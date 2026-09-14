import React from 'react';
import { ChevronRight, LogOut, Wifi, WifiOff } from 'lucide-react';
import type { AuthUser, BusinessType, Language, UserRole } from '@/types/v1';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useTenantTheme } from '@/context/TenantThemeContext';
import { getWorkplace } from '@/lib/businessProfiles';
import {
  getVisibleModules,
  isModuleHubTab,
  moduleLabel,
  resolveTabModule,
  type AppModuleId,
} from '@/lib/appModules';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  activeTab: string;
  setActiveTab: (view: string) => void;
  language: Language;
  role?: UserRole;
  userRole?: UserRole;
  businessType: BusinessType;
  businessName?: string;
  lowStockCount?: number;
  overdueCreditCount?: number;
  isOnline?: boolean;
  currentUser?: AuthUser | null;
  staffRole?: string;
  branchLabel?: string;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  language,
  businessType,
  businessName = 'Duka+',
  lowStockCount = 0,
  overdueCreditCount = 0,
  isOnline = true,
  currentUser,
  staffRole,
  branchLabel,
  onLogout,
}) => {
  const { theme } = useTenantTheme();
  const isSw = language === 'sw';
  const workplace = getWorkplace(businessType, language);
  const modules = getVisibleModules(currentUser, businessType);

  const navigateModule = (mod: (typeof modules)[number]) => {
    setActiveTab(mod.directTab ?? mod.hubTab);
  };

  const isModuleActive = (mod: (typeof modules)[number]) => {
    if (mod.directTab && activeTab === mod.directTab) return true;
    if (isModuleHubTab(activeTab) && activeTab === mod.hubTab) return true;
    const resolved = resolveTabModule(activeTab, businessType);
    return resolved?.id === mod.id;
  };

  const moduleBadge = (id: AppModuleId): number | undefined => {
    if (id === 'stock' && lowStockCount > 0) return lowStockCount;
    if (id === 'sales' && overdueCreditCount > 0) return overdueCreditCount;
    return undefined;
  };

  const sidebarBg = theme.sidebarBg || '#1a2832';

  return (
    <aside
      className="w-[15.5rem] min-w-[15.5rem] h-[calc(100dvh-1.5rem)] m-3 mr-0 flex flex-col rounded-2xl overflow-hidden shadow-xl select-none font-sans shrink-0"
      style={{ backgroundColor: sidebarBg }}
    >
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <BrandLogo height={36} className="rounded-lg brightness-110" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{businessName}</p>
            <p className="text-[10px] text-white/60 truncate">
              {isSw ? workplace.label_sw : workplace.label_en}
              {branchLabel ? ` · ${branchLabel}` : ''}
            </p>
          </div>
        </div>
        {staffRole && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/50 px-1">
            {staffRole}
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-wider text-white/40">
          {isSw ? 'Moduli' : 'Modules'}
        </p>
        {modules.map(mod => {
          const active = isModuleActive(mod);
          const badge = moduleBadge(mod.id);
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => navigateModule(mod)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-white text-[#323130] shadow-md'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#6264A7]' : 'text-white/70'}`} />
                <span className="truncate">{moduleLabel(mod, language)}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                {badge != null && badge > 0 && (
                  <span
                    className={`min-w-[1.15rem] h-5 px-1 rounded-full text-[10px] font-black flex items-center justify-center ${
                      active ? 'bg-rose-500 text-white' : 'bg-amber-400 text-[#323130]'
                    }`}
                  >
                    {badge}
                  </span>
                )}
                <ChevronRight className={`h-4 w-4 ${active ? 'text-[#6264A7]' : 'text-white/30'}`} />
              </span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-2">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold ${
            isOnline ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'
          }`}
        >
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? (isSw ? 'Mtandaoni' : 'Online') : (isSw ? 'Nje ya mtandao' : 'Offline')}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-300 hover:text-rose-200 cursor-pointer rounded-lg hover:bg-white/5"
        >
          <LogOut className="h-4 w-4" />
          {isSw ? 'Ondoka' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
};
