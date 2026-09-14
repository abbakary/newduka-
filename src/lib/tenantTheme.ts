export interface TenantTheme {
  primaryColor: string;
  sidebarBg: string;
}

export const DEFAULT_TENANT_THEME: TenantTheme = {
  primaryColor: '#f97316',
  sidebarBg: '#1a2832',
};

const STORAGE_PREFIX = 'duka_tenant_theme_';

export function themeStorageKey(tenantId?: string | null): string {
  return `${STORAGE_PREFIX}${tenantId || 'local'}`;
}

export function loadTenantTheme(tenantId?: string | null): TenantTheme {
  try {
    const raw = localStorage.getItem(themeStorageKey(tenantId));
    if (!raw) return { ...DEFAULT_TENANT_THEME };
    const parsed = JSON.parse(raw) as Partial<TenantTheme>;
    return {
      primaryColor: normalizeHex(parsed.primaryColor) ?? DEFAULT_TENANT_THEME.primaryColor,
      sidebarBg: normalizeHex(parsed.sidebarBg) ?? DEFAULT_TENANT_THEME.sidebarBg,
    };
  } catch {
    return { ...DEFAULT_TENANT_THEME };
  }
}

export function saveTenantTheme(tenantId: string | null | undefined, theme: TenantTheme): void {
  localStorage.setItem(themeStorageKey(tenantId), JSON.stringify(theme));
}

export function normalizeHex(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return null;
}

export function themeFromBusinessSettings(raw?: Record<string, unknown>): Partial<TenantTheme> {
  if (!raw) return {};
  return {
    primaryColor: normalizeHex(String(raw.primary_color ?? raw.primaryColor ?? '')) ?? undefined,
    sidebarBg: normalizeHex(String(raw.sidebar_bg ?? raw.sidebarBg ?? '')) ?? undefined,
  };
}

export function themeToBusinessSettings(theme: TenantTheme): Record<string, string> {
  return {
    primary_color: theme.primaryColor,
    sidebar_bg: theme.sidebarBg,
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const h = n.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function applyTenantThemeCss(theme: TenantTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--tenant-primary', theme.primaryColor);
  root.style.setProperty('--tenant-sidebar-bg', theme.sidebarBg);
  const rgb = hexToRgb(theme.primaryColor);
  if (rgb) {
    root.style.setProperty('--tenant-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }
  root.style.setProperty('--tenant-primary-soft', `${theme.primaryColor}1a`);
  root.style.setProperty('--tenant-primary-hover', theme.primaryColor);
}
