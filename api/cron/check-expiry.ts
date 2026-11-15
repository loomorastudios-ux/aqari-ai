// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import fs from 'fs';
import path from 'path';

// =========================================================================
// 1. INLINED PLANS & EMAIL TEMPLATES (Zero external ../../lib imports)
// =========================================================================

type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise';

const PRODUCTION_URL = 'https://aqari-ai-rho.vercel.app';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_FROM = 'AQARI Terminal <onboarding@resend.dev>';
const EMAIL_FROM_ADDRESS = 'onboarding@resend.dev';

const PLAN_DEFINITIONS: Record<
  PlanKey,
  {
    displayName: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
    launchPrice: number;
    analysesLimit: number;
  }
> = {
  free: { displayName: 'FREE', launchPrice: 0, analysesLimit: 3 },
  starter: { displayName: 'STARTER', launchPrice: 79, analysesLimit: 30 },
  pro: { displayName: 'PROFESSIONAL', launchPrice: 199, analysesLimit: 150 },
  enterprise: { displayName: 'SOVEREIGN', launchPrice: 599, analysesLimit: 400 },
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

function getStoreFile(): string {
  try {
    return path.join('/tmp', 'aqari_terminal_store_v1.json');
  } catch {
    return '/tmp/aqari_terminal_store_v1.json';
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
    if (!res.ok) throw new Error(`KV HTTP ${res.status}`);
    const json = await res.json();
    return json?.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function loadRawStore(): any {
  try {
    const storeFile = getStoreFile();
    if (fs.existsSync(storeFile)) {
      return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    }
  } catch {}
  return {
    users: {},
    webhook_logs: [],
    failed_webhooks: [],
    email_logs: [],
    pricing_logs: [],
    pending_checkouts: {},
    used_orders: {},
  };
}

function persistRawStore(store: any): void {
  try {
    fs.writeFileSync(getStoreFile(), JSON.stringify(store, null, 2), 'utf8');
  } catch {}
}

function appendEmailLog(entry: any) {
  const store = loadRawStore();
  if (!Array.isArray(store.email_logs)) store.email_logs = [];
  const log = {
    id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.email_logs.unshift(log);
  store.email_logs = store.email_logs.slice(0, 200);
  persistRawStore(store);
  const kv = getKvConfig();
  if (kv) {
    kvCommand(['LPUSH', 'aqari:email_logs:v1', JSON.stringify(log)])
      .then(() => kvCommand(['LTRIM', 'aqari:email_logs:v1', 0, 199]))
      .catch(() => {});
  }
}

function buildDay29RenewalEmail(params: {
  name: string;
  plan: PlanKey;
  endDateFormatted: string;
  analysesLeft: number | string;
}) {
  const planName = PLAN_DEFINITIONS[params.plan]?.displayName || 'STARTER';
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
    `Or Upgrade to Professional ($${PLAN_DEFINITIONS.pro.launchPrice}) / Sovereign ($${PLAN_DEFINITIONS.enterprise.launchPrice}): ${renewUrl}`,
    '',
    `If you don't renew, you will return to FREE (3 analyses).`,
    '',
    `AQARI Global Terminal`,
    PRODUCTION_URL,
  ].join('\n');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#070709;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#0b0b0f;border:1px solid #26262e;border-radius:16px;"><div style="font-family:monospace;color:#D4AF37;font-size:12px;letter-spacing:1.5px;font-weight:bold;margin-bottom:12px;">AQARI GLOBAL TERMINAL • 30-DAY LICENSING NOTICE</div><h1 style="font-size:22px;margin:0 0 16px;color:#ffffff;">Your AQARI ${planName} ends tomorrow</h1><p style="font-size:15px;line-height:1.6;color:#d4d4d8;margin:0 0 16px;">Hi <strong>${params.name}</strong>, your <strong>${planName}</strong> ends tomorrow (<strong>${params.endDateFormatted}</strong>). You have <strong>${leftText}</strong> analyses left.</p><a href="${renewUrl}" style="display:inline-block;padding:12px 22px;background:#D4AF37;color:#000000;font-weight:800;font-family:monospace;text-decoration:none;border-radius:10px;font-size:13px;">Renew ${planName} in 1 Click &rarr;</a><p style="font-size:13px;line-height:1.6;color:#a1a1aa;margin:16px 0 0;border-top:1px solid #27272a;padding-top:16px;">If you don't renew, you will return to <strong>FREE (3 analyses)</strong>.</p></div></body></html>`;

  return { subject, text, html };
}

function buildExpiredEmail(params: { name: string; previousPlan: PlanKey }) {
  const prevName = PLAN_DEFINITIONS[params.previousPlan]?.displayName || 'STARTER';
  const renewUrl = `${PRODUCTION_URL}/pricing`;
  const subject = `Your AQARI ${prevName} plan expired`;
  const text = `Hi ${params.name},\n\nYour AQARI ${prevName} licensing window has expired. Your account has returned to FREE (3 analyses).\n\nRenew anytime: ${renewUrl}\n\nAQARI Global Terminal`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#070709;color:#ffffff;font-family:sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#0b0b0f;border:1px solid #26262e;border-radius:16px;"><div style="font-family:monospace;color:#fb7185;font-size:12px;font-weight:bold;margin-bottom:10px;">AQARI GLOBAL TERMINAL</div><h2 style="margin:0 0 12px;color:#fff;">Your AQARI ${prevName} plan expired</h2><p style="color:#d4d4d8;font-size:14px;line-height:1.6;">Hi ${params.name}, your 30-day licensing window has ended and your account has returned to <strong>FREE (3 analyses)</strong>.</p><a href="${renewUrl}" style="display:inline-block;margin-top:16px;padding:12px 22px;background:#D4AF37;color:#000;font-weight:bold;text-decoration:none;border-radius:10px;">Renew Subscription &rarr;</a></div></body></html>`;
  return { subject, text, html };
}

async function dispatchEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: 'day29_renewal' | 'plan_expired' | 'test_day29';
}) {
  const resendKey = cleanEnvValue(getEnv('RESEND_API_KEY'));
  const hasResendKey = Boolean(resendKey);
  const keyPrefix = hasResendKey ? resendKey.slice(0, 6) : 'MISSING';

  if (!hasResendKey) {
    appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: 'failed',
      provider: 'resend',
      error: 'RESEND_API_KEY missing in Vercel',
      has_resend_key: false,
      key_prefix: 'MISSING',
      resend_status: 0,
    });
    return { success: false };
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
    appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: res.ok ? 'sent' : 'failed',
      provider: 'resend',
      has_resend_key: true,
      key_prefix: keyPrefix,
      resend_status: res.status,
    });
    return { success: res.ok };
  } catch (err: any) {
    appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: 'failed',
      provider: 'resend',
      error: err?.message || 'Network error',
      has_resend_key: true,
      key_prefix: keyPrefix,
      resend_status: 502,
    });
    return { success: false };
  }
}

function getLocalHourAndDate(timestamp: number, timeZone: string): { hour: number; dateStr: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Muscat',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date(timestamp));

    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    return {
      hour: Number(get('hour')),
      dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    const d = new Date(timestamp);
    return {
      hour: d.getUTCHours(),
      dateStr: d.toISOString().slice(0, 10),
    };
  }
}

export default async function handler(req: any, res: any) {
  try {
    const now = Date.now();
    const force = req?.query?.force === 'true' || req?.body?.force === true;
    const store = loadRawStore();
    const users = Object.values(store.users || {}) as any[];

    let downgradedToFree = 0;
    let expiredEmailsSent = 0;
    let day29EmailsSent = 0;
    const actions: Array<{ email: string; action: string }> = [];

    for (const u of users) {
      const planKey = normalizePlanKey(u?.plan);
      if (planKey === 'free' || !u?.license_end) continue;

      if (now >= u.license_end) {
        const previousPlan = planKey;
        const shouldSendExpired = !u.expired_email_sent;
        u.plan = 'free';
        u.analyses_used = 0;
        u.license_start = now;
        u.license_end = now + THIRTY_DAYS_MS;
        u.expired_email_sent = true;
        u.updated_at = now;
        store.users[u.email] = u;
        persistRawStore(store);
        downgradedToFree++;

        if (shouldSendExpired) {
          const mail = buildExpiredEmail({ name: u.name || u.email.split('@')[0], previousPlan });
          await dispatchEmail({
            to: u.email,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            type: 'plan_expired',
          });
          expiredEmailsSent++;
        }
        actions.push({ email: u.email, action: `expired_downgraded_from_${previousPlan}_to_free` });
        continue;
      }

      const msLeft = u.license_end - now;
      const isTomorrow = msLeft > 0 && msLeft <= 36 * 60 * 60 * 1000;
      const tz = u.timezone || 'Asia/Muscat';
      const userEnd = getLocalHourAndDate(u.license_end, tz);
      const userTomorrow = getLocalHourAndDate(now + 24 * 60 * 60 * 1000, tz);
      const utcTomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const utcEnd = new Date(u.license_end).toISOString().slice(0, 10);

      const endsTomorrow =
        userEnd.dateStr === userTomorrow.dateStr ||
        utcEnd === utcTomorrow ||
        isTomorrow;

      if ((endsTomorrow || force) && !u.day29_email_sent) {
        const planCfg = PLAN_DEFINITIONS[planKey];
        const limit = planCfg.analysesLimit;
        const analysesLeft = Number.isFinite(limit)
          ? Math.max(0, limit - Math.max(0, Number(u.analyses_used || 0)))
          : 'Unlimited';

        const formattedEnd = new Date(u.license_end).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        const mail = buildDay29RenewalEmail({
          name: u.name || u.email.split('@')[0],
          plan: planKey,
          endDateFormatted: formattedEnd,
          analysesLeft,
        });

        await dispatchEmail({
          to: u.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          type: 'day29_renewal',
        });

        u.day29_email_sent = true;
        u.updated_at = now;
        store.users[u.email] = u;
        persistRawStore(store);
        day29EmailsSent++;
        actions.push({ email: u.email, action: `sent_day29_email_${planKey}` });
      }
    }

    return res.status(200).json({
      success: true,
      checkedAt: new Date(now).toISOString(),
      processedUsers: users.length,
      downgradedToFree,
      expiredEmailsSent,
      day29EmailsSent,
      actions,
    });
  } catch (error: any) {
    console.error('/api/cron/check-expiry error:', error);
    return res.status(200).json({ success: false, error: error?.message || 'Cron execution failed' });
  }
}
