// @ts-nocheck
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { 
  Customer, 
  Language, 
  Product, 
  SaleTransaction, 
  Supplier, 
  UserRole, 
  VendorApplication, 
  CalendarEvent,
  BusinessType,
  PurchaseOrder,
  StockMovement,
  SupplierPayment,
  AuthUser,
  TenantStore,
  PlatformMetrics,
  SaaSPlan,
  SaaSTransaction,
  PlatformBroadcast,
  PlatformOperator,
  SystemTelemetryLog,
  StaffMember,
  ExpenseItem,
  StoreBranch,
  InterBranchTransfer,
  SaaSPlanTier
} from '@/types/v1';
import { 
  EMPTY_CUSTOMERS,
  EMPTY_PRODUCTS,
  EMPTY_SALES,
  EMPTY_SUPPLIERS,
  EMPTY_EVENTS,
  EMPTY_PURCHASE_ORDERS,
  EMPTY_STOCK_MOVEMENTS,
  EMPTY_SUPPLIER_PAYMENTS,
  EMPTY_TENANTS,
  EMPTY_APPLICATIONS,
  EMPTY_STAFF,
  EMPTY_EXPENSES,
  EMPTY_BRANCHES,
  EMPTY_TRANSFERS,
  DEFAULT_PLATFORM_METRICS,
  EMPTY_SAAS_TRANSACTIONS,
  EMPTY_BROADCASTS,
  EMPTY_OPERATORS,
  EMPTY_TELEMETRY,
} from '@/lib/emptyDefaults';
import { Sidebar } from '@/components/v1/Sidebar';
import { SuperAdminSidebar } from '@/components/v1/SuperAdminSidebar';
import { MobileBottomNav } from '@/components/v1/MobileBottomNav';
import { ModuleHubView } from '@/components/v1/ModuleHubView';
import { ModuleContextBar } from '@/components/v1/ModuleContextBar';
import { Header } from '@/components/v1/Header';
import { isModuleHubTab } from '@/lib/appModules';
import { DashboardView } from '@/components/v1/DashboardView';
import { SuperAdminDashboardView } from '@/components/v1/SuperAdminDashboardView';
import { SuperAdminTenantsView } from '@/components/v1/SuperAdminTenantsView';
import { SuperAdminSubscriptionsView } from '@/components/v1/SuperAdminSubscriptionsView';
import { SuperAdminPlansView } from '@/components/v1/SuperAdminPlansView';
import { SuperAdminRemindersView } from '@/components/v1/SuperAdminRemindersView';
import { derivePaymentStatus } from '@/lib/saasPlans';
import { CustomersCRMView } from '@/components/v1/CustomersCRMView';
import { ReceivablesPayablesView } from '@/components/v1/ReceivablesPayablesView';
import { BranchManagementView } from '@/components/v1/BranchManagementView';
import { AdvancedCalendarView } from '@/components/v1/AdvancedCalendarView';
import { POSView } from '@/components/v1/POSView';
import { InventoryView } from '@/components/v1/InventoryView';
import { SuppliersView } from '@/components/v1/SuppliersView';
import { ReportsAnalyticsView } from '@/components/v1/ReportsAnalyticsView';
import { ProductCustomerLocationAnalyticsView } from '@/components/v1/ProductCustomerLocationAnalyticsView';
import { ConfigurableWorkplacePanel, isRestaurantWorkplaceTab, resolveWorkplaceModeFromTab } from '@/components/v1/ConfigurableWorkplacePanel';
import { AdminApprovalsView } from '@/components/v1/AdminApprovalsView';
import { LandingPageView } from '@/components/v1/LandingPageView';
import { PublicLoginView } from '@/components/v1/PublicLoginView';
import { PublicRegisterWizardView } from '@/components/v1/PublicRegisterWizardView';
import { TermsOfServiceView } from '@/components/v1/TermsOfServiceView';
import { AuthModalOrView } from '@/components/v1/AuthModalOrView';
import { AccountSettingsView } from '@/components/v1/AccountSettingsView';
import { DocumentsView } from '@/components/v1/DocumentsView';
import { TransactionHistoryView } from '@/components/v1/TransactionHistoryView';
import { PendingTransactionsView } from '@/components/v1/PendingTransactionsView';
import {
  analyzeCompletionGaps,
  countAwaitingPaymentDrafts,
  loadSyncQueue,
  removeOpenTransaction,
  saveSyncQueue,
  shouldDeductStock,
  AWAITING_PAYMENT_STATUSES,
  type OpenTransactionDraft,
} from '@/lib/transactionEngine';
import { TaxComplianceProvider } from '@/context/TaxComplianceContext';
import { TraReceiptProvider } from '@/context/TraReceiptContext';
import { DocumentTemplateProvider } from '@/context/DocumentTemplateContext';
import { TraEfdHubView } from '@/components/v1/TraEfdHubView';
import { TenantThemeProvider } from '@/context/TenantThemeContext';
import { AIChatbotDrawer } from '@/components/v1/AIChatbotDrawer';
import { WorkplaceView } from '@/components/v1/WorkplaceView';
import confetti from 'canvas-confetti';
import { api } from '@/lib/api';
import { useSaasPlans } from '@/context/SaasPlansContext';
import { mapApiUserToAuthUser, tryRestoreSession, persistAuthUser } from '@/lib/authBridge';
import { syncTenantFromApi, syncAdminFromApi, saleToApiPayload, fetchDashboardStats, fetchProductsFromApi, fetchCustomersFromApi, mergeCustomersFromApi, mapSupplier, scopeSnapshotByBranch, resolveDefaultBranchId, filterByBranchId, type DashboardStats, type ApiSyncResult } from '@/lib/apiSync';
import { enforceSaleDueDate } from '@/lib/dueDate';
import {
  applyPurchaseOrderToProducts,
  mergePoSellingPricesIntoProducts,
  poReceiveItemPayload,
} from '@/lib/purchaseReceive';
import { saveTenantCache, loadTenantCache, formatCacheAge } from '@/lib/tenantCache';
import { flushSyncQueue } from '@/lib/offlineSync';
import {
  offlineBannerText,
  syncSuccessText,
  syncPartialText,
  saleQueuedOfflineText,
  mutationQueuedText,
  loadingShopText,
  backOnlineText,
} from '@/lib/offlineMessages';
import { useOfflineStore } from '@/stores';
import { canAccessVendorTab, receivablesInitialTab, expensesInitialTab, canSwitchStaffWorkstation } from '@/lib/rbac';
import { getDefaultWorkplaceTab, getDefaultMainCategory, getDefaultUnit } from '@/lib/businessProfiles';
import { RestaurantOrder } from '@/types/restaurant';
import {
  buildPosContextFromOrder,
  completeRestaurantTablePayment,
  getRestaurantPosContext,
  posContextToCartItems,
  setRestaurantPosContext,
} from '@/lib/restaurantPosBridge';
import { CartItem } from '@/types/v1';

const StaffRoleSiteView = lazy(() => import('@/components/v1/StaffRoleSiteView').then(m => ({ default: m.StaffRoleSiteView })));
const BIAnalyticsDashboard = lazy(() => import('@/components/v1/BIAnalyticsDashboard').then(m => ({ default: m.BIAnalyticsDashboard })));
const ExpensesPayrollView = lazy(() => import('@/components/v1/ExpensesPayrollView').then(m => ({ default: m.ExpensesPayrollView })));
const StaffUsersView = lazy(() => import('@/components/v1/StaffUsersView').then(m => ({ default: m.StaffUsersView })));
const PredictiveAnalyticsView = lazy(() => import('@/components/v1/PredictiveAnalyticsView').then(m => ({ default: m.PredictiveAnalyticsView })));

function TabLoading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-sm text-[#605E5C]">
      <span className="animate-pulse">Loading…</span>
    </div>
  );
}

function isVendorRouteTab(tab: string): boolean {
  return VENDOR_ROUTE_TABS.includes(tab) || tab.startsWith('workplace-');
}

function workplaceModeFromTab(tab: string) {
  const mode = resolveWorkplaceModeFromTab(tab);
  if (mode) return mode;
  if (tab === 'workplace-kitchen') return 'kitchen';
  if (tab === 'workplace-waiter') return 'waiter';
  if (tab === 'workplace-restaurant-live') return 'restaurant-live';
  if (tab === 'workplace-tables') return 'tables';
  return 'reception';
}

const VENDOR_ROUTE_TABS = [
  'module-sales', 'module-stock', 'module-finance', 'module-operations', 'module-people',
  'pos', 'customers', 'receivables-payables', 'debts', 'receivables', 'payables',
  'pending-transactions',
  'branches', 'branch-management', 'calendar', 'inventory', 'suppliers', 'reports',
  'analytics', 'bi-analytics', 'bi', 'product-geo-matrix', 'geo-analytics', 'matrix',
  'expenses-payroll', 'expenses', 'payroll', 'allowances', 'advances', 'predictive', 'forecasting',
  'admin-approvals', 'admin_approvals', 'profile', 'settings', 'documents', 'transaction-history', 'tra-efd',
  'staff', 'team', 'staff-site',
  'workplace-reception', 'workplace-kitchen', 'workplace-waiter', 'workplace-restaurant-live',
  'workplace-tables', 'workplace-appointments', 'workplace-prescriptions',
  'workplace-fractional', 'workplace-barcodes',
];

export default function DukaPortal() {
  // Global Application View & Authentication State
  const { refreshPlans } = useSaasPlans();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>('landing');
  const [language, setLanguage] = useState<Language>('sw'); // Default Swahili for Tanzania
  const [userRole, setUserRole] = useState<UserRole>('vendor_owner');
  const [businessType, setBusinessType] = useState<BusinessType>('retail');
  const [businessName, setBusinessName] = useState<string>('');
  const isOnline = useOfflineStore(s => s.isOnline);
  const [sessionReady, setSessionReady] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [cacheSavedAt, setCacheSavedAt] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Super Admin / Provider specific state
  const [tenants, setTenants] = useState<TenantStore[]>(EMPTY_TENANTS);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics>(DEFAULT_PLATFORM_METRICS);
  const [saasTransactions, setSaasTransactions] = useState<SaaSTransaction[]>(EMPTY_SAAS_TRANSACTIONS);
  const [platformBroadcasts, setPlatformBroadcasts] = useState<PlatformBroadcast[]>(EMPTY_BROADCASTS);
  const [platformOperators, setPlatformOperators] = useState<PlatformOperator[]>(EMPTY_OPERATORS);
  const [telemetryLogs, setTelemetryLogs] = useState<SystemTelemetryLog[]>(EMPTY_TELEMETRY);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const [impersonatedTenant, setImpersonatedTenant] = useState<TenantStore | null>(null);

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authPreselectType, setAuthPreselectType] = useState<BusinessType | undefined>(undefined);
  const [authPreselectPlan, setAuthPreselectPlan] = useState<SaaSPlanTier | undefined>(undefined);

  // Core Centralized Connected Data Stores
  const [customers, setCustomers] = useState<Customer[]>(EMPTY_CUSTOMERS);
  const [products, setProducts] = useState<Product[]>(EMPTY_PRODUCTS);
  const [sales, setSales] = useState<SaleTransaction[]>(EMPTY_SALES);
  const [suppliers, setSuppliers] = useState<Supplier[]>(EMPTY_SUPPLIERS);
  const [events, setEvents] = useState<CalendarEvent[]>(EMPTY_EVENTS);
  const [applications, setApplications] = useState<VendorApplication[]>(EMPTY_APPLICATIONS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(EMPTY_PURCHASE_ORDERS);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(EMPTY_STOCK_MOVEMENTS);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(EMPTY_SUPPLIER_PAYMENTS);
  const [staffList, setStaffList] = useState<StaffMember[]>(EMPTY_STAFF);
  const [activeStaffMember, setActiveStaffMember] = useState<StaffMember | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(EMPTY_EXPENSES);
  const [branches, setBranches] = useState<StoreBranch[]>(EMPTY_BRANCHES);
  const [transfers, setTransfers] = useState<InterBranchTransfer[]>(EMPTY_TRANSFERS);
  const [activeBranchId, setActiveBranchId] = useState<string>('all');
  const [posPreloadCart, setPosPreloadCart] = useState<CartItem[] | null>(null);
  const [posPreloadCustomer, setPosPreloadCustomer] = useState<{ id?: string; name?: string } | null>(null);
  const [posResumeSaleId, setPosResumeSaleId] = useState<string | null>(null);
  const [posPreloadDraftId, setPosPreloadDraftId] = useState<string | null>(null);
  const [posTableLabel, setPosTableLabel] = useState<string | null>(null);
  const [currentPlanTier, setCurrentPlanTier] = useState<SaaSPlanTier>('starter');
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string>(
    () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );

  const [pendingSyncQueue, setPendingSyncQueue] = useState<Array<Record<string, unknown>>>([]);

  const tenantStorageId = currentUser?.businessId || currentUser?.id || 'local';
  const isSw = language === 'sw';

  const initBranchContextFromUser = (user: AuthUser) => {
    if (user.isBranchScoped && user.branchId) {
      setActiveBranchId(user.branchId);
    } else if (user.branchId) {
      setActiveBranchId(user.branchId);
    }
  };

  /** Branch filter sent to API — every workspace sees exactly one branch. */
  const resolveApiBranchId = (): string | null => {
    if (!currentUser) return null;
    if (currentUser.isBranchScoped && currentUser.branchId) {
      return currentUser.branchId;
    }
    if (activeBranchId && activeBranchId !== 'all') {
      return activeBranchId;
    }
    if (currentUser.branchId) {
      return currentUser.branchId;
    }
    return resolveDefaultBranchId(branches);
  };

  const applyTenantSnapshot = (data: ApiSyncResult & { dashboardStats?: DashboardStats | null }) => {
    const branchId = resolveApiBranchId();
    const scoped = scopeSnapshotByBranch(data, branchId);
    const branchScoped = Boolean(currentUser?.isBranchScoped && currentUser.branchId);
    setBusinessType(scoped.businessType);
    setBusinessName(scoped.businessName);
    if (scoped.plan) setCurrentPlanTier(scoped.plan);
    if (scoped.subscriptionExpiry) setSubscriptionExpiry(scoped.subscriptionExpiry);
    // Keep local photos when API omits image_url (common for large data URLs)
    setProducts(prev =>
      scoped.products.map(p => {
        const prior = prev.find(x => x.id === p.id);
        return { ...p, imageUrl: p.imageUrl || prior?.imageUrl };
      }),
    );
    void import('@/lib/productImageCache').then(({ mergeProductImages }) =>
      mergeProductImages(tenantStorageId, scoped.products, []).then(hydrated => {
        setProducts(prev =>
          hydrated.map(p => {
            const prior = prev.find(x => x.id === p.id);
            return { ...p, imageUrl: p.imageUrl || prior?.imageUrl };
          }),
        );
      }),
    );
    if (scoped.customersFetchOk !== false) {
      setCustomers(prev =>
        branchScoped
          ? scoped.customers
          : mergeCustomersFromApi(prev, scoped.customers, branchId),
      );
    }
    setSuppliers(scoped.suppliers);
    setBranches(scoped.branches);
    setExpenses(scoped.expenses);
    setEvents(scoped.events);
    setStaffList(scoped.staff);
    if (scoped.staff.length) setActiveStaffMember(scoped.staff[0]);
    setPurchaseOrders(scoped.purchaseOrders);
    setSales(scoped.sales);
    setStockMovements(scoped.stockMovements);
    if (scoped.dashboardStats) setDashboardStats(scoped.dashboardStats);
  };

  const persistTenantSnapshot = async (data: ApiSyncResult) => {
    const branchId = resolveApiBranchId();
    const stats = await fetchDashboardStats(branchId).catch(() => null);
    if (stats) setDashboardStats(stats);
    const savedAt = new Date().toISOString();
    await saveTenantCache(tenantStorageId, branchId, {
      ...data,
      savedAt,
      dashboardStats: stats,
    });
    setCacheSavedAt(savedAt);
  };

  useEffect(() => {
    if (!currentUser || currentUser.isBranchScoped) return;
    const isOwnerWide = currentUser.role === 'vendor_owner' || currentUser.staffRole === 'Owner';
    if (!isOwnerWide || !branches.length) return;
    if (activeBranchId === 'all' || !branches.some(b => b.id === activeBranchId)) {
      const hq = resolveDefaultBranchId(branches);
      if (hq) setActiveBranchId(hq);
    }
  }, [branches, currentUser?.id, currentUser?.isBranchScoped, activeBranchId]);

  useEffect(() => {
    if (!tenantStorageId) return;
    const saved = loadSyncQueue(tenantStorageId);
    if (saved.length) {
      setPendingSyncQueue(saved);
      setPendingSyncCount(saved.length);
    }
  }, [tenantStorageId]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (sidebarOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = prev || '';
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, [sidebarOpen]);

  const enqueueSyncItem = (item: Record<string, unknown>) => {
    setPendingSyncQueue(prev => {
      const next = [...prev, item];
      saveSyncQueue(tenantStorageId, next as import('@/lib/transactionEngine').SyncQueueItem[]);
      return next;
    });
    setPendingSyncCount(prev => prev + 1);
  };

  const notifyQueuedMutation = (entityType: string) => {
    setOfflineNotice(mutationQueuedText(isSw, entityType));
  };

  const applyApiTenantData = async (): Promise<{ ok: boolean; fromCache: boolean }> => {
    const branchId = resolveApiBranchId();
    if (!navigator.onLine) {
      const cached = await loadTenantCache(tenantStorageId, branchId);
      if (cached) {
        applyTenantSnapshot(cached);
        setCacheSavedAt(cached.savedAt);
        return { ok: true, fromCache: true };
      }
      return { ok: false, fromCache: false };
    }
    const data = await syncTenantFromApi(branchId);
    if (!data) {
      const cached = await loadTenantCache(tenantStorageId, branchId);
      if (cached) {
        applyTenantSnapshot(cached);
        setCacheSavedAt(cached.savedAt);
        return { ok: true, fromCache: true };
      }
      return { ok: false, fromCache: false };
    }
    applyTenantSnapshot(data);
    await persistTenantSnapshot(data);
    return { ok: true, fromCache: false };
  };

  const refreshCustomersFromApi = async () => {
    try {
      const branchId = resolveApiBranchId();
      const nextCustomers = await fetchCustomersFromApi(branchId);
      const branchScoped = Boolean(currentUser?.isBranchScoped && currentUser?.branchId);
      setCustomers(prev =>
        branchScoped
          ? nextCustomers
          : mergeCustomersFromApi(prev, nextCustomers, branchId),
      );
    } catch {
      /* keep current list */
    }
  };

  const refreshSuppliersFromApi = async () => {
    try {
      const raw = await api.getSuppliers();
      setSuppliers((raw as Array<Record<string, unknown>>).map(mapSupplier));
    } catch {
      /* keep current list */
    }
  };

  const refreshProductsFromApi = async () => {
    try {
      const nextProducts = await fetchProductsFromApi(resolveApiBranchId(), tenantStorageId);
      const { mergeProductImages } = await import('@/lib/productImageCache');
      // Sync merge first — never blank out photos already in state
      setProducts(prev => {
        const priorById = new Map(prev.map(p => [p.id, p]));
        return nextProducts.map(p => ({
          ...p,
          imageUrl: p.imageUrl || priorById.get(p.id)?.imageUrl,
        }));
      });
      // Async IDB hydration — also merges with current React state to cover
      // products whose image_url was omitted by the API (large base64 blobs).
      setProducts(currentProducts => {
        void mergeProductImages(tenantStorageId, nextProducts, currentProducts).then(hydrated => {
          setProducts(prev => {
            const priorById = new Map(prev.map(p => [p.id, p]));
            return hydrated.map(p => ({
              ...p,
              imageUrl: p.imageUrl || priorById.get(p.id)?.imageUrl,
            }));
          });
        });
        return currentProducts; // no-op — we only captured currentProducts here
      });
      const stats = await fetchDashboardStats(resolveApiBranchId());
      if (stats) setDashboardStats(stats);
    } catch {
      /* keep current list */
    }
  };

  const applyAdminData = async () => {
    const data = await syncAdminFromApi();
    if (!data) return;
    setTenants(data.tenants);
    setSaasTransactions(data.payments);
    setPlatformBroadcasts(data.broadcasts);
    setApplications(data.tenants
      .filter(t => t.status === 'pending' || t.status === 'pending_kyc')
      .map(t => ({
        id: t.id,
        businessName: t.name,
        ownerName: t.ownerName,
        email: t.ownerEmail,
        phone: t.ownerPhone,
        type: t.type,
        tinNumber: t.tinNumber || '',
        licenseNumber: t.licenseNumber || '',
        location: `${t.district}, ${t.region}`,
        submittedDate: t.createdDate,
        status: 'pending' as const,
        logoUrl: '🏪',
      })));
    if (data.metrics) {
      setPlatformMetrics(prev => ({
        ...prev,
        totalTenants: Number(data.metrics.total_tenants ?? prev.totalTenants),
        activeTenants: Number(data.metrics.active_tenants ?? prev.activeTenants),
        pendingKycCount: Number(data.metrics.pending_kyc ?? prev.pendingKycCount),
        suspendedCount: Number(data.metrics.suspended_tenants ?? prev.suspendedCount),
        monthlySubscriptionRevenueTzs: Number(data.metrics.total_revenue_month ?? prev.monthlySubscriptionRevenueTzs),
        totalPlatformGmvTzs: Number(data.metrics.total_sales_month ?? prev.totalPlatformGmvTzs),
      }));
    }
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    api.clearTokens();
    setCurrentUser(null);
    setActiveTab('landing');
    setCustomers(EMPTY_CUSTOMERS);
    setProducts(EMPTY_PRODUCTS);
    setSales(EMPTY_SALES);
    setSuppliers(EMPTY_SUPPLIERS);
    setEvents(EMPTY_EVENTS);
    setPurchaseOrders(EMPTY_PURCHASE_ORDERS);
    setStockMovements(EMPTY_STOCK_MOVEMENTS);
    setStaffList(EMPTY_STAFF);
    setExpenses(EMPTY_EXPENSES);
    setBranches(EMPTY_BRANCHES);
    setTenants(EMPTY_TENANTS);
    setDashboardStats(null);
    setPendingSyncQueue([]);
    setPendingSyncCount(0);
    setOfflineNotice(null);
    setCacheSavedAt(null);
  };

  useEffect(() => {
    (async () => {
      const result = await tryRestoreSession();
      if (result.user) {
        setCurrentUser(result.user);
        setUserRole(result.user.role);
        if (result.user.businessType) setBusinessType(result.user.businessType);
        if (result.user.businessName) setBusinessName(result.user.businessName);
        initBranchContextFromUser(result.user);
        setActiveTab(result.user.role === 'super_admin' ? 'super-dashboard' : 'dashboard');
        void refreshPlans();

        const tid = result.user.businessId || result.user.id || 'local';
        const restoreBranchId =
          result.user.isBranchScoped && result.user.branchId
            ? result.user.branchId
            : result.user.branchId ?? null;
        if (restoreBranchId) {
          const cached = await loadTenantCache(tid, restoreBranchId);
          if (cached) {
            applyTenantSnapshot(cached);
            setCacheSavedAt(cached.savedAt);
          }
        }
        const savedQueue = loadSyncQueue(tid);
        if (savedQueue.length) {
          setPendingSyncQueue(savedQueue);
          setPendingSyncCount(savedQueue.length);
        }

        if (result.user.role !== 'super_admin') {
          const sync = await applyApiTenantData();
          if (result.offline || sync.fromCache || !navigator.onLine) {
            setOfflineNotice(offlineBannerText(language === 'sw', savedQueue.length));
          } else {
            setOfflineNotice(null);
          }
        } else {
          await applyAdminData();
        }
      }
      setSessionReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!currentUser || !staffList.length) return;
    const match =
      (currentUser.staffId && staffList.find(s => s.id === currentUser.staffId)) ||
      (currentUser.role === 'vendor_staff' && staffList.find(s => s.email === currentUser.email)) ||
      null;
    if (match) setActiveStaffMember(match);
  }, [currentUser?.id, currentUser?.staffId, staffList]);

  useEffect(() => {
    if (!currentUser || userRole === 'super_admin') return;
    if (activeTab === 'inventory' || activeTab === 'pos') {
      void refreshProductsFromApi();
    }
    if (activeTab === 'dashboard' || activeTab === 'pos' || activeTab === 'transaction-history' || activeTab === 'reports' || activeTab === 'analytics') {
      void applyApiTenantData();
    }
    if (activeTab === 'customers' || activeTab === 'receivables-payables' || activeTab === 'debts' || activeTab === 'receivables' || activeTab === 'payables' || activeTab === 'pos') {
      void refreshCustomersFromApi();
    }
    if (activeTab === 'receivables-payables' || activeTab === 'debts' || activeTab === 'receivables' || activeTab === 'payables' || activeTab === 'suppliers') {
      void refreshSuppliersFromApi();
    }
  }, [activeTab, currentUser?.id, userRole]);

  useEffect(() => {
    if (!currentUser || userRole === 'super_admin') return;
    void applyApiTenantData();
  }, [activeBranchId, currentUser?.id, currentUser?.isBranchScoped, currentUser?.branchId]);

  useEffect(() => {
    if (!currentUser || userRole === 'super_admin') return;
    if (VENDOR_ROUTE_TABS.includes(activeTab) && !canAccessVendorTab(currentUser, activeTab, businessType)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentUser, userRole, businessType]);

  // Switch to Staff Workstation Site with RBAC Privileges
  const handleSwitchToStaffSite = (staff: StaffMember) => {
    if (!canSwitchStaffWorkstation(currentUser)) {
      return;
    }
    setActiveStaffMember(staff);
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        staffId: staff.id,
        staffRole: staff.role,
        permissions: staff.permissions,
        branch: staff.branch,
        shift: staff.shift,
        role: staff.role === 'Owner' ? 'vendor_owner' : 'vendor_staff'
      });
      setUserRole(staff.role === 'Owner' ? 'vendor_owner' : 'vendor_staff');
    }
    setActiveTab('staff');
    confetti({
      particleCount: 35,
      spread: 55,
      origin: { y: 0.6 }
    });
  };

  // Trigger AI with custom context
  const handleOpenAIChatWithPrompt = (prompt: string) => {
    setAiInitialPrompt(prompt);
    setIsAIChatOpen(true);
  };

  // Switch / Login User Handler
  const handleLoginUser = async (user: AuthUser, options?: { fromRegistration?: boolean }) => {
    persistAuthUser(user);
    setCurrentUser(user);
    setUserRole(user.role);
    if (user.businessType) setBusinessType(user.businessType);
    if (user.businessName) setBusinessName(user.businessName);
    void refreshPlans();

    if (user.role === 'super_admin') {
      setActiveTab('super-dashboard');
      await applyAdminData();
    } else {
      await applyApiTenantData();
      const bt = user.businessType || businessType;
      if (options?.fromRegistration && authPreselectPlan) {
        setCurrentPlanTier(authPreselectPlan);
      }
      if (user.subscriptionExpiry) setSubscriptionExpiry(user.subscriptionExpiry);
      else if (user.plan) setCurrentPlanTier(user.plan);
      initBranchContextFromUser(user);
      setActiveTab(options?.fromRegistration ? getDefaultWorkplaceTab(bt) : 'dashboard');
    }
  };

  // Register New Vendor Application & User Handler (legacy — registration now uses handleLoginUser)
  const handleRegisterSubmit = (_newApp: VendorApplication, user: AuthUser) => {
    void handleLoginUser(user, { fromRegistration: true });
  };

  // Landing CTAs → full-page login/register or modal fallback
  const handleLaunchPortalFromLanding = (
    role?: UserRole,
    type?: BusinessType,
    plan?: SaaSPlanTier,
  ) => {
    if (role === 'super_admin') {
      setActiveTab('login');
      return;
    }
    if (plan) setAuthPreselectPlan(plan);
    setActiveTab('register');
    if (type) setAuthPreselectType(type);
  };

  const handleOpenLoginFromPublic = () => setActiveTab('login');
  const handleOpenRegisterFromPublic = (type?: BusinessType, plan?: SaaSPlanTier) => {
    if (type) setAuthPreselectType(type);
    if (plan) setAuthPreselectPlan(plan);
    setActiveTab('register');
  };

  const providerUnpaidCount = useMemo(
    () => tenants.filter(t => {
      const ps = derivePaymentStatus(t.subscriptionExpiry, t.status);
      return ps === 'unpaid' || ps === 'overdue' || ps === 'grace';
    }).length,
    [tenants],
  );

  // Instant Approve Application from Pending screen
  const handleApproveApplication = (appId?: string) => {
    if (appId) {
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: 'approved' } : a));
    }
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        status: 'approved',
      });
    }
  };

  // Resubmit Application from Pending/Rejected screen
  const handleResubmitApplication = (updatedDetails: Partial<VendorApplication>) => {
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        ...updatedDetails,
        status: 'pending' as const,
      };
      setCurrentUser(updatedUser);
      setApplications(prev => prev.map(a => a.id === (currentUser.businessId || currentUser.id) ? { ...a, ...updatedDetails, status: 'pending' } : a));
    }
  };

  // Super Admin impersonate / switch to vendor
  const handleImpersonateVendor = (app: VendorApplication) => {
    const impersonatedUser: AuthUser = {
      id: `user-${app.id}`,
      name: app.ownerName,
      email: app.email,
      phone: app.phone,
      role: 'vendor_owner',
      businessType: app.type,
      businessName: app.businessName,
      businessId: app.id,
      status: app.status,
      tinNumber: app.tinNumber,
      licenseNumber: app.licenseNumber,
      location: app.location,
    };
    setIsImpersonating(true);
    setBusinessName(app.businessName);
    setBusinessType(app.type);
    handleLoginUser(impersonatedUser);
  };

  // Super Admin Impersonate Tenant Store from Tenant Directory
  const handleImpersonateTenant = (tenant: TenantStore) => {
    setIsImpersonating(true);
    setImpersonatedTenant(tenant);
    setBusinessName(tenant.name);
    setBusinessType(tenant.type);
    setUserRole('vendor_owner');
    setCurrentPlanTier(tenant.plan);
    setSubscriptionExpiry(tenant.subscriptionExpiry);
    setActiveTab('dashboard');
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  // Exit Impersonation Mode back to Super Admin Portal
  const handleExitImpersonation = () => {
    setIsImpersonating(false);
    setImpersonatedTenant(null);
    setUserRole('super_admin');
    setActiveTab('super-dashboard');
  };

  // Complete Sale — persists to API when online, queues offline
  const resolveBranchId = () => resolveApiBranchId() ?? branches[0]?.id;

  const prepareSaleForPersist = (sale: SaleTransaction) => {
    // Trust POS-calculated vatAmount/total (supports per-sale With/Without VAT).
    // Do NOT re-run enforceSaleTaxTotals with org settings — that forced 18% VAT
    // even when cashier selected "No VAT" or shop is non-VAT.
    return enforceSaleDueDate(sale);
  };
  const handleOpenTablePayment = (order: RestaurantOrder) => {
    const bid = resolveBranchId() ?? 'hq';
    const ctx = buildPosContextFromOrder(order, bid);
    setRestaurantPosContext(ctx);
    setPosPreloadCart(posContextToCartItems(ctx, products));
    setPosTableLabel(order.table_id ?? order.counter_label ?? null);
    setActiveTab('pos');
  };

  const handleCompleteSale = async (incomingSale: SaleTransaction) => {
    let sale: SaleTransaction;
    try {
      sale = prepareSaleForPersist(incomingSale);
    } catch (err) {
      setOfflineNotice(err instanceof Error ? err.message : String(err));
      return;
    }
    if (tenantStorageId) {
      removeOpenTransaction(tenantStorageId, sale.id);
    }
    const ctx = getRestaurantPosContext();
    if (ctx) {
      sale.tableId = ctx.tableId ?? undefined;
      sale.orderId = ctx.orderId;
      sale.branchId = ctx.branchId;
    }
    sale.branchId = sale.branchId || resolveApiBranchId() || undefined;
    const applyLocal = () => {
      setSales(prev => [sale, ...prev.filter(s => s.id !== sale.id)]);
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      if (sale.customerId && shouldDeductStock(sale.status)) {
        setCustomers(prev => prev.map(cust => {
          if (cust.id === sale.customerId) {
            return {
              ...cust,
              balance: cust.balance + sale.balanceRemaining,
              totalPurchases: cust.totalPurchases + sale.total,
              lastPurchaseDate: sale.date.split(' ')[0] || sale.date.slice(0, 10),
              loyaltyPoints: cust.loyaltyPoints + Math.floor(sale.total / 1000),
              dunningStage: sale.balanceRemaining > 0 ? 'stage1_reminder' : cust.dunningStage,
            };
          }
          return cust;
        }));
      }
      const newMovements: StockMovement[] = [];
      if (shouldDeductStock(sale.status)) {
        setProducts(prev => prev.map(prod => {
          const soldItem = sale.items.find(i => i.productId === prod.id);
          if (soldItem) {
            const prevStock = prod.stock;
            const newStock = Math.max(0, prod.stock - soldItem.quantity);
            newMovements.push({
              id: `sm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              date: nowStr, productId: prod.id, productName: prod.name, sku: prod.sku,
              type: 'out_sale', quantity: -soldItem.quantity, previousStock: prevStock, newStock,
              unitCost: prod.cost, totalValuation: soldItem.quantity * prod.cost,
              referenceId: sale.receiptNumber, referenceType: 'SALE',
              operatorName: currentUser?.name || 'Cashier',
              notes: `POS Sale (${sale.receiptNumber})`,
            });
            return { ...prod, stock: newStock };
          }
          return prod;
        }));
      }
      if (newMovements.length) setStockMovements(prev => [...newMovements, ...prev]);
    };

    if (isOnline && navigator.onLine && userRole !== 'super_admin') {
      try {
        await api.createSale(saleToApiPayload(sale, {
          finalize: true,
          branchId: resolveApiBranchId(),
        }));
        await completeRestaurantTablePayment(sale, resolveBranchId());
        setPosPreloadCart(null);
        setPosTableLabel(null);
        await applyApiTenantData();
        await refreshCustomersFromApi();
        setOfflineNotice(null);
        return;
      } catch {
        // fall through to offline queue
      }
    }

    applyLocal();
    try {
      await completeRestaurantTablePayment(sale, resolveBranchId());
    } catch { /* offline workplace sync */ }
    setPosPreloadCart(null);
    setPosTableLabel(null);
    enqueueSyncItem({
      entity_type: 'sale', entity_id: sale.id, action: 'create',
      payload: saleToApiPayload(sale, {
        finalize: true,
        branchId: resolveApiBranchId(),
      }),
      client_timestamp: new Date().toISOString(),
    });
    setOfflineNotice(saleQueuedOfflineText(isSw));
    if (tenantStorageId) {
      const branchId = resolveApiBranchId();
      const cached = await loadTenantCache(tenantStorageId, branchId);
      if (cached) {
        await saveTenantCache(tenantStorageId, branchId, {
          ...cached,
          sales: [sale, ...cached.sales.filter(s => s.id !== sale.id)],
          savedAt: new Date().toISOString(),
        });
      }
    }
  };

  const handleSavePendingSale = async (incomingSale: SaleTransaction) => {
    let sale: SaleTransaction;
    try {
      sale = prepareSaleForPersist(incomingSale);
    } catch (err) {
      setOfflineNotice(err instanceof Error ? err.message : String(err));
      return;
    }
    sale.branchId = sale.branchId || resolveBranchId();
    removeOpenTransaction(tenantStorageId, sale.id);
    if (isOnline && navigator.onLine && userRole !== 'super_admin') {
      try {
        await api.createSale(saleToApiPayload(sale, {
          finalize: false,
          branchId: resolveApiBranchId(),
        }));
        await applyApiTenantData();
        return;
      } catch {
        // fall through to offline queue
      }
    }
    setSales(prev => {
      const withoutDup = prev.filter(s => s.id !== sale.id);
      return [sale, ...withoutDup];
    });
    enqueueSyncItem({
      entity_type: 'sale',
      entity_id: sale.id,
      action: 'create',
      payload: saleToApiPayload(sale, {
        finalize: false,
        branchId: resolveApiBranchId(),
      }),
      client_timestamp: new Date().toISOString(),
    });
  };

  const handleFinalizePending = async (
    sale: SaleTransaction,
    updates: {
      reference?: string;
      customerId?: string;
      customerName?: string;
      paymentMethod?: import('@/types/v1').PaymentMethod;
      paidAmount?: number;
    },
  ) => {
    const paidAmount = updates.paidAmount ?? sale.payments?.[0]?.amount ?? sale.total;
    const method = updates.paymentMethod ?? sale.payments?.[0]?.method ?? 'cash';
    const payments = [{
      method,
      amount: paidAmount,
      reference: updates.reference ?? sale.payments?.[0]?.reference,
    }];

    if (updates.customerId) {
      sale.customerId = updates.customerId;
      sale.customerName =
        updates.customerName ??
        customers.find(c => c.id === updates.customerId)?.name ??
        sale.customerName;
    }
    sale.payments = payments;
    sale.paidAmount = paidAmount;
    sale.balanceRemaining = Math.max(0, sale.total - paidAmount);
    sale.type = sale.balanceRemaining > 0 ? (paidAmount > 0 ? 'partial' : 'credit') : 'full';
    sale.status = sale.balanceRemaining > 0 ? 'pending_credit' : 'completed';

    const gaps = analyzeCompletionGaps(sale, false);
    const blocking = gaps.filter(g => g.severity === 'critical');
    if (blocking.length) {
      throw new Error(blocking.map(g => g.labelEn).join('; '));
    }
    const mobileMethods = ['mpesa', 'airtel', 'tigopesa', 'card'] as const;
    if (mobileMethods.includes(method as typeof mobileMethods[number]) && !payments[0]?.reference) {
      throw new Error('Payment reference is required for this payment method.');
    }

    const finalizePayload = {
      payments: payments.map(p => ({ method: p.method, amount: p.amount, reference: p.reference })),
      customer_id: sale.customerId,
      customer_name: sale.customerName,
    };

    if (isOnline) {
      try {
        await api.finalizeSale(sale.id, finalizePayload);
        removeOpenTransaction(tenantStorageId, sale.id);
        setSales(prev => prev.filter(s => s.id !== sale.id));
        await applyApiTenantData();
        await refreshCustomersFromApi();
        return;
      } catch (err) {
        console.error('Finalize pending sale failed', err);
        throw err;
      }
    }
    await handleCompleteSale(sale);
    removeOpenTransaction(tenantStorageId, sale.id);
    setSales(prev => prev.map(s => (s.id === sale.id ? sale : s)));
  };

  const handleResumeDraft = (draft: OpenTransactionDraft) => {
    const restored = draft.cart
      .map(c => {
        const product = products.find(p => p.id === c.productId);
        if (!product) return null;
        return { product, quantity: c.quantity, discountPercent: c.discountPercent };
      })
      .filter(Boolean);
    setPosPreloadCart(restored as CartItem[]);
    setPosPreloadCustomer(
      draft.customerId || draft.customerName
        ? { id: draft.customerId, name: draft.customerName }
        : null,
    );
    setPosPreloadDraftId(draft.id);
    setPosResumeSaleId(null);
    removeOpenTransaction(tenantStorageId, draft.id);
    setActiveTab('pos');
  };

  const handleResumePendingSale = (sale: SaleTransaction) => {
    const restored = sale.items
      .map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          return {
            product: {
              id: item.productId,
              name: item.productName,
              category: 'General',
              sku: item.productId,
              price: item.unitPrice,
              cost: item.unitPrice * 0.7,
              stock: 0,
              reorderPoint: 10,
              unit: 'pcs',
              businessType,
            } as Product,
            quantity: item.quantity,
            discountPercent: 0,
          };
        }
        return { product, quantity: item.quantity, discountPercent: 0 };
      })
      .filter(Boolean) as CartItem[];

    const matchedCustomer = sale.customerId
      ? customers.find(c => c.id === sale.customerId)
      : customers.find(c => c.name === sale.customerName);

    setPosPreloadCart(restored);
    setPosPreloadCustomer(
      sale.customerId || sale.customerName || matchedCustomer
        ? {
            id: sale.customerId || matchedCustomer?.id,
            name: sale.customerName || matchedCustomer?.name,
          }
        : null,
    );
    setPosResumeSaleId(sale.id);
    setPosPreloadDraftId(null);
    setActiveTab('pos');
  };

  // Receive PO via API
  const handleReceivePO = async (poId: string, receivedNotes?: string) => {
    const targetPO = purchaseOrders.find(po => po.id === poId);
    if (!targetPO || targetPO.status === 'received') return;

    if (isOnline) {
      try {
        await api.receivePurchaseOrder(poId, {
          notes: receivedNotes,
          items: poReceiveItemPayload(targetPO),
        });
        await applyApiTenantData();
        setProducts(prev => mergePoSellingPricesIntoProducts(prev, targetPO));
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        return;
      } catch {
        // fallback to local
      }
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    setPurchaseOrders(prev => prev.map(po => {
      if (po.id === poId) {
        return {
          ...po,
          status: 'received' as const,
          receivedDate: nowStr,
          notes: receivedNotes ? `${po.notes ? po.notes + ' • ' : ''}${receivedNotes}` : po.notes,
        };
      }
      return po;
    }));

    const { products: updatedProducts, movements: newMovements } = applyPurchaseOrderToProducts(
      products,
      targetPO,
      {
        businessType,
        language: language === 'sw' ? 'sw' : 'en',
        operatorName: currentUser?.name || 'Manager',
        nowIso: nowStr,
      },
    );

    setProducts(updatedProducts);
    if (newMovements.length > 0) {
      setStockMovements(prev => [...newMovements, ...prev]);
    }

    // 4. Update Supplier Balance & Create Supplier Bill/Payment Record
    setSuppliers(prev => prev.map(sup => {
      if (sup.id === targetPO.supplierId || sup.name === targetPO.supplierName) {
        return {
          ...sup,
          balance: sup.balance + targetPO.totalAmount,
          totalPurchases: sup.totalPurchases + targetPO.totalAmount,
        };
      }
      return sup;
    }));

    setSupplierPayments(prev => [
      {
        id: `sp-${Date.now()}`,
        date: nowStr,
        supplierId: targetPO.supplierId,
        supplierName: targetPO.supplierName,
        poId: targetPO.id,
        orderNumber: targetPO.poNumber || targetPO.orderNumber || targetPO.id,
        amount: targetPO.totalAmount ?? targetPO.totalCost ?? 0,
        type: 'bill_created',
        paymentMethod: 'Bank Transfer (CRDB)',
        status: 'pending',
        notes: `Automated bill for received PO ${targetPO.poNumber || targetPO.orderNumber || targetPO.id}`,
      },
      ...prev
    ]);

    // 5. Automatically update or complete associated Calendar Event
    setEvents(prev => prev.map(ev => {
      if (ev.orderId === targetPO.id || (ev.title.includes(targetPO.poNumber || targetPO.orderNumber || ''))) {
        return {
          ...ev,
          completed: true,
          description: `${ev.description || ''} • (Fully Received on ${nowStr})`,
        };
      }
      return ev;
    }));

    // Trigger celebration confetti
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Sync handler — pushes offline queue to API
  const handleSync = async (opts?: { silent?: boolean }) => {
    if (!isOnline) {
      setOfflineNotice(offlineBannerText(isSw, pendingSyncQueue.length));
      return;
    }
    if (pendingSyncQueue.length === 0 && pendingSyncCount === 0) return;
    try {
      const result = await flushSyncQueue(tenantStorageId, pendingSyncQueue as import('@/lib/transactionEngine').SyncQueueItem[]);
      setPendingSyncQueue(result.remaining);
      setPendingSyncCount(result.remaining.length);
      if (result.processed > 0) {
        await applyApiTenantData();
        if (!opts?.silent) {
          confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
        }
        setOfflineNotice(
          result.failed > 0
            ? syncPartialText(isSw, result.processed, result.failed)
            : syncSuccessText(isSw, result.processed),
        );
      } else if (result.failed > 0) {
        setOfflineNotice(syncPartialText(isSw, 0, result.failed));
      } else {
        setOfflineNotice(null);
      }
    } catch {
      setPendingSyncCount(pendingSyncQueue.length);
      setOfflineNotice(offlineBannerText(isSw, pendingSyncQueue.length));
    }
  };

  useEffect(() => {
    if (!isOnline || !currentUser || userRole === 'super_admin') return;
    if (pendingSyncQueue.length === 0) return;
    setOfflineNotice(backOnlineText(isSw));
    void handleSync({ silent: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pendingSyncQueue.length, currentUser?.id]);

  const handleApproveTenantKyc = async (tenantId: string) => {
    try {
      await api.approveTenantKyc(tenantId);
      await applyAdminData();
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    } catch { /* keep local state */ }
  };

  // Helper to change user role with proper tab synchronization
  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    if (newRole === 'super_admin') {
      if (!activeTab.startsWith('super-') && activeTab !== 'admin-approvals') {
        setActiveTab('super-dashboard');
      }
    } else {
      if (activeTab.startsWith('super-') || activeTab === 'admin-approvals') {
        setActiveTab('dashboard');
      }
    }
  };

  // Helper from Dashboard to CRM
  const handleSelectCustomerFromDashboard = (customer: Customer) => {
    setActiveTab('customers');
  };

  // Derived telemetry metrics (branch-scoped)
  const apiBranchId = resolveApiBranchId();
  const branchScopedProducts = useMemo(
    () => filterByBranchId(products, apiBranchId),
    [products, apiBranchId],
  );
  const branchScopedCustomers = useMemo(
    () => filterByBranchId(customers, apiBranchId),
    [customers, apiBranchId],
  );
  const branchScopedEvents = useMemo(
    () => filterByBranchId(events, apiBranchId),
    [events, apiBranchId],
  );
  const lowStockCount = branchScopedProducts.filter(p => p.stock <= p.reorderPoint).length;
  const overdueCreditCount = branchScopedCustomers.filter(c => c.daysOverdue > 0).length;
  const upcomingEventsCount = branchScopedEvents.filter(e => !e.completed).length;

  // Pending approval flow disabled — new tenants are active immediately after register.

  if (!sessionReady && api.hasValidSession()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f0f2f5]">
        <div className="w-8 h-8 border-2 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[#605E5C]">{loadingShopText(isSw)}</p>
      </div>
    );
  }

  // If active view is explicit Landing Page, render LandingPageView full screen
  if (activeTab === 'landing') {
    return (
      <div className="min-h-screen bg-[#fafafa] text-slate-900">
        <LandingPageView
          language={language}
          onOpenLogin={handleOpenLoginFromPublic}
          onOpenRegister={handleOpenRegisterFromPublic}
          onLaunchPortal={handleLaunchPortalFromLanding}
          onOpenTerms={() => setActiveTab('terms')}
        />
      </div>
    );
  }

  if (activeTab === 'login') {
    return (
      <PublicLoginView
        language={language}
        onBack={() => setActiveTab('landing')}
        onRegister={() => setActiveTab('register')}
        onLoginSuccess={user => void handleLoginUser(user)}
      />
    );
  }

  if (activeTab === 'register') {
    return (
      <PublicRegisterWizardView
        language={language}
        initialBusinessType={authPreselectType}
        initialPlan={authPreselectPlan}
        onBack={() => setActiveTab('landing')}
        onLogin={() => setActiveTab('login')}
        onOpenTerms={() => setActiveTab('terms')}
        onRegisterSuccess={user => void handleLoginUser(user, { fromRegistration: true })}
      />
    );
  }

  if (activeTab === 'terms') {
    return (
      <TermsOfServiceView
        language={language}
        onBack={() => setActiveTab('landing')}
      />
    );
  }

  // Decide if we should render the Super Admin / Platform Provider Shell
  const isSuperAdminMode = userRole === 'super_admin';
  const vendorPaymentStatus = !isSuperAdminMode && subscriptionExpiry
    ? derivePaymentStatus(
        subscriptionExpiry,
        currentUser?.status === 'rejected' ? 'suspended' : 'active',
      )
    : 'paid';
  const vendorAccessBlocked =
    !isSuperAdminMode &&
    (currentUser?.status === 'rejected' || vendorPaymentStatus === 'overdue');

  return (
    <TaxComplianceProvider
      tenantId={currentUser?.businessId || currentUser?.id}
      businessName={businessName || currentUser?.businessName}
      tinNumber={currentUser?.tinNumber}
    >
    <TraReceiptProvider tenantId={currentUser?.businessId || currentUser?.id}>
    <TenantThemeProvider tenantId={currentUser?.businessId || currentUser?.id}>
    <DocumentTemplateProvider
      tenantId={currentUser?.businessId || currentUser?.id}
      businessName={businessName || currentUser?.businessName}
    >
    <div className={`flex h-dvh overflow-hidden font-sans ${isSuperAdminMode ? 'bg-[#F9F9F7] text-[#003322]' : 'bg-[#f0f2f5] text-[#323130]'}`}>
      {/* 1. Left Sidebar — drawer on mobile, persistent on lg+ */}
      {isSuperAdminMode ? (
        <SuperAdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          language={language}
          tenantsCount={tenants.length}
          pendingApprovalsCount={applications.filter(a => a.status === 'pending').length}
          unpaidCount={providerUnpaidCount}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          onGoToLanding={() => {
            setActiveTab('landing');
          }}
          onSwitchToVendorMode={() => {
            setUserRole('vendor_owner');
            setActiveTab('dashboard');
          }}
          onLogout={handleLogout}
        />
      ) : (
        <Sidebar
          currentView={activeTab}
          setCurrentView={setActiveTab}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          language={language}
          role={userRole}
          userRole={userRole}
          businessType={businessType}
          businessName={businessName}
          lowStockCount={lowStockCount}
          overdueCreditCount={overdueCreditCount}
          isOnline={isOnline}
          currentUser={currentUser}
          staffRole={currentUser?.staffRole}
          branchLabel={
            branches.find(b => b.id === activeBranchId)?.name ||
            branches[0]?.name
          }
          onLogout={handleLogout}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
      )}

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 w-full">
        {/* Top Header */}
        <Header
          language={language}
          setLanguage={setLanguage}
          role={userRole}
          userRole={userRole}
          businessType={businessType}
          setBusinessType={setBusinessType}
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          onSync={() => void handleSync()}
          onOpenAIChat={() => {
            setAiInitialPrompt(undefined);
            setIsAIChatOpen(true);
          }}
          activeTab={activeTab}
          currentUser={currentUser}
          onGoToLanding={() => setActiveTab('landing')}
          onOpenAuthModal={() => {
            setAuthModalMode('login');
            setIsAuthModalOpen(true);
          }}
          onLogout={handleLogout}
          isImpersonating={isImpersonating}
          impersonatedTenantName={impersonatedTenant?.name || businessName}
          onExitImpersonation={handleExitImpersonation}
          tenantsList={tenants}
          onSelectTenantToImpersonate={handleImpersonateTenant}
          onToggleSidebar={() => setSidebarOpen(open => !open)}
        />

        {(offlineNotice || (!isOnline && currentUser)) && (
          <div
            className={`mx-3 mt-2 px-4 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-between gap-3 shrink-0 ${
              isOnline
                ? 'bg-[#0078D4]/10 text-[#0078D4] border-[#0078D4]/25'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <span>{offlineNotice || offlineBannerText(isSw, pendingSyncCount)}</span>
            {cacheSavedAt && !isOnline && (
              <span className="text-[10px] opacity-70 whitespace-nowrap">
                {isSw ? 'Imesasishwa' : 'Updated'}: {formatCacheAge(cacheSavedAt, isSw)}
              </span>
            )}
            {pendingSyncCount > 0 && isOnline && (
              <button
                type="button"
                onClick={() => void handleSync()}
                className="px-2.5 py-1 rounded-lg bg-[#0078D4] text-white text-[10px] font-bold shrink-0"
              >
                {isSw ? 'Sawazisha' : 'Sync now'}
              </button>
            )}
          </div>
        )}

        {/* Scrollable View Container */}
        {/* Avoid backdrop-filter/transform here — they trap position:fixed modals inside the scroll pane. */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 rounded-none sm:rounded-2xl shadow-sm pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-6 ${isSuperAdminMode ? 'bg-[#F9F9F7] border border-[#003322]/10' : 'bg-white border border-[#E1DFDD]/80'}`}>
          <div className="max-w-7xl mx-auto w-full min-w-0">
            {!isSuperAdminMode && (
              <ModuleContextBar
                activeTab={activeTab}
                language={language}
                businessType={businessType}
                onNavigate={setActiveTab}
              />
            )}
            {/* SUPER ADMIN / SYSTEM PROVIDER VIEWS */}
            {isSuperAdminMode && (
              <>
                {(activeTab === 'super-dashboard' || activeTab === 'dashboard' || !['super-tenants', 'super-approvals', 'admin-approvals', 'super-subscriptions', 'super-plans', 'super-reminders'].includes(activeTab)) && (
                  <SuperAdminDashboardView
                    language={language}
                    metrics={platformMetrics}
                    tenants={tenants}
                    applications={applications}
                    transactions={saasTransactions}
                    onNavigate={setActiveTab}
                    onImpersonateTenant={handleImpersonateTenant}
                  />
                )}

                {activeTab === 'super-tenants' && (
                  <SuperAdminTenantsView
                    language={language}
                    tenants={tenants}
                    setTenants={setTenants}
                    onImpersonateTenant={handleImpersonateTenant}
                    onOpenNewTenantModal={() => {
                      const newId = `tenant-${Date.now()}`;
                      const dummyTenant: TenantStore = {
                        id: newId,
                        name: 'Mwenge Auto & Spares Store',
                        ownerName: 'Rashid Hamis',
                        ownerEmail: 'rashid@mwengespares.co.tz',
                        ownerPhone: '+255 713 445 678',
                        region: 'Dar es Salaam',
                        district: 'Kinondoni',
                        type: 'hardware',
                        status: 'active',
                        plan: 'starter',
                        branchesCount: 1,
                        staffCount: 2,
                        tinNumber: '155-223-908',
                        licenseNumber: 'BRELA-TZ-55412',
                        traEfdDeviceSerial: 'EFD-TZ-2026-784',
                        monthlyGmvTzs: 8200000,
                        mrrTzs: 39000,
                        subscriptionExpiry: '2026-12-31',
                        lastSyncTime: 'Just now',
                        storageUsedMb: 64,
                        createdAt: '2026-08-28',
                        autoRenew: true,
                      };
                      setTenants(prev => [dummyTenant, ...prev]);
                    }}
                  />
                )}

                {(activeTab === 'super-approvals' || activeTab === 'admin-approvals') && (
                  <AdminApprovalsView
                    language={language}
                    applications={applications}
                    setApplications={setApplications}
                    onImpersonateVendor={handleImpersonateVendor}
                    onApproved={() => void applyAdminData()}
                  />
                )}

                {activeTab === 'super-subscriptions' && (
                  <SuperAdminSubscriptionsView
                    language={language}
                    transactions={saasTransactions}
                    setTransactions={setSaasTransactions}
                    tenants={tenants}
                    setTenants={setTenants}
                  />
                )}

                {activeTab === 'super-plans' && (
                  <SuperAdminPlansView language={language} />
                )}

                {activeTab === 'super-reminders' && (
                  <SuperAdminRemindersView
                    language={language}
                    broadcasts={platformBroadcasts}
                    setBroadcasts={setPlatformBroadcasts}
                    tenants={tenants}
                  />
                )}
              </>
            )}

            {/* VENDOR / SHOP ADMIN & CASHIER VIEWS */}
            {!isSuperAdminMode && (
              <>
                {isModuleHubTab(activeTab) && (
                  <ModuleHubView
                    hubTab={activeTab}
                    language={language}
                    businessType={businessType}
                    currentUser={currentUser}
                    onNavigate={setActiveTab}
                    navContext={{
                      lowStockCount,
                      overdueCreditCount,
                      pendingApprovalsCount: applications.filter(a => a.status === 'pending').length,
                      branchesCount: branches.length,
                    }}
                  />
                )}

                {vendorAccessBlocked && (
                  <div className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-4 text-sm text-rose-900">
                    <p className="font-bold">
                      {language === 'sw' ? 'Huduma imezuiwa — malipo yanahitajika' : 'Service blocked — payment required'}
                    </p>
                    <p className="text-xs mt-1 text-rose-800">
                      {language === 'sw'
                        ? 'Usajili wako umeisha au akaunti imesimamishwa. Lipia ili kuendelea kutumia POS, hesabu na bidhaa.'
                        : 'Your subscription expired or the account was suspended. Pay to restore POS, inventory, and reports.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="mt-3 px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      {language === 'sw' ? 'Nenda Malipo & Mpango' : 'Go to Plan & Billing'}
                    </button>
                  </div>
                )}
                {(activeTab === 'dashboard' || activeTab === 'landing') && (
                  <DashboardView
                    language={language}
                    businessType={businessType}
                    customers={customers}
                    products={products}
                    sales={sales}
                    expenses={expenses}
                    currentUser={currentUser}
                    userRole={userRole}
                    onNavigate={setActiveTab}
                    onOpenAIChat={() => {
                      setAiInitialPrompt(undefined);
                      setIsAIChatOpen(true);
                    }}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onSelectCustomer={handleSelectCustomerFromDashboard}
                  />
                )}

                {(activeTab === 'branches' || activeTab === 'branch-management') && (
                  <BranchManagementView
                    language={language}
                    branches={branches}
                    setBranches={setBranches}
                    transfers={transfers}
                    setTransfers={setTransfers}
                    products={products}
                    setProducts={setProducts}
                    staffMembers={staffList}
                    currentUser={currentUser}
                    activeBranchId={activeBranchId}
                    setActiveBranchId={setActiveBranchId}
                    currentPlanTier={currentPlanTier}
                    setCurrentPlanTier={setCurrentPlanTier}
                    tenantId={tenantStorageId}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onNavigateToPOS={() => setActiveTab('pos')}
                    onNavigateToInventory={() => setActiveTab('inventory')}
                  />
                )}

                {(activeTab === 'receivables-payables' || activeTab === 'debts' || activeTab === 'receivables' || activeTab === 'payables') && (
                  <ReceivablesPayablesView
                    language={language}
                    customers={customers}
                    setCustomers={setCustomers}
                    suppliers={suppliers}
                    setSuppliers={setSuppliers}
                    purchaseOrders={purchaseOrders}
                    setPurchaseOrders={setPurchaseOrders}
                    supplierPayments={supplierPayments}
                    setSupplierPayments={setSupplierPayments}
                    sales={sales}
                    currentUser={currentUser}
                    activeBranchId={resolveApiBranchId()}
                    initialTab={receivablesInitialTab(activeTab)}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onNavigateToPOS={() => setActiveTab('pos')}
                  />
                )}

                {(activeTab === 'bi-analytics' || activeTab === 'bi') && (
                  <Suspense fallback={<TabLoading />}>
                  <BIAnalyticsDashboard
                    language={language}
                    sales={sales}
                    products={products}
                    customers={customers}
                    expenses={expenses}
                    staffList={staffList}
                    suppliers={suppliers}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onNavigateToExpenses={() => setActiveTab('expenses-payroll')}
                    onNavigateToGeoMatrix={() => setActiveTab('product-geo-matrix')}
                  />
                  </Suspense>
                )}

                {(activeTab === 'product-geo-matrix' || activeTab === 'geo-analytics' || activeTab === 'matrix') && (
                  <ProductCustomerLocationAnalyticsView
                    language={language}
                    customers={customers}
                    products={products}
                    sales={sales}
                    activeBranchId={resolveApiBranchId()}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onNavigateToPOSWithItem={(prod) => {
                      setActiveTab('pos');
                    }}
                  />
                )}

                {(activeTab === 'staff' || activeTab === 'team' || activeTab === 'staff-site') && (
                  <Suspense fallback={<TabLoading />}>
                  <StaffUsersView
                    language={language}
                    staffList={staffList}
                    setStaffList={setStaffList}
                    currentUser={currentUser}
                    sales={sales}
                    tenantStorageId={tenantStorageId}
                    onNavigate={setActiveTab}
                    onSwitchToStaffSite={canSwitchStaffWorkstation(currentUser) ? handleSwitchToStaffSite : undefined}
                  />
                  </Suspense>
                )}

                {(activeTab === 'expenses-payroll' || activeTab === 'expenses' || activeTab === 'payroll' || activeTab === 'allowances' || activeTab === 'advances') && (
                  <Suspense fallback={<TabLoading />}>
                  <ExpensesPayrollView
                    language={language}
                    expenses={expenses}
                    setExpenses={setExpenses}
                    staffList={staffList}
                    setStaffList={setStaffList}
                    currentUser={currentUser}
                    tenantStorageId={tenantStorageId}
                    initialTab={expensesInitialTab(activeTab)}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                  />
                  </Suspense>
                )}

                {(activeTab === 'predictive' || activeTab === 'forecasting') && (
                  <Suspense fallback={<TabLoading />}>
                  <PredictiveAnalyticsView
                    language={language}
                    products={products}
                    sales={sales}
                    suppliers={suppliers}
                    purchaseOrders={purchaseOrders}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onNavigateToSuppliers={() => setActiveTab('suppliers')}
                  />
                  </Suspense>
                )}


                {activeTab === 'pos' && (
                  <POSView
                    language={language}
                    businessType={businessType}
                    products={products}
                    customers={customers}
                    activeBranchId={resolveApiBranchId()}
                    branchVatRegistered={branches.find(b => b.id === resolveApiBranchId())?.vatRegistered}
                    setCustomers={setCustomers}
                    onCustomersChanged={refreshCustomersFromApi}
                    onCompleteSale={handleCompleteSale}
                    onSavePending={handleSavePendingSale}
                    onOpenPending={() => setActiveTab('pending-transactions')}
                    tenantId={tenantStorageId}
                    pendingCount={
                      countAwaitingPaymentDrafts(tenantStorageId) +
                      sales.filter(s => AWAITING_PAYMENT_STATUSES.includes(s.status as typeof AWAITING_PAYMENT_STATUSES[number])).length
                    }
                    cashierName={currentUser?.name || 'Cashier'}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onNavigateToReceivables={() => setActiveTab('receivables-payables')}
                    initialCart={posPreloadCart ?? undefined}
                    initialCustomerId={posPreloadCustomer?.id}
                    initialCustomerName={posPreloadCustomer?.name}
                    initialDraftId={posPreloadDraftId ?? undefined}
                    resumeSaleId={posResumeSaleId ?? undefined}
                    onFinalizeResume={async (saleId, sale) => {
                      await api.finalizeSale(saleId, {
                        payments: sale.payments.map(p => ({
                          method: p.method,
                          amount: p.amount,
                          reference: p.reference,
                        })),
                        customer_id: sale.customerId,
                        customer_name: sale.customerName,
                      });
                      setPosResumeSaleId(null);
                      await applyApiTenantData();
                    }}
                    onResumeConsumed={() => {
                      setPosPreloadCart(null);
                      setPosPreloadCustomer(null);
                      setPosPreloadDraftId(null);
                      setPosResumeSaleId(null);
                    }}
                    tableContextLabel={posTableLabel ?? undefined}
                    currentUser={currentUser}
                  />
                )}

                {activeTab === 'pending-transactions' && (
                  <PendingTransactionsView
                    language={language}
                    tenantId={tenantStorageId}
                    products={products}
                    customers={customers}
                    pendingSales={sales}
                    onResumeDraft={handleResumeDraft}
                    onResumePendingSale={handleResumePendingSale}
                    onCompleteSale={handleCompleteSale}
                    onFinalizePending={handleFinalizePending}
                    onNavigateToPOS={() => setActiveTab('pos')}
                  />
                )}

                {activeTab.startsWith('workplace-') && (
                  <WorkplaceView
                    language={language}
                    businessType={businessType}
                    branchId={resolveBranchId()}
                    products={products}
                    onOpenTablePayment={handleOpenTablePayment}
                    mode={workplaceModeFromTab(activeTab) as any}
                  />
                )}

                {activeTab === 'customers' && (
                  <CustomersCRMView
                    language={language}
                    customers={customers}
                    activeBranchId={resolveApiBranchId()}
                    setCustomers={setCustomers}
                    onCustomersChanged={refreshCustomersFromApi}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    currentUser={currentUser}
                    tenantId={tenantStorageId}
                    enqueueSyncItem={enqueueSyncItem}
                    onQueueMutation={notifyQueuedMutation}
                  />
                )}

                {activeTab === 'calendar' && (
                  <AdvancedCalendarView
                    language={language}
                    events={events}
                    setEvents={setEvents}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    lowStockCount={lowStockCount}
                    overdueCreditCount={overdueCreditCount}
                    activeBranchId={resolveApiBranchId()}
                    currentUser={currentUser}
                  />
                )}

                {activeTab === 'inventory' && (
                  <InventoryView
                    language={language}
                    businessType={businessType}
                    products={products}
                    setProducts={setProducts}
                    stockMovements={stockMovements}
                    setStockMovements={setStockMovements}
                    purchaseOrders={purchaseOrders}
                    setPurchaseOrders={setPurchaseOrders}
                    suppliers={suppliers}
                    setSuppliers={setSuppliers}
                    events={events}
                    setEvents={setEvents}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onReceivePO={handleReceivePO}
                    onProductsChanged={refreshProductsFromApi}
                    currentUser={currentUser}
                    tenantId={tenantStorageId}
                    enqueueSyncItem={enqueueSyncItem}
                    onQueueMutation={notifyQueuedMutation}
                  />
                )}

                {activeTab === 'suppliers' && (
                  <SuppliersView
                    language={language}
                    suppliers={suppliers}
                    setSuppliers={setSuppliers}
                    purchaseOrders={purchaseOrders}
                    setPurchaseOrders={setPurchaseOrders}
                    products={products}
                    setProducts={setProducts}
                    stockMovements={stockMovements}
                    setStockMovements={setStockMovements}
                    supplierPayments={supplierPayments}
                    setSupplierPayments={setSupplierPayments}
                    events={events}
                    setEvents={setEvents}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onReceivePO={handleReceivePO}
                    businessType={businessType}
                    currentUser={currentUser}
                    activeBranchId={resolveApiBranchId()}
                  />
                )}

                {(activeTab === 'reports' || activeTab === 'analytics') && (
                  <ReportsAnalyticsView
                    language={language}
                    sales={sales}
                    products={products}
                    suppliers={suppliers}
                    purchaseOrders={purchaseOrders}
                    onOpenAIChatWithPrompt={handleOpenAIChatWithPrompt}
                    onNavigateToSuppliers={() => setActiveTab('suppliers')}
                    currentUser={currentUser}
                  />
                )}

                {(activeTab === 'admin-approvals' || activeTab === 'admin_approvals') && (
                  <AdminApprovalsView
                    language={language}
                    applications={applications}
                    setApplications={setApplications}
                    onImpersonateVendor={handleImpersonateVendor}
                  />
                )}

                {activeTab === 'documents' && (
                  <DocumentsView language={language} />
                )}

                {activeTab === 'transaction-history' && (
                  <TransactionHistoryView language={language} sales={sales} />
                )}

                {activeTab === 'tra-efd' && (
                  <TraEfdHubView
                    language={language}
                    businessName={businessName || currentUser?.businessName}
                    tinNumber={currentUser?.tinNumber}
                  />
                )}

                {(activeTab === 'profile' || activeTab === 'settings') && (
                  <AccountSettingsView
                    language={language}
                    businessName={businessName}
                    setBusinessName={setBusinessName}
                    businessType={businessType}
                    setBusinessType={setBusinessType}
                    userRole={userRole}
                    currentUser={currentUser}
                    location={currentUser?.location}
                    tinNumber={currentUser?.tinNumber}
                    licenseNumber={currentUser?.licenseNumber}
                    staffList={staffList}
                    setStaffList={setStaffList}
                    onSwitchToStaffSite={canSwitchStaffWorkstation(currentUser) ? handleSwitchToStaffSite : undefined}
                    onNavigate={setActiveTab}
                    currentPlanTier={currentPlanTier}
                    subscriptionExpiry={subscriptionExpiry}
                    sales={sales}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {!isSuperAdminMode && currentUser && !['landing', 'login', 'register'].includes(activeTab) && (
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          language={language}
          businessType={businessType}
          currentUser={currentUser}
          lowStockCount={lowStockCount}
        />
      )}

      {/* Floating AI Assistant Chatbot Drawer */}
      <AIChatbotDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        language={language}
        initialPrompt={aiInitialPrompt}
      />

      {/* Global Auth & Registration Wizard Modal */}
      <AuthModalOrView
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        language={language}
        initialMode={authModalMode}
        initialBusinessType={authPreselectType}
        onLoginSuccess={handleLoginUser}
        onRegisterSubmit={handleRegisterSubmit}
      />
    </div>
    </DocumentTemplateProvider>
    </TenantThemeProvider>
    </TraReceiptProvider>
    </TaxComplianceProvider>
  );
}
