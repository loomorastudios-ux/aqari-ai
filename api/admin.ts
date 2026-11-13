// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { PLANS, findPlanPricing, normalizePlanKey } from '../lib/plans';
import { buildPdfDocument } from '../lib/pdfGenerator';
import { buildDay29RenewalEmail, dispatchEmail } from '../lib/mailer';
import { getSessionEmailFromReq, isAdminEmail } from '../lib/security';
import {
  adminChangeUserPlan,
  computeServerLicenseStatus,
  evaluateRefundEligibility,
  getAllServerUsers,
  getEmailLogs,
  getFailedWebhookLogs,
  getOrCreateServerUser,
  getPricingChangeLogs,
  getPricingPublicPayload,
  getWebhookLogs,
  recordRefundDecision,
  updateLaunchDiscountSettings,
  updateServerPlanPricing,
} from '../lib/serverStore';

function getQueryParam(req: any, url: URL, key: string): string {
  const q = req.query?.[key];
  if (typeof q === 'string') return q;
  if (Array.isArray(q) && q[0]) return String(q[0]);
  return url.searchParams.get(key) || '';
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '/api/admin', `http://${req.headers?.host || 'localhost:3000'}`);
  const action = (
    getQueryParam(req, url, 'action') ||
    (req.body && typeof req.body === 'object' ? req.body.action : '') ||
    'users'
  )
    .toString()
    .trim()
    .toLowerCase();

  try {
    const sessionEmail = getSessionEmailFromReq(req);
    if (!isAdminEmail(sessionEmail)) {
      return res.status(403).json({
        error: 'Forbidden: Admin access restricted to owner account',
        code: 'ADMIN_FORBIDDEN',
      });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    switch (action) {
      // ------------------------------------------------------------------
      // 1. GET /api/admin?action=users
      // ------------------------------------------------------------------
      case 'users': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const search = getQueryParam(req, url, 'q').trim().toLowerCase();
        const planFilter = getQueryParam(req, url, 'plan').trim().toLowerCase();
        const statusFilter = getQueryParam(req, url, 'status').trim().toLowerCase();
        const minAnalyses = Number(getQueryParam(req, url, 'minAnalyses') || 0);
        const refundOnly = getQueryParam(req, url, 'refundRequested') === 'true';

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
            if (
              planFilter &&
              planFilter !== 'all' &&
              u.displayPlan.toLowerCase() !== planFilter &&
              u.plan !== planFilter
            ) {
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
      }

      // ------------------------------------------------------------------
      // 2. GET /api/admin?action=stats
      // ------------------------------------------------------------------
      case 'stats': {
        const allUsers = getAllServerUsers();
        let paidUsers = 0;
        let starterCount = 0;
        let proCount = 0;
        let enterpriseCount = 0;
        let freeCount = 0;
        let totalRevenueUSD = 0;
        let totalAnalysesUsed = 0;

        for (const u of allUsers) {
          const lic = computeServerLicenseStatus(u);
          totalAnalysesUsed += Number(u.analyses_used || 0);
          totalRevenueUSD += Number(u.total_paid_usd || 0);
          if (lic.planKey === 'starter') {
            paidUsers++;
            starterCount++;
          } else if (lic.planKey === 'pro') {
            paidUsers++;
            proCount++;
          } else if (lic.planKey === 'enterprise') {
            paidUsers++;
            enterpriseCount++;
          } else {
            freeCount++;
          }
        }

        const pricing = getPricingPublicPayload();
        const starterPrice = findPlanPricing(pricing, 'starter')?.activePrice || 79;
        const proPrice = findPlanPricing(pricing, 'pro')?.activePrice || 199;
        const entPrice = findPlanPricing(pricing, 'enterprise')?.activePrice || 599;
        const estimatedMrrUSD =
          starterCount * starterPrice + proCount * proPrice + enterpriseCount * entPrice;

        return res.status(200).json({
          success: true,
          admin: sessionEmail,
          stats: {
            totalUsers: allUsers.length,
            paidUsers,
            freeCount,
            planBreakdown: {
              free: freeCount,
              starter: starterCount,
              pro: proCount,
              enterprise: enterpriseCount,
            },
            totalRevenueUSD,
            estimatedMrrUSD,
            totalAnalysesUsed,
            webhookLogsCount: getWebhookLogs().length,
            failedWebhooksCount: getFailedWebhookLogs().length,
            emailLogsCount: getEmailLogs().length,
            pricingChangesCount: getPricingChangeLogs().length,
          },
        });
      }

      // ------------------------------------------------------------------
      // 3. GET /api/admin?action=pricing (or pricing-get)
      // ------------------------------------------------------------------
      case 'pricing':
      case 'pricing-get': {
        return res.status(200).json({
          success: true,
          pricing: getPricingPublicPayload(),
          logs: getPricingChangeLogs(),
        });
      }

      // ------------------------------------------------------------------
      // 4. POST /api/admin?action=pricing-update (or update_plan)
      // ------------------------------------------------------------------
      case 'pricing-update':
      case 'update_plan': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = req.body || {};
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
          originalPrice: body.originalPrice !== undefined ? Number(body.originalPrice) : undefined,
          launchPrice: body.launchPrice !== undefined ? Number(body.launchPrice) : undefined,
          analysesLimit: body.analysesLimit !== undefined ? Number(body.analysesLimit) : undefined,
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

      // ------------------------------------------------------------------
      // 5. POST /api/admin?action=toggle-discount (or toggle_launch_discount)
      // ------------------------------------------------------------------
      case 'toggle-discount':
      case 'toggle_launch_discount': {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }
        const body = req.body || {};
        const result = updateLaunchDiscountSettings({
          launchDiscountActive:
            typeof body.launchDiscountActive === 'boolean' ? body.launchDiscountActive : undefined,
          launchBadgeText: typeof body.launchBadgeText === 'string' ? body.launchBadgeText : undefined,
          countdownDays: body.countdownDays !== undefined ? Number(body.countdownDays) : undefined,
          adminEmail: sessionEmail!,
        });

        return res.status(200).json({
          success: true,
          pricing: result.pricing,
          log: result.log,
          logs: getPricingChangeLogs(),
        });
      }

      // ------------------------------------------------------------------
      // 6. GET/POST /api/admin?action=user&email=... | ?action=change-plan | ?action=refund-decision
      // ------------------------------------------------------------------
      case 'user':
      case 'change-plan':
      case 'refund-decision': {
        const rawEmail = (
          getQueryParam(req, url, 'email') ||
          req.params?.email ||
          req.body?.email ||
          ''
        )
          .toString()
          .trim();
        const targetEmail = decodeURIComponent(rawEmail).toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
          return res.status(400).json({ error: 'Valid target user email is required' });
        }

        if (req.method === 'GET' && action === 'user') {
          const user = getOrCreateServerUser(targetEmail);
          const license = computeServerLicenseStatus(user);
          const refundEvaluation = evaluateRefundEligibility(user);
          return res.status(200).json({
            success: true,
            user: {
              ...user,
              displayPlan: license.displayName,
              daysLeft: license.daysLeft,
              isExpired: license.isExpired,
              analysesLimit: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit,
              refundEvaluation,
            },
          });
        }

        if (req.method === 'POST') {
          const body = req.body || {};
          const op = (
            action === 'change-plan'
              ? 'change_plan'
              : action === 'refund-decision'
              ? 'refund_decision'
              : body.operation || body.subAction || (body.newPlan ? 'change_plan' : body.status ? 'refund_decision' : '')
          )
            .toString()
            .trim();

          if (op === 'change_plan') {
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

          if (op === 'refund_decision') {
            const status =
              body.status === 'approved' ? 'approved' : body.status === 'pending' ? 'pending' : 'denied';
            const updated = recordRefundDecision({
              email: targetEmail,
              status,
              notes: (body.notes || '').toString().trim(),
              actorEmail: sessionEmail!,
            });
            return res.status(200).json({ success: true, user: updated });
          }

          return res.status(400).json({ error: 'Invalid admin user operation' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ------------------------------------------------------------------
      // 7. GET /api/admin?action=export&email=...
      // ------------------------------------------------------------------
      case 'export': {
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const rawEmail = (getQueryParam(req, url, 'email') || req.params?.email || '').toString().trim();
        const targetEmail = decodeURIComponent(rawEmail).toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
          return res.status(400).json({ error: 'Valid target email is required' });
        }

        const user = getOrCreateServerUser(targetEmail);
        const license = computeServerLicenseStatus(user);
        const refundEval = evaluateRefundEligibility(user);
        const nowIso = new Date().toISOString();
        const latestPayment = user.payments[0];
        const purchaseDate = latestPayment
          ? latestPayment.timestamp
          : user.license_start
          ? new Date(user.license_start).toISOString()
          : 'N/A';

        const lines: string[] = [
          '=== ACCOUNT & SUBSCRIPTION RECORD ===',
          `Company: Loomora Studios (Owner: Hamed Al Shami, Oman) - AQARI TERMINAL`,
          `Customer Email: ${user.email}`,
          `Customer Name: ${user.name}`,
          `Current Plan: ${license.displayName} (${license.daysLeft} days left)`,
          `Purchase Date: ${purchaseDate}`,
          `Order ID: ${latestPayment ? latestPayment.order_id : 'N/A'}`,
          `Total Paid: $${user.total_paid_usd} USD`,
          `Locked Launch Price: ${user.locked_launch_price ? `$${user.locked_launch_price}` : 'N/A'}`,
          `Checkout Policy Accepted At: ${user.refund_policy_accepted_at || 'Recorded at checkout'}`,
          `Last Login: ${user.last_login_at ? new Date(user.last_login_at).toISOString() : 'N/A'}`,
          `Total Analyses Executed: ${user.analyses_used} / ${license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit}`,
          `Total PDF Memoranda Downloaded: ${user.pdf_downloads.length}`,
          '',
          '=== OFFICIAL REFUND POLICY & ELIGIBILITY VERDICT ===',
          'Refund ONLY within 5-7 days AND <=3 analyses. No refund after 7 days or >3 analyses or PDF download.',
          `System Evaluation Verdict: ${refundEval.verdict}`,
          `Days Since Purchase: ${refundEval.daysSincePurchase} | Analyses Run: ${refundEval.analysesCount} | PDF Downloads: ${refundEval.pdfDownloadsCount}`,
          '',
          '=== FULL ANALYSES EXECUTION LOG (TIMESTAMPED) ===',
        ];

        if (user.analyses_log.length === 0) {
          lines.push('No underwriting analyses logged for this account.');
        } else {
          user.analyses_log.forEach((a, idx) => {
            lines.push(
              `#${idx + 1} | ${a.timestamp} | ${a.property} (${a.city}) | $${a.priceUSD} | ${a.resultSummary}`
            );
          });
        }

        lines.push('');
        lines.push('=== FULL PDF MEMORANDUM DOWNLOAD LOG ===');
        if (user.pdf_downloads.length === 0) {
          lines.push('No PDF Memorandum downloads logged for this account.');
        } else {
          user.pdf_downloads.forEach((p, idx) => {
            lines.push(`#${idx + 1} | ${p.timestamp} | ${p.property} | Format: ${p.format.toUpperCase()}`);
          });
        }

        lines.push('');
        lines.push('=== CHRONOLOGICAL AUDIT TIMELINE ===');
        if (user.timeline.length === 0) {
          lines.push('No timeline events recorded yet.');
        } else {
          user.timeline.forEach((t) => {
            lines.push(`${t.timestamp} - ${t.message}`);
          });
        }

        const pdfBytes = buildPdfDocument({
          title: 'Loomora Studios - AQARI TERMINAL | Forensic Evidence Report',
          subtitle: `Official Payment & Usage Audit Dossier for Dispute / Court Review`,
          lines,
          watermark: `OFFICIAL DISPUTE EVIDENCE - Generated by Loomora Studios AQARI TERMINAL DB`,
          footer: `Generated from AQARI TERMINAL DB - ${nowIso} - This log is system-generated and cannot be edited by user.`,
        });

        const safeFile = targetEmail.replace(/[^a-z0-9._-]+/gi, '_');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="AQARI_Evidence_${safeFile}.pdf"`);
        res.end(Buffer.from(pdfBytes));
        return;
      }

      // ------------------------------------------------------------------
      // 8. GET/POST /api/admin?action=test-email-day29
      // ------------------------------------------------------------------
      case 'test-email-day29': {
        const body = req.body || {};
        const email = (
          getQueryParam(req, url, 'email') ||
          body.email ||
          'loomorastudios@gmail.com'
        )
          .toString()
          .trim()
          .toLowerCase();

        const userRecord = getOrCreateServerUser(email);
        const planKey = normalizePlanKey(
          (
            getQueryParam(req, url, 'plan') ||
            body.plan ||
            (userRecord.plan !== 'free' ? userRecord.plan : 'starter')
          ).toString()
        );
        const planCfg = PLANS[planKey];
        const name = (
          getQueryParam(req, url, 'name') ||
          body.name ||
          userRecord.name ||
          email.split('@')[0]
        ).toString();

        const rawLeft = getQueryParam(req, url, 'analyses_left') || body.analyses_left;
        const analysesLeft =
          rawLeft !== '' && rawLeft !== undefined
            ? rawLeft
            : Number.isFinite(planCfg.analysesLimit)
            ? Math.max(0, planCfg.analysesLimit - (userRecord.analyses_used || 0))
            : 'Unlimited';

        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endDateFormatted = tomorrow.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        const mail = buildDay29RenewalEmail({
          name,
          plan: planKey,
          endDateFormatted,
          analysesLeft,
        });

        const delivery = await dispatchEmail({
          to: email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          type: 'test_day29',
        });

        return res.status(200).json({
          success: true,
          message: `Day-29 renewal email processed for ${email}`,
          delivery,
        });
      }

      default:
        return res.status(400).json({
          error: `Unknown admin action '${action}'`,
          supportedActions: [
            'users',
            'stats',
            'pricing',
            'pricing-update',
            'toggle-discount',
            'user',
            'change-plan',
            'refund-decision',
            'export',
            'test-email-day29',
          ],
        });
    }
  } catch (err: any) {
    console.error(`/api/admin?action=${action} error:`, err);
    return res.status(500).json({ error: err?.message || 'Admin API error' });
  }
}
