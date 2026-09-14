/** Backward-compatible re-exports from the Business-Type Engine */
import {
  BUSINESS_ENGINE,
  flattenTaxonomy,
  getBusinessProfile,
  getDefaultWorkplaceTab,
  hasFeature,
  getProductNamePlaceholder,
  getDefaultMainCategory,
  getSupplierIndustryCategory,
  getDefaultUnit,
  ALL_BUSINESS_TYPES,
  planAllowsBranches,
  planHasFeature,
  type BusinessType,
} from '@/lib/businessEngine';

export type { BusinessType };
export {
  getBusinessProfile,
  getDefaultWorkplaceTab,
  hasFeature,
  getProductNamePlaceholder,
  getDefaultMainCategory,
  getSupplierIndustryCategory,
  getDefaultUnit,
  ALL_BUSINESS_TYPES,
  BUSINESS_ENGINE,
  planAllowsBranches,
  planHasFeature,
};

export function getWorkplace(type?: string, _lang?: 'sw' | 'en'): BusinessWorkplace {
  const key = (type as BusinessType) || 'retail';
  return BUSINESS_PROFILES[key] ?? BUSINESS_PROFILES.retail;
}

export interface BusinessWorkplace {
  id: BusinessType;
  label_sw: string;
  label_en: string;
  icon: string;
  inventory_title_sw: string;
  inventory_title_en: string;
  pos_title_sw: string;
  pos_title_en: string;
  product_fields: string[];
  default_units: string[];
  default_categories: string[];
  nav_extra: Array<{ id: string; label_sw: string; label_en: string }>;
  features: {
    batch_tracking: boolean;
    expiry_alerts: boolean;
    barcode_scan: boolean;
    fractional_units: boolean;
    table_management: boolean;
    appointments: boolean;
  };
}

export const BUSINESS_PROFILES: Record<string, BusinessWorkplace> = Object.fromEntries(
  Object.entries(BUSINESS_ENGINE).map(([key, p]) => [
    key,
    {
      id: p.id,
      label_sw: p.label_sw,
      label_en: p.label_en,
      icon: p.icon,
      inventory_title_sw: p.inventory_title_sw,
      inventory_title_en: p.inventory_title_en,
      pos_title_sw: p.pos_title_sw,
      pos_title_en: p.pos_title_en,
      product_fields: p.product_fields.map(f => f.key),
      default_units: p.default_units,
      default_categories: flattenTaxonomy(p).slice(0, 12),
      nav_extra: p.nav_extra.map(n => ({ id: n.id, label_sw: n.label_sw, label_en: n.label_en })),
      features: {
        batch_tracking: p.features.batch_tracking,
        expiry_alerts: p.features.expiry_alerts,
        barcode_scan: p.features.barcode_scan,
        fractional_units: p.features.fractional_units,
        table_management: p.features.table_management,
        appointments: p.features.appointments,
      },
    },
  ]),
);

export function workplaceLabel(type: BusinessType | undefined, lang: 'sw' | 'en'): string {
  const w = getBusinessProfile(type);
  return lang === 'sw' ? w.label_sw : w.label_en;
}
