import type { Customer, CustomerBIInsight, ExpenseItem, Product, ProductBIInsight, SaleTransaction, Supplier } from '@/types/v1';

export function computeProductInsights(products: Product[], sales: SaleTransaction[]): ProductBIInsight[] {
  const volumeByProduct = new Map<string, { qty: number; revenue: number }>();
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const cur = volumeByProduct.get(item.productId) ?? { qty: 0, revenue: 0 };
      volumeByProduct.set(item.productId, {
        qty: cur.qty + item.quantity,
        revenue: cur.revenue + item.total,
      });
    });
  });

  const insights = products.map(p => {
    const vol = volumeByProduct.get(p.id) ?? { qty: 0, revenue: 0 };
    const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
    const grossProfitPerUnit = p.price - p.cost;
    const monthlyGrossProfit = vol.qty * grossProfitPerUnit;
    const turnoverDays = vol.qty > 0 && p.stock > 0 ? Math.round((p.stock / vol.qty) * 30) : 999;
    let stockHealthStatus: ProductBIInsight['stockHealthStatus'] = 'healthy';
    if (vol.qty === 0 && p.stock > p.reorderPoint * 2) stockHealthStatus = 'dead_capital';
    else if (vol.qty > p.reorderPoint) stockHealthStatus = 'fast_mover';
    else if (p.stock <= p.reorderPoint) stockHealthStatus = 'slow_mover';

    return {
      productId: p.id,
      productName: p.name,
      category: p.category,
      sku: p.sku,
      unitPrice: p.price,
      costPrice: p.cost,
      marginPercent: Math.round(margin * 10) / 10,
      grossProfitPerUnit,
      monthlySalesVolume: vol.qty,
      monthlyRevenue: vol.revenue,
      monthlyGrossProfit,
      profitContributionPercent: 0,
      paretoClass: 'C' as const,
      turnoverDays,
      stockHealthStatus,
      reorderUrgency: p.stock <= 5 ? 'critical' as const : p.stock <= p.reorderPoint ? 'normal' as const : 'overstocked' as const,
    };
  });

  const totalProfit = insights.reduce((s, i) => s + i.monthlyGrossProfit, 0) || 1;
  const sorted = insights
    .map(i => ({ ...i, profitContributionPercent: Math.round((i.monthlyGrossProfit / totalProfit) * 1000) / 10 }))
    .sort((a, b) => b.monthlyGrossProfit - a.monthlyGrossProfit);

  let cumulative = 0;
  return sorted.map(i => {
    cumulative += i.profitContributionPercent;
    const paretoClass: ProductBIInsight['paretoClass'] =
      cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C';
    return { ...i, paretoClass };
  });
}

export function computeCustomerInsights(customers: Customer[], sales: SaleTransaction[]): CustomerBIInsight[] {
  const byCustomer = new Map<string, { spend: number; count: number; lastDate: string }>();
  sales.forEach(sale => {
    if (!sale.customerId) return;
    const cur = byCustomer.get(sale.customerId) ?? { spend: 0, count: 0, lastDate: sale.date };
    byCustomer.set(sale.customerId, {
      spend: cur.spend + sale.total,
      count: cur.count + 1,
      lastDate: sale.date > cur.lastDate ? sale.date : cur.lastDate,
    });
  });

  return customers.map(c => {
    const stats = byCustomer.get(c.id) ?? { spend: c.totalPurchases, count: 0, lastDate: c.lastPurchaseDate };
    const avg = stats.count > 0 ? stats.spend / stats.count : 0;
    const daysSince = stats.lastDate
      ? Math.max(0, Math.floor((Date.now() - new Date(stats.lastDate).getTime()) / 86400000))
      : (c.lastPurchaseDate
        ? Math.max(0, Math.floor((Date.now() - new Date(c.lastPurchaseDate).getTime()) / 86400000))
        : 999);

    let segment: CustomerBIInsight['segment'] = 'Occasional Buyer';
    if (stats.spend > 500000) segment = 'VIP Champion';
    else if (stats.spend > 200000) segment = 'Loyal Core';
    else if (stats.count >= 3) segment = 'High Potential';
    else if (daysSince > 60) segment = 'At Risk';

    return {
      customerId: c.id,
      customerName: c.name,
      phone: c.phone,
      loyaltyTier: c.loyaltyTier,
      totalSpend: stats.spend || c.totalPurchases,
      purchaseCount: stats.count,
      averageOrderValue: Math.round(avg),
      lifetimeGrossMargin: Math.round((stats.spend || c.totalPurchases) * 0.25),
      daysSinceLastPurchase: daysSince,
      churnRisk: daysSince > 90 ? 'high_churn' : daysSince > 45 ? 'medium' : 'low',
      creditHealth: c.balance > c.creditLimit * 0.8 ? 'overdue_risk' : c.balance > 0 ? 'prompt_payer' : 'reliable_cash',
      segment,
    };
  });
}

export type BITimeRange = 'month' | 'quarter' | 'year' | 'all';

export function filterSalesByTimeRange(sales: SaleTransaction[], range: BITimeRange): SaleTransaction[] {
  if (range === 'all') return sales;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  if (range === 'month') {
    cutoff.setDate(1);
  } else if (range === 'quarter') {
    cutoff.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
  } else {
    cutoff.setMonth(0, 1);
  }
  return sales.filter(s => new Date(s.date.replace(' ', 'T')) >= cutoff);
}

export function filterExpensesByTimeRange(expenses: ExpenseItem[], range: BITimeRange): ExpenseItem[] {
  if (range === 'all') return expenses;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  if (range === 'month') {
    cutoff.setDate(1);
  } else if (range === 'quarter') {
    cutoff.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
  } else {
    cutoff.setMonth(0, 1);
  }
  return expenses.filter(e => new Date(e.date) >= cutoff);
}

export function computeMoMRevenueChange(sales: SaleTransaction[]): {
  percent: number;
  hasData: boolean;
  direction: 'up' | 'down' | 'flat';
} {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let thisMonth = 0;
  let lastMonth = 0;
  sales.forEach(s => {
    const d = new Date(s.date.replace(' ', 'T'));
    if (d >= thisMonthStart) thisMonth += s.total;
    else if (d >= lastMonthStart && d < thisMonthStart) lastMonth += s.total;
  });

  if (thisMonth === 0 && lastMonth === 0) return { percent: 0, hasData: false, direction: 'flat' };
  if (lastMonth === 0) return { percent: 100, hasData: true, direction: 'up' };
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10;
  return {
    percent: Math.abs(pct),
    hasData: true,
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  };
}

export interface CategoryProfitRow {
  category: string;
  profit: number;
  marginPercent: number;
  profitSharePercent: number;
}

export function computeCategoryProfitContribution(
  products: Product[],
  sales: SaleTransaction[],
): CategoryProfitRow[] {
  const costById = new Map(products.map(p => [p.id, p.cost ?? p.buyingPrice ?? 0]));
  const byCat = new Map<string, { revenue: number; cogs: number }>();

  sales.forEach(sale => {
    sale.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const category = product?.category || 'General';
      const revenue = item.total ?? item.quantity * item.unitPrice;
      const cogs = (costById.get(item.productId) ?? 0) * item.quantity;
      const entry = byCat.get(category) ?? { revenue: 0, cogs: 0 };
      entry.revenue += revenue;
      entry.cogs += cogs;
      byCat.set(category, entry);
    });
  });

  const rows = Array.from(byCat.entries()).map(([category, data]) => {
    const profit = data.revenue - data.cogs;
    const marginPercent = data.revenue > 0 ? Math.round((profit / data.revenue) * 1000) / 10 : 0;
    return { category, profit, marginPercent, profitSharePercent: 0 };
  });

  const totalProfit = rows.reduce((s, r) => s + Math.max(0, r.profit), 0) || 1;
  return rows
    .map(r => ({
      ...r,
      profitSharePercent: Math.round((Math.max(0, r.profit) / totalProfit) * 1000) / 10,
    }))
    .sort((a, b) => b.profit - a.profit);
}

export interface MonthlyPLRow {
  month: string;
  short: string;
  revenue: number;
  cogs: number;
  opex: number;
  netProfit: number;
}

export function computeMonthlyPLTrend(
  sales: SaleTransaction[],
  products: Product[],
  expenses: ExpenseItem[],
  isSw: boolean,
  monthCount = 8,
): MonthlyPLRow[] {
  const costById = new Map(products.map(p => [p.id, p.cost ?? p.buyingPrice ?? 0]));
  const buckets: Array<MonthlyPLRow & { key: string }> = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = isSw
      ? d.toLocaleString('sw-TZ', { month: 'short' })
      : d.toLocaleString('en', { month: 'short' });
    buckets.push({ month: label, short: label, revenue: 0, cogs: 0, opex: 0, netProfit: 0, key });
  }

  sales.forEach(sale => {
    const sd = new Date(sale.date.replace(' ', 'T'));
    const key = `${sd.getFullYear()}-${sd.getMonth()}`;
    const bucket = buckets.find(b => b.key === key);
    if (!bucket) return;
    bucket.revenue += sale.total;
    bucket.cogs += sale.items.reduce(
      (sum, item) => sum + (costById.get(item.productId) ?? 0) * item.quantity,
      0,
    );
  });

  expenses.forEach(exp => {
    const ed = new Date(exp.date);
    const key = `${ed.getFullYear()}-${ed.getMonth()}`;
    const bucket = buckets.find(b => b.key === key);
    if (bucket) bucket.opex += exp.amount;
  });

  return buckets.map(({ key: _, ...rest }) => ({
    ...rest,
    netProfit: rest.revenue - rest.cogs - rest.opex,
  }));
}

export interface CostSavingOpportunity {
  id: string;
  savingsLabel: string;
  tag: string;
  title: string;
  description: string;
}

export function buildCostSavingOpportunities(
  productInsights: ProductBIInsight[],
  products: Product[],
  expenses: ExpenseItem[],
  suppliers: Supplier[],
  isSw: boolean,
): CostSavingOpportunity[] {
  const ops: CostSavingOpportunity[] = [];
  const stockById = new Map(products.map(p => [p.id, p.stock]));

  const deadCapital = productInsights.filter(
    p => p.paretoClass === 'C' && (p.stockHealthStatus === 'dead_capital' || p.monthlySalesVolume === 0),
  ).slice(0, 2);

  if (deadCapital.length > 0) {
    const locked = deadCapital.reduce(
      (s, p) => s + p.costPrice * (stockById.get(p.productId) ?? 0),
      0,
    );
    const names = deadCapital.map(p => p.productName).join(', ');
    ops.push({
      id: 'dead-capital',
      savingsLabel: isSw ? `Okoa hadi ${formatTSh(Math.max(50000, locked))}` : `Save up to ${formatTSh(Math.max(50000, locked))}`,
      tag: isSw ? 'Mtaji uliolala' : 'Dead capital',
      title: isSw ? '1. Toa punguzo kwa bidhaa za Daraja C' : '1. Discount or bundle slow Class C SKUs',
      description: isSw
        ? `${names} hazina mauzo ya kutosha. Fanya ofa ya kuhamisha akiba na kurejesha mtaji kwa bidhaa zinazouzika.`
        : `${names} have weak turnover. Run a promo to free working capital for faster-moving items.`,
    });
  }

  const utilities = expenses.filter(e => e.category === 'utilities_luku' || e.category === 'water');
  const utilityTotal = utilities.reduce((s, e) => s + e.amount, 0);
  if (utilityTotal > 0) {
    ops.push({
      id: 'utilities',
      savingsLabel: isSw ? `Okoa ~${formatTSh(Math.round(utilityTotal * 0.1))} / mwezi` : `Save ~${formatTSh(Math.round(utilityTotal * 0.1))} / mo`,
      tag: isSw ? 'Umeme & maji' : 'Utilities',
      title: isSw ? '2. Punguza matumizi ya umeme na maji' : '2. Trim electricity & water usage',
      description: isSw
        ? `Matumizi ya sasa ni ${formatTSh(utilityTotal)}. Zima taa/AC nje ya masaa ya mauzo na fuatilia LUKU kila wiki.`
        : `Current utility spend is ${formatTSh(utilityTotal)}. Switch off non-essential loads after hours and track LUKU weekly.`,
    });
  }

  const topSupplier = [...suppliers].sort((a, b) => b.outstandingPayable - a.outstandingPayable)[0];
  if (topSupplier && topSupplier.outstandingPayable > 0) {
    ops.push({
      id: 'supplier-terms',
      savingsLabel: isSw
        ? `Okoa ~${formatTSh(Math.round(topSupplier.outstandingPayable * 0.05))}`
        : `Save ~${formatTSh(Math.round(topSupplier.outstandingPayable * 0.05))}`,
      tag: isSw ? 'Wasambazaji' : 'Suppliers',
      title: isSw ? '3. Omba punguzo la malipo ya mapema' : '3. Negotiate early payment discount',
      description: isSw
        ? `${topSupplier.name} ana deni la ${formatTSh(topSupplier.outstandingPayable)}. Uliza punguzo la 3–5% kwa malipo ndani ya siku 7–10.`
        : `${topSupplier.name} has ${formatTSh(topSupplier.outstandingPayable)} payable. Ask for 3–5% early settlement if you pay within 7–10 days.`,
    });
  }

  const stipends = expenses.filter(e => e.category === 'daily_stipends_food_transport');
  const stipendTotal = stipends.reduce((s, e) => s + e.amount, 0);
  if (stipendTotal > 0 || productInsights.length > 0) {
    ops.push({
      id: 'stipends',
      savingsLabel: stipendTotal > 0
        ? (isSw ? `Okoa ~${formatTSh(Math.round(stipendTotal * 0.15))} / mwezi` : `Save ~${formatTSh(Math.round(stipendTotal * 0.15))} / mo`)
        : (isSw ? 'Zuia uvujaji wa posho' : 'Prevent allowance leakage'),
      tag: isSw ? 'Posho & HR' : 'Allowances',
      title: isSw ? '4. Thibitisha posho kwa zamu za kazi' : '4. Tie stipends to verified shifts',
      description: isSw
        ? 'Lipia posho ya chakula/nauli tu kwa wafanyakazi waliosaini kuingia kazini — hii inazuia malipo maradufu.'
        : 'Pay food/transport allowances only for staff with verified shift sign-in to stop duplicate claims.',
    });
  }

  if (ops.length === 0) {
    ops.push({
      id: 'baseline',
      savingsLabel: isSw ? 'Anza kurekodi data' : 'Start recording data',
      tag: isSw ? 'Ushauri' : 'Guidance',
      title: isSw ? 'Rekodi mauzo, matumizi na wasambazaji' : 'Record sales, expenses, and suppliers',
      description: isSw
        ? 'Ukisha rekodi mauzo ya POS na matumizi ya duka, fursa za kuokoa fedha zitaonekana hapa kiotomatiki.'
        : 'Once POS sales and shop expenses are recorded, cost-saving opportunities will appear here automatically.',
    });
  }

  return ops.slice(0, 4);
}

function formatTSh(n: number): string {
  return `TSh ${Math.round(n).toLocaleString('en-TZ')}`;
}
