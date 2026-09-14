import React, { useRef, useState } from 'react';
import { ImageIcon, Palette, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { Language } from '@/types/v1';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import { useTenantTheme } from '@/context/TenantThemeContext';
import { DEFAULT_TENANT_THEME } from '@/lib/tenantTheme';

const PRESET_COLORS = [
  '#f97316', '#0078D4', '#107C10', '#6264A7', '#D13438',
  '#FFB900', '#0d9488', '#8B5CF6', '#E11D48', '#1a2832',
];

interface BrandThemePanelProps {
  language: Language;
}

export const BrandThemePanel: React.FC<BrandThemePanelProps> = ({ language }) => {
  const isSw = language === 'sw';
  const { theme, updateTheme, resetTheme } = useTenantTheme();
  const { config, uploadLogo, removeLogo, saveBrandingNow } = useDocumentTemplates();
  const [logoError, setLogoError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const hasLogo = Boolean(previewUrl || config.branding.logoUrl);
  const displayLogo = previewUrl || config.branding.logoUrl;

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const handlePickFile = (file: File) => {
    setLogoError('');
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    setLogoError('');
    setLogoBusy(true);
    try {
      if (pendingFile) {
        await uploadLogo(pendingFile);
        setPendingFile(null);
        setPreviewUrl(null);
      } else {
        await saveBrandingNow();
      }
      flashSaved();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : isSw ? 'Imeshindikana kuhifadhi nembo' : 'Could not save logo');
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#323130] flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[var(--tenant-primary,#f97316)]" />
            {isSw ? 'Nembo ya Biashara' : 'Business Logo'}
          </h3>
          <p className="text-[11px] text-[#605E5C] mt-1">
            {isSw
              ? 'Chagua picha, kisha bonyeza Hifadhi Nembo — inabaki hata baada ya kuonyesha upya ukurasa.'
              : 'Choose an image, then click Save Logo — it stays after refresh on this device and syncs to your account.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="w-24 h-24 rounded-xl border border-[#E1DFDD] bg-[#FAFAFA] flex items-center justify-center overflow-hidden">
            {hasLogo ? (
              <img src={displayLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) handlePickFile(file);
              }}
            />
            <button
              type="button"
              disabled={logoBusy}
              onClick={() => logoInputRef.current?.click()}
              className="px-3 py-2 rounded-lg border border-[#E1DFDD] text-xs font-bold text-[#323130] cursor-pointer flex items-center gap-1.5 disabled:opacity-60 bg-white"
            >
              <Upload className="w-3.5 h-3.5" />
              {isSw ? 'Chagua picha' : 'Choose image'}
            </button>
            <button
              type="button"
              disabled={logoBusy || (!pendingFile && !config.branding.logoUrl)}
              onClick={() => void handleSaveLogo()}
              className="px-3 py-2 rounded-lg text-xs font-bold text-white cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              style={{ background: 'var(--tenant-primary, #f97316)' }}
            >
              <Save className="w-3.5 h-3.5" />
              {logoBusy
                ? (isSw ? 'Inahifadhi…' : 'Saving…')
                : (isSw ? 'Hifadhi Nembo' : 'Save Logo')}
            </button>
            {(hasLogo || pendingFile) && (
              <button
                type="button"
                disabled={logoBusy}
                onClick={() => {
                  setPendingFile(null);
                  setPreviewUrl(null);
                  void removeLogo().then(flashSaved).catch(() => undefined);
                }}
                className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isSw ? 'Ondoa' : 'Remove'}
              </button>
            )}
          </div>
        </div>
        {pendingFile && (
          <p className="text-[11px] text-amber-700 font-semibold">
            {isSw
              ? 'Picha imechaguliwa — bonyeza Hifadhi Nembo ili iendelee kuonekana.'
              : 'Image selected — click Save Logo to keep it permanently.'}
          </p>
        )}
        {logoError && <p className="text-xs text-rose-600">{logoError}</p>}
      </div>

      <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#323130] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[var(--tenant-primary,#f97316)]" />
            {isSw ? 'Rangi za Duka Lako' : 'Your Shop Colors'}
          </h3>
          <p className="text-[11px] text-[#605E5C] mt-1">
            {isSw
              ? 'Badilisha rangi kuu — inaonekana kwenye sidebar, vichwa vya ukurasa, na vitufe.'
              : 'Pick your primary color — updates sidebar accents, headers, and buttons across your workplace.'}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-[#323130] mb-1.5">
              {isSw ? 'Rangi kuu (Primary)' : 'Primary color'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.primaryColor}
                onChange={e => {
                  updateTheme({ primaryColor: e.target.value });
                  flashSaved();
                }}
                className="w-10 h-10 rounded-lg border border-[#E1DFDD] cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={theme.primaryColor}
                onChange={e => updateTheme({ primaryColor: e.target.value })}
                onBlur={flashSaved}
                className="flex-1 px-3 py-2 border border-[#E1DFDD] rounded-lg font-mono uppercase"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-[#323130] mb-1.5">
              {isSw ? 'Rangi ya Sidebar' : 'Sidebar background'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.sidebarBg}
                onChange={e => {
                  updateTheme({ sidebarBg: e.target.value });
                  flashSaved();
                }}
                className="w-10 h-10 rounded-lg border border-[#E1DFDD] cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={theme.sidebarBg}
                onChange={e => updateTheme({ sidebarBg: e.target.value })}
                onBlur={flashSaved}
                className="flex-1 px-3 py-2 border border-[#E1DFDD] rounded-lg font-mono uppercase"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-[#605E5C] mb-2 uppercase tracking-wide">
            {isSw ? 'Rangi za haraka' : 'Quick presets'}
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  updateTheme({ primaryColor: c });
                  flashSaved();
                }}
                className="w-8 h-8 rounded-lg border-2 border-white shadow-sm cursor-pointer ring-1 ring-[#E1DFDD]"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <div
            className="flex-1 min-w-[140px] h-12 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: theme.primaryColor }}
          >
            {isSw ? 'Kitufe cha mfano' : 'Sample button'}
          </div>
          <div
            className="flex-1 min-w-[140px] h-12 rounded-lg flex items-center px-3 text-white text-xs font-semibold"
            style={{ background: theme.sidebarBg }}
          >
            Sidebar preview
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetTheme();
            flashSaved();
          }}
          className="text-[11px] font-semibold text-[#605E5C] hover:text-[#323130] cursor-pointer flex items-center gap-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {isSw ? 'Rejesha chaguo-msingi' : `Reset to default (${DEFAULT_TENANT_THEME.primaryColor})`}
        </button>
      </div>

      {saved && (
        <p className="text-xs text-emerald-700 font-semibold">
          {isSw ? '✓ Mabadiliko yamehifadhiwa' : '✓ Changes saved'}
        </p>
      )}
    </div>
  );
};
