import { CurrencyCode, MarketMatrixRow } from '../types';
import { 
  FALLBACK_CURRENCY_RATES, 
  FALLBACK_CROSS_BORDER_DATA, 
  CURRENCY_RATES,
  EXCHANGE_RATE_API_URL 
} from '../constants';
import { getDeterministicMarketData, LiveMarketResponse, LiveMarketCity } from '../../api/market/live';

const FX_CACHE_KEY = 'aqari_fx_rates_cache';
const MARKET_CACHE_KEY = 'aqari_live_market_cache';

export type { LiveMarketResponse, LiveMarketCity };

export async function fetchLiveExchangeRates(): Promise<Record<CurrencyCode, number>> {
  try {
    const cached = localStorage.getItem(FX_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 3600000 && parsed.rates) {
        Object.assign(CURRENCY_RATES, parsed.rates);
        return parsed.rates;
      }
    }
  } catch (e) {
    // Ignore cache error
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(EXCHANGE_RATE_API_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) {
        const liveRates: Record<CurrencyCode, number> = {
          USD: 1,
          OMR: data.rates.OMR || FALLBACK_CURRENCY_RATES.OMR,
          AED: data.rates.AED || FALLBACK_CURRENCY_RATES.AED,
          GBP: data.rates.GBP || FALLBACK_CURRENCY_RATES.GBP,
        };

        Object.assign(CURRENCY_RATES, liveRates);
        localStorage.setItem(FX_CACHE_KEY, JSON.stringify({
          rates: liveRates,
          timestamp: Date.now(),
        }));

        if (typeof window !== 'undefined') {
          const win = window as unknown as { AQARI_DATA?: { rates: Record<CurrencyCode, number>; lastUpdated: number } };
          if (win.AQARI_DATA) {
            win.AQARI_DATA.rates = liveRates;
            win.AQARI_DATA.lastUpdated = Date.now();
          }
        }
        return liveRates;
      }
    }
  } catch (err) {
    console.warn('Live FX fetch failed, falling back to pegged rates', err);
  }

  return FALLBACK_CURRENCY_RATES;
}

/**
 * Single source of truth for live market metrics across 7 cities
 * GET /api/market/live
 */
export async function fetchLiveMarketData(): Promise<LiveMarketResponse> {
  // 1. Check in-memory/localStorage cache (valid for 5 minutes)
  try {
    const cached = localStorage.getItem(MARKET_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000 && parsed.data?.cities) {
        return parsed.data as LiveMarketResponse;
      }
    }
  } catch (e) {
    // Ignore
  }

  // 2. Fetch from /api/market/live
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('/api/market/live', { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data: LiveMarketResponse = await res.json();
      if (data && Array.isArray(data.cities) && data.cities.length > 0) {
        localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not reach /api/market/live, using deterministic client data', err);
  }

  // 3. Fallback to deterministic function
  const fallback = getDeterministicMarketData();
  try {
    localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify({
      data: fallback,
      timestamp: Date.now(),
    }));
  } catch (e) {
    // Ignore
  }
  return fallback;
}

/**
 * Returns MarketMatrixRow[] powered by the single source of truth
 */
export async function fetchMarketData(): Promise<MarketMatrixRow[]> {
  const live = await fetchLiveMarketData();
  
  const foreignOwnershipMap: Record<string, string> = {
    Muscat: '100% Freehold in ITC Zones',
    Dubai: '100% Freehold Designated Areas',
    Riyadh: 'Foreign Freehold via REGA Approval',
    Miami: '100% Freehold Worldwide',
    London: 'Freehold & Leasehold Open',
    'New York': '100% Freehold Worldwide',
    Singapore: 'Condominium Freehold / 60% ABSD',
  };

  const goldenVisaMap: Record<string, number | null> = {
    Muscat: 650000,
    Dubai: 545000,
    Riyadh: 1060000,
    Miami: 800000,
    London: null,
    'New York': 800000,
    Singapore: 7500000,
  };

  return live.cities.map((c) => ({
    city: c.city,
    country: c.country,
    flag: c.flag,
    basePriceSqMUSD: c.price_per_m2,
    avgGrossYield: c.gross_yield,
    transferTaxPct: c.transfer_tax,
    foreignOwnership: foreignOwnershipMap[c.city] || '100% Freehold Open',
    capitalGainsTax: c.capital_gains_tax,
    goldenVisaUSD: goldenVisaMap[c.city] ?? null,
    rentalGrowthYoY: c.rental_yoy,
  }));
}
