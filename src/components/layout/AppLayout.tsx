import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users, BarChart3,
  Settings, LogOut, Wifi, WifiOff, Globe, Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore, useOfflineStore } from '@/stores';
import { cn, t, BUSINESS_TYPE_LABELS } from '@/lib/utils';
import { BrandMark } from '@/components/ui/BrandLogo';

const navItems = [
  { to: '/app/dashboard', icon: LayoutDashboard, label: 'dashboard', perm: null },
  { to: '/app/pos', icon: ShoppingCart, label: 'pos', perm: 'canSellPOS' },
  { to: '/app/inventory', icon: Package, label: 'inventory', perm: 'canModifyInventory' },
  { to: '/app/customers', icon: Users, label: 'customers', perm: null },
  { to: '/app/reports', icon: BarChart3, label: 'reports', perm: 'canViewProfitReports' },
  { to: '/app/settings', icon: Settings, label: 'settings', perm: null },
];

export function AppLayout() {
  const { user, logout, language, setLanguage } = useAuthStore();
  const { isOnline, pendingCount } = useOfflineStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lang = language;

  const filteredNav = navItems.filter((item) => {
    if (!item.perm) return true;
    return user?.permissions?.[item.perm as keyof typeof user.permissions];
  });

  const bizLabel = user?.business_type
    ? BUSINESS_TYPE_LABELS[user.business_type]?.[lang] ?? user.business_type
    : '';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const NavContent = () => (
    <>
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <BrandMark size={40} className="shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{user?.business_name ?? 'Duka+'}</p>
            <p className="text-xs text-slate-500">{bizLabel} · {user?.staff_role ?? user?.role}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
            )}
          >
            <Icon size={20} />
            {t(label, lang)}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-100 space-y-2">
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium',
          isOnline ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'
        )}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isOnline ? t('online', lang) : t('offline', lang)}
          {pendingCount > 0 && <span className="ml-auto bg-amber-500 text-white px-1.5 rounded-full">{pendingCount}</span>}
        </div>
        <button
          onClick={() => setLanguage(lang === 'sw' ? 'en' : 'sw')}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
        >
          <Globe size={16} /> {lang === 'sw' ? 'English' : 'Kiswahili'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-rose-600 hover:bg-rose-50"
        >
          <LogOut size={16} /> {t('logout', lang)}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh bg-surface">
      {/* Desktop sidebar */}
      <aside className="sidebar-desktop w-64 bg-white border-r border-slate-100 flex flex-col shrink-0">
        <NavContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-1">
              <X size={20} />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-100 flex items-center px-4 gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <p className="text-sm text-slate-500">{t('welcome', lang)}, <span className="font-semibold text-slate-900">{user?.name}</span></p>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40">
        <div className="flex justify-around py-2">
          {filteredNav.slice(0, 5).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium',
                isActive ? 'text-brand-600' : 'text-slate-400'
              )}
            >
              <Icon size={20} />
              {t(label, lang)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
