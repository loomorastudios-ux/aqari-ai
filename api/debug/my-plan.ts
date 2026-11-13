// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { PLANS, findPlanPricing } from '../../lib/plans';
import { getSessionEmailFromReq, isAdminEmail } from '../../lib/security';
import {
  computeServerLicenseStatus,
  getOrCreateServerUser,
  getPricingPublicPayload,
} from '../../lib/serverStore';

export default async function handler(req: any, res: any) {
  try {
    const sessionEmail = getSessionEmailFromReq(req);
    const isProd =
      process.env.VERCEL_ENV === 'production' ||
      (process.env.NODE_ENV === 'production' && process.env.LEMON_TEST_MODE !== 'true');

    if (isProd && !isAdminEmail(sessionEmail)) {
      return res.status(403).json({
        error: 'Debug endpoint restricted to ADMIN_EMAIL in production',
      });
    }

    const email = (sessionEmail || req.query?.email || req.body?.email || '').toString().trim().toLowerCase();
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
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Debug query failed' });
  }
}
