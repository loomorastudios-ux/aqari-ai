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

export interface CustomCityCard {
  id: string;
  city: string;
  country: string;
  countryCode?: string;
  estimatedAvgPriceUSD: number;
  estimatedAvgRentUSD: number;
  grossYield: number;
  source: string;
  isEstimated?: boolean;
  addedAt: number;
}

export interface AnalystMessage {
  id: string;
  sender: 'client' | 'admin';
  senderEmail?: string;
  text: string;
  timestamp: number | string;
  attachedAnalysis?: SavedAnalysis | null;
  attachedAnalysisId?: string;
  attachedAnalysisTitle?: string;
  attachedAnalysisSummary?: string;
  replyByDate?: string;
  deadline?: string | null;
  pdfSummary?: string | null;
  attachmentPdfNote?: string;
}

export interface AnalystThread {
  email: string;
  clientName?: string;
  plan?: string;
  status: 'Open' | 'Replied' | 'Closed';
  unreadForAdmin: number;
  unreadForClient: number;
  updatedAt: number;
  createdAt?: number;
  deadline?: string | null;
  messages: AnalystMessage[];
}

export interface WhiteGlovePropertyInput {
  id: string;
  title: string;
  city: string;
  currency: string;
  valuation?: number;
  monthlyRent?: number;
  equityPct?: number;
  ratePct?: number;
  opexPct?: number;
  spvNote?: string;
  priceUSD?: number;
  rentUSD?: number;
  downPaymentPct?: number;
  interestRatePct?: number;
  operatingExpensePct?: number;
  capRate?: number;
  monthlyCashflowUSD?: number;
  irr5Yr?: number;
}

export interface WhiteGloveDeliverable {
  id: string;
  requestId?: string;
  title: string;
  currency?: string;
  spvNote?: string;
  spvStructureNote?: string;
  riskNote?: string;
  summaryRecommendation?: string;
  properties: WhiteGlovePropertyInput[];
  combined?: {
    totalValuation: number;
    totalMonthlyRent: number;
    totalMonthlyCashflow: number;
    weightedCapRate: number;
    blendedCoC: number;
    blendedIrr5Yr: number;
    portfolioDscr: number;
  };
  combinedResults?: {
    totalValuationUSD: number;
    totalMonthlyRentUSD: number;
    totalMonthlyCashflowUSD: number;
    weightedCapRate: number;
    weightedIrr5Yr: number;
  };
  deliveredAt: number | string;
  deliveredBy?: string;
  preparedBy?: string;
}

export interface WhiteGloveRequest {
  id: string;
  email: string;
  clientName?: string;
  propertyTitle?: string;
  dealLink?: string;
  targetCity?: string;
  currency?: string;
  valuation?: number;
  expectedMonthlyRent?: number;
  goalNotes?: string;
  attachments?: string[];
  brief?: string;
  status: 'Pending' | 'In Progress' | 'Done';
  createdAt: number | string;
  updatedAt?: number | string;
  deliveredAt?: number | string;
  deliverable?: WhiteGloveDeliverable | null;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  picture?: string;
  provider?: 'email' | 'google' | 'guest';
  googleId?: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  planName?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN' | string;
  planPrice?: number;
  features?: string[];
  subscriptionPlan?: 'free' | 'starter' | 'pro' | 'enterprise' | string;
  subscriptionStatus?: 'active' | 'expired' | 'trial' | 'free' | 'cancelled' | 'past_due';
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
  lockedLaunchPrice?: number | null;
  savedAnalyses?: SavedAnalysis[];
  maxSaved?: number;
  savedCount?: number;
  apiKey?: string | null;
  customCities?: CustomCityCard[];
  analystUnread?: number;
  whiteGloveRequests?: WhiteGloveRequest[];
  whiteGloveDeliverables?: WhiteGloveDeliverable[];
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
  inflationPct?: number | null;
  benchmarkLabel?: string;
  source?: string;
}

