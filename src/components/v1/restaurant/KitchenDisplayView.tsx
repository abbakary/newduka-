import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { RestaurantWorkplaceState, RestaurantOrder, OrderStatus } from '@/types/restaurant';
import {
  ORDER_HEADER_COLORS,
  orderStatusLabel,
  elapsedMinutes,
  appendHistory,
  syncTablesWithOrders,
} from '@/lib/restaurantUtils';

interface Props {
  isSw: boolean;
  state: RestaurantWorkplaceState;
  persist: (patch: Partial<RestaurantWorkplaceState>) => Promise<void>;
}

type Tab = 'new' | 'in_progress' | 'ready' | 'completed';

const TAB_MAP: Record<Tab, OrderStatus[]> = {
  new: ['new'],
  in_progress: ['accepted', 'cooking'],
  ready: ['ready'],
  completed: ['served', 'paid'],
};

export const KitchenDisplayView: React.FC<Props> = ({ isSw, state, persist }) => {
  const [tab, setTab] = useState<Tab>('new');

  const advanceOrder = async (order: RestaurantOrder, next: OrderStatus) => {
    const updated = appendHistory(order, next, 'kitchen');
    const orders = state.orders.map(o => (o.id === order.id ? updated : o));
    await persist({ orders, tables: syncTablesWithOrders(state.tables, orders) });
  };

  const filtered = state.orders.filter(o => TAB_MAP[tab].includes(o.status));

  const tabs: Array<{ id: Tab; sw: string; en: string }> = [
    { id: 'new', sw: 'Mpya', en: 'New' },
    { id: 'in_progress', sw: 'Inaendelea', en: 'In Progress' },
    { id: 'ready', sw: 'Tayari', en: 'Ready' },
    { id: 'completed', sw: 'Imekamilika', en: 'Completed' },
  ];

  return (
    <div className="bg-[#1A1D3B] rounded-xl p-4 min-h-[70vh]">
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(t => {
          const count = state.orders.filter(o => TAB_MAP[t.id].includes(o.status)).length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === t.id ? 'bg-white text-[#1E2244]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isSw ? t.sw : t.en}
              {count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px]">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          {isSw ? 'Hakuna maagizo kwenye foleni hii — jikoni safi' : 'No orders in this queue — kitchen clear'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(order => {
          const mins = elapsedMinutes(order.accepted_at ?? order.created_at);
          const headerColor = ORDER_HEADER_COLORS[order.status] ?? 'bg-slate-600';
          return (
            <div key={order.id} className="bg-white rounded-xl overflow-hidden shadow-lg">
              <div className={`${headerColor} text-white px-4 py-2 flex items-center justify-between`}>
                <div>
                  <div className="font-black text-lg">#{order.id.replace('ORD-', '')}</div>
                  <div className="text-xs opacity-90">{order.table_id ?? order.counter_label ?? 'Counter'}</div>
                </div>
                <div className="flex items-center gap-1 text-sm font-bold">
                  <Clock className="w-4 h-4" />
                  {mins}m
                </div>
              </div>
              <div className="p-4">
                <ul className="space-y-1 text-sm font-semibold text-[#323130] mb-3">
                  {order.items.map((item, i) => (
                    <li key={i}>{item.qty}× {item.name}</li>
                  ))}
                </ul>
                {order.urgent_note && (
                  <div className="mb-3 p-2 rounded-lg border-2 border-amber-400 bg-amber-50 text-xs font-bold text-amber-900">
                    ⚠ {isSw ? 'Maelezo' : 'Urgent Note'}: {order.urgent_note}
                  </div>
                )}
                <div className="text-[10px] font-bold text-[#605E5C] mb-2 uppercase">
                  {orderStatusLabel(order.status, isSw)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {order.status === 'new' && (
                    <button onClick={() => advanceOrder(order, 'accepted')} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-bold">
                      {isSw ? 'Kubali' : 'Accept'}
                    </button>
                  )}
                  {order.status === 'accepted' && (
                    <button onClick={() => advanceOrder(order, 'cooking')} className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold">
                      {isSw ? 'Anza Kupika' : 'Start Cooking'}
                    </button>
                  )}
                  {order.status === 'cooking' && (
                    <button onClick={() => advanceOrder(order, 'ready')} className="flex-1 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold">
                      {isSw ? 'Tayari' : 'Ready'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
