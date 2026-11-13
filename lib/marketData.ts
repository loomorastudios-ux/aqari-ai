// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.

export interface LiveMarketCity {
  city: string;
  country: string;
  countryIso3: string;
  flag: string;
  code: string;
  timezone: string;
  price_per_m2: number;
  gross_yield: number;
  transfer_tax: number;
  capital_gains_tax: string;
  golden_visa_tier: string;
  rental_yoy: number;
  inflation_pct: number | null;
  benchmark_label: string;
  source: string;
  last_updated: number;
}

export interface LiveMacroData {
  us_10y_yield: number;
  us_2y_yield: number;
  yield_curve_bps: number;
  inflation_by_country: Record<string, { value: number; year: string }>;
  fx_rates: Record<string, number>;
}

export interface LiveMarketResponse {
  cities: LiveMarketCity[];
  macro: LiveMacroData;
  metrics: {
    markets_tracked: number;
    sovereign_spread_bps: number;
    muscat_vs_us10y_bps: number;
    tax_havens: string;
    prime_yield_spread: string;
    fx_usd_omr: number;
    fx_usd_aed: number;
    fx_usd_gbp: number;
    us_10y_yield: number;
    dubai_dld_index: number;
  };
  sources: string[];
  last_updated: number;
  last_synced_iso: string;
  last_synced_display: string;
  cache_ttl_hours: number;
  stale: boolean;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let cachedMarketResponse: LiveMarketResponse | null = null;
let cachedAt = 0;

const OFFICIAL_CITIES = [
  {
    city: 'Muscat',
    country: 'Oman',
    countryIso3: 'OMN',
    flag: '🇴🇲',
    code: 'MCT',
    timezone: 'Asia/Muscat',
    price_per_m2: 1612,
    gross_yield: 8.4,
    transfer_tax: 3.0,
    capital_gains_tax: '0% (Tax-Free)',
    golden_visa_tier: '$650K',
    rental_yoy: 7.2,
    benchmark_label: 'ITC Cap Rate 8.4%',
    source: 'Savills Oman (Q1 2026)',
  },
  {
    city: 'Dubai',
    country: 'UAE',
    countryIso3: 'ARE',
    flag: '🇦🇪',
    code: 'DXB',
    timezone: 'Asia/Dubai',
    price_per_m2: 4120,
    gross_yield: 8.8,
    transfer_tax: 4.0,
    capital_gains_tax: '0% (Tax-Free)',
    golden_visa_tier: '$545K',
    rental_yoy: 11.5,
    benchmark_label: 'DLD Index 184.2 pts',
    source: 'Dubai Land Department (DLD Q1 2026)',
  },
  {
    city: 'Riyadh',
    country: 'Saudi Arabia',
    countryIso3: 'SAU',
    flag: '🇸🇦',
    code: 'RUH',
    timezone: 'Asia/Riyadh',
    price_per_m2: 2250,
    gross_yield: 8.8,
    transfer_tax: 5.0,
    capital_gains_tax: '0% for Individuals',
    golden_visa_tier: '$1.06M',
    rental_yoy: 14.8,
    benchmark_label: 'KAFD Rental +380 bps',
    source: 'JLL Riyadh (Q1 2026)',
  },
  {
    city: 'Miami',
    country: 'United States',
    countryIso3: 'USA',
    flag: '🇺🇸',
    code: 'MIA',
    timezone: 'America/New_York',
    price_per_m2: 8400,
    gross_yield: 6.7,
    transfer_tax: 1.5,
    capital_gains_tax: '15%-20% Fed / 0% FL State',
    golden_visa_tier: '$800K',
    rental_yoy: 6.4,
    benchmark_label: 'Brickell Gross 6.7%',
    source: 'Miami Realtors / FRED',
  },
  {
    city: 'London',
    country: 'United Kingdom',
    countryIso3: 'GBR',
    flag: '🇬🇧',
    code: 'LON',
    timezone: 'Europe/London',
    price_per_m2: 14200,
    gross_yield: 4.8,
    transfer_tax: 7.5,
    capital_gains_tax: '18%-28% Non-Resident',
    golden_visa_tier: 'None',
    rental_yoy: 5.8,
    benchmark_label: 'UK HPI 20.8x P/E',
    source: 'ONS UK House Price Index',
  },
  {
    city: 'New York',
    country: 'United States',
    countryIso3: 'USA',
    flag: '🇺🇸',
    code: 'NYC',
    timezone: 'America/New_York',
    price_per_m2: 16800,
    gross_yield: 4.6,
    transfer_tax: 2.0,
    capital_gains_tax: '20% Fed + NY State',
    golden_visa_tier: '$800K',
    rental_yoy: 4.9,
    benchmark_label: 'Tribeca 4.6% Gross',
    source: 'StreetEasy Manhattan Index',
  },
  {
    city: 'Singapore',
    country: 'Singapore',
    countryIso3: 'SGP',
    flag: '🇸🇬',
    code: 'SGP',
    timezone: 'Asia/Singapore',
    price_per_m2: 18400,
    gross_yield: 3.9,
    transfer_tax: 60.0,
    capital_gains_tax: '0% (Tax-Free)',
    golden_visa_tier: '$7.5M',
    rental_yoy: 3.5,
    benchmark_label: 'Foreign ABSD 60%',
    source: 'IRAS Singapore',
  },
];

async function fetchWorldBankInflation(): Promise<Record<string, { value: number; year: string }>> {
  const result: Record<string, { value: number; year: string }> = {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      'https://api.worldbank.org/v2/country/USA;ARE;GBR;SGP;SAU;OMN/indicator/FP.CPI.TOTL.ZG?format=json&mrnev=1',
      { signal: controller.signal }
    );
    if (!res.ok) return result;
    const json = await res.json();
    const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
    for (const row of rows) {
      const iso3 = row?.countryiso3code;
      const val = row?.value;
      const yr = row?.date;
      if (iso3 && typeof val === 'number') {
        result[iso3] = { value: Number(val.toFixed(2)), year: String(yr || '') };
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return result;
}

async function fetchFredSeriesLatest(seriesId: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    for (let i = lines.length - 1; i >= 1; i--) {
      const parts = lines[i].split(',');
      const num = parseFloat(parts[1]);
      if (Number.isFinite(num)) {
        return Number(num.toFixed(2));
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchExchangeRates(): Promise<Record<string, number> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.rates;
    if (!r) return null;
    return {
      USD: 1,
      OMR: Number((r.OMR || 0.385).toFixed(4)),
      AED: Number((r.AED || 3.6725).toFixed(4)),
      SAR: Number((r.SAR || 3.75).toFixed(4)),
      GBP: Number((r.GBP || 0.79).toFixed(4)),
      SGD: Number((r.SGD || 1.34).toFixed(4)),
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildResponse(params: {
  now: number;
  inflation: Record<string, { value: number; year: string }>;
  dgs10: number;
  dgs2: number;
  fxRates: Record<string, number>;
  stale: boolean;
}): LiveMarketResponse {
  const cities: LiveMarketCity[] = OFFICIAL_CITIES.map((c) => ({
    city: c.city,
    country: c.country,
    countryIso3: c.countryIso3,
    flag: c.flag,
    code: c.code,
    timezone: c.timezone,
    price_per_m2: c.price_per_m2,
    gross_yield: c.gross_yield,
    transfer_tax: c.transfer_tax,
    capital_gains_tax: c.capital_gains_tax,
    golden_visa_tier: c.golden_visa_tier,
    rental_yoy: c.rental_yoy,
    inflation_pct: params.inflation[c.countryIso3]?.value ?? null,
    benchmark_label: c.benchmark_label,
    source: c.source,
    last_updated: params.now,
  }));

  const muscat = cities.find((c) => c.city === 'Muscat')?.gross_yield || 8.4;
  const singapore = cities.find((c) => c.city === 'Singapore')?.gross_yield || 3.9;
  const spreadBps = Math.round((muscat - singapore) * 100);
  const muscatVsUs10yBps = Math.round((muscat - params.dgs10) * 100);
  const yieldCurveBps = Math.round((params.dgs10 - params.dgs2) * 100);
  const iso = new Date(params.now).toISOString();
  const display = new Date(params.now).toUTCString().replace(' GMT', ' UTC');

  return {
    cities,
    macro: {
      us_10y_yield: params.dgs10,
      us_2y_yield: params.dgs2,
      yield_curve_bps: yieldCurveBps,
      inflation_by_country: params.inflation,
      fx_rates: params.fxRates,
    },
    metrics: {
      markets_tracked: cities.length,
      sovereign_spread_bps: spreadBps,
      muscat_vs_us10y_bps: muscatVsUs10yBps,
      tax_havens: 'Oman & UAE (0% CGT)',
      prime_yield_spread: `${muscat}% vs ${singapore}%`,
      fx_usd_omr: params.fxRates.OMR || 0.385,
      fx_usd_aed: params.fxRates.AED || 3.6725,
      fx_usd_gbp: params.fxRates.GBP || 0.79,
      us_10y_yield: params.dgs10,
      dubai_dld_index: 184.2,
    },
    sources: ['World Bank', 'FRED', 'ExchangeRate-API', 'DLD', 'ONS', 'JLL', 'Savills', 'IRAS', 'StreetEasy'],
    last_updated: params.now,
    last_synced_iso: iso,
    last_synced_display: display,
    cache_ttl_hours: 6,
    stale: params.stale,
  };
}

export function getDeterministicMarketData(now = Date.now()): LiveMarketResponse {
  if (cachedMarketResponse) {
    return cachedMarketResponse;
  }
  return buildResponse({
    now,
    inflation: {
      OMN: { value: 1.1, year: '2025' },
      ARE: { value: 2.0, year: '2025' },
      SAU: { value: 1.8, year: '2025' },
      USA: { value: 2.8, year: '2025' },
      GBR: { value: 2.5, year: '2025' },
      SGP: { value: 2.3, year: '2025' },
    },
    dgs10: 4.28,
    dgs2: 4.12,
    fxRates: {
      USD: 1,
      OMR: 0.385,
      AED: 3.6725,
      SAR: 3.75,
      GBP: 0.79,
      SGD: 1.34,
    },
    stale: true,
  });
}

export async function getLiveMarketDataWithCache(forceRefresh = false): Promise<LiveMarketResponse> {
  const now = Date.now();
  if (!forceRefresh && cachedMarketResponse && now - cachedAt < CACHE_TTL_MS) {
    return cachedMarketResponse;
  }

  const [wbRes, dgs10Res, dgs2Res, fxRes] = await Promise.allSettled([
    fetchWorldBankInflation(),
    fetchFredSeriesLatest('DGS10'),
    fetchFredSeriesLatest('DGS2'),
    fetchExchangeRates(),
  ]);

  const anySuccess =
    (wbRes.status === 'fulfilled' && Object.keys(wbRes.value).length > 0) ||
    (dgs10Res.status === 'fulfilled' && dgs10Res.value !== null) ||
    (fxRes.status === 'fulfilled' && fxRes.value !== null);

  if (!anySuccess && cachedMarketResponse) {
    return {
      ...cachedMarketResponse,
      stale: true,
    };
  }

  const fallback = getDeterministicMarketData(now);
  const inflation =
    wbRes.status === 'fulfilled' && Object.keys(wbRes.value).length > 0
      ? { ...fallback.macro.inflation_by_country, ...wbRes.value }
      : cachedMarketResponse?.macro.inflation_by_country || fallback.macro.inflation_by_country;

  const dgs10 =
    dgs10Res.status === 'fulfilled' && dgs10Res.value !== null
      ? dgs10Res.value
      : cachedMarketResponse?.macro.us_10y_yield || fallback.macro.us_10y_yield;

  const dgs2 =
    dgs2Res.status === 'fulfilled' && dgs2Res.value !== null
      ? dgs2Res.value
      : cachedMarketResponse?.macro.us_2y_yield || fallback.macro.us_2y_yield;

  const fxRates =
    fxRes.status === 'fulfilled' && fxRes.value !== null
      ? fxRes.value
      : cachedMarketResponse?.macro.fx_rates || fallback.macro.fx_rates;

  const built = buildResponse({
    now,
    inflation,
    dgs10,
    dgs2,
    fxRates,
    stale: !anySuccess,
  });

  cachedMarketResponse = built;
  cachedAt = now;
  return built;
}
