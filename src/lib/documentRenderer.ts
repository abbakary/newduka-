import type { DocumentBranding, DocumentRenderData, DocumentTemplate } from './documentTemplates';
import { formatDueDateDisplay } from './dueDate';
import { documentTypeLabel } from './documentTemplates';

function fmt(n: number): string {
  return `TSh ${n.toLocaleString('en-TZ')}`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function logoHtml(logoUrl: string, maxHeight = 44): string {
  if (!logoUrl) {
    return `<div style="width:44px;height:44px;border-radius:8px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;">LOGO</div>`;
  }
  return `<img src="${esc(logoUrl)}" alt="Logo" style="max-height:${maxHeight}px;max-width:120px;object-fit:contain;border-radius:6px;" />`;
}

function companyMetaLines(branding: DocumentBranding, isSw: boolean): string {
  const lines: string[] = [];
  if (branding.address) lines.push(esc(branding.address));
  if (branding.phone) lines.push(`${isSw ? 'Simu' : 'Phone'}: ${esc(branding.phone)}`);
  if (branding.tinNumber) lines.push(`TIN: ${esc(branding.tinNumber)}`);
  if (!lines.length) return '';
  return `<div style="font-size:9px;color:#6B7280;line-height:1.45;margin-top:4px;">${lines.join('<br/>')}</div>`;
}

function headerBlock(
  tpl: DocumentTemplate,
  data: DocumentRenderData,
  branding: DocumentBranding,
  isSw: boolean,
) {
  const title = (data.titleOverride ?? documentTypeLabel(data.documentType, isSw)).toUpperCase();
  const { theme } = tpl;
  const logo = logoHtml(branding.logoUrl);

  if (tpl.theme.headerStyle === 'wave') {
    return `
      <div style="background:linear-gradient(135deg,${theme.primary},${theme.secondary});padding:18px 20px;border-radius:12px 12px 0 0;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div>
          <div style="font-size:10px;opacity:.85;">${esc(data.documentNumber)}</div>
          <div style="font-size:22px;font-weight:800;margin-top:4px;">${title}</div>
          <div style="font-size:10px;opacity:.9;margin-top:4px;">${esc(data.date)}</div>
        </div>
        <div>${logo.replace('rgba(255,255,255,.2)', 'rgba(255,255,255,.25)')}</div>
      </div>`;
  }
  if (tpl.theme.headerStyle === 'sidebar') {
    return `
      <div style="display:flex;min-height:88px;">
        <div style="width:32%;background:${theme.primary};color:#fff;padding:14px 12px;border-radius:12px 0 0 0;display:flex;flex-direction:column;justify-content:space-between;">
          <div>${logo}</div>
          <div style="font-size:12px;font-weight:800;margin-top:8px;line-height:1.2;">${title}</div>
        </div>
        <div style="flex:1;padding:14px 16px;background:${theme.accent}22;">
          <div style="font-size:11px;font-weight:700;color:${theme.primary};">${esc(data.documentNumber)}</div>
          <div style="font-size:10px;color:#4B5563;margin-top:4px;">${esc(data.date)}</div>
        </div>
      </div>`;
  }
  if (tpl.theme.headerStyle === 'brush') {
    return `
      <div style="position:relative;padding:20px;background:${theme.cardBg};border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;">
          <div style="height:8px;background:linear-gradient(90deg,${theme.primary},${theme.secondary});border-radius:99px;width:70%;margin-bottom:10px;"></div>
          <div style="font-size:24px;font-weight:900;color:${theme.primary};">${title}</div>
          <div style="font-size:10px;color:#6B7280;margin-top:4px;">${esc(data.documentNumber)} • ${esc(data.date)}</div>
        </div>
        <div>${logo.replace('44px', '40px')}</div>
      </div>`;
  }
  return `
    <div style="background:${theme.primary};color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;gap:12px;">
      <div>${logo}</div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:800;">${title}</div>
        <div style="font-size:10px;opacity:.9;margin-top:2px;">${esc(data.documentNumber)}</div>
      </div>
    </div>`;
}

function customerBlock(data: DocumentRenderData, isSw: boolean): string {
  const partyLabel = data.partyLabel ?? (isSw ? 'Mteja' : 'Customer');
  const address = data.customerAddress
    ? `<div style="font-size:9px;color:#6B7280;margin-top:2px;">${esc(data.customerAddress)}</div>`
    : '';
  return `
    <div style="margin-bottom:12px;padding:10px 12px;background:#F9FAFB;border-radius:10px;border:1px solid #E5E7EB;">
      <div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;">
        ${esc(partyLabel)}
      </div>
      <div style="font-size:11px;font-weight:700;color:#111;margin-top:2px;">${esc(data.customerName)}</div>
      ${address}
      <div style="font-size:9px;color:#6B7280;margin-top:4px;">${isSw ? 'Tarehe' : 'Date'}: ${esc(data.date)}</div>
    </div>`;
}

function signatureBlock(isSw: boolean): string {
  return `
    <div style="display:flex;justify-content:space-between;gap:16px;margin-top:16px;padding-top:12px;border-top:1px dashed #D1D5DB;">
      <div style="flex:1;">
        <div style="height:36px;border-bottom:1px solid #9CA3AF;"></div>
        <div style="font-size:8px;color:#6B7280;margin-top:4px;">${isSw ? 'Saini ya Mteja' : 'Customer Signature'}</div>
      </div>
      <div style="flex:1;">
        <div style="height:36px;border-bottom:1px solid #9CA3AF;"></div>
        <div style="font-size:8px;color:#6B7280;margin-top:4px;">${isSw ? 'Saini ya Biashara' : 'Authorized Signature'}</div>
      </div>
    </div>`;
}

export function renderDocumentPreviewHtml(
  tpl: DocumentTemplate,
  data: DocumentRenderData,
  branding: DocumentBranding,
  isSw: boolean,
): string {
  const rows = data.items.slice(0, 24).map(item => {
    const pct = item.discountPercent ?? 0;
    const label = pct > 0 ? `${item.description} (-${pct}%)` : item.description;
    const line = item.unitPrice * item.quantity * (1 - pct / 100);
    const qtyLabel = item.unit ? `${item.quantity} ${esc(item.unit)}` : String(item.quantity);
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;font-size:10px;">${esc(label)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;font-size:10px;text-align:center;">${qtyLabel}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;font-size:10px;text-align:right;">${fmt(Math.round(item.unitPrice))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #E5E7EB;font-size:10px;text-align:right;font-weight:600;">${fmt(Math.round(line))}</td>
    </tr>`;
  }).join('');

  const priceCol = data.priceColumnLabel ?? (isSw ? 'Bei' : 'Price');
  const discountLabel = data.discountLabel ?? (isSw ? 'Punguzo' : 'Discount');

  const discountRow = data.showDiscount && data.discountAmount > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#B45309;margin-top:4px;">
        <span>${esc(discountLabel)}</span><span>- ${fmt(data.discountAmount)}</span></div>`
    : '';

  const vatRow = data.hideVat
    ? ''
    : `<div style="display:flex;justify-content:space-between;font-size:10px;color:#374151;margin-top:4px;"><span>VAT (18%)</span><span>${fmt(data.vatAmount)}</span></div>`;

  const notesBlock = data.notes
    ? `<div style="margin-top:10px;padding:8px 10px;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;font-size:9px;color:#92400E;">
        <strong>${isSw ? 'Maelezo:' : 'Notes:'}</strong> ${esc(data.notes)}
      </div>`
    : '';

  const watermark = branding.watermark
    ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:.06;font-size:48px;font-weight:900;color:#000;transform:rotate(-24deg);">${esc(branding.watermark)}</div>`
    : '';

  return `
    <div style="position:relative;font-family:Segoe UI,system-ui,sans-serif;background:${tpl.theme.cardBg};border-radius:14px;overflow:hidden;border:1px solid #E5E7EB;box-shadow:0 8px 24px rgba(0,0,0,.08);transform:scale(.92);transform-origin:top center;">
      ${watermark}
      ${headerBlock(tpl, data, branding, isSw)}
      <div style="background:#fff;padding:14px 16px;">
        <div style="font-size:12px;font-weight:800;color:#111;margin-bottom:2px;">${esc(branding.companyName || 'Your Business')}</div>
        ${companyMetaLines(branding, isSw)}
        ${customerBlock(data, isSw)}
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:${tpl.theme.primary}15;">
              <th style="padding:6px 8px;text-align:left;font-size:9px;color:${tpl.theme.primary};">${isSw ? 'Bidhaa' : 'Item'}</th>
              <th style="padding:6px 8px;text-align:center;font-size:9px;color:${tpl.theme.primary};">Qty</th>
              <th style="padding:6px 8px;text-align:right;font-size:9px;color:${tpl.theme.primary};">${esc(priceCol)}</th>
              <th style="padding:6px 8px;text-align:right;font-size:9px;color:${tpl.theme.primary};">${isSw ? 'Jumla' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="4" style="padding:12px;text-align:center;font-size:10px;color:#9CA3AF;">Sample items</td></tr>`}</tbody>
        </table>
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #E5E7EB;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#374151;"><span>Subtotal</span><span>${fmt(data.subtotal + (data.showDiscount ? data.discountAmount : 0))}</span></div>
          ${discountRow}
          ${vatRow}
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:${tpl.theme.primary};margin-top:6px;"><span>TOTAL</span><span>${fmt(data.total)}</span></div>
          ${data.amountPaid != null && data.amountPaid > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#107C10;margin-top:4px;font-weight:700;"><span>${isSw ? 'Imelipwa' : 'Paid'}</span><span>${fmt(data.amountPaid)}</span></div>` : ''}
          ${data.balanceDue != null && data.balanceDue > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#D13438;margin-top:4px;font-weight:700;"><span>${isSw ? 'Deni' : 'Balance due'}</span><span>${fmt(data.balanceDue)}</span></div>` : ''}
          ${data.paymentDueDate && data.balanceDue != null && data.balanceDue > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#92400E;margin-top:4px;font-weight:700;"><span>${isSw ? 'Tarehe ya malipo' : 'Payment due'}</span><span>${esc(formatDueDateDisplay(data.paymentDueDate))}</span></div>` : ''}
        </div>
        ${notesBlock}
        ${data.hideSignature ? '' : signatureBlock(isSw)}
      </div>
      <div style="background:${tpl.theme.primary};color:#fff;font-size:8px;padding:8px 12px;text-align:center;">${esc(branding.footerText)}</div>
    </div>`;
}

export function samplePreviewData(documentType: DocumentRenderData['documentType']): DocumentRenderData {
  return {
    documentType,
    documentNumber: documentType === 'invoice' ? 'INV-2026-0042' : documentType === 'delivery_note' ? 'DN-2026-0188' : 'ON-2026-0091',
    date: new Date().toLocaleDateString('en-GB'),
    customerName: 'Fatuma Hassan',
    customerAddress: 'Kariakoo, Dar es Salaam',
    items: [
      { description: 'Paracetamol 500mg x100', quantity: 2, unitPrice: 8500, discountPercent: 5 },
      { description: 'Amoxicillin 250mg', quantity: 1, unitPrice: 12000 },
      { description: 'Vitamin C 1000mg', quantity: 3, unitPrice: 4500 },
    ],
    subtotal: 45200,
    discountAmount: 850,
    vatAmount: 7971,
    total: 53171,
    showDiscount: true,
    notes: 'Deliver before 5 PM. Call on arrival.',
  };
}

/** Open browser print dialog to save or print a full-size document. */
export function printDocument(
  tpl: DocumentTemplate,
  data: DocumentRenderData,
  branding: DocumentBranding,
  isSw: boolean,
): boolean {
  return downloadDocumentPdf(tpl, data, branding, isSw);
}

/** Open print dialog for arbitrary HTML content (reports, labels, etc.). */
export function printHtmlPage(title: string, bodyHtml: string, isSw: boolean): boolean {
  const landscape = /data-orientation=["']landscape["']/.test(bodyHtml);
  const pageSize = landscape ? 'A4 landscape' : 'A4';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page{size:${pageSize};margin:8mm}
html,body{margin:0;padding:0;background:#E8EAEE}
body{padding:12px;font-family:'Segoe UI',system-ui,sans-serif;color:#111}
.duka-report-paper{box-shadow:none!important;border:none!important;margin:0 auto!important}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #E5E7EB;padding:5px 6px;font-size:10px;text-align:left;vertical-align:top}
th{background:#F3F4F6;font-weight:700}
.no-print-hint{margin:0 auto 10px;max-width:900px;padding:8px 12px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;font-size:12px;color:#1E3A8A}
@media print{
  body{background:#fff;padding:0}
  .no-print,.no-print-hint{display:none!important}
  .duka-report-paper{width:100%!important;max-width:none!important;padding:0!important}
}
</style>
</head><body>
<div class="no-print-hint">${isSw
  ? 'Chapisha au chagua <strong>Save as PDF</strong> / Hifadhi kama PDF kwenye dirisha la print.'
  : 'Print or choose <strong>Save as PDF</strong> in the print dialog to download this Odoo-style paper report.'}</div>
${bodyHtml}<script>
window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 280); });
</script></body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    alert(isSw ? 'Ruhusu dirisha jipya ili kuchapisha / kupakua PDF.' : 'Allow pop-ups to print / download PDF.');
    return false;
  }
  const cleanup = () => URL.revokeObjectURL(url);
  win.addEventListener('load', cleanup, { once: true });
  setTimeout(cleanup, 120_000);
  return true;
}

/** Open browser print dialog to save or print a full-size document PDF. */
export function downloadDocumentPdf(
  tpl: DocumentTemplate,
  data: DocumentRenderData,
  branding: DocumentBranding,
  isSw: boolean,
): boolean {
  const body = renderDocumentPreviewHtml(tpl, data, branding, isSw)
    .replace('transform:scale(.92);transform-origin:top center;', '');
  const title = data.titleOverride ?? documentTypeLabel(data.documentType, isSw);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{margin:12mm}body{margin:0;padding:16px;font-family:Segoe UI,system-ui,sans-serif;background:#fff}</style>
</head><body>${body}<script>
window.addEventListener('load', function () {
  setTimeout(function () { window.print(); }, 250);
});
</script></body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');

  if (!win) {
    URL.revokeObjectURL(url);
    alert(isSw ? 'Ruhusu dirisha jipya ili kuchapisha hati.' : 'Allow pop-ups to print the document.');
    return false;
  }

  const cleanup = () => URL.revokeObjectURL(url);
  win.addEventListener('load', cleanup, { once: true });
  setTimeout(cleanup, 120_000);
  return true;
}
