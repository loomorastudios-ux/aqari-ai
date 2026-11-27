// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import { Redis } from '@upstash/redis';
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

export class StorageUnavailableError extends Error {
  readonly statusCode = 500;
  constructor(message = 'storage unavailable') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

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
  plan: string;
  amount: number;
  currency: string;
  test_mode: boolean;
  status?: 'completed' | 'refunded' | 'chargeback';
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
    | 'expired'
    | 'issue_reported'
    | 'issue_resolved'
    | 'cancellation'
    | 'credits_purchase'
    | 'branding_update';
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

export interface PersistedLastResults {
  analysis?: any;
  deal_finder?: any;
  forecast?: any;
  due_diligence?: any;
  portfolio_optimizer?: any;
  advisor?: any;
  file_analysis?: any;
  property_studio?: any;
  due_diligence_docs?: any;
  scenario_comparison?: any;
}

export interface ServerUserRecord {
  userId?: string;
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
  payment_customer_email: string | null;
  payment_provider?: string;
  payment_intent_id?: string | null;
  last_order_id?: string | null;
  extra_credits?: number;
  analyses_total?: number;
  analyses_left?: number;
  saved_count?: number;
  max_saved?: number;
  status?: 'active' | 'expired' | 'exhausted' | 'locked';
  locked?: boolean;
  locked_reason?: string | null;
  locked_at?: number | null;
  admin_locked?: boolean;
  admin_lock_reason?: string | null;
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
  successful_analyses?: number;
  has_reported_issue?: boolean;
  issue_description?: string | null;
  issue_status?: string;
  issue_reported_at?: number | null;
  issue_resolved_at?: number | null;
  cancel_status?: 'none' | 'refunded' | 'cancelled' | string;
  refunded_at?: number | null;
  refund_reason?: string | null;
  cancelled_at?: number | null;
  expired_from_plan?: PlanKey | null;
  api_key_token?: string | null;
  api_key_last4?: string | null;
  api_key_revoked_legacy?: boolean;
  portfolio_assets?: any[];
  last_results?: PersistedLastResults;
  image_pdf_used?: number;
  ai_listings_used?: number;
  pdfs_used?: number;
  api_calls_today?: number;
  api_calls_day?: string;
  last_extraction_id?: string | null;
  branding?: {
    firmName?: string;
    logoUrl?: string;
    accentColor?: string;
  } | null;
}

export interface ServerSessionRecord {
  sessionId: string;
  userId?: string;
  email: string;
  name?: string;
  picture?: string;
  verifiedViaGoogle: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface AdminAuditLogEntry {
  id: string;
  timestamp: string;
  adminEmail: string;
  targetEmail: string;
  action: string;
  details: string;
  ip: string;
}

export interface WebhookLogEntry {
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

export interface FailedWebhookLog {
  id: string;
  timestamp: string;
  reason: string;
  ip?: string;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  from?: string;
  subject: string;
  type?: 'day29_renewal' | 'plan_expired' | 'test_day29' | string;
  event_type?: string;
  status: 'sent' | 'failed' | 'simulated' | string;
  provider?: 'resend' | 'nodemailer' | 'log' | string;
  timestamp: string;
  error?: string;
  has_resend_key?: boolean;
  key_prefix?: string;
  resend_status?: number;
}

export interface UsedOrderRecord {
  order_id: string;
  transactionId?: string;
  userId?: string;
  login_email: string;
  payment_email: string;
  plan: PlanKey;
  plan_display: string;
  purchase_type?: 'plan' | 'credit_pack';
  pack_id?: 'pack_25' | 'pack_100' | 'pack_500';
  credits?: number;
  switched_from_plan?: PlanKey | null;
  switched_message?: string | null;
  analyses: number;
  amount: number;
  currency?: string;
  status?: 'completed' | 'refunded' | 'chargeback';
  refunded_at?: number;
  refund_reason?: string;
  timestamp?: string;
  test_mode: boolean;
  used_at: number;
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
  displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN' | 'ENTERPRISE';
  originalPrice: number;
  launchPrice: number;
  analysesLimit: number;
  savedLimit: number | null;
  features: string[];
  tierTag?: string;
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
}

export interface StoredPricingConfig {
  schemaVersion?: number;
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

export interface AnalystThreadRecord {
  email: string;
  clientName?: string;
  plan?: string;
  status: 'Open' | 'Replied' | 'Closed';
  unreadForAdmin: number;
  unreadForClient: number;
  updatedAt: number;
  createdAt?: number;
  deadline?: string | null;
  messages: Array<{
    id: string;
    sender: 'client' | 'admin';
    senderEmail?: string;
    text: string;
    timestamp: number | string;
    attachedAnalysis?: any;
    attachedAnalysisId?: string;
    attachedAnalysisTitle?: string;
    attachedAnalysisSummary?: string;
    replyByDate?: string;
    deadline?: string | null;
    pdfSummary?: string | null;
  }>;
}

export interface WhiteGloveRequestRecord {
  id: string;
  email: string;
  clientName?: string;
  targetCity?: string;
  propertyTitle?: string;
  brief: string;
  status: 'Pending' | 'In Progress' | 'Done';
  createdAt: number;
  updatedAt: number;
  deliveredAt?: string;
  deliverable?: any;
  [key: string]: any;
}

export interface StoredAnalysisRecord {
  id: string;
  userId: string;
  email: string;
  createdAt: string;
  payload: any;
}

export interface StoredReportRecord {
  id: string;
  ownerId: string;
  ownerEmail: string;
  createdAt?: number;
  generatedAt?: string;
  format: 'pdf' | 'csv' | 'json' | 'white_label_pdf' | 'investment_memo_pdf' | string;
  docType?: string;
  fileName?: string;
  filename?: string;
  mimeType?: string;
  propertyTitle: string;
  city?: string;
  watermark?: string;
  isWatermarked?: boolean;
  branding?: any;
  contentBase64?: string;
  contentText?: string;
}

export interface DecrementCreditsResult {
  ok: boolean;
  remaining: number;
  error?: 'insufficient';
}

export interface SavePaymentResult {
  ok: boolean;
  record?: UsedOrderRecord;
  existing?: UsedOrderRecord | null;
  error?: 'duplicate';
}

// =========================================================================
// 1. UPSTASH REDIS CONNECTION (NO MEMORY OR /tmp FALLBACKS)
// =========================================================================

function cleanEnvValue(value?: string | null): string {
  return String(value || '').replace(/^["']|["']$/g, '').trim();
}

export function getRedisCredentials(): { url: string; token: string } | null {
  const url = cleanEnvValue(
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  ).replace(/\/+$/, '');
  const token = cleanEnvValue(
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  );
  if (!url || !token || !/^https?:\/\//i.test(url)) {
    return null;
  }
  return { url, token };
}

export function isRedisConfigured(): boolean {
  return Boolean(getRedisCredentials());
}

let cachedClientPair: { signature: string; client: Redis } | null = null;

export function getRedisClient(): Redis {
  const creds = getRedisCredentials();
  if (!creds) {
    throw new StorageUnavailableError('storage unavailable');
  }
  const signature = `${creds.url}::${creds.token}`;
  if (!cachedClientPair || cachedClientPair.signature !== signature) {
    cachedClientPair = {
      signature,
      client: new Redis({
        url: creds.url,
        token: creds.token,
        automaticDeserialization: false,
        retry: { retries: 1, backoff: () => 25 },
      }),
    };
  }
  return cachedClientPair.client;
}

async function withRedis<T>(fn: (redis: Redis) => Promise<T>): Promise<T> {
  try {
    const redis = getRedisClient();
    return await fn(redis);
  } catch (err: any) {
    if (err instanceof StorageUnavailableError) {
      throw err;
    }
    console.error('[REDIS_ERROR]', err?.message || err);
    throw new StorageUnavailableError('storage unavailable');
  }
}

export async function healthCheckStorage(): Promise<
  { ok: true; latencyMs: number } | { ok: false; error: 'storage unavailable' }
> {
  const started = Date.now();
  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    if (!pong) {
      return { ok: false, error: 'storage unavailable' };
    }
    return { ok: true, latencyMs: Math.max(0, Date.now() - started) };
  } catch (err: any) {
    console.error('[REDIS_HEALTH_FAIL]', err?.message || err);
    return { ok: false, error: 'storage unavailable' };
  }
}

function safeParseJson<T = any>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    if (!raw.trim()) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as T;
  }
  return null;
}

// =========================================================================
// 2. KEY BUILDERS & RECORD HYDRATION
// =========================================================================

const USERS_INDEX_KEY = 'users:index';
const LEGACY_USERS_INDEX_KEY = 'aqari:users_index:v1';
const PAYMENTS_INDEX_KEY = 'payments:index';
const LEGACY_USED_ORDERS_MAP_KEY = 'aqari:used_orders_map:v1';
const AUDIT_LOG_LIST_KEY = 'aqari:audit_logs:v1';
const ADMIN_AUDIT_LOG_LIST_KEY = 'aqari:admin_audit_logs:v1';
const PRICING_CONFIG_KEY = 'aqari:pricing_config:v1';
const PRICING_LOGS_KEY = 'aqari:pricing_logs:v1';
const WEBHOOK_LOGS_KEY = 'aqari:webhook_logs:v1';
const FAILED_WEBHOOKS_KEY = 'aqari:failed_webhooks:v1';
const EMAIL_LOGS_KEY = 'aqari:email_logs:v1';
const CANCELLATION_LOGS_KEY = 'aqari:cancellation_logs:v1';
const ENTERPRISE_INQUIRIES_KEY = 'aqari:enterprise_inquiries:v1';
const ANALYST_THREADS_INDEX_KEY = 'aqari:analyst_threads:index';
const LEGACY_ANALYST_THREADS_MAP_KEY = 'aqari:analyst_threads:v1';
const WHITEGLOVE_REQUESTS_KEY = 'aqari:whiteglove_requests:v1';

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function normalizeOrderId(raw: string): string {
  return String(raw || '').replace(/^#/, '').trim();
}

export function getUserIdForEmail(rawEmail: string): string {
  const email = normalizeEmail(rawEmail);
  if (!email) return '';
  return 'usr_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 16);
}

function userKey(email: string): string {
  return `user:${normalizeEmail(email)}`;
}

function legacyUserKey(email: string): string {
  return `aqari:user:${normalizeEmail(email)}`;
}

function userIdLookupKey(userId: string): string {
  return `user:byId:${String(userId || '').trim()}`;
}

function creditsKey(userId: string): string {
  return `credits:${String(userId || '').trim()}`;
}

function sessionKey(sessionId: string): string {
  return `session:${String(sessionId || '').trim()}`;
}

function legacySessionKey(sessionId: string): string {
  return `aqari:session:${String(sessionId || '').trim()}`;
}

function userSessionsSetKey(userId: string): string {
  return `user:sessions:${String(userId || '').trim()}`;
}

function analysisKey(userId: string, analysisId: string): string {
  return `analysis:${String(userId || '').trim()}:${String(analysisId || '').trim()}`;
}

function analysesListKey(userId: string): string {
  return `analyses:index:${String(userId || '').trim()}`;
}

function paymentKey(orderId: string): string {
  return `payment:${normalizeOrderId(orderId)}`;
}

function legacyPaymentKey(orderId: string): string {
  return `aqari:used_order:${normalizeOrderId(orderId)}`;
}

function auditEntryKey(timestamp: string, id: string): string {
  return `audit:${timestamp}:${id}`;
}

function parseOptionalPositiveInt(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

function normalizeIsoDateOrNull(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }
  const str = String(value).trim();
  if (!str) return null;
  const parsed = Date.parse(str);
  if (!Number.isFinite(parsed)) return null;
  return str;
}

export function createDefaultPricingConfig(): StoredPricingConfig {
  const now = Date.now();
  return {
    schemaVersion: 5,
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
        savedLimit: PLANS.enterprise.savedLimit,
        features: [...PLANS.enterprise.features],
      },
      institutional: {
        key: 'institutional',
        displayName: 'ENTERPRISE',
        originalPrice: PLANS.institutional.originalPrice,
        launchPrice: PLANS.institutional.launchPrice,
        analysesLimit: PLANS.institutional.analysesLimit,
        savedLimit: PLANS.institutional.savedLimit,
        features: [...PLANS.institutional.features],
        isContractPricing: true,
      },
    },
  };
}

export function hydratePricingConfig(raw: any): StoredPricingConfig {
  const def = createDefaultPricingConfig();
  if (!raw || typeof raw !== 'object') return def;
  const plans = { ...def.plans };
  for (const k of ['free', 'starter', 'pro', 'enterprise', 'institutional'] as PlanKey[]) {
    const r = raw.plans?.[k];
    if (r && typeof r === 'object') {
      const analysesLimit =
        k === 'institutional'
          ? Number.isFinite(Number(r.analysesLimit)) && Number(r.analysesLimit) >= 0
            ? Number(r.analysesLimit)
            : 0
          : Number.isFinite(Number(r.analysesLimit)) && Number(r.analysesLimit) > 0
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
        savedLimit:
          k === 'institutional'
            ? 0
            : Math.min(analysesLimit || def.plans[k].savedLimit || 0, def.plans[k].savedLimit ?? analysesLimit),
        features: rawFeatures.length > 0 ? rawFeatures : def.plans[k].features,
      };
    }
  }
  return {
    schemaVersion: Number(raw.schemaVersion || 5),
    launchDiscountActive:
      typeof raw.launchDiscountActive === 'boolean' ? raw.launchDiscountActive : def.launchDiscountActive,
    launchBadgeText:
      typeof raw.launchBadgeText === 'string' && raw.launchBadgeText.trim()
        ? raw.launchBadgeText
        : def.launchBadgeText,
    launchEndsAt: Number.isFinite(Number(raw.launchEndsAt)) ? Number(raw.launchEndsAt) : def.launchEndsAt,
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : def.updatedAt,
    plans,
  };
}

export function hydrateUserRecord(raw: any, rawEmail: string): ServerUserRecord {
  const email = normalizeEmail(rawEmail);
  const now = Date.now();
  const plan = normalizePlanKey(raw?.plan);
  const isFreePlan = plan === 'free';
  const planCfg = PLANS[plan];
  const extraCredits = Math.max(0, Number(raw?.extra_credits ?? 0));
  const customAnalysesLimit = parseOptionalPositiveInt(raw?.custom_analyses_limit);
  const customImagePdfLimit = parseOptionalPositiveInt(raw?.custom_image_pdf_limit);
  const customListingsLimit = parseOptionalPositiveInt(raw?.custom_listings_limit);
  const customPortfolioLimit = parseOptionalPositiveInt(raw?.custom_portfolio_limit);
  const customSeats = parseOptionalPositiveInt(raw?.custom_seats);
  const customStorageGb = parseOptionalPositiveInt(raw?.custom_storage_gb);
  const slaLevel =
    typeof raw?.sla_level === 'string' && raw.sla_level.trim()
      ? raw.sla_level.trim().slice(0, 120)
      : null;
  const contractEndDate = normalizeIsoDateOrNull(raw?.contract_end_date);
  const whiteLabelEnabled = Boolean(raw?.white_label_enabled);
  const customApiEnabled = Boolean(raw?.custom_api_enabled);

  const basePlanAnalyses =
    plan === 'institutional' ? (customAnalysesLimit ?? 0) : planCfg.analysesLimit;
  const analysesTotal =
    plan === 'institutional'
      ? Math.max(0, Number(raw?.analyses_total ?? basePlanAnalyses + extraCredits))
      : Math.max(1, Number(raw?.analyses_total ?? basePlanAnalyses + extraCredits));
  const rawUsedNum =
    raw?.analyses_used !== undefined && raw?.analyses_used !== null ? Number(raw.analyses_used) : NaN;
  const rawLeftNum =
    raw?.analyses_left !== undefined && raw?.analyses_left !== null ? Number(raw.analyses_left) : NaN;
  let analysesUsed = Number.isFinite(rawUsedNum) ? Math.max(0, rawUsedNum) : 0;
  const maxPossibleLeft = Math.max(analysesTotal, analysesTotal + extraCredits);
  const analysesLeft = Number.isFinite(rawLeftNum)
    ? Math.max(0, Math.min(maxPossibleLeft, rawLeftNum))
    : Math.max(0, analysesTotal - analysesUsed);
  if (!Number.isFinite(rawUsedNum) && Number.isFinite(rawLeftNum)) {
    analysesUsed = Math.max(0, analysesTotal - analysesLeft);
  }

  const savedList = Array.isArray(raw?.saved_analyses) ? raw.saved_analyses : [];
  const defaultSavedCap =
    plan === 'institutional' ? (customPortfolioLimit ?? 0) : planCfg.savedLimit;
  const maxSaved =
    plan === 'institutional'
      ? customPortfolioLimit ?? 0
      : Number.isFinite(Number(raw?.max_saved)) && Number(raw?.max_saved) > 0
      ? Math.max(Number(raw.max_saved), defaultSavedCap)
      : defaultSavedCap;
  const savedCount =
    savedList.length > 0 ? savedList.length : Math.max(0, Number(raw?.saved_count ?? 0));

  const licenseStartVal =
    typeof raw?.license_start === 'number' && Number.isFinite(raw.license_start)
      ? raw.license_start
      : now;
  const licenseEndVal =
    typeof raw?.license_end === 'number' && Number.isFinite(raw.license_end)
      ? raw.license_end
      : licenseStartVal + THIRTY_DAYS_MS;

  const expiredFromPlanRaw = raw?.expired_from_plan
    ? normalizePlanKey(raw.expired_from_plan)
    : null;
  const expiredFromPlan: PlanKey | null =
    expiredFromPlanRaw && expiredFromPlanRaw !== 'free' && isFreePlan
      ? expiredFromPlanRaw
      : null;

  const contractEndParsed = contractEndDate ? Date.parse(contractEndDate) : NaN;
  const effectiveEnd =
    isFreePlan && !expiredFromPlan
      ? null
      : plan === 'institutional' && Number.isFinite(contractEndParsed)
      ? contractEndParsed
      : licenseEndVal;

  const packageExpired = Boolean(
    (!isFreePlan || Boolean(expiredFromPlan)) && effectiveEnd && now >= effectiveEnd
  );
  const adminLocked = Boolean(raw?.admin_locked || raw?.locked);
  const effectiveLeft = adminLocked
    ? 0
    : packageExpired
    ? extraCredits
    : analysesLeft;
  const hydratedStatus: 'active' | 'expired' | 'exhausted' =
    adminLocked || packageExpired
      ? 'expired'
      : effectiveLeft <= 0 && extraCredits <= 0
      ? 'exhausted'
      : 'active';

  const todayUtc = new Date(now).toISOString().slice(0, 10);
  const apiCallsDay = typeof raw?.api_calls_day === 'string' ? raw.api_calls_day : todayUtc;
  const apiCallsToday =
    apiCallsDay === todayUtc ? Math.max(0, Number(raw?.api_calls_today || 0)) : 0;

  return {
    userId:
      typeof raw?.userId === 'string' && raw.userId.trim()
        ? raw.userId.trim()
        : getUserIdForEmail(email),
    email,
    name: raw?.name || email.split('@')[0],
    plan,
    expired_from_plan: expiredFromPlan,
    license_start: licenseStartVal,
    license_end: licenseEndVal,
    analyses_used: analysesUsed,
    analyses_left: effectiveLeft,
    analyses_total: analysesTotal,
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
    locked_launch_price:
      typeof raw?.locked_launch_price === 'number' ? raw.locked_launch_price : null,
    payment_customer_email: raw?.payment_customer_email
      ? String(raw.payment_customer_email).toLowerCase()
      : null,
    payment_provider: String(raw?.payment_provider || 'paddle'),
    payment_intent_id: raw?.payment_intent_id ? String(raw.payment_intent_id) : null,
    last_order_id:
      typeof raw?.last_order_id === 'string' && raw.last_order_id.trim()
        ? raw.last_order_id.trim()
        : Array.isArray(raw?.payments) && raw.payments[0]?.order_id
        ? String(raw.payments[0].order_id)
        : null,
    extra_credits: extraCredits,
    status: hydratedStatus,
    locked: Boolean(raw?.locked),
    locked_reason: raw?.locked_reason ?? null,
    locked_at: typeof raw?.locked_at === 'number' ? raw.locked_at : null,
    admin_locked: Boolean(raw?.admin_locked),
    admin_lock_reason:
      typeof raw?.admin_lock_reason === 'string' && raw.admin_lock_reason.trim()
        ? raw.admin_lock_reason.trim()
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
    successful_analyses: Math.max(0, Number(raw?.successful_analyses ?? 0)),
    has_reported_issue: Boolean(raw?.has_reported_issue),
    issue_description: typeof raw?.issue_description === 'string' ? raw.issue_description : null,
    issue_status:
      raw?.issue_status === 'open' || raw?.issue_status === 'resolved'
        ? raw.issue_status
        : raw?.has_reported_issue
        ? raw?.issue_resolved_at
          ? 'resolved'
          : 'open'
        : 'none',
    issue_reported_at: typeof raw?.issue_reported_at === 'number' ? raw.issue_reported_at : null,
    issue_resolved_at: typeof raw?.issue_resolved_at === 'number' ? raw.issue_resolved_at : null,
    cancel_status:
      raw?.cancel_status === 'refunded'
        ? 'refunded'
        : raw?.cancel_status === 'cancelled'
        ? 'cancelled'
        : 'none',
    api_key_token: typeof raw?.api_key_token === 'string' ? raw.api_key_token : null,
    api_key_last4: typeof raw?.api_key_last4 === 'string' ? raw.api_key_last4 : null,
    api_key_revoked_legacy: Boolean(raw?.api_key_revoked_legacy),
    portfolio_assets: Array.isArray(raw?.portfolio_assets) ? raw.portfolio_assets : [],
    last_results:
      raw?.last_results && typeof raw.last_results === 'object' ? raw.last_results : {},
    image_pdf_used: Math.max(0, Number(raw?.image_pdf_used || 0)),
    ai_listings_used: Math.max(0, Number(raw?.ai_listings_used || 0)),
    pdfs_used: Math.max(0, Number(raw?.pdfs_used || 0)),
    api_calls_today: apiCallsToday,
    api_calls_day: apiCallsDay,
    last_extraction_id: typeof raw?.last_extraction_id === 'string' ? raw.last_extraction_id : null,
    branding:
      raw?.branding && typeof raw.branding === 'object'
        ? {
            firmName:
              typeof raw.branding.firmName === 'string' ? raw.branding.firmName.slice(0, 80) : undefined,
            logoUrl:
              typeof raw.branding.logoUrl === 'string' ? raw.branding.logoUrl.slice(0, 500) : undefined,
            accentColor:
              typeof raw.branding.accentColor === 'string'
                ? raw.branding.accentColor.slice(0, 24)
                : undefined,
          }
        : null,
  };
}

// =========================================================================
// 3. CORE USER CRUD (user:{email}, user:byId:{userId}, credits:{userId})
// =========================================================================

async function resolveEmailByUserId(userIdOrEmail: string): Promise<{ email: string; userId: string }> {
  const clean = String(userIdOrEmail || '').trim();
  if (!clean) return { email: '', userId: '' };
  if (clean.includes('@')) {
    const email = normalizeEmail(clean);
    return { email, userId: getUserIdForEmail(email) };
  }
  const emailRaw = await withRedis((redis) => redis.get<string>(userIdLookupKey(clean)));
  const email = normalizeEmail(String(emailRaw || ''));
  return { email, userId: clean };
}

export async function getUser(userIdOrEmail: string): Promise<ServerUserRecord | null> {
  const { email } = await resolveEmailByUserId(userIdOrEmail);
  if (!email) return null;

  return withRedis(async (redis) => {
    let raw = await redis.get<string>(userKey(email));
    if (!raw) {
      raw = await redis.get<string>(legacyUserKey(email));
    }
    const parsed = safeParseJson(raw);
    if (!parsed) return null;
    const hydrated = hydrateUserRecord(parsed, email);
    // Keep effective analyses_left synchronized if credits:{userId} counter exists
    const uid = hydrated.userId || getUserIdForEmail(email);
    const credRaw = await redis.get<string>(creditsKey(uid));
    if (credRaw !== null && credRaw !== undefined) {
      const credNum = Math.max(0, Number(credRaw));
      if (Number.isFinite(credNum)) {
        const isExpiredLocked = hydrated.status === 'expired' && Number(hydrated.extra_credits || 0) === 0;
        if (!hydrated.admin_locked && !isExpiredLocked && credNum !== hydrated.analyses_left) {
          hydrated.analyses_left = credNum;
        }
      }
    }
    return hydrated;
  });
}

export async function getUserFromDb(rawEmail: string): Promise<ServerUserRecord | null> {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
  return getUser(email);
}

export async function saveUser(
  user: ServerUserRecord,
  options?: { syncCredits?: boolean }
): Promise<ServerUserRecord> {
  const email = normalizeEmail(user?.email);
  if (!email) {
    throw new Error('Cannot save user without email');
  }
  const hydrated = hydrateUserRecord({ ...user, updated_at: Date.now() }, email);
  const uid = hydrated.userId || getUserIdForEmail(email);
  hydrated.userId = uid;

  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.set(userKey(email), JSON.stringify(hydrated));
    tx.set(userIdLookupKey(uid), email);
    tx.sadd(USERS_INDEX_KEY, email);
    if (options?.syncCredits !== false) {
      tx.set(creditsKey(uid), String(Math.max(0, Number(hydrated.analyses_left ?? 0))));
    }
    await tx.exec();
  });

  return hydrated;
}

export async function saveUserToDb(
  user: ServerUserRecord,
  options?: { syncCredits?: boolean }
): Promise<ServerUserRecord> {
  return saveUser(user, options);
}

export async function getOrCreateUserInDb(
  rawEmail: string,
  hints?: { name?: string; timezone?: string }
): Promise<ServerUserRecord> {
  const email = normalizeEmail(rawEmail) || 'guest@aqari-ai-rho.vercel.app';
  const existing = await getUser(email);

  if (!existing) {
    const now = Date.now();
    const fresh = hydrateUserRecord(
      {
        userId: getUserIdForEmail(email),
        email,
        name: hints?.name || email.split('@')[0],
        plan: 'free',
        license_start: now,
        license_end: now + THIRTY_DAYS_MS,
        analyses_used: 0,
        analyses_total: PLANS.free.analysesLimit,
        analyses_left: PLANS.free.analysesLimit,
        extra_credits: 0,
        timezone: hints?.timezone || 'Asia/Muscat',
        last_login_at: now,
      },
      email
    );
    return saveUser(fresh);
  }

  if (hints) {
    let changed = false;
    if (hints.timezone && hints.timezone !== existing.timezone) {
      existing.timezone = hints.timezone;
      changed = true;
    }
    if (hints.name && hints.name !== existing.name) {
      existing.name = hints.name;
      changed = true;
    }
    if (changed) {
      return saveUser(existing, { syncCredits: false });
    }
  }

  return existing;
}

export async function updateServerUserInDb(
  rawEmail: string,
  patch: Partial<ServerUserRecord>,
  options?: { syncCredits?: boolean }
): Promise<ServerUserRecord> {
  const norm = normalizeEmail(rawEmail);
  const existing = await getOrCreateUserInDb(norm);
  const updated: ServerUserRecord = {
    ...existing,
    ...patch,
    email: norm,
    userId: existing.userId || getUserIdForEmail(norm),
    updated_at: Date.now(),
  };
  return saveUser(updated, options);
}

export async function getAllServerUsersFromDb(): Promise<ServerUserRecord[]> {
  return withRedis(async (redis) => {
    const emailSet = new Set<string>();
    const idxMembers = await redis.smembers(USERS_INDEX_KEY);
    if (Array.isArray(idxMembers)) {
      for (const m of idxMembers) {
        const norm = normalizeEmail(String(m || ''));
        if (norm) emailSet.add(norm);
      }
    }
    const legacyIdxRaw = await redis.get<string>(LEGACY_USERS_INDEX_KEY);
    const legacyIdx = safeParseJson<string[]>(legacyIdxRaw);
    if (Array.isArray(legacyIdx)) {
      for (const m of legacyIdx) {
        const norm = normalizeEmail(String(m || ''));
        if (norm) emailSet.add(norm);
      }
    }

    const emails = Array.from(emailSet);
    if (emails.length === 0) return [];

    const keys = emails.map((e) => userKey(e));
    const raws = await redis.mget<string[]>(...keys);
    const users: ServerUserRecord[] = [];
    const missingEmails: string[] = [];

    for (let i = 0; i < emails.length; i++) {
      const parsed = safeParseJson(raws?.[i]);
      if (parsed) {
        users.push(hydrateUserRecord(parsed, emails[i]));
      } else {
        missingEmails.push(emails[i]);
      }
    }

    if (missingEmails.length > 0) {
      const legacyRaws = await redis.mget<string[]>(...missingEmails.map((e) => legacyUserKey(e)));
      for (let i = 0; i < missingEmails.length; i++) {
        const parsed = safeParseJson(legacyRaws?.[i]);
        if (parsed) {
          users.push(hydrateUserRecord(parsed, missingEmails[i]));
        }
      }
    }

    return users.sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
  });
}

// =========================================================================
// 4. ATOMIC CREDITS (credits:{userId}, Lua decrementCredits)
// =========================================================================

const DECREMENT_CREDITS_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return {-1, 0}
end
local cur = tonumber(raw)
local amt = tonumber(ARGV[1])
if not amt or amt < 0 then
  return {-2, cur or 0}
end
if amt == 0 then
  return {1, cur or 0}
end
if not cur or cur < amt then
  return {0, cur or 0}
end
local nextVal = redis.call('DECRBY', KEYS[1], amt)
return {1, nextVal}
`;

export async function getCredits(userIdOrEmail: string): Promise<number> {
  const { email, userId } = await resolveEmailByUserId(userIdOrEmail);
  if (!userId) return 0;

  return withRedis(async (redis) => {
    const raw = await redis.get<string>(creditsKey(userId));
    if (raw !== null && raw !== undefined) {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }
    if (email) {
      const user = await getUser(email);
      if (user) {
        const val = Math.max(0, Number(user.analyses_left ?? 0));
        await redis.set(creditsKey(userId), String(val), { nx: true });
        return val;
      }
    }
    return 0;
  });
}

export async function updateCredits(
  userIdOrEmail: string,
  amount: number,
  mode: 'set' | 'add' = 'set'
): Promise<number> {
  const { email, userId } = await resolveEmailByUserId(userIdOrEmail);
  if (!userId) throw new Error('Valid userId or email required for updateCredits');
  const safeVal = Math.trunc(Number(amount || 0));

  const nextCredits = await withRedis(async (redis) => {
    if (mode === 'add') {
      const res = await redis.incrby(creditsKey(userId), safeVal);
      if (Number(res) < 0) {
        await redis.set(creditsKey(userId), '0');
        return 0;
      }
      return Number(res);
    }
    const clamped = Math.max(0, safeVal);
    await redis.set(creditsKey(userId), String(clamped));
    return clamped;
  });

  if (email) {
    const existing = await getUser(email);
    if (existing) {
      await saveUser(
        {
          ...existing,
          analyses_left: nextCredits,
          updated_at: Date.now(),
        },
        { syncCredits: false }
      );
    }
  }
  return nextCredits;
}

export async function syncCreditsKeyIfUnset(userIdOrEmail: string, initialValue: number): Promise<void> {
  const { userId } = await resolveEmailByUserId(userIdOrEmail);
  if (!userId) return;
  const clamped = Math.max(0, Math.floor(Number(initialValue || 0)));
  await withRedis(async (redis) => {
    await redis.set(creditsKey(userId), String(clamped), { nx: true });
  });
}

export async function setCreditsKey(userIdOrEmail: string, exactValue: number): Promise<void> {
  const { userId } = await resolveEmailByUserId(userIdOrEmail);
  if (!userId) return;
  const clamped = Math.max(0, Math.floor(Number(exactValue || 0)));
  await withRedis(async (redis) => {
    await redis.set(creditsKey(userId), String(clamped));
  });
}

export async function decrementCredits(
  userIdOrEmail: string,
  amount = 1
): Promise<DecrementCreditsResult> {
  const { email, userId } = await resolveEmailByUserId(userIdOrEmail);
  if (!userId) {
    return { ok: false, error: 'insufficient', remaining: 0 };
  }
  const safeCost = Math.max(0, Math.floor(Number(amount ?? 1)));

  return withRedis(async (redis) => {
    let rawRes = (await redis.eval(
      DECREMENT_CREDITS_LUA,
      [creditsKey(userId)],
      [String(safeCost)]
    )) as [number | string, number | string];

    let code = Number(Array.isArray(rawRes) ? rawRes[0] : -1);
    let remaining = Math.max(0, Number(Array.isArray(rawRes) ? rawRes[1] : 0));

    if (code === -1 && email) {
      const user = await getUser(email);
      const initialCredits = user ? Math.max(0, Number(user.analyses_left ?? 0)) : 0;
      await redis.set(creditsKey(userId), String(initialCredits), { nx: true });
      rawRes = (await redis.eval(
        DECREMENT_CREDITS_LUA,
        [creditsKey(userId)],
        [String(safeCost)]
      )) as [number | string, number | string];
      code = Number(Array.isArray(rawRes) ? rawRes[0] : 0);
      remaining = Math.max(0, Number(Array.isArray(rawRes) ? rawRes[1] : 0));
    }

    if (code === 1) {
      return { ok: true, remaining };
    }
    return { ok: false, error: 'insufficient', remaining: Math.max(0, remaining) };
  });
}

// =========================================================================
// 5. ANALYSES PERSISTENCE (analysis:{userId}:{analysisId})
// =========================================================================

export async function getAnalyses(userIdOrEmail: string): Promise<StoredAnalysisRecord[]> {
  const { userId } = await resolveEmailByUserId(userIdOrEmail);
  if (!userId) return [];

  return withRedis(async (redis) => {
    const ids = await redis.lrange(analysesListKey(userId), 0, 499);
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const keys = ids.map((id) => analysisKey(userId, String(id)));
    const raws = await redis.mget<string[]>(...keys);
    return (Array.isArray(raws) ? raws : [])
      .map((r) => safeParseJson<StoredAnalysisRecord>(r))
      .filter((x): x is StoredAnalysisRecord => Boolean(x));
  });
}

export async function saveAnalysis(
  userIdOrEmail: string,
  analysis: any
): Promise<StoredAnalysisRecord> {
  const { email, userId } = await resolveEmailByUserId(userIdOrEmail);
  if (!userId) {
    throw new Error('Valid userId or email required to save analysis');
  }
  const analysisId = String(
    analysis?.id || `ana_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  ).trim();
  const record: StoredAnalysisRecord = {
    id: analysisId,
    userId,
    email: email || String(analysis?.email || ''),
    createdAt: String(analysis?.timestamp || new Date().toISOString()),
    payload: { ...analysis, id: analysisId, userId },
  };

  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.set(analysisKey(userId, analysisId), JSON.stringify(record));
    tx.lpush(analysesListKey(userId), analysisId);
    tx.ltrim(analysesListKey(userId), 0, 499);
    await tx.exec();
  });

  return record;
}

// =========================================================================
// 6. ATOMIC IDEMPOTENT PAYMENTS (payment:{orderId} via SET NX / Lua)
// =========================================================================

const SAVE_PAYMENT_NX_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SADD', KEYS[3], ARGV[2])
return 1
`;

export async function getPayment(rawOrderId: string): Promise<UsedOrderRecord | null> {
  const orderKey = normalizeOrderId(rawOrderId);
  if (!orderKey) return null;

  return withRedis(async (redis) => {
    const rawPrimary = await redis.get<string>(paymentKey(orderKey));
    const parsedPrimary = safeParseJson<UsedOrderRecord>(rawPrimary);
    if (parsedPrimary?.order_id) return parsedPrimary;

    const rawLegacy = await redis.get<string>(legacyPaymentKey(orderKey));
    const parsedLegacy = safeParseJson<UsedOrderRecord>(rawLegacy);
    if (parsedLegacy?.order_id) return parsedLegacy;

    const rawMap = await redis.get<string>(LEGACY_USED_ORDERS_MAP_KEY);
    const map = safeParseJson<Record<string, UsedOrderRecord>>(rawMap);
    if (map && typeof map === 'object' && map[orderKey]) {
      return map[orderKey];
    }

    return null;
  });
}

export async function savePayment(
  rawOrderId: string,
  data: Omit<UsedOrderRecord, 'order_id'> & { order_id?: string }
): Promise<SavePaymentResult> {
  const orderKey = normalizeOrderId(rawOrderId || data.order_id || '');
  if (!orderKey) {
    throw new Error('orderId is required for savePayment');
  }

  const usedAt = Number(data.used_at || Date.now());
  const loginEmail = normalizeEmail(data.login_email);
  const normalizedRecord: UsedOrderRecord = {
    ...data,
    order_id: orderKey,
    transactionId: String(data.transactionId || orderKey),
    userId: String(data.userId || (loginEmail ? getUserIdForEmail(loginEmail) : '')),
    login_email: loginEmail,
    payment_email: normalizeEmail(data.payment_email || loginEmail),
    currency: String(data.currency || 'USD').toUpperCase(),
    status: data.status || 'completed',
    timestamp: data.timestamp || new Date(usedAt).toISOString(),
    used_at: usedAt,
  };

  const inserted = await withRedis(async (redis) => {
    const res = await redis.eval(
      SAVE_PAYMENT_NX_LUA,
      [paymentKey(orderKey), legacyPaymentKey(orderKey), PAYMENTS_INDEX_KEY],
      [JSON.stringify(normalizedRecord), orderKey]
    );
    return Number(res) === 1;
  });

  if (!inserted) {
    const existing = await getPayment(orderKey);
    return {
      ok: false,
      error: 'duplicate',
      existing,
    };
  }

  return {
    ok: true,
    record: normalizedRecord,
  };
}

export async function updatePaymentStatus(
  rawOrderId: string,
  patch: {
    status: 'completed' | 'refunded' | 'chargeback';
    refunded_at?: number;
    refund_reason?: string;
  }
): Promise<UsedOrderRecord | null> {
  const orderKey = normalizeOrderId(rawOrderId);
  if (!orderKey) return null;

  return withRedis(async (redis) => {
    const existing = await getPayment(orderKey);
    if (!existing) return null;
    const updated: UsedOrderRecord = {
      ...existing,
      status: patch.status,
      refunded_at: patch.refunded_at ?? (patch.status === 'completed' ? existing.refunded_at : Date.now()),
      refund_reason: patch.refund_reason ?? existing.refund_reason,
    };
    const serialized = JSON.stringify(updated);
    const tx = redis.multi();
    tx.set(paymentKey(orderKey), serialized);
    tx.set(legacyPaymentKey(orderKey), serialized);
    tx.sadd(PAYMENTS_INDEX_KEY, orderKey);
    await tx.exec();
    return updated;
  });
}

export async function getUserPaymentsFromDb(userIdOrEmail: string): Promise<UsedOrderRecord[]> {
  const { email, userId } = await resolveEmailByUserId(userIdOrEmail);
  const normEmail = normalizeEmail(email);
  const all = await getAllPaymentsFromDb();
  return all.filter(
    (p) =>
      (normEmail && normalizeEmail(p.login_email) === normEmail) ||
      (userId && p.userId === userId)
  );
}

export async function getUsedOrderFromDb(rawOrderId: string): Promise<UsedOrderRecord | null> {
  return getPayment(rawOrderId);
}

export async function markOrderUsedInDb(record: UsedOrderRecord): Promise<UsedOrderRecord> {
  const res = await savePayment(record.order_id, record);
  if (res.ok && res.record) return res.record;
  return res.existing || record;
}

export async function getAllPaymentsFromDb(): Promise<UsedOrderRecord[]> {
  return withRedis(async (redis) => {
    const byId: Record<string, UsedOrderRecord> = {};
    const ids = await redis.smembers(PAYMENTS_INDEX_KEY);
    if (Array.isArray(ids) && ids.length > 0) {
      const raws = await redis.mget<string[]>(...ids.map((id) => paymentKey(String(id))));
      for (const r of Array.isArray(raws) ? raws : []) {
        const parsed = safeParseJson<UsedOrderRecord>(r);
        if (parsed?.order_id) {
          byId[normalizeOrderId(parsed.order_id)] = {
            ...parsed,
            transactionId: parsed.transactionId || parsed.order_id,
            status: parsed.status || 'completed',
            timestamp: parsed.timestamp || (parsed.used_at ? new Date(parsed.used_at).toISOString() : undefined),
          };
        }
      }
    }
    const rawMap = await redis.get<string>(LEGACY_USED_ORDERS_MAP_KEY);
    const map = safeParseJson<Record<string, UsedOrderRecord>>(rawMap);
    if (map && typeof map === 'object') {
      for (const [k, rec] of Object.entries(map)) {
        const oid = normalizeOrderId(rec?.order_id || k);
        if (oid && !byId[oid]) {
          byId[oid] = {
            ...rec,
            transactionId: rec.transactionId || oid,
            status: rec.status || 'completed',
          };
        }
      }
    }
    return Object.values(byId).sort((a, b) => Number(b.used_at || 0) - Number(a.used_at || 0));
  });
}

export async function findUsersByOrderId(orderId: string): Promise<string[]> {
  const normOrder = normalizeOrderId(orderId);
  const affected: string[] = [];
  if (!normOrder) return affected;

  const used = await getPayment(normOrder);
  if (used?.login_email) {
    affected.push(normalizeEmail(used.login_email));
  }

  const users = await getAllServerUsersFromDb();
  for (const user of users) {
    if (user?.payments?.some((p) => normalizeOrderId(p.order_id) === normOrder)) {
      affected.push(normalizeEmail(user.email));
    }
  }
  return Array.from(new Set(affected.filter(Boolean)));
}

// =========================================================================
// 7. TRANSACTIONAL PLAN UPDATE (updatePlan via MULTI / EXEC + Audit Log)
// =========================================================================

export async function updatePlan(params: {
  emailOrUserId: string;
  newPlan: PlanKey;
  reason?: string;
  adminEmail: string;
  licenseStart?: number;
  licenseEnd?: number;
  analysesTotal?: number;
  analysesUsed?: number;
  analysesLeft?: number;
  patch?: Partial<ServerUserRecord>;
  ip?: string;
  actionName?: string;
}): Promise<{ user: ServerUserRecord; auditEntry: AdminAuditLogEntry }> {
  const existing = await getOrCreateUserInDb(params.emailOrUserId);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const prevPlan = normalizePlanKey(existing.plan);
  const nextPlan = normalizePlanKey(params.newPlan);
  const prevPlanDisplay = PLANS[prevPlan].displayName;
  const nextPlanDisplay = PLANS[nextPlan].displayName;
  const uid = existing.userId || getUserIdForEmail(existing.email);

  const nextExtra =
    typeof params.patch?.extra_credits === 'number'
      ? Math.max(0, params.patch.extra_credits)
      : Math.max(0, Number(existing.extra_credits || 0));
  const baseLimit =
    nextPlan === 'institutional'
      ? Math.max(
          0,
          Number(
            params.patch?.custom_analyses_limit ?? existing.custom_analyses_limit ?? 0
          )
        )
      : PLANS[nextPlan].analysesLimit;
  const nextAnalysesTotal =
    typeof params.analysesTotal === 'number'
      ? Math.max(0, params.analysesTotal)
      : baseLimit + nextExtra;
  const nextAnalysesUsed =
    typeof params.analysesUsed === 'number' ? Math.max(0, params.analysesUsed) : 0;
  const nextAnalysesLeft =
    typeof params.analysesLeft === 'number'
      ? Math.max(0, params.analysesLeft)
      : Math.max(0, nextAnalysesTotal - nextAnalysesUsed);

  const timelineEntry: ForensicTimelineEntry = {
    id: `tl_${now}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: iso,
    type: 'admin_plan_change',
    message: `Plan changed from ${prevPlanDisplay} to ${nextPlanDisplay}${params.reason ? ` - Reason: ${params.reason}` : ''} - By: ${params.adminEmail} - At: ${iso}`,
    actor: params.adminEmail,
  };

  const nextUser = hydrateUserRecord(
    {
      ...existing,
      ...(params.patch || {}),
      userId: uid,
      email: existing.email,
      plan: nextPlan,
      expired_from_plan: params.patch?.expired_from_plan ?? null,
      license_start: params.licenseStart ?? now,
      license_end: params.licenseEnd ?? now + THIRTY_DAYS_MS,
      analyses_total: nextAnalysesTotal,
      analyses_used: nextAnalysesUsed,
      analyses_left: nextAnalysesLeft,
      extra_credits: nextExtra,
      updated_at: now,
      timeline: [timelineEntry, ...(existing.timeline || [])].slice(0, 200),
    },
    existing.email
  );

  const auditEntry: AdminAuditLogEntry = {
    id: `aud_${now}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: iso,
    adminEmail: normalizeEmail(params.adminEmail) || 'unknown',
    targetEmail: existing.email,
    action: params.actionName || 'updatePlan',
    details: JSON.stringify({
      previousPlan: prevPlan,
      newPlan: nextPlan,
      previousPlanDisplay: prevPlanDisplay,
      newPlanDisplay: nextPlanDisplay,
      reason: params.reason || 'Admin plan update',
      analyses_total: nextAnalysesTotal,
      analyses_left: nextAnalysesLeft,
    }),
    ip: String(params.ip || '127.0.0.1').trim(),
  };

  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.set(userKey(existing.email), JSON.stringify(nextUser));
    tx.set(userIdLookupKey(uid), existing.email);
    tx.sadd(USERS_INDEX_KEY, existing.email);
    tx.set(creditsKey(uid), String(Math.max(0, Number(nextUser.analyses_left ?? 0))));
    tx.set(auditEntryKey(auditEntry.timestamp, auditEntry.id), JSON.stringify(auditEntry));
    tx.lpush(AUDIT_LOG_LIST_KEY, JSON.stringify(auditEntry));
    await tx.exec();
  });

  return { user: nextUser, auditEntry };
}

// =========================================================================
// 8. PERSISTENT SESSIONS (session:{sessionId}, EX TTL)
// =========================================================================

export async function saveSession(session: ServerSessionRecord): Promise<ServerSessionRecord> {
  const cleanId = String(session?.sessionId || '').trim();
  const email = normalizeEmail(session?.email || '');
  const uid = session.userId || getUserIdForEmail(email);
  const normalized: ServerSessionRecord = {
    ...session,
    sessionId: cleanId,
    email,
    userId: uid,
  };
  const ttlSec = Math.max(60, Math.ceil((normalized.expiresAt - Date.now()) / 1000));

  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.set(sessionKey(cleanId), JSON.stringify(normalized), { ex: ttlSec });
    if (uid) {
      tx.sadd(userSessionsSetKey(uid), cleanId);
      tx.expire(userSessionsSetKey(uid), Math.max(ttlSec, 7 * 24 * 60 * 60));
    }
    await tx.exec();
  });

  return normalized;
}

export async function saveSessionToDb(session: ServerSessionRecord): Promise<ServerSessionRecord> {
  return saveSession(session);
}

export async function getSession(sessionId: string): Promise<ServerSessionRecord | null> {
  if (!sessionId || typeof sessionId !== 'string') return null;
  const cleanId = sessionId.trim();
  if (!cleanId) return null;

  return withRedis(async (redis) => {
    let raw = await redis.get<string>(sessionKey(cleanId));
    if (!raw) {
      raw = await redis.get<string>(legacySessionKey(cleanId));
    }
    const parsed = safeParseJson<ServerSessionRecord>(raw);
    if (!parsed || parsed.sessionId !== cleanId) return null;
    if (parsed.expiresAt <= Date.now()) {
      await deleteSession(cleanId);
      return null;
    }
    return parsed;
  });
}

export async function getSessionFromDb(sessionId: string): Promise<ServerSessionRecord | null> {
  return getSession(sessionId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId || typeof sessionId !== 'string') return;
  const cleanId = sessionId.trim();
  if (!cleanId) return;

  await withRedis(async (redis) => {
    const raw = await redis.get<string>(sessionKey(cleanId));
    const parsed = safeParseJson<ServerSessionRecord>(raw);
    const uid = parsed?.userId || (parsed?.email ? getUserIdForEmail(parsed.email) : '');
    const tx = redis.multi();
    tx.del(sessionKey(cleanId));
    tx.del(legacySessionKey(cleanId));
    if (uid) {
      tx.srem(userSessionsSetKey(uid), cleanId);
    }
    await tx.exec();
  });
}

export async function deleteSessionFromDb(sessionId: string): Promise<void> {
  return deleteSession(sessionId);
}

// =========================================================================
// 9. APPEND-ONLY ADMIN AUDIT LOG (audit:{timestamp}:{id})
// =========================================================================

export async function logAdminAction(params: {
  adminEmail: string;
  targetEmail: string;
  action: string;
  details: string | Record<string, any>;
  ip: string;
  timestamp?: string;
}): Promise<AdminAuditLogEntry> {
  const entry: AdminAuditLogEntry = {
    id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: params.timestamp || new Date().toISOString(),
    adminEmail: normalizeEmail(params.adminEmail) || 'unknown',
    targetEmail: normalizeEmail(params.targetEmail) || 'system',
    action: String(params.action || 'unknown').trim(),
    details:
      typeof params.details === 'string' ? params.details : JSON.stringify(params.details ?? {}),
    ip: String(params.ip || '127.0.0.1').trim(),
  };

  await withRedis(async (redis) => {
    const serialized = JSON.stringify(entry);
    const tx = redis.multi();
    tx.set(auditEntryKey(entry.timestamp, entry.id), serialized);
    tx.lpush(AUDIT_LOG_LIST_KEY, serialized);
    await tx.exec();
  });

  return entry;
}

export async function getAuditLog(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  logs: AdminAuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, Math.floor(Number(params?.page || 1) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params?.limit || 50) || 50)));
  const start = (page - 1) * limit;
  const stop = start + limit - 1;

  return withRedis(async (redis) => {
    const total = Math.max(0, Number(await redis.llen(AUDIT_LOG_LIST_KEY)));
    if (total === 0) {
      return { logs: [], total: 0, page, limit, totalPages: 1 };
    }
    const rawItems = await redis.lrange(AUDIT_LOG_LIST_KEY, start, stop);
    const logs: AdminAuditLogEntry[] = (Array.isArray(rawItems) ? rawItems : [])
      .map((item) => safeParseJson<AdminAuditLogEntry>(item))
      .filter((x): x is AdminAuditLogEntry => Boolean(x))
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  });
}

export async function getAuditLogsFromDb(params?: {
  page?: number;
  limit?: number;
}) {
  return getAuditLog(params);
}

// =========================================================================
// 10. ACCOUNT DELETION (GDPR / Privacy - Deletes Specific User Only)
// =========================================================================

export async function deleteServerUserFromDb(rawEmail: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  if (!email) return false;
  const userId = getUserIdForEmail(email);

  return withRedis(async (redis) => {
    const existing = await getUser(email);
    const sessionIds = await redis.smembers(userSessionsSetKey(userId));
    const analysisIds = await redis.lrange(analysesListKey(userId), 0, -1);
    const reportIds = await redis.smembers(`aqari:reports:index:${email}`);
    const apiKeys = await redis.smembers(`aqari:apikeys:index:${email}`);

    const tx = redis.multi();
    tx.del(userKey(email));
    tx.del(legacyUserKey(email));
    tx.del(userIdLookupKey(userId));
    tx.del(creditsKey(userId));
    tx.del(analysesListKey(userId));
    tx.del(userSessionsSetKey(userId));
    tx.del(`aqari:analyst_thread:${email}`);
    tx.del(`aqari:user_orgs:${email}`);
    tx.del(`aqari:reports:index:${email}`);
    tx.del(`aqari:apikeys:index:${email}`);
    tx.del(`aqari:pending_checkout:email:${email}`);
    tx.srem(USERS_INDEX_KEY, email);
    tx.srem(ANALYST_THREADS_INDEX_KEY, email);

    for (const sid of Array.isArray(sessionIds) ? sessionIds : []) {
      const cleanSid = String(sid || '').trim();
      if (cleanSid) {
        tx.del(sessionKey(cleanSid));
        tx.del(legacySessionKey(cleanSid));
      }
    }
    for (const aid of Array.isArray(analysisIds) ? analysisIds : []) {
      const cleanAid = String(aid || '').trim();
      if (cleanAid) tx.del(analysisKey(userId, cleanAid));
    }
    for (const rid of Array.isArray(reportIds) ? reportIds : []) {
      const cleanRid = String(rid || '').trim();
      if (cleanRid) tx.del(`aqari:report:${cleanRid}`);
    }
    for (const tok of Array.isArray(apiKeys) ? apiKeys : []) {
      const cleanTok = String(tok || '').trim();
      if (cleanTok) tx.del(`aqari:apikey:${cleanTok}`);
    }
    if (existing?.api_key_token) {
      tx.del(`aqari:apikey:${existing.api_key_token}`);
    }
    await tx.exec();

    // Update legacy users index array if present
    const legacyIdxRaw = await redis.get<string>(LEGACY_USERS_INDEX_KEY);
    const legacyIdx = safeParseJson<string[]>(legacyIdxRaw);
    if (Array.isArray(legacyIdx)) {
      const nextIdx = legacyIdx.filter((em) => normalizeEmail(em) !== email);
      await redis.set(LEGACY_USERS_INDEX_KEY, JSON.stringify(nextIdx));
    }

    // Remove user's whiteglove requests if present
    const wgRaw = await redis.get<string>(WHITEGLOVE_REQUESTS_KEY);
    const wgList = safeParseJson<WhiteGloveRequestRecord[]>(wgRaw);
    if (Array.isArray(wgList)) {
      const filtered = wgList.filter((w) => normalizeEmail(w?.email || '') !== email);
      if (filtered.length !== wgList.length) {
        await redis.set(WHITEGLOVE_REQUESTS_KEY, JSON.stringify(filtered));
      }
    }

    return Boolean(existing);
  });
}

// =========================================================================
// 11. SHARED PRICING, LOGS, WORKSPACES, REPORTS, API KEYS, RATE LIMIT
// =========================================================================

export async function getPricingConfigFromDb(): Promise<StoredPricingConfig> {
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(PRICING_CONFIG_KEY);
    const parsed = safeParseJson(raw);
    return hydratePricingConfig(parsed);
  });
}

export async function savePricingConfigToDb(
  cfg: StoredPricingConfig,
  log?: PricingChangeLogEntry
): Promise<StoredPricingConfig> {
  const hydrated = hydratePricingConfig(cfg);
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.set(PRICING_CONFIG_KEY, JSON.stringify(hydrated));
    if (log) {
      tx.lpush(PRICING_LOGS_KEY, JSON.stringify(log));
      tx.ltrim(PRICING_LOGS_KEY, 0, 199);
    }
    await tx.exec();
  });
  return hydrated;
}

export async function getPricingLogsFromDb(limit = 50): Promise<PricingChangeLogEntry[]> {
  return withRedis(async (redis) => {
    const rawItems = await redis.lrange(PRICING_LOGS_KEY, 0, Math.max(0, limit - 1));
    return (Array.isArray(rawItems) ? rawItems : [])
      .map((item) => safeParseJson<PricingChangeLogEntry>(item))
      .filter((x): x is PricingChangeLogEntry => Boolean(x));
  });
}

export async function appendWebhookLogToDb(
  entry: Omit<WebhookLogEntry, 'id' | 'timestamp'>
): Promise<WebhookLogEntry> {
  const log: WebhookLogEntry = {
    id: `wh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry,
    event: entry.event || entry.event_name,
    event_name: entry.event_name || entry.event || 'unknown',
    raw_error: entry.raw_error ?? entry.error,
    error: entry.error ?? entry.raw_error,
  };
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.lpush(WEBHOOK_LOGS_KEY, JSON.stringify(log));
    tx.ltrim(WEBHOOK_LOGS_KEY, 0, 199);
    await tx.exec();
  });
  return log;
}

export async function updateWebhookLogInDb(
  id: string,
  patch: Partial<WebhookLogEntry>
): Promise<WebhookLogEntry | null> {
  return withRedis(async (redis) => {
    const rawItems = await redis.lrange(WEBHOOK_LOGS_KEY, 0, 49);
    if (!Array.isArray(rawItems)) return null;
    for (let i = 0; i < rawItems.length; i++) {
      const parsed = safeParseJson<WebhookLogEntry>(rawItems[i]);
      if (parsed?.id === id) {
        const merged: WebhookLogEntry = { ...parsed, ...patch };
        if (patch.raw_error === undefined && 'raw_error' in patch) {
          delete merged.raw_error;
          delete merged.error;
        }
        await redis.lset(WEBHOOK_LOGS_KEY, i, JSON.stringify(merged));
        return merged;
      }
    }
    return null;
  });
}

export async function getWebhookLogsFromDb(limit = 50): Promise<WebhookLogEntry[]> {
  return withRedis(async (redis) => {
    const rawItems = await redis.lrange(WEBHOOK_LOGS_KEY, 0, Math.max(0, limit - 1));
    return (Array.isArray(rawItems) ? rawItems : [])
      .map((item) => safeParseJson<WebhookLogEntry>(item))
      .filter((x): x is WebhookLogEntry => Boolean(x));
  });
}

export async function recordFailedWebhookToDb(
  reason: string,
  ip?: string
): Promise<FailedWebhookLog> {
  const log: FailedWebhookLog = {
    id: `fwh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    reason,
    ip,
  };
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.lpush(FAILED_WEBHOOKS_KEY, JSON.stringify(log));
    tx.ltrim(FAILED_WEBHOOKS_KEY, 0, 199);
    await tx.exec();
  });
  return log;
}

export async function getFailedWebhooksFromDb(limit = 50): Promise<FailedWebhookLog[]> {
  return withRedis(async (redis) => {
    const rawItems = await redis.lrange(FAILED_WEBHOOKS_KEY, 0, Math.max(0, limit - 1));
    return (Array.isArray(rawItems) ? rawItems : [])
      .map((item) => safeParseJson<FailedWebhookLog>(item))
      .filter((x): x is FailedWebhookLog => Boolean(x));
  });
}

export async function appendEmailLogToDb(
  entry: Omit<EmailLogEntry, 'id' | 'timestamp'>
): Promise<EmailLogEntry> {
  const log: EmailLogEntry = {
    id: `mail_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.lpush(EMAIL_LOGS_KEY, JSON.stringify(log));
    tx.ltrim(EMAIL_LOGS_KEY, 0, 199);
    await tx.exec();
  });
  return log;
}

export async function getEmailLogsFromDb(limit = 50): Promise<EmailLogEntry[]> {
  return withRedis(async (redis) => {
    const rawItems = await redis.lrange(EMAIL_LOGS_KEY, 0, Math.max(0, limit - 1));
    return (Array.isArray(rawItems) ? rawItems : [])
      .map((item) => safeParseJson<EmailLogEntry>(item))
      .filter((x): x is EmailLogEntry => Boolean(x));
  });
}

export async function appendCancellationLogToDb(entry: any): Promise<any> {
  const log = {
    id: `can_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.lpush(CANCELLATION_LOGS_KEY, JSON.stringify(log));
    tx.ltrim(CANCELLATION_LOGS_KEY, 0, 199);
    await tx.exec();
  });
  return log;
}

export async function getCancellationLogsFromDb(limit = 100): Promise<any[]> {
  return withRedis(async (redis) => {
    const rawItems = await redis.lrange(CANCELLATION_LOGS_KEY, 0, Math.max(0, limit - 1));
    return (Array.isArray(rawItems) ? rawItems : [])
      .map((item) => safeParseJson(item))
      .filter(Boolean);
  });
}

export async function recordPendingCheckoutToDb(entry: PendingCheckoutEntry): Promise<void> {
  const norm = normalizeEmail(entry.email);
  const payload = JSON.stringify({ ...entry, email: norm });
  await withRedis(async (redis) => {
    const tx = redis.multi();
    if (norm) {
      tx.set(`aqari:pending_checkout:email:${norm}`, payload, { ex: 7200 });
    }
    if (entry.checkoutId) {
      tx.set(`aqari:pending_checkout:chk:${entry.checkoutId}`, payload, { ex: 7200 });
    }
    await tx.exec();
  });
}

export async function consumePendingCheckoutFromDb(
  email?: string,
  checkoutId?: string
): Promise<PendingCheckoutEntry | null> {
  const norm = normalizeEmail(email || '');
  return withRedis(async (redis) => {
    const byIdRaw = checkoutId ? await redis.get<string>(`aqari:pending_checkout:chk:${checkoutId}`) : null;
    const byEmailRaw = norm ? await redis.get<string>(`aqari:pending_checkout:email:${norm}`) : null;
    const match = safeParseJson<PendingCheckoutEntry>(byIdRaw || byEmailRaw);
    if (match) {
      const keys: string[] = [];
      if (norm) keys.push(`aqari:pending_checkout:email:${norm}`);
      if (checkoutId) keys.push(`aqari:pending_checkout:chk:${checkoutId}`);
      if (match.checkoutId) keys.push(`aqari:pending_checkout:chk:${match.checkoutId}`);
      if (keys.length > 0) await redis.del(...Array.from(new Set(keys)));
    }
    return match;
  });
}

export async function getAnalystThreadFromDb(rawEmail: string): Promise<AnalystThreadRecord> {
  const email = normalizeEmail(rawEmail);
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(`aqari:analyst_thread:${email}`);
    const parsed = safeParseJson<AnalystThreadRecord>(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return {
      email,
      plan: 'SOVEREIGN',
      status: 'Open',
      unreadForAdmin: 0,
      unreadForClient: 0,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      messages: [],
    };
  });
}

export async function saveAnalystThreadToDb(
  thread: AnalystThreadRecord
): Promise<AnalystThreadRecord> {
  const email = normalizeEmail(thread?.email);
  if (!email) return thread;
  const clean: AnalystThreadRecord = { ...thread, email };
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.set(`aqari:analyst_thread:${email}`, JSON.stringify(clean));
    tx.sadd(ANALYST_THREADS_INDEX_KEY, email);
    await tx.exec();
  });
  return clean;
}

export async function getAnalystThreadsMapFromDb(): Promise<Record<string, AnalystThreadRecord>> {
  return withRedis(async (redis) => {
    const out: Record<string, AnalystThreadRecord> = {};
    const legacyRaw = await redis.get<string>(LEGACY_ANALYST_THREADS_MAP_KEY);
    const legacyMap = safeParseJson<Record<string, AnalystThreadRecord>>(legacyRaw);
    if (legacyMap && typeof legacyMap === 'object') {
      Object.assign(out, legacyMap);
    }
    const members = await redis.smembers(ANALYST_THREADS_INDEX_KEY);
    if (Array.isArray(members) && members.length > 0) {
      const raws = await redis.mget<string[]>(
        ...members.map((e) => `aqari:analyst_thread:${normalizeEmail(String(e))}`)
      );
      for (const r of Array.isArray(raws) ? raws : []) {
        const parsed = safeParseJson<AnalystThreadRecord>(r);
        if (parsed?.email) {
          out[normalizeEmail(parsed.email)] = parsed;
        }
      }
    }
    return out;
  });
}

export async function getWhiteGloveRequestsFromDb(): Promise<WhiteGloveRequestRecord[]> {
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(WHITEGLOVE_REQUESTS_KEY);
    const parsed = safeParseJson<WhiteGloveRequestRecord[]>(raw);
    return Array.isArray(parsed) ? parsed : [];
  });
}

export async function saveWhiteGloveRequestsToDb(
  requests: WhiteGloveRequestRecord[]
): Promise<WhiteGloveRequestRecord[]> {
  const trimmed = requests.slice(0, 300);
  await withRedis(async (redis) => {
    await redis.set(WHITEGLOVE_REQUESTS_KEY, JSON.stringify(trimmed));
  });
  return trimmed;
}

export async function appendEnterpriseInquiryToDb(inquiry: any): Promise<any[]> {
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(ENTERPRISE_INQUIRIES_KEY);
    const parsed = safeParseJson<any[]>(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    list.unshift(inquiry);
    const trimmed = list.slice(0, 200);
    await redis.set(ENTERPRISE_INQUIRIES_KEY, JSON.stringify(trimmed));
    return trimmed;
  });
}

export async function getEnterpriseInquiriesFromDb(): Promise<any[]> {
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(ENTERPRISE_INQUIRIES_KEY);
    const parsed = safeParseJson<any[]>(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  });
}

export async function saveApiKeyToDb(token: string, rawEmail: string): Promise<void> {
  const cleanToken = String(token || '').trim();
  const email = normalizeEmail(rawEmail);
  if (!cleanToken || !email) return;
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.set(`aqari:apikey:${cleanToken}`, email);
    tx.sadd(`aqari:apikeys:index:${email}`, cleanToken);
    await tx.exec();
  });
}

export async function deleteApiKeyFromDb(rawToken: string): Promise<void> {
  const cleanToken = String(rawToken || '').trim();
  if (!cleanToken) return;
  await withRedis(async (redis) => {
    await redis.del(`aqari:apikey:${cleanToken}`);
  });
}

export async function resolveApiKeyOwnerFromDb(rawToken: string): Promise<string | null> {
  const cleanToken = String(rawToken || '').trim();
  if (!cleanToken) return null;
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(`aqari:apikey:${cleanToken}`);
    const email = normalizeEmail(String(raw || ''));
    return email && email.includes('@') ? email : null;
  });
}

export async function appendAdminAuditLogToDb(entry: {
  action: string;
  targetEmail?: string;
  details?: Record<string, any>;
  reason?: string;
  adminEmail?: string;
}): Promise<any> {
  const log = {
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    action: entry.action,
    admin: entry.adminEmail || 'admin-api',
    targetEmail: entry.targetEmail ? normalizeEmail(entry.targetEmail) : null,
    reason: entry.reason || '',
    details: entry.details || {},
  };
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.lpush(ADMIN_AUDIT_LOG_LIST_KEY, JSON.stringify(log));
    tx.ltrim(ADMIN_AUDIT_LOG_LIST_KEY, 0, 499);
    await tx.exec();
  });
  return log;
}

export async function getAdminAuditLogsFromDb(limit = 200): Promise<any[]> {
  return withRedis(async (redis) => {
    const rawItems = await redis.lrange(ADMIN_AUDIT_LOG_LIST_KEY, 0, Math.max(0, limit - 1));
    return (Array.isArray(rawItems) ? rawItems : [])
      .map((item) => safeParseJson(item))
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''))
      .slice(0, limit);
  });
}

export async function readEnterpriseOrgFromDb(orgId: string): Promise<any | null> {
  const cleanId = String(orgId || '').trim();
  if (!cleanId) return null;
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(`aqari:org:${cleanId}`);
    return safeParseJson(raw);
  });
}

export async function saveEnterpriseOrgToDb(org: any): Promise<void> {
  if (!org?.id) return;
  await withRedis(async (redis) => {
    await redis.set(`aqari:org:${org.id}`, JSON.stringify(org));
  });
}

export async function addOrgToUserIndexDb(rawEmail: string, orgId: string): Promise<string[]> {
  const email = normalizeEmail(rawEmail);
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(`aqari:user_orgs:${email}`);
    const parsed = safeParseJson<string[]>(raw);
    const ids = Array.isArray(parsed) ? parsed.map(String) : [];
    if (!ids.includes(orgId)) {
      ids.unshift(orgId);
      const trimmed = ids.slice(0, 50);
      await redis.set(`aqari:user_orgs:${email}`, JSON.stringify(trimmed));
      return trimmed;
    }
    return ids.slice(0, 50);
  });
}

export async function getUserOrgIdsDb(rawEmail: string): Promise<string[]> {
  const email = normalizeEmail(rawEmail);
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(`aqari:user_orgs:${email}`);
    const parsed = safeParseJson<string[]>(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  });
}

export async function saveReportFileToDb(report: StoredReportRecord): Promise<void> {
  if (!report?.id) return;
  const email = normalizeEmail(report.ownerEmail || '');
  await withRedis(async (redis) => {
    const tx = redis.multi();
    tx.set(`aqari:report:${report.id}`, JSON.stringify(report));
    if (email) {
      tx.sadd(`aqari:reports:index:${email}`, report.id);
    }
    await tx.exec();
  });
}

export async function readReportFileFromDb(reportId: string): Promise<StoredReportRecord | null> {
  const cleanId = String(reportId || '').trim();
  if (!cleanId) return null;
  return withRedis(async (redis) => {
    const raw = await redis.get<string>(`aqari:report:${cleanId}`);
    return safeParseJson<StoredReportRecord>(raw);
  });
}

// =========================================================================
// 12. ATOMIC PERSISTENT RATE LIMITER (Lua INCR + PEXPIRE)
// =========================================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  resetAt: number;
}

const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
local pttl = redis.call('PTTL', KEYS[1])
local win = tonumber(ARGV[1])
if count == 1 or pttl <= 0 then
  redis.call('PEXPIRE', KEYS[1], win)
  pttl = win
end
return {count, pttl}
`;

export async function rateLimit(
  rawKey: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = String(rawKey || 'anonymous').trim().slice(0, 180);
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindowMs = Math.max(1000, Math.floor(windowMs));
  const now = Date.now();
  const redisKey = `aqari:rl:${key}`;

  const [countRaw, pttlRaw] = await withRedis(async (redis) => {
    const res = await redis.eval(RATE_LIMIT_LUA, [redisKey], [String(safeWindowMs)]);
    return Array.isArray(res) ? res : [1, safeWindowMs];
  });

  const count = Math.max(1, Number(countRaw || 1));
  const ttlMs = Math.max(1000, Number(pttlRaw || safeWindowMs));
  const allowed = count <= safeLimit;

  return {
    allowed,
    remaining: Math.max(0, safeLimit - count),
    retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil(ttlMs / 1000)),
    resetAt: now + ttlMs,
  };
}

// =========================================================================
// 13. COMPATIBILITY EXPORTS FOR PRICING & LICENSE STATUS
// =========================================================================

export async function getPricingPublicPayloadFromDb(): Promise<PricingPublicPayload> {
  const cfg = await getPricingConfigFromDb();
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((cfg.launchEndsAt - now) / (24 * 60 * 60 * 1000)));
  const plansMap = {} as Record<PlanKey, DynamicPlanPublic>;
  const plansList: DynamicPlanPublic[] = [];

  for (const k of ['free', 'starter', 'pro', 'enterprise', 'institutional'] as PlanKey[]) {
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

export function createDefaultUserRecord(
  rawEmail: string,
  name?: string
): ServerUserRecord {
  const email = normalizeEmail(rawEmail);
  return hydrateUserRecord({ email, name: name || email.split('@')[0] }, email);
}

export async function updateUserPartial(
  rawEmail: string,
  patch: Partial<ServerUserRecord>,
  options?: { syncCredits?: boolean }
): Promise<ServerUserRecord> {
  const existing = await getOrCreateUserInDb(rawEmail);
  const merged = hydrateUserRecord(
    { ...existing, ...patch, email: existing.email, updated_at: Date.now() },
    existing.email
  );
  return saveUser(merged, options);
}

export const appendEmailLog = appendEmailLogToDb;
export const createSessionRecord = saveSession;
export const getSessionRecord = getSession;

export async function computeServerLicenseStatusFromDb(
  user: ServerUserRecord
): Promise<ComputedLicenseStatus> {
  const pricing = await getPricingPublicPayloadFromDb();
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
