import React from 'react';
import type { AuthUser, BusinessType, Language } from '@/types/v1';
import {
  getVisibleModules,
  isModuleHubTab,
  moduleLabel,
  resolveTabModule,
} from '@/lib/appModules';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  language: Language;
  businessType: BusinessType;
  currentUser?: AuthUser | null;
  lowStockCount?: number;
}

/** Compact thumb-reach nav for phones — mirrors primary sidebar modules. */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  language,
  businessType,
  currentUser,
  lowStockCount = 0,
}) => {
  const modules = getVisibleModules(currentUser, businessType).filter(m => m.id !== 'settings');
  const primary = modules.slice(0, 5);

  const isActive = (mod: (typeof primary)[number]) => {
    if (mod.directTab && activeTab === mod.directTab) return true;
    if (isModuleHubTab(activeTab) && activeTab === mod.hubTab) return true;
    return resolveTabModule(activeTab, businessType)?.id === mod.id;
  };

  return (
    <nav
      className="bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-[#E1DFDD]"
      aria-label={language === 'sw' ? 'Menyu ya chini' : 'Bottom navigation'}
    >
      <div className="grid grid-cols-5 w-full gap-0 px-1 sm:px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {primary.map(mod => {
          const active = isActive(mod);
          const Icon = mod.icon;
          const badge = mod.id === 'stock' && lowStockCount > 0 ? lowStockCount : 0;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => setActiveTab(mod.directTab ?? mod.hubTab)}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-xl text-[10px] font-bold cursor-pointer transition-colors min-w-0 ${
                active ? 'text-[#6264A7] bg-[#6264A7]/8' : 'text-[#8A8886]'
              }`}
            >
              <span className="relative">
                <Icon className={`w-5 h-5 ${active ? 'text-[#6264A7]' : ''}`} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[1rem] h-4 px-0.5 rounded-full bg-amber-400 text-[#323130] text-[9px] font-black flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="truncate w-full text-center leading-tight">{moduleLabel(mod, language)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
