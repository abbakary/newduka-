import { useEffect, useState } from 'react';
import { Download, Smartphone, Wifi, WifiOff } from 'lucide-react';
import type { Language } from '@/types/v1';
import { useOfflineStore } from '@/stores';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallPrompt({ language }: { language: Language }) {
  const isSw = language === 'sw';
  const isOnline = useOfflineStore(s => s.isOnline);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalonePwa);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstalled(isStandalonePwa());
  }, []);

  useEffect(() => {
    const onInstallable = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onInstallable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  if (installed || dismissed) return null;

  const showInstall = !!deferredPrompt;

  return (
    <div className="mx-auto w-full max-w-md mb-4 px-4">
      <div className="rounded-2xl border border-teal-200 bg-teal-50/80 px-4 py-3 flex items-start gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
          {showInstall ? <Download className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-teal-950">
            {showInstall
              ? (isSw ? 'Sakinisha Duka+ kwenye simu' : 'Install Duka+ on your device')
              : (isSw ? 'Hifadhi data nje ya mtandao' : 'Offline-ready web app')}
          </p>
          <p className="text-xs text-teal-800/80 mt-0.5 leading-relaxed">
            {showInstall
              ? (isSw
                ? 'Fungua haraka kama programu — inafanya kazi hata ukiwa nje ya mtandao.'
                : 'Open instantly like an app — works offline after first visit.')
              : (isSw
                ? 'Baada ya kuingia, data ya duka lako itahifadhiwa kwenye kifaa. Tumia HTTPS au npm run build + preview kuona kitufe cha kusakinisha.'
                : 'After sign-in, shop data is cached on this device. Use HTTPS or npm run build + preview to see the install button.')}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {showInstall && (
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={installing}
                className="px-3 py-1.5 rounded-full bg-teal-600 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {installing
                  ? (isSw ? 'Inasakinisha…' : 'Installing…')
                  : (isSw ? 'Sakinisha sasa' : 'Install now')}
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-900/70">
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? (isSw ? 'Mtandaoni' : 'Online') : (isSw ? 'Nje ya mtandao' : 'Offline')}
            </span>
            {!showInstall && (
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="text-[10px] font-semibold text-teal-700/70 hover:text-teal-900 cursor-pointer ml-auto"
              >
                {isSw ? 'Funga' : 'Dismiss'}
              </button>
            )}
          </div>
        </div>
        {showInstall && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-teal-700/60 hover:text-teal-900 text-lg leading-none cursor-pointer"
            aria-label={isSw ? 'Funga' : 'Dismiss'}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
