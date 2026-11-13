// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { normalizePlanKey } from '../../lib/plans';
import { getSessionEmailFromReq, isAdminEmail } from '../../lib/security';
import {
  getPricingChangeLogs,
  getPricingPublicPayload,
  updateLaunchDiscountSettings,
  updateServerPlanPricing,
} from '../../lib/serverStore';

export default async function handler(req: any, res: any) {
  try {
    const sessionEmail = getSessionEmailFromReq(req);
    if (!isAdminEmail(sessionEmail)) {
      return res.status(403).json({
        error: 'Forbidden: Admin pricing control restricted to owner account',
        code: 'ADMIN_FORBIDDEN',
      });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        pricing: getPricingPublicPayload(),
        logs: getPricingChangeLogs(),
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = (body.action || 'update_plan').toString();

      if (action === 'toggle_launch_discount') {
        const result = updateLaunchDiscountSettings({
          launchDiscountActive:
            typeof body.launchDiscountActive === 'boolean' ? body.launchDiscountActive : undefined,
          launchBadgeText: typeof body.launchBadgeText === 'string' ? body.launchBadgeText : undefined,
          countdownDays:
            body.countdownDays !== undefined ? Number(body.countdownDays) : undefined,
          adminEmail: sessionEmail!,
        });
        return res.status(200).json({
          success: true,
          pricing: result.pricing,
          log: result.log,
          logs: getPricingChangeLogs(),
        });
      }

      if (action === 'update_plan') {
        const planKey = normalizePlanKey(body.planKey || body.plan);
        const features = Array.isArray(body.features)
          ? body.features.map((s: any) => String(s))
          : typeof body.features === 'string'
          ? body.features
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : undefined;

        const result = updateServerPlanPricing({
          planKey,
          originalPrice:
            body.originalPrice !== undefined ? Number(body.originalPrice) : undefined,
          launchPrice:
            body.launchPrice !== undefined ? Number(body.launchPrice) : undefined,
          analysesLimit:
            body.analysesLimit !== undefined ? Number(body.analysesLimit) : undefined,
          features,
          adminEmail: sessionEmail!,
        });

        return res.status(200).json({
          success: true,
          pricing: result.pricing,
          log: result.log,
          logs: getPricingChangeLogs(),
        });
      }

      return res.status(400).json({ error: 'Invalid admin pricing action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('/api/admin/pricing error:', err);
    return res.status(500).json({ error: err?.message || 'Admin pricing action failed' });
  }
}
