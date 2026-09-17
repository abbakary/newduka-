import { api } from '@/lib/api';
import { enforceSaleTaxTotals } from '@/lib/taxEnforcement';
import type { TaxComplianceSettings } from '@/lib/taxComplianceSettings';
import { computeSaleDiscountAmount } from './saleDiscountUtils';
import type {
  BusinessType,
  CalendarEvent,
  Customer,
  ExpenseItem,
  PlatformBroadcast,
  Product,
  PurchaseOrder,
  SaaSTransaction,
  SaleTransaction,
  StaffMember,
  StaffPermissions,
  StaffRole,
  StockMovement,
  StoreBranch,
  Supplier,
  TenantStore,
} from '@/types/v1';

/** FastAPI/Pydantic rejects `""` for optional date fields — omit when empty. */
export function optionalApiDate(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export interface ApiSyncResult {
  businessType: BusinessType;
  businessName: string;
  plan?: import('@/types/v1').SaaSPlanTier;
  subscriptionExpiry?: string;
  tenantStatus?: string;
  products: Product[];
  customers: Customer[];
  customersFetchOk: boolean;
  suppliers: Supplier[];
  branches: StoreBranch[];
  expenses: ExpenseItem[];
  events: CalendarEvent[];
  staff: StaffMember[];
  purchaseOrders: PurchaseOrder[];
  sales: SaleTransaction[];
  stockMovements: StockMovement[];
}

export function mapProduct(p: Record<string, unknown>): Product {
  const rawMeta = p.metadata_json ?? p.metadata;
  let meta: Record<string, unknown> = {};
  if (rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)) {
    meta = rawMeta as Record<string, unknown>;
  } else if (typeof rawMeta === 'string' && rawMeta.trim()) {
    try {
      const parsed = JSON.parse(rawMeta) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        meta = parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore malformed metadata */
    }
  }

  const pickImage = (...candidates: unknown[]): string | undefined => {
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) return c;
    }
    return undefined;
  };

  const imageUrl = pickImage(
    p.image_url,
    p.imageUrl,
    meta.image_url,
    meta.imageUrl,
  );
  const vatType =
    (typeof p.vat_type === 'string' && p.vat_type) ||
    (typeof p.vatType === 'string' && p.vatType) ||
    (typeof meta.vat_type === 'string' && meta.vat_type) ||
    (typeof meta.vatType === 'string' && meta.vatType) ||
    undefined;

  return {
    id: p.id as string,
    branchId: (p.branch_id as string) ?? undefined,
    name: p.name as string,
    category: p.category as string,
    sku: p.sku as string,
    barcode: (typeof p.barcode === 'string' && p.barcode) || undefined,
    price: Number(p.price ?? 0),
    cost: Number(p.cost ?? 0),
    stock: Number(p.stock ?? 0),
    reorderPoint: Number(p.reorder_point ?? 10),
    unit: (p.unit as string) ?? 'pcs',
    batchNumber: (p.batch_number as string) ?? undefined,
    expiryDate: p.expiry_date ? String(p.expiry_date).slice(0, 10) : undefined,
    businessType: (p.business_type as BusinessType) ?? 'retail',
    requiresPrescription: Boolean(p.requires_prescription),
    supplier:
      (typeof meta.supplier_name === 'string' && meta.supplier_name) ||
      (typeof meta.supplier === 'string' && meta.supplier) ||
      (typeof p.supplier === 'string' ? p.supplier : undefined),
    description: (typeof meta.description === 'string' && meta.description) || undefined,
    location: (typeof meta.location === 'string' && meta.location) || undefined,
    imageUrl,
    vatType,
  } as Product;
}

export function resolveDefaultBranchId(branches: StoreBranch[]): string | null {
  const hq = branches.find(b => b.type === 'main_hq');
  return hq?.id ?? branches[0]?.id ?? null;
}

export function filterByBranchId<T extends { branchId?: string }>(
  items: T[],
  branchId: string | null | undefined,
  hqBranchId?: string | null,
): T[] {
  if (!branchId || branchId === 'all') return items;
  return items.filter(item => {
    if (item.branchId) return item.branchId === branchId;
    return hqBranchId != null && branchId === hqBranchId;
  });
}

/** Client-side guard — never show another branch's operational rows. */
export function scopeSnapshotByBranch(
  data: ApiSyncResult,
  branchId: string | null | undefined,
): ApiSyncResult {
  if (!branchId || branchId === 'all') return data;
  const hqBranchId = resolveDefaultBranchId(data.branches);
  const products = filterByBranchId(data.products, branchId, hqBranchId);
  const productIds = new Set(products.map(p => p.id));
  return {
    ...data,
    products,
    customers: filterByBranchId(data.customers, branchId, hqBranchId),
    sales: filterByBranchId(data.sales, branchId, hqBranchId),
    stockMovements: data.stockMovements.filter(m => productIds.has(m.productId)),
    events: filterByBranchId(data.events, branchId, hqBranchId),
    purchaseOrders: filterPurchaseOrdersByBranch(data.purchaseOrders, branchId, productIds),
  };
}

/** PO rows belong to a branch via branchId or exclusively branch products in line items. */
export function filterPurchaseOrdersByBranch(
  orders: PurchaseOrder[],
  branchId: string | null | undefined,
  branchProductIds?: Set<string>,
): PurchaseOrder[] {
  if (!branchId || branchId === 'all') return orders;
  return orders.filter(po => {
    if (po.branchId) return po.branchId === branchId;
    if (!branchProductIds || !po.items.length) return false;
    return po.items.every(it => !it.productId || branchProductIds.has(it.productId));
  });
}

export async function fetchProductsFromApi(
  branchId?: string | null,
  tenantId?: string | null,
): Promise<Product[]> {
  const raw = await api.getAllProducts(branchId);
  const mapped = (raw as Array<Record<string, unknown>>).map(mapProduct);
  if (!tenantId) return mapped;
  const { withProductImageCache } = await import('@/lib/productImageCache');
  return withProductImageCache(tenantId, mapped);
}

export async function fetchCustomersFromApi(branchId?: string | null): Promise<Customer[]> {
  const raw = await api.getAllCustomers(branchId);
  const mapped = (raw as Array<Record<string, unknown>>).map(mapCustomer);
  return filterByBranchId(mapped, branchId);
}

/** Keep local POS-created rows until the server returns the same phone/id. */
export function mergeCustomersFromApi(
  existing: Customer[],
  fromApi: Customer[],
  branchId?: string | null,
): Customer[] {
  const scopedApi = filterByBranchId(fromApi, branchId);
  const apiIds = new Set(scopedApi.map(c => c.id));
  const apiPhones = new Set(scopedApi.map(c => c.phone.replace(/\s/g, '')));
  const pendingLocal = existing.filter(c => {
    if (branchId && c.branchId && c.branchId !== branchId) return false;
    if (apiIds.has(c.id)) return false;
    const normalized = c.phone.replace(/\s/g, '');
    if (apiPhones.has(normalized)) return false;
    return c.id.startsWith('cust-') || c.id.startsWith('local-cust-');
  });
  return [...scopedApi, ...pendingLocal];
}

export function mapCustomer(c: Record<string, unknown>): Customer {
  return {
    id: c.id as string,
    branchId: (c.branch_id as string) ?? undefined,
    name: c.name as string,
    phone: c.phone as string,
    email: (c.email as string) ?? '',
    address: (c.address as string) ?? '',
    creditLimit: (c.credit_limit as number) ?? 0,
    balance: (c.balance as number) ?? 0,
    joinedDate: String(c.created_at ?? '').slice(0, 10),
    loyaltyTier: (c.loyalty_tier as Customer['loyaltyTier']) ?? 'Bronze',
    loyaltyPoints: (c.loyalty_points as number) ?? 0,
    riskScore: 'Low',
    dunningStage: (c.dunning_stage as Customer['dunningStage']) ?? 'cleared',
    daysOverdue: 0,
    lastPurchaseDate: '',
    totalPurchases: 0,
    avatarColor: 'bg-brand-600',
  };
}

export function mapSupplier(s: Record<string, unknown>): Supplier {
  return {
    id: s.id as string,
    name: s.name as string,
    contactPerson: (s.contact_person as string) ?? '',
    phone: (s.phone as string) ?? '',
    email: (s.email as string) ?? '',
    category: (s.category as string) ?? '',
    paymentTerms: (s.payment_terms as string) ?? 'Net 30 Days',
    outstandingPayable: (s.outstanding_payable as number) ?? 0,
    leadTimeDays: (s.lead_time_days as number) ?? 7,
    rating: (s.rating as number) ?? 5,
    balance: (s.outstanding_payable as number) ?? 0,
    totalPurchases: 0,
  } as Supplier;
}

export function mapBranch(b: Record<string, unknown>): StoreBranch {
  return {
    id: b.id as string,
    name: b.name as string,
    code: b.code as string,
    type: (b.branch_type as StoreBranch['type']) ?? 'main_hq',
    status: (b.status as StoreBranch['status']) ?? 'active',
    region: (b.region as string) ?? '',
    district: (b.district as string) ?? '',
    address: (b.address as string) ?? '',
    phone: (b.phone as string) ?? '',
    email: '',
    managerStaffId: (b.manager_staff_id as string) ?? undefined,
    managerName: (b.manager_name as string) ?? undefined,
    staffCount: Number(b.staff_count ?? 0),
    activeRegistersCount: 1,
    dailyGmvTzs: 0,
    monthlyGmvTzs: 0,
    stockCount: 0,
    stockValuationTzs: 0,
    traEfdSerial: (b.tra_efd_serial as string) ?? '',
    openingHours: (b.opening_hours as string) ?? '08:00 - 20:00',
    vatRegistered:
      b.vat_registered === null || b.vat_registered === undefined
        ? undefined
        : Boolean(b.vat_registered),
    createdDate: String(b.created_at ?? '').slice(0, 10),
  };
}

export function mapExpense(e: Record<string, unknown>): ExpenseItem {
  const dt = String(e.expense_date ?? '');
  return {
    id: e.id as string,
    date: dt.slice(0, 10),
    time: dt.length > 10 ? dt.slice(11, 16) : '09:00',
    title: e.title as string,
    category: (e.category as ExpenseItem['category']) ?? 'other',
    amount: (e.amount as number) ?? 0,
    paymentMethod: (e.payment_method as ExpenseItem['paymentMethod']) ?? 'cash_drawer',
    recipient: (e.recipient as string) ?? '',
    recordedBy: 'System',
    status: (e.status as ExpenseItem['status']) ?? 'paid',
  };
}

export function mapEvent(ev: Record<string, unknown>): CalendarEvent {
  return {
    id: ev.id as string,
    branchId: (ev.branch_id as string) ?? undefined,
    title: ev.title as string,
    category: (ev.category as CalendarEvent['category']) ?? 'general',
    date: String(ev.event_date ?? '').slice(0, 10),
    time: (ev.event_time as string) ?? '09:00',
    priority: (ev.priority as CalendarEvent['priority']) ?? 'medium',
    description: (ev.description as string) ?? '',
    assignedTo: (ev.assigned_to as string) ?? '',
    completed: Boolean(ev.completed),
  };
}

const DEFAULT_STAFF_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  Owner: {
    canSellPOS: true, canGiveCredit: true, canModifyInventory: true, canViewInventory: true,
    canViewProfitReports: true, canManageSuppliers: true, canApproveDiscounts: true,
    canOverridePrices: true, canVoidReceipts: true, canPerformDailyClosing: true, canAccessSuperAdmin: false,
  },
  Manager: {
    canSellPOS: true, canGiveCredit: true, canModifyInventory: true, canViewInventory: true,
    canViewProfitReports: true, canManageSuppliers: true, canApproveDiscounts: true,
    canOverridePrices: true, canVoidReceipts: true, canPerformDailyClosing: true, canAccessSuperAdmin: false,
  },
  Pharmacist: {
    canSellPOS: true, canGiveCredit: true, canModifyInventory: true, canViewInventory: true,
    canViewProfitReports: false, canManageSuppliers: true, canApproveDiscounts: true,
    canOverridePrices: true, canVoidReceipts: true, canPerformDailyClosing: false, canAccessSuperAdmin: false,
  },
  Cashier: {
    canSellPOS: true, canGiveCredit: false, canModifyInventory: false, canViewInventory: true,
    canViewProfitReports: false, canManageSuppliers: false, canApproveDiscounts: false,
    canOverridePrices: false, canVoidReceipts: false, canPerformDailyClosing: true, canAccessSuperAdmin: false,
  },
  Storekeeper: {
    canSellPOS: false, canGiveCredit: false, canModifyInventory: true, canViewInventory: true,
    canViewProfitReports: false, canManageSuppliers: true, canApproveDiscounts: false,
    canOverridePrices: false, canVoidReceipts: false, canPerformDailyClosing: false, canAccessSuperAdmin: false,
  },
  Accountant: {
    canSellPOS: false, canGiveCredit: true, canModifyInventory: true, canViewInventory: true,
    canViewProfitReports: true, canManageSuppliers: true, canApproveDiscounts: false,
    canOverridePrices: false, canVoidReceipts: false, canPerformDailyClosing: true, canAccessSuperAdmin: false,
  },
};

export function resolveStaffPermissions(
  staff: Pick<StaffMember, 'role' | 'permissions'>,
): StaffPermissions {
  const defaults = DEFAULT_STAFF_PERMISSIONS[staff.role] ?? DEFAULT_STAFF_PERMISSIONS.Cashier;
  const fromApi = staff.permissions as Partial<StaffPermissions> | undefined;
  if (!fromApi || typeof fromApi !== 'object') return defaults;
  return { ...defaults, ...fromApi };
}

export function mapStaff(s: Record<string, unknown>): StaffMember {
  const role = (s.role as StaffMember['role']) ?? 'Cashier';
  const branchName = (s.branch_name as string) ?? undefined;
  return {
    id: s.id as string,
    name: s.name as string,
    role,
    email: (s.email as string) ?? '',
    phone: (s.phone as string) ?? '',
    active: Boolean(s.active ?? true),
    joinedDate: new Date().toISOString().slice(0, 10),
    branch: branchName ?? 'HQ',
    branchId: (s.branch_id as string) ?? undefined,
    shift: 'Day',
    todaySalesCount: 0,
    todayRevenueTzs: 0,
    lastActive: new Date().toISOString().slice(0, 10),
    permissions: resolveStaffPermissions({
      role,
      permissions: s.permissions as StaffPermissions | undefined,
    }),
  };
}

export function mapPurchaseOrder(po: Record<string, unknown>): PurchaseOrder {
  const items = (po.items as Array<Record<string, unknown>>) ?? [];
  return {
    id: po.id as string,
    branchId: (po.branch_id as string) ?? undefined,
    poNumber: (po.po_number as string) ?? '',
    supplierId: (po.supplier_id as string) ?? '',
    supplierName: (po.supplier_name as string) ?? '',
    dateCreated: String(po.created_at ?? '').slice(0, 10),
    expectedDate: String(po.created_at ?? '').slice(0, 10),
    status: (po.status as PurchaseOrder['status']) ?? 'draft',
    items: items.map(i => ({
      productId: (i.product_id as string) ?? undefined,
      productName: (i.product_name as string) ?? '',
      quantity: (i.quantity as number) ?? 0,
      costPrice: (i.unit_cost as number) ?? 0,
      sellingPrice:
        i.selling_price != null ? Number(i.selling_price) : undefined,
      total: (i.total as number) ?? 0,
      taxId: (i.tax_id as PurchaseOrder['items'][0]['taxId']) ?? 'none',
      taxRate: Number(i.tax_rate ?? 0),
      taxAmount: Number(i.tax_amount ?? 0),
    })),
    subtotal: (po.subtotal as number) ?? 0,
    vatAmount: Number(po.vat_amount ?? 0),
    totalAmount: (po.total_amount as number) ?? 0,
    paidAmount: (po.paid_amount as number) ?? 0,
    vendorReference: (po.vendor_reference as string) ?? undefined,
    currency: (po.currency as string) ?? 'TZS',
    orderDeadline: (po.order_deadline as string) ?? undefined,
    deliverTo: (po.deliver_to as string) ?? undefined,
    askConfirmation: po.ask_confirmation === true,
    fiscalPosition: (po.fiscal_position as string) ?? undefined,
  };
}

export function mapSale(s: Record<string, unknown>): SaleTransaction {
  const items = (s.items as Array<Record<string, unknown>>) ?? [];
  const mappedItems = items.map(i => ({
    productId: (i.product_id as string) ?? '',
    productName: (i.product_name as string) ?? '',
    quantity: Number(i.quantity ?? 0),
    unitPrice: Number(i.unit_price ?? 0),
    total: Number(i.total ?? i.total_price ?? 0),
    discountPercent: Number(i.discount_percent ?? 0),
    originalUnitPrice: i.original_unit_price != null ? Number(i.original_unit_price) : undefined,
  }));
  const sale: SaleTransaction = {
    id: s.id as string,
    branchId: (s.branch_id as string) ?? undefined,
    receiptNumber: (s.receipt_number as string) ?? '',
    date: (() => {
      const raw = String(s.created_at ?? '');
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) {
        const d = new Date(parsed);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return `${ymd} ${hm}`;
      }
      return raw.replace('T', ' ').slice(0, 16);
    })(),
    customerId: (s.customer_id as string) ?? undefined,
    customerName: (s.customer_name as string) ?? 'Walk-in',
    items: mappedItems,
    subtotal: Number(s.subtotal ?? 0),
    discountAmount: s.discount_amount != null ? Number(s.discount_amount) : undefined,
    vatAmount: Number(s.vat_amount ?? 0),
    total: Number(s.total ?? 0),
    paidAmount: Number(s.paid_amount ?? 0),
    balanceRemaining: Number(s.balance_remaining ?? 0),
    payments: (s.payments as SaleTransaction['payments']) ?? [],
    type: (s.sale_type as SaleTransaction['type']) ?? 'full',
    cashierName: (s.cashier_name as string) ?? '',
    traEfdSignature: (s.tra_efd_signature as string) ?? '',
    status: (s.status as SaleTransaction['status']) ?? 'completed',
    paymentDueDate: (s.due_date as string) ?? (s.payment_due_date as string) ?? undefined,
  };
  sale.discountAmount = computeSaleDiscountAmount(sale);
  return sale;
}

export function mapStockMovement(m: Record<string, unknown>): StockMovement {
  return {
    id: m.id as string,
    date: String(m.created_at ?? '').replace('T', ' ').slice(0, 16),
    productId: (m.product_id as string) ?? '',
    productName: (m.product_name as string) ?? '',
    sku: (m.sku as string) ?? '',
    type: (m.movement_type as StockMovement['type']) ?? 'in_adjustment',
    quantity: (m.quantity as number) ?? 0,
    previousStock: (m.previous_stock as number) ?? 0,
    newStock: (m.new_stock as number) ?? 0,
    unitCost: 0,
    totalValuation: 0,
    operatorName: (m.operator_name as string) ?? '',
    notes: (m.notes as string) ?? undefined,
  };
}

export function mapAdminTenant(t: Record<string, unknown>): TenantStore {
  return {
    id: t.id as string,
    name: t.name as string,
    ownerName: (t.owner_name as string) ?? '',
    ownerEmail: (t.owner_email as string) ?? '',
    ownerPhone: (t.owner_phone as string) ?? '',
    type: (t.business_type as TenantStore['type']) ?? 'retail',
    region: (t.region as string) ?? '',
    district: (t.district as string) ?? '',
    plan: (t.plan as TenantStore['plan']) ?? 'starter',
    status: (t.status as TenantStore['status']) ?? 'active',
    traEfdDeviceSerial: (t.tra_efd_serial as string) ?? '',
    tinNumber: (t.tin_number as string) ?? '',
    licenseNumber: (t.license_number as string) ?? '',
    branchesCount: (t.branches_count as number) ?? 0,
    staffCount: 0,
    monthlyGmvTzs: (t.monthly_revenue as number) ?? 0,
    mrrTzs: (t.mrr_tzs as number) ?? 0,
    createdAt: String(t.created_at ?? '').slice(0, 10),
    lastSyncTime: String(t.created_at ?? '').slice(0, 10),
    subscriptionExpiry: String(t.subscription_expiry ?? '').slice(0, 10) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    kycDocumentsVerified: (t.status as string) === 'active',
    autoRenew: true,
    storageUsedMb: 0,
  };
}

export async function syncTenantFromApi(branchId?: string | null): Promise<ApiSyncResult | null> {
  try {
    const profile = await api.getTenantProfile();
    const [
      productsResult,
      customersResult,
      suppliersResult,
      branchesResult,
      expensesResult,
      eventsResult,
      staffResult,
      posResult,
      salesResult,
      movementsResult,
    ] = await Promise.allSettled([
      api.getAllProducts(branchId),
      api.getAllCustomers(branchId),
      api.getSuppliers(),
      api.getBranches(),
      api.getExpenses(),
      api.getCalendarEvents(branchId),
      api.getStaff(),
      api.getPurchaseOrders(branchId),
      api.getAllSales(branchId),
      api.getStockMovements(),
    ]);

    const unwrap = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
      result.status === 'fulfilled' ? result.value : fallback;

    const productsRaw = unwrap(productsResult, [] as Array<Record<string, unknown>>);
    const customersRaw = unwrap(customersResult, [] as Array<Record<string, unknown>>);
    const suppliersRaw = unwrap(suppliersResult, [] as Array<Record<string, unknown>>);
    const branchesRaw = unwrap(branchesResult, [] as Array<Record<string, unknown>>);
    const expensesRaw = unwrap(expensesResult, [] as Array<Record<string, unknown>>);
    const eventsRaw = unwrap(eventsResult, [] as Array<Record<string, unknown>>);
    const staffRaw = unwrap(staffResult, [] as Array<Record<string, unknown>>);
    const posRaw = unwrap(posResult, [] as Array<Record<string, unknown>>);
    const salesRaw = unwrap(salesResult, [] as Array<Record<string, unknown>>);
    const movementsRaw = unwrap(movementsResult, [] as Array<Record<string, unknown>>);

    let products = productsRaw.map(mapProduct);
    const tenantKey =
      String((profile as Record<string, unknown>).tenant_id ?? '') ||
      String((profile as Record<string, unknown>).id ?? '') ||
      '';
    if (tenantKey) {
      const { withProductImageCache } = await import('@/lib/productImageCache');
      products = await withProductImageCache(tenantKey, products);
    }

    return {
      businessType: profile.business_type as BusinessType,
      businessName: profile.business_name,
      plan: (profile as { plan?: string }).plan as import('@/types/v1').SaaSPlanTier | undefined,
      subscriptionExpiry: String((profile as { subscription_expiry?: string }).subscription_expiry ?? '').slice(0, 10) || undefined,
      tenantStatus: (profile as { status?: string }).status,
      products,
      customers: customersRaw.map(mapCustomer),
      customersFetchOk: customersResult.status === 'fulfilled',
      suppliers: suppliersRaw.map(mapSupplier),
      branches: branchesRaw.map(mapBranch),
      expenses: expensesRaw.map(mapExpense),
      events: eventsRaw.map(mapEvent),
      staff: staffRaw.map(mapStaff),
      purchaseOrders: posRaw.map(mapPurchaseOrder),
      sales: salesRaw.map(mapSale),
      stockMovements: movementsRaw.map(mapStockMovement),
    };
  } catch {
    return null;
  }
}

export function mapSubscriptionPayment(raw: Record<string, unknown>): SaaSTransaction {
  return {
    id: String(raw.id),
    storeId: String(raw.store_id),
    storeName: String(raw.store_name),
    plan: raw.plan as SaaSTransaction['plan'],
    amountTzs: Number(raw.amount_tzs ?? 0),
    paymentMethod: (raw.payment_method as SaaSTransaction['paymentMethod']) ?? 'M-Pesa',
    reference: String(raw.reference ?? ''),
    date: String(raw.date ?? ''),
    status: (raw.status as SaaSTransaction['status']) ?? 'completed',
    billingCycle: (raw.billing_cycle as SaaSTransaction['billingCycle']) ?? 'monthly',
  };
}

export function mapBroadcast(raw: Record<string, unknown>): PlatformBroadcast {
  return {
    id: String(raw.id),
    title: String(raw.title),
    message: String(raw.message),
    targetAudience: (raw.target_audience as PlatformBroadcast['targetAudience']) ?? 'all',
    targetRegion: String(raw.target_region ?? ''),
    channel: (raw.channel as PlatformBroadcast['channel']) ?? 'both',
    sentAt: String(raw.sent_at ?? ''),
    sentBy: String(raw.sent_by ?? 'Provider Admin'),
    deliveryCount: Number(raw.delivery_count ?? 0),
    status: (raw.status as PlatformBroadcast['status']) ?? 'sent',
  };
}

export async function syncAdminFromApi(): Promise<{
  tenants: TenantStore[];
  metrics: Record<string, unknown>;
  payments: SaaSTransaction[];
  broadcasts: PlatformBroadcast[];
} | null> {
  try {
    const [tenantsRaw, metrics, paymentsRaw, broadcastsRaw] = await Promise.all([
      api.getAdminTenants(),
      api.getAdminMetrics(),
      api.getSubscriptionPayments().catch(() => []),
      api.getAdminBroadcasts().catch(() => []),
    ]);
    return {
      tenants: tenantsRaw.map(mapAdminTenant),
      metrics,
      payments: (paymentsRaw as Array<Record<string, unknown>>).map(mapSubscriptionPayment),
      broadcasts: (broadcastsRaw as Array<Record<string, unknown>>).map(mapBroadcast),
    };
  } catch {
    return null;
  }
}

export interface DashboardStats {
  todayRevenue: number;
  todaySalesCount: number;
  totalProducts: number;
  lowStockCount: number;
  expiringSoonCount: number;
  totalCustomers: number;
  outstandingReceivables: number;
  outstandingPayables: number;
  monthlyRevenue: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
}

export function mapDashboardStats(raw: Record<string, unknown>): DashboardStats {
  const top = (raw.top_products as Array<Record<string, unknown>>) ?? [];
  return {
    todayRevenue: Number(raw.today_revenue ?? 0),
    todaySalesCount: Number(raw.today_sales_count ?? 0),
    totalProducts: Number(raw.total_products ?? 0),
    lowStockCount: Number(raw.low_stock_count ?? 0),
    expiringSoonCount: Number(raw.expiring_soon_count ?? 0),
    totalCustomers: Number(raw.total_customers ?? 0),
    outstandingReceivables: Number(raw.outstanding_receivables ?? 0),
    outstandingPayables: Number(raw.outstanding_payables ?? 0),
    monthlyRevenue: Number(raw.monthly_revenue ?? 0),
    topProducts: top.map(p => ({
      name: String(p.name ?? p.product_name ?? ''),
      quantity: Number(p.quantity ?? 0),
      revenue: Number(p.revenue ?? p.total ?? 0),
    })),
  };
}

export async function fetchDashboardStats(branchId?: string | null): Promise<DashboardStats | null> {
  try {
    const raw = await api.getDashboardStats(branchId);
    return mapDashboardStats(raw);
  } catch {
    return null;
  }
}

export function productToApiPayload(
  p: Partial<Product> & { name: string; metadata_json?: Record<string, unknown> },
  branchId?: string | null,
) {
  const existingMeta = p.metadata_json ?? {};
  const metadata_json: Record<string, unknown> = { ...existingMeta };
  if (p.imageUrl) metadata_json.image_url = p.imageUrl;
  else delete metadata_json.image_url;
  if (p.vatType) metadata_json.vat_type = p.vatType;
  if (p.supplier) metadata_json.supplier_name = p.supplier;

  return {
    name: p.name,
    category: p.category,
    sku: p.sku,
    barcode: p.barcode || undefined,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    reorder_point: p.reorderPoint,
    unit: p.unit,
    batch_number: p.batchNumber?.trim() || undefined,
    expiry_date: optionalApiDate(p.expiryDate),
    requires_prescription: p.requiresPrescription,
    business_type: p.businessType,
    // Top-level fields (backend folds into metadata_json) — keeps photos even if metadata merge fails
    image_url: p.imageUrl || undefined,
    vat_type: p.vatType || undefined,
    metadata_json: Object.keys(metadata_json).length ? metadata_json : undefined,
    branch_id: branchId && branchId !== 'all' ? branchId : (p as Product).branchId,
  };
}

export function customerToApiPayload(
  c: Partial<Customer> & { name: string },
  branchId?: string | null,
) {
  const resolvedBranch =
    branchId && branchId !== 'all' ? branchId : c.branchId;
  return {
    name: c.name.trim(),
    phone: (c.phone ?? '').trim(),
    email: (c.email ?? '').trim(),
    address: (c.address ?? '').trim(),
    credit_limit: c.creditLimit ?? 0,
    notes: (c as { notes?: string }).notes?.trim() || undefined,
    ...(resolvedBranch ? { branch_id: resolvedBranch } : {}),
  };
}

export function supplierToApiPayload(s: Partial<Supplier> & { name: string }) {
  return {
    name: s.name,
    contact_person: s.contactPerson,
    phone: s.phone,
    email: s.email,
    category: s.category,
    payment_terms: s.paymentTerms,
    lead_time_days: s.leadTimeDays,
    rating: s.rating,
  };
}

export function expenseToApiPayload(e: { title: string; category: string; amount: number; paymentMethod?: string; recipient?: string; notes?: string }) {
  return {
    title: e.title,
    category: e.category,
    amount: e.amount,
    payment_method: e.paymentMethod,
    recipient: e.recipient,
    notes: e.notes,
  };
}

export function eventToApiPayload(
  ev: Partial<CalendarEvent> & { title: string; date: string },
  branchId?: string | null,
) {
  const resolvedBranch = branchId && branchId !== 'all' ? branchId : ev.branchId;
  return {
    title: ev.title,
    category: ev.category,
    event_date: ev.date,
    event_time: ev.time,
    priority: ev.priority,
    description: ev.description,
    assigned_to: ev.assignedTo,
    ...(resolvedBranch ? { branch_id: resolvedBranch } : {}),
  };
}

export function saleToApiPayload(
  sale: SaleTransaction,
  options?: {
    finalize?: boolean;
    branchId?: string | null;
    taxSettings?: TaxComplianceSettings;
  },
) {
  const finalize =
    options?.finalize ??
    (sale.status === 'completed' || sale.status === 'pending_credit');
  const resolvedBranch =
    sale.branchId ||
    (options?.branchId && options.branchId !== 'all' ? options.branchId : null);

  const enforced = options?.taxSettings
    ? enforceSaleTaxTotals(sale, options.taxSettings)
    : sale;

  const discountAmount = computeSaleDiscountAmount(enforced);
  return {
    items: enforced.items.map(i => ({
      product_id: i.productId,
      product_name: i.productName,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      total: i.total,
      discount_percent: i.discountPercent ?? 0,
      original_unit_price: i.originalUnitPrice ?? i.unitPrice,
    })),
    subtotal: enforced.subtotal,
    discount_amount: discountAmount,
    cart_discount_percent: enforced.cartDiscountPercent ?? 0,
    vat_amount: enforced.vatAmount,
    apply_vat: Number(enforced.vatAmount || 0) > 0,
    total: enforced.total,
    customer_id: enforced.customerId || null,
    customer_name: enforced.customerName,
    payments: (enforced.payments ?? []).map(p => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference,
    })),
    sale_type: enforced.type,
    branch_id: resolvedBranch,
    client_id: enforced.id,
    finalize,
    ...(enforced.paymentDueDate && enforced.balanceRemaining > 0
      ? { due_date: enforced.paymentDueDate, payment_due_date: enforced.paymentDueDate }
      : {}),
  };
}
