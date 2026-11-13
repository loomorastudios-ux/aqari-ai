// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import {
  checkRateLimit,
  clearSessionCookie,
  getClientIp,
  getSessionEmailFromReq,
  isAdminEmail,
  setSessionCookie,
} from '../../lib/security';
import { PLANS, findPlanPricing } from '../../lib/plans';
import {
  computeServerLicenseStatus,
  getOrCreateServerUser,
  getPricingPublicPayload,
  recordUserLogin,
} from '../../lib/serverStore';

export default async function handler(req: any, res: any) {
  try {
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
  } catch (err: any) {
    console.error('/api/auth/session error:', err);
    return res.status(500).json({ error: err?.message || 'Session error' });
  }
}
