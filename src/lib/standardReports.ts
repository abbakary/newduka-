/**
 * Tanzania-standard commercial reports (TRA EFD / GN.389 inspired)
 * + Odoo-style inventory valuation & purchase ledgers.
 *
 * Survey basis:
 * - TRA daily gross sales: receipt #, date, buyer, qty/values, discounts,
 *   net, VAT rate/amount, gross totals (EFD Regulations).
 * - Z-report style: daily/period VAT totals by rate (A=18%, B/C/E zero/exempt).
 * - Odoo inventory valuation: on-hand qty × cost → stock value.
 * - Purchase report: PO lines with untaxed / VAT / total (input VAT trail).
 */

import type { Product, PurchaseOrder, SaleTransaction } from '@/types/v1';

export type StandardReportKind =
  | 'sales_detail'
  | 'sales_vat_summary'
  | 'inventory_valuation'
  | 'purchase_orders';

export type ReportDatePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface ReportPeriod {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface ReportCompanyInfo {
  businessName: string;
  ownerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  tinNumber?: string;
  vrn?: string;
  branch?: string;
  logoUrl?: string;
  businessType?: string;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function periodFromPreset(preset: ReportDatePreset, custom?: ReportPeriod): ReportPeriod {
  if (preset === 'custom' && custom?.from && custom?.to) return custom;
  const now = new Date();
  const to = toYmd(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === 'today') {
    /* keep today */
  } else if (preset === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else if (preset === 'month') {
    start.setDate(1);
  } else if (preset === 'quarter') {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  } else if (preset === 'year') {
    start.setMonth(0, 1);
  }
  return { from: toYmd(start), to };
}

export function saleDateKey(sale: SaleTransaction): string {
  return String(sale.date || '').slice(0, 10);
}

export function isReportableSale(sale: SaleTransaction): boolean {
  const status = String(sale.status || '').toLowerCase();
  if (['cancelled', 'voided', 'refunded', 'open'].includes(status)) return false;
  return true;
}

export function filterSalesByPeriod(
  sales: SaleTransaction[],
  period: ReportPeriod,
  opts?: { includeNonReportable?: boolean },
): SaleTransaction[] {
  return sales.filter(s => {
    if (!opts?.includeNonReportable && !isReportableSale(s)) return false;
    const d = saleDateKey(s);
    if (!d) return false;
    if (period.from && d < period.from) return false;
    if (period.to && d > period.to) return false;
    return true;
  });
}

export function filterPurchaseOrdersByPeriod(
  orders: PurchaseOrder[],
  period: ReportPeriod,
): PurchaseOrder[] {
  return orders.filter(o => {
    const d = String(o.dateCreated || o.receivedDate || '').slice(0, 10);
    if (!d) return false;
    if (period.from && d < period.from) return false;
    if (period.to && d > period.to) return false;
    return true;
  });
}

export interface SalesDetailRow {
  serial: number;
  receipt: string;
  date: string;
  time: string;
  customer: string;
  payment: string;
  cashier: string;
  itemCount: number;
  itemSummary: string;
  net: number;
  vat: number;
  discount: number;
  gross: number;
  fiscal: string;
  status: string;
}

export interface SalesVatBucket {
  code: string;
  label: string;
  ratePercent: number;
  receiptCount: number;
  net: number;
  vat: number;
  gross: number;
}

export interface SalesVatSummary {
  buckets: SalesVatBucket[];
  paymentBreakdown: Array<{ method: string; amount: number; count: number }>;
  receiptCount: number;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  totalDiscount: number;
}

export interface InventoryValuationRow {
  name: string;
  sku: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  unitPrice: number;
  stockValue: number;
  retailValue: number;
  marginPercent: number;
  reorderPoint: number;
  batchNumber: string;
  expiryDate: string;
  supplier: string;
  location: string;
  vatType: string;
  health: 'ok' | 'low' | 'critical' | 'overstock';
}

export interface PurchaseReportRow {
  poNumber: string;
  supplier: string;
  date: string;
  time: string;
  expected: string;
  receivedDate: string;
  status: string;
  itemCount: number;
  itemSummary: string;
  untaxed: number;
  vat: number;
  total: number;
  paid: number;
  paymentStatus: string;
  paymentMethod: string;
  notes: string;
}

function paymentMethod(sale: SaleTransaction): string {
  const first = sale.payments?.[0]?.method;
  if (first) return String(first).toUpperCase();
  return String(sale.type || 'CASH').toUpperCase();
}

function splitDateTime(raw: string): { date: string; time: string } {
  const s = String(raw || '').trim();
  if (!s) return { date: '—', time: '—' };
  // "2026-09-11 14:30" or ISO
  const normalized = s.replace('T', ' ');
  const date = normalized.slice(0, 10);
  const timePart = normalized.slice(11, 19).trim();
  if (timePart) return { date, time: timePart.slice(0, 5) };
  return { date, time: '—' };
}

function shortPoLabel(po: PurchaseOrder): string {
  const label = (po.poNumber || po.orderNumber || '').trim();
  if (label) return label;
  const id = String(po.id || '');
  return id.length > 12 ? `PO-${id.slice(0, 8).toUpperCase()}` : id || 'PO';
}

export function buildSalesDetailRows(sales: SaleTransaction[]): SalesDetailRow[] {
  const sorted = [...sales].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return sorted.map((s, i) => {
    const vat = Number(s.vatAmount || 0);
    const gross = Number(s.total || 0);
    const discount = Number(s.discountAmount || 0);
    const net = Math.max(0, Number(s.subtotal != null ? s.subtotal : gross - vat));
    const items = s.items || [];
    const { date, time } = splitDateTime(s.date);
    const itemSummary = items
      .slice(0, 3)
      .map(it => `${it.productName} ×${it.quantity}`)
      .join(', ')
      + (items.length > 3 ? ` +${items.length - 3}` : '');
    return {
      serial: i + 1,
      receipt: s.receiptNumber || s.id,
      date,
      time,
      customer: s.customerName || 'Walk-in',
      payment: paymentMethod(s),
      cashier: s.cashierName || '—',
      itemCount: items.length,
      itemSummary: itemSummary || '—',
      net,
      vat,
      discount,
      gross,
      fiscal: s.traEfdSignature ? 'EFD' : '—',
      status: s.status,
    };
  });
}

export function buildSalesVatSummary(sales: SaleTransaction[]): SalesVatSummary {
  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;
  let totalDiscount = 0;
  let vatReceipts = 0;
  let nonVatReceipts = 0;
  let vatNet = 0;
  let vatTax = 0;
  let vatGross = 0;
  let nonNet = 0;
  let nonGross = 0;

  const payMap = new Map<string, { amount: number; count: number }>();

  for (const s of sales) {
    const vat = Number(s.vatAmount || 0);
    const gross = Number(s.total || 0);
    const discount = Number(s.discountAmount || 0);
    const net = Math.max(0, Number(s.subtotal != null ? s.subtotal : gross - vat));
    totalNet += net;
    totalVat += vat;
    totalGross += gross;
    totalDiscount += discount;

    if (vat > 0) {
      vatReceipts += 1;
      vatNet += net;
      vatTax += vat;
      vatGross += gross;
    } else {
      nonVatReceipts += 1;
      nonNet += net;
      nonGross += gross;
    }

    const method = paymentMethod(s);
    const cur = payMap.get(method) ?? { amount: 0, count: 0 };
    payMap.set(method, { amount: cur.amount + gross, count: cur.count + 1 });
  }

  const buckets: SalesVatBucket[] = [
    {
      code: 'A',
      label: 'Standard VAT 18%',
      ratePercent: 18,
      receiptCount: vatReceipts,
      net: vatNet,
      vat: vatTax,
      gross: vatGross,
    },
    {
      code: 'E',
      label: 'Exempt / Non-VAT / Zero',
      ratePercent: 0,
      receiptCount: nonVatReceipts,
      net: nonNet,
      vat: 0,
      gross: nonGross,
    },
  ];

  return {
    buckets,
    paymentBreakdown: Array.from(payMap.entries())
      .map(([method, v]) => ({ method, amount: v.amount, count: v.count }))
      .sort((a, b) => b.amount - a.amount),
    receiptCount: sales.length,
    totalNet,
    totalVat,
    totalGross,
    totalDiscount,
  };
}

export function buildInventoryValuation(products: Product[]): {
  rows: InventoryValuationRow[];
  totalCostValue: number;
  totalRetailValue: number;
  skuCount: number;
  lowStockCount: number;
  criticalCount: number;
  generatedAt: string;
} {
  const rows: InventoryValuationRow[] = products.map(p => {
    const qty = Number(p.stock || 0);
    const unitCost = Number(p.cost || 0);
    const unitPrice = Number(p.price || 0);
    const stockValue = Math.round(qty * unitCost);
    const retailValue = Math.round(qty * unitPrice);
    let health: InventoryValuationRow['health'] = 'ok';
    if (qty <= 5) health = 'critical';
    else if (qty <= Number(p.reorderPoint || 0)) health = 'low';
    else if (qty > Number(p.reorderPoint || 0) * 4 && Number(p.reorderPoint || 0) > 0) health = 'overstock';
    const marginPercent =
      unitPrice > 0 ? Math.round(((unitPrice - unitCost) / unitPrice) * 1000) / 10 : 0;
    return {
      name: p.name,
      sku: p.sku || '—',
      category: p.category || '—',
      description: (p.description || '').trim(),
      qty,
      unit: p.unit || 'pcs',
      unitCost,
      unitPrice,
      stockValue,
      retailValue,
      marginPercent,
      reorderPoint: Number(p.reorderPoint || 0),
      batchNumber: p.batchNumber || '—',
      expiryDate: p.expiryDate ? String(p.expiryDate).slice(0, 10) : '—',
      supplier: p.supplier || '—',
      location: p.location || '—',
      vatType: String(p.vatType || 'standard'),
      health,
    };
  });

  rows.sort((a, b) => b.stockValue - a.stockValue);

  return {
    rows,
    totalCostValue: rows.reduce((s, r) => s + r.stockValue, 0),
    totalRetailValue: rows.reduce((s, r) => s + r.retailValue, 0),
    skuCount: rows.length,
    lowStockCount: rows.filter(r => r.health === 'low' || r.health === 'critical').length,
    criticalCount: rows.filter(r => r.health === 'critical').length,
    generatedAt: new Date().toISOString(),
  };
}

export function buildPurchaseRows(orders: PurchaseOrder[]): PurchaseReportRow[] {
  return [...orders]
    .sort((a, b) => String(b.dateCreated).localeCompare(String(a.dateCreated)))
    .map(o => {
      const total = Number(o.totalAmount ?? o.totalCost ?? 0);
      const vat = Number(o.vatAmount || 0);
      const untaxed = Number(o.subtotal != null ? o.subtotal : Math.max(0, total - vat));
      const { date, time } = splitDateTime(o.dateCreated);
      const items = o.items || [];
      const itemSummary = items
        .slice(0, 3)
        .map(it => `${it.productName} ×${it.quantity}`)
        .join(', ')
        + (items.length > 3 ? ` +${items.length - 3}` : '');
      return {
        poNumber: shortPoLabel(o),
        supplier: o.supplierName || '—',
        date,
        time,
        expected: String(o.expectedDate || '').slice(0, 10) || '—',
        receivedDate: o.receivedDate ? String(o.receivedDate).slice(0, 10) : '—',
        status: o.status,
        itemCount: items.length,
        itemSummary: itemSummary || '—',
        untaxed,
        vat,
        total,
        paid: Number(o.paidAmount || 0),
        paymentStatus: o.paymentStatus || '—',
        paymentMethod: o.paymentMethod || '—',
        notes: (o.notes || o.vatNote || '').trim() || '—',
      };
    });
}

export function formatPeriodLabel(period: ReportPeriod, isSw: boolean): string {
  if (period.from === period.to) {
    return isSw ? `Tarehe: ${period.from}` : `Date: ${period.from}`;
  }
  return isSw
    ? `Kipindi: ${period.from} — ${period.to}`
    : `Period: ${period.from} — ${period.to}`;
}
