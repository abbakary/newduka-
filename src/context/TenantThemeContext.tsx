import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  applyTenantThemeCss,
  DEFAULT_TENANT_THEME,
  loadTenantTheme,
  saveTenantTheme,
  themeFromBusinessSettings,
  themeToBusinessSettings,
  type TenantTheme,
} from '@/lib/tenantTheme';

interface TenantThemeContextValue {
  theme: TenantTheme;
  updateTheme: (patch: Partial<TenantTheme>) => void;
  resetTheme: () => void;
}

const TenantThemeContext = createContext<TenantThemeContextValue | null>(null);

interface Props {
  tenantId?: string | null;
  children: React.ReactNode;
}

export const TenantThemeProvider: React.FC<Props> = ({ tenantId, children }) => {
  const [theme, setTheme] = useState<TenantTheme>(() => loadTenantTheme(tenantId));

  useEffect(() => {
    setTheme(loadTenantTheme(tenantId));
  }, [tenantId]);

  useEffect(() => {
    applyTenantThemeCss(theme);
  }, [theme]);

  useEffect(() => {
    if (!tenantId) return;
    api.getTenantSettings()
      .then(res => {
        const fromApi = themeFromBusinessSettings(res.business_settings);
        if (fromApi.primaryColor || fromApi.sidebarBg) {
          setTheme(prev => {
            const merged = {
              primaryColor: fromApi.primaryColor ?? prev.primaryColor,
              sidebarBg: fromApi.sidebarBg ?? prev.sidebarBg,
            };
            saveTenantTheme(tenantId, merged);
            return merged;
          });
        }
      })
      .catch(() => undefined);
  }, [tenantId]);

  const persist = useCallback(
    (next: TenantTheme) => {
      setTheme(next);
      saveTenantTheme(tenantId, next);
      if (tenantId) {
        void api.updateTenantSettings({ business_settings: themeToBusinessSettings(next) }).catch(() => undefined);
      }
    },
    [tenantId],
  );

  const updateTheme = useCallback(
    (patch: Partial<TenantTheme>) => {
      setTheme(prev => {
        const next = {
          primaryColor: patch.primaryColor ?? prev.primaryColor,
          sidebarBg: patch.sidebarBg ?? prev.sidebarBg,
        };
        saveTenantTheme(tenantId, next);
        if (tenantId) {
          void api.updateTenantSettings({ business_settings: themeToBusinessSettings(next) }).catch(() => undefined);
        }
        return next;
      });
    },
    [tenantId],
  );

  const resetTheme = useCallback(() => {
    persist({ ...DEFAULT_TENANT_THEME });
  }, [persist]);

  const value = useMemo(
    () => ({ theme, updateTheme, resetTheme }),
    [theme, updateTheme, resetTheme],
  );

  return <TenantThemeContext.Provider value={value}>{children}</TenantThemeContext.Provider>;
};

export function useTenantTheme(): TenantThemeContextValue {
  const ctx = useContext(TenantThemeContext);
  if (!ctx) {
    return {
      theme: DEFAULT_TENANT_THEME,
      updateTheme: () => undefined,
      resetTheme: () => undefined,
    };
  }
  return ctx;
}
