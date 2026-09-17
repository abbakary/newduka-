/**
 * Odoo-inspired A4 paper HTML for standard Tanzania commercial reports.
 * Used for on-screen preview + browser print (real paper look).
 */

import { formatTSh } from '@/utils/translations';
import type {
  InventoryValuationRow,
  PurchaseReportRow,
  ReportCompanyInfo,
  ReportPeriod,
  SalesDetailRow,
  SalesVatSummary,
} from '@/lib/standardReports';
import { formatPeriodLabel } from '@/lib/standardReports';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return formatTSh(Math.round(n));
}

function companyHeader(company: ReportCompanyInfo, isSw: boolean): string {
  const logo = company.logoUrl
    ? `<img src="${esc(company.logoUrl)}" alt="" style="max-height:52px;max-width:120px;object-fit:contain" />`
    : `<div style="width:52px;height:52px;border-radius:8px;background:#0F2347;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">D+</div>`;

  return `
  <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #0F2347;padding-bottom:12px;margin-bottom:14px">
    <div style="display:flex;gap:12px;align-items:flex-start">
      ${logo}
      <div>
        <div style="font-size:18px;font-weight:800;color:#0F2347;letter-spacing:-0.02em">${esc(company.businessName || 'Duka+')}</div>
        ${company.address ? `<div style="font-size:11px;color:#4B5563;margin-top:2px">${esc(company.address)}</div>` : ''}
        <div style="font-size:11px;color:#4B5563;margin-top:2px">
          ${[
            company.ownerName ? `${isSw ? 'Mmiliki' : 'Owner'}: ${esc(company.ownerName)}` : '',
            company.phone ? `${isSw ? 'Simu' : 'Tel'}: ${esc(company.phone)}` : '',
            company.email ? esc(company.email) : '',
          ].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;color:#374151;line-height:1.55">
      ${company.tinNumber ? `<div><strong>TIN</strong>: ${esc(company.tinNumber)}</div>` : ''}
      ${company.vrn ? `<div><strong>VRN</strong>: ${esc(company.vrn)}</div>` : ''}
      ${company.branch ? `<div><strong>${isSw ? 'Tawi' : 'Branch'}</strong>: ${esc(company.branch)}</div>` : ''}
      ${company.businessType ? `<div>${esc(company.businessType)}</div>` : ''}
    </div>
  </div>`;
}

function titleBlock(title: string, subtitle: string, period: ReportPeriod, isSw: boolean): string {
  return `
  <div style="margin-bottom:14px">
    <div style="font-size:16px;font-weight:800;color:#111827;text-transform:uppercase;letter-spacing:0.04em">${esc(title)}</div>
    <div style="font-size:11px;color:#6B7280;margin-top:2px">${esc(subtitle)}</div>
    <div style="font-size:11px;color:#0F2347;font-weight:600;margin-top:6px">${esc(formatPeriodLabel(period, isSw))}</div>
  </div>`;
}

function kpiStrip(items: Array<{ label: string; value: string }>): string {
  const cells = items
    .map(
      k => `
    <div style="flex:1;min-width:120px;border:1px solid #E5E7EB;border-radius:6px;padding:8px 10px;background:#F9FAFB">
      <div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em">${esc(k.label)}</div>
      <div style="font-size:13px;font-weight:800;color:#111827;margin-top:3px;font-variant-numeric:tabular-nums">${esc(k.value)}</div>
    </div>`,
    )
    .join('');
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">${cells}</div>`;
}

function tableHtml(
  headers: string[],
  rows: string[][],
  emptyMsg: string,
  opts?: { compact?: boolean; moneyCols?: number[] },
): string {
  if (!rows.length) {
    return `<div style="border:1px dashed #D1D5DB;border-radius:8px;padding:28px;text-align:center;color:#6B7280;font-size:12px">${esc(emptyMsg)}</div>`;
  }
  const compact = Boolean(opts?.compact);
  const moneyCols = new Set(opts?.moneyCols ?? []);
  const pad = compact ? '4px 6px' : '6px 8px';
  const fs = compact ? '9px' : '10px';
  const headFs = compact ? '8px' : '9px';
  const head = headers
    .map(
      h =>
        `<th style="background:#F3F4F6;border:1px solid #E5E7EB;padding:${pad};font-size:${headFs};text-transform:uppercase;letter-spacing:0.02em;color:#374151;white-space:nowrap;font-weight:700;vertical-align:bottom">${esc(h)}</th>`,
    )
    .join('');
  const body = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
      return `<tr>${r
        .map((c, ci) => {
          const money = moneyCols.has(ci);
          return `<td style="border:1px solid #E5E7EB;padding:${pad};font-size:${fs};background:${bg};vertical-align:top;line-height:1.3;${money ? 'text-align:right;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums' : 'white-space:nowrap'}">${c}</td>`;
        })
        .join('')}</tr>`;
    })
    .join('');
  // table-layout:auto so column widths follow content, not fixed splits
  return `<div style="width:100%;overflow-x:auto"><table style="width:100%;border-collapse:collapse;table-layout:auto"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function footerNote(isSw: boolean, extra?: string): string {
  const generated = new Date().toLocaleString(isSw ? 'sw-TZ' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `
  <div style="margin-top:18px;padding-top:10px;border-top:1px solid #E5E7EB;font-size:9px;color:#6B7280">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <span>${isSw ? 'Imetolewa na Duka+ · Ripoti ya biashara (Tanzania)' : 'Generated by Duka+ · Tanzania business report'}</span>
      <span><strong>${isSw ? 'Muda wa kutolewa' : 'Generated at'}:</strong> ${esc(generated)}</span>
    </div>
    ${extra ? `<div style="margin-top:4px">${esc(extra)}</div>` : ''}
  </div>`;
}

function wrapPaper(inner: string, opts?: { landscape?: boolean }): string {
  const landscape = Boolean(opts?.landscape);
  const width = landscape ? '297mm' : '210mm';
  const pageRule = landscape
    ? '@page { size: A4 landscape; margin: 8mm; }'
    : '@page { size: A4 portrait; margin: 10mm; }';
  return `
  <style>
    ${pageRule}
    .duka-report-paper { box-sizing: border-box; }
    @media print {
      .duka-report-paper {
        width: 100% !important;
        max-width: none !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .duka-report-paper table { page-break-inside: auto; }
      .duka-report-paper tr { page-break-inside: avoid; }
    }
  </style>
  <div class="duka-report-paper" data-orientation="${landscape ? 'landscape' : 'portrait'}" style="
    width:${width};max-width:100%;margin:0 auto;background:#fff;
    color:#111;padding:10mm 8mm;box-sizing:border-box;
    font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
    box-shadow:0 12px 40px rgba(15,35,71,0.12);border:1px solid #E5E7EB;
    overflow:hidden;
  ">
    ${inner}
  </div>`;
}

export function renderSalesDetailPaper(opts: {
  company: ReportCompanyInfo;
  period: ReportPeriod;
  rows: SalesDetailRow[];
  totals: { net: number; vat: number; discount: number; gross: number };
  isSw: boolean;
}): string {
  const { company, period, rows, totals, isSw } = opts;
  // Compact A4 landscape columns — everything stays on one horizontal line per row
  const headers = isSw
    ? ['#', 'Risiti', 'Tarehe / Saa', 'Mteja', 'Bidhaa', 'Malipo', 'Neto', 'VAT', 'Jumla']
    : ['#', 'Receipt', 'Date / Time', 'Customer', 'Items', 'Pay', 'Net', 'VAT', 'Gross'];
  const tableRows = rows.map(r => [
    String(r.serial),
    esc(r.receipt),
    `<div>${esc(r.date)}</div><div style="color:#6B7280">${esc(r.time)}</div>`,
    esc(r.customer),
    `<div style="line-height:1.25"><strong>${r.itemCount}</strong> · ${esc(
      r.itemSummary.length > 42 ? `${r.itemSummary.slice(0, 40)}…` : r.itemSummary,
    )}</div>${r.cashier ? `<div style="color:#6B7280;margin-top:2px">${esc(r.cashier)}</div>` : ''}`,
    esc(r.payment),
    money(r.net),
    money(r.vat),
    money(r.gross),
  ]);
  const inner = `
    ${companyHeader(company, isSw)}
    ${titleBlock(
      isSw ? 'Ripoti ya Mauzo ya Kila Siku (Gross Sales)' : 'Daily Gross Sales Report',
      isSw
        ? 'Muundo wa karatasi A4 (mlalo) — risiti, muda, bidhaa, VAT na jumla'
        : 'Real A4 landscape paper — receipt, time, items, VAT & totals',
      period,
      isSw,
    )}
    ${kpiStrip([
      { label: isSw ? 'Risiti' : 'Receipts', value: String(rows.length) },
      { label: isSw ? 'Neto' : 'Net Sales', value: money(totals.net) },
      { label: isSw ? 'VAT' : 'VAT', value: money(totals.vat) },
      { label: isSw ? 'Jumla ya Mauzo' : 'Gross Sales', value: money(totals.gross) },
    ])}
    ${tableHtml(headers, tableRows, isSw ? 'Hakuna mauzo katika kipindi hiki.' : 'No sales in this period.', {
      compact: true,
      moneyCols: [6, 7, 8],
    })}
    ${footerNote(isSw)}
  `;
  return wrapPaper(inner, { landscape: true });
}

export function renderSalesVatSummaryPaper(opts: {
  company: ReportCompanyInfo;
  period: ReportPeriod;
  summary: SalesVatSummary;
  isSw: boolean;
}): string {
  const { company, period, summary, isSw } = opts;
  const vatHeaders = isSw
    ? ['Kodi', 'Maelezo', 'Risiti', 'Neto', 'VAT', 'Jumla']
    : ['Code', 'Description', 'Receipts', 'Net', 'VAT', 'Gross'];
  const vatRows = summary.buckets.map(b => [
    esc(b.code),
    esc(isSw && b.code === 'A' ? 'VAT ya kawaida 18%' : b.label),
    String(b.receiptCount),
    money(b.net),
    money(b.vat),
    money(b.gross),
  ]);
  const payHeaders = isSw
    ? ['Njia ya Malipo', 'Idadi', 'Kiasi']
    : ['Payment Method', 'Count', 'Amount'];
  const payRows = summary.paymentBreakdown.map(p => [
    esc(p.method),
    String(p.count),
    money(p.amount),
  ]);

  const inner = `
    ${companyHeader(company, isSw)}
    ${titleBlock(
      isSw ? 'Muhtasari wa VAT / Z-Report (Kipindi)' : 'VAT Summary / Period Z-Report',
      isSw
        ? 'Jumla za VAT kwa kiwango (A=18%) · malipo · idadi ya risiti'
        : 'VAT totals by rate (A=18%) · payments · receipt counts',
      period,
      isSw,
    )}
    ${kpiStrip([
      { label: isSw ? 'Risiti' : 'Receipts', value: String(summary.receiptCount) },
      { label: isSw ? 'Neto' : 'Net', value: money(summary.totalNet) },
      { label: isSw ? 'VAT' : 'VAT', value: money(summary.totalVat) },
      { label: isSw ? 'Jumla' : 'Gross', value: money(summary.totalGross) },
    ])}
    <div style="font-size:11px;font-weight:700;color:#374151;margin:4px 0 6px">${isSw ? 'Jumla za VAT' : 'VAT Totals'}</div>
    ${tableHtml(vatHeaders, vatRows, isSw ? 'Hakuna data.' : 'No data.', { moneyCols: [3, 4, 5] })}
    <div style="font-size:11px;font-weight:700;color:#374151;margin:16px 0 6px">${isSw ? 'Malipo' : 'Payments'}</div>
    ${tableHtml(payHeaders, payRows, isSw ? 'Hakuna malipo.' : 'No payments.', { moneyCols: [2] })}
    <div style="margin-top:12px;font-size:10px;color:#6B7280">
      ${isSw
        ? 'Kumbuka: Ripoti hii ni ya usimamizi wa ndani. Z-Report rasmi ya EFD inatolewa kutoka kifaa cha TRA.'
        : 'Note: Management report. Official EFD Z-Report is issued from the TRA fiscal device.'}
    </div>
    ${footerNote(isSw)}
  `;
  return wrapPaper(inner);
}

export function renderInventoryValuationPaper(opts: {
  company: ReportCompanyInfo;
  period: ReportPeriod;
  rows: InventoryValuationRow[];
  totals: { cost: number; retail: number; skus: number; low: number };
  isSw: boolean;
}): string {
  const { company, period, rows, totals, isSw } = opts;
  const headers = isSw
    ? ['Maelezo ya Bidhaa', 'Qty', 'Reorder', 'Gharama', 'Bei', 'Thamani Gharama', 'Thamani Reja', 'Margin', 'Hali']
    : ['Product details', 'Qty', 'Reorder', 'Unit cost', 'Sell price', 'Cost value', 'Retail value', 'Margin', 'Health'];
  const healthLabel = (h: InventoryValuationRow['health']) => {
    if (isSw) {
      if (h === 'critical') return 'Hatari';
      if (h === 'low') return 'Chini';
      if (h === 'overstock') return 'Ziada';
      return 'Sawa';
    }
    if (h === 'critical') return 'Critical';
    if (h === 'low') return 'Low';
    if (h === 'overstock') return 'Overstock';
    return 'OK';
  };
  const tableRows = rows.map(r => {
    const meta = [
      `SKU: ${r.sku}`,
      r.category,
      r.batchNumber !== '—' ? `${isSw ? 'Batch' : 'Batch'}: ${r.batchNumber}` : '',
      r.expiryDate !== '—' ? `${isSw ? 'Mwisho' : 'Expiry'}: ${r.expiryDate}` : '',
      r.supplier !== '—' ? `${isSw ? 'Msambazaji' : 'Supplier'}: ${r.supplier}` : '',
      r.location !== '—' ? `${isSw ? 'Eneo' : 'Location'}: ${r.location}` : '',
      `VAT: ${r.vatType}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const desc = r.description
      ? `<div style="font-size:9px;color:#6B7280;margin-top:2px">${esc(r.description.slice(0, 120))}${r.description.length > 120 ? '…' : ''}</div>`
      : '';
    return [
      `<div style="line-height:1.35;min-width:160px">
        <div style="font-weight:700;font-size:11px">${esc(r.name)}</div>
        <div style="font-size:9px;color:#4B5563;margin-top:2px">${esc(meta)}</div>
        ${desc}
      </div>`,
      `${r.qty} ${esc(r.unit)}`,
      String(r.reorderPoint),
      money(r.unitCost),
      money(r.unitPrice),
      money(r.stockValue),
      money(r.retailValue),
      `${r.marginPercent}%`,
      healthLabel(r.health),
    ];
  });
  const inner = `
    ${companyHeader(company, isSw)}
    ${titleBlock(
      isSw ? 'Thamani ya Stoo (Inventory Valuation)' : 'Inventory Valuation Report',
      isSw
        ? 'Mtindo wa Odoo — maelezo kamili ya bidhaa, batch, muda wa kutolewa, wingi × gharama'
        : 'Odoo-style — full product details, batch/expiry, generated time, qty × cost',
      period,
      isSw,
    )}
    ${kpiStrip([
      { label: isSw ? 'SKU' : 'SKUs', value: String(totals.skus) },
      { label: isSw ? 'Thamani (Gharama)' : 'Cost Value', value: money(totals.cost) },
      { label: isSw ? 'Thamani (Reja)' : 'Retail Value', value: money(totals.retail) },
      { label: isSw ? 'Stoo Chini' : 'Low Stock', value: String(totals.low) },
    ])}
    ${tableHtml(headers, tableRows, isSw ? 'Hakuna bidhaa.' : 'No products.', {
      compact: true,
      moneyCols: [3, 4, 5, 6],
    })}
    ${footerNote(
      isSw,
      isSw
        ? 'Thamani = wingi × gharama ya ununuzi. Bei ya kuuza inaonyeshwa kwa kulinganisha.'
        : 'Cost value = on-hand qty × purchase cost. Sell price shown for comparison.',
    )}
  `;
  return wrapPaper(inner, { landscape: true });
}

export function renderPurchaseOrdersPaper(opts: {
  company: ReportCompanyInfo;
  period: ReportPeriod;
  rows: PurchaseReportRow[];
  totals: { untaxed: number; vat: number; total: number; count: number };
  isSw: boolean;
}): string {
  const { company, period, rows, totals, isSw } = opts;
  const headers = isSw
    ? ['PO #', 'Msambazaji', 'Tarehe', 'Saa', 'Inatarajiwa', 'Imepokelewa', 'Hali', 'Bidhaa', 'Bila VAT', 'VAT', 'Jumla', 'Malipo']
    : ['PO #', 'Supplier', 'Date', 'Time', 'Expected', 'Received', 'Status', 'Items', 'Untaxed', 'VAT', 'Total', 'Payment'];
  const tableRows = rows.map(r => [
    esc(r.poNumber),
    esc(r.supplier),
    esc(r.date),
    esc(r.time),
    esc(r.expected),
    esc(r.receivedDate),
    esc(r.status),
    `<div style="font-size:10px;line-height:1.35"><strong>${r.itemCount}</strong> · ${esc(r.itemSummary)}</div>`,
    money(r.untaxed),
    money(r.vat),
    money(r.total),
    `${esc(r.paymentStatus)}${r.paymentMethod !== '—' ? ` / ${esc(r.paymentMethod)}` : ''}`,
  ]);
  const inner = `
    ${companyHeader(company, isSw)}
    ${titleBlock(
      isSw ? 'Ripoti ya Ununuzi (Purchase Orders)' : 'Purchase Orders Report',
      isSw
        ? 'Maagizo, bidhaa, muda, VAT ya pembejeo na hali ya malipo'
        : 'Orders, line items, timestamps, input VAT and payment status',
      period,
      isSw,
    )}
    ${kpiStrip([
      { label: isSw ? 'Maagizo' : 'Orders', value: String(totals.count) },
      { label: isSw ? 'Bila VAT' : 'Untaxed', value: money(totals.untaxed) },
      { label: isSw ? 'VAT Pembejeo' : 'Input VAT', value: money(totals.vat) },
      { label: isSw ? 'Jumla' : 'Total', value: money(totals.total) },
    ])}
    ${tableHtml(headers, tableRows, isSw ? 'Hakuna maagizo katika kipindi hiki.' : 'No purchase orders in this period.', {
      compact: true,
      moneyCols: [8, 9, 10],
    })}
    ${footerNote(isSw)}
  `;
  return wrapPaper(inner, { landscape: true });
}
