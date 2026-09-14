import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { playAlert } from '@/lib/restaurantSounds';
import { syncTablesWithOrders } from '@/lib/restaurantUtils';
import {
  RestaurantOrder,
  RestaurantTable,
  RestaurantWorkplaceState,
  Reservation,
  StaffPerformance,
} from '@/types/restaurant';

const POLL_MS = 2000;

export function useRestaurantWorkplace(
  role: 'reception' | 'kitchen' | 'waiter' | 'admin',
  branchId?: string,
) {
  const [state, setState] = useState<RestaurantWorkplaceState>({
    tables: [],
    orders: [],
    reservations: [],
    staff_performance: [],
  });
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const prevOrdersRef = useRef<RestaurantOrder[]>([]);

  const load = useCallback(async () => {
    try {
      const raw = await api.getWorkplaceState(branchId);
      const orders = (raw.orders as RestaurantOrder[]) ?? [];
      const tables = syncTablesWithOrders(
        (raw.tables as RestaurantTable[]) ?? [],
        orders,
      );
      const next: RestaurantWorkplaceState = {
        tables,
        orders,
        reservations: (raw.reservations as Reservation[]) ?? [],
        staff_performance: (raw.staff_performance as StaffPerformance[]) ?? [],
      };
      setState(next);
      setLive(true);

      const prev = prevOrdersRef.current;
      if (prev.length > 0) {
        for (const o of orders) {
          const old = prev.find(p => p.id === o.id);
          if (!old && o.status === 'new' && role === 'kitchen') {
            playAlert('kitchen_new');
          }
          if (old && old.status !== 'ready' && o.status === 'ready') {
            if (role === 'reception') playAlert('reception_ready');
            if (role === 'waiter') playAlert('waiter_ready');
          }
        }
      }
      prevOrdersRef.current = orders;
    } catch {
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, [role, branchId]);

  const persist = useCallback(async (patch: Partial<RestaurantWorkplaceState>) => {
    const next = {
      tables: patch.tables ?? state.tables,
      orders: patch.orders ?? state.orders,
      reservations: patch.reservations ?? state.reservations,
      staff_performance: patch.staff_performance ?? state.staff_performance,
    };
    next.tables = syncTablesWithOrders(next.tables, next.orders);
    await api.updateWorkplaceState(next, branchId);
    setState(next);
    prevOrdersRef.current = next.orders;
  }, [state, branchId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return { state, loading, live, load, persist };
}
