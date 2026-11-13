// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.

export interface MarketNewsArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

const NEWS_CACHE_MS = 60 * 60 * 1000; // 1 hour
let cachedArticles: MarketNewsArticle[] = [];
let cachedNewsAt = 0;

function decodeXmlEntities(str: string): string {
  return (str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(xmlBlock: string, tag: string): string {
  const match = xmlBlock.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXmlEntities(match[1]) : '';
}

export async function fetchGoogleMarketNews(): Promise<{
  success: boolean;
  articles: MarketNewsArticle[];
  lastSyncedIso: string;
}> {
  const now = Date.now();
  if (cachedArticles.length > 0 && now - cachedNewsAt < NEWS_CACHE_MS) {
    return {
      success: true,
      articles: cachedArticles,
      lastSyncedIso: new Date(cachedNewsAt).toISOString(),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const rssUrl =
      'https://news.google.com/rss/search?q=global+real+estate+market+Dubai+London&hl=en-US&gl=US&ceid=US:en';
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AQARI-Terminal/1.0)',
      },
    });
    if (!res.ok) {
      return {
        success: cachedArticles.length > 0,
        articles: cachedArticles,
        lastSyncedIso: new Date(cachedNewsAt || now).toISOString(),
      };
    }

    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const parsed: MarketNewsArticle[] = [];

    for (const item of items.slice(0, 5)) {
      const title = extractTag(item, 'title');
      const link = extractTag(item, 'link');
      const pubDate = extractTag(item, 'pubDate');
      const source = extractTag(item, 'source') || 'Google News';
      if (title && link) {
        parsed.push({ title, link, pubDate, source });
      }
    }

    if (parsed.length > 0) {
      cachedArticles = parsed;
      cachedNewsAt = now;
      return {
        success: true,
        articles: parsed,
        lastSyncedIso: new Date(now).toISOString(),
      };
    }

    return {
      success: false,
      articles: [],
      lastSyncedIso: new Date(now).toISOString(),
    };
  } catch {
    return {
      success: cachedArticles.length > 0,
      articles: cachedArticles,
      lastSyncedIso: new Date(cachedNewsAt || now).toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}
