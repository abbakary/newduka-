import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { PublicPlan, DEFAULT_PUBLIC_PLANS, loadPublicPlans, savePublicPlans, mapApiPlan, mapApiPlanToPatch } from '@/lib/saasPlans';

interface SaasPlansContextValue {
  plans: PublicPlan[];
  loading: boolean;
  updatePlans: (plans: PublicPlan[]) => void;
  updatePlan: (id: string, patch: Partial<PublicPlan>, isSw?: boolean) => Promise<void>;
  syncSharedFeatures: (features: string[], featuresSw: string[]) => Promise<void>;
  resetPlans: () => Promise<void>;
  refreshPlans: () => Promise<void>;
}

const SaasPlansContext = createContext<SaasPlansContextValue | null>(null);

export const SaasPlansProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plans, setPlans] = useState<PublicPlan[]>(() => loadPublicPlans());
  const [loading, setLoading] = useState(true);

  const refreshPlans = useCallback(async () => {
    try {
      let raw: Array<Record<string, unknown>>;
      try {
        raw = await api.getAdminPlans() as Array<Record<string, unknown>>;
      } catch {
        raw = await api.getPublicPlans() as Array<Record<string, unknown>>;
      }
      const next = raw.map(mapApiPlan);
      if (next.length) {
        setPlans(next);
        savePublicPlans(next);
      }
    } catch {
      setPlans(loadPublicPlans());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPlans();
  }, [refreshPlans]);

  const updatePlans = useCallback((next: PublicPlan[]) => {
    setPlans(next);
    savePublicPlans(next);
  }, []);

  const updatePlan = useCallback(async (id: string, patch: Partial<PublicPlan>, isSw?: boolean) => {
    try {
      const updated = await api.updateAdminPlan(id, mapApiPlanToPatch(patch, isSw));
      await refreshPlans();
      return updated;
    } catch {
      setPlans(prev => {
        const next = prev.map(p => (p.id === id ? { ...p, ...patch } : p));
        savePublicPlans(next);
        return next;
      });
    }
  }, [refreshPlans]);

  const syncSharedFeatures = useCallback(async (features: string[], featuresSw: string[]) => {
    try {
      const raw = await api.syncAdminPlanFeatures({ features, features_sw: featuresSw });
      const next = (raw as Array<Record<string, unknown>>).map(mapApiPlan);
      setPlans(next);
      savePublicPlans(next);
    } catch {
      setPlans(prev => {
        const next = prev.map(p => ({ ...p, features, featuresSw }));
        savePublicPlans(next);
        return next;
      });
    }
  }, []);

  const resetPlans = useCallback(async () => {
    try {
      const raw = await api.resetAdminPlans();
      const next = (raw as Array<Record<string, unknown>>).map(mapApiPlan);
      setPlans(next);
      savePublicPlans(next);
    } catch {
      setPlans(DEFAULT_PUBLIC_PLANS);
      savePublicPlans(DEFAULT_PUBLIC_PLANS);
    }
  }, []);

  const value = useMemo(
    () => ({ plans, loading, updatePlans, updatePlan, syncSharedFeatures, resetPlans, refreshPlans }),
    [plans, loading, updatePlans, updatePlan, syncSharedFeatures, resetPlans, refreshPlans],
  );

  return <SaasPlansContext.Provider value={value}>{children}</SaasPlansContext.Provider>;
};

export function useSaasPlans(): SaasPlansContextValue {
  const ctx = useContext(SaasPlansContext);
  if (!ctx) throw new Error('useSaasPlans must be used within SaasPlansProvider');
  return ctx;
}
