// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import { PLANS, PlanKey, findPlanPricing, normalizePlanKey } from '../../lib/plans';
import { getClientIp } from '../../lib/security';
import {
  activatePaidPlanOnServer,
  appendWebhookLog,
  getPricingPublicPayload,
  recordFailedWebhook,
  recordOrderRefunded,
  recordSubscriptionUpdated,
  updateServerUser,
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
    process.env.LEMON_WEBHOOK_SECRET || process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';
  const ip = getClientIp(req);

  try {
    // 1. Mandatory Signature Verification
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

    if (!webhookSecret) {
      recordFailedWebhook('Webhook secret not configured on server', ip);
      return res.status(401).json({ error: 'Webhook verification failed: missing secret configuration' });
    }

    if (!signature) {
      recordFailedWebhook('Missing X-Signature header', ip);
      return res.status(401).json({ error: 'Invalid webhook signature: missing X-Signature' });
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
      console.warn('Lemon Squeezy Webhook: Invalid signature rejected from', ip);
      recordFailedWebhook('Invalid X-Signature HMAC mismatch', ip);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const eventName = payload?.meta?.event_name || payload?.event_name || 'order_created';
    const customData = payload?.meta?.custom_data || {};
    const attributes = payload?.data?.attributes || {};

    const customerEmail = (
      attributes?.user_email ||
      attributes?.customer_email ||
      customData?.email ||
      payload?.email ||
      ''
    )
      .toLowerCase()
      .trim();

    const customerName =
      attributes?.user_name || attributes?.customer_name || customerEmail.split('@')[0];
    const productName = (
      attributes?.first_order_item?.product_name ||
      attributes?.product_name ||
      customData?.plan ||
      payload?.plan ||
      'Aqari AI - Pro'
    ).toString();

    const planCode = mapVariantOrProductToPlan(attributes, customData, payload);

    const orderId = (
      payload?.data?.id ||
      attributes?.order_id ||
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

    const paymentDateStr =
      attributes?.created_at || attributes?.order_date || new Date().toISOString();
    const paymentTimestamp = new Date(paymentDateStr).getTime();
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

    switch (eventName) {
      case 'order_created':
      case 'subscription_created':
      case 'subscription_payment_success':
      case 'subscription_resumed':
        subscriptionStatus = 'active';
        if (customerEmail) {
          persistedUser = activatePaidPlanOnServer({
            email: customerEmail,
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
          });
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
        if (customerEmail) {
          persistedUser = recordSubscriptionUpdated({
            email: customerEmail,
            plan: planCode,
            licenseEndMs,
            status: subStatus,
          });
        }
        break;
      }

      case 'order_refunded':
        subscriptionStatus = 'refunded';
        if (customerEmail) {
          persistedUser = recordOrderRefunded({
            email: customerEmail,
            orderId,
            amountUSD,
          });
        }
        break;

      case 'subscription_cancelled':
        subscriptionStatus = 'cancelled';
        if (customerEmail) {
          const endsAtStr = attributes?.ends_at;
          persistedUser = updateServerUser(customerEmail, {
            license_end: endsAtStr ? new Date(endsAtStr).getTime() : undefined,
          });
        }
        break;

      case 'subscription_expired':
        subscriptionStatus = 'expired';
        if (customerEmail) {
          persistedUser = updateServerUser(customerEmail, {
            plan: 'free',
            analyses_used: 0,
          });
        }
        break;

      case 'subscription_payment_failed':
        subscriptionStatus = 'past_due';
        break;

      default:
        subscriptionStatus = 'active';
        break;
    }

    const logEntry = appendWebhookLog({
      order_id: orderId,
      event_name: eventName,
      plan: planCode,
      email: customerEmail || 'unknown',
      amount: amountUSD,
      currency,
      test_mode: isTestMode,
    });

    console.log(
      `[Lemon Webhook] event=${eventName} order_id=${orderId} email=${customerEmail || 'unknown'} plan=${planCode} amount=$${amountUSD} test_mode=${isTestMode}`
    );

    return res.status(200).json({
      success: true,
      eventName,
      order_id: orderId,
      test_mode: isTestMode,
      amount: amountUSD,
      currency,
      customerEmail,
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
      log: logEntry,
    });
  } catch (error: any) {
    console.error('Error processing Lemon Squeezy webhook:', error);
    return res.status(500).json({ error: error?.message || 'Webhook processing failed' });
  }
}
