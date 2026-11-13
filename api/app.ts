// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import {
  PLANS,
  PlanKey,
  canUseFeature,
  computeLicenseStatus,
  findPlanPricing,
  getUpgradeMessage,
  normalizePlanKey,
} from '../lib/plans';
import {
  checkRateLimit,
  clearSessionCookie,
  getClientIp,
  getSessionEmailFromReq,
  isAdminEmail,
  setSessionCookie,
} from '../lib/security';
import {
  activatePaidPlanOnServer,
  appendWebhookLog,
  computeServerLicenseStatus,
  consumePendingCheckout,
  enforceServerUserExpiry,
  getEmailLogs,
  getFailedWebhookLogs,
  getOrCreateServerUser,
  getPricingPublicPayload,
  getWebhookLogs,
  recordPendingCheckout,
  recordUserAnalysis,
  recordUserLogin,
  recordUserPdfDownload,
  updateServerUser,
} from '../lib/serverStore';
import { getDeterministicMarketData, getLiveMarketDataWithCache } from '../lib/marketData';
import { fetchGoogleMarketNews } from '../lib/marketNews';
import { DEMO_ANALYSES } from '../src/constants/demoAnalyses';

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

const VARIANT_ID_TO_PLAN: Record<string, PlanKey> = {
  'da826632-dcb4-4885-966e-aac1fab84cb3': 'starter',
  '404c54cb-29c5-477a-b8c2-772092f5459a': 'pro',
  'ce8dfbdb-cedd-4445-a947-e821522472bb': 'enterprise',
};

const SUCCESS_REDIRECT = 'https://aqari-ai-rho.vercel.app/app?checkout=success';
const CANCEL_REDIRECT = 'https://aqari-ai-rho.vercel.app/pricing?checkout=cancelled';

function resolvePlanFromLemonAttributes(attrs: any, fallbackPlan?: PlanKey): PlanKey {
  const variantId = String(attrs?.first_order_item?.variant_id || attrs?.variant_id || '').trim();
  const productId = String(attrs?.first_order_item?.product_id || attrs?.product_id || '').trim();

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

function getQueryParam(req: any, url: URL, key: string): string {
  const q = req.query?.[key];
  if (typeof q === 'string') return q;
  if (Array.isArray(q) && q[0]) return String(q[0]);
  return url.searchParams.get(key) || '';
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '/api/app', `http://${req.headers?.host || 'localhost:3000'}`);
  const action = (
    getQueryParam(req, url, 'action') ||
    (req.body && typeof req.body === 'object' ? req.body.action : '') ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();

  try {
    switch (action) {
      // ------------------------------------------------------------------
      // 1. GET /api/app?action=me (Authoritative Server Entitlement + Backup Expiry)
      // ------------------------------------------------------------------
      case 'me': {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        const sessionEmail = getSessionEmailFromReq(req);
        if (!sessionEmail) {
          return res.status(401).json({
            authenticated: false,
            error: 'Authentication required',
          });
        }

        const initialUser = getOrCreateServerUser(sessionEmail);
        const dbUser = enforceServerUserExpiry(initialUser.email);
        const license = computeServerLicenseStatus(dbUser);
        const pricing = getPricingPublicPayload();
        const dynamicPlan = findPlanPricing(pricing, license.planKey);
        const features = dynamicPlan?.features || PLANS[license.planKey].features;

        return res.status(200).json({
          success: true,
          authenticated: true,
          email: dbUser.email,
          name: dbUser.name,
          isAdmin: isAdminEmail(dbUser.email),
          plan: license.displayName,
          planKey: license.planKey,
          license_start: dbUser.license_start,
          license_end: dbUser.license_end,
          days_left: license.daysLeft,
          analyses_limit: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit,
          analyses_used: license.analysesUsed,
          analyses_left: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLeft,
          saved_limit: license.isUnlimitedSaved ? 'Unlimited' : license.savedLimit,
          locked_launch_price: dbUser.locked_launch_price ?? null,
          features,
          capabilities: PLANS[license.planKey].capabilities,
          user: {
            email: dbUser.email,
            name: dbUser.name,
            plan: dbUser.plan,
            license_start: dbUser.license_start,
            license_end: dbUser.license_end,
            analyses_used: dbUser.analyses_used,
            locked_launch_price: dbUser.locked_launch_price ?? null,
          },
          license,
        });
      }

      // ------------------------------------------------------------------
      // 2. GET /api/app?action=pricing (Single Source of Truth Dynamic Pricing)
      // ------------------------------------------------------------------
      case 'pricing': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.status(200).json(getPricingPublicPayload());
      }

      // ------------------------------------------------------------------
      // 3. GET/POST /api/app?action=verify-checkout
      // ------------------------------------------------------------------
      case 'verify-checkout': {
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
      }

      // ------------------------------------------------------------------
      // 4. GET /api/app?action=debug-plan
      // ------------------------------------------------------------------
      case 'debug-plan': {
        const sessionEmail = getSessionEmailFromReq(req);
        const isProd =
          process.env.VERCEL_ENV === 'production' ||
          (process.env.NODE_ENV === 'production' && process.env.LEMON_TEST_MODE !== 'true');

        if (isProd && !isAdminEmail(sessionEmail)) {
          return res.status(403).json({
            error: 'Debug endpoint restricted to ADMIN_EMAIL in production',
          });
        }

        const email = (
          sessionEmail ||
          getQueryParam(req, url, 'email') ||
          req.body?.email ||
          ''
        )
          .toString()
          .trim()
          .toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication or email query required' });
        }

        const userRecord = getOrCreateServerUser(email);
        const license = computeServerLicenseStatus(userRecord);
        const pricing = getPricingPublicPayload();

        return res.status(200).json({
          email: userRecord.email,
          plan: license.displayName,
          planKey: license.planKey,
          license_start: userRecord.license_start,
          license_end: userRecord.license_end,
          analyses_used: license.analysesUsed,
          analyses_left: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLeft,
          days_left: license.daysLeft,
          locked_launch_price: userRecord.locked_launch_price ?? null,
          features: findPlanPricing(pricing, license.planKey)?.features || PLANS[license.planKey].features,
          capabilities: PLANS[license.planKey].capabilities,
        });
      }

      // ------------------------------------------------------------------
      // 5. POST /api/app?action=underwrite (formerly /api/analyze)
      // ------------------------------------------------------------------
      case 'underwrite':
      case 'analyze': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = req.body || {};
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required to run underwriting analysis' });
        }

        const rl = checkRateLimit(`analyze:${email}`, 10, 60 * 1000);
        if (!rl.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded (max 10 analyses per minute). Please wait briefly.',
            retryAfterSec: rl.retryAfterSec,
          });
        }

        const userRecord = getOrCreateServerUser(email, {
          name: body.name,
          timezone: body.timezone,
        });
        const license = computeServerLicenseStatus(userRecord);

        if (license.isExpired || (!license.isUnlimitedAnalyses && license.analysesLeft <= 0)) {
          return res.status(403).json({
            error: 'Licensing window expired - Renew',
            code: 'LICENSE_EXPIRED_OR_LIMIT_REACHED',
            plan: license.planKey,
            displayName: license.displayName,
            analysesLeft: 0,
            daysLeft: license.daysLeft,
          });
        }

        if (body.useMonteCarlo && !canUseFeature(license.planKey, 'monteCarlo')) {
          return res.status(403).json({
            error: getUpgradeMessage('monteCarlo'),
            code: 'FEATURE_LOCKED',
            feature: 'monteCarlo',
            requiredPlan: 'pro',
          });
        }

        if (body.useSensitivity && !canUseFeature(license.planKey, 'yieldSensitivity')) {
          return res.status(403).json({
            error: getUpgradeMessage('yieldSensitivity'),
            code: 'FEATURE_LOCKED',
            feature: 'yieldSensitivity',
            requiredPlan: 'starter',
          });
        }

        const priceUSD = Number(body.priceUSD || 650000);
        const rentUSD = Number(body.rentUSD || 4500);
        const downPaymentPct = Number(body.downPaymentPct ?? 30);
        const interestRatePct = Number(body.interestRatePct ?? 5.5);
        const operatingExpensePct = Number(body.operatingExpensePct ?? 15);
        const propertyTitle = (body.propertyTitle || 'Institutional Asset').toString();
        const city = (body.city || 'Muscat').toString();

        const downPaymentUSD = priceUSD * (downPaymentPct / 100);
        const loanAmountUSD = Math.max(0, priceUSD - downPaymentUSD);
        const monthlyRate = interestRatePct / 100 / 12;
        const numPayments = 25 * 12;
        const monthlyMortgageUSD =
          loanAmountUSD > 0 && monthlyRate > 0
            ? (loanAmountUSD * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
              (Math.pow(1 + monthlyRate, numPayments) - 1)
            : 0;

        const annualGrossRentUSD = rentUSD * 12 * 0.95;
        const annualOPEXUSD = annualGrossRentUSD * (operatingExpensePct / 100);
        const netOperatingIncomeUSD = annualGrossRentUSD - annualOPEXUSD;
        const annualDebtServiceUSD = monthlyMortgageUSD * 12;
        const annualCashflowUSD = netOperatingIncomeUSD - annualDebtServiceUSD;
        const monthlyCashflowUSD = annualCashflowUSD / 12;

        const capRate = Number(((netOperatingIncomeUSD / Math.max(1, priceUSD)) * 100).toFixed(2));
        const cashOnCash =
          downPaymentUSD > 0 ? Number(((annualCashflowUSD / downPaymentUSD) * 100).toFixed(2)) : 0;
        const irr5Yr = Number((cashOnCash + 4.8).toFixed(1));
        const dscr =
          annualDebtServiceUSD > 0 ? (netOperatingIncomeUSD / annualDebtServiceUSD).toFixed(2) : '∞';

        const updatedUser = recordUserAnalysis(email, {
          property: propertyTitle,
          city,
          priceUSD,
          capRate,
          cashOnCash,
          resultSummary: `Cap ${capRate}% | CoC ${cashOnCash}%`,
        });
        const nextLicense = computeServerLicenseStatus(updatedUser);

        return res.status(200).json({
          success: true,
          result: {
            capRate,
            cashOnCash,
            irr5Yr: canUseFeature(license.planKey, 'yieldSensitivity') ? irr5Yr : null,
            dscr: canUseFeature(license.planKey, 'yieldSensitivity') ? dscr : null,
            monthlyCashflowUSD: canUseFeature(license.planKey, 'yieldSensitivity')
              ? Math.round(monthlyCashflowUSD)
              : null,
            netOperatingIncomeUSD: Math.round(netOperatingIncomeUSD),
            monteCarlo: canUseFeature(license.planKey, 'monteCarlo')
              ? {
                  rateShockCoC: Number(Math.max(0, cashOnCash - 1.85).toFixed(2)),
                  vacancySurgeNetYield: Number(Math.max(0, capRate - 1.2).toFixed(2)),
                }
              : null,
          },
          license: nextLicense,
          planCapabilities: PLANS[nextLicense.planKey].capabilities,
        });
      }

      // ------------------------------------------------------------------
      // 6. POST /api/app?action=save-property (formerly /api/save)
      // ------------------------------------------------------------------
      case 'save-property':
      case 'save': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = req.body || {};
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required to save analyses' });
        }

        const userRecord = getOrCreateServerUser(email, { name: body.name });
        const license = computeServerLicenseStatus(userRecord);

        if (license.isExpired) {
          return res.status(403).json({
            error: 'Licensing window expired - Renew',
            code: 'LICENSE_EXPIRED',
          });
        }

        const currentSavedCount = Math.max(
          userRecord.saved_analyses.length,
          Number(body.currentSavedCount || 0)
        );

        if (
          !canUseFeature(license.planKey, 'saveProperty') ||
          (!license.isUnlimitedSaved && currentSavedCount >= license.savedLimit)
        ) {
          return res.status(403).json({
            error: 'Upgrade to save more',
            code: 'SAVE_LIMIT_REACHED',
            plan: license.planKey,
            savedCount: currentSavedCount,
            savedLimit: license.savedLimit,
          });
        }

        const analysis = body.analysis;
        if (!analysis) {
          return res.status(400).json({ error: 'Analysis payload is required' });
        }

        const newItem = {
          ...analysis,
          id: analysis.id || `saved_${Date.now()}`,
          date: analysis.date || Date.now(),
        };

        const nextSaved = [newItem, ...userRecord.saved_analyses];
        const updated = updateServerUser(email, { saved_analyses: nextSaved });

        return res.status(200).json({
          success: true,
          savedItem: newItem,
          savedCount: updated.saved_analyses.length,
          savedLimit: PLANS[license.planKey].savedLimit,
        });
      }

      // ------------------------------------------------------------------
      // 7. POST /api/app?action=export (formerly /api/export)
      // ------------------------------------------------------------------
      case 'export': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const body = req.body || {};
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required to export' });
        }

        const userRecord = getOrCreateServerUser(email, { name: body.name });
        const license = computeLicenseStatus({
          plan: userRecord.plan,
          licenseStart: userRecord.license_start,
          licenseEnd: userRecord.license_end,
          analysesUsed: userRecord.analyses_used,
        });

        if (license.isExpired) {
          return res.status(403).json({
            error: 'Licensing window expired - Renew',
            code: 'LICENSE_EXPIRED',
          });
        }

        const format = (body.format || 'pdf').toLowerCase();
        if (format === 'api') {
          if (!canUseFeature(license.planKey, 'apiAccess')) {
            return res.status(403).json({
              error: getUpgradeMessage('apiAccess'),
              code: 'FEATURE_LOCKED',
              feature: 'apiAccess',
              requiredPlan: 'enterprise',
            });
          }
        } else if (!canUseFeature(license.planKey, 'pdfExport')) {
          return res.status(403).json({
            error: getUpgradeMessage('pdfExport'),
            code: 'FEATURE_LOCKED',
            feature: 'pdfExport',
            requiredPlan: 'pro',
          });
        }

        const propertyTitle = (body.propertyTitle || 'AQARI_Institutional_Asset').toString();
        const safeName = propertyTitle.replace(/[^a-z0-9_-]+/gi, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        const watermark = `Generated by AQARI TERMINAL - Loomora Studios - Licensed to ${email} - ${dateStr}`;

        recordUserPdfDownload(email, {
          property: propertyTitle,
          format,
          watermark,
        });

        return res.status(200).json({
          success: true,
          format,
          filename: `${safeName}_AQARI_MEMO.${format === 'api' ? 'json' : 'pdf'}`,
          watermark,
          generatedAt: new Date().toISOString(),
          plan: license.displayName,
        });
      }

      // ------------------------------------------------------------------
      // 8. GET/POST /api/app?action=portfolio (formerly /api/portfolio)
      // ------------------------------------------------------------------
      case 'portfolio': {
        const body = req.method === 'POST' ? (req.body || {}) : (req.query || {});
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || body.email || '').toString().trim().toLowerCase();
        if (!email) {
          return res.status(401).json({ error: 'Authentication required for portfolio aggregation' });
        }

        const userRecord = getOrCreateServerUser(email, { name: body.name });
        const license = computeLicenseStatus({
          plan: userRecord.plan,
          licenseStart: userRecord.license_start,
          licenseEnd: userRecord.license_end,
          analysesUsed: userRecord.analyses_used,
        });

        if (license.isExpired) {
          return res.status(403).json({
            error: 'Licensing window expired - Renew',
            code: 'LICENSE_EXPIRED',
          });
        }

        if (!canUseFeature(license.planKey, 'portfolioAggregation')) {
          return res.status(403).json({
            error: getUpgradeMessage('portfolioAggregation'),
            code: 'FEATURE_LOCKED',
            feature: 'portfolioAggregation',
            requiredPlan: 'pro',
          });
        }

        const items = Array.isArray(body.savedAnalyses) ? body.savedAnalyses : userRecord.saved_analyses;
        const totalValueUSD = items.reduce((acc: number, item: any) => acc + Number(item.price || 0), 0);
        const monthlyCashflowUSD = items.reduce((acc: number, item: any) => acc + Number(item.monthlyCashflow || 0), 0);
        const avgCapRate = items.length
          ? Number((items.reduce((acc: number, item: any) => acc + Number(item.capRate || 0), 0) / items.length).toFixed(2))
          : 0;
        const avgIRR = items.length
          ? Number((items.reduce((acc: number, item: any) => acc + Number(item.irr || 0), 0) / items.length).toFixed(1))
          : 0;

        return res.status(200).json({
          success: true,
          plan: license.displayName,
          portfolio: {
            count: items.length,
            totalValueUSD,
            monthlyCashflowUSD,
            annualCashflowUSD: monthlyCashflowUSD * 12,
            avgCapRate,
            avgIRR,
          },
        });
      }

      // ------------------------------------------------------------------
      // 9. POST /api/app?action=checkout (formerly /api/checkout)
      // ------------------------------------------------------------------
      case 'checkout': {
        const startTime = Date.now();
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const { plan, email, userId, refundAcceptedAt } = req.body || {};
        const validPlan: 'starter' | 'pro' | 'enterprise' =
          plan === 'starter' || plan === 'pro' || plan === 'enterprise' ? plan : 'pro';
        const variantId = VARIANT_IDS[validPlan];
        const buyBaseUrl = BUY_URLS[validPlan];

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
      }

      // ------------------------------------------------------------------
      // 10. GET/POST/DELETE /api/app?action=session (formerly /api/auth/session)
      // ------------------------------------------------------------------
      case 'session': {
        if (req.method === 'DELETE') {
          clearSessionCookie(res);
          return res.status(200).json({ success: true });
        }

        if (req.method === 'GET') {
          const sessionEmail = getSessionEmailFromReq(req);
          if (!sessionEmail) {
            return res.status(200).json({ authenticated: false, email: null, isAdmin: false });
          }
          const user = getOrCreateServerUser(sessionEmail);
          const license = computeServerLicenseStatus(user);
          return res.status(200).json({
            authenticated: true,
            email: user.email,
            isAdmin: isAdminEmail(user.email),
            user,
            license,
          });
        }

        if (req.method === 'POST') {
          const ip = getClientIp(req);
          const rl = checkRateLimit(`auth:${ip}`, 5, 60 * 1000);
          if (!rl.allowed) {
            return res.status(429).json({
              error: 'Too many authentication attempts. Please wait 1 minute.',
              retryAfterSec: rl.retryAfterSec,
            });
          }

          const body = req.body || {};
          const email = (body.email || '').toString().trim().toLowerCase();
          if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email is required' });
          }

          const user = recordUserLogin(email, body.name);
          setSessionCookie(res, user.email);
          const license = computeServerLicenseStatus(user);
          const pricing = getPricingPublicPayload();

          return res.status(200).json({
            success: true,
            authenticated: true,
            email: user.email,
            isAdmin: isAdminEmail(user.email),
            user,
            license,
            features: findPlanPricing(pricing, license.planKey)?.features || PLANS[license.planKey].features,
          });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ------------------------------------------------------------------
      // 11. GET/POST /api/app?action=license (formerly /api/user/license)
      // ------------------------------------------------------------------
      case 'license': {
        const source = req.method === 'POST' ? (req.body || {}) : (req.query || {});
        const sessionEmail = getSessionEmailFromReq(req);
        const email = (sessionEmail || source.email || '').toString().trim().toLowerCase();
        if (!email) {
          return res.status(400).json({ error: 'Email is required' });
        }

        const userRecord = getOrCreateServerUser(email, {
          name: source.name,
          timezone: source.timezone,
        });
        const license = computeServerLicenseStatus(userRecord);
        const pricing = getPricingPublicPayload();

        return res.status(200).json({
          success: true,
          user: {
            email: userRecord.email,
            name: userRecord.name,
            plan: userRecord.plan,
            license_start: userRecord.license_start,
            license_end: userRecord.license_end,
            analyses_used: userRecord.analyses_used,
            timezone: userRecord.timezone,
            locked_launch_price: userRecord.locked_launch_price ?? null,
            paymentsCount: userRecord.payments.length,
            pdfDownloadsCount: userRecord.pdf_downloads.length,
          },
          license,
          features: findPlanPricing(pricing, license.planKey)?.features || PLANS[license.planKey].features,
          capabilities: PLANS[license.planKey].capabilities,
        });
      }

      // ------------------------------------------------------------------
      // 12. GET /api/app?action=market-live (formerly /api/market/live)
      // ------------------------------------------------------------------
      case 'market-live': {
        try {
          const force = getQueryParam(req, url, 'refresh') === 'true';
          const data = await getLiveMarketDataWithCache(force);
          res.setHeader('Cache-Control', 'public, max-age=21600, stale-while-revalidate=86400');
          return res.status(200).json(data);
        } catch {
          return res.status(200).json(getDeterministicMarketData());
        }
      }

      // ------------------------------------------------------------------
      // 13. GET /api/app?action=news (formerly /api/news)
      // ------------------------------------------------------------------
      case 'news': {
        const result = await fetchGoogleMarketNews();
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
        return res.status(200).json(result);
      }

      // ------------------------------------------------------------------
      // 14. GET /api/app?action=demo&slug=... (formerly /api/demo/[slug])
      // ------------------------------------------------------------------
      case 'demo': {
        const slug = getQueryParam(req, url, 'slug');
        if (!slug) {
          return res.status(200).json({
            available: Object.keys(DEMO_ANALYSES),
            count: Object.keys(DEMO_ANALYSES).length,
          });
        }
        const demo = DEMO_ANALYSES[slug];
        if (!demo) {
          return res.status(404).json({
            error: `Demo analysis '${slug}' not found`,
            available: Object.keys(DEMO_ANALYSES),
          });
        }
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        return res.status(200).json({ success: true, demo });
      }

      // ------------------------------------------------------------------
      // 15. GET /api/app?action=webhook-logs (formerly /api/webhooks/logs)
      // ------------------------------------------------------------------
      case 'webhook-logs': {
        const webhookLogs = getWebhookLogs();
        const emailLogs = getEmailLogs();
        const failedWebhooks = getFailedWebhookLogs();
        return res.status(200).json({
          success: true,
          testMode: process.env.LEMON_TEST_MODE === 'true' || process.env.VITE_LEMON_TEST_MODE === 'true',
          webhookLogs,
          webhooks: webhookLogs,
          failedWebhooks,
          emailLogs,
          emails: emailLogs,
        });
      }

      // ------------------------------------------------------------------
      // 16. GET /api/app?action=google-callback (Google OAuth 2.0 callback rewrite)
      // ------------------------------------------------------------------
      case 'google-callback': {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          return res.status(400).send(`
            <!DOCTYPE html>
            <html>
              <head><title>Authentication Error</title></head>
              <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
                <h2>Google Authentication Error</h2>
                <p style="color:#f87171;">${error}</p>
                <script>
                  if (window.opener) {
                    window.opener.postMessage({ type: 'AQARI_GOOGLE_AUTH_CALLBACK', error: ${JSON.stringify(error)} }, '*');
                    window.close();
                  } else {
                    setTimeout(() => { window.location.href = '/#/landing'; }, 2500);
                  }
                </script>
              </body>
            </html>
          `);
        }

        const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/callback/google`;

        if (code && clientId && clientSecret) {
          try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
              }),
            });

            if (!tokenRes.ok) {
              const errText = await tokenRes.text();
              throw new Error(`Token exchange failed: ${errText}`);
            }

            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;
            const idToken = tokenData.id_token;

            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!userRes.ok) {
              throw new Error('Failed to verify token with Google userinfo API');
            }
            const userData = await userRes.json();

            return res.status(200).send(`
              <!DOCTYPE html>
              <html>
                <head><title>Authenticating...</title></head>
                <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
                  <p>Verification successful. Redirecting to AQARI Terminal...</p>
                  <script>
                    const payload = {
                      type: 'AQARI_GOOGLE_AUTH_CALLBACK',
                      accessToken: ${JSON.stringify(accessToken)},
                      idToken: ${JSON.stringify(idToken)},
                      user: ${JSON.stringify(userData)}
                    };
                    if (window.opener) {
                      window.opener.postMessage(payload, '*');
                      window.close();
                    } else {
                      window.location.href = '/#access_token=' + encodeURIComponent(${JSON.stringify(accessToken)}) + '&id_token=' + encodeURIComponent(${JSON.stringify(idToken)});
                    }
                  </script>
                </body>
              </html>
            `);
          } catch (err: any) {
            return res.status(500).send(`
              <!DOCTYPE html>
              <html>
                <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
                  <h2>Verification Failed</h2>
                  <p style="color:#f87171;">${err?.message || 'Authentication error'}</p>
                  <a href="/#/landing" style="color:#D4AF37;">Back to AQARI</a>
                </body>
              </html>
            `);
          }
        }

        res.writeHead(302, { Location: '/#/landing' });
        res.end();
        return;
      }

      // ------------------------------------------------------------------
      // 17. GET /api/app?action=nextauth
      // ------------------------------------------------------------------
      case 'nextauth': {
        return res.status(200).json({
          google: {
            id: 'google',
            name: 'Google',
            type: 'oauth',
            signinUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            callbackUrl: 'https://aqari-ai-rho.vercel.app/api/auth/callback/google',
          },
        });
      }

      default:
        return res.status(400).json({
          error: `Unknown or missing action '${action}'.`,
          supportedActions: [
            'me',
            'pricing',
            'verify-checkout',
            'debug-plan',
            'underwrite',
            'save-property',
            'export',
            'portfolio',
            'checkout',
            'session',
            'license',
            'market-live',
            'news',
            'demo',
            'webhook-logs',
            'google-callback',
          ],
        });
    }
  } catch (err: any) {
    console.error(`/api/app?action=${action} error:`, err);
    return res.status(500).json({ error: err?.message || 'App API error' });
  }
}
