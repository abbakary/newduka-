import type { Product, PurchaseOrderItem } from '@/types/v1';

export type PurchaseTaxId = 'none' | 'vat_18';
export type PurchaseVatScope = 'none' | 'all' | 'vat_products';

export interface PurchaseTaxOption {
  id: PurchaseTaxId;
  labelEn: string;
  labelSw: string;
  rate: number;
}

export const PURCHASE_TAX_OPTIONS: PurchaseTaxOption[] = [
  { id: 'none', labelEn: 'No Tax', labelSw: 'Bila Kodi', rate: 0 },
  { id: 'vat_18', labelEn: 'VAT 18%', labelSw: 'VAT 18%', rate: 0.18 },
];

export function purchaseTaxRate(taxId?: PurchaseTaxId | string | null): number {
  return PURCHASE_TAX_OPTIONS.find(o => o.id === taxId)?.rate ?? 0;
}

export function purchaseTaxLabel(taxId: PurchaseTaxId | string | undefined, isSw: boolean): string {
  const opt = PURCHASE_TAX_OPTIONS.find(o => o.id === taxId);
  if (!opt) return isSw ? 'Bila Kodi' : 'No Tax';
  return isSw ? opt.labelSw : opt.labelEn;
}

/** Unit prices on PO lines are untaxed; tax is optional per line. */
export function computePurchaseLineAmounts(item: {
  quantity: number;
  costPrice: number;
  taxId?: PurchaseTaxId | string | null;
  taxRate?: number;
}): { untaxed: number; taxAmount: number; lineTotal: number } {
  const untaxed = Math.round(item.quantity * item.costPrice);
  const rate = item.taxRate ?? purchaseTaxRate(item.taxId);
  const taxAmount = Math.round(untaxed * rate);
  return { untaxed, taxAmount, lineTotal: untaxed + taxAmount };
}

export function normalizePurchaseOrderItem(item: PurchaseOrderItem): PurchaseOrderItem {
  const taxId = (item.taxId ?? 'none') as PurchaseTaxId;
  const taxRate = item.taxRate ?? purchaseTaxRate(taxId);
  const { untaxed, taxAmount } = computePurchaseLineAmounts({
    quantity: item.quantity,
    costPrice: item.costPrice,
    taxId,
    taxRate,
  });
  return {
    ...item,
    taxId,
    taxRate,
    total: untaxed,
    taxAmount,
  };
}

export function computePurchaseOrderTotals(items: PurchaseOrderItem[]): {
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let vatAmount = 0;
  for (const raw of items) {
    const item = normalizePurchaseOrderItem(raw);
    subtotal += item.total;
    vatAmount += item.taxAmount ?? 0;
  }
  return { subtotal, vatAmount, totalAmount: subtotal + vatAmount };
}

/** Products marked standard (or legacy vat / vat_18) are VAT-taxable on purchases. */
export function productIsVatTaxable(vatType?: string | null): boolean {
  if (!vatType) return false;
  const v = vatType.toLowerCase().trim();
  return v === 'standard' || v === 'vat' || v === 'vat_18' || v === 'taxable' || v === 'vatable';
}

export function resolveLineTaxIdForScope(
  scope: PurchaseVatScope,
  productVatType?: string | null,
): PurchaseTaxId {
  if (scope === 'all') return 'vat_18';
  if (scope === 'vat_products') return productIsVatTaxable(productVatType) ? 'vat_18' : 'none';
  return 'none';
}

/** Re-apply PO VAT scope across all lines (keeps costs; resets tax from scope + product class). */
export function applyPurchaseVatScopeToItems(
  items: PurchaseOrderItem[],
  scope: PurchaseVatScope,
  catalog?: Product[],
): PurchaseOrderItem[] {
  return items.map(item => {
    const fromCatalog = item.productId
      ? catalog?.find(p => p.id === item.productId)?.vatType
      : undefined;
    const vatType =
      (item.metadata?.vat_type as string | undefined) ??
      fromCatalog ??
      undefined;
    const taxId = resolveLineTaxIdForScope(scope, vatType);
    return normalizePurchaseOrderItem({
      ...item,
      taxId,
      taxRate: purchaseTaxRate(taxId),
      metadata: {
        ...(item.metadata || {}),
        ...(vatType ? { vat_type: vatType } : {}),
      },
    });
  });
}

export function purchaseVatScopeLabel(scope: PurchaseVatScope, isSw: boolean): string {
  switch (scope) {
    case 'all':
      return isSw ? 'VAT 18% kwenye mistari yote' : 'VAT 18% on all lines';
    case 'vat_products':
      return isSw ? 'VAT 18% kwa bidhaa za VAT tu' : 'VAT 18% on VAT products only';
    default:
      return isSw ? 'Bila VAT (chagua kwa mstari)' : 'No VAT (set per line)';
  }
}
