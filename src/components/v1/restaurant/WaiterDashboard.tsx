import React, { useState } from 'react';
import {
  Bell, ClipboardList, CreditCard, LayoutGrid, Sparkles,
} from 'lucide-react';
import { RestaurantWorkplaceState, RestaurantOrder } from '@/types/restaurant';
import { appendHistory, syncTablesWithOrders } from '@/lib/restaurantUtils';
import { formatTSh } from '@/utils/translations';

interface Props {
  isSw: boolean;
  state: RestaurantWorkplaceState;
  persist: (patch: Partial<RestaurantWorkplaceState>) => Promise<void>;
  onOpenTablePayment?: (order: RestaurantOrder) => void;
}

type WaiterTab = 'tasks' | 'orders' | 'tables' | 'notifications';

export const WaiterDashboard: React.FC<Props> = ({ isSw, state, persist, onOpenTablePayment }) => {
  const [tab, setTab] = useState<WaiterTab>('tasks');

  const readyOrders = state.orders.filter(o => o.status === 'ready');
  const paymentTables = state.tables.filter(t => t.status === 'awaiting_payment');
  const cleanTables = state.tables.filter(t => t.status === 'cleaning');

  const markServed = async (order: RestaurantOrder) => {
    const updated = appendHistory(order, 'served', 'waiter');
    const orders = state.orders.map(o => (o.id === order.id ? updated : o));
    const staff = state.staff_performance.map(s =>
      s.id === 'ST1' ? { ...s, orders_served: s.orders_served + 1 } : s,
    );
    await persist({ orders, staff_performance: staff, tables: syncTablesWithOrders(state.tables, orders) });
  };

  const markCleaningDone = async (tableId: string) => {
    const tables = state.tables.map(t =>
      t.id === tableId ? { ...t, status: 'available' as const, guest_count: 0, order_total: 0, items: [] } : t,
    );
    await persist({ tables: syncTablesWithOrders(tables, state.orders) });
  };

  const navItems: Array<{ id: WaiterTab; icon: React.ReactNode; sw: string; en: string }> = [
    { id: 'tasks', icon: <ClipboardList className="w-5 h-5" />, sw: 'Kazi Zangu', en: 'My Tasks' },
    { id: 'orders', icon: <Sparkles className="w-5 h-5" />, sw: 'Maagizo', en: 'Orders' },
    { id: 'tables', icon: <LayoutGrid className="w-5 h-5" />, sw: 'Meza', en: 'Tables' },
    { id: 'notifications', icon: <Bell className="w-5 h-5" />, sw: 'Arifa', en: 'Notifications' },
  ];

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border-2 border-teal-400 p-3 text-center">
          <div className="text-2xl font-black text-teal-700">{readyOrders.length}</div>
          <div className="text-[10px] font-bold text-teal-600">{isSw ? 'Hudumia' : 'Serve Orders'}</div>
        </div>
        <div className="bg-white rounded-xl border-2 border-purple-400 p-3 text-center">
          <div className="text-2xl font-black text-purple-700">{paymentTables.length}</div>
          <div className="text-[10px] font-bold text-purple-600">{isSw ? 'Malipo' : 'Pending Pay'}</div>
        </div>
        <div className="bg-white rounded-xl border-2 border-slate-300 p-3 text-center">
          <div className="text-2xl font-black text-slate-700">{cleanTables.length}</div>
          <div className="text-[10px] font-bold text-slate-600">{isSw ? 'Safisha' : 'Clean'}</div>
        </div>
      </div>

      {tab === 'tasks' && (
        <div className="space-y-3">
          {readyOrders.map(o => (
            <div key={o.id} className="bg-white rounded-xl border-2 border-red-400 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-red-600">{isSw ? 'TAYARI KUCHUKULIWA' : 'READY FOR PICKUP'}</div>
                  <div className="text-sm font-bold">{o.id} · {o.table_id}</div>
                </div>
                <button onClick={() => markServed(o)} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold">
                  {isSw ? 'Hudumia' : 'Serve'}
                </button>
              </div>
            </div>
          ))}
          {paymentTables.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-purple-300 p-4 flex items-center justify-between">
              <div>
                <div className="font-bold text-purple-700">{isSw ? 'Inasubiri Malipo' : 'Awaiting Payment'}</div>
                <div className="text-sm">{t.label} · {formatTSh(t.order_total)}</div>
              </div>
              {onOpenTablePayment && (
                <button
                  onClick={() => {
                    const order = state.orders.find(o => o.table_id === t.id && !['paid', 'cancelled'].includes(o.status));
                    if (order) onOpenTablePayment(order);
                  }}
                  className="p-2 rounded-lg bg-purple-100"
                >
                  <CreditCard className="w-5 h-5 text-purple-700" />
                </button>
              )}
            </div>
          ))}
          {cleanTables.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div className="font-bold">{t.label} — {isSw ? 'Safisha' : 'Clean'}</div>
              <button onClick={() => markCleaningDone(t.id)} className="text-xs font-bold text-emerald-600">
                {isSw ? 'Tayari' : 'Done'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-2">
          {state.orders.filter(o => !['paid', 'cancelled'].includes(o.status)).map(o => (
            <div key={o.id} className="bg-white rounded-xl border p-3 flex items-center justify-between">
              <div>
                <div className="font-bold">{o.id}</div>
                <div className="text-xs text-[#605E5C]">{o.table_id} · {o.status}</div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg bg-amber-100"><Bell className="w-4 h-4 text-amber-700" /></button>
                {onOpenTablePayment && (
                  <button
                    onClick={() => onOpenTablePayment(o)}
                    className="p-2 rounded-lg bg-blue-100"
                  >
                    <CreditCard className="w-4 h-4 text-blue-700" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tables' && (
        <div className="grid grid-cols-3 gap-2">
          {state.tables.map(t => (
            <div key={t.id} className={`rounded-xl p-3 text-center text-xs font-bold border-2 ${
              t.status === 'ready_to_serve' ? 'border-teal-400 bg-teal-50' :
              t.status === 'occupied' ? 'border-amber-400 bg-amber-50' : 'border-[#E1DFDD] bg-white'
            }`}>
              {t.id}
            </div>
          ))}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="text-center py-8 text-[#605E5C] text-sm">
          {readyOrders.length > 0
            ? (isSw ? `${readyOrders.length} meza ziko tayari kuhudumiwa` : `${readyOrders.length} tables ready to serve`)
            : (isSw ? 'Hakuna arifa mpya' : 'No new notifications')}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#1E2244] border-t border-[#2C315E] px-2 py-2 flex justify-around max-w-lg mx-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-bold ${
              tab === item.id ? 'text-white bg-white/20' : 'text-slate-400'
            }`}
          >
            {item.icon}
            {isSw ? item.sw : item.en}
          </button>
        ))}
      </div>
    </div>
  );
};
