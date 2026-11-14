import { PlanKey, PLANS, PRODUCTION_URL } from './plans';
import { appendEmailLog } from './serverStore';

export const EMAIL_FROM = 'AQARI Terminal <onboarding@resend.dev>';
export const EMAIL_FROM_ADDRESS = 'onboarding@resend.dev';

export interface EmailSendResult {
  success: boolean;
  provider: 'resend' | 'nodemailer' | 'log';
  status: 'sent' | 'failed' | 'simulated';
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  has_resend_key: boolean;
  key_prefix: string;
  resend_status?: number;
  resend_id?: string;
  error?: string;
}

export function buildDay29RenewalEmail(params: {
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

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#070709;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#0b0b0f;border:1px solid #26262e;border-radius:16px;">
      <div style="font-family:monospace;color:#D4AF37;font-size:12px;letter-spacing:1.5px;font-weight:bold;margin-bottom:12px;">
        AQARI GLOBAL TERMINAL • 30-DAY LICENSING NOTICE
      </div>
      <h1 style="font-size:22px;margin:0 0 16px;color:#ffffff;">
        Your AQARI ${planName} ends tomorrow
      </h1>
      <p style="font-size:15px;line-height:1.6;color:#d4d4d8;margin:0 0 16px;">
        Hi <strong>${params.name}</strong>, your <strong>${planName}</strong> ends tomorrow (<strong>${params.endDateFormatted}</strong>). You have <strong>${leftText}</strong> analyses left.
      </p>
      <div style="margin:24px 0;display:flex;gap:12px;flex-wrap:wrap;">
        <a href="${renewUrl}" style="display:inline-block;padding:12px 22px;background:#D4AF37;color:#000000;font-weight:800;font-family:monospace;text-decoration:none;border-radius:10px;font-size:13px;">
          Renew ${planName} in 1 Click &rarr;
        </a>
        <a href="${renewUrl}" style="display:inline-block;padding:12px 20px;background:#18181b;color:#D4AF37;border:1px solid #D4AF37;font-weight:700;font-family:monospace;text-decoration:none;border-radius:10px;font-size:13px;">
          Upgrade: Professional / Sovereign
        </a>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#a1a1aa;margin:16px 0 0;border-top:1px solid #27272a;padding-top:16px;">
        If you don't renew, you will return to <strong>FREE (3 analyses)</strong>.
      </p>
    </div>
  </body>
</html>`.trim();

  return { subject, text, html };
}

export function buildExpiredEmail(params: { name: string; previousPlan: PlanKey }) {
  const prevName = PLANS[params.previousPlan]?.displayName || 'STARTER';
  const renewUrl = `${PRODUCTION_URL}/pricing`;
  const subject = `Your AQARI ${prevName} plan expired`;
  const text = `Hi ${params.name},\n\nYour AQARI ${prevName} licensing window has expired. Your account has returned to FREE (3 analyses).\n\nRenew anytime to restore institutional access: ${renewUrl}\n\nAQARI Global Terminal`;
  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#070709;color:#ffffff;font-family:sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#0b0b0f;border:1px solid #26262e;border-radius:16px;">
      <div style="font-family:monospace;color:#fb7185;font-size:12px;font-weight:bold;margin-bottom:10px;">AQARI GLOBAL TERMINAL</div>
      <h2 style="margin:0 0 12px;color:#fff;">Your AQARI ${prevName} plan expired</h2>
      <p style="color:#d4d4d8;font-size:14px;line-height:1.6;">
        Hi ${params.name}, your 30-day licensing window has ended and your account has returned to <strong>FREE (3 analyses)</strong>.
      </p>
      <a href="${renewUrl}" style="display:inline-block;margin-top:16px;padding:12px 22px;background:#D4AF37;color:#000;font-weight:bold;text-decoration:none;border-radius:10px;">
        Renew Subscription &rarr;
      </a>
    </div>
  </body>
</html>`.trim();
  return { subject, text, html };
}

export async function dispatchEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: 'day29_renewal' | 'plan_expired' | 'test_day29';
}): Promise<EmailSendResult> {
  const resendKey = (process.env.RESEND_API_KEY || '').replace(/^["']|["']$/g, '').trim();
  const hasResendKey = Boolean(resendKey);
  const keyPrefix = hasResendKey ? resendKey.slice(0, 6) : 'MISSING';
  const fromHeader = EMAIL_FROM; // Always "AQARI Terminal <onboarding@resend.dev>" until domain verified

  console.log('[AQARI MAILER] Resend dispatch attempt:', {
    has_resend_key: hasResendKey,
    key_prefix: keyPrefix,
    from_email: fromHeader,
    to_email: params.to,
    type: params.type,
  });

  if (!hasResendKey) {
    const missingErr = 'RESEND_API_KEY missing in Vercel - Redeploy needed';
    appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: 'failed',
      provider: 'resend',
      error: missingErr,
      has_resend_key: false,
      key_prefix: 'MISSING',
      resend_status: 0,
    });
    return {
      success: false,
      provider: 'resend',
      status: 'failed',
      to: params.to,
      from: fromHeader,
      subject: params.subject,
      text: params.text,
      html: params.html,
      has_resend_key: false,
      key_prefix: 'MISSING',
      resend_status: 0,
      error: missingErr,
    };
  }

  // 1. Resend API (always uses onboarding@resend.dev so unverified custom domains never cause rejection)
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
          from: fromHeader,
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
    } catch {
      parsed = {};
    }

    if (res.ok) {
      appendEmailLog({
        to: params.to,
        from: EMAIL_FROM_ADDRESS,
        subject: params.subject,
        type: params.type,
        status: 'sent',
        provider: 'resend',
        has_resend_key: true,
        key_prefix: keyPrefix,
        resend_status: res.status,
      });
      return {
        success: true,
        provider: 'resend',
        status: 'sent',
        to: params.to,
        from: fromHeader,
        subject: params.subject,
        text: params.text,
        html: params.html,
        has_resend_key: true,
        key_prefix: keyPrefix,
        resend_status: res.status,
        resend_id: parsed?.id,
      };
    }

    const resendMessage =
      parsed?.message ||
      parsed?.error?.message ||
      parsed?.name ||
      rawText ||
      res.statusText ||
      'Resend rejected request';
    const formattedError = `${resendMessage} | status:${res.status} | has_key:${hasResendKey}`;
    console.error('[AQARI MAILER] Resend API rejected:', formattedError);

    appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: 'failed',
      provider: 'resend',
      error: formattedError,
      has_resend_key: true,
      key_prefix: keyPrefix,
      resend_status: res.status,
    });

    return {
      success: false,
      provider: 'resend',
      status: 'failed',
      to: params.to,
      from: fromHeader,
      subject: params.subject,
      text: params.text,
      html: params.html,
      has_resend_key: true,
      key_prefix: keyPrefix,
      resend_status: res.status,
      error: formattedError,
    };
  } catch (err: any) {
    const netError = `${err?.message || 'Resend network error'} | status:502 | has_key:${hasResendKey}`;
    console.error('[AQARI MAILER] Resend network error:', netError);
    appendEmailLog({
      to: params.to,
      from: EMAIL_FROM_ADDRESS,
      subject: params.subject,
      type: params.type,
      status: 'failed',
      provider: 'resend',
      error: netError,
      has_resend_key: true,
      key_prefix: keyPrefix,
      resend_status: 502,
    });
    return {
      success: false,
      provider: 'resend',
      status: 'failed',
      to: params.to,
      from: fromHeader,
      subject: params.subject,
      text: params.text,
      html: params.html,
      has_resend_key: true,
      key_prefix: keyPrefix,
      resend_status: 502,
      error: netError,
    };
  }
}
