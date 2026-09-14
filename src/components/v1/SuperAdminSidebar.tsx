import React from 'react';
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { Language } from '@/types/v1';
import { BrandLogo } from '@/components/ui/BrandLogo';

const FOREST = '#003322';
const GOLD = '#D4AF37';

interface SuperAdminSidebarProps {
  activeTab?: string;
  setActiveTab?: (view: string) => void;
  language: Language;
  onLogout: () => void;
  pendingApprovalsCount?: number;
  tenantsCount?: number;
  unpaidCount?: number;
  onSwitchToVendorMode?: () => void;
  onGoToLanding?: () => void;
}

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({
  activeTab = 'super-dashboard',
  setActiveTab,
  language = 'sw',
  onLogout,
  pendingApprovalsCount = 0,
  tenantsCount = 0,
  unpaidCount = 0,
  onSwitchToVendorMode,
  onGoToLanding,
}) => {
  const isSw = language === 'sw';
  const nav = (tab: string) => setActiveTab?.(tab);

  const link = (tab: string, icon: React.ReactNode, label: string, badge?: number | string) => {
    const active = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => nav(tab)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
          active ? 'text-[#003322]' : 'text-white/85 hover:bg-white/8 hover:text-white'
        }`}
        style={active ? { backgroundColor: GOLD } : undefined}
      >
        <span className="flex items-center gap-3">
          <span className={active ? 'text-[#003322]' : 'text-white/70'}>{icon}</span>
          {label}
        </span>
        {badge != null && badge !== 0 && (
          <span
            className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center ${
              active ? 'bg-[#003322] text-[#D4AF37]' : 'bg-[#D4AF37] text-[#003322]'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className="w-[17.5rem] min-w-[17.5rem] h-[calc(100dvh-1.5rem)] flex flex-col rounded-2xl overflow-hidden shadow-xl select-none font-sans"
      style={{ backgroundColor: FOREST }}
    >
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <BrandLogo height={40} className="rounded-lg" />
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>
              {isSw ? 'Mtoa Huduma' : 'Provider'}
            </p>
          </div>
        </div>
        <div className="mt-4 px-3 py-2.5 rounded-xl bg-white/8 border border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white">{isSw ? 'Usimamizi wa Wateja' : 'Client management'}</span>
          </div>
          <p className="text-[10px] text-white/60 mt-1">{isSw ? 'Malipo • Vifurushi • Vikumbusho' : 'Billing • Plans • Reminders'}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: GOLD }}>
          {isSw ? 'Wateja' : 'Clients'}
        </p>
        {link('super-dashboard', <LayoutDashboard className="w-4 h-4" />, isSw ? 'Dashibodi' : 'Dashboard')}
        {link('super-tenants', <Building2 className="w-4 h-4" />, isSw ? 'Orodha ya Wateja' : 'All clients', tenantsCount)}
        {link('super-approvals', <ShieldCheck className="w-4 h-4" />, isSw ? 'Uthibitishaji KYC' : 'KYC queue', pendingApprovalsCount)}

        <p className="px-3 pt-4 text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: GOLD }}>
          {isSw ? 'Malipo & Vifurushi' : 'Billing & plans'}
        </p>
        {link('super-subscriptions', <CreditCard className="w-4 h-4" />, isSw ? 'Malipo & Usajili' : 'Payments', unpaidCount || undefined)}
        {link('super-plans', <Package className="w-4 h-4" />, isSw ? 'Vifurushi & Bei' : 'Plans & pricing')}

        <p className="px-3 pt-4 text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: GOLD }}>
          {isSw ? 'Mawasiliano' : 'Outreach'}
        </p>
        {link('super-reminders', <Bell className="w-4 h-4" />, isSw ? 'Vikumbusho' : 'Reminders')}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        {onGoToLanding && (
          <button
            type="button"
            onClick={onGoToLanding}
            className="w-full flex items-center gap-2 text-xs text-white/70 hover:text-white cursor-pointer py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isSw ? 'Rudi kwenye tovuti ya wateja' : 'Back to client site'}
          </button>
        )}
        {onSwitchToVendorMode && (
          <button
            type="button"
            onClick={onSwitchToVendorMode}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/15 text-xs font-bold text-white/90 hover:bg-white/8 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Store className="w-4 h-4" style={{ color: GOLD }} />
              {isSw ? 'Tazama kama duka' : 'Preview shop portal'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-300 hover:text-rose-200 cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> {isSw ? 'Ondoka' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
};
