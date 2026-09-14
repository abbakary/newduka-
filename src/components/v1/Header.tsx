import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Globe, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Building2, 
  ShieldCheck, 
  Home, 
  LogOut, 
  ChevronDown, 
  Store,
  ArrowLeft, 
  User, 
  Pill, 
  ShoppingBag, 
  Hammer, 
  Utensils, 
  Briefcase
} from 'lucide-react';
import { BusinessType, Language, UserRole, AuthUser, TenantStore } from '@/types/v1';

interface HeaderProps {
  role?: UserRole;
  userRole?: UserRole;
  businessType?: BusinessType;
  setBusinessType?: (type: BusinessType) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  isOnline?: boolean;
  pendingSyncCount?: number;
  onSync?: () => void;
  onOpenAIChat: () => void;
  notificationCount?: number;
  activeTab?: string;
  currentUser?: AuthUser | null;
  onGoToLanding?: () => void;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
  // Impersonation support
  isImpersonating?: boolean;
  impersonatedTenantName?: string;
  onExitImpersonation?: () => void;
  tenantsList?: TenantStore[];
  onSelectTenantToImpersonate?: (tenant: TenantStore) => void;
  onOpenQRScanner?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  userRole,
  businessType = 'pharmacy',
  setBusinessType,
  language = 'sw',
  setLanguage,
  isOnline = true,
  pendingSyncCount = 0,
  onSync = () => {},
  onOpenAIChat,
  currentUser,
  onGoToLanding,
  onOpenAuthModal,
  onLogout,
  isImpersonating = false,
  impersonatedTenantName,
  onExitImpersonation,
  tenantsList = [],
  onSelectTenantToImpersonate,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isArchetypeMenuOpen, setIsArchetypeMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const archetypeMenuRef = useRef<HTMLDivElement>(null);

  const currentRole = role || userRole || currentUser?.role || 'vendor_owner';
  const isSuperAdmin = currentRole === 'super_admin';
  const isSw = language === 'sw';

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (archetypeMenuRef.current && !archetypeMenuRef.current.contains(e.target as Node)) {
        setIsArchetypeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'DU';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Business archetype mapping
  const businessConfig: Record<BusinessType, { nameSw: string; nameEn: string; icon: any; color: string; badgeBg: string }> = {
    pharmacy: { nameSw: 'Duka la Dawa (Pharmacy)', nameEn: 'Pharmacy & Health', icon: Pill, color: 'text-sky-600', badgeBg: 'bg-sky-50 border-sky-200' },
    retail: { nameSw: 'Duka la Rejareja (Retail)', nameEn: 'Retail & Grocery', icon: ShoppingBag, color: 'text-indigo-600', badgeBg: 'bg-indigo-50 border-indigo-200' },
    hardware: { nameSw: 'Vifaa vya Ujenzi (Hardware)', nameEn: 'Hardware & Tools', icon: Hammer, color: 'text-amber-600', badgeBg: 'bg-amber-50 border-amber-200' },
    restaurant: { nameSw: 'Mgahawa & Chakula (Bistro)', nameEn: 'Restaurant & Café', icon: Utensils, color: 'text-emerald-600', badgeBg: 'bg-emerald-50 border-emerald-200' },
    service: { nameSw: 'Huduma & Saluni (Services)', nameEn: 'Salon & Services', icon: Briefcase, color: 'text-purple-600', badgeBg: 'bg-purple-50 border-purple-200' }
  };

  const currentBiz = businessConfig[businessType] || businessConfig.pharmacy;
  const BizIcon = currentBiz.icon;

  return (
    <div className="flex flex-col select-none font-['Calibri',_'Aptos',_'Segoe_UI',_sans-serif]">
      {/* 1. Super Admin Live Impersonation Top Alert Banner */}
      {isImpersonating && (
        <div className="bg-amber-600 text-white px-4 sm:px-6 py-2 text-xs font-semibold flex items-center justify-between shadow-md z-30 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
            <span>
              <strong>{isSw ? 'HALI YA UIGAJI (Live Impersonation):' : 'IMPERSONATION ACTIVE:'}</strong>{' '}
              {isSw ? 'Unatazama na kudhibiti duka la' : 'Operating shop context for:'} <u>{impersonatedTenantName || (isSw ? 'Biashara Yako' : 'Your Business')}</u>
            </span>
          </div>

          <button
            onClick={onExitImpersonation}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 hover:bg-black text-amber-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isSw ? 'Rudi Super Admin' : 'Exit Impersonation'}</span>
          </button>
        </div>
      )}

      {/* 2. Main Executive Header Bar - Strictly Single Horizontal Line */}
      <header 
        id="duka-header" 
        className="border-b border-[#E1DFDD] px-3 sm:px-4 py-2 sticky top-0 z-20 shadow-xs flex items-center justify-between gap-2.5 bg-white text-[#323130] flex-nowrap w-full"
      >
        {/* Left Section: Home Nav & Search Bar */}
        <div className="flex items-center gap-2 shrink-0">
          {onGoToLanding && !currentUser && (
            <button
              onClick={onGoToLanding}
              title={isSw ? 'Rudi Ukurasa Mkuu' : 'Back to Landing Page'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border bg-[#F8F8F8] hover:bg-[#EDEBE9] text-[#323130] border-[#EDEBE9] shadow-2xs"
            >
              <Home className="w-4 h-4 text-[#6264A7]" />
              <span className="hidden lg:inline font-bold">{isSw ? 'Ukurasa Mkuu' : 'Landing'}</span>
            </button>
          )}

          {isSuperAdmin ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-mono text-xs font-bold border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                PROVIDER CONTROL PLANE
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Universal Search Input with fixed stable width */}
              <div className="relative w-40 md:w-52 lg:w-60 xl:w-64 shrink-0">
                <Search className="w-3.5 h-3.5 text-[#605E5C] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  id="global-search-input"
                  type="text"
                  placeholder={isSw ? 'Tafuta bidhaa, risiti, wateja...' : 'Search items, receipts, CRM...'}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#F3F2F1] border border-transparent focus:border-[#6264A7] focus:bg-white rounded-xl text-xs text-[#323130] placeholder-[#605E5C] outline-none transition-all"
                />
              </div>

              {/* Physical Branch Location Tag */}
              <div className="hidden 2xl:flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 shrink-0 font-medium">
                <Building2 className="w-3.5 h-3.5 text-[#6264A7]" />
                <span className="font-bold text-[#323130] truncate max-w-[130px]">{currentUser?.branch || 'Kariakoo Flagship'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: All controls in single compact horizontal line */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Impersonate Dropdown (for Super Admin) */}
          {isSuperAdmin && tenantsList.length > 0 && onSelectTenantToImpersonate && (
            <div className="hidden xl:flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 text-xs text-amber-900 shadow-2xs shrink-0">
              <Store className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-bold">{isSw ? 'Duka:' : 'Shop:'}</span>
              <select
                onChange={(e) => {
                  const target = tenantsList.find(t => t.id === e.target.value);
                  if (target) onSelectTenantToImpersonate(target);
                }}
                defaultValue=""
                className="bg-transparent text-amber-800 font-bold outline-none cursor-pointer text-xs"
              >
                <option value="" disabled>{isSw ? '-- Ingia Kwenye Duka --' : '-- Jump into Shop --'}</option>
                {tenantsList.map(t => (
                  <option key={t.id} value={t.id} className="bg-white text-[#323130]">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}



          {/* Language Switcher */}
          <button
            id="lang-toggle-btn"
            onClick={() => setLanguage && setLanguage(language === 'sw' ? 'en' : 'sw')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer bg-[#F3F2F1] hover:bg-[#EDEBE9] text-[#323130] border-[#EDEBE9] shadow-2xs shrink-0"
            title={isSw ? 'Badili Lugha kwenda Kiingereza' : 'Switch to Kiswahili'}
          >
            <Globe className="w-3.5 h-3.5 text-[#6264A7]" />
            <span>{language === 'sw' ? 'SW' : 'EN'}</span>
          </button>

          {/* Offline / Online Network State */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs shrink-0 ${
              isOnline
                ? 'bg-[#107C10]/10 text-[#107C10] border-[#107C10]/30'
                : 'bg-[#D13438]/10 text-[#D13438] border-[#D13438]/30'
            }`}
            title={isOnline
              ? (isSw ? 'Uko mtandaoni' : 'Connected')
              : (isSw ? 'Huna mtandao — data zimehifadhiwa kwenye kifaa' : 'Offline — using saved data on this device')}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOnline ? (isSw ? 'Mtandaoni' : 'Online') : (isSw ? 'Nje ya mtandao' : 'Offline')}</span>
          </div>

          {/* Pending Sync Trigger */}
          {pendingSyncCount > 0 && !isSuperAdmin && (
            <button
              id="sync-now-btn"
              onClick={onSync}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0078D4] text-white text-xs font-bold hover:bg-[#006cbd] transition-all shadow-xs cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Sync ({pendingSyncCount})</span>
            </button>
          )}

          {/* AI Pro Assistant Trigger Button */}
          <button
            id="header-ai-trigger"
            onClick={onOpenAIChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-extrabold shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer bg-gradient-to-r from-[#6264A7] to-[#0078D4] shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">AI Pro</span>
          </button>

          {/* User Profile Capsule with Interactive Dropdown */}
          <div className="relative pl-1 border-l border-[#EDEBE9] shrink-0" ref={userMenuRef}>
            <div 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-50 cursor-pointer transition-all border border-transparent hover:border-slate-200 shrink-0"
            >
              <div className={`w-7 h-7 rounded-xl text-white font-black text-xs flex items-center justify-center ring-2 shrink-0 shadow-xs ${
                isSuperAdmin ? 'bg-emerald-600 ring-emerald-200' : 'bg-[#6264A7] ring-indigo-100'
              }`}>
                {isSuperAdmin ? 'SA' : getInitials(currentUser?.name)}
              </div>
              <div className="hidden xl:block text-left leading-tight pr-0.5 max-w-[130px]">
                <div className="text-xs font-extrabold text-[#323130] truncate">
                  {isSuperAdmin ? 'Super Admin' : (currentUser?.name || 'Salum Omar')}
                </div>
                <div className="text-[10px] font-bold text-[#6264A7] truncate">
                  {isSuperAdmin ? 'Provider' : (currentUser?.branch || 'Kariakoo')}
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </div>

            {/* Profile Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-[#E1DFDD] p-3 z-50 animate-in fade-in zoom-in-95 text-xs">
                <div className="pb-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6264A7] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {getInitials(currentUser?.name)}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-[#323130]">{currentUser?.name || 'Salum Omar'}</h4>
                    <p className="text-[11px] text-slate-500">{currentUser?.email || 'admin@duka.co.tz'}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 space-y-1">
                  {onOpenAuthModal && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAuthModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                    >
                      <User className="w-4 h-4 text-[#6264A7]" />
                      <span>{isSw ? 'Badili Mtumiaji / Ingia Upya' : 'Switch Account / Sign In'}</span>
                    </button>
                  )}

                  {onLogout && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>{isSw ? 'Ondoka Kwenye Mfumo (Logout)' : 'Sign Out of Duka+'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
};
