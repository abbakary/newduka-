export type UserRole = 'super_admin' | 'vendor_owner' | 'vendor_staff';

export type BusinessType =
  | 'pharmacy' | 'supermarket' | 'retail' | 'hardware' | 'electronics'
  | 'auto_parts' | 'fashion' | 'agrovet' | 'beauty' | 'salon'
  | 'restaurant' | 'stationery' | 'furniture' | 'service' | 'mixed';

export type Language = 'sw' | 'en';

export type DunningStage = 'stage1_reminder' | 'stage2_statement' | 'stage3_call' | 'stage4_final' | 'stage5_legal' | 'cleared';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number; // in TSh
  balance: number; // current debt in TSh
  joinedDate: string;
  loyaltyTier: 'Bronze' | 'Silver' | 'Gold';
  loyaltyPoints: number;
  riskScore: 'Low' | 'Medium' | 'High';
  dunningStage: DunningStage;
  daysOverdue: number;
  lastPurchaseDate: string;
  totalPurchases: number;
  avatarColor: string;
  notes?: string;
  branchId?: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: 'sale' | 'payment' | 'credit_adjustment';
  amount: number;
  date: string;
  invoiceNumber: string;
  description: string;
  balanceAfter: number;
}

/** Product purchase/sale VAT class — used when shop applies VAT selectively. */
export type ProductVatType = 'standard' | 'exempt' | 'zero';

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number; // Selling price in TSh
  cost: number; // Cost price in TSh
  stock: number;
  branchStock?: Record<string, number>; // BranchId -> stock count mapping
  reorderPoint: number;
  unit: string; // pcs, boxes, kg, bottles, doses
  batchNumber?: string;
  expiryDate?: string;
  businessType: BusinessType;
  requiresPrescription?: boolean;
  buyingPrice?: number;
  supplier?: string;
  /** standard = VAT 18% eligible; exempt/zero = no purchase/sale VAT line */
  vatType?: ProductVatType | string;
  /** Product photo (data URL or remote URL) shown in inventory, POS, stock forms */
  imageUrl?: string;
  description?: string;
  location?: string;
  isDrug?: boolean;
  branchId?: string;
}

export type BranchType = 'main_hq' | 'sub_branch' | 'warehouse';
export type BranchStatus = 'active' | 'inactive' | 'renovation' | 'closed';

export interface StoreBranch {
  id: string;
  name: string;
  code: string;
  type: BranchType;
  status: BranchStatus;
  region: string;
  district: string;
  address: string;
  phone: string;
  email: string;
  managerStaffId?: string;
  managerName?: string;
  staffCount: number;
  activeRegistersCount: number;
  dailyGmvTzs: number;
  monthlyGmvTzs: number;
  stockCount: number;
  stockValuationTzs: number;
  traEfdSerial: string;
  openingHours: string;
  /** null/undefined = inherit organization tax status */
  vatRegistered?: boolean | null;
  notes?: string;
  createdDate: string;
}

export interface InterBranchTransferItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitCostTzs: number;
  totalValuationTzs: number;
}

export interface InterBranchTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  status: 'pending' | 'in_transit' | 'received' | 'rejected';
  items: InterBranchTransferItem[];
  totalUnits: number;
  totalValuationTzs: number;
  initiatedBy: string;
  dateInitiated: string;
  receivedBy?: string;
  dateReceived?: string;
  notes?: string;
  dispatchDriverOrWaybill?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
  /** Manual unit price when price override is enabled */
  unitPriceOverride?: number;
}

export type PaymentMethod = 'cash' | 'mpesa' | 'airtel' | 'tigopesa' | 'card' | 'credit';

export interface PaymentBreakdown {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface SaleTransaction {
  id: string;
  receiptNumber: string;
  date: string;
  customerId?: string;
  customerName?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    totalPrice?: number;
    discountPercent?: number;
    originalUnitPrice?: number;
  }[];
  subtotal: number;
  discountAmount?: number;
  cartDiscountPercent?: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  balanceRemaining: number;
  payments: PaymentBreakdown[];
  type: 'full' | 'partial' | 'credit';
  cashierName: string;
  traEfdSignature?: string;
  status:
    | 'open'
    | 'pending_completion'
    | 'requires_attention'
    | 'ready_to_complete'
    | 'completed'
    | 'pending_credit'
    | 'cancelled'
    | 'voided'
    | 'refunded';
  /** Restaurant lifecycle link (Part 3 / Part 4B) */
  tableId?: string;
  orderId?: string;
  branchId?: string;
  /** ISO date (YYYY-MM-DD) when credit/partial balance is due — required when balanceRemaining > 0. */
  paymentDueDate?: string;
}

export type CalendarEventCategory = 
  | 'delivery' 
  | 'dunning' 
  | 'compliance' 
  | 'promo' 
  | 'shift' 
  | 'maintenance' 
  | 'general';

export interface CalendarEvent {
  id: string;
  title: string;
  category: CalendarEventCategory;
  date: string; // YYYY-MM-DD
  time: string; // e.g. 10:30 AM
  priority: 'high' | 'medium' | 'low';
  description: string;
  assignedTo: string;
  completed: boolean;
  syncedTRA?: boolean;
  relatedEntityId?: string;
  orderId?: string;
  branchId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  category: string;
  paymentTerms: string; // e.g. "Net 30 Days"
  outstandingPayable: number;
  leadTimeDays: number;
  rating: number;
  balance?: number;
  totalPurchases?: number;
}

export type PurchaseTaxId = 'none' | 'vat_18';

export interface PurchaseOrderItem {
  productId?: string; // undefined or empty if brand new product
  productName: string;
  category?: string;
  sku?: string;
  quantity: number;
  receivedQuantity?: number;
  costPrice: number;
  sellingPrice?: number;
  unit?: string;
  batchNumber?: string;
  expiryDate?: string;
  /** Untaxed line amount (qty × unit price). */
  total: number;
  taxId?: PurchaseTaxId;
  taxRate?: number;
  taxAmount?: number;
  isNewProduct?: boolean;
  unitCost?: number;
  totalCost?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  orderNumber?: string;
  supplierId: string;
  supplierName: string;
  dateCreated: string;
  expectedDate: string;
  orderDeadline?: string;
  receivedDate?: string;
  status: 'draft' | 'sent' | 'received' | 'partially_received' | 'cancelled';
  items: PurchaseOrderItem[];
  subtotal: number;
  vatAmount?: number;
  totalAmount: number;
  totalCost?: number;
  paidAmount: number;
  paymentTerms?: string;
  paymentStatus?: 'paid' | 'credit' | 'partial';
  paymentMethod?: string;
  notes?: string;
  /** Extra note specifically for VAT / TRA on this purchase */
  vatNote?: string;
  /** How VAT was applied on this PO: none | all lines | only VAT-class products */
  purchaseVatScope?: 'none' | 'all' | 'vat_products';
  invoiceRefNumber?: string;
  vendorReference?: string;
  currency?: string;
  deliverTo?: string;
  askConfirmation?: boolean;
  fiscalPosition?: string;
  receivedBy?: string;
  branchId?: string;
}

export type StockMovementType = 
  | 'in_purchase' 
  | 'in_adjustment' 
  | 'out_sale' 
  | 'out_damage' 
  | 'out_expiry' 
  | 'out_adjustment' 
  | 'out_return';

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantity: number; // delta: positive or negative
  previousStock: number;
  newStock: number;
  unitCost?: number;
  totalValuation?: number;
  batchNumber?: string;
  expiryDate?: string;
  referenceId?: string; // PO Number or Sale Receipt Number
  referenceType?: 'PO' | 'PURCHASE_ORDER' | 'SALE' | 'MANUAL' | 'TRANSFER';
  operatorName: string;
  notes?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  notes?: string;
  balanceBefore: number;
  balanceAfter: number;
  poId?: string;
  orderNumber?: string;
  type?: string;
  status?: string;
}

export interface VendorApplication {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  type: BusinessType;
  tinNumber: string;
  licenseNumber: string;
  location: string;
  submittedDate: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  logoUrl?: string;
}

export interface DailyClosingData {
  date: string;
  cashier: string;
  cashExpected: number;
  cashCounted: number;
  mpesaExpected: number;
  mpesaCounted: number;
  cardExpected: number;
  cardCounted: number;
  creditSalesTotal: number;
  totalRevenue: number;
  discrepancyNotes: string;
  status: 'reconciled' | 'discrepancy' | 'pending';
}

export type StaffRole = 'Owner' | 'Manager' | 'Pharmacist' | 'Cashier' | 'Storekeeper' | 'Accountant';

export interface StaffPermissions {
  canSellPOS: boolean;
  canGiveCredit: boolean;
  canModifyInventory: boolean;
  /** View stock list/prices without editing (cashier lookup). */
  canViewInventory: boolean;
  canViewProfitReports: boolean;
  canManageSuppliers: boolean;
  canApproveDiscounts: boolean;
  canOverridePrices: boolean;
  canVoidReceipts: boolean;
  canPerformDailyClosing: boolean;
  canAccessSuperAdmin: boolean;
}

export interface StaffAuditLog {
  id: string;
  timestamp: string;
  action: string;
  category: 'sale' | 'security' | 'inventory' | 'finance' | 'auth';
  details: string;
  ipAddress?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  email: string;
  phone: string;
  active: boolean;
  joinedDate: string;
  branch?: string;
  branchId?: string;
  shift: string;
  avatarColor?: string;
  pinCode?: string;
  todaySalesCount: number;
  todayRevenueTzs: number;
  lastActive: string;
  baseSalary?: number; // Monthly base salary in TSh
  dailyFoodAllowance?: number; // Daily food (chakula) allowance
  dailyTransportAllowance?: number; // Daily transport (nauli) allowance
  paymentMethodPreference?: 'mpesa' | 'tigopesa' | 'airtel' | 'crdb_bank' | 'nmb_bank' | 'cash';
  accountNumberOrPhone?: string;
  nssfNumber?: string;
  permissions: StaffPermissions;
  recentAuditLogs?: StaffAuditLog[];
}

export type ExpenseCategory = 
  | 'rent'
  | 'utilities_luku'
  | 'water'
  | 'staff_salaries'
  | 'daily_stipends_food_transport'
  | 'licenses_permits_brela_tmda'
  | 'marketing_sms'
  | 'maintenance_repairs'
  | 'supplier_settlements'
  | 'petty_cash'
  | 'taxes_tra_local'
  | 'equipment_assets'
  | 'cleaning_sanitation'
  | 'other';

export interface ExpenseItem {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  title: string;
  category: ExpenseCategory;
  amount: number; // in TSh
  paymentMethod: 'cash_drawer' | 'mpesa_till' | 'tigopesa' | 'airtel' | 'bank_transfer' | 'cheque' | 'other';
  referenceNumber?: string;
  recipient: string; // Vendor, Landlord, TANESCO, Staff Name, etc.
  recordedBy: string;
  notes?: string;
  receiptNumber?: string;
  isRecurring?: boolean;
  status: 'paid' | 'pending' | 'reconciled';
  staffId?: string; // Linked staff member if allowance/salary
}

export interface StaffDailyAllowance {
  id: string;
  date: string; // YYYY-MM-DD
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  foodAmount: number; // Chakula
  transportAmount: number; // Nauli
  otherAmount?: number; // Extra shift/special
  totalAmount: number;
  status: 'allocated' | 'claimed' | 'declined' | 'paid';
  claimedAt?: string; // e.g. "08:15 AM"
  claimedTimestamp?: string;
  acknowledgedSignature?: string; // Digital signature acknowledgment
  paymentSource: 'cash_drawer' | 'mpesa_till';
  expenseId?: string; // Linked OPEX record when synced from API
  notes?: string;
}

export interface SalaryAdvanceRequest {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  requestedAmount: number;
  dateRequested: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  approvedBy?: string;
  approvedDate?: string;
  disbursedMethod?: string;
  disbursedDate?: string;
  referenceNumber?: string;
  rejectionReason?: string;
}

export interface SalaryPayrollRecord {
  id: string;
  monthYear: string; // e.g. "2026-08"
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  baseSalary: number;
  totalDailyAllowancesPaid: number;
  advancesDeducted: number;
  statutoryDeductions: number; // NSSF / PAYE / Loan
  performanceBonus: number;
  netPayable: number;
  status: 'draft' | 'approved' | 'paid';
  paymentDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  payslipNumber: string;
  notes?: string;
}

export interface ProductBIInsight {
  productId: string;
  productName: string;
  category: string;
  sku: string;
  unitPrice: number;
  costPrice: number;
  marginPercent: number;
  grossProfitPerUnit: number;
  monthlySalesVolume: number;
  monthlyRevenue: number;
  monthlyGrossProfit: number;
  profitContributionPercent: number;
  paretoClass: 'A' | 'B' | 'C'; // Class A (Top 80% profit), Class B (15%), Class C (5%)
  turnoverDays: number; // How many days to turn inventory
  stockHealthStatus: 'fast_mover' | 'healthy' | 'slow_mover' | 'dead_capital';
  reorderUrgency: 'critical' | 'normal' | 'overstocked';
}

export interface CustomerBIInsight {
  customerId: string;
  customerName: string;
  phone: string;
  loyaltyTier: string;
  totalSpend: number;
  purchaseCount: number;
  averageOrderValue: number;
  lifetimeGrossMargin: number;
  daysSinceLastPurchase: number;
  churnRisk: 'low' | 'medium' | 'high_churn';
  creditHealth: 'reliable_cash' | 'prompt_payer' | 'overdue_risk';
  segment: 'VIP Champion' | 'Loyal Core' | 'High Potential' | 'At Risk' | 'Occasional Buyer';
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  staffRole?: StaffRole;
  staffId?: string;
  branch?: string;
  branchId?: string;
  branchName?: string;
  branchType?: 'main_hq' | 'sub_branch' | 'warehouse';
  isBranchScoped?: boolean;
  shift?: string;
  permissions?: Partial<StaffPermissions>;
  businessType?: BusinessType;
  businessName?: string;
  businessId?: string;
  status: 'approved' | 'pending' | 'rejected';
  rejectionReason?: string;
  tinNumber?: string;
  licenseNumber?: string;
  location?: string;
  logoUrl?: string;
  plan?: SaaSPlanTier;
  subscriptionExpiry?: string;
}

export type SaaSPlanTier = 'starter' | 'biashara_pro' | 'enterprise_chain';
export type TenantStatus = 'active' | 'suspended' | 'pending_kyc' | 'grace_period';

export interface TenantStore {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  type: BusinessType;
  region: string; // Dar es Salaam, Arusha, Mwanza, Dodoma, Zanzibar, etc.
  district: string;
  tinNumber: string;
  licenseNumber: string;
  plan: SaaSPlanTier;
  status: TenantStatus;
  branchesCount: number;
  staffCount: number;
  monthlyGmvTzs: number;
  subscriptionExpiry: string;
  lastSyncTime: string;
  traEfdDeviceSerial: string;
  storageUsedMb: number;
  createdAt: string;
  mrrTzs: number;
  autoRenew: boolean;
}

export interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  pendingKycCount: number;
  suspendedCount: number;
  monthlySubscriptionRevenueTzs: number;
  annualRunRateTzs: number;
  totalPlatformGmvTzs: number;
  traReceiptsProcessedToday: number;
  smsCreditsRemaining: number;
  apiUptimePercent: number;
  averageLatencyMs: number;
  cloudStorageUsedGb: number;
}

export interface SaaSPlan {
  id: string;
  name: string;
  tier: SaaSPlanTier;
  priceMonthlyTzs: number;
  priceYearlyTzs: number;
  maxProducts: number;
  maxBranches: number;
  maxStaff: number;
  features: string[];
  popular?: boolean;
  activeSubscribersCount: number;
}

export interface SaaSTransaction {
  id: string;
  storeId: string;
  storeName: string;
  plan: SaaSPlanTier;
  amountTzs: number;
  paymentMethod: 'M-Pesa' | 'Tigo Pesa' | 'Airtel Money' | 'CRDB Bank' | 'NMB Bank' | 'Selcom';
  reference: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  billingCycle: 'monthly' | 'quarterly' | 'annual';
}

export interface PlatformBroadcast {
  id: string;
  title: string;
  message: string;
  targetAudience: 'all' | 'pharmacy' | 'hardware' | 'restaurant' | 'retail' | 'service';
  targetRegion: string;
  channel: 'in_app' | 'sms' | 'both';
  sentAt: string;
  sentBy: string;
  deliveryCount: number;
  status: 'sent' | 'scheduled' | 'draft';
}

export interface PlatformOperator {
  id: string;
  name: string;
  email: string;
  role: 'Super Administrator' | 'Compliance Officer' | 'Billing Specialist' | 'Technical Support Lead';
  lastActive: string;
  status: 'active' | 'inactive';
  permissions: string[];
  phone: string;
}

export interface SystemTelemetryLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  service: 'TRA-EFD-Bridge' | 'SMS-Gateway' | 'Subscription-Engine' | 'Auth-Security' | 'Offline-Sync-Relay';
  message: string;
  tenantId?: string;
  tenantName?: string;
  details?: string;
}

export interface GeoLocationSalesInsight {
  locationName: string; // e.g. 'Kariakoo', 'Sinza', 'Mikocheni', 'Kinondoni', 'Mwenge', 'Ilala', 'Tegeta', 'Temeke'
  region: string; // e.g. 'Dar es Salaam', 'Arusha', 'Dodoma'
  totalRevenue: number;
  totalUnitsSold: number;
  activeCustomerCount: number;
  topSellingProductId: string;
  topSellingProductName: string;
  topSellingProductRevenue: number;
  lowestSellingProductId: string;
  lowestSellingProductName: string;
  lowestSellingProductRevenue: number;
  averageOrderValue: number;
  penetrationScore: number; // 0 - 100
  dominantCustomerType: string;
  lat?: number;
  lng?: number;
}

export interface CustomerProductCrossMetric {
  customerId: string;
  customerName: string;
  customerLocation: string;
  customerTier: 'Gold' | 'Silver' | 'Bronze';
  productId: string;
  productName: string;
  productCategory: string;
  unitsBought: number;
  totalSpent: number;
  lastBoughtDate: string;
  isBestSellerForCustomer: boolean;
  isLowestSellerForCustomer: boolean;
  isUnpurchasedGap: boolean;
  recommendedAction: string;
}

export interface AIProductCustomerGeoAnalysis {
  executiveSummarySw: string;
  executiveSummaryEn: string;
  topGrowthLocations: {
    location: string;
    keyProducts: string[];
    topCustomer: string;
    rationale: string;
  }[];
  underperformingGaps: {
    location: string;
    laggingProduct: string;
    affectedCustomers: string[];
    fixStrategy: string;
  }[];
  crossSellOpportunities: {
    customerName: string;
    location: string;
    currentFavorite: string;
    recommendedCrossSell: string;
    estimatedRevenueGain: number;
  }[];
  generatedAt: string;
}


