import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { loadCachedAuthUser } from '@/lib/authBridge';
import {
  PublicPlan,
  DEFAULT_PUBLIC_PLANS,
  loadPublicPlans,
  savePublicPlans,
  mapApiPlans,
  mapApiPlanToPatch,
} from '@/lib/saasPlans';

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

function isSuperAdminSession(): boolean {
  return loadCachedAuthUser()?.role === 'super_admin';
}

export const SaasPlansProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plans, setPlans] = useState<PublicPlan[]>(() => loadPublicPlans());
  const [loading, setLoading] = useState(true);

  const refreshPlans = useCallback(async () => {
    try {
      let next: PublicPlan[] = [];
      // Only super_admin may call /admin/plans — everyone else uses public catalog
      // to avoid noisy 403s and broken pricing pages for tenant users.
      if (isSuperAdminSession()) {
        try {
          next = mapApiPlans(await api.getAdminPlans());
        } catch {
          next = mapApiPlans(await api.getPublicPlans());
        }
      } else {
        next = mapApiPlans(await api.getPublicPlans());
      }
      if (next.length) {
        setPlans(next);
        savePublicPlans(next);
      } else {
        setPlans(loadPublicPlans());
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
    const safe = next.filter((p): p is PublicPlan => Boolean(p?.id));
    setPlans(safe.length ? safe : DEFAULT_PUBLIC_PLANS);
    savePublicPlans(safe.length ? safe : DEFAULT_PUBLIC_PLANS);
  }, []);

  const updatePlan = useCallback(async (id: string, patch: Partial<PublicPlan>, isSw?: boolean) => {
    try {
      await api.updateAdminPlan(id, mapApiPlanToPatch(patch, isSw));
      await refreshPlans();
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
      const next = mapApiPlans(await api.syncAdminPlanFeatures({ features, features_sw: featuresSw }));
      if (next.length) {
        setPlans(next);
        savePublicPlans(next);
      }
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
      const next = mapApiPlans(await api.resetAdminPlans());
      const safe = next.length ? next : DEFAULT_PUBLIC_PLANS;
      setPlans(safe);
      savePublicPlans(safe);
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
