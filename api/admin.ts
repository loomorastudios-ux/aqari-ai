// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// =========================================================================
// 1. INLINED PLANS, SECURITY & ENV HELPERS (Zero external ../lib imports)
// =========================================================================

type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise';

const PRODUCTION_URL = 'https://aqari-ai-rho.vercel.app';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LAUNCH_BADGE = 'LAUNCH -40% - First 30 users only';
const SESSION_COOKIE_NAME = 'aqari_session';
const EMAIL_FROM = 'AQARI Terminal <onboarding@resend.dev>';
const EMAIL_FROM_ADDRESS = 'onboarding@resend.dev';

const PLANS: Record<
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
    savedLimit: 3,
    features: [
      '3 Analyses / 30 Days',
      'Basic Cap Rate',
      'Cash-on-Cash only',
    ],
  },
  starter: {
    key: 'starter',
    displayName: 'STARTER',
    originalPrice: 129,
    launchPrice: 79,
    analysesLimit: 30,
    savedLimit: 15,
    features: [
      '30 Analyses / 30 Days',
      'Yield & Sensitivity Calculator',
      'Cross-border Tax & Visa Matrix',
      'Save 15',
    ],
  },
  pro: {
    key: 'pro',
    displayName: 'PROFESSIONAL',
    originalPrice: 349,
    launchPrice: 199,
    analysesLimit: 150,
    savedLimit: 75,
    features: [
      '150 Analyses / 30 Days',
      'Monte Carlo Stress Tests +200bps',
      'PDF Memorandum Export',
      'Multi-asset Portfolio Aggregation',
      'Yield & Sensitivity Calculator',
      'Cross-border Tax & Visa Matrix',
      'Save 75',
    ],
  },
  enterprise: {
    key: 'enterprise',
    displayName: 'SOVEREIGN',
    originalPrice: 999,
    launchPrice: 599,
    analysesLimit: 400,
    savedLimit: 400,
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
      'Save 400',
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

function findPlanPricing(payload: any, key: PlanKey) {
  if (!payload) return undefined;
  if (payload.plansMap?.[key]) return payload.plansMap[key];
  if (Array.isArray(payload.plans)) {
    return payload.plans.find((p: any) => p.key === key || p.id === key);
  }
  return payload.plans?.[key];
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

function isAdminEmail(email?: string | null): boolean {
  const norm = (email || '').trim().toLowerCase();
  if (!norm) return false;
  return (
    norm === getAdminEmail() ||
    norm === 'loomora.studios@gmail.com' ||
    norm === 'loomorastudios@gmail.com'
  );
}

function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
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

// =========================================================================
// 2. INLINED SERVER STORE HELPERS
// =========================================================================

function getStoreFile(): string {
  try {
    return path.join('/tmp', 'aqari_terminal_store_v1.json');
  } catch {
    return '/tmp/aqari_terminal_store_v1.json';
  }
}

function createDefaultPricingConfig() {
  const now = Date.now();
  return {
    launchDiscountActive: true,
    launchBadgeText: DEFAULT_LAUNCH_BADGE,
    launchEndsAt: now + 7 * 24 * 60 * 60 * 1000,
    updatedAt: now,
    plans: {
      free: { ...PLANS.free },
      starter: { ...PLANS.starter },
      pro: { ...PLANS.pro },
      enterprise: { ...PLANS.enterprise },
    },
  };
}

let memoryStoreCache: any = null;

function getMemoryStore() {
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
    };
  }
  return memoryStoreCache;
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function hydrateUserRecord(raw: any, email: string) {
  const now = Date.now();
  return {
    email,
    name: raw?.name || email.split('@')[0],
    plan: normalizePlanKey(raw?.plan),
    license_start: raw?.license_start ?? now,
    license_end: raw?.license_end ?? now + THIRTY_DAYS_MS,
    analyses_used: Math.max(0, Number(raw?.analyses_used ?? 0)),
    successful_analyses: Math.max(0, Number(raw?.successful_analyses ?? 0)),
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
    payment_customer_email: raw?.payment_customer_email ? String(raw.payment_customer_email).toLowerCase() : null,
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
  };
}

function hydratePricingConfig(raw: any) {
  const def = createDefaultPricingConfig();
  if (!raw || typeof raw !== 'object') return def;
  const plans: any = { ...def.plans };
  for (const k of ['free', 'starter', 'pro', 'enterprise'] as PlanKey[]) {
    const r = raw.plans?.[k];
    if (r && typeof r === 'object') {
      const analysesLimit = Number.isFinite(Number(r.analysesLimit)) && Number(r.analysesLimit) > 0 ? Number(r.analysesLimit) : def.plans[k].analysesLimit;
      const rawFeatures: string[] = Array.isArray(r.features) && r.features.length > 0 ? r.features.map(String) : def.plans[k].features;
      const normalizedFeatures = rawFeatures
        .filter((f) => !(k === 'free' && f.startsWith('No Monte Carlo')))
        .map((f) => {
          const trimmed = f.trim();
          if (/^unlimited\s+saved$/i.test(trimmed)) return `Save ${def.plans[k].savedLimit}`;
          if (/^save\s+\d+$/i.test(trimmed)) return `Save ${def.plans[k].savedLimit}`;
          return f;
        });
      plans[k] = {
        key: k,
        displayName: def.plans[k].displayName,
        originalPrice: Number.isFinite(Number(r.originalPrice)) ? Number(r.originalPrice) : def.plans[k].originalPrice,
        launchPrice: Number.isFinite(Number(r.launchPrice)) ? Number(r.launchPrice) : def.plans[k].launchPrice,
        analysesLimit,
        savedLimit: Math.min(analysesLimit, def.plans[k].savedLimit),
        features: normalizedFeatures.length > 0 ? normalizedFeatures : def.plans[k].features,
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

function loadStore() {
  try {
    const storeFile = getStoreFile();
    if (fs.existsSync(storeFile)) {
      const parsed = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        const users: Record<string, any> = {};
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
          pending_checkouts: parsed.pending_checkouts || {},
          used_orders: parsed.used_orders || {},
          analyst_threads: parsed.analyst_threads || {},
          whiteglove_requests: Array.isArray(parsed.whiteglove_requests) ? parsed.whiteglove_requests : [],
          api_keys: parsed.api_keys || {},
        };
      }
    }
  } catch {}
  return getMemoryStore();
}

function persistStore(store: any): void {
  memoryStoreCache = store;
  try {
    fs.writeFileSync(getStoreFile(), JSON.stringify(store, null, 2), 'utf8');
  } catch {}
}

function enforceServerUserExpiry(rawEmail: string): any {
  const store = loadStore();
  const email = normalizeEmail(rawEmail) || 'guest@aqari-ai-rho.vercel.app';
  const user = store.users[email];
  const now = Date.now();
  if (!user) return getOrCreateServerUser(email);

  if (user.plan !== 'free' && user.license_end && now >= user.license_end) {
    const prevPlan = PLANS[normalizePlanKey(user.plan)].displayName;
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

function getOrCreateServerUser(rawEmail: string): any {
  const store = loadStore();
  const email = normalizeEmail(rawEmail) || 'guest@aqari-ai-rho.vercel.app';
  let user = store.users[email];
  if (!user) {
    const now = Date.now();
    user = hydrateUserRecord(
      {
        email,
        name: email.split('@')[0],
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
  return enforceServerUserExpiry(email);
}

function updateServerUser(email: string, patch: any) {
  const store = loadStore();
  const norm = normalizeEmail(email);
  const existing = getOrCreateServerUser(norm);
  const updated = {
    ...existing,
    ...patch,
    email: norm,
    updated_at: Date.now(),
  };
  store.users[norm] = updated;
  persistStore(store);
  return updated;
}

function getAllServerUsers() {
  const store = loadStore();
  return Object.keys(store.users).map((email) => enforceServerUserExpiry(email));
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
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getServerUserFromDb(rawEmail: string): Promise<any> {
  const norm = normalizeEmail(rawEmail);
  try {
    const kv = getKvConfig();
    if (kv) {
      const raw = await kvCommand(['GET', `aqari:user:${norm}`]);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const hydrated = hydrateUserRecord(parsed, norm);
        const store = loadStore();
        store.users[norm] = hydrated;
        persistStore(store);
      }
    }
  } catch {}
  return getOrCreateServerUser(norm);
}

async function saveServerUserToDb(user: any): Promise<void> {
  const norm = normalizeEmail(user?.email);
  if (!norm) return;
  const store = loadStore();
  store.users[norm] = user;
  persistStore(store);
  try {
    const kv = getKvConfig();
    if (kv) {
      await kvCommand(['SET', `aqari:user:${norm}`, JSON.stringify(user)]);
    }
  } catch {}
}

async function getAllServerUsersFromDb(): Promise<any[]> {
  try {
    const kv = getKvConfig();
    if (kv) {
      const rawIdx = await kvCommand(['GET', 'aqari:users_index:v1']);
      const idx: string[] = Array.isArray(rawIdx)
        ? rawIdx.map(String)
        : typeof rawIdx === 'string'
        ? JSON.parse(rawIdx)
        : [];
      const store = loadStore();
      for (const em of idx.slice(0, 200)) {
        const norm = normalizeEmail(em);
        if (!norm) continue;
        const raw = await kvCommand(['GET', `aqari:user:${norm}`]);
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          store.users[norm] = hydrateUserRecord(parsed, norm);
        }
      }
      persistStore(store);
    }
  } catch {}
  return getAllServerUsers();
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

async function getCancellationLogsFromDb(limit = 100): Promise<any[]> {
  try {
    const kv = getKvConfig();
    if (kv) {
      const rawItems = await kvCommand(['LRANGE', 'aqari:cancellation_logs:v1', 0, Math.max(0, limit - 1)]);
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
  return (loadStore().cancellation_logs || []).slice(0, limit);
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

async function getWebhookLogsFromDb(limit = 50): Promise<any[]> {
  try {
    const kv = getKvConfig();
    if (kv) {
      const rawItems = await kvCommand(['LRANGE', 'aqari:webhook_logs:v1', 0, Math.max(0, limit - 1)]);
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
  return (loadStore().webhook_logs || []).slice(0, limit);
}

async function getFailedWebhooksFromDb(limit = 50): Promise<any[]> {
  try {
    const kv = getKvConfig();
    if (kv) {
      const rawItems = await kvCommand(['LRANGE', 'aqari:failed_webhooks:v1', 0, Math.max(0, limit - 1)]);
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
  return (loadStore().failed_webhooks || []).slice(0, limit);
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

function getPricingPublicPayload() {
  const store = loadStore();
  const cfg = store.pricing_config || createDefaultPricingConfig();
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((cfg.launchEndsAt - now) / (24 * 60 * 60 * 1000)));
  const plansMap: Record<PlanKey, any> = {} as any;
  const plansList: any[] = [];

  for (const k of ['free', 'starter', 'pro', 'enterprise'] as PlanKey[]) {
    const p = cfg.plans[k];
    const entry = {
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

function computeServerLicenseStatus(user: any) {
  const pricing = getPricingPublicPayload();
  const rawPlanKey = normalizePlanKey(user.plan);
  const now = Date.now();
  const hasPaidEnd = Boolean(rawPlanKey !== 'free' && user.license_end);
  const isExpired = Boolean(hasPaidEnd && user.license_end <= now);
  const effectivePlanKey: PlanKey = isExpired ? 'free' : rawPlanKey;
  const dynamicPlan = pricing.plansMap?.[effectivePlanKey];
  const planCfg = PLANS[effectivePlanKey];
  const analysesLimit = dynamicPlan?.analysesLimit || planCfg.analysesLimit;
  const savedLimit = dynamicPlan?.savedLimit === null ? Infinity : (dynamicPlan?.savedLimit ?? planCfg.savedLimit);
  const isUnlimitedAnalyses = !Number.isFinite(analysesLimit);
  const analysesUsed = Math.max(0, Number(user.analyses_used || 0));
  const analysesLeft = isUnlimitedAnalyses ? Infinity : Math.max(0, analysesLimit - analysesUsed);
  const daysLeft =
    effectivePlanKey !== 'free' && user.license_end
      ? Math.max(0, Math.ceil((user.license_end - now) / (1000 * 60 * 60 * 24)))
      : isExpired
      ? 0
      : 30;

  return {
    planKey: effectivePlanKey,
    displayName: planCfg.displayName,
    isExpired,
    daysLeft,
    daysTotal: 30,
    analysesLimit,
    analysesUsed,
    analysesLeft,
    savedLimit,
    isUnlimitedAnalyses,
    isUnlimitedSaved: !Number.isFinite(savedLimit),
  };
}

function evaluateRefundEligibility(user: any) {
  const DAY_MS = 86_400_000;
  const now = Date.now();
  const latestPayment = user.payments?.[0];
  const purchaseTs = latestPayment
    ? new Date(latestPayment.timestamp).getTime()
    : user.license_start || now;
  const daysSincePurchase = Math.max(0, Math.floor((now - purchaseTs) / DAY_MS));
  const daysSinceExact = Math.max(0, (now - purchaseTs) / DAY_MS);
  const successfulAnalyses = Math.max(0, Number(user.successful_analyses || 0));
  const analysesCount = Math.max(user.analyses_used || 0, (user.analyses_log || []).length);
  const pdfDownloadsCount = (user.pdf_downloads || []).length;

  const hasReportedIssue = Boolean(user.has_reported_issue);
  const issueReportedAt = user.issue_reported_at ? Number(user.issue_reported_at) : null;
  const issueResolvedAt = user.issue_resolved_at ? Number(user.issue_resolved_at) : null;
  const resolvedWithin7Days = Boolean(
    hasReportedIssue && issueResolvedAt && issueReportedAt && issueResolvedAt - issueReportedAt <= 7 * DAY_MS
  );
  const unresolvedOver7Days = Boolean(
    hasReportedIssue && !issueResolvedAt && issueReportedAt && now - issueReportedAt >= 7 * DAY_MS
  );

  let eligible = false;
  let verdict = '';
  const reasons: string[] = [];

  if (successfulAnalyses >= 1) {
    eligible = false;
    reasons.push(`Rule A: ${successfulAnalyses} successful analysis completed`);
    verdict = `DENIED (Rule A): User completed ${successfulAnalyses} successful analysis`;
  } else if (daysSinceExact > 7 && !hasReportedIssue) {
    eligible = false;
    reasons.push(`Rule B: ${daysSincePurchase} days passed with no tool issue reported`);
    verdict = `DENIED (Rule B): ${daysSincePurchase} days passed and no tool issue reported`;
  } else if (hasReportedIssue && resolvedWithin7Days && daysSinceExact > 7) {
    eligible = false;
    reasons.push('Rule E: Issue resolved within 7 days and 7-day window passed');
    verdict = 'DENIED (Rule E): Tool issue resolved within 7 days and 7-day window passed';
  } else if (hasReportedIssue && unresolvedOver7Days && successfulAnalyses === 0) {
    eligible = true;
    verdict = 'ELIGIBLE (Rule D): Reported tool issue unresolved > 7 days and 0 successful analyses';
  } else if (daysSinceExact <= 7 && successfulAnalyses === 0) {
    eligible = true;
    verdict = 'ELIGIBLE (Rule C): Within 7 days and 0 successful analyses';
  } else if (hasReportedIssue && !issueResolvedAt && !unresolvedOver7Days) {
    eligible = false;
    reasons.push('Issue reported under 7-day resolution review');
    verdict = 'PENDING REVIEW: Issue reported - Under 7-day review';
  } else {
    eligible = false;
    verdict = 'DENIED: Outside eligibility criteria';
  }

  return {
    eligible,
    verdict,
    reasons,
    daysSincePurchase,
    analysesCount,
    successfulAnalyses,
    pdfDownloadsCount,
    hasReportedIssue,
    resolvedWithin7Days,
    unresolvedOver7Days,
  };
}

function adminChangeUserPlan(params: { email: string; newPlan: PlanKey; reason: string; adminEmail: string }) {
  const user = getOrCreateServerUser(params.email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const prevPlanDisplay = PLANS[normalizePlanKey(user.plan)].displayName;
  const nextPlanDisplay = PLANS[params.newPlan].displayName;
  const timelineEntry = {
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

function recordRefundDecision(params: {
  email: string;
  status: 'pending' | 'approved' | 'denied';
  notes: string;
  actorEmail: string;
}) {
  const user = getOrCreateServerUser(params.email);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const evalResult = evaluateRefundEligibility(user);
  const timelineEntry = {
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

function updateServerPlanPricing(params: {
  planKey: PlanKey;
  originalPrice?: number;
  launchPrice?: number;
  analysesLimit?: number;
  features?: string[];
  adminEmail: string;
}) {
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

  const log = {
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

function updateLaunchDiscountSettings(params: {
  launchDiscountActive?: boolean;
  launchBadgeText?: string;
  countdownDays?: number;
  adminEmail: string;
}) {
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

  const log = {
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

// =========================================================================
// 3. INLINED PDF GENERATOR & DAY-29 TEST EMAILER
// =========================================================================

function escapePdfText(input: string): string {
  return (input || '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxChars = 88): string[] {
  const clean = (text || '').trim();
  if (!clean) return [''];
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) current = w;
    else if (current.length + 1 + w.length <= maxChars) current += ' ' + w;
    else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildPdfDocument(opts: {
  title: string;
  subtitle?: string;
  lines: string[];
  watermark: string;
  footer: string;
}): Uint8Array {
  const wrappedLines: string[] = [];
  for (const rawLine of opts.lines) {
    for (const seg of String(rawLine).split('\n')) {
      wrappedLines.push(...wrapLine(seg, 86));
    }
  }

  const linesPerPage = 44;
  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['']);

  const objects: string[] = [];
  const pageObjNums: number[] = [];
  let nextObjNum = 5;

  const pageStreams: string[] = pages.map((pageLines, pageIdx) => {
    const ops: string[] = [];
    ops.push('0.08 0.08 0.11 rg');
    ops.push('36 728 540 50 re f');
    ops.push('0.83 0.69 0.22 rg');
    ops.push('36 726 540 2 re f');
    ops.push('BT');
    ops.push('/F2 13 Tf');
    ops.push('0.83 0.69 0.22 rg');
    ops.push(`48 756 Td (${escapePdfText(opts.title)}) Tj`);
    ops.push('ET');
    if (opts.subtitle) {
      ops.push('BT');
      ops.push('/F1 9 Tf');
      ops.push('0.85 0.85 0.88 rg');
      ops.push(`48 740 Td (${escapePdfText(opts.subtitle)}) Tj`);
      ops.push('ET');
    }
    ops.push('BT');
    ops.push('/F1 8 Tf');
    ops.push('0.55 0.45 0.15 rg');
    ops.push(`36 710 Td (${escapePdfText(opts.watermark)}) Tj`);
    ops.push('ET');

    let y = 688;
    for (const line of pageLines) {
      const isHeading =
        line.startsWith('===') ||
        line.endsWith(':') ||
        line.startsWith('SECTION') ||
        line.startsWith('REFUND POLICY');
      ops.push('BT');
      ops.push(isHeading ? '/F2 10 Tf' : '/F1 9.5 Tf');
      ops.push(isHeading ? '0.08 0.08 0.12 rg' : '0.18 0.18 0.22 rg');
      ops.push(`40 ${y} Td (${escapePdfText(line)}) Tj`);
      ops.push('ET');
      y -= 14;
    }

    ops.push('0.82 0.82 0.85 RG');
    ops.push('36 44 m 576 44 l S');
    ops.push('BT');
    ops.push('/F1 8 Tf');
    ops.push('0.35 0.35 0.40 rg');
    ops.push(`36 30 Td (${escapePdfText(`${opts.footer} | Page ${pageIdx + 1} of ${pages.length}`)}) Tj`);
    ops.push('ET');

    return ops.join('\n');
  });

  for (let i = 0; i < pageStreams.length; i++) {
    const pageNum = nextObjNum++;
    const contentNum = nextObjNum++;
    pageObjNums.push(pageNum);
    objects[pageNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`;
    const stream = pageStreams[i];
    objects[contentNum] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 1; i < nextObjNum; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${nextObjNum}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < nextObjNum; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${nextObjNum} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function buildDay29RenewalEmail(params: {
  name: string;
  plan: PlanKey;
  endDateFormatted: string;
  analysesLeft: number | string;
}) {
  const planName = PLANS[params.plan]?.displayName || 'STARTER';
  const subject = `Your AQARI ${planName} ends tomorrow - Renew in 1 click`;
  const renewUrl = `${PRODUCTION_URL}/pricing`;
  const leftText =
    params.analysesLeft === Infinity || params.analysesLeft === 'Unlimited'
      ? 'Unlimited'
      : String(params.analysesLeft);

  const text = [
    `Hi ${params.name},`,
    '',
    `Your ${planName} ends tomorrow (${params.endDateFormatted}). You have ${leftText} analyses left.`,
    '',
    `Renew same plan: ${renewUrl}`,
    `Or Upgrade to Professional ($${PLANS.pro.launchPrice}) / Sovereign ($${PLANS.enterprise.launchPrice}): ${renewUrl}`,
    '',
    `If you don't renew, you will return to FREE (3 analyses).`,
    '',
    `AQARI Global Terminal`,
    PRODUCTION_URL,
  ].join('\n');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#070709;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#0b0b0f;border:1px solid #26262e;border-radius:16px;"><div style="font-family:monospace;color:#D4AF37;font-size:12px;letter-spacing:1.5px;font-weight:bold;margin-bottom:12px;">AQARI GLOBAL TERMINAL • 30-DAY LICENSING NOTICE</div><h1 style="font-size:22px;margin:0 0 16px;color:#ffffff;">Your AQARI ${planName} ends tomorrow</h1><p style="font-size:15px;line-height:1.6;color:#d4d4d8;margin:0 0 16px;">Hi <strong>${params.name}</strong>, your <strong>${planName}</strong> ends tomorrow (<strong>${params.endDateFormatted}</strong>). You have <strong>${leftText}</strong> analyses left.</p><a href="${renewUrl}" style="display:inline-block;padding:12px 22px;background:#D4AF37;color:#000000;font-weight:800;font-family:monospace;text-decoration:none;border-radius:10px;font-size:13px;">Renew ${planName} in 1 Click &rarr;</a><p style="font-size:13px;line-height:1.6;color:#a1a1aa;margin:16px 0 0;border-top:1px solid #27272a;padding-top:16px;">If you don't renew, you will return to <strong>FREE (3 analyses)</strong>.</p></div></body></html>`;

  return { subject, text, html };
}

async function dispatchEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: 'day29_renewal' | 'plan_expired' | 'test_day29' | 'analyst_reply' | 'whiteglove_ready' | 'admin_alert';
}) {
  const resendKey = cleanEnvValue(getEnv('RESEND_API_KEY'));
  const hasResendKey = Boolean(resendKey);
  const keyPrefix = hasResendKey ? resendKey.slice(0, 6) : 'MISSING';

  if (!hasResendKey) {
    await appendEmailLogToDb({
      to: params.to,
      subject: params.subject,
      status: 'simulated',
      event_type: params.type,
      error: 'RESEND_API_KEY missing in Vercel (logged to email_logs)',
    });
    return {
      success: false,
      provider: 'resend',
      status: 'simulated',
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      error: 'RESEND_API_KEY missing in Vercel',
      has_resend_key: false,
      key_prefix: 'MISSING',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    const rawText = await res.text();
    let parsed: any = {};
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {}
    await appendEmailLogToDb({
      to: params.to,
      subject: params.subject,
      status: res.ok ? 'sent' : 'failed',
      event_type: params.type,
      error: res.ok ? undefined : parsed?.message || rawText || res.statusText,
    });
    return {
      success: res.ok,
      provider: 'resend',
      status: res.ok ? 'sent' : 'failed',
      to: params.to,
      from: EMAIL_FROM,
      has_resend_key: true,
      key_prefix: keyPrefix,
      resend_status: res.status,
      resend_id: parsed?.id,
      error: res.ok ? undefined : parsed?.message || rawText || res.statusText,
    };
  } catch (err: any) {
    await appendEmailLogToDb({
      to: params.to,
      subject: params.subject,
      status: 'failed',
      event_type: params.type,
      error: err?.message || 'Resend network error',
    });
    return {
      success: false,
      provider: 'resend',
      status: 'failed',
      to: params.to,
      from: EMAIL_FROM,
      has_resend_key: true,
      key_prefix: keyPrefix,
      error: err?.message || 'Resend network error',
    };
  }
}

function getQueryParam(req: any, url: URL, key: string): string {
  const q = req?.query?.[key];
  if (typeof q === 'string') return q;
  if (Array.isArray(q) && q[0]) return String(q[0]);
  return url.searchParams.get(key) || '';
}

// =========================================================================
// 4. ADMIN API HANDLER
// =========================================================================

export default async function handler(req: any, res: any) {
  let action = 'users';
  try {
    let url: URL;
    try {
      url = new URL(req?.url || '/api/admin', `http://${req?.headers?.host || 'localhost:3000'}`);
    } catch {
      url = new URL('/api/admin', 'http://localhost:3000');
    }
    action = (
      getQueryParam(req, url, 'action') ||
      (req?.body && typeof req.body === 'object' ? req.body.action : '') ||
      'users'
    )
      .toString()
      .trim()
      .toLowerCase();

    const sessionEmail = getSessionEmailFromReq(req);
    if (!isAdminEmail(sessionEmail)) {
      return res.status(403).json({
        error: 'Forbidden: Admin access restricted to owner account',
        code: 'ADMIN_FORBIDDEN',
      });
    }

    res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');

    switch (action) {
      case 'users': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const search = getQueryParam(req, url, 'q').trim().toLowerCase();
        const planFilter = getQueryParam(req, url, 'plan').trim().toLowerCase();
        const statusFilter = getQueryParam(req, url, 'status').trim().toLowerCase();
        const minAnalyses = Number(getQueryParam(req, url, 'minAnalyses') || 0);
        const refundOnly = getQueryParam(req, url, 'refundRequested') === 'true';
        const allUsers = await getAllServerUsersFromDb();
        const failedWebhooks = await getFailedWebhooksFromDb(50);

        const users = allUsers
          .map((u: any) => {
            const license = computeServerLicenseStatus(u);
            const refundEval = evaluateRefundEligibility(u);
            return {
              ...u,
              displayPlan: license.displayName,
              daysLeft: license.daysLeft,
              isExpired: license.isExpired,
              analysesLimit: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit,
              refundEvaluation: refundEval,
            };
          })
          .filter((u: any) => {
            if (search && !u.email.toLowerCase().includes(search)) return false;
            if (
              planFilter &&
              planFilter !== 'all' &&
              u.displayPlan.toLowerCase() !== planFilter &&
              u.plan !== planFilter
            ) {
              return false;
            }
            if (statusFilter === 'expired' && !u.isExpired) return false;
            if (statusFilter === 'active' && u.isExpired) return false;
            if (minAnalyses > 0 && u.analyses_used <= minAnalyses) return false;
            if (refundOnly && !u.refund_requested) return false;
            return true;
          })
          .sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0));

        return res.status(200).json({
          success: true,
          admin: sessionEmail,
          totalUsers: users.length,
          failedWebhooks,
          users,
        });
      }

      case 'stats': {
        const store = loadStore();
        const allUsers = await getAllServerUsersFromDb();
        const webhookLogs = await getWebhookLogsFromDb(100);
        const failedWebhooks = await getFailedWebhooksFromDb(100);
        const emailLogs = await getEmailLogsFromDb(100);
        const threadsMap = await getAnalystThreadsMap();
        const wgList = await getWhiteGloveRequestsFromDb();

        let paidUsers = 0;
        let starterCount = 0;
        let proCount = 0;
        let enterpriseCount = 0;
        let freeCount = 0;
        let totalRevenueUSD = 0;
        let totalAnalysesUsed = 0;

        for (const u of allUsers) {
          const lic = computeServerLicenseStatus(u);
          totalAnalysesUsed += Number(u.analyses_used || 0);
          totalRevenueUSD += Number(u.total_paid_usd || 0);
          if (lic.planKey === 'starter') {
            paidUsers++;
            starterCount++;
          } else if (lic.planKey === 'pro') {
            paidUsers++;
            proCount++;
          } else if (lic.planKey === 'enterprise') {
            paidUsers++;
            enterpriseCount++;
          } else {
            freeCount++;
          }
        }

        const pricing = getPricingPublicPayload();
        const starterPrice = findPlanPricing(pricing, 'starter')?.activePrice || 79;
        const proPrice = findPlanPricing(pricing, 'pro')?.activePrice || 199;
        const entPrice = findPlanPricing(pricing, 'enterprise')?.activePrice || 599;
        const estimatedMrrUSD =
          starterCount * starterPrice + proCount * proPrice + enterpriseCount * entPrice;

        const analystOpenCount = Object.values(threadsMap).filter(
          (t: any) => t?.status !== 'Closed' && (t?.messages?.length || 0) > 0
        ).length;
        const whiteGlovePendingCount = wgList.filter((r: any) => r?.status === 'Pending').length;

        return res.status(200).json({
          success: true,
          admin: sessionEmail,
          stats: {
            totalUsers: allUsers.length,
            paidUsers,
            freeCount,
            planBreakdown: {
              free: freeCount,
              starter: starterCount,
              pro: proCount,
              enterprise: enterpriseCount,
            },
            totalRevenueUSD,
            estimatedMrrUSD,
            totalAnalysesUsed,
            webhookLogsCount: webhookLogs.length,
            failedWebhooksCount: failedWebhooks.length,
            emailLogsCount: emailLogs.length,
            pricingChangesCount: (store.pricing_logs || []).length,
            analystOpenCount,
            whiteGlovePendingCount,
          },
        });
      }

      case 'pricing':
      case 'pricing-get': {
        const store = loadStore();
        return res.status(200).json({
          success: true,
          pricing: getPricingPublicPayload(),
          logs: store.pricing_logs || [],
        });
      }

      case 'pricing-update':
      case 'update_plan': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = req.body || {};
        const planKey = normalizePlanKey(body.planKey || body.plan);
        const features = Array.isArray(body.features)
          ? body.features.map((s: any) => String(s))
          : typeof body.features === 'string'
          ? body.features
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined;

        const result = updateServerPlanPricing({
          planKey,
          originalPrice: body.originalPrice !== undefined ? Number(body.originalPrice) : undefined,
          launchPrice: body.launchPrice !== undefined ? Number(body.launchPrice) : undefined,
          analysesLimit: body.analysesLimit !== undefined ? Number(body.analysesLimit) : undefined,
          features,
          adminEmail: sessionEmail!,
        });

        return res.status(200).json({
          success: true,
          pricing: result.pricing,
          log: result.log,
          logs: loadStore().pricing_logs || [],
        });
      }

      case 'toggle-discount':
      case 'toggle_launch_discount': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = req.body || {};
        const result = updateLaunchDiscountSettings({
          launchDiscountActive:
            typeof body.launchDiscountActive === 'boolean' ? body.launchDiscountActive : undefined,
          launchBadgeText: typeof body.launchBadgeText === 'string' ? body.launchBadgeText : undefined,
          countdownDays: body.countdownDays !== undefined ? Number(body.countdownDays) : undefined,
          adminEmail: sessionEmail!,
        });

        return res.status(200).json({
          success: true,
          pricing: result.pricing,
          log: result.log,
          logs: loadStore().pricing_logs || [],
        });
      }

      case 'user':
      case 'change-plan':
      case 'refund-decision': {
        const rawEmail = (
          getQueryParam(req, url, 'email') ||
          req.params?.email ||
          req.body?.email ||
          ''
        )
          .toString()
          .trim();
        const targetEmail = decodeURIComponent(rawEmail).toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
          return res.status(400).json({ error: 'Valid target user email is required' });
        }

        if (req.method === 'GET' && action === 'user') {
          const user = getOrCreateServerUser(targetEmail);
          const license = computeServerLicenseStatus(user);
          const refundEvaluation = evaluateRefundEligibility(user);
          return res.status(200).json({
            success: true,
            user: {
              ...user,
              displayPlan: license.displayName,
              daysLeft: license.daysLeft,
              isExpired: license.isExpired,
              analysesLimit: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit,
              refundEvaluation,
            },
          });
        }

        if (req.method === 'POST') {
          const body = req.body || {};
          const op = (
            action === 'change-plan'
              ? 'change_plan'
              : action === 'refund-decision'
              ? 'refund_decision'
              : body.operation || body.subAction || (body.newPlan ? 'change_plan' : body.status ? 'refund_decision' : '')
          )
            .toString()
            .trim();

          if (op === 'change_plan') {
            const reason = (body.reason || '').toString().trim();
            if (!reason) {
              return res.status(400).json({
                error: 'Mandatory audit reason is required to modify a user plan',
              });
            }
            const newPlan = normalizePlanKey(body.newPlan);
            const updated = adminChangeUserPlan({
              email: targetEmail,
              newPlan,
              reason,
              adminEmail: sessionEmail!,
            });
            return res.status(200).json({ success: true, user: updated });
          }

          if (op === 'refund_decision') {
            const status =
              body.status === 'approved' ? 'approved' : body.status === 'pending' ? 'pending' : 'denied';
            const updated = recordRefundDecision({
              email: targetEmail,
              status,
              notes: (body.notes || '').toString().trim(),
              actorEmail: sessionEmail!,
            });
            return res.status(200).json({ success: true, user: updated });
          }

          return res.status(400).json({ error: 'Invalid admin user operation' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      case 'export': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const rawEmail = (getQueryParam(req, url, 'email') || req.params?.email || '').toString().trim();
        const targetEmail = decodeURIComponent(rawEmail).toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
          return res.status(400).json({ error: 'Valid target email is required' });
        }

        const user = getOrCreateServerUser(targetEmail);
        const license = computeServerLicenseStatus(user);
        const refundEval = evaluateRefundEligibility(user);
        const nowIso = new Date().toISOString();
        const latestPayment = user.payments?.[0];
        const purchaseDate = latestPayment
          ? latestPayment.timestamp
          : user.license_start
          ? new Date(user.license_start).toISOString()
          : 'N/A';

        const lines: string[] = [
          '=== ACCOUNT & SUBSCRIPTION RECORD ===',
          `Company: Loomora Studios (Owner: Hamed Al Shami, Oman) - AQARI TERMINAL`,
          `Customer Email: ${user.email}`,
          `Customer Name: ${user.name}`,
          `Current Plan: ${license.displayName} (${license.daysLeft} days left)`,
          `Purchase Date: ${purchaseDate}`,
          `Order ID: ${latestPayment ? latestPayment.order_id : 'N/A'}`,
          `Total Paid: $${user.total_paid_usd} USD`,
          `Locked Launch Price: ${user.locked_launch_price ? `$${user.locked_launch_price}` : 'N/A'}`,
          `Checkout Policy Accepted At: ${user.refund_policy_accepted_at || 'Recorded at checkout'}`,
          `Last Login: ${user.last_login_at ? new Date(user.last_login_at).toISOString() : 'N/A'}`,
          `Total Analyses Executed: ${user.analyses_used} / ${license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit}`,
          `Total PDF Memoranda Downloaded: ${user.pdf_downloads.length}`,
          '',
          '=== OFFICIAL REFUND POLICY & ELIGIBILITY VERDICT ===',
          '7-Day No-Usage Refund Rule (Rules A-E): Eligible ONLY if 0 successful analyses within 7 days, OR unresolved tool issue >= 7 days.',
          `System Evaluation Verdict: ${refundEval.verdict}`,
          `Days Since Purchase: ${refundEval.daysSincePurchase} | Successful Analyses: ${refundEval.successfulAnalyses} | Total Runs: ${refundEval.analysesCount} | Issue Status: ${user.issue_status || 'none'}`,
          '',
          '=== FULL ANALYSES EXECUTION LOG (TIMESTAMPED) ===',
        ];

        if (user.analyses_log.length === 0) {
          lines.push('No underwriting analyses logged for this account.');
        } else {
          user.analyses_log.forEach((a: any, idx: number) => {
            lines.push(
              `#${idx + 1} | ${a.timestamp} | ${a.property} (${a.city}) | $${a.priceUSD} | ${a.resultSummary}`
            );
          });
        }

        lines.push('');
        lines.push('=== FULL PDF MEMORANDUM DOWNLOAD LOG ===');
        if (user.pdf_downloads.length === 0) {
          lines.push('No PDF Memorandum downloads logged for this account.');
        } else {
          user.pdf_downloads.forEach((p: any, idx: number) => {
            lines.push(`#${idx + 1} | ${p.timestamp} | ${p.property} | Format: ${p.format.toUpperCase()}`);
          });
        }

        lines.push('');
        lines.push('=== CHRONOLOGICAL AUDIT TIMELINE ===');
        if (user.timeline.length === 0) {
          lines.push('No timeline events recorded yet.');
        } else {
          user.timeline.forEach((t: any) => {
            lines.push(`${t.timestamp} - ${t.message}`);
          });
        }

        const pdfBytes = buildPdfDocument({
          title: 'Loomora Studios - AQARI TERMINAL | Forensic Evidence Report',
          subtitle: `Official Payment & Usage Audit Dossier for Dispute / Court Review`,
          lines,
          watermark: `OFFICIAL DISPUTE EVIDENCE - Generated by Loomora Studios AQARI TERMINAL DB`,
          footer: `Generated from AQARI TERMINAL DB - ${nowIso} - This log is system-generated and cannot be edited by user.`,
        });

        const safeFile = targetEmail.replace(/[^a-z0-9._-]+/gi, '_');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="AQARI_Evidence_${safeFile}.pdf"`);
        res.end(Buffer.from(pdfBytes));
        return;
      }

      case 'test-email-day29': {
        const body = req.body || {};
        const email = (
          getQueryParam(req, url, 'email') ||
          body.email ||
          'loomorastudios@gmail.com'
        )
          .toString()
          .trim()
          .toLowerCase();

        const userRecord = getOrCreateServerUser(email);
        const planKey = normalizePlanKey(
          (
            getQueryParam(req, url, 'plan') ||
            body.plan ||
            (userRecord.plan !== 'free' ? userRecord.plan : 'starter')
          ).toString()
        );
        const planCfg = PLANS[planKey];
        const name = (
          getQueryParam(req, url, 'name') ||
          body.name ||
          userRecord.name ||
          email.split('@')[0]
        ).toString();

        const rawLeft = getQueryParam(req, url, 'analyses_left') || body.analyses_left;
        const analysesLeft =
          rawLeft !== '' && rawLeft !== undefined
            ? rawLeft
            : Number.isFinite(planCfg.analysesLimit)
            ? Math.max(0, planCfg.analysesLimit - (userRecord.analyses_used || 0))
            : 'Unlimited';

        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endDateFormatted = tomorrow.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        const mail = buildDay29RenewalEmail({
          name,
          plan: planKey,
          endDateFormatted,
          analysesLeft,
        });

        const delivery = await dispatchEmail({
          to: email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          type: 'test_day29',
        });

        return res.status(200).json({
          success: true,
          message: `Day-29 renewal email processed for ${email}`,
          delivery,
        });
      }

      case 'analyst-inbox': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const map = await getAnalystThreadsMap();
        const threads = Object.values(map)
          .filter((t: any) => t && t.email)
          .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
        return res.status(200).json({
          success: true,
          threads,
        });
      }

      case 'analyst-thread': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const targetEmail = decodeURIComponent(getQueryParam(req, url, 'email')).trim().toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
          return res.status(400).json({ error: 'Valid client email is required' });
        }
        const thread = await getAnalystThreadFromDb(targetEmail);
        if ((thread.unreadForAdmin || 0) > 0) {
          thread.unreadForAdmin = 0;
          await saveAnalystThreadToDb(thread);
        }
        const clientUser = await getServerUserFromDb(targetEmail);
        return res.status(200).json({
          success: true,
          thread,
          savedAnalyses: clientUser?.saved_analyses || [],
          clientName: clientUser?.name || targetEmail.split('@')[0],
        });
      }

      case 'analyst-reply': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = req.body || {};
        const targetEmail = String(body.email || '').trim().toLowerCase();
        const text = String(body.message || body.text || '').trim().slice(0, 3000);
        if (!targetEmail || !targetEmail.includes('@') || !text) {
          return res.status(400).json({ success: false, error: 'Client email and reply message are required' });
        }

        const thread = await getAnalystThreadFromDb(targetEmail);
        const now = Date.now();
        const msg = {
          id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`,
          sender: 'admin',
          senderEmail: sessionEmail,
          text,
          timestamp: new Date(now).toISOString(),
          attachedAnalysisTitle: body.attachedAnalysisTitle || undefined,
          attachedAnalysisSummary: body.attachedAnalysisSummary || undefined,
          attachmentPdfNote: body.attachmentPdfNote || undefined,
        };
        thread.status = 'Replied';
        thread.updatedAt = now;
        thread.unreadForAdmin = 0;
        thread.unreadForClient = Number(thread.unreadForClient || 0) + 1;
        thread.messages = [...(thread.messages || []), msg].slice(-200);
        await saveAnalystThreadToDb(thread);

        const delivery = await dispatchEmail({
          to: targetEmail,
          subject: 'AQARI Analyst Desk: Analyst replied to your question',
          text: `Your AQARI Sovereign Analyst replied:\n\n${text}\n\nOpen your AQARI Terminal Analyst Desk to view the full thread: ${PRODUCTION_URL}/app`,
          html: `<div style="font-family:sans-serif;padding:20px;background:#0b0b0f;color:#fff;border:1px solid #D4AF37;border-radius:12px;"><h2 style="color:#D4AF37;margin-top:0;">Analyst Replied to Your Question</h2><p style="white-space:pre-wrap;line-height:1.6;">${text.replace(/</g, '&lt;')}</p><a href="${PRODUCTION_URL}/app" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#D4AF37;color:#000;font-weight:bold;text-decoration:none;border-radius:8px;">Open AQARI Analyst Desk &rarr;</a></div>`,
          type: 'analyst_reply',
        });

        return res.status(200).json({
          success: true,
          thread,
          delivery,
          message: 'Reply sent to client',
        });
      }

      case 'analyst-close': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const targetEmail = String(req.body?.email || '').trim().toLowerCase();
        if (!targetEmail) return res.status(400).json({ error: 'Client email required' });
        const thread = await getAnalystThreadFromDb(targetEmail);
        thread.status = 'Closed';
        thread.unreadForAdmin = 0;
        thread.updatedAt = Date.now();
        await saveAnalystThreadToDb(thread);
        return res.status(200).json({ success: true, thread });
      }

      case 'whiteglove-requests': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const requests = await getWhiteGloveRequestsFromDb();
        return res.status(200).json({
          success: true,
          requests,
        });
      }

      case 'whiteglove-deliver': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = req.body || {};
        const requestId = String(body.requestId || '').trim();
        const rawProps = Array.isArray(body.properties) ? body.properties : [];
        if (!requestId || rawProps.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Request ID and at least one property underwriting block are required',
          });
        }

        const all = await getWhiteGloveRequestsFromDb();
        const idx = all.findIndex((r: any) => r.id === requestId);
        if (idx === -1) {
          return res.status(404).json({ success: false, error: `Request ${requestId} not found` });
        }
        const reqItem = all[idx];

        let totalValuation = 0;
        let totalAnnualRent = 0;
        let totalAnnualNOI = 0;
        let totalAnnualDebt = 0;
        let totalEquity = 0;
        const normalizedProps = rawProps.map((p: any, pIdx: number) => {
          const val = Math.max(1, Number(p.valuation || 0));
          const rent = Math.max(0, Number(p.monthlyRent || 0));
          const eqPct = Math.min(100, Math.max(1, Number(p.equityPct ?? 30)));
          const ratePct = Math.max(0.1, Number(p.ratePct ?? 5.5));
          const opexPct = Math.min(95, Math.max(0, Number(p.opexPct ?? 15)));
          const down = val * (eqPct / 100);
          const loan = Math.max(0, val - down);
          const r = ratePct / 100 / 12;
          const n = 25 * 12;
          const monthlyDebt =
            loan > 0 && r > 0 ? (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0;
          const annualRent = rent * 12 * 0.95;
          const annualNOI = annualRent * (1 - opexPct / 100);
          const annualDebt = monthlyDebt * 12;

          totalValuation += val;
          totalAnnualRent += annualRent;
          totalAnnualNOI += annualNOI;
          totalAnnualDebt += annualDebt;
          totalEquity += down;

          return {
            id: p.id || `wgp_${pIdx + 1}`,
            title: String(p.title || `Property #${pIdx + 1}`),
            city: String(p.city || reqItem.targetCity || 'Muscat'),
            currency: 'USD',
            valuation: val,
            monthlyRent: rent,
            equityPct: eqPct,
            ratePct,
            opexPct,
            spvNote: String(p.spvNote || ''),
          };
        });

        const weightedCapRate =
          totalValuation > 0 ? Number(((totalAnnualNOI / totalValuation) * 100).toFixed(2)) : 0;
        const annualCashflow = totalAnnualNOI - totalAnnualDebt;
        const blendedCoC =
          totalEquity > 0 ? Number(((annualCashflow / totalEquity) * 100).toFixed(2)) : 0;
        const portfolioDscr =
          totalAnnualDebt > 0 ? Number((totalAnnualNOI / totalAnnualDebt).toFixed(2)) : 4.0;
        const blendedIrr5Yr = Number((blendedCoC + 4.8).toFixed(1));
        const now = Date.now();
        const currency = 'USD';

        const deliverable = {
          id: `WGD-${now.toString(36).toUpperCase()}`,
          title: String(body.title || `White-Glove Complex Dossier: ${reqItem.propertyTitle}`),
          currency,
          properties: normalizedProps,
          combined: {
            totalValuation: Math.round(totalValuation),
            totalMonthlyRent: Math.round(totalAnnualRent / 12),
            totalMonthlyCashflow: Math.round(annualCashflow / 12),
            weightedCapRate,
            blendedCoC,
            blendedIrr5Yr,
            portfolioDscr,
          },
          spvStructureNote: String(body.spvStructureNote || ''),
          riskNote: String(body.riskNote || ''),
          summaryRecommendation: String(body.summaryRecommendation || ''),
          preparedBy: sessionEmail || 'AQARI Executive Desk',
          deliveredAt: new Date(now).toISOString(),
        };

        const updatedRequest = {
          ...reqItem,
          status: 'Done',
          deliveredAt: deliverable.deliveredAt,
          deliverable,
        };
        all[idx] = updatedRequest;
        await saveWhiteGloveRequestsToDb(all);

        const deliveryEmail = await dispatchEmail({
          to: reqItem.email,
          subject: 'Your White-glove analysis is ready',
          text: `Hello ${reqItem.clientName || reqItem.email},\n\nYour White-glove Custom Underwriting analysis (${requestId}) is ready for download in your AQARI Terminal.\n\nCombined Portfolio Summary:\n- Properties Modeled: ${normalizedProps.length}\n- Total Valuation: ${currency} ${deliverable.combined.totalValuation.toLocaleString('en-US')}\n- Weighted Cap Rate: ${weightedCapRate}%\n- Blended Cash-on-Cash: ${blendedCoC}%\n- 5-Yr Net IRR: ${blendedIrr5Yr}%\n\nDownload your Institutional PDF Report inside Terminal -> Sovereign Suite: ${PRODUCTION_URL}/app`,
          html: `<div style="font-family:sans-serif;padding:20px;background:#0b0b0f;color:#fff;border:1px solid #D4AF37;border-radius:12px;"><h2 style="color:#D4AF37;margin-top:0;">Your White-glove analysis is ready</h2><p>Your bespoke custom underwriting dossier for <strong>${reqItem.propertyTitle}</strong> (${normalizedProps.length} asset(s)) is now available in your AQARI Sovereign Suite.</p><p><strong>Weighted Cap Rate:</strong> ${weightedCapRate}% | <strong>Blended CoC:</strong> ${blendedCoC}% | <strong>5-Yr IRR:</strong> ${blendedIrr5Yr}%</p><a href="${PRODUCTION_URL}/app" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#D4AF37;color:#000;font-weight:bold;text-decoration:none;border-radius:8px;">Download Custom PDF Report &rarr;</a></div>`,
          type: 'whiteglove_ready',
        });

        return res.status(200).json({
          success: true,
          request: updatedRequest,
          deliveryEmail,
          message: 'Sent',
        });
      }

      case 'email-logs': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const emailLogs = await getEmailLogsFromDb(100);
        const webhookLogs = await getWebhookLogsFromDb(100);
        const failedWebhooks = await getFailedWebhooksFromDb(100);
        const cancellationLogs = await getCancellationLogsFromDb(100);
        return res.status(200).json({
          success: true,
          emailLogs,
          webhookLogs,
          failedWebhooks,
          cancellationLogs,
        });
      }

      case 'issues': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const allUsers = await getAllServerUsersFromDb();
        const issues = allUsers
          .filter((u: any) => Boolean(u.has_reported_issue) || (u.issue_status && u.issue_status !== 'none'))
          .map((u: any) => ({
            email: u.email,
            name: u.name,
            plan: PLANS[normalizePlanKey(u.plan)].displayName,
            successful_analyses: Number(u.successful_analyses || 0),
            issue_description: u.issue_description || '',
            issue_status: u.issue_status || (u.issue_resolved_at ? 'resolved' : 'open'),
            issue_reported_at: u.issue_reported_at || null,
            issue_resolved_at: u.issue_resolved_at || null,
            cancel_status: u.cancel_status || 'none',
            refundEvaluation: evaluateRefundEligibility(u),
          }))
          .sort((a: any, b: any) => Number(b.issue_reported_at || 0) - Number(a.issue_reported_at || 0));

        const cancellationLogs = await getCancellationLogsFromDb(100);
        return res.status(200).json({
          success: true,
          issues,
          cancellationLogs,
        });
      }

      case 'resolve-issue': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const targetEmail = String(req.body?.email || '').trim().toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
          return res.status(400).json({ success: false, error: 'Valid client email is required' });
        }
        const targetUser = await getServerUserFromDb(targetEmail);
        const now = Date.now();
        const iso = new Date(now).toISOString();
        const timelineEntry = {
          id: `tl_${now}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: iso,
          type: 'issue_resolved',
          message: `Tool issue marked RESOLVED by admin (${sessionEmail}) at ${iso}`,
          actor: sessionEmail,
        };
        const updated = updateServerUser(targetEmail, {
          issue_resolved_at: now,
          issue_status: 'resolved',
          timeline: [timelineEntry, ...(targetUser.timeline || [])].slice(0, 200),
        });
        await saveServerUserToDb(updated);

        await dispatchEmail({
          to: targetEmail,
          subject: 'AQARI Terminal: Your Reported Tool Issue Has Been Resolved',
          text: `Hello ${updated.name || targetEmail},\n\nOur engineering team has resolved the tool issue you reported:\n"${updated.issue_description || 'Reported Terminal Issue'}"\n\nPlease log back in to continue using your AQARI Terminal: ${PRODUCTION_URL}/app`,
          html: `<div style="font-family:sans-serif;padding:20px;background:#0b0b0f;color:#fff;border:1px solid #D4AF37;border-radius:12px;"><h2 style="color:#D4AF37;margin-top:0;">Tool Issue Resolved</h2><p>Our engineering team has resolved the issue you reported.</p><a href="${PRODUCTION_URL}/app" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#D4AF37;color:#000;font-weight:bold;text-decoration:none;border-radius:8px;">Open AQARI Terminal &rarr;</a></div>`,
          type: 'admin_alert',
        }).catch(() => {});

        return res.status(200).json({
          success: true,
          email: targetEmail,
          issue_resolved_at: now,
          issue_status: 'resolved',
          message: 'Issue marked Resolved',
        });
      }

      case 'cancellations': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const cancellationLogs = await getCancellationLogsFromDb(100);
        return res.status(200).json({
          success: true,
          cancellationLogs,
        });
      }

      default:
        return res.status(400).json({
          error: `Unknown admin action '${action}'`,
          supportedActions: [
            'users',
            'stats',
            'pricing',
            'pricing-update',
            'toggle-discount',
            'user',
            'change-plan',
            'refund-decision',
            'export',
            'test-email-day29',
            'analyst-inbox',
            'analyst-thread',
            'analyst-reply',
            'analyst-close',
            'whiteglove-requests',
            'whiteglove-deliver',
            'email-logs',
            'issues',
            'resolve-issue',
            'cancellations',
          ],
        });
    }
  } catch (err: any) {
    console.error(`/api/admin?action=${action} error:`, err);
    return res.status(200).json({ success: false, error: err?.message || 'Admin API error' });
  }
}
