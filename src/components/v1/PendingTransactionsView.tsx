import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  User,
  CreditCard,
  Package,
} from 'lucide-react';
import type { Customer, Language, PaymentMethod, Product, SaleTransaction } from '@/types/v1';
import { formatTSh } from '@/utils/translations';
import {
  analyzeCompletionGaps,
  loadOpenTransactions,
  PENDING_STATUSES,
  removeOpenTransaction,
  type CompletionGap,
  type OpenTransactionDraft,
} from '@/lib/transactionEngine';

interface PendingTransactionsViewProps {
  language: Language;
  tenantId: string;
  products: Product[];
  customers: Customer[];
  pendingSales: SaleTransaction[];
  onResumeDraft: (draft: OpenTransactionDraft) => void;
  onResumePendingSale?: (sale: SaleTransaction) => void;
  onCompleteSale: (sale: SaleTransaction) => void;
  onFinalizePending: (
    sale: SaleTransaction,
    updates: {
      reference?: string;
      customerId?: string;
      customerName?: string;
      paymentMethod?: PaymentMethod;
      paidAmount?: number;
    },
  ) => void | Promise<void>;
  onNavigateToPOS?: () => void;
}

const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'cash', label: '💵 Cash' },
  { key: 'mpesa', label: '📱 M-Pesa' },
  { key: 'airtel', label: '🔴 Airtel' },
  { key: 'tigopesa', label: '🟢 Tigo Pesa' },
  { key: 'card', label: '💳 Card' },
];

const MOBILE_METHODS: PaymentMethod[] = ['mpesa', 'airtel', 'tigopesa', 'card'];

interface CompletionFormState {
  paymentMethod: PaymentMethod;
  amountPaid: string;
  reference: string;
  customerId: string;
}

function buildCompletionForm(sale: SaleTransaction): CompletionFormState {
  return {
    paymentMethod: sale.payments?.[0]?.method ?? 'cash',
    amountPaid: String(sale.payments?.[0]?.amount || sale.total || 0),
    reference: sale.payments?.[0]?.reference ?? '',
    customerId: sale.customerId ?? '',
  };
}

export const PendingTransactionsView: React.FC<PendingTransactionsViewProps> = ({
  language,
  tenantId,
  products,
  customers,
  pendingSales,
  onResumeDraft,
  onResumePendingSale,
  onCompleteSale,
  onFinalizePending,
  onNavigateToPOS,
}) => {
  const isSw = language === 'sw';
  const [filter, setFilter] = useState<'all' | 'critical' | 'payment' | 'customer'>('all');
  const [completionTarget, setCompletionTarget] = useState<{
    sale: SaleTransaction;
    gaps: CompletionGap[];
  } | null>(null);
  const [completionForm, setCompletionForm] = useState<CompletionFormState>({
    paymentMethod: 'cash',
    amountPaid: '',
    reference: '',
    customerId: '',
  });
  const [fixAllQueue, setFixAllQueue] = useState<number[]>([]);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const apiPending = useMemo(
    () => pendingSales.filter(s => PENDING_STATUSES.includes(s.status as typeof PENDING_STATUSES[number])),
    [pendingSales],
  );

  const apiPendingIds = useMemo(
    () => new Set(apiPending.map(s => s.id)),
    [apiPending],
  );

  const localDrafts = useMemo(() => {
    const seen = new Set<string>();
    return loadOpenTransactions(tenantId)
      .filter(d => PENDING_STATUSES.includes(d.status))
      .filter(d => !apiPendingIds.has(d.id) && !apiPendingIds.has(d.clientTransactionId))
      .filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });
  }, [tenantId, apiPendingIds, pendingSales.length]);

  const allPending = useMemo(() => {
    const fromApi = apiPending.map(s => ({ kind: 'sale' as const, sale: s, gaps: analyzeCompletionGaps(s, isSw) }));
    const fromLocal = localDrafts.map(d => ({
      kind: 'draft' as const,
      draft: d,
      gaps: [{ field: 'items', labelEn: 'Resume in POS', labelSw: 'Endelea kwenye POS', severity: 'warning' as const }],
    }));
    return [...fromApi, ...fromLocal];
  }, [apiPending, localDrafts, isSw]);

  const filtered = allPending.filter(entry => {
    if (filter === 'all') return true;
    const gaps = entry.kind === 'sale' ? entry.gaps : entry.gaps;
    if (filter === 'critical') return gaps.some(g => g.severity === 'critical');
    if (filter === 'payment') return gaps.some(g => g.field.includes('payment'));
    if (filter === 'customer') return gaps.some(g => g.field === 'customer');
    return true;
  });

  const openCompletionForm = (sale: SaleTransaction, gaps: CompletionGap[]) => {
    setCompletionTarget({ sale, gaps });
    setCompletionForm(buildCompletionForm(sale));
    setFinalizeError(null);
  };

  const closeCompletionForm = () => {
    setCompletionTarget(null);
    setCompletionForm({ paymentMethod: 'cash', amountPaid: '', reference: '', customerId: '' });
    setFinalizeError(null);
  };

  const previewSaleFromForm = (sale: SaleTransaction): SaleTransaction => {
    const paidAmount = Number(completionForm.amountPaid) || 0;
    const balanceRemaining = Math.max(0, sale.total - paidAmount);
    const type = balanceRemaining > 0 ? (paidAmount > 0 ? 'partial' : 'credit') : 'full';
    return {
      ...sale,
      customerId: completionForm.customerId || sale.customerId,
      customerName:
        customers.find(c => c.id === completionForm.customerId)?.name ?? sale.customerName,
      payments: [{
        method: completionForm.paymentMethod,
        amount: paidAmount,
        reference: completionForm.reference || undefined,
      }],
      paidAmount,
      balanceRemaining,
      type,
    };
  };

  const runCompletion = async () => {
    if (!completionTarget) return;
    const { sale } = completionTarget;
    const paidAmount = Number(completionForm.amountPaid) || 0;
    const needsCustomer = paidAmount < sale.total;
    if (needsCustomer && !completionForm.customerId) {
      setFinalizeError(
        isSw
          ? 'Chagua mteja kwa malipo ya mkopo au awamu.'
          : 'Select a customer for credit or partial payment.',
      );
      return;
    }
    if (MOBILE_METHODS.includes(completionForm.paymentMethod) && !completionForm.reference.trim()) {
      setFinalizeError(
        isSw
          ? 'Nambari ya malipo inahitajika kwa njia hii ya malipo.'
          : 'Payment reference is required for this payment method.',
      );
      return;
    }

    setFinalizeError(null);
    setFinalizingId(sale.id);
    try {
      const customer = customers.find(c => c.id === completionForm.customerId);
      await onFinalizePending(sale, {
        paymentMethod: completionForm.paymentMethod,
        paidAmount,
        reference: completionForm.reference.trim() || undefined,
        customerId: completionForm.customerId || undefined,
        customerName: customer?.name,
      });
      removeOpenTransaction(tenantId, sale.id);
      closeCompletionForm();
      if (fixAllQueue.length > 0) {
        const [nextIdx, ...rest] = fixAllQueue;
        setFixAllQueue(rest);
        const next = filtered[nextIdx];
        if (next?.kind === 'sale') {
          openCompletionForm(next.sale, next.gaps);
        }
      }
    } catch (err) {
      setFinalizeError(
        err instanceof Error
          ? err.message
          : isSw
            ? 'Imeshindwa kukamilisha mauzo. Hakikisha mtandao unafanya kazi na ujaribu tena.'
            : 'Could not complete sale. Check your connection and try again.',
      );
    } finally {
      setFinalizingId(null);
    }
  };

  const liveGaps = completionTarget
    ? analyzeCompletionGaps(previewSaleFromForm(completionTarget.sale), isSw)
    : [];

  const needsReferenceField = MOBILE_METHODS.includes(completionForm.paymentMethod);
  const needsCustomerField =
    liveGaps.some(g => g.field === 'customer') ||
    (Number(completionForm.amountPaid) || 0) < (completionTarget?.sale.total ?? 0);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8" />
          <div>
            <h2 className="text-xl font-black">
              {isSw ? 'Mauzo Yanayosubiri Malipo' : 'Pending Sales'}
            </h2>
            <p className="text-sm text-amber-100 mt-1">
              {isSw
                ? `${filtered.length} mauzo yamehifadhiwa bila malipo. Kamilisha malipo hapa — hakuna mauzo yaliyopotea.`
                : `${filtered.length} sale(s) saved without payment. Complete payment here — nothing is lost.`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'critical', 'payment', 'customer'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              filter === f ? 'bg-[#6264A7] text-white' : 'bg-white border border-[#E1DFDD] text-[#605E5C]'
            }`}
          >
            {f === 'all' ? (isSw ? 'Yote' : 'All') : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {filtered.filter(e => e.kind === 'sale').length > 1 && (
          <button
            type="button"
            onClick={() => {
              const saleIndices = filtered
                .map((e, i) => (e.kind === 'sale' ? i : -1))
                .filter(i => i >= 0);
              const [first, ...rest] = saleIndices;
              const firstEntry = filtered[first];
              if (firstEntry?.kind === 'sale') {
                setFixAllQueue(rest);
                openCompletionForm(firstEntry.sale, firstEntry.gaps);
              }
            }}
            className="ml-auto px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer"
          >
            {isSw ? 'Kamilisha Yote' : 'Complete All'}
          </button>
        )}
      </div>

      {finalizeError && !completionTarget && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {finalizeError}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E1DFDD] p-10 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-[#323130]">
            {isSw ? 'Hakuna mauzo yaliyosalia bila kukamilika.' : 'No pending transactions.'}
          </p>
          {onNavigateToPOS && (
            <button
              type="button"
              onClick={onNavigateToPOS}
              className="mt-4 px-4 py-2 rounded-xl bg-[#6264A7] text-white text-sm font-bold cursor-pointer"
            >
              {isSw ? 'Fungua POS' : 'Open POS'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((entry, idx) => {
            if (entry.kind === 'draft') {
              const d = entry.draft;
              const itemCount = d.cart.reduce((s, c) => s + c.quantity, 0);
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono text-[#605E5C]">{d.clientTransactionId.slice(0, 12)}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {isSw ? 'KIKAPU' : 'CART'}
                    </span>
                  </div>
                  <div className="font-bold text-[#323130]">{d.customerName || (isSw ? 'Mteja' : 'Customer')}</div>
                  <div className="text-sm text-[#605E5C]">{itemCount} {isSw ? 'bidhaa' : 'items'}</div>
                  <button
                    type="button"
                    onClick={() => onResumeDraft(d)}
                    className="w-full py-2.5 rounded-xl bg-[#6264A7] text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSw ? 'Endelea kwenye POS' : 'Continue in POS'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            }

            const { sale, gaps } = entry;
            return (
              <div key={sale.id} className="bg-white rounded-2xl border border-[#E1DFDD] p-5 space-y-3 shadow-xs">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono text-[#605E5C]">{sale.receiptNumber}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase">{sale.status}</span>
                </div>
                <div className="font-bold text-[#323130]">{sale.customerName}</div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#605E5C]">{sale.items.length} {isSw ? 'bidhaa' : 'items'}</span>
                  <span className="font-black text-emerald-700">{formatTSh(sale.total)}</span>
                </div>
                <ul className="space-y-1">
                  {gaps.map(g => (
                    <li key={g.field} className="flex items-center gap-2 text-xs text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {isSw ? g.labelSw : g.labelEn}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  {onResumePendingSale && (
                    <button
                      type="button"
                      onClick={() => onResumePendingSale(sale)}
                      className="flex-1 py-2.5 rounded-xl border border-[#6264A7] text-[#6264A7] text-sm font-bold cursor-pointer flex items-center justify-center gap-1"
                    >
                      {isSw ? 'Endelea kwenye POS' : 'Continue in POS'} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={finalizingId === sale.id}
                    onClick={() => openCompletionForm(sale, gaps)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    {finalizingId === sale.id
                      ? (isSw ? 'Inakamilisha…' : 'Completing…')
                      : (isSw ? 'Kamilisha Malipo' : 'Complete Payment')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-lg">
              {isSw ? 'Kamilisha Malipo' : 'Complete Payment'}
            </h3>
            <p className="text-sm text-[#605E5C]">
              {completionTarget.sale.receiptNumber} — {formatTSh(completionTarget.sale.total)}
            </p>

            <div className="rounded-xl bg-[#FAF9F8] border border-[#E1DFDD] p-3 space-y-2 text-sm">
              <p className="text-xs font-bold text-[#605E5C] uppercase">
                {isSw ? 'Imehifadhiwa tayari' : 'Already saved'}
              </p>
              <div className="flex items-center gap-2 text-emerald-700">
                <Package className="w-4 h-4 shrink-0" />
                {completionTarget.sale.items.length} {isSw ? 'bidhaa' : 'items'} ✓
              </div>
              <div className="flex items-center gap-2 text-[#323130]">
                <User className="w-4 h-4 shrink-0" />
                {completionTarget.sale.customerName || (isSw ? 'Mteja wa taslimu' : 'Walk-in customer')}
              </div>
              <div className="flex items-center gap-2 text-[#323130]">
                <Clock className="w-4 h-4 shrink-0" />
                {completionTarget.sale.date}
              </div>
            </div>

            {liveGaps.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-bold text-amber-900">
                  {isSw ? 'Jaza sehemu zinazokosekana' : 'Fill in missing details'}
                </p>
                {liveGaps.map(g => (
                  <div key={g.field} className="flex items-center gap-2 text-xs text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {isSw ? g.labelSw : g.labelEn}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#605E5C]">
                  {isSw ? 'Njia ya Malipo' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setCompletionForm(f => ({ ...f, paymentMethod: m.key }))}
                      className={`py-2 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        completionForm.paymentMethod === m.key
                          ? 'bg-[#0078D4] text-white border-[#0078D4]'
                          : 'bg-white border-[#E1DFDD] text-[#605E5C]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#605E5C]">
                  {isSw ? 'Kiasi Kilicholipwa (TZS)' : 'Amount Paid (TZS)'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={completionTarget.sale.total}
                  value={completionForm.amountPaid}
                  onChange={e => setCompletionForm(f => ({ ...f, amountPaid: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-[#E1DFDD] rounded-xl text-sm"
                />
                <p className="text-[10px] text-[#605E5C] mt-1">
                  {isSw ? 'Jumla' : 'Total'}: {formatTSh(completionTarget.sale.total)}
                  {(Number(completionForm.amountPaid) || 0) < completionTarget.sale.total && (
                    <> · {isSw ? 'Salio' : 'Balance'}: {formatTSh(completionTarget.sale.total - (Number(completionForm.amountPaid) || 0))}</>
                  )}
                </p>
              </div>

              {needsReferenceField && (
                <div>
                  <label className="text-xs font-bold text-[#605E5C]">
                    {isSw ? 'Nambari ya Malipo' : 'Payment Reference'} *
                  </label>
                  <input
                    value={completionForm.reference}
                    onChange={e => setCompletionForm(f => ({ ...f, reference: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-[#E1DFDD] rounded-xl text-sm"
                    placeholder={isSw ? 'M-Pesa / Card ref' : 'M-Pesa / Card ref'}
                  />
                </div>
              )}

              {needsCustomerField && (
                <div>
                  <label className="text-xs font-bold text-[#605E5C]">
                    {isSw ? 'Mteja (kwa mkopo/awamu)' : 'Customer (for credit/partial)'} *
                  </label>
                  <select
                    value={completionForm.customerId}
                    onChange={e => setCompletionForm(f => ({ ...f, customerId: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-[#E1DFDD] rounded-xl text-sm bg-white"
                  >
                    <option value="">{isSw ? 'Chagua mteja…' : 'Select customer…'}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `· ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {finalizeError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {finalizeError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  closeCompletionForm();
                  setFixAllQueue([]);
                }}
                className="flex-1 py-2.5 rounded-xl border border-[#E1DFDD] text-sm font-bold cursor-pointer"
              >
                {isSw ? 'Funga' : 'Close'}
              </button>
              <button
                type="button"
                disabled={finalizingId === completionTarget.sale.id}
                onClick={() => void runCompletion()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-1 disabled:opacity-60"
              >
                <CreditCard className="w-4 h-4" />
                {finalizingId === completionTarget.sale.id
                  ? (isSw ? 'Inakamilisha…' : 'Completing…')
                  : (isSw ? 'Kamilisha Mauzo' : 'Complete Sale')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
