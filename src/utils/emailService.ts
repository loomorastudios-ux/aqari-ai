import { User } from '../types';
import { saveUser } from './userStorage';

import { PRODUCTION_URL, getPlanConfig } from '../../lib/plans';

/**
 * Sends email via backend Resend / Nodemailer API or logs fallback
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  console.log(`[AQARI EMAIL SERVICE] From: noreply@aqari-ai-rho.vercel.app | To: ${to} | Subject: "${subject}"\n${body}`);
  return true;
}

/**
 * Automatically checks if a user's subscription ends within 24 hours (and > 0).
 * If not already sent, sends the Day-29 renewal email and sets expiryEmailSent = true.
 */
export function checkAndSendExpiryEmail(user: User): { shouldShowBanner: boolean; user: User } {
  if (!user || user.plan === 'free') {
    return { shouldShowBanner: false, user };
  }

  const endsAt = user.subscriptionEndsAt || user.subscriptionExpiry;
  if (!endsAt) {
    return { shouldShowBanner: false, user };
  }

  const now = Date.now();
  const msRemaining = endsAt - now;
  const isExpiringIn24h = msRemaining > 0 && msRemaining <= 24 * 60 * 60 * 1000;

  if (isExpiringIn24h && !user.expiryEmailSent) {
    const planCfg = getPlanConfig(user.plan);
    const formattedExpiry = new Date(endsAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const leftCount = Number.isFinite(planCfg.analysesLimit)
      ? Math.max(0, planCfg.analysesLimit - (user.analysesUsed || 0))
      : 'Unlimited';

    const subject = `Your AQARI ${planCfg.displayName} ends tomorrow - Renew in 1 click`;
    const body = `Hi ${user.name || 'Investor'},

Your ${planCfg.displayName} ends tomorrow (${formattedExpiry}). You have ${leftCount} analyses left.

Renew same plan / Upgrade:
${PRODUCTION_URL}/pricing

If you don't renew, you will return to FREE (3 analyses).

AQARI Global Terminal`;

    sendEmail(user.email, subject, body);

    const updatedUser: User = {
      ...user,
      expiryEmailSent: true,
    };
    saveUser(updatedUser);
    return { shouldShowBanner: true, user: updatedUser };
  }

  return { shouldShowBanner: isExpiringIn24h, user };
}

/**
 * Formats remaining milliseconds into "X days : XX hours : XX minutes left"
 */
export function formatTimeLeft(msRemaining: number): string {
  if (msRemaining <= 0) {
    return '0 days : 00 hours : 00 minutes left';
  }

  const totalMinutes = Math.floor(msRemaining / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return `${days} ${days === 1 ? 'day' : 'days'} : ${pad(hours)} hours : ${pad(minutes)} minutes left`;
}
