// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { PLANS, PlanKey, normalizePlanKey } from '../../lib/plans';
import { getSessionEmailFromReq, setSessionCookie } from '../../lib/security';
import {
  activatePaidPlanOnServer,
  appendWebhookLog,
  computeServerLicenseStatus,
  getOrCreateServerUser,
  getPricingPublicPayload,
} from '../../lib/serverStore';

/**
 * Post-Payment Verification Endpoint
 * GET /api/checkout/verify?session_id=...&order_id=...&plan=...&email=...
 * POST /api/checkout/verify
 */
function resolvePlanFromLemonName(rawName?: string | null, fallbackPlan?: PlanKey): PlanKey {
  const s = (rawName || '').toLowerCase();
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
    const src = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const sessionEmail = getSessionEmailFromReq(req);
    const email = (sessionEmail || src.email || '').toString().trim().toLowerCase();
    const sessionId = (src.session_id || src.checkout_id || '').toString().trim();
    const orderId = (src.order_id || src.order || '').toString().trim();
    const requestedPlan = normalizePlanKey(src.plan);
    const isTestEnv =
      process.env.LEMON_TEST_MODE === 'true' || process.env.VITE_LEMON_TEST_MODE === 'true';
    const isTestQuery = src.test_mode === '1' || src.test_mode === 'true' || src.test_mode === true;

    if (!email) {
      return res.status(401).json({ error: 'Authentication required to verify checkout' });
    }

    let dbUser = getOrCreateServerUser(email);
    const pricing = getPricingPublicPayload();

    // 1. If webhook already upgraded the user, return synced DB state
    if (
      dbUser.plan !== 'free' &&
      dbUser.license_end &&
      dbUser.license_end > Date.now() &&
      dbUser.payments.length > 0
    ) {
      const license = computeServerLicenseStatus(dbUser);
      setSessionCookie(res, dbUser.email);
      return res.status(200).json({
        success: true,
        verified: true,
        source: 'webhook_db_synced',
        user: dbUser,
        license,
        features: pricing.plans[license.planKey]?.features || PLANS[license.planKey].features,
      });
    }

    // 2. Query Lemon Squeezy API directly to re-verify order/checkout
    const apiKey = isTestEnv
      ? process.env.LEMON_TEST_API_KEY || process.env.LEMONSQUEEZY_API_KEY
      : process.env.LEMONSQUEEZY_API_KEY;

    let verifiedPaid = false;
    let verifiedPlan: PlanKey = requestedPlan === 'free' ? 'pro' : requestedPlan;
    let verifiedOrderId = orderId || sessionId || `ord_${Date.now()}`;
    const dynamicDefaultPrice = pricing.plans[verifiedPlan]?.activePrice ?? PLANS[verifiedPlan].launchPrice;
    let verifiedAmount = Number(src.charged_price) > 0 ? Number(src.charged_price) : dynamicDefaultPrice;
    let verifiedTestMode = isTestEnv || isTestQuery;
    let verifiedLockedLaunch: number | null =
      Number(src.launch_locked) > 0
        ? Number(src.launch_locked)
        : pricing.launchDiscountActive
        ? pricing.plans[verifiedPlan]?.launchPrice ?? verifiedAmount
        : null;

    if (apiKey) {
      try {
        if (orderId) {
          const orderRes = await fetch(`https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(orderId)}`, {
            headers: {
              Accept: 'application/vnd.api+json',
              Authorization: `Bearer ${apiKey}`,
            },
          });
          if (orderRes.ok) {
            const json = await orderRes.json();
            const attrs = json?.data?.attributes || {};
            if (attrs.status === 'paid') {
              verifiedPaid = true;
              verifiedOrderId = String(json.data.id || orderId);
              verifiedPlan = resolvePlanFromLemonName(
                attrs?.first_order_item?.product_name || attrs?.first_order_item?.variant_name,
                verifiedPlan
              );
              verifiedAmount = attrs.total
                ? Number(attrs.total) / 100
                : pricing.plans[verifiedPlan]?.activePrice ?? PLANS[verifiedPlan].launchPrice;
              verifiedTestMode = Boolean(attrs.test_mode);
              if (pricing.launchDiscountActive) {
                verifiedLockedLaunch = pricing.plans[verifiedPlan]?.launchPrice ?? verifiedAmount;
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
            if (attrs.custom_data?.plan) {
              verifiedPlan = normalizePlanKey(attrs.custom_data.plan);
            }
          }
        }

        if (!verifiedPaid) {
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
              verifiedPlan = resolvePlanFromLemonName(
                attrs?.first_order_item?.product_name || attrs?.first_order_item?.variant_name,
                verifiedPlan
              );
              verifiedAmount = attrs.total
                ? Number(attrs.total) / 100
                : pricing.plans[verifiedPlan]?.activePrice ?? PLANS[verifiedPlan].launchPrice;
              verifiedTestMode = Boolean(attrs.test_mode);
              if (pricing.launchDiscountActive) {
                verifiedLockedLaunch = pricing.plans[verifiedPlan]?.launchPrice ?? verifiedAmount;
              }
            }
          }
        }
      } catch (apiErr) {
        console.warn('Lemon Squeezy verify API lookup error:', apiErr);
      }
    }

    // 3. In Test Mode with checkout return (or when API verified paid order), activate license cleanly
    if (verifiedPaid || (isTestEnv && isTestQuery && requestedPlan !== 'free')) {
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

      return res.status(200).json({
        success: true,
        verified: true,
        source: verifiedPaid ? 'lemon_api_verified' : 'lemon_test_verified',
        user: dbUser,
        license,
        features: pricing.plans[license.planKey]?.features || PLANS[license.planKey].features,
      });
    }

    // If not verified in live mode, return current DB state without elevating plan
    const license = computeServerLicenseStatus(dbUser);
    return res.status(200).json({
      success: true,
      verified: dbUser.plan !== 'free',
      pendingVerification: dbUser.plan === 'free',
      source: 'db_authoritative',
      user: dbUser,
      license,
      features: pricing.plans[license.planKey]?.features || PLANS[license.planKey].features,
    });
  } catch (err: any) {
    console.error('/api/checkout/verify error:', err);
    return res.status(500).json({ error: err?.message || 'Checkout verification failed' });
  }
}
