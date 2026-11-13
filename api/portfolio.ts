// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import {
  computeLicenseStatus,
  canUseFeature,
  getUpgradeMessage,
} from '../lib/plans';
import { getSessionEmailFromReq } from '../lib/security';
import { getOrCreateServerUser } from '../lib/serverStore';

export default async function handler(req: any, res: any) {
  try {
    const body = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const sessionEmail = getSessionEmailFromReq(req);
    const email = (sessionEmail || body.email || '').toString().trim().toLowerCase();
    if (!email) {
      return res.status(401).json({ error: 'Authentication required for portfolio aggregation' });
    }

    // SECURITY: Read authoritative plan strictly from server DB
    const userRecord = getOrCreateServerUser(email, {
      name: body.name,
    });

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
  } catch (error: any) {
    console.error('/api/portfolio error:', error);
    return res.status(500).json({ error: error?.message || 'Portfolio aggregation failed' });
  }
}
