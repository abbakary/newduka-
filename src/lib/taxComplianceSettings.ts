export type TaxComplianceMode = 'manual' | 'non_vat' | 'tra_efd';

export interface TaxComplianceSettings {
  mode: TaxComplianceMode;
  /** Organization tax status — when false, VAT is never applied regardless of client payload. */
  vatRegistered: boolean;
  vatEnabled: boolean;
  vatRate: number;
  pricesIncludeVat: boolean;
  discountEnabled: boolean;
  maxDiscountPercent: number;
  showDiscountOnReceipts: boolean;
  showDiscountOnDocuments: boolean;
  cartDiscountEnabled: boolean;
  priceOverrideEnabled: boolean;
  partialPaymentEnabled: boolean;
  negotiationEnabled: boolean;
  showVatOnReceipt: boolean;
  showTraSignature: boolean;
  traEfdSerial: string;
  tinNumber: string;
  vrnNumber: string;
  receiptBusinessName: string;
  receiptFooterNote: string;
  /**
   * Default how purchase / stock-in applies VAT for VAT/TRA shops:
   * - none: lines start without tax (user can still set per line)
   * - all: apply VAT 18% to every PO/stock-in line
   * - vat_products: apply VAT only to products marked standard VAT
   */
  purchaseVatScope: 'none' | 'all' | 'vat_products';
  /** Default note appended on purchases when VAT is applied */
  purchaseVatNote: string;
}

export const DEFAULT_TAX_COMPLIANCE_SETTINGS: TaxComplianceSettings = {
  mode: 'manual',
  vatRegistered: false,
  vatEnabled: false,
  vatRate: 0.18,
  pricesIncludeVat: false,
  discountEnabled: true,
  maxDiscountPercent: 15,
  showDiscountOnReceipts: true,
  showDiscountOnDocuments: true,
  cartDiscountEnabled: false,
  priceOverrideEnabled: false,
  partialPaymentEnabled: true,
  negotiationEnabled: true,
  showVatOnReceipt: true,
  showTraSignature: false,
  traEfdSerial: '',
  tinNumber: '',
  vrnNumber: '',
  receiptBusinessName: '',
  receiptFooterNote: '',
  purchaseVatScope: 'none',
  purchaseVatNote: '',
};

const STORAGE_PREFIX = 'dukamkononi_tax_compliance_';

export function storageKeyForTenant(tenantId?: string | null): string {
  return `${STORAGE_PREFIX}${tenantId || 'default'}`;
}

export function loadTaxComplianceSettings(
  tenantId?: string | null,
  seed?: Partial<TaxComplianceSettings>,
): TaxComplianceSettings {
  const defaults = { ...DEFAULT_TAX_COMPLIANCE_SETTINGS, ...seed };
  try {
    const raw = localStorage.getItem(storageKeyForTenant(tenantId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TaxComplianceSettings>;
    const merged = { ...defaults, ...parsed };
    if (parsed.vatRegistered === undefined) {
      merged.vatRegistered = parsed.mode !== 'non_vat' && Boolean(parsed.vatEnabled);
    }
    return normalizeTaxComplianceSettings(merged);
  } catch {
    return defaults;
  }
}

export function saveTaxComplianceSettings(
  tenantId: string | null | undefined,
  settings: TaxComplianceSettings,
): void {
  localStorage.setItem(storageKeyForTenant(tenantId), JSON.stringify(settings));
}

export interface SaleTotalsInput {
  subtotal: number;
  discountPercent?: number;
}

export interface SaleTotalsResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  vatAmount: number;
  total: number;
}

/** VAT is off for non-VAT shops and when explicitly disabled in manual mode. */
export function isVatActive(settings: TaxComplianceSettings): boolean {
  if (!settings.vatRegistered || settings.mode === 'non_vat') return false;
  if (settings.mode === 'tra_efd') return true;
  return settings.vatEnabled;
}

export type BranchVatOverride = boolean | null;

const BRANCH_VAT_PREFIX = 'dukamkononi_branch_vat_';

function branchVatStorageKey(tenantId?: string | null): string {
  return `${BRANCH_VAT_PREFIX}${tenantId || 'default'}`;
}

export function loadBranchVatOverrides(tenantId?: string | null): Record<string, BranchVatOverride> {
  try {
    const raw = localStorage.getItem(branchVatStorageKey(tenantId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BranchVatOverride>;
  } catch {
    return {};
  }
}

export function getBranchVatOverride(
  tenantId: string | null | undefined,
  branchId?: string | null,
): BranchVatOverride | undefined {
  if (!branchId || branchId === 'all') return undefined;
  return loadBranchVatOverrides(tenantId)[branchId];
}

export function saveBranchVatOverride(
  tenantId: string | null | undefined,
  branchId: string,
  override: BranchVatOverride,
): void {
  const all = loadBranchVatOverrides(tenantId);
  if (override === null) {
    delete all[branchId];
  } else {
    all[branchId] = override;
  }
  localStorage.setItem(branchVatStorageKey(tenantId), JSON.stringify(all));
}

/** Resolve tenant tax settings with optional branch override (null = inherit org default). */
export function resolveEffectiveTaxSettings(
  org: TaxComplianceSettings,
  branchVatRegistered?: boolean | null,
): TaxComplianceSettings {
  if (branchVatRegistered === null || branchVatRegistered === undefined) {
    return org;
  }
  if (!branchVatRegistered) {
    return normalizeTaxComplianceSettings({
      ...org,
      vatRegistered: false,
      mode: 'non_vat',
      vatEnabled: false,
      showVatOnReceipt: false,
      pricesIncludeVat: false,
    });
  }
  if (org.mode === 'non_vat' || !org.vatRegistered) {
    return normalizeTaxComplianceSettings({
      ...org,
      vatRegistered: true,
      mode: 'manual',
      vatEnabled: true,
    });
  }
  return normalizeTaxComplianceSettings({ ...org, vatRegistered: true });
}

/** Resolve tax settings for a sale at a branch (used outside React context). */
export function resolveSaleTaxSettingsForBranch(
  tenantId: string | null | undefined,
  branchId?: string | null,
  branchVatRegistered?: boolean | null,
): TaxComplianceSettings {
  const org = loadTaxComplianceSettings(tenantId);
  const stored = getBranchVatOverride(tenantId, branchId);
  const override =
    branchVatRegistered !== undefined && branchVatRegistered !== null
      ? branchVatRegistered
      : stored;
  return resolveEffectiveTaxSettings(org, override ?? null);
}

/** Normalize settings after mode/profile changes so stored values stay consistent. */
export function normalizeTaxComplianceSettings(settings: TaxComplianceSettings): TaxComplianceSettings {
  if (settings.mode === 'non_vat' || !settings.vatRegistered) {
    return {
      ...settings,
      vatRegistered: false,
      mode: 'non_vat',
      vatEnabled: false,
      showVatOnReceipt: false,
      showTraSignature: false,
      pricesIncludeVat: false,
    };
  }
  if (settings.mode === 'tra_efd') {
    return {
      ...settings,
      vatRegistered: true,
      vatEnabled: true,
      showTraSignature: true,
    };
  }
  if (!settings.vatEnabled) {
    return {
      ...settings,
      vatRegistered: true,
      showVatOnReceipt: false,
      pricesIncludeVat: false,
    };
  }
  return { ...settings, vatRegistered: true };
}

export function calculateSaleTotals(
  { subtotal, discountPercent = 0 }: SaleTotalsInput,
  settings: TaxComplianceSettings,
): SaleTotalsResult {
  const cappedDiscount = settings.discountEnabled
    ? Math.min(Math.max(discountPercent, 0), settings.maxDiscountPercent)
    : 0;
  const discountAmount = Math.round(subtotal * (cappedDiscount / 100));
  const taxableAmount = subtotal - discountAmount;

  let vatAmount = 0;
  if (isVatActive(settings)) {
    if (settings.pricesIncludeVat) {
      vatAmount = Math.round(taxableAmount - taxableAmount / (1 + settings.vatRate));
    } else {
      vatAmount = Math.round(taxableAmount * settings.vatRate);
    }
  }

  const total = settings.pricesIncludeVat
    ? taxableAmount
    : taxableAmount + vatAmount;

  return { subtotal, discountAmount, taxableAmount, vatAmount, total };
}

export function formatVatLabel(settings: TaxComplianceSettings, isSw: boolean): string {
  if (!isVatActive(settings)) {
    return isSw ? 'Kodi (imezimwa)' : 'Tax (disabled)';
  }
  const pct = Math.round(settings.vatRate * 1000) / 10;
  return isSw ? `VAT (${pct}%)` : `VAT (${pct}%)`;
}

export function generateReceiptNumber(settings: TaxComplianceSettings): string {
  const seq = Math.floor(1000 + Math.random() * 9000);
  if (settings.mode === 'tra_efd') {
    const serial = settings.traEfdSerial.replace(/\s/g, '').slice(-6) || 'EFD';
    return `TRA-${serial}-${seq}`;
  }
  return `RCP-${new Date().getFullYear()}-${seq}`;
}

export function generateTraSignature(
  settings: TaxComplianceSettings,
  receiptNumber: string,
): string {
  if (settings.mode !== 'tra_efd' || !settings.showTraSignature) return '';
  const serial = settings.traEfdSerial.replace(/\s/g, '') || 'MANUAL';
  return `EFD-TZ-${serial.slice(-6)}-${receiptNumber.replace(/\s/g, '')}-${Date.now().toString(36).toUpperCase()}`;
}

export function getComplianceStatusLabel(settings: TaxComplianceSettings, isSw: boolean): string {
  if (settings.mode === 'tra_efd') {
    return isSw ? 'TRA EFD VFD 2.0 Synced' : 'TRA EFD VFD 2.0 Synced';
  }
  if (settings.mode === 'non_vat') {
    return isSw ? 'Duka bila usajili wa VAT/TRA' : 'Non-VAT / not TRA registered';
  }
  return isSw ? 'Hali ya Kawaida (Bila TRA EFD)' : 'Manual mode (no TRA EFD)';
}

export function getComplianceBadgeTone(settings: TaxComplianceSettings): 'tra' | 'manual' | 'non_vat' {
  if (settings.mode === 'tra_efd') return 'tra';
  if (settings.mode === 'non_vat') return 'non_vat';
  return 'manual';
}

/** Cap per-line or cart discount according to tenant settings. */
export function capDiscountPercent(
  discountPercent: number,
  settings: TaxComplianceSettings,
): number {
  if (!settings.discountEnabled) return 0;
  return Math.min(Math.max(discountPercent, 0), settings.maxDiscountPercent);
}

export interface LineDiscountInput {
  unitPrice: number;
  quantity: number;
  discountPercent?: number;
}

/** Effective shelf/unit price for a cart line (override or catalog). */
export function effectiveUnitPrice(unitPrice: number, override?: number): number {
  return override != null && override > 0 ? override : unitPrice;
}

/** Subtotal after per-line discounts (respects discountEnabled + max cap). */
export function computeDiscountedSubtotal(
  lines: LineDiscountInput[],
  settings: TaxComplianceSettings,
): { subtotal: number; discountAmount: number; grossSubtotal: number } {
  let grossSubtotal = 0;
  let subtotal = 0;
  for (const line of lines) {
    const gross = line.unitPrice * line.quantity;
    grossSubtotal += gross;
    const pct = capDiscountPercent(line.discountPercent ?? 0, settings);
    subtotal += Math.round(gross * (1 - pct / 100));
  }
  return { subtotal, discountAmount: grossSubtotal - subtotal, grossSubtotal };
}
