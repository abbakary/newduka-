import React, { useMemo, useState } from 'react';
import { Download, FileText, Printer, Search, ShoppingCart, Truck } from 'lucide-react';
import type { Language, SaleTransaction } from '@/types/v1';
import { formatTSh } from '@/utils/translations';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import type { DocumentType } from '@/lib/documentTemplates';
import { documentTypeLabel } from '@/lib/documentTemplates';
import { downloadDocumentPdf } from '@/lib/documentRenderer';
import { isCompletedSale, saleToDocumentRenderData } from '@/lib/saleDocumentMapper';

interface TransactionHistoryViewProps {
  language: Language;
  sales: SaleTransaction[];
}

const DOC_ACTIONS: { type: DocumentType; icon: React.ReactNode; color: string }[] = [
  { type: 'invoice', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { type: 'delivery_note', icon: <Truck className="w-3.5 h-3.5" />, color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { type: 'order_note', icon: <ShoppingCart className="w-3.5 h-3.5" />, color: 'text-orange-700 bg-orange-50 border-orange-200' },
];

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  language,
  sales,
}) => {
  const isSw = language === 'sw';
  const { config, getActive } = useDocumentTemplates();
  const { settings: taxSettings } = useTaxCompliance();
  const [query, setQuery] = useState('');
  const [days, setDays] = useState<number>(30);

  const completed = useMemo(() => {
    const cutoff = Date.now() - days * 86_400_000;
    return sales
      .filter(isCompletedSale)
      .filter(s => {
        const t = new Date(s.date.includes('T') ? s.date : s.date.replace(' ', 'T')).getTime();
        return Number.isNaN(t) || t >= cutoff;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, days]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return completed;
    return completed.filter(
      s =>
        s.receiptNumber.toLowerCase().includes(q) ||
        (s.customerName ?? '').toLowerCase().includes(q) ||
        s.items.some(i => i.productName.toLowerCase().includes(q)),
    );
  }, [completed, query]);

  const handlePrint = (sale: SaleTransaction, type: DocumentType) => {
    const tpl = getActive(type);
    const data = saleToDocumentRenderData(sale, type, {
      showDiscount: taxSettings.showDiscountOnDocuments && taxSettings.discountEnabled,
      isSw,
    });
    downloadDocumentPdf(tpl, data, config.branding, isSw);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-[#E1DFDD] p-6 shadow-xs">
        <h2 className="text-xl font-bold text-[#323130]">
          {isSw ? 'Historia ya Mauzo & Hati' : 'Sales History & Documents'}
        </h2>
        <p className="text-sm text-[#605E5C] mt-1">
          {isSw
            ? 'Tazama miamala yote iliyokamilika. Pakua au chapisha ankara, noti ya uwasilishaji, na noti ya agizo kwa kila mauzo.'
            : 'View all completed transactions. Download or print invoice, delivery note, and order note for each sale.'}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#605E5C]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={isSw ? 'Tafuta risiti, mteja, bidhaa…' : 'Search receipt, customer, product…'}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[#E1DFDD] text-sm focus:outline-none focus:ring-2 focus:ring-[#6264A7]/30"
            />
          </div>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="px-3 py-2.5 rounded-lg border border-[#E1DFDD] text-sm bg-white"
          >
            <option value={7}>{isSw ? 'Siku 7' : 'Last 7 days'}</option>
            <option value={30}>{isSw ? 'Siku 30' : 'Last 30 days'}</option>
            <option value={90}>{isSw ? 'Miezi 3' : 'Last 3 months'}</option>
            <option value={365}>{isSw ? 'Mwaka 1' : 'Last year'}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E1DFDD] overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-[#E1DFDD] flex items-center justify-between">
          <span className="text-xs font-bold text-[#605E5C] uppercase tracking-wide">
            {isSw ? 'Miamala' : 'Transactions'} ({filtered.length})
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#605E5C]">
            {isSw ? 'Hakuna mauzo yaliyokamilika kwa kipindi hiki.' : 'No completed sales for this period.'}
          </div>
        ) : (
          <div className="divide-y divide-[#E1DFDD]">
            {filtered.map(sale => (
              <div key={sale.id} className="p-4 hover:bg-[#FAFAFA] transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#323130]">{sale.receiptNumber}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        {isSw ? 'Imekamilika' : 'Completed'}
                      </span>
                    </div>
                    <div className="text-xs text-[#605E5C] mt-1">
                      {sale.date} · {sale.customerName || (isSw ? 'Mteja wa Kawaida' : 'Walk-in')} ·{' '}
                      {sale.items.length} {isSw ? 'bidhaa' : 'items'} · {sale.cashierName}
                    </div>
                    <div className="text-sm font-bold text-[#6264A7] mt-1">{formatTSh(sale.total)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {DOC_ACTIONS.map(action => (
                      <button
                        key={action.type}
                        type="button"
                        onClick={() => handlePrint(sale, action.type)}
                        title={documentTypeLabel(action.type, isSw)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition hover:shadow-sm cursor-pointer ${action.color}`}
                      >
                        {action.icon}
                        <span className="hidden sm:inline">{documentTypeLabel(action.type, isSw)}</span>
                        <Printer className="w-3 h-3 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-[#605E5C] flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5" />
        {isSw
          ? 'Bonyeza aina ya hati ili kufungua dirisha la kuchapisha / kuhifadhi kama PDF.'
          : 'Click a document type to open the print dialog and save as PDF.'}
      </p>
    </div>
  );
};
