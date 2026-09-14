import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { useCartStore, useAuthStore, useOfflineStore } from '@/stores';
import { Button, Card, Badge, Input } from '@/components/ui';
import { cn, formatTSh, t } from '@/lib/utils';
import type { Product, PaymentMethod } from '@/types';

const VAT_RATE = 0.18;

export function POSPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showCheckout, setShowCheckout] = useState(false);
  const { items, addItem, removeItem, updateQuantity, clear, total } = useCartStore();
  const { language, user } = useAuthStore();
  const { isOnline } = useOfflineStore();
  const queryClient = useQueryClient();
  const lang = language;

  const { data: products = [] } = useQuery({
    queryKey: ['products', search],
    queryFn: () => api.getProducts(search ? { search } : {}),
  });

  const categories = ['All', ...new Set(products.map((p) => p.category))];

  const filtered = selectedCategory === 'All'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const subtotal = total();
  const vat = Math.round(subtotal * VAT_RATE);
  const grandTotal = subtotal + vat;

  const saleMutation = useMutation({
    mutationFn: () => api.createSale({
      items: items.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price,
        total: i.product.price * i.quantity * (1 - i.discountPercent / 100),
      })),
      payments: [{ method: paymentMethod, amount: grandTotal }],
      sale_type: 'full',
    }),
    onSuccess: () => {
      clear();
      setShowCheckout(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const isPharmacy = user?.business_type === 'pharmacy';

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 -m-4 md:-m-6 p-4 md:p-6">
      {/* Product grid */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl font-bold">{t('pos', lang)}</h1>
          {!isOnline && <Badge variant="warning">{t('offline', lang)}</Badge>}
        </div>

        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search', lang)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                selectedCategory === cat ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 content-start">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isPharmacy={isPharmacy}
              onAdd={() => addItem(product)}
              lang={lang}
            />
          ))}
        </div>
      </div>

      {/* Cart panel */}
      <Card className="w-full lg:w-96 flex flex-col shrink-0 max-h-[50vh] lg:max-h-none">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-bold text-lg">
            {lang === 'sw' ? 'Kikapu' : 'Cart'} ({items.length})
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">
              {lang === 'sw' ? 'Ongeza bidhaa hapa' : 'Add products here'}
            </p>
          ) : items.map((item) => (
            <div key={item.product.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.product.name}</p>
                <p className="text-xs text-slate-500">{formatTSh(item.product.price)} × {item.quantity}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1 rounded-lg hover:bg-slate-100">
                  <Minus size={14} />
                </button>
                <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-1 rounded-lg hover:bg-slate-100">
                  <Plus size={14} />
                </button>
                <button onClick={() => removeItem(item.product.id)} className="p-1 rounded-lg hover:bg-rose-50 text-rose-500 ml-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-slate-100 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatTSh(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">VAT 18%</span><span>{formatTSh(vat)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span className="text-brand-600">{formatTSh(grandTotal)}</span></div>
            </div>

            {!showCheckout ? (
              <Button className="w-full" size="lg" onClick={() => setShowCheckout(true)}>
                {t('checkout', lang)}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['cash', Banknote, lang === 'sw' ? 'Taslimu' : 'Cash'],
                    ['mpesa', Smartphone, 'M-Pesa'],
                    ['card', CreditCard, 'Card'],
                  ] as const).map(([method, Icon, label]) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-colors',
                        paymentMethod === method ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200'
                      )}
                    >
                      <Icon size={18} />
                      {label}
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => saleMutation.mutate()}
                  disabled={saleMutation.isPending}
                >
                  {saleMutation.isPending ? '...' : `${lang === 'sw' ? 'Thibitisha' : 'Confirm'} · ${formatTSh(grandTotal)}`}
                </Button>
                {saleMutation.isSuccess && (
                  <p className="text-center text-brand-600 text-sm font-semibold">
                    ✓ {lang === 'sw' ? 'Mauzo yamekamilika!' : 'Sale completed!'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProductCard({
  product, isPharmacy, onAdd, lang,
}: { product: Product; isPharmacy: boolean; onAdd: () => void; lang: 'sw' | 'en' }) {
  const lowStock = product.stock <= product.reorder_point;
  return (
    <button
      onClick={onAdd}
      disabled={product.stock <= 0}
      className="text-left p-3 rounded-xl border border-slate-100 bg-white hover:border-brand-300 hover:shadow-sm transition-all disabled:opacity-40"
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
        {isPharmacy && product.requires_prescription && <Badge variant="rx">Rx</Badge>}
      </div>
      <p className="text-xs text-slate-400 mb-2">{product.sku}</p>
      <div className="flex items-end justify-between">
        <p className="text-sm font-bold text-brand-600">{formatTSh(product.price)}</p>
        <p className={cn('text-[10px] font-medium', lowStock ? 'text-amber-600' : 'text-slate-400')}>
          {product.stock} {product.unit}
        </p>
      </div>
      {isPharmacy && product.expiry_date && (
        <p className="text-[10px] text-slate-400 mt-1">Exp: {new Date(product.expiry_date).toLocaleDateString()}</p>
      )}
    </button>
  );
}
