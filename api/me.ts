// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { PLANS, findPlanPricing } from '../lib/plans';
import { getSessionEmailFromReq, isAdminEmail } from '../lib/security';
import {
  computeServerLicenseStatus,
  enforceServerUserExpiry,
  getOrCreateServerUser,
  getPricingPublicPayload,
} from '../lib/serverStore';

/**
 * Authoritative Server Entitlement Endpoint
 * GET /api/me
 * Always reads strictly from server DB via signed HttpOnly session cookie (NEVER localStorage).
 * Enforces license_end < now() -> FREE downgrade on every call as backup to daily cron.
 */
export default async function handler(req: any, res: any) {
  try {
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
  } catch (err: any) {
    console.error('/api/me error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to load profile' });
  }
}
