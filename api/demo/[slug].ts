import { DEMO_ANALYSES } from '../../src/constants/demoAnalyses';

export default async function handler(req: any, res: any) {
  try {
    const slug = req.query?.slug || req.url?.split('/').pop()?.split('?')[0];

    if (!slug) {
      return res.status(200).json({
        available: Object.keys(DEMO_ANALYSES),
        count: Object.keys(DEMO_ANALYSES).length,
      });
    }

    const demo = DEMO_ANALYSES[slug];
    if (!demo) {
      return res.status(404).json({
        error: `Demo analysis '${slug}' not found`,
        available: Object.keys(DEMO_ANALYSES),
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      success: true,
      demo,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to fetch demo analysis' });
  }
}
