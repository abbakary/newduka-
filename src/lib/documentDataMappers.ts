import type { PurchaseOrder, SalaryPayrollRecord, SaleTransaction } from '@/types/v1';
import type { DocumentRenderData } from './documentTemplates';
import { saleToDocumentRenderData } from './saleDocumentMapper';

interface SettlementVoucherLike {
  voucherNumber: string;
  date: string;
  partyName: string;
  partyType: string;
  paymentMethod: string;
  referenceNumber: string;
  amountPaid: number;
  balanceBefore: number;
  balanceAfter: number;
  cashierName: string;
  type: 'customer_receipt' | 'supplier_voucher';
  notes?: string;
}

function fmtDate(raw: string): string {
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB');
}

/** Goods Received Note from a purchase order. */
export function poToGrnRenderData(po: PurchaseOrder, isSw: boolean): DocumentRenderData {
  const subtotal = po.subtotal || po.items.reduce((s, it) => s + (it.total || it.costPrice * it.quantity), 0);
  const notes = [
    po.paymentTerms ? `${isSw ? 'Masharti ya malipo' : 'Payment terms'}: ${po.paymentTerms}` : '',
    `${isSw ? 'Hali' : 'Status'}: ${po.status.toUpperCase()}`,
    po.receivedDate ? `${isSw ? 'Ilipokelewa' : 'Received'}: ${po.receivedDate}` : '',
    po.notes ?? '',
  ].filter(Boolean).join('\n');

  return {
    documentType: 'delivery_note',
    titleOverride: isSw ? 'Noti ya Bidhaa Zilizopokelewa' : 'Goods Received Note',
    documentNumber: `GRN-${po.poNumber}`,
    date: fmtDate(po.receivedDate || po.dateCreated),
    customerName: po.supplierName,
    partyLabel: isSw ? 'Msambazaji' : 'Supplier',
    priceColumnLabel: isSw ? 'Gharama' : 'Cost',
    hideVat: !po.vatAmount,
    hideSignature: false,
    items: po.items.map(it => ({
      description: it.productName,
      quantity: it.quantity,
      unit: it.unit || 'pcs',
      unitPrice: it.costPrice,
    })),
    subtotal,
    discountAmount: 0,
    vatAmount: po.vatAmount ?? 0,
    total: po.totalAmount || subtotal,
    showDiscount: false,
    notes: notes || undefined,
  };
}

/** Purchase order sent to supplier. */
export function poToOrderNoteRenderData(po: PurchaseOrder, isSw: boolean): DocumentRenderData {
  const subtotal = po.subtotal || po.items.reduce((s, it) => s + (it.total || it.costPrice * it.quantity), 0);
  return {
    documentType: 'order_note',
    titleOverride: isSw ? 'Agizo la Ununuzi' : 'Purchase Order',
    documentNumber: po.poNumber,
    date: fmtDate(po.dateCreated),
    customerName: po.supplierName,
    partyLabel: isSw ? 'Msambazaji' : 'Supplier',
    priceColumnLabel: isSw ? 'Gharama' : 'Cost',
    hideVat: !po.vatAmount,
    items: po.items.map(it => ({
      description: it.productName,
      quantity: it.quantity,
      unit: it.unit || 'pcs',
      unitPrice: it.costPrice,
    })),
    subtotal,
    discountAmount: 0,
    vatAmount: po.vatAmount ?? 0,
    total: po.totalAmount || subtotal,
    showDiscount: false,
    notes: [
      po.expectedDate ? `${isSw ? 'Tarehe inayotarajiwa' : 'Expected date'}: ${po.expectedDate}` : '',
      po.paymentTerms ? `${isSw ? 'Masharti' : 'Terms'}: ${po.paymentTerms}` : '',
      po.notes ?? '',
    ].filter(Boolean).join('\n') || undefined,
  };
}

export function settlementToRenderData(v: SettlementVoucherLike, isSw: boolean): DocumentRenderData {
  const isCustomer = v.type === 'customer_receipt';
  return {
    documentType: 'invoice',
    titleOverride: isSw ? 'Hati ya Malipo' : 'Payment Voucher',
    documentNumber: v.voucherNumber,
    date: fmtDate(v.date),
    customerName: v.partyName,
    partyLabel: isCustomer ? (isSw ? 'Mteja' : 'Customer') : (isSw ? 'Msambazaji' : 'Supplier'),
    hideVat: true,
    hideSignature: true,
    items: [{
      description: isSw
        ? `Malipo — Rejea: ${v.referenceNumber}`
        : `Payment — Ref: ${v.referenceNumber}`,
      quantity: 1,
      unitPrice: v.amountPaid,
    }],
    subtotal: v.amountPaid,
    discountAmount: 0,
    vatAmount: 0,
    total: v.amountPaid,
    showDiscount: false,
    notes: [
      `${isSw ? 'Aina' : 'Party type'}: ${v.partyType}`,
      `${isSw ? 'Njia ya malipo' : 'Payment method'}: ${v.paymentMethod}`,
      `${isSw ? 'Salio kabla' : 'Balance before'}: TSh ${v.balanceBefore.toLocaleString('en-TZ')}`,
      `${isSw ? 'Kiasi kilicholipwa' : 'Amount paid'}: TSh ${v.amountPaid.toLocaleString('en-TZ')}`,
      `${isSw ? 'Salio baada' : 'Balance after'}: TSh ${v.balanceAfter.toLocaleString('en-TZ')}`,
      `${isSw ? 'Imetolewa na' : 'Issued by'}: ${v.cashierName}`,
      v.notes ?? '',
    ].filter(Boolean).join('\n'),
  };
}

export function payslipToRenderData(p: SalaryPayrollRecord, isSw: boolean): DocumentRenderData {
  const deductions = p.advancesDeducted + p.statutoryDeductions;
  const gross = p.baseSalary + p.performanceBonus + p.totalDailyAllowancesPaid;
  const items = [
    { description: isSw ? 'Mshahara msingi' : 'Basic salary', quantity: 1, unitPrice: p.baseSalary },
  ];
  if (p.performanceBonus > 0) {
    items.push({
      description: isSw ? 'Bonus ya utendaji' : 'Performance bonus',
      quantity: 1,
      unitPrice: p.performanceBonus,
    });
  }
  if (p.totalDailyAllowancesPaid > 0) {
    items.push({
      description: isSw ? 'Posho za siku' : 'Daily allowances',
      quantity: 1,
      unitPrice: p.totalDailyAllowancesPaid,
    });
  }

  return {
    documentType: 'invoice',
    titleOverride: isSw ? 'Slipi ya Mshahara' : 'Payslip',
    documentNumber: p.payslipNumber,
    date: fmtDate(p.paymentDate || new Date().toISOString()),
    customerName: p.staffName,
    partyLabel: isSw ? 'Mfanyakazi' : 'Employee',
    customerAddress: p.staffRole,
    priceColumnLabel: isSw ? 'Kiasi' : 'Amount',
    hideVat: true,
    hideSignature: true,
    items,
    subtotal: gross,
    discountAmount: deductions,
    showDiscount: deductions > 0,
    discountLabel: isSw ? 'Makato' : 'Deductions',
    vatAmount: 0,
    total: p.netPayable,
    notes: [
      `${isSw ? 'Mwezi' : 'Period'}: ${p.monthYear}`,
      p.paymentMethod ? `${isSw ? 'Njia' : 'Method'}: ${p.paymentMethod}` : '',
      p.paymentReference ? `${isSw ? 'Rejea' : 'Reference'}: ${p.paymentReference}` : '',
      p.notes ?? '',
    ].filter(Boolean).join('\n') || undefined,
  };
}

export function saleReceiptRenderData(
  sale: SaleTransaction,
  isSw: boolean,
  options?: { showDiscount?: boolean },
): DocumentRenderData {
  const data = saleToDocumentRenderData(sale, 'invoice', { ...options, isSw });
  return {
    ...data,
    titleOverride: isSw ? 'Risiti ya Mauzo' : 'Sales Receipt',
    hideSignature: true,
  };
}

export interface MatrixReportRow {
  productName: string;
  productCategory: string;
  customerName: string;
  customerLocation: string;
  unitsBought: number;
  totalSpent: number;
}

export function matrixReportHtml(
  rows: MatrixReportRow[],
  businessName: string,
  isSw: boolean,
): string {
  const title = isSw ? 'Ripoti ya Jedwali la Mauzo' : 'Sales Matrix Report';
  const head = rows.map(r => `<tr>
    <td>${escHtml(r.productName)}</td>
    <td>${escHtml(r.productCategory)}</td>
    <td>${escHtml(r.customerName)}</td>
    <td>${escHtml(r.customerLocation)}</td>
    <td style="text-align:right">${r.unitsBought}</td>
    <td style="text-align:right">TSh ${r.totalSpent.toLocaleString('en-TZ')}</td>
  </tr>`).join('');

  return `
    <h1 style="font-size:18px;margin:0 0 4px">${title}</h1>
    <p style="font-size:11px;color:#6B7280;margin:0 0 12px">${escHtml(businessName)} • ${new Date().toLocaleDateString('en-GB')}</p>
    <table>
      <thead><tr>
        <th>${isSw ? 'Bidhaa' : 'Product'}</th>
        <th>${isSw ? 'Kategoria' : 'Category'}</th>
        <th>${isSw ? 'Mteja' : 'Customer'}</th>
        <th>${isSw ? 'Eneo' : 'Location'}</th>
        <th style="text-align:right">${isSw ? 'Vipande' : 'Units'}</th>
        <th style="text-align:right">${isSw ? 'Jumla' : 'Total'}</th>
      </tr></thead>
      <tbody>${head || `<tr><td colspan="6">${isSw ? 'Hakuna data' : 'No data'}</td></tr>`}</tbody>
    </table>`;
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function qrLabelsPrintHtml(
  labels: { name: string; sku: string; price: number; qrDataUrl: string }[],
  isSw: boolean,
): string {
  const cards = labels.map(l => `
    <div style="display:inline-block;width:48%;margin:1%;padding:10px;border:1px dashed #CBD5E1;border-radius:8px;text-align:center;vertical-align:top;page-break-inside:avoid">
      <img src="${l.qrDataUrl}" alt="QR" style="width:120px;height:120px;object-fit:contain" />
      <div style="font-size:12px;font-weight:800;margin-top:6px">${escHtml(l.name)}</div>
      <div style="font-size:10px;color:#64748B">SKU: ${escHtml(l.sku)}</div>
      <div style="font-size:11px;font-weight:700;margin-top:4px">TSh ${l.price.toLocaleString('en-TZ')}</div>
    </div>`).join('');

  return `
    <h1 style="font-size:16px;margin:0 0 12px">${isSw ? 'Lebo za QR za Bidhaa' : 'Product QR Shelf Labels'}</h1>
    <div style="font-size:0">${cards}</div>`;
}
