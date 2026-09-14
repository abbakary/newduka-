import type { SaleTransaction } from '@/types/v1';

type SaleDiscountSource = Pick<
  SaleTransaction,
  'items' | 'discountAmount' | 'subtotal' | 'total' | 'vatAmount'
>;

/** Resolve discount total from API field or per-line item data. */
export function computeSaleDiscountAmount(sale: SaleDiscountSource): number {
  const explicit = sale.discountAmount;
  if (explicit != null && explicit > 0) return Math.round(explicit);

  let gross = 0;
  let net = 0;
  for (const item of sale.items) {
    const orig = item.originalUnitPrice ?? item.unitPrice;
    const pct = item.discountPercent ?? 0;
    const lineGross = orig * item.quantity;
    const lineNet =
      item.total > 0 && pct > 0
        ? item.total
        : Math.round(lineGross * (1 - pct / 100));
    gross += lineGross;
    net += lineNet;
  }

  const fromItems = Math.max(0, Math.round(gross - net));
  if (fromItems > 0) return fromItems;

  // Some APIs store net subtotal only — infer from totals when possible.
  if (sale.subtotal > 0 && sale.total > 0 && sale.vatAmount >= 0) {
    const inferred = sale.total - sale.vatAmount - sale.subtotal;
    if (inferred > 0 && inferred < sale.subtotal) return Math.round(inferred);
  }

  return 0;
}

export function saleGrossSubtotal(sale: SaleDiscountSource): number {
  const discount = computeSaleDiscountAmount(sale);
  if (discount > 0 && sale.subtotal > 0) return sale.subtotal + discount;
  return sale.items.reduce(
    (sum, i) => sum + (i.originalUnitPrice ?? i.unitPrice) * i.quantity,
    0,
  );
}
