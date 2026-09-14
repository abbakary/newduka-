import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  QrCode, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Keyboard, 
  Zap,
  ShoppingBag
} from 'lucide-react';
import { Product, Language } from '@/types/v1';
import { parseScannedQRPayload } from '@/utils/qrGenerator';
import { formatTSh } from '@/utils/translations';
import confetti from 'canvas-confetti';

interface POSQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductScanned: (product: Product) => void;
  language: Language;
}

export const POSQRScannerModal: React.FC<POSQRScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductScanned,
  language,
}) => {
  const isSw = language === 'sw';
  const [manualInput, setManualInput] = useState('');
  const [lastScannedItem, setLastScannedItem] = useState<Product | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'not_found'>('idle');
  const [isCameraActive, setIsCameraActive] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Play crisp POS beep feedback sound
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz high beep
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      // ignore audio context failures
    }
  };

  const handleMatchProduct = (text: string) => {
    if (!text) return;
    const parsed = parseScannedQRPayload(text);
    const querySku = parsed?.sku || text.trim();
    const queryId = parsed?.id || text.trim();
    const queryName = parsed?.name?.toLowerCase();

    const matched = products.find(
      p =>
        p.id === queryId ||
        p.sku.toLowerCase() === querySku.toLowerCase() ||
        (queryName && p.name.toLowerCase().includes(queryName)) ||
        p.name.toLowerCase() === text.trim().toLowerCase()
    );

    if (matched) {
      playBeep();
      setLastScannedItem(matched);
      setScanStatus('success');
      onProductScanned(matched);
      confetti({ particleCount: 20, spread: 45, origin: { y: 0.6 } });
      setTimeout(() => {
        setScanStatus('idle');
      }, 2500);
    } else {
      setScanStatus('not_found');
      setTimeout(() => {
        setScanStatus('idle');
      }, 3000);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleMatchProduct(manualInput.trim());
      setManualInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E1DFDD] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#24284A] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#107C10] to-[#0078D4] flex items-center justify-center text-white shadow-md">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isSw ? 'Kipiga Msimbo cha QR / Barcode' : 'POS Instant QR & Barcode Scanner'}
              </h3>
              <p className="text-xs text-slate-300">
                {isSw ? 'Skani lebo ya bidhaa kuongeza kikapuni mara moja' : 'Scan physical label to add product directly to cart'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="p-6 space-y-4">
          <div className="relative w-full aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-[#6264A7] shadow-inner">
            {/* Visual Scanning Animation Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#6264A7_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>

            {/* Target Reticle */}
            <div className="relative w-56 h-56 border-2 border-emerald-400/80 rounded-2xl flex items-center justify-center">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>

              {/* Laser scanner line animation */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[bounce_2.5s_infinite]"></div>

              <div className="text-center p-4 text-slate-300 flex flex-col items-center">
                <QrCode className="w-12 h-12 text-emerald-400/70 mb-2 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-300 tracking-wide">
                  {isSw ? 'Weka lebo ya QR hapa' : 'Align QR / Barcode within frame'}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  {isSw ? 'Kamera inasoma kiotomatiki' : 'Continuous auto-focus reading'}
                </span>
              </div>
            </div>

            {/* Status Feedback Overlay */}
            {scanStatus === 'success' && lastScannedItem && (
              <div className="absolute bottom-4 inset-x-4 p-3 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <div>
                    <div className="font-bold text-xs">{lastScannedItem.name}</div>
                    <div className="text-[10px] font-mono opacity-90">
                      {lastScannedItem.sku} • {formatTSh(lastScannedItem.price)}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-md">
                  +1 {isSw ? 'Imeongezwa' : 'Added'}
                </span>
              </div>
            )}

            {scanStatus === 'not_found' && (
              <div className="absolute bottom-4 inset-x-4 p-3 bg-rose-600 text-white rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
                <AlertCircle className="w-5 h-5 text-white" />
                <span className="text-xs font-semibold">
                  {isSw ? 'Bidhaa haikupatikana kwenye mfumo.' : 'Item not found in inventory catalog.'}
                </span>
              </div>
            )}
          </div>

          {/* Quick Simulation Clicker for Testing & Demo */}
          <div className="p-3 bg-[#FAF9F8] rounded-xl border border-[#EDEBE9] space-y-2">
            <div className="flex items-center justify-between text-xs text-[#605E5C]">
              <span className="font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{isSw ? 'Jaribu Kupiga Msimbo (Quick Test):' : 'Instant Scan Simulator:'}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{products.length} Products</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {products.slice(0, 6).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleMatchProduct(p.sku)}
                  className="px-2.5 py-1 bg-white hover:bg-[#6264A7] hover:text-white text-[#323130] text-[11px] font-medium rounded-lg border border-[#E1DFDD] shadow-2xs transition-all cursor-pointer flex items-center gap-1 truncate max-w-[200px]"
                >
                  <QrCode className="w-3 h-3 text-[#0078D4]" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Barcode / SKU Keyboard Entry */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder={isSw ? 'Andika au bandika SKU / Barcode...' : 'Type or paste SKU / Barcode manually...'}
                className="w-full pl-9 pr-3 py-2 bg-[#F3F2F1] border border-[#E1DFDD] focus:border-[#6264A7] focus:bg-white rounded-xl text-xs text-[#323130] outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
            >
              {isSw ? 'Weka' : 'Scan'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#F3F2F1] border-t border-[#E1DFDD] flex items-center justify-between">
          <span className="text-[11px] text-[#605E5C] font-medium">
            {isSw ? 'Imeunganishwa na Kaunta ya Mauzo (POS)' : 'Directly connected to POS register'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white border border-[#E1DFDD] text-[#323130] hover:bg-[#EDEBE9] cursor-pointer"
          >
            {isSw ? 'Maliza' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
