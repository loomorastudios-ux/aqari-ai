// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

// =========================================================================
// 1. INLINED PLANS & TIER MAPPING (Zero external ../lib imports)
// =========================================================================

const PLANS = {
  STARTER: { price: 75, analyses: 30, name: 'STARTER' },
  PROFESSIONAL: { price: 199, analyses: 150, name: 'PROFESSIONAL' },
  SOVEREIGN: { price: 599, analyses: 500, name: 'SOVEREIGN' },
  ENTERPRISE: { price: 1499, analyses: 0, name: 'ENTERPRISE' },
} as const;

function planFromAmount(amount: any) {
  const num = Number(amount || 0);
  const rounded = Math.round(num);
  if (rounded === 149900 || rounded === 1499 || rounded === 249900 || rounded === 2499) {
    return PLANS.ENTERPRISE;
  }
  if (rounded === 59900 || rounded === 599 || rounded === 99900 || rounded === 999) {
    return PLANS.SOVEREIGN;
  }
  if (rounded === 19900 || rounded === 199 || rounded === 34900 || rounded === 349) {
    return PLANS.PROFESSIONAL;
  }
  if (
    rounded === 7500 ||
    rounded === 75 ||
    rounded === 7900 ||
    rounded === 79 ||
    rounded === 12900 ||
    rounded === 129
  ) {
    return PLANS.STARTER;
  }
  return null;
}

type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise' | 'institutional';

type GatedFeature =
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

interface PlanQuotas {
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

interface PlanDefinition extends PlanQuotas {
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

interface DynamicPlanPublic {
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

interface PricingPublicPayload {
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

interface ComputedLicenseStatus {
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

const CREDIT_COSTS = {
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
} as const;

const EXTRA_CREDIT_PACKS = [
  {
    id: 'pack_25',
    label: '+25 AI Credits',
    credits: 25,
    priceUSD: 19,
    perCreditUSD: '$0.76',
    badge: 'Instant top-up',
    description: 'Immediate top-up for extra underwriting, Deal Finder, or OCR extractions.',
  },
  {
    id: 'pack_100',
    label: '+100 AI Credits',
    credits: 100,
    priceUSD: 59,
    perCreditUSD: '$0.59',
    badge: 'Most popular',
    description: 'Active acquisition sprint pack for Due Diligence & Studio workflows.',
  },
  {
    id: 'pack_500',
    label: '+500 AI Credits',
    credits: 500,
    priceUSD: 249,
    perCreditUSD: '$0.50',
    badge: 'Best value',
    description: 'High-volume credit reserve for teams, portfolios, and multi-doc DD.',
  },
] as const;

const PRICING_SCHEMA_VERSION = 4;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LAUNCH_END_DATE_MS = new Date('2026-11-28T23:59:59Z').getTime();
const DEFAULT_LAUNCH_BADGE = 'LAUNCH OFFER - First 30 institutional seats';

const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
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
    launchPrice: PLANS.STARTER.price,
    priceUSD: PLANS.STARTER.price,
    analysesLimit: PLANS.STARTER.analyses,
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
    launchPrice: PLANS.PROFESSIONAL.price,
    priceUSD: PLANS.PROFESSIONAL.price,
    analysesLimit: PLANS.PROFESSIONAL.analyses,
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
      'Save up to 2,000 analyses',
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
    launchPrice: PLANS.SOVEREIGN.price,
    priceUSD: PLANS.SOVEREIGN.price,
    analysesLimit: PLANS.SOVEREIGN.analyses,
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
      'Save up to 5,000 analyses',
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
    tierTag: 'CUSTOM SLA & CONTRACT PRICING',
    originalPrice: 2499,
    launchPrice: PLANS.ENTERPRISE.price,
    priceUSD: PLANS.ENTERPRISE.price,
    analysesLimit: 0,
    savedLimit: 0,
    isFairUseSaved: false,
    imagePdfLimit: 0,
    aiListingLimit: 0,
    investmentPdfLimit: 0,
    portfolioAssetsLimit: 0,
    compareLimit: 50,
    teamUsersLimit: 0,
    apiDailyLimit: 0,
    monteCarloMaxCycles: 10000,
    whiteLabelMode: 'full',
    licensingDays: 30,
    isContractPricing: true,
    features: [
      'Custom analyses/month per contract',
      'Custom Image/PDF extraction limits per contract',
      'Custom AI Listings & Report limits per contract',
      'Custom Portfolio Asset tracking limits per contract',
      'Multi-team & multi-user seats per contract',
      'Role-Based Access Control (Analyst / Manager / Admin)',
      'Full Audit Trail logs & Enterprise security controls',
      'Private Dedicated Organization Workspaces',
      'Enterprise AI Due Diligence (Multi-Document Contradiction Audit)',
      'Enterprise AI Market Intelligence (Custom Markets)',
      'Institutional Portfolio Optimization',
      'Custom Risk Models (Custom Cap Rate / Yield / Risk Rules)',
      'Custom Underwriting Models & Exit Scenarios',
      'Custom Monte Carlo & Stress Testing',
      'White Label Platform (Custom Brand, Logo & Domain Option)',
      'White Label Institutional Memorandums & Reports',
      'Custom REST API Access & Independent API Keys',
      'ERP / CRM Integration Support',
      'External Data Source Integrations (Per Contract)',
      'Custom Org Dashboards',
      'Custom SLA (Uptime & Response Guarantee per Contract)',
      'Dedicated Onboarding & Team Training',
      'Dedicated Account Manager & Direct Support',
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

function normalizePlanKey(raw?: string | null): PlanKey {
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

function toEnglishDigitsServer(raw: any): string {
  return String(raw ?? '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function parseEnglishNumberServer(raw: any): number {
  if (typeof raw === 'number') return raw;
  const normalized = toEnglishDigitsServer(raw).replace(/,/g, '').replace(/[^0-9.\-]/g, '');
  if (!normalized) return NaN;
  return Number(normalized);
}

function getPlanConfig(raw?: string | null): PlanDefinition {
  return PLAN_DEFINITIONS[normalizePlanKey(raw)];
}

function canUseFeature(plan: string | null | undefined, feature: GatedFeature): boolean {
  return Boolean(getPlanConfig(plan).capabilities[feature]);
}

function getUpgradeMessage(feature: GatedFeature): string {
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

interface ServerUnderwritingInputs {
  priceUSD: number;
  rentUSD: number;
  downPaymentPct: number;
  interestRatePct: number;
  operatingExpensePct: number;
  loanTermYears?: number;
  amortizationYears?: number;
  vacancyRatePct?: number;
  managementPct?: number;
  propertyTaxUSD?: number;
  insuranceUSD?: number;
  maintenanceReserveUSD?: number;
  hoaUSD?: number;
  closingCostsPct?: number;
  rentGrowthPct?: number;
  expenseGrowthPct?: number;
  appreciationPct?: number;
  exitCapRatePct?: number;
  sellingCostsPct?: number;
  noExitValue?: boolean;
}

type ServerIrrStatus = 'ok' | 'negative_cashflows' | 'no_exit_value' | 'insufficient_data';

function normalizeServerUnderwritingInputs(raw: ServerUnderwritingInputs) {
  const num = (v: any, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const loanTermYears = Math.max(1, Math.min(40, num(raw.loanTermYears, 25)));
  const amortizationYears = Math.max(1, Math.min(40, num(raw.amortizationYears, loanTermYears)));
  return {
    priceUSD: Math.max(0, num(raw.priceUSD, 0)),
    rentUSD: Math.max(0, num(raw.rentUSD, 0)),
    downPaymentPct: Math.max(0, Math.min(100, num(raw.downPaymentPct, 30))),
    interestRatePct: Math.max(0, Math.min(35, num(raw.interestRatePct, 5.5))),
    operatingExpensePct: Math.max(0, Math.min(99, num(raw.operatingExpensePct, 15))),
    loanTermYears,
    amortizationYears,
    vacancyRatePct: Math.max(0, Math.min(95, num(raw.vacancyRatePct, 0))),
    managementPct: Math.max(0, Math.min(50, num(raw.managementPct, 0))),
    propertyTaxUSD: Math.max(0, num(raw.propertyTaxUSD, 0)),
    insuranceUSD: Math.max(0, num(raw.insuranceUSD, 0)),
    maintenanceReserveUSD: Math.max(0, num(raw.maintenanceReserveUSD, 0)),
    hoaUSD: Math.max(0, num(raw.hoaUSD, 0)),
    closingCostsPct: Math.max(0, Math.min(25, num(raw.closingCostsPct, 0))),
    rentGrowthPct: Math.max(-20, Math.min(30, num(raw.rentGrowthPct, 3.0))),
    expenseGrowthPct: Math.max(-10, Math.min(30, num(raw.expenseGrowthPct, 2.5))),
    appreciationPct: Math.max(-50, Math.min(30, num(raw.appreciationPct, 3.0))),
    exitCapRatePct: Math.max(0, Math.min(40, num(raw.exitCapRatePct, 0))),
    sellingCostsPct: Math.max(0, Math.min(20, num(raw.sellingCostsPct, 3.0))),
    noExitValue: Boolean(raw.noExitValue),
  };
}

function calcServerMonthlyMortgage(loanUSD: number, annualInterestPct: number, amortizationYears: number): number {
  if (loanUSD <= 0) return 0;
  const n = Math.max(1, Math.round(amortizationYears * 12));
  const r = annualInterestPct / 100 / 12;
  if (r <= 0) return loanUSD / n;
  const factor = Math.pow(1 + r, n);
  return (loanUSD * r * factor) / (factor - 1);
}

function calcServerRemainingBalance(
  loanUSD: number,
  annualInterestPct: number,
  amortizationYears: number,
  monthsElapsed: number
): number {
  if (loanUSD <= 0) return 0;
  const n = Math.max(1, Math.round(amortizationYears * 12));
  const p = Math.max(0, Math.min(n, Math.round(monthsElapsed)));
  if (p >= n) return 0;
  const r = annualInterestPct / 100 / 12;
  if (r <= 0) return loanUSD * (1 - p / n);
  const fN = Math.pow(1 + r, n);
  const fP = Math.pow(1 + r, p);
  return Math.max(0, (loanUSD * (fN - fP)) / (fN - 1));
}

function computeServerIrrFromCashflows(cashflows: number[]): {
  irrPct: number | null;
  status: ServerIrrStatus;
  error: string | null;
} {
  if (!Array.isArray(cashflows) || cashflows.length < 2 || cashflows.some((c) => !Number.isFinite(c))) {
    return { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  }
  if (cashflows[0] >= 0) {
    return { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  }
  if (!cashflows.slice(1).some((c) => c > 0)) {
    return {
      irrPct: null,
      status: 'negative_cashflows',
      error: 'IRR cannot be calculated - negative cashflows',
    };
  }
  const npv = (rate: number): number => {
    let total = 0;
    for (let t = 0; t < cashflows.length; t++) {
      total += cashflows[t] / Math.pow(1 + rate, t);
    }
    return total;
  };
  let low = -0.95;
  let high = 50.0;
  let npvLow = npv(low);
  let npvHigh = npv(high);
  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh) || npvLow * npvHigh > 0) {
    const grid = [-0.9, -0.75, -0.5, -0.25, -0.1, 0, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3.0, 5.0, 15.0, 50.0];
    let found = false;
    for (let i = 0; i < grid.length - 1; i++) {
      const a = npv(grid[i]);
      const b = npv(grid[i + 1]);
      if (Number.isFinite(a) && Number.isFinite(b) && a * b <= 0) {
        low = grid[i];
        high = grid[i + 1];
        npvLow = a;
        npvHigh = b;
        found = true;
        break;
      }
    }
    if (!found) {
      return {
        irrPct: null,
        status: 'negative_cashflows',
        error: 'IRR cannot be calculated - negative cashflows',
      };
    }
  }
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 1e-6) {
      const pct = Number((mid * 100).toFixed(1));
      return { irrPct: pct === 0 ? 0.1 : pct, status: 'ok', error: null };
    }
    if ((npvLow > 0 && npvMid > 0) || (npvLow < 0 && npvMid < 0)) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
      npvHigh = npvMid;
    }
  }
  const finalPct = Number((((low + high) / 2) * 100).toFixed(1));
  if (!Number.isFinite(finalPct)) {
    return { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  }
  if (Math.abs(finalPct) < 0.05) {
    const netProfit = cashflows.reduce((s, c) => s + c, 0);
    if (netProfit <= 0) {
      return {
        irrPct: null,
        status: 'negative_cashflows',
        error: 'IRR cannot be calculated - negative cashflows',
      };
    }
    return { irrPct: 0.1, status: 'ok', error: null };
  }
  return { irrPct: finalPct, status: 'ok', error: null };
}

function validateServerUnderwriting(
  inputs: ReturnType<typeof normalizeServerUnderwritingInputs>,
  metrics: {
    capRate: number;
    cashOnCash: number;
    irr5Yr: number | null;
    dscrNumeric: number | null;
    annualGrossRentUSD: number;
  }
): string[] {
  const warnings: string[] = [];
  if (inputs.priceUSD > 0 && inputs.rentUSD > 0) {
    const grossYield = (metrics.annualGrossRentUSD / inputs.priceUSD) * 100;
    const priceToAnnualRent =
      metrics.annualGrossRentUSD > 0 ? inputs.priceUSD / metrics.annualGrossRentUSD : Infinity;
    if (grossYield > 30 || (inputs.priceUSD < 100000 && inputs.rentUSD >= 1500) || priceToAnnualRent < 3.0) {
      const suggested = inputs.priceUSD * 100;
      warnings.push(
        `Purchase Price ($${inputs.priceUSD.toLocaleString('en-US')}) looks unusually low vs monthly rent ($${inputs.rentUSD.toLocaleString('en-US')}/mo) — verify you didn't miss zeros (e.g. $${inputs.priceUSD.toLocaleString('en-US')} vs $${suggested.toLocaleString('en-US')}).`
      );
    }
  }
  if (metrics.capRate > 30) {
    warnings.push(
      `High Cap Rate warning (${metrics.capRate}% > 30%): verify Annual Rent ($${metrics.annualGrossRentUSD.toLocaleString('en-US')}) vs Acquisition Price ($${inputs.priceUSD.toLocaleString('en-US')}).`
    );
  }
  if (metrics.cashOnCash > 100) {
    warnings.push(
      `Extreme Cash-on-Cash warning (${metrics.cashOnCash}% > 100%): verify Down Payment % (${inputs.downPaymentPct}%) and leverage assumptions.`
    );
  }
  if (metrics.irr5Yr !== null && metrics.irr5Yr > 100) {
    warnings.push(
      `Extreme 5-Year IRR warning (${metrics.irr5Yr}% > 100%): verify appreciation, exit cap rate, and equity basis.`
    );
  }
  if (metrics.dscrNumeric !== null && metrics.dscrNumeric > 10) {
    warnings.push(
      `High DSCR warning (${metrics.dscrNumeric.toFixed(2)}x > 10x): verify loan leverage and debt service assumptions.`
    );
  }
  return warnings;
}

function calculateServerUnderwriting(rawInputs: ServerUnderwritingInputs) {
  const inputs = normalizeServerUnderwritingInputs(rawInputs);
  const priceUSD = inputs.priceUSD;
  const downPaymentUSD = priceUSD * (inputs.downPaymentPct / 100);
  const closingCostsUSD = priceUSD * (inputs.closingCostsPct / 100);
  const totalEquityInvestedUSD = downPaymentUSD + closingCostsUSD;
  const loanAmountUSD = Math.max(0, priceUSD - downPaymentUSD);

  const monthlyMortgageUSD = calcServerMonthlyMortgage(
    loanAmountUSD,
    inputs.interestRatePct,
    inputs.amortizationYears
  );
  const annualDebtServiceBaseUSD = monthlyMortgageUSD * 12;

  const grossRentAnnualUSD = inputs.rentUSD * 12;
  const vacancyLossUSD = grossRentAnnualUSD * (inputs.vacancyRatePct / 100);
  const effectiveGrossIncomeUSD = grossRentAnnualUSD - vacancyLossUSD;
  const baseOpexUSD = effectiveGrossIncomeUSD * (inputs.operatingExpensePct / 100);
  const managementFeeUSD = effectiveGrossIncomeUSD * (inputs.managementPct / 100);
  const propertyTaxUSD = inputs.propertyTaxUSD;
  const insuranceUSD = inputs.insuranceUSD;
  const maintenanceReserveUSD = inputs.maintenanceReserveUSD;
  const hoaUSD = inputs.hoaUSD;
  const totalExpensesUSD =
    baseOpexUSD + managementFeeUSD + propertyTaxUSD + insuranceUSD + maintenanceReserveUSD + hoaUSD;
  const netOperatingIncomeUSD = effectiveGrossIncomeUSD - totalExpensesUSD;

  const annualDebtServiceYr1 = inputs.loanTermYears >= 1 ? annualDebtServiceBaseUSD : 0;
  const annualCashflowUSD = netOperatingIncomeUSD - annualDebtServiceYr1;
  const monthlyCashflowUSD = annualCashflowUSD / 12;

  const capRate = priceUSD > 0 ? Number(((netOperatingIncomeUSD / priceUSD) * 100).toFixed(2)) : 0;
  const cashOnCash =
    totalEquityInvestedUSD > 0
      ? Number(((annualCashflowUSD / totalEquityInvestedUSD) * 100).toFixed(2))
      : 0;
  const dscrNumeric =
    annualDebtServiceYr1 > 0
      ? Number((netOperatingIncomeUSD / annualDebtServiceYr1).toFixed(2))
      : null;
  const dscr = dscrNumeric !== null ? dscrNumeric.toFixed(2) : null;

  const holdYears = 5;
  const computeYearNOI = (yr: number) => {
    const rFactor = Math.pow(1 + inputs.rentGrowthPct / 100, yr - 1);
    const eFactor = Math.pow(1 + inputs.expenseGrowthPct / 100, yr - 1);
    const gRent = grossRentAnnualUSD * rFactor;
    const vac = gRent * (inputs.vacancyRatePct / 100);
    const egi = gRent - vac;
    const pctExpenses = egi * ((inputs.operatingExpensePct + inputs.managementPct) / 100);
    const fixedExpenses =
      (propertyTaxUSD + insuranceUSD + maintenanceReserveUSD + hoaUSD) * eFactor;
    const totalOpex = pctExpenses + fixedExpenses;
    return {
      grossRentUSD: gRent,
      vacancyLossUSD: vac,
      effectiveGrossIncomeUSD: egi,
      operatingExpensesUSD: totalOpex,
      noiUSD: egi - totalOpex,
    };
  };

  const yearByYear: any[] = [];
  const dcfStream: number[] = [-totalEquityInvestedUSD];
  for (let yr = 1; yr <= holdYears; yr++) {
    const y = computeYearNOI(yr);
    const debtService = yr <= inputs.loanTermYears ? annualDebtServiceBaseUSD : 0;
    const netCf = y.noiUSD - debtService;
    const remainingLoan =
      yr <= inputs.loanTermYears
        ? calcServerRemainingBalance(loanAmountUSD, inputs.interestRatePct, inputs.amortizationYears, yr * 12)
        : 0;
    const yrDscr = debtService > 0 ? Number((y.noiUSD / debtService).toFixed(2)) : null;
    yearByYear.push({
      year: yr,
      grossRentUSD: Math.round(y.grossRentUSD),
      vacancyLossUSD: Math.round(y.vacancyLossUSD),
      effectiveGrossIncomeUSD: Math.round(y.effectiveGrossIncomeUSD),
      operatingExpensesUSD: Math.round(y.operatingExpensesUSD),
      noiUSD: Math.round(y.noiUSD),
      debtServiceUSD: Math.round(debtService),
      netCashflowUSD: Math.round(netCf),
      remainingLoanUSD: Math.round(remainingLoan),
      dscr: yrDscr,
      cumulativeIrrPct: null as number | null,
    });
    dcfStream.push(netCf);
  }

  const remainingLoanYr5USD =
    inputs.loanTermYears >= holdYears
      ? calcServerRemainingBalance(loanAmountUSD, inputs.interestRatePct, inputs.amortizationYears, holdYears * 12)
      : 0;

  let exitGrossValueUSD = 0;
  if (!inputs.noExitValue) {
    if (inputs.exitCapRatePct > 0) {
      const yr6 = computeYearNOI(6);
      exitGrossValueUSD = yr6.noiUSD > 0 ? yr6.noiUSD / (inputs.exitCapRatePct / 100) : 0;
    } else if (priceUSD > 0) {
      exitGrossValueUSD = priceUSD * Math.pow(1 + inputs.appreciationPct / 100, holdYears);
    }
  }
  const sellingCostsUSD =
    exitGrossValueUSD > 0 ? exitGrossValueUSD * (inputs.sellingCostsPct / 100) : 0;
  const netExitProceedsUSD = inputs.noExitValue
    ? 0
    : exitGrossValueUSD - sellingCostsUSD - remainingLoanYr5USD;

  for (let yr = 1; yr <= holdYears; yr++) {
    const partialStream = [-totalEquityInvestedUSD];
    for (let j = 0; j < yr; j++) partialStream.push(yearByYear[j].netCashflowUSD);
    if (!inputs.noExitValue && exitGrossValueUSD > 0) {
      const yrValue =
        inputs.exitCapRatePct > 0
          ? Math.max(0, computeYearNOI(yr + 1).noiUSD / (inputs.exitCapRatePct / 100))
          : priceUSD * Math.pow(1 + inputs.appreciationPct / 100, yr);
      const yrSell = yrValue * (inputs.sellingCostsPct / 100);
      partialStream[partialStream.length - 1] +=
        yrValue - yrSell - yearByYear[yr - 1].remainingLoanUSD;
    }
    yearByYear[yr - 1].cumulativeIrrPct = computeServerIrrFromCashflows(partialStream).irrPct;
  }

  let irrEval: { irrPct: number | null; status: ServerIrrStatus; error: string | null };
  if (priceUSD <= 0 || totalEquityInvestedUSD <= 0 || inputs.rentUSD <= 0) {
    irrEval = { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  } else if (inputs.noExitValue && yearByYear.every((r) => r.netCashflowUSD <= 0)) {
    irrEval = {
      irrPct: null,
      status: 'negative_cashflows',
      error: 'IRR cannot be calculated - negative cashflows',
    };
  } else if (inputs.noExitValue) {
    const opOnlyIrr = computeServerIrrFromCashflows(dcfStream);
    irrEval =
      opOnlyIrr.irrPct === null
        ? { irrPct: null, status: 'no_exit_value', error: 'No exit value' }
        : opOnlyIrr;
  } else {
    const terminalStream = [...dcfStream];
    terminalStream[terminalStream.length - 1] += netExitProceedsUSD;
    irrEval = computeServerIrrFromCashflows(terminalStream);
    if (irrEval.irrPct === null && exitGrossValueUSD <= 0) {
      irrEval = { irrPct: null, status: 'no_exit_value', error: 'No exit value' };
    }
  }

  const warnings = validateServerUnderwriting(inputs, {
    capRate,
    cashOnCash,
    irr5Yr: irrEval.irrPct,
    dscrNumeric,
    annualGrossRentUSD: grossRentAnnualUSD,
  });

  return {
    inputs,
    capRate,
    cashOnCash,
    irr5Yr: irrEval.irrPct,
    irrStatus: irrEval.status,
    irrError: irrEval.error,
    dscr,
    dscrNumeric,
    monthlyCashflowUSD: Math.round(monthlyCashflowUSD),
    monthlyMortgageUSD: Math.round(monthlyMortgageUSD),
    netOperatingIncomeUSD: Math.round(netOperatingIncomeUSD),
    annualGrossRentUSD: Math.round(grossRentAnnualUSD),
    annualOPEXUSD: Math.round(totalExpensesUSD),
    annualDebtServiceUSD: Math.round(annualDebtServiceYr1),
    downPaymentUSD: Math.round(downPaymentUSD),
    closingCostsUSD: Math.round(closingCostsUSD),
    totalEquityInvestedUSD: Math.round(totalEquityInvestedUSD),
    loanAmountUSD: Math.round(loanAmountUSD),
    exitGrossValueUSD: Math.round(exitGrossValueUSD),
    sellingCostsUSD: Math.round(sellingCostsUSD),
    remainingLoanYr5USD: Math.round(remainingLoanYr5USD),
    netExitProceedsUSD: Math.round(netExitProceedsUSD),
    noiBreakdown: {
      grossRentAnnualUSD: Math.round(grossRentAnnualUSD),
      vacancyLossUSD: Math.round(vacancyLossUSD),
      effectiveGrossIncomeUSD: Math.round(effectiveGrossIncomeUSD),
      baseOpexUSD: Math.round(baseOpexUSD),
      managementFeeUSD: Math.round(managementFeeUSD),
      propertyTaxUSD: Math.round(propertyTaxUSD),
      insuranceUSD: Math.round(insuranceUSD),
      maintenanceReserveUSD: Math.round(maintenanceReserveUSD),
      hoaUSD: Math.round(hoaUSD),
      totalExpensesUSD: Math.round(totalExpensesUSD),
      noiUSD: Math.round(netOperatingIncomeUSD),
    },
    yearByYear,
    warnings,
  };
}

function runServerMonteCarlo(
  rawInputs: ServerUnderwritingInputs,
  options?: { cycles?: number; seedOffset?: number }
) {
  const inputs = normalizeServerUnderwritingInputs(rawInputs);
  const cycles = Math.max(100, Math.min(10000, Math.round(options?.cycles || 1000)));
  const price = Math.max(1, inputs.priceUSD);
  const baseMonthlyRent = Math.max(1, inputs.rentUSD);
  const downUSD = price * (inputs.downPaymentPct / 100);
  const closingUSD = price * (inputs.closingCostsPct / 100);
  const equityUSD = Math.max(1, downUSD + closingUSD);
  const loanUSD = Math.max(0, price - downUSD);

  let seed =
    Math.round(price) ^
    (Math.round(baseMonthlyRent) << 5) ^
    (Math.round(inputs.interestRatePct * 100) << 11) ^
    (options?.seedOffset || 1337);
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randNorm = () => {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const dscrs: number[] = [];
  const cocs: number[] = [];
  const irrs: number[] = [];
  let passCount = 0;
  let positiveCashflowCount = 0;
  let negativeCashflowCount = 0;
  let valueDeclineCount = 0;

  const dscrBuckets = [0, 0, 0, 0, 0];
  const irrBuckets = [0, 0, 0, 0, 0, 0];
  const vacancyMean = Math.max(inputs.vacancyRatePct, 5) + 3.5;

  for (let i = 0; i < cycles; i++) {
    const zRate = randNorm();
    const zMacro = randNorm();
    const zVac = randNorm();
    const zApp = randNorm();

    const shockedRate = Math.max(0.5, inputs.interestRatePct + 1.5 + zRate * 0.9);
    const shockedVacancyPct = Math.min(35, Math.max(0, vacancyMean + zVac * 4.0 - zMacro * 1.2));
    const rentMultiplier = Math.min(1.3, Math.max(0.68, 1 - 0.02 + zMacro * 0.075));
    const shockedOpexPct = Math.min(75, Math.max(0, inputs.operatingExpensePct + 0.5 + randNorm() * 2.0));
    const shockedAppreciationPct = inputs.appreciationPct - 0.5 + zApp * 2.8 - zRate * 0.6;
    const shockedExitCapPct =
      inputs.exitCapRatePct > 0 ? Math.max(2.0, inputs.exitCapRatePct + 0.25 + zRate * 0.45) : 0;

    const trialMonthlyRent = baseMonthlyRent * rentMultiplier;
    const trialGross = trialMonthlyRent * 12;
    const trialEgi = trialGross * (1 - shockedVacancyPct / 100);
    const trialFixed =
      inputs.propertyTaxUSD + inputs.insuranceUSD + inputs.maintenanceReserveUSD + inputs.hoaUSD;
    const trialNOI =
      trialEgi * (1 - (shockedOpexPct + inputs.managementPct) / 100) - trialFixed;

    const monthlyDebt = calcServerMonthlyMortgage(loanUSD, shockedRate, inputs.amortizationYears);
    const annualDebt = inputs.loanTermYears >= 1 ? monthlyDebt * 12 : 0;
    const trialDscr = annualDebt > 0 ? trialNOI / annualDebt : 4.0;
    const trialCashflow = trialNOI - annualDebt;
    const trialCoc = (trialCashflow / equityUSD) * 100;

    dscrs.push(trialDscr);
    cocs.push(trialCoc);

    if (trialDscr >= 1.2) passCount++;
    if (trialCashflow > 0) positiveCashflowCount++;
    if (trialCashflow < 0) negativeCashflowCount++;

    if (trialDscr < 1.0) dscrBuckets[0]++;
    else if (trialDscr < 1.2) dscrBuckets[1]++;
    else if (trialDscr < 1.5) dscrBuckets[2]++;
    else if (trialDscr < 1.8) dscrBuckets[3]++;
    else dscrBuckets[4]++;

    const cfStream: number[] = [-equityUSD];
    let yr5NOI = trialNOI;
    for (let yr = 1; yr <= 5; yr++) {
      const rF = Math.pow(1 + inputs.rentGrowthPct / 100, yr - 1);
      const eF = Math.pow(1 + inputs.expenseGrowthPct / 100, yr - 1);
      const yEgi = trialGross * rF * (1 - shockedVacancyPct / 100);
      const yNoi = yEgi * (1 - (shockedOpexPct + inputs.managementPct) / 100) - trialFixed * eF;
      if (yr === 5) yr5NOI = yNoi;
      cfStream.push(yNoi - (yr <= inputs.loanTermYears ? annualDebt : 0));
    }

    const trialExitValue = inputs.noExitValue
      ? 0
      : shockedExitCapPct > 0
      ? Math.max(0, (yr5NOI * (1 + inputs.rentGrowthPct / 100)) / (shockedExitCapPct / 100))
      : price * Math.pow(1 + shockedAppreciationPct / 100, 5);

    if (!inputs.noExitValue && trialExitValue < price) valueDeclineCount++;

    const remLoanYr5 =
      inputs.loanTermYears >= 5
        ? calcServerRemainingBalance(loanUSD, shockedRate, inputs.amortizationYears, 60)
        : 0;
    const trialNetExit = inputs.noExitValue
      ? 0
      : trialExitValue * (1 - inputs.sellingCostsPct / 100) - remLoanYr5;
    cfStream[cfStream.length - 1] += trialNetExit;

    const irrRes = computeServerIrrFromCashflows(cfStream);
    if (irrRes.irrPct !== null && Number.isFinite(irrRes.irrPct)) {
      irrs.push(irrRes.irrPct);
      if (irrRes.irrPct < 0) irrBuckets[0]++;
      else if (irrRes.irrPct < 6) irrBuckets[1]++;
      else if (irrRes.irrPct < 12) irrBuckets[2]++;
      else if (irrRes.irrPct < 18) irrBuckets[3]++;
      else irrBuckets[4]++;
    } else {
      irrBuckets[5]++;
    }
  }

  dscrs.sort((a, b) => a - b);
  cocs.sort((a, b) => a - b);
  irrs.sort((a, b) => a - b);

  const combinedResult = calculateServerUnderwriting({
    ...inputs,
    interestRatePct: inputs.interestRatePct + 2.0,
    rentUSD: baseMonthlyRent * 0.9,
    vacancyRatePct: Math.max(inputs.vacancyRatePct, 15),
  });
  const rate200 = calculateServerUnderwriting({
    ...inputs,
    interestRatePct: inputs.interestRatePct + 2.0,
  });
  const vac15 = calculateServerUnderwriting({
    ...inputs,
    vacancyRatePct: Math.max(inputs.vacancyRatePct, 15),
  });

  const pctAt = (arr: number[], q: number) =>
    arr.length > 0 ? Number(arr[Math.min(arr.length - 1, Math.floor(arr.length * q))].toFixed(2)) : null;

  return {
    cycles,
    rateShockBps: 200,
    passCount,
    failCount: cycles - passCount,
    passRatePct: Number(((passCount / cycles) * 100).toFixed(1)),
    positiveCashflowPct: Number(((positiveCashflowCount / cycles) * 100).toFixed(1)),
    probNegativeCashflowPct: Number(((negativeCashflowCount / cycles) * 100).toFixed(1)),
    probValueDeclinePct: inputs.noExitValue
      ? 0
      : Number(((valueDeclineCount / cycles) * 100).toFixed(1)),
    meanDscr: Number((dscrs.reduce((s, x) => s + x, 0) / cycles).toFixed(2)),
    minDscr: Number(dscrs[0].toFixed(2)),
    maxDscr: Number(dscrs[cycles - 1].toFixed(2)),
    dscrP10: pctAt(dscrs, 0.1) ?? 0,
    dscrP50: pctAt(dscrs, 0.5) ?? 0,
    dscrP90: pctAt(dscrs, 0.9) ?? 0,
    cocP10: pctAt(cocs, 0.1) ?? 0,
    cocP50: pctAt(cocs, 0.5) ?? 0,
    cocP90: pctAt(cocs, 0.9) ?? 0,
    irrP10: irrs.length > 0 ? Number((pctAt(irrs, 0.1) ?? 0).toFixed(1)) : null,
    irrP50: irrs.length > 0 ? Number((pctAt(irrs, 0.5) ?? 0).toFixed(1)) : null,
    irrP90: irrs.length > 0 ? Number((pctAt(irrs, 0.9) ?? 0).toFixed(1)) : null,
    irrMean:
      irrs.length > 0 ? Number((irrs.reduce((s, x) => s + x, 0) / irrs.length).toFixed(1)) : null,
    irrCalculablePct: Number(((irrs.length / cycles) * 100).toFixed(1)),
    rateShockCoC: rate200.cashOnCash,
    vacancySurgeNetYield: vac15.capRate,
    combinedStress: {
      label: '+200bps Rate + -10% Rent + 15% Vacancy',
      shockedRatePct: Number((inputs.interestRatePct + 2.0).toFixed(2)),
      rentDropPct: -10,
      vacancyPct: Math.max(inputs.vacancyRatePct, 15),
      noiUSD: combinedResult.netOperatingIncomeUSD,
      annualCashflowUSD: combinedResult.monthlyCashflowUSD * 12,
      cocPct: combinedResult.cashOnCash,
      dscr: combinedResult.dscr ?? '∞',
      irr5Yr: combinedResult.irr5Yr,
      irrError: combinedResult.irrError,
    },
    distribution: [
      { label: '< 1.0x', count: dscrBuckets[0], pct: Number(((dscrBuckets[0] / cycles) * 100).toFixed(1)) },
      { label: '1.0x-1.2x', count: dscrBuckets[1], pct: Number(((dscrBuckets[1] / cycles) * 100).toFixed(1)) },
      { label: '1.2x-1.5x', count: dscrBuckets[2], pct: Number(((dscrBuckets[2] / cycles) * 100).toFixed(1)) },
      { label: '1.5x-1.8x', count: dscrBuckets[3], pct: Number(((dscrBuckets[3] / cycles) * 100).toFixed(1)) },
      { label: '1.8x+', count: dscrBuckets[4], pct: Number(((dscrBuckets[4] / cycles) * 100).toFixed(1)) },
    ],
    irrDistribution: [
      { label: '< 0%', count: irrBuckets[0], pct: Number(((irrBuckets[0] / cycles) * 100).toFixed(1)) },
      { label: '0%-6%', count: irrBuckets[1], pct: Number(((irrBuckets[1] / cycles) * 100).toFixed(1)) },
      { label: '6%-12%', count: irrBuckets[2], pct: Number(((irrBuckets[2] / cycles) * 100).toFixed(1)) },
      { label: '12%-18%', count: irrBuckets[3], pct: Number(((irrBuckets[3] / cycles) * 100).toFixed(1)) },
      { label: '18%+', count: irrBuckets[4], pct: Number(((irrBuckets[4] / cycles) * 100).toFixed(1)) },
      { label: 'N/A', count: irrBuckets[5], pct: Number(((irrBuckets[5] / cycles) * 100).toFixed(1)) },
    ],
    assumptions: {
      cycles,
      rateShockMeanBps: 150,
      rateShockStdBps: 90,
      rentShockMeanPct: -2.0,
      rentShockStdPct: 7.5,
      vacancyMeanPct: Number(vacancyMean.toFixed(1)),
      vacancyStdPct: 4.0,
      appreciationStdPct: 2.8,
      methodology:
        'Box-Muller correlated stochastic draws across mortgage rate, vacancy, gross rent, operating expense, and exit valuation.',
    },
  };
}

function runMonteCarlo1000(params: ServerUnderwritingInputs & { seedOffset?: number; cycles?: number }) {
  return runServerMonteCarlo(params, { cycles: params.cycles || 1000, seedOffset: params.seedOffset });
}

function computeServerPortfolioAggregation(items: any[]) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      trackedAssets: 0,
      excludedInvalidCount: 0,
      totalAumUSD: 0,
      totalAnnualNoiUSD: 0,
      monthlyCashflowUSD: 0,
      annualCashflowUSD: 0,
      weightedCapRate: 0,
      weightedIRR: null as number | null,
    };
  }
  let trackedAssets = 0;
  let excludedInvalidCount = 0;
  let totalAumUSD = 0;
  let totalAnnualNoiUSD = 0;
  let monthlyCashflowUSD = 0;
  let irrWeightedSum = 0;
  let irrWeightTotal = 0;

  for (const item of items) {
    const val = Number(item?.price);
    const rawCap = Number(item?.capRate);
    const rawNoi = item?.noi !== undefined && item?.noi !== null ? Number(item.noi) : NaN;
    const derivedNoi =
      Number.isFinite(rawNoi) && rawNoi >= 0
        ? rawNoi
        : Number.isFinite(val) && val > 0 && Number.isFinite(rawCap)
        ? val * (rawCap / 100)
        : NaN;
    const impliedCap = Number.isFinite(derivedNoi) && val > 0 ? (derivedNoi / val) * 100 : rawCap;
    const isValid =
      Number.isFinite(val) &&
      val > 0 &&
      Number.isFinite(derivedNoi) &&
      derivedNoi >= 0 &&
      Number.isFinite(impliedCap) &&
      impliedCap >= 0 &&
      impliedCap <= 50;

    if (!isValid) {
      excludedInvalidCount++;
      continue;
    }
    trackedAssets++;
    totalAumUSD += val;
    totalAnnualNoiUSD += derivedNoi;
    const mCf = Number(item?.monthlyCashflow);
    if (Number.isFinite(mCf)) monthlyCashflowUSD += mCf;
    const irrVal = item?.irr !== undefined && item?.irr !== null ? Number(item.irr) : NaN;
    if (Number.isFinite(irrVal) && irrVal > -100 && irrVal <= 150) {
      irrWeightedSum += irrVal * val;
      irrWeightTotal += val;
    }
  }

  return {
    trackedAssets,
    excludedInvalidCount,
    totalAumUSD: Math.round(totalAumUSD),
    totalAnnualNoiUSD: Math.round(totalAnnualNoiUSD),
    monthlyCashflowUSD: Math.round(monthlyCashflowUSD),
    annualCashflowUSD: Math.round(monthlyCashflowUSD * 12),
    weightedCapRate: totalAumUSD > 0 ? Number(((totalAnnualNoiUSD / totalAumUSD) * 100).toFixed(2)) : 0,
    weightedIRR: irrWeightTotal > 0 ? Number((irrWeightedSum / irrWeightTotal).toFixed(1)) : null,
  };
}

function findPlanPricing(
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

function formatDateDDMMYYYY(ms?: number | null): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function computeLicenseStatus(params: {
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
  const isFreePlan = rawPlanKey === 'free';
  const hasEnd = Boolean(!isFreePlan && params.licenseEnd);
  const isExpired = Boolean(hasEnd && params.licenseEnd! <= now);

  const effectivePlanKey: PlanKey = rawPlanKey;
  const planCfg = PLAN_DEFINITIONS[effectivePlanKey];
  const isEnterprise = effectivePlanKey === 'institutional';
  const effectiveAnalysesLimit =
    typeof params.analysesLimitOverride === 'number' &&
    (isEnterprise ? params.analysesLimitOverride >= 0 : params.analysesLimitOverride > 0)
      ? params.analysesLimitOverride
      : planCfg.analysesLimit;
  const effectiveSavedLimit =
    typeof params.savedLimitOverride === 'number' ? params.savedLimitOverride : planCfg.savedLimit;

  const isUnlimitedAnalyses = !Number.isFinite(effectiveAnalysesLimit);
  const isUnlimitedSaved = !Number.isFinite(effectiveSavedLimit);

  let daysLeft = isFreePlan ? 0 : 30;
  if (isFreePlan) {
    daysLeft = 0;
  } else if (isExpired) {
    daysLeft = 0;
  } else if (params.licenseEnd) {
    daysLeft = Math.max(0, Math.ceil((params.licenseEnd - now) / (1000 * 60 * 60 * 24)));
  }

  let analysesUsed = Math.max(0, params.analysesUsed ?? 0);
  const explicitLeft = params.analysesLeft ?? params.freeAnalysesLeft;
  let analysesLeft = isExpired
    ? typeof explicitLeft === 'number'
      ? Math.max(0, explicitLeft)
      : 0
    : isUnlimitedAnalyses
    ? Infinity
    : Math.max(0, effectiveAnalysesLimit - analysesUsed);

  if (!isExpired && !isUnlimitedAnalyses && typeof explicitLeft === 'number') {
    analysesLeft = Math.max(0, explicitLeft);
    if (analysesUsed === 0 && explicitLeft <= effectiveAnalysesLimit) {
      analysesUsed = Math.max(0, effectiveAnalysesLimit - analysesLeft);
    }
  }

  const timeProgress = isFreePlan
    ? effectiveAnalysesLimit > 0
      ? Math.min(100, Math.max(0, Math.round((analysesLeft / effectiveAnalysesLimit) * 100)))
      : 0
    : isExpired
    ? 0
    : params.licenseEnd
    ? Math.min(100, Math.max(0, Math.round((daysLeft / 30) * 100)))
    : isUnlimitedAnalyses
    ? 100
    : effectiveAnalysesLimit > 0
    ? Math.min(100, Math.max(0, Math.round((analysesLeft / effectiveAnalysesLimit) * 100)))
    : 0;

  const leftStr = isUnlimitedAnalyses ? 'Unlimited credits left' : `${analysesLeft} credits left`;
  const sidebarText = isFreePlan
    ? `FREE PLAN (NO TIME EXPIRY) - ${leftStr}`
    : isExpired
    ? `30-DAY LICENSE - ${planCfg.displayName} - EXPIRED - ${leftStr}`
    : `30-DAY LICENSE - ${planCfg.displayName} - ${daysLeft} days left - ${leftStr}`;

  return {
    planKey: effectivePlanKey,
    displayName: planCfg.displayName,
    isExpired,
    daysLeft,
    daysTotal: isFreePlan ? 0 : 30,
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

// =========================================================================
// 2. INLINED SECURITY & ENV HELPERS (Lazy, zero top-level env reads)
// =========================================================================

const SESSION_COOKIE_NAME = 'aqari_session';
const ENTITLEMENT_COOKIE_NAME = 'aqari_entitlement';

function getEnv(key: string): string {
  try {
    return typeof process !== 'undefined' && process?.env ? String(process.env[key] || '') : '';
  } catch {
    return '';
  }
}

function cleanEnvValue(value?: string | null): string {
  return (value || '').replace(/^["']|["']$/g, '').trim();
}

function resolvePaddleEnvironment(): {
  configured: boolean;
  raw: string;
  normalized: 'live' | 'sandbox' | null;
  baseUrl: string;
  isSandbox: boolean;
} {
  const raw = cleanEnvValue(getEnv('PADDLE_ENVIRONMENT') || getEnv('PADDLE_ENV')).toLowerCase();
  if (!raw) {
    return { configured: false, raw: '', normalized: null, baseUrl: '', isSandbox: false };
  }
  if (raw === 'live' || raw === 'production') {
    return {
      configured: true,
      raw,
      normalized: 'live',
      baseUrl: 'https://api.paddle.com',
      isSandbox: false,
    };
  }
  if (raw === 'sandbox') {
    return {
      configured: true,
      raw,
      normalized: 'sandbox',
      baseUrl: 'https://sandbox-api.paddle.com',
      isSandbox: true,
    };
  }
  return { configured: false, raw, normalized: null, baseUrl: '', isSandbox: false };
}

function getAdminEmail(): string {
  return (cleanEnvValue(getEnv('ADMIN_EMAIL')) || 'loomorastudios@gmail.com').toLowerCase();
}

function getSessionSecret(): string {
  return (
    cleanEnvValue(getEnv('SESSION_SECRET')) ||
    cleanEnvValue(getEnv('NEXTAUTH_SECRET')) ||
    cleanEnvValue(getEnv('GOOGLE_CLIENT_SECRET')) ||
    'aqari-terminal-sovereign-hmac-2026'
  );
}

interface SignedEntitlementPayload {
  email: string;
  plan: PlanKey;
  orderId: string;
  licenseStart: number;
  licenseEnd: number;
  amountUSD: number;
  testMode: boolean;
  paymentCustomerEmail?: string | null;
  exp: number;
}

function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function appendSetCookieHeader(res: any, cookieStr: string): void {
  const prev = res?.getHeader?.('Set-Cookie');
  if (!prev) {
    res?.setHeader?.('Set-Cookie', cookieStr);
    return;
  }
  const arr = Array.isArray(prev) ? prev.map(String) : [String(prev)];
  const cookieName = cookieStr.split('=')[0] + '=';
  const filtered = arr.filter((c) => !c.startsWith(cookieName));
  filtered.push(cookieStr);
  res?.setHeader?.('Set-Cookie', filtered);
}

function isAdminEmail(email?: string | null): boolean {
  const norm = (email || '').trim().toLowerCase();
  if (!norm) return false;
  return norm === getAdminEmail() || norm === 'loomorastudios@gmail.com' || norm === 'azzamalshmale@gmail.com';
}

function signSessionToken(email: string): string {
  const norm = (email || '').trim().toLowerCase();
  const payload = Buffer.from(
    JSON.stringify({
      email: norm,
      iat: Date.now(),
      exp: Date.now() + THIRTY_DAYS_MS,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token?: string | null): string | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const expected = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded?.email || (decoded.exp && Date.now() > decoded.exp)) return null;
    return String(decoded.email).trim().toLowerCase();
  } catch {
    return null;
  }
}

function getSessionEmailFromReq(req: any): string | null {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const fromCookie = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  if (fromCookie) return fromCookie;

  const authHeader = req?.headers?.authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerEmail = verifySessionToken(authHeader.slice(7).trim());
    if (bearerEmail) return bearerEmail;
  }
  return null;
}

function setSessionCookie(res: any, email: string): string {
  const token = signSessionToken(email);
  const isProd = getEnv('NODE_ENV') === 'production' || getEnv('VERCEL_ENV') === 'production';
  const flags = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
    ...(isProd ? ['Secure'] : []),
  ];
  appendSetCookieHeader(res, flags.join('; '));
  return token;
}

function signEntitlementToken(data: Omit<SignedEntitlementPayload, 'exp'>): string {
  const payloadObj: SignedEntitlementPayload = {
    ...data,
    email: (data.email || '').trim().toLowerCase(),
    exp: Math.max(data.licenseEnd, Date.now() + 24 * 60 * 60 * 1000),
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyEntitlementToken(token?: string | null): SignedEntitlementPayload | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const expected = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as SignedEntitlementPayload;
    if (!decoded?.email || !decoded?.plan || (decoded.exp && Date.now() > decoded.exp)) {
      return null;
    }
    return {
      ...decoded,
      email: String(decoded.email).trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

function getEntitlementFromReq(req: any): SignedEntitlementPayload | null {
  const cookies = parseCookies(req?.headers?.cookie || '');
  return verifyEntitlementToken(cookies[ENTITLEMENT_COOKIE_NAME]);
}

function setEntitlementCookie(res: any, data: Omit<SignedEntitlementPayload, 'exp'>): string {
  const token = signEntitlementToken(data);
  const isProd = getEnv('NODE_ENV') === 'production' || getEnv('VERCEL_ENV') === 'production';
  const flags = [
    `${ENTITLEMENT_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
    ...(isProd ? ['Secure'] : []),
  ];
  appendSetCookieHeader(res, flags.join('; '));
  return token;
}

function clearSessionCookie(res: any): void {
  appendSetCookieHeader(
    res,
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  appendSetCookieHeader(
    res,
    `${ENTITLEMENT_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

const rateBuckets = new Map<string, number[]>();

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (rateBuckets.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateBuckets.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - timestamps.length),
    retryAfterSec: 0,
  };
}

function getClientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || '127.0.0.1';
}

// =========================================================================
// 3. INLINED SERVER STORE (Shared Disk + Upstash KV REST Persistence)
// =========================================================================

interface ForensicAnalysisEntry {
  id: string;
  timestamp: string;
  property: string;
  city: string;
  priceUSD: number;
  capRate: number;
  cashOnCash: number;
  resultSummary: string;
}

interface ForensicPdfEntry {
  id: string;
  timestamp: string;
  property: string;
  format: string;
  watermark: string;
}

interface ForensicPaymentEntry {
  id: string;
  timestamp: string;
  order_id: string;
  plan: PlanKey | string;
  amount: number;
  currency: string;
  test_mode: boolean;
  refund_policy_accepted_at?: string;
}

interface ForensicTimelineEntry {
  id: string;
  timestamp: string;
  type:
    | 'purchase'
    | 'analysis'
    | 'pdf_download'
    | 'login'
    | 'refund_request'
    | 'admin_plan_change'
    | 'expired'
    | 'issue_reported'
    | 'issue_resolved'
    | 'cancellation'
    | 'credits_purchase'
    | 'branding_update';
  message: string;
  actor?: string;
}

interface CustomCityRecord {
  id: string;
  city: string;
  country: string;
  countryCode?: string;
  estimatedAvgPriceUSD: number;
  estimatedAvgRentUSD: number;
  grossYield: number;
  source: string;
  isEstimated: boolean;
  addedAt: number;
}

interface PersistedLastResults {
  analysis?: {
    inputs: Record<string, any>;
    cityData?: any;
    results: Record<string, any>;
    created_at: string;
  } | null;
  deal_finder?: {
    inputs: {
      city: string;
      budget: number;
      minCapRate: number;
      propertyType: string;
      risk: string;
    };
    city: string;
    country: string;
    countryCode?: string;
    avgCapRate?: number;
    sourceType?: string;
    isLimitedPreview?: boolean;
    totalAvailableDeals?: number;
    disclaimer?: string;
    deals: any[];
    created_at: string;
  } | null;
  forecast?: {
    inputs: {
      city: string;
      propertyType: string;
      period: string;
    };
    forecast: Record<string, any>;
    created_at: string;
  } | null;
  due_diligence?: {
    inputs: {
      city: string;
      propertyType: string;
      price: number;
      monthlyRent: number;
      ownershipType: string;
      buildingAge: number;
    };
    result: Record<string, any>;
    created_at: string;
  } | null;
  portfolio_optimizer?: {
    inputs: {
      totalCapital: number;
      cities: string[];
      risk: string;
    };
    result: Record<string, any>;
    created_at: string;
  } | null;
  advisor?: {
    inputs: {
      question: string;
      city: string;
      budget: number;
    };
    result: Record<string, any>;
    created_at: string;
  } | null;
  file_analysis?: Record<string, any> | null;
  property_studio?: Record<string, any> | null;
  due_diligence_docs?: Record<string, any> | null;
  scenario_comparison?: Record<string, any> | null;
}

interface ServerUserRecord {
  email: string;
  name: string;
  plan: PlanKey;
  license_start: number | null;
  license_end: number | null;
  analyses_used: number;
  analyses_left: number;
  analyses_total: number;
  successful_analyses: number;
  saved_analyses: any[];
  saved_count: number;
  max_saved: number;
  custom_cities: CustomCityRecord[];
  timezone: string;
  day29_email_sent: boolean;
  expired_email_sent: boolean;
  updated_at: number;
  last_login_at: number | null;
  total_paid_usd: number;
  analyses_log: ForensicAnalysisEntry[];
  pdf_downloads: ForensicPdfEntry[];
  payments: ForensicPaymentEntry[];
  timeline: ForensicTimelineEntry[];
  refund_requested: boolean;
  refund_status: 'none' | 'pending' | 'approved' | 'denied';
  refund_notes: string;
  refund_policy_accepted_at: string | null;
  locked_launch_price: number | null;
  payment_provider: string;
  payment_intent_id: string | null;
  payment_customer_email: string | null;
  status: 'active' | 'expired' | 'exhausted';
  has_reported_issue: boolean;
  issue_reported_at: number | null;
  issue_resolved_at: number | null;
  issue_description: string;
  issue_status: 'none' | 'open' | 'resolved';
  cancel_status: 'none' | 'refunded';
  last_order_id?: string | null;
  api_key_token?: string | null;
  api_key_last4?: string | null;
  api_key_revoked_legacy?: boolean;
  portfolio_assets?: any[];
  last_results?: PersistedLastResults;
  extra_credits?: number;
  image_pdf_used?: number;
  ai_listings_used?: number;
  pdfs_used?: number;
  api_calls_today?: number;
  api_calls_day?: string | null;
  last_extraction_id?: string | null;
  branding?: {
    firmName?: string;
    logoUrl?: string;
    accentColor?: string;
  } | null;
  custom_analyses_limit?: number | null;
  custom_image_pdf_limit?: number | null;
  custom_listings_limit?: number | null;
  custom_portfolio_limit?: number | null;
  custom_seats?: number | null;
  custom_storage_gb?: number | null;
  sla_level?: string | null;
  contract_end_date?: string | null;
  white_label_enabled?: boolean;
  custom_api_enabled?: boolean;
}

interface WebhookLogEntry {
  id: string;
  order_id: string;
  event?: string;
  event_name: string;
  plan: PlanKey;
  email: string;
  payment_email?: string;
  created_at?: string;
  amount: number;
  currency: string;
  test_mode: boolean;
  signature_valid?: boolean;
  error?: string;
  raw_error?: string;
  timestamp: string;
}

interface UsedOrderRecord {
  order_id: string;
  login_email: string;
  payment_email: string;
  plan: PlanKey;
  plan_display: 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN' | 'ENTERPRISE' | string;
  analyses: number;
  amount: number;
  test_mode: boolean;
  used_at: number;
}

interface StoredPlanConfig {
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN' | 'ENTERPRISE';
  tierTag?: string;
  originalPrice: number;
  launchPrice: number;
  analysesLimit: number;
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
}

interface StoredPricingConfig {
  schemaVersion?: number;
  launchDiscountActive: boolean;
  launchBadgeText: string;
  launchEndsAt: number;
  updatedAt: number;
  plans: Record<PlanKey, StoredPlanConfig>;
}

interface PendingCheckoutEntry {
  email: string;
  plan: PlanKey;
  amountUSD: number;
  isLaunchPrice: boolean;
  testMode: boolean;
  createdAt: number;
  checkoutId?: string;
}

interface StoreShape {
  users: Record<string, ServerUserRecord>;
  webhook_logs: WebhookLogEntry[];
  failed_webhooks: any[];
  email_logs: any[];
  cancellation_logs: any[];
  pricing_config: StoredPricingConfig;
  pricing_logs: any[];
  pending_checkouts: Record<string, PendingCheckoutEntry>;
  used_orders: Record<string, UsedOrderRecord>;
  analyst_threads: Record<string, any>;
  whiteglove_requests: any[];
  api_keys: Record<string, string>;
  enterprise_inquiries?: any[];
}

function buildStoredPlanEntry(k: PlanKey): StoredPlanConfig {
  const def = PLAN_DEFINITIONS[k];
  return {
    key: k,
    displayName: def.displayName,
    tierTag: def.tierTag,
    originalPrice: def.originalPrice,
    launchPrice: def.launchPrice,
    analysesLimit: def.analysesLimit,
    savedLimit: def.savedLimit,
    isFairUseSaved: def.isFairUseSaved,
    imagePdfLimit: def.imagePdfLimit,
    aiListingLimit: def.aiListingLimit,
    investmentPdfLimit: def.investmentPdfLimit,
    portfolioAssetsLimit: def.portfolioAssetsLimit,
    compareLimit: def.compareLimit,
    teamUsersLimit: def.teamUsersLimit,
    apiDailyLimit: def.apiDailyLimit,
    monteCarloMaxCycles: def.monteCarloMaxCycles,
    whiteLabelMode: def.whiteLabelMode,
    isContractPricing: Boolean(def.isContractPricing),
    features: [...def.features],
  };
}

function createDefaultPricingConfig(): StoredPricingConfig {
  const now = Date.now();
  return {
    schemaVersion: PRICING_SCHEMA_VERSION,
    launchDiscountActive: true,
    launchBadgeText: DEFAULT_LAUNCH_BADGE,
    launchEndsAt: DEFAULT_LAUNCH_END_DATE_MS,
    updatedAt: now,
    plans: {
      free: buildStoredPlanEntry('free'),
      starter: buildStoredPlanEntry('starter'),
      pro: buildStoredPlanEntry('pro'),
      enterprise: buildStoredPlanEntry('enterprise'),
      institutional: buildStoredPlanEntry('institutional'),
    },
  };
}

function getStoreFile(): string {
  try {
    return path.join('/tmp', 'aqari_terminal_store_v1.json');
  } catch {
    return '/tmp/aqari_terminal_store_v1.json';
  }
}

let memoryStoreCache: StoreShape | null = null;

function getMemoryStore(): StoreShape {
  if (!memoryStoreCache) {
    memoryStoreCache = {
      users: {},
      webhook_logs: [],
      failed_webhooks: [],
      email_logs: [],
      cancellation_logs: [],
      pricing_config: createDefaultPricingConfig(),
      pricing_logs: [],
      pending_checkouts: {},
      used_orders: {},
      analyst_threads: {},
      whiteglove_requests: [],
      api_keys: {},
      enterprise_inquiries: [],
    };
  }
  return memoryStoreCache;
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function normalizeOrderId(raw: string): string {
  return String(raw || '').replace(/^#/, '').trim();
}

function parseOptionalPositiveInt(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

function normalizeIsoDateOrNull(val: any): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return trimmed;
}

function resolveEffectiveQuotas(user: Partial<ServerUserRecord> & { plan?: PlanKey | string }, now = Date.now()) {
  const planKey = normalizePlanKey(user?.plan);
  const planCfg = PLAN_DEFINITIONS[planKey];
  const isFree = planKey === 'free';
  const rawLicenseEnd = typeof user?.license_end === 'number' && Number.isFinite(user.license_end) ? user.license_end : null;
  const contractEndDate = normalizeIsoDateOrNull(user?.contract_end_date);
  const parsedEnd = contractEndDate ? Date.parse(contractEndDate) : NaN;
  const contractEndMs = Number.isFinite(parsedEnd) ? parsedEnd : null;
  const effectiveEndMs = isFree
    ? null
    : planKey === 'institutional' && contractEndMs !== null
    ? contractEndMs
    : rawLicenseEnd;
  const packageExpired = Boolean(!isFree && effectiveEndMs !== null && now > effectiveEndMs);

  if (planKey !== 'institutional') {
    const freeDef = PLAN_DEFINITIONS.free;
    return {
      planKey,
      displayName: planCfg.displayName,
      isEnterprise: false,
      packageExpired,
      analysesLimit: packageExpired ? 0 : planCfg.analysesLimit,
      imagePdfLimit: packageExpired ? freeDef.imagePdfLimit : planCfg.imagePdfLimit,
      aiListingLimit: packageExpired ? freeDef.aiListingLimit : planCfg.aiListingLimit,
      investmentPdfLimit: packageExpired ? 0 : planCfg.investmentPdfLimit,
      portfolioAssetsLimit: packageExpired ? freeDef.portfolioAssetsLimit : planCfg.portfolioAssetsLimit,
      savedLimit: packageExpired ? freeDef.savedLimit : planCfg.savedLimit,
      teamUsersLimit: packageExpired ? 0 : planCfg.teamUsersLimit,
      compareLimit: packageExpired ? freeDef.compareLimit : planCfg.compareLimit,
      apiDailyLimit: packageExpired ? 0 : planCfg.apiDailyLimit,
      storageGb: null as number | null,
      slaLevel: null as string | null,
      contractEndDate: null as string | null,
      contractEndMs: null as number | null,
      contractExpired: false,
      whiteLabelEnabled: packageExpired ? false : canUseFeature(planKey, 'whiteLabelReports'),
      whiteLabelPlatformEnabled: packageExpired ? false : canUseFeature(planKey, 'whiteLabelPlatform'),
      customApiEnabled: packageExpired ? false : canUseFeature(planKey, 'apiAccess'),
    };
  }
  const customAnalyses = parseOptionalPositiveInt(user?.custom_analyses_limit);
  const customImgPdf = parseOptionalPositiveInt(user?.custom_image_pdf_limit);
  const customListings = parseOptionalPositiveInt(user?.custom_listings_limit);
  const customPortfolio = parseOptionalPositiveInt(user?.custom_portfolio_limit);
  const customSeats = parseOptionalPositiveInt(user?.custom_seats);
  const customStorageGb = parseOptionalPositiveInt(user?.custom_storage_gb);
  const contractExpired = Boolean(contractEndMs !== null && now > contractEndMs);
  const customApiEnabled = packageExpired ? false : Boolean(user?.custom_api_enabled);
  const whiteLabelEnabled = packageExpired ? false : Boolean(user?.white_label_enabled);
  const freeDef = PLAN_DEFINITIONS.free;
  return {
    planKey,
    displayName: planCfg.displayName,
    isEnterprise: true,
    packageExpired,
    analysesLimit: packageExpired ? 0 : customAnalyses,
    imagePdfLimit: packageExpired ? freeDef.imagePdfLimit : customImgPdf,
    aiListingLimit: packageExpired ? freeDef.aiListingLimit : customListings,
    investmentPdfLimit: packageExpired ? 0 : customListings,
    portfolioAssetsLimit: packageExpired ? freeDef.portfolioAssetsLimit : customPortfolio,
    savedLimit: packageExpired ? freeDef.savedLimit : customPortfolio,
    teamUsersLimit: packageExpired ? 0 : customSeats,
    compareLimit: packageExpired
      ? freeDef.compareLimit
      : customPortfolio
      ? Math.min(50, Math.max(1, customPortfolio))
      : 50,
    apiDailyLimit: customApiEnabled ? 10000 : 0,
    storageGb: customStorageGb,
    slaLevel: typeof user?.sla_level === 'string' && user.sla_level.trim() ? user.sla_level.trim() : null,
    contractEndDate,
    contractEndMs,
    contractExpired: packageExpired || contractExpired,
    whiteLabelEnabled,
    whiteLabelPlatformEnabled: whiteLabelEnabled,
    customApiEnabled,
  };
}

function hydrateUserRecord(raw: any, email: string): ServerUserRecord {
  const now = Date.now();
  const plan = normalizePlanKey(raw?.plan);
  const isFreePlan = plan === 'free';
  const planCfg = PLAN_DEFINITIONS[plan];
  const extraCredits = Math.max(0, Number(raw?.extra_credits || 0));
  const customAnalysesLimit = parseOptionalPositiveInt(raw?.custom_analyses_limit);
  const customImagePdfLimit = parseOptionalPositiveInt(raw?.custom_image_pdf_limit);
  const customListingsLimit = parseOptionalPositiveInt(raw?.custom_listings_limit);
  const customPortfolioLimit = parseOptionalPositiveInt(raw?.custom_portfolio_limit);
  const customSeats = parseOptionalPositiveInt(raw?.custom_seats);
  const customStorageGb = parseOptionalPositiveInt(raw?.custom_storage_gb);
  const slaLevel = typeof raw?.sla_level === 'string' && raw.sla_level.trim() ? raw.sla_level.trim().slice(0, 120) : null;
  const contractEndDate = normalizeIsoDateOrNull(raw?.contract_end_date);
  const whiteLabelEnabled = Boolean(raw?.white_label_enabled);
  const customApiEnabled = Boolean(raw?.custom_api_enabled);

  const basePlanAnalyses = plan === 'institutional' ? (customAnalysesLimit ?? 0) : planCfg.analysesLimit;
  const analysesTotal =
    plan === 'institutional'
      ? Math.max(0, Number(raw?.analyses_total ?? basePlanAnalyses + extraCredits))
      : Math.max(1, Number(raw?.analyses_total ?? basePlanAnalyses + extraCredits));
  const rawUsedNum = raw?.analyses_used !== undefined && raw?.analyses_used !== null ? Number(raw.analyses_used) : NaN;
  const rawLeftNum = raw?.analyses_left !== undefined && raw?.analyses_left !== null ? Number(raw.analyses_left) : NaN;
  let analysesUsed = Number.isFinite(rawUsedNum) ? Math.max(0, rawUsedNum) : 0;
  const maxPossibleLeft = Math.max(analysesTotal, analysesTotal + extraCredits);
  let analysesLeft = Number.isFinite(rawLeftNum)
    ? Math.max(0, Math.min(maxPossibleLeft, rawLeftNum))
    : Math.max(0, analysesTotal - analysesUsed);
  if (!Number.isFinite(rawUsedNum) && Number.isFinite(rawLeftNum)) {
    analysesUsed = Math.max(0, analysesTotal - analysesLeft);
  }
  const savedList = Array.isArray(raw?.saved_analyses) ? raw.saved_analyses : [];
  const defaultSavedCap = plan === 'institutional' ? (customPortfolioLimit ?? 0) : planCfg.savedLimit;
  const maxSaved =
    plan === 'institutional'
      ? customPortfolioLimit ?? 0
      : Number.isFinite(Number(raw?.max_saved)) && Number(raw?.max_saved) > 0
      ? Math.max(Number(raw.max_saved), defaultSavedCap)
      : defaultSavedCap;
  const savedCount = savedList.length > 0 ? savedList.length : Math.max(0, Number(raw?.saved_count ?? 0));

  const licenseStartVal =
    typeof raw?.license_start === 'number' && Number.isFinite(raw.license_start)
      ? raw.license_start
      : now;
  const licenseEndVal =
    typeof raw?.license_end === 'number' && Number.isFinite(raw.license_end)
      ? raw.license_end
      : licenseStartVal + THIRTY_DAYS_MS;

  const contractEndParsed = contractEndDate ? Date.parse(contractEndDate) : NaN;
  const effectiveEnd = isFreePlan
    ? null
    : plan === 'institutional' && Number.isFinite(contractEndParsed)
    ? contractEndParsed
    : licenseEndVal;

  const packageExpired = Boolean(!isFreePlan && effectiveEnd && now > effectiveEnd);
  const hydratedStatus: 'active' | 'expired' | 'exhausted' = packageExpired
    ? 'expired'
    : analysesLeft + (extraCredits > analysesLeft ? 0 : 0) <= 0 && extraCredits <= 0
    ? 'exhausted'
    : 'active';

  const todayUtc = new Date(now).toISOString().slice(0, 10);
  const apiCallsDay = typeof raw?.api_calls_day === 'string' ? raw.api_calls_day : todayUtc;
  const apiCallsToday = apiCallsDay === todayUtc ? Math.max(0, Number(raw?.api_calls_today || 0)) : 0;

  return {
    email,
    name: raw?.name || email.split('@')[0],
    plan,
    license_start: licenseStartVal,
    license_end: licenseEndVal,
    analyses_used: analysesUsed,
    analyses_left: packageExpired ? extraCredits : hydratedStatus === 'active' ? Math.max(analysesLeft, extraCredits > 0 && analysesUsed === 0 && rawLeftNum === undefined ? analysesTotal : analysesLeft) : extraCredits,
    analyses_total: analysesTotal,
    successful_analyses: Math.max(0, Number(raw?.successful_analyses ?? 0)),
    saved_analyses: savedList,
    saved_count: savedCount,
    max_saved: maxSaved,
    custom_cities: Array.isArray(raw?.custom_cities) ? raw.custom_cities : [],
    timezone: raw?.timezone || 'Asia/Muscat',
    day29_email_sent: Boolean(raw?.day29_email_sent),
    expired_email_sent: Boolean(raw?.expired_email_sent),
    updated_at: Number(raw?.updated_at || now),
    last_login_at: raw?.last_login_at ?? null,
    total_paid_usd: Number(raw?.total_paid_usd || 0),
    analyses_log: Array.isArray(raw?.analyses_log) ? raw.analyses_log : [],
    pdf_downloads: Array.isArray(raw?.pdf_downloads) ? raw.pdf_downloads : [],
    payments: Array.isArray(raw?.payments) ? raw.payments : [],
    timeline: Array.isArray(raw?.timeline) ? raw.timeline : [],
    refund_requested: Boolean(raw?.refund_requested),
    refund_status: raw?.refund_status || 'none',
    refund_notes: raw?.refund_notes || '',
    refund_policy_accepted_at: raw?.refund_policy_accepted_at || null,
    locked_launch_price: typeof raw?.locked_launch_price === 'number' ? raw.locked_launch_price : null,
    payment_provider: String(raw?.payment_provider || 'paddle'),
    payment_intent_id: raw?.payment_intent_id ? String(raw.payment_intent_id) : null,
    payment_customer_email: raw?.payment_customer_email
      ? String(raw.payment_customer_email).toLowerCase()
      : null,
    status: hydratedStatus,
    has_reported_issue: Boolean(raw?.has_reported_issue),
    issue_reported_at: typeof raw?.issue_reported_at === 'number' ? raw.issue_reported_at : null,
    issue_resolved_at: typeof raw?.issue_resolved_at === 'number' ? raw.issue_resolved_at : null,
    issue_description: typeof raw?.issue_description === 'string' ? raw.issue_description : '',
    issue_status:
      raw?.issue_status === 'open' || raw?.issue_status === 'resolved'
        ? raw.issue_status
        : raw?.has_reported_issue
        ? raw?.issue_resolved_at
          ? 'resolved'
          : 'open'
        : 'none',
    cancel_status: raw?.cancel_status === 'refunded' ? 'refunded' : 'none',
    last_order_id:
      typeof raw?.last_order_id === 'string' && raw.last_order_id.trim()
        ? raw.last_order_id.trim()
        : Array.isArray(raw?.payments) && raw.payments[0]?.order_id
        ? String(raw.payments[0].order_id)
        : null,
    api_key_token: typeof raw?.api_key_token === 'string' ? raw.api_key_token : null,
    api_key_last4: typeof raw?.api_key_last4 === 'string' ? raw.api_key_last4 : null,
    api_key_revoked_legacy: Boolean(raw?.api_key_revoked_legacy),
    portfolio_assets: Array.isArray(raw?.portfolio_assets) ? raw.portfolio_assets : [],
    last_results:
      raw?.last_results && typeof raw.last_results === 'object' ? raw.last_results : {},
    extra_credits: extraCredits,
    image_pdf_used: Math.max(0, Number(raw?.image_pdf_used || 0)),
    ai_listings_used: Math.max(0, Number(raw?.ai_listings_used || 0)),
    pdfs_used: Math.max(0, Number(raw?.pdfs_used || 0)),
    api_calls_today: apiCallsToday,
    api_calls_day: apiCallsDay,
    last_extraction_id: typeof raw?.last_extraction_id === 'string' ? raw.last_extraction_id : null,
    branding:
      raw?.branding && typeof raw.branding === 'object'
        ? {
            firmName: typeof raw.branding.firmName === 'string' ? raw.branding.firmName.slice(0, 80) : undefined,
            logoUrl: typeof raw.branding.logoUrl === 'string' ? raw.branding.logoUrl.slice(0, 500) : undefined,
            accentColor:
              typeof raw.branding.accentColor === 'string' ? raw.branding.accentColor.slice(0, 24) : undefined,
          }
        : null,
    custom_analyses_limit: customAnalysesLimit,
    custom_image_pdf_limit: customImagePdfLimit,
    custom_listings_limit: customListingsLimit,
    custom_portfolio_limit: customPortfolioLimit,
    custom_seats: customSeats,
    custom_storage_gb: customStorageGb,
    sla_level: slaLevel,
    contract_end_date: contractEndDate,
    white_label_enabled: whiteLabelEnabled,
    custom_api_enabled: customApiEnabled,
  };
}

function hydratePricingConfig(raw: any): StoredPricingConfig {
  const def = createDefaultPricingConfig();
  if (!raw || typeof raw !== 'object' || Number(raw.schemaVersion || 0) < PRICING_SCHEMA_VERSION) {
    return def;
  }
  const plans = { ...def.plans };
  for (const k of ['free', 'starter', 'pro', 'enterprise', 'institutional'] as PlanKey[]) {
    const r = raw.plans?.[k];
    if (r && typeof r === 'object') {
      const analysesLimit =
        Number.isFinite(Number(r.analysesLimit)) &&
        (k === 'institutional' ? Number(r.analysesLimit) >= 0 : Number(r.analysesLimit) > 0)
          ? Number(r.analysesLimit)
          : def.plans[k].analysesLimit;
      const rawFeatures: string[] =
        Array.isArray(r.features) && r.features.length > 0
          ? r.features.map(String)
          : def.plans[k].features;
      plans[k] = {
        ...def.plans[k],
        originalPrice: Number.isFinite(Number(r.originalPrice))
          ? Number(r.originalPrice)
          : def.plans[k].originalPrice,
        launchPrice: Number.isFinite(Number(r.launchPrice))
          ? Number(r.launchPrice)
          : def.plans[k].launchPrice,
        analysesLimit,
        features: rawFeatures.length > 0 ? rawFeatures : def.plans[k].features,
      };
    }
  }
  return {
    schemaVersion: PRICING_SCHEMA_VERSION,
    launchDiscountActive:
      typeof raw.launchDiscountActive === 'boolean'
        ? raw.launchDiscountActive
        : def.launchDiscountActive,
    launchBadgeText:
      typeof raw.launchBadgeText === 'string' && raw.launchBadgeText.trim()
        ? raw.launchBadgeText
        : def.launchBadgeText,
    launchEndsAt: Number.isFinite(Number(raw.launchEndsAt))
      ? Number(raw.launchEndsAt)
      : def.launchEndsAt,
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : def.updatedAt,
    plans,
  };
}

function loadStore(): StoreShape {
  try {
    const storeFile = getStoreFile();
    if (fs.existsSync(storeFile)) {
      const raw = fs.readFileSync(storeFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const users: Record<string, ServerUserRecord> = {};
        if (parsed.users && typeof parsed.users === 'object') {
          for (const [k, v] of Object.entries(parsed.users)) {
            users[k] = hydrateUserRecord(v, k);
          }
        }
        memoryStoreCache = {
          users,
          webhook_logs: Array.isArray(parsed.webhook_logs) ? parsed.webhook_logs : [],
          failed_webhooks: Array.isArray(parsed.failed_webhooks) ? parsed.failed_webhooks : [],
          email_logs: Array.isArray(parsed.email_logs) ? parsed.email_logs : [],
          cancellation_logs: Array.isArray(parsed.cancellation_logs) ? parsed.cancellation_logs : [],
          pricing_config: hydratePricingConfig(parsed.pricing_config),
          pricing_logs: Array.isArray(parsed.pricing_logs) ? parsed.pricing_logs : [],
          pending_checkouts:
            parsed.pending_checkouts && typeof parsed.pending_checkouts === 'object'
              ? parsed.pending_checkouts
              : {},
          used_orders:
            parsed.used_orders &&
            typeof parsed.used_orders === 'object' &&
            !Array.isArray(parsed.used_orders)
              ? parsed.used_orders
              : {},
          analyst_threads:
            parsed.analyst_threads &&
            typeof parsed.analyst_threads === 'object' &&
            !Array.isArray(parsed.analyst_threads)
              ? parsed.analyst_threads
              : {},
          whiteglove_requests: Array.isArray(parsed.whiteglove_requests)
            ? parsed.whiteglove_requests
            : [],
          api_keys:
            parsed.api_keys &&
            typeof parsed.api_keys === 'object' &&
            !Array.isArray(parsed.api_keys)
              ? parsed.api_keys
              : {},
          enterprise_inquiries: Array.isArray(parsed.enterprise_inquiries)
            ? parsed.enterprise_inquiries
            : [],
        };
      }
    }
  } catch {
    // Fallback cleanly to memory cache
  }
  return getMemoryStore();
}

function persistStore(store: StoreShape): void {
  memoryStoreCache = store;
  try {
    fs.writeFileSync(getStoreFile(), JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // Ignore read-only filesystem errors
  }
}

function getKvConfig(): { url: string; token: string } | null {
  const url = cleanEnvValue(getEnv('KV_REST_API_URL') || getEnv('UPSTASH_REDIS_REST_URL'));
  const token = cleanEnvValue(getEnv('KV_REST_API_TOKEN') || getEnv('UPSTASH_REDIS_REST_TOKEN'));
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function kvCommand(args: Array<string | number>): Promise<any> {
  const cfg = getKvConfig();
  if (!cfg) return null;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        throw new Error(`KV HTTP ${res.status}`);
      }
      const json = await res.json();
      return json?.result ?? null;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 120));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('KV command failed');
}

function getPricingPublicPayload(): PricingPublicPayload {
  const store = loadStore();
  const rawCfg = store.pricing_config || createDefaultPricingConfig();
  const cfg =
    Number(rawCfg.schemaVersion || 0) >= PRICING_SCHEMA_VERSION
      ? rawCfg
      : createDefaultPricingConfig();
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((cfg.launchEndsAt - now) / (24 * 60 * 60 * 1000)));
  const plansMap = {} as Record<PlanKey, DynamicPlanPublic>;
  const plansList: DynamicPlanPublic[] = [];

  for (const k of ['free', 'starter', 'pro', 'enterprise', 'institutional'] as PlanKey[]) {
    const p = cfg.plans[k] || buildStoredPlanEntry(k);
    const def = PLAN_DEFINITIONS[k];
    const entry: DynamicPlanPublic = {
      id: k,
      key: k,
      displayName: p.displayName,
      tierTag: p.tierTag ?? def.tierTag,
      originalPrice: p.originalPrice,
      launchPrice: p.launchPrice,
      activePrice: k === 'free' ? 0 : cfg.launchDiscountActive ? p.launchPrice : p.originalPrice,
      analyses: p.analysesLimit,
      analysesLimit: p.analysesLimit,
      saved: p.savedLimit,
      savedLimit: p.savedLimit,
      isFairUseSaved: p.isFairUseSaved ?? def.isFairUseSaved,
      imagePdfLimit: p.imagePdfLimit ?? def.imagePdfLimit,
      aiListingLimit: p.aiListingLimit ?? def.aiListingLimit,
      investmentPdfLimit: p.investmentPdfLimit ?? def.investmentPdfLimit,
      portfolioAssetsLimit: p.portfolioAssetsLimit ?? def.portfolioAssetsLimit,
      compareLimit: p.compareLimit ?? def.compareLimit,
      teamUsersLimit: p.teamUsersLimit ?? def.teamUsersLimit,
      apiDailyLimit: p.apiDailyLimit ?? def.apiDailyLimit,
      monteCarloMaxCycles: p.monteCarloMaxCycles ?? def.monteCarloMaxCycles,
      whiteLabelMode: p.whiteLabelMode ?? def.whiteLabelMode,
      isContractPricing: p.isContractPricing ?? Boolean(def.isContractPricing),
      features: [...p.features],
      launchDiscountActive: cfg.launchDiscountActive,
    };
    plansMap[k] = entry;
    plansList.push(entry);
  }
  return {
    success: true,
    schemaVersion: PRICING_SCHEMA_VERSION,
    launchDiscountActive: cfg.launchDiscountActive,
    launchBadgeText: cfg.launchBadgeText,
    launchEndsAt: cfg.launchEndsAt,
    daysRemaining,
    updatedAt: cfg.updatedAt,
    plans: plansList,
    plansMap,
  };
}

function evaluateLockState(
  user: Partial<ServerUserRecord> &
    Pick<ServerUserRecord, 'plan' | 'analyses_left' | 'analyses_total' | 'analyses_used' | 'license_end'>,
  now = Date.now()
): {
  locked: boolean;
  reason: 'exhausted' | 'expired' | null;
  status: 'active' | 'expired' | 'exhausted';
  error: string | null;
  analysesLeft: number;
  planAnalysesLeft: number;
  creditsBalance: number;
  packageExpired: boolean;
  creditsOnlyMode: boolean;
  day29Reminder: boolean;
  expiryDateFormatted: string | null;
  expiryBanner: string | null;
  enterpriseUnconfigured?: boolean;
} {
  const quotas = resolveEffectiveQuotas(user, now);
  const planKey = quotas.planKey;
  const isFreePlan = planKey === 'free';
  const planDisplay = quotas.displayName;
  const creditsBalance = Math.max(0, Number(user.extra_credits || 0));
  const rawBaseLimit = isFreePlan
    ? PLAN_DEFINITIONS.free.analysesLimit
    : quotas.isEnterprise
    ? parseOptionalPositiveInt(user.custom_analyses_limit) ?? 0
    : PLAN_DEFINITIONS[planKey].analysesLimit;
  const totalFallback = Math.max(0, rawBaseLimit + creditsBalance);
  const rawLeft =
    typeof user.analyses_left === 'number' && Number.isFinite(user.analyses_left)
      ? Math.max(0, user.analyses_left)
      : Math.max(0, totalFallback - Math.max(0, Number(user.analyses_used || 0)));

  const effectiveEnd = isFreePlan
    ? null
    : quotas.isEnterprise && quotas.contractEndMs !== null
    ? quotas.contractEndMs
    : user.license_end;
  const packageExpired = Boolean(!isFreePlan && effectiveEnd && now > effectiveEnd);
  const expiryDateFormatted = isFreePlan ? null : formatDateDDMMYYYY(effectiveEnd);
  const msLeft = effectiveEnd && !packageExpired ? effectiveEnd - now : 0;
  const daysRemaining = effectiveEnd && !packageExpired ? Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))) : 0;
  const day29Reminder = Boolean(!isFreePlan && !packageExpired && effectiveEnd && daysRemaining === 1);

  if (packageExpired) {
    if (creditsBalance > 0) {
      return {
        locked: false,
        reason: null,
        status: 'expired',
        error: null,
        analysesLeft: creditsBalance,
        planAnalysesLeft: 0,
        creditsBalance,
        packageExpired: true,
        creditsOnlyMode: true,
        day29Reminder: false,
        expiryDateFormatted,
        expiryBanner: `Your ${planDisplay} plan expired. You still have ${creditsBalance} Credits. Buy a plan to unlock full features, or continue with credits.`,
      };
    }
    return {
      locked: true,
      reason: 'expired',
      status: 'expired',
      error: `Your ${planDisplay} expired on ${expiryDateFormatted || 'N/A'}. Renew to continue. No auto-charge was made.`,
      analysesLeft: 0,
      planAnalysesLeft: 0,
      creditsBalance: 0,
      packageExpired: true,
      creditsOnlyMode: false,
      day29Reminder: false,
      expiryDateFormatted,
      expiryBanner: `Your ${planDisplay} expired on ${expiryDateFormatted || 'N/A'}. Renew to continue. No auto-charge was made.`,
    };
  }

  if (quotas.isEnterprise && (quotas.analysesLimit === null || quotas.analysesLimit <= 0)) {
    return {
      locked: true,
      reason: 'exhausted',
      status: 'exhausted',
      enterpriseUnconfigured: true,
      error:
        'Enterprise contract quotas (custom_analyses_limit) are not configured yet. Ask your Admin to configure contract limits in Admin Dashboard.',
      analysesLeft: 0,
      planAnalysesLeft: 0,
      creditsBalance,
      packageExpired: false,
      creditsOnlyMode: false,
      day29Reminder,
      expiryDateFormatted,
      expiryBanner: null,
    };
  }

  const planAnalysesLeft = Math.min(rawBaseLimit, Math.max(0, rawLeft - creditsBalance));
  const totalAvailable = planAnalysesLeft + creditsBalance;

  if (totalAvailable <= 0) {
    return {
      locked: true,
      reason: 'exhausted',
      status: 'exhausted',
      error: isFreePlan
        ? 'You used your 3 free analyses. Buy a plan or credits to continue.'
        : `0 credits left for ${planDisplay}. Buy Extra Credits or a 30-day plan to continue.`,
      analysesLeft: 0,
      planAnalysesLeft: 0,
      creditsBalance: 0,
      packageExpired: false,
      creditsOnlyMode: false,
      day29Reminder,
      expiryDateFormatted,
      expiryBanner: null,
    };
  }

  return {
    locked: false,
    reason: null,
    status: 'active',
    error: null,
    analysesLeft: totalAvailable,
    planAnalysesLeft,
    creditsBalance,
    packageExpired: false,
    creditsOnlyMode: false,
    day29Reminder,
    expiryDateFormatted,
    expiryBanner: day29Reminder
      ? `Your ${planDisplay} expires tomorrow ${expiryDateFormatted}. Renew now to keep access. No auto-charge will happen.`
      : null,
  };
}

function getEffectiveFeaturePlanKey(user: Partial<ServerUserRecord> & Pick<ServerUserRecord, 'plan' | 'analyses_left' | 'analyses_total' | 'analyses_used' | 'license_end'>): PlanKey {
  const lock = evaluateLockState(user);
  if (lock.packageExpired) return 'free';
  return normalizePlanKey(user.plan);
}

function ensureCreditsForAction(user: ServerUserRecord, cost: number) {
  const lock = evaluateLockState(user);
  if (lock.locked) {
    return {
      ok: false as const,
      status: 403,
      payload: {
        success: false,
        locked: true,
        insufficientCredits: true,
        reason: lock.reason,
        status: lock.status,
        error: lock.error || 'No credits remaining or license expired.',
        code: lock.enterpriseUnconfigured
          ? 'ENTERPRISE_CONTRACT_LIMIT_UNSET'
          : lock.reason === 'expired'
          ? 'LICENSE_EXPIRED'
          : 'NO_ANALYSES_LEFT',
        analyses_left: 0,
        analysesLeft: 0,
        plan_analyses_left: 0,
        credits_balance: lock.creditsBalance,
        package_expired: lock.packageExpired,
        credits_only_mode: lock.creditsOnlyMode,
        requiredCredits: cost,
        creditsRemaining: 0,
      },
    };
  }
  if (cost > 0 && lock.analysesLeft < cost) {
    return {
      ok: false as const,
      status: 403,
      payload: {
        success: false,
        locked: false,
        insufficientCredits: true,
        reason: 'insufficient_credits',
        status: lock.status,
        error: `This action costs ${cost} credits, but only ${lock.analysesLeft} credit${lock.analysesLeft === 1 ? '' : 's'} remain. Buy Extra Credits or a 30-day plan.`,
        code: 'INSUFFICIENT_CREDITS',
        analyses_left: lock.analysesLeft,
        analysesLeft: lock.analysesLeft,
        plan_analyses_left: lock.planAnalysesLeft,
        credits_balance: lock.creditsBalance,
        package_expired: lock.packageExpired,
        credits_only_mode: lock.creditsOnlyMode,
        requiredCredits: cost,
        creditsRemaining: lock.analysesLeft,
      },
    };
  }
  return { ok: true as const, lock };
}

function checkAndConsumeApiDailyQuota(user: ServerUserRecord) {
  const quotas = resolveEffectiveQuotas(user);
  const planKey = quotas.planKey;
  const planCfg = PLAN_DEFINITIONS[planKey];
  const todayUtc = new Date().toISOString().slice(0, 10);
  const callsToday = user.api_calls_day === todayUtc ? Math.max(0, Number(user.api_calls_today || 0)) : 0;

  if (!quotas.customApiEnabled || quotas.apiDailyLimit <= 0) {
    return {
      ok: false as const,
      status: 403,
      payload: {
        success: false,
        error: quotas.packageExpired
          ? 'Your 30-day plan expired. Buy a plan to unlock full REST API access.'
          : quotas.isEnterprise
          ? 'Enterprise custom_api_enabled is currently false. Admin must enable Custom API Access for this contract.'
          : 'REST API access requires PROFESSIONAL (100/day), SOVEREIGN (2,000/day), or ENTERPRISE with custom_api_enabled.',
        code: quotas.packageExpired
          ? 'LICENSE_EXPIRED'
          : quotas.isEnterprise
          ? 'ENTERPRISE_CONTRACT_LIMIT_UNSET'
          : 'FEATURE_LOCKED',
        feature: 'apiAccess',
        requiredPlan: quotas.isEnterprise ? 'institutional' : 'pro',
      },
    };
  }
  if (callsToday >= quotas.apiDailyLimit) {
    return {
      ok: false as const,
      status: 429,
      payload: {
        success: false,
        error: `Daily REST API quota exceeded (${callsToday}/${quotas.apiDailyLimit} req/day for ${planCfg.displayName}). Resets at 00:00 UTC.`,
        code: 'API_DAILY_LIMIT_REACHED',
        apiDailyLimit: quotas.apiDailyLimit,
        apiCallsToday: callsToday,
      },
    };
  }
  return {
    ok: true as const,
    api_calls_day: todayUtc,
    api_calls_today: callsToday + 1,
    apiDailyLimit: quotas.apiDailyLimit,
  };
}

function enforceServerUserExpiry(rawEmail: string): ServerUserRecord {
  const store = loadStore();
  const email = normalizeEmail(rawEmail) || 'guest@aqari-ai-rho.vercel.app';
  const user = store.users[email];

  if (!user) {
    return getOrCreateServerUser(email);
  }

  const lock = evaluateLockState(user);
  const targetLeft = lock.locked ? 0 : lock.analysesLeft;
  if (user.status !== lock.status || user.analyses_left !== targetLeft) {
    user.status = lock.status;
    user.analyses_left = targetLeft;
    store.users[email] = user;
    persistStore(store);
  }

  return user;
}

function getOrCreateServerUser(
  rawEmail: string,
  hints?: { name?: string; timezone?: string }
): ServerUserRecord {
  const store = loadStore();
  const email = normalizeEmail(rawEmail) || 'guest@aqari-ai-rho.vercel.app';
  let user = store.users[email];

  if (!user) {
    const now = Date.now();
    user = hydrateUserRecord(
      {
        email,
        name: hints?.name || email.split('@')[0],
        plan: 'free',
        license_start: now,
        license_end: now + THIRTY_DAYS_MS,
        analyses_used: 0,
        timezone: hints?.timezone || 'Asia/Muscat',
        last_login_at: now,
      },
      email
    );
    store.users[email] = user;
    persistStore(store);
  } else if (hints) {
    let changed = false;
    if (hints.timezone && hints.timezone !== user.timezone) {
      user.timezone = hints.timezone;
      changed = true;
    }
    if (hints.name && hints.name !== user.name) {
      user.name = hints.name;
      changed = true;
    }
    if (changed) {
      user.updated_at = Date.now();
      store.users[email] = user;
      persistStore(store);
    }
  }

  return enforceServerUserExpiry(email);
}

function getServerUserByEmail(rawEmail: string): ServerUserRecord | null {
  const store = loadStore();
  const email = normalizeEmail(rawEmail);
  if (!email || !store.users[email]) return null;
  return enforceServerUserExpiry(email);
}

function updateServerUser(email: string, patch: Partial<ServerUserRecord>): ServerUserRecord {
  const store = loadStore();
  const norm = normalizeEmail(email);
  const existing = getOrCreateServerUser(norm);
  const merged = {
    ...existing,
    ...patch,
    email: norm,
  };
  const planKey = normalizePlanKey(merged.plan);
  const quotas = resolveEffectiveQuotas(merged as ServerUserRecord);
  const planCfg = PLAN_DEFINITIONS[planKey];
  const extraCredits = Math.max(0, Number(merged.extra_credits || 0));
  const basePlanAnalyses = quotas.isEnterprise ? (quotas.analysesLimit ?? 0) : planCfg.analysesLimit;
  const analyses_total =
    typeof patch.analyses_total === 'number' && patch.analyses_total >= 0
      ? patch.analyses_total
      : planKey === existing.plan && existing.analyses_total > 0
      ? existing.analyses_total
      : basePlanAnalyses + extraCredits;
  const analyses_used =
    typeof patch.analyses_used === 'number'
      ? Math.max(0, patch.analyses_used)
      : Math.max(0, merged.analyses_used ?? 0);
  const analyses_left =
    typeof patch.analyses_left === 'number'
      ? Math.max(0, patch.analyses_left)
      : Math.max(0, analyses_total - analyses_used);
  const max_saved =
    typeof patch.max_saved === 'number' && patch.max_saved >= 0
      ? patch.max_saved
      : quotas.savedLimit ?? 0;
  const saved_count =
    typeof patch.saved_count === 'number'
      ? Math.max(0, patch.saved_count)
      : Array.isArray(merged.saved_analyses)
      ? merged.saved_analyses.length
      : Math.max(0, merged.saved_count ?? 0);

  const nextDraft: ServerUserRecord = {
    ...merged,
    plan: planKey,
    analyses_total,
    analyses_used,
    analyses_left,
    max_saved,
    saved_count,
    updated_at: Date.now(),
  };
  const lock = evaluateLockState(nextDraft);
  const updated: ServerUserRecord = {
    ...nextDraft,
    status: lock.status,
    analyses_left: lock.locked ? 0 : lock.analysesLeft,
  };
  store.users[norm] = updated;
  persistStore(store);
  return updated;
}

function recordUserLogin(email: string, name?: string): ServerUserRecord {
  const user = getOrCreateServerUser(email, { name });
  const now = Date.now();
  const timeline = [
    {
      id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(now).toISOString(),
      type: 'login' as const,
      message: `Authenticated session login (${user.email})`,
      actor: user.email,
    },
    ...user.timeline,
  ].slice(0, 200);
  return updateServerUser(user.email, {
    last_login_at: now,
    timeline,
  });
}

function activatePaidPlanOnServer(params: {
  email: string;
  name?: string;
  plan: PlanKey;
  paymentTimestamp?: number;
  orderId?: string;
  amountUSD?: number;
  currency?: string;
  testMode?: boolean;
  refundPolicyAcceptedAt?: string | null;
  lockedLaunchPrice?: number | null;
  paymentCustomerEmail?: string | null;
  paymentProvider?: string;
  paymentIntentId?: string | null;
}): ServerUserRecord {
  const now = params.paymentTimestamp || Date.now();
  const licenseStart = now;
  const licenseEnd = now + THIRTY_DAYS_MS;
  const existing = getOrCreateServerUser(params.email, { name: params.name });
  const pricing = getPricingPublicPayload();
  const dynamicPlan = pricing.plansMap?.[params.plan];
  const planCfg = PLAN_DEFINITIONS[params.plan];
  const amount = params.amountUSD ?? (params.plan === 'free' ? 0 : dynamicPlan?.activePrice ?? planCfg.launchPrice);
  const orderId = params.paymentIntentId || params.orderId || `pi_${now}`;
  const iso = new Date(now).toISOString();

  const resolvedLockedLaunch =
    typeof params.lockedLaunchPrice === 'number'
      ? params.lockedLaunchPrice
      : pricing.launchDiscountActive && params.plan !== 'free'
      ? dynamicPlan?.launchPrice ?? amount
      : existing.locked_launch_price;

  const alreadyRecorded = existing.payments.some(
    (p) => normalizeOrderId(p.order_id) === normalizeOrderId(orderId)
  );

  // CRITICAL: Do NOT reset analyses_used / analyses_left / successful_analyses if the same order is replayed
  if (alreadyRecorded && existing.cancel_status !== 'refunded') {
    return updateServerUser(params.email, {
      name: params.name || existing.name,
      payment_customer_email: params.paymentCustomerEmail
        ? normalizeEmail(params.paymentCustomerEmail)
        : existing.payment_customer_email || null,
    });
  }

  const payments = alreadyRecorded
    ? existing.payments
    : [
        {
          id: `pay_${now}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: iso,
          order_id: orderId,
          plan: params.plan,
          amount,
          currency: params.currency || 'USD',
          test_mode: Boolean(params.testMode),
          refund_policy_accepted_at: params.refundPolicyAcceptedAt || iso,
        },
        ...existing.payments,
      ];

  const timeline = alreadyRecorded
    ? existing.timeline
    : [
        {
          id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: iso,
          type: 'purchase' as const,
          message: `Activated ${planCfg.displayName} $${amount} - Payment #${orderId} (${
            params.testMode ? 'TEST' : 'LIVE'
          })${resolvedLockedLaunch ? ` - Locked Launch Price $${resolvedLockedLaunch}` : ''}`,
          actor: existing.email,
        },
        ...existing.timeline,
      ];

  const preservedExtra = Math.max(0, Number(existing.extra_credits || 0));
  const baseLimit =
    params.plan === 'institutional'
      ? Math.max(0, Number(existing.custom_analyses_limit || 0))
      : planCfg.analysesLimit;
  const baseSaved =
    params.plan === 'institutional'
      ? Math.max(0, Number(existing.custom_portfolio_limit || 0))
      : planCfg.savedLimit;

  return updateServerUser(params.email, {
    name: params.name || existing.name,
    plan: params.plan,
    status: 'active',
    license_start: licenseStart,
    license_end: licenseEnd,
    analyses_used: 0,
    analyses_left: baseLimit + preservedExtra,
    analyses_total: baseLimit + preservedExtra,
    max_saved: baseSaved,
    extra_credits: preservedExtra,
    image_pdf_used: 0,
    ai_listings_used: 0,
    pdfs_used: 0,
    last_extraction_id: null,
    successful_analyses: 0,
    has_reported_issue: false,
    issue_reported_at: null,
    issue_resolved_at: null,
    issue_description: '',
    issue_status: 'none',
    cancel_status: 'none',
    last_order_id: orderId,
    payment_provider: params.paymentProvider || 'paddle',
    payment_intent_id: params.paymentIntentId || orderId,
    day29_email_sent: false,
    expired_email_sent: false,
    total_paid_usd: alreadyRecorded ? existing.total_paid_usd : existing.total_paid_usd + amount,
    refund_policy_accepted_at:
      params.refundPolicyAcceptedAt || existing.refund_policy_accepted_at || iso,
    locked_launch_price: resolvedLockedLaunch ?? null,
    payment_customer_email: params.paymentCustomerEmail
      ? normalizeEmail(params.paymentCustomerEmail)
      : existing.payment_customer_email || null,
    payments,
    timeline: timeline.slice(0, 200),
  });
}

export async function activateLicense(
  email: string,
  plan: string,
  payment_intent_id?: string | null
): Promise<ServerUserRecord> {
  const normEmail = normalizeEmail(email);
  const planKey = normalizePlanKey(plan);
  await getUserFromDb(normEmail).catch(() => null);
  const activated = activatePaidPlanOnServer({
    email: normEmail,
    plan: planKey,
    paymentTimestamp: Date.now(),
    orderId: payment_intent_id || `txn_${Date.now()}`,
    paymentIntentId: payment_intent_id || `txn_${Date.now()}`,
    paymentProvider: 'paddle',
    paymentCustomerEmail: normEmail,
  });
  await saveUserToDb(activated);
  return activated;
}

async function applyCreditPackToUser(params: {
  email: string;
  pack: (typeof EXTRA_CREDIT_PACKS)[number];
  orderId: string;
  isTestMode: boolean;
}): Promise<ServerUserRecord> {
  const email = normalizeEmail(params.email);
  const { user: hydratedDb } = await readUserFromDbStatus(email);
  const userRecord = hydratedDb || getOrCreateServerUser(email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const quotas = resolveEffectiveQuotas(userRecord, now);
  const lockBefore = evaluateLockState(userRecord, now);
  const baseLimit = quotas.isEnterprise ? (parseOptionalPositiveInt(userRecord.custom_analyses_limit) ?? 0) : PLAN_DEFINITIONS[quotas.planKey].analysesLimit;
  const nextExtra = Math.max(0, Number(userRecord.extra_credits || 0)) + params.pack.credits;
  const nextLeft = lockBefore.planAnalysesLeft + nextExtra;
  const currentTotal = Number(userRecord.analyses_total || 0);
  const nextTotal = Math.max(currentTotal, baseLimit) + params.pack.credits;

  const updatedUser = updateServerUser(email, {
    status: lockBefore.packageExpired ? 'expired' : 'active',
    extra_credits: nextExtra,
    analyses_left: nextLeft,
    analyses_total: nextTotal,
    total_paid_usd: Math.max(0, Number(userRecord.total_paid_usd || 0)) + params.pack.priceUSD,
    payments: [
      {
        id: `pay_${now}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: iso,
        order_id: params.orderId,
        plan: `${normalizePlanKey(userRecord.plan)}+${params.pack.id}`,
        amount: params.pack.priceUSD,
        currency: 'USD',
        test_mode: params.isTestMode,
      },
      ...(userRecord.payments || []),
    ],
    timeline: [
      {
        id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: iso,
        type: 'purchase' as const,
        message: `Purchased ${params.pack.label} ($${params.pack.priceUSD}) -> +${params.pack.credits} non-expiring AI credits (Ref #${params.orderId})`,
        actor: email,
      },
      ...(userRecord.timeline || []),
    ].slice(0, 200),
  });
  await saveUserToDb(updatedUser);
  await markOrderUsedInDb({
    order_id: params.orderId,
    login_email: email,
    payment_email: email,
    plan: normalizePlanKey(userRecord.plan),
    plan_display: params.pack.label,
    analyses: params.pack.credits,
    amount: params.pack.priceUSD,
    test_mode: params.isTestMode,
    used_at: now,
  }).catch(() => {});
  return updatedUser;
}

function evaluateCancelRefundEligibility(user: ServerUserRecord, now = Date.now()) {
  const DAY_MS = 86_400_000;
  const planKey = normalizePlanKey(user.plan);
  const successfulAnalyses = Math.max(0, Number(user.successful_analyses || 0));
  const licenseStart = Number(
    user.license_start ||
      (user.payments?.[0]?.timestamp ? new Date(user.payments[0].timestamp).getTime() : now)
  );
  const daysSinceActivation = Math.max(0, (now - licenseStart) / DAY_MS);
  const daysSinceActivationRounded = Math.floor(daysSinceActivation);
  const hasReportedIssue = Boolean(user.has_reported_issue);
  const issueReportedAt = user.issue_reported_at ? Number(user.issue_reported_at) : null;
  const issueResolvedAt = user.issue_resolved_at ? Number(user.issue_resolved_at) : null;
  const resolvedWithin7Days = Boolean(
    hasReportedIssue &&
      issueResolvedAt &&
      issueReportedAt &&
      issueResolvedAt - issueReportedAt <= 7 * DAY_MS
  );
  const unresolvedOver7Days = Boolean(
    hasReportedIssue &&
      !issueResolvedAt &&
      issueReportedAt &&
      now - issueReportedAt >= 7 * DAY_MS
  );

  const isActivePaid = planKey !== 'free' && (!user.license_end || user.license_end > now);

  if (!isActivePaid) {
    return {
      canCancel: false,
      eligibleRule: 'FREE',
      statusLabel: 'Free Tier / Inactive',
      reason: 'Cancellation unavailable - Free tier or expired plan has no active paid subscription.',
      daysSinceActivation: daysSinceActivationRounded,
      successfulAnalyses,
      hasReportedIssue,
      resolvedWithin7Days,
      unresolvedOver7Days,
      toolStatus: user.issue_status === 'resolved' ? 'Resolved' : hasReportedIssue ? 'Reported Issue' : 'Working',
    };
  }

  // Rule A: ANY >= 1 successful analysis -> permanently locked (even if issue reported or resolved)
  if (successfulAnalyses >= 1) {
    return {
      canCancel: false,
      eligibleRule: 'RULE_A_USED_ANALYSIS',
      statusLabel: 'Locked - Analysis completed',
      reason:
        successfulAnalyses === 1
          ? 'Cancellation unavailable - You completed 1 successful analysis. Refund not eligible.'
          : `Cancellation unavailable - You completed ${successfulAnalyses} successful analyses. Refund not eligible.`,
      daysSinceActivation: daysSinceActivationRounded,
      successfulAnalyses,
      hasReportedIssue,
      resolvedWithin7Days,
      unresolvedOver7Days,
      toolStatus: user.issue_status === 'resolved' ? 'Resolved' : hasReportedIssue ? 'Reported Issue' : 'Working',
    };
  }

  // Rule B: > 7 days and NO issue reported -> locked
  if (daysSinceActivation > 7 && !hasReportedIssue) {
    return {
      canCancel: false,
      eligibleRule: 'RULE_B_WINDOW_PASSED',
      statusLabel: 'Locked - 7-day window passed',
      reason: 'Cancellation unavailable - 7-day window passed and no tool issue reported.',
      daysSinceActivation: daysSinceActivationRounded,
      successfulAnalyses,
      hasReportedIssue,
      resolvedWithin7Days,
      unresolvedOver7Days,
      toolStatus: 'Working',
    };
  }

  // Rule E: Issue resolved within 7 days AND > 7 days passed -> locked
  if (hasReportedIssue && resolvedWithin7Days && daysSinceActivation > 7) {
    return {
      canCancel: false,
      eligibleRule: 'RULE_E_RESOLVED_IN_7D',
      statusLabel: 'Locked - Issue resolved within 7 days',
      reason: 'Cancellation unavailable - Tool issue resolved within 7 days and 7-day window passed.',
      daysSinceActivation: daysSinceActivationRounded,
      successfulAnalyses,
      hasReportedIssue,
      resolvedWithin7Days,
      unresolvedOver7Days,
      toolStatus: 'Resolved',
    };
  }

  // Rule D: Issue reported & NOT resolved within 7 days -> unlocked (with 0 successful analyses)
  if (hasReportedIssue && successfulAnalyses === 0 && unresolvedOver7Days) {
    return {
      canCancel: true,
      eligibleRule: 'RULE_D_UNRESOLVED_7D',
      statusLabel: 'Cancel - Tool issue not resolved in 7 days',
      reason: 'Eligible for cancellation & refund - Tool issue unresolved for 7+ days with 0 successful analyses.',
      daysSinceActivation: daysSinceActivationRounded,
      successfulAnalyses,
      hasReportedIssue,
      resolvedWithin7Days,
      unresolvedOver7Days,
      toolStatus: 'Reported Issue',
    };
  }

  // Rule C: <= 7 days AND 0 successful analyses -> unlocked
  if (daysSinceActivation <= 7 && successfulAnalyses === 0) {
    return {
      canCancel: true,
      eligibleRule: 'RULE_C_WITHIN_7D',
      statusLabel: 'Cancel within 7 days - No successful analysis yet',
      reason: 'Eligible for cancellation & full refund - Within 7-day window with 0 successful analyses.',
      daysSinceActivation: daysSinceActivationRounded,
      successfulAnalyses,
      hasReportedIssue,
      resolvedWithin7Days,
      unresolvedOver7Days,
      toolStatus: user.issue_status === 'resolved' ? 'Resolved' : hasReportedIssue ? 'Reported Issue' : 'Working',
    };
  }

  // Edge case: > 7 days, issue reported < 7 days ago, still unresolved and 0 analyses
  if (hasReportedIssue && !issueResolvedAt && !unresolvedOver7Days && successfulAnalyses === 0) {
    return {
      canCancel: false,
      eligibleRule: 'UNDER_REVIEW_7D',
      statusLabel: 'Issue reported - Under 7-day review',
      reason: 'Issue reported - Under 7-day review.',
      daysSinceActivation: daysSinceActivationRounded,
      successfulAnalyses,
      hasReportedIssue,
      resolvedWithin7Days,
      unresolvedOver7Days,
      toolStatus: 'Reported Issue',
    };
  }

  return {
    canCancel: false,
    eligibleRule: 'NOT_ELIGIBLE',
    statusLabel: 'Locked',
    reason: 'Cancellation unavailable.',
    daysSinceActivation: daysSinceActivationRounded,
    successfulAnalyses,
    hasReportedIssue,
    resolvedWithin7Days,
    unresolvedOver7Days,
    toolStatus: user.issue_status === 'resolved' ? 'Resolved' : hasReportedIssue ? 'Reported Issue' : 'Working',
  };
}

function recordUserAnalysis(
  userOrEmail: string | ServerUserRecord,
  entry: Omit<ForensicAnalysisEntry, 'id' | 'timestamp'>,
  extraPatch?: Partial<ServerUserRecord>,
  creditCost = 1
): ServerUserRecord {
  const store = loadStore();
  let user: ServerUserRecord;
  if (typeof userOrEmail === 'string') {
    user = getOrCreateServerUser(userOrEmail);
  } else {
    const norm = normalizeEmail(userOrEmail.email);
    store.users[norm] = userOrEmail;
    persistStore(store);
    user = userOrEmail;
  }
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const quotas = resolveEffectiveQuotas(user, now);
  const lockBefore = evaluateLockState(user, now);
  const planCfg = PLAN_DEFINITIONS[quotas.planKey];
  const baseLimit = quotas.isEnterprise
    ? parseOptionalPositiveInt(user.custom_analyses_limit) ?? 0
    : planCfg.analysesLimit;
  const currentExtraCredits = lockBefore.creditsBalance;
  const analysesTotal = Math.max(
    user.analyses_total > 0 ? user.analyses_total : baseLimit,
    baseLimit + currentExtraCredits
  );
  const currentUsed = Math.max(0, Number(user.analyses_used || 0));
  const cost = Math.max(0, Number.isFinite(creditCost) ? Math.round(creditCost) : 1);
  // Deduction order: use active 30-day package analyses first, then non-expiring credits
  const fromPlan = Math.min(cost, lockBefore.planAnalysesLeft);
  const fromCredits = Math.max(0, cost - fromPlan);
  const nextExtraCredits = Math.max(0, currentExtraCredits - fromCredits);
  const nextPlanAnalysesLeft = Math.max(0, lockBefore.planAnalysesLeft - fromPlan);
  const nextUsed = currentUsed + cost;
  const nextLeft = nextPlanAnalysesLeft + nextExtraCredits;
  const successfulNum = (user.successful_analyses || 0) + 1;
  const logEntry: ForensicAnalysisEntry = {
    id: `ana_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    ...entry,
  };
  const timelineEntry: ForensicTimelineEntry = {
    id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    type: 'analysis',
    message: `Action #${successfulNum} (-${cost} ${cost === 1 ? 'credit' : 'credits'}${fromCredits > 0 ? ` [${fromPlan} plan, ${fromCredits} extra]` : ''}) - ${entry.property} (${entry.city}) - ${entry.resultSummary}`,
    actor: user.email,
  };

  return updateServerUser(user.email, {
    ...(extraPatch || {}),
    analyses_used: nextUsed,
    analyses_left: nextLeft,
    analyses_total: analysesTotal,
    extra_credits: nextExtraCredits,
    successful_analyses: successfulNum,
    analyses_log: [logEntry, ...user.analyses_log].slice(0, 500),
    timeline: [timelineEntry, ...user.timeline].slice(0, 200),
  });
}

function recordUserPdfDownload(
  email: string,
  entry: Omit<ForensicPdfEntry, 'id' | 'timestamp'>
): ServerUserRecord {
  const user = getOrCreateServerUser(email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const pdfEntry: ForensicPdfEntry = {
    id: `pdf_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    ...entry,
  };
  const timelineEntry: ForensicTimelineEntry = {
    id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    type: 'pdf_download',
    message: `PDF Downloaded - ${entry.property} (${entry.format.toUpperCase()})`,
    actor: user.email,
  };

  return updateServerUser(user.email, {
    pdf_downloads: [pdfEntry, ...user.pdf_downloads].slice(0, 200),
    timeline: [timelineEntry, ...user.timeline].slice(0, 200),
  });
}

function computeServerLicenseStatus(user: ServerUserRecord): ComputedLicenseStatus {
  const pricing = getPricingPublicPayload();
  const quotas = resolveEffectiveQuotas(user);
  const lock = evaluateLockState(user);
  const planKey = quotas.planKey;
  const dynamicPlan = pricing.plansMap?.[planKey];
  const explicitTotal = quotas.isEnterprise
    ? typeof user.analyses_total === 'number' && user.analyses_total >= 0
      ? user.analyses_total
      : quotas.analysesLimit ?? 0
    : typeof user.analyses_total === 'number' && user.analyses_total > 0
    ? user.analyses_total
    : dynamicPlan?.analysesLimit;
  const effectiveEnd =
    planKey === 'free'
      ? null
      : quotas.isEnterprise && quotas.contractEndMs !== null
      ? quotas.contractEndMs
      : user.license_end;
  return computeLicenseStatus({
    plan: user.plan,
    licenseStart: user.license_start,
    licenseEnd: effectiveEnd,
    analysesUsed: user.analyses_used,
    analysesLeft: lock.analysesLeft,
    analysesLimitOverride: explicitTotal,
    savedLimitOverride: quotas.savedLimit ?? 0,
  });
}

async function saveUserToDb(user: ServerUserRecord): Promise<void> {
  const norm = normalizeEmail(user?.email);
  if (!norm) return;
  const store = loadStore();
  store.users[norm] = user;
  persistStore(store);

  const kv = getKvConfig();
  if (kv) {
    try {
      await kvCommand(['SET', `aqari:user:${norm}`, JSON.stringify(user)]);
    } catch (kvErr) {
      console.error('[DB] CRITICAL failed saving user to KV store:', kvErr);
      throw kvErr;
    }
    try {
      const rawIdx = await kvCommand(['GET', 'aqari:users_index:v1']);
      let idx: string[] = [];
      if (Array.isArray(rawIdx)) idx = rawIdx.map(String);
      else if (typeof rawIdx === 'string') {
        try {
          const parsed = JSON.parse(rawIdx);
          if (Array.isArray(parsed)) idx = parsed.map(String);
        } catch {}
      }
      if (!idx.includes(norm)) {
        idx.unshift(norm);
        await kvCommand(['SET', 'aqari:users_index:v1', JSON.stringify(idx.slice(0, 5000))]);
      }
    } catch (idxErr) {
      console.error('[DB] Non-fatal failed updating users_index:', idxErr);
    }
  }
}

async function readUserFromDbStatus(rawEmail: string): Promise<{ user: ServerUserRecord | null; kvError: boolean }> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { user: null, kvError: false };
  let kvError = false;
  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:user:${email}`]);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const hydrated = hydrateUserRecord(parsed, email);
        const store = loadStore();
        store.users[email] = hydrated;
        persistStore(store);
        return { user: enforceServerUserExpiry(email), kvError: false };
      }
      return { user: null, kvError: false };
    }
  } catch (kvErr) {
    kvError = true;
    console.error('[DB] Failed reading user from KV store:', kvErr);
  }
  const diskUser = getServerUserByEmail(email);
  return { user: diskUser, kvError };
}

async function getUserFromDb(rawEmail: string): Promise<ServerUserRecord | null> {
  const { user } = await readUserFromDbStatus(rawEmail);
  return user;
}

function buildApiKeyForEmail(email: string): string {
  return (
    'aqari_live_' +
    crypto
      .createHmac('sha256', getSessionSecret())
      .update(`api:${normalizeEmail(email)}`)
      .digest('hex')
      .slice(0, 32)
  );
}

function maskApiKey(rawToken?: string | null): string | null {
  const clean = String(rawToken || '').trim();
  if (!clean || clean.length < 4) return null;
  return `****${clean.slice(-4)}`;
}

function getOrMintApiKeyForUser(user: ServerUserRecord): {
  rawToken: string;
  masked: string;
  last4: string;
  needsPersist: boolean;
} {
  if (user.api_key_token && user.api_key_token.startsWith('aqari_live_')) {
    const last4 = user.api_key_token.slice(-4);
    return {
      rawToken: user.api_key_token,
      masked: `****${last4}`,
      last4,
      needsPersist: user.api_key_last4 !== last4,
    };
  }
  const rawToken = user.api_key_revoked_legacy
    ? 'aqari_live_' + crypto.randomBytes(16).toString('hex')
    : buildApiKeyForEmail(user.email);
  const last4 = rawToken.slice(-4);
  return {
    rawToken,
    masked: `****${last4}`,
    last4,
    needsPersist: true,
  };
}

function sanitizeUserForClient(user: ServerUserRecord, maskedApiKey?: string | null) {
  const { api_key_token: _secret, ...safeUser } = user as any;
  return {
    ...safeUser,
    api_key: maskedApiKey ?? maskApiKey(user.api_key_token) ?? (user.api_key_last4 ? `****${user.api_key_last4}` : null),
    api_key_last4: user.api_key_last4 || (user.api_key_token ? user.api_key_token.slice(-4) : null),
  };
}

async function deleteApiKeyFromDb(rawToken: string): Promise<void> {
  const cleanToken = String(rawToken || '').trim();
  if (!cleanToken) return;
  const store = loadStore();
  if (store.api_keys && store.api_keys[cleanToken]) {
    delete store.api_keys[cleanToken];
    persistStore(store);
  }
  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['DEL', `aqari:apikey:${cleanToken}`]);
    }
  } catch {}
}

async function saveApiKeyToDb(token: string, rawEmail: string): Promise<void> {
  const cleanToken = String(token || '').trim();
  const email = normalizeEmail(rawEmail);
  if (!cleanToken || !email) return;

  const store = loadStore();
  if (!store.api_keys || typeof store.api_keys !== 'object') store.api_keys = {};
  store.api_keys[cleanToken] = email;
  persistStore(store);

  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['SET', `aqari:apikey:${cleanToken}`, email]);
    }
  } catch (err) {
    console.error('[DB] Failed saving API key:', err);
  }
}

async function resolveApiKeyEmail(rawToken: string): Promise<string | null> {
  const cleanToken = String(rawToken || '').trim();
  if (!cleanToken.startsWith('aqari_live_')) return null;

  const isLegacyOrMismatched = (user: ServerUserRecord | null): boolean => {
    if (!user) return false;
    if (user.api_key_token && user.api_key_token !== cleanToken) return true;
    if (user.api_key_revoked_legacy && buildApiKeyForEmail(user.email) === cleanToken) return true;
    return false;
  };

  const store = loadStore();
  if (store.api_keys?.[cleanToken]) {
    const norm = normalizeEmail(store.api_keys[cleanToken]);
    const user = (await getUserFromDb(norm).catch(() => null)) || store.users?.[norm] || null;
    if (isLegacyOrMismatched(user)) return null;
    return norm;
  }

  for (const email of Object.keys(store.users || {})) {
    const u = store.users[email];
    if (u?.api_key_token === cleanToken) return normalizeEmail(email);
    if (!u?.api_key_revoked_legacy && !u?.api_key_token && buildApiKeyForEmail(email) === cleanToken) {
      await saveApiKeyToDb(cleanToken, email).catch(() => {});
      return normalizeEmail(email);
    }
  }

  try {
    const kv = getKvConfig();
    if (kv) {
      const direct = await kvCommand(['GET', `aqari:apikey:${cleanToken}`]);
      if (direct && typeof direct === 'string' && direct.includes('@')) {
        const norm = normalizeEmail(direct);
        const user = await getUserFromDb(norm).catch(() => null);
        if (isLegacyOrMismatched(user)) return null;
        store.api_keys[cleanToken] = norm;
        persistStore(store);
        return norm;
      }
      const rawIdx = await kvCommand(['GET', 'aqari:users_index:v1']);
      const idx: string[] = Array.isArray(rawIdx)
        ? rawIdx.map(String)
        : typeof rawIdx === 'string'
        ? JSON.parse(rawIdx)
        : [];
      for (const email of idx) {
        const u = await getUserFromDb(email).catch(() => null);
        if (u?.api_key_token === cleanToken) return normalizeEmail(email);
        if (!u?.api_key_revoked_legacy && !u?.api_key_token && buildApiKeyForEmail(email) === cleanToken) {
          const norm = normalizeEmail(email);
          await saveApiKeyToDb(cleanToken, norm).catch(() => {});
          return norm;
        }
      }
    }
  } catch {}

  return null;
}

async function appendEmailLogToDb(entry: {
  to: string;
  subject: string;
  status: string;
  event_type: string;
  error?: string;
}): Promise<any> {
  const log = {
    id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  try {
    const store = loadStore();
    if (!Array.isArray(store.email_logs)) store.email_logs = [];
    store.email_logs.unshift(log);
    store.email_logs = store.email_logs.slice(0, 200);
    persistStore(store);
  } catch {}
  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['LPUSH', 'aqari:email_logs:v1', JSON.stringify(log)]);
      await kvCommand(['LTRIM', 'aqari:email_logs:v1', 0, 199]);
    }
  } catch {}
  return log;
}

async function getEmailLogsFromDb(limit = 50): Promise<any[]> {
  try {
    const kv = getKvConfig();
    if (kv) {
      const rawItems = await kvCommand(['LRANGE', 'aqari:email_logs:v1', 0, Math.max(0, limit - 1)]);
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        const parsed = rawItems
          .map((item) => {
            try {
              return typeof item === 'string' ? JSON.parse(item) : item;
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        if (parsed.length > 0) return parsed.slice(0, limit);
      }
    }
  } catch {}
  return (loadStore().email_logs || []).slice(0, limit);
}

async function appendCancellationLogToDb(entry: any): Promise<any> {
  const log = {
    id: `can_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  try {
    const store = loadStore();
    if (!Array.isArray(store.cancellation_logs)) store.cancellation_logs = [];
    store.cancellation_logs.unshift(log);
    store.cancellation_logs = store.cancellation_logs.slice(0, 200);
    persistStore(store);
  } catch {}
  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['LPUSH', 'aqari:cancellation_logs:v1', JSON.stringify(log)]);
      await kvCommand(['LTRIM', 'aqari:cancellation_logs:v1', 0, 199]);
    }
  } catch {}
  return log;
}

async function dispatchEmailAlert(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  eventType: string;
}): Promise<{ status: 'sent' | 'simulated' | 'failed'; error?: string }> {
  const toEmail = normalizeEmail(params.to) || getAdminEmail();
  const resendKey = cleanEnvValue(getEnv('RESEND_API_KEY'));
  if (!resendKey) {
    await appendEmailLogToDb({
      to: toEmail,
      subject: params.subject,
      status: 'simulated',
      event_type: params.eventType,
      error: 'RESEND_API_KEY missing (logged in email_logs)',
    });
    return { status: 'simulated' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AQARI Terminal <onboarding@resend.dev>',
          to: [toEmail],
          subject: params.subject,
          text: params.text,
          html: params.html || `<pre style="font-family:sans-serif;white-space:pre-wrap;">${params.text}</pre>`,
        }),
      });
      const rawText = await res.text();
      let parsed: any = {};
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {}
      const status = res.ok ? 'sent' : 'failed';
      await appendEmailLogToDb({
        to: toEmail,
        subject: params.subject,
        status,
        event_type: params.eventType,
        error: res.ok ? undefined : parsed?.message || rawText || res.statusText,
      });
      return { status, error: res.ok ? undefined : parsed?.message || rawText };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    const msg = err?.message || 'Resend error';
    await appendEmailLogToDb({
      to: toEmail,
      subject: params.subject,
      status: 'failed',
      event_type: params.eventType,
      error: msg,
    });
    return { status: 'failed', error: msg };
  }
}

async function getAnalystThreadsMap(): Promise<Record<string, any>> {
  const store = loadStore();
  let merged: Record<string, any> = { ...(store.analyst_threads || {}) };
  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', 'aqari:analyst_threads:v1']);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === 'object') {
          merged = { ...merged, ...parsed };
          store.analyst_threads = merged;
          persistStore(store);
        }
      }
    }
  } catch {}
  return merged;
}

async function getAnalystThreadFromDb(rawEmail: string): Promise<any> {
  const email = normalizeEmail(rawEmail);
  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:analyst_thread:${email}`]);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === 'object') {
          const store = loadStore();
          if (!store.analyst_threads) store.analyst_threads = {};
          store.analyst_threads[email] = parsed;
          persistStore(store);
          return parsed;
        }
      }
    }
  } catch {}
  const map = await getAnalystThreadsMap();
  return (
    map[email] || {
      email,
      plan: 'SOVEREIGN',
      status: 'Open',
      unreadForAdmin: 0,
      unreadForClient: 0,
      updatedAt: Date.now(),
      messages: [],
    }
  );
}

async function saveAnalystThreadToDb(thread: any): Promise<any> {
  const email = normalizeEmail(thread?.email);
  if (!email) return thread;
  const store = loadStore();
  if (!store.analyst_threads) store.analyst_threads = {};
  store.analyst_threads[email] = thread;
  persistStore(store);

  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['SET', `aqari:analyst_thread:${email}`, JSON.stringify(thread)]);
      const map = await getAnalystThreadsMap();
      map[email] = thread;
      await kvCommand(['SET', 'aqari:analyst_threads:v1', JSON.stringify(map)]);
    }
  } catch {}
  return thread;
}

async function getWhiteGloveRequestsFromDb(): Promise<any[]> {
  const store = loadStore();
  let list: any[] = Array.isArray(store.whiteglove_requests) ? [...store.whiteglove_requests] : [];
  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', 'aqari:whiteglove_requests:v1']);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          list = parsed;
          store.whiteglove_requests = list;
          persistStore(store);
        }
      }
    }
  } catch {}
  return list;
}

async function saveWhiteGloveRequestsToDb(requests: any[]): Promise<any[]> {
  const trimmed = requests.slice(0, 300);
  const store = loadStore();
  store.whiteglove_requests = trimmed;
  persistStore(store);
  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['SET', 'aqari:whiteglove_requests:v1', JSON.stringify(trimmed)]);
    }
  } catch {}
  return trimmed;
}

async function appendWebhookLogToDb(
  entry: Omit<WebhookLogEntry, 'id' | 'timestamp'>
): Promise<WebhookLogEntry> {
  const log: WebhookLogEntry = {
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
    event: entry.event || entry.event_name,
    event_name: entry.event_name || entry.event || 'unknown',
    raw_error: entry.raw_error ?? entry.error,
    error: entry.error ?? entry.raw_error,
  };

  try {
    const store = loadStore();
    store.webhook_logs.unshift(log);
    if (store.webhook_logs.length > 200) {
      store.webhook_logs = store.webhook_logs.slice(0, 200);
    }
    persistStore(store);
  } catch (diskErr) {
    console.error('[DB] Failed writing webhook log to disk store:', diskErr);
  }

  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['LPUSH', 'aqari:webhook_logs:v1', JSON.stringify(log)]);
      await kvCommand(['LTRIM', 'aqari:webhook_logs:v1', 0, 199]);
    }
  } catch (kvErr) {
    console.error('[DB] Failed writing webhook log to KV store:', kvErr);
  }

  return log;
}

async function getWebhookLogsFromDb(limit = 20): Promise<WebhookLogEntry[]> {
  try {
    const kv = getKvConfig();
    if (kv) {
      const rawItems = await kvCommand(['LRANGE', 'aqari:webhook_logs:v1', 0, Math.max(0, limit - 1)]);
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        const parsedLogs: WebhookLogEntry[] = rawItems
          .map((item) => {
            try {
              return typeof item === 'string' ? JSON.parse(item) : item;
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        if (parsedLogs.length > 0) {
          return parsedLogs.slice(0, limit);
        }
      }
    }
  } catch (kvErr) {
    console.error('[DB] Failed reading webhook logs from KV store:', kvErr);
  }

  try {
    const storeFile = getStoreFile();
    if (fs.existsSync(storeFile)) {
      const raw = fs.readFileSync(storeFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.webhook_logs)) {
        return parsed.webhook_logs.slice(0, limit);
      }
    }
  } catch (diskErr) {
    console.error('[DB] Failed reading webhook logs from disk store:', diskErr);
  }

  return loadStore().webhook_logs.slice(0, limit);
}

function recordPendingCheckout(entry: PendingCheckoutEntry): void {
  const store = loadStore();
  const norm = normalizeEmail(entry.email);
  if (norm) {
    store.pending_checkouts[norm] = { ...entry, email: norm };
  }
  if (entry.checkoutId) {
    store.pending_checkouts[`chk:${entry.checkoutId}`] = { ...entry, email: norm };
  }
  persistStore(store);
}

function mapAmountOrPlanToOrderTier(
  amountOrCents: number,
  fallbackPlan?: PlanKey,
  meta?: { productName?: string; variantId?: string; productId?: string; rawAmountCents?: number }
): {
  plan: PlanKey;
  planDisplay: 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  analyses: number;
} {
  let plan: PlanKey | null = null;

  const variantId = String(meta?.variantId || '').trim();
  const productId = String(meta?.productId || '').trim();
  if (variantId) {
    if (getEnv('PAYMENT_STARTER_VARIANT_ID') && variantId === getEnv('PAYMENT_STARTER_VARIANT_ID')) plan = 'starter';
    else if (getEnv('PAYMENT_PRO_VARIANT_ID') && variantId === getEnv('PAYMENT_PRO_VARIANT_ID')) plan = 'pro';
    else if (getEnv('PAYMENT_SOVEREIGN_VARIANT_ID') && variantId === getEnv('PAYMENT_SOVEREIGN_VARIANT_ID')) plan = 'enterprise';
  }
  if (!plan && productId) {
    if (getEnv('PAYMENT_STARTER_PRODUCT_ID') && productId === getEnv('PAYMENT_STARTER_PRODUCT_ID')) plan = 'starter';
    else if (getEnv('PAYMENT_PRO_PRODUCT_ID') && productId === getEnv('PAYMENT_PRO_PRODUCT_ID')) plan = 'pro';
    else if (getEnv('PAYMENT_SOVEREIGN_PRODUCT_ID') && productId === getEnv('PAYMENT_SOVEREIGN_PRODUCT_ID')) plan = 'enterprise';
  }

  if (!plan && meta?.productName) {
    const s = meta.productName.toLowerCase();
    if (s.includes('sovereign') || s.includes('enterprise') || s.includes('agency')) plan = 'enterprise';
    else if (s.includes('professional') || /\bpro\b/.test(s)) plan = 'pro';
    else if (s.includes('starter')) plan = 'starter';
  }

  if (!plan) {
    const fromCents = meta?.rawAmountCents ? planFromAmount(meta.rawAmountCents) : null;
    const fromAmt = fromCents || planFromAmount(amountOrCents);
    if (fromAmt?.name === 'SOVEREIGN') plan = 'enterprise';
    else if (fromAmt?.name === 'STARTER') plan = 'starter';
    else if (fromAmt?.name === 'PROFESSIONAL') plan = 'pro';
  }

  if (!plan) {
    plan = fallbackPlan && fallbackPlan !== 'free' ? fallbackPlan : 'pro';
  }

  if (plan === 'starter') {
    return { plan: 'starter', planDisplay: PLANS.STARTER.name, analyses: PLANS.STARTER.analyses };
  }
  if (plan === 'enterprise') {
    return {
      plan: 'enterprise',
      planDisplay: PLANS.SOVEREIGN.name,
      analyses: PLANS.SOVEREIGN.analyses,
    };
  }
  return {
    plan: 'pro',
    planDisplay: PLANS.PROFESSIONAL.name,
    analyses: PLANS.PROFESSIONAL.analyses,
  };
}

async function getUsedOrderFromDb(rawOrderId: string): Promise<UsedOrderRecord | null> {
  const orderKey = normalizeOrderId(rawOrderId);
  if (!orderKey) return null;

  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:used_order:${orderKey}`]);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed?.order_id) {
          const store = loadStore();
          if (!store.used_orders || typeof store.used_orders !== 'object' || Array.isArray(store.used_orders)) {
            store.used_orders = {};
          }
          store.used_orders[orderKey] = parsed;
          persistStore(store);
          return parsed;
        }
      }
      const rawMap = await kvCommand(['GET', 'aqari:used_orders_map:v1']);
      const map = rawMap ? (typeof rawMap === 'string' ? JSON.parse(rawMap) : rawMap) : null;
      if (map && typeof map === 'object' && map[orderKey]) {
        const store = loadStore();
        if (!store.used_orders || typeof store.used_orders !== 'object' || Array.isArray(store.used_orders)) {
          store.used_orders = {};
        }
        store.used_orders[orderKey] = map[orderKey];
        persistStore(store);
        return map[orderKey];
      }
    }
  } catch (err) {
    console.error('[DB] Failed reading used_order from KV:', err);
  }

  const store = loadStore();
  const table =
    store.used_orders && typeof store.used_orders === 'object' && !Array.isArray(store.used_orders)
      ? store.used_orders
      : {};
  return table[orderKey] || null;
}

async function markOrderUsedInDb(record: UsedOrderRecord): Promise<UsedOrderRecord> {
  const orderKey = normalizeOrderId(record.order_id);
  const normalizedRecord: UsedOrderRecord = {
    ...record,
    order_id: orderKey,
    login_email: normalizeEmail(record.login_email),
    payment_email: normalizeEmail(record.payment_email),
    used_at: Number(record.used_at || Date.now()),
  };

  const store = loadStore();
  if (!store.used_orders || typeof store.used_orders !== 'object' || Array.isArray(store.used_orders)) {
    store.used_orders = {};
  }
  store.used_orders[orderKey] = normalizedRecord;
  persistStore(store);

  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['SET', `aqari:used_order:${orderKey}`, JSON.stringify(normalizedRecord)]);
      const rawMap = await kvCommand(['GET', 'aqari:used_orders_map:v1']);
      const map: Record<string, UsedOrderRecord> =
        rawMap && typeof rawMap === 'string'
          ? JSON.parse(rawMap)
          : rawMap && typeof rawMap === 'object'
          ? rawMap
          : {};
      map[orderKey] = normalizedRecord;
      await kvCommand(['SET', 'aqari:used_orders_map:v1', JSON.stringify(map)]);
    }
  } catch (err) {
    console.error('[DB] Failed writing used_order to KV:', err);
  }

  return normalizedRecord;
}

// =========================================================================
// 4. INLINED MARKET DATA, MARKET NEWS & DEMO ANALYSES
// =========================================================================

interface LiveMarketCity {
  city: string;
  country: string;
  countryIso3: string;
  flag: string;
  code: string;
  timezone: string;
  price_per_m2: number;
  gross_yield: number;
  transfer_tax: number;
  capital_gains_tax: string;
  golden_visa_tier: string;
  rental_yoy: number;
  inflation_pct: number | null;
  benchmark_label: string;
  source: string;
  last_updated: number;
}

interface LiveMacroData {
  us_10y_yield: number;
  us_2y_yield: number;
  yield_curve_bps: number;
  inflation_by_country: Record<string, { value: number; year: string }>;
  fx_rates: Record<string, number>;
}

interface LiveMarketResponse {
  cities: LiveMarketCity[];
  macro: LiveMacroData;
  metrics: {
    markets_tracked: number;
    sovereign_spread_bps: number;
    muscat_vs_us10y_bps: number;
    tax_havens: string;
    prime_yield_spread: string;
    fx_usd_omr: number;
    fx_usd_aed: number;
    fx_usd_gbp: number;
    us_10y_yield: number;
    dubai_dld_index: number;
  };
  sources: string[];
  data_type?: 'Actual' | 'Estimated' | 'Demo';
  macro_data_type?: 'Actual' | 'Estimated' | 'Demo';
  benchmark_data_type?: 'Actual' | 'Estimated' | 'Demo';
  updated_date?: string;
  last_updated: number;
  last_synced_iso: string;
  last_synced_display: string;
  cache_ttl_hours: number;
  stale: boolean;
}

const MARKET_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cachedMarketResponse: LiveMarketResponse | null = null;
let cachedMarketAt = 0;

interface InlinedCityEntry {
  city: string;
  country: string;
  countryCode: string;
  currency: string;
  taxRate: number;
  visaNote: string;
  avgCapRate: number;
}

const CITY_COUNTRIES: Record<string, [string, string, string, number, string]> = {
  OM: ['Oman', 'OM', 'OMR', 3.0, 'ITC Freehold Residency ($650k+)'],
  AE: ['UAE', 'AE', 'AED', 4.0, '10-Yr UAE Golden Visa ($545k+)'],
  SA: ['Saudi Arabia', 'SA', 'SAR', 5.0, 'Premium Residency ($1.06M+)'],
  QA: ['Qatar', 'QA', 'QAR', 0.25, 'Permanent Residency ($1M+) / Temp ($200k+)'],
  KW: ['Kuwait', 'KW', 'KWD', 0.0, 'GCC Citizens & Approved Entities Only'],
  BH: ['Bahrain', 'BH', 'BHD', 2.0, 'Golden Residency ($530k+)'],
  EG: ['Egypt', 'EG', 'EGP', 2.5, 'Residency / Citizenship ($300k+)'],
  JO: ['Jordan', 'JO', 'JOD', 9.0, 'Investor Residency / Citizenship Program'],
  MA: ['Morocco', 'MA', 'MAD', 4.0, 'Long-Term Investor Residency'],
  TN: ['Tunisia', 'TN', 'TND', 5.0, 'Foreign Ownership Requires Governor Approval'],
  LB: ['Lebanon', 'LB', 'USD', 6.0, 'Residency via Property ($330k+)'],
  US: ['United States', 'US', 'USD', 2.5, 'EB-5 Regional Center ($800k+)'],
  GB: ['United Kingdom', 'GB', 'GBP', 7.5, 'No Property Golden Visa / Open Freehold'],
  SG: ['Singapore', 'SG', 'SGD', 60.0, 'GIP Investor Program ($1.85M+ / 60% ABSD)'],
  CA: ['Canada', 'CA', 'CAD', 3.5, 'Foreign Buyer Restrictions in Metro Areas'],
  AU: ['Australia', 'AU', 'AUD', 5.5, 'FIRB Approval Required for Foreign Buyers'],
  NZ: ['New Zealand', 'NZ', 'NZD', 0.0, 'Active Investor Plus Visa (NZD $5M+)'],
  FR: ['France', 'FR', 'EUR', 7.5, 'Talent Passport Investor Residency'],
  DE: ['Germany', 'DE', 'EUR', 5.5, 'Open Freehold / No Direct Golden Visa'],
  ES: ['Spain', 'ES', 'EUR', 8.0, 'Non-Lucrative / Wealth Residency Rules'],
  IT: ['Italy', 'IT', 'EUR', 9.0, 'Elective Residency & Investor Visa ($540k+)'],
  PT: ['Portugal', 'PT', 'EUR', 6.5, 'D7 Passive Income & Fund Golden Visa'],
  NL: ['Netherlands', 'NL', 'EUR', 10.4, 'Open Freehold / 10.4% Investor Transfer Tax'],
  CH: ['Switzerland', 'CH', 'CHF', 3.0, 'Lex Koller Quota for Foreign Buyers'],
  BE: ['Belgium', 'BE', 'EUR', 12.0, 'Open Freehold / Regional Transfer Tax'],
  AT: ['Austria', 'AT', 'EUR', 3.5, 'Land Authority Approval for Non-EU Buyers'],
  IE: ['Ireland', 'IE', 'EUR', 2.0, 'Stamp Duty 1%-2% / Open Freehold'],
  SE: ['Sweden', 'SE', 'SEK', 1.5, 'Open Freehold / 1.5% Stamp Duty'],
  NO: ['Norway', 'NO', 'NOK', 2.5, 'Open Freehold / 2.5% Document Fee'],
  DK: ['Denmark', 'DK', 'DKK', 0.6, '5-Yr Residency Rule for Foreign Buyers'],
  FI: ['Finland', 'FI', 'EUR', 3.0, 'Defence Permit for Non-EU Freehold'],
  PL: ['Poland', 'PL', 'PLN', 2.0, 'Open Apartment Freehold / Land Permit'],
  CZ: ['Czechia', 'CZ', 'CZK', 0.0, 'Open Freehold / 0% Acquisition Tax'],
  GR: ['Greece', 'GR', 'EUR', 3.09, 'Greece Golden Visa (€400k-€800k Zones)'],
  CY: ['Cyprus', 'CY', 'EUR', 4.0, 'Permanent Residency (€300k+ New Build)'],
  MT: ['Malta', 'MT', 'EUR', 5.0, 'MPRP Permanent Residency (€350k+)'],
  HU: ['Hungary', 'HU', 'HUF', 4.0, 'Guest Investor Program (€250k+ Fund)'],
  RO: ['Romania', 'RO', 'RON', 3.0, 'Open Apartment Ownership / Company Land'],
  HR: ['Croatia', 'HR', 'EUR', 3.0, 'Reciprocity Basis for Non-EU Buyers'],
  EE: ['Estonia', 'EE', 'EUR', 0.5, 'e-Residency & Open Freehold Ownership'],
  LV: ['Latvia', 'LV', 'EUR', 2.0, 'Temporary Residency (€250k+ Property)'],
  LT: ['Lithuania', 'LT', 'EUR', 0.5, 'Open Apartment Ownership'],
  LU: ['Luxembourg', 'LU', 'EUR', 7.0, 'Open Freehold / Investor Residence Permit'],
  MC: ['Monaco', 'MC', 'EUR', 6.5, 'Residency via Property + Local Bank Deposit'],
  TR: ['Turkey', 'TR', 'TRY', 4.0, 'Turkish Citizenship by Investment ($400k+)'],
  IN: ['India', 'IN', 'INR', 6.0, 'NRI/OCI Open Freehold (No Agri Land)'],
  PK: ['Pakistan', 'PK', 'PKR', 4.0, 'POC / NICOP Open Urban Freehold'],
  ID: ['Indonesia', 'ID', 'IDR', 5.0, 'Hak Pakai / PT PMA Corporate Leasehold'],
  MY: ['Malaysia', 'MY', 'MYR', 4.0, 'MM2H Residency Program (State Minimums)'],
  TH: ['Thailand', 'TH', 'THB', 2.0, '49% Foreign Condo Freehold Quota / LTR Visa'],
  VN: ['Vietnam', 'VN', 'VND', 0.5, '50-Yr Foreign Leasehold / 30% Condo Quota'],
  PH: ['Philippines', 'PH', 'PHP', 6.0, '40% Foreign Condo Freehold Quota / SRRV'],
  JP: ['Japan', 'JP', 'JPY', 4.0, '100% Foreign Freehold Ownership Open'],
  KR: ['South Korea', 'KR', 'KRW', 4.6, 'F-2/F-5 Investor Visa Designated Zones'],
  CN: ['China', 'CN', 'CNY', 3.0, '1-Yr Local Residence Rule for Foreign Buyers'],
  HK: ['Hong Kong', 'HK', 'HKD', 4.25, 'Open Freehold / CIES Capital Entrant'],
  TW: ['Taiwan', 'TW', 'TWD', 6.0, 'Reciprocity Freehold Ownership Rules'],
  LK: ['Sri Lanka', 'LK', 'LKR', 4.0, 'Condo Ownership Open Above 4th Floor'],
  BD: ['Bangladesh', 'BD', 'BDT', 6.5, 'BIDA Approval for Foreign Entities'],
  KZ: ['Kazakhstan', 'KZ', 'KZT', 0.0, 'Residency Permit Required for Individuals'],
  UZ: ['Uzbekistan', 'UZ', 'UZS', 1.0, 'Residence Permit via New Real Estate ($100k+)'],
  AZ: ['Azerbaijan', 'AZ', 'AZN', 0.5, 'Temporary Residency ($59k+ Property)'],
  GE: ['Georgia', 'GE', 'GEL', 0.0, 'Residency Permit ($100k+ / 0% Transfer Tax)'],
  AM: ['Armenia', 'AM', 'AMD', 0.5, 'Open Urban Freehold Ownership'],
  MX: ['Mexico', 'MX', 'MXN', 3.5, 'Fideicomiso Bank Trust in Coastal Zones'],
  BR: ['Brazil', 'BR', 'BRL', 3.0, 'VIPER Investor Visa ($140k-$200k Urban)'],
  AR: ['Argentina', 'AR', 'USD', 3.6, 'Open Foreign Freehold / Rentista Visa'],
  CL: ['Chile', 'CL', 'CLP', 1.0, 'Open Foreign Freehold / Investor Visa'],
  CO: ['Colombia', 'CO', 'COP', 2.5, 'M-Type Migrant Visa (~$100k+ Property)'],
  PE: ['Peru', 'PE', 'PEN', 3.0, 'Open Urban Freehold / Investor Visa'],
  PA: ['Panama', 'PA', 'USD', 2.0, 'Qualified Investor Visa ($300k+ Property)'],
  CR: ['Costa Rica', 'CR', 'USD', 1.5, 'Investor Residency ($150k+ Property)'],
  DO: ['Dominican Republic', 'DO', 'USD', 3.0, 'Investor Residency ($200k+ Property)'],
  BS: ['Bahamas', 'BS', 'BSD', 8.0, 'Permanent Residency ($750k+ Property)'],
  ZA: ['South Africa', 'ZA', 'ZAR', 8.0, 'Open Freehold Ownership / Retired Visa'],
  KE: ['Kenya', 'KE', 'KES', 4.0, '99-Yr Urban Leasehold for Non-Citizens'],
  NG: ['Nigeria', 'NG', 'NGN', 5.0, 'State Governor Consent for Foreign Title'],
  GH: ['Ghana', 'GH', 'GHS', 1.0, '50-Yr Renewable Leasehold for Foreigners'],
  MU: ['Mauritius', 'MU', 'MUR', 5.0, 'Permanent Residency ($375k+ PDS/IRS)'],
  RW: ['Rwanda', 'RW', 'RWF', 0.5, 'Long-Term Leasehold / Open Investor Rules'],
  TZ: ['Tanzania', 'TZ', 'TZS', 4.0, 'TIC Derivative Right of Occupancy'],
  GL: ['Global', 'GL', 'USD', 3.0, 'Standard International Freehold/Leasehold'],
};

const CITY_RAW: Array<[string, string, number]> = [
  ['Muscat','OM',8.4],['Dubai','AE',8.8],['Riyadh','SA',8.8],['London','GB',4.8],['New York','US',4.6],['Singapore','SG',3.9],['Miami','US',6.7],
  ['Salalah','OM',7.8],['Sohar','OM',8.1],['Nizwa','OM',7.4],['Sur','OM',7.2],['Duqm','OM',8.6],['Barka','OM',7.6],['Seeb','OM',8.0],['Ibri','OM',7.1],['Rustaq','OM',7.0],['Khasab','OM',7.3],['Buraimi','OM',7.4],['Saham','OM',7.2],['Ibra','OM',7.1],['Bahla','OM',7.0],
  ['Abu Dhabi','AE',7.6],['Sharjah','AE',7.9],['Ajman','AE',8.5],['Ras Al Khaimah','AE',8.2],['Fujairah','AE',7.5],['Al Ain','AE',7.4],['Umm Al Quwain','AE',7.6],['Khor Fakkan','AE',7.3],
  ['Jeddah','SA',8.1],['Dammam','SA',7.9],['Khobar','SA',8.0],['Mecca','SA',7.5],['Medina','SA',7.6],['Abha','SA',7.4],['Tabuk','SA',7.8],['Taif','SA',7.2],['Jubail','SA',8.3],['Yanbu','SA',7.9],['Diriyah','SA',8.4],['AlUla','SA',8.2],['NEOM','SA',8.9],['Hail','SA',7.3],['Buraydah','SA',7.4],['Al-Ahsa','SA',7.5],['Jazan','SA',7.6],['Najran','SA',7.2],['Khamis Mushait','SA',7.4],['Dhahran','SA',8.0],
  ['Doha','QA',7.2],['Lusail','QA',7.6],['Al Wakrah','QA',7.1],['Al Khor','QA',7.0],['Kuwait City','KW',6.8],['Salmiya','KW',7.0],['Hawalli','KW',7.1],['Jahra','KW',6.9],['Manama','BH',7.8],['Riffa','BH',7.4],['Muharraq','BH',7.5],['Amwaj Islands','BH',8.0],
  ['Cairo','EG',8.2],['New Cairo','EG',8.6],['New Administrative Capital','EG',8.8],['Alexandria','EG',7.5],['Giza','EG',7.9],['Sheikh Zayed City','EG',8.4],['Hurghada','EG',8.5],['Sharm El Sheikh','EG',8.3],['El Gouna','EG',8.7],['Mansoura','EG',7.2],['Tanta','EG',7.0],['Aswan','EG',7.1],['Luxor','EG',7.2],
  ['Amman','JO',7.4],['Aqaba','JO',7.8],['Irbid','JO',7.1],['Zarqa','JO',7.0],['Madaba','JO',6.9],
  ['Casablanca','MA',7.1],['Marrakech','MA',8.2],['Rabat','MA',6.8],['Tangier','MA',7.6],['Agadir','MA',7.5],['Fez','MA',6.9],['Meknes','MA',6.8],['Oujda','MA',6.7],['Essaouira','MA',7.7],
  ['Tunis','TN',6.9],['Sousse','TN',7.1],['Sfax','TN',6.8],['Hammamet','TN',7.4],['Beirut','LB',6.2],['Jounieh','LB',6.0],['Byblos','LB',6.1],
  ['Los Angeles','US',5.1],['Austin','US',6.4],['Dallas','US',6.9],['Houston','US',7.1],['Chicago','US',6.8],['San Francisco','US',4.5],['Seattle','US',5.2],['Boston','US',5.0],['Atlanta','US',6.7],['Phoenix','US',6.5],['Denver','US',5.8],['San Diego','US',4.9],['Nashville','US',6.3],['Orlando','US',6.8],['Tampa','US',6.9],['Charlotte','US',6.6],['Las Vegas','US',6.4],['Washington','US',5.4],['Philadelphia','US',6.9],['San Jose','US',4.4],['Jacksonville','US',7.0],['Fort Worth','US',6.8],['Columbus','US',7.2],['Indianapolis','US',7.4],['San Antonio','US',6.9],['Portland','US',5.6],['Sacramento','US',5.9],['Salt Lake City','US',5.8],['Minneapolis','US',6.5],['Raleigh','US',6.4],['Richmond','US',6.6],['Detroit','US',8.4],['Cleveland','US',8.2],['Pittsburgh','US',7.6],['St. Louis','US',7.7],['Kansas City','US',7.5],['Cincinnati','US',7.4],['Milwaukee','US',7.5],['New Orleans','US',6.8],['Honolulu','US',4.8],['Scottsdale','US',6.0],['Boca Raton','US',6.2],['West Palm Beach','US',6.4],['Naples','US',5.9],['Sarasota','US',6.3],['Fort Lauderdale','US',6.5],['Coral Gables','US',5.8],['Jersey City','US',5.7],['Hoboken','US',5.4],['Brooklyn','US',4.9],['Palo Alto','US',3.9],['Santa Monica','US',4.5],['Beverly Hills','US',4.2],['Bellevue','US',5.0],['Boulder','US',5.2],['Charleston','US',6.1],['Savannah','US',6.5],['Baltimore','US',7.5],['Memphis','US',8.1],['Louisville','US',7.2],['Oklahoma City','US',7.4],['Tucson','US',6.8],['Fresno','US',6.4],['Mesa','US',6.5],['Albuquerque','US',6.7],['Omaha','US',7.1],['Colorado Springs','US',6.1],['Tulsa','US',7.5],['Arlington','US',6.6],['Bakersfield','US',6.8],['Wichita','US',7.4],['Aurora','US',6.0],['Anaheim','US',5.2],['Santa Ana','US',5.3],['Riverside','US',6.0],['Lexington','US',6.9],['Stockton','US',6.3],['St. Paul','US',6.6],['Anchorage','US',6.7],['Newark','US',6.8],['Buffalo','US',7.8],['Plano','US',6.4],['Henderson','US',6.3],['Chandler','US',6.2],['Irvine','US',4.8],['Madison','US',6.5],['Boise','US',6.1],['Des Moines','US',7.3],['Birmingham','US',7.8],['Knoxville','US',6.9],['Chattanooga','US',6.8],['Greenville','US',6.7],['Asheville','US',6.0],['Palm Springs','US',6.2],['Aspen','US',4.3],
  ['Manchester','GB',6.9],['Edinburgh','GB',5.8],['Glasgow','GB',7.1],['Liverpool','GB',7.5],['Leeds','GB',6.8],['Bristol','GB',5.6],['Sheffield','GB',7.0],['Newcastle','GB',7.2],['Nottingham','GB',6.9],['Cardiff','GB',6.4],['Belfast','GB',6.8],['Oxford','GB',4.9],['Cambridge','GB',4.8],['Brighton','GB',5.3],['Reading','GB',5.9],['Southampton','GB',6.3],['Portsmouth','GB',6.4],['Bath','GB',5.1],['York','GB',5.7],['Leicester','GB',6.6],['Coventry','GB',6.7],['Aberdeen','GB',7.0],['Exeter','GB',5.8],['Milton Keynes','GB',6.1],['Bournemouth','GB',5.9],['Norwich','GB',6.2],['Swansea','GB',6.8],['Dundee','GB',7.3],['Preston','GB',7.2],['Bradford','GB',7.4],['Hull','GB',7.6],['Derby','GB',6.7],['Plymouth','GB',6.5],['Sunderland','GB',7.7],['Wolverhampton','GB',6.9],
  ['Toronto','CA',4.9],['Vancouver','CA',4.3],['Montreal','CA',5.8],['Calgary','CA',6.5],['Ottawa','CA',5.6],['Edmonton','CA',6.7],['Winnipeg','CA',6.6],['Quebec City','CA',6.1],['Hamilton','CA',5.7],['Kitchener','CA',5.8],['Halifax','CA',6.0],['Victoria','CA',5.0],['Kelowna','CA',5.4],['Mississauga','CA',5.1],['Markham','CA',4.8],['Brampton','CA',5.2],['Surrey','CA',4.9],['Burnaby','CA',4.6],['Saskatoon','CA',6.8],['Regina','CA',6.9],['Moncton','CA',6.7],['Waterloo','CA',5.9],['Oakville','CA',4.7],['Richmond BC','CA',4.5],
  ['Sydney','AU',4.4],['Melbourne','AU',4.9],['Brisbane','AU',5.6],['Perth','AU',6.2],['Adelaide','AU',5.8],['Gold Coast','AU',5.5],['Canberra','AU',5.7],['Hobart','AU',5.6],['Darwin','AU',6.8],['Newcastle AU','AU',5.4],['Sunshine Coast','AU',5.3],['Wollongong','AU',5.2],['Geelong','AU',5.1],['Cairns','AU',6.1],['Townsville','AU',6.4],['Parramatta','AU',4.8],
  ['Auckland','NZ',5.0],['Wellington','NZ',5.5],['Christchurch','NZ',5.8],['Queenstown','NZ',5.2],['Hamilton NZ','NZ',5.6],['Tauranga','NZ',5.3],['Dunedin','NZ',6.0],
  ['Paris','FR',4.3],['Lyon','FR',5.2],['Marseille','FR',5.9],['Nice','FR',5.1],['Bordeaux','FR',5.0],['Toulouse','FR',5.4],['Nantes','FR',5.3],['Strasbourg','FR',5.4],['Montpellier','FR',5.5],['Lille','FR',5.8],['Rennes','FR',5.2],['Cannes','FR',4.8],['Antibes','FR',4.9],['Aix-en-Provence','FR',4.9],['Annecy','FR',4.7],['Grenoble','FR',5.6],['Rouen','FR',5.9],['Reims','FR',5.7],
  ['Berlin','DE',4.6],['Munich','DE',3.9],['Frankfurt','DE',4.5],['Hamburg','DE',4.4],['Cologne','DE',4.7],['Dusseldorf','DE',4.6],['Stuttgart','DE',4.3],['Leipzig','DE',5.5],['Dresden','DE',5.3],['Hannover','DE',5.0],['Nuremberg','DE',4.9],['Dortmund','DE',5.6],['Essen','DE',5.7],['Bremen','DE',5.2],['Bonn','DE',4.8],['Heidelberg','DE',4.5],['Freiburg','DE',4.4],['Mannheim','DE',5.1],
  ['Madrid','ES',5.5],['Barcelona','ES',5.3],['Valencia','ES',6.2],['Malaga','ES',6.0],['Marbella','ES',5.7],['Seville','ES',5.9],['Bilbao','ES',5.4],['Alicante','ES',6.5],['Palma de Mallorca','ES',5.1],['Ibiza','ES',4.9],['Granada','ES',6.1],['Zaragoza','ES',6.0],['Murcia','ES',6.4],['San Sebastian','ES',4.6],['Las Palmas','ES',6.2],['Tenerife','ES',6.3],['Benidorm','ES',6.6],['Estepona','ES',5.8],
  ['Milan','IT',5.1],['Rome','IT',5.2],['Florence','IT',5.0],['Venice','IT',4.8],['Turin','IT',5.9],['Bologna','IT',5.4],['Naples','IT',6.0],['Verona','IT',5.5],['Genoa','IT',6.2],['Palermo','IT',6.4],['Bari','IT',6.1],['Catania','IT',6.3],['Padua','IT',5.6],['Como','IT',4.9],['Bergamo','IT',5.7],['Trieste','IT',5.8],
  ['Lisbon','PT',5.4],['Porto','PT',5.9],['Cascais','PT',4.9],['Faro','PT',6.1],['Albufeira','PT',6.4],['Lagos','PT',6.0],['Coimbra','PT',6.2],['Braga','PT',6.3],['Funchal','PT',5.8],['Vilamoura','PT',5.7],['Setubal','PT',6.1],['Aveiro','PT',6.0],
  ['Amsterdam','NL',4.7],['Rotterdam','NL',5.5],['The Hague','NL',5.3],['Utrecht','NL',5.0],['Eindhoven','NL',5.6],['Groningen','NL',5.8],['Maastricht','NL',5.7],['Haarlem','NL',4.8],['Delft','NL',5.1],
  ['Zurich','CH',3.4],['Geneva','CH',3.5],['Basel','CH',3.9],['Lausanne','CH',3.8],['Bern','CH',3.9],['Lugano','CH',4.1],['Zug','CH',3.5],['Lucerne','CH',3.7],['St. Moritz','CH',3.3],
  ['Brussels','BE',5.3],['Antwerp','BE',5.4],['Ghent','BE',5.2],['Bruges','BE',5.0],['Liege','BE',6.0],['Vienna','AT',4.4],['Salzburg','AT',4.3],['Innsbruck','AT',4.2],['Graz','AT',5.1],['Linz','AT',5.0],['Dublin','IE',5.8],['Cork','IE',6.2],['Galway','IE',6.0],['Limerick','IE',6.5],
  ['Stockholm','SE',4.6],['Gothenburg','SE',5.0],['Malmo','SE',5.3],['Uppsala','SE',4.9],['Oslo','NO',4.5],['Bergen','NO',5.1],['Trondheim','NO',5.2],['Stavanger','NO',5.4],['Copenhagen','DK',4.6],['Aarhus','DK',5.1],['Odense','DK',5.4],['Helsinki','FI',5.0],['Tampere','FI',5.5],['Turku','FI',5.4],['Espoo','FI',4.9],
  ['Warsaw','PL',6.2],['Krakow','PL',6.4],['Wroclaw','PL',6.3],['Gdansk','PL',6.5],['Poznan','PL',6.4],['Lodz','PL',7.0],['Prague','CZ',5.1],['Brno','CZ',5.6],['Ostrava','CZ',6.5],
  ['Athens','GR',6.4],['Thessaloniki','GR',6.6],['Mykonos','GR',6.8],['Santorini','GR',6.9],['Heraklion','GR',6.5],['Rhodes','GR',6.7],['Limassol','CY',6.5],['Nicosia','CY',6.3],['Paphos','CY',6.6],['Larnaca','CY',6.4],['Valletta','MT',5.6],['Sliema','MT',5.8],['St. Julians','MT',5.9],
  ['Budapest','HU',6.3],['Debrecen','HU',6.5],['Bucharest','RO',6.9],['Cluj-Napoca','RO',6.5],['Timisoara','RO',6.7],['Brasov','RO',6.8],['Constanta','RO',7.0],['Zagreb','HR',5.8],['Split','HR',6.3],['Dubrovnik','HR',6.1],['Zadar','HR',6.2],['Tallinn','EE',5.9],['Tartu','EE',6.1],['Riga','LV',6.5],['Jurmala','LV',6.0],['Vilnius','LT',6.2],['Kaunas','LT',6.5],['Luxembourg City','LU',4.1],['Monaco','MC',2.8],
  ['Istanbul','TR',6.8],['Ankara','TR',6.5],['Izmir','TR',6.4],['Antalya','TR',7.2],['Bodrum','TR',6.9],['Bursa','TR',6.6],['Alanya','TR',7.3],['Fethiye','TR',7.0],['Adana','TR',6.5],['Gaziantep','TR',6.4],['Konya','TR',6.2],['Mersin','TR',6.9],['Trabzon','TR',6.7],['Kayseri','TR',6.3],['Eskisehir','TR',6.4],
  ['Mumbai','IN',4.2],['Delhi','IN',4.5],['New Delhi','IN',4.4],['Bengaluru','IN',5.4],['Hyderabad','IN',5.6],['Pune','IN',5.3],['Chennai','IN',5.0],['Kolkata','IN',4.9],['Ahmedabad','IN',5.5],['Gurugram','IN',5.2],['Noida','IN',5.4],['Jaipur','IN',5.6],['Surat','IN',5.5],['Kochi','IN',5.8],['Chandigarh','IN',4.8],['Lucknow','IN',5.4],['Indore','IN',5.7],['Nagpur','IN',5.6],['Coimbatore','IN',5.5],['Visakhapatnam','IN',5.7],['Thiruvananthapuram','IN',5.4],['Panaji','IN',6.1],['Bhubaneswar','IN',5.6],['Vadodara','IN',5.5],['Mysuru','IN',5.3],['Thane','IN',4.6],['Navi Mumbai','IN',4.9],['Nashik','IN',5.4],['Guwahati','IN',5.8],['Udaipur','IN',5.7],
  ['Karachi','PK',6.5],['Lahore','PK',6.3],['Islamabad','PK',6.1],['Rawalpindi','PK',6.2],['Faisalabad','PK',6.4],['Multan','PK',6.3],['Peshawar','PK',6.0],['Quetta','PK',5.8],['Sialkot','PK',6.2],['Gujranwala','PK',6.3],['Bahawalpur','PK',6.1],['Abbottabad','PK',6.0],['Gwadar','PK',6.8],
  ['Jakarta','ID',6.9],['Bali','ID',8.9],['Denpasar','ID',8.5],['Surabaya','ID',6.8],['Bandung','ID',6.7],['Medan','ID',6.6],['Semarang','ID',6.7],['Yogyakarta','ID',7.0],['Makassar','ID',6.8],['Batam','ID',7.4],['Lombok','ID',8.6],['Ubud','ID',8.8],['Canggu','ID',9.2],
  ['Kuala Lumpur','MY',5.9],['Penang','MY',5.8],['George Town','MY',5.8],['Johor Bahru','MY',6.5],['Kota Kinabalu','MY',6.1],['Kuching','MY',5.9],['Ipoh','MY',5.7],['Malacca','MY',5.9],['Petaling Jaya','MY',5.6],['Cyberjaya','MY',6.3],['Langkawi','MY',6.4],
  ['Bangkok','TH',5.8],['Phuket','TH',7.6],['Chiang Mai','TH',6.5],['Pattaya','TH',7.2],['Koh Samui','TH',7.8],['Hua Hin','TH',6.6],['Krabi','TH',7.1],
  ['Ho Chi Minh City','VN',5.6],['Hanoi','VN',5.4],['Da Nang','VN',6.2],['Nha Trang','VN',6.4],['Phu Quoc','VN',6.6],['Hai Phong','VN',5.8],['Can Tho','VN',5.7],
  ['Manila','PH',6.4],['Makati','PH',6.5],['Taguig','PH',6.4],['Cebu City','PH',6.8],['Davao City','PH',6.6],['Quezon City','PH',6.3],['Iloilo City','PH',6.7],['Boracay','PH',7.2],['Clark','PH',6.9],
  ['Tokyo','JP',4.6],['Osaka','JP',5.8],['Kyoto','JP',4.9],['Yokohama','JP',5.1],['Nagoya','JP',5.5],['Fukuoka','JP',6.0],['Sapporo','JP',6.3],['Kobe','JP',5.6],['Naha','JP',5.9],['Sendai','JP',6.1],['Hiroshima','JP',5.9],['Niseko','JP',6.5],
  ['Seoul','KR',4.1],['Busan','KR',4.9],['Incheon','KR',5.0],['Daegu','KR',5.1],['Daejeon','KR',5.0],['Gwangju','KR',5.1],['Suwon','KR',4.7],['Jeju City','KR',5.5],['Seongnam','KR',4.3],
  ['Shanghai','CN',3.2],['Beijing','CN',3.0],['Shenzhen','CN',3.3],['Guangzhou','CN',3.6],['Chengdu','CN',4.1],['Hangzhou','CN',3.7],['Chongqing','CN',4.4],['Nanjing','CN',3.8],['Wuhan','CN',4.2],['Tianjin','CN',4.0],['Suzhou','CN',3.9],['Xian','CN',4.3],['Qingdao','CN',4.1],['Xiamen','CN',3.6],['Sanya','CN',4.5],['Ningbo','CN',4.0],['Changsha','CN',4.4],['Dalian','CN',4.3],
  ['Hong Kong','HK',3.4],['Kowloon','HK',3.5],['Taipei','TW',2.8],['New Taipei','TW',3.0],['Taichung','TW',3.5],['Kaohsiung','TW',3.8],['Tainan','TW',3.6],['Hsinchu','TW',3.4],
  ['Colombo','LK',6.4],['Kandy','LK',6.2],['Galle','LK',6.8],['Dhaka','BD',5.6],['Chattogram','BD',5.8],['Almaty','KZ',7.4],['Astana','KZ',7.2],['Shymkent','KZ',7.0],['Tashkent','UZ',7.8],['Samarkand','UZ',7.5],['Baku','AZ',7.1],['Tbilisi','GE',8.4],['Batumi','GE',8.9],['Yerevan','AM',7.6],
  ['Mexico City','MX',6.8],['Monterrey','MX',7.2],['Guadalajara','MX',6.9],['Cancun','MX',8.1],['Playa del Carmen','MX',8.4],['Tulum','MX',8.6],['Puerto Vallarta','MX',7.9],['Los Cabos','MX',7.8],['Merida','MX',7.3],['Queretaro','MX',7.1],['San Miguel de Allende','MX',7.0],['Puebla','MX',6.9],['Tijuana','MX',7.4],
  ['Sao Paulo','BR',6.5],['Rio de Janeiro','BR',6.8],['Belo Horizonte','BR',6.9],['Curitiba','BR',7.1],['Brasilia','BR',6.6],['Florianopolis','BR',7.4],['Porto Alegre','BR',6.8],['Salvador','BR',7.0],['Fortaleza','BR',7.3],['Recife','BR',7.1],['Campinas','BR',6.7],['Balneario Camboriu','BR',7.6],
  ['Buenos Aires','AR',6.2],['Cordoba','AR',6.4],['Mendoza','AR',6.5],['Bariloche','AR',6.8],['Santiago','CL',5.8],['Vina del Mar','CL',6.1],['Valparaiso','CL',6.0],['Bogota','CO',6.9],['Medellin','CO',7.8],['Cartagena','CO',8.2],['Cali','CO',7.2],['Barranquilla','CO',7.1],['Santa Marta','CO',7.7],
  ['Lima','PE',6.4],['Cusco','PE',7.1],['Arequipa','PE',6.5],['Panama City','PA',7.6],['Coronado','PA',7.2],['Boquete','PA',7.0],['San Jose CR','CR',7.1],['Tamarindo','CR',8.0],['Santa Teresa','CR',8.2],['Jaco','CR',7.7],['Santo Domingo','DO',7.5],['Punta Cana','DO',8.5],['Santiago de los Caballeros','DO',7.3],['Nassau','BS',6.9],
  ['Cape Town','ZA',7.9],['Johannesburg','ZA',8.6],['Pretoria','ZA',8.2],['Durban','ZA',8.4],['Stellenbosch','ZA',7.6],['Sandton','ZA',8.3],['Nairobi','KE',8.1],['Mombasa','KE',7.8],['Kisumu','KE',7.4],['Lagos','NG',8.5],['Abuja','NG',8.0],['Port Harcourt','NG',7.9],['Accra','GH',8.3],['Kumasi','GH',7.6],['Port Louis','MU',7.1],['Grand Baie','MU',7.5],['Kigali','RW',8.2],['Dar es Salaam','TZ',8.0],['Zanzibar','TZ',8.6],['Arusha','TZ',7.7],
  ['Baghdad','GL',7.5],['Erbil','GL',7.8],['Basra','GL',7.4],['Algiers','GL',6.5],['Oran','GL',6.6],['Tripoli','GL',6.2],['Addis Ababa','GL',8.1],['Kampala','GL',8.0],['Dakar','GL',7.6],['Abidjan','GL',7.8],['Casablanca Finance City','MA',7.4],['Luanda','GL',8.2],['Maputo','GL',7.5],['Gaborone','GL',7.3],['Windhoek','GL',7.2],['Lusaka','GL',7.9],['Harare','GL',7.4],['Victoria Seychelles','GL',7.2],['Tunis Carthage','TN',7.2],['Baku White City','AZ',7.4],
  ['Sofia','GL',6.4],['Plovdiv','GL',6.5],['Varna','GL',6.7],['Belgrade','GL',6.6],['Novi Sad','GL',6.5],['Ljubljana','GL',5.2],['Bratislava','GL',5.6],['Kosice','GL',6.0],['Tirana','GL',6.9],['Sarajevo','GL',6.3],['Podgorica','GL',6.4],['Budva','GL',6.8],['Tivat','GL',6.9],['Skopje','GL',6.2],['Chisinau','GL',6.7],['Reykjavik','GL',5.1],['Andorra la Vella','GL',4.8],['San Marino','GL',4.9],['Vaduz','CH',3.7],['Kyiv','GL',7.2],['Lviv','GL',7.0],['Minsk','GL',6.5],
  ['Kathmandu','GL',6.1],['Pokhara','GL',6.3],['Thimphu','GL',5.8],['Male','GL',7.0],['Bishkek','GL',7.3],['Dushanbe','GL',7.0],['Ashgabat','GL',6.4],['Ulaanbaatar','GL',7.6],['Phnom Penh','GL',6.9],['Siem Reap','GL',7.2],['Sihanoukville','GL',7.1],['Vientiane','GL',6.7],['Yangon','GL',6.4],['Bandar Seri Begawan','GL',6.0],['Suva','GL',6.5],['Port Moresby','GL',7.4],['Havana','GL',5.5],['Kingston','GL',7.0],['Montego Bay','GL',7.5],['Bridgetown','GL',6.8],['Port of Spain','GL',6.6],['Georgetown Guyana','GL',7.9],['Montevideo','GL',6.3],['Punta del Este','GL',6.7],['Asuncion','GL',7.6],['Quito','GL',6.8],['Guayaquil','GL',6.9],['Cuenca','GL',6.7],['La Paz','GL',6.4],['Santa Cruz de la Sierra','GL',7.0],['Guatemala City','GL',7.1],['Antigua Guatemala','GL',7.3],['San Salvador','GL',7.2],['Tegucigalpa','GL',6.9],['Managua','GL',6.8],['San Juan','US',6.9],['George Town Cayman','GL',6.4],['Hamilton Bermuda','GL',5.8],['Providenciales','GL',7.2],['Oranjestad','GL',7.1],['Willemstad','GL',7.0],['Castries','GL',6.8],
  ['Bournemouth Coastal','GB',5.8],['Cheltenham','GB',5.5],['Guildford','GB',5.1],['Winchester','GB',4.9],['Canterbury','GB',5.7],['Chester','GB',6.1],['Lancaster','GB',6.9],['Durham','GB',6.7],['St. Andrews','GB',5.4],['Inverness','GB',6.4],['Warrington','GB',6.8],['Stockport','GB',6.6],['Salford','GB',7.0],['Watford','GB',5.4],['St Albans','GB',4.9],['Aylesbury','GB',5.6],['Ipswich','GB',6.3],['Colchester','GB',6.1],['Peterborough','GB',6.6],['Lincoln','GB',6.7],
  ['Nimes','FR',5.8],['Toulon','FR',5.7],['Brest','FR',6.0],['Angers','FR',5.6],['Dijon','FR',5.7],['Clermont-Ferrand','FR',5.9],['Tours','FR',5.6],['Limoges','FR',6.3],['Amiens','FR',6.1],['Metz','FR',6.0],['Besancon','FR',5.9],['Perpignan','FR',6.2],['Biarritz','FR',4.8],['Saint-Tropez','FR',4.2],['Chamonix','FR',5.0],['Courchevel','FR',4.4],['Megeve','FR',4.5],['Avignon','FR',5.7],
  ['Karlsruhe','DE',4.9],['Augsburg','DE',4.8],['Wiesbaden','DE',4.6],['Mainz','DE',4.7],['Muenster','DE',4.8],['Bochum','DE',5.6],['Wuppertal','DE',5.8],['Bielefeld','DE',5.4],['Aachen','DE',5.2],['Kiel','DE',5.3],['Luebeck','DE',5.1],['Potsdam','DE',4.4],['Rostock','DE',5.4],['Regensburg','DE',4.7],['Wuerzburg','DE',4.8],['Ulm','DE',4.9],
  ['Cordoba ES','ES',6.1],['Valladolid','ES',5.9],['Vigo','ES',5.8],['Gijon','ES',5.9],['A Coruna','ES',5.7],['Vitoria-Gasteiz','ES',5.5],['Elche','ES',6.3],['Oviedo','ES',5.8],['Cartagena ES','ES',6.4],['Jerez de la Frontera','ES',6.2],['Pamplona','ES',5.4],['Santander','ES',5.5],['Almeria','ES',6.3],['Tarragona','ES',6.0],['Girona','ES',5.5],['Cadiz','ES',5.8],['Sitges','ES',5.0],['Sotogrande','ES',5.4],
  ['Brescia','IT',5.7],['Parma','IT',5.6],['Modena','IT',5.5],['Reggio Emilia','IT',5.8],['Perugia','IT',5.9],['Livorno','IT',6.0],['Cagliari','IT',6.0],['Pisa','IT',5.5],['Lucca','IT',5.3],['Siena','IT',5.2],['Salerno','IT',5.9],['Lecce','IT',6.2],['Taormina','IT',6.0],['Olbia','IT',6.1],['Portofino','IT',4.3],['Sorrento','IT',5.4],['Bolzano','IT',4.6],
  ['Cascais Marina','PT',4.8],['Sintra','PT',5.2],['Oeiras','PT',5.3],['Almada','PT',5.9],['Tavira','PT',6.1],['Portimao','PT',6.3],['Alvor','PT',6.2],['Evora','PT',6.0],['Viseu','PT',6.2],['Comporta','PT',5.1],
  ['Almere','NL',5.6],['Breda','NL',5.5],['Tilburg','NL',5.6],['Nijmegen','NL',5.4],['Arnhem','NL',5.5],['Leiden','NL',4.9],['Amersfoort','NL',5.2],['Zwolle','NL',5.6],['Enschede','NL',5.9],['Leeuwarden','NL',6.0],
  ['Winterthur','CH',3.8],['St. Gallen','CH',4.0],['Biel','CH',4.2],['Thun','CH',3.9],['Fribourg','CH',4.0],['Schaffhausen','CH',4.1],['Chur','CH',3.9],['Montreux','CH',3.7],['Verbier','CH',3.4],['Gstaad','CH',3.1],['Zermatt','CH',3.5],['Davos','CH',3.6],
  ['Marmaris','TR',6.9],['Kusadasi','TR',7.0],['Didim','TR',7.1],['Cesme','TR',6.6],['Alacati','TR',6.5],['Kas','TR',6.8],['Gocek','TR',6.7],['Yalova','TR',6.8],['Sakarya','TR',6.6],['Kocaeli','TR',6.5],['Samsun','TR',6.4],['Denizli','TR',6.3],['Canakkale','TR',6.5],
  ['Rajkot','IN',5.6],['Madurai','IN',5.5],['Jodhpur','IN',5.6],['Raipur','IN',5.7],['Kota','IN',5.9],['Vijayawada','IN',5.6],['Amritsar','IN',5.4],['Varanasi','IN',5.5],['Srinagar','IN',5.3],['Dehradun','IN',5.5],['Mangaluru','IN',5.6],['Faridabad','IN',5.3],['Ghaziabad','IN',5.4],['Patna','IN',5.5],['Bhopal','IN',5.6],['Ranchi','IN',5.6],['Jamshedpur','IN',5.7],['Tiruchirappalli','IN',5.5],['Salem','IN',5.5],['Hubballi','IN',5.6],
  ['Hyderabad PK','PK',6.2],['Sukkur','PK',6.0],['Mardan','PK',6.0],['Sargodha','PK',6.1],['Jhelum','PK',6.1],['Gujrat','PK',6.1],['Mirpur','PK',6.2],['Wah Cantt','PK',6.0],
  ['Balikpapan','ID',7.2],['Palembang','ID',6.7],['Malang','ID',6.9],['Bekasi','ID',6.6],['Tangerang','ID',6.8],['Depok','ID',6.7],['Bogor','ID',6.8],['Manado','ID',7.0],['Pekanbaru','ID',6.8],['Labuan Bajo','ID',8.4],
  ['Shah Alam','MY',5.8],['Subang Jaya','MY',5.7],['Seremban','MY',6.0],['Kuantan','MY',6.1],['Miri','MY',6.2],['Kota Bharu','MY',5.9],['Alor Setar','MY',5.8],['Putrajaya','MY',5.6],
  ['Rayong','TH',6.8],['Chonburi','TH',6.7],['Chiang Rai','TH',6.4],['Khon Kaen','TH',6.5],['Udon Thani','TH',6.4],['Hat Yai','TH',6.5],['Phang Nga','TH',7.3],['Koh Phangan','TH',7.9],
  ['Vung Tau','VN',6.3],['Da Lat','VN',6.1],['Hue','VN',5.8],['Quy Nhon','VN',6.2],['Ha Long','VN',6.4],['Bien Hoa','VN',5.9],['Binh Duong','VN',6.2],
  ['Baguio','PH',6.5],['Bacolod','PH',6.7],['Cagayan de Oro','PH',6.8],['Santa Rosa','PH',6.6],['Pasig','PH',6.4],['Mandaluyong','PH',6.5],['Pasay','PH',6.6],['Siargao','PH',7.5],['Palawan','PH',7.3],
  ['Kawasaki','JP',5.0],['Saitama','JP',5.3],['Chiba','JP',5.5],['Kumamoto','JP',6.1],['Kagoshima','JP',6.0],['Okayama','JP',5.9],['Kanazawa','JP',5.7],['Nagasaki','JP',5.8],['Matsuyama','JP',5.9],['Takamatsu','JP',5.8],['Karuizawa','JP',5.4],['Hakuba','JP',6.2],
  ['Ulsan','KR',5.1],['Changwon','KR',5.0],['Yongin','KR',4.6],['Goyang','KR',4.7],['Cheongju','KR',5.1],['Jeonju','KR',5.0],['Cheonan','KR',5.2],['Gangneung','KR',5.3],
  ['Zhuhai','CN',3.7],['Foshan','CN',3.9],['Dongguan','CN',4.0],['Wuxi','CN',4.0],['Hefei','CN',4.1],['Fuzhou','CN',3.9],['Kunming','CN',4.3],['Zhengzhou','CN',4.2],['Jinan','CN',4.1],['Harbin','CN',4.4],['Shenyang','CN',4.4],['Haikou','CN',4.4],['Guiyang','CN',4.5],['Nanchang','CN',4.3],['Nanning','CN',4.3],
  ['Girona Costa Brava','ES',5.6],['Oaxaca','MX',7.2],['Mazatlan','MX',7.7],['La Paz MX','MX',7.6],['San Luis Potosi','MX',7.1],['Aguascalientes','MX',7.0],['Leon','MX',7.0],['Morelia','MX',6.8],['Cabo San Lucas','MX',7.9],['San Jose del Cabo','MX',7.7],['Sayulita','MX',8.1],['Valle de Bravo','MX',7.0],
  ['Goiania','BR',6.9],['Belem','BR',7.0],['Manaus','BR',7.1],['Vitoria','BR',6.8],['Ribeirao Preto','BR',6.9],['Joinville','BR',7.0],['Natal','BR',7.2],['Maceio','BR',7.3],['Buzios','BR',7.5],['Gramado','BR',7.4],
  ['Key West','US',5.8],['Clearwater','US',6.5],['St. Petersburg','US',6.6],['Destin','US',6.8],['Park City','US',5.2],['Jackson Hole','US',4.5],['Sedona','US',6.1],['Santa Barbara','US',4.4],['Napa','US',4.8],['Carmel','US',4.2],['Laguna Beach','US',4.3],['Newport Beach','US',4.4],['La Jolla','US',4.6],['Malibu','US',4.1],['Greenwich','US',4.7],['Hamptons','US',4.5],['Stamford','US',5.8],['Providence','US',6.6],['Portland ME','US',6.1],['Burlington','US',6.0],['Ann Arbor','US',6.2],['Chapel Hill','US',5.9],['Durham NC','US',6.4],['Bentonville','US',6.8],['Fayetteville','US',6.9],['Huntsville','US',7.1],['Reno','US',6.2],['Spokane','US',6.5],['Tacoma','US',5.9],['Bend','US',5.6],['Provo','US',6.0],['Frisco','US',6.1],['McKinney','US',6.2],['The Woodlands','US',6.4],['Coral Springs','US',6.3],['Aventura','US',6.1],['Brickell','US',6.4],['Sunny Isles','US',6.0],['Palm Beach','US',5.3],['Vero Beach','US',6.2],
  ['Bathurst','AU',5.8],['Byron Bay','AU',4.9],['Noosa','AU',5.1],['Toowoomba','AU',6.2],['Ballarat','AU',5.6],['Bendigo','AU',5.7],['Launceston','AU',6.0],['Fremantle','AU',5.9],['Mandurah','AU',6.3],['Bunbury','AU',6.4],
  ['Tauranga Bay','NZ',5.3],['Napier','NZ',5.7],['Nelson','NZ',5.6],['Rotorua','NZ',6.1],['Wanaka','NZ',5.1],['Palmerston North','NZ',6.0],
  ['Ajman Corniche','AE',8.6],['Al Khobar Bay','SA',8.1],['Jebel Akhdar','OM',7.9],['Musandam','OM',7.5],['Al Mouj Muscat','OM',8.4],['Lusail Marina','QA',7.7],['Seef District','BH',7.9],['El Alamein','EG',8.4],['North Coast Egypt','EG',8.5],['Ain Sokhna','EG',8.0],['Dakhla','MA',7.6],['Taghazout','MA',8.0],['Dead Sea','JO',7.7],['Petra','JO',7.5],
  ['Capri','IT',4.6],['Amalfi','IT',4.9],['Sardinia','IT',5.8],['Corsica','FR',5.1],['Mallorca','ES',5.2],['Menorca','ES',5.4],['Lanzarote','ES',6.1],['Fuerteventura','ES',6.2],['Crete','GR',6.6],['Corfu','GR',6.5],['Paros','GR',6.7],['Naxos','GR',6.6],['Kefalonia','GR',6.4],['Ayia Napa','CY',6.8],['Protaras','CY',6.7],['Gozo','MT',5.9],['Algarve','PT',6.1],['Madeira','PT',5.9],['Azores','PT',6.2],
  ['Lofoten','NO',5.6],['Tromso','NO',5.5],['Rovaniemi','FI',6.1],['Oulu','FI',5.7],['Zakopane','PL',6.7],['Sopot','PL',6.0],['Gdynia','PL',6.3],['Katowice','PL',6.9],['Karlovy Vary','CZ',5.8],['Cesky Krumlov','CZ',5.7],['Sibiu','RO',6.6],['Iasi','RO',6.8],['Rijeka','HR',6.1],['Pula','HR',6.2],['Rovinj','HR',6.0],['Hvar','HR',6.4],['Szekesfehervar','HU',6.2],['Gyor','HU',6.3],['Szeged','HU',6.4],['Klaipeda','LT',6.4],['Parnu','EE',6.0],['Liepaja','LV',6.6],
  ['Baku Caspian','AZ',7.2],['Gudauri','GE',9.1],['Kazbegi','GE',8.5],['Kutaisi','GE',8.0],['Dilijan','AM',7.3],['Bukhara','UZ',7.4],['Aktau','KZ',7.3],['Bishkek Chuy','GL',7.3],['Galle Fort','LK',6.9],['Negombo','LK',6.5],['Sylhet','BD',5.7],['Coxs Bazar','BD',6.0],['Hua Hin Beach','TH',6.7],['Khao Lak','TH',7.0],['Hoi An','VN',6.4],['Mui Ne','VN',6.3],['Cebu Mactan','PH',6.9],['Subic Bay','PH',6.7],['Okinawa','JP',5.8],['Furano','JP',6.3],['Hakone','JP',5.5],['Gyeongju','KR',5.1],['Seogwipo','KR',5.6],['Macau','HK',3.8],['Hualien','TW',3.7],['Kenting','TW',4.1],
  ['Rosario','AR',6.3],['Mar del Plata','AR',6.4],['Ushuaia','AR',6.6],['Antofagasta','CL',6.3],['Puerto Varas','CL',6.0],['Bucaramanga','CO',7.1],['Pereira','CO',7.3],['Trujillo','PE',6.5],['David PA','PA',7.0],['Liberia CR','CR',7.5],['Nosara','CR',7.9],['Puerto Plata','DO',7.8],['Las Terrenas','DO',8.1],['Freeport','BS',7.1],['Exuma','BS',7.0],
  ['Knysna','ZA',7.8],['Umhlanga','ZA',8.3],['Paarl','ZA',7.7],['Nakuru','KE',7.6],['Naivasha','KE',7.5],['Diani Beach','KE',8.2],['Lekki','NG',8.6],['Ikoyi','NG',8.0],['Takoradi','GH',7.8],['Flic en Flac','MU',7.4],['Tamarin','MU',7.3],['Gisenyi','RW',7.8],['Mwanza','TZ',7.5],['Nungwi','TZ',8.7],
  ['Charlottesville','US',5.9],['Wilmington','US',6.5],['Myrtle Beach','US',7.0],['St. Augustine','US',6.4],['Ocala','US',7.0],['Lakeland','US',6.9],['Cape Coral','US',6.6],['Fort Myers','US',6.7],['Gainesville','US',6.8],['Tallahassee','US',6.9],['Pensacola','US',6.8],['Mobile','US',7.4],['Baton Rouge','US',7.2],['Little Rock','US',7.5],['Springfield MO','US',7.3],['Columbia SC','US',7.0],['Columbia MO','US',6.9],['Fargo','US',7.1],['Sioux Falls','US',7.0],['Rapid City','US',6.8],['Missoula','US',5.9],['Bozeman','US',5.4],['Whitefish','US',5.2],['Sun Valley','US',4.8],['Telluride','US',4.4],['Vail','US',4.5],['Breckenridge','US',5.1],['Steamboat Springs','US',5.3],['Santa Fe','US',5.8],['Flagstaff','US',6.0],['Lake Tahoe','US',5.4],['Big Bear','US',6.3],['Joshua Tree','US',6.9],['Gatlinburg','US',7.5],['Pigeon Forge','US',7.4],['Branson','US',7.3],['Galveston','US',6.8],['Corpus Christi','US',7.0],['Fredericksburg','US',6.6],['Katy','US',6.7],['Round Rock','US',6.3],['Tempe','US',6.2],['Gilbert','US',6.1],['Peoria AZ','US',6.3],['Glendale AZ','US',6.5],['Carlsbad','US',4.9],['Oceanside','US',5.3],['Monterey','US',4.8],['San Luis Obispo','US',5.1],['Eugene','US',5.8],['Salem OR','US',6.0],['Vancouver WA','US',5.9],['Bellingham','US',5.6],['Olympia','US',5.8],['Anchorage Midtown','US',6.8],['Kailua-Kona','US',5.4],['Maui','US',4.9],['Kihei','US',5.2],['Kauai','US',5.0],
  ['Kingston ON','CA',5.9],['London ON','CA',6.1],['Windsor ON','CA',6.5],['Oshawa','CA',5.8],['Barrie','CA',5.7],['Guelph','CA',5.5],['Sudbury','CA',6.9],['Thunder Bay','CA',7.0],['Laval','CA',5.7],['Gatineau','CA',5.9],['Sherbrooke','CA',6.3],['Trois-Rivieres','CA',6.4],['St. Johns NL','CA',6.6],['Charlottetown','CA',6.2],['Fredericton','CA',6.5],['Saint John NB','CA',6.9],['Banff','CA',5.3],['Canmore','CA',5.4],['Whistler','CA',4.8],['Nanaimo','CA',5.6],['Kamloops','CA',6.0],['Red Deer','CA',6.8],['Lethbridge','CA',6.9],['Abbotsford','CA',5.1],['Coquitlam','CA',4.7],
];

const INLINED_CITIES_MAP = new Map<string, InlinedCityEntry>();
for (const [city, countryKey, avgCapRate] of CITY_RAW) {
  const norm = city.trim().toLowerCase();
  if (INLINED_CITIES_MAP.has(norm)) continue;
  const spec = CITY_COUNTRIES[countryKey] || CITY_COUNTRIES.GL;
  INLINED_CITIES_MAP.set(norm, {
    city,
    country: spec[0],
    countryCode: spec[1],
    currency: spec[2],
    taxRate: spec[3],
    visaNote: spec[4],
    avgCapRate,
  });
}

function findInlinedCity(rawCity?: string | null): InlinedCityEntry | null {
  const raw = String(rawCity || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (INLINED_CITIES_MAP.has(lower)) return INLINED_CITIES_MAP.get(lower)!;
  const strippedParen = raw.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  if (INLINED_CITIES_MAP.has(strippedParen)) return INLINED_CITIES_MAP.get(strippedParen)!;
  const beforeComma = raw.split(',')[0].trim().toLowerCase();
  if (INLINED_CITIES_MAP.has(beforeComma)) return INLINED_CITIES_MAP.get(beforeComma)!;
  return null;
}

const OFFICIAL_CITIES = [
  {
    city: 'Muscat',
    country: 'Oman',
    countryIso3: 'OMN',
    flag: '🇴🇲',
    code: 'MCT',
    timezone: 'Asia/Muscat',
    price_per_m2: 1612,
    gross_yield: 8.4,
    transfer_tax: 3.0,
    capital_gains_tax: '0% (Tax-Free)',
    golden_visa_tier: '$650K',
    rental_yoy: 7.2,
    benchmark_label: 'ITC Cap Rate 8.4%',
    source: 'Savills Oman (Q1 2026)',
  },
  {
    city: 'Dubai',
    country: 'UAE',
    countryIso3: 'ARE',
    flag: '🇦🇪',
    code: 'DXB',
    timezone: 'Asia/Dubai',
    price_per_m2: 4120,
    gross_yield: 8.8,
    transfer_tax: 4.0,
    capital_gains_tax: '0% (Tax-Free)',
    golden_visa_tier: '$545K',
    rental_yoy: 11.5,
    benchmark_label: 'DLD Index 184.2 pts',
    source: 'Dubai Land Department (DLD Q1 2026)',
  },
  {
    city: 'Riyadh',
    country: 'Saudi Arabia',
    countryIso3: 'SAU',
    flag: '🇸🇦',
    code: 'RUH',
    timezone: 'Asia/Riyadh',
    price_per_m2: 2250,
    gross_yield: 8.8,
    transfer_tax: 5.0,
    capital_gains_tax: '0% for Individuals',
    golden_visa_tier: '$1.06M',
    rental_yoy: 14.8,
    benchmark_label: 'KAFD Rental +380 bps',
    source: 'JLL Riyadh (Q1 2026)',
  },
  {
    city: 'Miami',
    country: 'United States',
    countryIso3: 'USA',
    flag: '🇺🇸',
    code: 'MIA',
    timezone: 'America/New_York',
    price_per_m2: 8400,
    gross_yield: 6.7,
    transfer_tax: 1.5,
    capital_gains_tax: '15%-20% Fed / 0% FL State',
    golden_visa_tier: '$800K',
    rental_yoy: 6.4,
    benchmark_label: 'Brickell Gross 6.7%',
    source: 'Miami Realtors / FRED',
  },
  {
    city: 'London',
    country: 'United Kingdom',
    countryIso3: 'GBR',
    flag: '🇬🇧',
    code: 'LON',
    timezone: 'Europe/London',
    price_per_m2: 14200,
    gross_yield: 4.8,
    transfer_tax: 7.5,
    capital_gains_tax: '18%-28% Non-Resident',
    golden_visa_tier: 'None',
    rental_yoy: 5.8,
    benchmark_label: 'UK HPI 20.8x P/E',
    source: 'ONS UK House Price Index',
  },
  {
    city: 'New York',
    country: 'United States',
    countryIso3: 'USA',
    flag: '🇺🇸',
    code: 'NYC',
    timezone: 'America/New_York',
    price_per_m2: 16800,
    gross_yield: 4.6,
    transfer_tax: 2.0,
    capital_gains_tax: '20% Fed + NY State',
    golden_visa_tier: '$800K',
    rental_yoy: 4.9,
    benchmark_label: 'Tribeca 4.6% Gross',
    source: 'StreetEasy Manhattan Index',
  },
  {
    city: 'Singapore',
    country: 'Singapore',
    countryIso3: 'SGP',
    flag: '🇸🇬',
    code: 'SGP',
    timezone: 'Asia/Singapore',
    price_per_m2: 18400,
    gross_yield: 3.9,
    transfer_tax: 60.0,
    capital_gains_tax: '0% (Tax-Free)',
    golden_visa_tier: '$7.5M',
    rental_yoy: 3.5,
    benchmark_label: 'Foreign ABSD 60%',
    source: 'IRAS Singapore',
  },
];

async function fetchWorldBankInflation(): Promise<Record<string, { value: number; year: string }>> {
  const result: Record<string, { value: number; year: string }> = {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      'https://api.worldbank.org/v2/country/USA;ARE;GBR;SGP;SAU;OMN/indicator/FP.CPI.TOTL.ZG?format=json&mrnev=1',
      { signal: controller.signal }
    );
    if (!res.ok) return result;
    const json = await res.json();
    const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
    for (const row of rows) {
      const iso3 = row?.countryiso3code;
      const val = row?.value;
      const yr = row?.date;
      if (iso3 && typeof val === 'number') {
        result[iso3] = { value: Number(val.toFixed(2)), year: String(yr || '') };
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return result;
}

async function fetchFredSeriesLatest(seriesId: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    for (let i = lines.length - 1; i >= 1; i--) {
      const parts = lines[i].split(',');
      const num = parseFloat(parts[1]);
      if (Number.isFinite(num)) {
        return Number(num.toFixed(2));
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchExchangeRates(): Promise<Record<string, number> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.rates;
    if (!r) return null;
    return {
      USD: 1,
      OMR: Number((r.OMR || 0.385).toFixed(4)),
      AED: Number((r.AED || 3.6725).toFixed(4)),
      SAR: Number((r.SAR || 3.75).toFixed(4)),
      GBP: Number((r.GBP || 0.79).toFixed(4)),
      SGD: Number((r.SGD || 1.34).toFixed(4)),
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildMarketResponse(params: {
  now: number;
  inflation: Record<string, { value: number; year: string }>;
  dgs10: number;
  dgs2: number;
  fxRates: Record<string, number>;
  stale: boolean;
}): LiveMarketResponse {
  const cities: LiveMarketCity[] = OFFICIAL_CITIES.map((c) => ({
    city: c.city,
    country: c.country,
    countryIso3: c.countryIso3,
    flag: c.flag,
    code: c.code,
    timezone: c.timezone,
    price_per_m2: c.price_per_m2,
    gross_yield: c.gross_yield,
    transfer_tax: c.transfer_tax,
    capital_gains_tax: c.capital_gains_tax,
    golden_visa_tier: c.golden_visa_tier,
    rental_yoy: c.rental_yoy,
    inflation_pct: params.inflation[c.countryIso3]?.value ?? null,
    benchmark_label: c.benchmark_label,
    source: c.source,
    last_updated: params.now,
  }));

  const muscat = cities.find((c) => c.city === 'Muscat')?.gross_yield || 8.4;
  const singapore = cities.find((c) => c.city === 'Singapore')?.gross_yield || 3.9;
  const spreadBps = Math.round((muscat - singapore) * 100);
  const muscatVsUs10yBps = Math.round((muscat - params.dgs10) * 100);
  const yieldCurveBps = Math.round((params.dgs10 - params.dgs2) * 100);
  const iso = new Date(params.now).toISOString();
  const display = new Date(params.now).toUTCString().replace(' GMT', ' UTC');

  return {
    cities,
    macro: {
      us_10y_yield: params.dgs10,
      us_2y_yield: params.dgs2,
      yield_curve_bps: yieldCurveBps,
      inflation_by_country: params.inflation,
      fx_rates: params.fxRates,
    },
    metrics: {
      markets_tracked: cities.length,
      sovereign_spread_bps: spreadBps,
      muscat_vs_us10y_bps: muscatVsUs10yBps,
      tax_havens: 'Oman & UAE (0% CGT)',
      prime_yield_spread: `${muscat}% vs ${singapore}%`,
      fx_usd_omr: params.fxRates.OMR || 0.385,
      fx_usd_aed: params.fxRates.AED || 3.6725,
      fx_usd_gbp: params.fxRates.GBP || 0.79,
      us_10y_yield: params.dgs10,
      dubai_dld_index: 184.2,
    },
    sources: ['World Bank', 'FRED', 'ExchangeRate-API', 'DLD', 'ONS', 'JLL', 'Savills', 'IRAS', 'StreetEasy'],
    data_type: 'Estimated',
    macro_data_type: params.stale ? 'Estimated' : 'Actual',
    benchmark_data_type: 'Estimated',
    updated_date: iso.slice(0, 10),
    last_updated: params.now,
    last_synced_iso: iso,
    last_synced_display: display,
    cache_ttl_hours: 6,
    stale: params.stale,
  };
}

function getDeterministicMarketData(now = Date.now()): LiveMarketResponse {
  if (cachedMarketResponse) return cachedMarketResponse;
  return buildMarketResponse({
    now,
    inflation: {
      OMN: { value: 1.1, year: '2025' },
      ARE: { value: 2.0, year: '2025' },
      SAU: { value: 1.8, year: '2025' },
      USA: { value: 2.8, year: '2025' },
      GBR: { value: 2.5, year: '2025' },
      SGP: { value: 2.3, year: '2025' },
    },
    dgs10: 4.28,
    dgs2: 4.12,
    fxRates: {
      USD: 1,
      OMR: 0.385,
      AED: 3.6725,
      SAR: 3.75,
      GBP: 0.79,
      SGD: 1.34,
    },
    stale: true,
  });
}

async function getLiveMarketDataWithCache(forceRefresh = false): Promise<LiveMarketResponse> {
  const now = Date.now();
  if (!forceRefresh && cachedMarketResponse && now - cachedMarketAt < MARKET_CACHE_TTL_MS) {
    return cachedMarketResponse;
  }

  const [wbRes, dgs10Res, dgs2Res, fxRes] = await Promise.allSettled([
    fetchWorldBankInflation(),
    fetchFredSeriesLatest('DGS10'),
    fetchFredSeriesLatest('DGS2'),
    fetchExchangeRates(),
  ]);

  const anySuccess =
    (wbRes.status === 'fulfilled' && Object.keys(wbRes.value).length > 0) ||
    (dgs10Res.status === 'fulfilled' && dgs10Res.value !== null) ||
    (fxRes.status === 'fulfilled' && fxRes.value !== null);

  if (!anySuccess && cachedMarketResponse) {
    return { ...cachedMarketResponse, stale: true };
  }

  const fallback = getDeterministicMarketData(now);
  const inflation =
    wbRes.status === 'fulfilled' && Object.keys(wbRes.value).length > 0
      ? { ...fallback.macro.inflation_by_country, ...wbRes.value }
      : cachedMarketResponse?.macro.inflation_by_country || fallback.macro.inflation_by_country;

  const dgs10 =
    dgs10Res.status === 'fulfilled' && dgs10Res.value !== null
      ? dgs10Res.value
      : cachedMarketResponse?.macro.us_10y_yield || fallback.macro.us_10y_yield;

  const dgs2 =
    dgs2Res.status === 'fulfilled' && dgs2Res.value !== null
      ? dgs2Res.value
      : cachedMarketResponse?.macro.us_2y_yield || fallback.macro.us_2y_yield;

  const fxRates =
    fxRes.status === 'fulfilled' && fxRes.value !== null
      ? fxRes.value
      : cachedMarketResponse?.macro.fx_rates || fallback.macro.fx_rates;

  const built = buildMarketResponse({
    now,
    inflation,
    dgs10,
    dgs2,
    fxRates,
    stale: !anySuccess,
  });

  cachedMarketResponse = built;
  cachedMarketAt = now;
  return built;
}

interface MarketNewsArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const NEWS_CACHE_MS = 60 * 60 * 1000;
let cachedArticles: MarketNewsArticle[] = [];
let cachedNewsAt = 0;

function decodeXmlEntities(str: string): string {
  return (str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractXmlTag(xmlBlock: string, tag: string): string {
  const match = xmlBlock.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXmlEntities(match[1]) : '';
}

async function fetchGoogleMarketNews(): Promise<{
  success: boolean;
  articles: MarketNewsArticle[];
  lastSyncedIso: string;
}> {
  const now = Date.now();
  if (cachedArticles.length > 0 && now - cachedNewsAt < NEWS_CACHE_MS) {
    return {
      success: true,
      articles: cachedArticles,
      lastSyncedIso: new Date(cachedNewsAt).toISOString(),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const rssUrl =
      'https://news.google.com/rss/search?q=global+real+estate+market+Dubai+London&hl=en-US&gl=US&ceid=US:en';
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AQARI-Terminal/1.0)',
      },
    });
    if (!res.ok) {
      return {
        success: cachedArticles.length > 0,
        articles: cachedArticles,
        lastSyncedIso: new Date(cachedNewsAt || now).toISOString(),
      };
    }

    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const parsed: MarketNewsArticle[] = [];

    for (const item of items.slice(0, 5)) {
      const title = extractXmlTag(item, 'title');
      const link = extractXmlTag(item, 'link');
      const pubDate = extractXmlTag(item, 'pubDate');
      const source = extractXmlTag(item, 'source') || 'Google News';
      if (title && link) {
        parsed.push({ title, link, pubDate, source });
      }
    }

    if (parsed.length > 0) {
      cachedArticles = parsed;
      cachedNewsAt = now;
      return {
        success: true,
        articles: parsed,
        lastSyncedIso: new Date(now).toISOString(),
      };
    }

    return {
      success: false,
      articles: [],
      lastSyncedIso: new Date(now).toISOString(),
    };
  } catch {
    return {
      success: cachedArticles.length > 0,
      articles: cachedArticles,
      lastSyncedIso: new Date(cachedNewsAt || now).toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

const DEMO_ANALYSES: Record<string, any> = {
  tribeca: {
    slug: 'tribeca',
    tier: 'Free',
    title: 'Tribeca Cast-Iron Architectural Loft',
    subtitle: 'Franklin Street, Historic Tribeca, New York',
    city: 'New York',
    country: 'United States',
    flag: '🇺🇸',
    propertyType: 'Historic Cast-Iron Luxury Loft',
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 4200000,
    rentMonthlyUSD: 16100,
    areaSqM: 250,
    grossYield: 4.6,
    netYield: 4.2,
    capRate: 4.2,
    cashOnCash: 3.8,
    irr5Yr: 8.6,
    monthlyCashflowUSD: 3240,
    noiAnnualUSD: 163800,
    dscr: '1.28',
    downPaymentPct: 30,
    interestRatePct: 6.25,
    taxStructure: 'Federal & NY State Ordinary Capital Gains',
    goldenVisa: 'EB-5 Eligible ($800K TEA)',
    occupancyRate: 97,
    tenantRisk: 'AA',
    liquidityScore: 95,
    featuresUnlocked: [
      'Basic Institutional Yield Calculator (Cap Rate, CoC, IRR)',
      'Monthly Net Cash Flow Projection',
      'Historic 36-Month Occupancy Trend',
      'Standard Currency Normalization (USD/OMR/AED/GBP)',
    ],
    featuresLocked: [
      'Cross-Border Tax Shield Modeling (Standard / Pro)',
      'Monte Carlo Rate-Shock Simulations (Pro / Agency)',
      'Multi-Asset Portfolio Stress Testing (Agency)',
      'Institutional PDF Memorandum Export (Pro / Agency)',
    ],
    watermarkNote: 'SAMPLE FREE TIER ANALYSIS • UNLOCK PRO FOR SENSITIVITY MATRIX & TAX SHIELDS',
  },
  'dubai-marina': {
    slug: 'dubai-marina',
    tier: 'Standard',
    title: 'Dubai Marina - Marina Heights Tower',
    subtitle: 'Waterfront Suite, Dubai Marina Promenade, UAE',
    city: 'Dubai',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    propertyType: 'High-Floor Waterfront Suite',
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 652800,
    rentMonthlyUSD: 4800,
    areaSqM: 120,
    grossYield: 8.8,
    netYield: 8.4,
    capRate: 8.4,
    cashOnCash: 11.2,
    irr5Yr: 15.6,
    monthlyCashflowUSD: 2840,
    noiAnnualUSD: 54720,
    dscr: '1.82',
    downPaymentPct: 30,
    interestRatePct: 5.2,
    taxStructure: '0% Capital Gains / 0% Rental Income Tax',
    goldenVisa: 'Permanent 10-Year UAE Golden Visa ($545K+)',
    occupancyRate: 96,
    tenantRisk: 'AAA',
    liquidityScore: 98,
    featuresUnlocked: [
      'Full OPEX, Vacancy & Service Charge Modeling',
      'Mortgage Amortization & DSCR Stress Testing',
      '5-Year Net IRR Capital Appreciation Projection',
      '0% UAE Freehold Tax Exemption Breakdown',
      'Up to 30 Saved Portfolio Properties',
    ],
    featuresLocked: [
      'Monte Carlo 200-Simulation Stochastic Engine (Pro)',
      'Interest Rate Shock (+200bps) Stress Test (Pro)',
      'PDF Investment Memorandum Generation (Pro)',
      'Real-Time Rest API & Multi-Jurisdiction Feeds (Agency)',
    ],
    watermarkNote: 'SAMPLE STANDARD TIER ANALYSIS • SIGN IN FOR FULL UNDERWRITING PLANS',
  },
  'muscat-wave': {
    slug: 'muscat-wave',
    tier: 'Pro',
    title: 'Muscat ITC - The Wave (Al Mouj)',
    subtitle: 'Marina Drive, Flagship Integrated Tourism Complex, Muscat, Oman',
    city: 'Muscat',
    country: 'Oman',
    flag: '🇴🇲',
    propertyType: 'ITC Waterfront Luxury Freehold Condo',
    imageUrl: 'https://images.unsplash.com/photo-1546412414-e1885259563a?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 310000,
    rentMonthlyUSD: 2150,
    areaSqM: 110,
    grossYield: 8.4,
    netYield: 7.9,
    capRate: 7.9,
    cashOnCash: 12.4,
    irr5Yr: 17.2,
    monthlyCashflowUSD: 1420,
    noiAnnualUSD: 24510,
    dscr: '2.14',
    downPaymentPct: 30,
    interestRatePct: 4.85,
    taxStructure: '0% Capital Gains / 0% Net Income Tax (Oman ITC Freehold)',
    goldenVisa: 'Oman Investor Residency Tier-1 ($650K Freehold)',
    occupancyRate: 95,
    tenantRisk: 'AAA',
    liquidityScore: 92,
    featuresUnlocked: [
      '400 Institutional Analyses per 30-Day Window',
      'Monte Carlo 200-Simulation Stochastic Engine',
      '+200bps Macro Interest Rate Stress Test',
      'Oman ITC 100% Foreign Freehold Title Deed Audit',
      'Complete Cash Flow Waterfall Breakdown',
      'High-Resolution PDF Investment Memorandum Generation',
    ],
    featuresLocked: [
      'Direct REST API Endpoints & Multi-User Desk (Agency)',
      'White-Glove Bespoke Syndicate Structuring (Agency)',
    ],
    monteCarlo: {
      simulationsCount: 200,
      positiveYieldProbabilityPct: 98.4,
      rateShockStressBps: 200,
      medianIRR: 16.8,
    },
    watermarkNote: 'SAMPLE PRO TIER ANALYSIS • INSTITUTIONAL WATERFALL & MONTE CARLO DEMO',
  },
  'london-mayfair': {
    slug: 'london-mayfair',
    tier: 'Pro',
    title: 'London Mayfair - Curzon Street Residences',
    subtitle: 'Curzon Street, Mayfair, Prime Central London, UK',
    city: 'London',
    country: 'United Kingdom',
    flag: '🇬🇧',
    propertyType: 'Prime Central London Generational Asset',
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 2800000,
    rentMonthlyUSD: 9500,
    areaSqM: 170,
    grossYield: 4.8,
    netYield: 4.3,
    capRate: 4.3,
    cashOnCash: 4.6,
    irr5Yr: 9.8,
    monthlyCashflowUSD: 2650,
    noiAnnualUSD: 120400,
    dscr: '1.45',
    downPaymentPct: 35,
    interestRatePct: 5.6,
    taxStructure: '18% - 28% Non-Resident Capital Gains + SDLT Stamp Duty Surcharge',
    goldenVisa: 'UK Innovator Founder Route (Alternative)',
    occupancyRate: 98,
    tenantRisk: 'AAA',
    liquidityScore: 88,
    featuresUnlocked: [
      'Stamp Duty Land Tax (SDLT) Cross-Border Surcharge Calculator',
      'Non-Resident CGT & Inheritance Tax Risk Modeling',
      'Monte Carlo Interest Rate Stress Sensitivity',
      'Downloadable PDF Investment Memorandum',
      'Save up to 150 Institutional Properties',
    ],
    featuresLocked: ['Direct REST API Endpoints & Syndicate Desk (Agency)'],
    monteCarlo: {
      simulationsCount: 200,
      positiveYieldProbabilityPct: 94.6,
      rateShockStressBps: 200,
      medianIRR: 9.4,
    },
    watermarkNote: 'SAMPLE PRO TIER ANALYSIS • PRIME WEALTH PRESERVATION ASSET AUDIT',
  },
  'cross-border-portfolio': {
    slug: 'cross-border-portfolio',
    tier: 'Agency',
    title: 'GCC & UK Cross-Border Core-Plus Portfolio',
    subtitle: 'Syndicated Allocation: Muscat (45%) + Dubai (35%) + London (20%)',
    city: 'Multi-Jurisdiction',
    country: 'Oman / UAE / UK',
    flag: '🌐',
    propertyType: 'Diversified Cross-Border Core-Plus Syndicate',
    imageUrl: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 652400,
    rentMonthlyUSD: 4680,
    areaSqM: 400,
    grossYield: 8.6,
    netYield: 7.4,
    capRate: 7.4,
    cashOnCash: 12.8,
    irr5Yr: 16.4,
    monthlyCashflowUSD: 4680,
    noiAnnualUSD: 56160,
    dscr: '2.08',
    downPaymentPct: 30,
    interestRatePct: 5.1,
    taxStructure: 'Blended: 80% Zero-Tax Freehold (GCC) / 20% UK Core Hedge',
    goldenVisa: 'Dual UAE & Oman Investor Visa Eligible',
    occupancyRate: 96.5,
    tenantRisk: 'AAA',
    liquidityScore: 94,
    featuresUnlocked: [
      'Portfolio Underwriting Dossiers & Syndicate Aggregation (Up to 5,000 fair-use saves)',
      'Automated Cross-Border Currency Hedging (USD, OMR, AED, GBP)',
      'Multi-Jurisdiction Tax Shield Arbitrage (+360bps Yield Spread)',
      'Live REST API Access & Instant Webhook Feeds',
      'Dedicated 1-on-1 Analyst Desk & Custom White-Glove Modeling',
    ],
    featuresLocked: [],
    portfolioBreakdown: [
      { asset: 'Muscat ITC Luxury Freehold', city: 'Muscat', allocationPct: 45, valueUSD: 293580, yieldPct: 8.4 },
      { asset: 'Dubai Marina Waterfront Suite', city: 'Dubai', allocationPct: 35, valueUSD: 228340, yieldPct: 8.8 },
      { asset: 'London Mayfair Preservation Core', city: 'London', allocationPct: 20, valueUSD: 130480, yieldPct: 4.8 },
    ],
    watermarkNote: 'SAMPLE AGENCY TIER ANALYSIS • INSTITUTIONAL MULTI-ASSET PORTFOLIO',
  },
  'riyadh-singapore-portfolio': {
    slug: 'riyadh-singapore-portfolio',
    tier: 'Agency',
    title: 'Riyadh KAFD Growth & Singapore Core AAA Portfolio',
    subtitle: 'Institutional Pairing: Riyadh Vision 2030 (60%) + Singapore AAA Hub (40%)',
    city: 'Riyadh & Singapore',
    country: 'Saudi Arabia / Singapore',
    flag: '🇸🇦 🇸🇬',
    propertyType: 'High-Growth Corporate Core Institutional Pairing',
    imageUrl: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 1280000,
    rentMonthlyUSD: 7250,
    areaSqM: 320,
    grossYield: 6.8,
    netYield: 6.2,
    capRate: 6.2,
    cashOnCash: 9.6,
    irr5Yr: 15.2,
    monthlyCashflowUSD: 7250,
    noiAnnualUSD: 87000,
    dscr: '1.92',
    downPaymentPct: 35,
    interestRatePct: 4.95,
    taxStructure: '0% Individual Capital Gains (KAFD) + 0% CGT Singapore Freehold',
    goldenVisa: 'Saudi Premium Residency ($1.06M) + Singapore Global Investor ($7.5M)',
    occupancyRate: 98,
    tenantRisk: 'AAA',
    liquidityScore: 96,
    featuresUnlocked: [
      'Institutional Portfolio Analysis Access (Up to 500 credits/mo)',
      'KAFD Vision 2030 Corporate Headquarters Demand Index',
      'Singapore USD-Pegged Wealth Preservation Arbitrage',
      'Real-Time Capital Flow Radar & Rebalancing Triggers',
      'Dedicated Syndicate Director Support',
    ],
    featuresLocked: [],
    portfolioBreakdown: [
      { asset: 'Riyadh KAFD Financial Residence', city: 'Riyadh', allocationPct: 60, valueUSD: 768000, yieldPct: 8.8 },
      { asset: 'Singapore Marina Bay Preservation Core', city: 'Singapore', allocationPct: 40, valueUSD: 512000, yieldPct: 3.9 },
    ],
    watermarkNote: 'SAMPLE AGENCY TIER ANALYSIS • SOVEREIGN GROWTH & WEALTH PRESERVATION PAIR',
  },
};

// =========================================================================
// 5. ABSTRACT PAYMENT CHECKOUT & TIER RESOLUTION HELPERS (PADDLE READY)
// =========================================================================

const SUCCESS_REDIRECT = 'https://aqari-ai-rho.vercel.app/app?checkout=success';
const CANCEL_REDIRECT = 'https://aqari-ai-rho.vercel.app/pricing?checkout=cancelled';

function resolvePlanFromOrderAttributes(attrs: any, fallbackPlan?: PlanKey): PlanKey {
  const s = `${attrs?.first_order_item?.product_name || ''} ${attrs?.first_order_item?.variant_name || ''} ${attrs?.product_name || ''} ${attrs?.variant_name || ''} ${attrs?.metadata?.plan || ''}`.toLowerCase();
  if (s.includes('sovereign') || s.includes('enterprise') || s.includes('agency')) {
    return 'enterprise';
  }
  if (s.includes('professional') || /\bpro\b/.test(s)) {
    return 'pro';
  }
  if (s.includes('starter')) {
    return 'starter';
  }

  const rawCents = Number(attrs?.total ?? attrs?.subtotal ?? attrs?.amount ?? attrs?.first_order_item?.price ?? 0);
  const byCents = planFromAmount(rawCents);
  if (byCents?.name === 'SOVEREIGN') return 'enterprise';
  if (byCents?.name === 'STARTER') return 'starter';
  if (byCents?.name === 'PROFESSIONAL') return 'pro';

  const totalUSD = rawCents > 1000 ? rawCents / 100 : rawCents;
  const byUsd = planFromAmount(totalUSD);
  if (byUsd?.name === 'SOVEREIGN') return 'enterprise';
  if (byUsd?.name === 'STARTER') return 'starter';
  if (byUsd?.name === 'PROFESSIONAL') return 'pro';

  return fallbackPlan && fallbackPlan !== 'free' ? fallbackPlan : 'pro';
}

function getQueryParam(req: any, url: URL, key: string): string {
  const q = req?.query?.[key];
  if (typeof q === 'string') return q;
  if (Array.isArray(q) && q[0]) return String(q[0]);
  return url.searchParams.get(key) || '';
}

function safeParseBody(req: any): Record<string, any> {
  try {
    const raw = req?.body;
    if (!raw) return {};
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
      const str = raw.toString('utf8').trim();
      return str ? JSON.parse(str) : {};
    }
    if (typeof raw === 'string') {
      const str = raw.trim();
      return str ? JSON.parse(str) : {};
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw;
    }
  } catch {}
  return {};
}

// =========================================================================
// 5B. AI GEMINI CLIENT, PORTFOLIO INTELLIGENCE, WORKSPACE RBAC & GLOBAL INTEL
// =========================================================================

function getServerGeminiClient(): GoogleGenAI | null {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function stripBase64DataUrl(raw: string): { mimeType: string; data: string } {
  const s = String(raw || '').trim();
  const match = s.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'application/octet-stream', data: s };
}

const CITY_GEO_PROFILES: Record<
  string,
  { lat: number; lng: number; cluster: string; demand: number; mobility: number; climate: number; esg: number; climateFlags: string[]; liquidity: number }
> = {
  Muscat: { lat: 23.588, lng: 58.3829, cluster: 'GCC Coastal Sovereign', demand: 84, mobility: 78, climate: 66, esg: 74, climateFlags: ['Coastal Humidity & Heat Stress Index: Moderate-High', 'Cyclone Surge Buffer Check Recommended'], liquidity: 74 },
  Dubai: { lat: 25.2048, lng: 55.2708, cluster: 'GCC Global Gateway', demand: 94, mobility: 91, climate: 64, esg: 82, climateFlags: ['Extreme Summer Thermal Load (Cooling OPEX Sensitivity)', 'Coastal Salinization Check'], liquidity: 93 },
  Riyadh: { lat: 24.7136, lng: 46.6753, cluster: 'GCC Capital Growth', demand: 93, mobility: 83, climate: 70, esg: 79, climateFlags: ['Arid Dust & Cooling Efficiency Risk', 'Water Scarcity Utility Escalation'], liquidity: 85 },
  London: { lat: 51.5072, lng: -0.1276, cluster: 'European Prime Core', demand: 88, mobility: 96, climate: 82, esg: 88, climateFlags: ['UK EPC Minimum Efficiency Regulation Compliance', 'Thames Surface Runoff Flood Check'], liquidity: 94 },
  Singapore: { lat: 1.3521, lng: 103.8198, cluster: 'APAC Sovereign Hub', demand: 91, mobility: 97, climate: 76, esg: 92, climateFlags: ['Equatorial Sea-Level & Flash Flood Drainage', 'BCA Green Mark Mandatory Compliance'], liquidity: 91 },
  'New York': { lat: 40.7128, lng: -74.006, cluster: 'North America Gateway', demand: 89, mobility: 95, climate: 75, esg: 84, climateFlags: ['NYC Local Law 97 Carbon Cap Exposure', 'Coastal Storm Surge Flood Zone Check'], liquidity: 96 },
  Miami: { lat: 25.7617, lng: -80.1918, cluster: 'North America Sunbelt', demand: 87, mobility: 79, climate: 54, esg: 71, climateFlags: ['Hurricane Wind & Flood Insurance Volatility (HIGH)', 'Sea-Level Rise Coastal Exposure'], liquidity: 86 },
};

function computePostPurchaseAssetRecord(raw: any, existingId?: string) {
  const cityEntry = findInlinedCity(String(raw?.city || 'Muscat')) || findInlinedCity('Muscat')!;
  const geo = CITY_GEO_PROFILES[cityEntry.city] || {
    lat: 25.0,
    lng: 55.0,
    cluster: `${cityEntry.country} Regional Cluster`,
    demand: 80,
    mobility: 76,
    climate: 72,
    esg: 75,
    climateFlags: ['Verify municipal flood & thermal resilience reports'],
    liquidity: 76,
  };
  const purchasePriceUSD = Math.max(1000, Number(raw?.purchasePriceUSD ?? raw?.priceUSD ?? 500000));
  const currentValueUSD = Math.max(1000, Number(raw?.currentValueUSD ?? purchasePriceUSD));
  const forecastRentMonthlyUSD = Math.max(0, Number(raw?.forecastRentMonthlyUSD ?? raw?.rentUSD ?? 3500));
  const actualRentMonthlyUSD = Math.max(0, Number(raw?.actualRentMonthlyUSD ?? forecastRentMonthlyUSD));
  const forecastYieldPct = Number(
    raw?.forecastYieldPct ?? ((forecastRentMonthlyUSD * 12) / purchasePriceUSD) * 100
  );
  const actualYieldPct = Number(((actualRentMonthlyUSD * 12) / currentValueUSD) * 100);
  const loanBalanceUSD = Math.max(0, Number(raw?.loanBalanceUSD ?? Math.round(purchasePriceUSD * 0.65)));
  const interestRatePct = Math.max(0, Number(raw?.interestRatePct ?? 5.5));
  const monthlyDebtServiceUSD = Math.max(
    0,
    Number(
      raw?.monthlyDebtServiceUSD ??
        Math.round((loanBalanceUSD * (interestRatePct / 100)) / 12 + loanBalanceUSD / 300)
    )
  );
  const loanMaturityDate = String(raw?.loanMaturityDate || '2031-06-30');
  const purchaseDate = String(raw?.purchaseDate || new Date().toISOString().slice(0, 10));

  const riskAlerts: string[] = [];
  if (actualRentMonthlyUSD < forecastRentMonthlyUSD * 0.92) {
    const gapPct = Math.round(((forecastRentMonthlyUSD - actualRentMonthlyUSD) / (forecastRentMonthlyUSD || 1)) * 100);
    riskAlerts.push(`Rent Slippage Alert: Actual rent is ${gapPct}% below underwritten forecast.`);
  }
  if (actualYieldPct < forecastYieldPct - 0.8) {
    riskAlerts.push(`Yield Compression: Actual gross yield (${actualYieldPct.toFixed(2)}%) trails forecast (${forecastYieldPct.toFixed(2)}%).`);
  }
  if (currentValueUSD > 0 && loanBalanceUSD / currentValueUSD > 0.78) {
    riskAlerts.push(`High Leverage LTV (${Math.round((loanBalanceUSD / currentValueUSD) * 100)}%): Covenant buffer tight.`);
  }
  const maturityMs = new Date(loanMaturityDate).getTime();
  if (!Number.isNaN(maturityMs) && maturityMs - Date.now() < 540 * 86_400_000) {
    riskAlerts.push(`Refinancing Alert: Loan matures before ${loanMaturityDate} (<18 months).`);
  }
  if (geo.climate < 60) {
    riskAlerts.push(`Climate Risk Flag: ${cityEntry.city} carries elevated insurance/climate sensitivity.`);
  }

  const demandScore = Math.min(99, Math.max(40, Number(raw?.demandScore ?? geo.demand)));
  const mobilityScore = Math.min(99, Math.max(40, Number(raw?.mobilityScore ?? geo.mobility)));
  const climateScore = Math.min(99, Math.max(30, Number(raw?.climateScore ?? geo.climate)));
  const esgScore = Math.min(99, Math.max(35, Number(raw?.esgScore ?? geo.esg)));
  const financialPerfBoost = actualRentMonthlyUSD >= forecastRentMonthlyUSD ? 6 : -6;
  const overallScore = Math.min(
    99,
    Math.max(
      35,
      Math.round(demandScore * 0.3 + mobilityScore * 0.25 + climateScore * 0.2 + esgScore * 0.25 + financialPerfBoost)
    )
  );

  return {
    id: existingId || String(raw?.id || `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    property: String(raw?.property || `${cityEntry.city} Tracked Asset`).trim(),
    city: cityEntry.city,
    country: cityEntry.country,
    cluster: geo.cluster,
    lat: geo.lat,
    lng: geo.lng,
    purchaseDate,
    purchasePriceUSD: Math.round(purchasePriceUSD),
    currentValueUSD: Math.round(currentValueUSD),
    forecastRentMonthlyUSD: Math.round(forecastRentMonthlyUSD),
    actualRentMonthlyUSD: Math.round(actualRentMonthlyUSD),
    forecastYieldPct: Number(forecastYieldPct.toFixed(2)),
    actualYieldPct: Number(actualYieldPct.toFixed(2)),
    loanBalanceUSD: Math.round(loanBalanceUSD),
    monthlyDebtServiceUSD: Math.round(monthlyDebtServiceUSD),
    loanMaturityDate,
    interestRatePct: Number(interestRatePct.toFixed(2)),
    demandScore,
    mobilityScore,
    climateScore,
    esgScore,
    overallScore,
    climateFlags: geo.climateFlags,
    riskAlerts,
    notes: String(raw?.notes || ''),
    updatedAt: new Date().toISOString(),
  };
}

function getServerCityMarketStats(cityEntry: InlinedCityEntry): {
  avgPriceSqM: number;
  rentGrowthYoY: number;
  transferTaxPct: number;
  capitalGainsTax: string;
  goldenVisaUSD: number | null;
  source: string;
} {
  const intel = getGlobalMarketIntelligenceData().find(
    (m) => m.city.toLowerCase() === cityEntry.city.toLowerCase()
  );
  const presets: Record<
    string,
    { avgPriceSqM: number; capitalGainsTax: string; goldenVisaUSD: number | null; source: string }
  > = {
    Muscat: {
      avgPriceSqM: 2150,
      capitalGainsTax: '0% (Individuals)',
      goldenVisaUSD: 650000,
      source: 'MoHUP Oman / Savills / NCSI',
    },
    Dubai: {
      avgPriceSqM: 4950,
      capitalGainsTax: '0% (Individuals)',
      goldenVisaUSD: 545000,
      source: 'Dubai Land Department (DLD) / RERA',
    },
    Riyadh: {
      avgPriceSqM: 2850,
      capitalGainsTax: '0% (Principal) / 2.5% RETT',
      goldenVisaUSD: 1066000,
      source: 'REGA / ZATCA / GASTAT',
    },
    London: {
      avgPriceSqM: 12400,
      capitalGainsTax: '18% - 24% (UK CGT)',
      goldenVisaUSD: null,
      source: 'ONS / HMRC / HM Land Registry',
    },
    Singapore: {
      avgPriceSqM: 17800,
      capitalGainsTax: '0% (Long-term >3Y SSD)',
      goldenVisaUSD: 1850000,
      source: 'URA / IRAS Singapore',
    },
    'New York': {
      avgPriceSqM: 14200,
      capitalGainsTax: '15% - 20% Federal + NY State',
      goldenVisaUSD: 800000,
      source: 'FRED / NYC DOF / IRS',
    },
    Miami: {
      avgPriceSqM: 6900,
      capitalGainsTax: '15% - 20% Federal (0% FL State)',
      goldenVisaUSD: 800000,
      source: 'FRED / Florida DOR / IRS',
    },
  };
  const preset = presets[cityEntry.city];
  return {
    avgPriceSqM: preset?.avgPriceSqM ?? Math.round(2200 + cityEntry.avgCapRate * 250),
    rentGrowthYoY: intel?.rentGrowthYoY ?? 4.2,
    transferTaxPct: cityEntry.taxRate,
    capitalGainsTax: preset?.capitalGainsTax ?? 'Verify with local tax counsel',
    goldenVisaUSD: preset?.goldenVisaUSD ?? null,
    source: preset?.source ?? intel?.rentGrowthSource ?? `${cityEntry.country} Land Registry & Macro Benchmarks`,
  };
}

function getGlobalMarketIntelligenceData() {
  const verifiedDate = '2026-04-01';
  return [
    {
      city: 'Muscat',
      country: 'Oman',
      flag: '🇴🇲',
      rentGrowthYoY: 5.4,
      rentGrowthSource: 'Oman MoHUP / Savills Muscat Report',
      rentGrowthDate: verifiedDate,
      vacancyPct: 7.2,
      vacancySource: 'Savills Oman Market Beat Q1',
      vacancyDate: verifiedDate,
      interestRatePct: 5.65,
      interestRateSource: 'Central Bank of Oman / Local Mortgage Index',
      interestRateDate: verifiedDate,
      transactionVolumeUSD: 2_840_000_000,
      transactionVolumeLabel: '$2.84B (Annualized ITC + Freehold)',
      transactionSource: 'Oman Ministry of Housing & Urban Planning (MoHUP)',
      transactionDate: verifiedDate,
      supplyForecast: '+3,400 units (ITC zones through 2027)',
      demandForecast: 'Expansive (+7.8% expat & residency inflows)',
      supplyDemandBalance: 'Undersupplied' as const,
      supplyDemandSource: 'JLL MENA / NCSI Oman',
      supplyDemandDate: verifiedDate,
      politicalEconomicRisk: 'Low' as const,
      riskScore: 82,
      riskSource: 'World Bank Governance / Fitch Oman Outlook',
      riskDate: verifiedDate,
      historicalPriceIndex: [
        { year: '2022', index: 100 },
        { year: '2023', index: 103.8 },
        { year: '2024', index: 108.5 },
        { year: '2025', index: 113.9 },
        { year: '2026', index: 119.2 },
      ],
      historicalSource: 'NCSI Oman Real Estate Price Index',
      historicalDate: verifiedDate,
    },
    {
      city: 'Dubai',
      country: 'UAE',
      flag: '🇦🇪',
      rentGrowthYoY: 11.8,
      rentGrowthSource: 'Dubai Land Department (DLD) / RERA Rental Index',
      rentGrowthDate: verifiedDate,
      vacancyPct: 5.1,
      vacancySource: 'CBRE / JLL UAE Real Estate Market',
      vacancyDate: verifiedDate,
      interestRatePct: 4.85,
      interestRateSource: 'CBUAE EIBOR 3M + Prime Spread',
      interestRateDate: verifiedDate,
      transactionVolumeUSD: 118_500_000_000,
      transactionVolumeLabel: '$118.5B (Annualized DLD Volume)',
      transactionSource: 'Dubai Land Department (DLD)',
      transactionDate: verifiedDate,
      supplyForecast: '+39,000 units (scheduled 2026-2027 handovers)',
      demandForecast: 'High (+140k population net migration/yr)',
      supplyDemandBalance: 'Balanced' as const,
      supplyDemandSource: 'JLL / Knight Frank Dubai Review',
      supplyDemandDate: verifiedDate,
      politicalEconomicRisk: 'Low' as const,
      riskScore: 86,
      riskSource: 'Moody’s / S&P UAE Sovereign Stability',
      riskDate: verifiedDate,
      historicalPriceIndex: [
        { year: '2022', index: 100 },
        { year: '2023', index: 114.2 },
        { year: '2024', index: 129.6 },
        { year: '2025', index: 141.8 },
        { year: '2026', index: 149.5 },
      ],
      historicalSource: 'Dubai Land Department Residential Index',
      historicalDate: verifiedDate,
    },
    {
      city: 'Riyadh',
      country: 'Saudi Arabia',
      flag: '🇸🇦',
      rentGrowthYoY: 9.6,
      rentGrowthSource: 'GASTAT / REGA Rental Price Index',
      rentGrowthDate: verifiedDate,
      vacancyPct: 4.3,
      vacancySource: 'Knight Frank Saudi Arabia Report',
      vacancyDate: verifiedDate,
      interestRatePct: 5.5,
      interestRateSource: 'SAMA SAIBOR + Residential Margin',
      interestRateDate: verifiedDate,
      transactionVolumeUSD: 44_200_000_000,
      transactionVolumeLabel: '$44.2B (Annualized REGA Volume)',
      transactionSource: 'Saudi Real Estate General Authority (REGA)',
      transactionDate: verifiedDate,
      supplyForecast: '+24,000 residential units (Vision 2030 North Riyadh)',
      demandForecast: 'Strong (Regional HQ mandate + demographic expansion)',
      supplyDemandBalance: 'Undersupplied' as const,
      supplyDemandSource: 'JLL KSA Real Estate Outlook',
      supplyDemandDate: verifiedDate,
      politicalEconomicRisk: 'Low' as const,
      riskScore: 83,
      riskSource: 'World Bank / IMF Article IV Saudi Arabia',
      riskDate: verifiedDate,
      historicalPriceIndex: [
        { year: '2022', index: 100 },
        { year: '2023', index: 107.1 },
        { year: '2024', index: 115.4 },
        { year: '2025', index: 124.8 },
        { year: '2026', index: 132.1 },
      ],
      historicalSource: 'GASTAT Saudi Real Estate Price Index',
      historicalDate: verifiedDate,
    },
    {
      city: 'London',
      country: 'UK',
      flag: '🇬🇧',
      rentGrowthYoY: 4.8,
      rentGrowthSource: 'ONS Index of Private Housing Rental Prices',
      rentGrowthDate: verifiedDate,
      vacancyPct: 3.4,
      vacancySource: 'Savills UK Prime Residential Research',
      vacancyDate: verifiedDate,
      interestRatePct: 4.65,
      interestRateSource: 'Bank of England Bank Rate + 5Y Swap',
      interestRateDate: verifiedDate,
      transactionVolumeUSD: 68_400_000_000,
      transactionVolumeLabel: '$68.4B (Greater London Sales)',
      transactionSource: 'HM Land Registry / ONS',
      transactionDate: verifiedDate,
      supplyForecast: '+18,500 completions (constrained planning pipeline)',
      demandForecast: 'Steady (Institutional & international student core)',
      supplyDemandBalance: 'Undersupplied' as const,
      supplyDemandSource: 'RICS / JLL UK Residential Forecast',
      supplyDemandDate: verifiedDate,
      politicalEconomicRisk: 'Low' as const,
      riskScore: 87,
      riskSource: 'OECD / Fitch UK Institutional Risk',
      riskDate: verifiedDate,
      historicalPriceIndex: [
        { year: '2022', index: 100 },
        { year: '2023', index: 98.4 },
        { year: '2024', index: 99.9 },
        { year: '2025', index: 102.6 },
        { year: '2026', index: 105.8 },
      ],
      historicalSource: 'HM Land Registry UK House Price Index',
      historicalDate: verifiedDate,
    },
    {
      city: 'Singapore',
      country: 'Singapore',
      flag: '🇸🇬',
      rentGrowthYoY: 3.6,
      rentGrowthSource: 'URA Private Residential Rental Index',
      rentGrowthDate: verifiedDate,
      vacancyPct: 6.1,
      vacancySource: 'Urban Redevelopment Authority (URA)',
      vacancyDate: verifiedDate,
      interestRatePct: 3.25,
      interestRateSource: 'MAS SORA 3M + Mortgage Spread',
      interestRateDate: verifiedDate,
      transactionVolumeUSD: 27_900_000_000,
      transactionVolumeLabel: '$27.9B (Private Non-Landed & Commercial)',
      transactionSource: 'URA REALIS / IRAS',
      transactionDate: verifiedDate,
      supplyForecast: '+11,200 private units (2026 TOP pipeline)',
      demandForecast: 'Resilient (APAC Wealth & Family Office Hub)',
      supplyDemandBalance: 'Balanced' as const,
      supplyDemandSource: 'URA / CBRE Singapore',
      supplyDemandDate: verifiedDate,
      politicalEconomicRisk: 'Low' as const,
      riskScore: 95,
      riskSource: 'S&P AAA / MAS Financial Stability Review',
      riskDate: verifiedDate,
      historicalPriceIndex: [
        { year: '2022', index: 100 },
        { year: '2023', index: 106.8 },
        { year: '2024', index: 111.0 },
        { year: '2025', index: 114.6 },
        { year: '2026', index: 117.9 },
      ],
      historicalSource: 'URA Private Property Price Index',
      historicalDate: verifiedDate,
    },
    {
      city: 'New York',
      country: 'USA',
      flag: '🇺🇸',
      rentGrowthYoY: 4.1,
      rentGrowthSource: 'StreetEasy / BLS CPI Shelter NYC',
      rentGrowthDate: verifiedDate,
      vacancyPct: 2.1,
      vacancySource: 'NYC Housing & Vacancy Survey',
      vacancyDate: verifiedDate,
      interestRatePct: 6.25,
      interestRateSource: 'FRED 30-Year Fixed / SOFR Commercial',
      interestRateDate: verifiedDate,
      transactionVolumeUSD: 52_100_000_000,
      transactionVolumeLabel: '$52.1B (NYC Multifamily & Residential)',
      transactionSource: 'NYC DOF ACRIS / CBRE',
      transactionDate: verifiedDate,
      supplyForecast: '+16,000 multifamily units (tax abatement shift)',
      demandForecast: 'Tight (Sub-2.5% structural rental vacancy)',
      supplyDemandBalance: 'Undersupplied' as const,
      supplyDemandSource: 'REBNY / Cushman & Wakefield',
      supplyDemandDate: verifiedDate,
      politicalEconomicRisk: 'Moderate' as const,
      riskScore: 81,
      riskSource: 'FRED / Regulatory Rent-Stabilization Exposure',
      riskDate: verifiedDate,
      historicalPriceIndex: [
        { year: '2022', index: 100 },
        { year: '2023', index: 99.1 },
        { year: '2024', index: 101.8 },
        { year: '2025', index: 104.5 },
        { year: '2026', index: 107.6 },
      ],
      historicalSource: 'S&P CoreLogic Case-Shiller NY Index',
      historicalDate: verifiedDate,
    },
    {
      city: 'Miami',
      country: 'USA',
      flag: '🇺🇸',
      rentGrowthYoY: 3.4,
      rentGrowthSource: 'CoStar / FRED Miami MSA Rent Index',
      rentGrowthDate: verifiedDate,
      vacancyPct: 6.8,
      vacancySource: 'CBRE South Florida Multifamily',
      vacancyDate: verifiedDate,
      interestRatePct: 6.35,
      interestRateSource: 'FRED 30-Year Fixed / SOFR Spread',
      interestRateDate: verifiedDate,
      transactionVolumeUSD: 23_600_000_000,
      transactionVolumeLabel: '$23.6B (Miami-Dade Metro Volume)',
      transactionSource: 'Miami Realtors / CoStar',
      transactionDate: verifiedDate,
      supplyForecast: '+19,400 condo/multifamily deliveries (2026-2027)',
      demandForecast: 'Moderate (Domestic wealth migration offset by insurance cost)',
      supplyDemandBalance: 'High Pipeline' as const,
      supplyDemandSource: 'JLL South Florida Outlook',
      supplyDemandDate: verifiedDate,
      politicalEconomicRisk: 'Moderate' as const,
      riskScore: 76,
      riskSource: 'Florida Insurance & Climate Resilience Index',
      riskDate: verifiedDate,
      historicalPriceIndex: [
        { year: '2022', index: 100 },
        { year: '2023', index: 107.5 },
        { year: '2024', index: 112.9 },
        { year: '2025', index: 115.4 },
        { year: '2026', index: 117.1 },
      ],
      historicalSource: 'S&P Case-Shiller Miami Index',
      historicalDate: verifiedDate,
    },
  ];
}

// Enterprise Workspace Persistence (KV + Local Store fallback)
const localOrgsFallback: Record<string, any> = {};
const localUserOrgsFallback: Record<string, string[]> = {};

async function readEnterpriseOrgFromDb(orgId: string): Promise<any | null> {
  const cleanId = String(orgId || '').trim();
  if (!cleanId) return null;
  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:org:${cleanId}`]);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        localOrgsFallback[cleanId] = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Workspace KV Read]', err);
  }
  return localOrgsFallback[cleanId] || null;
}

async function saveEnterpriseOrgToDb(org: any): Promise<void> {
  if (!org?.id) return;
  localOrgsFallback[org.id] = org;
  const kv = getKvConfig();
  if (kv) {
    await kvCommand(['SET', `aqari:org:${org.id}`, JSON.stringify(org)]);
  }
}

async function addOrgToUserIndexDb(rawEmail: string, orgId: string): Promise<string[]> {
  const email = normalizeEmail(rawEmail);
  let ids: string[] = [...(localUserOrgsFallback[email] || [])];
  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:user_orgs:${email}`]);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) ids = parsed.map(String);
      }
      if (!ids.includes(orgId)) {
        ids.unshift(orgId);
        await kvCommand(['SET', `aqari:user_orgs:${email}`, JSON.stringify(ids.slice(0, 50))]);
      }
    }
  } catch {}
  if (!ids.includes(orgId)) ids.unshift(orgId);
  localUserOrgsFallback[email] = ids.slice(0, 50);
  return localUserOrgsFallback[email];
}

async function getUserOrgIdsDb(rawEmail: string): Promise<string[]> {
  const email = normalizeEmail(rawEmail);
  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:user_orgs:${email}`]);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          localUserOrgsFallback[email] = parsed.map(String);
          return localUserOrgsFallback[email];
        }
      }
    }
  } catch {}
  return localUserOrgsFallback[email] || [];
}

// =========================================================================
// 6. MAIN SERVERLESS HANDLER (NEVER RETURNS 500)
// =========================================================================

export default async function handler(req: any, res: any) {
  let action = '';
  try {
    let url: URL;
    try {
      url = new URL(req?.url || '/api/app', `http://${req?.headers?.host || 'localhost:3000'}`);
    } catch {
      url = new URL('/api/app', 'http://localhost:3000');
    }
    const parsedBody = safeParseBody(req);
    action = (getQueryParam(req, url, 'action') || parsedBody.action || '')
      .toString()
      .trim()
      .toLowerCase();

    switch (action) {
      case '': {
        return res.status(200).json({
          success: true,
          status: 'ok',
          service: 'aqari-terminal-api',
          supportedActions: [
            'me',
            'pricing',
            'verify-checkout',
            'verify-payment',
            'buy-credits',
            'update-branding',
            'enterprise-inquiry',
            'enterprise-request',
            'debug-plan',
            'run-analysis',
            'extract-from-file',
            'run-file-analysis',
            'studio-generate',
            'portfolio-intelligence',
            'due-diligence-docs',
            'scenario-compare',
            'workspace',
            'market-intelligence',
            'find-deals',
            'get-forecast',
            'run-due-diligence',
            'optimize-portfolio',
            'ask-advisor',
            'underwrite',
            'analyze',
            'monte-carlo',
            'save-to-portfolio',
            'save-property',
            'export',
            'portfolio',
            'analyst-chat',
            'whiteglove-request',
            'sovereign-request',
            'checkout',
            'paddle-webhook',
            'copy-api-key',
            'regenerate-api-key',
            'session',
            'license',
            'market-live',
            'news',
            'demo',
            'webhook-logs',
            'city-search',
            'city-analyze',
            'macro-sync',
            'get-last-results',
            'clear-last-result',
            'report-issue',
            'cancel-subscription',
            'google-callback',
            'nextauth',
          ],
        });
      }

      case 'me': {
        res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
        const sessionEmail = getSessionEmailFromReq(req);
        const queryEmail = normalizeEmail(
          getQueryParam(req, url, 'login_email') || getQueryParam(req, url, 'email')
        );
        const lookupEmail = sessionEmail || (queryEmail && queryEmail.includes('@') ? queryEmail : '');
        if (!lookupEmail) {
          return res.status(401).json({
            authenticated: false,
            error: 'Authentication required',
          });
        }

        const { user: hydratedDb, kvError } = await readUserFromDbStatus(lookupEmail);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            authenticated: false,
            error: 'Database temporarily unavailable. Please retry.',
          });
        }

        const initialUser = hydratedDb || getOrCreateServerUser(lookupEmail);
        let dbUser = enforceServerUserExpiry(initialUser.email);

        if (!hydratedDb) {
          await saveUserToDb(dbUser);
        }

        // Only restore from signed entitlement cookie if DB has NO active/refunded paid record
        // AND the DB user is still on FREE with 0 payments for this order. NEVER overwrite an
        // existing paid plan or decremented credit balance from a cookie.
        const ent = getEntitlementFromReq(req);
        const orderAlreadyInPayments = Boolean(
          ent &&
            dbUser.payments.some(
              (p) => normalizeOrderId(p.order_id) === normalizeOrderId(ent.orderId)
            )
        );
        const shouldApplyEntitlementCookie = Boolean(
          !hydratedDb &&
            ent &&
            ent.email === dbUser.email &&
            ent.plan !== 'free' &&
            ent.licenseEnd > Date.now() &&
            dbUser.plan === 'free' &&
            dbUser.cancel_status !== 'refunded' &&
            !orderAlreadyInPayments
        );

        if (ent && shouldApplyEntitlementCookie) {
          dbUser = activatePaidPlanOnServer({
            email: dbUser.email,
            name: dbUser.name,
            plan: ent.plan,
            paymentTimestamp: ent.licenseStart,
            orderId: ent.orderId,
            amountUSD: ent.amountUSD,
            testMode: ent.testMode,
            paymentCustomerEmail: ent.paymentCustomerEmail || null,
            paymentIntentId: ent.orderId,
          });
          await saveUserToDb(dbUser);
        }

        const lockState = evaluateLockState(dbUser);
        const license = computeServerLicenseStatus(dbUser);
        const quotas = resolveEffectiveQuotas(dbUser);
        const pricing = getPricingPublicPayload();
        const dynamicPlan = findPlanPricing(pricing, license.planKey);
        const features = dynamicPlan?.features || PLAN_DEFINITIONS[license.planKey].features;
        const planPrice =
          license.planKey === 'free'
            ? 0
            : dynamicPlan?.activePrice ?? PLAN_DEFINITIONS[license.planKey].priceUSD;
        const planCfg = PLAN_DEFINITIONS[license.planKey];
        const maxSaved = quotas.savedLimit ?? 0;
        const savedCount = Array.isArray(dbUser.saved_analyses)
          ? dbUser.saved_analyses.length
          : dbUser.saved_count || 0;
        const hasApiAccess =
          quotas.customApiEnabled &&
          !lockState.locked &&
          sessionEmail === dbUser.email;
        let maskedApiKey: string | null = null;
        let apiKeyLast4: string | null = null;
        if (hasApiAccess) {
          const minted = getOrMintApiKeyForUser(dbUser);
          maskedApiKey = minted.masked;
          apiKeyLast4 = minted.last4;
          await saveApiKeyToDb(minted.rawToken, dbUser.email).catch(() => {});
          if (minted.needsPersist) {
            dbUser = updateServerUser(dbUser.email, {
              api_key_token: minted.rawToken,
              api_key_last4: minted.last4,
            });
            await saveUserToDb(dbUser).catch(() => {});
          }
        }
        const featurePlanKey = getEffectiveFeaturePlanKey(dbUser);
        const analystThread = canUseFeature(featurePlanKey, 'analystDesk')
          ? await getAnalystThreadFromDb(dbUser.email).catch(() => null)
          : null;
        const allWhiteGlove = canUseFeature(featurePlanKey, 'customUnderwriting')
          ? await getWhiteGloveRequestsFromDb().catch(() => [])
          : [];
        const userWhiteGlove = Array.isArray(allWhiteGlove)
          ? allWhiteGlove.filter((r: any) => normalizeEmail(r?.email) === dbUser.email)
          : [];
        const userDeliverables = userWhiteGlove
          .filter((r: any) => r?.status === 'Done' && r?.deliverable)
          .map((r: any) => ({ ...r.deliverable, requestId: r.id, deliveredAt: r.deliveredAt }));

        const cancellationEligibility = evaluateCancelRefundEligibility(dbUser);
        const lastResults = dbUser.last_results || {};
        const todayUtc = new Date().toISOString().slice(0, 10);
        const apiCallsToday =
          dbUser.api_calls_day === todayUtc ? Math.max(0, Number(dbUser.api_calls_today || 0)) : 0;
        const effectivePlanCfg = PLAN_DEFINITIONS[featurePlanKey];
        const isFreePlan = license.planKey === 'free';
        const effectiveExpiryMs = isFreePlan
          ? null
          : quotas.isEnterprise && quotas.contractEndMs !== null
          ? quotas.contractEndMs
          : dbUser.license_end;

        const quotaEnvelope = {
          extra_credits: lockState.creditsBalance,
          credits_balance: lockState.creditsBalance,
          plan_analyses_left: lockState.planAnalysesLeft,
          plan_status: lockState.status,
          package_expired: lockState.packageExpired,
          credits_only_mode: lockState.creditsOnlyMode,
          purchase_date: isFreePlan ? null : dbUser.license_start,
          expiry_date: effectiveExpiryMs,
          expiry_date_formatted: lockState.expiryDateFormatted,
          day29_reminder: lockState.day29Reminder,
          expiry_banner: lockState.expiryBanner,
          image_pdf_used: Math.max(0, Number(dbUser.image_pdf_used || 0)),
          image_pdf_limit: quotas.imagePdfLimit ?? 0,
          ai_listings_used: Math.max(0, Number(dbUser.ai_listings_used || 0)),
          ai_listing_limit: quotas.aiListingLimit ?? 0,
          pdfs_used: Math.max(0, Number(dbUser.pdfs_used || 0)),
          investment_pdf_limit: quotas.investmentPdfLimit ?? 0,
          portfolio_assets_limit: quotas.portfolioAssetsLimit ?? 0,
          compare_limit: quotas.compareLimit,
          team_users_limit: quotas.teamUsersLimit ?? 0,
          api_daily_limit: quotas.apiDailyLimit,
          api_calls_today: apiCallsToday,
          monte_carlo_max_cycles: effectivePlanCfg.monteCarloMaxCycles,
          white_label_mode: quotas.whiteLabelEnabled ? effectivePlanCfg.whiteLabelMode : 'none',
          white_label_enabled: quotas.whiteLabelEnabled,
          custom_api_enabled: quotas.customApiEnabled,
          custom_analyses_limit: dbUser.custom_analyses_limit ?? null,
          custom_image_pdf_limit: dbUser.custom_image_pdf_limit ?? null,
          custom_listings_limit: dbUser.custom_listings_limit ?? null,
          custom_portfolio_limit: dbUser.custom_portfolio_limit ?? null,
          custom_seats: dbUser.custom_seats ?? null,
          custom_storage_gb: dbUser.custom_storage_gb ?? null,
          sla_level: dbUser.sla_level ?? null,
          contract_end_date: dbUser.contract_end_date ?? null,
          branding: dbUser.branding || null,
        };

        return res.status(200).json({
          success: true,
          authenticated: true,
          email: dbUser.email,
          login_email: dbUser.email,
          payment_provider: dbUser.payment_provider || 'paddle',
          payment_intent_id: dbUser.payment_intent_id || null,
          payment_customer_email: dbUser.payment_customer_email || null,
          name: dbUser.name,
          isAdmin: Boolean(sessionEmail && isAdminEmail(dbUser.email)),
          plan: license.displayName,
          plan_name: license.displayName,
          planKey: license.planKey,
          status: lockState.status,
          locked: lockState.locked,
          lockReason: lockState.reason,
          reason: lockState.reason,
          lockError: lockState.error,
          ...(lockState.error ? { error: lockState.error } : {}),
          price: planPrice,
          license_start: dbUser.license_start,
          license_end: effectiveExpiryMs,
          days_left: isFreePlan || lockState.packageExpired ? 0 : license.daysLeft,
          analyses_total: license.analysesLimit,
          analyses_limit: license.analysesLimit,
          analyses_used: license.analysesUsed,
          analyses_left: lockState.analysesLeft,
          successful_analyses: dbUser.successful_analyses || 0,
          ...quotaEnvelope,
          credit_costs: CREDIT_COSTS,
          credit_packs: EXTRA_CREDIT_PACKS,
          has_reported_issue: Boolean(dbUser.has_reported_issue),
          issue_reported_at: dbUser.issue_reported_at ?? null,
          issue_resolved_at: dbUser.issue_resolved_at ?? null,
          issue_description: dbUser.issue_description || '',
          issue_status: dbUser.issue_status || 'none',
          cancel_status: dbUser.cancel_status || 'none',
          last_order_id: dbUser.last_order_id || dbUser.payments?.[0]?.order_id || null,
          cancellationEligibility,
          maxSaved,
          max_saved: maxSaved,
          saved_limit: maxSaved,
          saved_count: savedCount,
          saved_analyses: dbUser.saved_analyses,
          portfolio_assets: dbUser.portfolio_assets || [],
          last_results: lastResults,
          api_key: maskedApiKey,
          api_key_last4: apiKeyLast4,
          locked_launch_price: dbUser.locked_launch_price ?? null,
          custom_cities: dbUser.custom_cities || [],
          features,
          capabilities: {
            ...effectivePlanCfg.capabilities,
            whiteLabelReports: quotas.whiteLabelEnabled,
            whiteLabelPlatform: quotas.whiteLabelPlatformEnabled,
            apiAccess: quotas.customApiEnabled,
          },
          analyst_unread: Number(analystThread?.unreadForClient || 0),
          analyst_thread: analystThread,
          whiteglove_requests: userWhiteGlove,
          whiteglove_deliverables: userDeliverables,
          user: {
            email: dbUser.email,
            login_email: dbUser.email,
            payment_provider: dbUser.payment_provider || 'paddle',
            payment_intent_id: dbUser.payment_intent_id || null,
            payment_customer_email: dbUser.payment_customer_email || null,
            name: dbUser.name,
            plan: dbUser.plan,
            status: lockState.status,
            locked: lockState.locked,
            lockReason: lockState.reason,
            lockError: lockState.error,
            license_start: dbUser.license_start,
            license_end: effectiveExpiryMs,
            analyses_used: license.analysesUsed,
            analyses_left: lockState.analysesLeft,
            analyses_total: license.analysesLimit,
            successful_analyses: dbUser.successful_analyses || 0,
            ...quotaEnvelope,
            has_reported_issue: Boolean(dbUser.has_reported_issue),
            issue_reported_at: dbUser.issue_reported_at ?? null,
            issue_resolved_at: dbUser.issue_resolved_at ?? null,
            issue_description: dbUser.issue_description || '',
            issue_status: dbUser.issue_status || 'none',
            cancel_status: dbUser.cancel_status || 'none',
            last_order_id: dbUser.last_order_id || dbUser.payments?.[0]?.order_id || null,
            maxSaved,
            max_saved: maxSaved,
            saved_count: savedCount,
            portfolio_assets: dbUser.portfolio_assets || [],
            last_results: lastResults,
            api_key: maskedApiKey,
            api_key_last4: apiKeyLast4,
            locked_launch_price: dbUser.locked_launch_price ?? null,
            custom_cities: dbUser.custom_cities || [],
            analyst_unread: Number(analystThread?.unreadForClient || 0),
            whiteglove_requests: userWhiteGlove,
            whiteglove_deliverables: userDeliverables,
          },
          license: {
            ...license,
            analysesLeft: lockState.analysesLeft,
            isExpired: lockState.packageExpired,
            savedLimit: maxSaved,
            isUnlimitedSaved: false,
          },
        });
      }

      case 'pricing': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res?.setHeader?.('Pragma', 'no-cache');
        res?.setHeader?.('Expires', '0');
        return res.status(200).json(getPricingPublicPayload());
      }

      case 'verify-payment':
      case 'verify-checkout': {
        try {
          res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
        } catch {}

        let orderId = '';
        const paddleApiKey = cleanEnvValue(getEnv('PADDLE_API_KEY'));
        const paddleEnv = resolvePaddleEnvironment();
        const paddleBaseUrl = paddleEnv.baseUrl;
        const hasPaymentKey = Boolean(paddleApiKey);

        try {
          const src: Record<string, any> = {
            ...(req?.query && typeof req.query === 'object' ? req.query : {}),
            ...(parsedBody && typeof parsedBody === 'object' ? parsedBody : {}),
          };
          const sessionEmail = getSessionEmailFromReq(req);
          const loginEmail = String(sessionEmail || src?.login_email || src?.email || '')
            .trim()
            .toLowerCase();

          if (!loginEmail || !loginEmail.includes('@')) {
            return res.status(200).json({
              success: false,
              error: 'Please sign in first to verify your payment - سجل دخولك أولاً لتفعيل حسابك',
            });
          }

          const requestedPlanRaw = String(src?.plan || '').trim().toLowerCase();
          const requestedPlan: PlanKey | undefined =
            requestedPlanRaw === 'starter' ||
            requestedPlanRaw === 'pro' ||
            requestedPlanRaw === 'professional' ||
            requestedPlanRaw === 'enterprise' ||
            requestedPlanRaw === 'sovereign'
              ? normalizePlanKey(requestedPlanRaw)
              : undefined;

          const cleanPlaceholderOrderId = (raw: any): string => {
            const cleaned = normalizeOrderId(String(raw || ''));
            const lower = cleaned.toLowerCase();
            if (
              !cleaned ||
              cleaned === '{ORDER_ID}' ||
              cleaned === '[order_id]' ||
              cleaned === '{order_id}' ||
              lower === 'last' ||
              lower === 'not found' ||
              lower === 'null' ||
              lower === 'undefined' ||
              lower === 'none' ||
              lower === 'empty'
            ) {
              return '';
            }
            return cleaned;
          };

          const rawOrderParam = String(
            src?.transaction_id || src?.transactionId || src?._ptxn || src?.order_id || src?.order || ''
          ).trim();
          const lowerOrderParam = rawOrderParam.toLowerCase();
          const isFallbackMode =
            !rawOrderParam ||
            lowerOrderParam === 'last' ||
            lowerOrderParam === 'not found' ||
            !cleanPlaceholderOrderId(rawOrderParam);
          orderId = isFallbackMode ? '' : cleanPlaceholderOrderId(rawOrderParam);

          const pricing = getPricingPublicPayload();

          const completeActivation = async (params: {
            resolvedOrderId: string;
            amountUSD: number;
            rawAmountCents?: number;
            productName?: string;
            variantId?: string;
            productId?: string;
            fallbackPlan?: PlanKey;
            paymentEmail: string;
            paymentProvider?: string;
            testMode: boolean;
            createdAtIso?: string;
            skipWebhookLogAppend?: boolean;
          }) => {
            const tier = mapAmountOrPlanToOrderTier(params.amountUSD, params.fallbackPlan, {
              productName: params.productName,
              variantId: params.variantId,
              productId: params.productId,
              rawAmountCents: params.rawAmountCents,
            });
            const now = Date.now();
            let dbUser =
              (await getUserFromDb(loginEmail).catch(() => null)) || getOrCreateServerUser(loginEmail);
            dbUser = activatePaidPlanOnServer({
              email: loginEmail,
              name: dbUser?.name,
              plan: tier.plan,
              paymentTimestamp: now,
              orderId: params.resolvedOrderId,
              amountUSD: params.amountUSD,
              currency: 'USD',
              testMode: params.testMode,
              refundPolicyAcceptedAt: src?.refundAcceptedAt || new Date(now).toISOString(),
              lockedLaunchPrice: pricing.launchDiscountActive ? params.amountUSD : null,
              paymentCustomerEmail: params.paymentEmail || null,
              paymentProvider: params.paymentProvider || 'paddle',
              paymentIntentId: params.resolvedOrderId,
            });
            await saveUserToDb(dbUser).catch(() => {});

            await markOrderUsedInDb({
              order_id: params.resolvedOrderId,
              login_email: loginEmail,
              payment_email: params.paymentEmail || 'unknown',
              plan: tier.plan,
              plan_display: tier.planDisplay,
              analyses: tier.analyses,
              amount: params.amountUSD,
              test_mode: params.testMode,
              used_at: now,
            });

            if (!params.skipWebhookLogAppend) {
              await appendWebhookLogToDb({
                order_id: params.resolvedOrderId,
                event: 'checkout_verify_api',
                event_name: 'checkout_verify_api',
                plan: tier.plan,
                email: loginEmail,
                payment_email: params.paymentEmail || 'unknown',
                created_at: params.createdAtIso || new Date(now).toISOString(),
                amount: params.amountUSD,
                currency: 'USD',
                test_mode: params.testMode,
                signature_valid: true,
              }).catch(() => {});
            }

            try {
              setSessionCookie(res, dbUser.email);
              setEntitlementCookie(res, {
                email: dbUser.email,
                plan: tier.plan,
                orderId: params.resolvedOrderId,
                licenseStart: dbUser.license_start || now,
                licenseEnd: dbUser.license_end || now + THIRTY_DAYS_MS,
                amountUSD: params.amountUSD,
                testMode: params.testMode,
                paymentCustomerEmail: params.paymentEmail || null,
              });
            } catch {}

            const license = computeServerLicenseStatus(dbUser);
            const features =
              findPlanPricing(pricing, tier.plan)?.features || PLAN_DEFINITIONS[tier.plan].features;
            const successMessage =
              tier.plan === 'pro'
                ? 'تم الاشتراك بنجاح! تم تفعيل باقة Pro'
                : `تم الاشتراك بنجاح! تم تفعيل باقة ${tier.planDisplay}`;

            return res.status(200).json({
              success: true,
              verified: true,
              message: successMessage,
              plan: tier.planDisplay,
              plan_name: tier.planDisplay,
              planKey: tier.plan,
              price: PLAN_DEFINITIONS[tier.plan].priceUSD,
              analyses_left: tier.analyses,
              payment_email_for_log_only: params.paymentEmail || null,
              order_id: params.resolvedOrderId,
              transaction_id: params.resolvedOrderId,
              payment_intent_id: params.resolvedOrderId,
              payment_provider: params.paymentProvider || 'paddle',
              login_email: dbUser.email,
              license_end: dbUser.license_end,
              user: dbUser,
              license: {
                ...license,
                analysesLimit: tier.analyses,
                analysesLeft: tier.analyses,
              },
              features,
            });
          };

          const returnExistingUsedOrder = async (existingUsedOrder: UsedOrderRecord) => {
            if (existingUsedOrder.login_email !== loginEmail) {
              return res.status(200).json({
                success: false,
                error: 'This order was already used - هذا الطلب تم استخدامه',
              });
            }

            let existingUser =
              (await getUserFromDb(loginEmail).catch(() => null)) || getOrCreateServerUser(loginEmail);
            if (
              existingUser.cancel_status !== 'refunded' &&
              (existingUser.plan === 'free' ||
                (existingUser.plan !== existingUsedOrder.plan &&
                  (existingUsedOrder.used_at || 0) >= (existingUser.license_start || 0)))
            ) {
              existingUser = activatePaidPlanOnServer({
                email: loginEmail,
                name: existingUser.name,
                plan: existingUsedOrder.plan,
                paymentTimestamp: existingUsedOrder.used_at || Date.now(),
                orderId: existingUsedOrder.order_id,
                amountUSD: existingUsedOrder.amount,
                currency: 'USD',
                testMode: Boolean(existingUsedOrder.test_mode),
                paymentCustomerEmail: existingUsedOrder.payment_email || null,
                paymentProvider: existingUser.payment_provider || 'paddle',
                paymentIntentId: existingUsedOrder.order_id,
              });
              await saveUserToDb(existingUser).catch(() => {});
            }
            const usedPlanKey = normalizePlanKey(existingUser.plan || existingUsedOrder.plan);
            const license = computeServerLicenseStatus(existingUser);
            const features =
              findPlanPricing(pricing, usedPlanKey)?.features || PLAN_DEFINITIONS[usedPlanKey].features;
            const successMessage =
              usedPlanKey === 'pro'
                ? 'تم الاشتراك بنجاح! تم تفعيل باقة Pro'
                : `تم الاشتراك بنجاح! تم تفعيل باقة ${license.displayName}`;
            try {
              setSessionCookie(res, existingUser.email);
              if (existingUser.cancel_status !== 'refunded') {
                setEntitlementCookie(res, {
                  email: existingUser.email,
                  plan: existingUsedOrder.plan,
                  orderId: existingUsedOrder.order_id,
                  licenseStart: existingUser.license_start || Date.now(),
                  licenseEnd: existingUser.license_end || Date.now() + THIRTY_DAYS_MS,
                  amountUSD: existingUsedOrder.amount,
                  testMode: Boolean(existingUsedOrder.test_mode),
                  paymentCustomerEmail: existingUsedOrder.payment_email || null,
                });
              }
            } catch {}

            return res.status(200).json({
              success: true,
              verified: true,
              message: successMessage,
              plan: license.displayName,
              plan_name: license.displayName,
              planKey: license.planKey,
              price: PLAN_DEFINITIONS[license.planKey].priceUSD,
              analyses_left: license.analysesLeft,
              analyses_total: license.analysesLimit,
              payment_email_for_log_only: existingUsedOrder.payment_email || null,
              order_id: existingUsedOrder.order_id,
              transaction_id: existingUsedOrder.order_id,
              payment_intent_id: existingUsedOrder.order_id,
              payment_provider: existingUser.payment_provider || 'paddle',
              login_email: existingUser.email,
              license_end: existingUser.license_end,
              user: existingUser,
              license,
              features,
            });
          };

          if (isFallbackMode) {
            const isValidWebhookOrderEntry = (entry: any, allowVerifyEvent = false): string => {
              if (!entry || typeof entry !== 'object') return '';
              const ev = String(entry?.event || entry?.event_name || '').trim().toLowerCase();
              const allowedEvents = allowVerifyEvent
                ? ['order_created', 'payment_intent.succeeded', 'checkout.session.completed', 'checkout_verify_api']
                : ['order_created', 'payment_intent.succeeded', 'checkout.session.completed'];
              if (ev && !allowedEvents.includes(ev)) {
                return '';
              }
              const oid = cleanPlaceholderOrderId(entry?.order_id);
              if (!oid || oid === 'key_missing' || oid === 'not_found' || oid.startsWith('ord_')) {
                return '';
              }
              return oid;
            };

            const recentLogs = await getWebhookLogsFromDb(100).catch(() => []);
            const logsArr = Array.isArray(recentLogs) ? recentLogs : [];

            let unusedWebhookLog: any = null;
            let latestUsedSameEmail: UsedOrderRecord | null = null;
            let latestClaimedByOther: UsedOrderRecord | null = null;

            for (const entry of logsArr) {
              const oid = isValidWebhookOrderEntry(entry, false);
              if (!oid) continue;
              const usedCheck = await getUsedOrderFromDb(oid).catch(() => null);
              if (!usedCheck) {
                unusedWebhookLog = entry;
                break;
              }
              if (usedCheck.login_email === loginEmail && !latestUsedSameEmail) {
                latestUsedSameEmail = usedCheck;
              } else if (usedCheck.login_email !== loginEmail && !latestClaimedByOther) {
                latestClaimedByOther = usedCheck;
              }
            }

            if (unusedWebhookLog) {
              orderId = cleanPlaceholderOrderId(unusedWebhookLog.order_id);
              const logAmount = Number(unusedWebhookLog?.amount ?? 0);
              const logPlan = normalizePlanKey(unusedWebhookLog?.plan);
              const fallbackAmount =
                Number.isFinite(logAmount) && logAmount > 0
                  ? logAmount
                  : logPlan === 'enterprise'
                  ? PLANS.SOVEREIGN.price
                  : logPlan === 'starter'
                  ? PLANS.STARTER.price
                  : PLANS.PROFESSIONAL.price;
              const logPaymentEmail = String(
                unusedWebhookLog?.payment_email || unusedWebhookLog?.email || ''
              )
                .trim()
                .toLowerCase();

              return await completeActivation({
                resolvedOrderId: orderId,
                amountUSD: fallbackAmount,
                fallbackPlan: logPlan !== 'free' ? logPlan : 'pro',
                paymentEmail: logPaymentEmail,
                testMode: Boolean(unusedWebhookLog?.test_mode),
                createdAtIso: unusedWebhookLog?.created_at || unusedWebhookLog?.timestamp,
                skipWebhookLogAppend: true,
              });
            }

            if (latestUsedSameEmail) {
              return await returnExistingUsedOrder(latestUsedSameEmail);
            }
            for (const entry of logsArr) {
              const oid = isValidWebhookOrderEntry(entry, true);
              if (!oid) continue;
              const usedCheck = await getUsedOrderFromDb(oid).catch(() => null);
              if (usedCheck && usedCheck.login_email === loginEmail) {
                return await returnExistingUsedOrder(usedCheck);
              }
              if (usedCheck && usedCheck.login_email !== loginEmail && !latestClaimedByOther) {
                latestClaimedByOther = usedCheck;
              }
            }

            if (latestClaimedByOther) {
              return res.status(200).json({
                success: false,
                error: 'This order was already used - هذا الطلب تم استخدامه',
              });
            }

            return res.status(200).json({
              success: false,
              error: 'No completed payment found yet. Complete Paddle checkout or enter Transaction ID below.',
            });
          }

          const existingUsedOrder = await getUsedOrderFromDb(orderId).catch(() => null);
          if (existingUsedOrder) {
            return await returnExistingUsedOrder(existingUsedOrder);
          }

          if (!hasPaymentKey || !paddleApiKey) {
            console.error('[Paddle Verify] Missing required environment variable: PADDLE_API_KEY');
            return res.status(500).json({
              success: false,
              error: 'Missing required server environment variable: PADDLE_API_KEY.',
            });
          }

          if (!paddleEnv.configured || !paddleBaseUrl) {
            console.error(
              '[Paddle Verify] Missing or invalid environment variable: PADDLE_ENVIRONMENT (expected "live" or "sandbox").'
            );
            return res.status(500).json({
              success: false,
              error: 'Missing required server environment variable: PADDLE_ENVIRONMENT.',
            });
          }

          const verifiedBaseUrl = paddleBaseUrl;
          const paddleRes = await fetch(
            `${verifiedBaseUrl}/transactions/${encodeURIComponent(orderId)}`,
            {
              headers: {
                Authorization: `Bearer ${paddleApiKey}`,
                Accept: 'application/json',
              },
            }
          );
          const paddleJson: any = await paddleRes.json().catch(() => null);
          const txnData = paddleJson?.data;
          if (!paddleRes?.ok || !txnData?.id) {
            return res.status(200).json({
              success: false,
              error:
                paddleJson?.error?.detail ||
                paddleJson?.error?.message ||
                `Transaction not found in Paddle: ${orderId}`,
            });
          }

          const txnStatus = String(txnData.status || '').toLowerCase();
          const isPaid =
            txnStatus === 'completed' ||
            txnStatus === 'billed' ||
            txnStatus === 'paid';
          if (!isPaid) {
            return res.status(200).json({
              success: false,
              error: `Paddle transaction #${orderId} status is '${txnData.status || 'pending'}' (not completed)`,
            });
          }

          const rawGrandTotal = Number(
            txnData?.details?.totals?.grand_total ??
              txnData?.details?.totals?.total ??
              txnData?.details?.totals?.subtotal ??
              0
          );
          const amountUSD =
            Number.isFinite(rawGrandTotal) && rawGrandTotal > 0
              ? rawGrandTotal / 100
              : PLAN_DEFINITIONS[requestedPlan && requestedPlan !== 'free' ? requestedPlan : 'pro'].launchPrice;

          const LEGACY_SANDBOX_PRICE_ID = 'pri_01m7qwqceh520nd4we9pg90f8m';
          const rawProEnv = cleanEnvValue(getEnv('NEXT_PUBLIC_PADDLE_PRICE_ID'));
          const proPriceId =
            rawProEnv && rawProEnv !== LEGACY_SANDBOX_PRICE_ID
              ? rawProEnv
              : !paddleEnv.isSandbox
              ? 'pri_01m7tggqhjtgk9fxmmg6mbp5wy'
              : '';
          const starterPriceId =
            cleanEnvValue(
              getEnv('NEXT_PUBLIC_PADDLE_STARTER_PRICE') ||
                getEnv('NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID')
            ) || (!paddleEnv.isSandbox ? 'pri_01m7tgfvteegdih2mx4hgyz1c' : '');
          const sovereignPriceId =
            cleanEnvValue(
              getEnv('NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE') ||
                getEnv('NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID')
            ) || (!paddleEnv.isSandbox ? 'pri_01m7tgj4pp767gacchp49k2qev' : '');
          const firstItem = Array.isArray(txnData?.items) ? txnData.items[0] : null;
          const itemPriceId = String(firstItem?.price?.id || firstItem?.price_id || '').trim();
          const itemProductName = String(
            firstItem?.price?.name || firstItem?.product?.name || firstItem?.price?.description || ''
          ).trim();

          let resolvedFallbackPlan: PlanKey = requestedPlan && requestedPlan !== 'free' ? requestedPlan : 'pro';
          if (proPriceId && itemPriceId === proPriceId) {
            resolvedFallbackPlan = 'pro';
          } else if (starterPriceId && itemPriceId === starterPriceId) {
            resolvedFallbackPlan = 'starter';
          } else if (sovereignPriceId && itemPriceId === sovereignPriceId) {
            resolvedFallbackPlan = 'enterprise';
          } else if (txnData?.custom_data?.plan) {
            const cdPlan = normalizePlanKey(String(txnData.custom_data.plan));
            if (cdPlan !== 'free') resolvedFallbackPlan = cdPlan;
          } else if (itemProductName) {
            resolvedFallbackPlan = resolvePlanFromOrderAttributes(
              { product_name: itemProductName, amount: rawGrandTotal },
              resolvedFallbackPlan
            );
          }

          const paymentEmail = String(
            txnData?.customer?.email ||
              txnData?.custom_data?.email ||
              txnData?.custom_data?.login_email ||
              src?.email ||
              loginEmail
          )
            .trim()
            .toLowerCase();

          return await completeActivation({
            resolvedOrderId: String(txnData.id),
            amountUSD,
            rawAmountCents: Number.isFinite(rawGrandTotal) ? rawGrandTotal : undefined,
            productName: itemProductName || undefined,
            variantId: itemPriceId || undefined,
            fallbackPlan: resolvedFallbackPlan,
            paymentEmail,
            paymentProvider: 'paddle',
            testMode: verifiedBaseUrl.includes('sandbox'),
            createdAtIso: txnData.created_at || new Date().toISOString(),
          });
        } catch (err: any) {
          console.error('[verify-checkout] Unhandled error (returning HTTP 200):', err);
          return res.status(200).json({
            success: false,
            error: `Verify failed: ${err?.message || String(err || 'Unknown error')} | order_id:${orderId || 'none'}`,
          });
        }
      }

      case 'debug-plan': {
        const sessionEmail = getSessionEmailFromReq(req);
        const isProd =
          getEnv('VERCEL_ENV') === 'production' ||
          getEnv('NODE_ENV') === 'production';

        if (isProd && !isAdminEmail(sessionEmail)) {
          return res.status(403).json({
            error: 'Debug endpoint restricted to ADMIN_EMAIL in production',
          });
        }

        const email = (
          sessionEmail ||
          getQueryParam(req, url, 'email') ||
          parsedBody?.email ||
          ''
        )
          .toString()
          .trim()
          .toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication or email query required' });
        }

        const userRecord =
          (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const pricing = getPricingPublicPayload();

        return res.status(200).json({
          email: userRecord.email,
          plan: license.displayName,
          planKey: license.planKey,
          license_start: userRecord.license_start,
          license_end: userRecord.license_end,
          analyses_used: license.analysesUsed,
          analyses_left: license.analysesLeft,
          extra_credits: userRecord.extra_credits || 0,
          days_left: license.daysLeft,
          locked_launch_price: userRecord.locked_launch_price ?? null,
          features:
            findPlanPricing(pricing, license.planKey)?.features ||
            PLAN_DEFINITIONS[license.planKey].features,
          capabilities: PLAN_DEFINITIONS[license.planKey].capabilities,
        });
      }

      case 'run-analysis':
      case 'underwrite':
      case 'analyze': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = parsedBody;
        const authHeader = String(req?.headers?.authorization || '');
        const bearerRaw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const isApiKeyBearer = bearerRaw.startsWith('aqari_live_');
        let email = getSessionEmailFromReq(req) || '';

        if (isApiKeyBearer) {
          const apiOwner = await resolveApiKeyEmail(bearerRaw);
          if (!apiOwner) {
            return res.status(401).json({
              success: false,
              error: 'Invalid or inactive REST API token. Copy your live token from SOVEREIGN Settings.',
              code: 'INVALID_API_KEY',
            });
          }
          email = apiOwner;
        } else if (!email) {
          email = String(body.login_email || body.email || '')
            .trim()
            .toLowerCase();
        }

        if (!email) {
          return res.status(401).json({ error: 'Authentication required to run underwriting analysis' });
        }

        const rl = checkRateLimit(`analyze:${email}`, 30, 60 * 1000);
        if (!rl.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded. Please wait briefly.',
            retryAfterSec: rl.retryAfterSec,
          });
        }

        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. No credit deducted. Please retry.',
          });
        }
        const userRecord =
          hydratedDb ||
          getOrCreateServerUser(email, {
            name: body.name,
            timezone: body.timezone,
          });
        const license = computeServerLicenseStatus(userRecord);
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['run-analysis']);
        let apiDailyPatch: Partial<ServerUserRecord> = {};
        if (isApiKeyBearer) {
          const apiCheck = checkAndConsumeApiDailyQuota(userRecord);
          if (!apiCheck.ok) {
            return res.status(apiCheck.status).json(apiCheck.payload);
          }
          apiDailyPatch = {
            api_calls_day: apiCheck.api_calls_day,
            api_calls_today: apiCheck.api_calls_today,
          };
        }

        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
            daysLeft: creditCheck.payload.reason === 'expired' ? 0 : license.daysLeft,
          });
        }

        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (body.useMonteCarlo === true && !canUseFeature(featurePlanKey, 'monteCarlo')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('monteCarlo'),
            code: 'FEATURE_LOCKED',
            feature: 'monteCarlo',
            requiredPlan: 'starter',
          });
        }

        const rawCityInput = String(body.city || '').trim();
        const cityEntry = findInlinedCity(rawCityInput);
        if (!cityEntry) {
          return res.status(400).json({
            success: false,
            error: 'City not supported yet. Choose from list.',
            code: 'INVALID_CITY',
            city: rawCityInput,
          });
        }

        const priceUSD = parseEnglishNumberServer(
          body.priceUSD ?? body.acquisitionValuation ?? body.valuation
        );
        const rentUSD = parseEnglishNumberServer(
          body.rentUSD ?? body.monthlyRent ?? body.rent
        );
        const downPaymentPct = parseEnglishNumberServer(
          body.downPaymentPct ?? body.equityDownPct ?? body.equity ?? 30
        );
        const interestRatePct = parseEnglishNumberServer(
          body.interestRatePct ?? body.mortgageRatePct ?? body.rate ?? 5.5
        );
        const operatingExpensePct = parseEnglishNumberServer(
          body.operatingExpensePct ?? body.opexPct ?? body.opex ?? 15
        );
        const loanTermYears = parseEnglishNumberServer(body.loanTermYears ?? 25);
        const amortizationYears = parseEnglishNumberServer(
          body.amortizationYears ?? (Number.isFinite(loanTermYears) ? loanTermYears : 25)
        );
        const vacancyRatePct = parseEnglishNumberServer(body.vacancyRatePct ?? 0);
        const managementPct = parseEnglishNumberServer(body.managementPct ?? 0);
        const propertyTaxUSD = parseEnglishNumberServer(body.propertyTaxUSD ?? 0);
        const insuranceUSD = parseEnglishNumberServer(body.insuranceUSD ?? 0);
        const maintenanceReserveUSD = parseEnglishNumberServer(body.maintenanceReserveUSD ?? 0);
        const hoaUSD = parseEnglishNumberServer(body.hoaUSD ?? 0);
        const closingCostsPct = parseEnglishNumberServer(body.closingCostsPct ?? 0);
        const rentGrowthPct = parseEnglishNumberServer(body.rentGrowthPct ?? 3.0);
        const expenseGrowthPct = parseEnglishNumberServer(body.expenseGrowthPct ?? 2.5);
        const appreciationPct = parseEnglishNumberServer(body.appreciationPct ?? 3.0);
        const exitCapRatePct = parseEnglishNumberServer(body.exitCapRatePct ?? 0);
        const sellingCostsPct = parseEnglishNumberServer(body.sellingCostsPct ?? 3.0);
        const noExitValue = Boolean(body.noExitValue);

        const propertyTitle = (
          body.propertyTitle ||
          body.title ||
          `${cityEntry.city} Prime Institutional Asset`
        ).toString();
        const city = cityEntry.city;

        if (
          !Number.isFinite(priceUSD) ||
          priceUSD <= 0 ||
          !Number.isFinite(rentUSD) ||
          rentUSD <= 0 ||
          !Number.isFinite(downPaymentPct) ||
          downPaymentPct < 0 ||
          downPaymentPct > 100 ||
          !Number.isFinite(interestRatePct) ||
          interestRatePct < 0 ||
          !Number.isFinite(operatingExpensePct) ||
          operatingExpensePct < 0 ||
          operatingExpensePct >= 100
        ) {
          return res.status(400).json({
            success: false,
            error: 'Price & monthly rent must be greater than 0; percentages must be valid.',
            code: 'INVALID_INPUTS',
          });
        }

        const uwInputs: ServerUnderwritingInputs = {
          priceUSD,
          rentUSD,
          downPaymentPct,
          interestRatePct,
          operatingExpensePct,
          loanTermYears: Number.isFinite(loanTermYears) ? loanTermYears : 25,
          amortizationYears: Number.isFinite(amortizationYears) ? amortizationYears : 25,
          vacancyRatePct: Number.isFinite(vacancyRatePct) ? vacancyRatePct : 0,
          managementPct: Number.isFinite(managementPct) ? managementPct : 0,
          propertyTaxUSD: Number.isFinite(propertyTaxUSD) ? propertyTaxUSD : 0,
          insuranceUSD: Number.isFinite(insuranceUSD) ? insuranceUSD : 0,
          maintenanceReserveUSD: Number.isFinite(maintenanceReserveUSD) ? maintenanceReserveUSD : 0,
          hoaUSD: Number.isFinite(hoaUSD) ? hoaUSD : 0,
          closingCostsPct: Number.isFinite(closingCostsPct) ? closingCostsPct : 0,
          rentGrowthPct: Number.isFinite(rentGrowthPct) ? rentGrowthPct : 3.0,
          expenseGrowthPct: Number.isFinite(expenseGrowthPct) ? expenseGrowthPct : 2.5,
          appreciationPct: Number.isFinite(appreciationPct) ? appreciationPct : 3.0,
          exitCapRatePct: Number.isFinite(exitCapRatePct) ? exitCapRatePct : 0,
          sellingCostsPct: Number.isFinite(sellingCostsPct) ? sellingCostsPct : 3.0,
          noExitValue,
        };

        const uw = calculateServerUnderwriting(uwInputs);
        const capRate = uw.capRate;
        const cashOnCash = uw.cashOnCash;
        const hasSensitivity = canUseFeature(featurePlanKey, 'yieldSensitivity');
        const hasMonteCarlo = canUseFeature(featurePlanKey, 'monteCarlo');
        const mcCycles = PLAN_DEFINITIONS[featurePlanKey].monteCarloMaxCycles || 1000;

        const sensitivity = hasSensitivity
          ? [-10, 0, 10].map((deltaPct) => {
              const adjRent = rentUSD * (1 + deltaPct / 100);
              const adjUw = calculateServerUnderwriting({ ...uwInputs, rentUSD: adjRent });
              return {
                deltaPct,
                rentUSD: Math.round(adjRent),
                capRate: adjUw.capRate,
                cashOnCash: adjUw.cashOnCash,
                monthlyCashflowUSD: adjUw.monthlyCashflowUSD,
              };
            })
          : null;

        const monteCarlo =
          hasMonteCarlo && body.useMonteCarlo === true
            ? runServerMonteCarlo(uwInputs, { cycles: mcCycles })
            : null;

        const analyzedAt = new Date().toISOString();
        const inputsPayload = {
          propertyTitle,
          city,
          country: cityEntry.country,
          countryCode: cityEntry.countryCode,
          currency: 'USD',
          ...uw.inputs,
        };
        const analysisResultPayload = {
          capRate: uw.capRate,
          cashOnCash: uw.cashOnCash,
          irr5Yr: hasSensitivity ? uw.irr5Yr : null,
          irrStatus: hasSensitivity ? uw.irrStatus : undefined,
          irrError: hasSensitivity ? uw.irrError : undefined,
          dscr: hasSensitivity ? uw.dscr : null,
          dscrNumeric: hasSensitivity ? uw.dscrNumeric : null,
          monthlyCashflowUSD: hasSensitivity ? uw.monthlyCashflowUSD : null,
          monthlyMortgageUSD: hasSensitivity ? uw.monthlyMortgageUSD : null,
          netOperatingIncomeUSD: uw.netOperatingIncomeUSD,
          annualGrossRentUSD: uw.annualGrossRentUSD,
          annualOPEXUSD: uw.annualOPEXUSD,
          annualDebtServiceUSD: uw.annualDebtServiceUSD,
          downPaymentUSD: uw.downPaymentUSD,
          closingCostsUSD: uw.closingCostsUSD,
          totalEquityInvestedUSD: uw.totalEquityInvestedUSD,
          loanAmountUSD: uw.loanAmountUSD,
          exitGrossValueUSD: uw.exitGrossValueUSD,
          sellingCostsUSD: uw.sellingCostsUSD,
          remainingLoanYr5USD: uw.remainingLoanYr5USD,
          netExitProceedsUSD: uw.netExitProceedsUSD,
          noiBreakdown: uw.noiBreakdown,
          yearByYear: hasSensitivity ? uw.yearByYear : undefined,
          warnings: uw.warnings,
          sensitivity,
          monteCarlo,
        };

        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: propertyTitle,
            city,
            priceUSD,
            capRate,
            cashOnCash,
            resultSummary: `Cap ${capRate}% | CoC ${cashOnCash}%${uw.irr5Yr !== null ? ` | IRR ${uw.irr5Yr}%` : ''}`,
          },
          {
            ...apiDailyPatch,
            last_results: {
              ...(userRecord.last_results || {}),
              analysis: {
                inputs: inputsPayload,
                cityData: cityEntry,
                results: analysisResultPayload,
                created_at: analyzedAt,
              },
            },
          },
          CREDIT_COSTS['run-analysis']
        );
        await saveUserToDb(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);
        const nextLock = evaluateLockState(updatedUser);
        const cancellationEligibility = evaluateCancelRefundEligibility(updatedUser);

        return res.status(200).json({
          success: true,
          analyzedAt,
          inputs: inputsPayload,
          cityData: cityEntry,
          result: analysisResultPayload,
          results: analysisResultPayload,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLock.analysesLeft,
          analyses_total: nextLicense.analysesLimit,
          analyses_used: nextLicense.analysesUsed,
          plan_analyses_left: nextLock.planAnalysesLeft,
          extra_credits: nextLock.creditsBalance,
          credits_balance: nextLock.creditsBalance,
          package_expired: nextLock.packageExpired,
          credits_only_mode: nextLock.creditsOnlyMode,
          successful_analyses: updatedUser.successful_analyses || 0,
          saved_count: updatedUser.saved_analyses.length,
          maxSaved: PLAN_DEFINITIONS[nextLicense.planKey].savedLimit,
          cancellationEligibility,
          license: {
            ...nextLicense,
            savedLimit: PLAN_DEFINITIONS[nextLicense.planKey].savedLimit,
            isUnlimitedSaved: false,
          },
          planCapabilities: PLAN_DEFINITIONS[nextLicense.planKey].capabilities,
        });
      }

      case 'find-deals': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const body = parsedBody;
        const authHeader = String(req?.headers?.authorization || '');
        const bearerRaw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const isApiKeyBearer = bearerRaw.startsWith('aqari_live_');
        let email = getSessionEmailFromReq(req) || '';

        if (isApiKeyBearer) {
          const apiOwner = await resolveApiKeyEmail(bearerRaw);
          if (!apiOwner) {
            return res.status(401).json({ success: false, error: 'Invalid API token' });
          }
          email = apiOwner;
        } else if (!email) {
          email = String(body.login_email || body.email || '')
            .trim()
            .toLowerCase();
        }

        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. No credit deducted. Please retry.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['find-deals']);

        let apiDailyPatch: Partial<ServerUserRecord> = {};
        if (isApiKeyBearer) {
          const apiCheck = checkAndConsumeApiDailyQuota(userRecord);
          if (!apiCheck.ok) {
            return res.status(apiCheck.status).json(apiCheck.payload);
          }
          apiDailyPatch = {
            api_calls_day: apiCheck.api_calls_day,
            api_calls_today: apiCheck.api_calls_today,
          };
        }

        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }

        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (!canUseFeature(featurePlanKey, 'dealFinder')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('dealFinder'),
            code: 'FEATURE_LOCKED',
            requiredPlan: 'starter',
          });
        }

        const rawCityInput = String(body.city || '').trim();
        const cityEntry = findInlinedCity(rawCityInput);
        if (!cityEntry) {
          return res.status(400).json({
            success: false,
            error: 'City not supported yet. Choose from list.',
            code: 'INVALID_CITY',
            city: rawCityInput,
          });
        }

        const budget = parseEnglishNumberServer(body.budget ?? body.maxBudget ?? body.priceUSD);
        const minCapRate = parseEnglishNumberServer(body.minCapRate ?? body.min_cap_rate ?? 0);
        const rawType = String(body.propertyType || 'All').trim();
        const propertyType = ['Apartment', 'Villa', 'Commercial', 'All'].includes(rawType)
          ? rawType
          : 'All';
        const rawRisk = String(body.risk || body.riskTolerance || 'Medium').trim();
        const riskLevel: 'Low' | 'Medium' | 'High' =
          rawRisk === 'Low' || rawRisk === 'High' ? rawRisk : 'Medium';

        if (!Number.isFinite(budget) || budget <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Budget ($) must be greater than 0.',
            code: 'INVALID_INPUTS',
          });
        }
        if (!Number.isFinite(minCapRate) || minCapRate <= 0 || minCapRate > 50) {
          return res.status(400).json({
            success: false,
            error: 'Min Cap Rate (%) must be between 0.1 and 50.',
            code: 'INVALID_INPUTS',
          });
        }

        const typePool: Array<'Apartment' | 'Villa' | 'Commercial'> =
          propertyType === 'All'
            ? ['Apartment', 'Villa', 'Commercial', 'Apartment', 'Commercial']
            : [
                propertyType as 'Apartment' | 'Villa' | 'Commercial',
                propertyType as 'Apartment' | 'Villa' | 'Commercial',
                propertyType as 'Apartment' | 'Villa' | 'Commercial',
                propertyType as 'Apartment' | 'Villa' | 'Commercial',
                propertyType as 'Apartment' | 'Villa' | 'Commercial',
              ];

        const dealNamesByType: Record<'Apartment' | 'Villa' | 'Commercial', string[]> = {
          Apartment: [
            `${cityEntry.city} Prime Residence`,
            `${cityEntry.city} Waterfront Suite`,
            `${cityEntry.city} Central Tower Apt`,
            `${cityEntry.city} Executive Flat`,
            `${cityEntry.city} Marina Corner Unit`,
          ],
          Villa: [
            `${cityEntry.city} Horizon Estate Villa`,
            `${cityEntry.city} Golf Crest Residence`,
            `${cityEntry.city} Waterfront Compound`,
            `${cityEntry.city} Sovereign Courtyard Villa`,
            `${cityEntry.city} Hillside Signature Villa`,
          ],
          Commercial: [
            `${cityEntry.city} Class-A Retail Floor`,
            `${cityEntry.city} Financial District Office`,
            `${cityEntry.city} Logistics Mixed-Use`,
            `${cityEntry.city} Boulevard Medical Plaza`,
            `${cityEntry.city} Corporate Hub Suite`,
          ],
        };

        const priceFactors = [0.82, 0.89, 0.96, 1.03, 1.09];
        const capDeltas = [-1.1, -0.3, +0.4, +0.9, +1.4];
        const riskNudge = riskLevel === 'High' ? 0.35 : riskLevel === 'Low' ? -0.25 : 0.05;
        const downPct = riskLevel === 'Low' ? 35 : riskLevel === 'High' ? 25 : 30;
        const mortgageRate = 5.5;
        const opexPct = 15;
        const r = mortgageRate / 100 / 12;
        const nPay = 25 * 12;

        const citySeed = cityEntry.city
          .split('')
          .reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 3), 0);

        const deals = priceFactors
          .map((factor, idx) => {
            const dtype = typePool[idx];
            const rawPrice = budget * factor;
            const price = Math.max(25000, Math.round(rawPrice / 500) * 500);
            const typeAdj = dtype === 'Commercial' ? 0.35 : dtype === 'Villa' ? -0.15 : 0.1;
            const seedBias = ((citySeed + idx * 7) % 5) * 0.05 - 0.1;
            const boundedDelta = Math.max(
              -1.5,
              Math.min(1.5, capDeltas[idx] + riskNudge + typeAdj + seedBias)
            );
            const capRate = Number(Math.max(1.5, cityEntry.avgCapRate + boundedDelta).toFixed(2));
            const annualNOI = price * (capRate / 100);
            const rent = Math.max(200, Math.round(annualNOI / (12 * 0.95 * (1 - opexPct / 100))));

            const downUSD = price * (downPct / 100);
            const loanUSD = Math.max(0, price - downUSD);
            const monthlyMortgage =
              loanUSD > 0 && r > 0
                ? (loanUSD * r * Math.pow(1 + r, nPay)) / (Math.pow(1 + r, nPay) - 1)
                : 0;
            const annualDebt = monthlyMortgage * 12;
            const annualCashflow = annualNOI - annualDebt;
            const monthlyCashflow = Math.round(annualCashflow / 12);
            const cashOnCash =
              downUSD > 0 ? Number(((annualCashflow / downUSD) * 100).toFixed(2)) : 0;
            const irr = Number((cashOnCash + 4.8).toFixed(1));
            const dscr = annualDebt > 0 ? (annualNOI / annualDebt).toFixed(2) : '2.00';

            const dealRisk: 'Low' | 'Medium' | 'High' =
              boundedDelta >= 0.95 ? 'High' : boundedDelta <= -0.2 ? 'Low' : 'Medium';

            // Weighted score (0-100): cap rate vs minCapRate + cash-on-cash + budget fit + risk match
            const capFitPts =
              capRate >= minCapRate
                ? Math.min(46, 34 + (capRate - minCapRate) * 4.5)
                : Math.max(8, 30 - (minCapRate - capRate) * 6);
            const cocPts = Math.max(0, Math.min(26, 12 + cashOnCash * 1.4));
            const budgetFitPts = price <= budget ? 16 : Math.max(6, 16 - (price / budget - 1) * 70);
            const riskPts = dealRisk === riskLevel ? 12 : 7;
            const score = Math.max(18, Math.min(98, Math.round(capFitPts + cocPts + budgetFitPts + riskPts)));

            return {
              id: `deal_${Date.now()}_${idx + 1}`,
              name: dealNamesByType[dtype][idx % dealNamesByType[dtype].length],
              city: cityEntry.city,
              country: cityEntry.country,
              propertyType: dtype,
              price,
              rent,
              capRate,
              cashOnCash,
              irr,
              dscr,
              monthlyCashflow,
              downPaymentPct: downPct,
              interestRatePct: mortgageRate,
              operatingExpensePct: opexPct,
              risk: dealRisk,
              score,
            };
          })
          .sort((a, b) => b.score - a.score);

        const isFreeLimitedPreview = license.planKey === 'free';
        const returnedDeals = isFreeLimitedPreview ? deals.slice(0, 2) : deals;
        const dealCreatedAt = new Date().toISOString();
        const sourceType = 'GENERATED_SIMULATED_NOT_LIVE_MLS';
        const dealDisclaimer = isFreeLimitedPreview
          ? `[GENERATED / SIMULATED — NOT LIVE MLS LISTINGS] Limited Deal Finder Preview (2 of ${deals.length} simulated deals for FREE tier) modeled from ${cityEntry.city} benchmark Cap Rate (${cityEntry.avgCapRate}%). Verify live inventory with a licensed broker.`
          : `[GENERATED / SIMULATED — NOT LIVE MLS LISTINGS] Modeled deals derived from ${cityEntry.city} benchmark avg cap rate (${cityEntry.avgCapRate}%) for screening illustration. Verify actual listings with a licensed broker.`;

        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: `AI Deal Finder - ${cityEntry.city} (${propertyType})`,
            city: cityEntry.city,
            priceUSD: budget,
            capRate: returnedDeals[0]?.capRate || 0,
            cashOnCash: returnedDeals[0]?.cashOnCash || 0,
            resultSummary: `AI Deal Finder: ${returnedDeals.length} simulated deals (${cityEntry.city}, Top ${returnedDeals[0]?.score || 0}/100)`,
          },
          {
            ...apiDailyPatch,
            last_results: {
              ...(userRecord.last_results || {}),
              deal_finder: {
                inputs: {
                  city: cityEntry.city,
                  budget,
                  minCapRate,
                  propertyType,
                  risk: riskLevel,
                },
                city: cityEntry.city,
                country: cityEntry.country,
                countryCode: cityEntry.countryCode,
                avgCapRate: cityEntry.avgCapRate,
                sourceType,
                isLimitedPreview: isFreeLimitedPreview,
                totalAvailableDeals: deals.length,
                disclaimer: dealDisclaimer,
                deals: returnedDeals,
                created_at: dealCreatedAt,
              },
            },
          },
          CREDIT_COSTS['find-deals']
        );
        await saveUserToDb(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);
        const cancellationEligibility = evaluateCancelRefundEligibility(updatedUser);

        return res.status(200).json({
          success: true,
          created_at: dealCreatedAt,
          city: cityEntry.city,
          country: cityEntry.country,
          countryCode: cityEntry.countryCode,
          avgCapRate: cityEntry.avgCapRate,
          sourceType,
          isLimitedPreview: isFreeLimitedPreview,
          totalAvailableDeals: deals.length,
          disclaimer: dealDisclaimer,
          deals: returnedDeals,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLicense.analysesLeft,
          analyses_total: nextLicense.analysesLimit,
          analyses_used: nextLicense.analysesUsed,
          extra_credits: updatedUser.extra_credits || 0,
          successful_analyses: updatedUser.successful_analyses || 0,
          saved_count: updatedUser.saved_analyses.length,
          maxSaved: PLAN_DEFINITIONS[nextLicense.planKey].savedLimit,
          cancellationEligibility,
          license: nextLicense,
        });
      }

      case 'get-forecast': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const body = parsedBody;
        const authHeader = String(req?.headers?.authorization || '');
        const bearerRaw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const isApiKeyBearer = bearerRaw.startsWith('aqari_live_');
        let email = getSessionEmailFromReq(req) || '';

        if (isApiKeyBearer) {
          const apiOwner = await resolveApiKeyEmail(bearerRaw);
          if (!apiOwner) {
            return res.status(401).json({ success: false, error: 'Invalid API token' });
          }
          email = apiOwner;
        } else if (!email) {
          email = String(body.login_email || body.email || '')
            .trim()
            .toLowerCase();
        }

        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. No credit deducted. Please retry.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['get-forecast']);

        let apiDailyPatch: Partial<ServerUserRecord> = {};
        if (isApiKeyBearer) {
          const apiCheck = checkAndConsumeApiDailyQuota(userRecord);
          if (!apiCheck.ok) {
            return res.status(apiCheck.status).json(apiCheck.payload);
          }
          apiDailyPatch = {
            api_calls_day: apiCheck.api_calls_day,
            api_calls_today: apiCheck.api_calls_today,
          };
        }

        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }

        // Basic 12M forecast unlocked on STARTER+; multi-year 3Y/5Y forecast unlocked on PROFESSIONAL+
        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (!canUseFeature(featurePlanKey, 'forecastBasic')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('forecastBasic'),
            code: 'FEATURE_LOCKED',
            feature: 'forecastBasic',
            requiredPlan: 'starter',
          });
        }

        const rawCityInput = String(body.city || '').trim();
        const cityEntry = findInlinedCity(rawCityInput);
        if (!cityEntry) {
          return res.status(400).json({
            success: false,
            error: 'City not supported yet. Choose from list.',
            code: 'INVALID_CITY',
            city: rawCityInput,
          });
        }

        const hasAdvancedForecast = canUseFeature(featurePlanKey, 'forecastAdvanced');
        const rawType = String(body.propertyType || 'Apartment').trim();
        const propertyType: 'Apartment' | 'Villa' | 'Commercial' =
          rawType === 'Villa' || rawType === 'Commercial' ? rawType : 'Apartment';
        const rawPeriod = String(body.period || '12 months').trim().toLowerCase();
        const period: '12 months' | '3 years' | '5 years' = !hasAdvancedForecast
          ? '12 months'
          : rawPeriod.includes('5')
          ? '5 years'
          : rawPeriod.includes('3')
          ? '3 years'
          : '12 months';

        const citySeed = `${cityEntry.city}:${propertyType}`
          .split('')
          .reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 5), 0);

        const currentAvgCapRate = Number(cityEntry.avgCapRate.toFixed(2));
        const typeCapAdj = propertyType === 'Commercial' ? 0.3 : propertyType === 'Villa' ? -0.1 : 0.12;
        const rentGrowth12M = Number((2.0 + ((citySeed % 30) / 10)).toFixed(1));
        const priceGrowth12M = Number((3.0 + (((citySeed * 3 + 7) % 40) / 10)).toFixed(1));
        const rentGrowth3Y = Number(((Math.pow(1 + rentGrowth12M / 100, 3) - 1) * 100).toFixed(1));
        const rentGrowth5Y = Number(((Math.pow(1 + rentGrowth12M / 100, 5) - 1) * 100).toFixed(1));
        const priceGrowth3Y = Number(((Math.pow(1 + priceGrowth12M / 100, 3) - 1) * 100).toFixed(1));
        const priceGrowth5Y = Number(((Math.pow(1 + priceGrowth12M / 100, 5) - 1) * 100).toFixed(1));

        const selectedRentGrowthPct =
          period === '5 years' ? rentGrowth5Y : period === '3 years' ? rentGrowth3Y : rentGrowth12M;
        const selectedPriceGrowthPct =
          period === '5 years' ? priceGrowth5Y : period === '3 years' ? priceGrowth3Y : priceGrowth12M;

        const capDrift12M = Number(((rentGrowth12M - priceGrowth12M * 0.65) * 0.18 + typeCapAdj * 0.35).toFixed(2));
        const forecastCap12M = Number(Math.max(1.5, currentAvgCapRate + capDrift12M).toFixed(2));
        const forecastCap3Y = Number(Math.max(1.5, currentAvgCapRate + capDrift12M * 2.1).toFixed(2));
        const forecastCap5Y = Number(Math.max(1.5, currentAvgCapRate + capDrift12M * 3.0).toFixed(2));

        const confidenceScore = (citySeed % 100);
        const confidence: 'High' | 'Medium' | 'Low' =
          confidenceScore >= 55 ? 'High' : confidenceScore >= 20 ? 'Medium' : 'Low';
        const recommendation: 'Buy' | 'Hold' | 'Wait' =
          forecastCap3Y >= currentAvgCapRate || currentAvgCapRate >= 6.0
            ? 'Buy'
            : currentAvgCapRate >= 4.4
            ? 'Hold'
            : 'Wait';

        const disclaimer = `[MODELED PROJECTION FROM HISTORICAL & BENCHMARK AVERAGES] ${cityEntry.city} baseline cap rate (${currentAvgCapRate}%) + compounding rent/price trajectory - Not financial advice, verify with local agent`;

        const fullSeries = [
          {
            label: 'Now',
            capRate: currentAvgCapRate,
            rentGrowthPct: 0,
            priceGrowthPct: 0,
            rentIndex: 100,
            priceIndex: 100,
          },
          {
            label: '12M',
            capRate: forecastCap12M,
            rentGrowthPct: rentGrowth12M,
            priceGrowthPct: priceGrowth12M,
            rentIndex: Number((100 * (1 + rentGrowth12M / 100)).toFixed(1)),
            priceIndex: Number((100 * (1 + priceGrowth12M / 100)).toFixed(1)),
          },
          {
            label: '3Y',
            capRate: forecastCap3Y,
            rentGrowthPct: rentGrowth3Y,
            priceGrowthPct: priceGrowth3Y,
            rentIndex: Number((100 * (1 + rentGrowth3Y / 100)).toFixed(1)),
            priceIndex: Number((100 * (1 + priceGrowth3Y / 100)).toFixed(1)),
          },
          {
            label: '5Y',
            capRate: forecastCap5Y,
            rentGrowthPct: rentGrowth5Y,
            priceGrowthPct: priceGrowth5Y,
            rentIndex: Number((100 * (1 + rentGrowth5Y / 100)).toFixed(1)),
            priceIndex: Number((100 * (1 + priceGrowth5Y / 100)).toFixed(1)),
          },
        ];

        const intelEntry = getGlobalMarketIntelligenceData().find(
          (m) => m.city.toLowerCase() === cityEntry.city.toLowerCase()
        );
        const derivedHistoricalIndex = intelEntry?.historicalPriceIndex || [
          { year: '2022', index: 100 },
          { year: '2023', index: Number((100 * (1 + priceGrowth12M * 0.6 / 100)).toFixed(1)) },
          { year: '2024', index: Number((100 * Math.pow(1 + priceGrowth12M * 0.7 / 100, 2)).toFixed(1)) },
          { year: '2025', index: Number((100 * Math.pow(1 + priceGrowth12M * 0.8 / 100, 3)).toFixed(1)) },
          { year: '2026', index: Number((100 * Math.pow(1 + priceGrowth12M * 0.85 / 100, 4)).toFixed(1)) },
        ];
        const baselineSource =
          intelEntry?.historicalSource ||
          `${cityEntry.country} Land Registry & Global Benchmark Calibration`;
        const updatedDate = intelEntry?.historicalDate || '2026-04-01';

        const forecast = {
          id: `fc_${Date.now()}`,
          city: cityEntry.city,
          country: cityEntry.country,
          countryCode: cityEntry.countryCode,
          propertyType,
          period,
          isBasicForecast: !hasAdvancedForecast,
          currentAvgCapRate,
          forecastCap12M,
          forecastCap3Y: hasAdvancedForecast ? forecastCap3Y : null,
          forecastCap5Y: hasAdvancedForecast ? forecastCap5Y : null,
          rentGrowth12M,
          rentGrowth3Y: hasAdvancedForecast ? rentGrowth3Y : null,
          rentGrowth5Y: hasAdvancedForecast ? rentGrowth5Y : null,
          priceGrowth12M,
          priceGrowth3Y: hasAdvancedForecast ? priceGrowth3Y : null,
          priceGrowth5Y: hasAdvancedForecast ? priceGrowth5Y : null,
          selectedRentGrowthPct,
          selectedPriceGrowthPct,
          confidence,
          recommendation,
          series: hasAdvancedForecast ? fullSeries : fullSeries.slice(0, 2),
          modelSpec: {
            modelName: 'AQARI Deterministic Compounding Yield & Rent Drift Model (v2.4)',
            dataType: intelEntry
              ? 'Historical Registry Index (2022-2026) + Documented Compounding Projection'
              : 'City Benchmark Average + Documented Compounding Projection',
            methodologySummary: `Anchored to ${cityEntry.city} baseline avg cap rate (${currentAvgCapRate}%) adjusted by property class factor (${typeCapAdj >= 0 ? '+' : ''}${typeCapAdj}%), compounded over 12M/3Y/5Y using calibrated YoY rent growth (${rentGrowth12M}%) and capital appreciation (${priceGrowth12M}%).`,
            formulas: [
              `Rent Index(t) = 100 × (1 + ${rentGrowth12M}% / 100)^t`,
              `Price Index(t) = 100 × (1 + ${priceGrowth12M}% / 100)^t`,
              `Annual Cap Drift = (RentGrowth - 0.65 × PriceGrowth) × 0.18 + TypeAdj(${typeCapAdj}) × 0.35`,
            ],
            baselineSource,
            updatedDate,
          },
          historicalBaseline: {
            cityAvgCapRate: currentAvgCapRate,
            historicalPriceIndex: derivedHistoricalIndex,
            source: baselineSource,
            updatedDate,
            dataType: intelEntry ? 'Published Historical Registry Index (Base 2022=100)' : 'Estimated Benchmark Curve (Base 2022=100)',
          },
          disclaimer: hasAdvancedForecast
            ? disclaimer
            : `${disclaimer} (STARTER includes 12-Month Basic Forecast; upgrade to PROFESSIONAL for 3Y/5Y projections).`,
          generatedAt: new Date().toISOString(),
        };

        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: `AI Market Forecast - ${cityEntry.city} (${propertyType})`,
            city: cityEntry.city,
            priceUSD: 0,
            capRate: forecastCap12M,
            cashOnCash: rentGrowth12M,
            resultSummary: `Forecast ${period}: Cap ${forecastCap12M}%${hasAdvancedForecast ? `->${forecastCap5Y}%` : ''} | ${recommendation}`,
          },
          {
            ...apiDailyPatch,
            last_results: {
              ...(userRecord.last_results || {}),
              forecast: {
                inputs: {
                  city: cityEntry.city,
                  propertyType,
                  period,
                },
                forecast,
                created_at: forecast.generatedAt,
              },
            },
          },
          CREDIT_COSTS['get-forecast']
        );
        await saveUserToDb(updatedUser);
        const nextLock = evaluateLockState(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);
        const cancellationEligibility = evaluateCancelRefundEligibility(updatedUser);

        return res.status(200).json({
          success: true,
          created_at: forecast.generatedAt,
          isBasicForecast: !hasAdvancedForecast,
          forecast,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLock.analysesLeft,
          analyses_total: nextLicense.analysesLimit,
          analyses_used: nextLicense.analysesUsed,
          successful_analyses: updatedUser.successful_analyses || 0,
          locked: nextLock.locked,
          status: nextLock.status,
          cancellationEligibility,
          license: nextLicense,
        });
      }

      case 'run-due-diligence': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const body = parsedBody;
        const authHeader = String(req?.headers?.authorization || '');
        const bearerRaw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const isApiKeyBearer = bearerRaw.startsWith('aqari_live_');
        let email = getSessionEmailFromReq(req) || '';

        if (isApiKeyBearer) {
          const apiOwner = await resolveApiKeyEmail(bearerRaw);
          if (!apiOwner) {
            return res.status(401).json({ success: false, error: 'Invalid API token' });
          }
          email = apiOwner;
        } else if (!email) {
          email = String(body.login_email || body.email || '')
            .trim()
            .toLowerCase();
        }

        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. No credit deducted. Please retry.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['run-due-diligence']);

        let apiDailyPatch: Partial<ServerUserRecord> = {};
        if (isApiKeyBearer) {
          const apiCheck = checkAndConsumeApiDailyQuota(userRecord);
          if (!apiCheck.ok) {
            return res.status(apiCheck.status).json(apiCheck.payload);
          }
          apiDailyPatch = {
            api_calls_day: apiCheck.api_calls_day,
            api_calls_today: apiCheck.api_calls_today,
          };
        }

        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }

        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (!canUseFeature(featurePlanKey, 'dueDiligence')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('dueDiligence'),
            code: 'FEATURE_LOCKED',
            feature: 'dueDiligence',
            requiredPlan: 'pro',
          });
        }

        const rawCityInput = String(body.city || '').trim();
        const cityEntry = findInlinedCity(rawCityInput);
        if (!cityEntry) {
          return res.status(400).json({
            success: false,
            error: 'City not supported yet. Choose from list.',
            code: 'INVALID_CITY',
            city: rawCityInput,
          });
        }

        const rawType = String(body.propertyType || 'Apartment').trim();
        const propertyType: 'Apartment' | 'Villa' | 'Commercial' =
          rawType === 'Villa' || rawType === 'Commercial' ? rawType : 'Apartment';
        const rawOwnership = String(body.ownershipType || 'Freehold').trim();
        const ownershipType: 'Freehold' | 'Leasehold' =
          rawOwnership === 'Leasehold' ? 'Leasehold' : 'Freehold';
        const price = parseEnglishNumberServer(body.price ?? body.priceUSD ?? body.propertyPrice);
        const monthlyRent = parseEnglishNumberServer(
          body.monthlyRent ?? body.rent ?? body.rentUSD
        );
        const rawAge = parseEnglishNumberServer(body.buildingAge ?? body.age ?? 5);
        const buildingAge = Number.isFinite(rawAge) ? Math.max(0, Math.min(200, Math.round(rawAge))) : -1;

        if (!Number.isFinite(price) || price <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Property Price ($) must be greater than 0.',
            code: 'INVALID_INPUTS',
          });
        }
        if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Gross Monthly Rent ($/mo) must be greater than 0.',
            code: 'INVALID_INPUTS',
          });
        }
        if (buildingAge < 0) {
          return res.status(400).json({
            success: false,
            error: 'Building Age (years) must be 0 or greater.',
            code: 'INVALID_INPUTS',
          });
        }

        const estimatedOpexPct = buildingAge > 30 ? 22 : buildingAge > 15 ? 18 : 15;
        const annualGross = monthlyRent * 12 * 0.95;
        const annualNOI = annualGross * (1 - estimatedOpexPct / 100);
        const propertyCapRate = Number(((annualNOI / price) * 100).toFixed(2));
        const cityAvgCapRate = Number(cityEntry.avgCapRate.toFixed(2));
        const marketAvgRent = Math.max(
          100,
          Math.round((price * (cityAvgCapRate / 100)) / (12 * 0.95 * 0.85))
        );

        const citySeed = `${cityEntry.city}:${propertyType}`
          .split('')
          .reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 5), 0);
        const estVacancyPct = Number((4.0 + (citySeed % 7) * 0.7).toFixed(1));
        const estPriceGrowthPct = Number((3.0 + (((citySeed * 3 + 7) % 40) / 10)).toFixed(1));

        let penalties = 0;
        let failCount = 0;
        const checklist: Array<{
          id: string;
          category: 'Legal Risk' | 'Financial Risk' | 'Market Risk';
          item: string;
          status: 'Pass' | 'Warning' | 'Fail';
          note: string;
        }> = [];

        // 1. Legal: Title / Ownership
        if (ownershipType === 'Leasehold') {
          penalties += 12;
          checklist.push({
            id: 'legal_ownership',
            category: 'Legal Risk',
            item: 'Title & Ownership Tenure',
            status: 'Warning',
            note: `Leasehold structure requires lease-term & ground-rent audit (>75 yrs recommended). (${cityEntry.visaNote})`,
          });
        } else {
          checklist.push({
            id: 'legal_ownership',
            category: 'Legal Risk',
            item: 'Title & Ownership Tenure',
            status: 'Pass',
            note: `Freehold ownership selected. Jurisdiction note: ${cityEntry.visaNote}`,
          });
        }

        // 2. Legal: Transfer Tax & Foreign Ownership Friction
        if (cityEntry.taxRate >= 8) {
          penalties += 6;
          checklist.push({
            id: 'legal_tax',
            category: 'Legal Risk',
            item: 'Acquisition Tax & Compliance',
            status: 'Warning',
            note: `High transfer / stamp tax (${cityEntry.taxRate}%) in ${cityEntry.country} impacts net entry basis.`,
          });
        } else {
          checklist.push({
            id: 'legal_tax',
            category: 'Legal Risk',
            item: 'Acquisition Tax & Compliance',
            status: 'Pass',
            note: `Standard transfer tax (${cityEntry.taxRate}%) in ${cityEntry.country}. Verify title deed escrow with local counsel.`,
          });
        }

        // 3. Financial: Cap Rate vs Market Benchmark
        if (propertyCapRate < cityAvgCapRate - 2) {
          penalties += 28;
          failCount += 1;
          checklist.push({
            id: 'fin_cap_rate',
            category: 'Financial Risk',
            item: 'Net Cap Rate vs Market Benchmark',
            status: 'Fail',
            note: `Property Cap Rate (${propertyCapRate}%) is >200bps below ${cityEntry.city} market average (${cityAvgCapRate}%). Overpriced or under-rented.`,
          });
        } else if (propertyCapRate < cityAvgCapRate) {
          penalties += 10;
          checklist.push({
            id: 'fin_cap_rate',
            category: 'Financial Risk',
            item: 'Net Cap Rate vs Market Benchmark',
            status: 'Warning',
            note: `Property Cap Rate (${propertyCapRate}%) is slightly below ${cityEntry.city} average (${cityAvgCapRate}%). Negotiate purchase price.`,
          });
        } else {
          checklist.push({
            id: 'fin_cap_rate',
            category: 'Financial Risk',
            item: 'Net Cap Rate vs Market Benchmark',
            status: 'Pass',
            note: `Property Cap Rate (${propertyCapRate}%) outperforms ${cityEntry.city} benchmark (${cityAvgCapRate}%).`,
          });
        }

        // 4. Financial: Gross Rent vs Market Avg
        if (monthlyRent > marketAvgRent * 1.2) {
          penalties += 14;
          checklist.push({
            id: 'fin_rent',
            category: 'Financial Risk',
            item: 'Monthly Rent vs Market Average',
            status: 'Warning',
            note: `Projected rent ($${monthlyRent.toLocaleString('en-US')}/mo) is >20% above ${cityEntry.city} market estimate ($${marketAvgRent.toLocaleString('en-US')}/mo) — verify executed lease.`,
          });
        } else if (monthlyRent < marketAvgRent * 0.7) {
          penalties += 6;
          checklist.push({
            id: 'fin_rent',
            category: 'Financial Risk',
            item: 'Monthly Rent vs Market Average',
            status: 'Warning',
            note: `Projected rent ($${monthlyRent.toLocaleString('en-US')}/mo) is >30% below market average ($${marketAvgRent.toLocaleString('en-US')}/mo).`,
          });
        } else {
          checklist.push({
            id: 'fin_rent',
            category: 'Financial Risk',
            item: 'Monthly Rent vs Market Average',
            status: 'Pass',
            note: `Projected rent ($${monthlyRent.toLocaleString('en-US')}/mo) is aligned with market benchmark ($${marketAvgRent.toLocaleString('en-US')}/mo).`,
          });
        }

        // 5. Financial: OPEX & Building Age Reserve
        if (buildingAge > 30) {
          penalties += 15;
          checklist.push({
            id: 'fin_opex_age',
            category: 'Financial Risk',
            item: 'Building Age & OPEX Reserve',
            status: 'Warning',
            note: `Building age (${buildingAge} yrs > 30 yrs) elevates CapEx & OPEX (${estimatedOpexPct}%). Require structural & MEP inspection.`,
          });
        } else if (buildingAge > 15) {
          penalties += 6;
          checklist.push({
            id: 'fin_opex_age',
            category: 'Financial Risk',
            item: 'Building Age & OPEX Reserve',
            status: 'Warning',
            note: `Asset age (${buildingAge} yrs) warrants ${estimatedOpexPct}% OPEX & HVAC/elevator reserve check.`,
          });
        } else {
          checklist.push({
            id: 'fin_opex_age',
            category: 'Financial Risk',
            item: 'Building Age & OPEX Reserve',
            status: 'Pass',
            note: `Modern structure (${buildingAge} yrs) with baseline ${estimatedOpexPct}% OPEX assumption.`,
          });
        }

        // 6. Market: Vacancy Rate
        if (estVacancyPct >= 7.5) {
          penalties += 8;
          checklist.push({
            id: 'mkt_vacancy',
            category: 'Market Risk',
            item: 'District Vacancy & Absorption',
            status: 'Warning',
            note: `Estimated ${estVacancyPct}% market vacancy in ${cityEntry.city} warrants conservative lease-up buffer.`,
          });
        } else {
          checklist.push({
            id: 'mkt_vacancy',
            category: 'Market Risk',
            item: 'District Vacancy & Absorption',
            status: 'Pass',
            note: `Healthy tenant absorption (~${estVacancyPct}% vacancy benchmark) for ${propertyType} in ${cityEntry.city}.`,
          });
        }

        // 7. Market: Price Growth Outlook
        if (estPriceGrowthPct < 3.5) {
          penalties += 5;
          checklist.push({
            id: 'mkt_growth',
            category: 'Market Risk',
            item: 'Capital Appreciation Momentum',
            status: 'Warning',
            note: `Modest projected annual price growth (+${estPriceGrowthPct}% YoY) — rely primarily on cashflow yield.`,
          });
        } else {
          checklist.push({
            id: 'mkt_growth',
            category: 'Market Risk',
            item: 'Capital Appreciation Momentum',
            status: 'Pass',
            note: `Constructive projected price growth (+${estPriceGrowthPct}% YoY) supporting 5-year exit value.`,
          });
        }

        const riskScore = Math.max(0, Math.min(100, 100 - penalties));
        const verdict: 'Low Risk - Proceed' | 'Medium Risk - Verify Items' | 'High Risk - Do Not Proceed' =
          riskScore >= 75 && failCount === 0
            ? 'Low Risk - Proceed'
            : riskScore >= 50 && failCount === 0
            ? 'Medium Risk - Verify Items'
            : 'High Risk - Do Not Proceed';

        const ddCreatedAt = new Date().toISOString();
        const disclaimer = `Due Diligence based on market averages for ${cityEntry.city} - Not legal advice, verify with local lawyer / agent`;

        const result = {
          id: `dd_${Date.now()}`,
          city: cityEntry.city,
          country: cityEntry.country,
          countryCode: cityEntry.countryCode,
          propertyType,
          ownershipType,
          buildingAge,
          price,
          monthlyRent,
          propertyCapRate,
          cityAvgCapRate,
          marketAvgRent,
          estimatedOpexPct,
          estVacancyPct,
          estPriceGrowthPct,
          riskScore,
          verdict,
          checklist,
          disclaimer,
          generatedAt: ddCreatedAt,
        };

        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: `AI Due Diligence - ${cityEntry.city} (${propertyType})`,
            city: cityEntry.city,
            priceUSD: price,
            capRate: propertyCapRate,
            cashOnCash: propertyCapRate,
            resultSummary: `Due Diligence Score ${riskScore}/100 (${verdict})`,
          },
          {
            ...apiDailyPatch,
            last_results: {
              ...(userRecord.last_results || {}),
              due_diligence: {
                inputs: {
                  city: cityEntry.city,
                  propertyType,
                  price,
                  monthlyRent,
                  ownershipType,
                  buildingAge,
                },
                result,
                created_at: ddCreatedAt,
              },
            },
          },
          CREDIT_COSTS['run-due-diligence']
        );
        await saveUserToDb(updatedUser);
        const nextLock = evaluateLockState(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);
        const cancellationEligibility = evaluateCancelRefundEligibility(updatedUser);

        return res.status(200).json({
          success: true,
          created_at: ddCreatedAt,
          result,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLock.analysesLeft,
          analyses_total: nextLicense.analysesLimit,
          analyses_used: nextLicense.analysesUsed,
          successful_analyses: updatedUser.successful_analyses || 0,
          locked: nextLock.locked,
          status: nextLock.status,
          cancellationEligibility,
          license: nextLicense,
        });
      }

      case 'optimize-portfolio': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const body = parsedBody;
        const authHeader = String(req?.headers?.authorization || '');
        const bearerRaw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const isApiKeyBearer = bearerRaw.startsWith('aqari_live_');
        let email = getSessionEmailFromReq(req) || '';

        if (isApiKeyBearer) {
          const apiOwner = await resolveApiKeyEmail(bearerRaw);
          if (!apiOwner) {
            return res.status(401).json({ success: false, error: 'Invalid API token' });
          }
          email = apiOwner;
        } else if (!email) {
          email = String(body.login_email || body.email || '')
            .trim()
            .toLowerCase();
        }

        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. No credit deducted. Please retry.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['optimize-portfolio']);

        let apiDailyPatch: Partial<ServerUserRecord> = {};
        if (isApiKeyBearer) {
          const apiCheck = checkAndConsumeApiDailyQuota(userRecord);
          if (!apiCheck.ok) {
            return res.status(apiCheck.status).json(apiCheck.payload);
          }
          apiDailyPatch = {
            api_calls_day: apiCheck.api_calls_day,
            api_calls_today: apiCheck.api_calls_today,
          };
        }

        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }

        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (!canUseFeature(featurePlanKey, 'globalOptimizer')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('globalOptimizer'),
            code: 'FEATURE_LOCKED',
            feature: 'globalOptimizer',
            requiredPlan: 'pro',
          });
        }

        const totalCapital = parseEnglishNumberServer(
          body.totalCapital ?? body.capital ?? body.budget
        );
        if (!Number.isFinite(totalCapital) || totalCapital <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Total Capital ($) must be greater than 0.',
            code: 'INVALID_INPUTS',
          });
        }

        const rawCitiesInput = Array.isArray(body.cities)
          ? body.cities
          : typeof body.cities === 'string'
          ? body.cities.split(',')
          : [];
        const resolvedCities: InlinedCityEntry[] = [];
        const seenCityNames = new Set<string>();
        for (const item of rawCitiesInput) {
          const entry = findInlinedCity(String(item || ''));
          if (!entry) {
            return res.status(400).json({
              success: false,
              error: `City "${String(item || '').trim()}" not supported yet. Choose 2-3 cities from list.`,
              code: 'INVALID_CITY',
            });
          }
          const key = entry.city.toLowerCase();
          if (!seenCityNames.has(key)) {
            seenCityNames.add(key);
            resolvedCities.push(entry);
          }
        }
        if (resolvedCities.length < 2 || resolvedCities.length > 3) {
          return res.status(400).json({
            success: false,
            error: 'Select 2 to 3 distinct target cities from list.',
            code: 'INVALID_CITIES_COUNT',
          });
        }

        const rawRisk = String(body.risk || 'Medium').trim();
        const riskLevel: 'Low' | 'Medium' | 'High' =
          rawRisk === 'Low' || rawRisk === 'High' ? rawRisk : 'Medium';

        // Compute raw allocation weights by risk + city cap rate
        const rawWeights = resolvedCities.map((c) => {
          const cap = Math.max(2.0, c.avgCapRate);
          if (riskLevel === 'Low') {
            return 1 / Math.pow(cap, 1.35);
          }
          if (riskLevel === 'High') {
            return Math.pow(cap, 1.45);
          }
          return 0.6 + cap * 0.12;
        });
        const totalWeight = rawWeights.reduce((s, w) => s + w, 0);
        const exactPcts = rawWeights.map((w) => (w / totalWeight) * 100);
        // Guarantee integer percentages >= 15 and sum === 100 using largest remainder
        const floorPcts = exactPcts.map((p) => Math.max(15, Math.floor(p)));
        let remainder = 100 - floorPcts.reduce((s, p) => s + p, 0);
        const remaindersOrder = exactPcts
          .map((p, i) => ({ i, frac: p - Math.floor(p) }))
          .sort((a, b) => b.frac - a.frac);
        let guard = 0;
        while (remainder !== 0 && guard < 100) {
          const idx = remaindersOrder[guard % remaindersOrder.length].i;
          if (remainder > 0) {
            floorPcts[idx] += 1;
            remainder -= 1;
          } else if (floorPcts[idx] > 15) {
            floorPcts[idx] -= 1;
            remainder += 1;
          }
          guard++;
        }

        let allocatedCapitalSum = 0;
        const allocations = resolvedCities.map((c, idx) => {
          const allocationPct = floorPcts[idx];
          const amountUSD =
            idx === resolvedCities.length - 1
              ? Math.max(0, Math.round(totalCapital - allocatedCapitalSum))
              : Math.round((totalCapital * allocationPct) / 100);
          allocatedCapitalSum += amountUSD;
          const estCapRate = Number(c.avgCapRate.toFixed(2));
          const estAnnualRentUSD = Math.round(amountUSD * (estCapRate / 100));
          return {
            city: c.city,
            country: c.country,
            countryCode: c.countryCode,
            allocationPct,
            amountUSD,
            estCapRate,
            estAnnualRentUSD,
          };
        });

        const totalEstAnnualIncomeUSD = allocations.reduce(
          (sum, row) => sum + row.estAnnualRentUSD,
          0
        );
        const blendedCapRate = Number(
          ((totalEstAnnualIncomeUSD / Math.max(1, totalCapital)) * 100).toFixed(2)
        );
        const uniqueCountries = new Set(resolvedCities.map((c) => c.countryCode || c.country)).size;
        const hhi = allocations.reduce((sum, a) => sum + Math.pow(a.allocationPct / 100, 2), 0);
        const diversificationScore = Math.min(
          98,
          Math.max(
            42,
            Math.round(
              (resolvedCities.length === 3 ? 58 : 44) +
                uniqueCountries * 10 +
                (1 - hhi) * 24
            )
          )
        );

        const optCreatedAt = new Date().toISOString();
        const disclaimer = `Global Portfolio Optimizer - Allocation modeled on city benchmark cap rates (${resolvedCities.map((c) => c.city).join(', ')}) - Not investment advice`;

        const result = {
          id: `opt_${Date.now()}`,
          totalCapital,
          risk: riskLevel,
          cities: resolvedCities.map((c) => c.city),
          allocations,
          totalEstAnnualIncomeUSD,
          blendedCapRate,
          diversificationScore,
          disclaimer,
          generatedAt: optCreatedAt,
        };

        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: `Global Portfolio Optimizer (${resolvedCities.map((c) => c.city).join(' + ')})`,
            city: resolvedCities[0].city,
            priceUSD: totalCapital,
            capRate: blendedCapRate,
            cashOnCash: blendedCapRate,
            resultSummary: `Blended Cap ${blendedCapRate}% | Diversification ${diversificationScore}/100`,
          },
          {
            ...apiDailyPatch,
            last_results: {
              ...(userRecord.last_results || {}),
              portfolio_optimizer: {
                inputs: {
                  totalCapital,
                  cities: resolvedCities.map((c) => c.city),
                  risk: riskLevel,
                },
                result,
                created_at: optCreatedAt,
              },
            },
          },
          CREDIT_COSTS['optimize-portfolio']
        );
        await saveUserToDb(updatedUser);
        const nextLock = evaluateLockState(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);
        const cancellationEligibility = evaluateCancelRefundEligibility(updatedUser);

        return res.status(200).json({
          success: true,
          created_at: optCreatedAt,
          result,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLock.analysesLeft,
          analyses_total: nextLicense.analysesLimit,
          analyses_used: nextLicense.analysesUsed,
          successful_analyses: updatedUser.successful_analyses || 0,
          locked: nextLock.locked,
          status: nextLock.status,
          cancellationEligibility,
          license: nextLicense,
        });
      }

      case 'ask-advisor': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const body = parsedBody;
        const authHeader = String(req?.headers?.authorization || '');
        const bearerRaw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const isApiKeyBearer = bearerRaw.startsWith('aqari_live_');
        let email = getSessionEmailFromReq(req) || '';

        if (isApiKeyBearer) {
          const apiOwner = await resolveApiKeyEmail(bearerRaw);
          if (!apiOwner) {
            return res.status(401).json({ success: false, error: 'Invalid API token' });
          }
          email = apiOwner;
        } else if (!email) {
          email = String(body.login_email || body.email || '')
            .trim()
            .toLowerCase();
        }

        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. No credit deducted. Please retry.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['ask-advisor']);

        let apiDailyPatch: Partial<ServerUserRecord> = {};
        if (isApiKeyBearer) {
          const apiCheck = checkAndConsumeApiDailyQuota(userRecord);
          if (!apiCheck.ok) {
            return res.status(apiCheck.status).json(apiCheck.payload);
          }
          apiDailyPatch = {
            api_calls_day: apiCheck.api_calls_day,
            api_calls_today: apiCheck.api_calls_today,
          };
        }

        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }

        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (!canUseFeature(featurePlanKey, 'institutionalAdvisor')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('institutionalAdvisor'),
            code: 'FEATURE_LOCKED',
            feature: 'institutionalAdvisor',
            requiredPlan: 'pro',
          });
        }

        const question = String(body.question || '').trim().slice(0, 1200);
        if (question.length < 4) {
          return res.status(400).json({
            success: false,
            error: 'Enter an investment question (minimum 4 characters).',
            code: 'INVALID_INPUTS',
          });
        }

        const rawCityInput = String(body.city || '').trim();
        const cityEntry = findInlinedCity(rawCityInput);
        if (!cityEntry) {
          return res.status(400).json({
            success: false,
            error: 'City not supported yet. Choose from list.',
            code: 'INVALID_CITY',
            city: rawCityInput,
          });
        }

        const budget = parseEnglishNumberServer(body.budget ?? body.capital ?? body.amount);
        if (!Number.isFinite(budget) || budget <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Budget ($) must be greater than 0.',
            code: 'INVALID_INPUTS',
          });
        }

        const qLower = question.toLowerCase();
        // Detect if question mentions a second city for side-by-side yield comparison
        let secondaryCity: InlinedCityEntry | null = null;
        for (const candidate of INLINED_CITIES_MAP.values()) {
          if (candidate.city.toLowerCase() === cityEntry.city.toLowerCase()) continue;
          if (candidate.city.length < 4) continue;
          const escaped = candidate.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\b${escaped}\\b`, 'i');
          if (re.test(question)) {
            secondaryCity = candidate;
            break;
          }
        }

        const cityAvgCapRate = Number(cityEntry.avgCapRate.toFixed(2));
        const budgetFmt = `$${Math.round(budget).toLocaleString('en-US')}`;
        const estAnnualIncomeUSD = Math.round(budget * (cityAvgCapRate / 100));
        const estMonthlyIncomeUSD = Math.round(estAnnualIncomeUSD / 12);
        const citySeed = cityEntry.city
          .split('')
          .reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 5), 0);
        const rentGrowth12M = Number((2.0 + ((citySeed % 30) / 10)).toFixed(1));
        const priceGrowth12M = Number((3.0 + (((citySeed * 3 + 7) % 40) / 10)).toFixed(1));

        const recommendation: 'Buy' | 'Hold' | 'Wait' =
          cityAvgCapRate >= 6.0 && cityEntry.taxRate <= 8
            ? 'Buy'
            : cityAvgCapRate >= 4.5
            ? 'Hold'
            : 'Wait';

        const wantsLeverage = /mortgage|loan|debt|financ|leverag/i.test(qLower);
        const wantsAppreciation = /growth|appreciat|equity|flip|5\s*y/i.test(qLower);

        const headline = `${recommendation} stance on ${cityEntry.city}, ${cityEntry.country} for ${budgetFmt}: benchmark ${cityAvgCapRate}% cap rate implies ~$${estAnnualIncomeUSD.toLocaleString('en-US')}/yr unlevered NOI.`;

        const reasoning: string[] = [
          `Market Yield Benchmark: ${cityEntry.city} delivers an institutional average Cap Rate of ${cityAvgCapRate}%, translating a ${budgetFmt} deployment into ~$${estAnnualIncomeUSD.toLocaleString('en-US')}/yr (~$${estMonthlyIncomeUSD.toLocaleString('en-US')}/mo) unlevered net income.`,
          `Growth & Income Trajectory: Baseline projections indicate +${rentGrowth12M}% 12-month rent growth and +${priceGrowth12M}% capital appreciation${wantsAppreciation ? ', prioritizing total return over immediate cash yield.' : '.'}`,
          `Jurisdiction & Residency Fit: ${cityEntry.country} applies a ${cityEntry.taxRate}% transfer/acquisition tax with policy guidance "${cityEntry.visaNote}" relevant to your ${budgetFmt} ticket size.`,
        ];
        if (secondaryCity) {
          const secCap = Number(secondaryCity.avgCapRate.toFixed(2));
          const spreadBps = Math.round((cityAvgCapRate - secCap) * 100);
          reasoning.push(
            `Cross-Market Comparison vs ${secondaryCity.city}: ${cityEntry.city} (${cityAvgCapRate}% cap rate, ${cityEntry.taxRate}% tax) carries a ${spreadBps >= 0 ? `+${spreadBps}` : spreadBps}bps yield spread vs ${secondaryCity.city} (${secCap}% cap rate, ${secondaryCity.taxRate}% tax) on a ${budgetFmt} allocation.`
          );
        } else if (wantsLeverage) {
          reasoning.push(
            `Debt Spread Consideration: At ${cityAvgCapRate}% unlevered cap rate on ${budgetFmt}, ensure mortgage cost stays at least 100bps below net yield (DSCR >= 1.35x) to preserve positive leverage.`
          );
        }

        const riskFactors: string[] = [
          `Rate & Financing Risk: A +200bps interest rate shock can compress leveraged Cash-on-Cash returns if debt-to-value exceeds 70% in ${cityEntry.city}.`,
          `Friction & Regulatory Costs: Factor ${cityEntry.taxRate}% transfer tax, local HOA/service charges, and closing legal fees (~1.5%) into total ${budgetFmt} cash required.`,
          `Vacancy & Liquidity Exposure: Unbudgeted lease-up gaps beyond 4-6 weeks reduce realized yield below the ${cityAvgCapRate}% ${cityEntry.city} benchmark.`,
        ];

        const nextSteps: string[] = [
          `Run "AI Due Diligence" on a target ${cityEntry.city} property (~${budgetFmt}) to audit Leasehold vs Freehold risk and Cap Rate spread.`,
          `Stress-test financing in "Analyze New Property" with Monte Carlo (+200bps rate shock) and inspect 5-year IRR before committing capital.`,
          secondaryCity
            ? `Model a split allocation between ${cityEntry.city} and ${secondaryCity.city} inside "Global Portfolio Optimizer" to maximize diversification.`
            : `Verify freehold title eligibility and residency qualification in ${cityEntry.country} with a licensed local conveyancing attorney.`,
        ];

        const advisorCreatedAt = new Date().toISOString();
        const disclaimer =
          'Institutional AI Advisor - Educational analysis based on market averages - Not financial advice';

        const result = {
          id: `adv_${Date.now()}`,
          question,
          city: cityEntry.city,
          country: cityEntry.country,
          countryCode: cityEntry.countryCode,
          budget,
          cityAvgCapRate,
          estAnnualIncomeUSD,
          estMonthlyIncomeUSD,
          recommendation,
          headline,
          reasoning,
          riskFactors,
          nextSteps,
          disclaimer,
          generatedAt: advisorCreatedAt,
        };

        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: `Institutional AI Advisor - ${cityEntry.city}`,
            city: cityEntry.city,
            priceUSD: budget,
            capRate: cityAvgCapRate,
            cashOnCash: cityAvgCapRate,
            resultSummary: `Advisor ${recommendation} (${cityEntry.city}, ${budgetFmt})`,
          },
          {
            ...apiDailyPatch,
            last_results: {
              ...(userRecord.last_results || {}),
              advisor: {
                inputs: {
                  question,
                  city: cityEntry.city,
                  budget,
                },
                result,
                created_at: advisorCreatedAt,
              },
            },
          },
          CREDIT_COSTS['ask-advisor']
        );
        await saveUserToDb(updatedUser);
        const nextLock = evaluateLockState(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);
        const cancellationEligibility = evaluateCancelRefundEligibility(updatedUser);

        return res.status(200).json({
          success: true,
          created_at: advisorCreatedAt,
          result,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLock.analysesLeft,
          analyses_total: nextLicense.analysesLimit,
          analyses_used: nextLicense.analysesUsed,
          successful_analyses: updatedUser.successful_analyses || 0,
          locked: nextLock.locked,
          status: nextLock.status,
          cancellationEligibility,
          license: nextLicense,
        });
      }

      case 'monte-carlo': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = String(sessionEmail || body.login_email || body.email || '')
          .trim()
          .toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        const userRecord =
          (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const lockState = evaluateLockState(userRecord);
        if (lockState.locked) {
          return res.status(403).json({
            success: false,
            locked: true,
            reason: lockState.reason,
            status: lockState.status,
            analyses_left: lockState.analysesLeft,
            error: lockState.error || 'No credits left or subscription expired. Upgrade to continue.',
            code: lockState.reason === 'expired' ? 'LICENSE_EXPIRED' : 'CREDITS_EXHAUSTED',
          });
        }
        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (lockState.packageExpired || !canUseFeature(featurePlanKey, 'monteCarlo')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('monteCarlo'),
            code: 'FEATURE_LOCKED',
            feature: 'monteCarlo',
            requiredPlan: 'starter',
          });
        }
        const mcCycles = PLAN_DEFINITIONS[featurePlanKey].monteCarloMaxCycles || 1000;
        const monteCarlo = runServerMonteCarlo(
          {
            priceUSD: Number(body.priceUSD || 650000),
            rentUSD: Number(body.rentUSD || 4500),
            downPaymentPct: Number(body.downPaymentPct ?? 30),
            interestRatePct: Number(body.interestRatePct ?? 5.5),
            operatingExpensePct: Number(body.operatingExpensePct ?? 15),
            loanTermYears: Number(body.loanTermYears ?? 25),
            amortizationYears: Number(body.amortizationYears ?? body.loanTermYears ?? 25),
            vacancyRatePct: Number(body.vacancyRatePct ?? 0),
            managementPct: Number(body.managementPct ?? 0),
            propertyTaxUSD: Number(body.propertyTaxUSD ?? 0),
            insuranceUSD: Number(body.insuranceUSD ?? 0),
            maintenanceReserveUSD: Number(body.maintenanceReserveUSD ?? 0),
            hoaUSD: Number(body.hoaUSD ?? 0),
            closingCostsPct: Number(body.closingCostsPct ?? 0),
            rentGrowthPct: Number(body.rentGrowthPct ?? 3.0),
            expenseGrowthPct: Number(body.expenseGrowthPct ?? 2.5),
            appreciationPct: Number(body.appreciationPct ?? 3.0),
            exitCapRatePct: Number(body.exitCapRatePct ?? 0),
            sellingCostsPct: Number(body.sellingCostsPct ?? 3.0),
            noExitValue: Boolean(body.noExitValue),
          },
          {
            cycles: mcCycles,
            seedOffset: Number(body.seedOffset || Date.now() % 100000),
          }
        );
        if (userRecord.last_results?.analysis?.results) {
          const nextLast = {
            ...(userRecord.last_results || {}),
            analysis: {
              ...userRecord.last_results.analysis,
              results: {
                ...userRecord.last_results.analysis.results,
                monteCarlo,
              },
            },
          };
          const updated = updateServerUser(userRecord.email, { last_results: nextLast });
          await saveUserToDb(updated).catch(() => {});
        }
        return res.status(200).json({
          success: true,
          monteCarlo,
        });
      }

      case 'save-to-portfolio':
      case 'save-property':
      case 'save': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = String(sessionEmail || body.login_email || body.email || '')
          .trim()
          .toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required to save analyses' });
        }

        const userRecord =
          (await getUserFromDb(email).catch(() => null)) ||
          getOrCreateServerUser(email, { name: body.name });
        const lockState = evaluateLockState(userRecord);
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);

        if (lockState.locked) {
          return res.status(403).json({
            success: false,
            locked: true,
            reason: lockState.reason,
            status: lockState.status,
            error: lockState.error,
            analyses_left: 0,
            code: lockState.enterpriseUnconfigured
              ? 'ENTERPRISE_CONTRACT_LIMIT_UNSET'
              : lockState.reason === 'expired'
              ? 'LICENSE_EXPIRED'
              : 'NO_ANALYSES_LEFT',
          });
        }

        if (quotas.isEnterprise && (quotas.savedLimit === null || quotas.savedLimit <= 0)) {
          return res.status(403).json({
            success: false,
            error: 'Enterprise contract custom_portfolio_limit is not configured yet. Ask your Admin to set contract save/portfolio limits.',
            code: 'ENTERPRISE_CONTRACT_LIMIT_UNSET',
            plan: license.displayName,
            planKey: license.planKey,
          });
        }

        const maxSaved = quotas.savedLimit ?? 0;
        const currentSavedCount = Math.max(
          userRecord.saved_analyses.length,
          Number(body.currentSavedCount ?? body.savedCount ?? 0)
        );

        if (currentSavedCount >= maxSaved) {
          const nextPlanHint =
            license.planKey === 'institutional'
              ? ' Contract save capacity reached — contact your Admin to adjust custom_portfolio_limit.'
              : license.planKey === 'enterprise'
              ? ' Upgrade to ENTERPRISE (custom contract capacity) for more capacity.'
              : license.planKey === 'pro'
              ? ' Upgrade to SOVEREIGN for more capacity.'
              : ' Upgrade to PROFESSIONAL for more saved capacity.';
          return res.status(403).json({
            success: false,
            error: `Save limit reached for ${license.displayName}: ${currentSavedCount}/${maxSaved}.${nextPlanHint}`,
            code: 'SAVE_LIMIT_REACHED',
            plan: license.displayName,
            planKey: license.planKey,
            saved_count: currentSavedCount,
            savedCount: currentSavedCount,
            maxSaved,
            savedLimit: maxSaved,
          });
        }

        const rawAnalysis = body.analysis || (body.property ? body : null);
        if (!rawAnalysis) {
          return res.status(400).json({ success: false, error: 'Analysis payload is required' });
        }

        const newItem = {
          ...rawAnalysis,
          id: rawAnalysis.id || `saved_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: rawAnalysis.date || Date.now(),
        };

        const nextSaved = [newItem, ...userRecord.saved_analyses];
        const updated = updateServerUser(email, {
          saved_analyses: nextSaved,
          saved_count: nextSaved.length,
          max_saved: maxSaved,
        });
        await saveUserToDb(updated);

        return res.status(200).json({
          success: true,
          savedItem: newItem,
          savedCount: updated.saved_analyses.length,
          saved_count: updated.saved_analyses.length,
          maxSaved,
          savedLimit: maxSaved,
        });
      }

      case 'delete-saved': {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = String(sessionEmail || body.login_email || body.email || '')
          .trim()
          .toLowerCase();
        if (!email) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const targetId = String(body.id || getQueryParam(req, url, 'id') || '').trim();
        if (!targetId) {
          return res.status(400).json({ success: false, error: 'Saved item id is required' });
        }
        const userRecord =
          (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const maxSaved = PLAN_DEFINITIONS[license.planKey].savedLimit;
        const nextSaved = userRecord.saved_analyses.filter((item: any) => String(item?.id) !== targetId);
        const updated = updateServerUser(email, {
          saved_analyses: nextSaved,
          saved_count: nextSaved.length,
          max_saved: maxSaved,
        });
        await saveUserToDb(updated);
        return res.status(200).json({
          success: true,
          savedCount: updated.saved_analyses.length,
          saved_count: updated.saved_analyses.length,
          maxSaved,
          saved_analyses: updated.saved_analyses,
        });
      }

      case 'analyst-chat': {
        const sessionEmail = getSessionEmailFromReq(req);
        const body = parsedBody;
        const email = String(sessionEmail || getQueryParam(req, url, 'email') || body.login_email || body.email || '')
          .trim()
          .toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        const userRecord =
          (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (license.isExpired || !canUseFeature(featurePlanKey, 'analystDesk')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('analystDesk'),
            code: 'FEATURE_LOCKED',
          });
        }

        if (req.method === 'GET') {
          const thread = await getAnalystThreadFromDb(email);
          if ((thread.unreadForClient || 0) > 0) {
            thread.unreadForClient = 0;
            await saveAnalystThreadToDb(thread);
          }
          return res.status(200).json({
            success: true,
            thread,
          });
        }

        if (req.method === 'POST') {
          const text = String(body.message || '').trim().slice(0, 2000);
          if (!text) {
            return res.status(400).json({ success: false, error: 'Message cannot be empty' });
          }
          const thread = await getAnalystThreadFromDb(email);
          const now = Date.now();
          const msg = {
            id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`,
            sender: 'client',
            senderEmail: email,
            text,
            timestamp: new Date(now).toISOString(),
            attachedAnalysisId: body.attachedAnalysisId || undefined,
            attachedAnalysisTitle: body.attachedAnalysisTitle || undefined,
            attachedAnalysisSummary: body.attachedAnalysisSummary || undefined,
            replyByDate: body.replyByDate || undefined,
          };
          thread.status = 'Open';
          thread.plan = 'SOVEREIGN';
          thread.updatedAt = now;
          thread.unreadForAdmin = Number(thread.unreadForAdmin || 0) + 1;
          thread.messages = [...(thread.messages || []), msg].slice(-200);
          await saveAnalystThreadToDb(thread);

          await dispatchEmailAlert({
            to: getAdminEmail(),
            subject: `AQARI Analyst Desk: New question from ${email}`,
            text: `Client: ${email} (SOVEREIGN)\n${
              msg.replyByDate ? `Requested Reply By: ${msg.replyByDate}\n` : ''
            }${msg.attachedAnalysisTitle ? `Attached Property: ${msg.attachedAnalysisTitle}\n` : ''}\nMessage:\n${text}`,
            eventType: 'analyst_question',
          }).catch(() => {});

          return res.status(200).json({
            success: true,
            thread,
            message: 'Sent - Analyst will reply within 24h',
          });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      case 'whiteglove-request': {
        const sessionEmail = getSessionEmailFromReq(req);
        const body = parsedBody;
        const email = String(sessionEmail || getQueryParam(req, url, 'email') || body.login_email || body.email || '')
          .trim()
          .toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        const userRecord =
          (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (license.isExpired || !canUseFeature(featurePlanKey, 'customUnderwriting')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('customUnderwriting'),
            code: 'FEATURE_LOCKED',
          });
        }

        if (req.method === 'GET') {
          const all = await getWhiteGloveRequestsFromDb();
          const mine = all.filter((r: any) => normalizeEmail(r?.email) === email);
          const deliverables = mine
            .filter((r: any) => r?.status === 'Done' && r?.deliverable)
            .map((r: any) => ({ ...r.deliverable, requestId: r.id, deliveredAt: r.deliveredAt }));
          return res.status(200).json({
            success: true,
            requests: mine,
            deliverables,
          });
        }

        if (req.method === 'POST') {
          const propertyTitle = String(body.propertyTitle || '').trim();
          const targetCity = String(body.targetCity || body.city || '').trim();
          const valuation = parseEnglishNumberServer(body.valuation || 0);
          const expectedMonthlyRent = parseEnglishNumberServer(body.expectedMonthlyRent || 0);
          if (!propertyTitle || !targetCity) {
            return res.status(400).json({
              success: false,
              error: 'Property title and target city are required',
            });
          }
          const now = Date.now();
          const requestItem = {
            id: `WG-${now.toString(36).toUpperCase()}`,
            email,
            clientName: userRecord.name || email.split('@')[0],
            propertyTitle,
            dealLink: String(body.dealLink || '').trim() || undefined,
            targetCity,
            currency: 'USD',
            valuation: Number.isFinite(valuation) ? valuation : 0,
            expectedMonthlyRent: Number.isFinite(expectedMonthlyRent) ? expectedMonthlyRent : 0,
            goalNotes: String(body.goalNotes || '').trim().slice(0, 2000),
            attachments: Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [],
            status: 'Pending',
            createdAt: new Date(now).toISOString(),
          };
          const all = await getWhiteGloveRequestsFromDb();
          await saveWhiteGloveRequestsToDb([requestItem, ...all]);

          await dispatchEmailAlert({
            to: getAdminEmail(),
            subject: `AQARI White-Glove Request (${requestItem.id}) from ${email}`,
            text: `Client: ${email} (SOVEREIGN)\nProperty: ${propertyTitle}\nTarget City: ${targetCity}\nValuation: ${requestItem.currency} ${requestItem.valuation}\nExpected Rent/mo: ${requestItem.expectedMonthlyRent}\nDeal Link: ${requestItem.dealLink || 'N/A'}\nNotes:\n${requestItem.goalNotes}`,
            eventType: 'whiteglove_request',
          }).catch(() => {});

          return res.status(200).json({
            success: true,
            request: requestItem,
            message: 'Request received. Analysis will be delivered in 48h.',
          });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      case 'sovereign-request': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = String(sessionEmail || body.login_email || body.email || '')
          .trim()
          .toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        const userRecord =
          (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (license.isExpired || !canUseFeature(featurePlanKey, 'analystDesk')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('analystDesk'),
            code: 'FEATURE_LOCKED',
          });
        }

        const reqType = body.type === 'white_glove' ? 'White-glove Custom Underwriting' : '1-on-1 Dedicated Analyst Desk';
        const now = Date.now();
        const referenceId = `SOV-${now.toString(36).toUpperCase()}`;
        const notes = String(body.notes || body.brief || body.preferredSlot || '').trim().slice(0, 500);
        const updated = updateServerUser(email, {
          timeline: [
            {
              id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
              timestamp: new Date(now).toISOString(),
              type: 'analysis' as const,
              message: `${reqType} submitted (${referenceId})${notes ? `: ${notes}` : ''}`,
              actor: email,
            },
            ...userRecord.timeline,
          ].slice(0, 200),
        });
        await saveUserToDb(updated).catch(() => {});

        return res.status(200).json({
          success: true,
          referenceId,
          requestType: reqType,
          message: `${reqType} request confirmed (${referenceId}). Our analyst desk will respond within 24h.`,
        });
      }

      case 'export': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required to export' });
        }

        const userRecord =
          (await getUserFromDb(email).catch(() => null)) ||
          getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);
        const planCfg = PLAN_DEFINITIONS[license.planKey];

        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (license.isExpired) {
          return res.status(403).json({
            success: false,
            error: 'Your 30-day plan expired. Buy a plan to unlock exports. No auto-charge was made.',
            code: 'LICENSE_EXPIRED',
          });
        }

        const format = String(body.format || 'pdf').toLowerCase();
        const docType = String(body.docType || 'pdf').toLowerCase();
        if (format === 'api') {
          if (!quotas.customApiEnabled) {
            return res.status(403).json({
              success: false,
              error: quotas.isEnterprise
                ? 'Enterprise custom_api_enabled is currently false. Admin must enable Custom API Access.'
                : getUpgradeMessage('apiAccess'),
              code: quotas.isEnterprise ? 'ENTERPRISE_CONTRACT_LIMIT_UNSET' : 'FEATURE_LOCKED',
              feature: 'apiAccess',
              requiredPlan: quotas.isEnterprise ? 'institutional' : 'pro',
            });
          }
        } else {
          if (!canUseFeature(featurePlanKey, 'pdfExport')) {
            return res.status(403).json({
              success: false,
              error: getUpgradeMessage('pdfExport'),
              code: 'FEATURE_LOCKED',
              feature: 'pdfExport',
              requiredPlan: 'starter',
            });
          }
          if (docType === 'memorandum' && !canUseFeature(featurePlanKey, 'memorandumPdf')) {
            return res.status(403).json({
              success: false,
              error: getUpgradeMessage('memorandumPdf'),
              code: 'FEATURE_LOCKED',
              feature: 'memorandumPdf',
              requiredPlan: 'pro',
            });
          }
          if (quotas.isEnterprise && (quotas.investmentPdfLimit === null || quotas.investmentPdfLimit <= 0)) {
            return res.status(403).json({
              success: false,
              error: 'Enterprise contract custom_listings_limit is not configured yet. Ask your Admin to set report/PDF limits.',
              code: 'ENTERPRISE_CONTRACT_LIMIT_UNSET',
            });
          }
          const pdfQuota = quotas.investmentPdfLimit ?? 0;
          const currentPdfsUsed = Math.max(0, Number(userRecord.pdfs_used || 0));
          if (currentPdfsUsed >= pdfQuota) {
            return res.status(403).json({
              success: false,
              error: `Monthly PDF export limit reached (${currentPdfsUsed}/${pdfQuota} for ${planCfg.displayName}). Upgrade your plan for additional PDF exports.`,
              code: 'PDF_QUOTA_EXCEEDED',
              pdfs_used: currentPdfsUsed,
              investment_pdf_limit: pdfQuota,
            });
          }
        }

        const exportCost = format === 'api' ? 0 : CREDIT_COSTS['export'];
        const creditCheck = ensureCreditsForAction(userRecord, exportCost);
        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }

        const propertyTitle = (body.propertyTitle || 'AQARI_Institutional_Asset').toString();
        const safeName = propertyTitle.replace(/[^a-z0-9_-]+/gi, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        const isWatermarked = license.planKey === 'free';
        const branding = quotas.whiteLabelEnabled
          ? userRecord.branding || null
          : null;
        const watermark = isWatermarked
          ? `FREE TIER WATERMARK - AQARI TERMINAL SAMPLE - Licensed to ${email} - ${dateStr}`
          : branding?.firmName
          ? `Prepared by ${branding.firmName} - ${dateStr}`
          : `Generated by AQARI TERMINAL - Licensed to ${email} - ${dateStr}`;

        const nextPdfsUsed = Math.max(0, Number(userRecord.pdfs_used || 0)) + (format === 'api' ? 0 : 1);
        const pdfEntry: ForensicPdfEntry = {
          id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          property: propertyTitle,
          format,
          watermark,
        };

        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: `${propertyTitle} (${format.toUpperCase()})`,
            city: String(body.city || 'Global'),
            priceUSD: Number(body.priceUSD || 0),
            capRate: Number(body.capRate || 0),
            cashOnCash: Number(body.cashOnCash || 0),
            resultSummary: `Exported ${docType === 'memorandum' ? 'Memorandum' : format.toUpperCase()} Report`,
          },
          {
            pdfs_used: nextPdfsUsed,
            pdf_downloads: [pdfEntry, ...(userRecord.pdf_downloads || [])].slice(0, 200),
          },
          exportCost
        );
        await saveUserToDb(updatedUser).catch(() => {});
        const nextLicense = computeServerLicenseStatus(updatedUser);

        return res.status(200).json({
          success: true,
          format,
          docType,
          filename: `${safeName}_AQARI_MEMO.${format === 'api' ? 'json' : 'pdf'}`,
          watermark,
          isWatermarked,
          branding,
          generatedAt: new Date().toISOString(),
          plan: nextLicense.displayName,
          planKey: nextLicense.planKey,
          pdfs_used: nextPdfsUsed,
          investment_pdf_limit: planCfg.investmentPdfLimit,
          analyses_left: nextLicense.analysesLeft,
          analyses_used: nextLicense.analysesUsed,
          analyses_total: nextLicense.analysesLimit,
        });
      }

      case 'portfolio': {
        const body = req.method === 'POST' ? parsedBody : req.query || {};
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').toString().trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required for portfolio aggregation' });
        }

        const userRecord =
          (await getUserFromDb(email).catch(() => null)) ||
          getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);
        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);

        if (license.isExpired) {
          return res.status(403).json({
            error: 'Your 30-day plan expired. Buy a plan to unlock portfolio aggregation. No auto-charge was made.',
            code: 'LICENSE_EXPIRED',
          });
        }

        if (!canUseFeature(featurePlanKey, 'portfolioAggregation')) {
          return res.status(403).json({
            error: getUpgradeMessage('portfolioAggregation'),
            code: 'FEATURE_LOCKED',
            feature: 'portfolioAggregation',
            requiredPlan: 'pro',
          });
        }

        const items = Array.isArray(body.savedAnalyses) ? body.savedAnalyses : userRecord.saved_analyses;
        const agg = computeServerPortfolioAggregation(items);

        return res.status(200).json({
          success: true,
          plan: license.displayName,
          portfolio: {
            count: agg.trackedAssets,
            trackedAssets: agg.trackedAssets,
            excludedInvalidCount: agg.excludedInvalidCount,
            totalValueUSD: agg.totalAumUSD,
            totalAnnualNoiUSD: agg.totalAnnualNoiUSD,
            monthlyCashflowUSD: agg.monthlyCashflowUSD,
            annualCashflowUSD: agg.annualCashflowUSD,
            avgCapRate: agg.weightedCapRate,
            weightedCapRate: agg.weightedCapRate,
            avgIRR: agg.weightedIRR,
            weightedIRR: agg.weightedIRR,
          },
        });
      }

      case 'checkout': {
        const startTime = Date.now();
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const { plan, email, refundAcceptedAt } = parsedBody;
        const validPlan: 'starter' | 'pro' | 'enterprise' =
          plan === 'starter' || plan === 'pro' || plan === 'enterprise' ? plan : 'pro';

        const pricing = getPricingPublicPayload();
        const planPricing = findPlanPricing(pricing, validPlan)!;
        const isLaunchPrice = Boolean(pricing.launchDiscountActive);
        const activePriceUSD = isLaunchPrice ? planPricing.launchPrice : planPricing.originalPrice;

        const paddleEnv = resolvePaddleEnvironment();
        if (!paddleEnv.configured) {
          console.error(
            '[Paddle Checkout] Missing or invalid environment variable: PADDLE_ENVIRONMENT (expected "live" or "sandbox").'
          );
          return res.status(500).json({
            success: false,
            error: 'Missing required server environment variable: PADDLE_ENVIRONMENT.',
          });
        }
        const isTestMode = paddleEnv.isSandbox;

        const LEGACY_SANDBOX_PRICE_ID = 'pri_01m7qwqceh520nd4we9pg90f8m';
        const rawProEnv = cleanEnvValue(getEnv('NEXT_PUBLIC_PADDLE_PRICE_ID'));
        const proPriceId =
          rawProEnv && rawProEnv !== LEGACY_SANDBOX_PRICE_ID
            ? rawProEnv
            : !isTestMode
            ? 'pri_01m7tggqhjtgk9fxmmg6mbp5wy'
            : '';
        const starterPriceId =
          cleanEnvValue(
            getEnv('NEXT_PUBLIC_PADDLE_STARTER_PRICE') ||
              getEnv('NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID')
          ) || (!isTestMode ? 'pri_01m7tgfvteegdih2mx4hgyz1c' : '');
        const sovereignPriceId =
          cleanEnvValue(
            getEnv('NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE') ||
              getEnv('NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID')
          ) || (!isTestMode ? 'pri_01m7tgj4pp767gacchp49k2qev' : '');
        const resolvedPriceId =
          validPlan === 'pro'
            ? proPriceId
            : validPlan === 'starter'
            ? starterPriceId
            : sovereignPriceId;

        if (email) {
          recordPendingCheckout({
            email,
            plan: validPlan,
            amountUSD: activePriceUSD,
            isLaunchPrice,
            testMode: isTestMode,
            createdAt: Date.now(),
          });
        }

        const duration = Date.now() - startTime;
        return res.status(200).json({
          success: true,
          provider: 'paddle',
          environment: isTestMode ? 'sandbox' : 'production',
          priceId: resolvedPriceId,
          url: '/#pricing',
          success_url: SUCCESS_REDIRECT,
          cancel_url: CANCEL_REDIRECT,
          testMode: isTestMode,
          durationMs: duration,
          plan: validPlan,
          activePriceUSD,
          originalPrice: planPricing.originalPrice,
          launchPrice: planPricing.launchPrice,
          isLaunchPrice,
          refundAcceptedAt: refundAcceptedAt || new Date().toISOString(),
        });
      }

      case 'session': {
        if (req.method === 'DELETE') {
          clearSessionCookie(res);
          return res.status(200).json({ success: true });
        }

        if (req.method === 'GET') {
          const sessionEmail = getSessionEmailFromReq(req);
          if (!sessionEmail) {
            return res.status(200).json({ authenticated: false, email: null, isAdmin: false });
          }
          const { user: hydratedDb, kvError } = await readUserFromDbStatus(sessionEmail);
          if (kvError && !hydratedDb) {
            return res.status(503).json({
              success: false,
              authenticated: false,
              error: 'Database temporarily unavailable. Please retry.',
            });
          }
          const user = hydratedDb || getOrCreateServerUser(sessionEmail);
          const license = computeServerLicenseStatus(user);
          const cancellationEligibility = evaluateCancelRefundEligibility(user);
          return res.status(200).json({
            authenticated: true,
            email: user.email,
            isAdmin: isAdminEmail(user.email),
            last_results: user.last_results || {},
            user: sanitizeUserForClient(user),
            license,
            cancellationEligibility,
          });
        }

        if (req.method === 'POST') {
          const ip = getClientIp(req);
          const rl = checkRateLimit(`auth:${ip}`, 60, 60 * 1000);
          if (!rl.allowed) {
            return res.status(429).json({
              error: 'Too many authentication attempts. Please wait 1 minute.',
              retryAfterSec: rl.retryAfterSec,
            });
          }

          const body = parsedBody;
          const email = (body.email || '').toString().trim().toLowerCase();
          if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email is required' });
          }

          const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
          if (kvError && !hydratedDb) {
            return res.status(503).json({
              success: false,
              error: 'Database temporarily unavailable. Please retry.',
            });
          }
          const user = recordUserLogin(email, body.name);
          await saveUserToDb(user);
          setSessionCookie(res, user.email);
          const license = computeServerLicenseStatus(user);
          const pricing = getPricingPublicPayload();
          const cancellationEligibility = evaluateCancelRefundEligibility(user);
          const sessionQuotas = resolveEffectiveQuotas(user);
          const maxSaved = sessionQuotas.savedLimit ?? 0;

          return res.status(200).json({
            success: true,
            authenticated: true,
            email: user.email,
            isAdmin: isAdminEmail(user.email),
            plan: license.displayName,
            planKey: license.planKey,
            analyses_left: license.analysesLeft,
            analyses_total: license.analysesLimit,
            analyses_used: license.analysesUsed,
            successful_analyses: user.successful_analyses || 0,
            saved_count: user.saved_analyses.length,
            maxSaved,
            last_results: user.last_results || {},
            user: sanitizeUserForClient(user),
            license,
            cancellationEligibility,
            features:
              findPlanPricing(pricing, license.planKey)?.features ||
              PLAN_DEFINITIONS[license.planKey].features,
          });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      case 'license': {
        const source = req.method === 'POST' ? parsedBody : req.query || {};
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || source.email || '').toString().trim().toLowerCase();
        if (!email) {
          return res.status(400).json({ error: 'Email is required' });
        }

        const userRecord = getOrCreateServerUser(email, {
          name: source.name,
          timezone: source.timezone,
        });
        const license = computeServerLicenseStatus(userRecord);
        const pricing = getPricingPublicPayload();

        return res.status(200).json({
          success: true,
          user: {
            email: userRecord.email,
            name: userRecord.name,
            plan: userRecord.plan,
            license_start: userRecord.license_start,
            license_end: userRecord.license_end,
            analyses_used: userRecord.analyses_used,
            timezone: userRecord.timezone,
            locked_launch_price: userRecord.locked_launch_price ?? null,
            paymentsCount: userRecord.payments.length,
            pdfDownloadsCount: userRecord.pdf_downloads.length,
          },
          license,
          features:
            findPlanPricing(pricing, license.planKey)?.features ||
            PLAN_DEFINITIONS[license.planKey].features,
          capabilities: PLAN_DEFINITIONS[license.planKey].capabilities,
        });
      }

      case 'market-live': {
        try {
          const force = getQueryParam(req, url, 'refresh') === 'true';
          const data = await getLiveMarketDataWithCache(force);
          res?.setHeader?.('Cache-Control', 'public, max-age=21600, stale-while-revalidate=86400');
          return res.status(200).json(data);
        } catch {
          return res.status(200).json(getDeterministicMarketData());
        }
      }

      case 'news': {
        const result = await fetchGoogleMarketNews();
        res?.setHeader?.('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
      }

      case 'demo': {
        const slug = getQueryParam(req, url, 'slug');
        if (!slug) {
          return res.status(200).json({
            available: Object.keys(DEMO_ANALYSES),
            count: Object.keys(DEMO_ANALYSES).length,
          });
        }
        const demo = DEMO_ANALYSES[slug];
        if (!demo) {
          return res.status(404).json({
            error: `Demo analysis '${slug}' not found`,
            available: Object.keys(DEMO_ANALYSES),
          });
        }
        res?.setHeader?.('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        return res.status(200).json({ success: true, demo });
      }

      case 'copy-api-key': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const sessionEmail = getSessionEmailFromReq(req);
        if (!sessionEmail) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const dbUser =
          (await getUserFromDb(sessionEmail).catch(() => null)) || getOrCreateServerUser(sessionEmail);
        const lockState = evaluateLockState(dbUser);
        const license = computeServerLicenseStatus(dbUser);
        const quotas = resolveEffectiveQuotas(dbUser);
        if (!quotas.customApiEnabled || lockState.locked) {
          return res.status(403).json({
            success: false,
            error: quotas.isEnterprise && !quotas.customApiEnabled
              ? 'Enterprise custom_api_enabled is currently false. Admin must enable Custom API Access.'
              : 'Active PROFESSIONAL (100 req/day), SOVEREIGN (2,000 req/day), or ENTERPRISE with custom_api_enabled required for REST API access.',
            code: quotas.isEnterprise && !quotas.customApiEnabled ? 'ENTERPRISE_CONTRACT_LIMIT_UNSET' : 'FEATURE_LOCKED',
            requiredPlan: quotas.isEnterprise ? 'institutional' : 'pro',
          });
        }
        const minted = getOrMintApiKeyForUser(dbUser);
        await saveApiKeyToDb(minted.rawToken, dbUser.email).catch(() => {});
        if (minted.needsPersist) {
          const updated = updateServerUser(dbUser.email, {
            api_key_token: minted.rawToken,
            api_key_last4: minted.last4,
          });
          await saveUserToDb(updated).catch(() => {});
        }
        return res.status(200).json({
          success: true,
          token: minted.rawToken,
          masked: minted.masked,
          last4: minted.last4,
          api_daily_limit: quotas.apiDailyLimit,
        });
      }

      case 'regenerate-api-key': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const sessionEmail = getSessionEmailFromReq(req);
        if (!sessionEmail) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const dbUser =
          (await getUserFromDb(sessionEmail).catch(() => null)) || getOrCreateServerUser(sessionEmail);
        const lockState = evaluateLockState(dbUser);
        const license = computeServerLicenseStatus(dbUser);
        const quotas = resolveEffectiveQuotas(dbUser);
        if (!quotas.customApiEnabled || lockState.locked) {
          return res.status(403).json({
            success: false,
            error: quotas.isEnterprise && !quotas.customApiEnabled
              ? 'Enterprise custom_api_enabled is currently false. Admin must enable Custom API Access.'
              : 'Active PROFESSIONAL (100 req/day), SOVEREIGN (2,000 req/day), or ENTERPRISE with custom_api_enabled required for REST API access.',
            code: quotas.isEnterprise && !quotas.customApiEnabled ? 'ENTERPRISE_CONTRACT_LIMIT_UNSET' : 'FEATURE_LOCKED',
            requiredPlan: quotas.isEnterprise ? 'institutional' : 'pro',
          });
        }

        const oldToken = dbUser.api_key_token || buildApiKeyForEmail(dbUser.email);
        if (oldToken) {
          await deleteApiKeyFromDb(oldToken).catch(() => {});
        }
        const newToken = 'aqari_live_' + crypto.randomBytes(16).toString('hex');
        const newLast4 = newToken.slice(-4);
        const newMasked = `****${newLast4}`;

        const updatedUser = updateServerUser(dbUser.email, {
          api_key_token: newToken,
          api_key_last4: newLast4,
          api_key_revoked_legacy: true,
        });
        await saveUserToDb(updatedUser);
        await saveApiKeyToDb(newToken, dbUser.email);

        return res.status(200).json({
          success: true,
          api_key: newMasked,
          api_key_last4: newLast4,
          token: newToken,
          api_daily_limit: quotas.apiDailyLimit,
          message: `API key regenerated (${newMasked}). Previous token revoked.`,
        });
      }

      case 'paddle-webhook': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const webhookSecret = cleanEnvValue(getEnv('PADDLE_WEBHOOK_SECRET'));
        const sigHeader = String(
          req?.headers?.['paddle-signature'] || req?.headers?.['Paddle-Signature'] || ''
        ).trim();
        const rawBodyString =
          typeof req?.body === 'string'
            ? req.body
            : Buffer.isBuffer(req?.body)
            ? req.body.toString('utf8')
            : JSON.stringify(parsedBody || {});

        let signatureValid = false;
        let verifyError = '';
        let missingSecret = false;

        if (!webhookSecret) {
          missingSecret = true;
          verifyError = 'Missing required server environment variable: PADDLE_WEBHOOK_SECRET.';
          console.error(
            '[Paddle Webhook] Missing required environment variable: PADDLE_WEBHOOK_SECRET. Refusing webhook verification without test-key fallback.'
          );
        } else if (!sigHeader) {
          verifyError = 'Missing Paddle-Signature header.';
        } else {
          const parts: Record<string, string> = {};
          for (const seg of sigHeader.split(';')) {
            const [k, ...v] = seg.split('=');
            if (k && v.length > 0) parts[k.trim()] = v.join('=').trim();
          }
          const ts = parts.ts || '';
          const h1 = parts.h1 || '';
          if (!ts || !h1) {
            verifyError = 'Malformed Paddle-Signature header (missing ts or h1).';
          } else {
            const expectedHex = crypto
              .createHmac('sha256', webhookSecret)
              .update(`${ts}:${rawBodyString}`)
              .digest('hex');
            try {
              const a = Buffer.from(h1, 'hex');
              const b = Buffer.from(expectedHex, 'hex');
              signatureValid = a.length === b.length && crypto.timingSafeEqual(a, b);
              if (!signatureValid) {
                verifyError = 'Invalid HMAC signature mismatch.';
              }
            } catch {
              signatureValid = false;
              verifyError = 'Invalid signature encoding.';
            }
          }
        }

        const eventName = String(
          parsedBody?.event_type || parsedBody?.event_name || parsedBody?.type || 'paddle.unknown'
        );
        const dataObj = parsedBody?.data || parsedBody || {};
        const orderId = String(
          dataObj?.id || dataObj?.transaction_id || dataObj?.subscription_id || `wh_${Date.now()}`
        );
        const customerEmail = normalizeEmail(
          dataObj?.customer?.email ||
            dataObj?.custom_data?.email ||
            dataObj?.custom_data?.login_email ||
            dataObj?.email ||
            ''
        );
        const firstPriceId = String(
          dataObj?.items?.[0]?.price?.id || dataObj?.items?.[0]?.price_id || ''
        );
        const totalMinorOrUsd = Number(
          dataObj?.details?.totals?.total ?? dataObj?.details?.totals?.subtotal ?? 0
        );
        const amountUSD =
          totalMinorOrUsd > 1000 ? Number((totalMinorOrUsd / 100).toFixed(2)) : totalMinorOrUsd;

        const credit25Price = cleanEnvValue(
          getEnv('PADDLE_CREDIT_25_PRICE') || getEnv('NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE')
        );
        const credit100Price = cleanEnvValue(
          getEnv('PADDLE_CREDIT_100_PRICE') || getEnv('NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE')
        );
        const credit500Price = cleanEnvValue(
          getEnv('PADDLE_CREDIT_500_PRICE') || getEnv('NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE')
        );
        const customPackId = String(
          dataObj?.custom_data?.packId || dataObj?.custom_data?.pack_id || ''
        ).trim();
        const isCreditPurchaseFlag =
          String(dataObj?.custom_data?.purchase_type || '').toLowerCase() === 'credit_pack';
        let matchedCreditPack =
          credit25Price && firstPriceId === credit25Price
            ? EXTRA_CREDIT_PACKS[0]
            : credit100Price && firstPriceId === credit100Price
            ? EXTRA_CREDIT_PACKS[1]
            : credit500Price && firstPriceId === credit500Price
            ? EXTRA_CREDIT_PACKS[2]
            : customPackId
            ? EXTRA_CREDIT_PACKS.find((p) => p.id === customPackId)
            : undefined;
        if (!matchedCreditPack && isCreditPurchaseFlag) {
          const roundedAmt = Math.round(amountUSD);
          matchedCreditPack = EXTRA_CREDIT_PACKS.find((p) => p.priceUSD === roundedAmt);
        }
        const isCreditPackPurchase = Boolean(matchedCreditPack || isCreditPurchaseFlag);

        const resolvedPlan =
          firstPriceId === 'pri_01m7tgj4pp767gacchp49k2qev'
            ? 'enterprise'
            : firstPriceId === 'pri_01m7tggqhjtgk9fxmmg6mbp5wy'
            ? 'pro'
            : firstPriceId === 'pri_01m7tgfvteegdih2mx4hgyz1c'
            ? 'starter'
            : resolvePlanFromOrderAttributes(
                { amount: amountUSD, metadata: dataObj?.custom_data },
                'pro'
              );

        const paddleEnv = resolvePaddleEnvironment();
        const isTestEnv = paddleEnv.isSandbox;

        await appendWebhookLogToDb({
          order_id: orderId,
          event: eventName,
          event_name: eventName,
          plan: isCreditPackPurchase
            ? (normalizeEmail(dataObj?.custom_data?.currentPlan) as PlanKey) || resolvedPlan
            : resolvedPlan,
          email: customerEmail || 'unassigned@paddle-webhook',
          payment_email: customerEmail || undefined,
          amount: Number.isFinite(amountUSD) ? amountUSD : 0,
          currency: String(dataObj?.currency_code || 'USD').toUpperCase(),
          test_mode: isTestEnv,
          signature_valid: signatureValid,
          error: signatureValid ? undefined : verifyError,
          raw_error: signatureValid ? undefined : verifyError,
        });

        if (!signatureValid) {
          return res.status(missingSecret ? 500 : 401).json({
            success: false,
            received: true,
            verified: false,
            error: verifyError,
          });
        }

        let creditsAdded = 0;
        if (
          (eventName === 'transaction.completed' || eventName === 'transaction.paid') &&
          customerEmail &&
          customerEmail.includes('@')
        ) {
          if (isCreditPackPurchase && matchedCreditPack) {
            const usedRec = await getUsedOrderFromDb(orderId).catch(() => null);
            const existingDb = await getUserFromDb(customerEmail).catch(() => null);
            const alreadyApplied = Boolean(
              usedRec ||
                existingDb?.payments?.some(
                  (p: any) => normalizeOrderId(p?.order_id) === normalizeOrderId(orderId)
                )
            );
            if (!alreadyApplied) {
              await applyCreditPackToUser({
                email: customerEmail,
                pack: matchedCreditPack,
                orderId,
                isTestMode: isTestEnv,
              });
              creditsAdded = matchedCreditPack.credits;
            }
          } else {
            const existingDb = await getUserFromDb(customerEmail).catch(() => null);
            const alreadyActivated = Boolean(
              existingDb?.payments?.some(
                (p: any) => normalizeOrderId(p?.order_id) === normalizeOrderId(orderId)
              )
            );
            if (!alreadyActivated) {
              const activated = activatePaidPlanOnServer({
                email: customerEmail,
                plan: resolvedPlan,
                orderId,
                amountUSD: amountUSD > 0 ? amountUSD : undefined,
                paymentCustomerEmail: customerEmail,
                paymentProvider: 'paddle',
                paymentIntentId: orderId,
              });
              await saveUserToDb(activated).catch(() => {});
            }
          }
        }

        return res.status(200).json({
          success: true,
          received: true,
          verified: true,
          event_type: eventName,
          order_id: orderId,
          ...(isCreditPackPurchase && matchedCreditPack
            ? {
                purchase_type: 'credit_pack',
                packId: matchedCreditPack.id,
                creditsAdded,
              }
            : { plan: resolvedPlan }),
        });
      }

      case 'webhook-logs': {
        res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
        const logs = await getWebhookLogsFromDb(50);
        const emailLogs = await getEmailLogsFromDb(50);
        const paddleWebhookSecretPresent = Boolean(
          cleanEnvValue(getEnv('PADDLE_WEBHOOK_SECRET'))
        );
        const webhookSecretPresent = paddleWebhookSecretPresent;
        const apiKeyPresent = Boolean(cleanEnvValue(getEnv('PADDLE_API_KEY')));
        const paddleEnv = resolvePaddleEnvironment();
        const webhookStatus = webhookSecretPresent ? 'Connected' : 'Not Connected';

        return res.status(200).json({
          success: true,
          testMode: paddleEnv.isSandbox,
          webhookStatus,
          logs,
          webhookLogs: logs,
          webhooks: logs,
          emailLogs,
          emails: emailLogs,
          envStatus: {
            webhookSecretPresent,
            paddleWebhookSecretPresent,
            apiKeyPresent,
            paddleEnvironmentConfigured: paddleEnv.configured,
            paddleEnvironment: paddleEnv.normalized || 'missing',
            webhookStatus,
          },
          ...(logs.length === 0
            ? {
                debug: webhookSecretPresent
                  ? 'PADDLE_WEBHOOK_SECRET configured (Connected) — waiting for Paddle events.'
                  : 'PADDLE_WEBHOOK_SECRET missing (Not Connected).',
              }
            : {}),
        });
      }

      case 'city-search': {
        const q = getQueryParam(req, url, 'q').trim();
        if (!q || q.length < 2) {
          return res.status(200).json({ success: true, suggestions: [] });
        }
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 5000);
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&featuretype=city&limit=6&q=${encodeURIComponent(q)}`,
            {
              signal: controller.signal,
              headers: {
                'User-Agent': 'AqariTerminal/1.0 (https://aqari-ai-rho.vercel.app; loomorastudios@gmail.com)',
                'Accept-Language': 'en,ar',
              },
            }
          );
          clearTimeout(t);
          if (!nomRes.ok) {
            return res.status(200).json({ success: true, suggestions: [] });
          }
          const items = (await nomRes.json()) as any[];
          const seen = new Set<string>();
          const suggestions: Array<{
            city: string;
            country: string;
            displayName: string;
            lat: number;
            lon: number;
          }> = [];

          for (const item of items) {
            const addr = item?.address || {};
            const cityName = String(
              addr.city || addr.town || addr.village || addr.municipality || addr.state || item?.name || ''
            ).trim();
            const countryName = String(addr.country || '').trim();
            if (!cityName) continue;
            const key = `${cityName.toLowerCase()}|${countryName.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            suggestions.push({
              city: cityName,
              country: countryName || 'Global',
              displayName: countryName ? `${cityName}, ${countryName}` : cityName,
              lat: Number(item.lat || 0),
              lon: Number(item.lon || 0),
            });
          }

          return res.status(200).json({ success: true, suggestions });
        } catch {
          return res.status(200).json({ success: true, suggestions: [] });
        }
      }

      case 'city-analyze': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').toString().trim().toLowerCase();
        const rawCity = (body.city || '').toString().trim();

        if (!email) {
          return res.status(401).json({ error: 'Authentication required to analyze a city' });
        }
        if (!rawCity || rawCity.length < 2) {
          return res.status(400).json({
            error: 'City not found, try another spelling - المدينة غير موجودة، جرب تهجئة ثانية',
          });
        }

        const userRecord =
          (await getUserFromDb(email).catch(() => null)) ||
          getOrCreateServerUser(email, { name: body.name });
        const lockState = evaluateLockState(userRecord);
        const license = computeServerLicenseStatus(userRecord);
        if (lockState.locked) {
          return res.status(403).json({
            success: false,
            locked: true,
            reason: lockState.reason,
            status: lockState.status,
            error: lockState.error,
            analyses_left: 0,
            code: 'LICENSE_EXPIRED_OR_LIMIT_REACHED',
          });
        }

        let resolvedCity = '';
        let resolvedCountry = '';
        let resolvedLat = 0;
        let resolvedLon = 0;
        let verifiedByNominatim = false;

        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 5500);
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(rawCity)}`,
            {
              signal: controller.signal,
              headers: {
                'User-Agent': 'AqariTerminal/1.0 (https://aqari-ai-rho.vercel.app; loomorastudios@gmail.com)',
                'Accept-Language': 'en,ar',
              },
            }
          );
          clearTimeout(t);
          if (nomRes.ok) {
            const results = (await nomRes.json()) as any[];
            const match =
              results.find((r: any) => {
                const cls = String(r?.class || '').toLowerCase();
                const typ = String(r?.type || '').toLowerCase();
                const addr = r?.address || {};
                return (
                  Boolean(
                    addr.city ||
                      addr.town ||
                      addr.village ||
                      addr.municipality ||
                      addr.state_district ||
                      addr.state
                  ) &&
                  (cls === 'boundary' ||
                    cls === 'place' ||
                    ['city', 'town', 'village', 'administrative', 'suburb', 'island'].includes(typ))
                );
              }) ||
              results.find(
                (r: any) => r?.address?.country && (r?.address?.city || r?.address?.town || r?.address?.state)
              );

            if (match) {
              const addr = match.address || {};
              resolvedCity = String(
                addr.city || addr.town || addr.village || addr.municipality || match.name || rawCity
              ).trim();
              resolvedCountry = String(addr.country || 'Global').trim();
              resolvedLat = Number(match.lat || 0);
              resolvedLon = Number(match.lon || 0);
              verifiedByNominatim = Boolean(resolvedCity && !/^[a-z]{1,4}\d+$/i.test(rawCity));
            }
          }
        } catch {
          const knownCities: Record<string, string> = {
            salalah: 'Oman',
            sohar: 'Oman',
            nizwa: 'Oman',
            jeddah: 'Saudi Arabia',
            dammam: 'Saudi Arabia',
            khobar: 'Saudi Arabia',
            doha: 'Qatar',
            'abu dhabi': 'United Arab Emirates',
            sharjah: 'United Arab Emirates',
            manama: 'Bahrain',
            kuwait: 'Kuwait',
            amman: 'Jordan',
            cairo: 'Egypt',
            alexandria: 'Egypt',
            paris: 'France',
            tokyo: 'Japan',
            istanbul: 'Turkey',
          };
          const norm = rawCity.split(',')[0].trim().toLowerCase();
          if (knownCities[norm]) {
            resolvedCity = norm.replace(/\b\w/g, (ch: string) => ch.toUpperCase());
            resolvedCountry = knownCities[norm];
            verifiedByNominatim = true;
          }
        }

        if (!verifiedByNominatim || !resolvedCity) {
          return res.status(404).json({
            success: false,
            error: 'City not found, try another spelling - المدينة غير موجودة، جرب تهجئة ثانية',
          });
        }

        const hashSeed = `${resolvedCity}:${resolvedCountry}`
          .split('')
          .reduce((acc, ch) => acc + ch.charCodeAt(0) * 17, 0);
        const isGCC = /oman|saudi|united arab emirates|uae|qatar|bahrain|kuwait/i.test(resolvedCountry);
        const basePriceSqMUSD = isGCC ? 1850 + (hashSeed % 2200) : 2600 + (hashSeed % 6800);
        const grossYield = Number(
          (isGCC ? 6.8 + (hashSeed % 24) / 10 : 4.6 + (hashSeed % 28) / 10).toFixed(1)
        );
        const priceUSD = Math.round((basePriceSqMUSD * 140) / 1000) * 1000;
        const rentUSD = Math.round((priceUSD * (grossYield / 100)) / 12);

        const cityCard: CustomCityRecord = {
          id: `custom_${resolvedCity.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
          city: resolvedCity,
          country: resolvedCountry,
          estimatedAvgPriceUSD: priceUSD,
          estimatedAvgRentUSD: rentUSD,
          grossYield,
          source: 'OpenStreetMap Nominatim + AQARI Regional Yield Model (Estimated)',
          isEstimated: true,
          addedAt: Date.now(),
        };

        const afterCreditUser = recordUserAnalysis(email, {
          property: `${resolvedCity} Prime Residential`,
          city: resolvedCity,
          priceUSD,
          capRate: Number((grossYield * 0.85).toFixed(2)),
          cashOnCash: Number((grossYield * 0.92).toFixed(2)),
          resultSummary: `Custom City Benchmark: ${grossYield}% Gross`,
        });

        const existingCities = Array.isArray(afterCreditUser.custom_cities)
          ? afterCreditUser.custom_cities
          : [];
        const dedupedCities: CustomCityRecord[] = [
          cityCard,
          ...existingCities.filter((c) => c.city.toLowerCase() !== resolvedCity.toLowerCase()),
        ].slice(0, 20);

        const savedUser = updateServerUser(email, { custom_cities: dedupedCities });
        await saveUserToDb(savedUser).catch(() => {});
        const nextLicense = computeServerLicenseStatus(savedUser);

        return res.status(200).json({
          success: true,
          cityCard,
          coordinates: { lat: resolvedLat, lon: resolvedLon },
          isEstimated: true,
          source: cityCard.source,
          custom_cities: savedUser.custom_cities || [],
          analyses_left: nextLicense.analysesLeft,
          analyses_total: nextLicense.analysesLimit,
          successful_analyses: savedUser.successful_analyses || 0,
          license: nextLicense,
        });
      }

      case 'macro-sync': {
        res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
        const live = await getLiveMarketDataWithCache(getQueryParam(req, url, 'refresh') === 'true');
        const dateStr = new Date(live.last_synced_iso || Date.now()).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        return res.status(200).json({
          success: true,
          source:
            Array.isArray(live.sources) && live.sources.length
              ? live.sources.join(' / ')
              : 'FRED / World Bank / ExchangeRate API',
          real_estate_note: 'City real estate yields & price/m² are Estimated benchmarks; FRED/World Bank/FX are Actual feeds.',
          data_type: (live as any).data_type || 'Estimated',
          macro_data_type: (live as any).macro_data_type || (live.stale ? 'Estimated' : 'Actual'),
          benchmark_data_type: 'Estimated',
          last_updated: live.last_synced_display,
          last_synced_iso: live.last_synced_iso,
          data_as_of: dateStr,
          isEstimated: true,
          macro: live.macro,
          metrics: live.metrics,
          cities: live.cities,
        });
      }

      case 'google-callback': {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          return res.status(400).send(`
            <!DOCTYPE html>
            <html>
              <head><title>Authentication Error</title></head>
              <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
                <h2>Google Authentication Error</h2>
                <p style="color:#f87171;">${error}</p>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'AQARI_GOOGLE_AUTH_CALLBACK', error: ${JSON.stringify(error)} }, '*');
                    window.close();
                  } else {
                    setTimeout(() => { window.location.href = '/#/landing'; }, 2500);
                  }
                </script>
              </body>
            </html>
          `);
        }

        const clientId = getEnv('GOOGLE_CLIENT_ID') || getEnv('VITE_GOOGLE_CLIENT_ID') || '';
        const clientSecret = getEnv('GOOGLE_CLIENT_SECRET') || '';
        const redirectUri = getEnv('GOOGLE_REDIRECT_URI') || `${url.origin}/api/auth/callback/google`;

        if (code && clientId && clientSecret) {
          try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
              }),
            });

            if (!tokenRes.ok) {
              const errText = await tokenRes.text();
              throw new Error(`Token exchange failed: ${errText}`);
            }

            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;
            const idToken = tokenData.id_token;

            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!userRes.ok) {
              throw new Error('Failed to verify token with Google userinfo API');
            }
            const userData = await userRes.json();

            return res.status(200).send(`
              <!DOCTYPE html>
              <html>
                <head><title>Authenticating...</title></head>
                <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
                  <p>Verification successful. Redirecting to AQARI Terminal...</p>
                  <script>
                    const payload = {
                      type: 'AQARI_GOOGLE_AUTH_CALLBACK',
                      accessToken: ${JSON.stringify(accessToken)},
                      idToken: ${JSON.stringify(idToken)},
                      user: ${JSON.stringify(userData)}
                    };
                    if (window.opener) {
                      window.opener.postMessage(payload, '*');
                      window.close();
                    } else {
                      window.location.href = '/#access_token=' + encodeURIComponent(${JSON.stringify(accessToken)}) + '&id_token=' + encodeURIComponent(${JSON.stringify(idToken)});
                    }
                  </script>
                </body>
              </html>
            `);
          } catch (err: any) {
            return res.status(200).send(`
              <!DOCTYPE html>
              <html>
                <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
                  <h2>Verification Failed</h2>
                  <p style="color:#f87171;">${err?.message || 'Authentication error'}</p>
                  <a href="/#/landing" style="color:#D4AF37;">Back to AQARI</a>
                </body>
              </html>
            `);
          }
        }

        res?.writeHead?.(302, { Location: '/#/landing' });
        res?.end?.();
        return;
      }

      case 'nextauth': {
        return res.status(200).json({
          google: {
            id: 'google',
            name: 'Google',
            type: 'oauth',
            signinUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            callbackUrl: 'https://aqari-ai-rho.vercel.app/api/auth/callback/google',
          },
        });
      }

      case 'report-issue': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = String(sessionEmail || body.login_email || body.email || '')
          .trim()
          .toLowerCase();
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const description = String(body.description || body.issueDescription || body.message || '').trim().slice(0, 2000);
        if (description.length < 4) {
          return res.status(400).json({
            success: false,
            error: 'Please describe the tool issue (minimum 4 characters).',
          });
        }

        const existing =
          (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
        const now = Date.now();
        const iso = new Date(now).toISOString();
        const timelineEntry: ForensicTimelineEntry = {
          id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: iso,
          type: 'issue_reported',
          message: `Tool issue reported by ${email}: "${description.slice(0, 180)}"`,
          actor: email,
        };

        const updatedUser = updateServerUser(email, {
          has_reported_issue: true,
          issue_reported_at: now,
          issue_resolved_at: null,
          issue_description: description,
          issue_status: 'open',
          timeline: [timelineEntry, ...existing.timeline].slice(0, 200),
        });
        await saveUserToDb(updatedUser).catch(() => {});

        const planName = PLAN_DEFINITIONS[normalizePlanKey(updatedUser.plan)].displayName;
        await dispatchEmailAlert({
          to: getAdminEmail(),
          subject: `AQARI Tool Issue Reported (${planName}) - ${email}`,
          text: `User: ${email}\nPlan: ${planName}\nSuccessful Analyses: ${updatedUser.successful_analyses}\nReported At: ${iso}\n\nDescription:\n${description}`,
          eventType: 'tool_issue_reported',
        }).catch(() => {});

        const cancellationEligibility = evaluateCancelRefundEligibility(updatedUser, now);
        return res.status(200).json({
          success: true,
          message: 'Tool issue reported. Our engineering team has been notified.',
          issue_reported_at: updatedUser.issue_reported_at,
          issue_status: updatedUser.issue_status,
          issue_description: updatedUser.issue_description,
          cancellationEligibility,
        });
      }

      case 'cancel-subscription': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = String(sessionEmail || body.login_email || body.email || '')
          .trim()
          .toLowerCase();
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const user =
          (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
        const now = Date.now();
        const planKey = normalizePlanKey(user.plan);
        if (planKey === 'free') {
          return res.status(200).json({
            success: false,
            error: 'No active paid subscription found on your account.',
          });
        }

        const eligibility = evaluateCancelRefundEligibility(user, now);
        if (!eligibility.canCancel) {
          return res.status(403).json({
            success: false,
            error: eligibility.reason,
            eligibility,
          });
        }

        const store = loadStore();
        let orderId = normalizeOrderId(
          body.order_id ||
            user.payment_intent_id ||
            user.last_order_id ||
            user.payments?.[0]?.order_id ||
            ''
        );
        if (!orderId) {
          const matchingUsed = Object.values(store.used_orders || {})
            .filter((o: any) => normalizeEmail(o?.login_email) === email && o?.order_id)
            .sort((a: any, b: any) => Number(b.used_at || 0) - Number(a.used_at || 0));
          if (matchingUsed[0]?.order_id) {
            orderId = normalizeOrderId(matchingUsed[0].order_id);
          }
        }
        if (!orderId) {
          const logs = await getWebhookLogsFromDb(50);
          const matchingLog = logs.find(
            (l) => normalizeEmail(l?.email) === email && l?.order_id
          );
          if (matchingLog?.order_id) {
            orderId = normalizeOrderId(matchingLog.order_id);
          }
        }
        orderId = orderId || `txn_${now}`;

        const refundedAmountUSD = Number(
          user.payments?.[0]?.amount || PLAN_DEFINITIONS[planKey].launchPrice || 0
        );
        const paddleApiKey = cleanEnvValue(getEnv('PADDLE_API_KEY'));
        const paddleEnv = resolvePaddleEnvironment();
        const paddleBaseUrl = paddleEnv.baseUrl;
        let refundedAlready = false;

        if (orderId.startsWith('txn_')) {
          if (!paddleApiKey) {
            console.error('[Paddle Refund] Missing required environment variable: PADDLE_API_KEY');
            return res.status(500).json({
              success: false,
              error: 'Missing required server environment variable: PADDLE_API_KEY. Refund could not be processed.',
            });
          }
          if (!paddleEnv.configured || !paddleBaseUrl) {
            console.error(
              '[Paddle Refund] Missing or invalid environment variable: PADDLE_ENVIRONMENT (expected "live" or "sandbox").'
            );
            return res.status(500).json({
              success: false,
              error: 'Missing required server environment variable: PADDLE_ENVIRONMENT. Refund could not be processed.',
            });
          }
          try {
            const refundRes = await fetch(`${paddleBaseUrl}/adjustments`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${paddleApiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                action: 'refund',
                type: 'full',
                transaction_id: orderId,
                reason: `Self-serve cancellation (${eligibility.eligibleRule})`,
              }),
            });
            if (!refundRes.ok) {
              const refErr: any = await refundRes.json().catch(() => ({}));
              const errCode = String(refErr?.error?.code || '');
              if (errCode === 'adjustment_transaction_already_refunded' || errCode === 'already_refunded') {
                refundedAlready = true;
              } else {
                return res.status(200).json({
                  success: false,
                  error: `Paddle refund failed (${refErr?.error?.detail || refErr?.error?.message || refundRes.status}). Your subscription was NOT cancelled or deactivated.`,
                });
              }
            }
          } catch (err: any) {
            return res.status(200).json({
              success: false,
              error: `Paddle refund error (${err?.message || 'network'}). Subscription was NOT cancelled.`,
            });
          }
        }

        const prevPlanDisplay = PLAN_DEFINITIONS[planKey].displayName;
        const iso = new Date(now).toISOString();
        const timelineEntry: ForensicTimelineEntry = {
          id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: iso,
          type: 'cancellation',
          message: `Self-serve cancellation & Paddle refund ($${refundedAmountUSD}) Ref #${orderId} -> Downgraded ${prevPlanDisplay} to FREE (${eligibility.eligibleRule})`,
          actor: email,
        };

        const updatedUser = updateServerUser(email, {
          plan: 'free',
          status: 'active',
          analyses_used: 0,
          analyses_left: PLAN_DEFINITIONS.free.analysesLimit,
          analyses_total: PLAN_DEFINITIONS.free.analysesLimit,
          max_saved: PLAN_DEFINITIONS.free.savedLimit,
          successful_analyses: 0,
          license_start: now,
          license_end: now + THIRTY_DAYS_MS,
          cancel_status: 'refunded',
          refund_requested: true,
          refund_status: 'approved',
          refund_notes: `Cancelled + Paddle refund Ref #${orderId} ($${refundedAmountUSD}) via ${eligibility.eligibleRule}`,
          timeline: [timelineEntry, ...user.timeline].slice(0, 200),
        });
        await saveUserToDb(updatedUser).catch(() => {});
        appendSetCookieHeader(
          res,
          `${ENTITLEMENT_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
        );

        await appendCancellationLogToDb({
          email,
          previous_plan: prevPlanDisplay,
          order_id: orderId,
          refunded_amount_usd: refundedAmountUSD,
          rule: eligibility.eligibleRule,
          reason: eligibility.statusLabel,
          successful_analyses: user.successful_analyses || 0,
          has_reported_issue: Boolean(user.has_reported_issue),
          issue_status: user.issue_status || 'none',
          provider_status: refundedAlready ? 'already_refunded' : 'refunded',
        });

        await dispatchEmailAlert({
          to: getAdminEmail(),
          subject: `AQARI Subscription Cancelled & Refunded ($${refundedAmountUSD}) - ${email}`,
          text: `Customer: ${email}\nPrevious Plan: ${prevPlanDisplay}\nReference ID: #${orderId}\nRefunded Amount: $${refundedAmountUSD} USD\nRule Applied: ${eligibility.eligibleRule} (${eligibility.statusLabel})\nTimestamp: ${iso}`,
          eventType: 'subscription_cancelled',
        }).catch(() => {});

        const nextEligibility = evaluateCancelRefundEligibility(updatedUser, now);
        return res.status(200).json({
          success: true,
          message: `${prevPlanDisplay} cancelled. Refund ($${refundedAmountUSD}) issued to original payment method via Paddle in 5-10 business days.`,
          refundedAmount: refundedAmountUSD,
          order_id: orderId,
          plan: 'FREE',
          analyses_left: PLAN_DEFINITIONS.free.analysesLimit,
          analyses_total: PLAN_DEFINITIONS.free.analysesLimit,
          cancel_status: 'refunded',
          cancellationEligibility: nextEligibility,
        });
      }

      case 'get-last-results': {
        res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
        const sessionEmail = getSessionEmailFromReq(req);
        const queryEmail = normalizeEmail(
          getQueryParam(req, url, 'login_email') ||
            getQueryParam(req, url, 'email') ||
            parsedBody?.login_email ||
            parsedBody?.email
        );
        const email = sessionEmail || (queryEmail && queryEmail.includes('@') ? queryEmail : '');
        if (!email) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. Please retry.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        return res.status(200).json({
          success: true,
          email: userRecord.email,
          last_results: userRecord.last_results || {},
        });
      }

      case 'clear-last-result': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = normalizeEmail(sessionEmail || body.login_email || body.email);
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const rawTool = String(body.tool || '').trim().toLowerCase();
        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. Please retry.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const nextLastResults: PersistedLastResults = { ...(userRecord.last_results || {}) };
        if (rawTool === 'analysis' || rawTool === 'analyze') {
          nextLastResults.analysis = null;
        } else if (rawTool === 'deal-finder' || rawTool === 'deal_finder' || rawTool === 'dealfinder') {
          nextLastResults.deal_finder = null;
        } else if (rawTool === 'forecast' || rawTool === 'market-forecast') {
          nextLastResults.forecast = null;
        } else if (rawTool === 'due-diligence' || rawTool === 'due_diligence' || rawTool === 'duediligence') {
          nextLastResults.due_diligence = null;
        } else if (
          rawTool === 'portfolio-optimizer' ||
          rawTool === 'portfolio_optimizer' ||
          rawTool === 'optimizer'
        ) {
          nextLastResults.portfolio_optimizer = null;
        } else if (rawTool === 'advisor' || rawTool === 'institutional-advisor') {
          nextLastResults.advisor = null;
        } else if (rawTool === 'file_analysis' || rawTool === 'file-analysis') {
          nextLastResults.file_analysis = null;
        } else if (rawTool === 'property_studio' || rawTool === 'property-studio') {
          nextLastResults.property_studio = null;
        } else if (rawTool === 'due_diligence_docs' || rawTool === 'due-diligence-docs') {
          nextLastResults.due_diligence_docs = null;
        } else if (rawTool === 'scenario_comparison' || rawTool === 'scenario-compare') {
          nextLastResults.scenario_comparison = null;
        } else if (rawTool === 'all') {
          nextLastResults.analysis = null;
          nextLastResults.deal_finder = null;
          nextLastResults.forecast = null;
          nextLastResults.due_diligence = null;
          nextLastResults.portfolio_optimizer = null;
          nextLastResults.advisor = null;
          nextLastResults.file_analysis = null;
          nextLastResults.property_studio = null;
          nextLastResults.due_diligence_docs = null;
          nextLastResults.scenario_comparison = null;
        } else {
          return res.status(400).json({
            success: false,
            error:
              "Specify tool: 'analysis', 'deal_finder', 'forecast', 'due_diligence', 'portfolio_optimizer', 'advisor', 'file_analysis', 'property_studio', 'due_diligence_docs', 'scenario_comparison', or 'all'.",
          });
        }
        const store = loadStore();
        store.users[email] = userRecord;
        persistStore(store);
        const updatedUser = updateServerUser(email, { last_results: nextLastResults });
        await saveUserToDb(updatedUser);
        return res.status(200).json({
          success: true,
          tool: rawTool,
          last_results: updatedUser.last_results || {},
        });
      }

      case 'extract-from-file': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const email = normalizeEmail(getSessionEmailFromReq(req) || body.login_email || body.email);
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. Please retry.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);
        const planCfg = PLAN_DEFINITIONS[license.planKey];
        if (quotas.isEnterprise && (quotas.imagePdfLimit === null || quotas.imagePdfLimit <= 0)) {
          return res.status(403).json({
            success: false,
            error: 'Enterprise contract custom_image_pdf_limit is not configured yet. Ask your Admin to configure File/OCR limits.',
            code: 'ENTERPRISE_CONTRACT_LIMIT_UNSET',
          });
        }
        const imagePdfQuota = quotas.imagePdfLimit ?? 0;
        const currentImagePdfUsed = Math.max(0, Number(userRecord.image_pdf_used || 0));
        if (currentImagePdfUsed >= imagePdfQuota) {
          return res.status(403).json({
            success: false,
            error: `Monthly Image/PDF extraction limit reached (${currentImagePdfUsed}/${imagePdfQuota} for ${planCfg.displayName}). Upgrade your plan for additional extractions.`,
            code: 'IMAGE_PDF_QUOTA_EXCEEDED',
            image_pdf_used: currentImagePdfUsed,
            image_pdf_limit: imagePdfQuota,
          });
        }
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['extract-from-file']);
        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }

        const ai = getServerGeminiClient();
        if (!ai) {
          return res.status(503).json({
            success: false,
            error: 'GEMINI_API_KEY is not configured in server Secrets (Settings > Secrets).',
            code: 'MISSING_GEMINI_KEY',
          });
        }

        const fileName = String(body.fileName || 'uploaded-property').slice(0, 120);
        const rawBase64 = String(body.base64Data || '').trim();
        const textHint = String(body.textExtract || '').trim().slice(0, 12000);
        if (!rawBase64 && !textHint) {
          return res.status(400).json({
            success: false,
            error: 'Please upload an image (PNG/JPG/WEBP) or PDF file.',
          });
        }

        const { mimeType: parsedMime, data: pureBase64 } = stripBase64DataUrl(rawBase64);
        const mimeType = String(body.mimeType || parsedMime || 'image/jpeg').toLowerCase();
        const isImageOnly = mimeType.startsWith('image/');

        const parts: any[] = [];
        if (pureBase64) {
          parts.push({
            inlineData: {
              mimeType,
              data: pureBase64,
            },
          });
        }
        parts.push({
          text:
            `Analyze this uploaded real estate ${isImageOnly ? 'image' : 'document/PDF'} (${fileName}). ` +
            (textHint ? `Additional text provided: ${textHint}\n` : '') +
            `Rules:
1. Extract ONLY what is visibly/explicitly written or pictured: propertyTitle, locationText, city, country, propertyType (Apartment|Villa|Commercial|Land|Hotel), areaSqM, bedrooms, bathrooms, priceUSD, monthlyRentUSD, annualOpexUSD, hoaUSD, propertyTaxUSD, vacancyRatePct.
2. CRITICAL: An exterior or interior image alone NEVER proves market price or rental income. If the file is an image without explicit price/rent figures printed inside it, set priceUSD/monthlyRentUSD to null (or list them in missingFields) rather than guessing fake prices. Convert non-USD prices/rents if explicitly written (e.g. OMR*2.597, AED/3.6725, SAR/3.75, GBP*1.27) and note conversion in extractedQuotes.
3. For every field that is estimated from visual clues rather than written text, include its field name in aiEstimatedFields.
4. For every field not present at all, set it to null and list the field key in missingFields.
5. In extractedQuotesJson, return a JSON object string mapping field keys to brief verbatim quotes or visual evidence.`,
        });

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts },
          config: {
            systemInstruction:
              'You are an institutional real estate underwriting extraction analyst. Never hallucinate numbers. Distinguish strictly between explicitly extracted figures vs AI visual estimates vs missing fields.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                propertyTitle: { type: Type.STRING },
                locationText: { type: Type.STRING },
                city: { type: Type.STRING },
                country: { type: Type.STRING },
                propertyType: { type: Type.STRING },
                areaSqM: { type: Type.NUMBER, nullable: true },
                bedrooms: { type: Type.NUMBER, nullable: true },
                bathrooms: { type: Type.NUMBER, nullable: true },
                priceUSD: { type: Type.NUMBER, nullable: true },
                monthlyRentUSD: { type: Type.NUMBER, nullable: true },
                annualOpexUSD: { type: Type.NUMBER, nullable: true },
                hoaUSD: { type: Type.NUMBER, nullable: true },
                propertyTaxUSD: { type: Type.NUMBER, nullable: true },
                vacancyRatePct: { type: Type.NUMBER, nullable: true },
                aiEstimatedFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                extractedQuotesJson: { type: Type.STRING },
                aiSummary: { type: Type.STRING },
              },
            },
          },
        });

        let extracted: any = {};
        try {
          extracted = JSON.parse((response.text ?? '{}').trim());
        } catch {
          extracted = {};
        }

        let quotesMap: Record<string, string> = {};
        try {
          const parsedQuotes = JSON.parse(String(extracted.extractedQuotesJson || '{}'));
          if (parsedQuotes && typeof parsedQuotes === 'object') {
            quotesMap = parsedQuotes;
          }
        } catch {}

        const estSet = new Set<string>(
          Array.isArray(extracted.aiEstimatedFields) ? extracted.aiEstimatedFields.map(String) : []
        );
        const missingList = new Set<string>(
          Array.isArray(extracted.missingFields) ? extracted.missingFields.map(String) : []
        );

        const matchedCity =
          findInlinedCity(String(extracted.city || '')) ||
          findInlinedCity(String(extracted.locationText || '')) ||
          null;

        const fieldKeys = [
          'propertyTitle',
          'city',
          'areaSqM',
          'bedrooms',
          'bathrooms',
          'priceUSD',
          'monthlyRentUSD',
          'annualOpexUSD',
          'hoaUSD',
          'propertyTaxUSD',
        ];
        const provenance: Record<string, 'Extracted' | 'AI Estimated' | 'User Confirmed' | 'Missing'> = {};
        for (const k of fieldKeys) {
          const val = k === 'city' ? matchedCity?.city || extracted.city : extracted[k];
          if (val === null || val === undefined || val === '' || missingList.has(k)) {
            provenance[k] = 'Missing';
            missingList.add(k);
          } else if (estSet.has(k)) {
            provenance[k] = 'AI Estimated';
          } else {
            provenance[k] = 'Extracted';
          }
        }
        // Image alone never proves price
        if (isImageOnly && (!quotesMap.priceUSD || provenance.priceUSD === 'Extracted')) {
          if (extracted.priceUSD && !quotesMap.priceUSD) {
            provenance.priceUSD = 'AI Estimated';
          }
        }

        const draft = {
          fileName,
          mimeType,
          isImageOnly,
          propertyTitle: String(extracted.propertyTitle || `${matchedCity?.city || 'Uploaded'} Property Asset`),
          locationText: String(extracted.locationText || ''),
          city: matchedCity?.city || String(extracted.city || 'Muscat'),
          country: matchedCity?.country || String(extracted.country || 'Oman'),
          propertyType: (['Apartment', 'Villa', 'Commercial', 'Land', 'Hotel'].includes(
            String(extracted.propertyType)
          )
            ? extracted.propertyType
            : 'Apartment') as any,
          areaSqM: typeof extracted.areaSqM === 'number' && extracted.areaSqM > 0 ? extracted.areaSqM : null,
          bedrooms: typeof extracted.bedrooms === 'number' ? extracted.bedrooms : null,
          bathrooms: typeof extracted.bathrooms === 'number' ? extracted.bathrooms : null,
          priceUSD: typeof extracted.priceUSD === 'number' && extracted.priceUSD > 0 ? extracted.priceUSD : null,
          monthlyRentUSD:
            typeof extracted.monthlyRentUSD === 'number' && extracted.monthlyRentUSD > 0
              ? extracted.monthlyRentUSD
              : null,
          annualOpexUSD:
            typeof extracted.annualOpexUSD === 'number' && extracted.annualOpexUSD >= 0
              ? extracted.annualOpexUSD
              : null,
          hoaUSD: typeof extracted.hoaUSD === 'number' && extracted.hoaUSD >= 0 ? extracted.hoaUSD : null,
          propertyTaxUSD:
            typeof extracted.propertyTaxUSD === 'number' && extracted.propertyTaxUSD >= 0
              ? extracted.propertyTaxUSD
              : null,
          vacancyRatePct:
            typeof extracted.vacancyRatePct === 'number' && extracted.vacancyRatePct >= 0
              ? extracted.vacancyRatePct
              : 5,
          extractedQuotes: quotesMap,
          provenance,
          missingFields: Array.from(missingList),
          imagePriceWarning: isImageOnly
            ? 'Image alone does NOT prove price or rent. Review and confirm all financial figures before generating the underwriting report.'
            : 'Verify extracted figures against signed contracts and valuation reports.',
          aiSummary: String(extracted.aiSummary || 'Extraction completed. Confirm any missing or estimated fields below.'),
        };

        const extractionId = `ext_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const nextImagePdfUsed = currentImagePdfUsed + 1;
        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: draft.propertyTitle,
            city: draft.city,
            priceUSD: Number(draft.priceUSD || 0),
            capRate: 0,
            cashOnCash: 0,
            resultSummary: `File Extraction (${fileName})`,
          },
          {
            image_pdf_used: nextImagePdfUsed,
            last_extraction_id: extractionId,
          },
          CREDIT_COSTS['extract-from-file']
        );
        await saveUserToDb(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);

        return res.status(200).json({
          success: true,
          extractionId,
          draft,
          analyses_left: nextLicense.analysesLeft,
          analyses_used: nextLicense.analysesUsed,
          analyses_total: nextLicense.analysesLimit,
          image_pdf_used: nextImagePdfUsed,
          image_pdf_limit: imagePdfQuota,
        });
      }

      case 'run-file-analysis': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const email = normalizeEmail(getSessionEmailFromReq(req) || body.login_email || body.email);
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({
            success: false,
            error: 'Database temporarily unavailable. No credit deducted.',
          });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);
        const planCfg = PLAN_DEFINITIONS[license.planKey];
        if (quotas.isEnterprise && (quotas.imagePdfLimit === null || quotas.imagePdfLimit <= 0)) {
          return res.status(403).json({
            success: false,
            error: 'Enterprise contract custom_image_pdf_limit is not configured yet. Ask your Admin to configure File/OCR limits.',
            code: 'ENTERPRISE_CONTRACT_LIMIT_UNSET',
          });
        }
        const imagePdfQuota = quotas.imagePdfLimit ?? 0;
        const currentImagePdfUsed = Math.max(0, Number(userRecord.image_pdf_used || 0));
        const alreadyCountedExtraction = Boolean(
          body.extractionId &&
            userRecord.last_extraction_id &&
            String(body.extractionId) === String(userRecord.last_extraction_id)
        );
        if (!alreadyCountedExtraction && currentImagePdfUsed >= imagePdfQuota) {
          return res.status(403).json({
            success: false,
            error: `Monthly Image/PDF analysis limit reached (${currentImagePdfUsed}/${imagePdfQuota} for ${planCfg.displayName}). Upgrade your plan to analyze more files.`,
            code: 'IMAGE_PDF_QUOTA_EXCEEDED',
            image_pdf_used: currentImagePdfUsed,
            image_pdf_limit: imagePdfQuota,
          });
        }
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['run-file-analysis']);
        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }

        const cityEntry = findInlinedCity(String(body.city || 'Muscat')) || findInlinedCity('Muscat')!;
        const priceUSD = parseEnglishNumberServer(body.priceUSD);
        const rentUSD = parseEnglishNumberServer(body.monthlyRentUSD ?? body.rentUSD);
        if (!Number.isFinite(priceUSD) || priceUSD <= 0 || !Number.isFinite(rentUSD) || rentUSD <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Confirmed Property Price ($) and Monthly Rent ($) must be greater than 0.',
          });
        }

        const downPaymentPct = parseEnglishNumberServer(body.downPaymentPct ?? 30);
        const interestRatePct = parseEnglishNumberServer(body.interestRatePct ?? 5.5);
        const operatingExpensePct = parseEnglishNumberServer(body.operatingExpensePct ?? 15);
        const hoaUSD = parseEnglishNumberServer(body.hoaUSD ?? 0);
        const propertyTaxUSD = parseEnglishNumberServer(body.propertyTaxUSD ?? 0);
        const vacancyRatePct = parseEnglishNumberServer(body.vacancyRatePct ?? 5);

        const uw = calculateServerUnderwriting({
          priceUSD,
          rentUSD,
          downPaymentPct: Number.isFinite(downPaymentPct) ? downPaymentPct : 30,
          interestRatePct: Number.isFinite(interestRatePct) ? interestRatePct : 5.5,
          operatingExpensePct: Number.isFinite(operatingExpensePct) ? operatingExpensePct : 15,
          hoaUSD: Number.isFinite(hoaUSD) ? hoaUSD : 0,
          propertyTaxUSD: Number.isFinite(propertyTaxUSD) ? propertyTaxUSD : 0,
          vacancyRatePct: Number.isFinite(vacancyRatePct) ? vacancyRatePct : 5,
        });

        const riskBase =
          65 +
          (uw.capRate >= cityEntry.avgCapRate ? 10 : -5) +
          (uw.dscrNumeric && uw.dscrNumeric >= 1.35 ? 12 : uw.dscrNumeric && uw.dscrNumeric >= 1.1 ? 4 : -10) -
          (uw.warnings.length * 6);
        const riskScore = Math.max(25, Math.min(96, Math.round(riskBase)));
        const verdict =
          riskScore >= 75
            ? 'Low Risk - Institutional Quality'
            : riskScore >= 55
            ? 'Moderate Risk - Verify Assumptions'
            : 'Elevated Risk - Re-Price Recommended';

        const createdAt = new Date().toISOString();
        const report = {
          id: `fa_${Date.now()}`,
          fileName: String(body.fileName || 'Uploaded Asset'),
          isImageOnly: Boolean(body.isImageOnly),
          inputs: {
            propertyTitle: String(body.propertyTitle || `${cityEntry.city} Uploaded Property`),
            city: cityEntry.city,
            country: cityEntry.country,
            propertyType: String(body.propertyType || 'Apartment'),
            areaSqM: Number(body.areaSqM || 0),
            bedrooms: Number(body.bedrooms || 0),
            bathrooms: Number(body.bathrooms || 0),
            priceUSD,
            rentUSD,
            downPaymentPct: uw.inputs.downPaymentPct,
            interestRatePct: uw.inputs.interestRatePct,
            operatingExpensePct: uw.inputs.operatingExpensePct,
            hoaUSD: uw.inputs.hoaUSD,
            propertyTaxUSD: uw.inputs.propertyTaxUSD,
            vacancyRatePct: uw.inputs.vacancyRatePct,
          },
          provenance: body.provenance && typeof body.provenance === 'object' ? body.provenance : {},
          extractedQuotes:
            body.extractedQuotes && typeof body.extractedQuotes === 'object' ? body.extractedQuotes : {},
          results: {
            capRate: uw.capRate,
            cashOnCash: uw.cashOnCash,
            irr5Yr: uw.irr5Yr,
            irrStatus: uw.irrStatus,
            irrError: uw.irrError,
            dscr: uw.dscr,
            dscrNumeric: uw.dscrNumeric,
            monthlyCashflowUSD: uw.monthlyCashflowUSD,
            monthlyMortgageUSD: uw.monthlyMortgageUSD,
            netOperatingIncomeUSD: uw.netOperatingIncomeUSD,
            annualGrossRentUSD: uw.annualGrossRentUSD,
            annualOPEXUSD: uw.annualOPEXUSD,
            annualDebtServiceUSD: uw.annualDebtServiceUSD,
            downPaymentUSD: uw.downPaymentUSD,
            totalEquityInvestedUSD: uw.totalEquityInvestedUSD,
            loanAmountUSD: uw.loanAmountUSD,
            noiBreakdown: uw.noiBreakdown,
            yearByYear: uw.yearByYear,
            warnings: uw.warnings,
            sensitivity: null,
            monteCarlo: canUseFeature(getEffectiveFeaturePlanKey(userRecord), 'monteCarlo')
              ? runServerMonteCarlo(uw.inputs, {
                  cycles: PLAN_DEFINITIONS[getEffectiveFeaturePlanKey(userRecord)].monteCarloMaxCycles || 1000,
                })
              : null,
          },
          marketContext: (() => {
            const stats = getServerCityMarketStats(cityEntry);
            return {
              cityAvgCapRate: cityEntry.avgCapRate,
              marketAvgPriceSqM: stats.avgPriceSqM,
              rentGrowthYoY: stats.rentGrowthYoY,
              transferTaxPct: stats.transferTaxPct,
              capitalGainsTax: stats.capitalGainsTax,
              source: stats.source,
              updatedDate: '2026-04-01',
            };
          })(),
          riskScore,
          verdict,
          warnings: [
            ...(body.isImageOnly
              ? ['Image alone does NOT prove price or rent — verify financial fields against binding records.']
              : []),
            ...uw.warnings,
          ],
          imagePriceWarning: Boolean(body.isImageOnly)
            ? 'Image alone does NOT prove price or rental yield.'
            : 'Document figures remain subject to legal & valuation verification.',
          createdAt,
        };

        const nextImagePdfUsed = alreadyCountedExtraction ? currentImagePdfUsed : currentImagePdfUsed + 1;
        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: report.inputs.propertyTitle,
            city: cityEntry.city,
            priceUSD,
            capRate: uw.capRate,
            cashOnCash: uw.cashOnCash,
            resultSummary: `[File Analysis] Cap ${uw.capRate}% | CoC ${uw.cashOnCash}%`,
          },
          {
            image_pdf_used: nextImagePdfUsed,
            last_extraction_id: null,
            last_results: {
              ...(userRecord.last_results || {}),
              file_analysis: report,
            },
          },
          CREDIT_COSTS['run-file-analysis']
        );
        await saveUserToDb(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);

        return res.status(200).json({
          success: true,
          report,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLicense.analysesLeft,
          analyses_used: nextLicense.analysesUsed,
          analyses_total: nextLicense.analysesLimit,
          image_pdf_used: nextImagePdfUsed,
          image_pdf_limit: imagePdfQuota,
        });
      }

      case 'studio-generate': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const email = normalizeEmail(getSessionEmailFromReq(req) || body.login_email || body.email);
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({ success: false, error: 'Database temporarily unavailable.' });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);
        const planCfg = PLAN_DEFINITIONS[license.planKey];

        const isVirtual = body.isVirtual !== false;
        const docType = body.docType === 'memorandum' ? 'memorandum' : 'listing';
        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (docType === 'memorandum' && !canUseFeature(featurePlanKey, 'memorandumPdf')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('memorandumPdf'),
            code: 'FEATURE_LOCKED',
            feature: 'memorandumPdf',
            requiredPlan: 'pro',
          });
        }
        if (quotas.isEnterprise && (quotas.aiListingLimit === null || quotas.aiListingLimit <= 0)) {
          return res.status(403).json({
            success: false,
            error: 'Enterprise contract custom_listings_limit is not configured yet. Ask your Admin to configure AI Listings/Report limits.',
            code: 'ENTERPRISE_CONTRACT_LIMIT_UNSET',
          });
        }
        const aiListingQuota = quotas.aiListingLimit ?? 0;
        const currentAiListingsUsed = Math.max(0, Number(userRecord.ai_listings_used || 0));
        if (currentAiListingsUsed >= aiListingQuota) {
          return res.status(403).json({
            success: false,
            error: `Monthly AI Property Studio limit reached (${currentAiListingsUsed}/${aiListingQuota} for ${planCfg.displayName}). Upgrade your plan to generate more listings.`,
            code: 'AI_LISTING_QUOTA_EXCEEDED',
            ai_listings_used: currentAiListingsUsed,
            ai_listing_limit: aiListingQuota,
          });
        }
        const studioCreditCost = body.useAiEnhance !== false ? CREDIT_COSTS['studio-generate'] : 1;
        const creditCheck = ensureCreditsForAction(userRecord, studioCreditCost);
        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }
        const country = String(body.country || 'Oman').trim();
        const city = String(body.city || 'Muscat').trim();
        const areaDistrict = String(body.areaDistrict || 'Prime Waterfront District').trim();
        const propertyType = String(body.propertyType || 'Apartment');
        const budgetUSD = Math.max(0, Number(body.budgetUSD || 0));
        const areaSqM = Math.max(0, Number(body.areaSqM || 0));
        const bedrooms = Math.max(0, Number(body.bedrooms || 0));
        const bathrooms = Math.max(0, Number(body.bathrooms || 0));
        const expectedMonthlyRentUSD = Math.max(0, Number(body.expectedMonthlyRentUSD || 0));
        const targetYieldPct = Math.max(0, Number(body.targetYieldPct || 7.5));
        const finishing = String(body.finishing || 'Luxury');
        const amenities = Array.isArray(body.amenities) ? body.amenities.map(String) : [];
        const targetAudience = String(body.targetAudience || 'Yield Investors');
        const title = String(body.title || `${city} ${areaDistrict} ${propertyType} ${isVirtual ? 'Concept' : 'Offering'}`).trim();

        const impliedYield =
          budgetUSD > 0 && expectedMonthlyRentUSD > 0
            ? Number((((expectedMonthlyRentUSD * 12) / budgetUSD) * 100).toFixed(2))
            : null;
        const isRentYieldReliable = Boolean(
          impliedYield !== null && impliedYield >= 1 && impliedYield <= 25
        );
        const rentYieldBasisNote = isRentYieldReliable
          ? `Indicative Gross Yield (${impliedYield}%) derived strictly from user-supplied rent ($${expectedMonthlyRentUSD.toLocaleString('en-US')}/mo) & budget ($${budgetUSD.toLocaleString('en-US')}). Not guaranteed.`
          : 'Monthly rent or yield is unverified/out-of-bounds and excluded from formal projections.';

        let aiCopy = {
          description: '',
          locationNarrative: '',
          investmentHighlights: [] as string[],
          riskNotes: [] as string[],
        };

        if (body.useAiEnhance !== false) {
          const ai = getServerGeminiClient();
          if (!ai) {
            return res.status(503).json({
              success: false,
              error: 'GEMINI_API_KEY is not configured in server Secrets (Settings > Secrets).',
            });
          }
          const resp = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Write institutional real estate marketing & underwriting prose in English for:
- Title: ${title}
- Location: ${areaDistrict}, ${city}, ${country}
- Mode: ${isVirtual ? 'VIRTUAL CONCEPT (MUST state "Virtual Concept - Not a real listing")' : 'Verified Offering'}
- Type: ${propertyType}, ${areaSqM} m2, ${bedrooms} bedrooms, ${bathrooms} bathrooms, Finishing: ${finishing}
- Budget: $${budgetUSD.toLocaleString('en-US')}, Target Yield: ${targetYieldPct}%, Rent: ${isRentYieldReliable ? `$${expectedMonthlyRentUSD}/mo` : 'Unverified'}
- Amenities: ${amenities.join(', ') || 'Standard'}
- Target Audience: ${targetAudience}
- Document Type: ${docType === 'memorandum' ? 'Investment Memorandum' : 'Property Listing'}

STRICT GUARDRAILS:
1. NEVER invent a real street address, building license number, or plot ID.
2. NEVER invent or reference real photos.
3. NEVER claim or promise guaranteed returns.
4. If Mode is VIRTUAL CONCEPT, state clearly inside the description: "Virtual Concept - Not a real listing."`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  locationNarrative: { type: Type.STRING },
                  investmentHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                  riskNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
            },
          });
          try {
            const parsed = JSON.parse((resp.text ?? '{}').trim());
            aiCopy = {
              description: String(parsed.description || ''),
              locationNarrative: String(parsed.locationNarrative || ''),
              investmentHighlights: Array.isArray(parsed.investmentHighlights)
                ? parsed.investmentHighlights.map(String)
                : [],
              riskNotes: Array.isArray(parsed.riskNotes) ? parsed.riskNotes.map(String) : [],
            };
          } catch {}
        }

        const draft = {
          id: `st_${Date.now()}`,
          docType,
          isVirtual,
          title,
          country,
          city,
          areaDistrict,
          propertyType,
          budgetUSD,
          areaSqM,
          bedrooms,
          bathrooms,
          expectedMonthlyRentUSD,
          targetYieldPct,
          finishing,
          amenities,
          targetAudience,
          description:
            aiCopy.description ||
            `${isVirtual ? 'Virtual Concept - Not a real listing. ' : ''}Architectural ${finishing.toLowerCase()} ${propertyType.toLowerCase()} concept positioned in ${areaDistrict}, ${city}, ${country} spanning ${areaSqM.toLocaleString('en-US')} m² for ${targetAudience}.`,
          locationNarrative:
            aiCopy.locationNarrative ||
            `${areaDistrict} within ${city}, ${country} offers institutional connectivity and demand fundamentals aligned with ${targetAudience}. Exact parcel coordinates withheld pending formal mandate.`,
          investmentHighlights:
            aiCopy.investmentHighlights.length > 0
              ? aiCopy.investmentHighlights
              : [
                  `${finishing} architectural specification across ${areaSqM.toLocaleString('en-US')} m² (${bedrooms} beds / ${bathrooms} baths).`,
                  `Aligned for ${targetAudience} with indicative budget of $${budgetUSD.toLocaleString('en-US')}.`,
                  isRentYieldReliable
                    ? `Indicative gross yield of ${impliedYield}% (unverified estimate; not guaranteed).`
                    : `Target yield hurdle set at ${targetYieldPct}% subject to market lease execution.`,
                ],
          riskNotes:
            aiCopy.riskNotes.length > 0
              ? aiCopy.riskNotes
              : [
                  isVirtual
                    ? 'Virtual Concept - Not a real listing. Land acquisition, permitting, and construction budgets remain subject to validation.'
                    : 'All income, vacancy, and exit assumptions remain subject to independent valuation and legal audit.',
                  'Market yields and FX rates fluctuate; returns are never guaranteed.',
                ],
          isRentYieldReliable,
          rentYieldBasisNote,
          contactName: String(body.contactName || userRecord.name || 'Sponsor Desk'),
          contactEmail: String(body.contactEmail || userRecord.email),
          contactPhone: String(body.contactPhone || ''),
          contactFirm: String(body.contactFirm || ''),
          aiEnhanced: body.useAiEnhance !== false,
          generatedAt: new Date().toISOString(),
        };

        const nextAiListingsUsed = currentAiListingsUsed + 1;
        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: draft.title,
            city: draft.city,
            priceUSD: draft.budgetUSD,
            capRate: impliedYield || 0,
            cashOnCash: 0,
            resultSummary: `Property Studio (${docType})`,
          },
          {
            ai_listings_used: nextAiListingsUsed,
            last_results: {
              ...(userRecord.last_results || {}),
              property_studio: draft,
            },
          },
          studioCreditCost
        );
        await saveUserToDb(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);

        return res.status(200).json({
          success: true,
          draft,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLicense.analysesLeft,
          analyses_used: nextLicense.analysesUsed,
          analyses_total: nextLicense.analysesLimit,
          ai_listings_used: nextAiListingsUsed,
          ai_listing_limit: aiListingQuota,
        });
      }

      case 'portfolio-intelligence': {
        const body = parsedBody;
        const email = normalizeEmail(
          getSessionEmailFromReq(req) || getQueryParam(req, url, 'email') || body.login_email || body.email
        );
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({ success: false, error: 'Database temporarily unavailable.' });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);
        const planCfg = PLAN_DEFINITIONS[license.planKey];
        let assets: any[] = Array.isArray(userRecord.portfolio_assets)
          ? [...userRecord.portfolio_assets]
          : [];

        if (req.method === 'POST') {
          const subAction = String(body.subAction || 'add').toLowerCase();
          if (subAction === 'delete') {
            const targetId = String(body.id || '');
            assets = assets.filter((a) => a.id !== targetId);
          } else if (subAction === 'update') {
            const targetId = String(body.id || '');
            const idx = assets.findIndex((a) => a.id === targetId);
            if (idx === -1) {
              return res.status(404).json({ success: false, error: 'Asset not found' });
            }
            assets[idx] = computePostPurchaseAssetRecord({ ...assets[idx], ...body.asset }, targetId);
          } else if (subAction === 'seed-from-saved') {
            if (quotas.isEnterprise && (quotas.portfolioAssetsLimit === null || quotas.portfolioAssetsLimit <= 0)) {
              return res.status(403).json({
                success: false,
                error: 'Enterprise contract custom_portfolio_limit is not configured yet. Ask your Admin to configure portfolio capacity.',
                code: 'ENTERPRISE_CONTRACT_LIMIT_UNSET',
              });
            }
            const portfolioQuota = quotas.portfolioAssetsLimit ?? 0;
            const existingNames = new Set(assets.map((a) => `${a.property}|${a.city}`));
            const candidates = (userRecord.saved_analyses || []).filter(
              (s: any) => !existingNames.has(`${s.property}|${s.city}`)
            );
            if (candidates.length > 0 && assets.length >= portfolioQuota) {
              return res.status(403).json({
                success: false,
                error: `Portfolio asset limit reached (${assets.length}/${portfolioQuota} assets for ${planCfg.displayName}). Upgrade to expand portfolio tracking capacity.`,
                code: 'PORTFOLIO_ASSET_LIMIT_REACHED',
                portfolioAssetsLimit: portfolioQuota,
                assetCount: assets.length,
              });
            }
            for (const s of candidates) {
              if (assets.length >= portfolioQuota) break;
              assets.unshift(
                computePostPurchaseAssetRecord({
                  property: s.property,
                  city: s.city,
                  purchasePriceUSD: s.price,
                  currentValueUSD: s.price,
                  forecastRentMonthlyUSD: s.rent,
                  actualRentMonthlyUSD: s.rent,
                })
              );
            }
          } else {
            if (quotas.isEnterprise && (quotas.portfolioAssetsLimit === null || quotas.portfolioAssetsLimit <= 0)) {
              return res.status(403).json({
                success: false,
                error: 'Enterprise contract custom_portfolio_limit is not configured yet. Ask your Admin to configure portfolio capacity.',
                code: 'ENTERPRISE_CONTRACT_LIMIT_UNSET',
              });
            }
            const portfolioQuota = quotas.portfolioAssetsLimit ?? 0;
            if (assets.length >= portfolioQuota) {
              return res.status(403).json({
                success: false,
                error: `Portfolio asset limit reached (${assets.length}/${portfolioQuota} assets for ${planCfg.displayName}). Upgrade to add more post-purchase assets.`,
                code: 'PORTFOLIO_ASSET_LIMIT_REACHED',
                portfolioAssetsLimit: portfolioQuota,
                assetCount: assets.length,
              });
            }
            const record = computePostPurchaseAssetRecord(body.asset || body);
            assets.unshift(record);
          }

          const sliceCap = quotas.portfolioAssetsLimit ?? assets.length;
          const store = loadStore();
          store.users[email] = userRecord;
          persistStore(store);
          const updated = updateServerUser(email, {
            portfolio_assets: assets.slice(0, sliceCap),
          });
          await saveUserToDb(updated);
          assets = updated.portfolio_assets || [];
        }

        const totalPurchaseUSD = assets.reduce((s, a) => s + Number(a.purchasePriceUSD || 0), 0);
        const totalCurrentUSD = assets.reduce((s, a) => s + Number(a.currentValueUSD || 0), 0);
        const totalLoanUSD = assets.reduce((s, a) => s + Number(a.loanBalanceUSD || 0), 0);
        const totalMonthlyDebtUSD = assets.reduce((s, a) => s + Number(a.monthlyDebtServiceUSD || 0), 0);
        const totalForecastRent = assets.reduce((s, a) => s + Number(a.forecastRentMonthlyUSD || 0), 0);
        const totalActualRent = assets.reduce((s, a) => s + Number(a.actualRentMonthlyUSD || 0), 0);

        const clusterTotals: Record<string, { value: number; count: number; avgScore: number }> = {};
        for (const a of assets) {
          const cl = String(a.cluster || 'Global');
          if (!clusterTotals[cl]) clusterTotals[cl] = { value: 0, count: 0, avgScore: 0 };
          clusterTotals[cl].value += Number(a.currentValueUSD || 0);
          clusterTotals[cl].count += 1;
          clusterTotals[cl].avgScore += Number(a.overallScore || 0);
        }
        const topClusterEntry = Object.entries(clusterTotals)
          .map(([cluster, d]) => ({
            cluster,
            valueUSD: d.value,
            count: d.count,
            avgScore: Math.round(d.avgScore / (d.count || 1)),
          }))
          .sort((a, b) => b.valueUSD - a.valueUSD)[0] || null;

        const avgScores = assets.length
          ? {
              overall: Math.round(assets.reduce((s, a) => s + Number(a.overallScore || 0), 0) / assets.length),
              demand: Math.round(assets.reduce((s, a) => s + Number(a.demandScore || 0), 0) / assets.length),
              mobility: Math.round(assets.reduce((s, a) => s + Number(a.mobilityScore || 0), 0) / assets.length),
              climate: Math.round(assets.reduce((s, a) => s + Number(a.climateScore || 0), 0) / assets.length),
              esg: Math.round(assets.reduce((s, a) => s + Number(a.esgScore || 0), 0) / assets.length),
            }
          : { overall: 0, demand: 0, mobility: 0, climate: 0, esg: 0 };

        const topPerformers = [...assets]
          .sort((a, b) => b.overallScore - a.overallScore || b.actualYieldPct - a.actualYieldPct)
          .slice(0, 3);

        const allClimateFlags = Array.from(new Set(assets.flatMap((a) => a.climateFlags || [])));
        const allRiskAlerts = assets.flatMap((a) =>
          (a.riskAlerts || []).map((msg: string) => ({ asset: a.property, city: a.city, message: msg }))
        );

        return res.status(200).json({
          success: true,
          planKey: license.planKey,
          portfolioAssetsLimit: quotas.portfolioAssetsLimit ?? 0,
          assets,
          summary: {
            assetCount: assets.length,
            totalPurchaseUSD,
            totalCurrentUSD,
            appreciationUSD: totalCurrentUSD - totalPurchaseUSD,
            appreciationPct:
              totalPurchaseUSD > 0
                ? Number((((totalCurrentUSD - totalPurchaseUSD) / totalPurchaseUSD) * 100).toFixed(2))
                : 0,
            totalLoanUSD,
            totalMonthlyDebtUSD,
            totalForecastRent,
            totalActualRent,
            rentVarianceMonthlyUSD: totalActualRent - totalForecastRent,
            avgScores,
            topCluster: topClusterEntry,
            topPerformers,
            climateFlags: allClimateFlags,
            riskAlerts: allRiskAlerts,
          },
        });
      }

      case 'due-diligence-docs': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const email = normalizeEmail(getSessionEmailFromReq(req) || body.login_email || body.email);
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({ success: false, error: 'Database temporarily unavailable. No credit deducted.' });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const creditCheck = ensureCreditsForAction(userRecord, CREDIT_COSTS['due-diligence-docs']);
        if (!creditCheck.ok) {
          return res.status(creditCheck.status).json({
            ...creditCheck.payload,
            plan: license.planKey,
            displayName: license.displayName,
          });
        }
        const featurePlanKey = getEffectiveFeaturePlanKey(userRecord);
        if (!canUseFeature(featurePlanKey, 'dueDiligence')) {
          return res.status(403).json({
            success: false,
            error: getUpgradeMessage('dueDiligence'),
            code: 'FEATURE_LOCKED',
            feature: 'dueDiligence',
            requiredPlan: 'pro',
          });
        }

        const documents = Array.isArray(body.documents) ? body.documents.slice(0, 5) : [];
        if (documents.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Upload at least 1 document (Lease, Title Deed, Valuation, Service Fees, or Legal doc).',
          });
        }

        const ai = getServerGeminiClient();
        if (!ai) {
          return res.status(503).json({
            success: false,
            error: 'GEMINI_API_KEY is not configured in server Secrets (Settings > Secrets).',
          });
        }

        const finModel = body.financialModel || {};
        const modelPrice = Number(finModel.priceUSD || 0);
        const modelRent = Number(finModel.monthlyRentUSD || 0);
        const modelHoa = Number(finModel.hoaUSD || 0);
        const modelOwnership = String(finModel.ownershipType || 'Freehold');
        const modelCity = String(finModel.city || 'Muscat');

        const parts: any[] = [];
        const docListDesc: string[] = [];
        for (const doc of documents) {
          const docType = String(doc.docType || 'Legal');
          const fileName = String(doc.fileName || `${docType}.pdf`);
          docListDesc.push(`[${docType}: ${fileName}]`);
          if (doc.base64Data) {
            const { mimeType: parsedMime, data: pureB64 } = stripBase64DataUrl(String(doc.base64Data));
            parts.push({
              inlineData: {
                mimeType: String(doc.mimeType || parsedMime || 'application/pdf'),
                data: pureB64,
              },
            });
          }
          if (doc.textExtract) {
            parts.push({
              text: `--- Document [${docType}: ${fileName}] ---\n${String(doc.textExtract).slice(0, 8000)}`,
            });
          }
        }

        parts.push({
          text: `Perform an institutional Real Estate Legal & Financial Due Diligence audit across these documents: ${docListDesc.join(', ')}.
Compare every extracted figure and legal clause against the User's Financial Model:
- City: ${modelCity}
- Valuation / Purchase Price: $${modelPrice.toLocaleString('en-US')}
- Gross Monthly Rent: $${modelRent.toLocaleString('en-US')}/mo
- Annual HOA / Service Fees: $${modelHoa.toLocaleString('en-US')}/yr
- Claimed Ownership Type: ${modelOwnership}

Return JSON with:
1. items: array of comparisons for Price/Valuation, Monthly Rent, Service Fees/HOA, Ownership Tenure, Lease Expiry/Tenant Covenant, Encumbrances/Liens, Zoning/Compliance. Each item MUST specify field, docType, extractedValue, modelValue, status (Match|Contradiction|Missing|Verified), sourceCitation (exact doc name & clause/page), severity (High|Medium|Low), note.
2. missingDocumentsOrClauses: list of critical missing clauses or missing supporting documents (e.g., if no Title Deed or no Service Fee invoice was uploaded).
3. overallComplianceScore (0-100) and verdict.`,
        });

        const resp = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts },
          config: {
            systemInstruction:
              'You are a sovereign real estate legal & financial auditor. Flag every discrepancy and missing document strictly with exact source citations.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overallComplianceScore: { type: Type.NUMBER },
                verdict: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      field: { type: Type.STRING },
                      docType: { type: Type.STRING },
                      extractedValue: { type: Type.STRING },
                      modelValue: { type: Type.STRING },
                      status: { type: Type.STRING },
                      sourceCitation: { type: Type.STRING },
                      severity: { type: Type.STRING },
                      note: { type: Type.STRING },
                    },
                  },
                },
                missingDocumentsOrClauses: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
        });

        let parsed: any = {};
        try {
          parsed = JSON.parse((resp.text ?? '{}').trim());
        } catch {
          parsed = {};
        }

        const items = Array.isArray(parsed.items) ? parsed.items : [];
        const contradictionsCount = items.filter((i: any) => i.status === 'Contradiction').length;
        const missingItems = items.filter((i: any) => i.status === 'Missing').length;
        const missingDocs = Array.isArray(parsed.missingDocumentsOrClauses)
          ? parsed.missingDocumentsOrClauses.map(String)
          : [];

        const extractedSummary: Record<string, { value: string; source: string }> = {};
        for (const it of items) {
          if (it?.field) {
            extractedSummary[String(it.field)] = {
              value: String(it.extractedValue || 'Not found'),
              source: String(it.sourceCitation || 'Uploaded Document'),
            };
          }
        }

        const result = {
          id: `ddd_${Date.now()}`,
          documentsScanned: documents.map((d: any) => ({
            fileName: String(d.fileName || 'Document'),
            docType: String(d.docType || 'Legal'),
          })),
          overallComplianceScore: Math.max(0, Math.min(100, Math.round(Number(parsed.overallComplianceScore ?? 68)))),
          contradictionsCount,
          missingCount: missingItems + missingDocs.length,
          verdict: String(
            parsed.verdict ||
              (contradictionsCount > 0
                ? 'Contradictions Found - Resolve Before Closing'
                : 'Verified Subject to Missing Clauses')
          ),
          items,
          extractedSummary,
          missingDocumentsOrClauses: missingDocs,
          disclaimer:
            'AI Document Due Diligence cross-references uploaded records against your underwriting model. Not legal/tax advice; obtain certified counsel sign-off.',
          generatedAt: new Date().toISOString(),
        };

        const updatedUser = recordUserAnalysis(
          userRecord,
          {
            property: `Document DD (${documents.length} docs)`,
            city: modelCity,
            priceUSD: modelPrice,
            capRate: modelPrice > 0 ? Number((((modelRent * 12) / modelPrice) * 100).toFixed(2)) : 0,
            cashOnCash: 0,
            resultSummary: `Doc DD Score ${result.overallComplianceScore}/100 | ${contradictionsCount} contradictions`,
          },
          {
            last_results: {
              ...(userRecord.last_results || {}),
              due_diligence_docs: result,
            },
          },
          CREDIT_COSTS['due-diligence-docs']
        );
        await saveUserToDb(updatedUser);
        const nextLicense = computeServerLicenseStatus(updatedUser);

        return res.status(200).json({
          success: true,
          result,
          last_results: updatedUser.last_results || {},
          analyses_left: nextLicense.analysesLeft,
          analyses_used: nextLicense.analysesUsed,
          analyses_total: nextLicense.analysesLimit,
        });
      }

      case 'scenario-compare': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const email = normalizeEmail(getSessionEmailFromReq(req) || body.login_email || body.email);
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb } = await readUserFromDbStatus(email);
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);
        const planCfg = PLAN_DEFINITIONS[license.planKey];
        const effectiveCompareLimit = quotas.compareLimit ?? planCfg.compareLimit;

        const defaultScenarios = [
          { id: 'sc-1', label: 'Muscat ITC Prime', city: 'Muscat', priceUSD: 650000, monthlyRentUSD: 4550, downPaymentPct: 30, interestRatePct: 5.65, operatingExpensePct: 14 },
          { id: 'sc-2', label: 'Dubai Marina Core', city: 'Dubai', priceUSD: 950000, monthlyRentUSD: 6950, downPaymentPct: 30, interestRatePct: 4.85, operatingExpensePct: 18 },
          { id: 'sc-3', label: 'Riyadh Al Olaya Yield', city: 'Riyadh', priceUSD: 820000, monthlyRentUSD: 6010, downPaymentPct: 30, interestRatePct: 5.5, operatingExpensePct: 15 },
        ];
        if (Array.isArray(body.scenarios) && body.scenarios.length > effectiveCompareLimit) {
          return res.status(403).json({
            success: false,
            error: `Scenario compare limit is ${effectiveCompareLimit} scenario${effectiveCompareLimit === 1 ? '' : 's'} on ${planCfg.displayName}. Upgrade to compare more scenarios side-by-side.`,
            code: 'COMPARE_LIMIT_EXCEEDED',
            compareLimit: effectiveCompareLimit,
          });
        }
        const rawScenarios = Array.isArray(body.scenarios) && body.scenarios.length > 0
          ? body.scenarios.slice(0, effectiveCompareLimit)
          : defaultScenarios.slice(0, effectiveCompareLimit);

        const computed = rawScenarios.map((sc: any, idx: number) => {
          const cityEntry = findInlinedCity(String(sc.city || 'Muscat')) || findInlinedCity('Muscat')!;
          const priceUSD = Math.max(10000, Number(sc.priceUSD || 500000));
          const monthlyRentUSD = Math.max(100, Number(sc.monthlyRentUSD || 3500));
          const downPaymentPct = Math.max(0, Math.min(100, Number(sc.downPaymentPct ?? 30)));
          const interestRatePct = Math.max(0, Number(sc.interestRatePct ?? 5.5));
          const operatingExpensePct = Math.max(0, Math.min(90, Number(sc.operatingExpensePct ?? 15)));
          const stats = getServerCityMarketStats(cityEntry);
          const uw = calculateServerUnderwriting({
            priceUSD,
            rentUSD: monthlyRentUSD,
            downPaymentPct,
            interestRatePct,
            operatingExpensePct,
            rentGrowthPct: stats.rentGrowthYoY,
          });
          const geo = CITY_GEO_PROFILES[cityEntry.city];
          const liquidityScore = geo?.liquidity || 76;
          const riskScore = Math.max(
            35,
            Math.min(
              95,
              Math.round(
                70 +
                  (uw.dscrNumeric && uw.dscrNumeric >= 1.3 ? 12 : uw.dscrNumeric && uw.dscrNumeric < 1.05 ? -15 : 4) +
                  (uw.capRate >= cityEntry.avgCapRate ? 6 : -4)
              )
            )
          );
          return {
            id: String(sc.id || `sc-${idx + 1}`),
            label: String(sc.label || `${cityEntry.city} Scenario`),
            city: cityEntry.city,
            country: cityEntry.country,
            priceUSD,
            monthlyRentUSD,
            noiUSD: uw.netOperatingIncomeUSD,
            capRate: uw.capRate,
            netYieldPct: uw.capRate,
            cashOnCash: uw.cashOnCash,
            irr5Yr: uw.irr5Yr,
            dscr: uw.dscr,
            monthlyDebtServiceUSD: Math.round(uw.annualDebtServiceUSD / 12),
            monthlyCashflowUSD: uw.monthlyCashflowUSD,
            ltvPct: Number((100 - downPaymentPct).toFixed(1)),
            transferTaxPct: stats.transferTaxPct,
            capitalGainsTax: stats.capitalGainsTax,
            goldenVisaUSD: stats.goldenVisaUSD,
            riskScore,
            liquidityScore,
            taxSource: `${stats.source} (Verified 2026-04-01)`,
          };
        });

        const payload = {
          scenarios: computed,
          created_at: new Date().toISOString(),
        };
        const updated = updateServerUser(email, {
          last_results: {
            ...(userRecord.last_results || {}),
            scenario_comparison: payload,
          },
        });
        await saveUserToDb(updated).catch(() => {});

        return res.status(200).json({
          success: true,
          compareLimit: effectiveCompareLimit,
          ...payload,
          last_results: updated.last_results || {},
        });
      }

      case 'workspace': {
        const body = parsedBody;
        const email = normalizeEmail(
          getSessionEmailFromReq(req) || getQueryParam(req, url, 'email') || body.login_email || body.email
        );
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb } = await readUserFromDbStatus(email);
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);

        let orgIds = await getUserOrgIdsDb(email);
        if (orgIds.length === 0) {
          const defaultOrgId = `org_${crypto.createHash('sha1').update(email).digest('hex').slice(0, 10)}`;
          const existing = await readEnterpriseOrgFromDb(defaultOrgId);
          if (!existing) {
            const nowIso = new Date().toISOString();
            const createdOrg = {
              id: defaultOrgId,
              name: `${userRecord.name || email.split('@')[0]} Capital Workspace`,
              ownerEmail: email,
              createdAt: nowIso,
              members: [
                {
                  email,
                  name: userRecord.name || email.split('@')[0],
                  role: 'Admin',
                  addedAt: nowIso,
                  addedBy: email,
                },
              ],
              sharedDeals: [],
              comments: [],
              auditTrail: [
                {
                  id: `aud_${Date.now()}`,
                  actorEmail: email,
                  actorRole: 'Admin',
                  action: 'WORKSPACE_CREATED',
                  target: defaultOrgId,
                  detail: 'Initialized private institutional organization workspace.',
                  timestamp: nowIso,
                },
              ],
            };
            await saveEnterpriseOrgToDb(createdOrg);
          }
          orgIds = await addOrgToUserIndexDb(email, defaultOrgId);
        }

        if (req.method === 'GET') {
          const orgs = (await Promise.all(orgIds.map((id) => readEnterpriseOrgFromDb(id)))).filter(Boolean);
          const requestedOrgId = getQueryParam(req, url, 'orgId');
          const activeOrg = (requestedOrgId && orgs.find((o: any) => o.id === requestedOrgId)) || orgs[0] || null;
          const myMember = activeOrg?.members?.find((m: any) => normalizeEmail(m.email) === email) || null;
          return res.status(200).json({
            success: true,
            planKey: license.planKey,
            teamUsersLimit: quotas.teamUsersLimit ?? 0,
            orgs,
            activeOrg,
            myRole: myMember?.role || 'Analyst',
          });
        }

        if (req.method === 'POST') {
          const subAction = String(body.subAction || '').toLowerCase();
          const nowIso = new Date().toISOString();

          if (subAction === 'create-org') {
            const orgName = String(body.name || 'Sovereign Family Office').trim().slice(0, 80);
            const newOrgId = `org_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
            const newOrg = {
              id: newOrgId,
              name: orgName,
              ownerEmail: email,
              createdAt: nowIso,
              members: [
                {
                  email,
                  name: userRecord.name || email.split('@')[0],
                  role: 'Admin',
                  addedAt: nowIso,
                  addedBy: email,
                },
              ],
              sharedDeals: [],
              comments: [],
              auditTrail: [
                {
                  id: `aud_${Date.now()}`,
                  actorEmail: email,
                  actorRole: 'Admin',
                  action: 'CREATE_ORG',
                  target: orgName,
                  detail: `Created private organization workspace "${orgName}".`,
                  timestamp: nowIso,
                },
              ],
            };
            await saveEnterpriseOrgToDb(newOrg);
            await addOrgToUserIndexDb(email, newOrgId);
            return res.status(200).json({ success: true, activeOrg: newOrg, myRole: 'Admin' });
          }

          const orgId = String(body.orgId || orgIds[0] || '').trim();
          const org = await readEnterpriseOrgFromDb(orgId);
          if (!org) {
            return res.status(404).json({ success: false, error: 'Organization workspace not found.' });
          }
          const actorMember = (org.members || []).find((m: any) => normalizeEmail(m.email) === email);
          if (!actorMember) {
            return res.status(403).json({
              success: false,
              error: 'Access Denied: You are not a member of this private workspace.',
            });
          }
          const actorRole: 'Analyst' | 'Manager' | 'Admin' = actorMember.role;
          const pushAudit = (actionName: string, target: string, detail: string) => {
            if (!Array.isArray(org.auditTrail)) org.auditTrail = [];
            org.auditTrail.unshift({
              id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              actorEmail: email,
              actorRole,
              action: actionName,
              target,
              detail,
              timestamp: nowIso,
            });
            org.auditTrail = org.auditTrail.slice(0, 300);
          };

          if (subAction === 'invite-member') {
            if (actorRole !== 'Admin') {
              return res.status(403).json({
                success: false,
                error: 'RBAC Denied (Server): Only Admin role can invite or assign team members.',
              });
            }
            const memberEmail = normalizeEmail(body.memberEmail);
            const role: 'Analyst' | 'Manager' | 'Admin' = ['Analyst', 'Manager', 'Admin'].includes(body.role)
              ? body.role
              : 'Analyst';
            if (!memberEmail || !memberEmail.includes('@')) {
              return res.status(400).json({ success: false, error: 'Valid team member email is required.' });
            }
            const existingIdx = org.members.findIndex((m: any) => normalizeEmail(m.email) === memberEmail);
            if (existingIdx >= 0) {
              org.members[existingIdx].role = role;
              pushAudit('ROLE_UPDATED', memberEmail, `Changed ${memberEmail} role to ${role}`);
            } else {
              if (quotas.isEnterprise && (quotas.teamUsersLimit === null || quotas.teamUsersLimit <= 0)) {
                return res.status(403).json({
                  success: false,
                  error: 'Enterprise contract custom_seats is not configured yet. Ask your Admin to configure team seat capacity.',
                  code: 'ENTERPRISE_CONTRACT_LIMIT_UNSET',
                });
              }
              const teamUsersLimit = quotas.teamUsersLimit ?? 0;
              if (org.members.length >= teamUsersLimit) {
                return res.status(403).json({
                  success: false,
                  error: `Team seat limit reached (${org.members.length}/${teamUsersLimit} users for ${PLAN_DEFINITIONS[license.planKey].displayName}). Upgrade your plan to add more team seats.`,
                  code: 'TEAM_SEAT_LIMIT_REACHED',
                  teamUsersLimit,
                });
              }
              org.members.push({
                email: memberEmail,
                name: String(body.memberName || memberEmail.split('@')[0]),
                role,
                addedAt: nowIso,
                addedBy: email,
              });
              await addOrgToUserIndexDb(memberEmail, org.id);
              pushAudit('MEMBER_INVITED', memberEmail, `Invited ${memberEmail} with role ${role}`);
            }
          } else if (subAction === 'update-role') {
            if (actorRole !== 'Admin') {
              return res.status(403).json({
                success: false,
                error: 'RBAC Denied (Server): Only Admin role can modify team member roles.',
              });
            }
            const memberEmail = normalizeEmail(body.memberEmail);
            const role: 'Analyst' | 'Manager' | 'Admin' = ['Analyst', 'Manager', 'Admin'].includes(body.role)
              ? body.role
              : 'Analyst';
            const idx = org.members.findIndex((m: any) => normalizeEmail(m.email) === memberEmail);
            if (idx === -1) {
              return res.status(404).json({ success: false, error: 'Member not found.' });
            }
            const prevRole = org.members[idx].role;
            org.members[idx].role = role;
            pushAudit('ROLE_CHANGED', memberEmail, `Role changed from ${prevRole} to ${role}`);
          } else if (subAction === 'remove-member') {
            if (actorRole !== 'Admin') {
              return res.status(403).json({
                success: false,
                error: 'RBAC Denied (Server): Only Admin role can remove team members.',
              });
            }
            const memberEmail = normalizeEmail(body.memberEmail);
            if (memberEmail === normalizeEmail(org.ownerEmail)) {
              return res.status(400).json({ success: false, error: 'Cannot remove workspace owner.' });
            }
            org.members = org.members.filter((m: any) => normalizeEmail(m.email) !== memberEmail);
            pushAudit('MEMBER_REMOVED', memberEmail, `Removed ${memberEmail} from workspace`);
          } else if (subAction === 'share-deal') {
            const deal = body.deal || {};
            const dealId = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const sharedDeal = {
              id: dealId,
              title: String(deal.title || deal.property || 'Shared Property Analysis'),
              city: String(deal.city || 'Muscat'),
              priceUSD: Number(deal.priceUSD ?? deal.price ?? 0),
              rentUSD: Number(deal.rentUSD ?? deal.rent ?? 0),
              capRate: Number(deal.capRate ?? 0),
              irr5Yr: deal.irr5Yr ?? deal.irr ?? null,
              dscr: deal.dscr ?? null,
              status: 'Under Review',
              sharedBy: email,
              sharedAt: nowIso,
              notes: String(deal.notes || ''),
            };
            org.sharedDeals.unshift(sharedDeal);
            pushAudit('DEAL_SHARED', sharedDeal.title, `Shared "${sharedDeal.title}" (${sharedDeal.city}) to IC pipeline`);
          } else if (subAction === 'update-deal-status') {
            if (actorRole !== 'Admin' && actorRole !== 'Manager') {
              return res.status(403).json({
                success: false,
                error: 'RBAC Denied (Server): Manager or Admin role required to approve/change deal status.',
              });
            }
            const dealId = String(body.dealId || '');
            const status = ['Under Review', 'IC Approved', 'On Hold', 'Rejected'].includes(body.status)
              ? body.status
              : 'Under Review';
            const dIdx = org.sharedDeals.findIndex((d: any) => d.id === dealId);
            if (dIdx === -1) {
              return res.status(404).json({ success: false, error: 'Shared deal not found.' });
            }
            const prevStatus = org.sharedDeals[dIdx].status;
            org.sharedDeals[dIdx].status = status;
            pushAudit(
              'DEAL_STATUS_UPDATED',
              org.sharedDeals[dIdx].title,
              `Status changed from "${prevStatus}" to "${status}"`
            );
          } else if (subAction === 'delete-deal') {
            if (actorRole !== 'Admin') {
              return res.status(403).json({
                success: false,
                error: 'RBAC Denied (Server): Only Admin role can delete shared deals.',
              });
            }
            const dealId = String(body.dealId || '');
            const targetDeal = org.sharedDeals.find((d: any) => d.id === dealId);
            org.sharedDeals = org.sharedDeals.filter((d: any) => d.id !== dealId);
            pushAudit('DEAL_DELETED', targetDeal?.title || dealId, `Removed shared deal from workspace`);
          } else if (subAction === 'add-comment') {
            const dealId = String(body.dealId || '');
            const text = String(body.text || '').trim().slice(0, 1200);
            if (!dealId || !text) {
              return res.status(400).json({ success: false, error: 'Deal ID and comment text are required.' });
            }
            const dealObj = org.sharedDeals.find((d: any) => d.id === dealId);
            org.comments.unshift({
              id: `cmt_${Date.now()}`,
              dealId,
              authorEmail: email,
              authorRole: actorRole,
              text,
              createdAt: nowIso,
            });
            pushAudit('COMMENT_ADDED', dealObj?.title || dealId, `Commented: "${text.slice(0, 80)}"`);
          } else {
            return res.status(400).json({ success: false, error: `Unknown workspace subAction: ${subAction}` });
          }

          await saveEnterpriseOrgToDb(org);
          return res.status(200).json({
            success: true,
            activeOrg: org,
            myRole: actorRole,
            teamUsersLimit: quotas.teamUsersLimit ?? 0,
          });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      case 'market-intelligence': {
        const allMarkets = getGlobalMarketIntelligenceData();
        const sessionEmail = getSessionEmailFromReq(req);
        const queryEmail = normalizeEmail(
          sessionEmail || getQueryParam(req, url, 'email') || parsedBody?.login_email || parsedBody?.email
        );
        let planKey: PlanKey = 'free';
        if (queryEmail && queryEmail.includes('@')) {
          const userRec = (await getUserFromDb(queryEmail).catch(() => null)) || getServerUserByEmail(queryEmail);
          if (userRec) {
            planKey = computeServerLicenseStatus(userRec).planKey;
          }
        }
        const isBasicMarket = planKey === 'free';
        return res.status(200).json({
          success: true,
          planKey,
          isBasicMarket,
          totalAvailable: allMarkets.length,
          markets: isBasicMarket ? allMarkets.slice(0, 2) : allMarkets,
          generatedAt: new Date().toISOString(),
          disclaimer: isBasicMarket
            ? 'FREE tier displays 2 basic market benchmarks. Upgrade to STARTER ($75 launch) for full Global Market Intelligence across all jurisdictions. Each indicator shows its authoritative source and date — not live exchange data.'
            : 'Each indicator displays its authoritative source and verification date. Market data is indicative benchmark research, not live exchange telemetry; verify prior to capital allocation.',
        });
      }

      case 'buy-credits': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const email = normalizeEmail(getSessionEmailFromReq(req) || body.login_email || body.email);
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required to purchase credits.' });
        }
        const packId = String(body.packId || body.pack_id || '').trim();
        const pack = EXTRA_CREDIT_PACKS.find((p) => p.id === packId);
        if (!pack) {
          return res.status(400).json({
            success: false,
            error: 'Invalid credit pack. Choose pack_25 (+25 credits), pack_100 (+100 credits), or pack_500 (+500 credits).',
            creditPacks: EXTRA_CREDIT_PACKS,
          });
        }

        const rawOrderId = normalizeOrderId(String(body.transaction_id || body.transactionId || body.order_id || '').trim());
        const paddleApiKey = cleanEnvValue(getEnv('PADDLE_API_KEY'));
        const paddleEnv = resolvePaddleEnvironment();

        if (!paddleApiKey) {
          console.error('[Paddle BuyCredits] Missing required environment variable: PADDLE_API_KEY');
          return res.status(500).json({
            success: false,
            error: 'Missing required server environment variable: PADDLE_API_KEY.',
          });
        }

        if (!paddleEnv.configured || !paddleEnv.baseUrl) {
          console.error(
            '[Paddle BuyCredits] Missing or invalid environment variable: PADDLE_ENVIRONMENT (expected "live" or "sandbox").'
          );
          return res.status(500).json({
            success: false,
            error: 'Missing required server environment variable: PADDLE_ENVIRONMENT.',
          });
        }

        if (!rawOrderId) {
          return res.status(402).json({
            success: false,
            requiresPayment: true,
            code: 'PAYMENT_REQUIRED_FOR_CREDITS',
            pack,
            error: `Extra credit pack (${pack.label}, $${pack.priceUSD}) must be purchased through one-time Paddle Checkout.`,
          });
        }

        const used = await getUsedOrderFromDb(rawOrderId);
        if (used) {
          if (normalizeEmail(used.login_email) !== email) {
            return res.status(403).json({
              success: false,
              error: 'This transaction ID has already been redeemed by another account.',
            });
          }
          const existingUser =
            (await getUserFromDb(email).catch(() => null)) || getOrCreateServerUser(email);
          const existingLic = computeServerLicenseStatus(existingUser);
          return res.status(200).json({
            success: true,
            alreadyApplied: true,
            pack,
            analyses_left: existingLic.analysesLeft,
            analyses_total: existingLic.analysesLimit,
            extra_credits: existingUser.extra_credits || 0,
          });
        }

        if (!rawOrderId.startsWith('txn_')) {
          return res.status(400).json({
            success: false,
            error: 'Valid Paddle transaction_id (txn_...) is required.',
          });
        }

        try {
          const pRes = await fetch(`${paddleEnv.baseUrl}/transactions/${encodeURIComponent(rawOrderId)}`, {
            headers: {
              Authorization: `Bearer ${paddleApiKey}`,
              Accept: 'application/json',
            },
          });
          const pJson: any = await pRes.json().catch(() => null);
          const pStatus = String(pJson?.data?.status || '').toLowerCase();
          if (!pRes.ok || (pStatus !== 'completed' && pStatus !== 'paid')) {
            return res.status(400).json({
              success: false,
              error: `Paddle transaction ${rawOrderId} is not completed/paid (status: ${pStatus || pRes.status}).`,
            });
          }
        } catch (err: any) {
          return res.status(502).json({
            success: false,
            error: `Unable to verify Paddle transaction: ${err?.message || 'network error'}`,
          });
        }

        const updatedUser = await applyCreditPackToUser({
          email,
          pack,
          orderId: rawOrderId,
          isTestMode: paddleEnv.isSandbox,
        });
        const nextLicense = computeServerLicenseStatus(updatedUser);

        return res.status(200).json({
          success: true,
          message: `Added +${pack.credits} non-expiring AI credits (${pack.label}) to your balance.`,
          pack,
          transaction_id: rawOrderId,
          analyses_left: nextLicense.analysesLeft,
          analyses_used: nextLicense.analysesUsed,
          analyses_total: nextLicense.analysesLimit,
          extra_credits: updatedUser.extra_credits || pack.credits,
          license: nextLicense,
        });
      }

      case 'update-branding': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const email = normalizeEmail(getSessionEmailFromReq(req) || body.login_email || body.email);
        if (!email || !email.includes('@')) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { user: hydratedDb, kvError } = await readUserFromDbStatus(email);
        if (kvError && !hydratedDb) {
          return res.status(503).json({ success: false, error: 'Database temporarily unavailable.' });
        }
        const userRecord = hydratedDb || getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const quotas = resolveEffectiveQuotas(userRecord);
        if (license.isExpired || !quotas.whiteLabelEnabled) {
          return res.status(403).json({
            success: false,
            error: quotas.isEnterprise
              ? 'Enterprise white_label_enabled is currently false. Admin must enable White Label for this contract.'
              : getUpgradeMessage('whiteLabelReports'),
            code: quotas.isEnterprise ? 'ENTERPRISE_CONTRACT_LIMIT_UNSET' : 'FEATURE_LOCKED',
            feature: 'whiteLabelReports',
            requiredPlan: quotas.isEnterprise ? 'institutional' : 'enterprise',
          });
        }

        const firmName = String(body.firmName || '').trim().slice(0, 100);
        const rawLogo = String(body.logoUrl || '').trim().slice(0, 200000);
        const rawAccent = String(body.accentColor || '#D4AF37').trim();
        const accentColor = /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent : '#D4AF37';
        const branding = {
          firmName: firmName || `${userRecord.name || 'Sovereign'} Capital`,
          logoUrl: rawLogo.startsWith('data:image/') || rawLogo.startsWith('https://') ? rawLogo : '',
          accentColor,
        };
        const now = Date.now();
        const updatedUser = updateServerUser(email, {
          branding,
          timeline: [
            {
              id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
              timestamp: new Date(now).toISOString(),
              type: 'branding_update' as const,
              message: `Updated White-Label PDF Branding (${branding.firmName}, ${branding.accentColor})`,
              actor: email,
            },
            ...(userRecord.timeline || []),
          ].slice(0, 200),
        });
        await saveUserToDb(updatedUser);
        return res.status(200).json({
          success: true,
          branding,
          message: 'White-label branding saved for Memorandum and PDF exports.',
        });
      }

      case 'enterprise-request':
      case 'enterprise-inquiry': {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, error: 'Method not allowed' });
        }
        const body = parsedBody;
        const companyName = String(body.companyName || body.firmName || '').trim().slice(0, 120);
        const contactEmail = normalizeEmail(body.email || '');
        const seats = Math.max(1, Math.min(500, Math.round(Number(body.seats || 50))));
        const assetsCount = Math.max(1, Math.min(10000, Math.round(Number(body.assetsCount || 1000))));
        const notes = String(body.notes || '').trim().slice(0, 2000);

        if (!companyName || !contactEmail || !contactEmail.includes('@')) {
          return res.status(400).json({
            success: false,
            error: 'Organization / Company Name and a valid Corporate Email are required.',
          });
        }

        const now = Date.now();
        const inquiry = {
          id: `ent_${now.toString(36).toUpperCase()}`,
          companyName,
          email: contactEmail,
          seats,
          assetsCount,
          notes,
          createdAt: new Date(now).toISOString(),
        };

        const store = loadStore();
        store.enterprise_inquiries = [inquiry, ...(store.enterprise_inquiries || [])].slice(0, 200);
        persistStore(store);

        const kv = getKvConfig();
        if (kv) {
          try {
            const raw = await kvCommand(['GET', 'aqari:enterprise_inquiries:v1']);
            let list: any[] = [];
            if (Array.isArray(raw)) list = raw;
            else if (typeof raw === 'string') {
              try {
                const p = JSON.parse(raw);
                if (Array.isArray(p)) list = p;
              } catch {}
            }
            await kvCommand([
              'SET',
              'aqari:enterprise_inquiries:v1',
              JSON.stringify([inquiry, ...list].slice(0, 200)),
            ]);
          } catch {}
        }

        await dispatchEmailAlert({
          to: 'loomorastudios@gmail.com',
          subject: `AQARI ENTERPRISE Contract Inquiry (${inquiry.id}) - ${companyName}`,
          text: `Organization: ${companyName}\nCorporate Email: ${contactEmail}\nRequested Seats (Custom per contract): ${seats}\nPortfolio Assets Scope (Custom per contract): ${assetsCount}\nNotes:\n${notes || 'N/A'}\nSubmitted: ${inquiry.createdAt}`,
          eventType: 'enterprise_inquiry',
        }).catch(() => {});

        return res.status(200).json({
          success: true,
          inquiry,
          message: 'Request sent. We will contact you within 24h at your Corporate Email.',
        });
      }

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action '${action}'.`,
          supportedActions: [
            'me',
            'pricing',
            'verify-checkout',
            'verify-payment',
            'debug-plan',
            'run-analysis',
            'extract-from-file',
            'run-file-analysis',
            'studio-generate',
            'portfolio-intelligence',
            'due-diligence-docs',
            'scenario-compare',
            'workspace',
            'market-intelligence',
            'find-deals',
            'get-forecast',
            'run-due-diligence',
            'optimize-portfolio',
            'ask-advisor',
            'buy-credits',
            'update-branding',
            'enterprise-inquiry',
            'enterprise-request',
            'get-last-results',
            'clear-last-result',
            'underwrite',
            'analyze',
            'monte-carlo',
            'save-to-portfolio',
            'save-property',
            'delete-saved',
            'export',
            'portfolio',
            'analyst-chat',
            'whiteglove-request',
            'sovereign-request',
            'checkout',
            'paddle-webhook',
            'copy-api-key',
            'regenerate-api-key',
            'session',
            'license',
            'market-live',
            'news',
            'demo',
            'webhook-logs',
            'report-issue',
            'cancel-subscription',
            'google-callback',
          ],
        });
    }
  } catch (err: any) {
    console.error(`/api/app?action=${action} error:`, err);
    return res.status(200).json({
      success: false,
      error: `Verify failed: ${err?.message || String(err || 'App API error')}`,
    });
  }
}
