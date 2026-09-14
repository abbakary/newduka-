import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_TAX_COMPLIANCE_SETTINGS,
  TaxComplianceSettings,
  loadTaxComplianceSettings,
  saveTaxComplianceSettings,
  normalizeTaxComplianceSettings,
  resolveEffectiveTaxSettings,
  getBranchVatOverride,
} from '@/lib/taxComplianceSettings';
import { api } from '@/lib/api';

function businessSettingsFromTax(settings: TaxComplianceSettings): Record<string, unknown> {
  return {
    mode: settings.mode,
    vatRegistered: settings.vatRegistered,
    vatEnabled: settings.vatEnabled,
    vatRate: settings.vatRate,
    pricesIncludeVat: settings.pricesIncludeVat,
    showVatOnReceipt: settings.showVatOnReceipt,
    showTraSignature: settings.showTraSignature,
    traEfdSerial: settings.traEfdSerial,
    tinNumber: settings.tinNumber,
    vrnNumber: settings.vrnNumber,
    receiptBusinessName: settings.receiptBusinessName,
    receiptFooterNote: settings.receiptFooterNote,
    discountEnabled: settings.discountEnabled,
    maxDiscountPercent: settings.maxDiscountPercent,
    showDiscountOnReceipts: settings.showDiscountOnReceipts,
    showDiscountOnDocuments: settings.showDiscountOnDocuments,
    cartDiscountEnabled: settings.cartDiscountEnabled,
    priceOverrideEnabled: settings.priceOverrideEnabled,
    partialPaymentEnabled: settings.partialPaymentEnabled,
    negotiationEnabled: settings.negotiationEnabled,
  };
}

function mergeTaxFromBusinessSettings(base: TaxComplianceSettings, raw: Record<string, unknown>): TaxComplianceSettings {
  const merged: TaxComplianceSettings = {
    ...base,
    mode: (raw.mode as TaxComplianceSettings['mode']) ?? base.mode,
    vatRegistered: raw.vatRegistered !== undefined ? Boolean(raw.vatRegistered) : base.vatRegistered,
    vatEnabled: raw.vatEnabled !== undefined ? Boolean(raw.vatEnabled) : base.vatEnabled,
    vatRate: raw.vatRate !== undefined ? Number(raw.vatRate) : base.vatRate,
    pricesIncludeVat: raw.pricesIncludeVat !== undefined ? Boolean(raw.pricesIncludeVat) : base.pricesIncludeVat,
    showVatOnReceipt: raw.showVatOnReceipt !== undefined ? Boolean(raw.showVatOnReceipt) : base.showVatOnReceipt,
    showTraSignature: raw.showTraSignature !== undefined ? Boolean(raw.showTraSignature) : base.showTraSignature,
    traEfdSerial: (raw.traEfdSerial as string) ?? base.traEfdSerial,
    tinNumber: (raw.tinNumber as string) ?? base.tinNumber,
    vrnNumber: (raw.vrnNumber as string) ?? base.vrnNumber,
    receiptBusinessName: (raw.receiptBusinessName as string) ?? base.receiptBusinessName,
    receiptFooterNote: (raw.receiptFooterNote as string) ?? base.receiptFooterNote,
    discountEnabled: raw.discountEnabled !== undefined ? Boolean(raw.discountEnabled) : base.discountEnabled,
    maxDiscountPercent: raw.maxDiscountPercent !== undefined ? Number(raw.maxDiscountPercent) : base.maxDiscountPercent,
    showDiscountOnReceipts: raw.showDiscountOnReceipts !== undefined ? Boolean(raw.showDiscountOnReceipts) : base.showDiscountOnReceipts,
    showDiscountOnDocuments: raw.showDiscountOnDocuments !== undefined ? Boolean(raw.showDiscountOnDocuments) : base.showDiscountOnDocuments,
    cartDiscountEnabled: raw.cartDiscountEnabled !== undefined ? Boolean(raw.cartDiscountEnabled) : base.cartDiscountEnabled,
    priceOverrideEnabled: raw.priceOverrideEnabled !== undefined ? Boolean(raw.priceOverrideEnabled) : base.priceOverrideEnabled,
    partialPaymentEnabled: raw.partialPaymentEnabled !== undefined ? Boolean(raw.partialPaymentEnabled) : base.partialPaymentEnabled,
    negotiationEnabled: raw.negotiationEnabled !== undefined ? Boolean(raw.negotiationEnabled) : base.negotiationEnabled,
  };
  if (raw.vatRegistered === undefined && merged.mode === 'non_vat') {
    merged.vatRegistered = false;
  }
  return normalizeTaxComplianceSettings(merged);
}

interface TaxComplianceContextValue {
  settings: TaxComplianceSettings;
  updateSettings: (patch: Partial<TaxComplianceSettings>) => void;
  applySettings: (next: TaxComplianceSettings) => void;
  resetSettings: () => void;
  effectiveSettings: (branchId?: string | null, branchVatRegistered?: boolean | null) => TaxComplianceSettings;
}

const TaxComplianceContext = createContext<TaxComplianceContextValue | null>(null);

interface TaxComplianceProviderProps {
  tenantId?: string | null;
  businessName?: string;
  tinNumber?: string;
  children: React.ReactNode;
}

export const TaxComplianceProvider: React.FC<TaxComplianceProviderProps> = ({
  tenantId,
  businessName,
  tinNumber,
  children,
}) => {
  const [settings, setSettings] = useState<TaxComplianceSettings>(() =>
    loadTaxComplianceSettings(tenantId, {
      receiptBusinessName: businessName || '',
      tinNumber: tinNumber || '',
    }),
  );

  useEffect(() => {
    setSettings(loadTaxComplianceSettings(tenantId, {
      receiptBusinessName: businessName || settings.receiptBusinessName,
      tinNumber: tinNumber || settings.tinNumber,
    }));
  }, [tenantId]);

  useEffect(() => {
    if (businessName && !settings.receiptBusinessName) {
      setSettings(prev => ({ ...prev, receiptBusinessName: businessName }));
    }
  }, [businessName, settings.receiptBusinessName]);

  useEffect(() => {
    if (tinNumber && !settings.tinNumber) {
      setSettings(prev => ({ ...prev, tinNumber }));
    }
  }, [tinNumber, settings.tinNumber]);

  useEffect(() => {
    if (!tenantId) return;
    api.getTenantSettings()
      .then(res => {
        const biz = res.business_settings ?? {};
        if (Object.keys(biz).length) {
          setSettings(prev => {
            const merged = mergeTaxFromBusinessSettings(prev, biz);
            saveTaxComplianceSettings(tenantId, merged);
            return merged;
          });
        }
      })
      .catch(() => undefined);
  }, [tenantId]);

  const persist = useCallback(
    (next: TaxComplianceSettings) => {
      const normalized = normalizeTaxComplianceSettings(next);
      setSettings(normalized);
      saveTaxComplianceSettings(tenantId, normalized);
      if (tenantId) {
        void api.updateTenantSettings({ business_settings: businessSettingsFromTax(normalized) }).catch(() => undefined);
      }
    },
    [tenantId],
  );

  const updateSettings = useCallback(
    (patch: Partial<TaxComplianceSettings>) => {
      persist({ ...settings, ...patch });
    },
    [persist, settings],
  );

  const applySettings = useCallback(
    (next: TaxComplianceSettings) => {
      persist(next);
    },
    [persist],
  );

  const resetSettings = useCallback(() => {
    persist({
      ...DEFAULT_TAX_COMPLIANCE_SETTINGS,
      receiptBusinessName: businessName || '',
      tinNumber: tinNumber || '',
    });
  }, [businessName, persist, tinNumber]);

  const effectiveSettings = useCallback(
    (branchId?: string | null, branchVatRegistered?: boolean | null) => {
      const storedOverride = getBranchVatOverride(tenantId, branchId);
      const override = branchVatRegistered !== undefined ? branchVatRegistered : storedOverride;
      return resolveEffectiveTaxSettings(settings, override ?? null);
    },
    [settings, tenantId],
  );

  const value = useMemo(
    () => ({ settings, updateSettings, applySettings, resetSettings, effectiveSettings }),
    [applySettings, resetSettings, settings, updateSettings, effectiveSettings],
  );

  return (
    <TaxComplianceContext.Provider value={value}>
      {children}
    </TaxComplianceContext.Provider>
  );
};

export function useTaxCompliance(): TaxComplianceContextValue {
  const ctx = useContext(TaxComplianceContext);
  if (!ctx) {
    throw new Error('useTaxCompliance must be used within TaxComplianceProvider');
  }
  return ctx;
}

/** Effective tax settings for the active branch (org default + branch override). */
export function useEffectiveTaxCompliance(
  branchId?: string | null,
  branchVatRegistered?: boolean | null,
): TaxComplianceSettings {
  const { effectiveSettings } = useTaxCompliance();
  return useMemo(
    () => effectiveSettings(branchId, branchVatRegistered),
    [branchId, branchVatRegistered, effectiveSettings],
  );
}
