/**
 * reportGenerator.ts
 *
 * Generates professional branded PDF reports matching the template:
 *   - Gradient header with chart icons, report title & subtitle
 *   - Provider profile block (business name, contact, TIN, branch)
 *   - White content area (data table / KPI summary)
 *   - Mini chart-stat strip
 *   - Dark footer: "Prepared for: Client | Date | Prepared by: Company"
 *
 * Uses: jsPDF + jspdf-autotable (no canvas, no server, pure client-side)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Colour palette matching the template image ────────────────────────────
const C = {
  headerTop:    [12,  48,  120] as [number, number, number],   // #0C3078 deep navy
  headerMid:    [0,  120,  212] as [number, number, number],   // #0078D4 Microsoft blue
  headerRight:  [220, 90,  20]  as [number, number, number],   // #DC5A14 orange
  accent:       [0,  120,  212] as [number, number, number],
  white:        [255, 255, 255] as [number, number, number],
  offWhite:     [245, 247, 252] as [number, number, number],
  footerBg:     [28,  34,  50]  as [number, number, number],   // #1C2232 dark navy
  footerText:   [180, 190, 210] as [number, number, number],
  footerBold:   [255, 255, 255] as [number, number, number],
  tableBorder:  [220, 225, 235] as [number, number, number],
  tableHeader:  [0,  120,  212] as [number, number, number],
  tableRowAlt:  [242, 246, 255] as [number, number, number],
  text:         [30,  40,  60]  as [number, number, number],
  textMuted:    [100, 115, 140] as [number, number, number],
  green:        [16,  124, 16]  as [number, number, number],
  kpiBlue:      [0,  120,  212] as [number, number, number],
  kpiGreen:     [16,  124, 16]  as [number, number, number],
  kpiOrange:    [200, 90,  10]  as [number, number, number],
  kpiPurple:    [98,  100, 167] as [number, number, number],
};

// ─── Types ─────────────────────────────────────────────────────────────────
export interface ProviderProfile {
  businessName: string;
  ownerName:    string;
  email:        string;
  phone?:       string;
  location?:    string;
  tinNumber?:   string;
  branch?:      string;
  plan?:        string;
  businessType?: string;
}

export interface ClientInfo {
  name:  string;
  email?: string;
  phone?: string;
}

export interface KpiItem {
  label: string;
  value: string;
  color?: 'blue' | 'green' | 'orange' | 'purple';
}

export interface TableRow {
  [key: string]: string | number;
}

export interface ReportOptions {
  title:     string;
  subtitle?: string;
  provider:  ProviderProfile;
  client?:   ClientInfo;
  kpis?:     KpiItem[];
  tableHeaders?: string[];
  tableRows?:    string[][];
  notes?:        string;
  language?:     'en' | 'sw';
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function hex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function setFill(doc: jsPDF, rgb: [number,number,number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setTextColor(doc: jsPDF, rgb: [number,number,number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDrawColor(doc: jsPDF, rgb: [number,number,number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

// Draw a multi-stop horizontal gradient by rendering thin vertical strips
function drawGradientRect(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  from: [number,number,number],
  to:   [number,number,number],
  steps = 80,
) {
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x + i * sw, y, sw + 0.5, h, 'F');
  }
}

// Draw a wave / diagonal separator under the header
function drawWaveSeparator(doc: jsPDF, y: number, w: number) {
  setFill(doc, C.offWhite);
  doc.ellipse(w * 0.5, y + 6, w * 0.65, 12, 'F');
}

// Draw a decorative semi-transparent circle (chart icon stand-in)
function drawChartCircle(doc: jsPDF, cx: number, cy: number, r: number, color: [number,number,number]) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
  doc.circle(cx, cy, r, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
}

// ─── Main export function ──────────────────────────────────────────────────
export function generateReport(opts: ReportOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const isSw = opts.language === 'sw';

  const now  = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month: 'short', year: 'numeric' });

  // ── 1. Gradient header (top ~65 mm) ─────────────────────────────────────
  const headerH = 65;
  drawGradientRect(doc, 0, 0, W, headerH, C.headerTop, C.headerRight);

  // Decorative circles (stand-in for chart icons like in the template)
  drawChartCircle(doc, 28,  22, 20, C.white);
  drawChartCircle(doc, 180, 18, 24, C.headerRight);
  drawChartCircle(doc, 168, 28, 14, C.white);

  // Mini bar-chart icon (left)
  setFill(doc, [255, 200, 60]);
  doc.rect(12, 14, 3, 10, 'F');
  setFill(doc, [60, 180, 80]);
  doc.rect(17, 10, 3, 14, 'F');
  setFill(doc, [0, 140, 220]);
  doc.rect(22, 7,  3, 17, 'F');

  // Mini pie-chart arc (right)
  setFill(doc, [0, 140, 220]);
  doc.circle(182, 22, 9, 'F');
  setFill(doc, C.headerRight);
  doc.triangle(182, 22, 182+9, 22, 182, 22-9, 'F');

  // Arrow up icon (left)
  setFill(doc, C.white);
  doc.setGState(new (doc as any).GState({ opacity: 0.9 }));
  doc.lines([[4,6],[4,-6],[-8,0]], 14, 28, [1, 1], 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Report title — large bold white text
  setTextColor(doc, C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(opts.title.toUpperCase(), W / 2, 42, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setGState(new (doc as any).GState({ opacity: 0.88 }));
  doc.text(opts.subtitle || (isSw ? 'Ripoti ya Biashara — Duka+' : 'Business Report — Duka+'), W / 2, 52, { align: 'center' });
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Wave underline
  drawWaveSeparator(doc, headerH - 4, W);

  // ── 2. Provider profile block ────────────────────────────────────────────
  let y = headerH + 10;
  const px = 14, pw = W - 28;

  setFill(doc, C.offWhite);
  setDrawColor(doc, C.tableBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(px, y, pw, 38, 3, 3, 'FD');

  // Left column — business info
  const lx = px + 6;
  setTextColor(doc, C.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(opts.provider.businessName, lx, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setTextColor(doc, C.textMuted);

  const bizTypeLabel = opts.provider.businessType
    ? `${isSw ? 'Aina ya Biashara' : 'Business Type'}: ${opts.provider.businessType}`
    : '';
  const provLines = [
    `${isSw ? 'Mmiliki' : 'Owner'}: ${opts.provider.ownerName}`,
    `${isSw ? 'Barua pepe' : 'Email'}: ${opts.provider.email}`,
    opts.provider.phone    ? `${isSw ? 'Simu' : 'Phone'}: ${opts.provider.phone}` : '',
    opts.provider.tinNumber ? `TIN: ${opts.provider.tinNumber}` : '',
  ].filter(Boolean);

  provLines.forEach((line, i) => {
    doc.text(line, lx, y + 16 + i * 5.5);
  });

  // Right column — branch / plan / type
  const rx = W / 2 + 4;
  setTextColor(doc, C.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(isSw ? 'Taarifa za Ziada' : 'Additional Info', rx, y + 8);
  doc.setFont('helvetica', 'normal');
  setTextColor(doc, C.textMuted);
  const rightLines = [
    opts.provider.branch   ? `${isSw ? 'Tawi' : 'Branch'}: ${opts.provider.branch}` : '',
    opts.provider.location ? `${isSw ? 'Mahali' : 'Location'}: ${opts.provider.location}` : '',
    opts.provider.plan     ? `${isSw ? 'Mpango' : 'Plan'}: ${opts.provider.plan}` : '',
    bizTypeLabel,
  ].filter(Boolean);
  rightLines.forEach((line, i) => {
    doc.text(line, rx, y + 16 + i * 5.5);
  });

  // "Powered by Duka+" badge top-right
  setFill(doc, C.accent);
  doc.roundedRect(W - px - 34, y + 2, 32, 8, 2, 2, 'F');
  setTextColor(doc, C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Powered by Duka+', W - px - 18, y + 7.2, { align: 'center' });

  y += 46;

  // ── 3. KPI summary strip ─────────────────────────────────────────────────
  if (opts.kpis && opts.kpis.length > 0) {
    const kpiColors: Record<string, [number,number,number]> = {
      blue:   C.kpiBlue,
      green:  C.kpiGreen,
      orange: C.kpiOrange,
      purple: C.kpiPurple,
    };

    const kpis  = opts.kpis.slice(0, 4);
    const kpiW  = (pw - (kpis.length - 1) * 4) / kpis.length;

    kpis.forEach((kpi, i) => {
      const kx = px + i * (kpiW + 4);
      const color = kpiColors[kpi.color || 'blue'];

      setFill(doc, C.white);
      setDrawColor(doc, color);
      doc.setLineWidth(0.5);
      doc.roundedRect(kx, y, kpiW, 22, 3, 3, 'FD');

      // Top accent bar
      setFill(doc, color);
      doc.roundedRect(kx, y, kpiW, 3, 3, 3, 'F');
      doc.rect(kx, y + 1.5, kpiW, 1.5, 'F');

      setTextColor(doc, color);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(kpi.value, kx + kpiW / 2, y + 13, { align: 'center' });

      setTextColor(doc, C.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(kpi.label, kx + kpiW / 2, y + 19, { align: 'center' });
    });

    y += 30;
  }

  // ── 4. Content area — white card with subtle border ──────────────────────
  const contentH = opts.tableRows && opts.tableRows.length > 0
    ? Math.min(opts.tableRows.length * 8 + 28, 130)
    : 60;

  setFill(doc, C.white);
  setDrawColor(doc, C.tableBorder);
  doc.setLineWidth(0.4);
  doc.roundedRect(px, y, pw, contentH, 3, 3, 'FD');

  if (opts.tableHeaders && opts.tableRows && opts.tableRows.length > 0) {
    // autoTable renders the data table
    autoTable(doc, {
      startY: y + 2,
      margin: { left: px + 2, right: px + 2 },
      head: [opts.tableHeaders],
      body: opts.tableRows,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 40, 60],
        lineColor: C.tableBorder,
        lineWidth: 0.2,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: C.tableHeader,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: {
        fillColor: C.tableRowAlt,
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
      },
      tableLineColor: C.tableBorder,
      tableLineWidth: 0.3,
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    // Placeholder "Your Content Here" text when no table rows
    setTextColor(doc, [190, 200, 220]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(
      isSw ? 'Maudhui Yako Hapa' : 'Your Content Here',
      W / 2, y + contentH / 2,
      { align: 'center' }
    );
    y += contentH + 6;
  }

  // ── 5. Mini chart-stat decorative strip ─────────────────────────────────
  const stripY = y;
  const stripH = 28;
  const stripW = pw;

  setFill(doc, C.offWhite);
  setDrawColor(doc, C.tableBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(px, stripY, stripW, stripH, 3, 3, 'FD');

  // Left: tiny line chart
  const lcx = px + 4, lcy = stripY + 6;
  const pts = [0,8,4,4,8,10,12,3,16,7,20,2];
  doc.setDrawColor(0, 120, 212);
  doc.setLineWidth(0.8);
  for (let i = 0; i < pts.length - 2; i += 2) {
    doc.line(lcx + pts[i], lcy + pts[i+1], lcx + pts[i+2], lcy + pts[i+3]);
  }
  // Dots
  setFill(doc, C.kpiBlue);
  for (let i = 0; i < pts.length; i += 2) {
    doc.circle(lcx + pts[i], lcy + pts[i+1], 0.8, 'F');
  }

  // Centre: pie (3 arc segments)
  const pcx = px + stripW / 2, pcy = stripY + stripH / 2;
  const pr = 10;
  [[C.kpiBlue, 0, 2.2], [C.kpiOrange, 2.2, 4.2], [C.kpiGreen, 4.2, 5.5],
   [[100,160,240] as [number,number,number], 5.5, 2*Math.PI]].forEach(([col, s, e]) => {
    setFill(doc, col as [number,number,number]);
    doc.setDrawColor(255,255,255);
    doc.setLineWidth(0.5);
    doc.ellipse(pcx, pcy, pr * 0.9, pr * 0.9, 'F');
  });
  // Simple pie via filled triangles (jsPDF has no arc fill natively)
  const pieCols: [number,number,number][] = [C.kpiBlue, C.kpiOrange, C.kpiGreen, [100,160,240]];
  const pieSlices = [0.35, 0.25, 0.22, 0.18];
  let angle = -Math.PI / 2;
  pieSlices.forEach((slice, si) => {
    const endAngle = angle + slice * 2 * Math.PI;
    setFill(doc, pieCols[si % pieCols.length]);
    // Draw as a polygon approximation
    const steps = Math.max(4, Math.round(slice * 20));
    const polyX = [pcx];
    const polyY = [pcy];
    for (let s2 = 0; s2 <= steps; s2++) {
      const a = angle + (s2 / steps) * (endAngle - angle);
      polyX.push(pcx + Math.cos(a) * pr);
      polyY.push(pcy + Math.sin(a) * pr);
    }
    doc.setFillColor(pieCols[si % pieCols.length][0], pieCols[si % pieCols.length][1], pieCols[si % pieCols.length][2]);
    // Draw using lines
    const lineArr: [number,number][] = polyX.map((px2, idx) => [px2, polyY[idx]]);
    doc.setDrawColor(255,255,255);
    doc.setLineWidth(0.4);
    for (let li = 1; li < lineArr.length - 1; li++) {
      doc.triangle(pcx, pcy, lineArr[li][0], lineArr[li][1], lineArr[li+1][0], lineArr[li+1][1], 'F');
    }
    angle = endAngle;
  });

  // Right: bar chart
  const bcx = px + stripW - 44, bcy = stripY + 22;
  const bars = [[C.kpiBlue,5,14],[C.kpiOrange,9,10],[C.kpiGreen,13,18],[C.kpiBlue,17,8]] as [number,number,number][][];
  bars.forEach(([col, bx, bh]) => {
    setFill(doc, col as [number,number,number]);
    doc.rect(bcx + (bx as number)*2, bcy - (bh as number), 5, bh as number, 'F');
  });

  y += stripH + 6;

  // ── 6. Notes block (optional) ─────────────────────────────────────────────
  if (opts.notes) {
    setFill(doc, [255, 252, 240]);
    setDrawColor(doc, [240, 200, 80]);
    doc.setLineWidth(0.4);
    doc.roundedRect(px, y, pw, 18, 3, 3, 'FD');
    setTextColor(doc, C.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(isSw ? 'Maelezo:' : 'Notes:', px + 4, y + 7);
    doc.setFont('helvetica', 'normal');
    setTextColor(doc, C.textMuted);
    doc.text(opts.notes, px + 4, y + 13, { maxWidth: pw - 8 });
    y += 24;
  }

  // ── 7. Footer ─────────────────────────────────────────────────────────────
  const footerH = 18;
  const fy = H - footerH;

  setFill(doc, C.footerBg);
  doc.rect(0, fy, W, footerH, 'F');

  // Thin accent line above footer
  setFill(doc, C.accent);
  doc.rect(0, fy, W, 1.2, 'F');

  // Footer left: "Prepared for: ClientName"
  const clientName = opts.client?.name || (isSw ? 'Mteja' : 'Client');
  setTextColor(doc, C.footerText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    isSw ? `Imetayarishwa kwa: ` : `Prepared for: `,
    14, fy + 7
  );
  const leftLabelW = doc.getTextWidth(isSw ? `Imetayarishwa kwa: ` : `Prepared for: `);
  setTextColor(doc, C.footerBold);
  doc.setFont('helvetica', 'bold');
  doc.text(clientName, 14 + leftLabelW, fy + 7);

  // Footer centre: Date
  setTextColor(doc, C.footerText);
  doc.setFont('helvetica', 'normal');
  doc.text(`${isSw ? 'Tarehe' : 'Date'}: `, W / 2 - 16, fy + 7, { align: 'right' });
  setTextColor(doc, C.footerBold);
  doc.setFont('helvetica', 'bold');
  doc.text(dateStr, W / 2 + 6, fy + 7, { align: 'center' });

  // Footer right: "Prepared by: Company"
  const companyName = opts.provider.businessName;
  setTextColor(doc, C.footerText);
  doc.setFont('helvetica', 'normal');
  doc.text(isSw ? `Imetayarishwa na: ` : `Prepared by: `, W - 14, fy + 7, { align: 'right' });
  const rightLabelW = doc.getTextWidth(isSw ? `Imetayarishwa na: ` : `Prepared by: `);
  setTextColor(doc, C.footerBold);
  doc.setFont('helvetica', 'bold');
  // Position right-side bold name
  const rightBase = W - 14 - rightLabelW;
  doc.text(companyName, rightBase, fy + 7, { align: 'right' });

  // Footer second line — dividers + subtle text
  setTextColor(doc, C.footerText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    [
      opts.provider.email,
      opts.provider.phone,
      opts.provider.tinNumber ? `TIN: ${opts.provider.tinNumber}` : '',
    ].filter(Boolean).join('  |  '),
    W / 2, fy + 13,
    { align: 'center' }
  );

  // ── 8. Watermark page number ───────────────────────────────────────────────
  setTextColor(doc, [190, 200, 215]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Page 1  ·  Generated by Duka+ Business Management`, W / 2, H - 3, { align: 'center' });

  // ── Save ──────────────────────────────────────────────────────────────────
  const slug = opts.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
  doc.save(`DukaPlus_${slug}_${now.toISOString().slice(0,10)}.pdf`);
}

// ─── Convenience wrappers ──────────────────────────────────────────────────

export function exportSalesReport(opts: {
  provider:  ProviderProfile;
  sales:     Array<{ receipt: string; customer: string; date: string; method: string; vat: string; total: string }>;
  totalGross: string;
  totalVat:   string;
  grossProfit: string;
  client?:    ClientInfo;
  language?:  'en' | 'sw';
}) {
  const isSw = opts.language === 'sw';
  generateReport({
    title:    isSw ? 'RIPOTI YA MAUZO NA KODI YA TRA' : 'SALES & TRA TAX AUDIT REPORT',
    subtitle: isSw
      ? 'Muhtasari wa Mauzo, VAT (18%) na Matokeo ya Kifedha'
      : 'Sales Summary, VAT (18%) Remittance & Financial Overview',
    provider: opts.provider,
    client:   opts.client,
    language: opts.language,
    kpis: [
      { label: isSw ? 'Jumla ya Mauzo' : 'Gross Sales',     value: opts.totalGross,  color: 'blue'   },
      { label: isSw ? 'VAT (18%) TRA'  : 'TRA VAT (18%)',   value: opts.totalVat,    color: 'orange' },
      { label: isSw ? 'Faida Jumla'    : 'Gross Profit',    value: opts.grossProfit, color: 'green'  },
      { label: isSw ? 'Miamala'        : 'Transactions',    value: `${opts.sales.length}`, color: 'purple' },
    ],
    tableHeaders: isSw
      ? ['Risiti #', 'Mteja', 'Tarehe', 'Njia ya Malipo', 'VAT (18%)', 'Jumla']
      : ['Receipt #', 'Customer', 'Date', 'Payment Method', 'VAT (18%)', 'Total'],
    tableRows: opts.sales.map(s => [s.receipt, s.customer, s.date, s.method, s.vat, s.total]),
    notes: isSw
      ? 'Ripoti hii imetolewa kiotomatiki na Duka+. Thamani zote zimejumuisha VAT ya TRA 18%.'
      : 'This report was auto-generated by Duka+. All values include TRA 18% VAT.',
  });
}

export function exportInventoryReport(opts: {
  provider:  ProviderProfile;
  products:  Array<{ name: string; sku: string; category: string; stock: string; cost: string; value: string }>;
  totalValue: string;
  lowStockCount: number;
  client?:    ClientInfo;
  language?:  'en' | 'sw';
}) {
  const isSw = opts.language === 'sw';
  generateReport({
    title:    isSw ? 'THAMANI YA STOO & UKAGUZI' : 'STOCK VALUATION & INVENTORY AUDIT',
    subtitle: isSw
      ? 'Orodha kamili ya bidhaa, gharama na thamani ya stoo'
      : 'Complete product listing with cost basis and stock value',
    provider: opts.provider,
    client:   opts.client,
    language: opts.language,
    kpis: [
      { label: isSw ? 'Thamani ya Stoo' : 'Stock Value',     value: opts.totalValue,           color: 'blue'   },
      { label: isSw ? 'Bidhaa Zote'     : 'Total Products',  value: `${opts.products.length}`, color: 'green'  },
      { label: isSw ? 'Stoo Chini'      : 'Low Stock Items', value: `${opts.lowStockCount}`,   color: 'orange' },
    ],
    tableHeaders: isSw
      ? ['Bidhaa', 'SKU', 'Kategoria', 'Stoo', 'Gharama', 'Thamani Jumla']
      : ['Product', 'SKU', 'Category', 'Stock', 'Unit Cost', 'Total Value'],
    tableRows: opts.products.map(p => [p.name, p.sku, p.category, p.stock, p.cost, p.value]),
    notes: isSw
      ? 'Ripoti ya ukaguzi wa stoo iliyotolewa na Duka+. Gharama zinajumuisha bidhaa za stoo ya sasa.'
      : 'Inventory audit report generated by Duka+. Costs reflect current on-hand stock.',
  });
}

export function exportProcurementReport(opts: {
  provider:   ProviderProfile;
  orders:     Array<{ poNumber: string; supplier: string; date: string; status: string; items: string; total: string }>;
  totalValue: string;
  client?:    ClientInfo;
  language?:  'en' | 'sw';
}) {
  const isSw = opts.language === 'sw';
  generateReport({
    title:    isSw ? 'DAFTARI LA UNUNUZI & STOO INAYOINGIA' : 'PROCUREMENT & INWARD STOCK LEDGER',
    subtitle: isSw
      ? 'Maagizo ya Ununuzi, Wasambazaji na Ugawaji wa Stoo'
      : 'Purchase Orders, Supplier Invoices & Stock Inward Records',
    provider: opts.provider,
    client:   opts.client,
    language: opts.language,
    kpis: [
      { label: isSw ? 'Thamani Jumla'  : 'Total Value',    value: opts.totalValue,          color: 'blue'   },
      { label: isSw ? 'Maagizo'        : 'Orders',         value: `${opts.orders.length}`,  color: 'green'  },
    ],
    tableHeaders: isSw
      ? ['Namba ya PO', 'Msambazaji', 'Tarehe', 'Hali', 'Bidhaa', 'Jumla']
      : ['PO Number', 'Supplier', 'Date', 'Status', 'Items', 'Total'],
    tableRows: opts.orders.map(o => [o.poNumber, o.supplier, o.date, o.status, o.items, o.total]),
  });
}

export function exportCustomerLedger(opts: {
  provider:   ProviderProfile;
  customers:  Array<{ name: string; phone: string; purchases: string; balance: string; lastSeen: string }>;
  totalReceivables: string;
  client?:    ClientInfo;
  language?:  'en' | 'sw';
}) {
  const isSw = opts.language === 'sw';
  generateReport({
    title:    isSw ? 'DAFTARI LA WATEJA & MADENI' : 'CUSTOMER LEDGER & RECEIVABLES',
    subtitle: isSw
      ? 'Historia ya Wateja, Manunuzi na Salio la Mikopo'
      : 'Customer History, Purchase Records & Outstanding Balances',
    provider: opts.provider,
    client:   opts.client,
    language: opts.language,
    kpis: [
      { label: isSw ? 'Madeni Jumla'  : 'Total Receivables', value: opts.totalReceivables,       color: 'orange' },
      { label: isSw ? 'Wateja Wote'   : 'Total Customers',   value: `${opts.customers.length}`,  color: 'blue'   },
    ],
    tableHeaders: isSw
      ? ['Jina', 'Simu', 'Manunuzi', 'Salio la Deni', 'Mwisho Kuonana']
      : ['Name', 'Phone', 'Purchases', 'Balance Owed', 'Last Seen'],
    tableRows: opts.customers.map(c => [c.name, c.phone, c.purchases, c.balance, c.lastSeen]),
  });
}
