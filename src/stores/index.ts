import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import type { AuthUser, CartItem, Language, Product } from '@/types';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  language: Language;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setLanguage: (lang: Language) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      language: 'sw',
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { loginAndLoadUser } = await import('@/lib/authBridge');
          const user = await loginAndLoadUser(email, password);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },
      logout: async () => {
        try { await api.logout(); } catch { /* ignore */ }
        api.clearTokens();
        set({ user: null, isAuthenticated: false });
      },
      loadUser: async () => {
        const { tryRestoreSession } = await import('@/lib/authBridge');
        const result = await tryRestoreSession();
        if (!result.user) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        set({ user: result.user, isAuthenticated: true, isLoading: false });
      },
      setLanguage: (lang) => set({ language: lang }),
    }),
    { name: 'duka-auth', partialize: (s) => ({ language: s.language }) }
  )
);

interface CartState {
  items: CartItem[];
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clear: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (product, qty = 1) => {
    const existing = get().items.find((i) => i.product.id === product.id);
    if (existing) {
      set({
        items: get().items.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
        ),
      });
    } else {
      set({ items: [...get().items, { product, quantity: qty, discountPercent: 0 }] });
    }
  },
  removeItem: (productId) => set({ items: get().items.filter((i) => i.product.id !== productId) }),
  updateQuantity: (productId, qty) => {
    if (qty <= 0) { get().removeItem(productId); return; }
    set({
      items: get().items.map((i) =>
        i.product.id === productId ? { ...i, quantity: qty } : i
      ),
    });
  },
  clear: () => set({ items: [] }),
  total: () => get().items.reduce((sum, i) => {
    const disc = i.discountPercent / 100;
    return sum + i.product.price * i.quantity * (1 - disc);
  }, 0),
}));

interface OfflineState {
  isOnline: boolean;
  pendingCount: number;
  setOnline: (v: boolean) => void;
  setPendingCount: (v: number) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  setOnline: (v) => set({ isOnline: v }),
  setPendingCount: (v) => set({ pendingCount: v }),
}));
