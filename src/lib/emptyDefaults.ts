import { buildDefaultSaasPlans } from '@/lib/planCatalog';
import type {
  CalendarEvent,
  Customer,
  ExpenseItem,
  InterBranchTransfer,
  PlatformBroadcast,
  PlatformMetrics,
  PlatformOperator,
  Product,
  PurchaseOrder,
  SaaSPlan,
  SaaSTransaction,
  SaleTransaction,
  StaffMember,
  StockMovement,
  StoreBranch,
  Supplier,
  SupplierPayment,
  SystemTelemetryLog,
  TenantStore,
  VendorApplication,
} from '@/types/v1';

export const EMPTY_CUSTOMERS: Customer[] = [];
export const EMPTY_PRODUCTS: Product[] = [];
export const EMPTY_SALES: SaleTransaction[] = [];
export const EMPTY_SUPPLIERS: Supplier[] = [];
export const EMPTY_EVENTS: CalendarEvent[] = [];
export const EMPTY_PURCHASE_ORDERS: PurchaseOrder[] = [];
export const EMPTY_STOCK_MOVEMENTS: StockMovement[] = [];
export const EMPTY_SUPPLIER_PAYMENTS: SupplierPayment[] = [];
export const EMPTY_STAFF: StaffMember[] = [];
export const EMPTY_EXPENSES: ExpenseItem[] = [];
export const EMPTY_BRANCHES: StoreBranch[] = [];
export const EMPTY_TRANSFERS: InterBranchTransfer[] = [];
export const EMPTY_TENANTS: TenantStore[] = [];
export const EMPTY_APPLICATIONS: VendorApplication[] = [];
export const EMPTY_SAAS_TRANSACTIONS: SaaSTransaction[] = [];
export const EMPTY_BROADCASTS: PlatformBroadcast[] = [];
export const EMPTY_OPERATORS: PlatformOperator[] = [];
export const EMPTY_TELEMETRY: SystemTelemetryLog[] = [];

export const DEFAULT_PLATFORM_METRICS: PlatformMetrics = {
  totalTenants: 0,
  activeTenants: 0,
  pendingKycCount: 0,
  suspendedCount: 0,
  monthlySubscriptionRevenueTzs: 0,
  annualRunRateTzs: 0,
  totalPlatformGmvTzs: 0,
  traReceiptsProcessedToday: 0,
  smsCreditsRemaining: 0,
  apiUptimePercent: 99.9,
  averageLatencyMs: 45,
  cloudStorageUsedGb: 0,
};

export const DEFAULT_SAAS_PLANS: SaaSPlan[] = buildDefaultSaasPlans();
