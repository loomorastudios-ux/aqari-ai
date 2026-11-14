// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import { PLANS, PlanKey, findPlanPricing, normalizePlanKey } from '../../lib/plans';
import { cleanEnvValue, getClientIp } from '../../lib/security';
import {
  WebhookLogEntry,
  activatePaidPlanOnServer,
  appendWebhookLogToDb,
  getPricingPublicPayload,
  recordFailedWebhook,
  recordOrderRefunded,
  recordSubscriptionUpdated,
  saveUserToDb,
  updateServerUser,
  updateWebhookLogInDb,
} from '../../lib/serverStore';

/**
 * Lemon Squeezy Official Webhook Handler
 * Endpoint: https://aqari-ai-rho.vercel.app/api/webhooks/lemonsqueezy
 * Handles all 6 events:
 *   - order_created
 *   - order_refunded
 *   - subscription_created
 *   - subscription_updated
 *   - subscription_cancelled
 *   - subscription_expired
 * Strictly enforces HMAC-SHA256 signature verification on EVERY request.
 */

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

  if (variantId && process.env.LEMON_STARTER_VARIANT_ID && variantId === process.env.LEMON_STARTER_VARIANT_ID) return 'starter';
  if (variantId && process.env.LEMON_PRO_VARIANT_ID && variantId === process.env.LEMON_PRO_VARIANT_ID) return 'pro';
  if (variantId && process.env.LEMON_SOVEREIGN_VARIANT_ID && variantId === process.env.LEMON_SOVEREIGN_VARIANT_ID) return 'enterprise';
  if (productId && process.env.LEMON_STARTER_PRODUCT_ID && productId === process.env.LEMON_STARTER_PRODUCT_ID) return 'starter';
  if (productId && process.env.LEMON_PRO_PRODUCT_ID && productId === process.env.LEMON_PRO_PRODUCT_ID) return 'pro';
  if (productId && process.env.LEMON_SOVEREIGN_PRODUCT_ID && productId === process.env.LEMON_SOVEREIGN_PRODUCT_ID) return 'enterprise';
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
    productName.includes('starter') ||
    productName.includes('standard') ||
    productName.includes('79') ||
    productName.includes('129')
  ) {
    return 'starter';
  }
  if (
    productName.includes('enterprise') ||
    productName.includes('sovereign') ||
    productName.includes('agency') ||
    productName.includes('599') ||
    productName.includes('999')
  ) {
    return 'enterprise';
  }
  if (
    productName.includes('pro') ||
    productName.includes('professional') ||
    productName.includes('199') ||
    productName.includes('349')
  ) {
    return 'pro';
  }

  const normalized = normalizePlanKey(customData?.plan || payload?.plan);
  return normalized === 'free' ? 'pro' : normalized;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret =
    cleanEnvValue(process.env.LEMON_WEBHOOK_SECRET) ||
    cleanEnvValue(process.env.LEMONSQUEEZY_WEBHOOK_SECRET) ||
    '';
  const ip = getClientIp(req);

  let preLog: WebhookLogEntry | null = null;

  try {
    // 0. Parse body & metadata FIRST so EVERY request is logged BEFORE signature verification
    const signature = (req.headers?.['x-signature'] || req.headers?.['X-Signature'] || '')
      .toString()
      .trim();

    let rawBody = '';
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (req.rawBody) {
      rawBody = req.rawBody;
    } else {
      rawBody = JSON.stringify(req.body || {});
    }

    let payload: any = {};
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
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

    const customerEmail = (
      attributes?.user_email ||
      attributes?.customer_email ||
      customData?.email ||
      payload?.email ||
      ''
    )
      .toString()
      .toLowerCase()
      .trim();
    const accountEmail = (
      customData?.user_email ||
      customerEmail ||
      ''
    )
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
        process.env.LEMON_TEST_MODE === 'true'
    );

    const pricing = getPricingPublicPayload();
    const dynamicPlan = findPlanPricing(pricing, planCode);
    const fallbackPlanPrice =
      dynamicPlan?.activePrice ?? PLANS[planCode]?.launchPrice ?? 199;
    const rawTotal =
      attributes?.total ??
      attributes?.subtotal ??
      (fallbackPlanPrice ? fallbackPlanPrice * 100 : 0);
    const amountUSD =
      Number(rawTotal) > 1000
        ? Number(rawTotal) / 100
        : Number(rawTotal || fallbackPlanPrice || 0);
    const currency = (attributes?.currency || 'USD').toString().toUpperCase();

    // 1. MANDATORY PRE-VERIFICATION DB LOG (logs EVERY incoming webhook even if signature fails)
    try {
      preLog = await appendWebhookLogToDb({
        order_id: orderId,
        event: eventName,
        event_name: eventName,
        plan: planCode,
        email: customerEmail || accountEmail || 'unknown',
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

    // 2. Mandatory Signature Verification
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
      console.error('[Lemon Webhook]', rawError);
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
      console.error('[Lemon Webhook]', rawError, 'ip=', ip);
      return res.status(401).json({ error: 'Invalid webhook signature: missing X-Signature' });
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
      const rawError = 'Invalid X-Signature HMAC mismatch';
      console.warn('Lemon Squeezy Webhook: Invalid signature rejected from', ip);
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

    // Mark pre-logged entry as valid signature
    if (preLog) {
      await updateWebhookLogInDb(preLog.id, {
        signature_valid: true,
        raw_error: undefined,
        error: undefined,
      }).catch((e) => console.error('[Lemon Webhook] DB valid update failed:', e));
    }

    const customerName =
      attributes?.user_name || attributes?.customer_name || (customerEmail || accountEmail).split('@')[0];
    const productName = (
      attributes?.first_order_item?.product_name ||
      attributes?.product_name ||
      customData?.plan ||
      payload?.plan ||
      'Aqari AI - Pro'
    ).toString();

    const paymentDateStr =
      attributes?.created_at || attributes?.order_date || new Date().toISOString();
    const paymentTimestamp = new Date(paymentDateStr).getTime() || Date.now();
    const duration30Days = 30 * 24 * 60 * 60 * 1000;
    const subscriptionEndsAt = paymentTimestamp + duration30Days;

    const customLockedLaunch = Number(customData?.launch_price_locked || 0);
    const lockedLaunchPrice =
      customLockedLaunch > 0
        ? customLockedLaunch
        : customData?.is_launch_price === 'true' || pricing.launchDiscountActive
        ? amountUSD
        : null;

    let subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'refunded' | 'past_due' = 'active';
    let persistedUser = null;
    const targetEmail = accountEmail || customerEmail;

    switch (eventName) {
      case 'order_created':
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
            lemonCustomerEmail: customerEmail || null,
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

      case 'order_refunded':
        subscriptionStatus = 'refunded';
        if (targetEmail) {
          persistedUser = recordOrderRefunded({
            email: targetEmail,
            orderId,
            amountUSD,
          });
          await saveUserToDb(persistedUser);
        }
        break;

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

    console.log(
      `[Lemon Webhook] event=${eventName} order_id=${orderId} email=${targetEmail || 'unknown'} plan=${planCode} amount=$${amountUSD} test_mode=${isTestMode} sig_valid=true`
    );

    return res.status(200).json({
      success: true,
      eventName,
      order_id: orderId,
      test_mode: isTestMode,
      amount: amountUSD,
      currency,
      customerEmail: customerEmail || targetEmail,
      customerName,
      productName,
      subscriptionPlan: planCode,
      displayPlan: PLANS[planCode]?.displayName || 'PROFESSIONAL',
      subscriptionStatus,
      paymentDate: new Date(paymentTimestamp).toISOString(),
      license_start: paymentTimestamp,
      license_end: persistedUser?.license_end ?? subscriptionEndsAt,
      subscriptionEndsAt: persistedUser?.license_end ?? subscriptionEndsAt,
      analyses_used: persistedUser?.analyses_used ?? 0,
      total_paid_usd: persistedUser?.total_paid_usd ?? amountUSD,
      expiryDateFormatted: new Date(persistedUser?.license_end ?? subscriptionEndsAt)
        .toISOString()
        .slice(0, 10),
      log: preLog ? { ...preLog, signature_valid: true, raw_error: undefined, error: undefined } : null,
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
    return res.status(500).json({ error: rawError });
  }
}
