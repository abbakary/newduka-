import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Receipt,
  Scale,
  Shield,
} from 'lucide-react';
import type { Language } from '@/types/v1';
import {
  TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
  termsSectionBody,
  termsSectionTitle,
  type TermsSection,
} from '@/lib/termsOfService';
import { BrandLogo } from '@/components/ui/BrandLogo';

const TEAL = '#0d9488';
const NAVY = '#0F2347';

function SectionIcon({ icon }: { icon: TermsSection['icon'] }) {
  const cls = 'w-5 h-5';
  switch (icon) {
    case 'shield':
      return <Shield className={cls} />;
    case 'receipt':
      return <Receipt className={cls} />;
    case 'building':
      return <Building2 className={cls} />;
    case 'scale':
      return <Scale className={cls} />;
    case 'alert':
      return <AlertTriangle className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

interface TermsOfServiceViewProps {
  language: Language;
  onBack?: () => void;
  /** When true, show compact header for embedding in wizard */
  embedded?: boolean;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({
  language,
  onBack,
  embedded = false,
}) => {
  const isSw = language === 'sw';

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gradient-to-b from-[#f0fdfa] via-[#fafafa] to-white'}>
      {!embedded && (
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100">
          <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {isSw ? 'Rudi' : 'Back'}
              </button>
            ) : (
              <span />
            )}
            <BrandLogo height={36} />
          </div>
        </header>
      )}

      <div className={`max-w-3xl mx-auto px-4 ${embedded ? 'py-4' : 'py-10 pb-16'}`}>
        {!embedded && (
          <div
            className="rounded-3xl p-8 mb-8 text-white relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${TEAL} 100%)` }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wider mb-4">
                <FileText className="w-3.5 h-3.5" />
                {isSw ? 'Masharti ya Huduma' : 'Terms of Service'}
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold leading-tight">
                {isSw ? 'Makubaliano ya DukaMkononi' : 'DukaMkononi Service Agreement'}
              </h1>
              <p className="mt-3 text-sm text-white/85 max-w-xl leading-relaxed">
                {isSw
                  ? 'Soma kwa makini kuhusu TRA EFD, TIN, na wajibu wako kama mteja. Mtoa huduma wa Duka+ hatawajibika kwa taarifa za uongo ulizotoa.'
                  : 'Please read carefully about TRA EFD, TIN, and your obligations as a client. The Duka+ provider is not liable for false information you submit.'}
              </p>
              <p className="mt-4 text-[11px] text-white/60">
                {isSw ? 'Imesasishwa:' : 'Last updated:'} {TERMS_LAST_UPDATED}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {TERMS_SECTIONS.map(section => (
            <article
              key={section.id}
              className={`rounded-2xl border p-6 shadow-sm ${
                section.highlight
                  ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    section.highlight ? 'bg-amber-100 text-amber-800' : 'bg-teal-50 text-teal-700'
                  }`}
                >
                  <SectionIcon icon={section.icon} />
                </div>
                <h2 className="text-lg font-bold text-slate-900 pt-1.5">
                  {termsSectionTitle(section, isSw)}
                </h2>
              </div>
              <ul className="space-y-3">
                {termsSectionBody(section, isSw).map((para, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600 leading-relaxed">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        section.highlight ? 'text-amber-600' : 'text-teal-600'
                      }`}
                    />
                    <span>{para}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">
            {isSw ? 'Kumbuka muhimu' : 'Important reminder'}
          </p>
          <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
            {isSw
              ? 'Kwa kusajili biashara yako, unathibitisha kuwa taarifa zako za TIN, leseni, na TRA EFD ni za kweli na kwamba wewe — si DukaMkononi — unawajibika kisheria.'
              : 'By registering your business, you confirm your TIN, licence, and TRA EFD details are genuine and that you — not DukaMkononi — are legally responsible.'}
          </p>
        </div>
      </div>
    </div>
  );
};

interface TermsAcceptanceCheckboxProps {
  language: Language;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onOpenTerms?: () => void;
}

export function TermsAcceptanceCheckbox({
  language,
  checked,
  onChange,
  onOpenTerms,
}: TermsAcceptanceCheckboxProps) {
  const isSw = language === 'sw';

  return (
    <label
      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
        checked ? 'border-teal-500 bg-teal-50/80' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
      />
      <span className="text-xs text-slate-700 leading-relaxed">
        {isSw ? 'Nimesoma na nakubali ' : 'I have read and agree to the '}
        {onOpenTerms ? (
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              onOpenTerms();
            }}
            className="font-bold text-teal-700 underline underline-offset-2 cursor-pointer"
          >
            {isSw ? 'Masharti ya Huduma' : 'Terms of Service'}
          </button>
        ) : (
          <strong>{isSw ? 'Masharti ya Huduma' : 'Terms of Service'}</strong>
        )}
        {isSw
          ? ', ikiwa ni pamoja na wajibu wangu wa kutoa TIN na taarifa za TRA EFD za kweli. Ninaelewa Mtoa Huduma wa Duka+ hatawajibika kwa taarifa za uongo.'
          : ', including my duty to provide accurate TIN and TRA EFD information. I understand the Duka+ provider is not liable for false submissions.'}
      </span>
    </label>
  );
}
