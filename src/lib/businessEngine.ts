/**
 * Duka+ Business-Type Engine
 * Business Type → Configuration → Taxonomy → Workplace → Navigation → Dashboard → Forms
 */

export type BusinessType =
  | 'pharmacy' | 'supermarket' | 'retail' | 'hardware' | 'electronics'
  | 'auto_parts' | 'fashion' | 'agrovet' | 'beauty' | 'salon'
  | 'restaurant' | 'stationery' | 'furniture' | 'service' | 'mixed';

export type BusinessPrimaryMode = 'pharmacy' | 'retail' | 'inventory' | 'restaurant' | 'service' | 'specialized' | 'hybrid';
export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'textarea';

export interface ProductFieldSchema {
  key: string;
  label_en: string;
  label_sw: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  /** Named preset list — see productFieldPresets.ts */
  preset?: string;
  /** Parent field key for cascading dropdowns (e.g. vehicle_model → vehicle_make) */
  dependsOn?: string;
  /** Allow "Other" free-text when preset/select is used */
  allowCustom?: boolean;
  placeholder_en?: string;
  placeholder_sw?: string;
  metadata?: boolean;
}

export interface TaxonomySubgroup { name_en: string; name_sw: string }
export interface TaxonomyGroup {
  name_en: string;
  name_sw: string;
  subgroups?: TaxonomySubgroup[];
}
export interface TaxonomyMain {
  name_en: string;
  name_sw: string;
  groups?: TaxonomyGroup[];
}

export interface NavItemConfig {
  id: string;
  label_en: string;
  label_sw: string;
  tab: string;
  icon?: string;
  feature?: string;
  module?: string;
}

export interface DashboardWidgetConfig {
  id: string;
  label_en: string;
  label_sw: string;
  feature?: string;
  priority: number;
}

export interface BusinessFeatures {
  batch_tracking: boolean;
  expiry_alerts: boolean;
  barcode_scan: boolean;
  fractional_units: boolean;
  table_management: boolean;
  appointments: boolean;
  serial_tracking: boolean;
  vehicle_compatibility: boolean;
  recipes: boolean;
  variants: boolean;
  prescriptions: boolean;
  quotations: boolean;
  commissions: boolean;
}

export interface BusinessProfileConfig {
  id: BusinessType;
  label_en: string;
  label_sw: string;
  icon: string;
  primary_mode: BusinessPrimaryMode;
  taxonomy_levels: 1 | 2 | 3 | 4;
  taxonomy: TaxonomyMain[];
  product_fields: ProductFieldSchema[];
  default_units: string[];
  inventory_title_en: string;
  inventory_title_sw: string;
  pos_title_en: string;
  pos_title_sw: string;
  nav_extra: NavItemConfig[];
  sidebar_extra: NavItemConfig[];
  dashboard_widgets: DashboardWidgetConfig[];
  features: BusinessFeatures;
  modules: string[];
  compliance: string[];
  allow_custom_taxonomy: boolean;
}

const BASE_FEATURES: BusinessFeatures = {
  batch_tracking: false, expiry_alerts: false, barcode_scan: false,
  fractional_units: false, table_management: false, appointments: false,
  serial_tracking: false, vehicle_compatibility: false, recipes: false,
  variants: false, prescriptions: false, quotations: false, commissions: false,
};

const PHARMACY_TAXONOMY: TaxonomyMain[] = [
  { name_en: 'Medicines', name_sw: 'Dawa', groups: [
    { name_en: 'Antibiotics', name_sw: 'Antibiotics', subgroups: [
      { name_en: 'Penicillins', name_sw: 'Penicillins' }, { name_en: 'Macrolides', name_sw: 'Macrolides' },
    ]},
    { name_en: 'Painkillers & Analgesics', name_sw: 'Dawa za Maumivu', subgroups: [{ name_en: 'Paracetamol', name_sw: 'Paracetamol' }] },
    { name_en: 'Antimalarials', name_sw: 'Dawa za Malaria' },
    { name_en: 'Antihistamines', name_sw: 'Antihistamines' },
    { name_en: 'Vitamins & Supplements', name_sw: 'Vitamini na Virutubisho' },
  ]},
  { name_en: 'Medical Supplies', name_sw: 'Vifaa Tiba' },
  { name_en: 'Personal Care', name_sw: 'Utunzaji Binafsi' },
  { name_en: 'Baby Care', name_sw: 'Huduma ya Watoto' },
  { name_en: 'Diagnostics', name_sw: 'Vipimo' },
  { name_en: 'First Aid', name_sw: 'Huduma ya Kwanza' },
];

const SUPERMARKET_TAXONOMY: TaxonomyMain[] = [
  { name_en: 'Food Basket', name_sw: 'Chakula', groups: [
    { name_en: 'Rice', name_sw: 'Mchele' }, { name_en: 'Pasta & Noodles', name_sw: 'Pasta na Tambi' },
    { name_en: 'Cereals', name_sw: 'Nafaka' }, { name_en: 'Cooking Oil', name_sw: 'Mafuta ya Kupikia' },
    { name_en: 'Spices', name_sw: 'Viungo' }, { name_en: 'Snacks', name_sw: 'Vitafunwa' },
  ]},
  { name_en: 'Drinks', name_sw: 'Vinywaji' },
  { name_en: 'Fresh Foods', name_sw: 'Chakula Bichi' },
  { name_en: 'Chilled & Frozen', name_sw: 'Baridi na Kufungwa', groups: [
    { name_en: 'Dairy', name_sw: 'Maziwa' }, { name_en: 'Frozen Meat', name_sw: 'Nyama Iliyofungwa' },
  ]},
  { name_en: 'Milk & Juices', name_sw: 'Maziwa na Juices' },
  { name_en: 'Bakery', name_sw: 'Mkate' },
  { name_en: 'Health & Beauty', name_sw: 'Afya na Urembo' },
  { name_en: 'Household', name_sw: 'Nyumbani' },
  { name_en: 'Baby Products', name_sw: 'Bidhaa za Watoto' },
  { name_en: 'Pets', name_sw: 'Wanyama wa Kipenzi' },
];

const HARDWARE_TAXONOMY: TaxonomyMain[] = [
  { name_en: 'Building Materials', name_sw: 'Nyenzo za Ujenzi' },
  { name_en: 'Cement & Concrete', name_sw: 'Saruji na Zege' },
  { name_en: 'Plumbing', name_sw: 'Bomba', groups: [
    { name_en: 'Pipes', name_sw: 'Bomba', subgroups: [
      { name_en: 'PVC', name_sw: 'PVC' }, { name_en: 'PPR', name_sw: 'PPR' }, { name_en: 'HDPE', name_sw: 'HDPE' },
    ]},
    { name_en: 'Fittings', name_sw: 'Viunganishi' },
    { name_en: 'Valves', name_sw: 'Valves' },
  ]},
  { name_en: 'Electrical', name_sw: 'Umeme' },
  { name_en: 'Paints & Coatings', name_sw: 'Rangi' },
  { name_en: 'Tools', name_sw: 'Vifaa vya Kazi' },
  { name_en: 'Fasteners', name_sw: 'Visigo' },
  { name_en: 'Timber & Boards', name_sw: 'Mbao' },
  { name_en: 'Sanitary Ware', name_sw: 'Vifaa vya Bafu' },
];

const PHARMACY_FIELDS: ProductFieldSchema[] = [
  { key: 'generic_name', label_en: 'Generic Name', label_sw: 'Jina la Kijeneriki', type: 'text', metadata: true, placeholder_en: 'e.g. Paracetamol', placeholder_sw: 'mf. Paracetamol' },
  { key: 'brand_name', label_en: 'Brand Name', label_sw: 'Chapa', type: 'text', metadata: true },
  { key: 'strength', label_en: 'Strength', label_sw: 'Nguvu', type: 'text', metadata: true, placeholder_en: 'e.g. 500mg', placeholder_sw: 'mf. 500mg' },
  { key: 'dosage_form', label_en: 'Dosage Form', label_sw: 'Umbo la Dozi', type: 'select', preset: 'dosage_forms', allowCustom: true, metadata: true },
  { key: 'batch_number', label_en: 'Batch Number', label_sw: 'Nambari ya Batch', type: 'text' },
  { key: 'expiry_date', label_en: 'Expiry Date', label_sw: 'Tarehe ya Mwisho', type: 'date' },
  { key: 'requires_prescription', label_en: 'Prescription Required', label_sw: 'Inahitaji Dawa ya Daktari', type: 'boolean' },
  { key: 'manufacturer', label_en: 'Manufacturer', label_sw: 'Mtengenezaji', type: 'select', preset: 'pharma_manufacturers', allowCustom: true, metadata: true },
  { key: 'storage_condition', label_en: 'Storage', label_sw: 'Hali ya Kuhifadhi', type: 'select', preset: 'storage_conditions', allowCustom: true, metadata: true },
];

export const BUSINESS_ENGINE: Record<BusinessType, BusinessProfileConfig> = {
  pharmacy: {
    id: 'pharmacy', label_en: 'Pharmacy', label_sw: 'Duka la Dawa', icon: '💊',
    primary_mode: 'pharmacy', taxonomy_levels: 4, taxonomy: PHARMACY_TAXONOMY,
    product_fields: PHARMACY_FIELDS,
    default_units: ['tablets', 'capsules', 'bottles', 'sachets', 'boxes'],
    inventory_title_en: 'Medicines & Health Products', inventory_title_sw: 'Dawa na Bidhaa za Afya',
    pos_title_en: 'Dispense & Sell', pos_title_sw: 'Uza Dawa',
    nav_extra: [
      { id: 'prescriptions', label_en: 'Prescriptions', label_sw: 'Dawa za Rx', tab: 'workplace-prescriptions' },
    ],
    sidebar_extra: [
      { id: 'batch-expiry', label_en: 'Batch & Expiry', label_sw: 'Batch & Mwisho', tab: 'inventory', feature: 'batch_tracking' },
    ],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'expiring_soon', label_en: 'Expiring Soon', label_sw: 'Zinakaribia Kuisha', feature: 'expiry_alerts', priority: 2 },
      { id: 'low_stock', label_en: 'Low Stock', label_sw: 'Akiba Chini', priority: 3 },
      { id: 'top_medicines', label_en: 'Top Medicines', label_sw: 'Dawa Zinazoongoza', priority: 4 },
      { id: 'credit', label_en: 'Credit', label_sw: 'Madeni', priority: 5 },
    ],
    features: { ...BASE_FEATURES, batch_tracking: true, expiry_alerts: true, barcode_scan: true, prescriptions: true },
    modules: ['inventory', 'batch_expiry', 'prescriptions', 'pos', 'suppliers', 'customers', 'credit'],
    compliance: ['TMDA', 'Pharmacy Council', 'TRA EFD'],
    allow_custom_taxonomy: true,
  },
  supermarket: {
    id: 'supermarket', label_en: 'Supermarket', label_sw: 'Supermarket', icon: '🏬',
    primary_mode: 'retail', taxonomy_levels: 3, taxonomy: SUPERMARKET_TAXONOMY,
    product_fields: [
      { key: 'barcode', label_en: 'Barcode', label_sw: 'Barcode', type: 'text' },
      { key: 'brand', label_en: 'Brand', label_sw: 'Chapa', type: 'select', preset: 'supermarket_brands', allowCustom: true, metadata: true },
      { key: 'weight', label_en: 'Weight', label_sw: 'Uzito', type: 'select', preset: 'weight_units', allowCustom: true, metadata: true },
      { key: 'expiry_date', label_en: 'Expiry Date', label_sw: 'Mwisho', type: 'date' },
      { key: 'batch_number', label_en: 'Batch', label_sw: 'Batch', type: 'text' },
    ],
    default_units: ['pcs', 'kg', 'g', 'liters', 'cartons', 'packs'],
    inventory_title_en: 'Supermarket Catalog', inventory_title_sw: 'Orodha ya Supermarket',
    pos_title_en: 'Checkout POS', pos_title_sw: 'POS ya Malipo',
    nav_extra: [{ id: 'barcodes', label_en: 'Barcodes', label_sw: 'Barcode', tab: 'workplace-barcodes' }],
    sidebar_extra: [{ id: 'promotions', label_en: 'Promotions', label_sw: 'Matangazo', tab: 'reports' }],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'transactions', label_en: 'Transactions', label_sw: 'Miamala', priority: 2 },
      { id: 'fast_moving', label_en: 'Fast Moving', label_sw: 'Zinazouzika Haraka', priority: 3 },
      { id: 'slow_moving', label_en: 'Slow Moving', label_sw: 'Zinazolala', priority: 4 },
    ],
    features: { ...BASE_FEATURES, barcode_scan: true, expiry_alerts: true, batch_tracking: true },
    modules: ['inventory', 'pos', 'promotions', 'suppliers', 'customers'],
    compliance: ['TRA EFD', 'TFDA'],
    allow_custom_taxonomy: true,
  },
  retail: {
    id: 'retail', label_en: 'General Retail / Duka', label_sw: 'Rejareja / Duka', icon: '🛒',
    primary_mode: 'retail', taxonomy_levels: 2,
    taxonomy: [
      { name_en: 'Food & Groceries', name_sw: 'Chakula' }, { name_en: 'Beverages', name_sw: 'Vinywaji' },
      { name_en: 'Household', name_sw: 'Nyumbani' }, { name_en: 'Personal Care', name_sw: 'Utunzaji Binafsi' },
      { name_en: 'Electronics', name_sw: 'Vifaa vya Umeme' }, { name_en: 'Clothing', name_sw: 'Nguo' },
      { name_en: 'Stationery', name_sw: 'Vifaa vya Ofisi' }, { name_en: 'Other', name_sw: 'Nyingine' },
    ],
    product_fields: [{ key: 'barcode', label_en: 'Barcode', label_sw: 'Barcode', type: 'text' }],
    default_units: ['pcs', 'pairs', 'packs', 'cartons'],
    inventory_title_en: 'Product Catalog', inventory_title_sw: 'Orodha ya Bidhaa',
    pos_title_en: 'Point of Sale', pos_title_sw: 'Uza Bidhaa',
    nav_extra: [{ id: 'barcodes', label_en: 'Barcodes', label_sw: 'Barcode', tab: 'workplace-barcodes' }],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'low_stock', label_en: 'Low Stock', label_sw: 'Akiba Chini', priority: 2 },
      { id: 'top_products', label_en: 'Top Products', label_sw: 'Bidhaa Bora', priority: 3 },
    ],
    features: { ...BASE_FEATURES, barcode_scan: true, expiry_alerts: true, variants: true },
    modules: ['inventory', 'pos', 'customers', 'suppliers'],
    compliance: ['TRA EFD', 'BRELA'],
    allow_custom_taxonomy: true,
  },
  hardware: {
    id: 'hardware', label_en: 'Hardware & Building', label_sw: 'Vifaa vya Ujenzi', icon: '🔧',
    primary_mode: 'inventory', taxonomy_levels: 4, taxonomy: HARDWARE_TAXONOMY,
    product_fields: [
      { key: 'size', label_en: 'Size', label_sw: 'Ukubwa', type: 'select', preset: 'pipe_sizes', allowCustom: true, metadata: true },
      { key: 'length', label_en: 'Length', label_sw: 'Urefu', type: 'text', metadata: true, placeholder_en: 'e.g. 3m', placeholder_sw: 'mf. 3m' },
      { key: 'diameter', label_en: 'Diameter', label_sw: 'Kipenyo', type: 'text', metadata: true },
      { key: 'material', label_en: 'Material', label_sw: 'Nyenzo', type: 'select', preset: 'hardware_materials', allowCustom: true, metadata: true },
      { key: 'brand', label_en: 'Brand', label_sw: 'Chapa', type: 'select', preset: 'hardware_brands', allowCustom: true, metadata: true },
      { key: 'min_order_qty', label_en: 'Min Order Qty', label_sw: 'Kiwango cha Chini', type: 'number', metadata: true },
    ],
    default_units: ['pcs', 'meters', 'kg', 'bags', 'liters', 'sheets', 'rolls'],
    inventory_title_en: 'Hardware & Materials', inventory_title_sw: 'Vifaa na Nyenzo',
    pos_title_en: 'Hardware POS', pos_title_sw: 'Uza Vifaa',
    nav_extra: [
      { id: 'fractional', label_en: 'Fractional Units', label_sw: 'Vipimo', tab: 'workplace-fractional' },
      { id: 'quotations', label_en: 'Quotations', label_sw: 'Makadirio', tab: 'workplace-quotations' },
    ],
    sidebar_extra: [{ id: 'quotations', label_en: 'Quotations', label_sw: 'Makadirio', tab: 'receivables-payables', feature: 'quotations' }],
    dashboard_widgets: [
      { id: 'sales', label_en: 'Sales', label_sw: 'Mauzo', priority: 1 },
      { id: 'stock_value', label_en: 'Stock Value', label_sw: 'Thamani ya Akiba', priority: 2 },
      { id: 'low_stock', label_en: 'Low Stock', label_sw: 'Akiba Chini', priority: 3 },
      { id: 'supplier_payables', label_en: 'Supplier Payables', label_sw: 'Madeni ya Wasambazaji', priority: 4 },
    ],
    features: { ...BASE_FEATURES, barcode_scan: true, fractional_units: true, quotations: true },
    modules: ['inventory', 'quotations', 'suppliers', 'customers', 'credit'],
    compliance: ['TRA EFD'],
    allow_custom_taxonomy: true,
  },
  electronics: {
    id: 'electronics', label_en: 'Electronics & Phones', label_sw: 'Vifaa vya Umeme / Simu', icon: '📱',
    primary_mode: 'specialized', taxonomy_levels: 3,
    taxonomy: [
      { name_en: 'Mobile Phones', name_sw: 'Simu', groups: [
        { name_en: 'Android', name_sw: 'Android' }, { name_en: 'iPhone', name_sw: 'iPhone' },
      ]},
      { name_en: 'Tablets', name_sw: 'Tableti' },
      { name_en: 'Chargers & Cables', name_sw: 'Chaja na Cable' },
      { name_en: 'Phone Accessories', name_sw: 'Vifaa vya Simu' },
      { name_en: 'Audio', name_sw: 'Sauti' },
      { name_en: 'Computers', name_sw: 'Kompyuta' },
      { name_en: 'Home Appliances', name_sw: 'Vifaa vya Nyumbani' },
    ],
    product_fields: [
      { key: 'brand', label_en: 'Brand', label_sw: 'Chapa', type: 'select', preset: 'phone_brands', allowCustom: true, metadata: true },
      { key: 'model', label_en: 'Model', label_sw: 'Modeli', type: 'text', metadata: true, placeholder_en: 'e.g. Galaxy A15', placeholder_sw: 'mf. Galaxy A15' },
      { key: 'imei', label_en: 'IMEI', label_sw: 'IMEI', type: 'text', metadata: true },
      { key: 'serial_number', label_en: 'Serial Number', label_sw: 'Serial', type: 'text', metadata: true },
      { key: 'ram', label_en: 'RAM', label_sw: 'RAM', type: 'select', preset: 'ram_sizes', allowCustom: true, metadata: true },
      { key: 'storage', label_en: 'Storage', label_sw: 'Hifadhi', type: 'select', preset: 'storage_sizes', allowCustom: true, metadata: true },
      { key: 'color', label_en: 'Color', label_sw: 'Rangi', type: 'select', preset: 'fashion_colors', allowCustom: true, metadata: true },
      { key: 'warranty_months', label_en: 'Warranty (months)', label_sw: 'Dhamana (miezi)', type: 'select', preset: 'salon_durations', allowCustom: true, metadata: true },
    ],
    default_units: ['pcs', 'sets'],
    inventory_title_en: 'Electronics Catalog', inventory_title_sw: 'Orodha ya Vifaa vya Umeme',
    pos_title_en: 'Electronics POS', pos_title_sw: 'POS ya Elektroniki',
    nav_extra: [
      { id: 'serial-numbers', label_en: 'Serial Numbers', label_sw: 'Serial Numbers', tab: 'workplace-serial-numbers' },
      { id: 'warranty', label_en: 'Warranty', label_sw: 'Dhamana', tab: 'workplace-warranty' },
    ],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'warranty_expiring', label_en: 'Warranty Expiring', label_sw: 'Dhamana Inaisha', feature: 'serial_tracking', priority: 2 },
      { id: 'low_stock', label_en: 'Low Stock', label_sw: 'Akiba Chini', priority: 3 },
    ],
    features: { ...BASE_FEATURES, barcode_scan: true, serial_tracking: true },
    modules: ['inventory', 'serial_tracking', 'warranty', 'repairs', 'pos'],
    compliance: ['TRA EFD'],
    allow_custom_taxonomy: true,
  },
  auto_parts: {
    id: 'auto_parts', label_en: 'Auto Spare Parts', label_sw: 'Vipuri vya Magari', icon: '🚗',
    primary_mode: 'specialized', taxonomy_levels: 3,
    taxonomy: [
      { name_en: 'Engine Parts', name_sw: 'Sehemu za Injini', groups: [
        { name_en: 'Pistons', name_sw: 'Pistons' }, { name_en: 'Gaskets', name_sw: 'Gaskets' }, { name_en: 'Timing', name_sw: 'Timing' },
      ]},
      { name_en: 'Brake System', name_sw: 'Mfumo wa Breki' },
      { name_en: 'Suspension', name_sw: 'Suspension' },
      { name_en: 'Electrical', name_sw: 'Umeme' },
      { name_en: 'Filters & Fluids', name_sw: 'Vichujio na Mafuta' },
      { name_en: 'Body Parts', name_sw: 'Sehemu za Mwili' },
      { name_en: 'Tyres & Rims', name_sw: 'Tairi na Rimu' },
    ],
    product_fields: [
      { key: 'vehicle_make', label_en: 'Vehicle Make', label_sw: 'Chapa ya Gari', type: 'select', preset: 'vehicle_makes', allowCustom: true, metadata: true },
      { key: 'vehicle_model', label_en: 'Vehicle Model', label_sw: 'Modeli ya Gari', type: 'select', preset: 'vehicle_models', dependsOn: 'vehicle_make', allowCustom: true, metadata: true },
      { key: 'year_from', label_en: 'Year From', label_sw: 'Mwaka Kuanzia', type: 'select', preset: 'years', metadata: true },
      { key: 'year_to', label_en: 'Year To', label_sw: 'Mwaka Hadi', type: 'select', preset: 'years', metadata: true },
      { key: 'oem_number', label_en: 'OEM Number', label_sw: 'Nambari OEM', type: 'text', metadata: true, placeholder_en: 'e.g. 04465-02220', placeholder_sw: 'mf. 04465-02220' },
      { key: 'part_number', label_en: 'Part Number', label_sw: 'Nambari ya Sehemu', type: 'text', metadata: true },
      { key: 'position', label_en: 'Position', label_sw: 'Mahali', type: 'select', preset: 'part_positions', allowCustom: true, metadata: true },
    ],
    default_units: ['pcs', 'sets', 'pairs'],
    inventory_title_en: 'Spare Parts Catalog', inventory_title_sw: 'Orodha ya Vipuri',
    pos_title_en: 'Parts Sales', pos_title_sw: 'Uza Vipuri',
    nav_extra: [
      { id: 'vehicle-compat', label_en: 'Vehicle Compatibility', label_sw: 'Ulinganifu wa Gari', tab: 'workplace-vehicle-compat' },
      { id: 'workshop', label_en: 'Workshop', label_sw: 'Kibanda cha Kazi', tab: 'workplace-workshop' },
    ],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'sales', label_en: 'Sales', label_sw: 'Mauzo', priority: 1 },
      { id: 'top_parts', label_en: 'Top Parts', label_sw: 'Vipuri Vinavyouzika', priority: 2 },
      { id: 'low_stock', label_en: 'Low Stock', label_sw: 'Akiba Chini', priority: 3 },
    ],
    features: { ...BASE_FEATURES, vehicle_compatibility: true, barcode_scan: true },
    modules: ['inventory', 'vehicle_compatibility', 'workshop', 'credit'],
    compliance: ['TRA EFD'],
    allow_custom_taxonomy: true,
  },
  fashion: {
    id: 'fashion', label_en: 'Clothing & Fashion', label_sw: 'Nguo na Mitindo', icon: '👗',
    primary_mode: 'retail', taxonomy_levels: 3,
    taxonomy: [
      { name_en: 'Men', name_sw: 'Wanaume', groups: [{ name_en: 'Shirts', name_sw: 'Mashati' }, { name_en: 'Trousers', name_sw: 'Suruali' }] },
      { name_en: 'Women', name_sw: 'Wanawake' },
      { name_en: 'Kids', name_sw: 'Watoto' },
      { name_en: 'Shoes', name_sw: 'Viatu' },
      { name_en: 'Accessories', name_sw: 'Vifaa' },
    ],
    product_fields: [
      { key: 'size', label_en: 'Size', label_sw: 'Ukubwa', type: 'select', preset: 'fashion_sizes', allowCustom: true, metadata: true },
      { key: 'color', label_en: 'Color', label_sw: 'Rangi', type: 'select', preset: 'fashion_colors', allowCustom: true, metadata: true },
      { key: 'material', label_en: 'Material', label_sw: 'Nyenzo', type: 'select', preset: 'fashion_materials', allowCustom: true, metadata: true },
      { key: 'brand', label_en: 'Brand', label_sw: 'Chapa', type: 'text', metadata: true },
    ],
    default_units: ['pcs', 'pairs', 'sets'],
    inventory_title_en: 'Fashion Catalog', inventory_title_sw: 'Orodha ya Mitindo',
    pos_title_en: 'Fashion POS', pos_title_sw: 'POS ya Nguo',
    nav_extra: [{ id: 'variants', label_en: 'Size & Color Variants', label_sw: 'Variants', tab: 'workplace-variants' }],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'top_styles', label_en: 'Top Styles', label_sw: 'Mitindo Inayoongoza', priority: 2 },
    ],
    features: { ...BASE_FEATURES, variants: true, barcode_scan: true },
    modules: ['inventory', 'variants', 'pos'],
    compliance: ['TRA EFD'],
    allow_custom_taxonomy: true,
  },
  agrovet: {
    id: 'agrovet', label_en: 'Agrovet', label_sw: 'Agrovet', icon: '🌾',
    primary_mode: 'specialized', taxonomy_levels: 3,
    taxonomy: [
      { name_en: 'Seeds', name_sw: 'Mbegu', groups: [{ name_en: 'Maize', name_sw: 'Mahindi' }, { name_en: 'Vegetable Seeds', name_sw: 'Mbegu za Mboga' }] },
      { name_en: 'Fertilizers', name_sw: 'Mbolea' },
      { name_en: 'Pesticides', name_sw: 'Dawa za Wadudu' },
      { name_en: 'Veterinary Medicines', name_sw: 'Dawa za Mifugo', groups: [
        { name_en: 'Antibiotics', name_sw: 'Antibiotics' }, { name_en: 'Dewormers', name_sw: 'Dawa za Minyoo' }, { name_en: 'Vaccines', name_sw: 'Chanjo' },
      ]},
      { name_en: 'Animal Feeds', name_sw: 'Chakula cha Mifugo' },
      { name_en: 'Farm Equipment', name_sw: 'Vifaa vya Shamba' },
    ],
    product_fields: [
      { key: 'crop', label_en: 'Crop', label_sw: 'Zao', type: 'select', preset: 'agrovet_crops', allowCustom: true, metadata: true },
      { key: 'animal_type', label_en: 'Animal Type', label_sw: 'Aina ya Mnyama', type: 'select', preset: 'agrovet_animals', allowCustom: true, metadata: true },
      { key: 'batch_number', label_en: 'Batch', label_sw: 'Batch', type: 'text' },
      { key: 'expiry_date', label_en: 'Expiry', label_sw: 'Mwisho', type: 'date' },
      { key: 'registration', label_en: 'Registration No.', label_sw: 'Nambari ya Usajili', type: 'text', metadata: true },
    ],
    default_units: ['bags', 'kg', 'liters', 'bottles', 'sachets'],
    inventory_title_en: 'Agrovet Inventory', inventory_title_sw: 'Akiba ya Agrovet',
    pos_title_en: 'Agrovet POS', pos_title_sw: 'POS ya Agrovet',
    nav_extra: [{ id: 'batch-expiry', label_en: 'Batch & Expiry', label_sw: 'Batch & Mwisho', tab: 'workplace-batch-expiry' }],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'expiring_soon', label_en: 'Expiring Soon', label_sw: 'Zinakaribia Kuisha', feature: 'expiry_alerts', priority: 2 },
    ],
    features: { ...BASE_FEATURES, batch_tracking: true, expiry_alerts: true },
    modules: ['inventory', 'batch_expiry', 'pos'],
    compliance: ['TFDA', 'TRA EFD'],
    allow_custom_taxonomy: true,
  },
  beauty: {
    id: 'beauty', label_en: 'Beauty & Cosmetics', label_sw: 'Urembo na Cosmetics', icon: '💄',
    primary_mode: 'retail', taxonomy_levels: 3,
    taxonomy: [
      { name_en: 'Skincare', name_sw: 'Utunzaji wa Ngozi' },
      { name_en: 'Haircare', name_sw: 'Utunzaji wa Nywele', groups: [
        { name_en: 'Shampoo', name_sw: 'Shampoo' }, { name_en: 'Conditioner', name_sw: 'Conditioner' }, { name_en: 'Hair Colour', name_sw: 'Rangi ya Nywele' },
      ]},
      { name_en: 'Makeup', name_sw: 'Makeup' },
      { name_en: 'Fragrance', name_sw: 'Manukato' },
      { name_en: 'Hygiene', name_sw: 'Usafi' },
    ],
    product_fields: [
      { key: 'brand', label_en: 'Brand', label_sw: 'Chapa', type: 'select', preset: 'beauty_brands', allowCustom: true, metadata: true },
      { key: 'batch_number', label_en: 'Batch', label_sw: 'Batch', type: 'text' },
      { key: 'expiry_date', label_en: 'Expiry', label_sw: 'Mwisho', type: 'date' },
    ],
    default_units: ['pcs', 'bottles', 'tubes', 'packs'],
    inventory_title_en: 'Beauty Products', inventory_title_sw: 'Bidhaa za Urembo',
    pos_title_en: 'Beauty POS', pos_title_sw: 'POS ya Urembo',
    nav_extra: [],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'top_products', label_en: 'Top Products', label_sw: 'Bidhaa Bora', priority: 2 },
    ],
    features: { ...BASE_FEATURES, expiry_alerts: true, barcode_scan: true },
    modules: ['inventory', 'pos', 'services'],
    compliance: ['TRA EFD', 'TFDA'],
    allow_custom_taxonomy: true,
  },
  salon: {
    id: 'salon', label_en: 'Salon / Barbershop', label_sw: 'Saluni / Kinyozi', icon: '💇',
    primary_mode: 'service', taxonomy_levels: 2,
    taxonomy: [
      { name_en: 'Hair', name_sw: 'Nywele', groups: [
        { name_en: 'Haircut', name_sw: 'Kukata Nywele' }, { name_en: 'Braiding', name_sw: 'Suka' }, { name_en: 'Styling', name_sw: 'Styling' },
      ]},
      { name_en: 'Nails', name_sw: 'Kucha', groups: [{ name_en: 'Manicure', name_sw: 'Manicure' }, { name_en: 'Pedicure', name_sw: 'Pedicure' }] },
      { name_en: 'Beauty', name_sw: 'Urembo', groups: [{ name_en: 'Facial', name_sw: 'Facial' }, { name_en: 'Makeup', name_sw: 'Makeup' }] },
    ],
    product_fields: [
      { key: 'duration_minutes', label_en: 'Duration (min)', label_sw: 'Muda (dakika)', type: 'select', preset: 'salon_durations', allowCustom: true, metadata: true },
      { key: 'commission_rate', label_en: 'Commission %', label_sw: 'Kamisheni %', type: 'number', metadata: true },
      { key: 'assigned_staff', label_en: 'Assigned Staff', label_sw: 'Mfanyakazi', type: 'text', metadata: true },
    ],
    default_units: ['service', 'session', 'hour'],
    inventory_title_en: 'Salon Products & Supplies', inventory_title_sw: 'Bidhaa za Saluni',
    pos_title_en: 'Service Billing', pos_title_sw: 'Toa Huduma',
    nav_extra: [
      { id: 'appointments', label_en: 'Appointments', label_sw: 'Miadi', tab: 'workplace-appointments' },
      { id: 'commissions', label_en: 'Commissions', label_sw: 'Kamisheni', tab: 'workplace-commissions' },
    ],
    sidebar_extra: [{ id: 'commissions', label_en: 'Commissions', label_sw: 'Kamisheni', tab: 'expenses-payroll', feature: 'commissions' }],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'appointments', label_en: 'Appointments', label_sw: 'Miadi', feature: 'appointments', priority: 2 },
      { id: 'customers_served', label_en: 'Customers Served', label_sw: 'Wateja Waliohudumiwa', priority: 3 },
      { id: 'top_services', label_en: 'Top Services', label_sw: 'Huduma Bora', priority: 4 },
      { id: 'staff_performance', label_en: 'Staff Performance', label_sw: 'Utendaji wa Wafanyakazi', priority: 5 },
    ],
    features: { ...BASE_FEATURES, appointments: true, commissions: true },
    modules: ['services', 'appointments', 'commissions', 'pos', 'products'],
    compliance: ['TRA EFD', 'BRELA'],
    allow_custom_taxonomy: true,
  },
  restaurant: {
    id: 'restaurant', label_en: 'Restaurant & Cafe', label_sw: 'Mgahawa', icon: '🍽️',
    primary_mode: 'restaurant', taxonomy_levels: 3,
    taxonomy: [
      { name_en: 'Food', name_sw: 'Chakula', groups: [
        { name_en: 'Main Meals', name_sw: 'Chakula Kikuu' }, { name_en: 'Fast Food', name_sw: 'Chakula cha Haraka' },
      ]},
      { name_en: 'Breakfast', name_sw: 'Kifungua Kinywa' },
      { name_en: 'Drinks', name_sw: 'Vinywaji' },
      { name_en: 'Ingredients', name_sw: 'Viungo' },
    ],
    product_fields: [
      { key: 'prep_time_minutes', label_en: 'Prep Time (min)', label_sw: 'Muda wa Kuandaa', type: 'select', preset: 'restaurant_prep', allowCustom: true, metadata: true },
      { key: 'recipe_items', label_en: 'Recipe Items', label_sw: 'Viungo', type: 'textarea', metadata: true },
      { key: 'is_menu_item', label_en: 'Menu Item', label_sw: 'Kipengele cha Menyu', type: 'boolean', metadata: true },
    ],
    default_units: ['plates', 'portions', 'kg', 'liters', 'pcs'],
    inventory_title_en: 'Kitchen Inventory & Ingredients', inventory_title_sw: 'Viungo na Stock ya Jikoni',
    pos_title_en: 'Orders & POS', pos_title_sw: 'Agiza / POS',
    nav_extra: [
      { id: 'reception', label_en: 'Reception', label_sw: 'Mapokezi', tab: 'workplace-reception' },
      { id: 'kitchen', label_en: 'Kitchen KDS', label_sw: 'Jikoni (KDS)', tab: 'workplace-kitchen' },
      { id: 'waiter', label_en: 'Waiter', label_sw: 'Waudum', tab: 'workplace-waiter' },
      { id: 'restaurant-live', label_en: 'Restaurant Live', label_sw: 'Meneja / Live', tab: 'workplace-restaurant-live' },
    ],
    sidebar_extra: [
      { id: 'menu', label_en: 'Menu', label_sw: 'Menyu', tab: 'inventory' },
      { id: 'recipes', label_en: 'Recipes', label_sw: 'Mapishi', tab: 'inventory', feature: 'recipes' },
    ],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'kitchen_orders', label_en: 'Kitchen Orders', label_sw: 'Maagizo ya Jikoni', feature: 'table_management', priority: 2 },
      { id: 'table_occupancy', label_en: 'Table Occupancy', label_sw: 'Meza Zilizojaa', priority: 3 },
    ],
    features: { ...BASE_FEATURES, batch_tracking: true, expiry_alerts: true, fractional_units: true, table_management: true, recipes: true },
    modules: ['restaurant', 'kitchen', 'menu', 'recipes', 'ingredients', 'pos'],
    compliance: ['TRA EFD', 'Food Safety'],
    allow_custom_taxonomy: true,
  },
  stationery: {
    id: 'stationery', label_en: 'Stationery / Bookshop', label_sw: 'Vifaa vya Ofisi / Vitabu', icon: '📚',
    primary_mode: 'retail', taxonomy_levels: 3,
    taxonomy: [
      { name_en: 'Writing Instruments', name_sw: 'Vifaa vya Kuandika', groups: [
        { name_en: 'Ballpoint Pens', name_sw: 'Kalamu' }, { name_en: 'Notebooks', name_sw: 'Daftari' },
      ]},
      { name_en: 'School Supplies', name_sw: 'Vifaa vya Shule' },
      { name_en: 'Office Supplies', name_sw: 'Vifaa vya Ofisi' },
      { name_en: 'Books', name_sw: 'Vitabu' },
    ],
    product_fields: [
      { key: 'isbn', label_en: 'ISBN', label_sw: 'ISBN', type: 'text', metadata: true },
      { key: 'author', label_en: 'Author', label_sw: 'Mwandishi', type: 'text', metadata: true },
      { key: 'barcode', label_en: 'Barcode', label_sw: 'Barcode', type: 'text' },
    ],
    default_units: ['pcs', 'packs', 'boxes', 'reams'],
    inventory_title_en: 'Stationery Catalog', inventory_title_sw: 'Orodha ya Vifaa vya Ofisi',
    pos_title_en: 'Stationery POS', pos_title_sw: 'POS ya Ofisi',
    nav_extra: [],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'top_products', label_en: 'Top Products', label_sw: 'Bidhaa Bora', priority: 2 },
    ],
    features: { ...BASE_FEATURES, barcode_scan: true },
    modules: ['inventory', 'pos'],
    compliance: ['TRA EFD'],
    allow_custom_taxonomy: true,
  },
  furniture: {
    id: 'furniture', label_en: 'Furniture', label_sw: 'Samani', icon: '🪑',
    primary_mode: 'retail', taxonomy_levels: 2,
    taxonomy: [
      { name_en: 'Living Room', name_sw: 'Sebule', groups: [{ name_en: 'Sofas', name_sw: 'Sofa' }, { name_en: 'TV Stands', name_sw: 'TV Stands' }] },
      { name_en: 'Bedroom', name_sw: 'Chumba cha Kulala' },
      { name_en: 'Office Furniture', name_sw: 'Samani za Ofisi' },
      { name_en: 'Mattresses', name_sw: 'Godoro' },
    ],
    product_fields: [
      { key: 'length_cm', label_en: 'Length (cm)', label_sw: 'Urefu (cm)', type: 'number', metadata: true },
      { key: 'width_cm', label_en: 'Width (cm)', label_sw: 'Upana (cm)', type: 'number', metadata: true },
      { key: 'height_cm', label_en: 'Height (cm)', label_sw: 'Kimo (cm)', type: 'number', metadata: true },
      { key: 'material', label_en: 'Material', label_sw: 'Nyenzo', type: 'select', preset: 'furniture_materials', allowCustom: true, metadata: true },
      { key: 'color', label_en: 'Color', label_sw: 'Rangi', type: 'select', preset: 'furniture_colors', allowCustom: true, metadata: true },
      { key: 'delivery_required', label_en: 'Delivery Required', label_sw: 'Inahitaji Usafirishaji', type: 'boolean', metadata: true },
    ],
    default_units: ['pcs', 'sets'],
    inventory_title_en: 'Furniture Catalog', inventory_title_sw: 'Orodha ya Samani',
    pos_title_en: 'Furniture POS', pos_title_sw: 'POS ya Samani',
    nav_extra: [],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'stock_value', label_en: 'Stock Value', label_sw: 'Thamani ya Akiba', priority: 2 },
    ],
    features: { ...BASE_FEATURES, variants: true },
    modules: ['inventory', 'pos', 'delivery'],
    compliance: ['TRA EFD'],
    allow_custom_taxonomy: true,
  },
  service: {
    id: 'service', label_en: 'General Service', label_sw: 'Huduma za Jumla', icon: '💼',
    primary_mode: 'service', taxonomy_levels: 2,
    taxonomy: [
      { name_en: 'Repairs', name_sw: 'Matengenezo' }, { name_en: 'Consultation', name_sw: 'Ushauri' },
      { name_en: 'Supplies', name_sw: 'Vifaa' },
    ],
    product_fields: [
      { key: 'duration_minutes', label_en: 'Duration (min)', label_sw: 'Muda', type: 'number', metadata: true },
      { key: 'commission_rate', label_en: 'Commission %', label_sw: 'Kamisheni %', type: 'number', metadata: true },
    ],
    default_units: ['service', 'hour', 'session'],
    inventory_title_en: 'Service Supplies', inventory_title_sw: 'Vifaa vya Huduma',
    pos_title_en: 'Service Billing', pos_title_sw: 'Toa Huduma',
    nav_extra: [{ id: 'appointments', label_en: 'Appointments', label_sw: 'Miadi', tab: 'workplace-appointments' }],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'appointments', label_en: 'Appointments', label_sw: 'Miadi', feature: 'appointments', priority: 2 },
    ],
    features: { ...BASE_FEATURES, appointments: true },
    modules: ['services', 'appointments', 'pos'],
    compliance: ['TRA EFD', 'BRELA'],
    allow_custom_taxonomy: true,
  },
  mixed: {
    id: 'mixed', label_en: 'Mixed Business', label_sw: 'Biashara Mchanganyiko', icon: '🏢',
    primary_mode: 'hybrid', taxonomy_levels: 2,
    taxonomy: [
      { name_en: 'Products', name_sw: 'Bidhaa' }, { name_en: 'Services', name_sw: 'Huduma' },
      { name_en: 'Other', name_sw: 'Nyingine' },
    ],
    product_fields: [
      { key: 'barcode', label_en: 'Barcode', label_sw: 'Barcode', type: 'text' },
      { key: 'is_service', label_en: 'Is Service', label_sw: 'Ni Huduma', type: 'boolean', metadata: true },
    ],
    default_units: ['pcs', 'service', 'kg', 'hours'],
    inventory_title_en: 'Products & Services', inventory_title_sw: 'Bidhaa na Huduma',
    pos_title_en: 'Sales & Billing', pos_title_sw: 'Mauzo na Malipo',
    nav_extra: [{ id: 'appointments', label_en: 'Appointments', label_sw: 'Miadi', tab: 'workplace-appointments' }],
    sidebar_extra: [],
    dashboard_widgets: [
      { id: 'today_sales', label_en: "Today's Sales", label_sw: 'Mauzo Leo', priority: 1 },
      { id: 'low_stock', label_en: 'Low Stock', label_sw: 'Akiba Chini', priority: 2 },
    ],
    features: { ...BASE_FEATURES, appointments: true, barcode_scan: true, variants: true },
    modules: ['inventory', 'services', 'pos', 'appointments'],
    compliance: ['TRA EFD'],
    allow_custom_taxonomy: true,
  },
};

export const ALL_BUSINESS_TYPES = Object.keys(BUSINESS_ENGINE) as BusinessType[];

/** Business types temporarily unavailable for new registrations. */
export const REGISTRATION_DISABLED_BUSINESS_TYPES: BusinessType[] = ['restaurant'];

export function isBusinessTypeRegistrationDisabled(type?: string | BusinessType): boolean {
  return REGISTRATION_DISABLED_BUSINESS_TYPES.includes((type ?? '') as BusinessType);
}

export function businessTypeUnavailableMessage(isSw: boolean, type?: string | BusinessType): string {
  const profile = type ? getBusinessProfile(type) : null;
  const name = profile ? (isSw ? profile.label_sw : profile.label_en) : isSw ? 'Mkahawa' : 'Restaurant';
  return isSw
    ? `${name} bado haipatikani kwa sasa. Tunafanya kazi kuileta hivi karibuni — tafadhali chagua aina nyingine ya biashara.`
    : `${name} is not available yet. We're working to launch it soon — please choose another business type.`;
}

export function getBusinessProfile(type?: string): BusinessProfileConfig {
  const key = (type as BusinessType) || 'retail';
  return BUSINESS_ENGINE[key] ?? BUSINESS_ENGINE.retail;
}

export function getDefaultWorkplaceTab(type?: string): string {
  const profile = getBusinessProfile(type);
  const first = profile.nav_extra[0];
  if (!first) return 'dashboard';
  return first.tab.startsWith('workplace-') ? first.tab : `workplace-${first.id}`;
}

export function flattenTaxonomy(profile: BusinessProfileConfig): string[] {
  const paths: string[] = [];
  for (const main of profile.taxonomy) {
    paths.push(main.name_en);
    for (const group of main.groups ?? []) {
      paths.push(`${main.name_en} > ${group.name_en}`);
      for (const sub of group.subgroups ?? []) {
        paths.push(`${main.name_en} > ${group.name_en} > ${sub.name_en}`);
      }
    }
  }
  return paths;
}

export function getFlatCategories(type?: string): string[] {
  return flattenTaxonomy(getBusinessProfile(type));
}

export function getMainCategories(type?: string): TaxonomyMain[] {
  return getBusinessProfile(type).taxonomy;
}

export function hasFeature(type: string | undefined, feature: keyof BusinessFeatures): boolean {
  return getBusinessProfile(type).features[feature] ?? false;
}

const PRODUCT_NAME_PLACEHOLDERS: Partial<Record<BusinessType, { en: string; sw: string }>> = {
  pharmacy: { en: 'e.g. Azithromycin 500mg Tablets', sw: 'mf. Azithromycin 500mg' },
  supermarket: { en: 'e.g. Rice 5kg Bag', sw: 'mf. Mchele gunia 5kg' },
  retail: { en: 'e.g. Cooking Oil 1L', sw: 'mf. Mafuta ya kupikia 1L' },
  hardware: { en: 'e.g. PVC Pipe 1/2"', sw: 'mf. Bomba la PVC 1/2"' },
  electronics: { en: 'e.g. Samsung USB-C Charger 25W', sw: 'mf. Chaja Samsung USB-C 25W' },
  auto_parts: { en: 'e.g. Brake Pad Set — Toyota Corolla 2010', sw: 'mf. Brake Pad — Toyota Corolla 2010' },
  fashion: { en: 'e.g. Men Cotton Shirt — Size L', sw: 'mf. Shati la Cotton — Size L' },
  agrovet: { en: 'e.g. Cattle Dewormer 100ml', sw: 'mf. Dawa ya minyoo ng\'ombe 100ml' },
  beauty: { en: 'e.g. Shea Body Lotion 400ml', sw: 'mf. Lotion ya Shea 400ml' },
  salon: { en: 'e.g. Professional Hair Relaxer', sw: 'mf. Relaxer ya nywele' },
  restaurant: { en: 'e.g. Chicken Breast 1kg', sw: 'mf. Kifua cha kuku 1kg' },
  stationery: { en: 'e.g. A4 Copy Paper Ream', sw: 'mf. Karatasi A4 ream' },
  furniture: { en: 'e.g. Office Chair — Ergonomic', sw: 'mf. Kiti cha ofisi' },
  service: { en: 'e.g. AC Servicing Package', sw: 'mf. Huduma ya AC' },
  mixed: { en: 'e.g. Product name', sw: 'mf. Jina la bidhaa' },
};

const SUPPLIER_INDUSTRY_LABELS: Partial<Record<BusinessType, { en: string; sw: string }>> = {
  pharmacy: { en: 'Pharmaceuticals & Medical', sw: 'Dawa na Vifaa Tiba' },
  supermarket: { en: 'FMCG & Groceries', sw: 'Bidhaa za Chakula' },
  retail: { en: 'General Merchandise', sw: 'Bidhaa za Jumla' },
  hardware: { en: 'Building Materials & Hardware', sw: 'Vifaa vya Ujenzi' },
  electronics: { en: 'Electronics & Appliances', sw: 'Vifaa vya Umeme' },
  auto_parts: { en: 'Auto Parts & Components', sw: 'Vipuri vya Magari' },
  fashion: { en: 'Clothing & Fashion', sw: 'Nguo na Mitindo' },
  agrovet: { en: 'Agrovet & Farm Inputs', sw: 'Agrovet na Pembejeo' },
  beauty: { en: 'Beauty & Cosmetics', sw: 'Urembo na Cosmetics' },
  salon: { en: 'Salon & Beauty Supplies', sw: 'Vifaa vya Saluni' },
  restaurant: { en: 'Food & Beverage Supplies', sw: 'Chakula na Vinywaji' },
  stationery: { en: 'Stationery & Office Supplies', sw: 'Vifaa vya Ofisi' },
  furniture: { en: 'Furniture & Furnishings', sw: 'Samani na Mapambo' },
  service: { en: 'Service Providers', sw: 'Watoa Huduma' },
  mixed: { en: 'Mixed Suppliers', sw: 'Wasambazaji Mbalimbali' },
};

export function getProductNamePlaceholder(type?: string, lang: 'sw' | 'en' = 'en'): string {
  const key = (type as BusinessType) || 'retail';
  const entry = PRODUCT_NAME_PLACEHOLDERS[key] ?? PRODUCT_NAME_PLACEHOLDERS.retail!;
  return lang === 'sw' ? entry.sw : entry.en;
}

export function getDefaultMainCategory(type?: string, lang: 'sw' | 'en' = 'en'): string {
  const mains = getMainCategories(type);
  if (!mains.length) return 'General';
  const main = mains[0];
  return lang === 'sw' ? main.name_sw : main.name_en;
}

export function getSupplierIndustryCategory(type?: string, lang: 'sw' | 'en' = 'en'): string {
  const key = (type as BusinessType) || 'retail';
  const entry = SUPPLIER_INDUSTRY_LABELS[key];
  if (entry) return lang === 'sw' ? entry.sw : entry.en;
  const profile = getBusinessProfile(type);
  return lang === 'sw' ? profile.label_sw : profile.label_en;
}

export function getDefaultUnit(type?: string): string {
  return getBusinessProfile(type).default_units[0] ?? 'pcs';
}

/** All packages include the same modules — branch quota is the tier differentiator. */
const ALL_PLAN_FEATURES = [
  'inventory', 'pos', 'branches', 'customers', 'suppliers', 'reports', 'bi', 'settings', 'transfers', 'ai_assistant',
] as const;

export const PLAN_ENTITLEMENTS: Record<string, { max_branches: number; max_users: number; features: string[] }> = {
  starter: { max_branches: 1, max_users: 15, features: [...ALL_PLAN_FEATURES] },
  biashara_pro: { max_branches: 2, max_users: 15, features: [...ALL_PLAN_FEATURES] },
  enterprise_chain: { max_branches: 3, max_users: 15, features: [...ALL_PLAN_FEATURES] },
};

export function planHasFeature(plan: string, feature: string): boolean {
  const normalized = plan === 'free_starter' ? 'starter' : plan;
  const ent = PLAN_ENTITLEMENTS[normalized] ?? PLAN_ENTITLEMENTS.starter;
  return ent.features.includes(feature);
}

export function planAllowsBranches(plan: string): boolean {
  return planHasFeature(plan, 'branches');
}
