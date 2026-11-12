import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Lemon Squeezy Real Checkout Creation Endpoint
 * POST /api/checkout
 *
 * Uses LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID from environment variables
 * Creates official checkout session or returns verified hosted URL
 */

const VARIANT_IDS: Record<'starter' | 'pro' | 'enterprise', string> = {
  starter: 'da826632-dcb4-4885-966e-aac1fab84cb3',
  pro: '404c54cb-29c5-477a-b8c2-772092f5459a',
  enterprise: 'ce8dfbdb-cedd-4445-a947-e821522472bb',
};

const BUY_URLS: Record<'starter' | 'pro' | 'enterprise', string> = {
  starter: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/da826632-dcb4-4885-966e-aac1fab84cb3',
  pro: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/404c54cb-29c5-477a-b8c2-772092f5459a',
  enterprise: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/ce8dfbdb-cedd-4445-a947-e821522472bb',
};

const SUCCESS_REDIRECT = 'https://aqari-e4ku9f7u3-aqari2.vercel.app/payment-success';
const CANCEL_REDIRECT = 'https://aqari-e4ku9f7u3-aqari2.vercel.app/pricing';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, email, userId } = req.body || {};
    const validPlan = (plan === 'starter' || plan === 'pro' || plan === 'enterprise') ? plan : 'pro';
    const variantId = VARIANT_IDS[validPlan as 'starter' | 'pro' | 'enterprise'];
    const buyBaseUrl = BUY_URLS[validPlan as 'starter' | 'pro' | 'enterprise'];

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    // If Lemon Squeezy API credentials are set, call the official Checkouts API
    if (apiKey && storeId) {
      try {
        const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'application/vnd.api+json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            data: {
              type: 'checkouts',
              attributes: {
                checkout_data: {
                  email: email || undefined,
                  custom: {
                    user_id: userId || 'anonymous',
                    plan: validPlan,
                  },
                },
                product_options: {
                  redirect_url: `${SUCCESS_REDIRECT}?plan=${validPlan}&email=${encodeURIComponent(email || '')}`,
                  receipt_button_text: 'Open Aqari Terminal',
                },
              },
              relationships: {
                store: {
                  data: {
                    type: 'stores',
                    id: storeId.toString(),
                  },
                },
                variant: {
                  data: {
                    type: 'variants',
                    id: variantId,
                  },
                },
              },
            },
          }),
        });

        if (response.ok) {
          const json = await response.json();
          const checkoutUrl = json?.data?.attributes?.url;
          if (checkoutUrl) {
            return res.status(200).json({ url: checkoutUrl, success: true });
          }
        }
      } catch (apiErr) {
        console.warn('Lemon Squeezy API call error, falling back to direct hosted checkout:', apiErr);
      }
    }

    // Direct Hosted Lemon Squeezy Checkout URL with parameters
    const params = new URLSearchParams();
    if (email) params.set('checkout[email]', email);
    if (userId) params.set('checkout[custom][user_id]', userId);
    params.set('checkout[custom][plan]', validPlan);
    params.set('checkout[redirect_url]', `${SUCCESS_REDIRECT}?plan=${validPlan}&email=${encodeURIComponent(email || '')}`);
    params.set('checkout[cancel_url]', CANCEL_REDIRECT);

    const directUrl = `${buyBaseUrl}?${params.toString()}`;
    return res.status(200).json({ url: directUrl, success: true });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to initialize checkout' });
  }
}
