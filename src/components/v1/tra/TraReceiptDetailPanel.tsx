import React from 'react';
import { ArrowLeft, Printer, ExternalLink, CheckCircle2, XCircle, Clock, FlaskConical } from 'lucide-react';
import type { TraReceipt, TraReceiptStatus } from '@/types/traReceipt';
import { formatTSh } from '@/utils/translations';
import { printHtmlPage } from '@/lib/documentRenderer';

function statusBadge(status: TraReceiptStatus, isDemo: boolean, isSw: boolean) {
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
      <Clock className="w-3 h-3" /> {isSw ? 'Inasubiri' : 'Pending'}
    </span>
  );
}

interface TraReceiptDetailPanelProps {
  receipt: TraReceipt;
  isSw: boolean;
  onBack: () => void;
}

export const TraReceiptDetailPanel: React.FC<TraReceiptDetailPanelProps> = ({
  receipt,
  isSw,
  onBack,
}) => {
  const printReceipt = () => {
    const rows = receipt.items
      .map(
        i =>
          `<tr><td>${i.productName}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${formatTSh(i.unitPrice)}</td><td style="text-align:right">${formatTSh(i.total)}</td></tr>`,
      )
      .join('');
    const qr = receipt.verificationQrDataUrl
      ? `<img src="${receipt.verificationQrDataUrl}" alt="QR" width="120" height="120" />`
      : `<p style="color:#888;font-size:12px">${isSw ? 'Msimbo wa QR haupo' : 'QR code not available'}</p>`;

    const bodyHtml = `
      <h1>${receipt.companyName}</h1>
      <p style="font-size:11px;color:#666">TRA EFD Receipt · ${receipt.receiptNumber}</p>
      <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        <div><div style="color:#666;font-size:10px;text-transform:uppercase">${isSw ? 'Tarehe' : 'Receipt Date'}</div><div style="font-weight:600">${receipt.receiptDate}</div></div>
        <div><div style="color:#666;font-size:10px;text-transform:uppercase">${isSw ? 'Muda' : 'Receipt Time'}</div><div style="font-weight:600">${receipt.receiptTime}</div></div>
        <div><div style="color:#666;font-size:10px;text-transform:uppercase">Z Number</div><div style="font-weight:600">${receipt.zNumber}</div></div>
        <div><div style="color:#666;font-size:10px;text-transform:uppercase">VRN</div><div style="font-weight:600">${receipt.vrn || '—'}</div></div>
      </div>
      <p style="margin-top:12px;font-size:12px"><strong>${isSw ? 'Nambari ya Uthibitisho' : 'Verification Code'}:</strong> ${receipt.verificationCode}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px"><thead><tr><th style="text-align:left;border-bottom:1px solid #eee;padding:6px 4px">${isSw ? 'Bidhaa' : 'Item'}</th><th style="text-align:right;border-bottom:1px solid #eee;padding:6px 4px">Qty</th><th style="text-align:right;border-bottom:1px solid #eee;padding:6px 4px">${isSw ? 'Bei' : 'Price'}</th><th style="text-align:right;border-bottom:1px solid #eee;padding:6px 4px">Total</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="text-align:right;font-size:13px;margin-top:8px">
        ${isSw ? 'Jumla bila VAT' : 'Total Excl. Tax'}: ${formatTSh(receipt.totalExclTax)}<br/>
        VAT: ${formatTSh(receipt.totalVat)}<br/>
        <strong>${isSw ? 'Jumla' : 'Total Incl. Tax'}: ${formatTSh(receipt.totalInclTax)}</strong>
      </p>
      <div style="text-align:center;margin-top:16px">${qr}</div>
      ${receipt.verificationLink ? `<p style="text-align:center;font-size:10px;word-break:break-all">${receipt.verificationLink}</p>` : ''}`;
    printHtmlPage(receipt.receiptNumber, bodyHtml, isSw);
  };

  const fields: { label: string; value: string; span?: boolean }[] = [
    { label: isSw ? 'Nambari ya Risiti' : 'Receipt Number', value: receipt.receiptNumber },
    { label: isSw ? 'Nambari ya Uthibitisho' : 'Verification Code', value: receipt.verificationCode },
    { label: isSw ? 'Tarehe ya Risiti' : 'Receipt Date', value: receipt.receiptDate },
    { label: isSw ? 'Muda wa Risiti' : 'Receipt Time', value: receipt.receiptTime },
    { label: 'Z Number', value: receipt.zNumber },
    { label: 'VRN', value: receipt.vrn || '—' },
    {
      label: isSw ? 'Kiungo cha Uthibitisho' : 'Verification Link',
      value: receipt.verificationLink || '—',
      span: true,
    },
    { label: isSw ? 'Mteja' : 'Customer', value: receipt.customerName },
    { label: isSw ? 'Jumla pamoja na VAT' : 'Total Incl. Tax', value: formatTSh(receipt.totalInclTax) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E1DFDD] text-sm font-semibold hover:bg-[#F3F2F1]"
        >
          <ArrowLeft className="w-4 h-4" />
          {isSw ? 'Rudi kwenye orodha' : 'Back to list'}
        </button>
        <button
          type="button"
          onClick={printReceipt}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#323130] text-white text-sm font-semibold hover:bg-[#201F1E]"
        >
          <Printer className="w-4 h-4" />
          {isSw ? 'Chapisha' : 'Print'}
        </button>
        {receipt.verificationLink && (
          <a
            href={receipt.verificationLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#0078D4] text-[#0078D4] text-sm font-semibold hover:bg-blue-50"
          >
            <ExternalLink className="w-4 h-4" />
            {isSw ? 'Thibitisha TRA' : 'Verify on TRA'}
          </a>
        )}
        {statusBadge(receipt.status, receipt.isDemo, isSw)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-[#323130]">
            {isSw ? 'Maelezo ya Risiti' : 'Receipt Details'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.label} className={f.span ? 'sm:col-span-2' : ''}>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#605E5C]">{f.label}</div>
                <div className="text-sm font-semibold text-[#323130] mt-0.5 break-all">{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs">
          <h4 className="text-sm font-bold text-[#323130] mb-3">
            {isSw ? 'Msimbo wa QR wa TRA' : 'TRA Verification QR Code'}
          </h4>
          <div className="flex flex-col items-center justify-center min-h-[200px] rounded-lg border border-dashed border-[#C8C6C4] bg-[#FAF9F8] p-4">
            {receipt.verificationQrDataUrl ? (
              <img
                src={receipt.verificationQrDataUrl}
                alt="TRA verification QR"
                className="w-40 h-40 object-contain"
              />
            ) : (
              <p className="text-xs text-[#605E5C] text-center">
                {isSw ? 'Msimbo wa QR haupo' : 'QR code not available'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
