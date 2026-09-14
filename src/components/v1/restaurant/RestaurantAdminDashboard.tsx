import React, { useMemo, useState } from 'react';
import { RestaurantWorkplaceState, RestaurantOrder } from '@/types/restaurant';
import { TABLE_STATUS_COLORS, tableStatusLabel, occupancyStats } from '@/lib/restaurantUtils';
import { formatTSh } from '@/utils/translations';

interface Props {
  isSw: boolean;
  state: RestaurantWorkplaceState;
  persist: (patch: Partial<RestaurantWorkplaceState>) => Promise<void>;
}

export const RestaurantAdminDashboard: React.FC<Props> = ({ isSw, state }) => {
  const [dateFilter, setDateFilter] = useState('today');
  const stats = occupancyStats(state.tables);

  const kpis = useMemo(() => {
    const openOrders = state.orders.filter(o => ['new', 'accepted', 'cooking', 'ready'].includes(o.status));
    const revenue = state.orders
      .filter(o => o.status === 'paid')
      .reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty * i.price, 0), 0);
    const openBill = state.orders
      .filter(o => !['paid', 'cancelled'].includes(o.status))
      .reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty * i.price, 0), 0);
    const occupied = state.tables.filter(t =>
      ['occupied', 'cooking', 'ready_to_serve', 'awaiting_payment'].includes(t.status),
    ).length;
    return { openOrders: openOrders.length, revenue, openBill, occupied, totalSales: revenue + openBill };
  }, [state]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8);
    return hours.map(h => ({
      hour: `${h}:00`,
      orders: state.orders.filter(o => new Date(o.created_at).getHours() === h).length,
      sales: state.orders
        .filter(o => new Date(o.created_at).getHours() === h && o.status === 'paid')
        .reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty * i.price, 0), 0),
    }));
  }, [state.orders]);

  const maxOrders = Math.max(1, ...hourlyData.map(d => d.orders));
  const maxSales = Math.max(1, ...hourlyData.map(d => d.sales));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="text-sm border border-[#E1DFDD] rounded-lg px-3 py-1.5 font-bold"
        >
          <option value="today">{isSw ? 'Leo' : 'Today'}</option>
          <option value="shift">{isSw ? 'Shift Hii' : 'This Shift'}</option>
          <option value="yesterday">{isSw ? 'Jana' : 'Yesterday'}</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: isSw ? 'Jumla ya Mauzo' : 'Total Sales', value: formatTSh(kpis.totalSales), color: 'border-blue-400' },
          { label: isSw ? 'Maagizo Hai' : 'Open Orders', value: String(kpis.openOrders), color: 'border-amber-400' },
          { label: isSw ? 'Meza Zimejaa' : "Today's Occupied", value: String(kpis.occupied), color: 'border-teal-400' },
          { label: isSw ? 'Mapato Leo' : "Today's Revenue", value: formatTSh(kpis.revenue), color: 'border-emerald-400' },
        ].map(kpi => (
          <div key={kpi.label} className={`bg-white rounded-xl border-2 ${kpi.color} p-4`}>
            <div className="text-[10px] font-bold text-[#605E5C] uppercase">{kpi.label}</div>
            <div className="text-xl font-black text-[#323130] mt-1">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <h3 className="font-bold mb-3">{isSw ? 'Hali ya Meza — Moja kwa Moja' : 'Live Table Status'}</h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {state.tables.map(t => {
              const c = TABLE_STATUS_COLORS[t.status] ?? TABLE_STATUS_COLORS.available;
              return (
                <div key={t.id} className={`rounded-lg border p-2 text-center ${c.bg} ${c.border}`}>
                  <div className="text-xs font-black">{t.id}</div>
                  <div className="text-[9px] font-bold truncate">{tableStatusLabel(t.status, isSw)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <h3 className="font-bold mb-3">{isSw ? 'Utendaji wa Wafanyakazi' : 'Staff Performance'}</h3>
          <div className="space-y-2">
            {state.staff_performance.map(s => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-[#F3F2F1]">
                <span className="font-bold text-sm">{s.name}</span>
                <span className="text-xs font-bold text-[#6264A7]">
                  {s.orders_served} {isSw ? 'imehudumiwa' : 'served'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <h3 className="font-bold mb-3">{isSw ? 'Muhtasari wa Hali' : 'Stats Overview'}</h3>
          <div className="flex items-end gap-1 h-32">
            {hourlyData.map(d => (
              <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-[#0078D4]/70 rounded-t"
                  style={{ height: `${(d.orders / maxOrders) * 100}%`, minHeight: d.orders ? 4 : 0 }}
                />
                <span className="text-[8px] font-bold text-[#605E5C]">{d.hour.split(':')[0]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#605E5C] mt-2">
            {isSw ? 'Umejaa' : 'Occupancy'}: {stats.occupiedPct}% · {isSw ? 'Wazi' : 'Available'}: {stats.availablePct}%
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E1DFDD] p-4">
          <h3 className="font-bold mb-3">{isSw ? 'Muhtasari wa Mauzo' : 'Sales Overview'}</h3>
          <div className="flex items-end gap-1 h-32">
            {hourlyData.map(d => (
              <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-emerald-500/70 rounded-t"
                  style={{ height: `${(d.sales / maxSales) * 100}%`, minHeight: d.sales ? 4 : 0 }}
                />
                <span className="text-[8px] font-bold text-[#605E5C]">{d.hour.split(':')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
