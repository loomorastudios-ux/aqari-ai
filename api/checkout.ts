import { findPlanPricing } from '../lib/plans';
import { getPricingPublicPayload, recordPendingCheckout } from '../lib/serverStore';

/**
 * Lemon Squeezy Real & Test Checkout Creation Endpoint
 * POST /api/checkout
 *
 * Dynamically uses Launch Price when launchDiscountActive=true,
 * or Original Price when admin toggles Launch Discount OFF in /admin.
 * Forces exact production success_url & cancel_url (no preview URLs).
 */

const VARIANT_IDS: Record<'starter' | 'pro' | 'enterprise', string> = {
  starter: process.env.LEMON_STARTER_VARIANT_ID || 'da826632-dcb4-4885-966e-aac1fab84cb3',
  pro: process.env.LEMON_PRO_VARIANT_ID || '404c54cb-29c5-477a-b8c2-772092f5459a',
  enterprise: process.env.LEMON_SOVEREIGN_VARIANT_ID || 'ce8dfbdb-cedd-4445-a947-e821522472bb',
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
    const validPlan: 'starter' | 'pro' | 'enterprise' =
      plan === 'starter' || plan === 'pro' || plan === 'enterprise' ? plan : 'pro';
    const variantId = VARIANT_IDS[validPlan];
    const buyBaseUrl = BUY_URLS[validPlan];

    // Single Source of Truth from dynamic pricing store
    const pricing = getPricingPublicPayload();
    const planPricing = findPlanPricing(pricing, validPlan)!;
    const isLaunchPrice = Boolean(pricing.launchDiscountActive);
    const activePriceUSD = isLaunchPrice ? planPricing.launchPrice : planPricing.originalPrice;
    const customPriceCents = Math.max(100, Math.round(activePriceUSD * 100));

    const isTestMode =
      process.env.LEMON_TEST_MODE === 'true' || process.env.VITE_LEMON_TEST_MODE === 'true';
    const apiKey = isTestMode
      ? process.env.LEMON_TEST_API_KEY || process.env.LEMON_API_KEY || process.env.LEMONSQUEEZY_API_KEY
      : process.env.LEMON_API_KEY || process.env.LEMONSQUEEZY_API_KEY;
    const storeId = isTestMode
      ? process.env.LEMON_TEST_STORE_ID || process.env.LEMON_STORE_ID || process.env.LEMONSQUEEZY_STORE_ID
      : process.env.LEMON_STORE_ID || process.env.LEMONSQUEEZY_STORE_ID;

    // Record pending checkout intent so /api/checkout/verify can reconcile exact URL return
    if (email) {
      recordPendingCheckout({
        email,
        plan: validPlan,
        amountUSD: activePriceUSD,
        isLaunchPrice,
        testMode: isTestMode,
        createdAt: Date.now(),
      });
    }

    // If Lemon Squeezy API credentials are set, call the official Checkouts API with custom_price
    if (apiKey && storeId) {
      const createLemonCheckout = async (includeCustomPrice: boolean) => {
        const attributes: any = {
          test_mode: isTestMode,
          checkout_data: {
            email: email || undefined,
            custom: {
              user_id: userId || 'anonymous',
              plan: validPlan,
              charged_price_usd: String(activePriceUSD),
              is_launch_price: isLaunchPrice ? 'true' : 'false',
              launch_price_locked: isLaunchPrice ? String(activePriceUSD) : '',
              test_mode: isTestMode ? 'true' : 'false',
              refund_accepted_at: refundAcceptedAt || new Date().toISOString(),
            },
          },
          product_options: {
            redirect_url: SUCCESS_REDIRECT,
            receipt_button_text: 'Go to My Terminal',
          },
        };
        if (includeCustomPrice) {
          attributes.custom_price = customPriceCents;
        }

        return fetch('https://api.lemonsqueezy.com/v1/checkouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'application/vnd.api+json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            data: {
              type: 'checkouts',
              attributes,
              relationships: {
                store: { data: { type: 'stores', id: storeId.toString() } },
                variant: { data: { type: 'variants', id: variantId } },
              },
            },
          }),
        });
      };

      try {
        let response = await createLemonCheckout(true);
        if (!response.ok) {
          response = await createLemonCheckout(false);
        }

        if (response.ok) {
          const json = await response.json();
          const checkoutUrl = json?.data?.attributes?.url;
          const checkoutId = json?.data?.id ? String(json.data.id) : undefined;
          if (checkoutUrl) {
            if (email) {
              recordPendingCheckout({
                email,
                plan: validPlan,
                amountUSD: activePriceUSD,
                isLaunchPrice,
                testMode: isTestMode,
                createdAt: Date.now(),
                checkoutId,
              });
            }
            const duration = Date.now() - startTime;
            console.log(
              `[Aqari Checkout] Generated in ${duration}ms, Plan: ${validPlan}, Price: $${activePriceUSD} (launch=${isLaunchPrice}), Test Mode: ${isTestMode}`
            );
            return res.status(200).json({
              url: checkoutUrl,
              checkoutId,
              success_url: SUCCESS_REDIRECT,
              cancel_url: CANCEL_REDIRECT,
              success: true,
              testMode: isTestMode,
              durationMs: duration,
              plan: validPlan,
              activePriceUSD,
              originalPrice: planPricing.originalPrice,
              launchPrice: planPricing.launchPrice,
              isLaunchPrice,
            });
          }
        }
      } catch (apiErr) {
        console.warn('Lemon Squeezy API call error, falling back to direct hosted checkout:', apiErr);
      }
    }

    // Direct Hosted Lemon Squeezy Checkout URL with exact production redirect URLs
    const params = new URLSearchParams();
    if (email) params.set('checkout[email]', email);
    if (userId) params.set('checkout[custom][user_id]', userId);
    params.set('checkout[custom][plan]', validPlan);
    params.set('checkout[custom][charged_price_usd]', String(activePriceUSD));
    params.set('checkout[custom][is_launch_price]', isLaunchPrice ? 'true' : 'false');
    if (isLaunchPrice) {
      params.set('checkout[custom][launch_price_locked]', String(activePriceUSD));
    }
    params.set('checkout[custom][refund_accepted_at]', refundAcceptedAt || new Date().toISOString());
    if (isTestMode) {
      params.set('checkout[test_mode]', '1');
      params.set('checkout[custom][test_mode]', 'true');
    }
    params.set('checkout[redirect_url]', SUCCESS_REDIRECT);
    params.set('checkout[cancel_url]', CANCEL_REDIRECT);

    const directUrl = `${buyBaseUrl}?${params.toString()}`;
    const duration = Date.now() - startTime;
    console.log(
      `[Aqari Checkout] Direct URL created in ${duration}ms, Plan: ${validPlan}, Price: $${activePriceUSD} (launch=${isLaunchPrice}), Test Mode: ${isTestMode}`
    );

    return res.status(200).json({
      url: directUrl,
      success_url: SUCCESS_REDIRECT,
      cancel_url: CANCEL_REDIRECT,
      success: true,
      testMode: isTestMode,
      durationMs: duration,
      plan: validPlan,
      activePriceUSD,
      originalPrice: planPricing.originalPrice,
      launchPrice: planPricing.launchPrice,
      isLaunchPrice,
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to initialize checkout' });
  }
}
