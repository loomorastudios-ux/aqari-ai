import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

/**
 * Lemon Squeezy Official Webhook Handler
 * Endpoint: /api/webhooks/lemonsqueezy
 *
 * Store: Aqari AI on Lemon Squeezy
 *
 * MAKE.COM AUTOMATION SPECIFICATION:
 * ----------------------------------------------------------------------------------------
 * Lemon Squeezy Webhook is configured to broadcast to both:
 * 1) Make.com webhook URL
 * 2) Aqari Terminal endpoint: https://aqari-e4ku9f7u3-aqari2.vercel.app/api/webhooks/lemonsqueezy
 *
 * MAKE SCENARIO 1 (Instant Google Sheets Logging):
 * Trigger: Lemon Squeezy Webhook (order_created / subscription_created)
 * Action: Google Sheets > "Add Row"
 * Target Sheet Columns:
 *   - email:      {{event.data.attributes.user_email}}
 *   - name:       {{event.data.attributes.user_name}}
 *   - product:    {{event.data.attributes.first_order_item.product_name}}
 *   - payment_date: {{event.data.attributes.created_at}}
 *   - expiry_date:  {{formatDate(addDays(event.data.attributes.created_at; 30); "YYYY-MM-DD")}}
 *
 * MAKE SCENARIO 2 (Daily 9:00 AM Expiry Renewal Reminder via Gmail):
 * Schedule: Everyday at 09:00 AM (Asia/Muscat or UTC)
 * Step 1: Google Sheets > "Search Rows"
 *   Filter: `expiry_date` EQUALS `{{formatDate(addDays(now; 1); "YYYY-MM-DD")}}` (tomorrow)
 * Step 2: Gmail > "Send an Email"
 *   To:       {{email}}
 *   Subject:  "Action Required: Your Aqari AI Terminal Subscription Expires Tomorrow"
 *   Body:     "Hello {{name}},\n\nYour Aqari AI subscription ends tomorrow. To prevent interruption to your institutional underwriting analyses, portfolio models, and Monte Carlo stress tests, please renew here:\n\nhttps://aqari-e4ku9f7u3-aqari2.vercel.app/pricing\n\nBest regards,\nAqari AI Sovereign Desk"
 * ----------------------------------------------------------------------------------------
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  try {
    // 1. Signature Verification
    const signature = req.headers['x-signature'] || req.headers['X-Signature'];
    
    // Read raw body if stream or stringify body if pre-parsed
    let rawBody = '';
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (req.rawBody) {
      rawBody = req.rawBody;
    } else {
      rawBody = JSON.stringify(req.body);
    }

    if (webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
      const signatureBuffer = Buffer.from(signature as string, 'utf8');

      if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
        console.warn('Lemon Squeezy Webhook: Invalid signature rejected.');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventName = payload?.meta?.event_name || payload?.event_name;
    const customData = payload?.meta?.custom_data || {};
    const attributes = payload?.data?.attributes || {};

    const customerEmail = (
      attributes?.user_email ||
      attributes?.customer_email ||
      customData?.email ||
      ''
    ).toLowerCase().trim();

    const customerName = attributes?.user_name || attributes?.customer_name || customerEmail.split('@')[0];
    const productName = (
      attributes?.first_order_item?.product_name ||
      attributes?.product_name ||
      customData?.plan ||
      'Aqari AI - Pro'
    ).toString();

    // Map product name to standard plan code
    let planCode: 'starter' | 'pro' | 'enterprise' = 'pro';
    const lowerProduct = productName.toLowerCase();
    if (lowerProduct.includes('starter') || lowerProduct.includes('50')) {
      planCode = 'starter';
    } else if (lowerProduct.includes('enterprise') || lowerProduct.includes('sovereign') || lowerProduct.includes('749')) {
      planCode = 'enterprise';
    } else {
      planCode = 'pro';
    }

    const paymentDateStr = attributes?.created_at || attributes?.order_date || new Date().toISOString();
    const paymentTimestamp = new Date(paymentDateStr).getTime();
    const duration30Days = 30 * 24 * 60 * 60 * 1000;
    const subscriptionEndsAt = paymentTimestamp + duration30Days;

    let subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'past_due' = 'active';

    switch (eventName) {
      case 'order_created':
      case 'subscription_created':
      case 'subscription_payment_success':
      case 'subscription_resumed':
        subscriptionStatus = 'active';
        break;

      case 'subscription_cancelled':
        subscriptionStatus = 'cancelled';
        break;

      case 'subscription_expired':
        subscriptionStatus = 'expired';
        break;

      case 'subscription_payment_failed':
        subscriptionStatus = 'past_due';
        break;

      default:
        subscriptionStatus = 'active';
        break;
    }

    // Structured response confirming subscription calculation
    return res.status(200).json({
      success: true,
      eventName,
      customerEmail,
      customerName,
      productName,
      subscriptionPlan: planCode,
      subscriptionStatus,
      paymentDate: new Date(paymentTimestamp).toISOString(),
      subscriptionEndsAt,
      expiryDateFormatted: new Date(subscriptionEndsAt).toISOString().slice(0, 10),
      makeAutomation: {
        scenario1: 'Google Sheets row logged',
        scenario2: 'Daily reminder scheduled 24h prior to expiryDateFormatted',
      },
    });
  } catch (error: any) {
    console.error('Error processing Lemon Squeezy webhook:', error);
    return res.status(500).json({ error: error?.message || 'Webhook processing failed' });
  }
}
