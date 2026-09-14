import {
  OrderStatus,
  RestaurantOrder,
  RestaurantTable,
  TableStatus,
} from '@/types/restaurant';

export const ORDER_PIPELINE: OrderStatus[] = [
  'new',
  'accepted',
  'cooking',
  'ready',
  'served',
  'paid',
];

export const TABLE_STATUS_COLORS: Record<TableStatus, { bg: string; border: string; text: string }> = {
  available: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800' },
  reserved: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
  occupied: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-900' },
  cooking: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900' },
  ready_to_serve: { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-900' },
  awaiting_payment: { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-900' },
  cleaning: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600' },
};

export const ORDER_HEADER_COLORS: Record<string, string> = {
  new: 'bg-red-500',
  accepted: 'bg-green-600',
  cooking: 'bg-orange-500',
  ready: 'bg-amber-500',
  served: 'bg-blue-500',
  paid: 'bg-slate-500',
};

export function tableStatusLabel(status: TableStatus, isSw: boolean): string {
  const map: Record<TableStatus, [string, string]> = {
    available: ['Available', 'Wazi'],
    reserved: ['Reserved', 'Imehifadhiwa'],
    occupied: ['Occupied', 'Imejaa'],
    cooking: ['Cooking', 'Inapikwa'],
    ready_to_serve: ['Ready to Serve', 'Tayari Kuhudumiwa'],
    awaiting_payment: ['Awaiting Payment', 'Inasubiri Malipo'],
    cleaning: ['Cleaning', 'Inasafishwa'],
  };
  return isSw ? map[status][1] : map[status][0];
}

export function orderStatusLabel(status: OrderStatus, isSw: boolean): string {
  const map: Record<OrderStatus, [string, string]> = {
    new: ['New', 'Mpya'],
    accepted: ['Accepted', 'Imekubaliwa'],
    cooking: ['Cooking', 'Inapikwa'],
    ready: ['Ready', 'Tayari'],
    served: ['Served', 'Imehudumiwa'],
    paid: ['Paid', 'Imelipwa'],
    cancelled: ['Cancelled', 'Imefutwa'],
  };
  return isSw ? map[status][1] : map[status][0];
}

export function deriveTableStatus(
  table: RestaurantTable,
  orders: RestaurantOrder[],
): TableStatus {
  if (table.status === 'cleaning' || table.status === 'reserved') return table.status;
  const active = orders.find(
    o => o.table_id === table.id && !['paid', 'cancelled'].includes(o.status),
  );
  if (!active) {
    if (table.status === 'awaiting_payment') return 'awaiting_payment';
    return table.guest_count && table.guest_count > 0 ? 'occupied' : 'available';
  }
  if (active.status === 'ready') return 'ready_to_serve';
  if (['new', 'accepted', 'cooking'].includes(active.status)) return 'cooking';
  if (active.status === 'served') return 'awaiting_payment';
  return table.status;
}

export function syncTablesWithOrders(
  tables: RestaurantTable[],
  orders: RestaurantOrder[],
): RestaurantTable[] {
  return tables.map(t => ({
    ...t,
    status: deriveTableStatus(t, orders),
    order_total: orders
      .filter(o => o.table_id === t.id && o.status !== 'paid' && o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty * i.price, 0), 0),
  }));
}

export function nextOrderStatus(current: OrderStatus): OrderStatus | null {
  const idx = ORDER_PIPELINE.indexOf(current);
  if (idx < 0 || idx >= ORDER_PIPELINE.length - 1) return null;
  return ORDER_PIPELINE[idx + 1];
}

export function elapsedMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function occupancyStats(tables: RestaurantTable[]) {
  const total = tables.length || 1;
  const counts = {
    available: 0,
    occupied: 0,
    reserved: 0,
    other: 0,
  };
  for (const t of tables) {
    if (t.status === 'available') counts.available++;
    else if (t.status === 'reserved') counts.reserved++;
    else if (['occupied', 'cooking', 'ready_to_serve', 'awaiting_payment'].includes(t.status))
      counts.occupied++;
    else counts.other++;
  }
  return {
    availablePct: Math.round((counts.available / total) * 100),
    occupiedPct: Math.round((counts.occupied / total) * 100),
    reservedPct: Math.round((counts.reserved / total) * 100),
    ...counts,
  };
}

export function createOrderId(): string {
  return `ORD-${Date.now().toString().slice(-6)}`;
}

export function appendHistory(
  order: RestaurantOrder,
  status: OrderStatus,
  by?: string,
): RestaurantOrder {
  return {
    ...order,
    status,
    status_history: [...(order.status_history || []), { status, at: new Date().toISOString(), by }],
    ...(status === 'accepted' ? { accepted_at: new Date().toISOString() } : {}),
    ...(status === 'ready' ? { ready_at: new Date().toISOString() } : {}),
    ...(status === 'served' ? { served_at: new Date().toISOString() } : {}),
    ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {}),
  };
}
