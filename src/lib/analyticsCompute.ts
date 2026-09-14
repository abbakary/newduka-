import type { Customer, Product, SaleTransaction } from '@/types/v1';

export interface ProductSalesStats {
  units: number;
  revenue: number;
  customers: Set<string>;
  lastDate: string;
}

export function buildProductSalesMap(sales: SaleTransaction[]): Record<string, ProductSalesStats> {
  const map: Record<string, ProductSalesStats> = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      if (!map[item.productId]) {
        map[item.productId] = { units: 0, revenue: 0, customers: new Set(), lastDate: sale.date };
      }
      const entry = map[item.productId];
      entry.units += item.quantity;
      entry.revenue += item.totalPrice ?? item.total ?? item.quantity * item.unitPrice;
      if (sale.customerName) entry.customers.add(sale.customerName);
      if (sale.date > entry.lastDate) entry.lastDate = sale.date;
    });
  });
  return map;
}

export function computeDailyVelocity(productId: string, sales: SaleTransaction[], windowDays = 30): number {
  const cutoff = Date.now() - windowDays * 86400000;
  let units = 0;
  let earliest = Date.now();
  sales.forEach(sale => {
    const ts = new Date(sale.date).getTime();
    if (ts < cutoff) return;
    sale.items.forEach(item => {
      if (item.productId === productId) {
        units += item.quantity;
        if (ts < earliest) earliest = ts;
      }
    });
  });
  if (units === 0) return 0;
  const spanDays = Math.max(1, (Date.now() - Math.max(earliest, cutoff)) / 86400000);
  return Math.round((units / spanDays) * 10) / 10;
}

const PAYMENT_COLORS: Record<string, string> = {
  mpesa: '#107C10',
  cash: '#D97706',
  airtel: '#DC2626',
  tigopesa: '#0284C7',
  card: '#6264A7',
  credit: '#8764B8',
};

const PAYMENT_LABELS: Record<string, { en: string; sw: string }> = {
  mpesa: { en: 'M-Pesa', sw: 'M-Pesa Lipa Namba' },
  cash: { en: 'Cash', sw: 'Pesa Taslimu (Cash)' },
  airtel: { en: 'Airtel Money', sw: 'Airtel Money' },
  tigopesa: { en: 'Tigo Pesa', sw: 'Tigo Pesa' },
  card: { en: 'Card', sw: 'Kadi' },
  credit: { en: 'Customer Credit', sw: 'Mkopo wa Wateja' },
};

export function computeTotalRevenue(sales: SaleTransaction[]): number {
  return sales.reduce((sum, s) => sum + s.total, 0);
}

export function computeTotalCOGS(sales: SaleTransaction[], products: Product[]): number {
  const costById = new Map(products.map(p => [p.id, p.cost ?? p.buyingPrice ?? 0]));
  return sales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => {
      const cost = costById.get(item.productId) ?? 0;
      return itemSum + cost * item.quantity;
    }, 0);
  }, 0);
}

export function computePaymentMethodsBreakdown(sales: SaleTransaction[], isSw: boolean) {
  const totals: Record<string, number> = {};
  sales.forEach(sale => {
    sale.payments?.forEach(p => {
      totals[p.method] = (totals[p.method] ?? 0) + p.amount;
    });
    if (!sale.payments?.length) {
      totals.cash = (totals.cash ?? 0) + sale.total;
    }
  });
  const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([method, value]) => ({
      name: isSw ? (PAYMENT_LABELS[method]?.sw ?? method) : (PAYMENT_LABELS[method]?.en ?? method),
      value,
      color: PAYMENT_COLORS[method] ?? '#605E5C',
      percent: Math.round((value / grand) * 1000) / 10,
    }));
}

export function computeHourlyRushData(sales: SaleTransaction[]) {
  const hours = Array.from({ length: 14 }, (_, i) => 8 + i);
  const byHour: Record<string, { sales: number; orders: number }> = {};
  hours.forEach(h => {
    byHour[`${String(h).padStart(2, '0')}:00`] = { sales: 0, orders: 0 };
  });
  sales.forEach(sale => {
    const d = new Date(sale.date);
    const h = d.getHours();
    if (h < 8 || h > 21) return;
    const key = `${String(h).padStart(2, '0')}:00`;
    if (!byHour[key]) byHour[key] = { sales: 0, orders: 0 };
    byHour[key].sales += sale.total;
    byHour[key].orders += 1;
  });
  const maxSales = Math.max(...Object.values(byHour).map(v => v.sales), 1);
  return Object.entries(byHour).map(([hour, data]) => ({
    hour,
    sales: data.sales,
    orders: data.orders,
    isPeak: data.sales >= maxSales * 0.75 && data.sales > 0,
  }));
}

function dayLabel(date: Date, isSw: boolean): string {
  const idx = date.getDay();
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sw = ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'];
  return isSw ? sw[idx] : en[idx];
}

export function computeSalesPerformance7d(sales: SaleTransaction[], products: Product[], isSw: boolean) {
  const days: { date: Date; revenue: number; orders: number; cogs: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: new Date(d), revenue: 0, orders: 0, cogs: 0 });
  }
  const costById = new Map(products.map(p => [p.id, p.cost ?? p.buyingPrice ?? 0]));
  sales.forEach(sale => {
    const sd = new Date(sale.date);
    sd.setHours(0, 0, 0, 0);
    const bucket = days.find(d => d.date.getTime() === sd.getTime());
    if (!bucket) return;
    bucket.revenue += sale.total;
    bucket.orders += 1;
    bucket.cogs += sale.items.reduce((s, item) => s + (costById.get(item.productId) ?? 0) * item.quantity, 0);
  });
  return days.map(d => {
    const netProfit = d.revenue - d.cogs;
    const margin = d.revenue > 0 ? Math.round((netProfit / d.revenue) * 1000) / 10 : 0;
    return {
      name: dayLabel(d.date, isSw),
      short: dayLabel(d.date, false),
      revenue: d.revenue,
      target: d.revenue > 0 ? Math.round(d.revenue * 0.9) : 0,
      netProfit,
      orders: d.orders,
      margin,
    };
  });
}

export function computeSalesPerformance30d(sales: SaleTransaction[], products: Product[]) {
  const weeks: { label: string; revenue: number; orders: number; cogs: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    weeks.push({ label: `Wk ${4 - w}`, revenue: 0, orders: 0, cogs: 0 });
  }
  const costById = new Map(products.map(p => [p.id, p.cost ?? p.buyingPrice ?? 0]));
  const now = new Date();
  sales.forEach(sale => {
    const sd = new Date(sale.date);
    const diffDays = Math.floor((now.getTime() - sd.getTime()) / 86400000);
    if (diffDays < 0 || diffDays >= 28) return;
    const wIdx = 3 - Math.floor(diffDays / 7);
    if (wIdx < 0 || wIdx > 3) return;
    weeks[wIdx].revenue += sale.total;
    weeks[wIdx].orders += 1;
    weeks[wIdx].cogs += sale.items.reduce((s, item) => s + (costById.get(item.productId) ?? 0) * item.quantity, 0);
  });
  return weeks.map(w => {
    const netProfit = w.revenue - w.cogs;
    const margin = w.revenue > 0 ? Math.round((netProfit / w.revenue) * 1000) / 10 : 0;
    return {
      name: w.label,
      short: w.label,
      revenue: w.revenue,
      target: w.revenue > 0 ? Math.round(w.revenue * 0.85) : 0,
      netProfit,
      orders: w.orders,
      margin,
    };
  });
}

export function computeSalesPerformanceQuarter(sales: SaleTransaction[], products: Product[], isSw: boolean) {
  const months: { key: string; label: string; revenue: number; orders: number; cogs: number }[] = [];
  for (let m = 2; m >= 0; m--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - m);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: isSw ? `Mwezi ${3 - m}` : d.toLocaleString('en', { month: 'short' }),
      revenue: 0,
      orders: 0,
      cogs: 0,
    });
  }
  const costById = new Map(products.map(p => [p.id, p.cost ?? p.buyingPrice ?? 0]));
  sales.forEach(sale => {
    const sd = new Date(sale.date);
    const key = `${sd.getFullYear()}-${sd.getMonth()}`;
    const bucket = months.find(m => m.key === key);
    if (!bucket) return;
    bucket.revenue += sale.total;
    bucket.orders += 1;
    bucket.cogs += sale.items.reduce((s, item) => s + (costById.get(item.productId) ?? 0) * item.quantity, 0);
  });
  return months.map(m => {
    const netProfit = m.revenue - m.cogs;
    const margin = m.revenue > 0 ? Math.round((netProfit / m.revenue) * 1000) / 10 : 0;
    return {
      name: m.label,
      short: m.label,
      revenue: m.revenue,
      target: m.revenue > 0 ? Math.round(m.revenue * 0.85) : 0,
      netProfit,
      orders: m.orders,
      margin,
    };
  });
}

export function computeProductInsightsSummary(
  products: Product[],
  sales: SaleTransaction[],
  customers: Customer[],
  isSw: boolean,
) {
  const salesMap = buildProductSalesMap(sales);
  const totalRev = computeTotalRevenue(sales) || 1;

  const ranked = products
    .map(p => {
      const stats = salesMap[p.id] ?? { units: 0, revenue: 0, customers: new Set<string>(), lastDate: '' };
      const velocity = computeDailyVelocity(p.id, sales);
      const marginPct = p.price > 0 ? Math.round(((p.price - (p.cost ?? p.buyingPrice ?? 0)) / p.price) * 100) : 0;
      const topCustomer = stats.customers.size ? Array.from(stats.customers)[0] : '—';
      const cust = customers.find(c => c.name === topCustomer);
      const territory = cust?.address?.split(',')[0]?.trim() || '—';
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unitsSold: stats.units,
        revenue: stats.revenue,
        margin: `${marginPct}%`,
        stock: p.stock,
        topCustomer,
        topTerritory: territory,
        velocity: velocity > 0 ? `${velocity} / day` : '—',
        trend: stats.units > 0 ? '+' : '—',
        status: 'bestseller' as const,
        velocityNum: velocity,
      };
    })
    .filter(p => p.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold);

  const bestMoving = ranked.slice(0, 4);

  const slowMoving = products
    .map(p => {
      const stats = salesMap[p.id] ?? { units: 0, revenue: 0, customers: new Set<string>(), lastDate: '' };
      const daysSince = stats.lastDate
        ? Math.floor((Date.now() - new Date(stats.lastDate).getTime()) / 86400000)
        : 999;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unitsSold: stats.units,
        stock: p.stock,
        stagnantDays: stats.units === 0 ? daysSince : daysSince,
        laggingTerritory: '—',
        aiRecommendation: isSw
          ? stats.units === 0
            ? 'Hakuna mauzo bado — weka ofa ya kuanzisha au tangaza bidhaa.'
            : 'Punguza bei kidogo au unganisha na bidhaa zinazouzika vizuri.'
          : stats.units === 0
            ? 'No sales yet — run a launch promo or bundle with top sellers.'
            : 'Consider a small discount or bundle with fast-moving items.',
        urgency: (p.stock > p.reorderPoint * 2 && stats.units <= 2 ? 'high' : stats.units <= 5 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        sortKey: stats.units,
      };
    })
    .filter(p => p.unitsSold <= 5 && p.stock > 0)
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 4)
    .map(({ sortKey: _, ...rest }) => rest);

  const locMap = new Map<string, { revenue: number; clients: Set<string>; products: Map<string, number> }>();
  sales.forEach(sale => {
    const cust = customers.find(c => c.id === sale.customerId);
    const loc = cust?.address?.split(',')[0]?.trim() || (isSw ? 'Wateja wa Kawaida' : 'Walk-in / General');
    if (!locMap.has(loc)) locMap.set(loc, { revenue: 0, clients: new Set(), products: new Map() });
    const entry = locMap.get(loc)!;
    entry.revenue += sale.total;
    if (sale.customerId) entry.clients.add(sale.customerId);
    sale.items.forEach(item => {
      entry.products.set(item.productName, (entry.products.get(item.productName) ?? 0) + item.quantity);
    });
  });

  const territories = Array.from(locMap.entries())
    .map(([name, data]) => {
      const topProduct = [...data.products.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      const share = Math.round((data.revenue / totalRev) * 1000) / 10;
      return {
        name,
        revenue: data.revenue,
        share: `${share}%`,
        topProduct,
        activeClients: data.clients.size,
        statusColor: share >= 30 ? 'emerald' : share >= 15 ? 'sky' : 'amber',
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const crossSellOpportunities: Array<{
    id: string;
    customer: string;
    phone: string;
    territory: string;
    boughtProduct: string;
    recommendedAddon: string;
    expectedValue: string;
    confidence: string;
    rationale: string;
  }> = [];

  customers.slice(0, 5).forEach(cust => {
    const purchased = new Set<string>();
    const unpurchased: Product[] = [];
    sales.filter(s => s.customerId === cust.id).forEach(s => {
      s.items.forEach(i => purchased.add(i.productId));
    });
    products.forEach(p => {
      if (!purchased.has(p.id) && purchased.size > 0) unpurchased.push(p);
    });
    if (purchased.size === 0 || unpurchased.length === 0) return;
    const fav = products.find(p => purchased.has(p.id));
    const rec = unpurchased[0];
    crossSellOpportunities.push({
      id: `cs-${cust.id}-${rec.id}`,
      customer: cust.name,
      phone: cust.phone,
      territory: cust.address?.split(',')[0]?.trim() || '—',
      boughtProduct: fav?.name ?? '—',
      recommendedAddon: rec.name,
      expectedValue: `TZS ${Math.round(rec.price * 2).toLocaleString()}`,
      confidence: purchased.size >= 3 ? '85% Match' : '70% Match',
      rationale: isSw
        ? `${cust.name} amewahi kununua ${fav?.name ?? 'bidhaa'} — pendekeza ${rec.name}.`
        : `${cust.name} buys ${fav?.name ?? 'items'} regularly — suggest ${rec.name} as add-on.`,
    });
  });

  return { bestMoving, slowMoving, territories, crossSellOpportunities };
}

export function computeShiftCashierStats(
  sales: SaleTransaction[],
  cashierName?: string,
  opts?: { shiftOpenedAt?: string | null; mineOnly?: boolean },
) {
  const today = localCalendarYmd();
  const openedAt = opts?.shiftOpenedAt ? new Date(opts.shiftOpenedAt).getTime() : null;
  const mineOnly = Boolean(opts?.mineOnly && cashierName);

  const todaySales = sales.filter(s => {
    if (!isCompletedLikeSale(s)) return false;
    if (!saleDateStartsWith(s.date, today)) return false;
    if (mineOnly && !saleMatchesName(s.cashierName, cashierName)) return false;
    if (openedAt != null) {
      const t = Date.parse(String(s.date).replace(' ', 'T'));
      if (!Number.isNaN(t) && t < openedAt) return false;
    }
    return true;
  });

  const totals = { cash: 0, mpesa: 0, airtel: 0, tigopesa: 0, card: 0, credit: 0 };
  todaySales.forEach(s => {
    const payments = s.payments?.length
      ? s.payments
      : [{ method: s.type === 'credit' ? 'credit' as const : 'cash' as const, amount: s.total }];
    payments.forEach(p => {
      const method = (p.method || 'cash') as keyof typeof totals;
      if (method in totals) totals[method] += Number(p.amount || 0);
      else totals.cash += Number(p.amount || 0);
    });
  });
  const shiftSalesTotal = todaySales.reduce((s, sale) => s + sale.total, 0);
  return {
    cashierName: cashierName ? `${cashierName}` : 'Cashier',
    shiftName: today,
    shiftSalesTotal,
    shiftTarget: shiftSalesTotal > 0 ? Math.round(shiftSalesTotal * 1.15) : 50_000,
    receiptsIssued: todaySales.length,
    cashDrawerBalance: totals.cash,
    mpesaCollected: totals.mpesa,
    airtelCollected: totals.airtel,
    todayStipendPaid: 0,
    stipendStatus: 'pending' as const,
  };
}

function localCalendarYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse sale timestamps (ISO/Z or "YYYY-MM-DD HH:mm") into local calendar YMD. */
function saleLocalYmd(date: string): string {
  const raw = String(date || '').trim();
  if (!raw) return '';
  // Prefer explicit local/naive wall-clock prefix when no timezone marker
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return raw.slice(0, 10);
  }
  const t = Date.parse(raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw);
  if (Number.isNaN(t)) return raw.slice(0, 10);
  return localCalendarYmd(new Date(t));
}

function saleDateStartsWith(date: string, ymd: string): boolean {
  return saleLocalYmd(date) === ymd;
}

function isCompletedLikeSale(s: SaleTransaction): boolean {
  const st = String(s.status || '').toLowerCase();
  if (['cancelled', 'voided', 'refunded', 'open'].includes(st)) return false;
  return true;
}

function saleMatchesName(saleCashier: string | undefined, cashierName: string | undefined): boolean {
  if (!cashierName) return true;
  const a = (saleCashier || '').trim().toLowerCase();
  const b = cashierName.trim().toLowerCase();
  if (!a) return true; // untagged sales still count for shift totals when filter is soft
  return a === b || a.includes(b) || b.includes(a);
}

export function computeCashierLeaderboard(
  sales: SaleTransaction[],
  opts?: { dateYmd?: string },
): Array<{ cashierName: string; receipts: number; revenue: number; cash: number; mobile: number }> {
  const day = opts?.dateYmd || localCalendarYmd();
  const map = new Map<string, { receipts: number; revenue: number; cash: number; mobile: number }>();
  sales.forEach(s => {
    if (!isCompletedLikeSale(s)) return;
    if (!saleDateStartsWith(s.date, day)) return;
    const name = (s.cashierName || 'Unknown').trim() || 'Unknown';
    const cur = map.get(name) ?? { receipts: 0, revenue: 0, cash: 0, mobile: 0 };
    cur.receipts += 1;
    cur.revenue += Number(s.total || 0);
    const payments = s.payments?.length
      ? s.payments
      : [{ method: 'cash' as const, amount: s.total }];
    payments.forEach(p => {
      const m = String(p.method || 'cash').toLowerCase();
      if (m === 'cash') cur.cash += Number(p.amount || 0);
      if (m === 'mpesa' || m === 'airtel' || m === 'tigopesa') cur.mobile += Number(p.amount || 0);
    });
    map.set(name, cur);
  });
  return Array.from(map.entries())
    .map(([cashierName, v]) => ({ cashierName, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function computeStaffMobileMoneyTotal(sales: SaleTransaction[]): number {
  return sales.reduce((sum, sale) => {
    return sum + (sale.payments?.filter(p => p.method === 'mpesa' || p.method === 'tigopesa').reduce((s, p) => s + p.amount, 0) ?? 0);
  }, 0);
}

export function computeWeekOverWeekChange(sales: SaleTransaction[]): { percent: number; hasData: boolean; direction: 'up' | 'down' | 'flat' } {
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - 7);
  thisWeekStart.setHours(0, 0, 0, 0);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let thisWeek = 0;
  let lastWeek = 0;
  sales.forEach(sale => {
    const d = new Date(sale.date);
    if (d >= thisWeekStart) thisWeek += sale.total;
    else if (d >= lastWeekStart && d < thisWeekStart) lastWeek += sale.total;
  });

  if (thisWeek === 0 && lastWeek === 0) return { percent: 0, hasData: false, direction: 'flat' };
  if (lastWeek === 0) return { percent: 100, hasData: true, direction: 'up' };
  const percent = Math.round(((thisWeek - lastWeek) / lastWeek) * 1000) / 10;
  return {
    percent: Math.abs(percent),
    hasData: true,
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
  };
}

export function computeAverageDailySales(data: Array<{ revenue: number }>): number {
  if (data.length === 0) return 0;
  return Math.round(data.reduce((sum, row) => sum + row.revenue, 0) / data.length);
}

export function computePeakHoursSummary(
  hourlyRushData: ReturnType<typeof computeHourlyRushData>,
  isSw: boolean,
): { badge: string; summary: string; hasData: boolean } {
  const peaks = hourlyRushData.filter(h => h.isPeak && h.sales > 0);
  if (peaks.length === 0) {
    return {
      badge: isSw ? 'Hakuna data' : 'No data',
      summary: isSw ? 'Hakuna mauzo ya kutosha kuonyesha masaa ya foleni.' : 'Not enough sales to identify peak hours yet.',
      hasData: false,
    };
  }
  const first = peaks[0].hour;
  const last = peaks[peaks.length - 1].hour;
  const endHour = `${String(parseInt(last.split(':')[0], 10) + 1).padStart(2, '0')}:00`;
  const badge = peaks.length === 1 ? `${first} - ${endHour}` : `${first} - ${endHour}`;
  const summary = isSw
    ? `Masaa ya foleni kuu: ${peaks.map(p => p.hour).join(', ')}`
    : `Peak rush hours: ${peaks.map(p => p.hour).join(', ')}`;
  return { badge: `${badge} Rush`, summary, hasData: true };
}

export function computeSuggestedReorderDate(
  product: Product | undefined,
  sales: SaleTransaction[],
  scenario: 'baseline' | 'rainy_season' | 'promo' | 'delay',
  isSw = true,
): { message: string; urgent: boolean; daysUntilStockout: number | null } {
  if (!product) {
    return {
      message: isSw ? 'Ongeza bidhaa kwenye stoo kwanza.' : 'Add products to inventory first.',
      urgent: false,
      daysUntilStockout: null,
    };
  }
  const multiplier =
    scenario === 'rainy_season' ? 1.3 :
    scenario === 'promo' ? 1.5 :
    scenario === 'delay' ? 1.05 : 1.0;
  const velocity = computeDailyVelocity(product.id, sales) * multiplier;
  if (velocity <= 0 || product.stock <= 0) {
    return {
      message: product.stock <= product.reorderPoint
        ? (isSw ? `Agiza ${product.name} — akiba iko chini ya kiwango cha kuagiza.` : `Reorder ${product.name} — stock is below reorder point.`)
        : (isSw ? 'Hakuna mauzo ya kutosha kwa utabiri wa siku 14.' : 'Not enough sales for a 14-day forecast.'),
      urgent: product.stock <= product.reorderPoint,
      daysUntilStockout: null,
    };
  }
  const daysUntil = Math.max(1, Math.floor(product.stock / velocity));
  const reorderBy = new Date();
  reorderBy.setDate(reorderBy.getDate() + Math.max(0, daysUntil - 3));
  const dateStr = reorderBy.toLocaleDateString(isSw ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: '2-digit' });
  return {
    message: isSw
      ? `Agizo la ${product.name} linapaswa kutolewa kufikia ${dateStr}.`
      : `Place reorder for ${product.name} by ${dateStr}.`,
    urgent: daysUntil <= 4,
    daysUntilStockout: daysUntil,
  };
}

export function buildDashboardStrategyHint(
  summary: ReturnType<typeof computeProductInsightsSummary>,
  isSw: boolean,
): string {
  const hasSales = summary.bestMoving.length > 0 || summary.territories.length > 0;
  if (!hasSales) {
    return isSw
      ? 'Anza kurekodi mauzo kupitia POS ili kupata ushauri wa mkakati kulingana na bidhaa na wateja wako.'
      : 'Start recording sales via POS to unlock strategy insights based on your products and customers.';
  }

  const topTerritories = summary.territories.slice(0, 2);
  const topProduct = summary.bestMoving[0];
  const slowProduct = summary.slowMoving[0];
  const territoryShare = topTerritories.reduce((sum, t) => sum + parseFloat(t.share), 0);

  if (isSw) {
    const territoryPart = topTerritories.length
      ? `Maeneo ${topTerritories.map(t => t.name).join(' na ')} yanaleta takriban ${Math.round(territoryShare)}% ya mapato.`
      : '';
    const productPart = topProduct
      ? ` Pendekezo: angalia akiba ya ${topProduct.name} (${topProduct.unitsSold} vilivyouzwa).`
      : '';
    const slowPart = slowProduct
      ? ` ${slowProduct.name} inaendelea polepole — fikiria ofa au bundle.`
      : '';
    return `${territoryPart}${productPart}${slowPart}`.trim();
  }

  const territoryPart = topTerritories.length
    ? `${topTerritories.map(t => t.name).join(' & ')} drive ~${Math.round(territoryShare)}% of revenue.`
    : '';
  const productPart = topProduct
    ? ` Action: review stock for ${topProduct.name} (${topProduct.unitsSold} units sold).`
    : '';
  const slowPart = slowProduct
    ? ` ${slowProduct.name} is slow-moving — consider a promo or bundle.`
    : '';
  return `${territoryPart}${productPart}${slowPart}`.trim();
}

export function computeAIForecastData(
  product: Product | undefined,
  sales: SaleTransaction[],
  scenario: 'baseline' | 'rainy_season' | 'promo' | 'delay',
) {
  if (!product) return [];
  const multiplier =
    scenario === 'rainy_season' ? 1.3 :
    scenario === 'promo' ? 1.5 :
    scenario === 'delay' ? 1.05 : 1.0;
  const velocity = computeDailyVelocity(product.id, sales) * multiplier;
  const currentStock = product.stock;
  const safetyStock = product.reorderPoint;
  const data: Array<{ day: string; actualStock: number | null; safetyStock: number; reorderLevel: number; forecastDemand: number | null }> = [];
  for (let i = 6; i >= 1; i--) {
    data.push({
      day: `Day -${i}`,
      actualStock: Math.round(currentStock + i * velocity),
      safetyStock,
      reorderLevel: product.reorderPoint,
      forecastDemand: null,
    });
  }
  data.push({
    day: 'Today',
    actualStock: currentStock,
    safetyStock,
    reorderLevel: product.reorderPoint,
    forecastDemand: currentStock,
  });
  [2, 4, 6, 8, 10, 12].forEach(offset => {
    data.push({
      day: `+${offset} Days`,
      actualStock: null,
      safetyStock,
      reorderLevel: product.reorderPoint,
      forecastDemand: Math.max(0, Math.round(currentStock - velocity * offset)),
    });
  });
  return data;
}

export function buildLocalCrossMatrixAnalysis(
  locationSummary: Array<{ locationName?: string; totalRevenue?: number; topSellingProductName?: string }>,
  customerTopPurchases: Array<{ customerName?: string; productName?: string; customerLocation?: string }>,
  stagnantItems: Array<{ name?: string; units?: number }>,
  isSw: boolean,
) {
  const hasData = locationSummary.length > 0 || customerTopPurchases.length > 0;
  if (!hasData) {
    return {
      executiveSummarySw: 'Hakuna data ya mauzo bado. Ongeza bidhaa, wateja, na rekodi mauzo kupitia POS ili kupata uchambuzi wa maeneo na wateja.',
      executiveSummaryEn: 'No sales data yet. Add products, customers, and record sales via POS to unlock location and customer matrix insights.',
      topGrowthLocations: [],
      underperformingGaps: [],
      crossSellOpportunities: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const topGrowthLocations = locationSummary.slice(0, 3).map(loc => ({
    location: loc.locationName ?? '—',
    keyProducts: [loc.topSellingProductName ?? '—'],
    topCustomer: customerTopPurchases.find(c => c.customerLocation === loc.locationName)?.customerName ?? '—',
    rationale: isSw
      ? `Maeneo haya yamechangia TSh ${(loc.totalRevenue ?? 0).toLocaleString()} kwa jumla.`
      : `This territory contributed TSh ${(loc.totalRevenue ?? 0).toLocaleString()} in tracked revenue.`,
  }));

  const underperformingGaps = stagnantItems.slice(0, 3).map(item => ({
    location: isSw ? 'Maeneo mbalimbali' : 'Multiple territories',
    laggingProduct: item.name ?? '—',
    affectedCustomers: [] as string[],
    fixStrategy: isSw
      ? `Bidhaa imeuza vipande ${item.units ?? 0} tu — jaribu ofa ya kuanzisha au uunganisho na bidhaa zinazouzika.`
      : `Only ${item.units ?? 0} units sold — try a starter promo or bundle with top sellers.`,
  }));

  const crossSellOpportunities = customerTopPurchases.slice(0, 3).map(c => ({
    customerName: c.customerName ?? '—',
    location: c.customerLocation ?? '—',
    currentFavorite: c.productName ?? '—',
    recommendedCrossSell: isSw ? 'Bidhaa nyingine katika kategoria hiyo hiyo' : 'Another product in the same category',
    estimatedRevenueGain: 50000,
  }));

  const topLoc = locationSummary[0]?.locationName ?? '—';
  return {
    executiveSummarySw: `Maeneo yanayoongoza: ${topLoc}. ${stagnantItems.length} bidhaa zina mauzo ya chini — angalia fursa za kuongeza mauzo.`,
    executiveSummaryEn: `Leading territory: ${topLoc}. ${stagnantItems.length} products show low velocity — review cross-sell and promo opportunities.`,
    topGrowthLocations,
    underperformingGaps,
    crossSellOpportunities,
    generatedAt: new Date().toISOString(),
  };
}

export interface TodaySalesStats {
  todayRevenue: number;
  todayReceiptCount: number;
  yesterdayRevenue: number;
  yesterdayReceiptCount: number;
  changePercent: number | null;
  changeDirection: 'up' | 'down' | 'flat';
  avgTicket: number;
}

export function computeTodaySalesStats(
  sales: SaleTransaction[],
  opts?: { cashierName?: string; mineOnly?: boolean },
): TodaySalesStats {
  const today = localCalendarYmd();
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterday = localCalendarYmd(yest);
  const mineOnly = Boolean(opts?.mineOnly && opts.cashierName);

  const filterDay = (ymd: string) =>
    sales.filter(s => {
      if (!isCompletedLikeSale(s)) return false;
      if (!saleDateStartsWith(s.date, ymd)) return false;
      if (mineOnly && !saleMatchesName(s.cashierName, opts?.cashierName)) return false;
      return true;
    });

  const todaySales = filterDay(today);
  const yesterdaySales = filterDay(yesterday);
  const todayRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
  const yesterdayRevenue = yesterdaySales.reduce((acc, s) => acc + s.total, 0);
  let changePercent: number | null = null;
  let changeDirection: 'up' | 'down' | 'flat' = 'flat';
  if (yesterdayRevenue > 0) {
    changePercent = Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 1000) / 10;
    changeDirection = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'flat';
  } else if (todayRevenue > 0) {
    changePercent = 100;
    changeDirection = 'up';
  }
  return {
    todayRevenue,
    todayReceiptCount: todaySales.length,
    yesterdayRevenue,
    yesterdayReceiptCount: yesterdaySales.length,
    changePercent,
    changeDirection,
    avgTicket: todaySales.length > 0 ? todayRevenue / todaySales.length : 0,
  };
}
