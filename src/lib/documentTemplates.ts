export type DocumentType = 'invoice' | 'delivery_note' | 'order_note';

export type TemplateLayout = 'classic' | 'modern' | 'corporate' | 'minimal';

export interface TemplateTheme {
  primary: string;
  secondary: string;
  accent: string;
  cardBg: string;
  headerStyle: 'bar' | 'wave' | 'sidebar' | 'brush';
}

export interface DocumentTemplate {
  id: string;
  documentType: DocumentType;
  name: string;
  nameSw: string;
  description: string;
  descriptionSw: string;
  theme: TemplateTheme;
  layout: TemplateLayout;
  isBuiltIn: boolean;
  version: number;
}

export interface DocumentBranding {
  logoUrl: string;
  companyName: string;
  footerText: string;
  watermark: string;
  address: string;
  phone: string;
  tinNumber: string;
}

export interface TenantDocumentConfig {
  activeTemplateIds: Record<DocumentType, string>;
  branding: DocumentBranding;
  customTemplates: DocumentTemplate[];
  updatedAt: string;
}

const mk = (
  id: string,
  documentType: DocumentType,
  name: string,
  nameSw: string,
  description: string,
  descriptionSw: string,
  theme: TemplateTheme,
  layout: TemplateLayout,
): DocumentTemplate => ({
  id,
  documentType,
  name,
  nameSw,
  description,
  descriptionSw,
  theme,
  layout,
  isBuiltIn: true,
  version: 1,
});

export const BUILT_IN_TEMPLATES: DocumentTemplate[] = [
  // ── Delivery Note (4) ─────────────────────────────────────────────
  mk('dn-classic-teal', 'delivery_note', 'Classic Teal Header', 'Kichwa cha Teal',
    'Dark teal header band with itemized grid table.', 'Kichwa cha teal na jedwali la bidhaa.',
    { primary: '#0F766E', secondary: '#134E4A', accent: '#F59E0B', cardBg: '#FEF3C7', headerStyle: 'bar' }, 'classic'),
  mk('dn-minimal-blue', 'delivery_note', 'Minimal Blue Grid', 'Grid ya Bluu Rahisi',
    'Clean white layout with blue accents and signature block.', 'Muundo safi wa bluu na sehemu ya saini.',
    { primary: '#2563EB', secondary: '#1E40AF', accent: '#93C5FD', cardBg: '#DBEAFE', headerStyle: 'minimal' }, 'minimal'),
  mk('dn-corporate-wave', 'delivery_note', 'Corporate Wave', 'Wimbi la Kampuni',
    'Navy wave header with order meta fields and teal rows.', 'Kichwa cha navy na maelezo ya agizo.',
    { primary: '#1E3A5F', secondary: '#0EA5E9', accent: '#14B8A6', cardBg: '#CCFBF1', headerStyle: 'wave' }, 'corporate'),
  mk('dn-modern-beige', 'delivery_note', 'Modern Beige', 'Beige ya Kisasa',
    'Beige boutique style with subtotal/tax/total breakdown.', 'Mtindo wa beige na jumla ya kodi.',
    { primary: '#115E59', secondary: '#D97706', accent: '#F5F5DC', cardBg: '#FEF9C3', headerStyle: 'sidebar' }, 'modern'),

  // ── Order Note (4) ────────────────────────────────────────────────
  mk('on-warm-classic', 'order_note', 'Warm Classic', 'Classic ya Joto',
    'Peach/tan accents with traditional order summary table.', 'Rangi za peach na jedwali la agizo.',
    { primary: '#EA580C', secondary: '#FDBA74', accent: '#FEF3C7', cardBg: '#FFEDD5', headerStyle: 'bar' }, 'classic'),
  mk('on-creative-curve', 'order_note', 'Creative Curve', 'Curve ya Ubunifu',
    'Teal curved sidebar with centered delivery note title.', 'Upande wa teal na kichwa cha agizo.',
    { primary: '#0D9488', secondary: '#1E3A8A', accent: '#99F6E4', cardBg: '#ECFEFF', headerStyle: 'sidebar' }, 'modern'),
  mk('on-navy-corporate', 'order_note', 'Navy Corporate', 'Navy ya Kampuni',
    'Dark navy header with teal-filled table headers.', 'Kichwa cha navy na jedwali la teal.',
    { primary: '#1E293B', secondary: '#0EA5E9', accent: '#14B8A6', cardBg: '#E0F2FE', headerStyle: 'wave' }, 'corporate'),
  mk('on-minimal-grid', 'order_note', 'Minimal Grid', 'Grid Rahisi',
    'Navy sidebar with structured delivery-to fields.', 'Sidebar ya navy na sehemu ya mteja.',
    { primary: '#1E40AF', secondary: '#64748B', accent: '#CBD5E1', cardBg: '#F1F5F9', headerStyle: 'sidebar' }, 'minimal'),

  // ── Invoice Note (4) ──────────────────────────────────────────────
  mk('inv-minimal-round', 'invoice', 'Minimal Rounded', 'Rounded Rahisi',
    'Yellow/grey circular accents with clean item grid.', 'Midundo ya manjano na grid safi.',
    { primary: '#CA8A04', secondary: '#374151', accent: '#FDE047', cardBg: '#FEFCE8', headerStyle: 'brush' }, 'minimal'),
  mk('inv-artistic-brush', 'invoice', 'Artistic Brush', 'Brush ya Sanaa',
    'Brushstroke header in teal or navy with bold INVOICE title.', 'Kichwa cha brush na INVOICE kubwa.',
    { primary: '#0F766E', secondary: '#1E293B', accent: '#F5F5DC', cardBg: '#ECFEFF', headerStyle: 'brush' }, 'modern'),
  mk('inv-professional-grid', 'invoice', 'Professional Grid', 'Grid ya Kitaalamu',
    'Orange or teal structured grid with highlighted totals.', 'Grid ya rangi na jumla iliyoangaziwa.',
    { primary: '#EA580C', secondary: '#0D9488', accent: '#FED7AA', cardBg: '#FFF7ED', headerStyle: 'bar' }, 'classic'),
  mk('inv-tech-corporate', 'invoice', 'Tech Corporate', 'Tech ya Kampuni',
    'Blue wave graphics with QR code slot and signature.', 'Mawimbi ya bluu, QR na saini.',
    { primary: '#2563EB', secondary: '#1E293B', accent: '#60A5FA', cardBg: '#EFF6FF', headerStyle: 'wave' }, 'corporate'),
];

export const DEFAULT_ACTIVE_TEMPLATES: Record<DocumentType, string> = {
  delivery_note: 'dn-classic-teal',
  order_note: 'on-warm-classic',
  invoice: 'inv-minimal-round',
};

export const DEFAULT_BRANDING: DocumentBranding = {
  logoUrl: '',
  companyName: '',
  footerText: 'Thank you for your business — Asante kwa biashara yako',
  watermark: '',
  address: '',
  phone: '',
  tinNumber: '',
};

const STORAGE_PREFIX = 'dukamkononi_document_templates_';

export function storageKeyForDocumentTemplates(tenantId?: string | null): string {
  return `${STORAGE_PREFIX}${tenantId || 'default'}`;
}

export function defaultTenantDocumentConfig(businessName?: string): TenantDocumentConfig {
  return {
    activeTemplateIds: { ...DEFAULT_ACTIVE_TEMPLATES },
    branding: { ...DEFAULT_BRANDING, companyName: businessName || '' },
    customTemplates: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadTenantDocumentConfig(
  tenantId?: string | null,
  businessName?: string,
): TenantDocumentConfig {
  const defaults = defaultTenantDocumentConfig(businessName);
  try {
    const raw = localStorage.getItem(storageKeyForDocumentTemplates(tenantId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TenantDocumentConfig>;
    return {
      ...defaults,
      ...parsed,
      activeTemplateIds: { ...defaults.activeTemplateIds, ...parsed.activeTemplateIds },
      branding: { ...defaults.branding, ...parsed.branding },
      customTemplates: parsed.customTemplates ?? [],
    };
  } catch {
    return defaults;
  }
}

export function saveTenantDocumentConfig(
  tenantId: string | null | undefined,
  config: TenantDocumentConfig,
): void {
  localStorage.setItem(
    storageKeyForDocumentTemplates(tenantId),
    JSON.stringify({ ...config, updatedAt: new Date().toISOString() }),
  );
}

export function allTemplatesForTenant(config: TenantDocumentConfig): DocumentTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...config.customTemplates];
}

export function templatesByType(
  documentType: DocumentType,
  config: TenantDocumentConfig,
): DocumentTemplate[] {
  return allTemplatesForTenant(config).filter(t => t.documentType === documentType);
}

export function getActiveTemplate(
  documentType: DocumentType,
  config: TenantDocumentConfig,
): DocumentTemplate {
  const id = config.activeTemplateIds[documentType];
  return (
    allTemplatesForTenant(config).find(t => t.id === id) ??
    BUILT_IN_TEMPLATES.find(t => t.documentType === documentType)!
  );
}

export interface DocumentLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  unit?: string;
}

export interface DocumentRenderData {
  documentType: DocumentType;
  documentNumber: string;
  date: string;
  customerName: string;
  customerAddress?: string;
  items: DocumentLineItem[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
  showDiscount: boolean;
  notes?: string;
  /** Override header title (e.g. Goods Received Note, Payslip). */
  titleOverride?: string;
  /** Override party block label (default Customer / Mteja). */
  partyLabel?: string;
  /** Override price column header (default Price / Bei). */
  priceColumnLabel?: string;
  /** Override discount row label. */
  discountLabel?: string;
  /** Hide VAT row on procurement / internal docs. */
  hideVat?: boolean;
  /** Hide signature block. */
  hideSignature?: boolean;
  /** Credit/partial — amount already paid at POS. */
  amountPaid?: number;
  /** Credit/partial — outstanding balance. */
  balanceDue?: number;
  /** ISO date when balance is due. */
  paymentDueDate?: string;
}

export function documentTypeLabel(type: DocumentType, isSw: boolean): string {
  const map: Record<DocumentType, [string, string]> = {
    delivery_note: ['Delivery Note', 'Noti ya Uwasilishaji'],
    order_note: ['Order Note', 'Noti ya Agizo'],
    invoice: ['Invoice Note', 'Noti ya Ankara'],
  };
  return isSw ? map[type][1] : map[type][0];
}

export function documentTypePurpose(type: DocumentType, isSw: boolean): string {
  const map: Record<DocumentType, [string, string]> = {
    delivery_note: [
      'Issued when goods are dispatched to the customer.',
      'Inatolewa bidhaa zinapotumwa kwa mteja.',
    ],
    order_note: [
      'Summarizes customer orders before fulfillment.',
      'Inaonyesha muhtasari wa agizo kabla ya utoaji.',
    ],
    invoice: [
      'Records confirmed sales and payment details.',
      'Inarekodi mauzo yaliyothibitishwa na malipo.',
    ],
  };
  return isSw ? map[type][1] : map[type][0];
}
