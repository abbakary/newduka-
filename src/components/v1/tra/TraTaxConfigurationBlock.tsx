import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ShoppingBag,
  Boxes,
  FileText,
} from 'lucide-react';
import type { Language } from '@/types/v1';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import { TaxComplianceSettings, normalizeTaxComplianceSettings } from '@/lib/taxComplianceSettings';

interface TraTaxConfigurationBlockProps {
  language: Language;
  businessName?: string;
  tinNumber?: string;
  sectionId?: string;
}

export const TraTaxConfigurationBlock: React.FC<TraTaxConfigurationBlockProps> = ({
  language,
  businessName,
  tinNumber,
  sectionId = 'tra-tax-mode',
}) => {
  const isSw = language === 'sw';
  const { settings, applySettings } = useTaxCompliance();
  const [draft, setDraft] = useState<TaxComplianceSettings>(() => ({
    ...settings,
    receiptBusinessName: settings.receiptBusinessName || businessName || '',
    tinNumber: settings.tinNumber || tinNumber || '',
  }));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft({
      ...settings,
      receiptBusinessName: settings.receiptBusinessName || businessName || '',
      tinNumber: settings.tinNumber || tinNumber || '',
    });
  }, [settings, businessName, tinNumber]);

  const patch = (partial: Partial<TaxComplianceSettings>) => {
    setDraft(prev => ({ ...prev, ...partial }));
    setSaved(false);
  };

  /** Apply immediately so POS/reports pick up tax mode without forgetting Save. */
  const patchAndApply = (partial: Partial<TaxComplianceSettings>) => {
    setDraft(prev => {
      const next = normalizeTaxComplianceSettings({
        ...prev,
        ...partial,
        vatRate: Math.min(Math.max((partial.vatRate ?? prev.vatRate), 0), 1),
        maxDiscountPercent: Math.min(
          Math.max((partial.maxDiscountPercent ?? prev.maxDiscountPercent), 0),
          100,
        ),
      });
      applySettings(next);
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleApply = () => {
    applySettings(normalizeTaxComplianceSettings({
      ...draft,
      vatRate: Math.min(Math.max(draft.vatRate, 0), 1),
      maxDiscountPercent: Math.min(Math.max(draft.maxDiscountPercent, 0), 100),
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const isTra = draft.mode === 'tra_efd';
  const isNonVat = draft.mode === 'non_vat' || !draft.vatRegistered;
  const vatControlsDisabled = isNonVat;

  return (
    <div id={sectionId} className="space-y-5 scroll-mt-4">
      <div className="bg-white rounded-xl border border-[#E1DFDD] p-6 shadow-xs space-y-4">
        <div className="border-b border-[#EDEBE9] pb-4">
          <h3 className="text-base font-bold text-[#323130] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#6264A7]" />
            {isSw ? 'Hali ya Kodi & TRA' : 'Tax & TRA Mode'}
          </h3>
          <p className="text-xs text-[#605E5C] mt-1">
            {isSw
              ? 'Chagua kama duka halijasajiliwa VAT, linatumia VAT ya ndani, au TRA EFD halisi.'
              : 'Choose not VAT registered, manual VAT, or live TRA EFD integration.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => patchAndApply({
              mode: 'non_vat',
              vatRegistered: false,
              vatEnabled: false,
              showVatOnReceipt: false,
              showTraSignature: false,
              pricesIncludeVat: false,
            })}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              draft.mode === 'non_vat'
                ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                : 'border-[#EDEBE9] hover:border-[#C8C6C4]'
            }`}
          >
            <div className="text-sm font-bold text-[#323130]">
              {isSw ? 'Sio Msajili wa VAT' : 'Not VAT Registered'}
            </div>
            <p className="text-[11px] text-[#605E5C] mt-1">
              {isSw ? 'VAT 0%, hakuna mstari wa kodi.' : 'VAT 0%, no tax line on receipts.'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => patchAndApply({
              mode: 'manual',
              vatRegistered: true,
              vatEnabled: true,
              showTraSignature: false,
              showVatOnReceipt: true,
            })}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              draft.mode === 'manual' && draft.vatRegistered
                ? 'border-[#6264A7] bg-[#6264A7]/5 ring-2 ring-[#6264A7]/20'
                : 'border-[#EDEBE9] hover:border-[#C8C6C4]'
            }`}
          >
            <div className="text-sm font-bold text-[#323130]">
              {isSw ? 'Msajili wa VAT (Manual)' : 'VAT Registered (Manual)'}
            </div>
            <p className="text-[11px] text-[#605E5C] mt-1">
              {isSw ? 'Risiti za ndani, bila saini ya TRA.' : 'Internal receipts, no TRA signature.'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => patchAndApply({
              mode: 'tra_efd',
              vatRegistered: true,
              showTraSignature: true,
              vatEnabled: true,
              showVatOnReceipt: true,
            })}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              draft.mode === 'tra_efd'
                ? 'border-[#E65100] bg-orange-50/60 ring-2 ring-[#E65100]/20'
                : 'border-[#EDEBE9] hover:border-[#C8C6C4]'
            }`}
          >
            <div className="text-sm font-bold text-[#323130]">
              {isSw ? 'TRA EFD Halisi (VFD 2.0)' : 'Real TRA EFD (VFD 2.0)'}
            </div>
            <p className="text-[11px] text-[#605E5C] mt-1">
              {isSw ? 'Saini ya TRA, TIN/VRN kwenye kila risiti.' : 'TRA signature, TIN/VRN on every receipt.'}
            </p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
          <h4 className="text-sm font-bold text-[#323130]">
            {isSw ? 'VAT & Punguzo' : 'VAT & Discounts'}
          </h4>

          {vatControlsDisabled && (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {isSw
                ? 'Duka halijasajiliwa kwa VAT — kodi ni 0%.'
                : 'Shop is not VAT registered — tax is 0%.'}
            </p>
          )}

          <label className="flex items-center gap-2 text-xs font-semibold text-[#323130]">
            <input
              type="checkbox"
              checked={draft.vatEnabled}
              onChange={e => patchAndApply({
                vatEnabled: e.target.checked,
                vatRegistered: true,
                mode: draft.mode === 'non_vat' ? 'manual' : draft.mode,
                showVatOnReceipt: e.target.checked ? draft.showVatOnReceipt : false,
              })}
              disabled={vatControlsDisabled || isTra}
              className="rounded text-[#0078D4] disabled:opacity-40"
            />
            {isSw ? 'Weka VAT kwenye mauzo' : 'Apply VAT on sales'}
          </label>

          <div>
            <label className="block text-xs font-semibold text-[#323130] mb-1">
              {isSw ? 'Kiwango cha VAT (%)' : 'VAT rate (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={Math.round(draft.vatRate * 1000) / 10}
              onChange={e => patch({ vatRate: Number(e.target.value) / 100 })}
              disabled={vatControlsDisabled}
              className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs disabled:opacity-40"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#323130]">
            <input
              type="checkbox"
              checked={draft.pricesIncludeVat}
              onChange={e => patch({ pricesIncludeVat: e.target.checked })}
              disabled={vatControlsDisabled}
              className="rounded text-[#0078D4] disabled:opacity-40"
            />
            {isSw ? 'Bei zimejumuisha VAT' : 'Shelf prices include VAT'}
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#323130]">
            <input
              type="checkbox"
              checked={draft.discountEnabled}
              onChange={e => patch({ discountEnabled: e.target.checked })}
              className="rounded text-[#0078D4]"
            />
            {isSw ? 'Ruhusu punguzo kwenye POS' : 'Allow discounts at POS'}
          </label>

          {draft.discountEnabled && (
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">
                {isSw ? 'Kikomo cha punguzo (%)' : 'Max discount (%)'}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.maxDiscountPercent}
                onChange={e => patch({ maxDiscountPercent: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-semibold text-[#323130]">
            <input
              type="checkbox"
              checked={draft.partialPaymentEnabled}
              onChange={e => patch({ partialPaymentEnabled: e.target.checked })}
              className="rounded text-[#0078D4]"
            />
            {isSw ? 'Ruhusu malipo ya awamu / mkopo' : 'Allow partial & credit sales'}
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#323130]">
            <input
              type="checkbox"
              checked={draft.negotiationEnabled}
              onChange={e => patch({ negotiationEnabled: e.target.checked })}
              className="rounded text-[#0078D4]"
            />
            {isSw ? 'Ruhusu mazungumzo ya bei' : 'Enable price negotiation'}
          </label>

          {!isNonVat && (
            <div className="border-t border-[#EDEBE9] pt-4 space-y-3">
              <h5 className="text-xs font-bold text-[#323130]">
                {isSw ? 'VAT kwenye Ununuzi / Stoo (TRA)' : 'VAT on Purchases / Stock-in (TRA)'}
              </h5>
              <p className="text-[11px] text-[#605E5C]">
                {isSw
                  ? 'Kwa duka la VAT/TRA: chagua chaguo-msingi — VAT kwenye mistari yote au bidhaa za VAT tu. Bado unaweza kubadilisha kwa kila ombi la ununuzi.'
                  : 'For VAT/TRA shops: set the default — VAT on all lines or only VAT-class products. You can still override per purchase order.'}
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#323130] mb-1">
                  {isSw ? 'Chaguo-msingi la VAT ya ununuzi' : 'Default purchase VAT scope'}
                </label>
                <select
                  value={draft.purchaseVatScope ?? 'none'}
                  onChange={e => patch({
                    purchaseVatScope: e.target.value as TaxComplianceSettings['purchaseVatScope'],
                  })}
                  className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
                >
                  <option value="none">{isSw ? 'Bila VAT (chagua kwa mstari)' : 'No VAT (set per line)'}</option>
                  <option value="all">{isSw ? 'VAT 18% — mistari yote' : 'VAT 18% — all lines'}</option>
                  <option value="vat_products">{isSw ? 'VAT 18% — bidhaa za VAT tu' : 'VAT 18% — VAT products only'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#323130] mb-1">
                  {isSw ? 'Kumbuka ya VAT (optional)' : 'VAT note (optional)'}
                </label>
                <textarea
                  rows={2}
                  value={draft.purchaseVatNote ?? ''}
                  onChange={e => patch({ purchaseVatNote: e.target.value })}
                  placeholder={isSw ? 'mf. Bei za ununuzi ni bila VAT; VAT 18% inaongezwa kwenye ankara' : 'e.g. Purchase prices are untaxed; VAT 18% added on invoice'}
                  className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
          <h4 className="text-sm font-bold text-[#323130]">
            {isSw ? 'Taarifa za Risiti & TRA' : 'Receipt & TRA Identity'}
          </h4>

          <div>
            <label className="block text-xs font-semibold text-[#323130] mb-1">
              {isSw ? 'Jina la biashara kwenye risiti' : 'Business name on receipt'}
            </label>
            <input
              type="text"
              value={draft.receiptBusinessName}
              onChange={e => patch({ receiptBusinessName: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">TIN</label>
              <input
                type="text"
                value={draft.tinNumber}
                onChange={e => patch({ tinNumber: e.target.value })}
                placeholder="108-992-451"
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">VRN</label>
              <input
                type="text"
                value={draft.vrnNumber}
                onChange={e => patch({ vrnNumber: e.target.value })}
                placeholder="40019283-Z"
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {isTra && (
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">
                {isSw ? 'Serial ya TRA EFD' : 'TRA EFD device serial'}
              </label>
              <input
                type="text"
                value={draft.traEfdSerial}
                onChange={e => patch({ traEfdSerial: e.target.value })}
                placeholder="TZ-EFD-2026-8819"
                className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#323130] mb-1">
              {isSw ? 'Maelezo ya chini ya risiti' : 'Receipt footer note'}
            </label>
            <textarea
              rows={2}
              value={draft.receiptFooterNote}
              onChange={e => patch({ receiptFooterNote: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8F8F8] border border-[#C8C6C4] rounded-lg text-xs resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-[#323130]">
            <input
              type="checkbox"
              checked={draft.showVatOnReceipt}
              onChange={e => patch({ showVatOnReceipt: e.target.checked })}
              disabled={vatControlsDisabled || !draft.vatEnabled}
              className="rounded text-[#0078D4] disabled:opacity-40"
            />
            {isSw ? 'Onyesha VAT kwenye risiti' : 'Show VAT line on receipt'}
          </label>
        </div>
      </div>

      <div className="bg-[#F8F9FC] rounded-xl border border-[#EDEBE9] p-4">
        <div className="text-xs font-bold text-[#323130] mb-2">
          {isSw ? 'Inatumika mara moja kwenye:' : 'Applies instantly to:'}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: ShoppingBag, label: 'POS' },
            { icon: Receipt, label: isSw ? 'Risiti' : 'Receipts' },
            { icon: Boxes, label: isSw ? 'Stoo' : 'Inventory' },
            { icon: FileText, label: isSw ? 'Ripoti' : 'Reports' },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E1DFDD] text-[11px] font-semibold text-[#605E5C]"
            >
              <Icon className="w-3.5 h-3.5 text-[#6264A7]" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[#605E5C] flex items-center gap-2">
          {isNonVat ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : isTra ? (
            <CheckCircle2 className="w-4 h-4 text-[#E65100]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600" />
          )}
          <span>
            {isNonVat
              ? (isSw ? 'Hali: Sio msajili wa VAT.' : 'Status: Not VAT registered.')
              : isTra
                ? (isSw ? 'Hali: TRA EFD — weka API hapa chini.' : 'Status: TRA EFD — configure API below.')
                : (isSw ? 'Hali: VAT manual.' : 'Status: Manual VAT.')}
          </span>
        </div>

        <button
          type="button"
          onClick={handleApply}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6264A7] to-[#0078D4] text-white text-xs font-bold shadow-xs hover:brightness-105 cursor-pointer"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              {isSw ? 'Imewekwa!' : 'Saved!'}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isSw ? 'Hifadhi Mipangilio ya Kodi' : 'Save Tax Settings'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
