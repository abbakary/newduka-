import type { EfdApiSettings } from '@/types/traReceipt';
import { DEFAULT_EFD_API_SETTINGS } from '@/types/traReceipt';

const PREFIX = 'dukamkononi_efd_api_';

export function efdSettingsStorageKey(tenantId?: string | null): string {
  return `${PREFIX}${tenantId || 'default'}`;
}

export function loadEfdApiSettings(tenantId?: string | null): EfdApiSettings {
  try {
    const raw = localStorage.getItem(efdSettingsStorageKey(tenantId));
    if (!raw) return { ...DEFAULT_EFD_API_SETTINGS };
    return { ...DEFAULT_EFD_API_SETTINGS, ...JSON.parse(raw) as Partial<EfdApiSettings> };
  } catch {
    return { ...DEFAULT_EFD_API_SETTINGS };
  }
}

export function saveEfdApiSettings(
  tenantId: string | null | undefined,
  settings: EfdApiSettings,
): void {
  localStorage.setItem(efdSettingsStorageKey(tenantId), JSON.stringify(settings));
}
