// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import { requireAdmin } from '../../lib/auth';
import {
  getAllServerUsersFromDb,
  saveUserToDb,
  appendEmailLogToDb,
} from '../../lib/serverStore';

// =========================================================================
// 1. INLINED PLANS & EMAIL TEMPLATES
// =========================================================================

type PlanKey = 'free' | 'starter' | 'pro' | 'enterprise';

const PRODUCTION_URL = 'https://aqari-ai-rho.vercel.app';
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

async function appendEmailLog(entry: any) {
  await appendEmailLogToDb(entry).catch((err) => {
    console.error('[CRON] Failed persisting email log:', err);
  });
}

function buildDay29RenewalEmail(params: {
  name: string;
  plan: PlanKey;
  endDateFormatted: string;
  analysesLeft: number | string;
}) {
  const planName = PLAN_DEFINITIONS[params.plan]?.displayName || 'STARTER';
  const subject = `Your AQARI ${planName} expires tomorrow ${params.endDateFormatted} - Renew Plan`;
  const renewUrl = `${PRODUCTION_URL}/pricing`;
  const leftText =
    params.analysesLeft === Infinity || params.analysesLeft === 'Unlimited'
      ? 'Unlimited'
      : String(params.analysesLeft);

  const text = [
    `Hi ${params.name},`,
    '',
    `Your ${planName} expires tomorrow ${params.endDateFormatted}. You have ${leftText} analyses left.`,
    `Renew now to keep access. No auto-charge will happen.`,
    '',
    `Renew Plan (30-day one-time access): ${renewUrl}`,
    '',
    `AQARI Global Terminal`,
    PRODUCTION_URL,
  ].join('\n');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#070709;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#0b0b0f;border:1px solid #26262e;border-radius:16px;"><div style="font-family:monospace;color:#D4AF37;font-size:12px;letter-spacing:1.5px;font-weight:bold;margin-bottom:12px;">AQARI GLOBAL TERMINAL • 30-DAY ONE-TIME ACCESS</div><h1 style="font-size:22px;margin:0 0 16px;color:#ffffff;">Your ${planName} expires tomorrow ${params.endDateFormatted}</h1><p style="font-size:15px;line-height:1.6;color:#d4d4d8;margin:0 0 16px;">Hi <strong>${params.name}</strong>, your <strong>${planName}</strong> expires tomorrow (<strong>${params.endDateFormatted}</strong>). You have <strong>${leftText}</strong> credits left. Renew now to keep access. <strong>No auto-charge will happen.</strong></p><a href="${renewUrl}" style="display:inline-block;padding:12px 22px;background:#D4AF37;color:#000000;font-weight:800;font-family:monospace;text-decoration:none;border-radius:10px;font-size:13px;">Renew Plan &rarr;</a><p style="font-size:13px;line-height:1.6;color:#a1a1aa;margin:16px 0 0;border-top:1px solid #27272a;padding-top:16px;">All plans are 30-day one-time purchases. Purchased Extra Credits never expire.</p></div></body></html>`;

  return { subject, text, html };
}

function buildExpiredEmail(params: { name: string; previousPlan: PlanKey; expiredDateFormatted: string; extraCredits: number }) {
  const prevName = PLAN_DEFINITIONS[params.previousPlan]?.displayName || 'STARTER';
  const renewUrl = `${PRODUCTION_URL}/pricing`;
  const subject = `Your AQARI ${prevName} expired on ${params.expiredDateFormatted}`;
  const creditNote =
    params.extraCredits > 0
      ? `You still have ${params.extraCredits} non-expiring Credits. Buy a plan to unlock full features, or continue with credits.`
      : `Renew to continue. No auto-charge was made.`;
  const text = `Hi ${params.name},\n\nYour ${prevName} expired on ${params.expiredDateFormatted}. ${creditNote}\n\nRenew anytime: ${renewUrl}\n\nAQARI Global Terminal`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#070709;color:#ffffff;font-family:sans-serif;"><div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#0b0b0f;border:1px solid #26262e;border-radius:16px;"><div style="font-family:monospace;color:#fb7185;font-size:12px;font-weight:bold;margin-bottom:10px;">AQARI GLOBAL TERMINAL</div><h2 style="margin:0 0 12px;color:#fff;">Your ${prevName} expired on ${params.expiredDateFormatted}</h2><p style="color:#d4d4d8;font-size:14px;line-height:1.6;">Hi ${params.name}, ${creditNote}</p><a href="${renewUrl}" style="display:inline-block;margin-top:16px;padding:12px 22px;background:#D4AF37;color:#000;font-weight:bold;text-decoration:none;border-radius:10px;">Renew Plan &rarr;</a></div></body></html>`;
  return { subject, text, html };
}

function verifyCronAuth(req: any): boolean {
  const cronSecret = cleanEnvValue(getEnv('CRON_SECRET'));
  if (!cronSecret) return false;
  const rawAuth = String(req?.headers?.authorization || req?.headers?.Authorization || '');
  if (!rawAuth.startsWith('Bearer ')) return false;
  const token = rawAuth.slice(7).trim();
  if (!token) return false;
  try {
    const a = Buffer.from(token, 'utf8');
    const b = Buffer.from(cronSecret, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
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

  if (!hasResendKey) {
    await appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: 'failed',
      provider: 'resend',
      error: 'Email service not configured',
      has_resend_key: false,
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
    await appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: res.ok ? 'sent' : 'failed',
      provider: 'resend',
      has_resend_key: true,
      resend_status: res.status,
    });
    return { success: res.ok };
  } catch {
    await appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: 'failed',
      provider: 'resend',
      error: 'Network error',
      has_resend_key: true,
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
    res?.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!verifyCronAuth(req)) {
      const adminAuth = await requireAdmin(req);
      if (!adminAuth.ok) {
        return res.status(401).json({ success: false, error: 'unauthorized' });
      }
    }

    const now = Date.now();
    const force = req?.query?.force === 'true' || req?.body?.force === true;
    const users = await getAllServerUsersFromDb();

    let downgradedToFree = 0;
    let expiredEmailsSent = 0;
    let day29EmailsSent = 0;

    for (const u of users) {
      const planKey = normalizePlanKey(u?.plan);
      if (planKey === 'free' || !u?.license_end) continue;

      if (now >= u.license_end) {
        const previousPlan = planKey;
        const shouldSendExpired = !u.expired_email_sent;
        const preservedCredits = Math.max(0, Number(u.extra_credits || 0));
        const expD = new Date(u.license_end);
        const expiredDateFormatted = `${String(expD.getUTCDate()).padStart(2, '0')}/${String(expD.getUTCMonth() + 1).padStart(2, '0')}/${expD.getUTCFullYear()}`;
        u.status = 'expired';
        u.analyses_left = preservedCredits;
        u.expired_email_sent = true;
        u.updated_at = now;
        await saveUserToDb(u);
        downgradedToFree++;

        if (shouldSendExpired) {
          const mail = buildExpiredEmail({
            name: u.name || u.email.split('@')[0],
            previousPlan,
            expiredDateFormatted,
            extraCredits: preservedCredits,
          });
          await dispatchEmail({
            to: u.email,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            type: 'plan_expired',
          });
          expiredEmailsSent++;
        }
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
          ? Math.max(0, limit - Math.max(0, Number(u.analyses_used || 0))) + Math.max(0, Number(u.extra_credits || 0))
          : 'Unlimited';

        const expD = new Date(u.license_end);
        const formattedEnd = `${String(expD.getUTCDate()).padStart(2, '0')}/${String(expD.getUTCMonth() + 1).padStart(2, '0')}/${expD.getUTCFullYear()}`;

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
        await saveUserToDb(u);
        day29EmailsSent++;
      }
    }

    return res.status(200).json({
      success: true,
      checkedAt: new Date(now).toISOString(),
      processedUsers: users.length,
      downgradedToFree,
      expiredEmailsSent,
      day29EmailsSent,
    });
  } catch (error: any) {
    console.error('/api/cron/check-expiry error:', error);
    if (error?.name === 'StorageUnavailableError') {
      return res.status(500).json({ success: false, error: 'storage unavailable' });
    }
    const isProd = getEnv('VERCEL_ENV') === 'production' || getEnv('NODE_ENV') === 'production';
    return res.status(500).json({
      success: false,
      error: isProd ? 'internal error' : error?.message || 'Cron execution failed',
    });
  }
}
