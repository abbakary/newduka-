import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  DocumentType,
  TenantDocumentConfig,
  defaultTenantDocumentConfig,
  loadTenantDocumentConfig,
  saveTenantDocumentConfig,
  getActiveTemplate,
  templatesByType,
  allTemplatesForTenant,
  DocumentBranding,
  DocumentTemplate,
} from '@/lib/documentTemplates';
import { compressLogoFile, readFileAsDataUrl } from '@/lib/imageCompress';

interface DocumentTemplateContextValue {
  config: TenantDocumentConfig;
  loading: boolean;
  setActiveTemplate: (type: DocumentType, templateId: string) => void;
  updateBranding: (patch: Partial<DocumentBranding>) => void;
  uploadLogo: (file: File) => Promise<void>;
  removeLogo: () => Promise<void>;
  saveBrandingNow: () => Promise<void>;
  addCustomTemplate: (tpl: DocumentTemplate) => void;
  resetConfig: () => void;
  getActive: (type: DocumentType) => DocumentTemplate;
  listForType: (type: DocumentType) => DocumentTemplate[];
  allTemplates: DocumentTemplate[];
}

const DocumentTemplateContext = createContext<DocumentTemplateContextValue | null>(null);

interface Props {
  tenantId?: string | null;
  businessName?: string;
  children: React.ReactNode;
}

function mapApiDocumentConfig(
  raw: Record<string, unknown>,
  businessName?: string,
  preserveLogoUrl?: string,
): TenantDocumentConfig {
  const defaults = defaultTenantDocumentConfig(businessName);
  const branding = (raw.branding as Record<string, unknown>) ?? {};
  const activeIds = (raw.activeTemplateIds as Record<string, string>) ?? {};
  const apiLogo = String(branding.logoUrl ?? '').trim();
  const logoUrl = apiLogo || preserveLogoUrl || '';
  return {
    activeTemplateIds: { ...defaults.activeTemplateIds, ...activeIds },
    branding: {
      logoUrl,
      companyName: String(branding.companyName ?? businessName ?? ''),
      footerText: String(branding.footerText ?? defaults.branding.footerText),
      watermark: String(branding.watermark ?? ''),
      address: String(branding.address ?? ''),
      phone: String(branding.phone ?? ''),
      tinNumber: String(branding.tinNumber ?? ''),
    },
    customTemplates: (raw.customTemplates as DocumentTemplate[]) ?? [],
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

/** Sync branding without wiping a stored logo when API payload omits it. */
function documentConfigForApi(config: TenantDocumentConfig): Record<string, unknown> {
  return {
    activeTemplateIds: config.activeTemplateIds,
    branding: {
      ...config.branding,
      // Keep logo in API when present so refresh does not clear it.
      logoUrl: config.branding.logoUrl || '',
    },
    customTemplates: config.customTemplates,
    updatedAt: config.updatedAt,
  };
}

export const DocumentTemplateProvider: React.FC<Props> = ({
  tenantId,
  businessName,
  children,
}) => {
  const [config, setConfig] = useState<TenantDocumentConfig>(() =>
    loadTenantDocumentConfig(tenantId, businessName),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setConfig(loadTenantDocumentConfig(tenantId, businessName));
      return;
    }
    setLoading(true);
    const local = loadTenantDocumentConfig(tenantId, businessName);
    api.getTenantSettings()
      .then(res => {
        const doc = res.document_config ?? {};
        if (Object.keys(doc).length) {
          const mapped = mapApiDocumentConfig(doc, businessName, local.branding.logoUrl);
          setConfig(mapped);
          saveTenantDocumentConfig(tenantId, mapped);
        } else {
          setConfig(local);
        }
      })
      .catch(() => {
        setConfig(local);
      })
      .finally(() => setLoading(false));
  }, [tenantId, businessName]);

  const persist = useCallback(
    (updater: (prev: TenantDocumentConfig) => TenantDocumentConfig) => {
      setConfig(prev => {
        const next = updater(prev);
        saveTenantDocumentConfig(tenantId, next);
        if (tenantId) {
          void api.updateTenantSettings({
            document_config: documentConfigForApi(next),
          }).catch(() => undefined);
        }
        return next;
      });
    },
    [tenantId],
  );

  const setActiveTemplate = useCallback(
    (type: DocumentType, templateId: string) => {
      persist(prev => ({
        ...prev,
        activeTemplateIds: { ...prev.activeTemplateIds, [type]: templateId },
        updatedAt: new Date().toISOString(),
      }));
    },
    [persist],
  );

  const updateBranding = useCallback(
    (patch: Partial<DocumentBranding>) => {
      persist(prev => ({
        ...prev,
        branding: { ...prev.branding, ...patch },
        updatedAt: new Date().toISOString(),
      }));
    },
    [persist],
  );

  const uploadLogo = useCallback(
    async (file: File) => {
      let dataUrl: string;
      try {
        ({ dataUrl } = await compressLogoFile(file));
      } catch {
        dataUrl = await readFileAsDataUrl(file);
      }

      const applyLocal = (url: string) => {
        setConfig(prev => {
          const next = {
            ...prev,
            branding: { ...prev.branding, logoUrl: url },
            updatedAt: new Date().toISOString(),
          };
          saveTenantDocumentConfig(tenantId, next);
          return next;
        });
      };

      applyLocal(dataUrl);

      if (tenantId) {
        try {
          const res = await api.uploadDocumentLogo(dataUrl);
          const localLogo = dataUrl;
          const mapped = mapApiDocumentConfig(res.document_config ?? {}, businessName, localLogo);
          // Prefer server logo when present; otherwise keep local data URL
          if (!mapped.branding.logoUrl) {
            mapped.branding.logoUrl = localLogo;
          }
          setConfig(mapped);
          saveTenantDocumentConfig(tenantId, mapped);
          // Also persist branding blob so refresh cannot drop logo
          void api.updateTenantSettings({
            document_config: documentConfigForApi(mapped),
          }).catch(() => undefined);
        } catch {
          // Logo already saved locally — sync will retry later.
        }
      }
    },
    [tenantId, businessName],
  );

  const saveBrandingNow = useCallback(async () => {
    setConfig(prev => {
      saveTenantDocumentConfig(tenantId, prev);
      if (tenantId) {
        void api.updateTenantSettings({
          document_config: documentConfigForApi(prev),
        }).catch(() => undefined);
        if (prev.branding.logoUrl?.startsWith('data:image')) {
          void api.uploadDocumentLogo(prev.branding.logoUrl).catch(() => undefined);
        }
      }
      return prev;
    });
  }, [tenantId]);

  const removeLogo = useCallback(async () => {
    if (tenantId) {
      const res = await api.removeDocumentLogo();
      const mapped = mapApiDocumentConfig(res.document_config ?? {}, businessName, '');
      mapped.branding.logoUrl = '';
      setConfig(mapped);
      saveTenantDocumentConfig(tenantId, mapped);
    } else {
      updateBranding({ logoUrl: '' });
    }
  }, [tenantId, businessName, updateBranding]);

  const addCustomTemplate = useCallback(
    (tpl: DocumentTemplate) => {
      persist(prev => ({
        ...prev,
        customTemplates: [...prev.customTemplates.filter(t => t.id !== tpl.id), tpl],
        updatedAt: new Date().toISOString(),
      }));
    },
    [persist],
  );

  const resetConfig = useCallback(() => {
    persist(() => defaultTenantDocumentConfig(businessName));
  }, [businessName, persist]);

  const value = useMemo(
    () => ({
      config,
      loading,
      setActiveTemplate,
      updateBranding,
      uploadLogo,
      removeLogo,
      saveBrandingNow,
      addCustomTemplate,
      resetConfig,
      getActive: (type: DocumentType) => getActiveTemplate(type, config),
      listForType: (type: DocumentType) => templatesByType(type, config),
      allTemplates: allTemplatesForTenant(config),
    }),
    [config, loading, setActiveTemplate, updateBranding, uploadLogo, removeLogo, saveBrandingNow, addCustomTemplate, resetConfig],
  );

  return (
    <DocumentTemplateContext.Provider value={value}>
      {children}
    </DocumentTemplateContext.Provider>
  );
};

export function useDocumentTemplates(): DocumentTemplateContextValue {
  const ctx = useContext(DocumentTemplateContext);
  if (!ctx) {
    throw new Error('useDocumentTemplates must be used within DocumentTemplateProvider');
  }
  return ctx;
}

