import { resolveStaffPermissions } from '@/lib/apiSync';
import { buildAppModules, filterAccessibleTiles } from '@/lib/appModules';
import type { AuthUser, BusinessType, StaffPermissions, StaffRole, UserRole } from '@/types/v1';

export function resolveUserPermissions(user: AuthUser | null | undefined): StaffPermissions {
  if (!user) {
    return resolveStaffPermissions({ role: 'Cashier', permissions: undefined });
  }
  if (user.role === 'vendor_owner' || user.staffRole === 'Owner') {
    return resolveStaffPermissions({ role: 'Owner', permissions: user.permissions });
  }
  if (user.role === 'super_admin') {
    return resolveStaffPermissions({ role: 'Owner', permissions: user.permissions });
  }
  const staffRole = (user.staffRole ?? 'Cashier') as StaffRole;
  return resolveStaffPermissions({ role: staffRole, permissions: user.permissions });
}

function roleFlags(user: AuthUser | null | undefined) {
  const role = user?.role as UserRole | undefined;
  const staffRole = user?.staffRole;
  const isOwner = role === 'vendor_owner' || staffRole === 'Owner';
  const isManager = isOwner || staffRole === 'Manager';
  const isCashier = staffRole === 'Cashier';
  const isAccountant = staffRole === 'Accountant';
  const isStorekeeper = staffRole === 'Storekeeper';
  const perms = resolveUserPermissions(user);
  return { isOwner, isManager, isCashier, isAccountant, isStorekeeper, perms };
}

export function canSeeReceivables(user: AuthUser | null | undefined): boolean {
  const { isOwner, isManager, isCashier, isAccountant } = roleFlags(user);
  return isOwner || isManager || isCashier || isAccountant;
}

export function canSettleCustomerDebt(user: AuthUser | null | undefined): boolean {
  const { isOwner, isManager, isCashier, isAccountant, perms } = roleFlags(user);
  return isOwner || isManager || isCashier || isAccountant || perms.canGiveCredit || perms.canSellPOS;
}

export function canSettleSupplierPayable(user: AuthUser | null | undefined): boolean {
  const { isOwner, isManager, isAccountant, isStorekeeper, perms } = roleFlags(user);
  return isOwner || isManager || isAccountant || isStorekeeper || perms.canManageSuppliers;
}

export function canSeeExpenses(user: AuthUser | null | undefined): boolean {
  const { isOwner, isManager, isAccountant } = roleFlags(user);
  return isOwner || isManager || isAccountant;
}

export function canManageExpenses(user: AuthUser | null | undefined): boolean {
  const { isOwner, isManager, isAccountant, perms } = roleFlags(user);
  return isOwner || isManager || isAccountant || perms.canViewProfitReports;
}

/** Owner & Manager — process monthly payroll, approve advances, configure allowance rates */
export function canManagePayroll(user: AuthUser | null | undefined): boolean {
  const { isOwner, isManager } = roleFlags(user);
  return isOwner || isManager;
}

export function canConfigureAllowances(user: AuthUser | null | undefined): boolean {
  return canManagePayroll(user);
}

export function canApproveAdvances(user: AuthUser | null | undefined): boolean {
  return canManagePayroll(user);
}

/** View-only access to payroll hub tabs (Accountant can view, not pay) */
export function canViewPayrollHub(user: AuthUser | null | undefined): boolean {
  return canSeeExpenses(user);
}

/** Owner & Manager — switch workstation / impersonate staff for supervision */
export function canSwitchStaffWorkstation(user: AuthUser | null | undefined): boolean {
  const { isOwner, isManager } = roleFlags(user);
  return isOwner || isManager;
}

/** Owner & Manager — RBAC matrix, staff registration, permission edits */
export function canManageStaffRBAC(user: AuthUser | null | undefined): boolean {
  return canSwitchStaffWorkstation(user);
}

/** Staff self-service: claim own daily posho (cashier, pharmacist, etc.) */
export function canClaimOwnDailyStipend(user: AuthUser | null | undefined): boolean {
  const { perms } = roleFlags(user);
  return Boolean(perms.canPerformDailyClosing || perms.canSellPOS);
}

function canAccessModuleHub(
  user: AuthUser | null | undefined,
  hubTab: string,
  businessType?: BusinessType,
): boolean {
  const bt = businessType ?? (user?.businessType as BusinessType) ?? 'retail';
  const mod = buildAppModules(bt).find(m => m.hubTab === hubTab);
  if (!mod) return false;
  return filterAccessibleTiles(mod.tiles, user).length > 0;
}

export function canAccessVendorTab(
  user: AuthUser | null | undefined,
  tab: string,
  businessType?: BusinessType,
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return tab.startsWith('super-') || tab === 'super-dashboard';

  if (tab.startsWith('module-')) {
    return canAccessModuleHub(user, tab, businessType);
  }

  const map: Record<string, () => boolean> = {
    dashboard: () => {
      const { isOwner, isManager, isAccountant, isCashier } = roleFlags(user);
      return isOwner || isManager || isAccountant || isCashier || Boolean(user.staffRole);
    },
    pos: () => {
      const { isOwner, isManager, isCashier, perms } = roleFlags(user);
      return isOwner || isManager || isCashier || user.staffRole === 'Pharmacist' || perms.canSellPOS;
    },
    customers: () => {
      const { isOwner, isManager, isCashier, isAccountant } = roleFlags(user);
      return isOwner || isManager || isCashier || isAccountant || user.staffRole === 'Pharmacist';
    },
    'receivables-payables': canSeeReceivables,
    debts: canSeeReceivables,
    receivables: canSeeReceivables,
    payables: canSeeReceivables,
    'expenses-payroll': canSeeExpenses,
    expenses: canSeeExpenses,
    payroll: canViewPayrollHub,
    allowances: canViewPayrollHub,
    advances: canViewPayrollHub,
    staff: canManageStaffRBAC,
    team: canManageStaffRBAC,
    'staff-site': canManageStaffRBAC,
    'module-people': () => canManageStaffRBAC(user) || canViewPayrollHub(user),
    inventory: () => {
      const { isOwner, isManager, perms } = roleFlags(user);
      return (
        isOwner ||
        isManager ||
        user.staffRole === 'Storekeeper' ||
        user.staffRole === 'Pharmacist' ||
        perms.canModifyInventory ||
        perms.canViewInventory
      );
    },
    suppliers: () => {
      const { isOwner, isManager, isAccountant, isStorekeeper, perms } = roleFlags(user);
      return isOwner || isManager || isAccountant || isStorekeeper || perms.canManageSuppliers;
    },
    reports: () => {
      const { isOwner, isManager, isAccountant, perms } = roleFlags(user);
      return isOwner || isManager || isAccountant || perms.canViewProfitReports;
    },
    analytics: () => canAccessVendorTab(user, 'reports'),
    'bi-analytics': () => {
      const { isOwner, isManager, isAccountant } = roleFlags(user);
      return isOwner || isManager || isAccountant;
    },
    bi: () => canAccessVendorTab(user, 'bi-analytics'),
    branches: () => {
      const { isOwner, isManager } = roleFlags(user);
      return isOwner || isManager;
    },
    'branch-management': () => canAccessVendorTab(user, 'branches'),
    settings: () => true,
    profile: () => true,
    documents: () => {
      const { isOwner, isManager, isAccountant } = roleFlags(user);
      return isOwner || isManager || isAccountant;
    },
    'transaction-history': () => {
      const { isOwner, isManager, isAccountant, isCashier } = roleFlags(user);
      return isOwner || isManager || isAccountant || isCashier;
    },
    'tra-efd': () => {
      const { isOwner, isManager, isAccountant } = roleFlags(user);
      return isOwner || isManager || isAccountant;
    },
    'pending-transactions': () => canAccessVendorTab(user, 'pos'),
  };

  const checker = map[tab];
  return checker ? checker(user) : true;
}

export function receivablesInitialTab(activeTab: string): 'receivables' | 'payables' | 'history' {
  if (activeTab === 'payables') return 'payables';
  if (activeTab === 'history') return 'history';
  return 'receivables';
}

export function expensesInitialTab(activeTab: string): 'expenses' | 'allowances' | 'payroll' | 'advances' | 'team' {
  if (activeTab === 'payroll') return 'payroll';
  if (activeTab === 'allowances') return 'allowances';
  if (activeTab === 'advances') return 'advances';
  if (activeTab === 'team') return 'team';
  return 'expenses';
}

export type DashboardPersona =
  | 'owner'
  | 'manager'
  | 'cashier'
  | 'accountant'
  | 'storekeeper'
  | 'pharmacist';

export function getDashboardPersona(user: AuthUser | null | undefined): DashboardPersona {
  if (!user) return 'owner';
  if (user.role === 'vendor_owner' || user.staffRole === 'Owner') return 'owner';
  if (user.staffRole === 'Manager') return 'manager';
  if (user.staffRole === 'Accountant') return 'accountant';
  if (user.staffRole === 'Storekeeper') return 'storekeeper';
  if (user.staffRole === 'Pharmacist') return 'pharmacist';
  if (user.staffRole === 'Cashier' || user.role === 'vendor_staff') return 'cashier';
  return 'owner';
}

export function canSeeExecutiveDashboard(user: AuthUser | null | undefined): boolean {
  const persona = getDashboardPersona(user);
  return persona === 'owner' || persona === 'manager' || persona === 'accountant';
}

export function canToggleDashboardView(user: AuthUser | null | undefined): boolean {
  const { isOwner, isManager } = roleFlags(user);
  return isOwner || isManager;
}

export interface PosPricingAccess {
  canApplyDiscount: boolean;
  canApproveHighDiscount: boolean;
  maxDiscountPercent: number;
  canOverridePrice: boolean;
  canUsePartialPayment: boolean;
  canNegotiate: boolean;
}

/** Tenant toggles + staff permissions for POS discounts, overrides, and negotiation. */
export function resolvePosPricingAccess(
  user: AuthUser | null | undefined,
  settings: {
    discountEnabled?: boolean;
    maxDiscountPercent?: number;
    priceOverrideEnabled?: boolean;
    partialPaymentEnabled?: boolean;
    negotiationEnabled?: boolean;
  },
): PosPricingAccess {
  const perms = resolveUserPermissions(user);
  const maxDiscountPercent = settings.maxDiscountPercent ?? 15;
  const negotiation = Boolean(settings.negotiationEnabled);
  const canSell = perms.canSellPOS;
  return {
    canApplyDiscount: (Boolean(settings.discountEnabled) || negotiation) && canSell,
    canApproveHighDiscount: perms.canApproveDiscounts,
    maxDiscountPercent,
    canOverridePrice:
      (Boolean(settings.priceOverrideEnabled) || negotiation) &&
      (perms.canOverridePrices || perms.canApproveDiscounts || (negotiation && canSell)),
    canUsePartialPayment:
      Boolean(settings.partialPaymentEnabled) &&
      (perms.canGiveCredit || canSell),
    canNegotiate: negotiation && canSell,
  };
}
