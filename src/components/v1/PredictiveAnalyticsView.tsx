import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Truck, 
  CheckCircle2, 
  DollarSign, 
  Sliders, 
  Boxes,
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { Language, Product, SaleTransaction, Supplier, PurchaseOrder } from '@/types/v1';
import { formatTSh } from '@/utils/translations';
import { computeDailyVelocity } from '@/lib/analyticsCompute';

interface PredictiveAnalyticsViewProps {
  language: Language;
  products: Product[];
  sales: SaleTransaction[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  onNavigateToSuppliers?: () => void;
}

export const PredictiveAnalyticsView: React.FC<PredictiveAnalyticsViewProps> = ({
  language,
  products,
  sales,
  onOpenAIChatWithPrompt,
  onNavigateToSuppliers,
}) => {
  const isSw = language === 'sw';

  const [scenario, setScenario] = useState<'normal' | 'rainy_season' | 'holiday_rush' | 'supplier_delay'>('normal');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'upcoming' | 'safe'>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [generatedPoProduct, setGeneratedPoProduct] = useState<string | null>(null);

  const velocityMultiplier = 
    scenario === 'rainy_season' ? 1.35 :
    scenario === 'holiday_rush' ? 1.50 :
    scenario === 'supplier_delay' ? 1.05 : 1.0;

  const extraLeadTimeDays = scenario === 'supplier_delay' ? 4 : 0;

  const forecastedProducts = useMemo(() => {
    return products.map((prod) => {
      const baseVelocity = computeDailyVelocity(prod.id, sales);
      const activeVelocity = Math.round((baseVelocity * velocityMultiplier) * 10) / 10;
      const daysRemaining = activeVelocity > 0 ? Math.round(prod.stock / activeVelocity) : (prod.stock > 0 ? 99 : 0);
      
      const supplierLeadTime = 3 + extraLeadTimeDays;
      const daysUntilOrder = Math.max(0, daysRemaining - supplierLeadTime);
      
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() + daysUntilOrder);
      const suggestedDateStr = orderDate.toISOString().split('T')[0];

      const targetDaysCoverage = 21;
      const unitCost = prod.cost ?? prod.buyingPrice ?? 0;
      const suggestedQuantity = Math.max(
        prod.reorderPoint * 2,
        Math.round((activeVelocity * targetDaysCoverage) + Math.max(0, prod.reorderPoint - prod.stock))
      );

      const estimatedCost = suggestedQuantity * unitCost;

      let urgency: 'critical' | 'upcoming' | 'safe' = 'safe';
      if (activeVelocity > 0 && daysUntilOrder <= 3) urgency = 'critical';
      else if (activeVelocity > 0 && daysUntilOrder <= 7) urgency = 'upcoming';
      else if (prod.stock <= prod.reorderPoint) urgency = 'upcoming';

      return {
        ...prod,
        dailyVelocity: activeVelocity,
        daysRemaining,
        supplierLeadTime,
        daysUntilOrder,
        suggestedDateStr,
        suggestedQuantity,
        estimatedCost,
        urgency
      };
    }).sort((a, b) => {
      const order = { critical: 0, upcoming: 1, safe: 2 };
      return order[a.urgency] - order[b.urgency] || a.daysRemaining - b.daysRemaining;
    });
  }, [products, sales, velocityMultiplier, extraLeadTimeDays]);

  useEffect(() => {
    if (products.length === 0) {
      setSelectedProduct('');
      return;
    }
    if (!selectedProduct || !products.some(p => p.id === selectedProduct)) {
      setSelectedProduct(forecastedProducts[0]?.id ?? products[0].id);
    }
  }, [products, forecastedProducts, selectedProduct]);

  const filteredProducts = useMemo(() => {
    return forecastedProducts.filter(p => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (urgencyFilter !== 'all' && p.urgency !== urgencyFilter) return false;
      return true;
    });
  }, [forecastedProducts, categoryFilter, urgencyFilter]);

  const criticalCount = forecastedProducts.filter(p => p.urgency === 'critical').length;
  const upcomingCount = forecastedProducts.filter(p => p.urgency === 'upcoming').length;
  const totalRestockCapitalNeeded = forecastedProducts
    .filter(p => p.urgency === 'critical' || p.urgency === 'upcoming')
    .reduce((sum, p) => sum + p.estimatedCost, 0);

  const activeProductData = forecastedProducts.find(p => p.id === selectedProduct);

  const trajectoryChartData = useMemo(() => {
    if (!activeProductData) return [];

    const data = [];
    const currentStock = activeProductData.stock;
    const velocity = activeProductData.dailyVelocity || 0;
    const safetyStock = activeProductData.reorderPoint;

    for (let i = 5; i >= 1; i--) {
      data.push({
        day: `-${i}d`,
        label: `Siku -${i}`,
        actual: velocity > 0 ? Math.round(currentStock + (i * velocity * 0.95)) : currentStock,
        predicted: null,
        safety: safetyStock,
      });
    }

    data.push({
      day: isSw ? 'Leo' : 'Today',
      label: isSw ? 'Leo' : 'Today',
      actual: currentStock,
      predicted: currentStock,
      safety: safetyStock,
    });

    for (let i = 1; i <= 10; i++) {
      const remaining = velocity > 0 ? Math.max(0, Math.round(currentStock - (i * velocity))) : currentStock;
      data.push({
        day: `+${i}d`,
        label: `+${i}d`,
        actual: null,
        predicted: remaining,
        safety: safetyStock,
      });
    }

    return data;
  }, [activeProductData, isSw]);

  const handleGeneratePO = (prodId: string) => {
    setGeneratedPoProduct(prodId);
    setTimeout(() => {
      if (onNavigateToSuppliers) {
        onNavigateToSuppliers();
      } else {
        alert(isSw 
          ? 'Agizo la manunuzi (PO) limetengenezwa kikamilifu.' 
          : 'Purchase Order generated successfully.'
        );
      }
    }, 1000);
  };

  if (products.length === 0) {
    return (
      <div className="space-y-6 pb-16 animate-in fade-in duration-200">
        <div className="bg-gradient-to-r from-[#1E2244] via-[#2D3369] to-[#40498F] rounded-2xl p-8 text-white shadow-md border border-white/10 text-center">
          <Boxes className="w-12 h-12 mx-auto text-amber-300 mb-3" />
          <h2 className="text-xl font-black">
            {isSw ? 'Utabiri wa Akiba & Mauzo (AI)' : 'AI Restock & Forecast'}
          </h2>
          <p className="text-sm text-slate-300 mt-2 max-w-lg mx-auto">
            {isSw
              ? 'Hakuna bidhaa bado. Ongeza bidhaa kwenye Inventory, kisha rekodi mauzo kupitia POS ili mfumo uweze kubashiri mahitaji ya kuagiza.'
              : 'No products yet. Add inventory items and record sales via POS so the system can forecast restock needs.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      <div className="bg-gradient-to-r from-[#1E2244] via-[#2D3369] to-[#40498F] rounded-2xl p-6 text-white shadow-md border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400/20 text-amber-300">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black tracking-tight text-white">
                {isSw ? 'Utabiri wa Mauzo & Upangaji wa Akiba (AI)' : 'AI Predictive Restock & Velocity Forecasting'}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              {isSw 
                ? 'Mfumo unatumia historia halisi ya mauzo yako kubashiri tarehe ya kuagiza na idadi inayopendekezwa.'
                : 'Forecasts use your actual sales history to suggest reorder dates and quantities.'}
            </p>
          </div>

          <button
            onClick={() => {
              if (onOpenAIChatWithPrompt) {
                onOpenAIChatWithPrompt('Fanya uchambuzi wa utabiri wa mauzo, nionyeshe bidhaa zenye hatari ya kuisha wiki hii.');
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1E2244] font-black text-xs shadow-md transition-all self-start lg:self-auto cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSw ? 'Ushauri wa AI kuhusu Ununuzi' : 'AI Restock Strategy'}</span>
          </button>
        </div>

        <div className="mt-5 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Sliders className="w-4 h-4 text-amber-300" />
            <span className="font-bold text-slate-200">{isSw ? 'Mfano wa Mazingira:' : 'Demand Scenario:'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['normal', 'rainy_season', 'holiday_rush', 'supplier_delay'] as const).map(key => (
              <button
                key={key}
                onClick={() => setScenario(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  scenario === key ? 'bg-white text-[#1E2244] shadow-md font-black' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                {key === 'normal' && (isSw ? '📊 Kawaida' : '📊 Baseline')}
                {key === 'rainy_season' && (isSw ? '🌧️ Msimu wa Mvua (+35%)' : '🌧️ Rainy (+35%)')}
                {key === 'holiday_rush' && (isSw ? '🎉 Sikukuu (+50%)' : '🎉 Holiday (+50%)')}
                {key === 'supplier_delay' && (isSw ? '🚚 Kuchelewa (+4d)' : '🚚 Delay (+4d)')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-rose-200 bg-rose-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              {isSw ? 'Kuagiza Haraka (≤ 3 Siku)' : 'Critical Reorder (≤ 3 Days)'}
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-700" />
          </div>
          <div className="mt-2.5 text-3xl font-black text-rose-700">{criticalCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              {isSw ? 'Maandalizi (Siku 4-7)' : 'Upcoming (4-7 Days)'}
            </span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <div className="mt-2.5 text-3xl font-black text-amber-700">{upcomingCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#6264A7]/30 bg-[#FAF9F8] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#6264A7] uppercase tracking-wider">
              {isSw ? 'Mtaji wa Kuagiza' : 'Restock Capital'}
            </span>
            <DollarSign className="w-4 h-4 text-[#6264A7]" />
          </div>
          <div className="mt-2.5 text-2xl font-black text-[#323130]">{formatTSh(totalRestockCapitalNeeded)}</div>
        </div>
      </div>

      {activeProductData && (
        <div className="bg-white rounded-2xl p-5 border border-[#E1DFDD] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F3F2F1] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#6264A7]" />
                <h3 className="font-extrabold text-sm text-[#323130]">
                  {isSw ? `Mchoro wa Akiba: ${activeProductData.name}` : `Depletion: ${activeProductData.name}`}
                </h3>
              </div>
              <p className="text-xs text-[#605E5C] mt-0.5">
                {activeProductData.dailyVelocity > 0
                  ? (isSw
                    ? `Mzunguko: ${activeProductData.dailyVelocity}/siku • Siku ${activeProductData.daysRemaining} zimebaki`
                    : `Velocity: ${activeProductData.dailyVelocity}/day • ${activeProductData.daysRemaining} days left`)
                  : (isSw ? 'Hakuna mauzo bado — ongeza rekodi za POS' : 'No sales yet — record POS transactions')}
              </p>
            </div>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E1DFDD] text-xs font-bold bg-[#F8F9FA]"
            >
              {forecastedProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.stock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {trajectoryChartData.length > 0 && (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trajectoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F2F1" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#605E5C' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#605E5C' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine y={activeProductData.reorderPoint} stroke="#D13438" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="actual" stroke="#6264A7" fill="#6264A7" fillOpacity={0.25} />
                  <Line type="monotone" dataKey="predicted" stroke="#0284C7" strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-[#E1DFDD] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[#605E5C] block text-[10px] uppercase font-bold">{isSw ? 'Tarehe ya Kuagiza' : 'Reorder Date'}</span>
                <span className="font-extrabold text-sm">{activeProductData.suggestedDateStr}</span>
              </div>
              <div>
                <span className="text-[#605E5C] block text-[10px] uppercase font-bold">{isSw ? 'Idadi' : 'Qty'}</span>
                <span className="font-extrabold text-[#0078D4] text-sm">{activeProductData.suggestedQuantity} {activeProductData.unit}</span>
              </div>
              <div>
                <span className="text-[#605E5C] block text-[10px] uppercase font-bold">{isSw ? 'Gharama' : 'Cost'}</span>
                <span className="font-extrabold text-emerald-700 text-sm">{formatTSh(activeProductData.estimatedCost)}</span>
              </div>
            </div>
            <button
              onClick={() => handleGeneratePO(activeProductData.id)}
              disabled={generatedPoProduct === activeProductData.id}
              className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-[#6264A7] hover:bg-[#525492] text-white cursor-pointer"
            >
              {generatedPoProduct === activeProductData.id ? (
                <><CheckCircle2 className="w-4 h-4" /> PO Created</>
              ) : (
                <><Truck className="w-4 h-4" /> {isSw ? 'Agiza PO' : 'Create PO'}</>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E1DFDD] shadow-xs p-5 space-y-4">
        <h3 className="font-extrabold text-sm text-[#323130]">
          {isSw ? 'Ratiba ya Kuagiza' : 'Reorder Schedule'}
        </h3>
        {filteredProducts.length === 0 ? (
          <p className="text-sm text-[#605E5C] py-8 text-center">
            {isSw ? 'Hakuna bidhaa zinazolingana na vichujio.' : 'No products match the current filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F3F2F1] text-[#605E5C] font-semibold">
                  <th className="pb-2.5">{isSw ? 'Bidhaa' : 'Product'}</th>
                  <th className="pb-2.5">{isSw ? 'Akiba' : 'Stock'}</th>
                  <th className="pb-2.5">{isSw ? 'Mzunguko' : 'Velocity'}</th>
                  <th className="pb-2.5">{isSw ? 'Siku' : 'Days'}</th>
                  <th className="pb-2.5">{isSw ? 'Tarehe' : 'Date'}</th>
                  <th className="pb-2.5 text-right">{isSw ? 'Hatua' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2F1]">
                {filteredProducts.map((prod) => (
                  <tr key={prod.id} onClick={() => setSelectedProduct(prod.id)} className="hover:bg-[#F8F9FA] cursor-pointer">
                    <td className="py-3 font-bold">{prod.name}</td>
                    <td className="py-3">{prod.stock} {prod.unit}</td>
                    <td className="py-3">{prod.dailyVelocity}/day</td>
                    <td className="py-3">{prod.daysRemaining}</td>
                    <td className="py-3">{prod.suggestedDateStr}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGeneratePO(prod.id); }}
                        className="px-2.5 py-1 rounded-lg bg-[#6264A7] text-white text-xs font-bold cursor-pointer"
                      >
                        PO
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
