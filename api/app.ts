// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// =========================================================================
// 1. INLINED PLANS & TIER MAPPING (Zero external ../lib imports)
// =========================================================================

const PLANS = {
  STARTER: { price: 79, analyses: 30, name: 'STARTER' },
  PROFESSIONAL: { price: 199, analyses: 150, name: 'PROFESSIONAL' },
  SOVEREIGN: { price: 599, analyses: 400, name: 'SOVEREIGN' },
} as const;

function planFromAmount(amount: any) {
  const num = Number(amount || 0);
  if (num >= 500) return PLANS.SOVEREIGN;
  if (num >= 150) return PLANS.PROFESSIONAL;
  if (num >= 50) return PLANS.STARTER;
  return PLANS.PROFESSIONAL;
}

type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise';

type GatedFeature =
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

interface PlanDefinition {
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  originalPrice: number;
  launchPrice: number;
  priceUSD: number;
  analysesLimit: number;
  savedLimit: number;
  licensingDays: number;
  features: string[];
  hiddenFeatures: string[];
  capabilities: Record<GatedFeature, boolean>;
}

interface DynamicPlanPublic {
  id?: PlanKey;
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  originalPrice: number;
  launchPrice: number;
  activePrice: number;
  analyses?: number;
  analysesLimit: number;
  saved?: number | null;
  savedLimit: number | null;
  features: string[];
  launchDiscountActive?: boolean;
}

interface PricingPublicPayload {
  success?: boolean;
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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LAUNCH_BADGE = 'LAUNCH -40% - First 30 users only';

const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
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
    launchPrice: PLANS.STARTER.price,
    priceUSD: PLANS.STARTER.price,
    analysesLimit: PLANS.STARTER.analyses,
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
    launchPrice: PLANS.PROFESSIONAL.price,
    priceUSD: PLANS.PROFESSIONAL.price,
    analysesLimit: PLANS.PROFESSIONAL.analyses,
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
    launchPrice: PLANS.SOVEREIGN.price,
    priceUSD: PLANS.SOVEREIGN.price,
    analysesLimit: PLANS.SOVEREIGN.analyses,
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

function normalizePlanKey(raw?: string | null): PlanKey {
  const val = (raw || '').toLowerCase().trim();
  if (val === 'starter' || val === 'standard') return 'starter';
  if (val === 'pro' || val === 'professional') return 'pro';
  if (val === 'enterprise' || val === 'sovereign' || val === 'agency') return 'enterprise';
  return 'free';
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
  const hasPaidEnd = Boolean(rawPlanKey !== 'free' && params.licenseEnd);
  const isExpired = Boolean(hasPaidEnd && params.licenseEnd! <= now);

  const effectivePlanKey: PlanKey = isExpired ? 'free' : rawPlanKey;
  const planCfg = PLAN_DEFINITIONS[effectivePlanKey];
  const effectiveAnalysesLimit =
    typeof params.analysesLimitOverride === 'number' && params.analysesLimitOverride > 0
      ? params.analysesLimitOverride
      : planCfg.analysesLimit;
  const effectiveSavedLimit =
    typeof params.savedLimitOverride === 'number' ? params.savedLimitOverride : planCfg.savedLimit;

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

function getAdminEmail(): string {
  return (cleanEnvValue(getEnv('ADMIN_EMAIL')) || 'loomora.studios@gmail.com').toLowerCase();
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
  lemonCustomerEmail?: string | null;
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
  return (
    norm === getAdminEmail() ||
    norm === 'loomora.studios@gmail.com' ||
    norm === 'loomorastudios@gmail.com'
  );
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
  plan: PlanKey;
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
    | 'expired';
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

interface ServerUserRecord {
  email: string;
  name: string;
  plan: PlanKey;
  license_start: number | null;
  license_end: number | null;
  analyses_used: number;
  saved_analyses: any[];
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
  lemon_customer_email: string | null;
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
  plan_display: 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  analyses: number;
  amount: number;
  test_mode: boolean;
  used_at: number;
}

interface StoredPlanConfig {
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  originalPrice: number;
  launchPrice: number;
  analysesLimit: number;
  savedLimit: number | null;
  features: string[];
}

interface StoredPricingConfig {
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
  pricing_config: StoredPricingConfig;
  pricing_logs: any[];
  pending_checkouts: Record<string, PendingCheckoutEntry>;
  used_orders: Record<string, UsedOrderRecord>;
}

function createDefaultPricingConfig(): StoredPricingConfig {
  const now = Date.now();
  return {
    launchDiscountActive: true,
    launchBadgeText: DEFAULT_LAUNCH_BADGE,
    launchEndsAt: now + 7 * 24 * 60 * 60 * 1000,
    updatedAt: now,
    plans: {
      free: {
        key: 'free',
        displayName: 'FREE',
        originalPrice: PLAN_DEFINITIONS.free.originalPrice,
        launchPrice: PLAN_DEFINITIONS.free.launchPrice,
        analysesLimit: PLAN_DEFINITIONS.free.analysesLimit,
        savedLimit: PLAN_DEFINITIONS.free.savedLimit,
        features: [...PLAN_DEFINITIONS.free.features],
      },
      starter: {
        key: 'starter',
        displayName: 'STARTER',
        originalPrice: PLAN_DEFINITIONS.starter.originalPrice,
        launchPrice: PLAN_DEFINITIONS.starter.launchPrice,
        analysesLimit: PLAN_DEFINITIONS.starter.analysesLimit,
        savedLimit: PLAN_DEFINITIONS.starter.savedLimit,
        features: [...PLAN_DEFINITIONS.starter.features],
      },
      pro: {
        key: 'pro',
        displayName: 'PROFESSIONAL',
        originalPrice: PLAN_DEFINITIONS.pro.originalPrice,
        launchPrice: PLAN_DEFINITIONS.pro.launchPrice,
        analysesLimit: PLAN_DEFINITIONS.pro.analysesLimit,
        savedLimit: PLAN_DEFINITIONS.pro.savedLimit,
        features: [...PLAN_DEFINITIONS.pro.features],
      },
      enterprise: {
        key: 'enterprise',
        displayName: 'SOVEREIGN',
        originalPrice: PLAN_DEFINITIONS.enterprise.originalPrice,
        launchPrice: PLAN_DEFINITIONS.enterprise.launchPrice,
        analysesLimit: PLAN_DEFINITIONS.enterprise.analysesLimit,
        savedLimit: null,
        features: [...PLAN_DEFINITIONS.enterprise.features],
      },
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
      pricing_config: createDefaultPricingConfig(),
      pricing_logs: [],
      pending_checkouts: {},
      used_orders: {},
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

function hydrateUserRecord(raw: any, email: string): ServerUserRecord {
  const now = Date.now();
  return {
    email,
    name: raw?.name || email.split('@')[0],
    plan: normalizePlanKey(raw?.plan),
    license_start: raw?.license_start ?? now,
    license_end: raw?.license_end ?? now + THIRTY_DAYS_MS,
    analyses_used: Math.max(0, Number(raw?.analyses_used ?? 0)),
    saved_analyses: Array.isArray(raw?.saved_analyses) ? raw.saved_analyses : [],
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
    lemon_customer_email: raw?.lemon_customer_email
      ? String(raw.lemon_customer_email).toLowerCase()
      : null,
  };
}

function hydratePricingConfig(raw: any): StoredPricingConfig {
  const def = createDefaultPricingConfig();
  if (!raw || typeof raw !== 'object') return def;
  const plans = { ...def.plans };
  for (const k of ['free', 'starter', 'pro', 'enterprise'] as PlanKey[]) {
    const r = raw.plans?.[k];
    if (r && typeof r === 'object') {
      plans[k] = {
        key: k,
        displayName: def.plans[k].displayName,
        originalPrice: Number.isFinite(Number(r.originalPrice))
          ? Number(r.originalPrice)
          : def.plans[k].originalPrice,
        launchPrice: Number.isFinite(Number(r.launchPrice))
          ? Number(r.launchPrice)
          : def.plans[k].launchPrice,
        analysesLimit:
          Number.isFinite(Number(r.analysesLimit)) && Number(r.analysesLimit) > 0
            ? Number(r.analysesLimit)
            : def.plans[k].analysesLimit,
        savedLimit:
          r.savedLimit === null
            ? null
            : Number.isFinite(Number(r.savedLimit))
            ? Number(r.savedLimit)
            : def.plans[k].savedLimit,
        features:
          Array.isArray(r.features) && r.features.length > 0
            ? r.features.map(String)
            : def.plans[k].features,
      };
    }
  }
  return {
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
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
  } finally {
    clearTimeout(timer);
  }
}

function getPricingPublicPayload(): PricingPublicPayload {
  const store = loadStore();
  const cfg = store.pricing_config || createDefaultPricingConfig();
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((cfg.launchEndsAt - now) / (24 * 60 * 60 * 1000)));
  const plansMap = {} as Record<PlanKey, DynamicPlanPublic>;
  const plansList: DynamicPlanPublic[] = [];

  for (const k of ['free', 'starter', 'pro', 'enterprise'] as PlanKey[]) {
    const p = cfg.plans[k];
    const entry: DynamicPlanPublic = {
      id: k,
      key: k,
      displayName: p.displayName,
      originalPrice: p.originalPrice,
      launchPrice: p.launchPrice,
      activePrice: k === 'free' ? 0 : cfg.launchDiscountActive ? p.launchPrice : p.originalPrice,
      analyses: p.analysesLimit,
      analysesLimit: p.analysesLimit,
      saved: p.savedLimit,
      savedLimit: p.savedLimit,
      features: [...p.features],
      launchDiscountActive: cfg.launchDiscountActive,
    };
    plansMap[k] = entry;
    plansList.push(entry);
  }
  return {
    success: true,
    launchDiscountActive: cfg.launchDiscountActive,
    launchBadgeText: cfg.launchBadgeText,
    launchEndsAt: cfg.launchEndsAt,
    daysRemaining,
    updatedAt: cfg.updatedAt,
    plans: plansList,
    plansMap,
  };
}

function enforceServerUserExpiry(rawEmail: string): ServerUserRecord {
  const store = loadStore();
  const email = normalizeEmail(rawEmail) || 'guest@aqari-ai-rho.vercel.app';
  const user = store.users[email];
  const now = Date.now();

  if (!user) {
    return getOrCreateServerUser(email);
  }

  if (user.plan !== 'free' && user.license_end && now >= user.license_end) {
    const prevPlan = PLAN_DEFINITIONS[user.plan].displayName;
    user.plan = 'free';
    user.analyses_used = 0;
    user.license_start = now;
    user.license_end = now + THIRTY_DAYS_MS;
    user.day29_email_sent = false;
    user.updated_at = now;
    user.timeline.unshift({
      id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(now).toISOString(),
      type: 'expired',
      message: `30-day ${prevPlan} license expired -> auto-downgraded to FREE`,
      actor: 'system',
    });
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
  const updated: ServerUserRecord = {
    ...existing,
    ...patch,
    email: norm,
    updated_at: Date.now(),
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
  lemonCustomerEmail?: string | null;
}): ServerUserRecord {
  const now = params.paymentTimestamp || Date.now();
  const licenseStart = now;
  const licenseEnd = now + THIRTY_DAYS_MS;
  const existing = getOrCreateServerUser(params.email, { name: params.name });
  const pricing = getPricingPublicPayload();
  const dynamicPlan = pricing.plansMap?.[params.plan];
  const planCfg = PLAN_DEFINITIONS[params.plan];
  const amount = params.amountUSD ?? dynamicPlan?.activePrice ?? planCfg.launchPrice;
  const orderId = params.orderId || `ord_${now}`;
  const iso = new Date(now).toISOString();

  const resolvedLockedLaunch =
    typeof params.lockedLaunchPrice === 'number'
      ? params.lockedLaunchPrice
      : pricing.launchDiscountActive && params.plan !== 'free'
      ? dynamicPlan?.launchPrice ?? amount
      : existing.locked_launch_price;

  const alreadyRecorded = existing.payments.some((p) => p.order_id === orderId);

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
          message: `Purchased ${planCfg.displayName} $${amount} - Order #${orderId} (${
            params.testMode ? 'TEST' : 'LIVE'
          })${resolvedLockedLaunch ? ` - Locked Launch Price $${resolvedLockedLaunch}` : ''}`,
          actor: existing.email,
        },
        ...existing.timeline,
      ];

  return updateServerUser(params.email, {
    name: params.name || existing.name,
    plan: params.plan,
    license_start: licenseStart,
    license_end: licenseEnd,
    analyses_used: 0,
    day29_email_sent: false,
    expired_email_sent: false,
    total_paid_usd: alreadyRecorded ? existing.total_paid_usd : existing.total_paid_usd + amount,
    refund_policy_accepted_at:
      params.refundPolicyAcceptedAt || existing.refund_policy_accepted_at || iso,
    locked_launch_price: resolvedLockedLaunch ?? null,
    lemon_customer_email: params.lemonCustomerEmail
      ? normalizeEmail(params.lemonCustomerEmail)
      : existing.lemon_customer_email || null,
    payments,
    timeline: timeline.slice(0, 200),
  });
}

function recordUserAnalysis(
  email: string,
  entry: Omit<ForensicAnalysisEntry, 'id' | 'timestamp'>
): ServerUserRecord {
  const user = getOrCreateServerUser(email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const analysisNum = user.analyses_used + 1;
  const logEntry: ForensicAnalysisEntry = {
    id: `ana_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    ...entry,
  };
  const timelineEntry: ForensicTimelineEntry = {
    id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    type: 'analysis',
    message: `Analysis #${analysisNum} - ${entry.property} (${entry.city}) - ${entry.resultSummary}`,
    actor: user.email,
  };

  return updateServerUser(user.email, {
    analyses_used: analysisNum,
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
  const planKey = normalizePlanKey(user.plan);
  const dynamicPlan = pricing.plansMap?.[planKey];
  return computeLicenseStatus({
    plan: user.plan,
    licenseStart: user.license_start,
    licenseEnd: user.license_end,
    analysesUsed: user.analyses_used,
    analysesLimitOverride: dynamicPlan?.analysesLimit,
    savedLimitOverride: dynamicPlan?.savedLimit === null ? Infinity : dynamicPlan?.savedLimit,
  });
}

async function saveUserToDb(user: ServerUserRecord): Promise<void> {
  try {
    const kv = getKvConfig();
    if (kv && user?.email) {
      await kvCommand(['SET', `aqari:user:${normalizeEmail(user.email)}`, JSON.stringify(user)]);
    }
  } catch (kvErr) {
    console.error('[DB] Failed saving user to KV store:', kvErr);
  }
}

async function getUserFromDb(rawEmail: string): Promise<ServerUserRecord | null> {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
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
        return enforceServerUserExpiry(email);
      }
    }
  } catch (kvErr) {
    console.error('[DB] Failed reading user from KV store:', kvErr);
  }
  return getServerUserByEmail(email);
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
  amountUSD: number,
  fallbackPlan?: PlanKey
): {
  plan: PlanKey;
  planDisplay: 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  analyses: number;
} {
  const numericAmount = Number(amountUSD || 0);
  const rounded = Math.round(numericAmount);
  let plan: PlanKey = fallbackPlan && fallbackPlan !== 'free' ? fallbackPlan : 'pro';

  if (numericAmount > 0) {
    const fromAmt = planFromAmount(rounded);
    if (fromAmt.name === 'SOVEREIGN') plan = 'enterprise';
    else if (fromAmt.name === 'STARTER') plan = 'starter';
    else plan = 'pro';
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
  last_updated: number;
  last_synced_iso: string;
  last_synced_display: string;
  cache_ttl_hours: number;
  stale: boolean;
}

const MARKET_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cachedMarketResponse: LiveMarketResponse | null = null;
let cachedMarketAt = 0;

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
      'Up to 50 Saved Portfolio Properties',
    ],
    featuresLocked: [
      'Monte Carlo 200-Simulation Stochastic Engine (Pro)',
      'Interest Rate Shock (+200bps) Stress Test (Pro)',
      'PDF Investment Memorandum Generation (Pro)',
      'Real-Time Rest API & Multi-Jurisdiction Feeds (Agency)',
    ],
    watermarkNote: 'SAMPLE STANDARD TIER ANALYSIS • SIGN IN TO RUN UNLIMITED UNDERWRITINGS',
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
      'Save up to 200 Institutional Properties',
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
      'Unlimited Underwriting Dossiers & Syndicate Aggregation',
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
      'Unlimited Institutional Analysis Access',
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
// 5. LEMON SQUEEZY CHECKOUT HELPERS
// =========================================================================

function getVariantIds(): Record<'starter' | 'pro' | 'enterprise', string> {
  return {
    starter: getEnv('LEMON_STARTER_VARIANT_ID') || 'da826632-dcb4-4885-966e-aac1fab84cb3',
    pro: getEnv('LEMON_PRO_VARIANT_ID') || '404c54cb-29c5-477a-b8c2-772092f5459a',
    enterprise: getEnv('LEMON_SOVEREIGN_VARIANT_ID') || 'ce8dfbdb-cedd-4445-a947-e821522472bb',
  };
}

const BUY_URLS: Record<'starter' | 'pro' | 'enterprise', string> = {
  starter: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/da826632-dcb4-4885-966e-aac1fab84cb3',
  pro: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/404c54cb-29c5-477a-b8c2-772092f5459a',
  enterprise: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/ce8dfbdb-cedd-4445-a947-e821522472bb',
};

const VARIANT_ID_TO_PLAN: Record<string, PlanKey> = {
  'da826632-dcb4-4885-966e-aac1fab84cb3': 'starter',
  '404c54cb-29c5-477a-b8c2-772092f5459a': 'pro',
  'ce8dfbdb-cedd-4445-a947-e821522472bb': 'enterprise',
};

const SUCCESS_REDIRECT = 'https://aqari-ai-rho.vercel.app/app?checkout=success';
const CANCEL_REDIRECT = 'https://aqari-ai-rho.vercel.app/pricing?checkout=cancelled';

function resolvePlanFromLemonAttributes(attrs: any, fallbackPlan?: PlanKey): PlanKey {
  const variantId = String(attrs?.first_order_item?.variant_id || attrs?.variant_id || '').trim();
  const productId = String(attrs?.first_order_item?.product_id || attrs?.product_id || '').trim();

  if (variantId && getEnv('LEMON_STARTER_VARIANT_ID') && variantId === getEnv('LEMON_STARTER_VARIANT_ID')) return 'starter';
  if (variantId && getEnv('LEMON_PRO_VARIANT_ID') && variantId === getEnv('LEMON_PRO_VARIANT_ID')) return 'pro';
  if (variantId && getEnv('LEMON_SOVEREIGN_VARIANT_ID') && variantId === getEnv('LEMON_SOVEREIGN_VARIANT_ID')) return 'enterprise';
  if (productId && getEnv('LEMON_STARTER_PRODUCT_ID') && productId === getEnv('LEMON_STARTER_PRODUCT_ID')) return 'starter';
  if (productId && getEnv('LEMON_PRO_PRODUCT_ID') && productId === getEnv('LEMON_PRO_PRODUCT_ID')) return 'pro';
  if (productId && getEnv('LEMON_SOVEREIGN_PRODUCT_ID') && productId === getEnv('LEMON_SOVEREIGN_PRODUCT_ID')) return 'enterprise';
  if (variantId && VARIANT_ID_TO_PLAN[variantId]) return VARIANT_ID_TO_PLAN[variantId];

  const totalUSD = attrs?.total ? Number(attrs.total) / 100 : Number(attrs?.subtotal || 0) / 100;
  if (totalUSD >= 500) return 'enterprise';
  if (totalUSD >= 150) return 'pro';
  if (totalUSD >= 50) return 'starter';

  const s = `${attrs?.first_order_item?.product_name || ''} ${attrs?.first_order_item?.variant_name || ''} ${attrs?.product_name || ''} ${attrs?.variant_name || ''}`.toLowerCase();
  if (s.includes('sovereign') || s.includes('enterprise') || s.includes('agency') || s.includes('599') || s.includes('999')) {
    return 'enterprise';
  }
  if (s.includes('pro') || s.includes('professional') || s.includes('199') || s.includes('349')) {
    return 'pro';
  }
  if (s.includes('starter') || s.includes('79') || s.includes('129')) {
    return 'starter';
  }

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
            'debug-plan',
            'underwrite',
            'save-property',
            'export',
            'portfolio',
            'checkout',
            'session',
            'license',
            'market-live',
            'news',
            'demo',
            'webhook-logs',
            'city-search',
            'city-analyze',
            'macro-sync',
            'google-callback',
            'nextauth',
          ],
        });
      }

      case 'me': {
        res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
        const sessionEmail = getSessionEmailFromReq(req);
        if (!sessionEmail) {
          return res.status(401).json({
            authenticated: false,
            error: 'Authentication required',
          });
        }

        const hydratedDb = await getUserFromDb(sessionEmail);
        const initialUser = hydratedDb || getOrCreateServerUser(sessionEmail);
        let dbUser = enforceServerUserExpiry(initialUser.email);

        const ent = getEntitlementFromReq(req);
        if (
          ent &&
          ent.email === dbUser.email &&
          ent.plan !== 'free' &&
          ent.licenseEnd > Date.now() &&
          dbUser.plan === 'free'
        ) {
          dbUser = activatePaidPlanOnServer({
            email: dbUser.email,
            name: dbUser.name,
            plan: ent.plan,
            paymentTimestamp: ent.licenseStart,
            orderId: ent.orderId,
            amountUSD: ent.amountUSD,
            testMode: ent.testMode,
            lemonCustomerEmail: ent.lemonCustomerEmail || null,
          });
          await saveUserToDb(dbUser);
        }

        const license = computeServerLicenseStatus(dbUser);
        const pricing = getPricingPublicPayload();
        const dynamicPlan = findPlanPricing(pricing, license.planKey);
        const features = dynamicPlan?.features || PLAN_DEFINITIONS[license.planKey].features;

        return res.status(200).json({
          success: true,
          authenticated: true,
          email: dbUser.email,
          login_email: dbUser.email,
          lemon_customer_email: dbUser.lemon_customer_email || null,
          name: dbUser.name,
          isAdmin: isAdminEmail(dbUser.email),
          plan: license.displayName,
          planKey: license.planKey,
          license_start: dbUser.license_start,
          license_end: dbUser.license_end,
          days_left: license.daysLeft,
          analyses_limit: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit,
          analyses_used: license.analysesUsed,
          analyses_left: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLeft,
          saved_limit: license.isUnlimitedSaved ? 'Unlimited' : license.savedLimit,
          locked_launch_price: dbUser.locked_launch_price ?? null,
          custom_cities: dbUser.custom_cities || [],
          features,
          capabilities: PLAN_DEFINITIONS[license.planKey].capabilities,
          user: {
            email: dbUser.email,
            login_email: dbUser.email,
            lemon_customer_email: dbUser.lemon_customer_email || null,
            name: dbUser.name,
            plan: dbUser.plan,
            license_start: dbUser.license_start,
            license_end: dbUser.license_end,
            analyses_used: dbUser.analyses_used,
            locked_launch_price: dbUser.locked_launch_price ?? null,
            custom_cities: dbUser.custom_cities || [],
          },
          license,
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

      case 'verify-checkout': {
        try {
          res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
        } catch {}

        let orderId = '';
        const candidateKeys = Array.from(
          new Set(
            [
              cleanEnvValue(getEnv('LEMONSQUEEZY_API_KEY')),
              cleanEnvValue(getEnv('LEMON_API_KEY')),
              cleanEnvValue(getEnv('LEMON_TEST_API_KEY')),
            ].filter(Boolean)
          )
        );
        const hasLemonKey = candidateKeys.length > 0;

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

          const rawOrderParam = String(src?.order_id || src?.order || '').trim();
          const lowerOrderParam = rawOrderParam.toLowerCase();
          const isFallbackMode =
            !rawOrderParam ||
            lowerOrderParam === 'last' ||
            lowerOrderParam === 'not found' ||
            !cleanPlaceholderOrderId(rawOrderParam);
          const isExplicitLastRequest = lowerOrderParam === 'last';
          orderId = isFallbackMode ? '' : cleanPlaceholderOrderId(rawOrderParam);

          const pricing = getPricingPublicPayload();

          const completeActivation = async (params: {
            resolvedOrderId: string;
            amountUSD: number;
            fallbackPlan?: PlanKey;
            paymentEmail: string;
            testMode: boolean;
            createdAtIso?: string;
            skipWebhookLogAppend?: boolean;
          }) => {
            const tier = mapAmountOrPlanToOrderTier(params.amountUSD, params.fallbackPlan);
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
              lemonCustomerEmail: params.paymentEmail || null,
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
                lemonCustomerEmail: params.paymentEmail || null,
              });
            } catch {}

            const license = computeServerLicenseStatus(dbUser);
            const features =
              findPlanPricing(pricing, tier.plan)?.features || PLAN_DEFINITIONS[tier.plan].features;

            return res.status(200).json({
              success: true,
              verified: true,
              plan: tier.planDisplay,
              planKey: tier.plan,
              analyses_left: tier.analyses,
              payment_email_for_log_only: params.paymentEmail || null,
              order_id: params.resolvedOrderId,
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
            if (existingUser.plan === 'free') {
              existingUser = activatePaidPlanOnServer({
                email: loginEmail,
                name: existingUser.name,
                plan: existingUsedOrder.plan,
                paymentTimestamp: existingUsedOrder.used_at || Date.now(),
                orderId: existingUsedOrder.order_id,
                amountUSD: existingUsedOrder.amount,
                currency: 'USD',
                testMode: Boolean(existingUsedOrder.test_mode),
                lemonCustomerEmail: existingUsedOrder.payment_email || null,
              });
              await saveUserToDb(existingUser).catch(() => {});
            }
            const usedPlanKey = normalizePlanKey(existingUsedOrder.plan);
            const license = computeServerLicenseStatus(existingUser);
            const features =
              findPlanPricing(pricing, usedPlanKey)?.features || PLAN_DEFINITIONS[usedPlanKey].features;
            try {
              setSessionCookie(res, existingUser.email);
              setEntitlementCookie(res, {
                email: existingUser.email,
                plan: existingUsedOrder.plan,
                orderId: existingUsedOrder.order_id,
                licenseStart: existingUser.license_start || Date.now(),
                licenseEnd: existingUser.license_end || Date.now() + THIRTY_DAYS_MS,
                amountUSD: existingUsedOrder.amount,
                testMode: Boolean(existingUsedOrder.test_mode),
                lemonCustomerEmail: existingUsedOrder.payment_email || null,
              });
            } catch {}

            return res.status(200).json({
              success: true,
              verified: true,
              plan: existingUsedOrder.plan_display,
              planKey: existingUsedOrder.plan,
              analyses_left: existingUsedOrder.analyses,
              payment_email_for_log_only: existingUsedOrder.payment_email || null,
              order_id: existingUsedOrder.order_id,
              login_email: existingUser.email,
              license_end: existingUser.license_end,
              user: existingUser,
              license,
              features,
            });
          };

          if (isFallbackMode) {
            const isValidWebhookOrderEntry = (entry: any): string => {
              if (!entry || typeof entry !== 'object') return '';
              const ev = String(entry?.event || entry?.event_name || '').trim().toLowerCase();
              if (ev && ev !== 'order_created' && ev !== 'subscription_created' && ev !== 'checkout_verify_api') {
                return '';
              }
              const oid = cleanPlaceholderOrderId(entry?.order_id);
              if (
                !oid ||
                oid === 'key_missing' ||
                oid === 'not_found' ||
                oid === 'invalid_api_key' ||
                oid.startsWith('ord_')
              ) {
                return '';
              }
              return oid;
            };

            const recentLogs = await getWebhookLogsFromDb(100).catch(() => []);
            const logsArr = Array.isArray(recentLogs) ? recentLogs : [];

            let matchedLog: any = logsArr.find((entry) => {
              const oid = isValidWebhookOrderEntry(entry);
              if (!oid) return false;
              const e1 = String(entry?.email || '').trim().toLowerCase();
              const e2 = String(entry?.payment_email || '').trim().toLowerCase();
              return e1 === loginEmail || e2 === loginEmail;
            });

            if (!matchedLog && isExplicitLastRequest) {
              for (const entry of logsArr) {
                const oid = isValidWebhookOrderEntry(entry);
                if (!oid) continue;
                const usedCheck = await getUsedOrderFromDb(oid).catch(() => null);
                if (!usedCheck) {
                  matchedLog = entry;
                  break;
                }
              }
            }

            if (!matchedLog) {
              return res.status(200).json({
                success: false,
                error: `No order found in webhook-logs for ${loginEmail}. Pay first, then click USE LAST ORDER.`,
              });
            }

            orderId = cleanPlaceholderOrderId(matchedLog.order_id);
            console.log(`order_id from webhook-logs fallback: ${orderId}`);

            const existingUsedOrder = await getUsedOrderFromDb(orderId).catch(() => null);
            if (existingUsedOrder) {
              return await returnExistingUsedOrder(existingUsedOrder);
            }

            const logAmount = Number(matchedLog?.amount ?? 0);
            const logPlan = normalizePlanKey(matchedLog?.plan);
            const fallbackAmount =
              Number.isFinite(logAmount) && logAmount > 0
                ? logAmount
                : logPlan === 'enterprise'
                ? PLANS.SOVEREIGN.price
                : logPlan === 'starter'
                ? PLANS.STARTER.price
                : PLANS.PROFESSIONAL.price;
            const logPaymentEmail = String(matchedLog?.payment_email || matchedLog?.email || '')
              .trim()
              .toLowerCase();

            return await completeActivation({
              resolvedOrderId: orderId,
              amountUSD: fallbackAmount,
              fallbackPlan: logPlan !== 'free' ? logPlan : 'pro',
              paymentEmail: logPaymentEmail,
              testMode: Boolean(matchedLog?.test_mode),
              createdAtIso: matchedLog?.created_at || matchedLog?.timestamp,
              skipWebhookLogAppend: true,
            });
          }

          const existingUsedOrder = await getUsedOrderFromDb(orderId).catch(() => null);
          if (existingUsedOrder) {
            return await returnExistingUsedOrder(existingUsedOrder);
          }

          if (!hasLemonKey) {
            return res.status(200).json({
              success: false,
              error: 'LEMONSQUEEZY_API_KEY missing in Vercel - Add it and Redeploy',
            });
          }

          let verifiedAttrs: any = null;
          let verifiedOrderData: any = null;
          let lemonIncluded: any[] = [];
          let lastLemonError = '';

          for (const apiKey of candidateKeys) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
              const orderRes = await fetch(
                `https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(orderId)}`,
                {
                  headers: {
                    Accept: 'application/vnd.api+json',
                    Authorization: `Bearer ${apiKey}`,
                  },
                  signal: controller.signal,
                }
              );

              if (orderRes.status === 404) {
                lastLemonError = `Order not found in Lemon: ${orderId}`;
                continue;
              }
              if (orderRes.status === 401) {
                lastLemonError = 'Lemon API key invalid - Check LEMONSQUEEZY_API_KEY';
                continue;
              }

              const rawText = await orderRes.text();
              let parsed: any = {};
              try {
                parsed = rawText ? JSON.parse(rawText) : {};
              } catch {
                parsed = {};
              }

              if (orderRes.ok && parsed?.data?.attributes) {
                verifiedOrderData = parsed.data;
                verifiedAttrs = parsed.data.attributes;
                lemonIncluded = Array.isArray(parsed.included) ? parsed.included : [];
                break;
              }

              const lemonDetail =
                parsed?.errors?.[0]?.detail ||
                parsed?.errors?.[0]?.title ||
                parsed?.message ||
                orderRes.statusText ||
                `HTTP ${orderRes.status}`;
              lastLemonError = `Lemon API (${orderRes.status}): ${lemonDetail}`;
            } catch (fetchErr: any) {
              lastLemonError = `Lemon API request failed: ${fetchErr?.message || String(fetchErr)}`;
            } finally {
              clearTimeout(timer);
            }
          }

          if (!verifiedAttrs) {
            await appendWebhookLogToDb({
              order_id: orderId,
              event: 'checkout_verify_failed',
              event_name: 'checkout_verify_failed',
              plan: 'free',
              email: loginEmail,
              amount: 0,
              currency: 'USD',
              test_mode: getEnv('LEMON_TEST_MODE') === 'true',
              signature_valid: false,
              raw_error: lastLemonError || `Order not found in Lemon: ${orderId}`,
              error: lastLemonError || `Order not found in Lemon: ${orderId}`,
            }).catch(() => {});
            return res.status(200).json({
              success: false,
              error: lastLemonError || `Order not found in Lemon: ${orderId}`,
            });
          }

          const orderStatus = String(verifiedAttrs?.status || '').trim().toLowerCase();
          const firstItemStatus = String(
            verifiedAttrs?.first_order_item?.status ||
              lemonIncluded.find((i: any) => i?.type === 'order-items')?.attributes?.status ||
              ''
          )
            .trim()
            .toLowerCase();

          const isPaid =
            orderStatus === 'paid' ||
            orderStatus === 'completed' ||
            firstItemStatus === 'paid' ||
            firstItemStatus === 'completed';

          if (!isPaid) {
            const unpaidMsg = `Order #${orderId} status is '${verifiedAttrs?.status || 'unknown'}' (not paid)`;
            return res.status(200).json({
              success: false,
              error: unpaidMsg,
            });
          }

          const rawTotalCents = Number(verifiedAttrs?.total ?? verifiedAttrs?.subtotal ?? 0);
          const amountUSD =
            Number.isFinite(rawTotalCents) && rawTotalCents > 0
              ? rawTotalCents / 100
              : PLANS.PROFESSIONAL.price;
          const fallbackPlan = resolvePlanFromLemonAttributes(verifiedAttrs, 'pro');
          const testMode = Boolean(verifiedAttrs?.test_mode);
          const paymentEmailForLogOnly = String(
            verifiedAttrs?.user_email ||
              verifiedAttrs?.customer_email ||
              verifiedAttrs?.checkout_data?.email ||
              ''
          )
            .trim()
            .toLowerCase();

          return await completeActivation({
            resolvedOrderId: String(verifiedOrderData?.id || orderId),
            amountUSD,
            fallbackPlan,
            paymentEmail: paymentEmailForLogOnly,
            testMode,
            createdAtIso: verifiedAttrs?.created_at,
          });
        } catch (err: any) {
          console.error('[verify-checkout] Unhandled error (returning HTTP 200):', err);
          return res.status(200).json({
            success: false,
            error: `Verify failed: ${err?.message || String(err || 'Unknown error')} | order_id:${orderId || 'none'} | has_lemon_key:${hasLemonKey}`,
          });
        }
      }

      case 'debug-plan': {
        const sessionEmail = getSessionEmailFromReq(req);
        const isProd =
          getEnv('VERCEL_ENV') === 'production' ||
          (getEnv('NODE_ENV') === 'production' && getEnv('LEMON_TEST_MODE') !== 'true');

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

        const userRecord = getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const pricing = getPricingPublicPayload();

        return res.status(200).json({
          email: userRecord.email,
          plan: license.displayName,
          planKey: license.planKey,
          license_start: userRecord.license_start,
          license_end: userRecord.license_end,
          analyses_used: license.analysesUsed,
          analyses_left: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLeft,
          days_left: license.daysLeft,
          locked_launch_price: userRecord.locked_launch_price ?? null,
          features:
            findPlanPricing(pricing, license.planKey)?.features ||
            PLAN_DEFINITIONS[license.planKey].features,
          capabilities: PLAN_DEFINITIONS[license.planKey].capabilities,
        });
      }

      case 'underwrite':
      case 'analyze': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required to run underwriting analysis' });
        }

        const rl = checkRateLimit(`analyze:${email}`, 10, 60 * 1000);
        if (!rl.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded (max 10 analyses per minute). Please wait briefly.',
            retryAfterSec: rl.retryAfterSec,
          });
        }

        const userRecord = getOrCreateServerUser(email, {
          name: body.name,
          timezone: body.timezone,
        });
        const license = computeServerLicenseStatus(userRecord);

        if (license.isExpired || (!license.isUnlimitedAnalyses && license.analysesLeft <= 0)) {
          return res.status(403).json({
            error: 'Licensing window expired - Renew',
            code: 'LICENSE_EXPIRED_OR_LIMIT_REACHED',
            plan: license.planKey,
            displayName: license.displayName,
            analysesLeft: 0,
            daysLeft: license.daysLeft,
          });
        }

        if (body.useMonteCarlo && !canUseFeature(license.planKey, 'monteCarlo')) {
          return res.status(403).json({
            error: getUpgradeMessage('monteCarlo'),
            code: 'FEATURE_LOCKED',
            feature: 'monteCarlo',
            requiredPlan: 'pro',
          });
        }

        if (body.useSensitivity && !canUseFeature(license.planKey, 'yieldSensitivity')) {
          return res.status(403).json({
            error: getUpgradeMessage('yieldSensitivity'),
            code: 'FEATURE_LOCKED',
            feature: 'yieldSensitivity',
            requiredPlan: 'starter',
          });
        }

        const priceUSD = Number(body.priceUSD || 650000);
        const rentUSD = Number(body.rentUSD || 4500);
        const downPaymentPct = Number(body.downPaymentPct ?? 30);
        const interestRatePct = Number(body.interestRatePct ?? 5.5);
        const operatingExpensePct = Number(body.operatingExpensePct ?? 15);
        const propertyTitle = (body.propertyTitle || 'Institutional Asset').toString();
        const city = (body.city || 'Muscat').toString();

        const downPaymentUSD = priceUSD * (downPaymentPct / 100);
        const loanAmountUSD = Math.max(0, priceUSD - downPaymentUSD);
        const monthlyRate = interestRatePct / 100 / 12;
        const numPayments = 25 * 12;
        const monthlyMortgageUSD =
          loanAmountUSD > 0 && monthlyRate > 0
            ? (loanAmountUSD * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
              (Math.pow(1 + monthlyRate, numPayments) - 1)
            : 0;

        const annualGrossRentUSD = rentUSD * 12 * 0.95;
        const annualOPEXUSD = annualGrossRentUSD * (operatingExpensePct / 100);
        const netOperatingIncomeUSD = annualGrossRentUSD - annualOPEXUSD;
        const annualDebtServiceUSD = monthlyMortgageUSD * 12;
        const annualCashflowUSD = netOperatingIncomeUSD - annualDebtServiceUSD;
        const monthlyCashflowUSD = annualCashflowUSD / 12;

        const capRate = Number(((netOperatingIncomeUSD / Math.max(1, priceUSD)) * 100).toFixed(2));
        const cashOnCash =
          downPaymentUSD > 0 ? Number(((annualCashflowUSD / downPaymentUSD) * 100).toFixed(2)) : 0;
        const irr5Yr = Number((cashOnCash + 4.8).toFixed(1));
        const dscr =
          annualDebtServiceUSD > 0 ? (netOperatingIncomeUSD / annualDebtServiceUSD).toFixed(2) : '∞';

        const updatedUser = recordUserAnalysis(email, {
          property: propertyTitle,
          city,
          priceUSD,
          capRate,
          cashOnCash,
          resultSummary: `Cap ${capRate}% | CoC ${cashOnCash}%`,
        });
        const nextLicense = computeServerLicenseStatus(updatedUser);

        return res.status(200).json({
          success: true,
          result: {
            capRate,
            cashOnCash,
            irr5Yr: canUseFeature(license.planKey, 'yieldSensitivity') ? irr5Yr : null,
            dscr: canUseFeature(license.planKey, 'yieldSensitivity') ? dscr : null,
            monthlyCashflowUSD: canUseFeature(license.planKey, 'yieldSensitivity')
              ? Math.round(monthlyCashflowUSD)
              : null,
            netOperatingIncomeUSD: Math.round(netOperatingIncomeUSD),
            monteCarlo: canUseFeature(license.planKey, 'monteCarlo')
              ? {
                  rateShockCoC: Number(Math.max(0, cashOnCash - 1.85).toFixed(2)),
                  vacancySurgeNetYield: Number(Math.max(0, capRate - 1.2).toFixed(2)),
                }
              : null,
          },
          license: nextLicense,
          planCapabilities: PLAN_DEFINITIONS[nextLicense.planKey].capabilities,
        });
      }

      case 'save-property':
      case 'save': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = parsedBody;
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required to save analyses' });
        }

        const userRecord = getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);

        if (license.isExpired) {
          return res.status(403).json({
            error: 'Licensing window expired - Renew',
            code: 'LICENSE_EXPIRED',
          });
        }

        const currentSavedCount = Math.max(
          userRecord.saved_analyses.length,
          Number(body.currentSavedCount || 0)
        );

        if (
          !canUseFeature(license.planKey, 'saveProperty') ||
          (!license.isUnlimitedSaved && currentSavedCount >= license.savedLimit)
        ) {
          return res.status(403).json({
            error: 'Upgrade to save more',
            code: 'SAVE_LIMIT_REACHED',
            plan: license.planKey,
            savedCount: currentSavedCount,
            savedLimit: license.savedLimit,
          });
        }

        const analysis = body.analysis;
        if (!analysis) {
          return res.status(400).json({ error: 'Analysis payload is required' });
        }

        const newItem = {
          ...analysis,
          id: analysis.id || `saved_${Date.now()}`,
          date: analysis.date || Date.now(),
        };

        const nextSaved = [newItem, ...userRecord.saved_analyses];
        const updated = updateServerUser(email, { saved_analyses: nextSaved });

        return res.status(200).json({
          success: true,
          savedItem: newItem,
          savedCount: updated.saved_analyses.length,
          savedLimit: PLAN_DEFINITIONS[license.planKey].savedLimit,
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

        const userRecord = getOrCreateServerUser(email, { name: body.name });
        const license = computeLicenseStatus({
          plan: userRecord.plan,
          licenseStart: userRecord.license_start,
          licenseEnd: userRecord.license_end,
          analysesUsed: userRecord.analyses_used,
        });

        if (license.isExpired) {
          return res.status(403).json({
            error: 'Licensing window expired - Renew',
            code: 'LICENSE_EXPIRED',
          });
        }

        const format = (body.format || 'pdf').toLowerCase();
        if (format === 'api') {
          if (!canUseFeature(license.planKey, 'apiAccess')) {
            return res.status(403).json({
              error: getUpgradeMessage('apiAccess'),
              code: 'FEATURE_LOCKED',
              feature: 'apiAccess',
              requiredPlan: 'enterprise',
            });
          }
        } else if (!canUseFeature(license.planKey, 'pdfExport')) {
          return res.status(403).json({
            error: getUpgradeMessage('pdfExport'),
            code: 'FEATURE_LOCKED',
            feature: 'pdfExport',
            requiredPlan: 'pro',
          });
        }

        const propertyTitle = (body.propertyTitle || 'AQARI_Institutional_Asset').toString();
        const safeName = propertyTitle.replace(/[^a-z0-9_-]+/gi, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        const watermark = `Generated by AQARI TERMINAL - Loomora Studios - Licensed to ${email} - ${dateStr}`;

        recordUserPdfDownload(email, {
          property: propertyTitle,
          format,
          watermark,
        });

        return res.status(200).json({
          success: true,
          format,
          filename: `${safeName}_AQARI_MEMO.${format === 'api' ? 'json' : 'pdf'}`,
          watermark,
          generatedAt: new Date().toISOString(),
          plan: license.displayName,
        });
      }

      case 'portfolio': {
        const body = req.method === 'POST' ? parsedBody : req.query || {};
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').toString().trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required for portfolio aggregation' });
        }

        const userRecord = getOrCreateServerUser(email, { name: body.name });
        const license = computeLicenseStatus({
          plan: userRecord.plan,
          licenseStart: userRecord.license_start,
          licenseEnd: userRecord.license_end,
          analysesUsed: userRecord.analyses_used,
        });

        if (license.isExpired) {
          return res.status(403).json({
            error: 'Licensing window expired - Renew',
            code: 'LICENSE_EXPIRED',
          });
        }

        if (!canUseFeature(license.planKey, 'portfolioAggregation')) {
          return res.status(403).json({
            error: getUpgradeMessage('portfolioAggregation'),
            code: 'FEATURE_LOCKED',
            feature: 'portfolioAggregation',
            requiredPlan: 'pro',
          });
        }

        const items = Array.isArray(body.savedAnalyses) ? body.savedAnalyses : userRecord.saved_analyses;
        const totalValueUSD = items.reduce((acc: number, item: any) => acc + Number(item.price || 0), 0);
        const monthlyCashflowUSD = items.reduce((acc: number, item: any) => acc + Number(item.monthlyCashflow || 0), 0);
        const avgCapRate = items.length
          ? Number((items.reduce((acc: number, item: any) => acc + Number(item.capRate || 0), 0) / items.length).toFixed(2))
          : 0;
        const avgIRR = items.length
          ? Number((items.reduce((acc: number, item: any) => acc + Number(item.irr || 0), 0) / items.length).toFixed(1))
          : 0;

        return res.status(200).json({
          success: true,
          plan: license.displayName,
          portfolio: {
            count: items.length,
            totalValueUSD,
            monthlyCashflowUSD,
            annualCashflowUSD: monthlyCashflowUSD * 12,
            avgCapRate,
            avgIRR,
          },
        });
      }

      case 'checkout': {
        const startTime = Date.now();
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const { plan, email, userId, refundAcceptedAt } = parsedBody;
        const validPlan: 'starter' | 'pro' | 'enterprise' =
          plan === 'starter' || plan === 'pro' || plan === 'enterprise' ? plan : 'pro';
        const variantId = getVariantIds()[validPlan];
        const buyBaseUrl = BUY_URLS[validPlan];

        const pricing = getPricingPublicPayload();
        const planPricing = findPlanPricing(pricing, validPlan)!;
        const isLaunchPrice = Boolean(pricing.launchDiscountActive);
        const activePriceUSD = isLaunchPrice ? planPricing.launchPrice : planPricing.originalPrice;
        const customPriceCents = Math.max(100, Math.round(activePriceUSD * 100));

        const isTestMode =
          getEnv('LEMON_TEST_MODE') === 'true' || getEnv('VITE_LEMON_TEST_MODE') === 'true';
        const apiKey = isTestMode
          ? cleanEnvValue(
              getEnv('LEMON_TEST_API_KEY') || getEnv('LEMON_API_KEY') || getEnv('LEMONSQUEEZY_API_KEY')
            )
          : cleanEnvValue(getEnv('LEMON_API_KEY') || getEnv('LEMONSQUEEZY_API_KEY'));
        const storeId = isTestMode
          ? cleanEnvValue(
              getEnv('LEMON_TEST_STORE_ID') || getEnv('LEMON_STORE_ID') || getEnv('LEMONSQUEEZY_STORE_ID')
            )
          : cleanEnvValue(getEnv('LEMON_STORE_ID') || getEnv('LEMONSQUEEZY_STORE_ID'));

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

        if (apiKey && storeId) {
          const createLemonCheckout = async (includeCustomPrice: boolean) => {
            const attributes: any = {
              test_mode: isTestMode,
              checkout_data: {
                email: email || undefined,
                custom: {
                  user_id: userId || 'anonymous',
                  plan: validPlan,
                  charged_price_usd: String(activePriceUSD),
                  is_launch_price: isLaunchPrice ? 'true' : 'false',
                  launch_price_locked: isLaunchPrice ? String(activePriceUSD) : '',
                  test_mode: isTestMode ? 'true' : 'false',
                  refund_accepted_at: refundAcceptedAt || new Date().toISOString(),
                },
              },
              product_options: {
                redirect_url: SUCCESS_REDIRECT,
                receipt_button_text: 'Go to My Terminal',
              },
            };
            if (includeCustomPrice) {
              attributes.custom_price = customPriceCents;
            }

            return fetch('https://api.lemonsqueezy.com/v1/checkouts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/vnd.api+json',
                Accept: 'application/vnd.api+json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                data: {
                  type: 'checkouts',
                  attributes,
                  relationships: {
                    store: { data: { type: 'stores', id: storeId.toString() } },
                    variant: { data: { type: 'variants', id: variantId } },
                  },
                },
              }),
            });
          };

          try {
            let response = await createLemonCheckout(true);
            if (!response.ok) {
              response = await createLemonCheckout(false);
            }

            if (response.ok) {
              const json = await response.json();
              const checkoutUrl = json?.data?.attributes?.url;
              const checkoutId = json?.data?.id ? String(json.data.id) : undefined;
              if (checkoutUrl) {
                if (email) {
                  recordPendingCheckout({
                    email,
                    plan: validPlan,
                    amountUSD: activePriceUSD,
                    isLaunchPrice,
                    testMode: isTestMode,
                    createdAt: Date.now(),
                    checkoutId,
                  });
                }
                const duration = Date.now() - startTime;
                return res.status(200).json({
                  url: checkoutUrl,
                  checkoutId,
                  success_url: SUCCESS_REDIRECT,
                  cancel_url: CANCEL_REDIRECT,
                  success: true,
                  testMode: isTestMode,
                  durationMs: duration,
                  plan: validPlan,
                  activePriceUSD,
                  originalPrice: planPricing.originalPrice,
                  launchPrice: planPricing.launchPrice,
                  isLaunchPrice,
                });
              }
            }
          } catch (apiErr) {
            console.warn('Lemon Squeezy API call error, falling back to direct hosted checkout:', apiErr);
          }
        }

        const params = new URLSearchParams();
        if (email) params.set('checkout[email]', email);
        if (userId) params.set('checkout[custom][user_id]', userId);
        params.set('checkout[custom][plan]', validPlan);
        params.set('checkout[custom][charged_price_usd]', String(activePriceUSD));
        params.set('checkout[custom][is_launch_price]', isLaunchPrice ? 'true' : 'false');
        if (isLaunchPrice) {
          params.set('checkout[custom][launch_price_locked]', String(activePriceUSD));
        }
        params.set('checkout[custom][refund_accepted_at]', refundAcceptedAt || new Date().toISOString());
        if (isTestMode) {
          params.set('checkout[test_mode]', '1');
          params.set('checkout[custom][test_mode]', 'true');
        }
        params.set('checkout[redirect_url]', SUCCESS_REDIRECT);
        params.set('checkout[cancel_url]', CANCEL_REDIRECT);

        const directUrl = `${buyBaseUrl}?${params.toString()}`;
        const duration = Date.now() - startTime;

        return res.status(200).json({
          url: directUrl,
          success_url: SUCCESS_REDIRECT,
          cancel_url: CANCEL_REDIRECT,
          success: true,
          testMode: isTestMode,
          durationMs: duration,
          plan: validPlan,
          activePriceUSD,
          originalPrice: planPricing.originalPrice,
          launchPrice: planPricing.launchPrice,
          isLaunchPrice,
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
          const user = getOrCreateServerUser(sessionEmail);
          const license = computeServerLicenseStatus(user);
          return res.status(200).json({
            authenticated: true,
            email: user.email,
            isAdmin: isAdminEmail(user.email),
            user,
            license,
          });
        }

        if (req.method === 'POST') {
          const ip = getClientIp(req);
          const rl = checkRateLimit(`auth:${ip}`, 5, 60 * 1000);
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

          const user = recordUserLogin(email, body.name);
          setSessionCookie(res, user.email);
          const license = computeServerLicenseStatus(user);
          const pricing = getPricingPublicPayload();

          return res.status(200).json({
            success: true,
            authenticated: true,
            email: user.email,
            isAdmin: isAdminEmail(user.email),
            user,
            license,
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

      case 'webhook-logs': {
        res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
        const logs = await getWebhookLogsFromDb(50);
        const webhookSecretPresent = Boolean(
          cleanEnvValue(getEnv('LEMON_WEBHOOK_SECRET')) ||
            cleanEnvValue(getEnv('LEMONSQUEEZY_WEBHOOK_SECRET'))
        );
        const apiKeyPresent = Boolean(
          cleanEnvValue(getEnv('LEMONSQUEEZY_API_KEY')) ||
            cleanEnvValue(getEnv('LEMON_API_KEY')) ||
            cleanEnvValue(getEnv('LEMON_TEST_API_KEY'))
        );

        return res.status(200).json({
          success: true,
          testMode:
            getEnv('LEMON_TEST_MODE') === 'true' || getEnv('VITE_LEMON_TEST_MODE') === 'true',
          logs,
          webhookLogs: logs,
          webhooks: logs,
          envStatus: {
            webhookSecretPresent,
            apiKeyPresent,
          },
          ...(logs.length === 0
            ? {
                debug:
                  'No webhook received - Check Lemon > Settings > Webhooks URL is https://aqari-ai-rho.vercel.app/api/webhooks/lemonsqueezy',
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
                'User-Agent': 'AqariTerminal/1.0 (https://aqari-ai-rho.vercel.app; contact@loomora.studios)',
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

        const userRecord = getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);
        if (license.isExpired || (!license.isUnlimitedAnalyses && license.analysesLeft <= 0)) {
          return res.status(403).json({
            error: 'Licensing window expired or quota reached - Renew to analyze more cities',
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
                'User-Agent': 'AqariTerminal/1.0 (https://aqari-ai-rho.vercel.app; contact@loomora.studios)',
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
        const nextLicense = computeServerLicenseStatus(savedUser);

        return res.status(200).json({
          success: true,
          cityCard,
          coordinates: { lat: resolvedLat, lon: resolvedLon },
          isEstimated: true,
          source: cityCard.source,
          custom_cities: savedUser.custom_cities || [],
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
          real_estate_note: 'Baseline / Estimated market benchmarks - بيانات تقديرية',
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

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown action '${action}'.`,
          supportedActions: [
            'me',
            'pricing',
            'verify-checkout',
            'debug-plan',
            'underwrite',
            'save-property',
            'export',
            'portfolio',
            'checkout',
            'session',
            'license',
            'market-live',
            'news',
            'demo',
            'webhook-logs',
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
