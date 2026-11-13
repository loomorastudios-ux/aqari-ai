// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { getWebhookLogs, getEmailLogs, getFailedWebhookLogs } from '../../lib/serverStore';

export default async function handler(req: any, res: any) {
  try {
    const webhookLogs = getWebhookLogs();
    const emailLogs = getEmailLogs();
    const failedWebhooks = getFailedWebhookLogs();
    return res.status(200).json({
      success: true,
      testMode: process.env.LEMON_TEST_MODE === 'true' || process.env.VITE_LEMON_TEST_MODE === 'true',
      webhookLogs,
      failedWebhooks,
      emailLogs,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to retrieve logs' });
  }
}
