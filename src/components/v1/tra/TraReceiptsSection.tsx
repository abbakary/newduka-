import React, { useMemo, useState } from 'react';
import { Search, CheckCircle2, XCircle, Clock, FlaskConical } from 'lucide-react';
import type { Language } from '@/types/v1';
import type { TraReceipt, TraReceiptStatus } from '@/types/traReceipt';
import { formatTSh } from '@/utils/translations';
import { useTraReceipts } from '@/context/TraReceiptContext';
import { TraReceiptDetailPanel } from '@/components/v1/tra/TraReceiptDetailPanel';

function statusBadge(status: TraReceiptStatus, isDemo: boolean) {
  if (isDemo || status === 'demo') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <FlaskConical className="w-3 h-3" /> Demo
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> Success
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

interface TraReceiptsSectionProps {
  language: Language;
}

export const TraReceiptsSection: React.FC<TraReceiptsSectionProps> = ({ language }) => {
  const isSw = language === 'sw';
  const { receipts, selectedReceiptId, setSelectedReceiptId } = useTraReceipts();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TraReceiptStatus | 'all'>('success');

  const selectedReceipt = useMemo(
    () => receipts.find(r => r.id === selectedReceiptId),
    [receipts, selectedReceiptId],
  );

  const filtered = useMemo(() => {
    let list = [...receipts];
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter || (statusFilter === 'demo' && r.isDemo));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        r =>
          r.receiptNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.verificationCode.toLowerCase().includes(q) ||
          r.invoiceReference.toLowerCase().includes(q),
      );
    }
    return list;
  }, [receipts, query, statusFilter]);

  if (selectedReceipt) {
    return (
      <TraReceiptDetailPanel
        receipt={selectedReceipt}
        isSw={isSw}
        onBack={() => setSelectedReceiptId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#E1DFDD] p-4 shadow-xs flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
        <div className="flex flex-1 flex-col sm:flex-row gap-2 sm:max-w-xl sm:ml-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#605E5C]" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={isSw ? 'Tafuta risiti…' : 'Search receipts…'}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E1DFDD] text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as TraReceiptStatus | 'all')}
            className="px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm bg-white"
          >
            <option value="all">{isSw ? 'Zote' : 'All'}</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="demo">Demo</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E1DFDD] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#FAF9F8] border-b border-[#E1DFDD] text-[#605E5C]">
              <tr>
                <th className="text-left px-3 py-3 font-bold">{isSw ? 'Nambari' : 'Receipt No.'}</th>
                <th className="text-left px-3 py-3 font-bold">{isSw ? 'Tarehe' : 'Date'}</th>
                <th className="text-left px-3 py-3 font-bold">{isSw ? 'Mteja' : 'Customer'}</th>
                <th className="text-left px-3 py-3 font-bold">{isSw ? 'Uthibitisho' : 'Verification'}</th>
                <th className="text-right px-3 py-3 font-bold">VAT</th>
                <th className="text-right px-3 py-3 font-bold">{isSw ? 'Jumla' : 'Total'}</th>
                <th className="text-left px-3 py-3 font-bold">{isSw ? 'Hali' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#605E5C]">
                    {isSw
                      ? 'Hakuna risiti za TRA bado. Washa TRA EFD kwenye Usanidi na kamilisha mauzo kwenye POS.'
                      : 'No TRA receipts yet. Enable TRA EFD in Setup and complete POS sales.'}
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr
                    key={r.id}
                    className="border-t border-[#EDEBE9] hover:bg-[#FAF9F8] cursor-pointer"
                    onClick={() => setSelectedReceiptId(r.id)}
                  >
                    <td className="px-3 py-2.5 font-mono text-[11px]">{r.receiptNumber}</td>
                    <td className="px-3 py-2.5">{r.receiptDate}</td>
                    <td className="px-3 py-2.5">{r.customerName}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] max-w-[100px] truncate">
                      {r.verificationCode}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatTSh(r.totalVat)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatTSh(r.totalInclTax)}</td>
                    <td className="px-3 py-2.5">{statusBadge(r.status, r.isDemo)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
