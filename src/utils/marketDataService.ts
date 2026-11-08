import { CurrencyCode, MarketMatrixRow } from '../types';
import { 
  FALLBACK_CURRENCY_RATES, 
  FALLBACK_CROSS_BORDER_DATA, 
  CURRENCY_RATES,
  EXCHANGE_RATE_API_URL, 
  MARKET_DATA_URL, 
  PROPERTY_LISTINGS 
} from '../constants';

const FX_CACHE_KEY = 'aqari_fx_rates_cache';
const MARKET_CACHE_KEY = 'aqari_market_data_cache';

export async function fetchLiveExchangeRates(): Promise<Record<CurrencyCode, number>> {
  // Check 1h cache
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

export async function fetchMarketData(): Promise<MarketMatrixRow[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${MARKET_DATA_URL}?t=${Date.now()}`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
        return data;
      } else if (typeof data === 'object') {
        // Map object { muscat: {...}, dubai: {...} }
        const mapped: MarketMatrixRow[] = FALLBACK_CROSS_BORDER_DATA.map((row) => {
          const key = row.city.toLowerCase().replace(/\s+/g, '');
          const serverCity = data[key];
          if (serverCity) {
            return {
              ...row,
              basePriceSqMUSD: serverCity.pricePerM2 || serverCity.price_sqm || row.basePriceSqMUSD,
              avgGrossYield: serverCity.yield || serverCity.gross_yield || row.avgGrossYield,
              transferTaxPct: serverCity.transferTax ?? row.transferTaxPct,
              goldenVisaUSD: serverCity.goldenVisa ?? row.goldenVisaUSD,
            };
          }
          return row;
        });

        localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify({
          data: mapped,
          timestamp: Date.now(),
        }));
        return mapped;
      }
    }
  } catch (e) {
    // Check local storage fallback
    try {
      const cached = localStorage.getItem(MARKET_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.data) return parsed.data;
      }
    } catch {
      // Ignore
    }
  }

  return FALLBACK_CROSS_BORDER_DATA;
}
