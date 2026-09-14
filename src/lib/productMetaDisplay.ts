import type { BusinessType, Product } from '@/types/v1';
import { getBusinessProfile } from '@/lib/businessEngine';

export interface ProductMetaEntry {
  key: string;
  label: string;
  value: string;
}

export function getProductMetaEntries(
  product: Product,
  businessType: BusinessType,
  lang: 'sw' | 'en' = 'en',
): ProductMetaEntry[] {
  const profile = getBusinessProfile(businessType);
  const rec = product as Record<string, unknown>;
  const entries: ProductMetaEntry[] = [];

  for (const field of profile.product_fields) {
    if (!field.metadata) continue;
    const raw = rec[field.key];
    if (raw === undefined || raw === null || raw === '') continue;
    entries.push({
      key: field.key,
      label: lang === 'sw' ? field.label_sw : field.label_en,
      value: String(raw),
    });
  }
  return entries;
}

/** Compact one-line summary for POS cards, e.g. "Toyota Corolla · 2010–2015 · OEM: 04465" */
export function formatProductMetaSummary(
  product: Product,
  businessType: BusinessType,
  maxParts = 3,
): string {
  if (businessType === 'auto_parts') {
    const rec = product as Record<string, unknown>;
    const parts: string[] = [];
    const make = rec.vehicle_make as string | undefined;
    const model = rec.vehicle_model as string | undefined;
    const yFrom = rec.year_from as string | number | undefined;
    const yTo = rec.year_to as string | number | undefined;
    const oem = rec.oem_number as string | undefined;
    const partNo = rec.part_number as string | undefined;
    if (make) parts.push(make);
    if (model) parts.push(model);
    if (yFrom || yTo) parts.push(`${yFrom ?? '?'}–${yTo ?? '?'}`);
    if (oem) parts.push(`OEM: ${oem}`);
    else if (partNo) parts.push(`#${partNo}`);
    return parts.slice(0, maxParts).join(' · ');
  }

  return getProductMetaEntries(product, businessType)
    .slice(0, maxParts)
    .map(e => e.value)
    .join(' · ');
}

export function productMatchesSearch(
  product: Product,
  businessType: BusinessType,
  query: string,
): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const base = [product.name, product.sku, product.category].some(v => v?.toLowerCase().includes(q));
  if (base) return true;
  return getProductMetaEntries(product, businessType).some(
    e => e.value.toLowerCase().includes(q) || e.label.toLowerCase().includes(q),
  );
}
