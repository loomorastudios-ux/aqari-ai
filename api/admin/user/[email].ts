// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { computeLicenseStatus, normalizePlanKey, PLANS } from '../../../lib/plans';
import { getSessionEmailFromReq, isAdminEmail } from '../../../lib/security';
import {
  adminChangeUserPlan,
  evaluateRefundEligibility,
  getOrCreateServerUser,
  recordRefundDecision,
} from '../../../lib/serverStore';

export default async function handler(req: any, res: any) {
  try {
    const sessionEmail = getSessionEmailFromReq(req);
    if (!isAdminEmail(sessionEmail)) {
      return res.status(403).json({
        error: 'Forbidden: Admin access restricted to owner account',
        code: 'ADMIN_FORBIDDEN',
      });
    }

    const rawEmail = (req.query?.email || req.params?.email || req.body?.email || '').toString().trim();
    const targetEmail = decodeURIComponent(rawEmail).toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid target user email is required' });
    }

    if (req.method === 'GET') {
      const user = getOrCreateServerUser(targetEmail);
      const license = computeLicenseStatus({
        plan: user.plan,
        licenseStart: user.license_start,
        licenseEnd: user.license_end,
        analysesUsed: user.analyses_used,
      });
      const refundEvaluation = evaluateRefundEligibility(user);
      return res.status(200).json({
        success: true,
        user: {
          ...user,
          displayPlan: license.displayName,
          daysLeft: license.daysLeft,
          isExpired: license.isExpired,
          analysesLimit: license.isUnlimitedAnalyses ? 'Unlimited' : PLANS[license.planKey].analysesLimit,
          refundEvaluation,
        },
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action === 'change_plan') {
        const reason = (body.reason || '').toString().trim();
        if (!reason) {
          return res.status(400).json({
            error: 'Mandatory audit reason is required to modify a user plan',
          });
        }
        const newPlan = normalizePlanKey(body.newPlan);
        const updated = adminChangeUserPlan({
          email: targetEmail,
          newPlan,
          reason,
          adminEmail: sessionEmail!,
        });
        return res.status(200).json({ success: true, user: updated });
      }

      if (body.action === 'refund_decision') {
        const status = body.status === 'approved' ? 'approved' : body.status === 'pending' ? 'pending' : 'denied';
        const updated = recordRefundDecision({
          email: targetEmail,
          status,
          notes: (body.notes || '').toString().trim(),
          actorEmail: sessionEmail!,
        });
        return res.status(200).json({ success: true, user: updated });
      }

      return res.status(400).json({ error: 'Invalid admin action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('/api/admin/user error:', err);
    return res.status(500).json({ error: err?.message || 'Admin user action failed' });
  }
}
