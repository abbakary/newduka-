import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, AlertTriangle, Clock, Package, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { Card, Badge, Button, Input } from '@/components/ui';
import { cn, formatTSh, t } from '@/lib/utils';
import type { Product } from '@/types';

type FilterType = 'all' | 'low_stock' | 'expiring';

export function InventoryPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const { language, user } = useAuthStore();
  const lang = language;
  const isPharmacy = user?.business_type === 'pharmacy';

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, filter],
    queryFn: () => api.getProducts({
      ...(search ? { search } : {}),
      ...(filter === 'low_stock' ? { low_stock: true } : {}),
      ...(filter === 'expiring' ? { expiring: true } : {}),
    }),
  });

  const filters: { key: FilterType; label: string; icon: typeof Package }[] = [
    { key: 'all', label: lang === 'sw' ? 'Zote' : 'All', icon: Package },
    { key: 'low_stock', label: t('lowStock', lang), icon: AlertTriangle },
    { key: 'expiring', label: t('expiringSoon', lang), icon: Clock },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('inventory', lang)}</h1>
          <p className="text-sm text-slate-500">
            {isPharmacy
              ? (lang === 'sw' ? 'Dawa na bidhaa za afya' : 'Medicines & health products')
              : (lang === 'sw' ? 'Orodha ya bidhaa zote' : 'Full product catalog')}
          </p>
        </div>
        <Button><Package size={16} /> {lang === 'sw' ? 'Ongeza Bidhaa' : 'Add Product'}</Button>
      </div>

      {/* Business-type specific info banner */}
      {isPharmacy && (
        <Card className="p-4 bg-purple-50 border-purple-100">
          <p className="text-sm text-purple-800 font-medium">
            💊 {lang === 'sw'
              ? 'Hifadhi ya dawa: Fuata batch na tarehe ya kuisha. Bidhaa za Rx zinahitaji daktari.'
              : 'Pharmacy inventory: Track batch numbers & expiry dates. Rx items require prescription.'}
          </p>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search', lang)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex gap-2">
          {filters.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                filter === key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-200 text-slate-600'
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">{lang === 'sw' ? 'Bidhaa' : 'Product'}</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    {isPharmacy && <th className="px-4 py-3 font-medium">Batch</th>}
                    {isPharmacy && <th className="px-4 py-3 font-medium">{lang === 'sw' ? 'Kuisha' : 'Expiry'}</th>}
                    <th className="px-4 py-3 font-medium text-right">{lang === 'sw' ? 'Bei' : 'Price'}</th>
                    <th className="px-4 py-3 font-medium text-right">{lang === 'sw' ? 'Hifadhi' : 'Stock'}</th>
                    <th className="px-4 py-3 font-medium">{lang === 'sw' ? 'Hali' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <InventoryRow key={p.id} product={p} isPharmacy={isPharmacy} lang={lang} />
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {products.map((p) => (
              <ProductMobileCard key={p.id} product={p} isPharmacy={isPharmacy} lang={lang} />
            ))}
          </div>

          {products.length === 0 && (
            <Card className="p-8 text-center text-slate-400">
              <Filter size={32} className="mx-auto mb-2 opacity-50" />
              {lang === 'sw' ? 'Hakuna bidhaa zilizopatikana' : 'No products found'}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function InventoryRow({ product: p, isPharmacy, lang }: { product: Product; isPharmacy: boolean; lang: 'sw' | 'en' }) {
  const low = p.stock <= p.reorder_point;
  return (
    <tr className="border-t border-slate-50 hover:bg-slate-50/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{p.name}</span>
          {isPharmacy && p.requires_prescription && <Badge variant="rx">Rx</Badge>}
        </div>
        <span className="text-xs text-slate-400">{p.category}</span>
      </td>
      <td className="px-4 py-3 text-slate-500">{p.sku}</td>
      {isPharmacy && <td className="px-4 py-3 text-slate-500">{p.batch_number ?? '—'}</td>}
      {isPharmacy && (
        <td className="px-4 py-3 text-slate-500">
          {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : '—'}
        </td>
      )}
      <td className="px-4 py-3 text-right font-medium">{formatTSh(p.price)}</td>
      <td className="px-4 py-3 text-right">{p.stock} {p.unit}</td>
      <td className="px-4 py-3">
        {low ? <Badge variant="warning">{t('lowStock', lang)}</Badge> : <Badge variant="success">OK</Badge>}
      </td>
    </tr>
  );
}

function ProductMobileCard({ product: p, isPharmacy, lang }: { product: Product; isPharmacy: boolean; lang: 'sw' | 'en' }) {
  const low = p.stock <= p.reorder_point;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold">{p.name}</p>
          <p className="text-xs text-slate-400">{p.sku} · {p.category}</p>
        </div>
        {low ? <Badge variant="warning">{t('lowStock', lang)}</Badge> : <Badge variant="success">OK</Badge>}
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-bold text-brand-600">{formatTSh(p.price)}</span>
        <span>{p.stock} {p.unit}</span>
      </div>
      {isPharmacy && p.batch_number && (
        <p className="text-xs text-slate-400 mt-1">Batch: {p.batch_number}</p>
      )}
    </Card>
  );
}
