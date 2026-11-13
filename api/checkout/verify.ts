// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { PLANS, PlanKey, findPlanPricing, normalizePlanKey } from '../../lib/plans';
import { getSessionEmailFromReq, setSessionCookie } from '../../lib/security';
import {
  activatePaidPlanOnServer,
  appendWebhookLog,
  computeServerLicenseStatus,
  consumePendingCheckout,
  getOrCreateServerUser,
  getPricingPublicPayload,
} from '../../lib/serverStore';

/**
 * Post-Payment Verification Endpoint (Backup if webhook fails or is delayed)
 * GET /api/checkout/verify?order_id=... OR ?checkout_id=...
 * POST /api/checkout/verify
 */
const VARIANT_ID_TO_PLAN: Record<string, PlanKey> = {
  'da826632-dcb4-4885-966e-aac1fab84cb3': 'starter',
  '404c54cb-29c5-477a-b8c2-772092f5459a': 'pro',
  'ce8dfbdb-cedd-4445-a947-e821522472bb': 'enterprise',
};

function resolvePlanFromLemonAttributes(attrs: any, fallbackPlan?: PlanKey): PlanKey {
  const variantId = String(
    attrs?.first_order_item?.variant_id || attrs?.variant_id || ''
  ).trim();
  const productId = String(
    attrs?.first_order_item?.product_id || attrs?.product_id || ''
  ).trim();

  if (variantId && process.env.LEMON_STARTER_VARIANT_ID && variantId === process.env.LEMON_STARTER_VARIANT_ID) return 'starter';
  if (variantId && process.env.LEMON_PRO_VARIANT_ID && variantId === process.env.LEMON_PRO_VARIANT_ID) return 'pro';
  if (variantId && process.env.LEMON_SOVEREIGN_VARIANT_ID && variantId === process.env.LEMON_SOVEREIGN_VARIANT_ID) return 'enterprise';
  if (productId && process.env.LEMON_STARTER_PRODUCT_ID && productId === process.env.LEMON_STARTER_PRODUCT_ID) return 'starter';
  if (productId && process.env.LEMON_PRO_PRODUCT_ID && productId === process.env.LEMON_PRO_PRODUCT_ID) return 'pro';
  if (productId && process.env.LEMON_SOVEREIGN_PRODUCT_ID && productId === process.env.LEMON_SOVEREIGN_PRODUCT_ID) return 'enterprise';
  if (variantId && VARIANT_ID_TO_PLAN[variantId]) return VARIANT_ID_TO_PLAN[variantId];

  const s = `${attrs?.first_order_item?.product_name || ''} ${attrs?.first_order_item?.variant_name || ''} ${attrs?.product_name || ''} ${attrs?.variant_name || ''}`.toLowerCase();
  if (s.includes('sovereign') || s.includes('enterprise') || s.includes('agency') || s.includes('599') || s.includes('999')) {
    return 'enterprise';
  }
  if (s.includes('pro') || s.includes('professional') || s.includes('199') || s.includes('349')) {
    return 'pro';
  }
  if (s.includes('starter') || s.includes('standard') || s.includes('79') || s.includes('129')) {
    return 'starter';
  }
  return fallbackPlan && fallbackPlan !== 'free' ? fallbackPlan : 'pro';
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const src = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const sessionEmail = getSessionEmailFromReq(req);
    let email = (sessionEmail || src.email || '').toString().trim().toLowerCase();
    const sessionId = (src.session_id || src.checkout_id || '').toString().trim();
    const orderId = (src.order_id || src.order || '').toString().trim();
    const requestedPlan = normalizePlanKey(src.plan);
    const isTestEnv =
      process.env.LEMON_TEST_MODE === 'true' || process.env.VITE_LEMON_TEST_MODE === 'true';
    const isTestQuery = src.test_mode === '1' || src.test_mode === 'true' || src.test_mode === true;

    const apiKey = isTestEnv
      ? process.env.LEMON_TEST_API_KEY || process.env.LEMON_API_KEY || process.env.LEMONSQUEEZY_API_KEY
      : process.env.LEMON_API_KEY || process.env.LEMONSQUEEZY_API_KEY;

    const pricing = getPricingPublicPayload();
    const pending = consumePendingCheckout(email, sessionId);

    let verifiedPaid = false;
    let verifiedPlan: PlanKey =
      requestedPlan !== 'free'
        ? requestedPlan
        : pending?.plan && pending.plan !== 'free'
        ? pending.plan
        : 'pro';
    let verifiedOrderId = orderId || sessionId || `ord_${Date.now()}`;
    const dynamicDefaultPlan = findPlanPricing(pricing, verifiedPlan);
    let verifiedAmount =
      Number(src.charged_price) > 0
        ? Number(src.charged_price)
        : pending?.amountUSD || dynamicDefaultPlan?.activePrice || PLANS[verifiedPlan].launchPrice;
    let verifiedTestMode = isTestEnv || isTestQuery || Boolean(pending?.testMode);
    let verifiedLockedLaunch: number | null =
      Number(src.launch_locked) > 0
        ? Number(src.launch_locked)
        : pending?.isLaunchPrice || pricing.launchDiscountActive
        ? (dynamicDefaultPlan?.launchPrice ?? verifiedAmount)
        : null;

    // 1. Query Lemon Squeezy API directly (GET /v1/orders/{id}, checkout, or orders filter)
    if (apiKey) {
      try {
        if (orderId) {
          const orderRes = await fetch(
            `https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(orderId)}`,
            {
              headers: {
                Accept: 'application/vnd.api+json',
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );
          if (orderRes.ok) {
            const json = await orderRes.json();
            const attrs = json?.data?.attributes || {};
            if (!email && (attrs.user_email || attrs.customer_email)) {
              email = String(attrs.user_email || attrs.customer_email).trim().toLowerCase();
            }
            if (attrs.status === 'paid') {
              verifiedPaid = true;
              verifiedOrderId = String(json.data.id || orderId);
              verifiedPlan = resolvePlanFromLemonAttributes(attrs, verifiedPlan);
              const matchedDyn = findPlanPricing(pricing, verifiedPlan);
              verifiedAmount = attrs.total
                ? Number(attrs.total) / 100
                : matchedDyn?.activePrice ?? PLANS[verifiedPlan].launchPrice;
              verifiedTestMode = Boolean(attrs.test_mode);
              if (pricing.launchDiscountActive) {
                verifiedLockedLaunch = matchedDyn?.launchPrice ?? verifiedAmount;
              }
            }
          }
        }

        if (!verifiedPaid && sessionId) {
          const chkRes = await fetch(
            `https://api.lemonsqueezy.com/v1/checkouts/${encodeURIComponent(sessionId)}`,
            {
              headers: {
                Accept: 'application/vnd.api+json',
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );
          if (chkRes.ok) {
            const chkJson = await chkRes.json();
            const attrs = chkJson?.data?.attributes || {};
            verifiedTestMode = Boolean(attrs.test_mode ?? verifiedTestMode);
            if (!email && attrs.checkout_data?.email) {
              email = String(attrs.checkout_data.email).trim().toLowerCase();
            }
            if (attrs.checkout_data?.custom?.plan) {
              verifiedPlan = normalizePlanKey(attrs.checkout_data.custom.plan);
            }
          }
        }

        if (!verifiedPaid && email) {
          const listRes = await fetch(
            `https://api.lemonsqueezy.com/v1/orders?filter[user_email]=${encodeURIComponent(email)}`,
            {
              headers: {
                Accept: 'application/vnd.api+json',
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );
          if (listRes.ok) {
            const listJson = await listRes.json();
            const orders = Array.isArray(listJson?.data) ? listJson.data : [];
            const recentPaid = orders.find((o: any) => o?.attributes?.status === 'paid');
            if (recentPaid) {
              const attrs = recentPaid.attributes || {};
              verifiedPaid = true;
              verifiedOrderId = String(recentPaid.id || verifiedOrderId);
              verifiedPlan = resolvePlanFromLemonAttributes(attrs, verifiedPlan);
              const matchedDyn = findPlanPricing(pricing, verifiedPlan);
              verifiedAmount = attrs.total
                ? Number(attrs.total) / 100
                : matchedDyn?.activePrice ?? PLANS[verifiedPlan].launchPrice;
              verifiedTestMode = Boolean(attrs.test_mode);
              if (pricing.launchDiscountActive) {
                verifiedLockedLaunch = matchedDyn?.launchPrice ?? verifiedAmount;
              }
            }
          }
        }
      } catch (apiErr) {
        console.warn('Lemon Squeezy verify API lookup error:', apiErr);
      }
    }

    if (!email) {
      return res.status(401).json({ error: 'Authentication or order email required to verify checkout' });
    }

    let dbUser = getOrCreateServerUser(email);

    // 2. If webhook already upgraded the user and no new order_id upgrade needed, return synced DB state
    if (
      !verifiedPaid &&
      dbUser.plan !== 'free' &&
      dbUser.license_end &&
      dbUser.license_end > Date.now() &&
      dbUser.payments.length > 0 &&
      (!orderId || dbUser.payments.some((p) => p.order_id === orderId))
    ) {
      const license = computeServerLicenseStatus(dbUser);
      const features = findPlanPricing(pricing, license.planKey)?.features || PLANS[license.planKey].features;
      setSessionCookie(res, dbUser.email);
      return res.status(200).json({
        success: true,
        verified: true,
        source: 'webhook_db_synced',
        plan: license.displayName,
        planKey: license.planKey,
        license_end: dbUser.license_end,
        analyses_used: license.analysesUsed,
        analyses_left: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLeft,
        user: dbUser,
        license,
        features,
      });
    }

    // 3. Activate when API confirmed paid order OR in Test Mode checkout return
    if (verifiedPaid || (isTestEnv && (isTestQuery || Boolean(pending)) && verifiedPlan !== 'free')) {
      dbUser = activatePaidPlanOnServer({
        email,
        name: dbUser.name,
        plan: verifiedPlan,
        orderId: verifiedOrderId,
        amountUSD: verifiedAmount,
        currency: 'USD',
        testMode: verifiedTestMode,
        refundPolicyAcceptedAt: src.refundAcceptedAt || new Date().toISOString(),
        lockedLaunchPrice: verifiedLockedLaunch,
      });

      appendWebhookLog({
        order_id: verifiedOrderId,
        event_name: verifiedPaid ? 'checkout_verify_api' : 'checkout_verify_test',
        plan: verifiedPlan,
        email,
        amount: verifiedAmount,
        currency: 'USD',
        test_mode: verifiedTestMode,
      });

      setSessionCookie(res, dbUser.email);
      const license = computeServerLicenseStatus(dbUser);
      const features = findPlanPricing(pricing, license.planKey)?.features || PLANS[license.planKey].features;

      return res.status(200).json({
        success: true,
        verified: true,
        source: verifiedPaid ? 'lemon_api_verified' : 'lemon_test_verified',
        plan: license.displayName,
        planKey: license.planKey,
        license_end: dbUser.license_end,
        analyses_used: license.analysesUsed,
        analyses_left: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLeft,
        user: dbUser,
        license,
        features,
      });
    }

    // If still unverified in live mode, return authoritative DB state cleanly (never elevate unearned plan)
    const license = computeServerLicenseStatus(dbUser);
    const features = findPlanPricing(pricing, license.planKey)?.features || PLANS[license.planKey].features;
    return res.status(200).json({
      success: true,
      verified: dbUser.plan !== 'free',
      pendingVerification: dbUser.plan === 'free',
      source: 'db_authoritative',
      plan: license.displayName,
      planKey: license.planKey,
      license_end: dbUser.license_end,
      analyses_used: license.analysesUsed,
      analyses_left: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLeft,
      user: dbUser,
      license,
      features,
    });
  } catch (err: any) {
    console.error('/api/checkout/verify error:', err);
    return res.status(500).json({ error: err?.message || 'Checkout verification failed' });
  }
}
