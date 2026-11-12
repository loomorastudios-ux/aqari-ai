/**
 * Lemon Squeezy Webhook Handler
 * Endpoint: /api/webhook/lemonsqueezy
 *
 * Handles order_created, subscription_created, subscription_resumed, subscription_expired
 * Calculates subscriptionEndsAt = payment_date + 30 days
 * Sets subscriptionStatus = 'active' | 'expired'
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
    const eventName = event?.meta?.event_name || event?.event_name;
    const data = event?.data;
    const attributes = data?.attributes;

    const email = (
      attributes?.user_email ||
      attributes?.customer_email ||
      event?.meta?.custom_data?.email ||
      ''
    ).toLowerCase().trim();

    const createdAtStr = attributes?.created_at || attributes?.order_date || new Date().toISOString();
    const paymentTimestamp = new Date(createdAtStr).getTime();
    const duration30Days = 30 * 24 * 60 * 60 * 1000;
    const subscriptionEndsAt = paymentTimestamp + duration30Days;

    let subscriptionStatus: 'active' | 'expired' = 'active';

    if (eventName === 'subscription_expired' || eventName === 'subscription_cancelled') {
      subscriptionStatus = 'expired';
    } else {
      subscriptionStatus = 'active';
    }

    // Return structured subscription confirmation payload
    return res.status(200).json({
      received: true,
      email,
      eventName,
      subscriptionStatus,
      subscriptionEndsAt,
      paymentDate: new Date(paymentTimestamp).toISOString(),
      expiresAt: new Date(subscriptionEndsAt).toISOString(),
    });
  } catch (error: any) {
    console.error('Lemon Squeezy Webhook Error:', error);
    return res.status(500).json({ error: error?.message || 'Webhook processing failed' });
  }
}
