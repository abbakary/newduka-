import React, { useEffect, useState } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';
import type { Language } from '@/types/v1';
import type { EfdApiSettings } from '@/types/traReceipt';
import { useTraReceipts } from '@/context/TraReceiptContext';
import { TRA_CUSTOMER_ID_TYPES } from '@/lib/efdApi';

interface TraEfdApiSectionProps {
  language: Language;
  sectionId?: string;
}

export const TraEfdApiSection: React.FC<TraEfdApiSectionProps> = ({
  language,
  sectionId = 'tra-efd-api',
}) => {
  const isSw = language === 'sw';
  const { efdSettings, saveEfdSettings, testConnection } = useTraReceipts();
  const [draftEfd, setDraftEfd] = useState<EfdApiSettings>(efdSettings);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraftEfd(efdSettings);
  }, [efdSettings]);

  const handleSave = () => {
    saveEfdSettings(draftEfd);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = async () => {
    setTesting(true);
    saveEfdSettings(draftEfd);
    await testConnection();
    setTesting(false);
  };

  return (
    <div id={sectionId} className="space-y-4 scroll-mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-[#323130] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#E65100]" />
            {isSw ? 'Muunganisho wa EFD API' : 'EFD API Connection'}
          </h3>
          <p className="text-xs text-[#605E5C]">
            {isSw
              ? 'Unganisha kifaa cha EFD au mtoa huduma wa VFD. Risiti za TRA zinatuma kupitia API hii.'
              : 'Link your EFD device or VFD provider. TRA fiscal receipts submit through this API.'}
          </p>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draftEfd.enabled}
              onChange={e => setDraftEfd(d => ({ ...d, enabled: e.target.checked }))}
            />
            {isSw ? 'Washa muunganisho wa EFD API' : 'Enable EFD API integration'}
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draftEfd.demoMode}
              onChange={e => setDraftEfd(d => ({ ...d, demoMode: e.target.checked }))}
            />
            {isSw ? 'Hali ya majaribio (Demo / Sandbox)' : 'Demo / sandbox mode'}
          </label>

          <div className="space-y-3">
            {[
              { key: 'apiBaseUrl' as const, label: 'API Base URL', placeholder: 'https://efd.example.com/api/v1' },
              { key: 'apiKey' as const, label: 'API Key', placeholder: 'Bearer token or API key' },
              { key: 'apiSecret' as const, label: 'API Secret', placeholder: 'Optional secret' },
              { key: 'deviceId' as const, label: isSw ? 'Kitambulisho cha Kifaa' : 'Device ID', placeholder: 'EFD device serial' },
              { key: 'zNumber' as const, label: 'Z Number', placeholder: 'Z report counter' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-[10px] font-bold uppercase text-[#605E5C]">{field.label}</label>
                <input
                  type={field.key.includes('Secret') || field.key.includes('Key') ? 'password' : 'text'}
                  value={draftEfd[field.key]}
                  onChange={e => setDraftEfd(d => ({ ...d, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E65100] text-white text-sm font-bold"
            >
              <Save className="w-4 h-4" />
              {saved ? (isSw ? 'Imehifadhiwa!' : 'Saved!') : isSw ? 'Hifadhi API' : 'Save API'}
            </button>
            <button
              type="button"
              disabled={testing || !draftEfd.apiBaseUrl.trim()}
              onClick={() => void handleTest()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E1DFDD] text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {isSw ? 'Jaribu Muunganisho' : 'Test Connection'}
            </button>
          </div>

          {efdSettings.lastTestAt && (
            <div
              className={`text-xs rounded-lg p-3 border ${
                efdSettings.lastTestOk
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <strong>{isSw ? 'Jaribio la mwisho:' : 'Last test:'}</strong>{' '}
              {new Date(efdSettings.lastTestAt).toLocaleString()}
              <br />
              {efdSettings.lastTestMessage}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-[#323130]">
            {isSw ? 'Maelezo ya Mteja (POS)' : 'Customer Fields at POS'}
          </h3>
          <p className="text-xs text-[#605E5C]">
            {isSw
              ? 'Aina ya kitambulisho, nambari, na simu zinachukuliwa kutoka mteja aliyechaguliwa kwenye POS.'
              : 'ID type, ID number, and mobile are captured from the customer selected at POS checkout.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TRA_CUSTOMER_ID_TYPES.map(t => (
              <span key={t} className="px-2 py-0.5 rounded bg-[#F3F2F1] text-[10px] font-semibold">
                {t}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-[#605E5C] border-t border-[#EDEBE9] pt-3">
            {isSw
              ? 'Hakikisha TIN, VRN, na serial ya EFD zimewekwa kwenye sehemu ya Kodi hapo juu kabla ya kuwasilisha risiti.'
              : 'Ensure TIN, VRN, and EFD serial are set in the Tax section above before submitting receipts.'}
          </p>
        </div>
      </div>
    </div>
  );
};
