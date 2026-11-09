export type CurrencyCode = 'USD' | 'OMR' | 'AED' | 'GBP';

export interface SavedAnalysis {
  id: string;
  property: string;
  city: string;
  price: number;
  rent: number;
  capRate: number;
  cashOnCash: number;
  irr: number;
  dscr: string;
  monthlyCashflow: number;
  riskScore: string;
  date: number;
  imageUrl?: string;
  notes?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  picture?: string;
  provider?: 'email' | 'google' | 'guest';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  freeAnalysesLeft?: number;
  freeAnalyses?: number; // fallback alias
  analysesLeft?: number;
  analysesUsed: number;
  subscriptionExpiry: number | null;
  subscriptionStartAt?: number | null;
  subscriptionEndsAt?: number | null;
  expiryEmailSent?: boolean;
  createdAt: number;
  lastLoginAt?: number;
  lastReminderDate?: string;
  savedAnalyses?: SavedAnalysis[];
  portfolio?: {
    totalValue: number;
    monthlyCashflow: number;
  };
}

export interface PlanFeatureConfig {
  analyses: number;
  maxSaved: number;
  label: string;
  priceUSD: number;
  lemon: string;
  allowedInputs: string[];
  allowedOutputs: string[];
  hasMonteCarlo: boolean;
  hasPdfExport: boolean;
  hasPortfolioAggregation: boolean;
  hasApiAccess: boolean;
  hasDedicatedAnalyst: boolean;
  features: string[];
}

export interface RemoteConfig {
  prices: {
    starter: number;
    pro: number;
    enterprise: number;
  };
  discount: {
    active: boolean;
    percent: number;
    code: string;
    banner: string;
  };
  announcement: {
    active: boolean;
    text: string;
    type: 'info' | 'warning' | 'success';
  };
  maintenance: boolean;
}

export interface PropertyListing {
  id: string;
  title: string;
  location: string;
  city: 'Muscat' | 'Dubai' | 'London' | 'Singapore' | 'New York' | 'Riyadh' | 'Miami';
  basePriceUSD: number;
  baseRentMonthlyUSD: number;
  areaSqM: number;
  grossYield: number;
  netYield: number;
  occupancyRate: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  taxAdvantage: string;
  residencyEligible: boolean;
  imageUrl: string;
  featuredTag?: string;
  capRate: number;
  capitalGrowthForecast: number;
  tenantRiskScore: 'AAA' | 'AA' | 'A' | 'BBB';
  liquidityScore: number;
  // Real waterfall breakdown values
  noiUSD: number;
  vacancyPct: number;
  vacancyUSD: number;
  hoaUSD: number;
  managementPct: number;
  managementUSD: number;
  microLocationText: string;
}

export interface MarketMatrixRow {
  city: string;
  country: string;
  flag: string;
  basePriceSqMUSD: number;
  avgGrossYield: number;
  transferTaxPct: number;
  foreignOwnership: string;
  capitalGainsTax: string;
  goldenVisaUSD: number | null;
  rentalGrowthYoY: number;
}
