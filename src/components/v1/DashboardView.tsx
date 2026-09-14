import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard,
  TrendingUp, 
  Users, 
  AlertTriangle, 
  CreditCard, 
  ArrowUpRight, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  ShoppingBag, 
  Clock, 
  ShieldCheck,
  Calendar,
  ChevronRight,
  BarChart3,
  PieChart as PieChartIcon,
  DollarSign,
  Coins,
  Wallet,
  Zap,
  Boxes,
  Truck,
  Building2,
  RefreshCw,
  Send,
  Sliders,
  Check,
  Filter,
  Eye,
  Layers,
  Compass,
  MapPin,
  Award,
  TrendingDown,
  Target,
  Bot,
  MessageSquareQuote,
  Flame,
  ArrowDownRight,
  PackageCheck,
  Lock,
  Unlock,
  LogOut,
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { Customer, Language, SaleTransaction, Product, AuthUser, UserRole, BusinessType, ExpenseItem } from '@/types/v1';
import { getTranslation, formatTSh } from '@/utils/translations';
import { exportSalesReport } from '@/utils/reportGenerator';
import { ActionBar } from '@/components/v1/ActionBar';
import { useTaxCompliance } from '@/context/TaxComplianceContext';
import { getComplianceStatusLabel } from '@/lib/taxComplianceSettings';
import { getBusinessProfile } from '@/lib/businessEngine';
import {
  computeTotalRevenue,
  computeTotalCOGS,
  computeSalesPerformance7d,
  computeSalesPerformance30d,
  computeSalesPerformanceQuarter,
  computePaymentMethodsBreakdown,
  computeHourlyRushData,
  computeProductInsightsSummary,
  computeShiftCashierStats,
  computeCashierLeaderboard,
  computeAIForecastData,
  computeWeekOverWeekChange,
  computeAverageDailySales,
  computePeakHoursSummary,
  computeSuggestedReorderDate,
  buildDashboardStrategyHint,
  computeTodaySalesStats,
} from '@/lib/analyticsCompute';
import { getDashboardPersona, canToggleDashboardView, canSeeExecutiveDashboard, resolveUserPermissions } from '@/lib/rbac';
import {
  closeCashierShift,
  getOpenCashierShift,
  openCashierShift,
  type CashierShiftSession,
} from '@/lib/cashierShiftStore';
import { TodaySalesHeroKpi } from '@/components/v1/TodaySalesHeroKpi';

interface DashboardViewProps {
  language: Language;
  customers: Customer[];
  products: Product[];
  sales: SaleTransaction[];
  expenses?: ExpenseItem[];
  currentUser?: AuthUser | null;
  userRole?: UserRole;
  businessType?: BusinessType;
  onNavigate: (view: string) => void;
  onOpenAIChat: () => void;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onSelectCustomer: (cust: Customer) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  language,
  customers,
  products,
  sales,
  expenses = [],
  currentUser,
  userRole = 'vendor_owner',
  businessType = 'retail',
  onNavigate,
  onOpenAIChat,
  onOpenAIChatWithPrompt,
  onSelectCustomer,
}) => {
  const isSw = language === 'sw';
  const t = (key: any) => getTranslation(language, key);
  const { settings: taxSettings } = useTaxCompliance();
  const businessProfile = getBusinessProfile(businessType);
  const businessLabel = isSw ? businessProfile.label_sw : businessProfile.label_en;
  const productNoun = isSw ? 'Bidhaa' : 'Products';
  const stockNoun = isSw ? 'vitu' : 'items';

  // Role-aware dashboard persona
  const persona = getDashboardPersona(currentUser ?? null);
  const canToggleView = canToggleDashboardView(currentUser ?? null);
  const showExecutive = canSeeExecutiveDashboard(currentUser ?? null);

  const initialMode = persona === 'cashier' || !showExecutive ? 'cashier_shift' : 'executive';
  const [viewMode, setViewMode] = useState<'executive' | 'cashier_shift'>(initialMode);

  const tenantId = currentUser?.businessId || currentUser?.id || 'local';
  const staffKey = currentUser?.staffId || currentUser?.id || currentUser?.email || 'anon';
  const [openShift, setOpenShift] = useState<CashierShiftSession | null>(null);
  const [openingFloat, setOpeningFloat] = useState('0');
  const [closingCash, setClosingCash] = useState('');
  const [shiftMsg, setShiftMsg] = useState<string | null>(null);

  useEffect(() => {
    setOpenShift(getOpenCashierShift(tenantId, staffKey));
  }, [tenantId, staffKey, currentUser?.id]);

  useEffect(() => {
    setViewMode(persona === 'cashier' || !showExecutive ? 'cashier_shift' : 'executive');
  }, [persona, showExecutive]);

  const perms = resolveUserPermissions(currentUser);
  const canViewStock = perms.canViewInventory || perms.canModifyInventory;
  const canEditStock = perms.canModifyInventory;

  const refreshShift = useCallback(() => {
    setOpenShift(getOpenCashierShift(tenantId, staffKey));
  }, [tenantId, staffKey]);

  const handleOpenShift = () => {
    const session = openCashierShift({
      tenantId,
      staffId: staffKey,
      cashierName: currentUser?.name || 'Cashier',
      openingFloat: Number(openingFloat) || 0,
    });
    setOpenShift(session);
    setShiftMsg(isSw ? 'Zamu imefunguliwa. Unaweza kuuza sasa.' : 'Shift opened. You can sell now.');
  };

  const handleCloseShift = () => {
    if (!openShift) return;
    closeCashierShift({
      tenantId,
      staffId: staffKey,
      closingCashCounted: Number(closingCash) || undefined,
    });
    setOpenShift(null);
    setClosingCash('');
    setShiftMsg(isSw ? 'Zamu imefungwa. Fungua tena kabla ya POS.' : 'Shift closed. Open again before POS.');
    refreshShift();
  };

  const goPos = () => {
    if (persona === 'cashier' && !openShift) {
      setShiftMsg(isSw ? 'Fungua zamu kwanza kabla ya POS.' : 'Open your shift before using POS.');
      return;
    }
    onNavigate('pos');
  };
  
  // Time range filter for Executive Chart
  const [chartTimeRange, setChartTimeRange] = useState<'7d' | '30d' | 'quarter'>('7d');

  // AI Predictive Demand Scenario Toggle
  const [aiScenario, setAiScenario] = useState<'baseline' | 'rainy_season' | 'promo' | 'delay'>('baseline');
  const [isDunningSent, setIsDunningSent] = useState<Record<string, boolean>>({});
  const [autoPoSuccess, setAutoPoSuccess] = useState<boolean>(false);

  // Product Analysis Dashboard Widget Lens
  const [productInsightTab, setProductInsightTab] = useState<'best' | 'slow' | 'territories' | 'crosssell'>('best');
  const [quickPromoSent, setQuickPromoSent] = useState<string | null>(null);

  // Aggregations from live sales data
  const totalSalesRevenue = useMemo(() => computeTotalRevenue(sales), [sales]);
  const totalCost = useMemo(() => computeTotalCOGS(sales, products), [sales, products]);
  const totalOperatingExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses],
  );
  const netProfit = totalSalesRevenue - totalCost - totalOperatingExpenses;
  const netMarginPercent = totalSalesRevenue > 0
    ? Math.round((netProfit / totalSalesRevenue) * 1000) / 10
    : 0;

  const lowStockProducts = products.filter(p => p.stock <= p.reorderPoint);
  const criticalStockCount = products.filter(p => p.stock <= 5).length;
  const topCreditCustomers = useMemo(() => {
    return [...customers].sort((a, b) => b.balance - a.balance).slice(0, 4);
  }, [customers]);

  const totalOutstandingCredit = customers.reduce((sum, c) => sum + c.balance, 0);

  const salesPerformanceData7d = useMemo(
    () => computeSalesPerformance7d(sales, products, isSw),
    [sales, products, isSw],
  );
  const salesPerformanceData30d = useMemo(
    () => computeSalesPerformance30d(sales, products),
    [sales, products],
  );
  const salesPerformanceDataQuarter = useMemo(
    () => computeSalesPerformanceQuarter(sales, products, isSw),
    [sales, products, isSw],
  );

  const activeSalesData = chartTimeRange === '7d'
    ? salesPerformanceData7d
    : chartTimeRange === '30d'
      ? salesPerformanceData30d
      : salesPerformanceDataQuarter;

  const paymentMethodsData = useMemo(
    () => computePaymentMethodsBreakdown(sales, isSw),
    [sales, isSw],
  );

  const hourlyRushData = useMemo(() => computeHourlyRushData(sales), [sales]);

  const forecastProduct = useMemo(() => {
    const low = products.filter(p => p.stock <= p.reorderPoint);
    return low[0] ?? products[0];
  }, [products]);

  const aiForecastData = useMemo(
    () => computeAIForecastData(forecastProduct, sales, aiScenario),
    [forecastProduct, sales, aiScenario],
  );

  const productInsightsSummary = useMemo(
    () => computeProductInsightsSummary(products, sales, customers, isSw),
    [products, sales, customers, isSw],
  );

  const shiftCashierStats = useMemo(() => {
    const mine = computeShiftCashierStats(sales, currentUser?.name, {
      mineOnly: persona === 'cashier',
    });
    // Fallback: if tagged-name filter yields nothing, show today's completed sales so KPIs aren't blank.
    if (persona === 'cashier' && mine.receiptsIssued === 0) {
      return computeShiftCashierStats(sales, currentUser?.name, { mineOnly: false });
    }
    return mine;
  }, [sales, currentUser?.name, persona]);

  const todaySalesStats = useMemo(() => {
    const mine = computeTodaySalesStats(sales, {
      cashierName: currentUser?.name,
      mineOnly: persona === 'cashier',
    });
    if (persona === 'cashier' && mine.todayReceiptCount === 0) {
      return computeTodaySalesStats(sales, { cashierName: currentUser?.name, mineOnly: false });
    }
    return mine;
  }, [sales, currentUser?.name, persona]);

  const cashierLeaderboard = useMemo(
    () => computeCashierLeaderboard(sales),
    [sales],
  );

  const dashboardTitle = useMemo(() => {
    if (persona === 'cashier') return isSw ? 'Dashibodi ya Keshia' : 'Cashier Shift Dashboard';
    if (persona === 'manager') return isSw ? 'Dashibodi ya Meneja' : 'Manager Operations Dashboard';
    if (persona === 'accountant') return isSw ? 'Dashibodi ya Mhasibu' : 'Finance Dashboard';
    if (persona === 'storekeeper') return isSw ? 'Dashibodi ya Stoo' : 'Inventory Dashboard';
    return isSw ? 'Dashibodi Kuu ya Biashara' : 'Main Business Dashboard';
  }, [persona, isSw]);

  const weekOverWeek = useMemo(() => computeWeekOverWeekChange(sales), [sales]);
  const avgDailySales = useMemo(() => computeAverageDailySales(activeSalesData), [activeSalesData]);

  const handleExportDashboard = () => {
    const totalVatCollected = sales.reduce((acc, s) => acc + (s.vatAmount || 0), 0);
    exportSalesReport({
      provider: {
        businessName: currentUser?.businessName || 'Duka+ Business',
        ownerName: currentUser?.name || 'Owner',
        email: currentUser?.email || '',
        phone: currentUser?.phone,
        location: currentUser?.location,
        tinNumber: currentUser?.tinNumber,
        branch: currentUser?.branch,
        plan: currentUser?.plan,
        businessType: currentUser?.businessType,
      },
      sales: sales.map(s => ({
        receipt: s.receiptNumber || s.id,
        customer: s.customerName || (isSw ? 'Mteja wa Taslimu' : 'Walk-in'),
        date: s.date,
        method: (s.payments?.[0]?.method || s.type || '').toUpperCase(),
        vat: formatTSh(s.vatAmount || 0),
        total: formatTSh(s.total),
      })),
      totalGross: formatTSh(totalSalesRevenue),
      totalVat: formatTSh(totalVatCollected),
      grossProfit: formatTSh(netProfit),
      language: language as 'en' | 'sw',
    });
  };
  const peakHours = useMemo(() => computePeakHoursSummary(hourlyRushData, isSw), [hourlyRushData, isSw]);
  const strategyHint = useMemo(
    () => buildDashboardStrategyHint(productInsightsSummary, isSw),
    [productInsightsSummary, isSw],
  );
  const reorderHint = useMemo(
    () => computeSuggestedReorderDate(forecastProduct, sales, aiScenario, isSw),
    [forecastProduct, sales, aiScenario, isSw],
  );

  const topProductPreview = productInsightsSummary.bestMoving[0];
  const slowProductPreview = productInsightsSummary.slowMoving[0];
  const topTerritoryPreview = productInsightsSummary.territories[0];
  const topCrossSellPreview = productInsightsSummary.crossSellOpportunities[0];
  const topPaymentMethod = paymentMethodsData[0];
  const hasSalesData = sales.length > 0;
  const complianceLabel = getComplianceStatusLabel(taxSettings, isSw);

  const handleSendDunningSms = (cust: Customer) => {
    setIsDunningSent(prev => ({ ...prev, [cust.id]: true }));
    setTimeout(() => {
      alert(
        isSw 
          ? `Ujumbe wa ukumbusho wa deni (TZS ${formatTSh(cust.balance)}) umetumwa kwa mafanikio kupitia SMS kwa ${cust.name} (${cust.phone}).`
          : `Automated debt statement & M-Pesa Lipa link sent via SMS to ${cust.name} (${cust.phone}).`
      );
    }, 200);
  };

  const handleTriggerAutoPO = () => {
    setAutoPoSuccess(true);
    setTimeout(() => {
      setAutoPoSuccess(false);
      onNavigate('suppliers');
    }, 1200);
  };

  const handleSendQuickPromo = (opportunityId: string, customerName: string) => {
    setQuickPromoSent(opportunityId);
    setTimeout(() => {
      alert(
        isSw
          ? `Ujumbe wa ofa maalum ya bidhaa umetumwa kwa mafanikio kwa ${customerName} kupitia SMS.`
          : `Targeted cross-sell promo SMS successfully dispatched to ${customerName}.`
      );
    }, 200);
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      {/* 1. TOP HEADER — full-width title + toolbar spanning edge to edge */}
      <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs overflow-hidden w-full">
        <div className="px-4 py-4 sm:px-5 sm:py-4 border-b border-[#EDEBE9] bg-gradient-to-r from-white via-[#FAF9F8] to-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#6264A7]/10 text-[#6264A7] shrink-0">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-black text-[#323130] tracking-tight">
                {dashboardTitle}
              </h2>
              <p className="text-[11px] sm:text-xs text-[#605E5C] mt-0.5">
                {currentUser?.businessName || (isSw ? 'Biashara Yako' : 'Your Business')} • {complianceLabel}
                {persona !== 'owner' && currentUser?.staffRole && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#6264A7]/10 text-[#6264A7] font-bold">
                    {currentUser.staffRole}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Full-width action toolbar — buttons stretch edge to edge */}
        <div className="px-3 py-3 sm:px-4 sm:py-3.5 flex flex-wrap lg:flex-nowrap gap-2 w-full">
          {canToggleView && (
            <>
              <button
                onClick={() => setViewMode('executive')}
                className={`flex flex-1 min-w-[calc(50%-4px)] lg:min-w-0 items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'executive'
                    ? 'bg-[#6264A7] text-white shadow-sm'
                    : 'bg-[#F3F2F1] text-[#605E5C] hover:bg-[#EDEBE9] border border-[#E1DFDD]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isSw ? 'Mmiliki / Meneja' : 'Owner / Manager'}</span>
              </button>
              <button
                onClick={() => setViewMode('cashier_shift')}
                className={`flex flex-1 min-w-[calc(50%-4px)] lg:min-w-0 items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'cashier_shift'
                    ? 'bg-[#107C10] text-white shadow-sm'
                    : 'bg-[#F3F2F1] text-[#605E5C] hover:bg-[#EDEBE9] border border-[#E1DFDD]'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>{isSw ? 'Zamu Cashier' : 'Cashier Shift'}</span>
              </button>
            </>
          )}

          {(persona === 'owner' || persona === 'manager') && (
            <button
              onClick={() => onNavigate('product-geo-matrix')}
              className="flex flex-1 min-w-[calc(50%-4px)] lg:min-w-0 items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] sm:text-xs font-bold shadow-sm cursor-pointer transition-all border border-emerald-400/30 whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>{isSw ? 'Mauzo & Maeneo' : 'Geo Matrix'}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (onOpenAIChatWithPrompt) {
                onOpenAIChatWithPrompt('Fanya uchambuzi wa dashibodi ya leo, unipe ripoti ya faida, bidhaa zilizoisha na mikakati ya kuongeza mauzo ya duka langu.');
              } else {
                onOpenAIChat();
              }
            }}
            className="flex flex-1 min-w-[calc(50%-4px)] lg:min-w-0 items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-[11px] sm:text-xs font-bold shadow-sm cursor-pointer transition-all whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{isSw ? 'Ushauri wa AI' : 'AI Brief'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OWNER / EXECUTIVE MODE SECTION */}
      {/* ========================================================================= */}
      {viewMode === 'executive' && (
        <>
          {/* KPI band — one row: 4 compact KPIs (horizontal) + tall Today Sales on far right */}
          <div className="rounded-2xl border border-[#E1DFDD] bg-gradient-to-br from-[#FAF9F8] via-white to-[#FAF9F8] p-3 sm:p-4 w-full shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4 w-full">
            <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5 order-2 lg:order-1 self-start w-full">
            {/* KPI 1: Gross Sales — compact */}
            <div 
              onClick={() => onNavigate('bi-analytics')}
              className="bg-white rounded-lg p-2.5 sm:p-3 border border-[#E1DFDD] shadow-xs hover:border-[#0078D4] hover:shadow-sm transition-all cursor-pointer relative group flex flex-col gap-1 min-h-0 h-auto"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-semibold text-[#605E5C] leading-tight">
                  {isSw ? 'Mauzo ya Jumla' : 'Gross Revenue'}
                </span>
                <div className="w-6 h-6 rounded-md bg-[#0078D4]/10 text-[#0078D4] flex items-center justify-center shrink-0">
                  <DollarSign className="w-3 h-3" />
                </div>
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-black text-[#323130] tabular-nums leading-snug break-words block">{formatTSh(totalSalesRevenue)}</span>
                {weekOverWeek.hasData && (
                  <span className={`text-[10px] font-semibold flex items-center gap-0.5 mt-0.5 ${weekOverWeek.direction === 'down' ? 'text-rose-600' : 'text-[#107C10]'}`}>
                    {weekOverWeek.direction === 'down' ? <ArrowDownRight className="w-3 h-3 shrink-0" /> : <ArrowUpRight className="w-3 h-3 shrink-0" />}
                    {weekOverWeek.direction === 'flat' ? '—' : `${weekOverWeek.direction === 'down' ? '-' : '+'}${weekOverWeek.percent}%`}
                  </span>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0078D4] rounded-b-lg" />
            </div>

            {/* KPI 2: Net Profit — compact */}
            <div 
              onClick={() => onNavigate('bi-analytics')}
              className="bg-white rounded-lg p-2.5 sm:p-3 border border-[#E1DFDD] shadow-xs hover:border-[#107C10] hover:shadow-sm transition-all cursor-pointer relative group flex flex-col gap-1 min-h-0 h-auto"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-semibold text-[#605E5C] leading-tight">
                  {isSw ? 'Pesa Unayobaki' : 'Money You Keep'}
                </span>
                <div className="w-6 h-6 rounded-md bg-[#107C10]/10 text-[#107C10] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3 h-3" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                  <span className="text-xs sm:text-sm font-black text-[#107C10] tabular-nums leading-snug break-words">{formatTSh(netProfit)}</span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-px rounded shrink-0">{netMarginPercent}%</span>
                </div>
                <span className="text-[9px] text-[#605E5C] leading-tight mt-0.5 block">{isSw ? 'Baada ya kununua bidhaa na matumizi' : 'After stock purchases & shop bills'}</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#107C10] rounded-b-lg" />
            </div>

            {/* KPI 3: Low Stock — compact */}
            <div 
              onClick={() => onNavigate('predictive')}
              className="bg-white rounded-lg p-2.5 sm:p-3 border border-[#E1DFDD] shadow-xs hover:border-[#D13438] hover:shadow-sm transition-all cursor-pointer relative group flex flex-col gap-1 min-h-0 h-auto"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-semibold text-[#605E5C] leading-tight">
                  {isSw ? 'Bidhaa Chini' : 'Low Stock'}
                </span>
                <div className="w-6 h-6 rounded-md bg-[#D13438]/10 text-[#D13438] flex items-center justify-center shrink-0">
                  <Boxes className="w-3 h-3" />
                </div>
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-black text-[#D13438] tabular-nums leading-snug">{lowStockProducts.length}</span>
                <span className="text-[9px] text-[#D13438] font-semibold flex items-center gap-0.5 mt-0.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {criticalStockCount} {isSw ? 'hatari' : 'critical'}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D13438] rounded-b-lg" />
            </div>

            {/* KPI 4: Customer Debt — compact */}
            <div 
              onClick={() => onNavigate('customers')}
              className="bg-white rounded-lg p-2.5 sm:p-3 border border-[#E1DFDD] shadow-xs hover:border-[#FFB900] hover:shadow-sm transition-all cursor-pointer relative group flex flex-col gap-1 min-h-0 h-auto"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-semibold text-[#605E5C] leading-tight">
                  {isSw ? 'Madeni Wateja' : 'Customer Debt'}
                </span>
                <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                  <Coins className="w-3 h-3" />
                </div>
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-black text-[#323130] tabular-nums leading-snug break-words block">{formatTSh(totalOutstandingCredit)}</span>
                <span className="text-[9px] text-rose-600 font-semibold mt-0.5 block">
                  {topCreditCustomers.length} {isSw ? 'wateja' : 'customers'}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-b-lg" />
            </div>
            </div>

            <TodaySalesHeroKpi
              stats={todaySalesStats}
              isSw={isSw}
              variant="owner"
              onClick={() => onNavigate('reports')}
              className="w-full lg:w-[min(420px,34%)] lg:min-w-[320px] shrink-0 order-1 lg:order-2 min-h-[280px] lg:min-h-[300px] lg:self-stretch"
            />
          </div>
          </div>

          {/* PRIMARY CHARTS ROW 1: Multi-metric Sales Performance + Payment Channels Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Recharts Composed Area & Line Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#6264A7]"></span>
                    <h3 className="font-bold text-sm text-[#323130]">
                      {isSw ? 'Mwenendo wa Mauzo, Malengo na Pesa Unayobaki' : 'Sales Revenue, Target & Money You Keep'}
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#605E5C] mt-0.5">
                    {isSw ? 'Ulinganifu wa Mauzo halisi dhidi ya Lengo la duka na Faida' : 'Comparative performance tracking gross sales against targets'}
                  </p>
                </div>

                <div className="flex items-center bg-[#F3F2F1] p-0.5 rounded-lg border border-[#EDEBE9] text-xs font-bold">
                  <button
                    onClick={() => setChartTimeRange('7d')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      chartTimeRange === '7d' ? 'bg-white text-[#6264A7] shadow-xs' : 'text-[#605E5C] hover:text-[#323130]'
                    }`}
                  >
                    {isSw ? 'Siku 7' : '7 Days'}
                  </button>
                  <button
                    onClick={() => setChartTimeRange('30d')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      chartTimeRange === '30d' ? 'bg-white text-[#6264A7] shadow-xs' : 'text-[#605E5C] hover:text-[#323130]'
                    }`}
                  >
                    {isSw ? 'Mwezi' : '30 Days'}
                  </button>
                  <button
                    onClick={() => setChartTimeRange('quarter')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      chartTimeRange === 'quarter' ? 'bg-white text-[#6264A7] shadow-xs' : 'text-[#605E5C] hover:text-[#323130]'
                    }`}
                  >
                    {isSw ? 'Robo Mwaka' : 'Quarter'}
                  </button>
                </div>
              </div>

              {/* Recharts Composed Chart */}
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activeSalesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6264A7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6264A7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F2F1" vertical={false} />
                    <XAxis 
                      dataKey="short" 
                      tick={{ fontSize: 11, fill: '#605E5C', fontWeight: 600 }} 
                      axisLine={{ stroke: '#EDEBE9' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#605E5C' }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#1E2244] text-white p-3 rounded-xl shadow-xl border border-white/10 text-xs">
                              <div className="font-black text-amber-300 border-b border-white/10 pb-1 mb-1.5 flex justify-between">
                                <span>{data.name}</span>
                                <span>{data.orders} orders</span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-4 text-slate-200">
                                  <span>Mauzo (Revenue):</span>
                                  <strong className="text-white">{formatTSh(data.revenue)}</strong>
                                </div>
                                <div className="flex justify-between gap-4 text-slate-300">
                                  <span>Lengo (Target):</span>
                                  <span className="text-slate-300">{formatTSh(data.target)}</span>
                                </div>
                                <div className="flex justify-between gap-4 text-emerald-400 font-bold border-t border-white/10 pt-1">
                                  <span>{isSw ? 'Pesa Unayobaki:' : 'Money You Keep:'}</span>
                                  <span>{formatTSh(data.netProfit)} ({data.margin}%)</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontWeight: 'bold' }} 
                    />
                    <Bar dataKey="target" name={isSw ? 'Lengo (Target)' : 'Target'} fill="#E2E8F0" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Area type="monotone" dataKey="revenue" name={isSw ? 'Mauzo Halisi' : 'Actual Revenue'} stroke="#6264A7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                    <Line type="monotone" dataKey="netProfit" name={isSw ? 'Pesa Unayobaki' : 'Money You Keep'} stroke="#107C10" strokeWidth={2.5} dot={{ r: 4, fill: '#107C10' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-3 border-t border-[#F3F2F1] flex flex-wrap items-center justify-between text-xs text-[#605E5C]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#323130]">{isSw ? 'Muhtasari wa Kipindi:' : 'Period summary:'}</span>
                  <span>
                    {hasSalesData ? (
                      <>
                        {isSw ? 'Wastani wa mauzo kwa siku ni ' : 'Average daily sales: '}
                        <strong className="text-[#6264A7]">{formatTSh(avgDailySales)}</strong>
                      </>
                    ) : (
                      <span>{isSw ? 'Hakuna mauzo bado — anza kutumia POS.' : 'No sales yet — start using POS.'}</span>
                    )}
                  </span>
                </div>
                <button 
                  onClick={() => onNavigate('bi-analytics')}
                  className="text-xs text-[#0078D4] hover:underline font-bold flex items-center gap-1"
                >
                  <span>{isSw ? 'Angalia Faida na Gharama' : 'View Profit & Costs'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right 1 Col: Recharts Donut PieChart - Payment Channels */}
            <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-[#6264A7]" />
                    <h3 className="font-bold text-sm text-[#323130]">
                      {isSw ? 'Njia za Malipo Zilizotumika' : 'Payment Methods Share'}
                    </h3>
                  </div>
                  {topPaymentMethod && topPaymentMethod.value > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {topPaymentMethod.name} #1
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {isSw ? 'Hakuna data' : 'No data'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#605E5C] mb-2">
                  {isSw ? 'Asilimia ya pesa zilizokusanywa kwa M-Pesa, Cash, Airtel na Tigo' : 'Distribution of revenue across settlement channels'}
                </p>

                {/* Donut Chart */}
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {paymentMethodsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#1E2244] text-white px-2.5 py-1.5 rounded-lg shadow-lg text-xs">
                                <div className="font-bold">{data.name}</div>
                                <div className="text-amber-300">{formatTSh(data.value)} ({data.percent}%)</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Compact Legend List */}
                <div className="space-y-1.5 mt-1">
                  {paymentMethodsData.map((pm) => (
                    <div key={pm.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pm.color }}></span>
                        <span className="text-[#323130] font-medium">{pm.name}</span>
                      </div>
                      <span className="font-bold text-[#605E5C]">{formatTSh(pm.value)} ({pm.percent}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F3F2F1]">
                <button
                  onClick={() => onNavigate('expenses-payroll')}
                  className="w-full py-2 rounded-xl bg-[#F3F2F1] hover:bg-[#EDEBE9] text-[#6264A7] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{isSw ? 'Angalia Matumizi & Mishahara' : 'Manage Expenses & Payroll'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PRODUCT & TERRITORY PERFORMANCE INSIGHTS (AI GEO-MATRIX PREVIEW) */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs space-y-4">
            {/* Header & Quick Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#F3F2F1]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-[#323130]">
                        {isSw ? 'Uchambuzi wa Mauzo ya Bidhaa & Wateja kwa Maeneo' : 'Product Sales Velocity & Territory Intelligence'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        AI Matrix Active
                      </span>
                    </div>
                    <p className="text-xs text-[#605E5C] mt-0.5">
                      {isSw 
                        ? 'Bainisha bidhaa zinazouza zaidi, bidhaa zinazolala, tabia za wateja na fursa za kukuza mauzo mtaani.'
                        : 'Track fast vs. slow-moving SKUs, customer buying patterns, and high-velocity geographic corridors.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* View Matrix CTA */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('product-geo-matrix')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                >
                  <Compass className="w-4 h-4 text-emerald-200" />
                  <span>{isSw ? 'Jedwali Kamili la Maeneo & Wateja' : 'Open Full Geo Matrix'}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </div>

            {/* Quick 4-Insight Mini KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <div className="flex items-center justify-between text-xs text-emerald-900 font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    {isSw ? `${productNoun} Inayoongoza` : 'Top Selling SKU'}
                  </span>
                  {topProductPreview && (
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">#1 {isSw ? 'Mauzo' : 'Sales'}</span>
                  )}
                </div>
                {topProductPreview ? (
                  <>
                    <div className="text-sm font-black text-slate-900 truncate">{topProductPreview.name}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-800">
                      <span>{topProductPreview.unitsSold} {isSw ? 'vipande' : 'units'} ({formatTSh(topProductPreview.revenue)})</span>
                      <span className="font-semibold text-slate-600 truncate max-w-[100px]">{topProductPreview.topTerritory}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-emerald-800">{isSw ? 'Hakuna mauzo bado' : 'No sales recorded yet'}</div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80">
                <div className="flex items-center justify-between text-xs text-rose-900 font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    {isSw ? `${productNoun} Inayolala` : 'Slow Moving SKU'}
                  </span>
                  {slowProductPreview && (
                    <span className="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded font-bold">
                      {slowProductPreview.stagnantDays} {isSw ? 'siku' : 'days'}
                    </span>
                  )}
                </div>
                {slowProductPreview ? (
                  <>
                    <div className="text-sm font-black text-slate-900 truncate">{slowProductPreview.name}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-rose-800">
                      <span>{slowProductPreview.unitsSold} {isSw ? 'vilivyouzwa' : 'sold'} • {isSw ? 'Akiba' : 'Stock'} {slowProductPreview.stock}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-rose-800">{isSw ? 'Hakuna bidhaa za polepole bado' : 'No slow movers identified'}</div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/80">
                <div className="flex items-center justify-between text-xs text-sky-900 font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    {isSw ? 'Eneo Linaloongoza' : 'Top Territory'}
                  </span>
                  {topTerritoryPreview && (
                    <span className="text-[10px] bg-sky-200 text-sky-900 px-1.5 py-0.2 rounded font-bold">{topTerritoryPreview.share} Share</span>
                  )}
                </div>
                {topTerritoryPreview ? (
                  <>
                    <div className="text-sm font-black text-slate-900 truncate">{topTerritoryPreview.name}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-sky-800">
                      <span>{formatTSh(topTerritoryPreview.revenue)}</span>
                      <span className="font-semibold text-slate-600">{topTerritoryPreview.activeClients} {isSw ? 'Wateja Hai' : 'Active Clients'}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-sky-800">{isSw ? 'Ongeza anwani za wateja kwa uchambuzi wa maeneo' : 'Add customer addresses for territory insights'}</div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
                <div className="flex items-center justify-between text-xs text-amber-900 font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    {isSw ? 'Fursa ya Haraka ya AI' : 'AI Growth Upsell'}
                  </span>
                  {topCrossSellPreview && (
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">{topCrossSellPreview.expectedValue}</span>
                  )}
                </div>
                {topCrossSellPreview ? (
                  <>
                    <div className="text-sm font-black text-slate-900 truncate">{topCrossSellPreview.recommendedAddon}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800">
                      <span className="truncate">{topCrossSellPreview.boughtProduct} → {topCrossSellPreview.recommendedAddon}</span>
                      <span className="font-semibold text-emerald-700 shrink-0">{topCrossSellPreview.confidence}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-amber-800">{isSw ? 'Inahitaji mauzo na wateja waliosajiliwa' : 'Needs sales history with registered customers'}</div>
                )}
              </div>
            </div>

            {/* Interactive Lens Switcher Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5 bg-[#F3F2F1] p-1 rounded-xl border border-[#E1DFDD] text-xs font-bold">
                <button
                  onClick={() => setProductInsightTab('best')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    productInsightTab === 'best'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-[#605E5C] hover:text-[#323130]'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isSw ? 'Bidhaa Zinazoongoza (Best Sellers)' : 'Top Moving SKUs'}</span>
                </button>
                <button
                  onClick={() => setProductInsightTab('slow')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    productInsightTab === 'slow'
                      ? 'bg-white text-rose-800 shadow-xs'
                      : 'text-[#605E5C] hover:text-[#323130]'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  <span>{isSw ? 'Zinazolala & Ushauri (Slow Movers)' : 'Slow Movers & Action'}</span>
                </button>
                <button
                  onClick={() => setProductInsightTab('territories')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    productInsightTab === 'territories'
                      ? 'bg-white text-sky-800 shadow-xs'
                      : 'text-[#605E5C] hover:text-[#323130]'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-sky-600" />
                  <span>{isSw ? 'Mgao kwa Maeneo (Territories)' : 'Territory Breakdown'}</span>
                </button>
                <button
                  onClick={() => setProductInsightTab('crosssell')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    productInsightTab === 'crosssell'
                      ? 'bg-white text-amber-800 shadow-xs'
                      : 'text-[#605E5C] hover:text-[#323130]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isSw ? 'Fursa za AI (Cross-Sell Bundles)' : 'AI Cross-Sell Pairs'}</span>
                </button>
              </div>

              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>
                  {isSw
                    ? `Data kutoka mauzo halisi • ${businessLabel}`
                    : `Live from your sales • ${businessLabel}`}
                </span>
              </div>
            </div>

            {/* TAB CONTENT 1: BEST MOVING PRODUCTS */}
            {productInsightTab === 'best' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {productInsightsSummary.bestMoving.length === 0 ? (
                  <div className="col-span-full p-6 text-center text-xs text-[#605E5C] rounded-xl bg-[#F8F8F8] border border-[#EDEBE9]">
                    {isSw ? 'Hakuna mauzo bado — bidhaa zinazoongoza zitaonekana hapa.' : 'No sales yet — top sellers will appear here.'}
                  </div>
                ) : productInsightsSummary.bestMoving.map((item, idx) => (
                  <div 
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 transition-all shadow-xs flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.margin} Faida
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-slate-500">{item.category}</p>

                      <div className="mt-2.5 p-2 rounded-lg bg-slate-50 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-700">
                          <span>{isSw ? 'Vipande Vilivyouzwa:' : 'Units Sold:'}</span>
                          <strong className="text-slate-900">{item.unitsSold} pcs</strong>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>{isSw ? 'Mapato ya Mauzo:' : 'Revenue:'}</span>
                          <strong className="text-emerald-700">{formatTSh(item.revenue)}</strong>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>{isSw ? 'Kasi ya Mzunguko:' : 'Velocity:'}</span>
                          <span className="text-emerald-600 font-semibold">{item.velocity}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Mteja Mkuu:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[120px]">{item.topCustomer}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Eneo Kuu:</span>
                        <span className="font-semibold text-slate-700 truncate max-w-[120px]">{item.topTerritory}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT 2: SLOW MOVING PRODUCTS & ACTIONABLE RESOLUTIONS */}
            {productInsightTab === 'slow' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {productInsightsSummary.slowMoving.length === 0 ? (
                  <div className="col-span-full p-6 text-center text-xs text-[#605E5C] rounded-xl bg-[#F8F8F8] border border-[#EDEBE9]">
                    {isSw ? 'Hakuna bidhaa za polepole zilizotambuliwa bado.' : 'No slow-moving products identified yet.'}
                  </div>
                ) : productInsightsSummary.slowMoving.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 rounded-xl border border-rose-200/90 bg-rose-50/20 hover:border-rose-400 transition-all shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" />
                          Siku {item.stagnantDays} Bila Mauzo
                        </span>
                        <span className="text-[10px] font-bold text-slate-600">
                          Akiba: <strong className="text-rose-700">{item.stock} pcs</strong>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                      <p className="text-[10px] text-slate-500 mb-2">{item.category} • Eneo Lililolala: {item.laggingTerritory}</p>

                      <div className="p-2.5 rounded-lg bg-white border border-rose-100 text-[11px] text-slate-700 space-y-1">
                        <div className="text-[10px] font-bold text-rose-800 flex items-center gap-1">
                          <Bot className="w-3 h-3 text-rose-600" />
                          {isSw ? 'Ushauri wa AI (Action Plan):' : 'AI Actionable Recommendation:'}
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                          {item.aiRecommendation}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-rose-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          if (onOpenAIChatWithPrompt) {
                            onOpenAIChatWithPrompt(`Nipe mkakati wa kutoa ofa na kuuza haraka stoo ya ${item.name} yenye vipande ${item.stock} vilivyolala siku ${item.stagnantDays} katika maeneo ya ${item.laggingTerritory}.`);
                          } else {
                            onOpenAIChat();
                          }
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <MessageSquareQuote className="w-3 h-3" />
                        <span>{isSw ? 'Unda Mkakati wa Ofa (AI)' : 'Generate Promo Strategy'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT 3: TERRITORY SALES MATRIX */}
            {productInsightTab === 'territories' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {productInsightsSummary.territories.length === 0 ? (
                  <div className="col-span-full p-6 text-center text-xs text-[#605E5C] rounded-xl bg-[#F8F8F8] border border-[#EDEBE9]">
                    {isSw ? 'Ongeza anwani za wateja na mauzo ili kuona mgao wa maeneo.' : 'Add customer addresses and sales to see territory breakdown.'}
                  </div>
                ) : productInsightsSummary.territories.map((terr) => (
                  <div 
                    key={terr.name}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-sky-500 transition-all shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {terr.share} ya Mauzo
                        </span>
                        <span className="text-[11px] font-bold text-slate-600">{terr.activeClients} Wateja</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{terr.name}</h4>
                      
                      <div className="mt-2 text-lg font-black text-slate-900">{formatTSh(terr.revenue)}</div>

                      {/* Share Progress Bar */}
                      <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-sky-600 h-1.5 rounded-full" 
                          style={{ width: terr.share }}
                        ></div>
                      </div>

                      <div className="mt-3 p-2 rounded-lg bg-slate-50 text-[11px] text-slate-700 space-y-0.5">
                        <div className="text-[10px] text-slate-500 font-semibold">{isSw ? 'Bidhaa Inayouza Zaidi:' : 'Top Moving Product:'}</div>
                        <div className="font-bold text-emerald-800 line-clamp-1">{terr.topProduct}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('product-geo-matrix')}
                      className="mt-3 w-full py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <span>{isSw ? 'Fungua Matrix ya Eneo Hili' : 'Analyze Territory'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT 4: AI CROSS-SELL BUNDLES */}
            {productInsightTab === 'crosssell' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {productInsightsSummary.crossSellOpportunities.length === 0 ? (
                  <div className="col-span-full p-6 text-center text-xs text-[#605E5C] rounded-xl bg-[#F8F8F8] border border-[#EDEBE9]">
                    {isSw ? 'Inahitaji wateja waliosajiliwa na historia ya mauzo kwa mapendekezo ya cross-sell.' : 'Needs registered customers with purchase history for cross-sell suggestions.'}
                  </div>
                ) : productInsightsSummary.crossSellOpportunities.map((opp) => (
                  <div 
                    key={opp.id}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50/25 hover:border-amber-400 transition-all shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center">
                            {opp.customer[0]}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900">{opp.customer}</div>
                            <div className="text-[10px] text-slate-500">{opp.territory} • {opp.phone}</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                          {opp.confidence}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-white border border-amber-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">{isSw ? 'Anachonunua Sasa:' : 'Current Purchase:'}</span>
                          <strong className="text-slate-800 line-clamp-1">{opp.boughtProduct}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                          <span className="text-[10px] text-emerald-700 font-semibold block">{isSw ? 'Pendekezo la AI la Kuongeza:' : 'AI Cross-Sell SKU:'}</span>
                          <strong className="text-emerald-900 line-clamp-1">{opp.recommendedAddon}</strong>
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-amber-100/70 leading-relaxed font-medium">
                        💡 {opp.rationale}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-amber-100 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-500 text-[10px] block">{isSw ? 'Mapato Yanayoongezeka:' : 'Expected Upsell:'}</span>
                        <strong className="text-emerald-700 font-black">{opp.expectedValue}</strong>
                      </div>

                      <button
                        onClick={() => handleSendQuickPromo(opp.id, opp.customer)}
                        disabled={quickPromoSent === opp.id}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          quickPromoSent === opp.id
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-xs'
                        }`}
                      >
                        {quickPromoSent === opp.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>SMS ya Ofa Imetumwa!</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSw ? 'Tuma SMS ya Ofa' : 'Dispatch Promo SMS'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AI Strategic Synthesis Takeaway Banner */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-white/10 text-amber-300 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-amber-300">
                    {isSw ? 'Ushauri wa Mkakati wa AI (Gemini 3.7 Flash):' : 'AI Strategic Synthesis Takeaway:'}
                  </h4>
                  <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                    {strategyHint}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (onOpenAIChatWithPrompt) {
                    onOpenAIChatWithPrompt('Fanya uchambuzi wa kina wa mauzo ya bidhaa kwa kila mteja na eneo. Niambie bidhaa gani inalala, wapi inauzwa kidogo, na nini mikakati ya kuongeza faida wiki hii.');
                  } else {
                    onOpenAIChat();
                  }
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-sky-300" />
                <span>{isSw ? 'Uliza AI Mkakati' : 'Consult AI'}</span>
              </button>
            </div>
          </div>

          {/* CHARTS ROW 2: Hourly Rush Hours BarChart + AI Predictive Demand Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Col: Hourly Sales Velocity & Rush Hours */}
            <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#0078D4]" />
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Muda wa Wateja Wengi Dukani (Peak Rush Hours)' : 'Customer Rush Hours & Hourly Sales Velocity'}
                  </h3>
                </div>
                {peakHours.hasData ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {peakHours.badge}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {peakHours.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#605E5C] mb-3">
                {isSw 
                  ? 'Bainisha masaa ya duka kuwa na foleni ili kupanga zamu za wahudumu (Cashiers) vizuri.' 
                  : 'Identify peak shopping hours to allocate floor staff and cashier shifts effectively.'}
              </p>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyRushData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F2F1" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 10, fill: '#605E5C', fontWeight: 600 }} 
                      axisLine={{ stroke: '#EDEBE9' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#605E5C' }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#1E2244] text-white p-2.5 rounded-xl shadow-lg text-xs">
                              <div className="font-black text-sky-300">{data.hour} {data.isPeak ? '🔥 (Saa ya Foleni)' : ''}</div>
                              <div className="text-white font-bold">{formatTSh(data.sales)}</div>
                              <div className="text-slate-300 text-[11px]">{data.orders} wateja walihudumiwa</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="sales" 
                      radius={[4, 4, 0, 0]}
                    >
                      {hourlyRushData.map((entry, index) => (
                        <Cell 
                          key={`bar-${index}`} 
                          fill={entry.isPeak ? '#6264A7' : '#94A3B8'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-[#605E5C] bg-[#F8F8F8] p-2.5 rounded-xl border border-[#EDEBE9]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6264A7]"></span>
                  <span className="font-semibold text-[#323130]">{peakHours.summary}</span>
                </div>
                <button 
                  onClick={() => onNavigate('staff')}
                  className="text-xs text-[#0078D4] hover:underline font-bold"
                >
                  {isSw ? 'Simamia Watu & HR →' : 'Manage People & HR →'}
                </button>
              </div>
            </div>

            {/* Right Col: AI-Powered Predictive Demand & Reorder Simulator */}
            <div className="bg-gradient-to-br from-[#FAF9F8] to-[#F0F2FA] rounded-2xl p-5 border border-[#6264A7]/30 shadow-xs relative">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-amber-400/20 text-amber-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Utabiri wa AI: Kupungua kwa Akiba & Kuagiza' : 'AI Predictive Restock Simulation'}
                  </h3>
                </div>
                {forecastProduct && hasSalesData && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6264A7] text-white shadow-xs">
                    {forecastProduct.name}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[#605E5C] mb-3">
                {forecastProduct
                  ? (isSw
                    ? `Mfanano wa siku 14 zijazo kwa ${forecastProduct.name} (akiba ${forecastProduct.stock}).`
                    : `14-day depletion forecast for ${forecastProduct.name} (stock: ${forecastProduct.stock}).`)
                  : (isSw ? 'Ongeza bidhaa kwenye stoo ili kuona utabiri.' : 'Add products to inventory to see forecasts.')}
              </p>

              {/* Scenario Toggles */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={() => setAiScenario('baseline')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    aiScenario === 'baseline' 
                      ? 'bg-[#6264A7] text-white shadow-xs' 
                      : 'bg-white text-[#605E5C] border border-[#E1DFDD] hover:bg-slate-50'
                  }`}
                >
                  📊 Kawaida (Baseline)
                </button>
                <button
                  onClick={() => setAiScenario('rainy_season')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    aiScenario === 'rainy_season' 
                      ? 'bg-rose-600 text-white shadow-xs' 
                      : 'bg-white text-[#605E5C] border border-[#E1DFDD] hover:bg-slate-50'
                  }`}
                >
                  🌧️ Msimu wa Mvua (+30%)
                </button>
                <button
                  onClick={() => setAiScenario('promo')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    aiScenario === 'promo' 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'bg-white text-[#605E5C] border border-[#E1DFDD] hover:bg-slate-50'
                  }`}
                >
                  🏷️ Kampeni ya Bei (+50%)
                </button>
                <button
                  onClick={() => setAiScenario('delay')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    aiScenario === 'delay' 
                      ? 'bg-indigo-700 text-white shadow-xs' 
                      : 'bg-white text-[#605E5C] border border-[#E1DFDD] hover:bg-slate-50'
                  }`}
                >
                  🚚 Ucheleweshaji wa Msambazaji
                </button>
              </div>

              {/* AI Composed Simulation Chart */}
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={aiForecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1DFDD" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 10, fill: '#605E5C', fontWeight: 600 }} 
                      axisLine={{ stroke: '#EDEBE9' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#605E5C' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#1E2244] text-white p-2.5 rounded-xl shadow-xl text-xs">
                              <div className="font-bold text-amber-300">{data.day}</div>
                              {data.actualStock !== null && (
                                <div className="text-white">Akiba Iliyopo: {data.actualStock} pcs</div>
                              )}
                              {data.forecastDemand !== null && (
                                <div className="text-sky-300 font-bold">Utabiri wa AI: {data.forecastDemand} pcs</div>
                              )}
                              <div className="text-rose-400 text-[10px]">Kiwango cha Hatari: {data.safetyStock} pcs</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={forecastProduct?.reorderPoint ?? 0} stroke="#D13438" strokeDasharray="3 3" label={{ value: isSw ? 'Hatari (Reorder)' : 'Reorder level', fill: '#D13438', fontSize: 10, position: 'right' }} />
                    <Area type="monotone" dataKey="actualStock" name="Akiba ya Sasa" stroke="#6264A7" fill="#6264A7" fillOpacity={0.2} strokeWidth={2} />
                    <Line type="monotone" dataKey="forecastDemand" name="Utabiri wa Kupungua (AI)" stroke="#0284C7" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3, fill: '#0284C7' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom Simulation Action Bar */}
              <div className="mt-3 flex items-center justify-between pt-3 border-t border-[#E1DFDD]/70">
                <div className="text-xs text-[#323130]">
                  {reorderHint.urgent ? (
                    <span className="text-rose-700 font-bold">⚠️ {reorderHint.message}</span>
                  ) : (
                    <span className="text-[#605E5C] font-semibold">{reorderHint.message}</span>
                  )}
                </div>

                <button
                  onClick={handleTriggerAutoPO}
                  disabled={autoPoSuccess}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6264A7] hover:bg-[#525492] text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                >
                  {autoPoSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>PO Imeundwa! Inafunguka...</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-3.5 h-3.5" />
                      <span>{isSw ? 'Unda Agizo (Auto PO)' : 'Auto-Generate PO'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ROW 3: DEBTORS TABLE & RECENT TRANSACTIONS STREAM */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Debtors Table with 1-Click SMS */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#6264A7]" />
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Wateja Wenye Madeni Makubwa (Credit Debtors)' : 'Top Debtors & Overdue Follow-up'}
                  </h3>
                </div>
                <button 
                  onClick={() => onNavigate('customers')}
                  className="text-xs text-[#0078D4] hover:underline font-bold"
                >
                  {isSw ? 'Tazama Wateja Wote →' : 'View All Debtors →'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F3F2F1] text-[#605E5C] font-semibold">
                      <th className="pb-2.5">{isSw ? 'Mteja' : 'Customer'}</th>
                      <th className="pb-2.5">{isSw ? 'Simu' : 'Phone'}</th>
                      <th className="pb-2.5">{isSw ? 'Deni Lililopo' : 'Balance'}</th>
                      <th className="pb-2.5">{isSw ? 'Siku Zilizopita' : 'Overdue'}</th>
                      <th className="pb-2.5 text-right">{isSw ? 'Hatua ya SMS' : 'Dunning Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F2F1]">
                    {topCreditCustomers.filter(c => c.balance > 0).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#605E5C] text-xs">
                          {isSw ? 'Hakuna wateja wenye madeni kwa sasa.' : 'No customers with outstanding credit.'}
                        </td>
                      </tr>
                    ) : topCreditCustomers.filter(c => c.balance > 0).map((cust) => (
                      <tr key={cust.id} className="hover:bg-[#FAF9F8] transition-colors">
                        <td className="py-2.5 font-bold text-[#323130]">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full ${cust.avatarColor} text-white font-bold text-[11px] flex items-center justify-center`}>
                              {cust.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span>{cust.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-[#605E5C] font-mono">{cust.phone}</td>
                        <td className="py-2.5 font-extrabold text-rose-600">{formatTSh(cust.balance)}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                            {cust.daysOverdue ?? 0} {isSw ? 'siku' : 'days'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleSendDunningSms(cust)}
                            disabled={isDunningSent[cust.id]}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ml-auto transition-all cursor-pointer ${
                              isDunningSent[cust.id]
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-[#6264A7] hover:bg-[#525492] text-white shadow-xs'
                            }`}
                          >
                            {isDunningSent[cust.id] ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>SMS Imetumwa</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3 h-3" />
                                <span>Tuma SMS Lipa</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Col: Live POS Stream & Fast Shortcuts */}
            <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#107C10]" />
                    <h3 className="font-bold text-sm text-[#323130]">
                      {isSw ? 'Stakabadhi za Hivi Karibuni' : 'Recent POS Receipts'}
                    </h3>
                  </div>
                  <span className="text-[10px] text-[#107C10] font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#107C10] animate-ping"></span>
                    {taxSettings.mode === 'tra_efd' ? 'Live EFD' : (isSw ? 'Mauzo Hai' : 'Live Sales')}
                  </span>
                </div>

                <div className="space-y-2">
                  {sales.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#605E5C] rounded-xl bg-[#F8F8F8] border border-[#EDEBE9]">
                      {isSw ? 'Hakuna stakabadhi bado — fungua POS kuanza.' : 'No receipts yet — open POS to start selling.'}
                    </div>
                  ) : sales.slice(0, 3).map((sale) => (
                    <div key={sale.id} className="p-2.5 rounded-xl bg-[#F8F8F8] border border-[#EDEBE9] flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#323130]">{sale.receiptNumber}</div>
                        <div className="text-[11px] text-[#605E5C]">{sale.customerName || 'Mteja wa Pesa Taslimu'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-[#107C10]">{formatTSh(sale.total)}</div>
                        <div className="text-[10px] text-[#605E5C] uppercase font-bold">{sale.payments[0]?.method || 'Cash'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F3F2F1] space-y-2">
                <button
                  onClick={() => onNavigate('pos')}
                  className="w-full py-2.5 rounded-xl bg-[#107C10] hover:bg-[#0E6A0E] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isSw ? 'Fungua POS' : 'Open POS Register'}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 3. CASHIER / STAFF SHIFT MODE SECTION */}
      {/* ========================================================================= */}
      {viewMode === 'cashier_shift' && (
        <div className="space-y-5">
          {shiftMsg && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              {shiftMsg}
            </div>
          )}

          {/* Shift gate strip */}
          <div
            className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              openShift
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-rose-50 border-rose-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl ${openShift ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {openShift ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#323130]">
                  {openShift
                    ? (isSw ? 'Zamu ikiwa wazi' : 'Shift is open')
                    : (isSw ? 'Zamu imefungwa — fungua kabla ya kuuza' : 'Shift closed — open before selling')}
                </div>
                <div className="text-[11px] text-[#605E5C] mt-0.5">
                  {openShift
                    ? `${isSw ? 'Ilifunguliwa' : 'Opened'}: ${new Date(openShift.openedAt).toLocaleString()} · ${isSw ? 'Float' : 'Float'}: ${formatTSh(openShift.openingFloat)}`
                    : (isSw
                      ? 'Lazima ufungue zamu ili POS ifanye kazi.'
                      : 'You must open a shift before POS will work.')}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!openShift ? (
                <>
                  <input
                    type="number"
                    min={0}
                    value={openingFloat}
                    onChange={e => setOpeningFloat(e.target.value)}
                    placeholder={isSw ? 'Float ya kuanza' : 'Opening float'}
                    className="w-28 px-2 py-1.5 rounded-lg border border-[#E1DFDD] text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleOpenShift}
                    className="px-3 py-2 rounded-xl bg-[#0F2347] text-white text-xs font-bold cursor-pointer"
                  >
                    {isSw ? 'Fungua Zamu' : 'Open Shift'}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min={0}
                    value={closingCash}
                    onChange={e => setClosingCash(e.target.value)}
                    placeholder={isSw ? 'Hesabu cash' : 'Count cash'}
                    className="w-28 px-2 py-1.5 rounded-lg border border-[#E1DFDD] text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleCloseShift}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {isSw ? 'Funga Zamu' : 'Close Shift'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
            <div className="rounded-2xl bg-[#0F2347] text-white p-5 shadow-md border border-[#0F2347]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/60 font-bold">
                    {isSw ? 'Dashibodi ya Keshia' : 'Cashier dashboard'}
                  </div>
                  <h3 className="text-xl font-black mt-1">
                    {shiftCashierStats.cashierName}
                    <span className="text-white/50 font-semibold text-sm"> · {shiftCashierStats.shiftName}</span>
                  </h3>
                  <p className="text-xs text-white/70 mt-1">
                    {currentUser?.location || businessLabel}
                    {taxSettings.mode === 'tra_efd' ? ' · TRA EFD' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={goPos}
                  disabled={!openShift && persona === 'cashier'}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-md inline-flex items-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {isSw ? 'Uza Sasa (POS)' : 'Sell now (POS)'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
                {[
                  { label: isSw ? 'Mauzo leo' : 'Sales today', value: formatTSh(shiftCashierStats.shiftSalesTotal), sub: `${shiftCashierStats.receiptsIssued} ${isSw ? 'risiti' : 'receipts'}` },
                  { label: 'Cash', value: formatTSh(shiftCashierStats.cashDrawerBalance), sub: isSw ? 'Droo' : 'Drawer' },
                  { label: 'M-Pesa / Airtel', value: formatTSh(shiftCashierStats.mpesaCollected + shiftCashierStats.airtelCollected), sub: isSw ? 'Simu' : 'Mobile' },
                  { label: isSw ? 'Lengo' : 'Target', value: formatTSh(shiftCashierStats.shiftTarget), sub: shiftCashierStats.shiftTarget > 0 ? `${Math.min(100, Math.round((shiftCashierStats.shiftSalesTotal / shiftCashierStats.shiftTarget) * 100))}%` : '—' },
                ].map(k => (
                  <div key={k.label} className="rounded-xl bg-white/8 border border-white/10 p-3">
                    <div className="text-[10px] text-white/60 font-semibold uppercase tracking-wide">{k.label}</div>
                    <div className="text-base font-black mt-1 tabular-nums">{k.value}</div>
                    <div className="text-[10px] text-emerald-300/90 mt-0.5">{k.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            <TodaySalesHeroKpi
              stats={todaySalesStats}
              isSw={isSw}
              variant="staff"
              staffName={shiftCashierStats.cashierName}
              onClick={goPos}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-[#E1DFDD] shadow-xs">
              <h4 className="font-bold text-sm text-[#323130] mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                {isSw ? 'Vitendo vya haraka' : 'Quick actions'}
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={goPos} className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left cursor-pointer">
                  <ShoppingBag className="w-5 h-5 text-emerald-600 mb-1" />
                  <div className="font-bold text-xs">{isSw ? 'POS' : 'POS sale'}</div>
                </button>
                {canViewStock && (
                  <button type="button" onClick={() => onNavigate('inventory')} className="p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left cursor-pointer">
                    <Boxes className="w-5 h-5 text-blue-600 mb-1" />
                    <div className="font-bold text-xs">{isSw ? canEditStock ? 'Stoo' : 'Angalia stoo' : canEditStock ? 'Inventory' : 'View stock'}</div>
                    {!canEditStock && <div className="text-[10px] text-[#605E5C]">{isSw ? 'Soma tu' : 'Read-only'}</div>}
                  </button>
                )}
                <button type="button" onClick={() => onNavigate('customers')} className="p-3 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-left cursor-pointer">
                  <Users className="w-5 h-5 text-violet-600 mb-1" />
                  <div className="font-bold text-xs">{isSw ? 'Wateja' : 'Customers'}</div>
                </button>
                <button type="button" onClick={() => onNavigate('transaction-history')} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left cursor-pointer">
                  <Clock className="w-5 h-5 text-slate-600 mb-1" />
                  <div className="font-bold text-xs">{isSw ? 'Historia' : 'History'}</div>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-[#E1DFDD] shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-[#323130] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  {isSw ? 'Stoo chini' : 'Low stock'}
                </h4>
                <span className="text-xs text-rose-600 font-bold">{lowStockProducts.length}</span>
              </div>
              <div className="space-y-2">
                {lowStockProducts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[#605E5C] rounded-xl bg-emerald-50 border border-emerald-100">
                    {isSw ? 'Akiba salama.' : 'Stock looks healthy.'}
                  </div>
                ) : (
                  lowStockProducts.slice(0, 4).map(prod => (
                    <div key={prod.id} className="p-2 rounded-xl bg-rose-50/60 border border-rose-100 flex justify-between text-xs gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-[#323130] truncate">{prod.name}</div>
                        <div className="text-[10px] text-[#605E5C]">{prod.sku}</div>
                      </div>
                      <div className="font-bold text-rose-700 shrink-0">{prod.stock} {prod.unit}</div>
                    </div>
                  ))
                )}
              </div>
              {canViewStock && (
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="mt-3 w-full py-2 rounded-lg bg-[#F3F2F1] text-[#0F2347] text-xs font-bold cursor-pointer"
                >
                  {isSw ? 'Orodha ya stoo →' : 'Full stock list →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Owner/manager: cashier performance board */}
      {viewMode === 'executive' && (persona === 'owner' || persona === 'manager') && (
        <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-4">
          <h4 className="font-bold text-sm text-[#323130] mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            {isSw ? 'Utendaji wa makeshia leo' : "Today's cashier performance"}
          </h4>
          {cashierLeaderboard.length === 0 ? (
            <p className="text-xs text-[#605E5C]">{isSw ? 'Hakuna mauzo ya makeshia leo bado.' : 'No cashier sales recorded yet today.'}</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#605E5C] border-b border-[#EDEBE9]">
                  <th className="py-2 pr-2">{isSw ? 'Keshia' : 'Cashier'}</th>
                  <th className="py-2 pr-2">{isSw ? 'Risiti' : 'Receipts'}</th>
                  <th className="py-2 pr-2">Cash</th>
                  <th className="py-2 pr-2">{isSw ? 'Simu' : 'Mobile'}</th>
                  <th className="py-2 text-right">{isSw ? 'Jumla' : 'Revenue'}</th>
                </tr>
              </thead>
              <tbody>
                {cashierLeaderboard.slice(0, 8).map(row => (
                  <tr key={row.cashierName} className="border-b border-[#F3F2F1]">
                    <td className="py-2 pr-2 font-semibold text-[#323130]">{row.cashierName}</td>
                    <td className="py-2 pr-2">{row.receipts}</td>
                    <td className="py-2 pr-2">{formatTSh(row.cash)}</td>
                    <td className="py-2 pr-2">{formatTSh(row.mobile)}</td>
                    <td className="py-2 text-right font-bold text-emerald-700">{formatTSh(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* FULL WIDTH ACTION BAR — role-aware */}
      <ActionBar
        language={language}
        onAdd={goPos}
        onEdit={canEditStock ? () => onNavigate('inventory') : canViewStock ? () => onNavigate('inventory') : undefined}
        onView={() => onNavigate('transaction-history')}
        onAISuggest={onOpenAIChat}
        onExport={persona === 'cashier' ? undefined : handleExportDashboard}
        customAddLabel={isSw ? '➕ Mauzo (POS)' : '➕ POS Sale'}
        customEditLabel={
          canEditStock
            ? (isSw ? 'Stoo' : 'Inventory')
            : canViewStock
              ? (isSw ? 'Angalia stoo' : 'View stock')
              : undefined
        }
        customViewLabel={isSw ? 'Historia' : 'History'}
        totalCount={shiftCashierStats.receiptsIssued || sales.length}
      />
    </div>
  );
};
