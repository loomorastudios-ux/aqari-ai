/**
 * Single Source of Truth for AQARI Terminal Plans, AI Credit Costs, Quotas & 30-Day Licensing
 * Used identically by backend API routes (/api/*) and frontend components (src/*)
 *
 * IMPORTANT: 'enterprise' key is permanently preserved as SOVEREIGN to protect live Paddle checkouts
 * and existing subscribers. The new $2,499 / Launch $1,499 contract tier uses key 'institutional' (ENTERPRISE).
 */

export type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise' | 'institutional';

export type GatedFeature =
  | 'basicMetrics'
  | 'yieldSensitivity'
  | 'crossBorderMatrixFull'
  | 'saveProperty'
  | 'monteCarlo'
  | 'monteCarloAdvanced'
  | 'monteCarlo10k'
  | 'pdfExport'
  | 'memorandumPdf'
  | 'customBrandingPdf'
  | 'whiteLabelReports'
  | 'whiteLabelPlatform'
  | 'dealFinder'
  | 'dealFinderAdvanced'
  | 'forecastBasic'
  | 'forecastAdvanced'
  | 'dueDiligence'
  | 'globalOptimizer'
  | 'institutionalAdvisor'
  | 'portfolioAggregation'
  | 'apiAccess'
  | 'analystDesk'
  | 'customUnderwriting';

export interface PlanQuotas {
  analysesLimit: number;
  savedLimit: number;
  isFairUseSaved: boolean;
  imagePdfLimit: number;
  aiListingLimit: number;
  investmentPdfLimit: number;
  portfolioAssetsLimit: number;
  compareLimit: number;
  teamUsersLimit: number;
  apiDailyLimit: number;
  monteCarloMaxCycles: number;
  whiteLabelMode: 'none' | 'reports' | 'full';
}

export interface PlanDefinition extends PlanQuotas {
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN' | 'ENTERPRISE';
  tierTag?: string;
  originalPrice: number;
  launchPrice: number;
  priceUSD: number;
  licensingDays: number;
  isContractPricing?: boolean;
  features: string[];
  hiddenFeatures: string[];
  capabilities: Record<GatedFeature, boolean>;
}

export interface DynamicPlanPublic {
  id?: PlanKey;
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN' | 'ENTERPRISE';
  tierTag?: string;
  originalPrice: number;
  launchPrice: number;
  activePrice: number;
  analyses?: number;
  analysesLimit: number;
  saved?: number | null;
  savedLimit: number | null;
  isFairUseSaved?: boolean;
  imagePdfLimit?: number;
  aiListingLimit?: number;
  investmentPdfLimit?: number;
  portfolioAssetsLimit?: number;
  compareLimit?: number;
  teamUsersLimit?: number;
  apiDailyLimit?: number;
  monteCarloMaxCycles?: number;
  whiteLabelMode?: 'none' | 'reports' | 'full';
  isContractPricing?: boolean;
  features: string[];
  launchDiscountActive?: boolean;
}

export interface PricingPublicPayload {
  success?: boolean;
  schemaVersion?: number;
  launchDiscountActive: boolean;
  launchBadgeText: string;
  launchEndsAt: number;
  daysRemaining: number;
  updatedAt: number;
  plans: DynamicPlanPublic[] | Record<PlanKey, DynamicPlanPublic>;
  plansMap?: Record<PlanKey, DynamicPlanPublic>;
}

export type CreditActionKey =
  | 'run-analysis'
  | 'find-deals'
  | 'get-forecast'
  | 'export'
  | 'extract-from-file'
  | 'run-file-analysis'
  | 'studio-generate'
  | 'run-due-diligence'
  | 'optimize-portfolio'
  | 'ask-advisor'
  | 'due-diligence-docs'
  | 'scenario-compare';

export const CREDIT_COSTS: Record<CreditActionKey, number> = {
  'run-analysis': 1,
  'find-deals': 1,
  'get-forecast': 1,
  'export': 1,
  'extract-from-file': 1,
  'run-file-analysis': 1,
  'studio-generate': 2,
  'run-due-diligence': 2,
  'optimize-portfolio': 2,
  'ask-advisor': 2,
  'due-diligence-docs': 3,
  'scenario-compare': 0,
};

export interface ExtraCreditPack {
  id: 'pack_25' | 'pack_100' | 'pack_500';
  label: string;
  credits: number;
  priceUSD: number;
  perCreditUSD: string;
  description: string;
}

export const EXTRA_CREDIT_PACKS: ExtraCreditPack[] = [
  {
    id: 'pack_25',
    label: '+25 AI Credits',
    credits: 25,
    priceUSD: 19,
    perCreditUSD: '$0.76',
    description: 'Immediate top-up for extra underwriting, Deal Finder, or OCR extractions.',
  },
  {
    id: 'pack_100',
    label: '+100 AI Credits',
    credits: 100,
    priceUSD: 59,
    perCreditUSD: '$0.59',
    description: 'Active acquisition sprint pack for Due Diligence & Studio workflows.',
  },
  {
    id: 'pack_500',
    label: '+500 AI Credits',
    credits: 500,
    priceUSD: 249,
    perCreditUSD: '$0.50',
    description: 'High-volume credit reserve for teams, portfolios, and multi-doc DD.',
  },
];

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
export const DEFAULT_LAUNCH_BADGE = 'LAUNCH OFFER - First 30 institutional seats';

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    displayName: 'FREE',
    tierTag: 'EXPLORATORY ACCESS',
    originalPrice: 0,
    launchPrice: 0,
    priceUSD: 0,
    analysesLimit: 3,
    savedLimit: 3,
    isFairUseSaved: false,
    imagePdfLimit: 1,
    aiListingLimit: 1,
    investmentPdfLimit: 1,
    portfolioAssetsLimit: 1,
    compareLimit: 1,
    teamUsersLimit: 1,
    apiDailyLimit: 0,
    monteCarloMaxCycles: 0,
    whiteLabelMode: 'none',
    licensingDays: 30,
    features: [
      '3 analyses / 30 days',
      'Basic ROI (Cap + NOI + Cashflow)',
      '1 Image / PDF upload trial',
      '1 AI Listing trial',
      '1 Basic PDF with AQARI watermark',
      'Limited Deal Finder (2 preview deals)',
      'Basic Market intelligence (2 benchmarks)',
      'Demo Portfolio (1 asset)',
      'Save up to 3 properties',
      'No API access',
      'No Monte Carlo simulations',
      'No White Label branding',
    ],
    hiddenFeatures: [
      'Full IRR, DSCR & Waterfall Sensitivity',
      'Monte Carlo Stress Tests',
      'AI Due Diligence & Document Audit',
      'Global Portfolio Optimizer',
      'Institutional AI Advisor',
      'REST API Credentials',
      'White Label Reports',
    ],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: false,
      crossBorderMatrixFull: false,
      saveProperty: true,
      monteCarlo: false,
      monteCarloAdvanced: false,
      monteCarlo10k: false,
      pdfExport: true,
      memorandumPdf: false,
      customBrandingPdf: false,
      whiteLabelReports: false,
      whiteLabelPlatform: false,
      dealFinder: true,
      dealFinderAdvanced: false,
      forecastBasic: false,
      forecastAdvanced: false,
      dueDiligence: false,
      globalOptimizer: false,
      institutionalAdvisor: false,
      portfolioAggregation: false,
      apiAccess: false,
      analystDesk: false,
      customUnderwriting: false,
    },
  },
  starter: {
    key: 'starter',
    displayName: 'STARTER',
    tierTag: 'INDIVIDUAL INVESTOR',
    originalPrice: 129,
    launchPrice: 75,
    priceUSD: 75,
    analysesLimit: 30,
    savedLimit: 30,
    isFairUseSaved: false,
    imagePdfLimit: 5,
    aiListingLimit: 3,
    investmentPdfLimit: 5,
    portfolioAssetsLimit: 10,
    compareLimit: 3,
    teamUsersLimit: 1,
    apiDailyLimit: 0,
    monteCarloMaxCycles: 1000,
    whiteLabelMode: 'none',
    licensingDays: 30,
    features: [
      '30 analyses / 30 days',
      'Full financial (Cap + NOI + DSCR + CoC + IRR)',
      '5 Image / PDF extractions / mo',
      '3 AI Listings / mo',
      '5 Investment PDFs / mo',
      'Deal Finder + Forecast Basic',
      'Market Radar + Cross-Border Basic',
      'Monte Carlo Basic (1,000 cycles)',
      'Portfolio tracker up to 10 assets',
      'Save 30 analyses • Compare 3 scenarios',
      'Email support',
      'No REST API access',
      'No White Label branding',
    ],
    hiddenFeatures: [
      'AI Due Diligence',
      'Global Portfolio Optimizer',
      'Institutional AI Advisor',
      'REST API Credentials',
      'White Label Reports',
    ],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: true,
      crossBorderMatrixFull: true,
      saveProperty: true,
      monteCarlo: true,
      monteCarloAdvanced: false,
      monteCarlo10k: false,
      pdfExport: true,
      memorandumPdf: false,
      customBrandingPdf: false,
      whiteLabelReports: false,
      whiteLabelPlatform: false,
      dealFinder: true,
      dealFinderAdvanced: false,
      forecastBasic: true,
      forecastAdvanced: false,
      dueDiligence: false,
      globalOptimizer: false,
      institutionalAdvisor: false,
      portfolioAggregation: true,
      apiAccess: false,
      analystDesk: false,
      customUnderwriting: false,
    },
  },
  pro: {
    key: 'pro',
    displayName: 'PROFESSIONAL',
    tierTag: 'MAIN MARKETING PLAN',
    originalPrice: 349,
    launchPrice: 199,
    priceUSD: 199,
    analysesLimit: 150,
    savedLimit: 2000,
    isFairUseSaved: true,
    imagePdfLimit: 30,
    aiListingLimit: 20,
    investmentPdfLimit: 30,
    portfolioAssetsLimit: 100,
    compareLimit: 10,
    teamUsersLimit: 2,
    apiDailyLimit: 100,
    monteCarloMaxCycles: 5000,
    whiteLabelMode: 'none',
    licensingDays: 30,
    features: [
      '150 analyses / 30 days',
      'Advanced financial + Equity Waterfall',
      'Advanced Monte Carlo (5,000) + Stress + Sensitivity',
      '30 Image / PDF extractions / mo',
      '20 AI Listings / mo',
      '30 Investment PDFs + Memorandum PDF',
      'Deal Finder Advanced + Forecast Advanced',
      'AI Due Diligence (Deal + Document Audit)',
      'Global Portfolio Optimizer + Institutional Advisor',
      'Cross-Border Full + Tax & Sovereign Radar',
      'Portfolio 100 assets • Compare 10 scenarios',
      'Unlimited saves (fair-use cap 2,000)',
      'Limited REST API (100 req/day) • 2 users',
      'Priority support',
      'No White Label branding',
    ],
    hiddenFeatures: [
      'Monte Carlo 10,000 Cycles',
      'White Label Custom Logo & Colors',
      '1-on-1 Dedicated Analyst Desk',
    ],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: true,
      crossBorderMatrixFull: true,
      saveProperty: true,
      monteCarlo: true,
      monteCarloAdvanced: true,
      monteCarlo10k: false,
      pdfExport: true,
      memorandumPdf: true,
      customBrandingPdf: false,
      whiteLabelReports: false,
      whiteLabelPlatform: false,
      dealFinder: true,
      dealFinderAdvanced: true,
      forecastBasic: true,
      forecastAdvanced: true,
      dueDiligence: true,
      globalOptimizer: true,
      institutionalAdvisor: true,
      portfolioAggregation: true,
      apiAccess: true,
      analystDesk: false,
      customUnderwriting: false,
    },
  },
  enterprise: {
    key: 'enterprise',
    displayName: 'SOVEREIGN',
    tierTag: 'HIGHEST VALUE FOR INSTITUTIONS',
    originalPrice: 999,
    launchPrice: 599,
    priceUSD: 599,
    analysesLimit: 500,
    savedLimit: 5000,
    isFairUseSaved: true,
    imagePdfLimit: 100,
    aiListingLimit: 100,
    investmentPdfLimit: 100,
    portfolioAssetsLimit: 400,
    compareLimit: 25,
    teamUsersLimit: 10,
    apiDailyLimit: 2000,
    monteCarloMaxCycles: 10000,
    whiteLabelMode: 'reports',
    licensingDays: 30,
    features: [
      '500 analyses / 30 days',
      'All financial + institutional modeling',
      '100 Image / PDF extractions / mo',
      '100 AI Listings / mo',
      '100 PDFs + Pro Memorandum',
      'White Label Reports + Custom logo & colors',
      'Advanced Due Diligence + Tax Audit',
      'Advanced Deal Finder + Forecast + Optimizer + Advisor',
      'Monte Carlo 10,000 cycles + Advanced Stress',
      'Sovereign Radar + Cross-Border Intelligence',
      'Portfolio 400 assets • Compare 25 scenarios',
      'Unlimited saves (fair-use cap 5,000)',
      'Full REST API (2,000 req/day) • 10 users + RBAC',
      'High priority + Dedicated Analyst Desk',
    ],
    hiddenFeatures: [],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: true,
      crossBorderMatrixFull: true,
      saveProperty: true,
      monteCarlo: true,
      monteCarloAdvanced: true,
      monteCarlo10k: true,
      pdfExport: true,
      memorandumPdf: true,
      customBrandingPdf: true,
      whiteLabelReports: true,
      whiteLabelPlatform: false,
      dealFinder: true,
      dealFinderAdvanced: true,
      forecastBasic: true,
      forecastAdvanced: true,
      dueDiligence: true,
      globalOptimizer: true,
      institutionalAdvisor: true,
      portfolioAggregation: true,
      apiAccess: true,
      analystDesk: true,
      customUnderwriting: true,
    },
  },
  institutional: {
    key: 'institutional',
    displayName: 'ENTERPRISE',
    tierTag: 'CONTRACT PRICING — NO UNLIMITED PROMISE',
    originalPrice: 2499,
    launchPrice: 1499,
    priceUSD: 1499,
    analysesLimit: 1000,
    savedLimit: 1000,
    isFairUseSaved: false,
    imagePdfLimit: 250,
    aiListingLimit: 250,
    investmentPdfLimit: 250,
    portfolioAssetsLimit: 1000,
    compareLimit: 50,
    teamUsersLimit: 50,
    apiDailyLimit: 10000,
    monteCarloMaxCycles: 10000,
    whiteLabelMode: 'full',
    licensingDays: 30,
    isContractPricing: true,
    features: [
      '1,000 analyses / mo (per contract)',
      '250 Image / PDF / mo • 250 AI Listings / mo • 250 PDFs / mo',
      'Portfolio 1,000 assets (per contract) • Save 1,000 (not unlimited)',
      'Compare up to 50 scenarios',
      'Multi-team + multi-user (up to 50 seats per contract)',
      'Enterprise AI Due Diligence & Market Intelligence',
      'Institutional Portfolio Optimization & Custom Risk Models',
      'Full White Label for Platform + Custom Reports',
      'Custom Investment Memorandum & Monte Carlo Models',
      'Custom API Integration + Independent REST keys/permissions',
      'Connect to company ERP/CRM & External data integrations',
      'Advanced permissions + Audit Trail + Custom org dashboards',
      'Custom data/markets, capacity & SLA per written contract',
      'Dedicated onboarding + Custom training + Direct institutional support',
    ],
    hiddenFeatures: [],
    capabilities: {
      basicMetrics: true,
      yieldSensitivity: true,
      crossBorderMatrixFull: true,
      saveProperty: true,
      monteCarlo: true,
      monteCarloAdvanced: true,
      monteCarlo10k: true,
      pdfExport: true,
      memorandumPdf: true,
      customBrandingPdf: true,
      whiteLabelReports: true,
      whiteLabelPlatform: true,
      dealFinder: true,
      dealFinderAdvanced: true,
      forecastBasic: true,
      forecastAdvanced: true,
      dueDiligence: true,
      globalOptimizer: true,
      institutionalAdvisor: true,
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
  if (
    val === 'institutional' ||
    val === 'enterprise_contract' ||
    val === 'contract' ||
    val === 'custom_enterprise'
  ) {
    return 'institutional';
  }
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
    case 'forecastBasic':
    case 'portfolioAggregation':
    case 'yieldSensitivity':
    case 'crossBorderMatrixFull':
      return 'Available in STARTER or higher - Upgrade';
    case 'memorandumPdf':
    case 'monteCarloAdvanced':
    case 'dealFinderAdvanced':
    case 'forecastAdvanced':
    case 'dueDiligence':
    case 'globalOptimizer':
    case 'institutionalAdvisor':
    case 'apiAccess':
      return 'Available in PROFESSIONAL / SOVEREIGN - Upgrade';
    case 'monteCarlo10k':
    case 'customBrandingPdf':
    case 'whiteLabelReports':
    case 'analystDesk':
    case 'customUnderwriting':
      return 'Available in SOVEREIGN / ENTERPRISE - Upgrade';
    case 'whiteLabelPlatform':
      return 'Available in ENTERPRISE Contract Tier - Contact Institutional Desk';
    case 'saveProperty':
      return 'Save quota reached - Upgrade plan';
    default:
      return 'Available in PROFESSIONAL - Upgrade';
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
  const hasEnd = Boolean(params.licenseEnd);
  const isExpired = Boolean(hasEnd && params.licenseEnd! <= now);

  const effectivePlanKey: PlanKey = rawPlanKey;
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
  if (isExpired) {
    daysLeft = 0;
  } else if (params.licenseEnd) {
    daysLeft = Math.max(0, Math.ceil((params.licenseEnd - now) / (1000 * 60 * 60 * 24)));
  }

  let analysesUsed = Math.max(0, params.analysesUsed ?? 0);
  let analysesLeft = isExpired
    ? 0
    : isUnlimitedAnalyses
    ? Infinity
    : Math.max(0, effectiveAnalysesLimit - analysesUsed);

  if (!isExpired && !isUnlimitedAnalyses) {
    const explicitLeft =
      params.analysesLeft ?? params.freeAnalysesLeft;
    if (typeof explicitLeft === 'number') {
      analysesLeft = Math.max(0, explicitLeft);
      if (analysesUsed === 0 && explicitLeft <= effectiveAnalysesLimit) {
        analysesUsed = Math.max(0, effectiveAnalysesLimit - analysesLeft);
      }
    }
  }

  const timeProgress = isExpired
    ? 0
    : params.licenseEnd
    ? Math.min(100, Math.max(0, Math.round((daysLeft / 30) * 100)))
    : isUnlimitedAnalyses
    ? 100
    : Math.min(100, Math.max(0, Math.round((analysesLeft / effectiveAnalysesLimit) * 100)));

  const leftStr = isUnlimitedAnalyses ? 'Unlimited credits left' : `${analysesLeft} credits left`;
  const sidebarText = isExpired
    ? `LICENSING COUNTDOWN - ${planCfg.displayName} - EXPIRED - 0 credits left`
    : `LICENSING COUNTDOWN - ${planCfg.displayName} - ${daysLeft} days left - ${leftStr}`;

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
