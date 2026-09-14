import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Phone, Mail, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { Card, Badge } from '@/components/ui';
import { formatTSh, t } from '@/lib/utils';

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const { language } = useAuthStore();
  const lang = language;

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.getCustomers(search || undefined),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('customers', lang)}</h1>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search', lang)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <Badge variant={c.loyalty_tier === 'Gold' ? 'success' : 'default'}>{c.loyalty_tier}</Badge>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-slate-500">
                {c.phone && <p className="flex items-center gap-2"><Phone size={14} /> {c.phone}</p>}
                {c.email && <p className="flex items-center gap-2"><Mail size={14} /> {c.email}</p>}
                <p className="flex items-center gap-2">
                  <CreditCard size={14} />
                  {lang === 'sw' ? 'Deni' : 'Balance'}: <span className={c.balance > 0 ? 'text-rose-600 font-semibold' : 'text-brand-600'}>
                    {formatTSh(c.balance)}
                  </span>
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
