import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTSh(amount: number): string {
  return `TSh ${amount.toLocaleString('en-TZ')}`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-TZ', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const translations: Record<string, Record<'sw' | 'en', string>> = {
  dashboard: { sw: 'Dashibodi', en: 'Dashboard' },
  pos: { sw: 'Uza (POS)', en: 'Point of Sale' },
  inventory: { sw: 'Hifadhi', en: 'Inventory' },
  customers: { sw: 'Wateja', en: 'Customers' },
  sales: { sw: 'Mauzo', en: 'Sales' },
  reports: { sw: 'Ripoti', en: 'Reports' },
  settings: { sw: 'Mipangilio', en: 'Settings' },
  login: { sw: 'Ingia', en: 'Login' },
  logout: { sw: 'Toka', en: 'Logout' },
  welcome: { sw: 'Karibu', en: 'Welcome' },
  todayRevenue: { sw: 'Mapato ya Leo', en: "Today's Revenue" },
  lowStock: { sw: 'Hifadhi Chini', en: 'Low Stock' },
  expiringSoon: { sw: 'Inakaribia Kuisha', en: 'Expiring Soon' },
  addToCart: { sw: 'Ongeza Kikapuni', en: 'Add to Cart' },
  checkout: { sw: 'Maliza', en: 'Checkout' },
  search: { sw: 'Tafuta...', en: 'Search...' },
  offline: { sw: 'Huna mtandao', en: 'You are offline' },
  online: { sw: 'Uko mtandaoni', en: 'Online' },
};

export function t(key: string, lang: 'sw' | 'en' = 'sw'): string {
  return translations[key]?.[lang] ?? key;
}

export const BUSINESS_TYPE_LABELS: Record<string, { sw: string; en: string; icon: string }> = {
  pharmacy: { sw: 'Duka la Dawa', en: 'Pharmacy', icon: '💊' },
  retail: { sw: 'Rejareja', en: 'Retail', icon: '🛒' },
  hardware: { sw: 'Vifaa vya Ujenzi', en: 'Hardware', icon: '🔧' },
  restaurant: { sw: 'Mgahawa', en: 'Restaurant', icon: '🍽️' },
  service: { sw: 'Huduma', en: 'Service', icon: '💼' },
};
