/**
 * Server-side-style tax enforcement for sale payloads.
 * Recalculates VAT from tenant/branch settings so client-supplied amounts cannot be tampered with.
 */

import type { SaleTransaction } from '@/types/v1';
import {
  calculateSaleTotals,
  capDiscountPercent,
  computeDiscountedSubtotal,
  isVatActive,
  type TaxComplianceSettings,
} from '@/lib/taxComplianceSettings';

export function enforceSaleTaxTotals(
  sale: SaleTransaction,
  settings: TaxComplianceSettings,
): SaleTransaction {
  const { subtotal, discountAmount: lineDiscount } = computeDiscountedSubtotal(
    sale.items.map(i => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discountPercent: i.discountPercent ?? 0,
    })),
    settings,
  );

  const cartPct = settings.cartDiscountEnabled
    ? capDiscountPercent(sale.cartDiscountPercent ?? 0, settings)
    : 0;

  const totals = calculateSaleTotals({ subtotal, discountPercent: cartPct }, settings);
  const vatAmount = isVatActive(settings) ? totals.vatAmount : 0;
  const total = isVatActive(settings) ? totals.total : totals.taxableAmount;
  const paidAmount =
    sale.type === 'full' ? total : sale.type === 'credit' ? 0 : sale.paidAmount;

  return {
    ...sale,
    subtotal: totals.subtotal,
    discountAmount: lineDiscount + totals.discountAmount,
    vatAmount,
    total,
    paidAmount,
    balanceRemaining: Math.max(0, total - paidAmount),
    cartDiscountPercent: cartPct,
  };
}

export function assertSaleTaxIntegrity(
  sale: SaleTransaction,
  settings: TaxComplianceSettings,
): void {
  const enforced = enforceSaleTaxTotals(sale, settings);
  if (enforced.vatAmount !== sale.vatAmount || enforced.total !== sale.total) {
    throw new Error(
      `Tax mismatch: expected VAT ${enforced.vatAmount} and total ${enforced.total}, ` +
        `got VAT ${sale.vatAmount} and total ${sale.total}`,
    );
  }
}
