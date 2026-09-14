import React, { useMemo, useState } from 'react';

import {

  Ban,

  Bell,

  Calendar,

  CheckCircle2,

  Download,

  Loader2,

  Search,

  ShieldCheck,

  Unlock,

  UserCheck,

  Wallet,

} from 'lucide-react';

import { Language, SaaSPlanTier, TenantStore } from '@/types/v1';

import { derivePaymentStatus, paymentStatusLabel, paymentStatusTone, planLabel } from '@/lib/saasPlans';

import { useSaasPlans } from '@/context/SaasPlansContext';

import { api } from '@/lib/api';

import { mapAdminTenant } from '@/lib/apiSync';

import { exportSalesReport } from '@/utils/reportGenerator';



interface Props {

  language: Language;

  tenants: TenantStore[];

  setTenants: React.Dispatch<React.SetStateAction<TenantStore[]>>;

  onImpersonateTenant: (tenant: TenantStore) => void;

}



async function reloadTenants(setTenants: Props['setTenants']) {

  const updated = await api.getAdminTenants();

  setTenants(updated.map(mapAdminTenant));

}



export const SuperAdminTenantsView: React.FC<Props> = ({

  language,

  tenants,

  setTenants,

  onImpersonateTenant,

}) => {

  const isSw = language === 'sw';

  const { plans } = useSaasPlans();

  const [q, setQ] = useState('');

  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  const [busyId, setBusyId] = useState<string | null>(null);

  const [payModal, setPayModal] = useState<TenantStore | null>(null);

  const [payForm, setPayForm] = useState({ months: 1, method: 'M-Pesa', reference: '', amount: '' });

  const [createOpen, setCreateOpen] = useState(false);

  const [createBusy, setCreateBusy] = useState(false);

  const [createError, setCreateError] = useState('');

  const [createForm, setCreateForm] = useState({

    business_name: '',

    owner_name: '',

    email: '',

    phone: '+255',

    password: '',

    business_type: 'retail',

    plan: 'starter',

  });



  const filtered = useMemo(() => {

    return tenants.filter(t => {

      const ps = derivePaymentStatus(t.subscriptionExpiry, t.status);

      const isPaid = ps === 'paid';

      const isUnpaid = ps === 'unpaid' || ps === 'overdue' || ps === 'grace';

      if (filter === 'paid' && !isPaid) return false;

      if (filter === 'unpaid' && !isUnpaid) return false;

      const hay = `${t.name} ${t.ownerEmail} ${t.region} ${t.ownerName}`.toLowerCase();

      return hay.includes(q.toLowerCase());

    });

  }, [tenants, q, filter]);



  const runAction = async (id: string, fn: () => Promise<void>) => {

    setBusyId(id);

    try {

      await fn();

      try {

        await reloadTenants(setTenants);

      } catch {

        /* keep optimistic state */

      }

    } finally {

      setBusyId(null);

    }

  };



  const openPayModal = (t: TenantStore) => {

    const price = plans.find(p => p.tier === t.plan)?.priceMonthlyTzs ?? t.mrrTzs;

    setPayForm({ months: 1, method: 'M-Pesa', reference: `MPESA-${Date.now()}`, amount: String(price) });

    setPayModal(t);

  };



  const submitPayment = async () => {

    if (!payModal) return;

    const id = payModal.id;

    await runAction(id, async () => {

      await api.recordSubscriptionPayment({

        store_id: id,

        amount_tzs: Number(payForm.amount) || undefined,

        payment_method: payForm.method,

        reference: payForm.reference,

        billing_cycle: 'monthly',

        extend_months: payForm.months,

      });

      setPayModal(null);

    });

  };



  const markPaidQuick = (id: string, months = 1) =>

    runAction(id, () => api.updateAdminTenant(id, { extend_months: months, status: 'active' }));



  const suspend = (id: string) => runAction(id, () => api.suspendTenant(id));

  const reactivate = (id: string) => runAction(id, () => api.reactivateTenant(id));

  const setGrace = (id: string) => runAction(id, () => api.setTenantGrace(id));

  const approveKyc = (id: string) => runAction(id, () => api.approveTenantKyc(id));



  const changePlan = (id: string, plan: SaaSPlanTier) =>

    runAction(id, () => api.updateAdminTenant(id, { plan }));



  const setExpiry = (id: string, date: string) =>

    runAction(id, () => api.updateAdminTenant(id, { subscription_expiry: date }));



  const sendReminder = (t: TenantStore) =>

    runAction(t.id, () =>

      api.sendAdminBroadcast({

        title: isSw ? 'Kumbusho la malipo — Duka+' : 'Payment reminder — Duka+',

        message: isSw

          ? `Habari ${t.ownerName}, usajili wa ${t.name} unahitaji malipo. Tafadhali lipia kupitia M-Pesa.`

          : `Hello ${t.ownerName}, subscription for ${t.name} requires payment. Please pay via M-Pesa.`,

        target: 'unpaid',

        channel: 'both',

      }),

    );



  const exportList = () => {

    exportSalesReport({

      provider: { businessName: 'Duka+ Provider', ownerName: 'Admin', email: 'admin@dukaplus.co.tz' },

      sales: filtered.map(t => ({

        receipt: t.id,

        customer: t.name,

        date: t.subscriptionExpiry,

        method: planLabel(t.plan, isSw, plans),

        vat: paymentStatusLabel(derivePaymentStatus(t.subscriptionExpiry, t.status), isSw),

        total: `TZS ${t.mrrTzs.toLocaleString()}`,

      })),

      totalGross: `${filtered.length} clients`,

      totalVat: '—',

      grossProfit: '—',

      language: language as 'en' | 'sw',

    });

  };



  const createAccount = async () => {

    setCreateError('');

    const email = createForm.email.trim().toLowerCase();

    if (!createForm.business_name.trim() || !createForm.owner_name.trim()) {

      setCreateError(isSw ? 'Jaza jina la biashara na mmiliki.' : 'Enter business and owner names.');

      return;

    }

    if (!email || !email.includes('@')) {

      setCreateError(isSw ? 'Weka barua pepe sahihi (lazima iwe na @).' : 'Enter a valid owner email (must include @).');

      return;

    }

    if (createForm.password.trim().length < 6) {

      setCreateError(isSw ? 'Nenosiri angalau herufi 6.' : 'Password must be at least 6 characters.');

      return;

    }

    setCreateBusy(true);

    try {

      await api.createAdminTenant({

        business_name: createForm.business_name.trim(),

        owner_name: createForm.owner_name.trim(),

        email,

        phone: createForm.phone.trim() || '+255700000000',

        password: createForm.password.trim(),

        business_type: createForm.business_type,

        plan: createForm.plan,

        status: 'active',

      });

      await reloadTenants(setTenants);

      setCreateOpen(false);

      setCreateForm({

        business_name: '',

        owner_name: '',

        email: '',

        phone: '+255',

        password: '',

        business_type: 'retail',

        plan: 'starter',

      });

    } catch (err) {

      setCreateError(err instanceof Error ? err.message : 'Failed to create account');

    } finally {

      setCreateBusy(false);

    }

  };



  return (

    <div className="space-y-5 pb-10">

      <header>

        <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">

          {isSw ? 'ORODHA YA WATEJA' : 'CLIENT DIRECTORY'}

        </p>

        <h1 className="text-2xl font-serif font-bold text-[#003322]">{isSw ? 'Wateja wote' : 'All clients'}</h1>

        <p className="text-sm text-slate-600 mt-1">

          {isSw

            ? 'Simamia malipo, zuia huduma kwa wateja wasiolipa, na ingia kama mteja.'

            : 'Manage payments, block unpaid clients, and impersonate shops.'}

        </p>

      </header>



      <div className="flex flex-wrap gap-3 items-center">

        <div className="relative flex-1 min-w-[200px] max-w-md">

          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

          <input

            value={q}

            onChange={e => setQ(e.target.value)}

            placeholder={isSw ? 'Tafuta wateja…' : 'Search clients…'}

            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"

          />

        </div>

        {(['all', 'paid', 'unpaid'] as const).map(f => (

          <button

            key={f}

            type="button"

            onClick={() => setFilter(f)}

            className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${

              filter === f ? 'bg-[#003322] text-white' : 'bg-white border border-slate-200'

            }`}

          >

            {f === 'all' ? (isSw ? 'Wote' : 'All') : f === 'paid' ? (isSw ? 'Walio lipa' : 'Paid') : (isSw ? 'Hawajalipa' : 'Unpaid')}

          </button>

        ))}

        <button

          type="button"

          onClick={exportList}

          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-[#0d9488] text-[#0d9488] text-xs font-bold cursor-pointer"

        >

          <Download className="w-4 h-4" /> PDF

        </button>

        <button

          type="button"

          onClick={() => {

            setCreateError('');

            setCreateOpen(true);

          }}

          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#003322] text-white text-xs font-bold cursor-pointer"

        >

          {isSw ? '+ Akaunti mpya' : '+ New account'}

        </button>

      </div>



      <div className="space-y-3">

        {filtered.map(t => {

          const ps = derivePaymentStatus(t.subscriptionExpiry, t.status);

          const blocked = t.status === 'suspended' || ps === 'overdue';

          const busy = busyId === t.id;



          return (

            <div

              key={t.id}

              className={`bg-white rounded-2xl border p-4 shadow-sm ${blocked ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'}`}

              style={{ borderLeftWidth: 4, borderLeftColor: blocked ? '#e11d48' : '#003322' }}

            >

              <div className="flex flex-wrap gap-4 items-start">

                <div className="flex-1 min-w-[220px]">

                  <div className="text-[10px] font-bold uppercase text-[#D4AF37]">{t.region} • {t.type}</div>

                  <div className="font-bold text-[#003322] text-lg">{t.name}</div>

                  <div className="text-xs text-slate-500">{t.ownerName} · {t.ownerEmail}</div>

                  <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-2 items-center">

                    <span>{planLabel(t.plan, isSw, plans)}</span>

                    <span>·</span>

                    <span>{isSw ? 'Inaisha' : 'Expires'} {t.subscriptionExpiry || '—'}</span>

                    {blocked && (

                      <span className="text-rose-700 font-bold">{isSw ? '· Huduma imezuiwa' : '· Service blocked'}</span>

                    )}

                  </div>

                </div>



                <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold h-fit ${paymentStatusTone(ps)}`}>

                  {paymentStatusLabel(ps, isSw)}

                </span>

              </div>



              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">

                <button

                  type="button"

                  disabled={busy}

                  onClick={() => onImpersonateTenant(t)}

                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#0d9488] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"

                >

                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}

                  {isSw ? 'Ingia kama mteja' : 'Login as client'}

                </button>



                <button

                  type="button"

                  disabled={busy}

                  onClick={() => openPayModal(t)}

                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"

                >

                  <Wallet className="w-3.5 h-3.5" />

                  {isSw ? 'Rekodi malipo' : 'Record payment'}

                </button>



                <button

                  type="button"

                  disabled={busy}

                  onClick={() => markPaidQuick(t.id, 1)}

                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-emerald-400 text-emerald-800 text-[11px] font-bold cursor-pointer disabled:opacity-50"

                >

                  <CheckCircle2 className="w-3.5 h-3.5" />

                  {isSw ? 'Weka imelipwa (+1m)' : 'Mark paid (+1 mo)'}

                </button>



                {t.status === 'suspended' || blocked ? (

                  <button

                    type="button"

                    disabled={busy}

                    onClick={() => reactivate(t.id)}

                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-teal-400 text-teal-800 text-[11px] font-bold cursor-pointer"

                  >

                    <Unlock className="w-3.5 h-3.5" />

                    {isSw ? 'Fungua huduma' : 'Unblock access'}

                  </button>

                ) : (

                  <button

                    type="button"

                    disabled={busy}

                    onClick={() => suspend(t.id)}

                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-rose-300 text-rose-700 text-[11px] font-bold cursor-pointer"

                  >

                    <Ban className="w-3.5 h-3.5" />

                    {isSw ? 'Zuia huduma' : 'Block access'}

                  </button>

                )}



                <button

                  type="button"

                  disabled={busy}

                  onClick={() => setGrace(t.id)}

                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-amber-300 text-amber-800 text-[11px] font-bold cursor-pointer"

                >

                  <ShieldCheck className="w-3.5 h-3.5" />

                  {isSw ? 'Muda wa rehema' : 'Grace period'}

                </button>



                {t.status === 'pending_kyc' && (

                  <button

                    type="button"

                    disabled={busy}

                    onClick={() => approveKyc(t.id)}

                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-blue-300 text-blue-800 text-[11px] font-bold cursor-pointer"

                  >

                    {isSw ? 'Idhinisha KYC' : 'Approve KYC'}

                  </button>

                )}



                <button

                  type="button"

                  disabled={busy}

                  onClick={() => sendReminder(t)}

                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"

                >

                  <Bell className="w-3.5 h-3.5" />

                  {isSw ? 'Tuma kumbusho' : 'Send reminder'}

                </button>



                <select

                  value={t.plan}

                  disabled={busy}

                  onChange={e => changePlan(t.id, e.target.value as SaaSPlanTier)}

                  className="text-[11px] border border-slate-200 rounded-lg px-2 py-2 bg-white"

                  title={isSw ? 'Badili kifurushi' : 'Change plan'}

                >

                  {plans.map(p => (

                    <option key={p.tier} value={p.tier}>{isSw ? p.nameSw : p.name}</option>

                  ))}

                </select>



                <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 bg-white">

                  <Calendar className="w-3.5 h-3.5" />

                  <input

                    type="date"

                    defaultValue={t.subscriptionExpiry?.slice(0, 10)}

                    onBlur={e => {

                      if (e.target.value) setExpiry(t.id, e.target.value);

                    }}

                    className="text-[11px] outline-none w-[118px]"

                  />

                </label>

              </div>

            </div>

          );

        })}

        {filtered.length === 0 && (

          <div className="text-center py-12 text-slate-500 text-sm">{isSw ? 'Hakuna wateja.' : 'No clients found.'}</div>

        )}

      </div>



      {createOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-3">

            <h3 className="font-bold text-lg text-[#003322]">

              {isSw ? 'Sajili akaunti mpya ya duka' : 'Create new shop account'}

            </h3>

            {createError && (

              <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">

                {createError}

              </div>

            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <div className="sm:col-span-2">

                <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Jina la biashara' : 'Business name'}</label>

                <input

                  value={createForm.business_name}

                  onChange={e => setCreateForm(f => ({ ...f, business_name: e.target.value }))}

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

                />

              </div>

              <div>

                <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Jina la mmiliki' : 'Owner name'}</label>

                <input

                  value={createForm.owner_name}

                  onChange={e => setCreateForm(f => ({ ...f, owner_name: e.target.value }))}

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

                />

              </div>

              <div>

                <label className="text-[10px] font-bold text-slate-500 uppercase">Email *</label>

                <input

                  type="email"

                  required

                  value={createForm.email}

                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}

                  placeholder="owner@shop.co.tz"

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

                />

              </div>

              <div>

                <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Simu' : 'Phone'}</label>

                <input

                  value={createForm.phone}

                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

                />

              </div>

              <div>

                <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Nenosiri' : 'Password'}</label>

                <input

                  type="password"

                  value={createForm.password}

                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

                />

              </div>

              <div>

                <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Aina' : 'Type'}</label>

                <select

                  value={createForm.business_type}

                  onChange={e => setCreateForm(f => ({ ...f, business_type: e.target.value }))}

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

                >

                  <option value="retail">Retail</option>

                  <option value="pharmacy">Pharmacy</option>

                  <option value="wholesale">Wholesale</option>

                  <option value="restaurant">Restaurant</option>

                </select>

              </div>

              <div>

                <label className="text-[10px] font-bold text-slate-500 uppercase">Plan</label>

                <select

                  value={createForm.plan}

                  onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value }))}

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

                >

                  <option value="starter">Starter</option>

                  <option value="growth">Growth</option>

                  <option value="pro">Pro</option>

                </select>

              </div>

            </div>

            <div className="flex justify-end gap-2 pt-2">

              <button

                type="button"

                onClick={() => setCreateOpen(false)}

                className="px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer"

              >

                {isSw ? 'Ghairi' : 'Cancel'}

              </button>

              <button

                type="button"

                disabled={createBusy}

                onClick={() => void createAccount()}

                className="px-3 py-2 rounded-xl bg-[#003322] text-white text-xs font-bold cursor-pointer disabled:opacity-50"

              >

                {createBusy ? (isSw ? 'Inasajili…' : 'Creating…') : (isSw ? 'Sajili' : 'Create')}

              </button>

            </div>

          </div>

        </div>

      )}



      {payModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">

            <h3 className="font-bold text-lg text-[#003322]">

              {isSw ? 'Rekodi malipo' : 'Record payment'} — {payModal.name}

            </h3>

            <div className="grid grid-cols-2 gap-3">

              <div>

                <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Miezi' : 'Months'}</label>

                <input

                  type="number"

                  min={1}

                  max={24}

                  value={payForm.months}

                  onChange={e => setPayForm(f => ({ ...f, months: Number(e.target.value) }))}

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

                />

              </div>

              <div>

                <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Kiasi (TZS)' : 'Amount (TZS)'}</label>

                <input

                  type="number"

                  value={payForm.amount}

                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}

                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono"

                />

              </div>

            </div>

            <div>

              <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Njia ya malipo' : 'Payment method'}</label>

              <select

                value={payForm.method}

                onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}

                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"

              >

                <option value="M-Pesa">M-Pesa</option>

                <option value="Bank Transfer">Bank Transfer</option>

                <option value="Tigo Pesa">Tigo Pesa</option>

                <option value="Cash">Cash</option>

              </select>

            </div>

            <div>

              <label className="text-[10px] font-bold text-slate-500 uppercase">{isSw ? 'Nambari ya kumbukumbu' : 'Reference'}</label>

              <input

                value={payForm.reference}

                onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}

                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono"

              />

            </div>

            <div className="flex gap-2 pt-2">

              <button

                type="button"

                onClick={() => setPayModal(null)}

                className="flex-1 py-2.5 rounded-xl border text-sm font-bold cursor-pointer"

              >

                {isSw ? 'Ghairi' : 'Cancel'}

              </button>

              <button

                type="button"

                disabled={busyId === payModal.id}

                onClick={() => void submitPayment()}

                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer disabled:opacity-60"

              >

                {busyId === payModal.id ? (isSw ? 'Inahifadhi…' : 'Saving…') : (isSw ? 'Thibitisha malipo' : 'Confirm payment')}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

};


