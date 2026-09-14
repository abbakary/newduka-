import { api } from '@/lib/api';
import { appendHistory, syncTablesWithOrders } from '@/lib/restaurantUtils';
import { OrderItem, RestaurantOrder } from '@/types/restaurant';
import { CartItem, SaleTransaction, Product } from '@/types/v1';

const POS_CONTEXT_KEY = 'duka_restaurant_pos_context';

export interface RestaurantPosContext {
  tableId: string | null;
  orderId: string;
  branchId: string;
  items: OrderItem[];
}

export function setRestaurantPosContext(ctx: RestaurantPosContext): void {
  localStorage.setItem(POS_CONTEXT_KEY, JSON.stringify(ctx));
}

export function getRestaurantPosContext(): RestaurantPosContext | null {
  try {
    const raw = localStorage.getItem(POS_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as RestaurantPosContext) : null;
  } catch {
    return null;
  }
}

export function clearRestaurantPosContext(): void {
  localStorage.removeItem(POS_CONTEXT_KEY);
}

export function posContextToCartItems(ctx: RestaurantPosContext, products: Product[]): CartItem[] {
  return ctx.items.map((item, idx) => {
    const matched = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    const product: Product = matched ?? {
      id: `table-item-${idx}`,
      name: item.name,
      category: 'Main Course',
      sku: `TBL-${idx}`,
      price: item.price || 0,
      cost: 0,
      stock: 999,
      reorderPoint: 0,
      unit: 'portion',
      businessType: 'restaurant',
    };
    return { product, quantity: item.qty, discountPercent: 0 };
  });
}

export async function completeRestaurantTablePayment(
  sale: SaleTransaction,
  branchId?: string,
): Promise<void> {
  const ctx = getRestaurantPosContext();
  if (!ctx) return;

  const raw = await api.getWorkplaceState(ctx.branchId || branchId);
  const orders = (raw.orders as RestaurantOrder[]) ?? [];
  const tables = syncTablesWithOrders((raw.tables as import('@/types/restaurant').RestaurantTable[]) ?? [], orders);

  const targetOrderId = ctx.orderId;
  const updatedOrders = orders.map(o => {
    if (o.id !== targetOrderId && !(ctx.tableId && o.table_id === ctx.tableId && o.status === 'served')) {
      return o;
    }
    if (o.status === 'paid') return o;
    const paid = appendHistory(
      {
        ...o,
        pos_receipt_id: sale.receiptNumber,
      },
      'paid',
      sale.cashierName,
    );
    return paid;
  });

  const updatedTables = syncTablesWithOrders(
    tables.map(t => {
      if (ctx.tableId && t.id === ctx.tableId) {
        return {
          ...t,
          status: 'available' as const,
          guest_count: 0,
          order_total: 0,
          items: [],
          seated_at: undefined,
        };
      }
      return t;
    }),
    updatedOrders,
  );

  await api.updateWorkplaceState(
    { orders: updatedOrders, tables: updatedTables },
    ctx.branchId || branchId,
  );
  clearRestaurantPosContext();
}

export function buildPosContextFromOrder(
  order: RestaurantOrder,
  branchId: string,
): RestaurantPosContext {
  return {
    tableId: order.table_id,
    orderId: order.id,
    branchId,
    items: order.items,
  };
}
