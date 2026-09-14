export type UserRole = 'super_admin' | 'vendor_owner' | 'vendor_staff';
export type BusinessType = 'pharmacy' | 'retail' | 'hardware' | 'restaurant' | 'service';
export type Language = 'sw' | 'en';

export interface StaffPermissions {
  canSellPOS: boolean;
  canGiveCredit: boolean;
  canModifyInventory: boolean;
  canViewProfitReports: boolean;
  canManageSuppliers: boolean;
  canApproveDiscounts: boolean;
  canVoidReceipts: boolean;
  canPerformDailyClosing: boolean;
  canAccessSuperAdmin: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  tenant_id?: string;
  business_name?: string;
  business_type?: BusinessType;
  staff_role?: string;
  branch?: string;
  permissions: StaffPermissions;
  language: Language;
  status: 'approved' | 'pending' | 'rejected';
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  barcode?: string;
  price: number;
  cost: number;
  stock: number;
  reorder_point: number;
  unit: string;
  batch_number?: string;
  expiry_date?: string;
  requires_prescription: boolean;
  business_type: BusinessType;
  metadata_json: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  credit_limit: number;
  balance: number;
  loyalty_tier: string;
  loyalty_points: number;
  dunning_stage: string;
  created_at: string;
}

export interface SaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Payment {
  method: string;
  amount: number;
  reference?: string;
}

export interface Sale {
  id: string;
  receipt_number: string;
  customer_id?: string;
  customer_name?: string;
  items: SaleItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  paid_amount: number;
  balance_remaining: number;
  payments: Payment[];
  sale_type: string;
  cashier_name: string;
  tra_efd_signature?: string;
  status: string;
  created_at: string;
}

export interface DashboardStats {
  today_revenue: number;
  today_sales_count: number;
  total_products: number;
  low_stock_count: number;
  expiring_soon_count: number;
  total_customers: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  monthly_revenue: number;
  top_products: Array<Record<string, unknown>>;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
}

export type PaymentMethod = 'cash' | 'mpesa' | 'airtel' | 'tigopesa' | 'card' | 'credit';
