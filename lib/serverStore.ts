// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import fs from 'fs';
import path from 'path';
import {
  PlanKey,
  PLANS,
  THIRTY_DAYS_MS,
  DEFAULT_LAUNCH_BADGE,
  DynamicPlanPublic,
  PricingPublicPayload,
  ComputedLicenseStatus,
  computeLicenseStatus,
  normalizePlanKey,
} from './plans';

export interface ForensicAnalysisEntry {
  id: string;
  timestamp: string;
  property: string;
  city: string;
  priceUSD: number;
  capRate: number;
  cashOnCash: number;
  resultSummary: string;
}

export interface ForensicPdfEntry {
  id: string;
  timestamp: string;
  property: string;
  format: string;
  watermark: string;
}

export interface ForensicPaymentEntry {
  id: string;
  timestamp: string;
  order_id: string;
  plan: PlanKey;
  amount: number;
  currency: string;
  test_mode: boolean;
  refund_policy_accepted_at?: string;
}

export interface ForensicTimelineEntry {
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

export interface CustomCityRecord {
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

export interface ServerUserRecord {
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
  // Forensic evidence fields
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

export interface WebhookLogEntry {
  id: string;
  order_id: string;
  event?: string;
  event_name: string;
  plan: PlanKey;
  email: string;
  amount: number;
  currency: string;
  test_mode: boolean;
  signature_valid?: boolean;
  error?: string;
  raw_error?: string;
  activation_code?: string;
  has_resend_key?: boolean;
  key_prefix?: string;
  from_email?: string;
  to_email?: string;
  resend_status?: number;
  timestamp: string;
}

export interface FailedWebhookLog {
  id: string;
  timestamp: string;
  reason: string;
  ip?: string;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  from: string;
  subject: string;
  type: 'day29_renewal' | 'plan_expired' | 'test_day29' | 'activation_code';
  status: 'sent' | 'failed' | 'simulated';
  provider: 'resend' | 'nodemailer' | 'log';
  timestamp: string;
  error?: string;
  has_resend_key?: boolean;
  key_prefix?: string;
  resend_status?: number;
}

export interface ActivationCodeRecord {
  code: string;
  payment_email: string;
  order_id: string;
  plan: PlanKey;
  plan_display: 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  analyses: number;
  amount: number;
  test_mode: boolean;
  used: boolean;
  invalidated?: boolean;
  used_by?: string | null;
  used_at?: number | null;
  created_at: number;
  expires_at: number;
}

export interface PricingChangeLogEntry {
  id: string;
  timestamp: string;
  adminEmail: string;
  planKey: PlanKey | 'global';
  message: string;
}

export interface StoredPlanConfig {
  key: PlanKey;
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  originalPrice: number;
  launchPrice: number;
  analysesLimit: number;
  savedLimit: number | null;
  features: string[];
}

export interface StoredPricingConfig {
  launchDiscountActive: boolean;
  launchBadgeText: string;
  launchEndsAt: number;
  updatedAt: number;
  plans: Record<PlanKey, StoredPlanConfig>;
}

export interface PendingCheckoutEntry {
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
  failed_webhooks: FailedWebhookLog[];
  email_logs: EmailLogEntry[];
  pricing_config: StoredPricingConfig;
  pricing_logs: PricingChangeLogEntry[];
  pending_checkouts: Record<string, PendingCheckoutEntry>;
  activation_codes: Record<string, ActivationCodeRecord>;
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
        originalPrice: PLANS.free.originalPrice,
        launchPrice: PLANS.free.launchPrice,
        analysesLimit: PLANS.free.analysesLimit,
        savedLimit: PLANS.free.savedLimit,
        features: [...PLANS.free.features],
      },
      starter: {
        key: 'starter',
        displayName: 'STARTER',
        originalPrice: PLANS.starter.originalPrice,
        launchPrice: PLANS.starter.launchPrice,
        analysesLimit: PLANS.starter.analysesLimit,
        savedLimit: PLANS.starter.savedLimit,
        features: [...PLANS.starter.features],
      },
      pro: {
        key: 'pro',
        displayName: 'PROFESSIONAL',
        originalPrice: PLANS.pro.originalPrice,
        launchPrice: PLANS.pro.launchPrice,
        analysesLimit: PLANS.pro.analysesLimit,
        savedLimit: PLANS.pro.savedLimit,
        features: [...PLANS.pro.features],
      },
      enterprise: {
        key: 'enterprise',
        displayName: 'SOVEREIGN',
        originalPrice: PLANS.enterprise.originalPrice,
        launchPrice: PLANS.enterprise.launchPrice,
        analysesLimit: PLANS.enterprise.analysesLimit,
        savedLimit: null,
        features: [...PLANS.enterprise.features],
      },
    },
  };
}

const STORE_FILE = path.join('/tmp', 'aqari_terminal_store_v1.json');

let memoryStore: StoreShape = {
  users: {},
  webhook_logs: [],
  failed_webhooks: [],
  email_logs: [],
  pricing_config: createDefaultPricingConfig(),
  pricing_logs: [],
  pending_checkouts: {},
  activation_codes: {},
};

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
    locked_launch_price:
      typeof raw?.locked_launch_price === 'number' ? raw.locked_launch_price : null,
    lemon_customer_email: raw?.lemon_customer_email ? String(raw.lemon_customer_email).toLowerCase() : null,
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
        originalPrice: Number.isFinite(Number(r.originalPrice)) ? Number(r.originalPrice) : def.plans[k].originalPrice,
        launchPrice: Number.isFinite(Number(r.launchPrice)) ? Number(r.launchPrice) : def.plans[k].launchPrice,
        analysesLimit: Number.isFinite(Number(r.analysesLimit)) && Number(r.analysesLimit) > 0 ? Number(r.analysesLimit) : def.plans[k].analysesLimit,
        savedLimit: r.savedLimit === null ? null : (Number.isFinite(Number(r.savedLimit)) ? Number(r.savedLimit) : def.plans[k].savedLimit),
        features: Array.isArray(r.features) && r.features.length > 0 ? r.features.map(String) : def.plans[k].features,
      };
    }
  }
  return {
    launchDiscountActive: typeof raw.launchDiscountActive === 'boolean' ? raw.launchDiscountActive : def.launchDiscountActive,
    launchBadgeText: typeof raw.launchBadgeText === 'string' && raw.launchBadgeText.trim() ? raw.launchBadgeText : def.launchBadgeText,
    launchEndsAt: Number.isFinite(Number(raw.launchEndsAt)) ? Number(raw.launchEndsAt) : def.launchEndsAt,
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : def.updatedAt,
    plans,
  };
}

function loadStore(): StoreShape {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const users: Record<string, ServerUserRecord> = {};
        if (parsed.users && typeof parsed.users === 'object') {
          for (const [k, v] of Object.entries(parsed.users)) {
            users[k] = hydrateUserRecord(v, k);
          }
        }
        memoryStore = {
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
          activation_codes:
            parsed.activation_codes && typeof parsed.activation_codes === 'object'
              ? parsed.activation_codes
              : {},
        };
      }
    }
  } catch {
    // Fallback cleanly to memoryStore
  }
  return memoryStore;
}

function persistStore(store: StoreShape): void {
  memoryStore = store;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // Ignore read-only filesystem errors
  }
}

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * SECURITY CRITICAL:
 * Client hints MUST NEVER elevate `plan` or `license_end`.
 * New users always start as FREE (3 analyses / 30 days) until verified Lemon Squeezy payment.
 */
export function getOrCreateServerUser(
  rawEmail: string,
  hints?: {
    name?: string;
    timezone?: string;
  }
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

export function getServerUserByEmail(rawEmail: string): ServerUserRecord | null {
  const store = loadStore();
  const email = normalizeEmail(rawEmail);
  if (!email || !store.users[email]) return null;
  return enforceServerUserExpiry(email);
}

export function enforceServerUserExpiry(rawEmail: string): ServerUserRecord {
  const store = loadStore();
  const email = normalizeEmail(rawEmail) || 'guest@aqari-ai-rho.vercel.app';
  const user = store.users[email];
  const now = Date.now();

  if (!user) {
    return getOrCreateServerUser(email);
  }

  if (user.plan !== 'free' && user.license_end && now >= user.license_end) {
    const prevPlan = PLANS[user.plan].displayName;
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

export function updateServerUser(email: string, patch: Partial<ServerUserRecord>): ServerUserRecord {
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

export function recordUserLogin(email: string, name?: string): ServerUserRecord {
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

export function activatePaidPlanOnServer(params: {
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
  const planCfg = PLANS[params.plan];
  const amount = params.amountUSD ?? dynamicPlan?.activePrice ?? planCfg.launchPrice;
  const orderId = params.orderId || `ord_${now}`;
  const iso = new Date(now).toISOString();

  const resolvedLockedLaunch =
    typeof params.lockedLaunchPrice === 'number'
      ? params.lockedLaunchPrice
      : pricing.launchDiscountActive && params.plan !== 'free'
      ? (dynamicPlan?.launchPrice ?? amount)
      : existing.locked_launch_price;

  // Prevent duplicate order entry if verify + webhook both fire for same order_id
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
          message: `Purchased ${planCfg.displayName} $${amount} - Order #${orderId} (${params.testMode ? 'TEST' : 'LIVE'})${resolvedLockedLaunch ? ` - Locked Launch Price $${resolvedLockedLaunch}` : ''}`,
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

export function recordUserAnalysis(
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

export function recordUserPdfDownload(
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

export function evaluateRefundEligibility(user: ServerUserRecord): {
  eligible: boolean;
  verdict: string;
  reasons: string[];
  daysSincePurchase: number;
  analysesCount: number;
  pdfDownloadsCount: number;
} {
  const latestPayment = user.payments[0];
  const purchaseTs = latestPayment
    ? new Date(latestPayment.timestamp).getTime()
    : user.license_start || Date.now();
  const daysSincePurchase = Math.max(
    0,
    Math.floor((Date.now() - purchaseTs) / (24 * 60 * 60 * 1000))
  );
  const analysesCount = Math.max(user.analyses_used, user.analyses_log.length);
  const pdfDownloadsCount = user.pdf_downloads.length;

  const reasons: string[] = [];
  if (daysSincePurchase > 7) {
    reasons.push(`${daysSincePurchase} days passed (7-day window exceeded)`);
  }
  if (analysesCount > 3) {
    reasons.push(`${analysesCount} analyses run (exceeds max 3 analyses limit)`);
  }
  if (pdfDownloadsCount > 0) {
    reasons.push(`${pdfDownloadsCount} PDF Memorandum download(s) completed`);
  }

  const eligible = reasons.length === 0;
  const verdict = eligible
    ? 'ELIGIBLE (Within 7 days, <= 3 analyses, 0 PDF exports)'
    : `DENIED: ${reasons.join(' + ')}`;

  return {
    eligible,
    verdict,
    reasons,
    daysSincePurchase,
    analysesCount,
    pdfDownloadsCount,
  };
}

export function adminChangeUserPlan(params: {
  email: string;
  newPlan: PlanKey;
  reason: string;
  adminEmail: string;
}): ServerUserRecord {
  const user = getOrCreateServerUser(params.email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const prevPlanDisplay = PLANS[user.plan].displayName;
  const nextPlanDisplay = PLANS[params.newPlan].displayName;

  const timelineEntry: ForensicTimelineEntry = {
    id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    type: 'admin_plan_change',
    message: `Admin changed plan from ${prevPlanDisplay} to ${nextPlanDisplay} - Reason: ${params.reason} - By: ${params.adminEmail} - At: ${iso}`,
    actor: params.adminEmail,
  };

  return updateServerUser(user.email, {
    plan: params.newPlan,
    license_start: now,
    license_end: now + THIRTY_DAYS_MS,
    analyses_used: 0,
    timeline: [timelineEntry, ...user.timeline].slice(0, 200),
  });
}

export function recordRefundDecision(params: {
  email: string;
  status: 'pending' | 'approved' | 'denied';
  notes: string;
  actorEmail: string;
}): ServerUserRecord {
  const user = getOrCreateServerUser(params.email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const evalResult = evaluateRefundEligibility(user);
  const timelineEntry: ForensicTimelineEntry = {
    id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    type: 'refund_request',
    message: `Refund ${params.status.toUpperCase()} - ${params.notes || evalResult.verdict}`,
    actor: params.actorEmail,
  };

  return updateServerUser(user.email, {
    refund_requested: true,
    refund_status: params.status,
    refund_notes: params.notes || evalResult.verdict,
    timeline: [timelineEntry, ...user.timeline].slice(0, 200),
  });
}

export function getAllServerUsers(): ServerUserRecord[] {
  const store = loadStore();
  return Object.keys(store.users).map((email) => enforceServerUserExpiry(email));
}

function getKvConfig(): { url: string; token: string } | null {
  const url = (
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ''
  )
    .replace(/^["']|["']$/g, '')
    .trim();
  const token = (
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ''
  )
    .replace(/^["']|["']$/g, '')
    .trim();
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

export async function appendWebhookLogToDb(
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

  // Write local disk DB
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

  // Write remote KV DB when configured (shared across serverless containers)
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

export async function updateWebhookLogInDb(
  id: string,
  patch: Partial<WebhookLogEntry>
): Promise<WebhookLogEntry | null> {
  let updatedLog: WebhookLogEntry | null = null;
  try {
    const store = loadStore();
    const idx = store.webhook_logs.findIndex((w) => w.id === id);
    if (idx >= 0) {
      const merged: WebhookLogEntry = {
        ...store.webhook_logs[idx],
        ...patch,
      };
      if (patch.raw_error === undefined && 'raw_error' in patch) {
        delete merged.raw_error;
        delete merged.error;
      }
      store.webhook_logs[idx] = merged;
      updatedLog = merged;
      persistStore(store);
    }
  } catch (diskErr) {
    console.error('[DB] Failed updating webhook log in disk store:', diskErr);
  }

  try {
    const kv = getKvConfig();
    if (kv) {
      const rawItems = await kvCommand(['LRANGE', 'aqari:webhook_logs:v1', 0, 49]);
      if (Array.isArray(rawItems)) {
        for (let i = 0; i < rawItems.length; i++) {
          try {
            const parsed = typeof rawItems[i] === 'string' ? JSON.parse(rawItems[i]) : rawItems[i];
            if (parsed?.id === id) {
              const merged: WebhookLogEntry = { ...parsed, ...patch };
              if (patch.raw_error === undefined && 'raw_error' in patch) {
                delete merged.raw_error;
                delete merged.error;
              }
              await kvCommand(['LSET', 'aqari:webhook_logs:v1', i, JSON.stringify(merged)]);
              updatedLog = merged;
              break;
            }
          } catch {}
        }
      }
    }
  } catch (kvErr) {
    console.error('[DB] Failed updating webhook log in KV store:', kvErr);
  }

  return updatedLog;
}

export async function getWebhookLogsFromDb(limit = 20): Promise<WebhookLogEntry[]> {
  // Prefer remote shared KV DB if configured
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

  // Always read directly from disk DB file when present (not stale memory)
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
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

export async function getEmailLogsFromDb(limit = 20): Promise<EmailLogEntry[]> {
  try {
    const kv = getKvConfig();
    if (kv) {
      const rawItems = await kvCommand(['LRANGE', 'aqari:email_logs:v1', 0, Math.max(0, limit - 1)]);
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        const parsedLogs: EmailLogEntry[] = rawItems
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
    console.error('[DB] Failed reading email logs from KV store:', kvErr);
  }

  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.email_logs)) {
        return parsed.email_logs.slice(0, limit);
      }
    }
  } catch {}
  return loadStore().email_logs.slice(0, limit);
}

export async function saveUserToDb(user: ServerUserRecord): Promise<void> {
  try {
    const kv = getKvConfig();
    if (kv && user?.email) {
      await kvCommand(['SET', `aqari:user:${normalizeEmail(user.email)}`, JSON.stringify(user)]);
    }
  } catch (kvErr) {
    console.error('[DB] Failed saving user to KV store:', kvErr);
  }
}

export async function getUserFromDb(rawEmail: string): Promise<ServerUserRecord | null> {
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

export function appendWebhookLog(
  entry: Omit<WebhookLogEntry, 'id' | 'timestamp'>
): WebhookLogEntry {
  const store = loadStore();
  const log: WebhookLogEntry = {
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
    event: entry.event || entry.event_name,
    event_name: entry.event_name || entry.event || 'unknown',
    raw_error: entry.raw_error ?? entry.error,
    error: entry.error ?? entry.raw_error,
  };
  store.webhook_logs.unshift(log);
  if (store.webhook_logs.length > 200) {
    store.webhook_logs = store.webhook_logs.slice(0, 200);
  }
  persistStore(store);
  const kv = getKvConfig();
  if (kv) {
    kvCommand(['LPUSH', 'aqari:webhook_logs:v1', JSON.stringify(log)])
      .then(() => kvCommand(['LTRIM', 'aqari:webhook_logs:v1', 0, 199]))
      .catch((err) => console.error('[DB] Async KV webhook log write failed:', err));
  }
  return log;
}

export function getWebhookLogs(): WebhookLogEntry[] {
  return loadStore().webhook_logs;
}

export function recordFailedWebhook(reason: string, ip?: string): FailedWebhookLog {
  const store = loadStore();
  const log: FailedWebhookLog = {
    id: `fwh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    reason,
    ip,
  };
  store.failed_webhooks.unshift(log);
  if (store.failed_webhooks.length > 200) {
    store.failed_webhooks = store.failed_webhooks.slice(0, 200);
  }
  persistStore(store);
  return log;
}

export function getFailedWebhookLogs(): FailedWebhookLog[] {
  return loadStore().failed_webhooks;
}

export function appendEmailLog(entry: Omit<EmailLogEntry, 'id' | 'timestamp'>): EmailLogEntry {
  const store = loadStore();
  const log: EmailLogEntry = {
    id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.email_logs.unshift(log);
  if (store.email_logs.length > 200) {
    store.email_logs = store.email_logs.slice(0, 200);
  }
  persistStore(store);
  const kv = getKvConfig();
  if (kv) {
    kvCommand(['LPUSH', 'aqari:email_logs:v1', JSON.stringify(log)])
      .then(() => kvCommand(['LTRIM', 'aqari:email_logs:v1', 0, 199]))
      .catch((err) => console.error('[DB] Async KV email log write failed:', err));
  }
  return log;
}

export function getEmailLogs(): EmailLogEntry[] {
  return loadStore().email_logs;
}

export function recordPendingCheckout(entry: PendingCheckoutEntry): void {
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

export function consumePendingCheckout(
  email?: string,
  checkoutId?: string
): PendingCheckoutEntry | null {
  const store = loadStore();
  const norm = normalizeEmail(email || '');
  const byId = checkoutId ? store.pending_checkouts[`chk:${checkoutId}`] : undefined;
  const byEmail = norm ? store.pending_checkouts[norm] : undefined;
  const match = byId || byEmail || null;
  if (match) {
    if (norm) delete store.pending_checkouts[norm];
    if (checkoutId) delete store.pending_checkouts[`chk:${checkoutId}`];
    if (match.checkoutId) delete store.pending_checkouts[`chk:${match.checkoutId}`];
    persistStore(store);
  }
  return match;
}

export function recordOrderRefunded(params: {
  email: string;
  orderId: string;
  amountUSD?: number;
}): ServerUserRecord {
  const user = getOrCreateServerUser(params.email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const timelineEntry: ForensicTimelineEntry = {
    id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    type: 'refund_request',
    message: `Order #${params.orderId} refunded ($${params.amountUSD ?? 0}) -> License revoked to FREE`,
    actor: 'lemonsqueezy',
  };
  return updateServerUser(user.email, {
    plan: 'free',
    analyses_used: 0,
    license_end: now,
    refund_requested: true,
    refund_status: 'approved',
    refund_notes: `Refunded via Lemon Squeezy webhook (Order #${params.orderId})`,
    timeline: [timelineEntry, ...user.timeline].slice(0, 200),
  });
}

export function recordSubscriptionUpdated(params: {
  email: string;
  plan?: PlanKey;
  licenseEndMs?: number | null;
  status?: string;
}): ServerUserRecord {
  const user = getOrCreateServerUser(params.email);
  const nextPlan =
    params.status === 'expired'
      ? 'free'
      : params.plan && params.plan !== 'free'
      ? params.plan
      : user.plan;
  const now = Date.now();
  const nextEnd =
    params.licenseEndMs && Number.isFinite(params.licenseEndMs)
      ? params.licenseEndMs
      : user.license_end || now + THIRTY_DAYS_MS;

  return updateServerUser(user.email, {
    plan: nextPlan,
    license_end: nextEnd,
    day29_email_sent: false,
    expired_email_sent: false,
  });
}

export function getPricingPublicPayload(): PricingPublicPayload {
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

export function computeServerLicenseStatus(user: ServerUserRecord): ComputedLicenseStatus {
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

export function updateServerPlanPricing(params: {
  planKey: PlanKey;
  originalPrice?: number;
  launchPrice?: number;
  analysesLimit?: number;
  features?: string[];
  adminEmail: string;
}): { pricing: PricingPublicPayload; log: PricingChangeLogEntry } {
  const store = loadStore();
  const cfg = hydratePricingConfig(store.pricing_config);
  const current = cfg.plans[params.planKey];
  const now = Date.now();
  const iso = new Date(now).toISOString();

  const prevPrice = cfg.launchDiscountActive ? current.launchPrice : current.originalPrice;
  const prevAnalyses = current.analysesLimit;

  const nextOriginal =
    typeof params.originalPrice === 'number' && Number.isFinite(params.originalPrice) && params.originalPrice >= 0
      ? Math.round(params.originalPrice)
      : current.originalPrice;
  const nextLaunch =
    typeof params.launchPrice === 'number' && Number.isFinite(params.launchPrice) && params.launchPrice >= 0
      ? Math.round(params.launchPrice)
      : current.launchPrice;
  const nextAnalyses =
    typeof params.analysesLimit === 'number' && Number.isFinite(params.analysesLimit) && params.analysesLimit > 0
      ? Math.round(params.analysesLimit)
      : current.analysesLimit;
  const nextFeatures =
    Array.isArray(params.features) && params.features.length > 0
      ? params.features.map((f) => f.trim()).filter(Boolean)
      : current.features;

  cfg.plans[params.planKey] = {
    ...current,
    originalPrice: nextOriginal,
    launchPrice: nextLaunch,
    analysesLimit: nextAnalyses,
    features: nextFeatures,
  };
  cfg.updatedAt = now;

  const nextPrice = cfg.launchDiscountActive ? nextLaunch : nextOriginal;
  const planTitle =
    current.displayName === 'PROFESSIONAL'
      ? 'Professional'
      : current.displayName === 'STARTER'
      ? 'Starter'
      : current.displayName === 'SOVEREIGN'
      ? 'Sovereign'
      : 'Free';

  const log: PricingChangeLogEntry = {
    id: `plog_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    adminEmail: params.adminEmail,
    planKey: params.planKey,
    message: `Admin changed ${planTitle} from ${prevPrice}$ / ${prevAnalyses} analyses to ${nextPrice}$ / ${nextAnalyses} analyses - At: ${iso}`,
  };

  store.pricing_config = cfg;
  store.pricing_logs = [log, ...(store.pricing_logs || [])].slice(0, 200);
  persistStore(store);

  return { pricing: getPricingPublicPayload(), log };
}

export function updateLaunchDiscountSettings(params: {
  launchDiscountActive?: boolean;
  launchBadgeText?: string;
  countdownDays?: number;
  adminEmail: string;
}): { pricing: PricingPublicPayload; log: PricingChangeLogEntry } {
  const store = loadStore();
  const cfg = hydratePricingConfig(store.pricing_config);
  const now = Date.now();
  const iso = new Date(now).toISOString();

  if (typeof params.launchDiscountActive === 'boolean') {
    cfg.launchDiscountActive = params.launchDiscountActive;
  }
  if (typeof params.launchBadgeText === 'string' && params.launchBadgeText.trim()) {
    cfg.launchBadgeText = params.launchBadgeText.trim();
  }
  if (typeof params.countdownDays === 'number' && Number.isFinite(params.countdownDays) && params.countdownDays >= 0) {
    cfg.launchEndsAt = now + Math.round(params.countdownDays) * 24 * 60 * 60 * 1000;
  }
  cfg.updatedAt = now;

  const log: PricingChangeLogEntry = {
    id: `plog_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: iso,
    adminEmail: params.adminEmail,
    planKey: 'global',
    message: `Admin toggled Launch Discount ${cfg.launchDiscountActive ? 'ON (checkout uses launchPrice)' : 'OFF (checkout uses originalPrice)'} - Badge: "${cfg.launchBadgeText}" - At: ${iso}`,
  };

  store.pricing_config = cfg;
  store.pricing_logs = [log, ...(store.pricing_logs || [])].slice(0, 200);
  persistStore(store);

  return { pricing: getPricingPublicPayload(), log };
}

export function getPricingChangeLogs(): PricingChangeLogEntry[] {
  return loadStore().pricing_logs || [];
}

// =========================================================================
// ONE-TIME ACTIVATION CODE DB LIFECYCLE (24h Expiry, Single-Use, Invalidation)
// =========================================================================

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function normalizeActivationCode(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212]+/g, '-')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-');
  if (!cleaned) return '';
  if (cleaned.startsWith('AQARI') && !cleaned.startsWith('AQARI-')) {
    return `AQARI-${cleaned.slice(5).replace(/^-+/, '')}`;
  }
  return cleaned;
}

export function mapAmountOrPlanToCodeTier(
  amountUSD: number,
  fallbackPlan?: PlanKey
): {
  plan: PlanKey;
  planDisplay: 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  analyses: number;
} {
  const rounded = Math.round(Number(amountUSD || 0));
  let plan: PlanKey = fallbackPlan && fallbackPlan !== 'free' ? fallbackPlan : 'pro';

  if (rounded === 599 || rounded === 999 || rounded >= 500) {
    plan = 'enterprise';
  } else if (rounded === 199 || rounded === 349 || (rounded >= 150 && rounded < 500)) {
    plan = 'pro';
  } else if (rounded === 79 || rounded === 129 || (rounded > 0 && rounded < 150)) {
    plan = 'starter';
  }

  if (plan === 'starter') {
    return { plan: 'starter', planDisplay: 'STARTER', analyses: 30 };
  }
  if (plan === 'enterprise') {
    return { plan: 'enterprise', planDisplay: 'SOVEREIGN', analyses: 400 };
  }
  return { plan: 'pro', planDisplay: 'PROFESSIONAL', analyses: 150 };
}

function generateRandomAqariCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return `AQARI-${suffix}`;
}

async function readActivationCodesMapFromKv(): Promise<Record<string, ActivationCodeRecord> | null> {
  try {
    const kv = getKvConfig();
    if (!kv) return null;
    const raw = await kvCommand(['GET', 'aqari:activation_codes_map:v1']);
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, ActivationCodeRecord>;
    }
  } catch (err) {
    console.error('[DB] Failed reading activation_codes_map from KV:', err);
  }
  return null;
}

async function saveActivationCodeRecordToKv(record: ActivationCodeRecord): Promise<void> {
  try {
    const kv = getKvConfig();
    if (!kv) return;
    const codeKey = normalizeActivationCode(record.code);
    await kvCommand(['SET', `aqari:activation_code:${codeKey}`, JSON.stringify(record)]);

    const map = (await readActivationCodesMapFromKv()) || {};
    map[codeKey] = record;
    const keys = Object.keys(map);
    if (keys.length > 500) {
      const sorted = Object.values(map)
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
        .slice(0, 500);
      const trimmed: Record<string, ActivationCodeRecord> = {};
      for (const item of sorted) {
        trimmed[normalizeActivationCode(item.code)] = item;
      }
      await kvCommand(['SET', 'aqari:activation_codes_map:v1', JSON.stringify(trimmed)]);
    } else {
      await kvCommand(['SET', 'aqari:activation_codes_map:v1', JSON.stringify(map)]);
    }

    if (record.payment_email) {
      await kvCommand([
        'SET',
        `aqari:latest_code_email:${normalizeEmail(record.payment_email)}`,
        codeKey,
      ]);
    }
  } catch (err) {
    console.error('[DB] Failed writing activation code to KV:', err);
  }
}

export async function upsertActivationCodeInDb(
  record: ActivationCodeRecord
): Promise<ActivationCodeRecord> {
  const codeKey = normalizeActivationCode(record?.code || '');
  const normalizedRecord: ActivationCodeRecord = {
    ...record,
    code: codeKey,
    payment_email: normalizeEmail(record?.payment_email || ''),
  };
  const store = loadStore();
  if (!store.activation_codes || typeof store.activation_codes !== 'object' || Array.isArray(store.activation_codes)) {
    store.activation_codes = {};
  }
  store.activation_codes[codeKey] = normalizedRecord;
  persistStore(store);
  await saveActivationCodeRecordToKv(normalizedRecord);
  return normalizedRecord;
}

export async function getActivationCodeFromDb(rawCode: string): Promise<ActivationCodeRecord | null> {
  const codeKey = normalizeActivationCode(rawCode);
  if (!codeKey) return null;

  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:activation_code:${codeKey}`]);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed?.code) {
          const store = loadStore();
          if (!store.activation_codes || typeof store.activation_codes !== 'object' || Array.isArray(store.activation_codes)) {
            store.activation_codes = {};
          }
          store.activation_codes[codeKey] = parsed;
          persistStore(store);
          return parsed;
        }
      }
      const map = await readActivationCodesMapFromKv();
      if (map && map[codeKey]) {
        const store = loadStore();
        if (!store.activation_codes || typeof store.activation_codes !== 'object' || Array.isArray(store.activation_codes)) {
          store.activation_codes = {};
        }
        store.activation_codes[codeKey] = map[codeKey];
        persistStore(store);
        return map[codeKey];
      }
    }
  } catch (err) {
    console.error('[DB] Failed reading activation code from KV:', err);
  }

  const store = loadStore();
  const codesTable =
    store.activation_codes && typeof store.activation_codes === 'object' && !Array.isArray(store.activation_codes)
      ? store.activation_codes
      : {};
  const direct = codesTable[codeKey];
  if (direct) return direct;

  for (const [k, rec] of Object.entries(codesTable)) {
    if (rec && (normalizeActivationCode(k) === codeKey || normalizeActivationCode(rec?.code || '') === codeKey)) {
      return rec;
    }
  }
  return null;
}

export async function getActivationCodeDbStats(): Promise<{
  totalCodes: number;
  lastCode: string | null;
}> {
  const store = loadStore();
  const safeLocal =
    store.activation_codes && typeof store.activation_codes === 'object' && !Array.isArray(store.activation_codes)
      ? store.activation_codes
      : {};
  const merged: Record<string, ActivationCodeRecord> = { ...safeLocal };
  try {
    const kvMap = await readActivationCodesMapFromKv();
    if (kvMap && typeof kvMap === 'object') {
      for (const [k, v] of Object.entries(kvMap)) {
        if (v) merged[normalizeActivationCode(k)] = v;
      }
    }
  } catch {}
  const all = Object.values(merged)
    .filter((v): v is ActivationCodeRecord => Boolean(v && typeof v === 'object'))
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return {
    totalCodes: all.length,
    lastCode: all[0]?.code || null,
  };
}

export async function createActivationCodeInDb(params: {
  paymentEmail: string;
  orderId: string;
  amountUSD: number;
  fallbackPlan?: PlanKey;
  testMode?: boolean;
  invalidatePreviousForEmail?: boolean;
}): Promise<ActivationCodeRecord> {
  const store = loadStore();
  if (!store.activation_codes || typeof store.activation_codes !== 'object' || Array.isArray(store.activation_codes)) {
    store.activation_codes = {};
  }

  const normEmail = normalizeEmail(params?.paymentEmail || 'unknown@aqari-ai-rho.vercel.app');
  const tier = mapAmountOrPlanToCodeTier(Number(params?.amountUSD || 0), params?.fallbackPlan);

  // Do NOT invalidate previous unused codes on resend; prior codes remain valid until activated or 24h expires.

  let uniqueCode = normalizeActivationCode(generateRandomAqariCode());
  for (let attempt = 0; attempt < 15; attempt++) {
    if (!store.activation_codes[uniqueCode]) break;
    uniqueCode = normalizeActivationCode(generateRandomAqariCode());
  }

  const now = Date.now();
  const record: ActivationCodeRecord = {
    code: uniqueCode,
    payment_email: normEmail,
    order_id: String(params?.orderId || 'manual-resend'),
    plan: tier.plan,
    plan_display: tier.planDisplay,
    analyses: tier.analyses,
    amount: Number(params?.amountUSD || 0),
    test_mode: Boolean(params?.testMode),
    used: false,
    invalidated: false,
    used_by: null,
    used_at: null,
    created_at: now,
    expires_at: now + TWENTY_FOUR_HOURS_MS,
  };

  store.activation_codes[uniqueCode] = record;
  persistStore(store);
  await saveActivationCodeRecordToKv(record);
  return record;
}

export async function markActivationCodeUsedInDb(params: {
  code: string;
  loginEmail: string;
}): Promise<ActivationCodeRecord | null> {
  const codeKey = normalizeActivationCode(params.code);
  const existing = await getActivationCodeFromDb(codeKey);
  if (!existing) return null;

  const updated: ActivationCodeRecord = {
    ...existing,
    code: codeKey,
    used: true,
    used_by: normalizeEmail(params.loginEmail),
    used_at: Date.now(),
  };

  const store = loadStore();
  if (!store.activation_codes) store.activation_codes = {};
  store.activation_codes[codeKey] = updated;
  persistStore(store);
  await saveActivationCodeRecordToKv(updated);
  return updated;
}

export async function findLatestActivationCodeByPaymentEmailInDb(
  rawPaymentEmail: string
): Promise<ActivationCodeRecord | null> {
  const norm = normalizeEmail(rawPaymentEmail);
  if (!norm) return null;

  try {
    const kv = getKvConfig();
    if (kv) {
      const latestCodeKey = await kvCommand(['GET', `aqari:latest_code_email:${norm}`]);
      if (latestCodeKey && typeof latestCodeKey === 'string') {
        const rec = await getActivationCodeFromDb(latestCodeKey);
        if (rec) return rec;
      }
    }
  } catch (err) {
    console.error('[DB] Failed looking up latest activation code by email in KV:', err);
  }

  const store = loadStore();
  const matches = Object.values(store.activation_codes || {})
    .filter((c) => normalizeEmail(c.payment_email) === norm)
    .sort((a, b) => b.created_at - a.created_at);

  return matches[0] || null;
}

export async function invalidateActivationCodesForOrderOrEmailInDb(params: {
  orderId?: string;
  paymentEmail?: string;
}): Promise<string[]> {
  const store = loadStore();
  const normOrder = String(params.orderId || '').trim();
  const normEmail = normalizeEmail(params.paymentEmail || '');
  const affectedUsers: string[] = [];

  for (const [k, rec] of Object.entries(store.activation_codes || {})) {
    const matchesOrder = normOrder && String(rec.order_id) === normOrder;
    const matchesEmail = normEmail && normalizeEmail(rec.payment_email) === normEmail;
    if (matchesOrder || matchesEmail) {
      const updated: ActivationCodeRecord = { ...rec, invalidated: true };
      store.activation_codes[k] = updated;
      if (rec.used_by) {
        affectedUsers.push(rec.used_by);
      }
      await saveActivationCodeRecordToKv(updated);
    }
  }
  persistStore(store);
  return Array.from(new Set(affectedUsers));
}
