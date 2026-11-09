import { User } from '../types';
import { saveUser } from './userStorage';

/**
 * Placeholder function to connect to an external email service (SendGrid, Postmark, AWS SES, or LemonSqueezy Webhook)
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  console.log(`[AQARI EMAIL SERVICE] To: ${to} | Subject: "${subject}"\n${body}`);
  return true;
}

/**
 * Automatically checks if a user's subscription ends within 24 hours (and > 0).
 * If not already sent, sends the expiry email to the verified Gmail account and sets expiryEmailSent = true.
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
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const formattedExpiry = new Date(endsAt).toLocaleString();

    const subject = 'Your AQARI plan ends tomorrow';
    const body = `Dear ${user.name || 'Investor'},

Your AQARI ${user.plan.toUpperCase()} plan is scheduled to expire in approximately ${hoursRemaining} hours and ${minutesRemaining} minutes (on ${formattedExpiry}).

Exact Time Left: ${hoursRemaining}h ${minutesRemaining}m
Registered Verified Gmail: ${user.email}

To continue accessing institutional analyses, live radar feeds, and saved portfolios without interruption, please renew your plan now:
https://aqari-ai.vercel.app/#pricing

Best regards,
AQARI Global Terminal Team`;

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
