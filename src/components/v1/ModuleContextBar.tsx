import React from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import type { BusinessType, Language } from '@/types/v1';
import {
  isModuleHubTab,
  moduleLabel,
  resolveTabModule,
  tileLabel,
  resolveTileForTab,
} from '@/lib/appModules';

interface ModuleContextBarProps {
  activeTab: string;
  language: Language;
  businessType: BusinessType;
  onNavigate: (tab: string) => void;
}

export const ModuleContextBar: React.FC<ModuleContextBarProps> = ({
  activeTab,
  language,
  businessType,
  onNavigate,
}) => {
  if (activeTab === 'dashboard' || activeTab === 'settings' || isModuleHubTab(activeTab)) {
    return null;
  }

  const mod = resolveTabModule(activeTab, businessType);
  const tile = resolveTileForTab(activeTab, businessType);
  if (!mod || !tile) return null;

  const isSw = language === 'sw';

  return (
    <nav
      aria-label={isSw ? 'Mahali ulipo' : 'You are here'}
      className="mb-4 flex items-center gap-1.5 text-xs text-[#605E5C]"
    >
      <button
        type="button"
        onClick={() => onNavigate(mod.hubTab.startsWith('module-') ? mod.hubTab : mod.directTab ?? 'dashboard')}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-[#F3F2F1] text-[#6264A7] cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {moduleLabel(mod, language)}
      </button>
      <ChevronRight className="h-3.5 w-3.5 opacity-50" />
      <span className="font-bold text-[#323130]">{tileLabel(tile, language)}</span>
    </nav>
  );
};
