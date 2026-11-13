// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import fs from 'fs';
import path from 'path';
import { PlanKey, PLANS, THIRTY_DAYS_MS, normalizePlanKey } from './plans';

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

export interface ServerUserRecord {
  email: string;
  name: string;
  plan: PlanKey;
  license_start: number | null;
  license_end: number | null;
  analyses_used: number;
  saved_analyses: any[];
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
}

export interface WebhookLogEntry {
  id: string;
  order_id: string;
  event_name: string;
  plan: PlanKey;
  email: string;
  amount: number;
  currency: string;
  test_mode: boolean;
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
  type: 'day29_renewal' | 'plan_expired' | 'test_day29';
  status: 'sent' | 'simulated';
  provider: 'resend' | 'nodemailer' | 'log';
  timestamp: string;
  error?: string;
}

interface StoreShape {
  users: Record<string, ServerUserRecord>;
  webhook_logs: WebhookLogEntry[];
  failed_webhooks: FailedWebhookLog[];
  email_logs: EmailLogEntry[];
}

const STORE_FILE = path.join('/tmp', 'aqari_terminal_store_v1.json');

let memoryStore: StoreShape = {
  users: {},
  webhook_logs: [],
  failed_webhooks: [],
  email_logs: [],
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
}): ServerUserRecord {
  const now = params.paymentTimestamp || Date.now();
  const licenseStart = now;
  const licenseEnd = now + THIRTY_DAYS_MS;
  const existing = getOrCreateServerUser(params.email, { name: params.name });
  const planCfg = PLANS[params.plan];
  const amount = params.amountUSD ?? planCfg.priceUSD;
  const orderId = params.orderId || `ord_${now}`;
  const iso = new Date(now).toISOString();

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
          message: `Purchased ${planCfg.displayName} $${amount} - Order #${orderId} (${params.testMode ? 'TEST' : 'LIVE'})`,
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

export function appendWebhookLog(
  entry: Omit<WebhookLogEntry, 'id' | 'timestamp'>
): WebhookLogEntry {
  const store = loadStore();
  const log: WebhookLogEntry = {
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.webhook_logs.unshift(log);
  if (store.webhook_logs.length > 200) {
    store.webhook_logs = store.webhook_logs.slice(0, 200);
  }
  persistStore(store);
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
  return log;
}

export function getEmailLogs(): EmailLogEntry[] {
  return loadStore().email_logs;
}
