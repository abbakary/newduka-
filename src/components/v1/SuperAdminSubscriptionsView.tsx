import React, { useState } from 'react';
import { CheckCircle2, Download, XCircle } from 'lucide-react';
import { Language, SaaSTransaction, SaaSPlanTier } from '@/types/v1';
import { addMonths, derivePaymentStatus, paymentStatusLabel, paymentStatusTone } from '@/lib/saasPlans';
import { useSaasPlans } from '@/context/SaasPlansContext';
import type { TenantStore } from '@/types/v1';
import { api } from '@/lib/api';
import { mapAdminTenant, mapSubscriptionPayment } from '@/lib/apiSync';
import { exportSalesReport } from '@/utils/reportGenerator';

interface Props {
  language: Language;
  transactions: SaaSTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<SaaSTransaction[]>>;
  tenants?: TenantStore[];
  setTenants?: React.Dispatch<React.SetStateAction<TenantStore[]>>;
}

export const SuperAdminSubscriptionsView: React.FC<Props> = ({
  setTransactions,
  tenants = [],
  setTenants,
}) => {
  const isSw = language === 'sw';
  const { plans: publicPlans } = useSaasPlans();
  const [recording, setRecording] = useState(false);
  const [form, setForm] = useState({ storeId: '', amount: '', reference: '', method: 'M-Pesa' as const });

  const recordPayment = async () => {
    const tenant = tenants.find(t => t.id === form.storeId);
    if (!tenant) return;
    const amount = Number(form.amount) || publicPlans.find(p => p.tier === tenant.plan)?.priceMonthlyTzs || 0;
    try {
      const raw = await api.recordSubscriptionPayment({
        store_id: tenant.id,
        amount_tzs: amount,
        payment_method: form.method,
        reference: form.reference || undefined,
        extend_months: 1,
      });
      const tx = mapSubscriptionPayment(raw as Record<string, unknown>);
      setTransactions(prev => [tx, ...prev]);
      const updated = await api.getAdminTenants();
      setTenants?.(updated.map(mapAdminTenant));
    } catch {
      const tx: SaaSTransaction = {
        id: `tx-${Date.now()}`,
        storeId: tenant.id,
        storeName: tenant.name,
        plan: tenant.plan,
        amountTzs: amount,
        paymentMethod: form.method,
        reference: form.reference || `MPESA-${Date.now()}`,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        status: 'completed',
        billingCycle: 'monthly',
      };
      setTransactions(prev => [tx, ...prev]);
      setTenants?.(prev =>
        prev.map(t =>
          t.id === tenant.id
            ? { ...t, status: 'active', subscriptionExpiry: addMonths(t.subscriptionExpiry, 1), mrrTzs: amount }
            : t,
        ),
      );
    }
    setRecording(false);
    setForm({ storeId: '', amount: '', reference: '', method: 'M-Pesa' });
  };

  const exportTx = () => {
    exportSalesReport({
      provider: { businessName: 'Duka+ Provider', ownerName: 'Admin', email: 'admin@dukaplus.co.tz' },
      sales: transactions.map(tx => ({
        receipt: tx.reference,
        customer: tx.storeName,
        date: tx.date,
        method: tx.paymentMethod,
        vat: tx.status,
        total: `TZS ${tx.amountTzs.toLocaleString()}`,
      })),
      totalGross: `TZS ${transactions.filter(t => t.status === 'completed').reduce((s, t) => s + t.amountTzs, 0).toLocaleString()}`,
      totalVat: '—',
      grossProfit: '—',
      language: language as 'en' | 'sw',
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
            {isSw ? 'MALIPO & USAJILI' : 'PAYMENTS & SUBSCRIPTIONS'}
          </p>
          <h1 className="text-2xl font-serif font-bold text-[#003322]">
            {isSw ? 'Malipo ya wateja' : 'Client payments'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRecording(true)} className="px-4 py-2 rounded-full text-sm font-bold text-[#003322] cursor-pointer" style={{ backgroundColor: '#D4AF37' }}>
            {isSw ? '+ Rekodi malipo' : '+ Record payment'}
          </button>
          <button type="button" onClick={exportTx} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-[#0d9488] text-[#0d9488] text-xs font-bold cursor-pointer">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </header>

      {recording && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-sm">{isSw ? 'Rekodi malipo ya M-Pesa' : 'Record M-Pesa payment'}</h3>
          <select value={form.storeId} onChange={e => setForm(f => ({ ...f, storeId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">{isSw ? 'Chagua mteja' : 'Select client'}</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input placeholder={isSw ? 'Kiasi (TZS)' : 'Amount (TZS)'} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder={isSw ? 'Nambari ya kumbukumbu' : 'Reference no.'} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={recordPayment} className="px-4 py-2 rounded-xl bg-[#0d9488] text-white text-xs font-bold cursor-pointer">{isSw ? 'Hifadhi' : 'Save'}</button>
            <button type="button" onClick={() => setRecording(false)} className="px-4 py-2 rounded-xl border text-xs cursor-pointer">{isSw ? 'Ghairi' : 'Cancel'}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[#003322] text-white">
            <tr>
              <th className="text-left p-3">{isSw ? 'Mteja' : 'Client'}</th>
              <th className="text-left p-3">{isSw ? 'Kiasi' : 'Amount'}</th>
              <th className="text-left p-3">{isSw ? 'Njia' : 'Method'}</th>
              <th className="text-left p-3">{isSw ? 'Hali' : 'Status'}</th>
              <th className="text-left p-3">{isSw ? 'Tarehe' : 'Date'}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold">{tx.storeName}</td>
                <td className="p-3">TZS {tx.amountTzs.toLocaleString()}</td>
                <td className="p-3">{tx.paymentMethod}</td>
                <td className="p-3">
                  {tx.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-600"><XCircle className="w-3.5 h-3.5" /> {tx.status}</span>
                  )}
                </td>
                <td className="p-3 text-slate-500">{tx.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <p className="p-6 text-center text-slate-500 text-sm">{isSw ? 'Hakuna malipo bado.' : 'No payments yet.'}</p>
        )}
      </div>

      {tenants.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-[#003322] mb-2">{isSw ? 'Hali ya usajili kwa mteja' : 'Subscription status by client'}</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {tenants.slice(0, 8).map(t => {
              const ps = derivePaymentStatus(t.subscriptionExpiry, t.status);
              return (
                <div key={t.id} className="flex justify-between items-center p-3 bg-white rounded-xl border text-xs">
                  <span className="font-semibold truncate pr-2">{t.name}</span>
                  <span className={`px-2 py-0.5 rounded-full border font-bold shrink-0 ${paymentStatusTone(ps)}`}>
                    {paymentStatusLabel(ps, isSw)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
