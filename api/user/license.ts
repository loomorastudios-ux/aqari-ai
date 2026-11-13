// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { PLANS } from '../../lib/plans';
import { getSessionEmailFromReq } from '../../lib/security';
import {
  computeServerLicenseStatus,
  getOrCreateServerUser,
  getPricingPublicPayload,
} from '../../lib/serverStore';

export default async function handler(req: any, res: any) {
  try {
    const source = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const sessionEmail = getSessionEmailFromReq(req);
    const email = (sessionEmail || source.email || '').toString().trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // SECURITY CRITICAL: Never elevate plan from client input; read strictly from DB
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
      features: pricing.plans[license.planKey]?.features || PLANS[license.planKey].features,
      capabilities: PLANS[license.planKey].capabilities,
    });
  } catch (error: any) {
    console.error('/api/user/license error:', error);
    return res.status(500).json({ error: error?.message || 'License check failed' });
  }
}
