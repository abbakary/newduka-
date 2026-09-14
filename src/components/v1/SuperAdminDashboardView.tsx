import React, { useMemo } from 'react';
import { Building2, CreditCard, Download, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import {
  Language,
  PlatformMetrics,
  SaaSTransaction,
  TenantStore,
  VendorApplication,
} from '@/types/v1';
import { derivePaymentStatus, paymentStatusLabel, paymentStatusTone } from '@/lib/saasPlans';
import { exportSalesReport } from '@/utils/reportGenerator';

interface Props {
  language: Language;
  metrics: PlatformMetrics;
  tenants: TenantStore[];
  applications: VendorApplication[];
  transactions: SaaSTransaction[];
  onNavigate: (tab: string) => void;
  onImpersonateTenant: (tenant: TenantStore) => void;
}

export const SuperAdminDashboardView: React.FC<Props> = ({
  language,
  metrics,
  tenants,
  applications,
  transactions,
  onNavigate,
  onImpersonateTenant,
}) => {
  const isSw = language === 'sw';

  const paymentBreakdown = useMemo(() => {
    const counts = { paid: 0, unpaid: 0, overdue: 0, grace: 0, trial: 0 };
    tenants.forEach(t => {
      const ps = derivePaymentStatus(t.subscriptionExpiry, t.status);
      counts[ps]++;
    });
    return counts;
  }, [tenants]);

  const exportSummary = () => {
    exportSalesReport({
      provider: { businessName: 'Duka+ Provider', ownerName: 'Platform Admin', email: 'admin@dukaplus.co.tz' },
      sales: tenants.slice(0, 20).map(t => ({
        receipt: t.id,
        customer: t.name,
        date: t.createdAt,
        method: derivePaymentStatus(t.subscriptionExpiry, t.status).toUpperCase(),
        vat: '—',
        total: `TZS ${(t.mrrTzs || 0).toLocaleString()}`,
      })),
      totalGross: `TZS ${metrics.monthlySubscriptionRevenueTzs.toLocaleString()}`,
      totalVat: '—',
      grossProfit: `TZS ${metrics.monthlySubscriptionRevenueTzs.toLocaleString()}`,
      language: language as 'en' | 'sw',
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#D4AF37' }}>
            {isSw ? 'MTOA HUDUMA • WATEJA' : 'PROVIDER • CLIENT OPS'}
          </p>
          <h1 className="text-3xl font-serif font-bold text-[#003322] mt-1">
            {isSw ? 'Dashibodi ya Wateja' : 'Client management studio'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            {isSw
              ? 'Simamia usajili, malipo, vifurushi, na vikumbusho kwa wateja wote wa Duka+.'
              : 'Manage subscriptions, payments, plans, and reminders for all Duka+ clients.'}
          </p>
        </div>
        <button
          type="button"
          onClick={exportSummary}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-[#003322] cursor-pointer"
          style={{ backgroundColor: '#D4AF37' }}
        >
          <Download className="w-4 h-4" />
          {isSw ? 'Pakua muhtasari PDF' : 'Export summary PDF'}
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Building2, label: isSw ? 'Wateja wote' : 'Total clients', val: metrics.totalTenants || tenants.length, color: '#003322' },
          { icon: Users, label: isSw ? 'Hai (walio lipa)' : 'Active paid', val: paymentBreakdown.paid, color: '#0d9488' },
          { icon: AlertTriangle, label: isSw ? 'Haijalipwa / chelewa' : 'Unpaid / overdue', val: paymentBreakdown.unpaid + paymentBreakdown.overdue, color: '#dc2626' },
          { icon: CreditCard, label: isSw ? 'Mapato ya mwezi' : 'Monthly MRR', val: `TZS ${(metrics.monthlySubscriptionRevenueTzs || tenants.reduce((s, t) => s + t.mrrTzs, 0)).toLocaleString()}`, color: '#D4AF37' },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
            <k.icon className="w-5 h-5 mb-2" style={{ color: k.color }} />
            <div className="text-2xl font-black text-[#003322]">{k.val}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-[#003322] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#0d9488]" />
            {isSw ? 'Hali ya malipo' : 'Payment status'}
          </h2>
          <div className="mt-4 space-y-2">
            {(['paid', 'grace', 'overdue', 'trial'] as const).map(s => (
              <div key={s} className="flex items-center justify-between text-xs">
                <span className={`px-2 py-0.5 rounded-full border font-bold ${paymentStatusTone(s)}`}>
                  {paymentStatusLabel(s, isSw)}
                </span>
                <span className="font-mono font-bold">{paymentBreakdown[s]}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onNavigate('super-subscriptions')} className="mt-4 text-xs font-bold text-[#0d9488] cursor-pointer hover:underline">
            {isSw ? 'Simamia malipo →' : 'Manage payments →'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-[#003322]">{isSw ? 'Wateja wa hivi karibuni' : 'Recent clients'}</h2>
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {tenants.slice(0, 6).map(t => {
              const ps = derivePaymentStatus(t.subscriptionExpiry, t.status);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onImpersonateTenant(t)}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-left cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-[#003322]">{t.name}</div>
                    <div className="text-[10px] text-slate-500">{t.ownerEmail}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${paymentStatusTone(ps)}`}>
                    {paymentStatusLabel(ps, isSw)}
                  </span>
                </button>
              );
            })}
            {tenants.length === 0 && (
              <p className="text-xs text-slate-500">{isSw ? 'Hakuna wateja bado.' : 'No clients yet.'}</p>
            )}
          </div>
        </div>
      </div>

      {(applications.length > 0 || transactions.length > 0) && (
        <p className="text-[11px] text-slate-500">
          {applications.length} {isSw ? 'maombi ya KYC' : 'KYC applications'} · {transactions.length} {isSw ? 'malipo ya hivi karibuni' : 'recent payments'}
        </p>
      )}
    </div>
  );
};
