import type { ApiSyncResult, DashboardStats } from '@/lib/apiSync';
import { idbGet, idbSet, idbDelete } from '@/lib/idbStore';

export interface TenantCacheSnapshot extends ApiSyncResult {
  savedAt: string;
  dashboardStats?: DashboardStats | null;
  cacheBranchId?: string | null;
}

/** Cache scope — one snapshot per branch, never shared across branches. */
export function tenantCacheScope(branchId?: string | null): string {
  if (branchId && branchId !== 'all') return branchId;
  return '_all';
}

const legacyKey = (tenantId: string) => `duka_tenant_cache_${tenantId}`;
const metaKey = (tenantId: string, scope: string) => `duka_cache_meta_${tenantId}_${scope}`;
const idbKey = (tenantId: string, scope: string) => `tenant:${tenantId}:${scope}`;

function writeMeta(tenantId: string, scope: string, savedAt: string): void {
  try {
    localStorage.setItem(metaKey(tenantId, scope), JSON.stringify({ savedAt }));
  } catch {
    /* ignore */
  }
}

export async function saveTenantCache(
  tenantId: string,
  branchId: string | null | undefined,
  snapshot: TenantCacheSnapshot,
): Promise<void> {
  if (!tenantId) return;
  const scope = tenantCacheScope(branchId);
  const payload: TenantCacheSnapshot = { ...snapshot, cacheBranchId: branchId ?? null };
  try {
    await idbSet(idbKey(tenantId, scope), payload);
    writeMeta(tenantId, scope, snapshot.savedAt);
    try {
      localStorage.removeItem(legacyKey(tenantId));
    } catch {
      /* ignore */
    }
  } catch {
    try {
      localStorage.setItem(`${legacyKey(tenantId)}_${scope}`, JSON.stringify(payload));
      writeMeta(tenantId, scope, snapshot.savedAt);
    } catch {
      /* quota exceeded */
    }
  }
}

export async function loadTenantCache(
  tenantId: string,
  branchId?: string | null,
): Promise<TenantCacheSnapshot | null> {
  if (!tenantId) return null;
  const scope = tenantCacheScope(branchId);
  try {
    const fromIdb = await idbGet<TenantCacheSnapshot>(idbKey(tenantId, scope));
    if (fromIdb) return fromIdb;
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem(`${legacyKey(tenantId)}_${scope}`);
    if (raw) return JSON.parse(raw) as TenantCacheSnapshot;
  } catch {
    /* ignore */
  }
  // Legacy unscoped cache — only use when no branch filter requested
  if (!branchId || branchId === 'all') {
    try {
      const legacy = localStorage.getItem(legacyKey(tenantId));
      if (legacy) return JSON.parse(legacy) as TenantCacheSnapshot;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function loadCacheSavedAt(tenantId: string, branchId?: string | null): string | null {
  const scope = tenantCacheScope(branchId);
  try {
    const raw = localStorage.getItem(metaKey(tenantId, scope));
    if (raw) return (JSON.parse(raw) as { savedAt: string }).savedAt ?? null;
  } catch {
    /* ignore */
  }
  return null;
}

export async function clearTenantCache(tenantId: string): Promise<void> {
  if (!tenantId) return;
  localStorage.removeItem(legacyKey(tenantId));
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(`duka_cache_meta_${tenantId}_`) || key?.startsWith(`${legacyKey(tenantId)}_`)) {
      localStorage.removeItem(key);
    }
  }
}

export function formatCacheAge(savedAt: string, isSw: boolean): string {
  const ms = Date.now() - new Date(savedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return isSw ? 'Hivi punde' : 'Just now';
  if (mins < 60) return isSw ? `Dakika ${mins} zilizopita` : `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isSw ? `Saa ${hrs} zilizopita` : `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return isSw ? `Siku ${days} zilizopita` : `${days} day(s) ago`;
}
