import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wallet,
  Compass,
  Settings,
  Users,
  Clock,
  CreditCard,
  Receipt,
  Truck,
  BarChart3,
  PieChart,
  Banknote,
  Calendar,
  Building2,
  FileText,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  UserCog,
  HandCoins,
  CircleDollarSign,
} from 'lucide-react';
import type { AuthUser, BusinessType, Language } from '@/types/v1';
import { canAccessVendorTab } from '@/lib/rbac';
import { getBusinessProfile } from '@/lib/businessEngine';

export type AppModuleId = 'home' | 'sales' | 'stock' | 'people' | 'finance' | 'operations' | 'settings';

export interface ModuleTile {
  id: string;
  tab: string;
  labelEn: string;
  labelSw: string;
  hintEn: string;
  hintSw: string;
  icon: LucideIcon;
  accent?: string;
}

export interface AppModule {
  id: AppModuleId;
  hubTab: string;
  labelEn: string;
  labelSw: string;
  hintEn: string;
  hintSw: string;
  icon: LucideIcon;
  tiles: ModuleTile[];
  /** Direct tab (no hub) — e.g. dashboard, settings */
  directTab?: string;
}

export interface ModuleNavContext {
  lowStockCount?: number;
  overdueCreditCount?: number;
  pendingApprovalsCount?: number;
  branchesCount?: number;
}

const SALES_TILES: ModuleTile[] = [
  {
    id: 'pos',
    tab: 'pos',
    labelEn: 'Point of Sale',
    labelSw: 'Uza (POS)',
    hintEn: 'Scan, sell, and print receipts',
    hintSw: 'Changanua, uza, na chapisha risiti',
    icon: ShoppingCart,
    accent: 'bg-emerald-500',
  },
  {
    id: 'pending',
    tab: 'pending-transactions',
    labelEn: 'Pending sales',
    labelSw: 'Mauzo yanayosubiri',
    hintEn: 'Resume carts and awaiting payment',
    hintSw: 'Endelea mauzo yaliyosimamishwa',
    icon: Clock,
    accent: 'bg-amber-500',
  },
  {
    id: 'customers',
    tab: 'customers',
    labelEn: 'Customers',
    labelSw: 'Wateja',
    hintEn: 'CRM, loyalty, and contact history',
    hintSw: 'Wateja, uaminifu, na historia',
    icon: Users,
    accent: 'bg-sky-500',
  },
  {
    id: 'receivables',
    tab: 'receivables-payables',
    labelEn: 'Credit & debts',
    labelSw: 'Madeni & mikopo',
    hintEn: 'Customer credit and supplier payables',
    hintSw: 'Deni la wateja na malipo kwa wauzaji',
    icon: CreditCard,
    accent: 'bg-violet-500',
  },
  {
    id: 'history',
    tab: 'transaction-history',
    labelEn: 'Sales history',
    labelSw: 'Historia ya mauzo',
    hintEn: 'Receipts and past transactions',
    hintSw: 'Risiti na miamala iliyopita',
    icon: Receipt,
    accent: 'bg-slate-500',
  },
];

const STOCK_TILES: ModuleTile[] = [
  {
    id: 'inventory',
    tab: 'inventory',
    labelEn: 'Inventory',
    labelSw: 'Stoo / Bidhaa',
    hintEn: 'Stock levels, batches, and pricing',
    hintSw: 'Akiba, bei, na batch',
    icon: Package,
    accent: 'bg-indigo-500',
  },
  {
    id: 'suppliers',
    tab: 'suppliers',
    labelEn: 'Suppliers & POs',
    labelSw: 'Wauzaji & maagizo',
    hintEn: 'Purchase orders and receiving',
    hintSw: 'Agizo la ununuzi na kupokea bidhaa',
    icon: Truck,
    accent: 'bg-orange-500',
  },
  {
    id: 'forecast',
    tab: 'predictive',
    labelEn: 'Reorder forecast',
    labelSw: 'Utabiri wa ununuzi',
    hintEn: 'What to buy before you run out',
    hintSw: 'Nunua nini kabla ya kuisha',
    icon: Sparkles,
    accent: 'bg-teal-500',
  },
];

const PEOPLE_TILES: ModuleTile[] = [
  {
    id: 'staff',
    tab: 'staff',
    labelEn: 'Staff & HR',
    labelSw: 'Wafanyakazi & HR',
    hintEn: 'Directory, roles, shifts, and performance',
    hintSw: 'Orodha, nafasi, zamu, na utendaji',
    icon: UserCog,
    accent: 'bg-violet-600',
  },
  {
    id: 'payroll',
    tab: 'payroll',
    labelEn: 'Monthly payroll',
    labelSw: 'Mishahara ya mwezi',
    hintEn: 'Salaries, NSSF, bonuses, and payslips',
    hintSw: 'Mishahara, NSSF, bonasi, na slipu',
    icon: Banknote,
    accent: 'bg-emerald-600',
  },
  {
    id: 'allowances',
    tab: 'allowances',
    labelEn: 'Daily stipends',
    labelSw: 'Posho ya kila siku',
    hintEn: 'Food and transport claims',
    hintSw: 'Madai ya chakula na usafiri',
    icon: HandCoins,
    accent: 'bg-amber-500',
  },
  {
    id: 'advances',
    tab: 'advances',
    labelEn: 'Salary advances',
    labelSw: 'Mikopo ya mshahara',
    hintEn: 'Approve and track staff advances',
    hintSw: 'Idhinisha na fuatilia mikopo',
    icon: CircleDollarSign,
    accent: 'bg-sky-600',
  },
];

const FINANCE_TILES: ModuleTile[] = [
  {
    id: 'reports',
    tab: 'reports',
    labelEn: 'Reports',
    labelSw: 'Ripoti',
    hintEn: 'TRA sales, VAT, stock value & purchases (paper)',
    hintSw: 'Mauzo TRA, VAT, thamani ya stoo & ununuzi',
    icon: BarChart3,
    accent: 'bg-blue-500',
  },
  {
    id: 'bi',
    tab: 'bi-analytics',
    labelEn: 'Business intelligence',
    labelSw: 'Uchambuzi wa biashara',
    hintEn: 'Trends, KPIs, and deep dives',
    hintSw: 'Mwenendo, viashiria, na uchambuzi',
    icon: PieChart,
    accent: 'bg-purple-500',
  },
  {
    id: 'expenses',
    tab: 'expenses-payroll',
    labelEn: 'Operating expenses',
    labelSw: 'Matumizi ya uendeshaji',
    hintEn: 'Rent, utilities, and other costs',
    hintSw: 'Kodi, bili, na gharama nyingine',
    icon: Wallet,
    accent: 'bg-rose-500',
  },
];

function operationsTiles(businessType: BusinessType): ModuleTile[] {
  const profile = getBusinessProfile(businessType);
  const workplace: ModuleTile[] = profile.nav_extra.map(extra => ({
    id: extra.id,
    tab: extra.tab.startsWith('workplace-') ? extra.tab : `workplace-${extra.id}`,
    labelEn: extra.label_en,
    labelSw: extra.label_sw,
    hintEn: `Workplace — ${extra.label_en}`,
    hintSw: `Kazi — ${extra.label_sw}`,
    icon: UtensilsCrossed,
    accent: 'bg-emerald-600',
  }));

  return [
    ...workplace,
    {
      id: 'calendar',
      tab: 'calendar',
      labelEn: 'Calendar',
      labelSw: 'Kalenda',
      hintEn: 'Events, deliveries, and reminders',
      hintSw: 'Matukio, usafirishaji, vikumbusho',
      icon: Calendar,
      accent: 'bg-cyan-500',
    },
    {
      id: 'branches',
      tab: 'branches',
      labelEn: 'Branches',
      labelSw: 'Matawi',
      hintEn: 'Locations, transfers, and quotas',
      hintSw: 'Maeneo, uhamisho, na vifurushi',
      icon: Building2,
      accent: 'bg-slate-600',
    },
    {
      id: 'documents',
      tab: 'documents',
      labelEn: 'Documents',
      labelSw: 'Nyaraka',
      hintEn: 'Invoices, quotes, and templates',
      hintSw: 'Ankara, makadirio, na violezo',
      icon: FileText,
      accent: 'bg-neutral-500',
    },
    {
      id: 'tra',
      tab: 'tra-efd',
      labelEn: 'TRA & EFD Setup',
      labelSw: 'Usanidi TRA & EFD',
      hintEn: 'Tax mode, EFD API, receipts & reports — one page',
      hintSw: 'Kodi, EFD API, risiti na ripoti — ukurasa mmoja',
      icon: ShieldCheck,
      accent: 'bg-green-700',
    },
  ];
}

export function buildAppModules(businessType: BusinessType): AppModule[] {
  return [
    {
      id: 'home',
      hubTab: 'dashboard',
      directTab: 'dashboard',
      labelEn: 'Home',
      labelSw: 'Mwanzo',
      hintEn: 'Today at a glance',
      hintSw: 'Muhtasari wa leo',
      icon: LayoutDashboard,
      tiles: [],
    },
    {
      id: 'sales',
      hubTab: 'module-sales',
      labelEn: 'Sales',
      labelSw: 'Mauzo',
      hintEn: 'Sell, customers, and credit',
      hintSw: 'Uza, wateja, na madeni',
      icon: ShoppingCart,
      tiles: SALES_TILES,
    },
    {
      id: 'stock',
      hubTab: 'module-stock',
      labelEn: 'Stock',
      labelSw: 'Stoo',
      hintEn: 'Products and purchasing',
      hintSw: 'Bidhaa na ununuzi',
      icon: Package,
      tiles: STOCK_TILES,
    },
    {
      id: 'people',
      hubTab: 'module-people',
      labelEn: 'People',
      labelSw: 'Watu',
      hintEn: 'Staff, HR, payroll, and stipends',
      hintSw: 'Wafanyakazi, HR, mishahara, na posho',
      icon: Users,
      tiles: PEOPLE_TILES,
    },
    {
      id: 'finance',
      hubTab: 'module-finance',
      labelEn: 'Finance',
      labelSw: 'Fedha',
      hintEn: 'Reports and operating costs',
      hintSw: 'Ripoti na gharama za uendeshaji',
      icon: Wallet,
      tiles: FINANCE_TILES,
    },
    {
      id: 'operations',
      hubTab: 'module-operations',
      labelEn: 'Operations',
      labelSw: 'Shughuli',
      hintEn: 'Workplace, branches, compliance',
      hintSw: 'Kazi, matawi, ushuru',
      icon: Compass,
      tiles: operationsTiles(businessType),
    },
    {
      id: 'settings',
      hubTab: 'settings',
      directTab: 'settings',
      labelEn: 'Settings',
      labelSw: 'Mipangilio',
      hintEn: 'Account and plan',
      hintSw: 'Akaunti na mpango',
      icon: Settings,
      tiles: [],
    },
  ];
}

export function isModuleHubTab(tab: string): boolean {
  return tab.startsWith('module-');
}

export function resolveTabModule(activeTab: string, businessType: BusinessType): AppModule | null {
  const modules = buildAppModules(businessType);
  if (isModuleHubTab(activeTab)) {
    return modules.find(m => m.hubTab === activeTab) ?? null;
  }
  for (const mod of modules) {
    if (mod.directTab === activeTab) return mod;
    if (mod.tiles.some(t => t.tab === activeTab || activeTab.startsWith('workplace-'))) {
      if (activeTab.startsWith('workplace-')) {
        return mod.id === 'operations' ? mod : null;
      }
      return mod;
    }
  }
  // Legacy aliases
  const aliasMap: Record<string, AppModuleId> = {
    debts: 'sales',
    receivables: 'sales',
    payables: 'sales',
    expenses: 'finance',
    payroll: 'people',
    allowances: 'people',
    advances: 'people',
    team: 'people',
    bi: 'finance',
    'branch-management': 'operations',
    profile: 'settings',
    'staff-site': 'people',
  };
  const alias = aliasMap[activeTab];
  if (alias) return modules.find(m => m.id === alias) ?? null;
  return null;
}

export function resolveTileForTab(activeTab: string, businessType: BusinessType): ModuleTile | null {
  const modules = buildAppModules(businessType);
  for (const mod of modules) {
    const tile = mod.tiles.find(t => t.tab === activeTab);
    if (tile) return tile;
  }
  if (activeTab.startsWith('workplace-')) {
    const ops = modules.find(m => m.id === 'operations');
    return (
      ops?.tiles.find(t => t.tab === activeTab) ?? {
        id: activeTab,
        tab: activeTab,
        labelEn: 'Workplace',
        labelSw: 'Mahali pa kazi',
        hintEn: '',
        hintSw: '',
        icon: Compass,
      }
    );
  }
  return null;
}

export function filterAccessibleTiles(
  tiles: ModuleTile[],
  user: AuthUser | null | undefined,
): ModuleTile[] {
  return tiles.filter(t => canAccessVendorTab(user, t.tab));
}

export function getVisibleModules(
  user: AuthUser | null | undefined,
  businessType: BusinessType,
): AppModule[] {
  return buildAppModules(businessType).filter(mod => {
    if (mod.directTab) {
      return canAccessVendorTab(user, mod.directTab);
    }
    return filterAccessibleTiles(mod.tiles, user).length > 0;
  });
}

export function moduleLabel(mod: AppModule, lang: Language): string {
  return lang === 'sw' ? mod.labelSw : mod.labelEn;
}

export function tileLabel(tile: ModuleTile, lang: Language): string {
  return lang === 'sw' ? tile.labelSw : tile.labelEn;
}

export function tileHint(tile: ModuleTile, lang: Language): string {
  return lang === 'sw' ? tile.hintSw : tile.hintEn;
}

export function tileBadge(
  tile: ModuleTile,
  ctx: ModuleNavContext,
): number | undefined {
  if (tile.id === 'inventory' && ctx.lowStockCount) return ctx.lowStockCount;
  if (tile.id === 'receivables' && ctx.overdueCreditCount) return ctx.overdueCreditCount;
  return undefined;
}
