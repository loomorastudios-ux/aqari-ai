// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { getSessionEmailFromReq, isAdminEmail } from '../../lib/security';
import {
  computeServerLicenseStatus,
  evaluateRefundEligibility,
  getAllServerUsers,
  getFailedWebhookLogs,
} from '../../lib/serverStore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionEmail = getSessionEmailFromReq(req);
    if (!isAdminEmail(sessionEmail)) {
      return res.status(403).json({
        error: 'Forbidden: Admin access restricted to owner account',
        code: 'ADMIN_FORBIDDEN',
      });
    }

    const search = (req.query?.q || '').toString().trim().toLowerCase();
    const planFilter = (req.query?.plan || '').toString().trim().toLowerCase();
    const statusFilter = (req.query?.status || '').toString().trim().toLowerCase();
    const minAnalyses = Number(req.query?.minAnalyses || 0);
    const refundOnly = req.query?.refundRequested === 'true';

    const users = getAllServerUsers()
      .map((u) => {
        const license = computeServerLicenseStatus(u);
        const refundEval = evaluateRefundEligibility(u);
        return {
          ...u,
          displayPlan: license.displayName,
          daysLeft: license.daysLeft,
          isExpired: license.isExpired,
          analysesLimit: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit,
          refundEvaluation: refundEval,
        };
      })
      .filter((u) => {
        if (search && !u.email.toLowerCase().includes(search)) return false;
        if (planFilter && planFilter !== 'all' && u.displayPlan.toLowerCase() !== planFilter && u.plan !== planFilter) {
          return false;
        }
        if (statusFilter === 'expired' && !u.isExpired) return false;
        if (statusFilter === 'active' && u.isExpired) return false;
        if (minAnalyses > 0 && u.analyses_used <= minAnalyses) return false;
        if (refundOnly && !u.refund_requested) return false;
        return true;
      })
      .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

    return res.status(200).json({
      success: true,
      admin: sessionEmail,
      totalUsers: users.length,
      failedWebhooks: getFailedWebhookLogs().slice(0, 50),
      users,
    });
  } catch (err: any) {
    console.error('/api/admin/users error:', err);
    return res.status(500).json({ error: err?.message || 'Admin query failed' });
  }
}
