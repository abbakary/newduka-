import type { Language, SaaSPlan, SaaSPlanTier } from '@/types/v1';
import { buildDefaultPublicPlans } from '@/lib/planCatalog';

const STORAGE_KEY = 'duka_saas_plans_v1';

export interface PublicPlan extends SaaSPlan {
  nameSw: string;
  tagEn: string;
  tagSw: string;
  contactUs?: boolean;
  featuresSw: string[];
}

/** Three paid tiers — same features; branch count & price differ. */
export const DEFAULT_PUBLIC_PLANS: PublicPlan[] = buildDefaultPublicPlans();

export function loadPublicPlans(): PublicPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PUBLIC_PLANS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PUBLIC_PLANS;
    const cleaned = parsed
      .filter((p): p is PublicPlan => Boolean(p && typeof p === 'object' && p.tier && p.tier !== 'free_starter' && p.id))
      .map(p => ({
        ...p,
        name: String(p.name ?? ''),
        nameSw: String(p.nameSw ?? p.name ?? ''),
        features: Array.isArray(p.features) ? p.features : [],
        featuresSw: Array.isArray(p.featuresSw) ? p.featuresSw : [],
      }));
    return cleaned.length ? cleaned : DEFAULT_PUBLIC_PLANS;
  } catch {
    return DEFAULT_PUBLIC_PLANS;
  }
}

export function savePublicPlans(plans: PublicPlan[]): void {
  const safe = plans.filter((p): p is PublicPlan => Boolean(p && p.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe.length ? safe : DEFAULT_PUBLIC_PLANS));
}

/** Normalize API / wrapped payloads into plan objects. */
export function unwrapPlansPayload(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nested = obj.items ?? obj.plans ?? obj.data;
    if (Array.isArray(nested)) {
      return nested.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
    }
  }
  return [];
}

export function mapApiPlan(raw: Record<string, unknown> | null | undefined): PublicPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id != null ? String(raw.id) : '';
  if (!id) return null;
  const tier = raw.tier === 'free_starter' ? 'starter' : (raw.tier as PublicPlan['tier']);
  return {
    id,
    tier: tier || 'starter',
    name: String(raw.name ?? ''),
    nameSw: String(raw.name_sw ?? raw.name ?? ''),
    priceMonthlyTzs: Number(raw.price_monthly_tzs ?? 0),
    priceYearlyTzs: Number(raw.price_yearly_tzs ?? 0),
    maxBranches: Number(raw.max_branches ?? 1),
    maxStaff: Number(raw.max_staff ?? 3),
    maxProducts: Number(raw.max_products ?? 500),
    features: Array.isArray(raw.features) ? (raw.features as string[]) : [],
    featuresSw: Array.isArray(raw.features_sw) ? (raw.features_sw as string[]) : [],
    tagEn: String(raw.tag_en ?? ''),
    tagSw: String(raw.tag_sw ?? ''),
    contactUs: Boolean(raw.contact_us),
    popular: Boolean(raw.popular),
    activeSubscribersCount: Number(raw.active_subscribers_count ?? 0),
  };
}

export function mapApiPlans(raw: unknown): PublicPlan[] {
  return unwrapPlansPayload(raw)
    .map(mapApiPlan)
    .filter((p): p is PublicPlan => Boolean(p?.id));
}

export function mapApiPlanToPatch(patch: Partial<PublicPlan>, isSw?: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined && !isSw) out.name = patch.name;
  if (patch.nameSw !== undefined || (isSw && patch.name !== undefined)) out.name_sw = patch.nameSw ?? patch.name;
  if (patch.tagEn !== undefined) out.tag_en = patch.tagEn;
  if (patch.tagSw !== undefined) out.tag_sw = patch.tagSw;
  if (patch.priceMonthlyTzs !== undefined) out.price_monthly_tzs = patch.priceMonthlyTzs;
  if (patch.priceYearlyTzs !== undefined) out.price_yearly_tzs = patch.priceYearlyTzs;
  if (patch.maxBranches !== undefined) out.max_branches = patch.maxBranches;
  if (patch.maxStaff !== undefined) out.max_staff = patch.maxStaff;
  if (patch.maxProducts !== undefined) out.max_products = patch.maxProducts;
  if (patch.features !== undefined) out.features = patch.features;
  if (patch.featuresSw !== undefined) out.features_sw = patch.featuresSw;
  if (patch.contactUs !== undefined) out.contact_us = patch.contactUs;
  if (patch.popular !== undefined) out.popular = patch.popular;
  return out;
}

export function formatPlanPrice(plan: PublicPlan | null | undefined, isSw: boolean): string {
  if (!plan) return isSw ? '—' : '—';
  if (plan.contactUs) return isSw ? 'Maalum' : 'Custom';
  return `TZS ${plan.priceMonthlyTzs.toLocaleString('en-TZ')}`;
}

export function planPeriod(isSw: boolean): string {
  return isSw ? '/mwezi' : '/mo';
}

export function planBranchLabel(plan: Pick<SaaSPlan, 'maxBranches'>, isSw: boolean): string {
  const n = plan.maxBranches;
  if (isSw) return n === 1 ? 'Tawi 1' : `Matawi ${n}`;
  return n === 1 ? '1 branch' : `${n} branches`;
}

export function planLabel(tier: SaaSPlanTier, isSw: boolean, plans = loadPublicPlans()): string {
  const normalized = tier === 'free_starter' ? 'starter' : tier;
  const p = plans.find(x => x.tier === normalized);
  if (!p) return normalized;
  return isSw ? p.nameSw : p.name;
}

export function planFeatures(plan: PublicPlan, lang: Language): string[] {
  return lang === 'sw' ? plan.featuresSw : plan.features;
}

export type PaymentStatus = 'paid' | 'unpaid' | 'overdue' | 'trial' | 'grace';

export function derivePaymentStatus(expiry: string, status: string): PaymentStatus {
  if (status === 'suspended') return 'overdue';
  if (status === 'grace_period') return 'grace';
  if (status === 'pending_kyc') return 'trial';
  if (!expiry) return 'unpaid';
  const exp = new Date(expiry);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  if (exp >= now) return 'paid';
  const daysPast = (now.getTime() - exp.getTime()) / 86400000;
  if (daysPast <= 7) return 'grace';
  return 'overdue';
}

export function paymentStatusLabel(s: PaymentStatus, isSw: boolean): string {
  const map: Record<PaymentStatus, [string, string]> = {
    paid: ['Paid', 'Imelipwa'],
    unpaid: ['Unpaid', 'Haijalipwa'],
    overdue: ['Overdue', 'Imechelewa'],
    trial: ['Trial / KYC', 'Jaribio / KYC'],
    grace: ['Grace period', 'Muda wa rehema'],
  };
  return isSw ? map[s][1] : map[s][0];
}

export function paymentStatusTone(s: PaymentStatus): string {
  switch (s) {
    case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'unpaid': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'overdue': return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'trial': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'grace': return 'bg-orange-100 text-orange-800 border-orange-200';
  }
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function normalizePlanTier(tier?: string | null): SaaSPlanTier {
  if (!tier || tier === 'free_starter') return 'starter';
  return tier as SaaSPlanTier;
}
