import { THIRTY_DAYS_MS } from '../../lib/plans';
import { computeServerLicenseStatus, getAllServerUsers, updateServerUser } from '../../lib/serverStore';
import { buildDay29RenewalEmail, buildExpiredEmail, dispatchEmail } from '../../lib/mailer';

function getLocalHourAndDate(timestamp: number, timeZone: string): { hour: number; dateStr: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Muscat',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date(timestamp));

    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    return {
      hour: Number(get('hour')),
      dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    const d = new Date(timestamp);
    return {
      hour: d.getUTCHours(),
      dateStr: d.toISOString().slice(0, 10),
    };
  }
}

export default async function handler(req: any, res: any) {
  try {
    const now = Date.now();
    const force = req.query?.force === 'true' || req.body?.force === true;
    const users = getAllServerUsers();

    let downgradedToFree = 0;
    let expiredEmailsSent = 0;
    let day29EmailsSent = 0;
    const actions: Array<{ email: string; action: string }> = [];

    for (const u of users) {
      if (u.plan === 'free' || !u.license_end) continue;

      // 1. If license_end passed -> downgrade to FREE, analyses_used = 0, send expired email
      if (now >= u.license_end) {
        const previousPlan = u.plan;
        updateServerUser(u.email, {
          plan: 'free',
          analyses_used: 0,
          license_start: now,
          license_end: now + THIRTY_DAYS_MS,
          expired_email_sent: true,
        });
        downgradedToFree++;

        if (!u.expired_email_sent) {
          const mail = buildExpiredEmail({ name: u.name || u.email.split('@')[0], previousPlan });
          await dispatchEmail({
            to: u.email,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            type: 'plan_expired',
          });
          expiredEmailsSent++;
        }
        actions.push({ email: u.email, action: `expired_downgraded_from_${previousPlan}_to_free` });
        continue;
      }

      // 2. Daily 09:00 UTC cron check for Day-29 renewal reminder (if license_end is tomorrow)
      const msLeft = u.license_end - now;
      const isTomorrow = msLeft > 0 && msLeft <= 36 * 60 * 60 * 1000;
      const tz = u.timezone || 'Asia/Muscat';
      const userEnd = getLocalHourAndDate(u.license_end, tz);
      const userTomorrow = getLocalHourAndDate(now + 24 * 60 * 60 * 1000, tz);
      const utcTomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const utcEnd = new Date(u.license_end).toISOString().slice(0, 10);

      const endsTomorrow =
        userEnd.dateStr === userTomorrow.dateStr ||
        utcEnd === utcTomorrow ||
        isTomorrow;

      if ((endsTomorrow || force) && !u.day29_email_sent) {
        const license = computeServerLicenseStatus(u);

        const formattedEnd = new Date(u.license_end).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

        const mail = buildDay29RenewalEmail({
          name: u.name || u.email.split('@')[0],
          plan: u.plan,
          endDateFormatted: formattedEnd,
          analysesLeft: license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLeft,
        });

        await dispatchEmail({
          to: u.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          type: 'day29_renewal',
        });

        updateServerUser(u.email, { day29_email_sent: true });
        day29EmailsSent++;
        actions.push({ email: u.email, action: `sent_day29_email_${u.plan}` });
      }
    }

    return res.status(200).json({
      success: true,
      checkedAt: new Date(now).toISOString(),
      processedUsers: users.length,
      downgradedToFree,
      expiredEmailsSent,
      day29EmailsSent,
      actions,
    });
  } catch (error: any) {
    console.error('/api/cron/check-expiry error:', error);
    return res.status(500).json({ error: error?.message || 'Cron execution failed' });
  }
}
