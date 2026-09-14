import React, { useState } from 'react';
import {
  ChefHat, ClipboardList, ConciergeBell, LayoutDashboard, Volume2, BellOff,
} from 'lucide-react';
import { Language, Product } from '@/types/v1';
import { RestaurantOrder, RestaurantRole } from '@/types/restaurant';
import { useRestaurantWorkplace } from '@/hooks/useRestaurantWorkplace';
import { isSoundMuted, toggleSoundMute } from '@/lib/restaurantSounds';
import { ReceptionDashboard } from './ReceptionDashboard';
import { KitchenDisplayView } from './KitchenDisplayView';
import { WaiterDashboard } from './WaiterDashboard';
import { RestaurantAdminDashboard } from './RestaurantAdminDashboard';

interface RestaurantWorkplaceViewProps {
  language: Language;
  mode: RestaurantRole;
  branchId?: string;
  products?: Product[];
  onOpenTablePayment?: (order: RestaurantOrder) => void;
}

const ROLE_TABS: Array<{ id: RestaurantRole; icon: React.ReactNode; sw: string; en: string }> = [
  { id: 'reception', icon: <ConciergeBell className="w-4 h-4" />, sw: 'Mapokezi', en: 'Reception' },
  { id: 'kitchen', icon: <ChefHat className="w-4 h-4" />, sw: 'Jikoni', en: 'Kitchen' },
  { id: 'waiter', icon: <ClipboardList className="w-4 h-4" />, sw: 'Waudum', en: 'Waiter' },
  { id: 'admin', icon: <LayoutDashboard className="w-4 h-4" />, sw: 'Meneja', en: 'Admin' },
];

export const RestaurantWorkplaceView: React.FC<RestaurantWorkplaceViewProps> = ({
  language,
  mode,
  branchId,
  products = [],
  onOpenTablePayment,
}) => {
  const isSw = language === 'sw';
  const [activeRole, setActiveRole] = useState<RestaurantRole>(mode);
  const [muted, setMuted] = useState(isSoundMuted());
  const { state, loading, live, persist } = useRestaurantWorkplace(activeRole, branchId);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-[#605E5C]">
        {isSw ? 'Inapakia eneo la kazi la mgahawa...' : 'Loading restaurant workplace...'}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1E2244] text-white rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black">🍽️ {isSw ? 'Mgahawa' : 'Restaurant'}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${live ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}`}>
            {live ? (isSw ? 'MOJA KWA MOJA' : 'LIVE') : (isSw ? 'IMEKATIKA' : 'OFFLINE')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ROLE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveRole(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeRole === tab.id ? 'bg-white text-[#1E2244]' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {tab.icon}
              {isSw ? tab.sw : tab.en}
            </button>
          ))}
          <button
            onClick={() => setMuted(!toggleSoundMute())}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
            title={isSw ? 'Sauti' : 'Sound alerts'}
          >
            {muted ? <BellOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {activeRole === 'reception' && (
        <ReceptionDashboard
          isSw={isSw}
          state={state}
          persist={persist}
          products={products}
          onOpenTablePayment={onOpenTablePayment}
        />
      )}
      {activeRole === 'kitchen' && (
        <KitchenDisplayView isSw={isSw} state={state} persist={persist} />
      )}
      {activeRole === 'waiter' && (
        <WaiterDashboard
          isSw={isSw}
          state={state}
          persist={persist}
          onOpenTablePayment={onOpenTablePayment}
        />
      )}
      {activeRole === 'admin' && (
        <RestaurantAdminDashboard isSw={isSw} state={state} persist={persist} />
      )}
    </div>
  );
};
