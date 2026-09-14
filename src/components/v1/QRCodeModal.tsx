import React, { useEffect, useState } from 'react';
import { 
  QrCode, 
  Printer, 
  Download, 
  X, 
  Copy, 
  Check, 
  Tag, 
  Layers, 
  Sparkles,
  ShieldCheck,
  Calendar,
  Package
} from 'lucide-react';
import { Product, Language } from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import { generateProductQRCodeDataUrl, getProductQRPayloadString } from '@/utils/qrGenerator';
import { printHtmlPage } from '@/lib/documentRenderer';
import { qrLabelsPrintHtml } from '@/lib/documentDataMappers';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  allProducts?: Product[];
  language: Language;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  product,
  allProducts = [],
  language,
}) => {
  const isSw = language === 'sw';
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [batchDataUrls, setBatchDataUrls] = useState<{ product: Product; url: string }[]>([]);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [labelSize, setLabelSize] = useState<'thermal_small' | 'thermal_medium' | 'a4_sheet'>('thermal_medium');
  const [copied, setCopied] = useState(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  // Generate single QR code
  useEffect(() => {
    if (product) {
      generateProductQRCodeDataUrl(product, 320).then(url => setQrDataUrl(url));
    }
  }, [product]);

  // Generate batch QR codes when switched to batch mode
  useEffect(() => {
    if (mode === 'batch' && allProducts.length > 0 && batchDataUrls.length === 0) {
      setIsGeneratingBatch(true);
      Promise.all(
        allProducts.map(async p => ({
          product: p,
          url: await generateProductQRCodeDataUrl(p, 200),
        }))
      ).then(res => {
        setBatchDataUrls(res);
        setIsGeneratingBatch(false);
      });
    }
  }, [mode, allProducts, batchDataUrls.length]);

  if (!isOpen || (!product && mode === 'single')) return null;

  const handleCopyPayload = () => {
    if (product) {
      navigator.clipboard.writeText(getProductQRPayloadString(product));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = async () => {
    if (mode === 'single' && product && qrDataUrl) {
      printHtmlPage(
        isSw ? 'Lebo ya QR' : 'QR Label',
        qrLabelsPrintHtml([{
          name: product.name,
          sku: product.sku,
          price: product.price,
          qrDataUrl,
        }], isSw),
        isSw,
      );
      return;
    }
    if (mode === 'batch' && batchDataUrls.length > 0) {
      printHtmlPage(
        isSw ? 'Lebo za QR' : 'QR Labels',
        qrLabelsPrintHtml(
          batchDataUrls.map(({ product: p, url }) => ({
            name: p.name,
            sku: p.sku,
            price: p.price,
            qrDataUrl: url,
          })),
          isSw,
        ),
        isSw,
      );
    }
  };

  const handleDownloadSingle = () => {
    if (!qrDataUrl || !product) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${product.sku}_${product.name.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#E1DFDD] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#24284A] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0078D4] to-[#6264A7] flex items-center justify-center text-white shadow-md">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isSw ? 'Msimbo wa QR & Lebo ya Bidhaa' : 'Product QR Code & Smart Shelf Tag'}
              </h3>
              <p className="text-xs text-slate-300">
                {mode === 'single' && product
                  ? `${product.name} • SKU: ${product.sku}`
                  : `${allProducts.length} ${isSw ? 'Bidhaa Zote' : 'Total Items in Catalog'}`}
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

        {/* Mode Selector & Controls */}
        <div className="px-6 py-3 bg-[#FAF9F8] border-b border-[#EDEBE9] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'single'
                  ? 'bg-[#6264A7] text-white shadow-xs'
                  : 'bg-white text-[#605E5C] border border-[#E1DFDD] hover:bg-[#F3F2F1]'
              }`}
            >
              {isSw ? 'Lebo ya Bidhaa Hii' : 'Single Product Label'}
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'batch'
                  ? 'bg-[#6264A7] text-white shadow-xs'
                  : 'bg-white text-[#605E5C] border border-[#E1DFDD] hover:bg-[#F3F2F1]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isSw ? 'Chapisha Zote (Batch)' : 'Batch Catalog Labels'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#605E5C] font-semibold">{isSw ? 'Ukubwa wa Lebo:' : 'Label Size:'}</span>
            <select
              value={labelSize}
              onChange={e => setLabelSize(e.target.value as any)}
              className="px-2.5 py-1 bg-white border border-[#E1DFDD] rounded-lg text-xs font-medium text-[#323130] outline-none"
            >
              <option value="thermal_small">Thermal 40x25mm (Price Tag)</option>
              <option value="thermal_medium">Thermal 50x30mm (Standard)</option>
              <option value="a4_sheet">A4 Sheet Grid (24 labels/page)</option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {mode === 'single' && product && (
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Printable Physical Label Preview */}
              <div className="p-4 bg-white rounded-xl border-2 border-dashed border-[#6264A7]/40 shadow-md flex flex-col items-center text-center w-full max-w-[280px]">
                <div className="text-[10px] font-bold text-[#6264A7] tracking-wider uppercase flex items-center gap-1 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Duka+ Smart Tag</span>
                </div>
                <div className="font-bold text-sm text-[#323130] leading-tight line-clamp-2 px-1">
                  {product.name}
                </div>
                <div className="text-xs font-mono font-bold text-[#0078D4] mt-0.5">
                  SKU: {product.sku}
                </div>

                <div className="my-2.5 p-2 bg-white rounded-lg border border-[#EDEBE9] shadow-2xs">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR Code for ${product.name}`}
                      className="w-36 h-36 object-contain"
                    />
                  ) : (
                    <div className="w-36 h-36 bg-slate-100 animate-pulse flex items-center justify-center text-xs text-slate-400">
                      Generating...
                    </div>
                  )}
                </div>

                <div className="w-full pt-1 border-t border-[#F3F2F1] flex items-center justify-between px-2 text-xs">
                  <span className="text-[10px] text-[#605E5C] font-mono">
                    {product.batchNumber || 'BT-2026'}
                  </span>
                  <span className="font-extrabold text-sm text-[#107C10]">
                    {formatTSh(product.price)}
                  </span>
                </div>
              </div>

              {/* Product Info & Scannable Details */}
              <div className="flex-1 space-y-4 text-xs">
                <div className="p-4 bg-[#F8F8F8] rounded-xl border border-[#EDEBE9] space-y-2">
                  <div className="flex items-center justify-between text-[#605E5C]">
                    <span className="font-semibold">{isSw ? 'Kitengo cha Bidhaa:' : 'Category:'}</span>
                    <span className="font-bold text-[#323130]">{product.category}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#605E5C]">
                    <span className="font-semibold">{isSw ? 'Bei ya Kuuzia:' : 'Retail Price:'}</span>
                    <span className="font-extrabold text-[#107C10] text-sm">{formatTSh(product.price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#605E5C]">
                    <span className="font-semibold">{isSw ? 'Stoo Iliyopo:' : 'Current Stock:'}</span>
                    <span className="font-bold text-[#323130]">{product.stock} {product.unit}</span>
                  </div>
                  {product.batchNumber && (
                    <div className="flex items-center justify-between text-[#605E5C]">
                      <span className="font-semibold">{isSw ? 'Namba ya Bachi:' : 'Batch Number:'}</span>
                      <span className="font-mono text-[#323130]">{product.batchNumber}</span>
                    </div>
                  )}
                  {product.expiryDate && (
                    <div className="flex items-center justify-between text-[#605E5C]">
                      <span className="font-semibold">{isSw ? 'Tarehe ya Kuisha:' : 'Expiry Date:'}</span>
                      <span className="font-mono font-bold text-amber-700">{product.expiryDate}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5 text-indigo-900">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-indigo-950">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>{isSw ? 'Urahisi wa Mauzo (POS Instant Scan)' : 'POS Instant QR Barcode Scanning'}</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    {isSw
                      ? 'Lebo salama: QR ina SKU pekee (DUKA+SKU:…). Bei na jina hazionyeshwi ukiskani nje ya POS — POS inatafuta bidhaa kwenye stoo yako.'
                      : 'Secure label: QR encodes SKU only (DUKA+SKU:…). Price and name are not exposed if scanned outside POS — POS looks up the item in your catalog.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleCopyPayload}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[#E1DFDD] bg-white text-[#323130] font-semibold hover:bg-[#F3F2F1] transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#107C10]" /> : <Copy className="w-3.5 h-3.5 text-[#605E5C]" />}
                    <span>{copied ? (isSw ? 'Imenakiliwa!' : 'Copied!') : (isSw ? 'Nakili Data ya QR' : 'Copy QR Payload')}</span>
                  </button>

                  <button
                    onClick={handleDownloadSingle}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[#E1DFDD] bg-white text-[#323130] font-semibold hover:bg-[#F3F2F1] transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#0078D4]" />
                    <span>{isSw ? 'Pakua Picha ya PNG' : 'Download PNG'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'batch' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[#605E5C]">
                <span>{isSw ? 'Orodha ya lebo zote zinazoweza kuchapishwa:' : 'Preview of all printable batch labels:'}</span>
                <span className="font-mono font-bold text-[#323130]">{allProducts.length} Items</span>
              </div>

              {isGeneratingBatch ? (
                <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-3 border-[#6264A7] border-t-transparent rounded-full animate-spin"></div>
                  <span>{isSw ? 'Inazalisha misimbo ya QR ya bidhaa zote...' : 'Generating QR codes for entire inventory...'}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto p-2 bg-[#FAF9F8] rounded-xl border border-[#EDEBE9]">
                  {batchDataUrls.map(({ product: p, url }) => (
                    <div
                      key={p.id}
                      className="p-2.5 bg-white rounded-lg border border-[#E1DFDD] shadow-2xs flex flex-col items-center text-center"
                    >
                      <div className="font-bold text-[11px] text-[#323130] line-clamp-1 w-full">
                        {p.name}
                      </div>
                      <div className="text-[10px] font-mono text-[#0078D4] truncate w-full">
                        {p.sku}
                      </div>
                      <img src={url} alt={p.name} className="w-20 h-20 my-1 object-contain" />
                      <div className="font-bold text-xs text-[#107C10]">
                        {formatTSh(p.price)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-3.5 bg-[#F3F2F1] border-t border-[#E1DFDD] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#605E5C] hover:bg-[#EDEBE9] transition-all cursor-pointer"
          >
            {isSw ? 'Funga' : 'Close'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isSw ? 'Chapisha Lebo (Print Labels)' : 'Print Smart Labels'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
