import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { AuthUser, BusinessType, Language } from '@/types/v1';
import {
  filterAccessibleTiles,
  moduleLabel,
  resolveTabModule,
  tileBadge,
  tileHint,
  tileLabel,
  type ModuleNavContext,
} from '@/lib/appModules';
import { getDashboardPersona } from '@/lib/rbac';

interface ModuleHubViewProps {
  hubTab: string;
  language: Language;
  businessType: BusinessType;
  currentUser?: AuthUser | null;
  onNavigate: (tab: string) => void;
  navContext?: ModuleNavContext;
}

const PERSONA_GREETING: Record<string, { en: string; sw: string }> = {
  cashier: {
    en: 'Start with POS — scan items and complete a sale.',
    sw: 'Anza na POS — changanua bidhaa na kamilisha mauzo.',
  },
  storekeeper: {
    en: 'Check stock levels and receive purchase orders.',
    sw: 'Angalia akiba na pokea maagizo ya ununuzi.',
  },
  accountant: {
    en: 'Review reports, expenses, and receivables.',
    sw: 'Angalia ripoti, matumizi, na madeni.',
  },
  owner: {
    en: 'Pick what you want to do — each card opens one task.',
    sw: 'Chagua unachotaka kufanya — kila kadi ni kazi moja.',
  },
  manager: {
    en: 'Pick what you want to do — each card opens one task.',
    sw: 'Chagua unachotaka kufanya — kila kadi ni kazi moja.',
  },
  pharmacist: {
    en: 'Dispense medicines or manage stock batches.',
    sw: 'Toa dawa au simamia batch za stoo.',
  },
};

export const ModuleHubView: React.FC<ModuleHubViewProps> = ({
  hubTab,
  language,
  businessType,
  currentUser,
  onNavigate,
  navContext = {},
}) => {
  const isSw = language === 'sw';
  const mod = resolveTabModule(hubTab, businessType);
  if (!mod) return null;

  const tiles = filterAccessibleTiles(mod.tiles, currentUser);
  const persona = getDashboardPersona(currentUser);
  const greeting =
    PERSONA_GREETING[persona] ?? PERSONA_GREETING.owner;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6264A7]/10 text-[#6264A7]">
            <mod.icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-[#323130] tracking-tight">
              {moduleLabel(mod, language)}
            </h1>
            <p className="text-sm text-[#605E5C]">
              {isSw ? mod.hintSw : mod.hintEn}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-[#6264A7]/20 bg-[#6264A7]/5 px-4 py-3 text-sm text-[#323130]">
          <Sparkles className="h-4 w-4 shrink-0 text-[#6264A7] mt-0.5" />
          <span>{isSw ? greeting.sw : greeting.en}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(tile => {
          const Icon = tile.icon;
          const badge = tileBadge(tile, navContext);
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => onNavigate(tile.tab)}
              className="group text-left rounded-2xl border border-[#E1DFDD] bg-white p-5 shadow-sm hover:shadow-md hover:border-[#6264A7]/40 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${tile.accent ?? 'bg-[#6264A7]'}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {badge != null && badge > 0 && (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-base font-bold text-[#323130] group-hover:text-[#6264A7]">
                {tileLabel(tile, language)}
              </h2>
              <p className="mt-1 text-xs text-[#605E5C] leading-relaxed">
                {tileHint(tile, language)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#6264A7] opacity-0 group-hover:opacity-100 transition-opacity">
                {isSw ? 'Fungua' : 'Open'}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
