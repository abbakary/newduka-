import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  Users, 
  Boxes, 
  Layers, 
  Sparkles, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  Lightbulb, 
  Coins, 
  Calendar, 
  Filter, 
  Receipt,
  Scissors,
  Zap,
  HelpCircle,
  Clock,
  Target
} from 'lucide-react';
import { 
  Customer, 
  ExpenseItem, 
  Language, 
  Product, 
  ProductBIInsight, 
  CustomerBIInsight, 
  SaleTransaction, 
  StaffMember, 
  Supplier 
} from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import {
  computeProductInsights,
  computeCustomerInsights,
  filterSalesByTimeRange,
  filterExpensesByTimeRange,
  computeMoMRevenueChange,
  computeCategoryProfitContribution,
  computeMonthlyPLTrend,
  buildCostSavingOpportunities,
} from '@/lib/biCompute';
import { computeTotalRevenue, computeTotalCOGS } from '@/lib/analyticsCompute';

interface BIAnalyticsDashboardProps {
  language: Language;
  sales: SaleTransaction[];
  products: Product[];
  customers: Customer[];
  expenses: ExpenseItem[];
  staffList: StaffMember[];
  suppliers: Supplier[];
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onNavigateToExpenses?: () => void;
  onNavigateToGeoMatrix?: () => void;
}

export const BIAnalyticsDashboard: React.FC<BIAnalyticsDashboardProps> = ({
  language,
  sales,
  products,
  customers,
  expenses,
  staffList,
  suppliers,
  onOpenAIChatWithPrompt,
  onNavigateToExpenses,
  onNavigateToGeoMatrix,
}) => {
  const isSw = language === 'sw';
  const t = (key: any) => getTranslation(language, key);

  // Time range selector
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [activeAnalysisView, setActiveAnalysisView] = useState<'overview' | 'products' | 'customers' | 'expenses' | 'cost_cutting'>('overview');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paretoFilter, setParetoFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');

  const scopedSales = useMemo(
    () => filterSalesByTimeRange(sales, timeRange),
    [sales, timeRange],
  );
  const scopedExpenses = useMemo(
    () => filterExpensesByTimeRange(expenses, timeRange),
    [expenses, timeRange],
  );

  const totalSalesRevenue = useMemo(() => computeTotalRevenue(scopedSales), [scopedSales]);
  const totalCOGS = useMemo(() => computeTotalCOGS(scopedSales, products), [scopedSales, products]);
  const momChange = useMemo(() => computeMoMRevenueChange(sales), [sales]);

  const grossProfit = totalSalesRevenue - totalCOGS;
  const grossMarginPercent = totalSalesRevenue > 0
    ? Math.round((grossProfit / totalSalesRevenue) * 1000) / 10
    : 0;

  const cogsSharePercent = totalSalesRevenue > 0
    ? Math.round((totalCOGS / totalSalesRevenue) * 1000) / 10
    : 0;

  const totalOperatingExpenses = useMemo(() => {
    return scopedExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [scopedExpenses]);

  const opexSharePercent = totalSalesRevenue > 0
    ? Math.round((totalOperatingExpenses / totalSalesRevenue) * 1000) / 10
    : 0;

  const netOperatingProfit = grossProfit - totalOperatingExpenses;
  const netProfitMarginPercent = totalSalesRevenue > 0
    ? Math.round((netOperatingProfit / totalSalesRevenue) * 1000) / 10
    : 0;

  const marginHealthLabel = netProfitMarginPercent >= 20
    ? (isSw ? 'Nzuri' : 'Healthy')
    : netProfitMarginPercent >= 5
      ? (isSw ? 'Wastani' : 'Fair')
      : totalSalesRevenue > 0
        ? (isSw ? 'Dhaifu' : 'Weak')
        : (isSw ? 'Hakuna data' : 'No data');

  const dailyBurnRate = totalOperatingExpenses > 0 ? Math.round(totalOperatingExpenses / 30) : 0;
  const breakevenDailySales = grossMarginPercent > 0
    ? Math.round(dailyBurnRate / (grossMarginPercent / 100))
    : 0;

  const totalMonthlyPayroll = useMemo(() => {
    const fromExpenses = scopedExpenses
      .filter(e => e.category === 'staff_salaries' || e.category === 'daily_stipends_food_transport')
      .reduce((acc, e) => acc + e.amount, 0);
    const fromStaff = staffList.reduce((acc, s) => acc + (s.baseSalary ?? 0), 0);
    return fromExpenses > 0 ? fromExpenses : fromStaff;
  }, [scopedExpenses, staffList]);

  const staffRevenueEfficiency = totalMonthlyPayroll > 0
    ? Math.round((totalSalesRevenue / totalMonthlyPayroll) * 10) / 10
    : 0;

  const productInsights: ProductBIInsight[] = useMemo(() => {
    return computeProductInsights(products, scopedSales);
  }, [products, scopedSales]);

  const categoryProfitRows = useMemo(
    () => computeCategoryProfitContribution(products, scopedSales),
    [products, scopedSales],
  );

  const monthlyPLTrend = useMemo(
    () => computeMonthlyPLTrend(sales, products, expenses, isSw),
    [sales, products, expenses, isSw],
  );

  const ytdGrowth = useMemo(() => {
    if (monthlyPLTrend.length < 2) return { percent: 0, hasData: false };
    const first = monthlyPLTrend[0].revenue;
    const last = monthlyPLTrend[monthlyPLTrend.length - 1].revenue;
    if (first === 0 && last === 0) return { percent: 0, hasData: false };
    if (first === 0) return { percent: 100, hasData: true };
    return { percent: Math.round(((last - first) / first) * 1000) / 10, hasData: true };
  }, [monthlyPLTrend]);

  const costSavingOps = useMemo(
    () => buildCostSavingOpportunities(productInsights, products, scopedExpenses, suppliers, isSw),
    [productInsights, products, scopedExpenses, suppliers, isSw],
  );

  const filteredProducts = useMemo(() => {
    return productInsights.filter(p => {
      if (paretoFilter !== 'all' && p.paretoClass !== paretoFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      return true;
    });
  }, [productInsights, paretoFilter, categoryFilter]);

  const customerInsights: CustomerBIInsight[] = useMemo(() => {
    return computeCustomerInsights(customers, scopedSales);
  }, [customers, scopedSales]);

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    scopedExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [scopedExpenses]);

  const categoryLabels: Record<string, { en: string; sw: string; color: string }> = {
    rent: { en: 'Premises Rent', sw: 'Kodi ya Pango', color: 'bg-rose-500 text-white' },
    supplier_settlements: { en: 'Supplier Settlements', sw: 'Malipo ya Wasambazaji', color: 'bg-purple-600 text-white' },
    staff_salaries: { en: 'Staff Salaries', sw: 'Mishahara ya Wafanyakazi', color: 'bg-indigo-600 text-white' },
    daily_stipends_food_transport: { en: 'Daily Food & Transport Allowances', sw: 'Posho za Kila Siku (Chakula & Nauli)', color: 'bg-emerald-600 text-white' },
    licenses_permits_brela_tmda: { en: 'Govt Permits & Licenses (TMDA/BRELA)', sw: 'Leseni & Vibali (TMDA/BRELA)', color: 'bg-blue-600 text-white' },
    utilities_luku: { en: 'Electricity (LUKU)', sw: 'Umeme wa LUKU (TANESCO)', color: 'bg-amber-500 text-white' },
    maintenance_repairs: { en: 'Repairs & Maintenance', sw: 'Matengenezo & Ukarabati', color: 'bg-orange-500 text-white' },
    marketing_sms: { en: 'Bulk SMS & Marketing', sw: 'Matangazo & SMS za Wateja', color: 'bg-sky-500 text-white' },
    petty_cash: { en: 'Petty Cash & Shop Supplies', sw: 'Matumizi Madogo & Karatasi', color: 'bg-slate-500 text-white' },
    water: { en: 'Water Bill (DAWASA)', sw: 'Bili ya Maji (DAWASA)', color: 'bg-cyan-600 text-white' },
    other: { en: 'Other Misc Expenses', sw: 'Matumizi Mengine', color: 'bg-gray-500 text-white' }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Executive Summary Controls */}
      <div className="bg-gradient-to-r from-[#1E2244] via-[#2D336B] to-[#40467A] rounded-2xl p-6 text-white shadow-lg border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <BarChart3 className="w-6 h-6" />
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white">
                {isSw ? 'Faida na Gharama — Uchambuzi wa Biashara' : 'Profit & Costs — Business Performance'}
              </h2>
            </div>
            <p className="text-sm text-slate-300 mt-1.5 max-w-2xl">
              {isSw 
                ? 'Punguza gharama, zuia upotevu wa mtaji, na ongeza faida halisi kupitia uchambuzi wa Bidhaa, Wateja, Matumizi na Mishahara.'
                : 'Cut operating overheads, eliminate dead capital, and boost net cash margin through Item Pareto, Customer LTV, and Expense telemetry.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/15 text-xs font-bold">
              <button
                onClick={() => setTimeRange('month')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  timeRange === 'month' ? 'bg-white text-[#1E2244] shadow-xs' : 'text-slate-200 hover:text-white'
                }`}
              >
                {isSw ? 'Mwezi Huu' : 'This Month'}
              </button>
              <button
                onClick={() => setTimeRange('quarter')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  timeRange === 'quarter' ? 'bg-white text-[#1E2244] shadow-xs' : 'text-slate-200 hover:text-white'
                }`}
              >
                {isSw ? 'Robo Mwaka' : 'Quarter'}
              </button>
              <button
                onClick={() => setTimeRange('year')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  timeRange === 'year' ? 'bg-white text-[#1E2244] shadow-xs' : 'text-slate-200 hover:text-white'
                }`}
              >
                {isSw ? 'Mwaka 2026' : 'Year 2026'}
              </button>
            </div>

            {onNavigateToGeoMatrix && (
              <button
                onClick={onNavigateToGeoMatrix}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md cursor-pointer transition-all border border-emerald-400/40"
              >
                <Target className="w-4 h-4 text-emerald-200" />
                <span>{isSw ? 'Uchambuzi: Bidhaa x Wateja x Maeneo' : 'Geo & Customer Matrix'}</span>
              </button>
            )}

            <button
              onClick={() => {
                if (onOpenAIChatWithPrompt) {
                  onOpenAIChatWithPrompt(
                    'Fanya ukaguzi wa kina wa faida (Profitability Audit), matumizi (Expenses), na utoe mikakati 3 ya haraka ya kuzuia duka kupoteza fedha nchini Tanzania.'
                  );
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#1E2244] text-xs font-black shadow-md cursor-pointer transition-all"
            >
              <Sparkles className="w-4 h-4 text-[#1E2244]" />
              <span>{isSw ? 'Ushauri wa AI wa Kuokoa Fedha' : 'AI Money-Saving Advice'}</span>
            </button>
          </div>
        </div>

        {/* Primary Executive Profit Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Gross Sales</span>
            <span className="text-lg font-black text-white block mt-1">{formatTSh(totalSalesRevenue)}</span>
            <span className="text-[10px] font-bold flex items-center gap-0.5 mt-0.5">
              {momChange.hasData ? (
                <>
                  {momChange.direction === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-400" />}
                  {momChange.direction === 'down' && <ArrowDownRight className="w-3 h-3 text-rose-400" />}
                  <span className={
                    momChange.direction === 'up' ? 'text-emerald-400'
                      : momChange.direction === 'down' ? 'text-rose-400'
                        : 'text-slate-300'
                  }>
                    {momChange.direction === 'up' ? '+' : momChange.direction === 'down' ? '-' : ''}
                    {momChange.percent}% MoM
                  </span>
                </>
              ) : (
                <span className="text-slate-400 font-medium">
                  {isSw ? 'Hakuna data ya mwezi uliopita' : 'No prior month data'}
                </span>
              )}
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              {isSw ? 'Gharama ya Kununua Bidhaa' : 'Stock Purchase Cost'}
            </span>
            <span className="text-lg font-black text-amber-300 block mt-1">{formatTSh(totalCOGS)}</span>
            <span className="text-[10px] text-slate-300 font-medium block mt-0.5">
              {isSw ? 'Bei uliyoilipia bidhaa zilizouzwa' : 'What you paid for sold products'} • {cogsSharePercent}% {isSw ? 'ya mauzo' : 'of sales'}
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              {isSw ? 'Faida Kabla ya Matumizi' : 'Profit Before Bills'}
            </span>
            <span className="text-lg font-black text-emerald-300 block mt-1">{formatTSh(grossProfit)}</span>
            <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">{grossMarginPercent}% Margin</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Total OPEX (Matumizi)</span>
            <span className="text-lg font-black text-rose-300 block mt-1">{formatTSh(totalOperatingExpenses)}</span>
            <span className="text-[10px] text-rose-300 font-medium block mt-0.5">Rent, LUKU, Posho, etc.</span>
          </div>

          <div className="bg-white/10 rounded-xl p-3.5 border border-emerald-400/30 ring-1 ring-emerald-400/20">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
              {isSw ? 'Pesa Unayobaki' : 'Money You Keep'}
            </span>
            <span className="text-xl font-black text-emerald-300 block mt-1">{formatTSh(netOperatingProfit)}</span>
            <span className="text-[10px] text-emerald-300 font-bold block mt-0.5">
              {isSw ? 'Baada ya kununua na matumizi' : 'After buying stock & paying bills'} • {netProfitMarginPercent}%
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Staff ROI Factor</span>
            <span className="text-lg font-black text-sky-300 block mt-1">{staffRevenueEfficiency}x</span>
            <span className="text-[10px] text-sky-300 font-medium block mt-0.5">Mapato kwa TSh ya Mshahara</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveAnalysisView('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeAnalysisView === 'overview'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#323130]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isSw ? 'Muhtasari wa Faida (Executive KPIs)' : 'Executive Summary & Burn Rate'}</span>
        </button>

        <button
          onClick={() => setActiveAnalysisView('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeAnalysisView === 'products'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#323130]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>{isSw ? 'Uchambuzi wa Bidhaa (Pareto ABC & Margins)' : 'Product & Item Unit Economics'}</span>
        </button>

        <button
          onClick={() => setActiveAnalysisView('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeAnalysisView === 'customers'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#323130]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isSw ? 'Uchambuzi wa Wateja (LTV & Churn)' : 'Customer Lifetime Value (LTV)'}</span>
        </button>

        <button
          onClick={() => setActiveAnalysisView('expenses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeAnalysisView === 'expenses'
              ? 'bg-[#6264A7] text-white shadow-xs'
              : 'text-[#605E5C] hover:bg-[#F3F2F1] hover:text-[#323130]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{isSw ? 'Mgawanyo wa Matumizi (OPEX Breakdown)' : 'Expense Breakdown & Salaries'}</span>
        </button>

        <button
          onClick={() => setActiveAnalysisView('cost_cutting')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeAnalysisView === 'cost_cutting'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>{isSw ? '💡 Fursa za Kupunguza Gharama' : '💡 AI Cost-Saving Actions'}</span>
        </button>
      </div>

      {/* VIEW 1: EXECUTIVE OVERVIEW & BURN RATE */}
      {activeAnalysisView === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Burn Rate & Breakeven Card */}
            <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Gharama za Kila Siku (Daily Burn Rate)' : 'Daily Operational Burn Rate'}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#605E5C]">24h Operating Baseline</span>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F9FA] border border-[#E1DFDD] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#605E5C]">{isSw ? 'Gharama ya Kufungua Duka kwa Siku' : 'Daily Cost to Run Shop'}:</span>
                  <span className="text-base font-black text-rose-600">{formatTSh(dailyBurnRate)} / day</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#605E5C]">{isSw ? 'Kima cha Chini cha Mauzo (Breakeven Sales)' : 'Breakeven Sales Required'}:</span>
                  <span className="text-base font-black text-[#0078D4]">{formatTSh(breakevenDailySales)} / day</span>
                </div>
                <div className="text-[11px] text-[#605E5C] pt-2 border-t border-[#E1DFDD]">
                  {isSw 
                    ? `Duka lazima liuze angalau ${formatTSh(breakevenDailySales)} kila siku kabla ya kuanza kuingiza faida ya mmiliki.`
                    : `Your shop must clear ${formatTSh(breakevenDailySales)} every day before net owner profits begin accumulating.`}
                </div>
              </div>

              {/* Quick Health Meter */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>{isSw ? 'Hali ya Pesa Unayobaki' : 'Money You Keep Health'}:</span>
                  <span className={
                    netProfitMarginPercent >= 20 ? 'text-emerald-700 font-extrabold'
                      : netProfitMarginPercent >= 5 ? 'text-amber-700 font-extrabold'
                        : 'text-rose-700 font-extrabold'
                  }>
                    {netProfitMarginPercent}% ({marginHealthLabel})
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-rose-400"
                    style={{ width: `${Math.min(100, cogsSharePercent)}%` }}
                    title={isSw ? `Gharama ya kununua: ${cogsSharePercent}%` : `Stock cost: ${cogsSharePercent}%`}
                  />
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${Math.min(100 - cogsSharePercent, opexSharePercent)}%` }}
                    title={`OPEX: ${opexSharePercent}%`}
                  />
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.max(0, Math.min(100 - cogsSharePercent - opexSharePercent, netProfitMarginPercent))}%` }}
                    title={isSw ? `Pesa unayobaki: ${netProfitMarginPercent}%` : `Money you keep: ${netProfitMarginPercent}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#605E5C]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400"></span> {isSw ? 'Kununua bidhaa' : 'Stock cost'} ({cogsSharePercent}%)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> {isSw ? 'Matumizi' : 'Bills'} ({opexSharePercent}%)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {isSw ? 'Pesa unayobaki' : 'You keep'} ({netProfitMarginPercent}%)</span>
                </div>
              </div>
            </div>

            {/* Top 3 Profit Generating Categories */}
            <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Mchango wa Faida kwa Makundi' : 'Profit Contribution by Category'}
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-indigo-700">Pareto A</span>
              </div>

              <div className="space-y-3">
                {categoryProfitRows.length === 0 ? (
                  <p className="text-xs text-[#605E5C] py-4 text-center">
                    {isSw
                      ? 'Hakuna mauzo kwa kipindi hiki. Rekodi mauzo kwenye POS ili kuona mchango wa makundi.'
                      : 'No sales in this period. Record POS sales to see category profit contribution.'}
                  </p>
                ) : (
                  categoryProfitRows.slice(0, 3).map((row, idx) => {
                    const barColors = ['#0078D4', '#10B981', '#8B5CF6'];
                    const topProfit = Math.max(categoryProfitRows[0]?.profit ?? 0, 1);
                    const barWidth = Math.round((Math.max(0, row.profit) / topProfit) * 100);
                    return (
                      <div key={row.category} className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E1DFDD] space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-[#323130]">
                          <span>{idx + 1}. {row.category}</span>
                          <span className="text-emerald-700 font-black">+{row.profitSharePercent}% {isSw ? 'ya Faida' : 'Profit'}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${barWidth}%`, backgroundColor: barColors[idx] ?? '#6264A7' }}
                          />
                        </div>
                        <div className="text-[11px] text-[#605E5C] flex justify-between">
                          <span>{isSw ? 'Faida Jumla' : 'Gross Margin'}: {row.marginPercent}%</span>
                          <span>{formatTSh(row.profit)} {isSw ? 'Faida' : 'Profit'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Staff Efficiency & Payroll Ratio */}
            <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Ufanisi wa Wafanyakazi (Staff ROI)' : 'Staff ROI & Wage Efficiency'}
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-emerald-700">{staffList.length} Active Staff</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-900 font-medium">{isSw ? 'Jumla ya Gharama za Wafanyakazi' : 'Total Monthly Staff Wage'}:</span>
                  <span className="font-bold text-emerald-950">{formatTSh(totalMonthlyPayroll)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-900 font-medium">{isSw ? 'Wastani wa Mauzo kwa Mhudumu' : 'Revenue per Staff Member'}:</span>
                  <span className="font-bold text-emerald-950">{formatTSh(Math.round(totalSalesRevenue / Math.max(staffList.length, 1)))}</span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-emerald-200 font-bold">
                  <span className="text-emerald-950">{isSw ? 'Kiwango cha Ufanisi (Staff ROI)' : 'Staff Wage Multiplier'}:</span>
                  <span className="text-emerald-700 text-sm font-black">{staffRevenueEfficiency}x Return</span>
                </div>
              </div>

              <div className="text-xs text-[#605E5C] leading-relaxed">
                {isSw 
                  ? `Kwa kila Shilingi 1,000 unayomlipa mfanyakazi (Mshahara + Posho ya chakula/nauli), duka linaingiza TSh ${Math.round(staffRevenueEfficiency * 1000).toLocaleString()} katika mauzo ya jumla.`
                  : `For every TSh 1,000 paid in staff compensation (base wage + daily stipends), your business generates TSh ${Math.round(staffRevenueEfficiency * 1000).toLocaleString()} in gross revenue.`}
              </div>
            </div>
          </div>

          {/* Recharts Comprehensive P&L Cash Flow Trend */}
          <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#6264A7]" />
                  <h3 className="font-bold text-sm text-[#323130]">
                    {isSw ? 'Mwenendo wa Faida na Gharama kwa Miezi (P&L Trend)' : 'Monthly Profit & Loss (P&L) Trajectory'}
                  </h3>
                </div>
                <p className="text-[11px] text-[#605E5C] mt-0.5">
                  {isSw ? 'Ulinganisho wa mauzo, gharama ya kununua bidhaa, matumizi ya duka na pesa unayobaki' : 'Sales vs stock cost vs shop bills vs money you keep'}
                </p>
              </div>
              {ytdGrowth.hasData && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                  ytdGrowth.percent >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {ytdGrowth.percent >= 0 ? '+' : ''}{ytdGrowth.percent}% {isSw ? 'Ukuaji wa Miezi' : 'Period Growth'}
                </span>
              )}
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={monthlyPLTrend}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="biRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6264A7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6264A7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F2F1" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#605E5C', fontWeight: 600 }} axisLine={{ stroke: '#EDEBE9' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#605E5C' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${Math.round(val / 1000000)}M`} />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#1E2244] text-white p-3 rounded-xl shadow-xl border border-white/10 text-xs">
                            <div className="font-bold text-amber-300 border-b border-white/10 pb-1 mb-1.5">
                              {data.month} Financials
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4 text-slate-200">
                                <span>Gross Revenue:</span>
                                <strong className="text-white">{formatTSh(data.revenue)}</strong>
                              </div>
                              <div className="flex justify-between gap-4 text-rose-300">
                                <span>{isSw ? 'Gharama ya kununua:' : 'Stock purchase cost:'}</span>
                                <span>{formatTSh(data.cogs)}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-amber-300">
                                <span>OPEX (Matumizi & Posho):</span>
                                <span>{formatTSh(data.opex)}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-emerald-400 font-bold border-t border-white/10 pt-1">
                                <span>{isSw ? 'Pesa unayobaki:' : 'Money you keep:'}</span>
                                <span>{formatTSh(data.netProfit)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="revenue" name={isSw ? 'Mapato (Revenue)' : 'Revenue'} stroke="#6264A7" strokeWidth={2} fill="url(#biRevenueGrad)" />
                  <Bar dataKey="cogs" name={isSw ? 'Gharama ya Kununua Bidhaa' : 'Stock Purchase Cost'} fill="#FDA4AF" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="opex" name={isSw ? 'Matumizi ya Duka' : 'Shop Bills'} fill="#FDE68A" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Line type="monotone" dataKey="netProfit" name={isSw ? 'Pesa Unayobaki' : 'Money You Keep'} stroke="#107C10" strokeWidth={2.5} dot={{ r: 4, fill: '#107C10' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: PRODUCT UNIT ECONOMICS & PARETO ABC */}
      {activeAnalysisView === 'products' && (
        <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F2F1] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#6264A7]" />
                <h3 className="font-extrabold text-base text-[#323130]">
                  {isSw ? 'Uchambuzi wa Bidhaa (Pareto ABC & Contribution Margins)' : 'Product Profitability & Unit Economics Matrix'}
                </h3>
              </div>
              <p className="text-xs text-[#605E5C] mt-0.5">
                {isSw 
                  ? 'Gundua bidhaa zinazoleta 80% ya faida (Daraja A) na bidhaa zinazolaza mtaji wako (Mtaji Uliolala).'
                  : 'Identify high-margin profit drivers (Class A) vs dead capital sitting unpurchased on shelves.'}
              </p>
            </div>

            {/* Pareto Class Filter Pills */}
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="text-xs text-[#605E5C] mr-1">{isSw ? 'Daraja' : 'Class'}:</span>
              <button
                onClick={() => setParetoFilter('all')}
                className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                  paretoFilter === 'all' ? 'bg-[#323130] text-white border-transparent' : 'bg-[#F3F2F1] text-[#605E5C]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setParetoFilter('A')}
                className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                  paretoFilter === 'A' ? 'bg-emerald-600 text-white border-transparent' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                A (Top 80%)
              </button>
              <button
                onClick={() => setParetoFilter('B')}
                className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                  paretoFilter === 'B' ? 'bg-indigo-600 text-white border-transparent' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}
              >
                B (15%)
              </button>
              <button
                onClick={() => setParetoFilter('C')}
                className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                  paretoFilter === 'C' ? 'bg-rose-600 text-white border-transparent' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                C (Dead Capital)
              </button>
            </div>
          </div>

          {/* Detailed Product Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Daraja / Class</th>
                  <th className="py-3 px-3">Jina la Bidhaa / SKU</th>
                  <th className="py-3 px-3 text-right">Bei ya Kununua</th>
                  <th className="py-3 px-3 text-right">Bei ya Kuuza</th>
                  <th className="py-3 px-3 text-right">Faida / Unit</th>
                  <th className="py-3 px-3 text-right">Faida % (Margin)</th>
                  <th className="py-3 px-3 text-right">Mauzo / Mwezi</th>
                  <th className="py-3 px-3 text-right font-black text-emerald-800">Faida ya Jumla (TSh)</th>
                  <th className="py-3 px-3 text-center">Hali ya Stoo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2F1]">
                {filteredProducts.map(p => (
                  <tr key={p.productId} className="hover:bg-[#FAF9F8] transition-colors">
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-md font-black text-[11px] uppercase ${
                        p.paretoClass === 'A' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : p.paretoClass === 'B'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        Class {p.paretoClass}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#323130]">{p.productName}</div>
                      <div className="text-[10px] font-mono text-[#605E5C]">{p.sku} • {p.category}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#605E5C]">{formatTSh(p.costPrice)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#323130]">{formatTSh(p.unitPrice)}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">+{formatTSh(p.grossProfitPerUnit)}</td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-indigo-700">{p.marginPercent}%</td>
                    <td className="py-3 px-3 text-right font-mono text-[#323130] font-semibold">{p.monthlySalesVolume} pcs</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                      {formatTSh(p.monthlyGrossProfit)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.stockHealthStatus === 'fast_mover'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.stockHealthStatus === 'healthy'
                          ? 'bg-blue-100 text-blue-800'
                          : p.stockHealthStatus === 'slow_mover'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800 animate-pulse'
                      }`}>
                        {p.stockHealthStatus === 'fast_mover' ? '⚡ Fast Mover' :
                         p.stockHealthStatus === 'healthy' ? '✓ Healthy' :
                         p.stockHealthStatus === 'slow_mover' ? '⚠️ Slow Mover' : '🛑 Mtaji Uliolala'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: CUSTOMER LIFETIME VALUE & CHURN */}
      {activeAnalysisView === 'customers' && (
        <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F2F1] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0078D4]" />
                <h3 className="font-extrabold text-base text-[#323130]">
                  {isSw ? 'Uchambuzi wa Wateja (LTV & Churn Risk Analytics)' : 'Customer Lifetime Value & Churn Telemetry'}
                </h3>
              </div>
              <p className="text-xs text-[#605E5C] mt-0.5">
                {isSw 
                  ? 'Fahamu wateja wanaoingiza faida kubwa na wateja walio katika hatari ya kuacha kununua dukani.'
                  : 'Track customer lifetime gross margins, purchase frequencies, and debt reliability status.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-[#0078D4] text-xs font-bold border border-blue-200">
                {customerInsights.length} VIP & Regular Profiles
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8F8F8] text-[#605E5C] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3">Segment</th>
                  <th className="py-3 px-3">Mteja / Customer</th>
                  <th className="py-3 px-3 text-right">Jumla ya Mauzo (Spend)</th>
                  <th className="py-3 px-3 text-right font-black text-emerald-800">Faida ya Mteja (LTV Margin)</th>
                  <th className="py-3 px-3 text-right">Idadi ya Manunuzi</th>
                  <th className="py-3 px-3 text-right">Wastani wa Bili (AOV)</th>
                  <th className="py-3 px-3 text-center">Siku Tangu Manunuzi</th>
                  <th className="py-3 px-3 text-center">Hatari ya Kuondoka</th>
                  <th className="py-3 px-3 text-center">Nidhamu ya Madeni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2F1]">
                {customerInsights.map(c => (
                  <tr key={c.customerId} className="hover:bg-[#FAF9F8] transition-colors">
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        c.segment === 'VIP Champion' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                        c.segment === 'Loyal Core' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                        c.segment === 'High Potential' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                        'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}>
                        {c.segment}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#323130]">{c.customerName}</div>
                      <div className="text-[10px] font-mono text-[#605E5C]">{c.phone}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#323130]">{formatTSh(c.totalSpend)}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                      +{formatTSh(c.lifetimeGrossMargin)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#605E5C]">{c.purchaseCount} visits</td>
                    <td className="py-3 px-3 text-right font-mono text-[#323130]">{formatTSh(c.averageOrderValue)}</td>
                    <td className="py-3 px-3 text-center font-mono text-[#605E5C]">
                      {c.daysSinceLastPurchase} days ago
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.churnRisk === 'low' ? 'bg-emerald-100 text-emerald-800' :
                        c.churnRisk === 'medium' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800 animate-pulse'
                      }`}>
                        {c.churnRisk === 'low' ? '✓ Low Risk' : c.churnRisk === 'medium' ? '⚠️ Medium' : '🚨 High Churn'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.creditHealth === 'prompt_payer' ? 'bg-emerald-100 text-emerald-800' :
                        c.creditHealth === 'reliable_cash' ? 'bg-blue-100 text-blue-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {c.creditHealth === 'prompt_payer' ? 'Pesa Mara Moja' :
                         c.creditHealth === 'reliable_cash' ? 'Cash Payer' : 'Deni Liko Juu'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: EXPENSES BREAKDOWN & SALARIES */}
      {activeAnalysisView === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Breakdown List */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-rose-600" />
                  <h3 className="font-extrabold text-base text-[#323130]">
                    {isSw ? 'Mgawanyo wa Matumizi (OPEX Categories)' : 'Operating Expense Distribution'}
                  </h3>
                </div>
                <span className="text-xs font-black text-rose-600">
                  {formatTSh(totalOperatingExpenses)} Total
                </span>
              </div>

              <div className="space-y-3">
                {expensesByCategory.map(([cat, amount]) => {
                  const label = categoryLabels[cat] || { en: cat, sw: cat, color: 'bg-slate-600 text-white' };
                  const percent = Math.round((amount / (totalOperatingExpenses || 1)) * 1000) / 10;
                  return (
                    <div key={cat} className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E1DFDD] space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#323130]">{isSw ? label.sw : label.en}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-rose-700 font-mono">{formatTSh(amount)}</span>
                          <span className="text-[11px] font-bold text-[#605E5C]">({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {onNavigateToExpenses && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={onNavigateToExpenses}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-bold cursor-pointer transition-all"
                  >
                    <span>{isSw ? 'Fungua Kituo cha Matumizi & Mishahara' : 'Manage Expenses & Staff Payroll'}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Cost Breakdown Pie Summary Card */}
            <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-[#323130]">
                  {isSw ? 'Uchambuzi wa Matumizi Makubwa' : 'Top Expense Drivers'}
                </h3>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="text-xs font-bold text-amber-900">
                  {isSw ? 'Matumizi 3 Makubwa' : 'Top 3 Expense Categories'}:
                </div>
                {expensesByCategory.length === 0 ? (
                  <p className="text-xs text-amber-950">
                    {isSw
                      ? 'Hakuna matumizi yaliyorekodiwa kwa kipindi hiki.'
                      : 'No expenses recorded for this period.'}
                  </p>
                ) : (
                  <ul className="text-xs text-amber-950 space-y-2 list-disc list-inside">
                    {expensesByCategory.slice(0, 3).map(([cat, amount]) => {
                      const label = categoryLabels[cat] || { en: cat, sw: cat };
                      return (
                        <li key={cat}>
                          <strong>{isSw ? label.sw : label.en}</strong>: {formatTSh(amount)}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                <div className="font-bold text-emerald-900 flex items-center gap-1">
                  <Lightbulb className="w-4 h-4 text-emerald-700" />
                  <span>{isSw ? 'Ushauri wa Kuokoa' : 'Cost Optimization Tip'}</span>
                </div>
                <p>
                  {scopedExpenses.some(e => e.category === 'daily_stipends_food_transport')
                    ? (isSw
                      ? `Kuweka posho za kila siku kwenye mfumo kunaweza kupunguza uvujaji wa fedha za taslimu — sasa unatumia ${formatTSh(scopedExpenses.filter(e => e.category === 'daily_stipends_food_transport').reduce((s, e) => s + e.amount, 0))} kwa posho.`
                      : `Digitizing daily stipends can reduce petty cash leakage — you currently spend ${formatTSh(scopedExpenses.filter(e => e.category === 'daily_stipends_food_transport').reduce((s, e) => s + e.amount, 0))} on allowances.`)
                    : (isSw
                      ? 'Rekodi matumizi ya posho, kodi ya pango na umeme ili kuona fursa za kuokoa fedha.'
                      : 'Record stipends, rent, and utility expenses to surface cost-saving opportunities.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: ACTIONABLE COST-SAVING OPPORTUNITIES */}
      {activeAnalysisView === 'cost_cutting' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-md">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-white/20 text-white ring-1 ring-white/30">
                <Scissors className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-xl font-black">
                  {isSw
                    ? `Mikakati ${costSavingOps.length} ya Kuokoa Fedha`
                    : `${costSavingOps.length} Strategic Cost-Saving Actions`}
                </h3>
                <p className="text-xs text-emerald-100 mt-1">
                  {isSw
                    ? 'Uchambuzi unaotokana na bidhaa, matumizi na wasambazaji wako halisi.'
                    : 'Recommendations derived from your actual products, expenses, and suppliers.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {costSavingOps.map(op => (
              <div key={op.id} className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[11px] uppercase">
                    {op.savingsLabel}
                  </span>
                  <span className="text-xs font-mono text-[#605E5C]">{op.tag}</span>
                </div>
                <h4 className="font-bold text-sm text-[#323130]">{op.title}</h4>
                <p className="text-xs text-[#605E5C] leading-relaxed">{op.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
