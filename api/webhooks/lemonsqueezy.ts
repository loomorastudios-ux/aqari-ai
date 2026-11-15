// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// =========================================================================
// 1. INLINED PLANS & CONSTANTS (Zero external ../../lib imports)
// =========================================================================

const PLANS = {
  STARTER: { price: 79, analyses: 30, name: 'STARTER' },
  PROFESSIONAL: { price: 199, analyses: 150, name: 'PROFESSIONAL' },
  SOVEREIGN: { price: 599, analyses: 400, name: 'SOVEREIGN' },
} as const;

type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LAUNCH_BADGE = 'LAUNCH -40% - First 30 users only';

const PLAN_DEFINITIONS: Record<
  PlanKey,
  {
    key: PlanKey;
    displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
    originalPrice: number;
    launchPrice: number;
    analysesLimit: number;
    savedLimit: number;
    features: string[];
  }
> = {
  free: {
    key: 'free',
    displayName: 'FREE',
    originalPrice: 0,
    launchPrice: 0,
    analysesLimit: 3,
    savedLimit: 0,
    features: [
      '3 Analyses / 30 Days',
      'Basic Cap Rate',
      'Cash-on-Cash only',
      'No Monte Carlo, PDF Export, API, Analyst Desk, Portfolio Aggregation & Full Matrix',
    ],
  },
  starter: {
    key: 'starter',
    displayName: 'STARTER',
    originalPrice: 129,
    launchPrice: PLANS.STARTER.price,
    analysesLimit: PLANS.STARTER.analyses,
    savedLimit: 50,
    features: [
      '30 Analyses / 30 Days',
      'Yield & Sensitivity Calculator',
      'Cross-border Tax & Visa Matrix',
      'Save 50',
    ],
  },
  pro: {
    key: 'pro',
    displayName: 'PROFESSIONAL',
    originalPrice: 349,
    launchPrice: PLANS.PROFESSIONAL.price,
    analysesLimit: PLANS.PROFESSIONAL.analyses,
    savedLimit: 200,
    features: [
      '150 Analyses / 30 Days',
      'Monte Carlo Stress Tests +200bps',
      'PDF Memorandum Export',
      'Multi-asset Portfolio Aggregation',
      'Yield & Sensitivity Calculator',
      'Cross-border Tax & Visa Matrix',
      'Save 200',
    ],
  },
  enterprise: {
    key: 'enterprise',
    displayName: 'SOVEREIGN',
    originalPrice: 999,
    launchPrice: PLANS.SOVEREIGN.price,
    analysesLimit: PLANS.SOVEREIGN.analyses,
    savedLimit: Infinity,
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
  },
};

function normalizePlanKey(raw?: string | null): PlanKey {
  const val = (raw || '').toLowerCase().trim();
  if (val === 'starter' || val === 'standard') return 'starter';
  if (val === 'pro' || val === 'professional') return 'pro';
  if (val === 'enterprise' || val === 'sovereign' || val === 'agency') return 'enterprise';
  return 'free';
}

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

function getClientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || '127.0.0.1';
}

// =========================================================================
// 2. INLINED SERVER STORE (Shared Disk + Upstash KV Persistence)
// =========================================================================

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

interface ServerUserRecord {
  email: string;
  name: string;
  plan: PlanKey;
  license_start: number | null;
  license_end: number | null;
  analyses_used: number;
  saved_analyses: any[];
  custom_cities: any[];
  timezone: string;
  day29_email_sent: boolean;
  expired_email_sent: boolean;
  updated_at: number;
  last_login_at: number | null;
  total_paid_usd: number;
  analyses_log: any[];
  pdf_downloads: any[];
  payments: any[];
  timeline: any[];
  refund_requested: boolean;
  refund_status: 'none' | 'pending' | 'approved' | 'denied';
  refund_notes: string;
  refund_policy_accepted_at: string | null;
  locked_launch_price: number | null;
  lemon_customer_email: string | null;
}

interface StoreShape {
  users: Record<string, ServerUserRecord>;
  webhook_logs: WebhookLogEntry[];
  failed_webhooks: any[];
  email_logs: any[];
  pricing_config: any;
  pricing_logs: any[];
  pending_checkouts: Record<string, any>;
  used_orders: Record<string, any>;
}

function createDefaultPricingConfig() {
  const now = Date.now();
  return {
    launchDiscountActive: true,
    launchBadgeText: DEFAULT_LAUNCH_BADGE,
    launchEndsAt: now + 7 * 24 * 60 * 60 * 1000,
    updatedAt: now,
    plans: {
      free: { ...PLAN_DEFINITIONS.free },
      starter: { ...PLAN_DEFINITIONS.starter },
      pro: { ...PLAN_DEFINITIONS.pro },
      enterprise: { ...PLAN_DEFINITIONS.enterprise, savedLimit: null },
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
          pricing_config: parsed.pricing_config || createDefaultPricingConfig(),
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
  } catch {}
  return getMemoryStore();
}

function persistStore(store: StoreShape): void {
  memoryStoreCache = store;
  try {
    fs.writeFileSync(getStoreFile(), JSON.stringify(store, null, 2), 'utf8');
  } catch {}
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
    if (!res.ok) throw new Error(`KV HTTP ${res.status}`);
    const json = await res.json();
    return json?.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function getPricingPublicPayload() {
  const store = loadStore();
  const cfg = store.pricing_config || createDefaultPricingConfig();
  const plansMap: Record<PlanKey, any> = {} as any;
  for (const k of ['free', 'starter', 'pro', 'enterprise'] as PlanKey[]) {
    const p = cfg.plans?.[k] || PLAN_DEFINITIONS[k];
    plansMap[k] = {
      key: k,
      displayName: p.displayName,
      originalPrice: p.originalPrice,
      launchPrice: p.launchPrice,
      activePrice: k === 'free' ? 0 : cfg.launchDiscountActive ? p.launchPrice : p.originalPrice,
    };
  }
  return {
    launchDiscountActive: Boolean(cfg.launchDiscountActive),
    plansMap,
  };
}

function getOrCreateServerUser(rawEmail: string, hints?: { name?: string }): ServerUserRecord {
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
        last_login_at: now,
      },
      email
    );
    store.users[email] = user;
    persistStore(store);
  }
  return user;
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

  const alreadyRecorded = existing.payments.some((p: any) => p.order_id === orderId);

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
          type: 'purchase',
          message: `Purchased ${planCfg.displayName} $${amount} - Order #${orderId} (${
            params.testMode ? 'TEST' : 'LIVE'
          })`,
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

function recordSubscriptionUpdated(params: {
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

function recordOrderRefunded(params: {
  email: string;
  orderId: string;
  amountUSD?: number;
}): ServerUserRecord {
  const user = getOrCreateServerUser(params.email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const timelineEntry = {
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

async function findUsersByOrderId(orderId: string): Promise<string[]> {
  const normOrder = normalizeOrderId(orderId);
  const affected: string[] = [];
  if (!normOrder) return affected;

  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:used_order:${normOrder}`]);
      const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      if (parsed?.login_email) affected.push(normalizeEmail(parsed.login_email));
    }
  } catch {}

  const store = loadStore();
  if (store.used_orders?.[normOrder]?.login_email) {
    affected.push(normalizeEmail(store.used_orders[normOrder].login_email));
  }
  for (const user of Object.values(store.users || {})) {
    if (user?.payments?.some((p: any) => normalizeOrderId(p.order_id) === normOrder)) {
      affected.push(normalizeEmail(user.email));
    }
  }
  return Array.from(new Set(affected.filter(Boolean)));
}

function recordFailedWebhook(reason: string, ip?: string) {
  const store = loadStore();
  const log = {
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

async function updateWebhookLogInDb(
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

// =========================================================================
// 3. LEMON SQUEEZY PLAN RESOLVER & HANDLER
// =========================================================================

const VARIANT_ID_TO_PLAN: Record<string, PlanKey> = {
  'da826632-dcb4-4885-966e-aac1fab84cb3': 'starter',
  '404c54cb-29c5-477a-b8c2-772092f5459a': 'pro',
  'ce8dfbdb-cedd-4445-a947-e821522472bb': 'enterprise',
};

function mapVariantOrProductToPlan(
  attributes: any,
  customData: any,
  payload: any
): PlanKey {
  const variantId = String(
    attributes?.first_order_item?.variant_id || attributes?.variant_id || ''
  ).trim();
  const productId = String(
    attributes?.first_order_item?.product_id || attributes?.product_id || ''
  ).trim();

  if (variantId && getEnv('LEMON_STARTER_VARIANT_ID') && variantId === getEnv('LEMON_STARTER_VARIANT_ID')) return 'starter';
  if (variantId && getEnv('LEMON_PRO_VARIANT_ID') && variantId === getEnv('LEMON_PRO_VARIANT_ID')) return 'pro';
  if (variantId && getEnv('LEMON_SOVEREIGN_VARIANT_ID') && variantId === getEnv('LEMON_SOVEREIGN_VARIANT_ID')) return 'enterprise';
  if (productId && getEnv('LEMON_STARTER_PRODUCT_ID') && productId === getEnv('LEMON_STARTER_PRODUCT_ID')) return 'starter';
  if (productId && getEnv('LEMON_PRO_PRODUCT_ID') && productId === getEnv('LEMON_PRO_PRODUCT_ID')) return 'pro';
  if (productId && getEnv('LEMON_SOVEREIGN_PRODUCT_ID') && productId === getEnv('LEMON_SOVEREIGN_PRODUCT_ID')) return 'enterprise';
  if (variantId && VARIANT_ID_TO_PLAN[variantId]) return VARIANT_ID_TO_PLAN[variantId];

  const productName = (
    attributes?.first_order_item?.product_name ||
    attributes?.first_order_item?.variant_name ||
    attributes?.product_name ||
    attributes?.variant_name ||
    customData?.plan ||
    payload?.plan ||
    ''
  )
    .toString()
    .toLowerCase();

  if (
    productName.includes('sovereign') ||
    productName.includes('enterprise') ||
    productName.includes('agency')
  ) {
    return 'enterprise';
  }
  if (productName.includes('professional') || /\bpro\b/.test(productName)) {
    return 'pro';
  }
  if (productName.includes('starter')) {
    return 'starter';
  }

  // Exact amount matching in BOTH cents and dollars
  const rawCents = Number(attributes?.total ?? attributes?.subtotal ?? attributes?.first_order_item?.price ?? 0);
  const roundedCents = Math.round(rawCents);
  const usd = rawCents > 1000 ? rawCents / 100 : rawCents;
  const roundedUsd = Math.round(usd);

  if (roundedCents === 59900 || roundedUsd === 599 || roundedCents === 99900 || roundedUsd === 999) {
    return 'enterprise';
  }
  if (roundedCents === 19900 || roundedUsd === 199 || roundedCents === 34900 || roundedUsd === 349) {
    return 'pro';
  }
  if (roundedCents === 7900 || roundedUsd === 79 || roundedCents === 12900 || roundedUsd === 129) {
    return 'starter';
  }

  const normalized = normalizePlanKey(customData?.plan || payload?.plan);
  return normalized === 'free' ? 'pro' : normalized;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret =
    cleanEnvValue(getEnv('LEMON_WEBHOOK_SECRET')) ||
    cleanEnvValue(getEnv('LEMONSQUEEZY_WEBHOOK_SECRET')) ||
    '';
  const ip = getClientIp(req);

  let preLog: WebhookLogEntry | null = null;

  try {
    const signature = (req.headers?.['x-signature'] || req.headers?.['X-Signature'] || '')
      .toString()
      .trim();

    let rawBody = '';
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (req.rawBody) {
      rawBody = req.rawBody;
    } else {
      rawBody = JSON.stringify(req.body || {});
    }

    let payload: any = {};
    try {
      if (typeof req.body === 'string' || (typeof Buffer !== 'undefined' && Buffer.isBuffer(req.body))) {
        payload = JSON.parse(rawBody || '{}');
      } else if (req.body && typeof req.body === 'object') {
        payload = req.body;
      } else if (rawBody) {
        payload = JSON.parse(rawBody);
      }
    } catch (parseErr: any) {
      console.error('[Lemon Webhook] JSON parse warning:', parseErr?.message || parseErr);
      payload = {};
    }

    const eventName = (
      payload?.meta?.event_name ||
      payload?.event_name ||
      req.headers?.['x-event-name'] ||
      'unknown'
    )
      .toString()
      .trim();
    const customData = payload?.meta?.custom_data || {};
    const attributes = payload?.data?.attributes || {};

    const paymentEmail = (
      attributes?.user_email ||
      attributes?.customer_email ||
      customData?.email ||
      payload?.email ||
      ''
    )
      .toString()
      .toLowerCase()
      .trim();
    const accountEmail = (customData?.user_email || paymentEmail || '')
      .toString()
      .toLowerCase()
      .trim();

    const planCode = mapVariantOrProductToPlan(attributes, customData, payload);
    const orderId = (
      payload?.data?.id ||
      attributes?.order_id ||
      attributes?.order_number ||
      attributes?.identifier ||
      `ord_${Date.now()}`
    ).toString();

    const isTestMode = Boolean(
      payload?.meta?.test_mode === true ||
        attributes?.test_mode === true ||
        customData?.test_mode === 'true' ||
        payload?.test_mode === true ||
        getEnv('LEMON_TEST_MODE') === 'true'
    );

    const pricing = getPricingPublicPayload();
    const dynamicPlan = pricing.plansMap?.[planCode];
    const fallbackPlanPrice =
      dynamicPlan?.activePrice ?? PLAN_DEFINITIONS[planCode]?.launchPrice ?? 199;
    const rawTotal =
      attributes?.total ??
      attributes?.subtotal ??
      (fallbackPlanPrice ? fallbackPlanPrice * 100 : 0);
    const amountUSD =
      Number(rawTotal) > 1000
        ? Number(rawTotal) / 100
        : Number(rawTotal || fallbackPlanPrice || 0);
    const currency = (attributes?.currency || 'USD').toString().toUpperCase();
    const createdAt = (
      attributes?.created_at ||
      attributes?.order_date ||
      new Date().toISOString()
    ).toString();

    try {
      preLog = await appendWebhookLogToDb({
        order_id: orderId,
        event: eventName,
        event_name: eventName,
        plan: planCode,
        email: paymentEmail || accountEmail || 'unknown',
        payment_email: paymentEmail || undefined,
        created_at: createdAt,
        amount: amountUSD,
        currency,
        test_mode: isTestMode,
        signature_valid: false,
        raw_error: 'Signature verification pending',
        error: 'Signature verification pending',
      });
    } catch (dbErr) {
      console.error('[Lemon Webhook] DB pre-log write failed:', dbErr);
    }

    if (!webhookSecret) {
      const rawError = 'LEMON_WEBHOOK_SECRET not configured on server';
      recordFailedWebhook(rawError, ip);
      if (preLog) {
        await updateWebhookLogInDb(preLog.id, {
          signature_valid: false,
          raw_error: rawError,
          error: rawError,
        }).catch((e) => console.error('[Lemon Webhook] DB update failed:', e));
      }
      return res.status(401).json({ error: 'Webhook verification failed: missing secret configuration' });
    }

    if (!signature) {
      const rawError = 'Missing X-Signature header';
      recordFailedWebhook(rawError, ip);
      if (preLog) {
        await updateWebhookLogInDb(preLog.id, {
          signature_valid: false,
          raw_error: rawError,
          error: rawError,
        }).catch((e) => console.error('[Lemon Webhook] DB update failed:', e));
      }
      return res.status(401).json({ error: 'Invalid webhook signature: missing X-Signature' });
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
      const rawError = 'Invalid X-Signature HMAC mismatch';
      recordFailedWebhook(rawError, ip);
      if (preLog) {
        await updateWebhookLogInDb(preLog.id, {
          signature_valid: false,
          raw_error: rawError,
          error: rawError,
        }).catch((e) => console.error('[Lemon Webhook] DB update failed:', e));
      }
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    if (preLog) {
      await updateWebhookLogInDb(preLog.id, {
        signature_valid: true,
        payment_email: paymentEmail || 'unknown',
        created_at: createdAt,
        raw_error: undefined,
        error: undefined,
      }).catch((e) => console.error('[Lemon Webhook] DB valid update failed:', e));
    }

    const customerName =
      attributes?.user_name || attributes?.customer_name || (paymentEmail || accountEmail || 'user').split('@')[0];
    const productName = (
      attributes?.first_order_item?.product_name ||
      attributes?.product_name ||
      customData?.plan ||
      payload?.plan ||
      'Aqari AI - Pro'
    ).toString();

    const paymentTimestamp = new Date(createdAt).getTime() || Date.now();
    const subscriptionEndsAt = paymentTimestamp + THIRTY_DAYS_MS;

    const customLockedLaunch = Number(customData?.launch_price_locked || 0);
    const lockedLaunchPrice =
      customLockedLaunch > 0
        ? customLockedLaunch
        : customData?.is_launch_price === 'true' || pricing.launchDiscountActive
        ? amountUSD
        : null;

    let subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'refunded' | 'past_due' = 'active';
    let persistedUser: ServerUserRecord | null = null;
    const targetEmail = accountEmail || paymentEmail;

    switch (eventName) {
      case 'order_created': {
        subscriptionStatus = 'active';
        if (!preLog) {
          await appendWebhookLogToDb({
            order_id: orderId,
            event: 'order_created',
            event_name: 'order_created',
            plan: planCode,
            email: paymentEmail || 'unknown',
            payment_email: paymentEmail || 'unknown',
            created_at: createdAt,
            amount: amountUSD,
            currency,
            test_mode: isTestMode,
            signature_valid: true,
          });
        }
        if (targetEmail) {
          persistedUser = activatePaidPlanOnServer({
            email: targetEmail,
            name: customerName,
            plan: planCode,
            paymentTimestamp,
            orderId,
            amountUSD,
            currency,
            testMode: isTestMode,
            refundPolicyAcceptedAt:
              customData?.refund_accepted_at || new Date(paymentTimestamp).toISOString(),
            lockedLaunchPrice,
            lemonCustomerEmail: paymentEmail || null,
          });
          await saveUserToDb(persistedUser);
        }
        break;
      }

      case 'subscription_created':
      case 'subscription_payment_success':
      case 'subscription_resumed':
        subscriptionStatus = 'active';
        if (targetEmail) {
          persistedUser = activatePaidPlanOnServer({
            email: targetEmail,
            name: customerName,
            plan: planCode,
            paymentTimestamp,
            orderId,
            amountUSD,
            currency,
            testMode: isTestMode,
            refundPolicyAcceptedAt:
              customData?.refund_accepted_at || new Date(paymentTimestamp).toISOString(),
            lockedLaunchPrice,
            lemonCustomerEmail: paymentEmail || null,
          });
          await saveUserToDb(persistedUser);
        }
        break;

      case 'subscription_updated': {
        const subStatus = (attributes?.status || '').toString().toLowerCase();
        subscriptionStatus =
          subStatus === 'expired'
            ? 'expired'
            : subStatus === 'cancelled'
            ? 'cancelled'
            : 'active';
        const renewsOrEndsStr = attributes?.renews_at || attributes?.ends_at;
        const licenseEndMs = renewsOrEndsStr ? new Date(renewsOrEndsStr).getTime() : null;
        if (targetEmail) {
          persistedUser = recordSubscriptionUpdated({
            email: targetEmail,
            plan: planCode,
            licenseEndMs,
            status: subStatus,
          });
          await saveUserToDb(persistedUser);
        }
        break;
      }

      case 'order_refunded': {
        subscriptionStatus = 'refunded';
        const affectedEmails = await findUsersByOrderId(orderId);
        const revokeEmails = Array.from(
          new Set([targetEmail, paymentEmail, ...affectedEmails].filter(Boolean))
        );
        for (const revEmail of revokeEmails) {
          persistedUser = recordOrderRefunded({
            email: revEmail,
            orderId,
            amountUSD,
          });
          await saveUserToDb(persistedUser);
        }
        break;
      }

      case 'subscription_cancelled':
        subscriptionStatus = 'cancelled';
        if (targetEmail) {
          const endsAtStr = attributes?.ends_at;
          persistedUser = updateServerUser(targetEmail, {
            license_end: endsAtStr ? new Date(endsAtStr).getTime() : undefined,
          });
          await saveUserToDb(persistedUser);
        }
        break;

      case 'subscription_expired':
        subscriptionStatus = 'expired';
        if (targetEmail) {
          persistedUser = updateServerUser(targetEmail, {
            plan: 'free',
            analyses_used: 0,
          });
          await saveUserToDb(persistedUser);
        }
        break;

      case 'subscription_payment_failed':
        subscriptionStatus = 'past_due';
        break;

      default:
        subscriptionStatus = 'active';
        break;
    }

    return res.status(200).json({
      success: true,
      eventName,
      order_id: orderId,
      payment_email: paymentEmail || null,
      amount: amountUSD,
      plan: planCode,
      created_at: createdAt,
      test_mode: isTestMode,
      currency,
      customerName,
      productName,
      displayPlan: PLAN_DEFINITIONS[planCode]?.displayName || 'PROFESSIONAL',
      subscriptionStatus,
      license_start: paymentTimestamp,
      license_end: persistedUser?.license_end ?? subscriptionEndsAt,
      log: preLog
        ? {
            ...preLog,
            signature_valid: true,
            payment_email: paymentEmail || 'unknown',
            created_at: createdAt,
            raw_error: undefined,
            error: undefined,
          }
        : null,
    });
  } catch (error: any) {
    const rawError = error?.message || 'Webhook processing failed';
    console.error('Error processing Lemon Squeezy webhook:', error);
    if (preLog) {
      await updateWebhookLogInDb(preLog.id, {
        raw_error: rawError,
        error: rawError,
      }).catch((e) => console.error('[Lemon Webhook] DB error update failed:', e));
    }
    return res.status(200).json({ success: false, error: rawError });
  }
}
