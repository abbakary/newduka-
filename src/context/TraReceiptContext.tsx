import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SaleTransaction } from '@/types/v1';
import type { EfdApiSettings, TraReceipt } from '@/types/traReceipt';
import { loadTraReceipts, saveTraReceipts, addTraReceipt } from '@/lib/traReceiptStore';
import { loadEfdApiSettings, saveEfdApiSettings } from '@/lib/efdSettingsStore';
import { issueTraReceipt, testEfdConnection } from '@/lib/efdApi';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import type { TraCustomerIdType } from '@/types/traReceipt';

interface IssueFromSaleOptions {
  customerMobile?: string;
  customerIdType?: TraCustomerIdType;
  customerIdNumber?: string;
}

interface TraReceiptContextValue {
  receipts: TraReceipt[];
  efdSettings: EfdApiSettings;
  updateEfdSettings: (patch: Partial<EfdApiSettings>) => void;
  saveEfdSettings: (next: EfdApiSettings) => void;
  testConnection: () => Promise<{ ok: boolean; message: string }>;
  issueFromSale: (sale: SaleTransaction, companyName: string, opts?: IssueFromSaleOptions) => Promise<TraReceipt | null>;
  refreshReceipts: () => void;
  selectedReceiptId: string | null;
  setSelectedReceiptId: (id: string | null) => void;
}

const TraReceiptContext = createContext<TraReceiptContextValue | null>(null);

interface TraReceiptProviderProps {
  tenantId?: string | null;
  children: React.ReactNode;
}

export const TraReceiptProvider: React.FC<TraReceiptProviderProps> = ({ tenantId, children }) => {
  const { settings: taxSettings } = useTaxCompliance();
  const [receipts, setReceipts] = useState<TraReceipt[]>(() => loadTraReceipts(tenantId));
  const [efdSettings, setEfdSettings] = useState<EfdApiSettings>(() => loadEfdApiSettings(tenantId));
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  useEffect(() => {
    setReceipts(loadTraReceipts(tenantId));
    setEfdSettings(loadEfdApiSettings(tenantId));
    setSelectedReceiptId(null);
  }, [tenantId]);

  const refreshReceipts = useCallback(() => {
    setReceipts(loadTraReceipts(tenantId));
  }, [tenantId]);

  const updateEfdSettings = useCallback(
    (patch: Partial<EfdApiSettings>) => {
      setEfdSettings(prev => {
        const next = { ...prev, ...patch };
        saveEfdApiSettings(tenantId, next);
        return next;
      });
    },
    [tenantId],
  );

  const saveEfdSettingsFn = useCallback(
    (next: EfdApiSettings) => {
      saveEfdApiSettings(tenantId, next);
      setEfdSettings(next);
    },
    [tenantId],
  );

  const testConnection = useCallback(async () => {
    const result = await testEfdConnection(efdSettings);
    const next = {
      ...efdSettings,
      lastTestAt: new Date().toISOString(),
      lastTestOk: result.ok,
      lastTestMessage: result.message,
    };
    saveEfdApiSettings(tenantId, next);
    setEfdSettings(next);
    return result;
  }, [efdSettings, tenantId]);

  const issueFromSale = useCallback(
    async (sale: SaleTransaction, companyName: string, opts?: IssueFromSaleOptions) => {
      if (taxSettings.mode !== 'tra_efd') return null;
      const receipt = await issueTraReceipt({
        sale,
        taxSettings,
        efdSettings,
        companyName,
        customerMobile: opts?.customerMobile,
        customerIdType: opts?.customerIdType,
        customerIdNumber: opts?.customerIdNumber,
        branchId: sale.branchId,
      });
      const list = addTraReceipt(tenantId, receipt);
      setReceipts(list);
      return receipt;
    },
    [taxSettings, efdSettings, tenantId],
  );

  const value = useMemo(
    () => ({
      receipts,
      efdSettings,
      updateEfdSettings,
      saveEfdSettings: saveEfdSettingsFn,
      testConnection,
      issueFromSale,
      refreshReceipts,
      selectedReceiptId,
      setSelectedReceiptId,
    }),
    [
      receipts,
      efdSettings,
      updateEfdSettings,
      saveEfdSettingsFn,
      testConnection,
      issueFromSale,
      refreshReceipts,
      selectedReceiptId,
    ],
  );

  return <TraReceiptContext.Provider value={value}>{children}</TraReceiptContext.Provider>;
};

export function useTraReceipts(): TraReceiptContextValue {
  const ctx = useContext(TraReceiptContext);
  if (!ctx) throw new Error('useTraReceipts must be used within TraReceiptProvider');
  return ctx;
}
