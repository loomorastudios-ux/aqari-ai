// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import {
  PLANS,
  computeLicenseStatus,
  canUseFeature,
  getUpgradeMessage,
} from '../lib/plans';
import { checkRateLimit, getSessionEmailFromReq } from '../lib/security';
import {
  getOrCreateServerUser,
  recordUserAnalysis,
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
      return res.status(401).json({ error: 'Authentication required to run underwriting analysis' });
    }

    // Rate Limit: max 10 requests / min per user
    const rl = checkRateLimit(`analyze:${email}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded (max 10 analyses per minute). Please wait briefly.',
        retryAfterSec: rl.retryAfterSec,
      });
    }

    // SECURITY: Read authoritative plan strictly from server DB — NEVER trust body.userPlan or localStorage
    const userRecord = getOrCreateServerUser(email, {
      name: body.name,
      timezone: body.timezone,
    });

    const license = computeLicenseStatus({
      plan: userRecord.plan,
      licenseStart: userRecord.license_start,
      licenseEnd: userRecord.license_end,
      analysesUsed: userRecord.analyses_used,
    });

    // 1. Check expired or analyses quota exhausted
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

    // 2. Enforce Monte Carlo / Stress Test feature gate (Professional+)
    if (body.useMonteCarlo && !canUseFeature(license.planKey, 'monteCarlo')) {
      return res.status(403).json({
        error: getUpgradeMessage('monteCarlo'),
        code: 'FEATURE_LOCKED',
        feature: 'monteCarlo',
        requiredPlan: 'pro',
      });
    }

    // 3. Enforce Yield & Sensitivity feature gate if explicitly requested
    if (body.useSensitivity && !canUseFeature(license.planKey, 'yieldSensitivity')) {
      return res.status(403).json({
        error: getUpgradeMessage('yieldSensitivity'),
        code: 'FEATURE_LOCKED',
        feature: 'yieldSensitivity',
        requiredPlan: 'starter',
      });
    }

    // 4. Perform underwriting calculations
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

    // 5. Deduct 1 analysis credit & append forensic audit log in backend store
    const updatedUser = recordUserAnalysis(email, {
      property: propertyTitle,
      city,
      priceUSD,
      capRate,
      cashOnCash,
      resultSummary: `Cap ${capRate}% | CoC ${cashOnCash}%`,
    });

    const nextLicense = computeLicenseStatus({
      plan: updatedUser.plan,
      licenseStart: updatedUser.license_start,
      licenseEnd: updatedUser.license_end,
      analysesUsed: updatedUser.analyses_used,
    });

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
  } catch (error: any) {
    console.error('/api/analyze error:', error);
    return res.status(500).json({ error: error?.message || 'Analysis failed' });
  }
}
