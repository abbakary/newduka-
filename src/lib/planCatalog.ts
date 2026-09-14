import type { PublicPlan, SaaSPlan, SaaSPlanTier } from '@/types/v1';

/** Same features on every package — only branch count & price differ. */
export const SHARED_PLAN_FEATURES = [
  'POS & barcode scanning',
  'Inventory & stock alerts',
  'Customer CRM',
  'TRA EFD receipts',
  'Staff roles (RBAC)',
  'Reports & analytics',
  'AI business insights',
  'Offline POS mode',
] as const;

export const SHARED_PLAN_FEATURES_SW = [
  'POS na barcode',
  'Hifadhi na arifa za stoo',
  'CRM ya wateja',
  'Risiti TRA EFD',
  'Mamlaka za wafanyakazi (RBAC)',
  'Ripoti na uchambuzi',
  'Ushauri wa AI',
  'POS bila mtandao',
] as const;

export const SHARED_MAX_STAFF = 15;
export const SHARED_MAX_PRODUCTS = 99999;

type TierSpec = {
  id: string;
  tier: SaaSPlanTier;
  name: string;
  nameSw: string;
  tagEn: string;
  tagSw: string;
  priceMonthlyTzs: number;
  priceYearlyTzs: number;
  maxBranches: number;
  popular?: boolean;
};

const TIER_SPECS: TierSpec[] = [
  {
    id: 'plan-starter',
    tier: 'starter',
    name: 'Plan 1 — Starter',
    nameSw: 'Mpango 1 — Starter',
    tagEn: '1 branch — single shop',
    tagSw: 'Tawi 1 — duka moja',
    priceMonthlyTzs: 49000,
    priceYearlyTzs: 490000,
    maxBranches: 1,
    popular: false,
  },
  {
    id: 'plan-pro',
    tier: 'biashara_pro',
    name: 'Plan 2 — Biashara Pro',
    nameSw: 'Mpango 2 — Biashara Pro',
    tagEn: '2 branches — growing business',
    tagSw: 'Matawi 2 — biashara inayokua',
    priceMonthlyTzs: 99000,
    priceYearlyTzs: 990000,
    maxBranches: 2,
    popular: true,
  },
  {
    id: 'plan-enterprise',
    tier: 'enterprise_chain',
    name: 'Plan 3 — Enterprise',
    nameSw: 'Mpango 3 — Biashara Kubwa',
    tagEn: '3 branches — store chain',
    tagSw: 'Matawi 3 — minyororo ya maduka',
    priceMonthlyTzs: 249000,
    priceYearlyTzs: 2490000,
    maxBranches: 3,
    popular: false,
  },
];

function withSharedFields(spec: TierSpec): PublicPlan {
  return {
    ...spec,
    maxStaff: SHARED_MAX_STAFF,
    maxProducts: SHARED_MAX_PRODUCTS,
    features: [...SHARED_PLAN_FEATURES],
    featuresSw: [...SHARED_PLAN_FEATURES_SW],
    contactUs: false,
    activeSubscribersCount: 0,
  };
}

export function buildDefaultPublicPlans(): PublicPlan[] {
  return TIER_SPECS.map(withSharedFields);
}

export function buildDefaultSaasPlans(): SaaSPlan[] {
  return buildDefaultPublicPlans().map(({ id, tier, name, priceMonthlyTzs, priceYearlyTzs, maxBranches, maxStaff, maxProducts, features, popular, activeSubscribersCount }) => ({
    id,
    tier,
    name,
    priceMonthlyTzs,
    priceYearlyTzs,
    maxBranches,
    maxStaff,
    maxProducts,
    features,
    popular,
    activeSubscribersCount,
  }));
}
