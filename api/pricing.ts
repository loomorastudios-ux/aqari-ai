// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { getPricingPublicPayload } from '../lib/serverStore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const payload = getPricingPublicPayload();
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('/api/pricing error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to load pricing' });
  }
}
