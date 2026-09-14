/**
 * Unified client transaction engine — shared by Normal POS, Emergency/Rapid Capture, and Voice modes.
 * All modes must produce the same SaleTransaction shape and use saleToApiPayload for the API.
 */

import type { CartItem, Customer, PaymentBreakdown, PaymentMethod, Product, SaleTransaction } from '@/types/v1';
import { calculateSaleTotals, computeDiscountedSubtotal, effectiveUnitPrice } from '@/lib/taxComplianceSettings';
import type { TaxComplianceSettings } from '@/lib/taxComplianceSettings';

export type TransactionLifecycleStatus =
  | 'open'
  | 'pending_completion'
  | 'requires_attention'
  | 'ready_to_complete'
  | 'completed'
  | 'pending_credit'
  | 'cancelled'
  | 'voided'
  | 'refunded';

export const PENDING_STATUSES: TransactionLifecycleStatus[] = [
  'open',
  'pending_completion',
  'requires_attention',
  'ready_to_complete',
];

/** Parked sales awaiting payment — not autosave `open` cart drafts. */
export const AWAITING_PAYMENT_STATUSES: TransactionLifecycleStatus[] = [
  'pending_completion',
  'requires_attention',
  'ready_to_complete',
];

export const COMPLETED_STATUSES: TransactionLifecycleStatus[] = [
  'completed',
  'pending_credit',
];

export interface OpenTransactionDraft {
  id: string;
  clientTransactionId: string;
  updatedAt: string;
  cart: Array<{ productId: string; quantity: number; discountPercent: number }>;
  customerId?: string;
  customerName?: string;
  paymentMode: 'full' | 'partial' | 'credit';
  selectedPaymentMethod: PaymentMethod;
  amountPaidInput: string;
  status: TransactionLifecycleStatus;
  branchId?: string;
  tableId?: string;
  paymentDueDate?: string;
}

export interface CompletionGap {
  field: string;
  labelEn: string;
  labelSw: string;
  severity: 'critical' | 'warning';
}

const DRAFTS_KEY = (tenantId: string) => `duka_open_transactions_${tenantId}`;
const SYNC_QUEUE_KEY = (tenantId: string) => `duka_sync_queue_${tenantId}`;

export function generateClientTransactionId(): string {
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadOpenTransactions(tenantId: string): OpenTransactionDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY(tenantId));
    const list: OpenTransactionDraft[] = raw ? JSON.parse(raw) : [];
    const seen = new Set<string>();
    const deduped = list.filter(d => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    if (deduped.length !== list.length) {
      saveOpenTransactions(tenantId, deduped);
    }
    return deduped;
  } catch {
    return [];
  }
}

export function saveOpenTransactions(tenantId: string, drafts: OpenTransactionDraft[]): void {
  localStorage.setItem(DRAFTS_KEY(tenantId), JSON.stringify(drafts));
}

export function upsertOpenTransaction(tenantId: string, draft: OpenTransactionDraft): void {
  const list = loadOpenTransactions(tenantId).filter(d => d.id !== draft.id);
  saveOpenTransactions(tenantId, [draft, ...list]);
}

export function removeOpenTransaction(tenantId: string, id: string): void {
  saveOpenTransactions(tenantId, loadOpenTransactions(tenantId).filter(d => d.id !== id));
}

export interface SyncQueueItem {
  entity_type: string;
  entity_id: string;
  action: string;
  payload: Record<string, unknown>;
  client_timestamp?: string;
}

export function loadSyncQueue(tenantId: string): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY(tenantId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(tenantId: string, items: SyncQueueItem[]): void {
  localStorage.setItem(SYNC_QUEUE_KEY(tenantId), JSON.stringify(items));
}

export function analyzeCompletionGaps(
  sale: Partial<SaleTransaction>,
  isSw: boolean,
): CompletionGap[] {
  const gaps: CompletionGap[] = [];
  if (!sale.items?.length) {
    gaps.push({
      field: 'items',
      labelEn: 'Add at least one product',
      labelSw: 'Ongeza angalau bidhaa moja',
      severity: 'critical',
    });
  }
  const needsCustomer = sale.type === 'credit' || (sale.type === 'partial' && (sale.balanceRemaining ?? 0) > 0);
  const needsDueDate = (sale.balanceRemaining ?? 0) > 0;
  if (needsCustomer && !sale.customerId) {
    gaps.push({
      field: 'customer',
      labelEn: 'Customer required for credit/partial',
      labelSw: 'Mteja anahitajika kwa mkopo/malipo ya awamu',
      severity: 'critical',
    });
  }
  if (needsDueDate && !sale.paymentDueDate?.trim()) {
    gaps.push({
      field: 'payment_due_date',
      labelEn: 'Payment due date required',
      labelSw: 'Tarehe ya malipo inahitajika',
      severity: 'critical',
    });
  }
  const mobileMethods: PaymentMethod[] = ['mpesa', 'airtel', 'tigopesa', 'card'];
  const method = sale.payments?.[0]?.method;
  if (method && mobileMethods.includes(method) && !sale.payments?.[0]?.reference) {
    gaps.push({
      field: 'payment_reference',
      labelEn: 'Payment reference missing',
      labelSw: 'Nambari ya malipo haipo',
      severity: 'warning',
    });
  }
  if ((sale.total ?? 0) > 0 && (sale.paidAmount ?? 0) === 0 && sale.type === 'full') {
    gaps.push({
      field: 'payment_amount',
      labelEn: 'Payment amount missing',
      labelSw: 'Kiasi cha malipo hakijajazwa',
      severity: 'warning',
    });
  }
  return gaps;
}

export interface BuildSaleParams {
  cart: CartItem[];
  customer?: Customer | null;
  paymentMode: 'full' | 'partial' | 'credit';
  paymentMethod: PaymentMethod;
  amountPaid: number;
  taxSettings: TaxComplianceSettings;
  cashierName: string;
  clientTransactionId?: string;
  finalize: boolean;
  isSw?: boolean;
  branchId?: string;
  tableId?: string;
  receiptNumber?: string;
  cartDiscountPercent?: number;
  paymentDueDate?: string;
}

export function buildSaleFromCart(params: BuildSaleParams): SaleTransaction {
  const {
    cart,
    customer,
    paymentMode,
    paymentMethod,
    amountPaid,
    taxSettings,
    cashierName,
    finalize,
    isSw = false,
    branchId,
    tableId,
  } = params;

  const clientId = params.clientTransactionId ?? generateClientTransactionId();
  const { subtotal, discountAmount } = computeDiscountedSubtotal(
    cart.map(i => ({
      unitPrice: effectiveUnitPrice(i.product.price, i.unitPriceOverride),
      quantity: i.quantity,
      discountPercent: i.discountPercent,
    })),
    taxSettings,
  );
  const cartPct =
    taxSettings.cartDiscountEnabled && (params.cartDiscountPercent ?? 0) > 0
      ? params.cartDiscountPercent ?? 0
      : 0;
  const saleTotals = calculateSaleTotals({ subtotal, discountPercent: cartPct }, taxSettings);
  const total = saleTotals.total;
  const actualPaid =
    paymentMode === 'full' ? total : paymentMode === 'credit' ? 0 : amountPaid;
  const balanceRemaining = Math.max(0, total - actualPaid);

  const gaps = analyzeCompletionGaps(
    {
      items: cart.map(i => ({ productId: i.product.id, productName: i.product.name, quantity: i.quantity, unitPrice: i.product.price, total: i.product.price * i.quantity })),
      type: paymentMode,
      balanceRemaining,
      paidAmount: actualPaid,
      payments: [{ method: paymentMethod, amount: actualPaid }],
    },
    isSw,
  );

  let status: TransactionLifecycleStatus;
  if (!finalize) {
    status = gaps.some(g => g.severity === 'critical') ? 'requires_attention' : 'pending_completion';
  } else if (balanceRemaining > 0) {
    status = 'pending_credit';
  } else {
    status = 'completed';
  }

  const receiptNumber = params.receiptNumber ?? `DRAFT-${clientId.slice(-8).toUpperCase()}`;

  return {
    id: clientId,
    receiptNumber,
    date: new Date().toISOString().replace('T', ' ').slice(0, 16),
    customerId: customer?.id,
    customerName: customer?.name || (isSw ? 'Mteja wa Taslimu (Walk-in)' : 'Walk-in Customer'),
    items: cart.map(i => {
      const unit = effectiveUnitPrice(i.product.price, i.unitPriceOverride);
      const lineGross = unit * i.quantity;
      const pct = taxSettings.discountEnabled ? i.discountPercent : 0;
      const lineTotal = Math.round(lineGross * (1 - pct / 100));
      return {
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: unit,
        originalUnitPrice: i.product.price,
        discountPercent: pct,
        total: lineTotal,
      };
    }),
    subtotal: saleTotals.subtotal,
    discountAmount: discountAmount + saleTotals.discountAmount,
    cartDiscountPercent: cartPct,
    vatAmount: saleTotals.vatAmount,
    total,
    paidAmount: actualPaid,
    balanceRemaining,
    payments: [
      {
        method: paymentMethod,
        amount: actualPaid,
        reference: paymentMethod === 'mpesa' ? undefined : undefined,
      },
    ],
    type: paymentMode,
    cashierName,
    status,
    branchId,
    tableId,
    paymentDueDate:
      balanceRemaining > 0 && params.paymentDueDate?.trim()
        ? params.paymentDueDate.trim()
        : undefined,
  };
}

export function draftFromPosState(
  cart: CartItem[],
  opts: Omit<OpenTransactionDraft, 'id' | 'clientTransactionId' | 'updatedAt' | 'cart' | 'status'> & {
    id?: string;
    status?: TransactionLifecycleStatus;
  },
): OpenTransactionDraft {
  const draftId = opts.id ?? generateClientTransactionId();
  return {
    id: draftId,
    clientTransactionId: draftId,
    updatedAt: new Date().toISOString(),
    cart: cart.map(c => ({ productId: c.product.id, quantity: c.quantity, discountPercent: c.discountPercent })),
    customerId: opts.customerId,
    customerName: opts.customerName,
    paymentMode: opts.paymentMode,
    selectedPaymentMethod: opts.selectedPaymentMethod,
    amountPaidInput: opts.amountPaidInput,
    status: opts.status ?? 'open',
    branchId: opts.branchId,
    tableId: opts.tableId,
  };
}

export function restoreCartFromDraft(draft: OpenTransactionDraft, products: Product[]): CartItem[] {
  return draft.cart
    .map(c => {
      const product = products.find(p => p.id === c.productId);
      if (!product) return null;
      return { product, quantity: c.quantity, discountPercent: c.discountPercent };
    })
    .filter((x): x is CartItem => x !== null);
}

export function countPendingTransactions(tenantId: string): number {
  return loadOpenTransactions(tenantId).filter(d => PENDING_STATUSES.includes(d.status)).length;
}

/** Count only parked sales awaiting payment (excludes in-progress autosave carts). */
export function countAwaitingPaymentDrafts(tenantId: string): number {
  return loadOpenTransactions(tenantId).filter(d =>
    AWAITING_PAYMENT_STATUSES.includes(d.status),
  ).length;
}

export function shouldDeductStock(status: TransactionLifecycleStatus): boolean {
  return COMPLETED_STATUSES.includes(status);
}
