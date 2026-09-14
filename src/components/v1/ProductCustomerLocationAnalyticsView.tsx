import React, { useState, useMemo, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  BarChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  MapPin, 
  Users, 
  Boxes, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Filter, 
  Download, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Send, 
  Share2, 
  ShoppingBag, 
  RefreshCw, 
  DollarSign, 
  HelpCircle, 
  SlidersHorizontal, 
  Compass, 
  Target, 
  Award, 
  Building2, 
  Layers, 
  ChevronRight, 
  FileSpreadsheet, 
  Printer, 
  Bot, 
  Check, 
  X,
  MessageSquareQuote,
  PieChart as LucidePieChart
} from 'lucide-react';
import { 
  Customer, 
  Product, 
  SaleTransaction, 
  Language, 
  AIProductCustomerGeoAnalysis, 
  GeoLocationSalesInsight, 
  CustomerProductCrossMetric 
} from '@/types/v1';
import { formatTSh, getTranslation } from '@/utils/translations';
import { buildLocalCrossMatrixAnalysis } from '@/lib/analyticsCompute';
import { api } from '@/lib/api';
import { filterByBranchId } from '@/lib/apiSync';
import { printHtmlPage } from '@/lib/documentRenderer';
import { matrixReportHtml } from '@/lib/documentDataMappers';
import { TerritoryLeafletMap, type TerritoryMapPoint } from '@/components/v1/TerritoryLeafletMap';

const TZ_GEO_HINTS: Array<[string, number, number, string]> = [
  ['kariakoo', -6.8167, 39.2833, 'Dar es Salaam'],
  ['kinondoni', -6.7847, 39.2543, 'Dar es Salaam'],
  ['sinza', -6.75, 39.2167, 'Dar es Salaam'],
  ['mikocheni', -6.745, 39.25, 'Dar es Salaam'],
  ['arusha', -3.3869, 36.683, 'Arusha'],
  ['mwanza', -2.5164, 32.9175, 'Mwanza'],
  ['dodoma', -6.163, 35.7516, 'Dodoma'],
];

function geocodeLocationHint(name: string, region?: string): { lat: number; lng: number; region: string } {
  const lower = `${name} ${region ?? ''}`.toLowerCase();
  for (const [hint, lat, lng, reg] of TZ_GEO_HINTS) {
    if (lower.includes(hint)) return { lat, lng, region: reg };
  }
  return { lat: -6.7924, lng: 39.2083, region: region || 'Dar es Salaam' };
}

interface ProductCustomerLocationAnalyticsViewProps {
  language: Language;
  customers: Customer[];
  products: Product[];
  sales: SaleTransaction[];
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onNavigateToPOSWithItem?: (product: Product, customer?: Customer) => void;
  activeBranchId?: string | null;
}

export const ProductCustomerLocationAnalyticsView: React.FC<ProductCustomerLocationAnalyticsViewProps> = ({
  language,
  customers,
  products,
  sales,
  onOpenAIChatWithPrompt,
  onNavigateToPOSWithItem,
  activeBranchId,
}) => {
  const isSw = language === 'sw';
  const t = (key: any) => getTranslation(language, key);

  const branchCustomers = useMemo(
    () => filterByBranchId(customers, activeBranchId),
    [customers, activeBranchId],
  );
  const branchProducts = useMemo(
    () => filterByBranchId(products, activeBranchId),
    [products, activeBranchId],
  );
  const branchSales = useMemo(
    () => filterByBranchId(sales, activeBranchId),
    [sales, activeBranchId],
  );

  const [geoSummary, setGeoSummary] = useState<Record<string, unknown> | null>(null);
  const [apiLocations, setApiLocations] = useState<GeoLocationSalesInsight[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await api.getGeoTerritory(activeBranchId);
        if (cancelled || !raw) return;
        setGeoSummary(raw.summary as Record<string, unknown>);
        const locs = (raw.locations as Array<Record<string, unknown>>) ?? [];
        setApiLocations(
          locs.map(loc => ({
            locationName: String(loc.location_name ?? ''),
            region: String(loc.region ?? 'Tanzania'),
            lat: Number(loc.lat ?? 0),
            lng: Number(loc.lng ?? 0),
            totalRevenue: Number(loc.total_revenue ?? 0),
            totalUnitsSold: Number(loc.total_units_sold ?? 0),
            activeCustomerCount: Number(loc.active_customer_count ?? 0),
            topSellingProductId: '',
            topSellingProductName: String(loc.top_selling_product_name ?? ''),
            topSellingProductRevenue: Number(loc.top_selling_product_revenue ?? 0),
            lowestSellingProductId: '',
            lowestSellingProductName: String(loc.lowest_selling_product_name ?? ''),
            lowestSellingProductRevenue: Number(loc.lowest_selling_product_revenue ?? 0),
            averageOrderValue: Number(loc.average_order_value ?? 0),
            penetrationScore: Number(loc.penetration_score ?? 0),
            dominantCustomerType: '',
          })),
        );
      } catch {
        if (!cancelled) {
          setGeoSummary(null);
          setApiLocations([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeBranchId]);

  // Filter & Dimension States
  const [activeLens, setActiveLens] = useState<'matrix' | 'location' | 'customer' | 'product'>('location');
  const [performanceFilter, setPerformanceFilter] = useState<'all' | 'best' | 'lowest' | 'gaps'>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // AI State
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIProductCustomerGeoAnalysis | null>(null);
  const [aiSource, setAiSource] = useState<string>('gemini-3.7-flash');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [smsModalData, setSmsModalData] = useState<{ customer: Customer; product: Product; offer: string } | null>(null);

  // Extract distinct locations from customers
  const distinctLocations = useMemo(() => {
    const locMap = new Map<string, { full: string; short: string }>();
    branchCustomers.forEach(c => {
      if (c.address) {
        // e.g. "Kariakoo Market, Dar es Salaam" -> "Kariakoo"
        const parts = c.address.split(',');
        const short = parts[0]?.trim() || c.address;
        locMap.set(short, { full: c.address, short });
      }
    });
    return Array.from(locMap.values());
  }, [branchCustomers]);

  // Distinct Categories
  const distinctCategories = useMemo(() => {
    return Array.from(new Set(branchProducts.map(p => p.category)));
  }, [branchProducts]);

  // Build Comprehensive Cross-Matrix Data: Customer x Product x Location
  const crossMetrics = useMemo<CustomerProductCrossMetric[]>(() => {
    const metrics: CustomerProductCrossMetric[] = [];

    // Map sales by customerId & productId
    const customerProductSales = new Map<string, { units: number; totalSpent: number; lastDate: string }>();
    
    branchSales.forEach(sale => {
      const custId = sale.customerId || 'walk_in';
      sale.items.forEach(item => {
        const key = `${custId}___${item.productId}`;
        const existing = customerProductSales.get(key) || { units: 0, totalSpent: 0, lastDate: sale.date };
        customerProductSales.set(key, {
          units: existing.units + item.quantity,
          totalSpent: existing.totalSpent + item.total,
          lastDate: sale.date > existing.lastDate ? sale.date : existing.lastDate
        });
      });
    });

    // Compute metrics for each customer & each product
    branchCustomers.forEach(cust => {
      const custSalesForProducts = branchProducts.map(prod => {
        const sp = customerProductSales.get(`${cust.id}___${prod.id}`);
        return {
          prod,
          units: sp?.units || 0,
          totalSpent: sp?.totalSpent || 0,
          lastDate: sp?.lastDate || 'None'
        };
      });

      // Find max units & min units (>0) for this customer
      const purchasedOnly = custSalesForProducts.filter(x => x.units > 0);
      const maxUnits = purchasedOnly.length ? Math.max(...purchasedOnly.map(x => x.units)) : 0;
      const minUnits = purchasedOnly.length ? Math.min(...purchasedOnly.map(x => x.units)) : 0;

      custSalesForProducts.forEach(({ prod, units, totalSpent, lastDate }) => {
        const isBest = units > 0 && units === maxUnits;
        const isLowest = units > 0 && units === minUnits && purchasedOnly.length > 1;
        const isUnpurchased = units === 0;

        let recAction = "";
        if (isBest) {
          recAction = isSw ? "Weka ofa ya jumla ya 5%" : "Offer 5% bulk repeat loyalty discount";
        } else if (isLowest) {
          recAction = isSw ? "Kifurushi cha majaribio (Trial bundle)" : "Recommend discounted starter bundle";
        } else {
          recAction = isSw ? "Tuma SMS ya taarifa ya bidhaa hii" : "Send targeted cross-sell introduction SMS";
        }

        metrics.push({
          customerId: cust.id,
          customerName: cust.name,
          customerLocation: cust.address.split(',')[0]?.trim() || cust.address,
          customerTier: cust.loyaltyTier,
          productId: prod.id,
          productName: prod.name,
          productCategory: prod.category,
          unitsBought: units,
          totalSpent: totalSpent,
          lastBoughtDate: lastDate,
          isBestSellerForCustomer: isBest,
          isLowestSellerForCustomer: isLowest,
          isUnpurchasedGap: isUnpurchased,
          recommendedAction: recAction
        });
      });
    });

    return metrics;
  }, [branchCustomers, branchProducts, branchSales, isSw]);

  // Aggregate by Location (Where)
  const locationInsights = useMemo<GeoLocationSalesInsight[]>(() => {
    const locMap = new Map<string, {
      totalRev: number;
      totalUnits: number;
      customers: Set<string>;
      productSales: Map<string, { name: string; units: number; rev: number }>;
    }>();

    crossMetrics.forEach(m => {
      const loc = m.customerLocation;
      if (!locMap.has(loc)) {
        locMap.set(loc, {
          totalRev: 0,
          totalUnits: 0,
          customers: new Set(),
          productSales: new Map()
        });
      }
      const entry = locMap.get(loc)!;
      entry.customers.add(m.customerId);
      entry.totalRev += m.totalSpent;
      entry.totalUnits += m.unitsBought;

      if (m.unitsBought > 0) {
        const pEntry = entry.productSales.get(m.productId) || { name: m.productName, units: 0, rev: 0 };
        pEntry.units += m.unitsBought;
        pEntry.rev += m.totalSpent;
        entry.productSales.set(m.productId, pEntry);
      }
    });

    const results: GeoLocationSalesInsight[] = [];

    locMap.forEach((val, locName) => {
      const pList = Array.from(val.productSales.entries()).map(([id, p]) => ({ id, ...p }));
      pList.sort((a, b) => b.units - a.units);

      const top = pList[0] || { id: 'none', name: 'N/A', units: 0, rev: 0 };
      const lowest = pList.length > 1 ? pList[pList.length - 1] : { id: 'none', name: 'N/A', units: 0, rev: 0 };
      const geo = geocodeLocationHint(locName);

      // Total potential penetration score
      const customerCount = val.customers.size;
      const penetration = Math.min(100, Math.round((val.totalUnits / Math.max(1, customerCount * 10)) * 100));

      results.push({
        locationName: locName,
        region: locName.includes('Arusha') ? 'Arusha' : geo.region,
        lat: geo.lat,
        lng: geo.lng,
        totalRevenue: val.totalRev,
        totalUnitsSold: val.totalUnits,
        activeCustomerCount: customerCount,
        topSellingProductId: top.id,
        topSellingProductName: top.name,
        topSellingProductRevenue: top.rev,
        lowestSellingProductId: lowest.id,
        lowestSellingProductName: lowest.name,
        lowestSellingProductRevenue: lowest.rev,
        averageOrderValue: customerCount > 0 ? Math.round(val.totalRev / customerCount) : 0,
        penetrationScore: penetration,
        dominantCustomerType: locName.includes('Kariakoo') ? 'Wholesale Trader' : locName.includes('Mikocheni') ? 'Premium Clinic' : 'Retail Dispensary'
      });
    });

    results.sort((a, b) => b.totalRevenue - a.totalRevenue);
    return apiLocations.length ? apiLocations : results;
  }, [crossMetrics, apiLocations]);

  // Overall Top Product & Lowest Product across all data
  const overallProductStats = useMemo(() => {
    const pStats = new Map<string, { 
      product: Product; 
      totalUnits: number; 
      totalRev: number; 
      topLocation: string; 
      topCustomer: string;
      lowestLocation: string;
    }>();

    branchProducts.forEach(p => {
      pStats.set(p.id, {
        product: p,
        totalUnits: 0,
        totalRev: 0,
        topLocation: 'N/A',
        topCustomer: 'N/A',
        lowestLocation: 'N/A'
      });
    });

    crossMetrics.forEach(m => {
      const st = pStats.get(m.productId);
      if (st) {
        st.totalUnits += m.unitsBought;
        st.totalRev += m.totalSpent;
      }
    });

    const list = Array.from(pStats.values());
    list.sort((a, b) => b.totalUnits - a.totalUnits);

    const topProduct = list[0] || null;
    const lowestProduct = list.filter(x => x.totalUnits > 0).slice(-1)[0] || list[list.length - 1] || null;

    return { topProduct, lowestProduct, allRanked: list };
  }, [branchProducts, crossMetrics]);

  // Filtered Cross Metrics for Display
  const filteredMetrics = useMemo(() => {
    return crossMetrics.filter(m => {
      // Performance filter
      if (performanceFilter === 'best' && !m.isBestSellerForCustomer) return false;
      if (performanceFilter === 'lowest' && !m.isLowestSellerForCustomer) return false;
      if (performanceFilter === 'gaps' && !m.isUnpurchasedGap) return false;

      // Location filter
      if (selectedLocation !== 'all' && m.customerLocation !== selectedLocation) return false;

      // Customer filter
      if (selectedCustomer !== 'all' && m.customerId !== selectedCustomer) return false;

      // Category filter
      if (selectedCategory !== 'all' && m.productCategory !== selectedCategory) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.productName.toLowerCase().includes(q) ||
          m.customerName.toLowerCase().includes(q) ||
          m.customerLocation.toLowerCase().includes(q) ||
          m.productCategory.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [crossMetrics, performanceFilter, selectedLocation, selectedCustomer, selectedCategory, searchQuery]);

  // Chart Data for Location Sales Breakdown
  const locationBarChartData = useMemo(() => {
    return locationInsights.map(loc => ({
      name: loc.locationName,
      revenue: loc.totalRevenue,
      units: loc.totalUnitsSold,
      topItem: loc.topSellingProductName.split('(')[0].trim(),
      lowestItem: loc.lowestSellingProductName.split('(')[0].trim(),
      customers: loc.activeCustomerCount
    }));
  }, [locationInsights]);

  // Pie chart for revenue contribution by location
  const locationPieChartData = useMemo(() => {
    const colors = ['#0078D4', '#107C41', '#D83B01', '#8764B8', '#008272', '#B4009E', '#E3008C', '#5C2E91'];
    return locationInsights.map((loc, idx) => ({
      name: loc.locationName,
      value: loc.totalRevenue,
      color: colors[idx % colors.length]
    }));
  }, [locationInsights]);

  // Run AI Synthesis
  const handleFetchAIAnalysis = async () => {
    setIsAiLoading(true);
    try {
      const stagnant = overallProductStats.allRanked.filter(x => x.totalUnits <= 5).map(x => ({
        name: x.product.name,
        units: x.totalUnits,
        stockRemaining: x.product.stock
      }));

      const res = await fetch('/api/ai/cross-matrix-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          locationSummary: locationInsights,
          customerTopPurchases: crossMetrics.filter(m => m.isBestSellerForCustomer),
          stagnantItems: stagnant,
          selectedLocation,
          selectedCustomer
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAiAnalysis(data.analysis);
          setAiSource(data.source || 'local-heuristic-engine');
          return;
        }
      }
      setAiAnalysis(buildLocalCrossMatrixAnalysis(
        locationInsights,
        crossMetrics.filter(m => m.isBestSellerForCustomer),
        stagnant,
        isSw,
      ));
      setAiSource('local-fallback');
    } catch (err) {
      console.error('Failed to fetch AI matrix analysis:', err);
      setAiAnalysis(buildLocalCrossMatrixAnalysis(
        locationInsights,
        crossMetrics.filter(m => m.isBestSellerForCustomer),
        overallProductStats.allRanked.filter(x => x.totalUnits <= 5).map(x => ({
          name: x.product.name,
          units: x.totalUnits,
        })),
        isSw,
      ));
      setAiSource('local-fallback');
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI analysis runs on demand (button) — not on mount

  // Quick SMS campaign trigger
  const handleSendTargetedSMS = (custName: string, loc: string, recProduct: string) => {
    const cust = branchCustomers.find(c => c.name === custName) || branchCustomers[0];
    const prod = branchProducts.find(p => p.name.includes(recProduct.split('&')[0].trim())) || branchProducts[0];
    
    setSmsModalData({
      customer: cust,
      product: prod,
      offer: isSw 
        ? `Habari ${custName}! Duka+ inakuletea ofa maalum ya ${recProduct} kwa punguzo la 10% wiki hii hapo ${loc}. Agiza sasa tukuletee bure!`
        : `Hello ${custName}! Duka+ has an exclusive 10% discount on ${recProduct} this week for our ${loc} clients. Order now for free delivery!`
    });
  };

  const handleConfirmSendSMS = () => {
    setActionSuccessMsg(isSw ? `SMS ya matangazo imetumwa kikamilifu kwa ${smsModalData?.customer.name}!` : `Promotional SMS successfully dispatched to ${smsModalData?.customer.name}!`);
    setSmsModalData(null);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12 font-['Calibri',_'Aptos',_'Segoe_UI',_sans-serif]">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-emerald-600 text-white rounded-xl shadow-2xl animate-fade-in border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span className="font-semibold text-sm">{actionSuccessMsg}</span>
        </div>
      )}

      {/* HEADER BAR WITH TITLE & AI REFRESH */}
      <div className="bg-gradient-to-r from-[#1A1D3B] via-[#242954] to-[#1E2244] rounded-2xl p-6 text-white shadow-xl border border-[#3B4177]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900 shadow-md">
                <Compass className="w-6 h-6 text-slate-950 font-black" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  {isSw ? 'Uchambuzi wa Mauzo: Bidhaa x Wateja x Maeneo' : 'Product vs Customer vs Location Matrix'}
                  <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/40">
                    AI Grounded
                  </span>
                </h1>
                <p className="text-xs text-indigo-200">
                  {isSw 
                    ? 'Tambua bidhaa zinazofanya vizuri (Best Sellers) au zinazolala (Low Sellers) kulingana na wateja na maeneo yao (Kariakoo, Sinza, Mikocheni, n.k.)'
                    : 'Discover best-selling vs low-moving products mapped across individual customer profiles and geographic territories'}
                </p>
              </div>
            </div>
          </div>

          {/* AI Synthesis Trigger & Export Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleFetchAIAnalysis}
              disabled={isAiLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0078D4] to-[#6264A7] hover:from-[#006cbd] hover:to-[#555794] text-white font-bold text-xs shadow-lg transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer border border-white/20"
            >
              <Sparkles className={`w-4 h-4 text-amber-300 ${isAiLoading ? 'animate-spin' : ''}`} />
              <span>{isAiLoading ? (isSw ? 'AI Inachambua...' : 'AI Analyzing...') : (isSw ? 'Chambua Upya na AI' : 'Synthesize with AI')}</span>
            </button>

            <button
              onClick={() => {
                if (onOpenAIChatWithPrompt) {
                  onOpenAIChatWithPrompt(
                    isSw
                      ? "Nipe uchambuzi wa kina: Ni bidhaa gani inafanya vizuri zaidi Kariakoo na Mikocheni, na ni wateja gani hawajanunua dawa za watoto hivi karibuni?"
                      : "Provide a detailed deep-dive: Which products are selling best in Kariakoo and Mikocheni, and which customers have low purchasing volume this month?"
                  );
                }
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer"
            >
              <Bot className="w-4 h-4 text-sky-300" />
              <span>{isSw ? 'Uliza AI Co-Pilot' : 'Ask AI Co-Pilot'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 HIGH-LEVEL STRATEGIC KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. TOP BEST-SELLING PRODUCT OVERALL */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {isSw ? 'Bidhaa Bora (Top Seller)' : 'Top Best Seller'}
            </span>
            <Award className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 truncate">
            {overallProductStats.topProduct?.product.name || (isSw ? 'Hakuna bado' : 'No data yet')}
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">
              {overallProductStats.topProduct?.totalUnits ?? 0} <span className="text-xs text-slate-500 font-medium">{isSw ? 'vipande' : 'units'}</span>
            </span>
            <span className="text-xs font-semibold text-slate-600">
              ({formatTSh(overallProductStats.topProduct?.totalRev ?? 0)})
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <strong className="text-slate-700">{isSw ? 'Eneo Kuu:' : 'Top Hub:'}</strong>{' '}
            {locationInsights[0]?.locationName || (isSw ? '—' : '—')}
          </p>
        </div>

        {/* 2. LOWEST / STAGNANT ITEM (Action Needed) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              {isSw ? 'Mauzo ya Chini (Low / Stagnant)' : 'Lowest Moving SKU'}
            </span>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 truncate">
            {overallProductStats.lowestProduct?.product.name || (isSw ? 'Hakuna bado' : 'No data yet')}
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">
              {overallProductStats.lowestProduct?.totalUnits ?? 0} <span className="text-xs text-slate-500 font-medium">{isSw ? 'vipande' : 'units'}</span>
            </span>
            <span className="text-xs font-semibold text-slate-500">
              ({isSw ? 'Stoo:' : 'Stock:'} {overallProductStats.lowestProduct?.product.stock ?? 0})
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <strong className="text-slate-700">{isSw ? 'Angalia:' : 'Review:'}</strong>{' '}
            {locationInsights[locationInsights.length - 1]?.locationName || (isSw ? '—' : '—')}
          </p>
        </div>

        {/* 3. HIGHEST GROSSING GEOGRAPHIC LOCATION */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {isSw ? 'Eneo Linaloongoza' : 'Top Territory'}
            </span>
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 truncate">
            {locationInsights[0]?.locationName || (isSw ? 'Hakuna bado' : 'No territory yet')}
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600">
              {formatTSh(locationInsights[0]?.totalRevenue ?? 0)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <strong className="text-slate-700">{isSw ? 'Wateja:' : 'Buyers:'}</strong> {locationInsights[0]?.activeCustomerCount ?? 0}
          </p>
        </div>

        {/* 4. CROSS-SELL REVENUE EXPANSION POTENTIAL */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {isSw ? 'Fursa ya Mauzo Zaidi' : 'Cross-Sell Potential'}
            </span>
            <Target className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            {isSw ? 'Mapengo ya Wateja' : 'Customer whitespace gaps'}{' '}
            {Number(geoSummary?.whitespace_gaps ?? crossMetrics.filter(m => m.isUnpurchasedGap).length)}
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">
              +{formatTSh(Number(geoSummary?.cross_sell_potential_tzs ?? 0))}
            </span>
            <span className="text-xs text-slate-500 font-medium">/{isSw ? 'mwezi' : 'mo'}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {isSw ? 'Kupitia vifurushi vya dawa na vifaa' : 'Targeted bundling on dormant SKUs'}
          </p>
        </div>
      </div>

      {/* AI STRATEGY & EXECUTIVE INTELLIGENCE PANEL */}
      {aiAnalysis && (
        <div className="bg-gradient-to-br from-indigo-900 via-[#1E2244] to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-500/30">
          <div className="flex items-center justify-between pb-4 border-b border-indigo-700/50 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {isSw ? 'Muhtasari wa Akili Mnemba (AI Strategy & Insights)' : 'AI Matrix Strategy & Recommendations'}
                </h2>
                <p className="text-xs text-indigo-200">
                  {isSw ? 'Uchambuzi wa moja kwa moja kutoka Gemini AI kulingana na mienendo ya soko' : 'Real-time strategic synthesis based on regional buying velocity'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-white/10 text-indigo-200 border border-white/15">
              Model: {aiSource}
            </span>
          </div>

          {/* Executive Narrative */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-5 text-sm text-indigo-100 leading-relaxed">
            <p className="flex items-start gap-2.5">
              <MessageSquareQuote className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <span>{isSw ? aiAnalysis.executiveSummarySw : aiAnalysis.executiveSummaryEn}</span>
            </p>
          </div>

          {/* 3 Interactive AI Recommendation Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Top Growth Corridors */}
            <div className="bg-slate-900/60 rounded-xl p-4 border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>{isSw ? 'Maeneo ya Ukuaji wa Haraka' : 'Top Growth Corridors'}</span>
              </div>
              <div className="space-y-2.5">
                {aiAnalysis.topGrowthLocations.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{item.location}</span>
                      <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded font-mono">
                        {item.topCustomer}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{item.rationale}</p>
                    <div className="text-[10px] text-amber-200/90 font-medium">
                      ⭐ {item.keyProducts.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Underperforming Gaps & Solutions */}
            <div className="bg-slate-900/60 rounded-xl p-4 border border-rose-500/30 space-y-3">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>{isSw ? 'Mapengo & Mikakati ya Kurekebisha' : 'Lagging Gaps & Fixes'}</span>
              </div>
              <div className="space-y-2.5">
                {aiAnalysis.underperformingGaps.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{item.location}</span>
                      <span className="text-[10px] text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded">
                        {item.affectedCustomers.join(', ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-200">
                      ⚠️ <strong>{item.laggingProduct}</strong>
                    </p>
                    <p className="text-[11px] text-slate-300">
                      💡 {item.fixStrategy}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 1-Click Cross-Sell Opportunities */}
            <div className="bg-slate-900/60 rounded-xl p-4 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>{isSw ? 'Fursa za Mauzo & SMS za Matangazo' : 'Actionable Cross-Sell & SMS'}</span>
              </div>
              <div className="space-y-2.5">
                {aiAnalysis.crossSellOpportunities.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{item.customerName}</span>
                      <span className="text-[10px] text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded font-mono">
                        +{formatTSh(item.estimatedRevenueGain)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {isSw ? 'Ananunua:' : 'Buys:'} <strong className="text-white">{item.currentFavorite}</strong>
                      <br />
                      {isSw ? 'Pendekeza:' : 'Recommend:'} <strong className="text-amber-300">{item.recommendedCrossSell}</strong>
                    </p>
                    <button
                      onClick={() => handleSendTargetedSMS(item.customerName, item.location, item.recommendedCrossSell)}
                      className="w-full py-1.5 px-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSw ? 'Tuma Ofa ya SMS' : 'Dispatch Promo SMS'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTER & DIMENSION CONTROLS */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        {/* LENS SWITCHER TABS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveLens('location')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeLens === 'location'
                  ? 'bg-[#0078D4] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>{isSw ? 'Kwa Maeneo (Where)' : 'By Location (Where)'}</span>
            </button>

            <button
              onClick={() => setActiveLens('customer')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeLens === 'customer'
                  ? 'bg-[#0078D4] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isSw ? 'Kwa Wateja (Customers)' : 'By Customer Profile'}</span>
            </button>

            <button
              onClick={() => setActiveLens('product')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeLens === 'product'
                  ? 'bg-[#0078D4] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>{isSw ? 'Kwa Bidhaa (Products)' : 'By Product / SKU'}</span>
            </button>

            <button
              onClick={() => setActiveLens('matrix')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeLens === 'matrix'
                  ? 'bg-[#0078D4] text-white shadow'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{isSw ? 'Jedwali la Pamoja (Heatmap Matrix)' : 'Cross-Matrix Grid'}</span>
            </button>
          </div>

          {/* Performance filter (Best vs Low) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              onClick={() => setPerformanceFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                performanceFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isSw ? 'Zote' : 'All Items'}
            </button>
            <button
              onClick={() => setPerformanceFilter('best')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                performanceFilter === 'best'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{isSw ? 'Bora Tu (Best Sellers)' : 'Best Sellers Only'}</span>
            </button>
            <button
              onClick={() => setPerformanceFilter('lowest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                performanceFilter === 'lowest'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{isSw ? 'Chini Tu (Lowest Sellers)' : 'Lowest Sellers Only'}</span>
            </button>
            <button
              onClick={() => setPerformanceFilter('gaps')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                performanceFilter === 'gaps'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isSw ? 'Mapengo (Zero Sales)' : 'Zero-Sales Gaps'}</span>
            </button>
          </div>
        </div>

        {/* GRANULAR SELECTORS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Location Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              {isSw ? 'Chuja kwa Eneo (Where)' : 'Filter by Location'}
            </label>
            <select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">{isSw ? 'Maeneo Yote (All Locations)' : 'All Locations'}</option>
              {distinctLocations.map(l => (
                <option key={l.short} value={l.short}>{l.short}</option>
              ))}
            </select>
          </div>

          {/* Customer Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              {isSw ? 'Chuja kwa Mteja' : 'Filter by Customer'}
            </label>
            <select
              value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">{isSw ? 'Wateja Wote (All Customers)' : 'All Customers'}</option>
              {branchCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.address.split(',')[0]})</option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              {isSw ? 'Aina ya Bidhaa' : 'Product Category'}
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">{isSw ? 'Aina Zote (All Categories)' : 'All Categories'}</option>
              {distinctCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              {isSw ? 'Tafuta (Bidhaa, Mteja, Eneo)' : 'Search Matrix'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={isSw ? "Tafuta jina lolote..." : "Search product or customer..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* LENS 1: BY LOCATION (WHERE) - GEOGRAPHIC COMPARISON & CARDS */}
      {activeLens === 'location' && (
        <div className="space-y-6">
          {/* LOCATION COMPARISON CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar Chart + Leaflet map: Revenue & Volume by Territory */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    {isSw ? 'Mauzo na Vipande kwa Kila Eneo (Where)' : 'Sales Revenue & Volume by Territory'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isSw ? 'Ulinganisho wa mapato na ramani ya maeneo (OpenStreetMap)' : 'Revenue comparison and live territory map (OpenStreetMap)'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={locationBarChartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#475569' }} />
                      <RechartsTooltip 
                        formatter={(val: any, name: string) => [
                          name === 'revenue' ? formatTSh(Number(val)) : `${val} units`, 
                          name === 'revenue' ? (isSw ? 'Mapato' : 'Revenue') : (isSw ? 'Vipande' : 'Units Sold')
                        ]}
                        labelStyle={{ fontWeight: 'bold' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar yAxisId="left" dataKey="revenue" name={isSw ? "Mapato (TSh)" : "Revenue (TSh)"} fill="#0078D4" radius={[6, 6, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="units" name={isSw ? "Idadi ya Vipande" : "Total Units"} stroke="#D83B01" strokeWidth={3} dot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <TerritoryLeafletMap
                  isSw={isSw}
                  height={288}
                  points={locationInsights.map(loc => ({
                    locationName: loc.locationName,
                    region: loc.region,
                    lat: loc.lat ?? -6.7924,
                    lng: loc.lng ?? 39.2083,
                    totalRevenue: loc.totalRevenue,
                    totalUnitsSold: loc.totalUnitsSold,
                    activeCustomerCount: loc.activeCustomerCount,
                  })) satisfies TerritoryMapPoint[]}
                />
              </div>
            </div>

            {/* Pie Chart: Market Share by Location */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <LucidePieChart className="w-5 h-5 text-indigo-600" />
                  {isSw ? 'Mgao wa Mapato (Geo Share)' : 'Territory Market Share'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isSw ? 'Uchangiaji wa mapato kwa kila kituo' : 'Share of gross earnings per zone'}
                </p>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={locationPieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {locationPieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v: any) => formatTSh(Number(v))} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {locationPieChartData.map(loc => (
                  <div key={loc.name} className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: loc.color }} />
                      {loc.name}
                    </span>
                    <span className="font-bold text-slate-900">{formatTSh(loc.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TERRITORY CARDS WITH BEST & LOWEST PRODUCT DETAILS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {locationInsights.map(loc => (
              <div key={loc.locationName} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {loc.region}
                    </span>
                    <h4 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      {loc.locationName}
                    </h4>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {loc.activeCustomerCount} {isSw ? 'Wateja' : 'Clients'}
                  </span>
                </div>

                {/* Revenue Banner */}
                <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block">{isSw ? 'Jumla ya Mauzo:' : 'Total Sales:'}</span>
                    <span className="text-lg font-black text-slate-900">{formatTSh(loc.totalRevenue)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-500 block">{isSw ? 'Wastani / Oda:' : 'Avg Ticket:'}</span>
                    <span className="text-xs font-bold text-slate-700">{formatTSh(loc.averageOrderValue)}</span>
                  </div>
                </div>

                {/* Best vs Lowest Products in this Area */}
                <div className="space-y-2.5">
                  {/* Top Performer */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                        {isSw ? 'Bidhaa Inayoongoza (Best)' : 'Best Selling Item'}
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        {formatTSh(loc.topSellingProductRevenue)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {loc.topSellingProductName}
                    </p>
                  </div>

                  {/* Lowest Performer */}
                  <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-rose-600" />
                        {isSw ? 'Mauzo ya Chini (Lowest / Stagnant)' : 'Lowest Moving Item'}
                      </span>
                      <span className="text-xs font-bold text-rose-700">
                        {formatTSh(loc.lowestSellingProductRevenue)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {loc.lowestSellingProductName}
                    </p>
                  </div>
                </div>

                {/* Quick Action */}
                <button
                  onClick={() => {
                    setSelectedLocation(loc.locationName);
                    setActiveLens('matrix');
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{isSw ? 'Tazama Bidhaa Zote za Eneo Hili' : 'Inspect All Items in this Location'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LENS 2: BY CUSTOMER PROFILE (Which customer buys best / lowest) */}
      {activeLens === 'customer' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {branchCustomers.map(cust => {
              const custMetrics = crossMetrics.filter(m => m.customerId === cust.id);
              const bestItems = custMetrics.filter(m => m.isBestSellerForCustomer);
              const lowestItems = custMetrics.filter(m => m.isLowestSellerForCustomer);
              const zeroItems = custMetrics.filter(m => m.isUnpurchasedGap);

              return (
                <div key={cust.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${cust.avatarColor} text-white flex items-center justify-center font-black text-lg shadow`}>
                        {cust.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">{cust.name}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {cust.address}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                      cust.loyaltyTier === 'Gold' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      cust.loyaltyTier === 'Silver' ? 'bg-slate-200 text-slate-800 border border-slate-300' :
                      'bg-orange-100 text-orange-800 border border-orange-300'
                    }`}>
                      {cust.loyaltyTier}
                    </span>
                  </div>

                  {/* Top Buying Items */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      {isSw ? 'Bidhaa Anazonunua Zaidi (Best Purchases):' : 'Top Purchased Items (Best):'}
                    </span>
                    <div className="space-y-1.5">
                      {bestItems.map(item => (
                        <div key={item.productId} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-xs">
                          <span className="font-bold text-slate-900 truncate max-w-[200px]">{item.productName}</span>
                          <div className="text-right">
                            <span className="font-black text-emerald-700">{item.unitsBought} {isSw ? 'vipande' : 'units'}</span>
                            <span className="text-[10px] text-slate-500 block">({formatTSh(item.totalSpent)})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lowest Buying Items / Zero Purchase Opportunities */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      {isSw ? 'Bidhaa Zinazonunuliwa Chini au Hazijawahi Nunuliwa:' : 'Low Velocity or Unpurchased Items:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {zeroItems.slice(0, 4).map(item => (
                        <span key={item.productId} className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 font-medium">
                          {item.productName.split('(')[0]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleSendTargetedSMS(cust.name, cust.address.split(',')[0], zeroItems[0]?.productName || 'Supplements')}
                      className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSw ? 'Tuma Ofa ya SMS' : 'Send Targeted SMS'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCustomer(cust.id);
                        setActiveLens('matrix');
                      }}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      {isSw ? 'Tazama Yote' : 'View Full'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LENS 3: BY PRODUCT / SKU */}
      {activeLens === 'product' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {overallProductStats.allRanked.map(({ product, totalUnits, totalRev }) => {
              const productMetrics = crossMetrics.filter(m => m.productId === product.id && m.unitsBought > 0);
              productMetrics.sort((a, b) => b.unitsBought - a.unitsBought);

              const topBuyers = productMetrics.slice(0, 3);
              const lowestBuyers = productMetrics.length > 3 ? productMetrics.slice(-2) : [];

              return (
                <div key={product.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {product.category}
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900 mt-1">{product.name}</h4>
                      <p className="text-xs text-slate-500 font-mono">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-slate-900">{formatTSh(product.price)}</span>
                      <span className="text-xs text-slate-500 block font-semibold">
                        {isSw ? 'Faida:' : 'Margin:'} {formatTSh(product.price - product.cost)}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{isSw ? 'Jumla ya Mauzo' : 'Total Units Sold'}</span>
                      <span className="text-base font-black text-emerald-600 block">{totalUnits} {product.unit}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{isSw ? 'Mapato ya Jumla' : 'Total Revenue'}</span>
                      <span className="text-base font-black text-slate-900 block">{formatTSh(totalRev)}</span>
                    </div>
                  </div>

                  {/* Top Customer Buyers */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      {isSw ? 'Wateja Wanaoongoza Kununua (Best Buyers):' : 'Top Customer Buyers (Best):'}
                    </span>
                    {topBuyers.length > 0 ? (
                      topBuyers.map(tb => (
                        <div key={tb.customerId} className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                          <span className="font-semibold text-slate-800">
                            {tb.customerName} <span className="text-slate-400 font-normal">({tb.customerLocation})</span>
                          </span>
                          <span className="font-bold text-emerald-700">{tb.unitsBought} {product.unit}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">{isSw ? 'Hakuna mauzo yaliyorekodiwa hivi karibuni' : 'No recent sales recorded'}</p>
                    )}
                  </div>

                  {/* Quick Order / POS Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        if (onNavigateToPOSWithItem) {
                          onNavigateToPOSWithItem(product);
                        }
                      }}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <ShoppingBag className="w-4 h-4 text-amber-300" />
                      <span>{isSw ? 'Uza Kwenye POS Sasa' : 'Sell in POS Checkout'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LENS 4: DETAILED 2D CROSS-MATRIX HEATMAP & TABLE */}
      {activeLens === 'matrix' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                {isSw ? 'Jedwali la Kina la Mauzo (Bidhaa x Wateja x Maeneo)' : 'Cross-Matrix Breakdown Table'}
              </h3>
              <p className="text-xs text-slate-500">
                {isSw 
                  ? `Inaonesha rekodi ${filteredMetrics.length} zilizochujwa kulingana na vigezo vyako`
                  : `Displaying ${filteredMetrics.length} filtered multi-dimensional sales matrix records`}
              </p>
            </div>

            {/* Print / Export Button */}
            <button
              onClick={() => {
                const html = matrixReportHtml(
                  filteredMetrics.map(m => ({
                    productName: m.productName,
                    productCategory: m.productCategory,
                    customerName: m.customerName,
                    customerLocation: m.customerLocation,
                    unitsBought: m.unitsBought,
                    totalSpent: m.totalSpent,
                  })),
                  isSw ? 'Duka+ Business' : 'Duka+ Business',
                  isSw,
                );
                printHtmlPage(isSw ? 'Ripoti ya Jedwali' : 'Matrix Report', html, isSw);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer self-start"
            >
              <Printer className="w-4 h-4" />
              <span>{isSw ? 'Chapisha Ripoti' : 'Print Matrix Report'}</span>
            </button>
          </div>

          {/* MATRIX DATA TABLE */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1E2244] text-white">
                  <th className="py-3 px-4 font-bold">{isSw ? 'Bidhaa (Product)' : 'Product'}</th>
                  <th className="py-3 px-4 font-bold">{isSw ? 'Aina' : 'Category'}</th>
                  <th className="py-3 px-4 font-bold">{isSw ? 'Mteja (Customer)' : 'Customer'}</th>
                  <th className="py-3 px-4 font-bold">{isSw ? 'Eneo (Where / Location)' : 'Where / Location'}</th>
                  <th className="py-3 px-4 font-bold text-right">{isSw ? 'Vipande' : 'Units'}</th>
                  <th className="py-3 px-4 font-bold text-right">{isSw ? 'Jumla (TSh)' : 'Total Spent'}</th>
                  <th className="py-3 px-4 font-bold text-center">{isSw ? 'Hali ya Mauzo' : 'Performance Status'}</th>
                  <th className="py-3 px-4 font-bold text-center">{isSw ? 'Kitendo Kinachopendekezwa' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {filteredMetrics.length > 0 ? (
                  filteredMetrics.map((m, idx) => {
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{m.productName}</td>
                        <td className="py-3 px-4 text-slate-500">{m.productCategory}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{m.customerName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{m.customerTier} Tier</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                            <MapPin className="w-3 h-3 text-blue-600" />
                            {m.customerLocation}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {m.unitsBought > 0 ? m.unitsBought : <span className="text-slate-300">0</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {m.totalSpent > 0 ? formatTSh(m.totalSpent) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {m.isBestSellerForCustomer && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                              <TrendingUp className="w-3 h-3" />
                              {isSw ? 'Inayoongoza (Best)' : 'Best Seller'}
                            </span>
                          )}
                          {m.isLowestSellerForCustomer && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-300">
                              <TrendingDown className="w-3 h-3" />
                              {isSw ? 'Ya Chini (Lowest)' : 'Low Mover'}
                            </span>
                          )}
                          {m.isUnpurchasedGap && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                              <Zap className="w-3 h-3" />
                              {isSw ? 'Pengo (Zero)' : 'Zero Gap'}
                            </span>
                          )}
                          {!m.isBestSellerForCustomer && !m.isLowestSellerForCustomer && !m.isUnpurchasedGap && (
                            <span className="text-[11px] text-slate-500 font-semibold">{isSw ? 'Kawaida' : 'Moderate'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleSendTargetedSMS(m.customerName, m.customerLocation, m.productName)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer border border-blue-200"
                          >
                            <Send className="w-3 h-3" />
                            <span>{isSw ? 'Ofa' : 'Promo'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">
                      {isSw ? 'Hakuna matokeo yanayolingana na vichujio vyako' : 'No records match your selected filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: TARGETED PROMO SMS DISPATCH */}
      {smsModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {isSw ? 'Tuma SMS ya Matangazo ya Kijiografia' : 'Dispatch Geo-Targeted Promo SMS'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {smsModalData.customer.name} ({smsModalData.customer.address})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSmsModalData(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isSw ? 'Namba ya Simu:' : 'Recipient Phone:'}
                </label>
                <input
                  type="text"
                  readOnly
                  value={smsModalData.customer.phone}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isSw ? 'Ujumbe wa SMS (Swahili & English):' : 'SMS Message Body:'}
                </label>
                <textarea
                  rows={4}
                  value={smsModalData.offer}
                  onChange={e => setSmsModalData({ ...smsModalData, offer: e.target.value })}
                  className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSmsModalData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmSendSMS}
                className="px-5 py-2 bg-[#0078D4] hover:bg-[#006cbd] text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSw ? 'Tuma SMS Sasa' : 'Send SMS Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
