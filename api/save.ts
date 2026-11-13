// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import {
  PLANS,
  computeLicenseStatus,
  canUseFeature,
} from '../lib/plans';
import { getSessionEmailFromReq } from '../lib/security';
import {
  getOrCreateServerUser,
  updateServerUser,
} from '../lib/serverStore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const sessionEmail = getSessionEmailFromReq(req);
    const email = (sessionEmail || body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(401).json({ error: 'Authentication required to save analyses' });
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
  } catch (error: any) {
    console.error('/api/save error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to save analysis' });
  }
}
