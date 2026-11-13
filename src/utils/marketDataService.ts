// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { CurrencyCode, MarketMatrixRow } from '../types';
import {
  FALLBACK_CURRENCY_RATES,
  CURRENCY_RATES,
  EXCHANGE_RATE_API_URL,
} from '../constants';
import {
  getDeterministicMarketData,
  LiveMarketResponse,
  LiveMarketCity,
} from '../../api/market/live';
import type { MarketNewsArticle } from '../../api/news';

const FX_CACHE_KEY = 'aqari_fx_rates_cache_v2';
const MARKET_CACHE_KEY = 'aqari_live_market_cache_v2';

export type { LiveMarketResponse, LiveMarketCity, MarketNewsArticle };

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
  } catch {
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
        localStorage.setItem(
          FX_CACHE_KEY,
          JSON.stringify({
            rates: liveRates,
            timestamp: Date.now(),
          })
        );
        return liveRates;
      }
    }
  } catch (err) {
    console.warn('Live FX fetch failed, using last cached/pegged rates', err);
  }

  return FALLBACK_CURRENCY_RATES;
}

/**
 * Single source of truth for live market metrics across 7 cities
 * GET /api/market/live (backed by World Bank, FRED, ExchangeRate API, DLD, ONS, JLL, Savills, IRAS, StreetEasy)
 */
export async function fetchLiveMarketData(): Promise<LiveMarketResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('/api/market/live', { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data: LiveMarketResponse = await res.json();
      if (data && Array.isArray(data.cities) && data.cities.length > 0) {
        if (data.macro?.fx_rates) {
          CURRENCY_RATES.OMR = data.macro.fx_rates.OMR || CURRENCY_RATES.OMR;
          CURRENCY_RATES.AED = data.macro.fx_rates.AED || CURRENCY_RATES.AED;
          CURRENCY_RATES.GBP = data.macro.fx_rates.GBP || CURRENCY_RATES.GBP;
        }
        try {
          localStorage.setItem(
            MARKET_CACHE_KEY,
            JSON.stringify({
              data,
              timestamp: Date.now(),
            })
          );
        } catch {}
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not reach /api/market/live, checking last cached snapshot', err);
  }

  try {
    const cached = localStorage.getItem(MARKET_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.data?.cities) {
        return { ...(parsed.data as LiveMarketResponse), stale: true };
      }
    }
  } catch {}

  return getDeterministicMarketData();
}

export async function fetchLiveNews(): Promise<{
  success: boolean;
  articles: MarketNewsArticle[];
  lastSyncedIso?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('/api/news', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const json = await res.json();
      if (json?.success && Array.isArray(json.articles) && json.articles.length > 0) {
        return json;
      }
    }
  } catch {}
  return { success: false, articles: [] };
}

export function mapLiveCitiesToMatrix(live: LiveMarketResponse): MarketMatrixRow[] {
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
    inflationPct: c.inflation_pct,
    benchmarkLabel: c.benchmark_label,
    source: c.source,
  }));
}

export async function fetchMarketData(): Promise<MarketMatrixRow[]> {
  const live = await fetchLiveMarketData();
  return mapLiveCitiesToMatrix(live);
}
