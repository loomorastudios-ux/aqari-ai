export interface DemoAnalysisItem {
  slug: string;
  tier: 'Free' | 'Standard' | 'Pro' | 'Agency';
  title: string;
  subtitle: string;
  city: string;
  country: string;
  flag: string;
  propertyType: string;
  imageUrl: string;
  priceUSD: number;
  rentMonthlyUSD: number;
  areaSqM: number;
  grossYield: number;
  netYield: number;
  capRate: number;
  cashOnCash: number;
  irr5Yr: number;
  monthlyCashflowUSD: number;
  noiAnnualUSD: number;
  dscr: string;
  downPaymentPct: number;
  interestRatePct: number;
  taxStructure: string;
  goldenVisa: string;
  occupancyRate: number;
  tenantRisk: string;
  liquidityScore: number;
  featuresUnlocked: string[];
  featuresLocked: string[];
  watermarkNote: string;
  portfolioBreakdown?: Array<{
    asset: string;
    city: string;
    allocationPct: number;
    valueUSD: number;
    yieldPct: number;
  }>;
  monteCarlo?: {
    simulationsCount: number;
    positiveYieldProbabilityPct: number;
    rateShockStressBps: number;
    medianIRR: number;
  };
}

export const DEMO_ANALYSES: Record<string, DemoAnalysisItem> = {
  tribeca: {
    slug: 'tribeca',
    tier: 'Free',
    title: 'Tribeca Cast-Iron Architectural Loft',
    subtitle: 'Franklin Street, Historic Tribeca, New York',
    city: 'New York',
    country: 'United States',
    flag: '🇺🇸',
    propertyType: 'Historic Cast-Iron Luxury Loft',
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 4200000,
    rentMonthlyUSD: 16100,
    areaSqM: 250,
    grossYield: 4.6,
    netYield: 4.2,
    capRate: 4.2,
    cashOnCash: 3.8,
    irr5Yr: 8.6,
    monthlyCashflowUSD: 3240,
    noiAnnualUSD: 163800,
    dscr: '1.28',
    downPaymentPct: 30,
    interestRatePct: 6.25,
    taxStructure: 'Federal & NY State Ordinary Capital Gains',
    goldenVisa: 'EB-5 Eligible ($800K TEA)',
    occupancyRate: 97,
    tenantRisk: 'AA',
    liquidityScore: 95,
    featuresUnlocked: [
      'Basic Institutional Yield Calculator (Cap Rate, CoC, IRR)',
      'Monthly Net Cash Flow Projection',
      'Historic 36-Month Occupancy Trend',
      'Standard Currency Normalization (USD/OMR/AED/GBP)',
    ],
    featuresLocked: [
      'Cross-Border Tax Shield Modeling (Standard / Pro)',
      'Monte Carlo Rate-Shock Simulations (Pro / Agency)',
      'Multi-Asset Portfolio Stress Testing (Agency)',
      'Institutional PDF Memorandum Export (Pro / Agency)',
    ],
    watermarkNote: 'SAMPLE FREE TIER ANALYSIS • UNLOCK PRO FOR SENSITIVITY MATRIX & TAX SHIELDS',
  },

  'dubai-marina': {
    slug: 'dubai-marina',
    tier: 'Standard',
    title: 'Dubai Marina - Marina Heights Tower',
    subtitle: 'Waterfront Suite, Dubai Marina Promenade, UAE',
    city: 'Dubai',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    propertyType: 'High-Floor Waterfront Suite',
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 652800,
    rentMonthlyUSD: 4800,
    areaSqM: 120,
    grossYield: 8.8,
    netYield: 8.4,
    capRate: 8.4,
    cashOnCash: 11.2,
    irr5Yr: 15.6,
    monthlyCashflowUSD: 2840,
    noiAnnualUSD: 54720,
    dscr: '1.82',
    downPaymentPct: 30,
    interestRatePct: 5.2,
    taxStructure: '0% Capital Gains / 0% Rental Income Tax',
    goldenVisa: 'Permanent 10-Year UAE Golden Visa ($545K+)',
    occupancyRate: 96,
    tenantRisk: 'AAA',
    liquidityScore: 98,
    featuresUnlocked: [
      'Full OPEX, Vacancy & Service Charge Modeling',
      'Mortgage Amortization & DSCR Stress Testing',
      '5-Year Net IRR Capital Appreciation Projection',
      '0% UAE Freehold Tax Exemption Breakdown',
      'Up to 50 Saved Portfolio Properties',
    ],
    featuresLocked: [
      'Monte Carlo 200-Simulation Stochastic Engine (Pro)',
      'Interest Rate Shock (+200bps) Stress Test (Pro)',
      'PDF Investment Memorandum Generation (Pro)',
      'Real-Time Rest API & Multi-Jurisdiction Feeds (Agency)',
    ],
    watermarkNote: 'SAMPLE STANDARD TIER ANALYSIS • SIGN IN TO RUN UNLIMITED UNDERWRITINGS',
  },

  'muscat-wave': {
    slug: 'muscat-wave',
    tier: 'Pro',
    title: 'Muscat ITC - The Wave (Al Mouj)',
    subtitle: 'Marina Drive, Flagship Integrated Tourism Complex, Muscat, Oman',
    city: 'Muscat',
    country: 'Oman',
    flag: '🇴🇲',
    propertyType: 'ITC Waterfront Luxury Freehold Condo',
    imageUrl: 'https://images.unsplash.com/photo-1546412414-e1885259563a?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 310000,
    rentMonthlyUSD: 2150,
    areaSqM: 110,
    grossYield: 8.4,
    netYield: 7.9,
    capRate: 7.9,
    cashOnCash: 12.4,
    irr5Yr: 17.2,
    monthlyCashflowUSD: 1420,
    noiAnnualUSD: 24510,
    dscr: '2.14',
    downPaymentPct: 30,
    interestRatePct: 4.85,
    taxStructure: '0% Capital Gains / 0% Net Income Tax (Oman ITC Freehold)',
    goldenVisa: 'Oman Investor Residency Tier-1 ($650K Freehold)',
    occupancyRate: 95,
    tenantRisk: 'AAA',
    liquidityScore: 92,
    featuresUnlocked: [
      '400 Institutional Analyses per 30-Day Window',
      'Monte Carlo 200-Simulation Stochastic Engine',
      '+200bps Macro Interest Rate Stress Test',
      'Oman ITC 100% Foreign Freehold Title Deed Audit',
      'Complete Cash Flow Waterfall Breakdown',
      'High-Resolution PDF Investment Memorandum Generation',
    ],
    featuresLocked: [
      'Direct REST API Endpoints & Multi-User Desk (Agency)',
      'White-Glove Bespoke Syndicate Structuring (Agency)',
    ],
    monteCarlo: {
      simulationsCount: 200,
      positiveYieldProbabilityPct: 98.4,
      rateShockStressBps: 200,
      medianIRR: 16.8,
    },
    watermarkNote: 'SAMPLE PRO TIER ANALYSIS • INSTITUTIONAL WATERFALL & MONTE CARLO DEMO',
  },

  'london-mayfair': {
    slug: 'london-mayfair',
    tier: 'Pro',
    title: 'London Mayfair - Curzon Street Residences',
    subtitle: 'Curzon Street, Mayfair, Prime Central London, UK',
    city: 'London',
    country: 'United Kingdom',
    flag: '🇬🇧',
    propertyType: 'Prime Central London Generational Asset',
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 2800000,
    rentMonthlyUSD: 9500,
    areaSqM: 170,
    grossYield: 4.8,
    netYield: 4.3,
    capRate: 4.3,
    cashOnCash: 4.6,
    irr5Yr: 9.8,
    monthlyCashflowUSD: 2650,
    noiAnnualUSD: 120400,
    dscr: '1.45',
    downPaymentPct: 35,
    interestRatePct: 5.6,
    taxStructure: '18% - 28% Non-Resident Capital Gains + SDLT Stamp Duty Surcharge',
    goldenVisa: 'UK Innovator Founder Route (Alternative)',
    occupancyRate: 98,
    tenantRisk: 'AAA',
    liquidityScore: 88,
    featuresUnlocked: [
      'Stamp Duty Land Tax (SDLT) Cross-Border Surcharge Calculator',
      'Non-Resident CGT & Inheritance Tax Risk Modeling',
      'Monte Carlo Interest Rate Stress Sensitivity',
      'Downloadable PDF Investment Memorandum',
      'Save up to 200 Institutional Properties',
    ],
    featuresLocked: [
      'Direct REST API Endpoints & Syndicate Desk (Agency)',
    ],
    monteCarlo: {
      simulationsCount: 200,
      positiveYieldProbabilityPct: 94.6,
      rateShockStressBps: 200,
      medianIRR: 9.4,
    },
    watermarkNote: 'SAMPLE PRO TIER ANALYSIS • PRIME WEALTH PRESERVATION ASSET AUDIT',
  },

  'cross-border-portfolio': {
    slug: 'cross-border-portfolio',
    tier: 'Agency',
    title: 'GCC & UK Cross-Border Core-Plus Portfolio',
    subtitle: 'Syndicated Allocation: Muscat (45%) + Dubai (35%) + London (20%)',
    city: 'Multi-Jurisdiction',
    country: 'Oman / UAE / UK',
    flag: '🌐',
    propertyType: 'Diversified Cross-Border Core-Plus Syndicate',
    imageUrl: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 652400,
    rentMonthlyUSD: 4680,
    areaSqM: 400,
    grossYield: 8.6,
    netYield: 7.4,
    capRate: 7.4,
    cashOnCash: 12.8,
    irr5Yr: 16.4,
    monthlyCashflowUSD: 4680,
    noiAnnualUSD: 56160,
    dscr: '2.08',
    downPaymentPct: 30,
    interestRatePct: 5.1,
    taxStructure: 'Blended: 80% Zero-Tax Freehold (GCC) / 20% UK Core Hedge',
    goldenVisa: 'Dual UAE & Oman Investor Visa Eligible',
    occupancyRate: 96.5,
    tenantRisk: 'AAA',
    liquidityScore: 94,
    featuresUnlocked: [
      'Unlimited Underwriting Dossiers & Syndicate Aggregation',
      'Automated Cross-Border Currency Hedging (USD, OMR, AED, GBP)',
      'Multi-Jurisdiction Tax Shield Arbitrage (+360bps Yield Spread)',
      'Live REST API Access & Instant Webhook Feeds',
      'Dedicated 1-on-1 Analyst Desk & Custom White-Glove Modeling',
    ],
    featuresLocked: [],
    portfolioBreakdown: [
      { asset: 'Muscat ITC Luxury Freehold', city: 'Muscat', allocationPct: 45, valueUSD: 293580, yieldPct: 8.4 },
      { asset: 'Dubai Marina Waterfront Suite', city: 'Dubai', allocationPct: 35, valueUSD: 228340, yieldPct: 8.8 },
      { asset: 'London Mayfair Preservation Core', city: 'London', allocationPct: 20, valueUSD: 130480, yieldPct: 4.8 },
    ],
    watermarkNote: 'SAMPLE AGENCY TIER ANALYSIS • INSTITUTIONAL MULTI-ASSET PORTFOLIO',
  },

  'riyadh-singapore-portfolio': {
    slug: 'riyadh-singapore-portfolio',
    tier: 'Agency',
    title: 'Riyadh KAFD Growth & Singapore Core AAA Portfolio',
    subtitle: 'Institutional Pairing: Riyadh Vision 2030 (60%) + Singapore AAA Hub (40%)',
    city: 'Riyadh & Singapore',
    country: 'Saudi Arabia / Singapore',
    flag: '🇸🇦 🇸🇬',
    propertyType: 'High-Growth Corporate Core Institutional Pairing',
    imageUrl: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=1200&q=80',
    priceUSD: 1280000,
    rentMonthlyUSD: 7250,
    areaSqM: 320,
    grossYield: 6.8,
    netYield: 6.2,
    capRate: 6.2,
    cashOnCash: 9.6,
    irr5Yr: 15.2,
    monthlyCashflowUSD: 7250,
    noiAnnualUSD: 87000,
    dscr: '1.92',
    downPaymentPct: 35,
    interestRatePct: 4.95,
    taxStructure: '0% Individual Capital Gains (KAFD) + 0% CGT Singapore Freehold',
    goldenVisa: 'Saudi Premium Residency ($1.06M) + Singapore Global Investor ($7.5M)',
    occupancyRate: 98,
    tenantRisk: 'AAA',
    liquidityScore: 96,
    featuresUnlocked: [
      'Unlimited Institutional Analysis Access',
      'KAFD Vision 2030 Corporate Headquarters Demand Index',
      'Singapore USD-Pegged Wealth Preservation Arbitrage',
      'Real-Time Capital Flow Radar & Rebalancing Triggers',
      'Dedicated Syndicate Director Support',
    ],
    featuresLocked: [],
    portfolioBreakdown: [
      { asset: 'Riyadh KAFD Financial Residence', city: 'Riyadh', allocationPct: 60, valueUSD: 768000, yieldPct: 8.8 },
      { asset: 'Singapore Marina Bay Preservation Core', city: 'Singapore', allocationPct: 40, valueUSD: 512000, yieldPct: 3.9 },
    ],
    watermarkNote: 'SAMPLE AGENCY TIER ANALYSIS • SOVEREIGN GROWTH & WEALTH PRESERVATION PAIR',
  },
};
