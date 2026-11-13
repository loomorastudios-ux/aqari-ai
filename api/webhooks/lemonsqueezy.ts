// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import { PLANS, PlanKey, normalizePlanKey } from '../../lib/plans';
import { getClientIp } from '../../lib/security';
import {
  activatePaidPlanOnServer,
  appendWebhookLog,
  recordFailedWebhook,
  updateServerUser,
} from '../../lib/serverStore';

/**
 * Lemon Squeezy Official Webhook Handler
 * Endpoint: https://aqari-ai-rho.vercel.app/api/webhooks/lemonsqueezy
 * Strictly enforces HMAC-SHA256 signature verification on EVERY webhook.
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret =
    process.env.LEMON_WEBHOOK_SECRET || process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';
  const ip = getClientIp(req);

  try {
    // 1. Mandatory Signature Verification
    const signature = (req.headers?.['x-signature'] || req.headers?.['X-Signature'] || '').toString().trim();

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

    let planCode: PlanKey = normalizePlanKey(customData?.plan || payload?.plan);
    const lowerProduct = productName.toLowerCase();
    if (
      lowerProduct.includes('starter') ||
      lowerProduct.includes('standard') ||
      lowerProduct.includes('50') ||
      lowerProduct.includes('89')
    ) {
      planCode = 'starter';
    } else if (
      lowerProduct.includes('enterprise') ||
      lowerProduct.includes('sovereign') ||
      lowerProduct.includes('agency') ||
      lowerProduct.includes('749')
    ) {
      planCode = 'enterprise';
    } else if (
      lowerProduct.includes('pro') ||
      lowerProduct.includes('professional') ||
      lowerProduct.includes('249')
    ) {
      planCode = 'pro';
    }

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

    const rawTotal =
      attributes?.total ??
      attributes?.subtotal ??
      (PLANS[planCode]?.priceUSD ? PLANS[planCode].priceUSD * 100 : 0);
    const amountUSD =
      Number(rawTotal) > 1000
        ? Number(rawTotal) / 100
        : Number(rawTotal || PLANS[planCode]?.priceUSD || 0);
    const currency = (attributes?.currency || 'USD').toString().toUpperCase();

    const paymentDateStr =
      attributes?.created_at || attributes?.order_date || new Date().toISOString();
    const paymentTimestamp = new Date(paymentDateStr).getTime();
    const duration30Days = 30 * 24 * 60 * 60 * 1000;
    const subscriptionEndsAt = paymentTimestamp + duration30Days;

    let subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'past_due' = 'active';
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
            plan: planCode === 'free' ? 'pro' : planCode,
            paymentTimestamp,
            orderId,
            amountUSD,
            currency,
            testMode: isTestMode,
            refundPolicyAcceptedAt: customData?.refund_accepted_at || new Date(paymentTimestamp).toISOString(),
          });
        }
        break;

      case 'subscription_cancelled':
        subscriptionStatus = 'cancelled';
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
      license_end: subscriptionEndsAt,
      subscriptionEndsAt,
      analyses_used: persistedUser?.analyses_used ?? 0,
      expiryDateFormatted: new Date(subscriptionEndsAt).toISOString().slice(0, 10),
      log: logEntry,
    });
  } catch (error: any) {
    console.error('Error processing Lemon Squeezy webhook:', error);
    return res.status(500).json({ error: error?.message || 'Webhook processing failed' });
  }
}
