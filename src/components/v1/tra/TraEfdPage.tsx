import React, { useState } from 'react';
import { Settings, Receipt, BarChart3, ShieldCheck } from 'lucide-react';
import type { Language } from '@/types/v1';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import { TraTaxConfigurationBlock } from '@/components/v1/tra/TraTaxConfigurationBlock';
import { TraEfdApiSection } from '@/components/v1/tra/TraEfdApiSection';
import { TraReceiptsSection } from '@/components/v1/tra/TraReceiptsSection';
import { TraReportsSection } from '@/components/v1/tra/TraReportsSection';

export type TraEfdPageTab = 'setup' | 'receipts' | 'reports';

interface TraEfdPageProps {
  language: Language;
  businessName?: string;
  tinNumber?: string;
  initialTab?: TraEfdPageTab;
}

const SETUP_SECTIONS = [
  { id: 'tra-tax-mode', labelEn: 'Tax mode', labelSw: 'Hali ya kodi' },
  { id: 'tra-efd-api', labelEn: 'EFD API', labelSw: 'EFD API' },
] as const;

export const TraEfdPage: React.FC<TraEfdPageProps> = ({
  language,
  businessName,
  tinNumber,
  initialTab = 'setup',
}) => {
  const isSw = language === 'sw';
  const { settings: taxSettings } = useTaxCompliance();
  const [tab, setTab] = useState<TraEfdPageTab>(initialTab);

  const scrollToSection = (id: string) => {
    setTab('setup');
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const tabs: { id: TraEfdPageTab; label: string; icon: React.ReactNode }[] = [
    { id: 'setup', label: isSw ? 'Usanidi' : 'Setup', icon: <Settings className="w-4 h-4" /> },
    { id: 'receipts', label: isSw ? 'Risiti' : 'Receipts', icon: <Receipt className="w-4 h-4" /> },
    { id: 'reports', label: isSw ? 'Ripoti' : 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  const modeLabel =
    taxSettings.mode === 'tra_efd'
      ? isSw ? 'TRA EFD imewashwa' : 'TRA EFD active'
      : taxSettings.mode === 'non_vat'
        ? isSw ? 'Sio msajili wa VAT' : 'Not VAT registered'
        : isSw ? 'VAT manual' : 'Manual VAT';

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#E65100] to-[#FF8F00] rounded-xl px-5 py-4 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
              <ShieldCheck className="w-4 h-4" />
              TRA & EFD
            </div>
            <h2 className="text-xl font-bold mt-1">
              {isSw ? 'Usimamizi wa Kodi, TRA & EFD' : 'Tax, TRA & EFD Management'}
            </h2>
            <p className="text-xs opacity-90 mt-1">
              {businessName || taxSettings.receiptBusinessName || (isSw ? 'Duka lako' : 'Your shop')}
              {' · '}
              {modeLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  tab === t.id
                    ? 'bg-white text-[#E65100] shadow-sm'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'setup' && (
        <div className="space-y-6">
          <nav className="flex flex-wrap gap-2 sticky top-0 z-10 bg-white/90 backdrop-blur-sm border border-[#E1DFDD] rounded-xl p-2 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-[#605E5C] px-2 py-1 self-center">
              {isSw ? 'Nenda kwenye:' : 'Jump to:'}
            </span>
            {SETUP_SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F3F2F1] hover:bg-[#E65100]/10 hover:text-[#E65100] text-[#323130] cursor-pointer"
              >
                {isSw ? s.labelSw : s.labelEn}
              </button>
            ))}
          </nav>

          <TraTaxConfigurationBlock
            language={language}
            businessName={businessName}
            tinNumber={tinNumber}
          />

          <TraEfdApiSection language={language} />
        </div>
      )}

      {tab === 'receipts' && <TraReceiptsSection language={language} />}

      {tab === 'reports' && <TraReportsSection language={language} />}
    </div>
  );
};
