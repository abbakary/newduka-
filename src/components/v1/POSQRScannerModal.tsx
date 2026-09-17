import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  QrCode,
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
  Keyboard,
  Usb,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Product, Language } from '@/types/v1';
import { parseScannedQRPayload } from '@/utils/qrGenerator';
import { formatTSh } from '@/utils/translations';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { useUsbBarcodeScanner } from '@/hooks/useUsbBarcodeScanner';
import confetti from 'canvas-confetti';

interface POSQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductScanned: (product: Product) => void;
  language: Language;
}

const SCANNER_REGION_ID = 'duka-pos-qr-reader';

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanAtRef = useRef(0);
  const usbInputRef = useRef<HTMLInputElement>(null);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      /* ignore */
    }
  };

  const handleMatchProduct = useCallback((text: string) => {
    if (!text) return;
    const now = Date.now();
    if (now - lastScanAtRef.current < 900) return;
    lastScanAtRef.current = now;

    const parsed = parseScannedQRPayload(text);
    const querySku = parsed?.sku || text.trim();
    const queryId = parsed?.id || text.trim();
    const queryName = parsed?.name?.toLowerCase();

    const matched = products.find(
      p =>
        p.id === queryId ||
        p.sku.toLowerCase() === querySku.toLowerCase() ||
        (p.barcode && p.barcode.toLowerCase() === querySku.toLowerCase()) ||
        (queryName && p.name.toLowerCase().includes(queryName)) ||
        p.name.toLowerCase() === text.trim().toLowerCase(),
    );

    if (matched) {
      playBeep();
      setLastScannedItem(matched);
      setScanStatus('success');
      onProductScanned(matched);
      confetti({ particleCount: 20, spread: 45, origin: { y: 0.6 } });
      setTimeout(() => setScanStatus('idle'), 2500);
    } else {
      setScanStatus('not_found');
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  }, [onProductScanned, products]);

  useUsbBarcodeScanner(isOpen, handleMatchProduct);

  useEffect(() => {
    if (!isOpen) return;
    setCameraError(null);
    setCameraReady(false);
    const t = window.setTimeout(() => usbInputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const scanner = new Html5Qrcode(SCANNER_REGION_ID);
    scannerRef.current = scanner;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
            ],
          },
          decoded => {
            if (!cancelled) handleMatchProduct(decoded);
          },
          () => {},
        );
        if (!cancelled) setCameraReady(true);
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            isSw
              ? 'Kamera haiwezi kufunguliwa. Tumia skana ya USB au andika SKU hapa chini.'
              : 'Could not open camera. Use a USB scanner or type the SKU below.',
          );
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        void s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [isOpen, handleMatchProduct, isSw]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleMatchProduct(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <ModalPortal open={isOpen} onClose={onClose} zClassName="z-[220]">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E1DFDD] overflow-hidden flex flex-col max-h-[min(92dvh,880px)]">
        <div className="px-4 sm:px-6 py-4 bg-[#24284A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#107C10] to-[#0078D4] flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <h3 className="font-bold text-sm sm:text-base text-white">
                {isSw ? 'Skani QR / Barcode' : 'Scan QR & Barcode'}
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-300 truncate">
                {isSw ? 'Kamera, skana ya USB, au SKU' : 'Camera, USB scanner, or SKU entry'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-4 sm:p-6 space-y-4">
          <div className="relative w-full min-h-[220px] max-h-[min(50vh,320px)] bg-slate-950 rounded-2xl overflow-hidden border-2 border-[#6264A7]">
            <div id={SCANNER_REGION_ID} className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 pointer-events-none">
                <QrCode className="w-10 h-10 animate-pulse text-emerald-400/70" />
                {isSw ? 'Inafungua kamera…' : 'Starting camera…'}
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-amber-200 bg-slate-950/90">
                {cameraError}
              </div>
            )}

            {scanStatus === 'success' && lastScannedItem && (
              <div className="absolute bottom-3 inset-x-3 p-3 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center justify-between text-xs z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div className="min-w-0 truncate">
                    <div className="font-bold truncate">{lastScannedItem.name}</div>
                    <div className="text-[10px] font-mono opacity-90">{lastScannedItem.sku} · {formatTSh(lastScannedItem.price)}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-md shrink-0">+1</span>
              </div>
            )}
            {scanStatus === 'not_found' && (
              <div className="absolute bottom-3 inset-x-3 p-3 bg-rose-600 text-white rounded-xl shadow-lg flex items-center gap-2 text-xs z-10">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{isSw ? 'Bidhaa haikupatikana.' : 'Product not found.'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-[#605E5C] justify-center">
            <Usb className="w-3.5 h-3.5 text-[#6264A7]" />
            <span>{isSw ? 'Skana ya USB: piga msimbo — inaongezwa kiotomatiki' : 'USB scanner: scan any time — auto-adds to cart'}</span>
          </div>

          <input
            ref={usbInputRef}
            type="text"
            aria-hidden
            tabIndex={-1}
            className="sr-only"
            readOnly
          />

          <div className="p-3 bg-[#FAF9F8] rounded-xl border border-[#EDEBE9] space-y-2">
            <div className="flex items-center justify-between text-xs text-[#605E5C]">
              <span className="font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                {isSw ? 'Jaribu haraka:' : 'Quick test:'}
              </span>
              <span className="text-[10px] font-mono">{products.length}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-h-20 overflow-y-auto">
              {products.slice(0, 8).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleMatchProduct(p.sku)}
                  className="px-2 py-1 bg-white hover:bg-[#6264A7] hover:text-white text-[#323130] text-[10px] font-medium rounded-lg border border-[#E1DFDD] cursor-pointer truncate max-w-[140px]"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="w-4 h-4 text-[#605E5C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder={isSw ? 'SKU / Barcode…' : 'SKU / Barcode…'}
                className="w-full pl-9 pr-3 py-2.5 bg-[#F3F2F1] border border-[#E1DFDD] focus:border-[#6264A7] focus:bg-white rounded-xl text-xs font-mono outline-none"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="px-4 py-2.5 bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-bold rounded-xl cursor-pointer shrink-0">
              {isSw ? 'Weka' : 'Add'}
            </button>
          </form>
        </div>

        <div className="px-4 sm:px-6 py-3 bg-[#F3F2F1] border-t border-[#E1DFDD] flex items-center justify-between shrink-0">
          <span className="text-[10px] sm:text-[11px] text-[#605E5C] font-medium">
            {isSw ? 'POS · QR + Code128 (USB)' : 'POS · QR + Code128 (USB)'}
          </span>
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white border border-[#E1DFDD] cursor-pointer">
            {isSw ? 'Maliza' : 'Done'}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};
