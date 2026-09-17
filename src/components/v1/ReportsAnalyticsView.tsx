import React, { useMemo, useState } from 'react';
import {
  FileText,
  TrendingUp,
  ShieldCheck,
  Download,
  Sparkles,
  Printer,
  Boxes,
  ShoppingCart,
  CalendarRange,
  Package,
} from 'lucide-react';
import { Language, SaleTransaction, Product, Supplier, PurchaseOrder, AuthUser } from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import { PredictiveAnalyticsView } from '@/components/v1/PredictiveAnalyticsView';
import { printHtmlPage } from '@/lib/documentRenderer';
import { useDocumentTemplates } from '@/context/DocumentTemplateContext';
import {
  type StandardReportKind,
  type ReportDatePreset,
  periodFromPreset,
  filterSalesByPeriod,
  filterPurchaseOrdersByPeriod,
  buildSalesDetailRows,
  buildSalesVatSummary,
  buildInventoryValuation,
  buildPurchaseRows,
  type ReportCompanyInfo,
} from '@/lib/standardReports';
import { PageSectionHeader } from '@/components/v1/PageSectionHeader';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import { BusinessPageSubtitle } from '@/lib/businessPageSubtitle';
import {
  renderSalesDetailPaper,
  renderSalesVatSummaryPaper,
  renderInventoryValuationPaper,
  renderPurchaseOrdersPaper,
} from '@/lib/reportPaperHtml';

interface ReportsAnalyticsViewProps {
  language: Language;
  sales: SaleTransaction[];
  products?: Product[];
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onNavigateToSuppliers?: () => void;
  currentUser?: AuthUser | null;
}

type HubTab = 'standard' | 'predictive';

const REPORT_KINDS: Array<{
  id: StandardReportKind;
  icon: React.ReactNode;
  en: string;
  sw: string;
  hintEn: string;
  hintSw: string;
}> = [
  {
    id: 'sales_detail',
    icon: <ShoppingCart className="w-4 h-4" />,
    en: 'Sales detail',
    sw: 'Mauzo kwa undani',
    hintEn: 'TRA-style daily gross sales ledger',
    hintSw: 'Daftari la mauzo ya kila siku (TRA)',
  },
  {
    id: 'sales_vat_summary',
    icon: <ShieldCheck className="w-4 h-4" />,
    en: 'VAT / Z summary',
    sw: 'Muhtasari VAT / Z',
    hintEn: 'VAT by rate + payments (period Z)',
    hintSw: 'VAT kwa kiwango + malipo (Z ya kipindi)',
  },
  {
    id: 'inventory_valuation',
    icon: <Package className="w-4 h-4" />,
    en: 'Inventory valuation',
    sw: 'Thamani ya stoo',
    hintEn: 'Odoo-style qty × cost value',
    hintSw: 'Mtindo wa Odoo — wingi × gharama',
  },
  {
    id: 'purchase_orders',
    icon: <Boxes className="w-4 h-4" />,
    en: 'Purchase orders',
    sw: 'Maagizo ya ununuzi',
    hintEn: 'POs with input VAT trail',
    hintSw: 'PO na VAT ya pembejeo',
  },
];

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsViewProps> = ({
  language,
  sales,
  products = [],
  suppliers = [],
  purchaseOrders = [],
  onOpenAIChatWithPrompt,
  onNavigateToSuppliers,
  currentUser,
}) => {
  const isSw = language === 'sw';
  const t = (key: string) => getTranslation(language, key as never);
  const { settings: taxSettings } = useTaxCompliance();
  const { config } = useDocumentTemplates();

  const [hubTab, setHubTab] = useState<HubTab>('standard');
  const [reportKind, setReportKind] = useState<StandardReportKind>('sales_detail');
  const [preset, setPreset] = useState<ReportDatePreset>('month');
  const [customFrom, setCustomFrom] = useState(() => periodFromPreset('month').from);
  const [customTo, setCustomTo] = useState(() => periodFromPreset('month').to);
  const [search, setSearch] = useState('');

  const period = useMemo(
    () => periodFromPreset(preset, { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  );

  const company: ReportCompanyInfo = useMemo(
    () => ({
      businessName: config.branding.companyName || currentUser?.businessName || 'Duka+ Business',
      ownerName: currentUser?.name,
      address: config.branding.address || currentUser?.location,
      phone: config.branding.phone || currentUser?.phone,
      email: currentUser?.email,
      tinNumber: config.branding.tinNumber || currentUser?.tinNumber,
      branch: currentUser?.branch,
      logoUrl: config.branding.logoUrl || undefined,
      businessType: currentUser?.businessType,
    }),
    [config.branding, currentUser],
  );

  const filteredSales = useMemo(() => {
    let list = filterSalesByPeriod(sales, period);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        s =>
          (s.receiptNumber || '').toLowerCase().includes(q) ||
          (s.customerName || '').toLowerCase().includes(q) ||
          (s.cashierName || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [sales, period, search]);

  const filteredPos = useMemo(() => {
    let list = filterPurchaseOrdersByPeriod(purchaseOrders, period);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        o =>
          (o.poNumber || '').toLowerCase().includes(q) ||
          (o.supplierName || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [purchaseOrders, period, search]);

  const salesRows = useMemo(() => buildSalesDetailRows(filteredSales), [filteredSales]);
  const vatSummary = useMemo(() => buildSalesVatSummary(filteredSales), [filteredSales]);
  const inventory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = buildInventoryValuation(products);
    if (!q) return base;
    const rows = base.rows.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
    );
    return {
      ...base,
      rows,
      skuCount: rows.length,
      totalCostValue: rows.reduce((s, r) => s + r.stockValue, 0),
      totalRetailValue: rows.reduce((s, r) => s + r.retailValue, 0),
      lowStockCount: rows.filter(r => r.health === 'low' || r.health === 'critical').length,
    };
  }, [products, search]);
  const purchaseRows = useMemo(() => buildPurchaseRows(filteredPos), [filteredPos]);

  const salesGrossProfit = useMemo(() => {
    const costById = new Map(products.map(p => [p.id, Number(p.cost || 0)]));
    let cogs = 0;
    for (const sale of filteredSales) {
      for (const item of sale.items || []) {
        const unitCost = costById.get(item.productId) ?? 0;
        cogs += unitCost * Number(item.quantity || 0);
      }
    }
    return Math.round(vatSummary.totalGross - cogs);
  }, [filteredSales, products, vatSummary.totalGross]);

  const paperHtml = useMemo(() => {
    if (reportKind === 'sales_detail') {
      return renderSalesDetailPaper({
        company,
        period,
        rows: salesRows,
        totals: {
          net: vatSummary.totalNet,
          vat: vatSummary.totalVat,
          discount: vatSummary.totalDiscount,
          gross: vatSummary.totalGross,
        },
        isSw,
      });
    }
    if (reportKind === 'sales_vat_summary') {
      return renderSalesVatSummaryPaper({ company, period, summary: vatSummary, isSw });
    }
    if (reportKind === 'inventory_valuation') {
      return renderInventoryValuationPaper({
        company,
        period,
        rows: inventory.rows,
        totals: {
          cost: inventory.totalCostValue,
          retail: inventory.totalRetailValue,
          skus: inventory.skuCount,
          low: inventory.lowStockCount,
        },
        isSw,
      });
    }
    return renderPurchaseOrdersPaper({
      company,
      period,
      rows: purchaseRows,
      totals: {
        untaxed: purchaseRows.reduce((s, r) => s + r.untaxed, 0),
        vat: purchaseRows.reduce((s, r) => s + r.vat, 0),
        total: purchaseRows.reduce((s, r) => s + r.total, 0),
        count: purchaseRows.length,
      },
      isSw,
    });
  }, [reportKind, company, period, salesRows, vatSummary, inventory, purchaseRows, isSw]);

  const reportTitle = () => {
    const titles: Record<StandardReportKind, string> = {
      sales_detail: isSw ? 'Ripoti ya Mauzo' : 'Sales Report',
      sales_vat_summary: isSw ? 'Muhtasari wa VAT' : 'VAT Summary',
      inventory_valuation: isSw ? 'Thamani ya Stoo' : 'Inventory Valuation',
      purchase_orders: isSw ? 'Ripoti ya Ununuzi' : 'Purchase Report',
    };
    return titles[reportKind];
  };

  /** Print + Download PDF both use the Odoo-style A4 paper (Save as PDF in print dialog). */
  const handlePrintOrPdf = () => {
    printHtmlPage(reportTitle(), paperHtml, isSw);
  };

  const emptyHint = (() => {
    if (reportKind === 'inventory_valuation') {
      return products.length === 0
        ? isSw
          ? 'Hakuna bidhaa kwenye stoo bado.'
          : 'No products in inventory yet.'
        : null;
    }
    if (reportKind === 'purchase_orders') {
      return filteredPos.length === 0
        ? isSw
          ? 'Hakuna maagizo katika kipindi hiki.'
          : 'No purchase orders in this period.'
        : null;
    }
    return filteredSales.length === 0
      ? isSw
        ? 'Hakuna mauzo katika kipindi hiki.'
        : 'No sales in this period.'
      : null;
  })();

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      <PageSectionHeader
        icon={<FileText className="w-5 h-5" />}
        title={t('reports')}
        subtitle={
          <BusinessPageSubtitle
            currentUser={currentUser}
            taxSettings={taxSettings}
            isSw={isSw}
            detail={
              isSw
                ? 'Ripoti TRA/VAT · thamani ya stoo · ununuzi (karatasi kama Odoo)'
                : 'TRA/VAT · inventory valuation · purchases (Odoo-style paper)'
            }
          />
        }
        toolbar={
          <button
            type="button"
            onClick={() =>
              onOpenAIChatWithPrompt?.(
                isSw
                  ? 'Chambua ripoti ya mauzo, VAT na stoo yangu. Toa ushauri wa kukuza faida nchini Tanzania.'
                  : 'Analyse my sales, VAT and inventory reports. Give practical profit advice for a Tanzania shop.',
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6264A7] text-white text-xs font-bold hover:brightness-110 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            {isSw ? 'Ushauri wa AI' : 'AI insights'}
          </button>
        }
      />

      <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-[#E1DFDD] shadow-xs w-full max-w-md">
        <button
          type="button"
          onClick={() => setHubTab('standard')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold cursor-pointer ${
            hubTab === 'standard' ? 'bg-[#0F2347] text-white' : 'text-[#605E5C] hover:bg-[#F3F2F1]'
          }`}
        >
          <FileText className="w-4 h-4" />
          {isSw ? 'Ripoti za kawaida' : 'Standard reports'}
        </button>
        <button
          type="button"
          onClick={() => setHubTab('predictive')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold cursor-pointer ${
            hubTab === 'predictive' ? 'bg-[#0F2347] text-white' : 'text-[#605E5C] hover:bg-[#F3F2F1]'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          {isSw ? 'Utabiri wa stoo' : 'Stock forecast'}
        </button>
      </div>

      {hubTab === 'predictive' ? (
        <PredictiveAnalyticsView
          language={language}
          products={products}
          sales={sales}
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
          onOpenAIChatWithPrompt={onOpenAIChatWithPrompt}
          onNavigateToSuppliers={onNavigateToSuppliers}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-4">
          <aside className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs p-3 space-y-1 h-fit xl:sticky xl:top-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8886] px-2 py-1">
              {isSw ? 'Aina ya ripoti' : 'Report type'}
            </div>
            {REPORT_KINDS.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReportKind(r.id)}
                className={`w-full text-left rounded-lg px-2.5 py-2.5 transition-colors cursor-pointer ${
                  reportKind === r.id
                    ? 'bg-[#E8EEF7] border border-[#C5D0E6]'
                    : 'hover:bg-[#F8F8F8] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#323130]">
                  <span className={reportKind === r.id ? 'text-[#0F2347]' : 'text-[#8A8886]'}>{r.icon}</span>
                  {isSw ? r.sw : r.en}
                </div>
                <div className="text-[10px] text-[#605E5C] mt-0.5 pl-6">{isSw ? r.hintSw : r.hintEn}</div>
              </button>
            ))}
          </aside>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs p-3.5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarRange className="w-4 h-4 text-[#6264A7]" />
                <span className="text-xs font-bold text-[#323130]">{isSw ? 'Kipindi' : 'Period'}</span>
                {(['today', 'week', 'month', 'quarter', 'year', 'custom'] as ReportDatePreset[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPreset(p);
                      if (p !== 'custom') {
                        const next = periodFromPreset(p);
                        setCustomFrom(next.from);
                        setCustomTo(next.to);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      preset === p ? 'bg-[#0F2347] text-white' : 'bg-[#F3F2F1] text-[#605E5C] hover:bg-[#EDEBE9]'
                    }`}
                  >
                    {p === 'today' && (isSw ? 'Leo' : 'Today')}
                    {p === 'week' && (isSw ? 'Wiki' : 'Week')}
                    {p === 'month' && (isSw ? 'Mwezi' : 'Month')}
                    {p === 'quarter' && (isSw ? 'Robo' : 'Quarter')}
                    {p === 'year' && (isSw ? 'Mwaka' : 'Year')}
                    {p === 'custom' && (isSw ? 'Maalum' : 'Custom')}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-semibold text-[#605E5C] mb-1">
                    {isSw ? 'Kuanzia' : 'From'}
                  </label>
                  <input
                    type="date"
                    value={period.from}
                    onChange={e => {
                      setPreset('custom');
                      setCustomFrom(e.target.value);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-[#E1DFDD] bg-[#FAF9F8] text-xs outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#605E5C] mb-1">
                    {isSw ? 'Mpaka' : 'To'}
                  </label>
                  <input
                    type="date"
                    value={period.to}
                    onChange={e => {
                      setPreset('custom');
                      setCustomTo(e.target.value);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-[#E1DFDD] bg-[#FAF9F8] text-xs outline-none focus:bg-white"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[10px] font-semibold text-[#605E5C] mb-1">
                    {isSw ? 'Tafuta' : 'Search'}
                  </label>
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={
                      reportKind === 'purchase_orders'
                        ? isSw
                          ? 'PO au msambazaji…'
                          : 'PO or supplier…'
                        : reportKind === 'inventory_valuation'
                          ? isSw
                            ? 'Bidhaa / SKU…'
                            : 'Product / SKU…'
                          : isSw
                            ? 'Risiti / mteja…'
                            : 'Receipt / customer…'
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#E1DFDD] bg-[#FAF9F8] text-xs outline-none focus:bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePrintOrPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E1DFDD] bg-white text-xs font-bold text-[#323130] hover:bg-[#F3F2F1] cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {isSw ? 'Chapisha' : 'Print'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintOrPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] text-white text-xs font-bold hover:brightness-110 cursor-pointer"
                    title={isSw ? 'Fungua karatasi ya Odoo — chagua Hifadhi kama PDF' : 'Opens Odoo-style paper — choose Save as PDF'}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isSw ? 'Pakua PDF' : 'Download PDF'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {reportKind === 'inventory_valuation' ? (
                <>
                  <Kpi label={isSw ? 'SKU' : 'SKUs'} value={String(inventory.skuCount)} />
                  <Kpi label={isSw ? 'Thamani (gharama)' : 'Cost value'} value={formatTSh(inventory.totalCostValue)} accent="blue" />
                  <Kpi label={isSw ? 'Thamani (reja)' : 'Retail value'} value={formatTSh(inventory.totalRetailValue)} accent="green" />
                  <Kpi label={isSw ? 'Stoo chini' : 'Low stock'} value={String(inventory.lowStockCount)} accent="orange" />
                </>
              ) : reportKind === 'purchase_orders' ? (
                <>
                  <Kpi label={isSw ? 'Maagizo' : 'Orders'} value={String(purchaseRows.length)} />
                  <Kpi
                    label={isSw ? 'Bila VAT' : 'Untaxed'}
                    value={formatTSh(purchaseRows.reduce((s, r) => s + r.untaxed, 0))}
                    accent="blue"
                  />
                  <Kpi
                    label={isSw ? 'VAT pembejeo' : 'Input VAT'}
                    value={formatTSh(purchaseRows.reduce((s, r) => s + r.vat, 0))}
                    accent="orange"
                  />
                  <Kpi
                    label={isSw ? 'Jumla' : 'Total'}
                    value={formatTSh(purchaseRows.reduce((s, r) => s + r.total, 0))}
                    accent="green"
                  />
                </>
              ) : (
                <>
                  <Kpi label={isSw ? 'Risiti' : 'Receipts'} value={String(filteredSales.length)} />
                  <Kpi label={isSw ? 'Neto' : 'Net sales'} value={formatTSh(vatSummary.totalNet)} accent="blue" />
                  <Kpi
                    label={vatSummary.totalVat > 0 ? (isSw ? 'VAT' : 'VAT') : (isSw ? 'VAT (0)' : 'VAT (0)')}
                    value={formatTSh(vatSummary.totalVat)}
                    accent="orange"
                  />
                  <Kpi
                    label={isSw ? 'Jumla / Faida' : 'Gross / Profit'}
                    value={`${formatTSh(vatSummary.totalGross)} · ${formatTSh(salesGrossProfit)}`}
                    accent="green"
                  />
                </>
              )}
            </div>

            <div className="rounded-2xl border border-[#D0D4DC] bg-[linear-gradient(160deg,#E8EAEE_0%,#F4F5F7_45%,#DEE2E8_100%)] p-3 sm:p-5 shadow-inner">
              {/* Preview header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#605E5C]">
                  {isSw ? 'Muhtasari wa karatasi (A4)' : 'Paper preview (A4)'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#8A8886]">
                    {isSw ? 'Chapisha / Pakua PDF' : 'Print / Download PDF'}
                  </span>
                  <button
                    type="button"
                    onClick={handlePrintOrPdf}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0F2347] text-white text-[10px] font-bold hover:brightness-110 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    {isSw ? 'Chapisha' : 'Print'}
                  </button>
                </div>
              </div>

              {emptyHint && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {emptyHint}
                </div>
              )}

              {/* Paper container — horizontally scrollable on small screens */}
              <div
                className="overflow-x-auto overflow-y-auto rounded-sm"
                style={{
                  maxHeight: 'min(78vh, 920px)',
                  WebkitOverflowScrolling: 'touch',
                  // Scale down slightly on very narrow viewports so columns are readable
                  overflowX: 'auto',
                }}
              >
                {/* Inner wrapper lets the A4 paper maintain its true width but the outer container scrolls */}
                <div
                  style={{ minWidth: 0, width: '100%' }}
                  dangerouslySetInnerHTML={{ __html: paperHtml }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function Kpi({
  label,
  value,
  accent = 'navy',
}: {
  label: string;
  value: string;
  accent?: 'navy' | 'blue' | 'green' | 'orange';
}) {
  const bar =
    accent === 'blue'
      ? 'bg-[#0078D4]'
      : accent === 'green'
        ? 'bg-[#107C10]'
        : accent === 'orange'
          ? 'bg-[#C45A10]'
          : 'bg-[#0F2347]';
  return (
    <div className="bg-white rounded-xl border border-[#E1DFDD] shadow-xs p-3.5 relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`} />
      <div className="text-[10px] font-semibold text-[#605E5C] uppercase tracking-wide pl-2">{label}</div>
      <div className="text-sm sm:text-base font-extrabold text-[#323130] mt-1 pl-2 tabular-nums leading-snug break-words">
        {value}
      </div>
    </div>
  );
}
