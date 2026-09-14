import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Package, AlertTriangle, Users, CreditCard, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { StatCard, Card, Badge } from '@/components/ui';
import { formatTSh, t } from '@/lib/utils';
import { useAuthStore } from '@/stores';

export function DashboardPage() {
  const { language, user } = useAuthStore();
  const lang = language;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard', lang)}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {user?.business_name} · {new Date().toLocaleDateString('en-TZ', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label={t('todayRevenue', lang)}
          value={formatTSh(s.today_revenue)}
          icon={<TrendingUp size={22} />}
          trend={`${s.today_sales_count} ${lang === 'sw' ? 'mauzo leo' : 'sales today'}`}
        />
        <StatCard
          label={lang === 'sw' ? 'Mapato Mwezi' : 'Monthly Revenue'}
          value={formatTSh(s.monthly_revenue)}
          icon={<TrendingUp size={22} />}
          color="blue"
        />
        <StatCard
          label={lang === 'sw' ? 'Bidhaa' : 'Products'}
          value={String(s.total_products)}
          icon={<Package size={22} />}
        />
        <StatCard
          label={t('lowStock', lang)}
          value={String(s.low_stock_count)}
          icon={<AlertTriangle size={22} />}
          color="amber"
        />
        <StatCard
          label={t('expiringSoon', lang)}
          value={String(s.expiring_soon_count)}
          icon={<Clock size={22} />}
          color="rose"
        />
        <StatCard
          label={t('customers', lang)}
          value={String(s.total_customers)}
          icon={<Users size={22} />}
          color="blue"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={20} className="text-brand-600" />
            <h3 className="font-semibold">{lang === 'sw' ? 'Madeni ya Wateja' : 'Receivables'}</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatTSh(s.outstanding_receivables)}</p>
          <p className="text-sm text-slate-500 mt-1">
            {lang === 'sw' ? 'Jumla ya deni la wateja' : 'Total customer outstanding balance'}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={20} className="text-rose-600" />
            <h3 className="font-semibold">{lang === 'sw' ? 'Malipo ya Wasambazaji' : 'Payables'}</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatTSh(s.outstanding_payables)}</p>
          <p className="text-sm text-slate-500 mt-1">
            {lang === 'sw' ? 'Deni la wasambazaji' : 'Supplier outstanding balance'}
          </p>
        </Card>
      </div>

      {(s.low_stock_count > 0 || s.expiring_soon_count > 0) && (
        <Card className="p-5">
          <h3 className="font-semibold mb-3">{lang === 'sw' ? 'Tahadhari' : 'Alerts'}</h3>
          <div className="flex flex-wrap gap-2">
            {s.low_stock_count > 0 && (
              <Badge variant="warning">
                {s.low_stock_count} {lang === 'sw' ? 'bidhaa chini ya kiwango' : 'items low stock'}
              </Badge>
            )}
            {s.expiring_soon_count > 0 && (
              <Badge variant="danger">
                {s.expiring_soon_count} {lang === 'sw' ? 'bidhaa zinakaribia kuisha' : 'items expiring soon'}
              </Badge>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
