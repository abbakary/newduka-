import React, { useMemo } from 'react';
import type { Language } from '@/types/v1';
import { formatTSh } from '@/utils/translations';
import { useTraReceipts } from '@/context/TraReceiptContext';

interface TraReportsSectionProps {
  language: Language;
}

export const TraReportsSection: React.FC<TraReportsSectionProps> = ({ language }) => {
  const isSw = language === 'sw';
  const { receipts } = useTraReceipts();

  const stats = useMemo(() => {
    const success = receipts.filter(r => r.status === 'success').length;
    const failed = receipts.filter(r => r.status === 'failed').length;
    const totalVat = receipts.reduce((s, r) => s + r.totalVat, 0);
    const totalSales = receipts.reduce((s, r) => s + r.totalInclTax, 0);
    return { success, failed, totalVat, totalSales, count: receipts.length };
  }, [receipts]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        {
          label: isSw ? 'Jumla ya Risiti' : 'Total Receipts',
          value: String(stats.count),
          tone: 'text-[#323130]',
        },
        {
          label: isSw ? 'Zilizofanikiwa' : 'Successful',
          value: String(stats.success),
          tone: 'text-emerald-700',
        },
        {
          label: isSw ? 'Zilizoshindwa' : 'Failed',
          value: String(stats.failed),
          tone: 'text-red-700',
        },
        {
          label: isSw ? 'Jumla ya VAT' : 'Total VAT Collected',
          value: formatTSh(stats.totalVat),
          tone: 'text-[#E65100]',
        },
      ].map(card => (
        <div key={card.label} className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-[#605E5C]">{card.label}</div>
          <div className={`text-2xl font-bold mt-1 ${card.tone}`}>{card.value}</div>
        </div>
      ))}
      <div className="sm:col-span-2 lg:col-span-4 bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs">
        <div className="text-[10px] font-bold uppercase text-[#605E5C]">
          {isSw ? 'Jumla ya Mauzo (pamoja na VAT)' : 'Gross Sales (incl. VAT)'}
        </div>
        <div className="text-3xl font-bold text-[#323130] mt-1">{formatTSh(stats.totalSales)}</div>
      </div>
    </div>
  );
};
