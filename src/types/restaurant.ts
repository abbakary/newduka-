export type OrderStatus = 'new' | 'accepted' | 'cooking' | 'ready' | 'served' | 'paid' | 'cancelled';

export type TableStatus =
  | 'available'
  | 'reserved'
  | 'occupied'
  | 'cooking'
  | 'ready_to_serve'
  | 'awaiting_payment'
  | 'cleaning';

export type ReservationStatus = 'confirmed' | 'pending' | 'checked_in' | 'cancelled';

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  notes?: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus | string;
  at: string;
  by?: string;
}

export interface RestaurantOrder {
  id: string;
  table_id: string | null;
  counter_label?: string;
  items: OrderItem[];
  status: OrderStatus;
  notes?: string;
  urgent_note?: string;
  waiter_name?: string;
  created_at: string;
  accepted_at?: string;
  ready_at?: string;
  served_at?: string;
  paid_at?: string;
  pos_receipt_id?: string;
  status_history: StatusHistoryEntry[];
}

export interface RestaurantTable {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  guest_count?: number;
  order_total: number;
  assigned_waiter?: string;
  seated_at?: string;
  items: OrderItem[];
}

export interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  time: string;
  table_id?: string;
  status: ReservationStatus;
}

export interface StaffPerformance {
  id: string;
  name: string;
  orders_served: number;
}

export interface RestaurantWorkplaceState {
  tables: RestaurantTable[];
  orders: RestaurantOrder[];
  reservations: Reservation[];
  staff_performance: StaffPerformance[];
  /** @deprecated legacy KOT list — migrated to orders on load */
  kots?: unknown[];
}

export type RestaurantRole = 'reception' | 'kitchen' | 'waiter' | 'admin';
