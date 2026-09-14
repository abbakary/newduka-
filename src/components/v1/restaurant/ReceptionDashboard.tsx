import React, { useMemo, useState } from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import { Product } from '@/types/v1';
import {
  RestaurantWorkplaceState,
  RestaurantTable,
  RestaurantOrder,
  OrderItem,
  Reservation,
} from '@/types/restaurant';
import {
  TABLE_STATUS_COLORS,
  tableStatusLabel,
  orderStatusLabel,
  occupancyStats,
  createOrderId,
  appendHistory,
  syncTablesWithOrders,
} from '@/lib/restaurantUtils';
import { formatTSh } from '@/utils/translations';

interface Props {
  isSw: boolean;
  state: RestaurantWorkplaceState;
  persist: (patch: Partial<RestaurantWorkplaceState>) => Promise<void>;
  products?: Product[];
  onOpenTablePayment?: (order: RestaurantOrder) => void;
}

export const ReceptionDashboard: React.FC<Props> = ({
  isSw,
  state,
  persist,
  products = [],
  onOpenTablePayment,
}) => {
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showResModal, setShowResModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [urgentNote, setUrgentNote] = useState('');
  const stats = occupancyStats(state.tables);
  const activeOrders = state.orders.filter(o => !['paid', 'cancelled'].includes(o.status));

  const menuProducts = useMemo(
    () => products.slice(0, 12).map(p => ({ name: p.name, price: p.price })),
    [products],
  );

  const toggleMenuItem = (name: string, price: number) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.name === name);
      if (existing) {
        return prev.map(i => (i.name === name ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { name, qty: 1, price }];
    });
  };

  const seatTable = async (table: RestaurantTable) => {
    const tables = state.tables.map(t =>
      t.id === table.id
        ? { ...t, status: 'occupied' as const, guest_count: 2, seated_at: new Date().toISOString() }
        : t,
    );
    await persist({ tables: syncTablesWithOrders(tables, state.orders) });
  };

  const submitOrder = async (
    tableId: string | null,
    counterLabel?: string,
    itemsOverride?: OrderItem[],
  ) => {
    const items = itemsOverride ?? selectedItems;
    if (!items.length) return;
    const order: RestaurantOrder = {
      id: createOrderId(),
      table_id: tableId,
      counter_label: counterLabel,
      items,
      status: 'new',
      urgent_note: urgentNote || undefined,
      created_at: new Date().toISOString(),
      status_history: [{ status: 'new', at: new Date().toISOString(), by: 'reception' }],
    };
    const orders = [order, ...state.orders];
    const tables = tableId
      ? state.tables.map(t =>
          t.id === tableId ? { ...t, status: 'cooking' as const, items } : t,
        )
      : state.tables;
    await persist({ orders, tables: syncTablesWithOrders(tables, orders) });
    setSelectedTable(null);
    setSelectedItems([]);
    setUrgentNote('');
  };

  const createCounterOrder = async () => {
    if (!menuProducts.length) return;
    const label = `Counter #${String(state.orders.filter(o => !o.table_id).length + 1).padStart(2, '0')}`;
    const items: OrderItem[] = selectedItems.length
      ? selectedItems
      : [{ name: menuProducts[0]?.name ?? 'Takeaway', qty: 1, price: menuProducts[0]?.price ?? 5000 }];
    await submitOrder(null, label, items);
  };

  const requestBill = async (table: RestaurantTable) => {
    const order = state.orders.find(
      o => o.table_id === table.id && ['served', 'ready'].includes(o.status),
    ) ?? state.orders.find(o => o.table_id === table.id && !['paid', 'cancelled'].includes(o.status));
    const tables = state.tables.map(t =>
      t.id === table.id ? { ...t, status: 'awaiting_payment' as const } : t,
    );
    await persist({ tables: syncTablesWithOrders(tables, state.orders) });
    if (order && onOpenTablePayment) onOpenTablePayment(order);
  };

  const checkInReservation = async (res: Reservation) => {
    const reservations = state.reservations.map(r =>
      r.id === res.id ? { ...r, status: 'checked_in' as const } : r,
    );
    const tables = state.tables.map(t =>
      t.id === res.table_id
        ? { ...t, status: 'occupied' as const, guest_count: res.party_size, seated_at: new Date().toISOString() }
        : t,
    );
    await persist({ reservations, tables: syncTablesWithOrders(tables, state.orders) });
  };

  const markAvailable = async (tableId: string) => {
    const tables = state.tables.map(t =>
      t.id === tableId
        ? { ...t, status: 'available' as const, guest_count: 0, order_total: 0, items: [], seated_at: undefined }
        : t,
    );
    await persist({ tables: syncTablesWithOrders(tables, state.orders) });
  };

  const tableOrder = selectedTable
    ? state.orders.find(o => o.table_id === selectedTable.id && !['paid', 'cancelled'].includes(o.status))
    : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[#323130]">{isSw ? 'Ramani ya Meza' : 'Table Overview'}</h3>
            <button
              onClick={createCounterOrder}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white"
            >
              {isSw ? '+ Takeaway' : '+ Counter Order'}
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {state.tables.map(table => {
              const colors = TABLE_STATUS_COLORS[table.status] ?? TABLE_STATUS_COLORS.available;
              return (
                <button
                  key={table.id}
                  onClick={() => { setSelectedTable(table); setSelectedItems([]); }}
                  className={`rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] ${colors.bg} ${colors.border}`}
                >
                  <div className={`text-xs font-black ${colors.text}`}>{table.id}</div>
                  <div className="text-[10px] font-bold mt-1 truncate">{tableStatusLabel(table.status, isSw)}</div>
                  {table.order_total > 0 && (
                    <div className="text-[10px] font-bold text-[#0078D4] mt-1">{formatTSh(table.order_total)}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <h3 className="font-bold text-[#323130] mb-3">{isSw ? 'Foleni ya Maagizo' : 'Order Queue'}</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activeOrders.length === 0 && (
              <p className="text-sm text-[#605E5C]">{isSw ? 'Hakuna maagizo hai' : 'No active orders'}</p>
            )}
            {activeOrders.map(o => (
              <div
                key={o.id}
                className={`flex items-center justify-between p-2 rounded-lg border text-sm ${
                  o.status === 'ready' ? 'border-teal-400 bg-teal-50 animate-pulse' : 'border-[#E1DFDD]'
                }`}
              >
                <span className="font-bold">{o.id} · {o.table_id ?? o.counter_label}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#6264A7]/10 text-[#6264A7]">
                  {orderStatusLabel(o.status, isSw)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <h3 className="font-bold text-[#323130] mb-3">{isSw ? 'Uhifadhi' : 'Reservations'}</h3>
          <div className="flex gap-2 mb-3 text-center">
            <div className="flex-1 p-2 rounded-lg bg-emerald-50">
              <div className="text-lg font-black text-emerald-700">{stats.availablePct}%</div>
              <div className="text-[10px] font-bold text-emerald-600">{isSw ? 'Wazi' : 'Available'}</div>
            </div>
            <div className="flex-1 p-2 rounded-lg bg-amber-50">
              <div className="text-lg font-black text-amber-700">{stats.occupiedPct}%</div>
              <div className="text-[10px] font-bold text-amber-600">{isSw ? 'Imejaa' : 'Occupied'}</div>
            </div>
            <div className="flex-1 p-2 rounded-lg bg-blue-50">
              <div className="text-lg font-black text-blue-700">{stats.reservedPct}%</div>
              <div className="text-[10px] font-bold text-blue-600">{isSw ? 'Imehifadhiwa' : 'Reserved'}</div>
            </div>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {state.reservations.map(res => (
              <div key={res.id} className="p-2 rounded-lg border border-[#E1DFDD] text-sm">
                <div className="font-bold">{res.guest_name}</div>
                <div className="text-xs text-[#605E5C]">{res.time} · {res.party_size} {isSw ? 'wageni' : 'guests'} · {res.table_id}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-bold uppercase text-[#6264A7]">{res.status}</span>
                  {res.status === 'confirmed' && (
                    <button onClick={() => checkInReservation(res)} className="text-[10px] font-bold text-[#107C10]">
                      {isSw ? 'Ingiza' : 'Check in'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowResModal(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#6264A7] text-white text-sm font-bold"
          >
            <Calendar className="w-4 h-4" />
            {isSw ? 'Simamia Uhifadhi' : 'Manage Reservations'}
          </button>
        </div>
      </div>

      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg">{selectedTable.label}</h3>
              <button onClick={() => setSelectedTable(null)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-[#605E5C] mb-3">{tableStatusLabel(selectedTable.status, isSw)}</p>

            <div className="mb-3">
              <p className="text-xs font-bold mb-2">{isSw ? 'Chagua kutoka katalogi' : 'Add from catalog'}</p>
              {menuProducts.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  {isSw ? 'Hakuna bidhaa kwenye katalogi. Ongeza bidhaa kwenye Inventory kwanza.' : 'No products in catalog. Add menu items in Inventory first.'}
                </p>
              ) : (
              <div className="flex flex-wrap gap-1">
                {menuProducts.map(p => (
                  <button
                    key={p.name}
                    onClick={() => toggleMenuItem(p.name, p.price)}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#F3F2F1] hover:bg-[#6264A7]/10"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              )}
              {selectedItems.length > 0 && (
                <ul className="mt-2 text-xs space-y-1">
                  {selectedItems.map(i => (
                    <li key={i.name}>{i.qty}× {i.name} — {formatTSh(i.qty * i.price)}</li>
                  ))}
                </ul>
              )}
              <input
                value={urgentNote}
                onChange={e => setUrgentNote(e.target.value)}
                placeholder={isSw ? 'Maelezo maalum (mf. bila pilipili)' : 'Special notes (e.g. no pepper)'}
                className="mt-2 w-full text-xs border rounded-lg px-2 py-1.5"
              />
            </div>

            {tableOrder?.status_history && (
              <div className="mb-3 p-2 rounded-lg bg-[#F3F2F1] text-[10px]">
                <p className="font-bold mb-1">{isSw ? 'Historia ya Hali' : 'Status audit trail'}</p>
                {tableOrder.status_history.map((h, i) => (
                  <div key={i}>{h.status} · {new Date(h.at).toLocaleTimeString()} {h.by ? `· ${h.by}` : ''}</div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {selectedTable.status === 'available' && (
                <button onClick={() => seatTable(selectedTable)} className="w-full py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm">
                  {isSw ? 'Ketisha Wageni' : 'Seat Guests'}
                </button>
              )}
              {['occupied', 'cooking', 'ready_to_serve'].includes(selectedTable.status) && (
                <button
                  onClick={() => submitOrder(selectedTable.id)}
                  disabled={!selectedItems.length}
                  className="w-full py-2 rounded-lg bg-[#6264A7] text-white font-bold text-sm disabled:opacity-50"
                >
                  {isSw ? 'Tuma Jikoni' : 'Send to Kitchen'}
                </button>
              )}
              {['occupied', 'cooking', 'ready_to_serve', 'awaiting_payment', 'served'].includes(selectedTable.status) && (
                <button onClick={() => requestBill(selectedTable)} className="w-full py-2 rounded-lg bg-[#0078D4] text-white font-bold text-sm">
                  {isSw ? 'Omba Bili / POS' : 'Request Bill / POS'}
                </button>
              )}
              {selectedTable.status === 'cleaning' && (
                <button onClick={() => markAvailable(selectedTable.id)} className="w-full py-2 rounded-lg bg-slate-600 text-white font-bold text-sm">
                  {isSw ? 'Meza Tayari' : 'Mark Available'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showResModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">{isSw ? 'Uhifadhi Mpya' : 'New Reservation'}</h3>
              <button onClick={() => setShowResModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <button
              onClick={async () => {
                const res: Reservation = {
                  id: `RES-${Date.now()}`,
                  guest_name: isSw ? 'Mteja Mpya' : 'New Guest',
                  party_size: 2,
                  time: '21:00',
                  table_id: 'T5',
                  status: 'pending',
                };
                await persist({ reservations: [...state.reservations, res] });
                setShowResModal(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#6264A7] text-white font-bold text-sm"
            >
              <Plus className="w-4 h-4" /> {isSw ? 'Ongeza' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
