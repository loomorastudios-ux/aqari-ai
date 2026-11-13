// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { PLANS, PlanKey, normalizePlanKey } from '../../lib/plans';
import { getSessionEmailFromReq, setSessionCookie } from '../../lib/security';
import { activatePaidPlanOnServer, appendWebhookLog, getOrCreateServerUser } from '../../lib/serverStore';
import { computeLicenseStatus } from '../../lib/plans';

/**
 * Post-Payment Verification Endpoint
 * GET /api/checkout/verify?session_id=...&order_id=...&plan=...&email=...
 * POST /api/checkout/verify
 *
 * Re-fetches order/checkout from Lemon Squeezy REST API when API key is present,
 * updates DB user.plan, license_start, license_end, analyses_used=0, and syncs session.
 */
function resolvePlanFromLemonName(rawName?: string | null, fallbackPlan?: PlanKey): PlanKey {
  const s = (rawName || '').toLowerCase();
  if (s.includes('sovereign') || s.includes('enterprise') || s.includes('agency') || s.includes('749')) {
    return 'enterprise';
  }
  if (s.includes('pro') || s.includes('professional') || s.includes('249')) {
    return 'pro';
  }
  if (s.includes('starter') || s.includes('standard') || s.includes('89')) {
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

    // 1. If webhook already upgraded the user within the last 10 minutes, return synced DB state
    if (
      dbUser.plan !== 'free' &&
      dbUser.license_end &&
      dbUser.license_end > Date.now() &&
      dbUser.payments.length > 0
    ) {
      const license = computeLicenseStatus({
        plan: dbUser.plan,
        licenseStart: dbUser.license_start,
        licenseEnd: dbUser.license_end,
        analysesUsed: dbUser.analyses_used,
      });
      setSessionCookie(res, dbUser.email);
      return res.status(200).json({
        success: true,
        source: 'webhook_db_synced',
        user: dbUser,
        license,
        features: PLANS[license.planKey].features,
      });
    }

    // 2. Query Lemon Squeezy API directly to re-verify order/checkout
    const apiKey = isTestEnv
      ? process.env.LEMON_TEST_API_KEY || process.env.LEMONSQUEEZY_API_KEY
      : process.env.LEMONSQUEEZY_API_KEY;

    let verifiedPaid = false;
    let verifiedPlan: PlanKey = requestedPlan === 'free' ? 'pro' : requestedPlan;
    let verifiedOrderId = orderId || sessionId || `ord_${Date.now()}`;
    let verifiedAmount = PLANS[verifiedPlan].priceUSD;
    let verifiedTestMode = isTestEnv || isTestQuery;

    if (apiKey) {
      try {
        // Check specific order ID first
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
              verifiedAmount = attrs.total ? Number(attrs.total) / 100 : PLANS[verifiedPlan].priceUSD;
              verifiedTestMode = Boolean(attrs.test_mode);
            }
          }
        }

        // Or check checkout object if session_id passed
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

        // Or query latest paid order by user_email from Lemon Squeezy API
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
              verifiedAmount = attrs.total ? Number(attrs.total) / 100 : PLANS[verifiedPlan].priceUSD;
              verifiedTestMode = Boolean(attrs.test_mode);
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
      const license = computeLicenseStatus({
        plan: dbUser.plan,
        licenseStart: dbUser.license_start,
        licenseEnd: dbUser.license_end,
        analysesUsed: dbUser.analyses_used,
      });

      return res.status(200).json({
        success: true,
        source: verifiedPaid ? 'lemon_api_verified' : 'lemon_test_verified',
        user: dbUser,
        license,
        features: PLANS[license.planKey].features,
      });
    }

    // If not verified in live mode, return current DB state without elevating plan
    const license = computeLicenseStatus({
      plan: dbUser.plan,
      licenseStart: dbUser.license_start,
      licenseEnd: dbUser.license_end,
      analysesUsed: dbUser.analyses_used,
    });
    return res.status(200).json({
      success: true,
      pendingVerification: dbUser.plan === 'free',
      source: 'db_authoritative',
      user: dbUser,
      license,
      features: PLANS[license.planKey].features,
    });
  } catch (err: any) {
    console.error('/api/checkout/verify error:', err);
    return res.status(500).json({ error: err?.message || 'Checkout verification failed' });
  }
}
