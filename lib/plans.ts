/**
 * Single Source of Truth for AQARI Terminal Plans, Feature Gating & 30-Day Licensing
 * Used identically by backend API routes (/api/*) and frontend components (src/*)
 */

export type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise';

export type GatedFeature =
  | 'basicMetrics'
  | 'yieldSensitivity'
  | 'crossBorderMatrixFull'
  | 'saveProperty'
  | 'monteCarlo'
  | 'pdfExport'
  | 'portfolioAggregation'
  | 'apiAccess'
  | 'analystDesk'
  | 'customUnderwriting';

export interface PlanDefinition {
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  originalPrice: number;
  launchPrice: number;
  priceUSD: number;
  analysesLimit: number; // 3 for Free, 30 for Starter, 150 for Pro, 400 for Sovereign
  savedLimit: number; // 0 for Free, 50 for Starter, 200 for Professional, Infinity for Sovereign
  licensingDays: number;
  features: string[];
  hiddenFeatures: string[];
  capabilities: Record<GatedFeature, boolean>;
}

export interface DynamicPlanPublic {
  id?: PlanKey;
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  originalPrice: number;
  launchPrice: number;
  activePrice: number;
  analyses?: number;
  analysesLimit: number;
  saved?: number | null;
  savedLimit: number | null; // null = Unlimited
  features: string[];
  launchDiscountActive?: boolean;
}

export interface PricingPublicPayload {
  success?: boolean;
  launchDiscountActive: boolean;
  launchBadgeText: string;
  launchEndsAt: number;
  daysRemaining: number;
  updatedAt: number;
  plans: DynamicPlanPublic[] | Record<PlanKey, DynamicPlanPublic>;
  plansMap?: Record<PlanKey, DynamicPlanPublic>;
}

export function findPlanPricing(
  payload: PricingPublicPayload | null | undefined,
  key: PlanKey
): DynamicPlanPublic | undefined {
  if (!payload) return undefined;
  if (payload.plansMap && payload.plansMap[key]) return payload.plansMap[key];
  if (Array.isArray(payload.plans)) {
    return payload.plans.find((p) => p.key === key || p.id === key);
  }
  return payload.plans?.[key];
}

export const PRODUCTION_URL = 'https://aqari-ai-rho.vercel.app';
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_LAUNCH_BADGE = 'LAUNCH -40% - First 30 users only';

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    displayName: 'FREE',
    originalPrice: 0,
    launchPrice: 0,
    priceUSD: 0,
    analysesLimit: 3,
    savedLimit: 0,
    licensingDays: 30,
    features: ['3 Analyses / 30 Days', 'Basic Cap Rate', 'Cash-on-Cash only'],
    hiddenFeatures: [
      'Monte Carlo Stress Tests',
      'PDF Memorandum Export',
      'REST API Credentials',
      '1-on-1 Dedicated Analyst Desk',
      'Multi-asset Portfolio Aggregation',
      'Cross-border Tax & Visa Matrix (Full)',
    ],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: false,
      crossBorderMatrixFull: false,
      saveProperty: false,
      monteCarlo: false,
      pdfExport: false,
      portfolioAggregation: false,
      apiAccess: false,
      analystDesk: false,
      customUnderwriting: false,
    },
  },
  starter: {
    key: 'starter',
    displayName: 'STARTER',
    originalPrice: 129,
    launchPrice: 79,
    priceUSD: 79,
    analysesLimit: 30,
    savedLimit: 50,
    licensingDays: 30,
    features: [
      '30 Analyses / 30 Days',
      'Yield & Sensitivity Calculator',
      'Cross-border Tax & Visa Matrix',
      'Save 50',
    ],
    hiddenFeatures: [
      'Monte Carlo Stress Tests +200bps',
      'PDF Memorandum Export',
      'Multi-asset Portfolio Aggregation',
      'Full REST API Credentials',
    ],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: true,
      crossBorderMatrixFull: true,
      saveProperty: true,
      monteCarlo: false,
      pdfExport: false,
      portfolioAggregation: false,
      apiAccess: false,
      analystDesk: false,
      customUnderwriting: false,
    },
  },
  pro: {
    key: 'pro',
    displayName: 'PROFESSIONAL',
    originalPrice: 349,
    launchPrice: 199,
    priceUSD: 199,
    analysesLimit: 150,
    savedLimit: 200,
    licensingDays: 30,
    features: [
      '150 Analyses / 30 Days',
      'Monte Carlo Stress Tests +200bps',
      'PDF Memorandum Export',
      'Multi-asset Portfolio Aggregation',
      'Yield & Sensitivity Calculator',
      'Cross-border Tax & Visa Matrix',
      'Save 200',
    ],
    hiddenFeatures: [
      'Full REST API Credentials',
      '1-on-1 Dedicated Analyst Desk',
      'White-glove Custom Underwriting',
    ],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: true,
      crossBorderMatrixFull: true,
      saveProperty: true,
      monteCarlo: true,
      pdfExport: true,
      portfolioAggregation: true,
      apiAccess: false,
      analystDesk: false,
      customUnderwriting: false,
    },
  },
  enterprise: {
    key: 'enterprise',
    displayName: 'SOVEREIGN',
    originalPrice: 999,
    launchPrice: 599,
    priceUSD: 599,
    analysesLimit: 400,
    savedLimit: Infinity,
    licensingDays: 30,
    features: [
      '400 Analyses / 30 Days',
      'Full REST API Credentials',
      '1-on-1 Dedicated Analyst Desk',
      'White-glove Custom Underwriting',
      'Monte Carlo Stress Tests +200bps',
      'PDF Memorandum Export',
      'Multi-asset Portfolio Aggregation',
      'Yield & Sensitivity Calculator',
      'Cross-border Tax & Visa Matrix',
      'Unlimited Saved',
    ],
    hiddenFeatures: [],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: true,
      crossBorderMatrixFull: true,
      saveProperty: true,
      monteCarlo: true,
      pdfExport: true,
      portfolioAggregation: true,
      apiAccess: true,
      analystDesk: true,
      customUnderwriting: true,
    },
  },
};

export function normalizePlanKey(raw?: string | null): PlanKey {
  const val = (raw || '').toLowerCase().trim();
  if (val === 'starter' || val === 'standard') return 'starter';
  if (val === 'pro' || val === 'professional') return 'pro';
  if (val === 'enterprise' || val === 'sovereign' || val === 'agency') return 'enterprise';
  return 'free';
}

export function getPlanConfig(raw?: string | null): PlanDefinition {
  return PLANS[normalizePlanKey(raw)];
}

export function canUseFeature(plan: string | null | undefined, feature: GatedFeature): boolean {
  return Boolean(getPlanConfig(plan).capabilities[feature]);
}

export function getUpgradeMessage(feature: GatedFeature): string {
  switch (feature) {
    case 'monteCarlo':
    case 'pdfExport':
    case 'portfolioAggregation':
      return 'Upgrade to Professional to unlock';
    case 'apiAccess':
    case 'analystDesk':
    case 'customUnderwriting':
      return 'Upgrade to Sovereign to unlock';
    case 'saveProperty':
      return 'Upgrade to save more';
    case 'yieldSensitivity':
    case 'crossBorderMatrixFull':
      return 'Upgrade to Starter to unlock';
    default:
      return 'Upgrade to Professional to unlock';
  }
}

export interface ComputedLicenseStatus {
  planKey: PlanKey;
  displayName: PlanDefinition['displayName'];
  isExpired: boolean;
  daysLeft: number;
  daysTotal: number;
  analysesLimit: number;
  analysesUsed: number;
  analysesLeft: number;
  savedLimit: number;
  isUnlimitedAnalyses: boolean;
  isUnlimitedSaved: boolean;
  progressPct: number;
  sidebarText: string;
}

export function computeLicenseStatus(params: {
  plan?: string | null;
  licenseStart?: number | null;
  licenseEnd?: number | null;
  analysesUsed?: number;
  freeAnalysesLeft?: number;
  analysesLeft?: number;
  analysesLimitOverride?: number;
  savedLimitOverride?: number;
  now?: number;
}): ComputedLicenseStatus {
  const now = params.now ?? Date.now();
  const rawPlanKey = normalizePlanKey(params.plan);
  const hasPaidEnd = Boolean(rawPlanKey !== 'free' && params.licenseEnd);
  const isExpired = Boolean(hasPaidEnd && params.licenseEnd! <= now);

  // If expired, treat effective plan as FREE
  const effectivePlanKey: PlanKey = isExpired ? 'free' : rawPlanKey;
  const planCfg = PLANS[effectivePlanKey];
  const effectiveAnalysesLimit =
    typeof params.analysesLimitOverride === 'number' && params.analysesLimitOverride > 0
      ? params.analysesLimitOverride
      : planCfg.analysesLimit;
  const effectiveSavedLimit =
    typeof params.savedLimitOverride === 'number'
      ? params.savedLimitOverride
      : planCfg.savedLimit;

  const isUnlimitedAnalyses = !Number.isFinite(effectiveAnalysesLimit);
  const isUnlimitedSaved = !Number.isFinite(effectiveSavedLimit);

  let daysLeft = 30;
  if (effectivePlanKey !== 'free' && params.licenseEnd) {
    daysLeft = Math.max(0, Math.ceil((params.licenseEnd - now) / (1000 * 60 * 60 * 24)));
  } else if (isExpired) {
    daysLeft = 0;
  }

  let analysesUsed = Math.max(0, params.analysesUsed ?? 0);
  let analysesLeft = isUnlimitedAnalyses
    ? Infinity
    : Math.max(0, effectiveAnalysesLimit - analysesUsed);

  // Reconcile if explicit remaining credits were passed and analysesUsed was 0
  if (!isUnlimitedAnalyses) {
    const explicitLeft =
      effectivePlanKey === 'free'
        ? params.freeAnalysesLeft
        : params.analysesLeft ?? params.freeAnalysesLeft;
    if (typeof explicitLeft === 'number' && analysesUsed === 0 && explicitLeft <= effectiveAnalysesLimit) {
      analysesLeft = Math.max(0, explicitLeft);
      analysesUsed = Math.max(0, effectiveAnalysesLimit - analysesLeft);
    }
  }

  const timeProgress =
    effectivePlanKey !== 'free' && params.licenseEnd
      ? Math.min(100, Math.max(0, Math.round((daysLeft / 30) * 100)))
      : isUnlimitedAnalyses
      ? 100
      : Math.min(100, Math.max(0, Math.round((analysesLeft / effectiveAnalysesLimit) * 100)));

  const leftStr = isUnlimitedAnalyses ? 'Unlimited analyses left' : `${analysesLeft} analyses left`;
  const sidebarText = `LICENSING COUNTDOWN - ${planCfg.displayName} - ${daysLeft} days left - ${leftStr}`;

  return {
    planKey: effectivePlanKey,
    displayName: planCfg.displayName,
    isExpired,
    daysLeft,
    daysTotal: 30,
    analysesLimit: effectiveAnalysesLimit,
    analysesUsed,
    analysesLeft,
    savedLimit: effectiveSavedLimit,
    isUnlimitedAnalyses,
    isUnlimitedSaved,
    progressPct: timeProgress,
    sidebarText,
  };
}
