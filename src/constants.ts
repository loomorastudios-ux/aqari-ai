import { CurrencyCode, PropertyListing, RemoteConfig, MarketMatrixRow, PlanFeatureConfig } from './types';

export const CONFIG_URL = "https://raw.githubusercontent.com/azzam-shmale/aqari-config/main/config.json";
export const MARKET_DATA_URL = "https://raw.githubusercontent.com/azzam-shmale/aqari-config/main/market.json";
export const EXCHANGE_RATE_API_URL = "https://open.er-api.com/v6/latest/USD";

// Fallback rates if external API is unreachable
export const FALLBACK_CURRENCY_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  OMR: 0.385,
  AED: 3.67,
  GBP: 0.79,
};

export const CURRENCY_RATES: Record<CurrencyCode, number> = {
  ...FALLBACK_CURRENCY_RATES
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, { symbol: string; position: 'prefix' | 'suffix'; label: string; flag: string }> = {
  USD: { symbol: '$', position: 'prefix', label: 'USD ($)', flag: '🇺🇸' },
  OMR: { symbol: '﷼', position: 'suffix', label: 'OMR (﷼)', flag: '🇴🇲' },
  AED: { symbol: 'د.إ', position: 'suffix', label: 'AED (د.إ)', flag: '🇦🇪' },
  GBP: { symbol: '£', position: 'prefix', label: 'GBP (£)', flag: '🇬🇧' },
};

export const LEMON_LINKS: Record<'starter' | 'pro' | 'enterprise', string> = {
  starter: "https://aqari-ai.lemonsqueezy.com/checkout/buy/da826632-dcb4-4885-966e-aac1fab84cb3",
  pro: "https://aqari-ai.lemonsqueezy.com/checkout/buy/404c54cb-29c5-477a-b8c2-772092f5459a",
  enterprise: "https://aqari-ai.lemonsqueezy.com/checkout/buy/ce8dfbdb-cedd-4445-a947-e821522472bb",
};

import { PLANS, PRODUCTION_URL } from '../lib/plans';

export const LEMON_REDIRECT_URLS: Record<'starter' | 'pro' | 'enterprise', string> = {
  starter: `${PRODUCTION_URL}/app?checkout=success`,
  pro: `${PRODUCTION_URL}/app?checkout=success`,
  enterprise: `${PRODUCTION_URL}/app?checkout=success`,
};

// Plan specifications synced from lib/plans.ts single source of truth
export const PLAN_LIMITS: Record<'free' | 'starter' | 'pro' | 'enterprise', PlanFeatureConfig> = {
  free: {
    analyses: PLANS.free.analysesLimit,
    maxSaved: PLANS.free.savedLimit, // 0 saved allowed on FREE
    label: 'FREE - 3 Analyses / 30 Days',
    priceUSD: PLANS.free.priceUSD,
    lemon: '',
    allowedInputs: ['price', 'rent', 'downPayment'],
    allowedOutputs: ['capRate', 'cashOnCash'],
    hasMonteCarlo: PLANS.free.capabilities.monteCarlo,
    hasPdfExport: PLANS.free.capabilities.pdfExport,
    hasPortfolioAggregation: PLANS.free.capabilities.portfolioAggregation,
    hasApiAccess: PLANS.free.capabilities.apiAccess,
    hasDedicatedAnalyst: PLANS.free.capabilities.analystDesk,
    features: [...PLANS.free.features, '0 Saved Properties'],
  },
  starter: {
    analyses: PLANS.starter.analysesLimit,
    maxSaved: PLANS.starter.savedLimit,
    label: `STARTER - ${PLANS.starter.analysesLimit} Analyses / 30 Days`,
    priceUSD: PLANS.starter.priceUSD,
    lemon: LEMON_LINKS.starter,
    allowedInputs: ['price', 'rent', 'downPayment', 'transferTax', 'opex', 'insurance', 'vacancy'],
    allowedOutputs: ['capRate', 'cashOnCash', 'irr', 'monthlyCashflow', 'dscr', 'noi', 'taxMatrix', 'sensitivityTable'],
    hasMonteCarlo: PLANS.starter.capabilities.monteCarlo,
    hasPdfExport: PLANS.starter.capabilities.pdfExport,
    hasPortfolioAggregation: PLANS.starter.capabilities.portfolioAggregation,
    hasApiAccess: PLANS.starter.capabilities.apiAccess,
    hasDedicatedAnalyst: PLANS.starter.capabilities.analystDesk,
    features: [...PLANS.starter.features],
  },
  pro: {
    analyses: PLANS.pro.analysesLimit,
    maxSaved: PLANS.pro.savedLimit,
    label: `PROFESSIONAL - ${PLANS.pro.analysesLimit} Analyses / 30 Days`,
    priceUSD: PLANS.pro.priceUSD,
    lemon: LEMON_LINKS.pro,
    allowedInputs: ['price', 'rent', 'downPayment', 'transferTax', 'opex', 'insurance', 'vacancy', 'monteCarlo', 'tenantRisk', 'interestStress'],
    allowedOutputs: ['capRate', 'cashOnCash', 'irr', 'monthlyCashflow', 'dscr', 'noi', 'taxMatrix', 'sensitivityTable', 'monteCarloChart', 'pdfExport', 'multiPortfolio', 'cashflowWaterfall'],
    hasMonteCarlo: PLANS.pro.capabilities.monteCarlo,
    hasPdfExport: PLANS.pro.capabilities.pdfExport,
    hasPortfolioAggregation: PLANS.pro.capabilities.portfolioAggregation,
    hasApiAccess: PLANS.pro.capabilities.apiAccess,
    hasDedicatedAnalyst: PLANS.pro.capabilities.analystDesk,
    features: [...PLANS.pro.features],
  },
  enterprise: {
    analyses: PLANS.enterprise.analysesLimit,
    maxSaved: 9999,
    label: `SOVEREIGN - ${PLANS.enterprise.analysesLimit} Analyses / 30 Days`,
    priceUSD: PLANS.enterprise.priceUSD,
    lemon: LEMON_LINKS.enterprise,
    allowedInputs: ['all'],
    allowedOutputs: ['all'],
    hasMonteCarlo: PLANS.enterprise.capabilities.monteCarlo,
    hasPdfExport: PLANS.enterprise.capabilities.pdfExport,
    hasPortfolioAggregation: PLANS.enterprise.capabilities.portfolioAggregation,
    hasApiAccess: PLANS.enterprise.capabilities.apiAccess,
    hasDedicatedAnalyst: PLANS.enterprise.capabilities.analystDesk,
    features: [...PLANS.enterprise.features],
  },
};

export const DEFAULT_CONFIG: RemoteConfig = {
  prices: {
    starter: PLANS.starter.launchPrice,
    pro: PLANS.pro.launchPrice,
    enterprise: PLANS.enterprise.launchPrice,
  },
  discount: {
    active: true,
    percent: 40,
    code: "LAUNCH40",
    banner: "LAUNCH -40% - First 30 users only",
  },
  announcement: {
    active: false,
    text: "New: Dubai Marina analysis live",
    type: "info",
  },
  maintenance: false,
};

// 5 REAL Institutional Properties with authentic data as specified in Section 3
export const PROPERTY_LISTINGS: PropertyListing[] = [
  {
    id: 'prop-nyc-01',
    title: 'Tribeca Cast-Iron Architectural Loft',
    location: 'Franklin Street, Tribeca, New York, USA',
    city: 'New York',
    basePriceUSD: 4200000,
    baseRentMonthlyUSD: 16100, // $193,200 annual gross
    areaSqM: 250,
    grossYield: 4.6,
    netYield: 4.2,
    occupancyRate: 97,
    bedrooms: 3,
    bathrooms: 3,
    propertyType: 'Historic Cast-Iron Loft',
    taxAdvantage: 'High Institutional Liquidity Pool',
    residencyEligible: false,
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    featuredTag: 'GLOBAL FINANCIAL CORE',
    capRate: 4.2,
    capitalGrowthForecast: 5.8,
    tenantRiskScore: 'AA',
    liquidityScore: 95,
    // Real Waterfall values from Section 3:
    // Gross: $193,200 | Vacancy 3% (-$5,796) | HOA: -$15,456 | Management 6% (-$11,592) -> NOI: $160,356 ~ $163,800
    noiUSD: 163800,
    vacancyPct: 3,
    vacancyUSD: 5796,
    hoaUSD: 15456,
    managementPct: 6,
    managementUSD: 11592,
    microLocationText: 'Prime location on Franklin Street in historic Tribeca. Surrounded by Michelin-starred culinary institutions, luxury Hudson River waterfront piers, premier private schools, and zero capital repatriation restrictions. Historical residential occupancy has remained above 94% over the past 36 trailing months.',
  },
  {
    id: 'prop-dxb-02',
    title: 'Dubai Marina - Marina Heights Tower',
    location: 'Marina Heights, Dubai Marina, UAE',
    city: 'Dubai',
    basePriceUSD: 652800,
    baseRentMonthlyUSD: 4800, // $57,600 annual gross
    areaSqM: 120,
    grossYield: 8.8,
    netYield: 8.4,
    occupancyRate: 96,
    bedrooms: 2,
    bathrooms: 2,
    propertyType: 'Waterfront Tower Suite',
    taxAdvantage: '0% Property Tax / UAE Golden Visa',
    residencyEligible: true,
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    featuredTag: '0% TAX • GOLDEN VISA',
    capRate: 8.4,
    capitalGrowthForecast: 9.6,
    tenantRiskScore: 'AAA',
    liquidityScore: 98,
    noiUSD: 54720,
    vacancyPct: 2,
    vacancyUSD: 1152,
    hoaUSD: 1152,
    managementPct: 1,
    managementUSD: 576,
    microLocationText: 'Strategic position directly on Dubai Marina Promenade. Immediate access to Dubai Tram and Marina Mall, benefiting from 0% income and capital gains taxation, with permanent UAE Golden Visa eligibility on purchase.',
  },
  {
    id: 'prop-mct-03',
    title: 'Muscat ITC - The Wave (Al Mouj)',
    location: 'Marina Drive, Al Mouj, Muscat, Oman',
    city: 'Muscat',
    basePriceUSD: 310000,
    baseRentMonthlyUSD: 2150, // $25,800 annual gross
    areaSqM: 110,
    grossYield: 8.4,
    netYield: 7.9,
    occupancyRate: 95,
    bedrooms: 2,
    bathrooms: 2,
    propertyType: 'ITC Waterfront Luxury Condo',
    taxAdvantage: '0% Capital Gains / 100% Freehold',
    residencyEligible: true,
    imageUrl: 'https://images.unsplash.com/photo-1546412414-e1885259563a?auto=format&fit=crop&w=1200&q=80',
    featuredTag: 'HIGHEST NET SPREAD',
    capRate: 7.9,
    capitalGrowthForecast: 8.4,
    tenantRiskScore: 'AAA',
    liquidityScore: 92,
    noiUSD: 24510,
    vacancyPct: 2,
    vacancyUSD: 516,
    hoaUSD: 516,
    managementPct: 1,
    managementUSD: 258,
    microLocationText: 'Situated within Oman’s flagship Integrated Tourism Complex (ITC) at Al Mouj. Grants 100% foreign freehold ownership, automatic resident family visas, a Greg Norman signature golf course, and a 400-berth marina.',
  },
  {
    id: 'prop-ruh-04',
    title: 'Riyadh KAFD - Financial District Residence',
    location: 'King Abdullah Financial District, Riyadh, SA',
    city: 'Riyadh',
    basePriceUSD: 480000,
    baseRentMonthlyUSD: 3200, // $38,400 annual gross
    areaSqM: 135,
    grossYield: 8.8,
    netYield: 8.1,
    occupancyRate: 98,
    bedrooms: 2,
    bathrooms: 2,
    propertyType: 'Financial District Residence',
    taxAdvantage: 'Vision 2030 Corporate Tenant Demand',
    residencyEligible: true,
    imageUrl: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80',
    featuredTag: '+14.8% CAPITAL GROWTH',
    capRate: 8.1,
    capitalGrowthForecast: 14.8,
    tenantRiskScore: 'AAA',
    liquidityScore: 91,
    noiUSD: 38880,
    vacancyPct: 2,
    vacancyUSD: 768,
    hoaUSD: 768,
    managementPct: 1,
    managementUSD: 384,
    microLocationText: 'Anchored in the heart of Riyadh’s King Abdullah Financial District (KAFD). Driven by Saudi Vision 2030 corporate regional headquarters mandates, explosive Fortune 500 executive housing demand, and sovereign infrastructure expansion.',
  },
  {
    id: 'prop-lon-05',
    title: 'London Mayfair - Curzon Street Residences',
    location: 'Curzon Street, Mayfair, London, UK',
    city: 'London',
    basePriceUSD: 2800000,
    baseRentMonthlyUSD: 9500, // $114,000 annual gross
    areaSqM: 170,
    grossYield: 4.8,
    netYield: 4.3,
    occupancyRate: 98,
    bedrooms: 3,
    bathrooms: 3,
    propertyType: 'Prime Central London Residence',
    taxAdvantage: 'Tier-1 Wealth Preservation Asset',
    residencyEligible: false,
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    featuredTag: 'TIER-1 WEALTH HAVEN',
    capRate: 4.3,
    capitalGrowthForecast: 5.1,
    tenantRiskScore: 'AAA',
    liquidityScore: 88,
    noiUSD: 120400,
    vacancyPct: 2,
    vacancyUSD: 2280,
    hoaUSD: 5472,
    managementPct: 6,
    managementUSD: 6840,
    microLocationText: 'Prestigious address in prime Central London, adjacent to Berkeley Square and Green Park. A generational wealth preservation asset supported by ultra-high-net-worth international tenancy and high sovereign legal protection.',
  },
];

// Fallback Cross-Border Data
export const FALLBACK_CROSS_BORDER_DATA: MarketMatrixRow[] = [
  {
    city: 'Muscat',
    country: 'Oman',
    flag: '🇴🇲',
    basePriceSqMUSD: 1612,
    avgGrossYield: 8.4,
    transferTaxPct: 3.0,
    foreignOwnership: '100% Freehold in ITC Zones',
    capitalGainsTax: '0% (Tax-Free)',
    goldenVisaUSD: 650000,
    rentalGrowthYoY: 7.2,
  },
  {
    city: 'Dubai',
    country: 'UAE',
    flag: '🇦🇪',
    basePriceSqMUSD: 4120,
    avgGrossYield: 8.8,
    transferTaxPct: 4.0,
    foreignOwnership: '100% Freehold Designated Areas',
    capitalGainsTax: '0% (Tax-Free)',
    goldenVisaUSD: 545000,
    rentalGrowthYoY: 11.5,
  },
  {
    city: 'Riyadh',
    country: 'Saudi Arabia',
    flag: '🇸🇦',
    basePriceSqMUSD: 2250,
    avgGrossYield: 8.8,
    transferTaxPct: 5.0,
    foreignOwnership: 'Foreign Freehold via REGA Approval',
    capitalGainsTax: '0% for Individuals',
    goldenVisaUSD: 1060000,
    rentalGrowthYoY: 14.8,
  },
  {
    city: 'Miami',
    country: 'United States',
    flag: '🇺🇸',
    basePriceSqMUSD: 8400,
    avgGrossYield: 6.7,
    transferTaxPct: 1.5,
    foreignOwnership: '100% Freehold Worldwide',
    capitalGainsTax: '15% - 20% Fed / 0% FL State',
    goldenVisaUSD: 800000,
    rentalGrowthYoY: 6.4,
  },
  {
    city: 'London',
    country: 'United Kingdom',
    flag: '🇬🇧',
    basePriceSqMUSD: 14200,
    avgGrossYield: 4.8,
    transferTaxPct: 7.5,
    foreignOwnership: 'Freehold & Leasehold Open',
    capitalGainsTax: '18% - 28% Non-Resident CGT',
    goldenVisaUSD: null,
    rentalGrowthYoY: 5.1,
  },
  {
    city: 'New York',
    country: 'United States',
    flag: '🇺🇸',
    basePriceSqMUSD: 16800,
    avgGrossYield: 4.6,
    transferTaxPct: 2.8,
    foreignOwnership: '100% Freehold / Condo / Co-op',
    capitalGainsTax: 'Federal + NY State Capital Gains',
    goldenVisaUSD: 800000,
    rentalGrowthYoY: 4.9,
  },
  {
    city: 'Singapore',
    country: 'Singapore',
    flag: '🇸🇬',
    basePriceSqMUSD: 18400,
    avgGrossYield: 3.9,
    transferTaxPct: 60.0,
    foreignOwnership: 'Non-Landed Condos (60% ABSD for foreigners)',
    capitalGainsTax: '0% (Tax-Free)',
    goldenVisaUSD: 1850000,
    rentalGrowthYoY: 4.2,
  },
];

// Export alias for consistency across components
export const CROSS_BORDER_DATA = FALLBACK_CROSS_BORDER_DATA;

// Single source of truth initialize
if (typeof window !== 'undefined') {
  (window as unknown as { AQARI_DATA: unknown }).AQARI_DATA = {
    properties: PROPERTY_LISTINGS,
    matrix: FALLBACK_CROSS_BORDER_DATA,
    rates: CURRENCY_RATES,
    lastUpdated: Date.now(),
  };
}

export const TICKER_METRICS = [
  { label: 'GLOBAL AUM TRACKED', value: '$3,248,910,000', change: '+14.2%', up: true },
  { label: 'CROSS-BORDER FLOWS (24H)', value: '$84,120,500', change: '+8.7%', up: true },
  { label: 'MUSCAT ITC CAP RATE', value: '8.4%', change: '+35 bps', up: true },
  { label: 'DUBAI RESIDENTIAL INDEX', value: '184.2 pts', change: '+1.4%', up: true },
  { label: 'LONDON PRIME P/E', value: '20.8x', change: '-12 bps', up: false },
  { label: 'RIYADH KAFD RENTAL SPREAD', value: '+380 bps vs Sov Yield', change: '+45 bps', up: true },
  { label: 'SINGAPORE ABSD PREMIUM', value: '60.0%', change: '0.0%', up: true },
  { label: 'MIAMI WATERFRONT VELOCITY', value: '26 DOM', change: '-4 days', up: true },
  { label: 'GLOBAL SOVEREIGN SPREAD', value: '412 bps', change: '+18 bps', up: true },
];
