import type { SaleTransaction } from '@/types/v1';
import { computeSaleDiscountAmount } from './saleDiscountUtils';
import type { DocumentRenderData, DocumentType } from './documentTemplates';
import { formatDueDateDisplay } from './dueDate';

const DOC_PREFIX: Record<DocumentType, string> = {
  invoice: 'INV',
  delivery_note: 'DN',
  order_note: 'ON',
};

export function saleDocumentNumber(sale: SaleTransaction, type: DocumentType): string {
  const base = sale.receiptNumber?.replace(/\s+/g, '-') || sale.id.slice(0, 8).toUpperCase();
  return `${DOC_PREFIX[type]}-${base}`;
}

function buildSaleDocumentNotes(
  sale: SaleTransaction,
  isSw: boolean,
): string | undefined {
  const parts: string[] = [];

  if (sale.paidAmount > 0) {
    parts.push(
      isSw
        ? `Imelipwa: TSh ${sale.paidAmount.toLocaleString('en-TZ')}`
        : `Paid: TSh ${sale.paidAmount.toLocaleString('en-TZ')}`,
    );
  }
  if (sale.balanceRemaining > 0) {
    parts.push(
      isSw
        ? `Deni linalobaki: TSh ${sale.balanceRemaining.toLocaleString('en-TZ')}`
        : `Balance due: TSh ${sale.balanceRemaining.toLocaleString('en-TZ')}`,
    );
  }
  if (sale.paymentDueDate && sale.balanceRemaining > 0) {
    parts.push(
      isSw
        ? `Tarehe ya malipo: ${formatDueDateDisplay(sale.paymentDueDate)}`
        : `Payment due: ${formatDueDateDisplay(sale.paymentDueDate)}`,
    );
  }
  if (sale.traEfdSignature) {
    parts.push(`TRA EFD: ${sale.traEfdSignature}`);
  } else if (sale.payments?.length && sale.balanceRemaining <= 0) {
    parts.push(
      `Payment: ${sale.payments.map(p => `${p.method} ${p.amount}`).join(', ')}`,
    );
  }

  return parts.length ? parts.join('\n') : undefined;
}

export function saleToDocumentRenderData(
  sale: SaleTransaction,
  documentType: DocumentType,
  options?: { showDiscount?: boolean; isSw?: boolean },
): DocumentRenderData {
  const isSw = options?.isSw ?? false;
  const discount = computeSaleDiscountAmount(sale);
  const subtotalExVat = sale.subtotal ?? sale.total - sale.vatAmount;
  const showDiscount = Boolean(options?.showDiscount) && discount > 0;
  return {
    documentType,
    documentNumber: saleDocumentNumber(sale, documentType),
    date: formatSaleDate(sale.date),
    customerName: sale.customerName?.trim() || 'Walk-in Customer',
    items: sale.items.map(item => ({
      description: item.productName,
      quantity: item.quantity,
      unitPrice: item.originalUnitPrice ?? item.unitPrice,
      discountPercent: item.discountPercent ?? 0,
    })),
    subtotal: subtotalExVat,
    discountAmount: discount,
    vatAmount: sale.vatAmount ?? 0,
    total: sale.total,
    showDiscount,
    amountPaid: sale.paidAmount > 0 ? sale.paidAmount : undefined,
    balanceDue: sale.balanceRemaining > 0 ? sale.balanceRemaining : undefined,
    paymentDueDate: sale.paymentDueDate,
    notes: buildSaleDocumentNotes(sale, isSw),
  };
}

function formatSaleDate(raw: string): string {
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB');
}

export const COMPLETED_SALE_STATUSES: SaleTransaction['status'][] = [
  'completed',
  'pending_credit',
];

export function isCompletedSale(sale: SaleTransaction): boolean {
  return COMPLETED_SALE_STATUSES.includes(sale.status);
}
