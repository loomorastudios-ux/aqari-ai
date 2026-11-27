export type CurrencyCode = 'USD' | 'OMR' | 'AED' | 'GBP';

export interface SavedAnalysis {
  id: string;
  property: string;
  city: string;
  price: number;
  rent: number;
  noi?: number;
  capRate: number;
  cashOnCash: number;
  irr: number | null;
  dscr: string | null;
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
  vacancyPct?: number;
  capRate?: number | null;
  monthlyCashflowUSD?: number | null;
  irr5Yr?: number | null;
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
    weightedCapRate: number | null;
    blendedCoC: number | null;
    blendedIrr5Yr: number | null;
    portfolioDscr: number | null;
  };
  combinedResults?: {
    totalValuationUSD: number;
    totalMonthlyRentUSD: number;
    totalMonthlyCashflowUSD: number;
    weightedCapRate: number | null;
    weightedIrr5Yr: number | null;
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

export interface CancellationEligibility {
  canCancel: boolean;
  rule: 'A' | 'B' | 'C' | 'D' | 'E' | 'PENDING_REVIEW' | string;
  reason: string;
  buttonText: string;
  daysSinceActivation: number;
  successfulAnalyses: number;
  hasReportedIssue: boolean;
  issueStatus: string;
  issueReportedAt?: number | null;
  issueResolvedAt?: number | null;
  refundableAmountUSD: number;
  lastOrderId?: string | null;
  cancelStatus?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  picture?: string;
  provider?: 'email' | 'google' | 'guest';
  googleId?: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise' | 'institutional';
  planName?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN' | 'ENTERPRISE' | string;
  planPrice?: number;
  features?: string[];
  subscriptionPlan?: 'free' | 'starter' | 'pro' | 'enterprise' | 'institutional' | string;
  subscriptionStatus?: 'active' | 'expired' | 'trial' | 'free' | 'cancelled' | 'past_due';
  freeAnalysesLeft?: number;
  freeAnalyses?: number; // fallback alias
  analysesLeft?: number;
  analysesTotal?: number;
  analysesUsed: number;
  successfulAnalyses?: number;
  extraCredits?: number;
  creditsBalance?: number;
  planAnalysesLeft?: number;
  packageExpired?: boolean;
  creditsOnlyMode?: boolean;
  day29Reminder?: boolean;
  expiryBanner?: string | null;
  expiryDateFormatted?: string | null;
  imagePdfUsed?: number;
  imagePdfLimit?: number;
  aiListingsUsed?: number;
  aiListingLimit?: number;
  pdfsUsed?: number;
  investmentPdfLimit?: number;
  portfolioAssetsLimit?: number;
  compareLimit?: number;
  teamUsersLimit?: number;
  apiDailyLimit?: number;
  apiCallsToday?: number;
  whiteLabelMode?: 'none' | 'reports' | 'full';
  whiteLabelEnabled?: boolean;
  customApiEnabled?: boolean;
  customAnalysesLimit?: number | null;
  customImagePdfLimit?: number | null;
  customListingsLimit?: number | null;
  customPortfolioLimit?: number | null;
  customSeats?: number | null;
  customStorageGb?: number | null;
  slaLevel?: string | null;
  contractEndDate?: string | null;
  branding?: {
    firmName?: string;
    logoUrl?: string;
    accentColor?: string;
  } | null;
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
  apiKeyLast4?: string | null;
  customCities?: CustomCityCard[];
  analystUnread?: number;
  whiteGloveRequests?: WhiteGloveRequest[];
  whiteGloveDeliverables?: WhiteGloveDeliverable[];
  hasReportedIssue?: boolean;
  issueReportedAt?: number | null;
  issueResolvedAt?: number | null;
  issueDescription?: string;
  issueStatus?: 'none' | 'reported' | 'resolved' | string;
  cancelStatus?: 'none' | 'refunded' | string;
  lastOrderId?: string | null;
  cancellationEligibility?: CancellationEligibility | null;
  status?: 'active' | 'expired' | 'exhausted' | string;
  locked?: boolean;
  lockReason?: 'expired' | 'exhausted' | string | null;
  lockError?: string | null;
  paymentProvider?: string;
  paymentIntentId?: string | null;
  lastResults?: LastResultsData | null;
  portfolioAssets?: PortfolioAssetPostPurchase[];
  portfolio?: {
    totalValue: number;
    monthlyCashflow: number;
  };
}

export interface LastResultsData {
  analysis?: {
    inputs: {
      propertyTitle: string;
      city: string;
      country?: string;
      countryCode?: string;
      currency?: string;
      priceUSD: number;
      rentUSD: number;
      downPaymentPct: number;
      interestRatePct: number;
      operatingExpensePct: number;
      loanTermYears?: number;
      amortizationYears?: number;
      vacancyRatePct?: number;
      managementPct?: number;
      propertyTaxUSD?: number;
      insuranceUSD?: number;
      maintenanceReserveUSD?: number;
      hoaUSD?: number;
      closingCostsPct?: number;
      rentGrowthPct?: number;
      expenseGrowthPct?: number;
      appreciationPct?: number;
      exitCapRatePct?: number;
      sellingCostsPct?: number;
      noExitValue?: boolean;
    };
    cityData?: any;
    results: {
      capRate: number | null;
      capRateReason?: string | null;
      grossYieldPct?: number | null;
      netYieldPct?: number | null;
      cashOnCash: number | null;
      cashOnCashReason?: string | null;
      irr5Yr: number | null;
      irrStatus?: 'ok' | 'negative_cashflows' | 'no_exit_value' | 'insufficient_data';
      irrError?: string | null;
      dscr: string | null;
      dscrNumeric?: number | null;
      dscrReason?: string | null;
      ltvPct?: number | null;
      equityMultiple?: number | null;
      roiPct?: number | null;
      appreciationUSD?: number | null;
      monthlyCashflowUSD: number | null;
      monthlyCashflowReason?: string | null;
      annualCashflowUSD?: number | null;
      monthlyMortgageUSD: number | null;
      netOperatingIncomeUSD: number | null;
      noiReason?: string | null;
      annualGrossRentUSD: number | null;
      annualOPEXUSD: number | null;
      annualDebtServiceUSD: number | null;
      downPaymentUSD: number;
      closingCostsUSD?: number;
      totalEquityInvestedUSD?: number;
      loanAmountUSD?: number;
      exitGrossValueUSD?: number | null;
      sellingCostsUSD?: number | null;
      remainingLoanYr5USD?: number;
      netExitProceedsUSD?: number | null;
      noiBreakdown?: {
        grossRentAnnualUSD: number;
        vacancyLossUSD: number;
        effectiveGrossIncomeUSD: number;
        baseOpexUSD: number;
        managementFeeUSD: number;
        propertyTaxUSD: number;
        insuranceUSD: number;
        maintenanceReserveUSD: number;
        hoaUSD: number;
        annualOperatingExpensesUSD?: number;
        totalExpensesUSD: number;
        noiUSD: number;
      } | null;
      yearByYear?: Array<{
        year: number;
        grossRentUSD: number;
        vacancyLossUSD: number;
        effectiveGrossIncomeUSD: number;
        operatingExpensesUSD: number;
        noiUSD: number;
        debtServiceUSD: number;
        netCashflowUSD: number;
        remainingLoanUSD: number;
        dscr: number | null;
        cumulativeIrrPct: number | null;
      }>;
      metrics?: Record<string, { value: number | null; reason?: string; assumptions: string[] }>;
      assumptions?: string[];
      warnings?: string[];
      sensitivity: any[] | null;
      monteCarlo: any | null;
    };
    created_at: string;
  } | null;
  deal_finder?: {
    inputs: {
      city: string;
      budget: number;
      minCapRate: number;
      propertyType: string;
      risk: string;
    };
    city: string;
    country: string;
    countryCode?: string;
    avgCapRate?: number;
    sourceType?: string;
    disclaimer?: string;
    deals: DealFinderDeal[];
    created_at: string;
  } | null;
  forecast?: {
    inputs: {
      city: string;
      propertyType: string;
      period: string;
    };
    forecast: MarketForecastResult;
    created_at: string;
  } | null;
  due_diligence?: {
    inputs: {
      city: string;
      propertyType: string;
      price: number;
      monthlyRent: number;
      ownershipType: string;
      buildingAge: number;
    };
    result: DueDiligenceResult;
    created_at: string;
  } | null;
  portfolio_optimizer?: {
    inputs: {
      totalCapital: number;
      cities: string[];
      risk: string;
    };
    result: PortfolioOptimizerResult;
    created_at: string;
  } | null;
  advisor?: {
    inputs: {
      question: string;
      city: string;
      budget: number;
    };
    result: AdvisorResult;
    created_at: string;
  } | null;
  file_analysis?: FileAnalysisReport | null;
  property_studio?: PropertyStudioDraft | null;
  due_diligence_docs?: DocumentDueDiligenceResult | null;
  scenario_comparison?: {
    scenarios: ScenarioCompareOutput[];
    created_at: string;
  } | null;
}

export interface PlanFeatureConfig {
  analyses: number;
  maxSaved: number;
  imagePdfLimit: number;
  aiListingLimit: number;
  investmentPdfLimit: number;
  portfolioAssetsLimit: number;
  compareLimit: number;
  teamUsersLimit: number;
  apiDailyLimit: number;
  label: string;
  priceUSD: number;
  checkoutUrl: string;
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
    institutional?: number;
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
  isEnterpriseShowcase?: boolean;
  pricePerSqMUSD?: number;
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
  updatedDate?: string;
  dataType?: 'Actual' | 'Estimated' | 'Demo';
  taxSource?: string;
  taxVerifiedDate?: string;
}

export interface DealFinderDeal {
  id: string;
  name: string;
  city: string;
  country: string;
  propertyType: 'Apartment' | 'Villa' | 'Commercial' | string;
  price: number;
  rent: number;
  capRate: number;
  cashOnCash: number;
  irr: number | null;
  dscr: string | null;
  monthlyCashflow: number;
  downPaymentPct: number;
  interestRatePct: number;
  operatingExpensePct: number;
  vacancyRatePct?: number;
  risk: 'Low' | 'Medium' | 'High' | string;
  score: number;
}

export interface MarketForecastSeriesPoint {
  label: string;
  capRate: number;
  rentGrowthPct: number;
  priceGrowthPct: number;
  rentIndex: number;
  priceIndex: number;
}

export interface MarketForecastResult {
  city: string;
  country: string;
  propertyType: 'Apartment' | 'Villa' | 'Commercial' | string;
  period: '12 months' | '3 years' | '5 years' | string;
  currentAvgCapRate: number;
  forecastCap12M: number;
  forecastCap3Y: number;
  forecastCap5Y: number;
  rentGrowth12M: number;
  priceGrowth12M: number;
  rentGrowthSelected: number;
  priceGrowthSelected: number;
  confidence: 'High' | 'Medium' | 'Low' | string;
  recommendation: 'Buy' | 'Hold' | 'Wait' | string;
  series: MarketForecastSeriesPoint[];
  modelSpec?: {
    modelName: string;
    dataType: string;
    methodologySummary: string;
    formulas: string[];
    baselineSource: string;
    updatedDate: string;
  };
  historicalBaseline?: {
    cityAvgCapRate: number;
    historicalPriceIndex: Array<{ year: string; index: number }>;
    source: string;
    updatedDate: string;
    dataType: string;
  };
  disclaimer: string;
}

export interface DueDiligenceCheckItem {
  id: string;
  category: 'Legal Risk' | 'Financial Risk' | 'Market Risk' | string;
  item: string;
  status: 'Pass' | 'Warning' | 'Fail';
  note: string;
}

export interface DueDiligenceResult {
  id: string;
  city: string;
  country: string;
  countryCode?: string;
  propertyType: 'Apartment' | 'Villa' | 'Commercial' | string;
  ownershipType: 'Freehold' | 'Leasehold' | string;
  buildingAge: number;
  price: number;
  monthlyRent: number;
  propertyCapRate: number;
  cityAvgCapRate: number;
  marketAvgRent: number;
  estimatedOpexPct: number;
  estVacancyPct: number;
  estPriceGrowthPct: number;
  riskScore: number;
  verdict: 'Low Risk - Proceed' | 'Medium Risk - Verify Items' | 'High Risk - Do Not Proceed' | string;
  checklist: DueDiligenceCheckItem[];
  disclaimer: string;
  generatedAt: string;
}

export interface PortfolioAllocationRow {
  city: string;
  country: string;
  countryCode?: string;
  allocationPct: number;
  amountUSD: number;
  estCapRate: number;
  estAnnualRentUSD: number;
}

export interface PortfolioOptimizerResult {
  id: string;
  totalCapital: number;
  risk: 'Low' | 'Medium' | 'High' | string;
  cities: string[];
  allocations: PortfolioAllocationRow[];
  totalEstAnnualIncomeUSD: number;
  blendedCapRate: number;
  diversificationScore: number;
  disclaimer: string;
  generatedAt: string;
}

export interface AdvisorResult {
  id: string;
  question: string;
  city: string;
  country: string;
  countryCode?: string;
  budget: number;
  cityAvgCapRate: number;
  estAnnualIncomeUSD: number;
  estMonthlyIncomeUSD: number;
  recommendation: 'Buy' | 'Hold' | 'Wait' | string;
  headline: string;
  reasoning: string[];
  riskFactors: string[];
  nextSteps: string[];
  disclaimer: string;
  generatedAt: string;
}

export type FieldProvenanceTag = 'Extracted' | 'AI Estimated' | 'User Confirmed' | 'Missing';

export interface ExtractedFilePropertyDraft {
  fileName: string;
  mimeType: string;
  isImageOnly: boolean;
  propertyTitle: string;
  locationText: string;
  city: string;
  country: string;
  propertyType: 'Apartment' | 'Villa' | 'Commercial' | 'Land' | 'Hotel';
  areaSqM: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  priceUSD: number | null;
  monthlyRentUSD: number | null;
  annualOpexUSD: number | null;
  hoaUSD: number | null;
  propertyTaxUSD: number | null;
  vacancyRatePct: number | null;
  extractedQuotes: Record<string, string>;
  provenance: Record<string, FieldProvenanceTag>;
  missingFields: string[];
  imagePriceWarning: string;
  aiSummary: string;
}

export interface FileAnalysisReport {
  id: string;
  fileName: string;
  isImageOnly: boolean;
  inputs: {
    propertyTitle: string;
    city: string;
    country: string;
    propertyType: string;
    areaSqM: number;
    bedrooms: number;
    bathrooms: number;
    priceUSD: number;
    rentUSD: number;
    downPaymentPct: number;
    interestRatePct: number;
    operatingExpensePct: number;
    hoaUSD: number;
    propertyTaxUSD: number;
    vacancyRatePct: number;
  };
  provenance: Record<string, FieldProvenanceTag>;
  extractedQuotes: Record<string, string>;
  results: NonNullable<LastResultsData['analysis']>['results'];
  marketContext: {
    cityAvgCapRate: number;
    marketAvgPriceSqM: number;
    rentGrowthYoY: number;
    transferTaxPct: number;
    capitalGainsTax: string;
    source: string;
    updatedDate: string;
  };
  riskScore: number;
  verdict: string;
  warnings: string[];
  imagePriceWarning: string;
  createdAt: string;
}

export interface PropertyStudioDraft {
  id?: string;
  docType: 'listing' | 'memorandum';
  isVirtual: boolean;
  title: string;
  country: string;
  city: string;
  areaDistrict: string;
  propertyType: 'Apartment' | 'Villa' | 'Commercial' | 'Land' | 'Hotel';
  budgetUSD: number;
  areaSqM: number;
  bedrooms: number;
  bathrooms: number;
  expectedMonthlyRentUSD: number;
  targetYieldPct: number;
  finishing: 'Shell & Core' | 'Standard' | 'Luxury' | 'Ultra-Prime Turnkey';
  amenities: string[];
  targetAudience: string;
  description: string;
  locationNarrative: string;
  investmentHighlights: string[];
  riskNotes: string[];
  isRentYieldReliable: boolean;
  rentYieldBasisNote: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactFirm: string;
  aiEnhanced?: boolean;
  generatedAt?: string;
}

export interface PortfolioAssetPostPurchase {
  id: string;
  property: string;
  city: string;
  country: string;
  cluster: string;
  lat: number;
  lng: number;
  purchaseDate: string;
  purchasePriceUSD: number;
  currentValueUSD: number;
  forecastRentMonthlyUSD: number;
  actualRentMonthlyUSD: number;
  forecastYieldPct: number;
  actualYieldPct: number;
  loanBalanceUSD: number;
  monthlyDebtServiceUSD: number;
  loanMaturityDate: string;
  interestRatePct: number;
  demandScore: number;
  mobilityScore: number;
  climateScore: number;
  esgScore: number;
  overallScore: number;
  climateFlags: string[];
  riskAlerts: string[];
  notes?: string;
  updatedAt: string;
}

export interface DocumentDueDiligenceItem {
  field: string;
  docType: 'Lease' | 'Title Deed' | 'Valuation' | 'Service Fees' | 'Legal';
  extractedValue: string;
  modelValue: string;
  status: 'Match' | 'Contradiction' | 'Missing' | 'Verified';
  sourceCitation: string;
  severity: 'High' | 'Medium' | 'Low';
  note: string;
}

export interface DocumentDueDiligenceResult {
  id: string;
  documentsScanned: Array<{ fileName: string; docType: string }>;
  overallComplianceScore: number;
  contradictionsCount: number;
  missingCount: number;
  verdict: string;
  items: DocumentDueDiligenceItem[];
  extractedSummary: Record<string, { value: string; source: string }>;
  missingDocumentsOrClauses: string[];
  disclaimer: string;
  generatedAt: string;
}

export interface ScenarioCompareInput {
  id: string;
  label: string;
  city: string;
  priceUSD: number;
  monthlyRentUSD: number;
  downPaymentPct: number;
  interestRatePct: number;
  operatingExpensePct: number;
}

export interface ScenarioCompareOutput {
  id: string;
  label: string;
  city: string;
  country: string;
  priceUSD: number;
  monthlyRentUSD: number;
  noiUSD: number | null;
  capRate: number | null;
  netYieldPct: number | null;
  cashOnCash: number | null;
  irr5Yr: number | null;
  dscr: string | null;
  monthlyDebtServiceUSD: number;
  monthlyCashflowUSD: number | null;
  ltvPct: number;
  transferTaxPct: number;
  capitalGainsTax: string;
  goldenVisaUSD: number | null;
  riskScore: number;
  liquidityScore: number;
  taxSource: string;
}

export type WorkspaceRole = 'Analyst' | 'Manager' | 'Admin';

export interface WorkspaceMember {
  email: string;
  name: string;
  role: WorkspaceRole;
  addedAt: string;
  addedBy: string;
}

export interface WorkspaceComment {
  id: string;
  dealId: string;
  authorEmail: string;
  authorRole: WorkspaceRole;
  text: string;
  createdAt: string;
}

export interface WorkspaceSharedDeal {
  id: string;
  title: string;
  city: string;
  priceUSD: number;
  rentUSD: number;
  capRate: number;
  irr5Yr: number | null;
  dscr: string | null;
  status: 'Under Review' | 'IC Approved' | 'On Hold' | 'Rejected';
  sharedBy: string;
  sharedAt: string;
  notes?: string;
}

export interface WorkspaceAuditEntry {
  id: string;
  actorEmail: string;
  actorRole: WorkspaceRole;
  action: string;
  target: string;
  detail: string;
  timestamp: string;
}

export interface EnterpriseOrganization {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: string;
  members: WorkspaceMember[];
  sharedDeals: WorkspaceSharedDeal[];
  comments: WorkspaceComment[];
  auditTrail: WorkspaceAuditEntry[];
}

export interface GlobalMarketIntelCity {
  city: string;
  country: string;
  flag: string;
  rentGrowthYoY: number;
  rentGrowthSource: string;
  rentGrowthDate: string;
  vacancyPct: number;
  vacancySource: string;
  vacancyDate: string;
  interestRatePct: number;
  interestRateSource: string;
  interestRateDate: string;
  transactionVolumeUSD: number;
  transactionVolumeLabel: string;
  transactionSource: string;
  transactionDate: string;
  supplyForecast: string;
  demandForecast: string;
  supplyDemandBalance: 'Undersupplied' | 'Balanced' | 'High Pipeline';
  supplyDemandSource: string;
  supplyDemandDate: string;
  politicalEconomicRisk: 'Low' | 'Moderate' | 'Elevated';
  riskScore: number;
  riskSource: string;
  riskDate: string;
  historicalPriceIndex: Array<{ year: string; index: number }>;
  historicalSource: string;
  historicalDate: string;
}

