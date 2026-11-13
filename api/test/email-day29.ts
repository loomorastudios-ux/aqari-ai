import { normalizePlanKey, PLANS } from '../../lib/plans';
import { buildDay29RenewalEmail, dispatchEmail } from '../../lib/mailer';
import { getOrCreateServerUser } from '../../lib/serverStore';

export default async function handler(req: any, res: any) {
  try {
    const query = req.query || {};
    const body = req.body || {};

    let email = (query.email || body.email || 'loomorastudios@gmail.com').toString().trim().toLowerCase();
    if (!email && req.url?.includes('?')) {
      const qs = new URLSearchParams(req.url.split('?')[1]);
      email = (qs.get('email') || 'loomorastudios@gmail.com').trim().toLowerCase();
    }

    const userRecord = getOrCreateServerUser(email);
    const planKey = normalizePlanKey(
      (query.plan || body.plan || (userRecord.plan !== 'free' ? userRecord.plan : 'starter')).toString()
    );
    const planCfg = PLANS[planKey];
    const name = (query.name || body.name || userRecord.name || email.split('@')[0]).toString();

    const analysesLeft =
      query.analyses_left ??
      body.analyses_left ??
      (Number.isFinite(planCfg.analysesLimit)
        ? Math.max(0, planCfg.analysesLimit - (userRecord.analyses_used || 0))
        : 'Unlimited');

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
  } catch (error: any) {
    console.error('/api/test/email-day29 error:', error);
    return res.status(500).json({ error: error?.message || 'Test Day-29 email failed' });
  }
}
