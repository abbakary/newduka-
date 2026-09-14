import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar, ChefHat, Clock, LayoutGrid, Plus, RefreshCw, User, UtensilsCrossed,
} from 'lucide-react';
import { BusinessType, Language } from '@/types/v1';
import { getWorkplace } from '@/lib/businessProfiles';
import { api } from '@/lib/api';
import { formatTSh } from '@/utils/translations';
import { RestaurantWorkplaceView } from '@/components/v1/restaurant/RestaurantWorkplaceView';
import { ConfigurableWorkplacePanel, resolveWorkplaceModeFromTab, type WorkplaceMode } from '@/components/v1/ConfigurableWorkplacePanel';
import { RestaurantOrder, RestaurantRole } from '@/types/restaurant';
import { Product } from '@/types/v1';

interface WorkplaceViewProps {
  language: Language;
  businessType: BusinessType;
  mode: WorkplaceMode;
  branchId?: string;
  products?: Product[];
  onOpenTablePayment?: (order: RestaurantOrder) => void;
}

type TableState = {
  id: string; label: string; seats: number; status: string;
  order_total: number; items: Array<{ name: string; qty: number; price: number }>;
};

type KotState = {
  id: string; table_id: string; items: string[]; status: string; created_at: string;
};

type AppointmentState = {
  id: string; client: string; service: string; time: string; status: string; staff: string;
};

const RESTAURANT_MODE_MAP: Record<string, RestaurantRole> = {
  reception: 'reception',
  kitchen: 'kitchen',
  waiter: 'waiter',
  'restaurant-live': 'admin',
  tables: 'reception',
};

export const WorkplaceView: React.FC<WorkplaceViewProps> = ({
  language,
  businessType,
  mode,
  branchId,
  products,
  onOpenTablePayment,
}) => {
  if (businessType === 'restaurant') {
    const role = RESTAURANT_MODE_MAP[mode] ?? 'reception';
    return (
      <RestaurantWorkplaceView
        language={language}
        mode={role}
        branchId={branchId}
        products={products}
        onOpenTablePayment={onOpenTablePayment}
      />
    );
  }

  return (
    <ConfigurableWorkplacePanel
      language={language}
      businessType={businessType}
      mode={mode}
      products={products}
    />
  );
};

const LegacyWorkplaceView: React.FC<{
  language: Language;
  businessType: BusinessType;
  mode: 'tables' | 'kitchen' | 'appointments';
}> = ({ language, businessType, mode }) => {
  const isSw = language === 'sw';
  const workplace = getWorkplace(businessType, isSw ? 'sw' : 'en');
  const [tables, setTables] = useState<TableState[]>([]);
  const [kots, setKots] = useState<KotState[]>([]);
  const [appointments, setAppointments] = useState<AppointmentState[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const state = await api.getWorkplaceState();
      setTables((state.tables as TableState[]) ?? []);
      setKots((state.kots as KotState[]) ?? []);
      setAppointments((state.appointments as AppointmentState[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (patch: Partial<{ tables: TableState[]; kots: KotState[]; appointments: AppointmentState[] }>) => {
    const next = {
      tables: patch.tables ?? tables,
      kots: patch.kots ?? kots,
      appointments: patch.appointments ?? appointments,
    };
    await api.updateWorkplaceState(next);
    if (patch.tables) setTables(patch.tables);
    if (patch.kots) setKots(patch.kots);
    if (patch.appointments) setAppointments(patch.appointments);
  };

  const addAppointment = async () => {
    const apt: AppointmentState = {
      id: `APT-${Date.now()}`,
      client: isSw ? 'Mteja Mpya' : 'New Client',
      service: isSw ? 'Huduma' : 'Service',
      time: '14:00',
      status: 'scheduled',
      staff: '',
    };
    await persist({ appointments: [...appointments, apt] });
  };

  const toggleTable = async (tableId: string) => {
    const updated = tables.map(t => {
      if (t.id !== tableId) return t;
      const nextStatus = t.status === 'free' ? 'occupied' : 'free';
      return { ...t, status: nextStatus, order_total: nextStatus === 'free' ? 0 : t.order_total, items: nextStatus === 'free' ? [] : t.items };
    });
    await persist({ tables: updated });
  };

  const sendKot = async (table: TableState) => {
    if (!table.items.length) return;
    const kot: KotState = {
      id: `KOT-${Date.now()}`,
      table_id: table.id,
      items: table.items.map(i => `${i.qty}x ${i.name}`),
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    await persist({ kots: [kot, ...kots] });
  };

  const completeKot = async (kotId: string) => {
    await persist({ kots: kots.map(k => k.id === kotId ? { ...k, status: 'ready' } : k) });
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-[#605E5C]">{isSw ? 'Inapakia...' : 'Loading workplace...'}</div>;
  }

  const title = mode === 'tables'
    ? (isSw ? 'Meza za Mgahawa' : 'Restaurant Tables')
    : mode === 'kitchen'
    ? (isSw ? 'Jikoni — KOT' : 'Kitchen — KOT Queue')
    : (isSw ? 'Miadi ya Huduma' : 'Service Appointments');

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#323130]">{workplace.icon} {title}</h2>
          <p className="text-xs text-[#605E5C]">{isSw ? workplace.label_sw : workplace.label_en}</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E1DFDD] text-xs font-bold hover:bg-[#F3F2F1]">
          <RefreshCw className="w-3.5 h-3.5" /> {isSw ? 'Sasisha' : 'Refresh'}
        </button>
      </div>

      {mode === 'tables' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tables.map(table => (
            <div key={table.id} className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
              table.status === 'occupied' ? 'border-amber-400 bg-amber-50' : 'border-[#E1DFDD] bg-white hover:border-[#6264A7]'
            }`} onClick={() => toggleTable(table.id)}>
              <div className="flex items-center justify-between mb-2">
                <LayoutGrid className="w-5 h-5 text-[#6264A7]" />
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  table.status === 'occupied' ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                }`}>{table.status}</span>
              </div>
              <div className="font-bold text-[#323130]">{table.label}</div>
              <div className="text-xs text-[#605E5C]">{table.seats} {isSw ? 'viti' : 'seats'}</div>
              {table.order_total > 0 && (
                <div className="mt-2 text-sm font-bold text-[#0078D4]">{formatTSh(table.order_total)}</div>
              )}
              {table.status === 'occupied' && (
                <button
                  onClick={e => { e.stopPropagation(); sendKot(table); }}
                  className="mt-2 w-full py-1.5 rounded-lg bg-[#6264A7] text-white text-[10px] font-bold flex items-center justify-center gap-1"
                >
                  <ChefHat className="w-3 h-3" /> KOT
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {mode === 'kitchen' && (
        <div className="space-y-3">
          {kots.length === 0 && (
            <div className="text-center py-12 text-[#605E5C] text-sm">{isSw ? 'Hakuna maagizo ya jikoni' : 'No kitchen orders'}</div>
          )}
          {kots.map(kot => (
            <div key={kot.id} className="bg-white rounded-xl border border-[#E1DFDD] p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 font-bold text-[#323130]">
                  <UtensilsCrossed className="w-4 h-4 text-[#6264A7]" />
                  {kot.id} · {kot.table_id}
                </div>
                <ul className="mt-2 text-xs text-[#605E5C] space-y-1">
                  {kot.items.map((item, i) => <li key={i}>• {item}</li>)}
                </ul>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  kot.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>{kot.status}</span>
                {kot.status === 'pending' && (
                  <button onClick={() => completeKot(kot.id)} className="text-xs font-bold text-[#107C10] hover:underline">
                    {isSw ? 'Tayari' : 'Mark Ready'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'appointments' && (
        <div className="space-y-3">
          <button onClick={addAppointment} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6264A7] text-white text-xs font-bold">
            <Plus className="w-4 h-4" /> {isSw ? 'Ongeza Miadi' : 'Add Appointment'}
          </button>
          {appointments.map(apt => (
            <div key={apt.id} className="bg-white rounded-xl border border-[#E1DFDD] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#6264A7]/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#6264A7]" />
                </div>
                <div>
                  <div className="font-bold text-[#323130]">{apt.client}</div>
                  <div className="text-xs text-[#605E5C]">{apt.service}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs font-bold text-[#0078D4]">
                  <Clock className="w-3.5 h-3.5" /> {apt.time}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#605E5C] mt-0.5">
                  <Calendar className="w-3 h-3" /> {apt.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
