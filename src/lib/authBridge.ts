import { api } from '@/lib/api';
import type { AuthUser, StaffPermissions } from '@/types/v1';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  tenant_id?: string;
  staff_id?: string;
  business_name?: string;
  business_type?: string;
  plan?: string;
  subscription_expiry?: string;
  tin_number?: string;
  license_number?: string;
  staff_role?: string;
  branch?: string;
  branch_id?: string;
  branch_name?: string;
  branch_type?: string;
  is_branch_scoped?: boolean;
  permissions?: Partial<StaffPermissions>;
  language?: string;
  status?: string;
}

const USER_KEY = 'duka_user';

export function mapApiUserToAuthUser(apiUser: ApiUser): AuthUser {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    phone: apiUser.phone || '',
    role: apiUser.role as AuthUser['role'],
    businessName: apiUser.business_name,
    businessType: apiUser.business_type as AuthUser['businessType'],
    businessId: apiUser.tenant_id,
    staffRole: apiUser.staff_role as AuthUser['staffRole'],
    staffId: apiUser.staff_id,
    staff_id: apiUser.staff_id,
    branch: apiUser.branch_name ?? apiUser.branch,
    branchId: apiUser.branch_id,
    branchName: apiUser.branch_name,
    branchType: apiUser.branch_type as AuthUser['branchType'],
    isBranchScoped: Boolean(apiUser.is_branch_scoped),
    permissions: apiUser.permissions,
    status: (apiUser.status as AuthUser['status']) || 'approved',
    tinNumber: apiUser.tin_number,
    licenseNumber: apiUser.license_number,
    plan: apiUser.plan as AuthUser['plan'],
    subscriptionExpiry: apiUser.subscription_expiry,
  };
}

export function persistAuthUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadCachedAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('connection') ||
    msg.includes('timeout')
  );
}

export function isAuthFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid');
}

export interface SessionRestoreResult {
  user: AuthUser | null;
  offline: boolean;
  fromCache: boolean;
}

export async function tryRestoreSession(): Promise<SessionRestoreResult> {
  api.loadTokens();
  if (!api.hasValidSession()) {
    api.clearTokens();
    return { user: null, offline: false, fromCache: false };
  }

  const cached = loadCachedAuthUser();

  if (!navigator.onLine) {
    if (cached) return { user: cached, offline: true, fromCache: true };
    return { user: null, offline: true, fromCache: false };
  }

  try {
    const user = await api.getMe();
    const mapped = mapApiUserToAuthUser(user as unknown as ApiUser);
    persistAuthUser(mapped);
    return { user: mapped, offline: false, fromCache: false };
  } catch (error) {
    if (isAuthFailure(error)) {
      api.clearTokens();
      return { user: null, offline: false, fromCache: false };
    }
    if (cached) {
      return { user: cached, offline: true, fromCache: true };
    }
    return { user: null, offline: !navigator.onLine, fromCache: false };
  }
}

export async function loginAndLoadUser(email: string, password: string): Promise<AuthUser> {
  const tokens = await api.login(email.trim(), password);
  api.setTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in_days);
  const me = await api.getMe();
  const user = mapApiUserToAuthUser(me as unknown as ApiUser);
  persistAuthUser(user);
  return user;
}
