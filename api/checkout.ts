import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Lemon Squeezy Real & Test Checkout Creation Endpoint
 * POST /api/checkout
 *
 * Supports LEMON_TEST_MODE=true / false
 * Returns checkout URL with test credentials or live credentials
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

const SUCCESS_REDIRECT = 'https://aqari-ai-rho.vercel.app/app?checkout=success';
const CANCEL_REDIRECT = 'https://aqari-ai-rho.vercel.app/pricing?checkout=cancelled';

export default async function handler(req: any, res: any) {
  const startTime = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, email, userId, refundAcceptedAt } = req.body || {};
    const validPlan = (plan === 'starter' || plan === 'pro' || plan === 'enterprise') ? plan : 'pro';
    const variantId = VARIANT_IDS[validPlan as 'starter' | 'pro' | 'enterprise'];
    const buyBaseUrl = BUY_URLS[validPlan as 'starter' | 'pro' | 'enterprise'];

    const isTestMode = process.env.LEMON_TEST_MODE === 'true' || process.env.VITE_LEMON_TEST_MODE === 'true';
    const apiKey = isTestMode ? (process.env.LEMON_TEST_API_KEY || process.env.LEMONSQUEEZY_API_KEY) : process.env.LEMONSQUEEZY_API_KEY;
    const storeId = isTestMode ? (process.env.LEMON_TEST_STORE_ID || process.env.LEMONSQUEEZY_STORE_ID) : process.env.LEMONSQUEEZY_STORE_ID;

    const redirectWithParams = `${SUCCESS_REDIRECT}&plan=${validPlan}&email=${encodeURIComponent(email || '')}&test_mode=${isTestMode ? '1' : '0'}`;

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
                test_mode: isTestMode,
                checkout_data: {
                  email: email || undefined,
                  custom: {
                    user_id: userId || 'anonymous',
                    plan: validPlan,
                    test_mode: isTestMode ? 'true' : 'false',
                    refund_accepted_at: refundAcceptedAt || new Date().toISOString(),
                  },
                },
                product_options: {
                  redirect_url: redirectWithParams,
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
            const duration = Date.now() - startTime;
            console.log(`[Aqari Checkout] Generated in ${duration}ms, Test Mode: ${isTestMode}`);
            return res.status(200).json({ 
              url: checkoutUrl, 
              success: true, 
              testMode: isTestMode, 
              durationMs: duration 
            });
          }
        }
      } catch (apiErr) {
        console.warn('Lemon Squeezy API call error, falling back to direct hosted checkout:', apiErr);
      }
    }

    // Direct Hosted Lemon Squeezy Checkout URL with prefilled parameters
    const params = new URLSearchParams();
    if (email) params.set('checkout[email]', email);
    if (userId) params.set('checkout[custom][user_id]', userId);
    params.set('checkout[custom][plan]', validPlan);
    params.set('checkout[custom][refund_accepted_at]', refundAcceptedAt || new Date().toISOString());
    if (isTestMode) {
      params.set('checkout[test_mode]', '1');
      params.set('checkout[custom][test_mode]', 'true');
    }
    params.set('checkout[redirect_url]', redirectWithParams);
    params.set('checkout[cancel_url]', CANCEL_REDIRECT);

    const directUrl = `${buyBaseUrl}?${params.toString()}`;
    const duration = Date.now() - startTime;
    console.log(`[Aqari Checkout] Direct URL created in ${duration}ms, Test Mode: ${isTestMode}`);

    return res.status(200).json({ 
      url: directUrl, 
      success: true, 
      testMode: isTestMode, 
      durationMs: duration 
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to initialize checkout' });
  }
}
