/**
 * Authoritative Real Estate Underwriting, Validation, Weighted Portfolio & Monte Carlo Engine
 * Shared cleanly by /api/app, /api/admin, PDF generators, and frontend components.
 */

export interface UnderwritingInputs {
  priceUSD: number;
  rentUSD: number; // monthly gross rent ($)
  downPaymentPct: number;
  interestRatePct: number;
  operatingExpensePct: number; // Base OPEX % on EGI (set 0 when entering all expenses individually)
  loanTermYears?: number;
  amortizationYears?: number;
  vacancyRatePct?: number;
  managementPct?: number;
  propertyTaxUSD?: number; // annual $
  insuranceUSD?: number; // annual $
  maintenanceReserveUSD?: number; // annual $
  hoaUSD?: number; // annual $
  annualOperatingExpensesUSD?: number; // optional explicit flat annual operating expenses ($)
  closingCostsPct?: number;
  rentGrowthPct?: number;
  expenseGrowthPct?: number;
  appreciationPct?: number;
  exitCapRatePct?: number; // 0 = derive exit from appreciationPct
  sellingCostsPct?: number;
  noExitValue?: boolean;
}

export interface MetricResult {
  value: number | null;
  reason?: string;
  assumptions: string[];
}

export interface NoiBreakdown {
  grossRentAnnualUSD: number;
  vacancyLossUSD: number;
  effectiveGrossIncomeUSD: number;
  baseOpexUSD: number;
  managementFeeUSD: number;
  propertyTaxUSD: number;
  insuranceUSD: number;
  maintenanceReserveUSD: number;
  hoaUSD: number;
  annualOperatingExpensesUSD: number;
  totalExpensesUSD: number;
  noiUSD: number;
}

export interface YearlyProjection {
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
}

export type IrrStatus =
  | 'ok'
  | 'negative_cashflows'
  | 'no_exit_value'
  | 'insufficient_data';

export interface UnderwritingMetricsMap {
  noi: MetricResult;
  grossYield: MetricResult;
  netYield: MetricResult;
  capRate: MetricResult;
  cashOnCash: MetricResult;
  dscr: MetricResult;
  ltv: MetricResult;
  monthlyMortgage: MetricResult;
  annualDebtService: MetricResult;
  annualCashflow: MetricResult;
  monthlyCashflow: MetricResult;
  irr5Yr: MetricResult;
  equityMultiple: MetricResult;
  roi: MetricResult;
  appreciation: MetricResult;
}

export interface UnderwritingResult {
  capRate: number | null;
  capRateReason: string | null;
  grossYieldPct: number | null;
  netYieldPct: number | null;
  cashOnCash: number | null;
  cashOnCashReason: string | null;
  irr5Yr: number | null;
  irrStatus: IrrStatus;
  irrError: string | null;
  dscr: string | null;
  dscrNumeric: number | null;
  dscrReason: string | null;
  ltvPct: number | null;
  equityMultiple: number | null;
  roiPct: number | null;
  appreciationUSD: number | null;
  monthlyCashflowUSD: number | null;
  monthlyCashflowReason: string | null;
  annualCashflowUSD: number | null;
  monthlyMortgageUSD: number | null;
  netOperatingIncomeUSD: number | null;
  noiReason: string | null;
  annualGrossRentUSD: number | null;
  annualOPEXUSD: number | null;
  annualDebtServiceUSD: number | null;
  downPaymentUSD: number;
  closingCostsUSD: number;
  totalEquityInvestedUSD: number;
  loanAmountUSD: number;
  exitGrossValueUSD: number | null;
  sellingCostsUSD: number | null;
  remainingLoanYr5USD: number;
  netExitProceedsUSD: number | null;
  noiBreakdown: NoiBreakdown | null;
  yearByYear: YearlyProjection[];
  metrics: UnderwritingMetricsMap;
  assumptions: string[];
  warnings: string[];
}

export interface NormalizedInputs extends Required<UnderwritingInputs> {}

export interface InputValidationSummary {
  priceReason: string | null;
  rentReason: string | null;
  expenseReason: string | null;
  debtReason: string | null;
  equityReason: string | null;
  growthReason: string | null;
}

function isProvided(v: any): boolean {
  return v !== undefined && v !== null && v !== '';
}

function inspectRawUnderwritingInputs(raw: UnderwritingInputs): InputValidationSummary {
  let priceReason: string | null = null;
  let rentReason: string | null = null;
  let expenseReason: string | null = null;
  let debtReason: string | null = null;
  let equityReason: string | null = null;
  let growthReason: string | null = null;

  const rawPrice = Number(raw?.priceUSD);
  if (!Number.isFinite(rawPrice)) {
    priceReason = 'Purchase price must be a finite number';
  } else if (rawPrice <= 0) {
    priceReason = 'Purchase price must be greater than zero';
  }

  const rawRent = Number(raw?.rentUSD);
  if (!Number.isFinite(rawRent)) {
    rentReason = 'Gross rent must be a finite number';
  } else if (rawRent < 0) {
    rentReason = 'Rent cannot be negative';
  }

  if (isProvided(raw?.downPaymentPct)) {
    const dp = Number(raw.downPaymentPct);
    if (!Number.isFinite(dp) || dp < 0 || dp > 100) {
      equityReason = 'Down payment % must be between 0 and 100';
    }
  }
  if (isProvided(raw?.closingCostsPct)) {
    const cc = Number(raw.closingCostsPct);
    if (!Number.isFinite(cc) || cc < 0 || cc > 50) {
      equityReason = equityReason || 'Closing costs % must be between 0 and 50';
    }
  }

  if (isProvided(raw?.interestRatePct)) {
    const rate = Number(raw.interestRatePct);
    if (!Number.isFinite(rate) || rate < 0) {
      debtReason = 'Interest rate cannot be negative';
    }
  }
  if (isProvided(raw?.loanTermYears)) {
    const lt = Number(raw.loanTermYears);
    if (!Number.isFinite(lt) || lt <= 0) {
      debtReason = debtReason || 'Loan term years must be greater than zero';
    }
  }
  if (isProvided(raw?.amortizationYears)) {
    const am = Number(raw.amortizationYears);
    if (!Number.isFinite(am) || am <= 0) {
      debtReason = debtReason || 'Amortization years must be greater than zero';
    }
  }

  if (isProvided(raw?.operatingExpensePct)) {
    const opex = Number(raw.operatingExpensePct);
    if (!Number.isFinite(opex) || opex < 0 || opex >= 100) {
      expenseReason = 'Operating expense % must be between 0 and 99.99';
    }
  }
  if (isProvided(raw?.vacancyRatePct)) {
    const vac = Number(raw.vacancyRatePct);
    if (!Number.isFinite(vac) || vac < 0 || vac >= 100) {
      expenseReason = expenseReason || 'Vacancy rate % must be between 0 and 99.99';
    }
  }
  if (isProvided(raw?.managementPct)) {
    const mgmt = Number(raw.managementPct);
    if (!Number.isFinite(mgmt) || mgmt < 0 || mgmt > 50) {
      expenseReason = expenseReason || 'Management fee % must be between 0 and 50';
    }
  }
  const fixedFields: Array<[any, string]> = [
    [raw?.propertyTaxUSD, 'Property tax'],
    [raw?.insuranceUSD, 'Insurance'],
    [raw?.maintenanceReserveUSD, 'Maintenance reserve'],
    [raw?.hoaUSD, 'HOA fee'],
    [raw?.annualOperatingExpensesUSD, 'Operating expenses'],
  ];
  for (const [val, label] of fixedFields) {
    if (isProvided(val)) {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) {
        expenseReason = expenseReason || `${label} cannot be negative`;
      }
    }
  }

  if (isProvided(raw?.sellingCostsPct)) {
    const sc = Number(raw.sellingCostsPct);
    if (!Number.isFinite(sc) || sc < 0 || sc > 50) {
      growthReason = 'Selling costs % must be between 0 and 50';
    }
  }
  if (isProvided(raw?.exitCapRatePct)) {
    const ec = Number(raw.exitCapRatePct);
    if (!Number.isFinite(ec) || ec < 0) {
      growthReason = growthReason || 'Exit cap rate cannot be negative';
    }
  }

  return { priceReason, rentReason, expenseReason, debtReason, equityReason, growthReason };
}

export function normalizeUnderwritingInputs(raw: UnderwritingInputs): NormalizedInputs {
  const num = (v: any, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const loanTermYears = Math.max(1, Math.min(40, num(raw.loanTermYears, 25)));
  const amortizationYears = Math.max(1, Math.min(40, num(raw.amortizationYears, loanTermYears)));

  return {
    priceUSD: Math.max(0, num(raw.priceUSD, 0)),
    rentUSD: Math.max(0, num(raw.rentUSD, 0)),
    downPaymentPct: Math.max(0, Math.min(100, num(raw.downPaymentPct, 30))),
    interestRatePct: Math.max(0, Math.min(35, num(raw.interestRatePct, 5.5))),
    operatingExpensePct: Math.max(0, Math.min(99, num(raw.operatingExpensePct, 15))),
    loanTermYears,
    amortizationYears,
    vacancyRatePct: Math.max(0, Math.min(95, num(raw.vacancyRatePct, 0))),
    managementPct: Math.max(0, Math.min(50, num(raw.managementPct, 0))),
    propertyTaxUSD: Math.max(0, num(raw.propertyTaxUSD, 0)),
    insuranceUSD: Math.max(0, num(raw.insuranceUSD, 0)),
    maintenanceReserveUSD: Math.max(0, num(raw.maintenanceReserveUSD, 0)),
    hoaUSD: Math.max(0, num(raw.hoaUSD, 0)),
    annualOperatingExpensesUSD: Math.max(0, num(raw.annualOperatingExpensesUSD, 0)),
    closingCostsPct: Math.max(0, Math.min(25, num(raw.closingCostsPct, 0))),
    rentGrowthPct: Math.max(-20, Math.min(30, num(raw.rentGrowthPct, 3.0))),
    expenseGrowthPct: Math.max(-10, Math.min(30, num(raw.expenseGrowthPct, 2.5))),
    appreciationPct: Math.max(-50, Math.min(30, num(raw.appreciationPct, 3.0))),
    exitCapRatePct: Math.max(0, Math.min(40, num(raw.exitCapRatePct, 0))),
    sellingCostsPct: Math.max(0, Math.min(20, num(raw.sellingCostsPct, 3.0))),
    noExitValue: Boolean(raw.noExitValue),
  };
}

export function calculateMonthlyMortgageMetric(
  loanUSD: number,
  annualInterestPct: number,
  amortizationYears: number
): MetricResult {
  const assumptions = [
    `Standard fixed-rate monthly amortization over ${Number.isFinite(amortizationYears) ? amortizationYears : 'N/A'} years`,
    `Annual nominal rate ${Number.isFinite(annualInterestPct) ? annualInterestPct : 'N/A'}% / 12 monthly compounding`,
  ];

  if (!Number.isFinite(loanUSD) || !Number.isFinite(annualInterestPct) || !Number.isFinite(amortizationYears)) {
    return { value: null, reason: 'Loan inputs must be finite numbers', assumptions };
  }
  if (loanUSD < 0) {
    return { value: null, reason: 'Loan principal cannot be negative', assumptions };
  }
  if (annualInterestPct < 0) {
    return { value: null, reason: 'Interest rate cannot be negative', assumptions };
  }
  if (amortizationYears <= 0) {
    return { value: null, reason: 'Amortization period must be greater than zero', assumptions };
  }
  if (loanUSD === 0) {
    return { value: 0, assumptions: ['No debt principal ($0)'] };
  }

  const n = Math.max(1, Math.round(amortizationYears * 12));
  const r = annualInterestPct / 100 / 12;
  if (r === 0) {
    const val = loanUSD / n;
    return {
      value: Number.isFinite(val) ? val : null,
      ...(Number.isFinite(val) ? {} : { reason: 'Non-finite payment calculation' }),
      assumptions: [`Zero-interest straight-line principal amortization: Principal / ${n} months`],
    };
  }
  const factor = Math.pow(1 + r, n);
  const payment = (loanUSD * r * factor) / (factor - 1);
  if (!Number.isFinite(payment)) {
    return { value: null, reason: 'Mortgage payment overflow', assumptions };
  }
  return { value: payment, assumptions };
}

export function calculateMonthlyMortgage(
  loanUSD: number,
  annualInterestPct: number,
  amortizationYears: number
): number {
  const res = calculateMonthlyMortgageMetric(loanUSD, annualInterestPct, amortizationYears);
  return res.value !== null && Number.isFinite(res.value) ? res.value : 0;
}

export function calculateRemainingLoanBalance(
  loanUSD: number,
  annualInterestPct: number,
  amortizationYears: number,
  monthsElapsed: number
): number {
  if (!Number.isFinite(loanUSD) || loanUSD <= 0) return 0;
  if (!Number.isFinite(amortizationYears) || amortizationYears <= 0) return 0;
  const n = Math.max(1, Math.round(amortizationYears * 12));
  const p = Math.max(0, Math.min(n, Math.round(monthsElapsed)));
  if (p >= n) return 0;
  const r = Math.max(0, annualInterestPct) / 100 / 12;
  if (r <= 0) return loanUSD * (1 - p / n);
  const fN = Math.pow(1 + r, n);
  const fP = Math.pow(1 + r, p);
  const rem = (loanUSD * (fN - fP)) / (fN - 1);
  return Number.isFinite(rem) ? Math.max(0, rem) : 0;
}

export function calculateNOIMetric(params: {
  annualGrossRentUSD?: number;
  monthlyRentUSD?: number;
  vacancyRatePct?: number;
  operatingExpensePct?: number;
  managementPct?: number;
  propertyTaxUSD?: number;
  insuranceUSD?: number;
  maintenanceReserveUSD?: number;
  hoaUSD?: number;
  annualOperatingExpensesUSD?: number;
}): MetricResult {
  const grossAnnual = isProvided(params.annualGrossRentUSD)
    ? Number(params.annualGrossRentUSD)
    : Number(params.monthlyRentUSD ?? NaN) * 12;
  const vacancyPct = isProvided(params.vacancyRatePct) ? Number(params.vacancyRatePct) : 0;
  const opexPct = isProvided(params.operatingExpensePct) ? Number(params.operatingExpensePct) : 0;
  const mgmtPct = isProvided(params.managementPct) ? Number(params.managementPct) : 0;
  const propTax = isProvided(params.propertyTaxUSD) ? Number(params.propertyTaxUSD) : 0;
  const ins = isProvided(params.insuranceUSD) ? Number(params.insuranceUSD) : 0;
  const maint = isProvided(params.maintenanceReserveUSD) ? Number(params.maintenanceReserveUSD) : 0;
  const hoa = isProvided(params.hoaUSD) ? Number(params.hoaUSD) : 0;
  const flatOpex = isProvided(params.annualOperatingExpensesUSD) ? Number(params.annualOperatingExpensesUSD) : 0;

  const assumptions = [
    `Vacancy allowance: ${Number.isFinite(vacancyPct) ? vacancyPct : 'N/A'}% of Gross Rent`,
    ...(opexPct > 0 ? [`Base OPEX: ${opexPct}% of Effective Gross Income`] : []),
    ...(mgmtPct > 0 ? [`Management Fee: ${mgmtPct}% of Effective Gross Income`] : []),
    ...(flatOpex > 0 ? [`Fixed Operating Expenses: $${flatOpex.toLocaleString('en-US')}/yr`] : []),
    'NOI excludes mortgage debt service (P&I)',
  ];

  if (
    !Number.isFinite(grossAnnual) ||
    !Number.isFinite(vacancyPct) ||
    !Number.isFinite(opexPct) ||
    !Number.isFinite(mgmtPct) ||
    !Number.isFinite(propTax) ||
    !Number.isFinite(ins) ||
    !Number.isFinite(maint) ||
    !Number.isFinite(hoa) ||
    !Number.isFinite(flatOpex)
  ) {
    return { value: null, reason: 'NOI inputs must be finite numbers', assumptions };
  }
  if (grossAnnual < 0) {
    return { value: null, reason: 'Rent cannot be negative', assumptions };
  }
  if (vacancyPct < 0 || vacancyPct >= 100) {
    return { value: null, reason: 'Vacancy rate must be between 0% and 99.99%', assumptions };
  }
  if (
    opexPct < 0 ||
    opexPct >= 100 ||
    mgmtPct < 0 ||
    propTax < 0 ||
    ins < 0 ||
    maint < 0 ||
    hoa < 0 ||
    flatOpex < 0
  ) {
    return { value: null, reason: 'Operating expenses cannot be negative', assumptions };
  }

  const vacancyLoss = grossAnnual * (vacancyPct / 100);
  const egi = grossAnnual - vacancyLoss;
  const pctExpenses = egi * ((opexPct + mgmtPct) / 100);
  const totalExpenses = pctExpenses + propTax + ins + maint + hoa + flatOpex;
  const noi = egi - totalExpenses;
  if (!Number.isFinite(noi)) {
    return { value: null, reason: 'NOI overflow', assumptions };
  }
  return { value: Math.round(noi * 100) / 100, assumptions };
}

export function calculateGrossYieldMetric(
  annualGrossRentUSD: number | null,
  purchasePriceUSD: number,
  rentReason?: string
): MetricResult {
  const assumptions = ['Gross Yield = (Annual Gross Rent / Purchase Price) * 100'];
  if (annualGrossRentUSD === null || !Number.isFinite(annualGrossRentUSD)) {
    return { value: null, reason: rentReason || 'Annual gross rent unavailable', assumptions };
  }
  if (annualGrossRentUSD < 0) {
    return { value: null, reason: 'Rent cannot be negative', assumptions };
  }
  if (!Number.isFinite(purchasePriceUSD) || purchasePriceUSD <= 0) {
    return { value: null, reason: 'Purchase price must be greater than zero', assumptions };
  }
  const val = Number(((annualGrossRentUSD / purchasePriceUSD) * 100).toFixed(2));
  return Number.isFinite(val)
    ? { value: val, assumptions }
    : { value: null, reason: 'Gross yield overflow', assumptions };
}

export function calculateNetYieldMetric(
  noiUSD: number | null,
  purchasePriceUSD: number,
  noiReason?: string
): MetricResult {
  const assumptions = ['Net Yield = (NOI / Purchase Price) * 100'];
  if (noiUSD === null || !Number.isFinite(noiUSD)) {
    return { value: null, reason: noiReason || 'NOI unavailable', assumptions };
  }
  if (!Number.isFinite(purchasePriceUSD) || purchasePriceUSD <= 0) {
    return { value: null, reason: 'Purchase price must be greater than zero', assumptions };
  }
  const val = Number(((noiUSD / purchasePriceUSD) * 100).toFixed(2));
  return Number.isFinite(val)
    ? { value: val, assumptions }
    : { value: null, reason: 'Net yield overflow', assumptions };
}

export function calculateCapRateMetric(
  noiUSD: number | null,
  purchasePriceUSD: number,
  noiReason?: string
): MetricResult {
  const assumptions = ['Cap Rate = (Annual NOI / Purchase Price) * 100 (unlevered, excludes closing costs)'];
  if (noiUSD === null || !Number.isFinite(noiUSD)) {
    return { value: null, reason: noiReason || 'NOI unavailable', assumptions };
  }
  if (!Number.isFinite(purchasePriceUSD) || purchasePriceUSD <= 0) {
    return { value: null, reason: 'Purchase price must be greater than zero', assumptions };
  }
  const val = Number(((noiUSD / purchasePriceUSD) * 100).toFixed(2));
  return Number.isFinite(val)
    ? { value: val, assumptions }
    : { value: null, reason: 'Cap rate overflow', assumptions };
}

export function calculateCashOnCashMetric(
  annualCashflowUSD: number | null,
  initialCashInvestedUSD: number,
  cfReason?: string
): MetricResult {
  const assumptions = [
    'Cash-on-Cash = (Annual Pre-Tax Cash Flow / Initial Cash Invested) * 100',
    'Initial Cash Invested = Down Payment + Closing Costs',
  ];
  if (annualCashflowUSD === null || !Number.isFinite(annualCashflowUSD)) {
    return { value: null, reason: cfReason || 'Annual cash flow unavailable', assumptions };
  }
  if (!Number.isFinite(initialCashInvestedUSD) || initialCashInvestedUSD <= 0) {
    return { value: null, reason: 'Initial cash invested must be greater than zero', assumptions };
  }
  const val = Number(((annualCashflowUSD / initialCashInvestedUSD) * 100).toFixed(2));
  return Number.isFinite(val)
    ? { value: val, assumptions }
    : { value: null, reason: 'Cash-on-Cash overflow', assumptions };
}

export function calculateDSCRMetric(
  noiUSD: number | null,
  annualDebtServiceUSD: number | null,
  noiReason?: string
): MetricResult {
  const assumptions = ['DSCR = Annual NOI / Annual Debt Service (P&I)'];
  if (noiUSD === null || !Number.isFinite(noiUSD)) {
    return { value: null, reason: noiReason || 'NOI unavailable', assumptions };
  }
  if (annualDebtServiceUSD === null || !Number.isFinite(annualDebtServiceUSD)) {
    return { value: null, reason: 'Debt service unavailable', assumptions };
  }
  if (annualDebtServiceUSD <= 0) {
    return { value: null, reason: 'No debt', assumptions };
  }
  const val = Number((noiUSD / annualDebtServiceUSD).toFixed(2));
  return Number.isFinite(val)
    ? { value: val, assumptions }
    : { value: null, reason: 'DSCR overflow', assumptions };
}

export function calculateLTVMetric(
  loanAmountUSD: number,
  purchasePriceUSD: number
): MetricResult {
  const assumptions = ['LTV = (Loan Principal / Purchase Price) * 100'];
  if (!Number.isFinite(loanAmountUSD) || loanAmountUSD < 0) {
    return { value: null, reason: 'Loan amount cannot be negative', assumptions };
  }
  if (!Number.isFinite(purchasePriceUSD) || purchasePriceUSD <= 0) {
    return { value: null, reason: 'Purchase price must be greater than zero', assumptions };
  }
  const val = Number(((loanAmountUSD / purchasePriceUSD) * 100).toFixed(2));
  return Number.isFinite(val)
    ? { value: val, assumptions }
    : { value: null, reason: 'LTV overflow', assumptions };
}

export function calculateEquityMultipleMetric(
  totalDistributionsUSD: number | null,
  initialEquityInvestedUSD: number,
  distReason?: string
): MetricResult {
  const assumptions = ['Equity Multiple = Total Cash Distributions (Operating Cash Flows + Net Exit Proceeds) / Initial Equity Invested'];
  if (totalDistributionsUSD === null || !Number.isFinite(totalDistributionsUSD)) {
    return { value: null, reason: distReason || 'Distributions unavailable', assumptions };
  }
  if (!Number.isFinite(initialEquityInvestedUSD) || initialEquityInvestedUSD <= 0) {
    return { value: null, reason: 'Initial equity invested must be greater than zero', assumptions };
  }
  const val = Number((totalDistributionsUSD / initialEquityInvestedUSD).toFixed(2));
  return Number.isFinite(val)
    ? { value: val, assumptions }
    : { value: null, reason: 'Equity Multiple overflow', assumptions };
}

export function calculateROIMetric(
  totalProfitUSD: number | null,
  initialInvestmentUSD: number,
  profitReason?: string
): MetricResult {
  const assumptions = ['ROI = (Total Net Profit / Initial Equity Invested) * 100'];
  if (totalProfitUSD === null || !Number.isFinite(totalProfitUSD)) {
    return { value: null, reason: profitReason || 'Net profit unavailable', assumptions };
  }
  if (!Number.isFinite(initialInvestmentUSD) || initialInvestmentUSD <= 0) {
    return { value: null, reason: 'Initial investment must be greater than zero', assumptions };
  }
  const val = Number(((totalProfitUSD / initialInvestmentUSD) * 100).toFixed(2));
  return Number.isFinite(val)
    ? { value: val, assumptions }
    : { value: null, reason: 'ROI overflow', assumptions };
}

export function calculateAppreciationMetric(
  purchasePriceUSD: number,
  annualAppreciationPct: number,
  years = 5
): MetricResult & { futureValueUSD: number | null } {
  const assumptions = [
    `Future Value = Purchase Price * (1 + ${annualAppreciationPct}%)^${years}`,
    'Appreciation Gain = Future Value - Purchase Price',
  ];
  if (!Number.isFinite(purchasePriceUSD) || purchasePriceUSD <= 0) {
    return { value: null, futureValueUSD: null, reason: 'Purchase price must be greater than zero', assumptions };
  }
  if (!Number.isFinite(annualAppreciationPct) || !Number.isFinite(years) || years < 0) {
    return { value: null, futureValueUSD: null, reason: 'Invalid appreciation rate or horizon', assumptions };
  }
  const growthBase = 1 + annualAppreciationPct / 100;
  if (growthBase < 0) {
    return { value: null, futureValueUSD: null, reason: 'Appreciation rate cannot be below -100%', assumptions };
  }
  const futureValueUSD = purchasePriceUSD * Math.pow(growthBase, years);
  if (!Number.isFinite(futureValueUSD)) {
    return { value: null, futureValueUSD: null, reason: 'Future value overflow', assumptions };
  }
  const gain = futureValueUSD - purchasePriceUSD;
  return {
    value: Math.round(gain),
    futureValueUSD: Math.round(futureValueUSD),
    assumptions,
  };
}

const MAX_IRR_ITERATIONS = 100;

export function calculateIRRMetric(
  cashflows: number[]
): MetricResult & { status: IrrStatus } {
  const assumptions = [
    'Multi-period DCF IRR solving sum(CF_t / (1 + r)^t) = 0',
    `Bisection solver capped at ${MAX_IRR_ITERATIONS} iterations`,
  ];

  if (!Array.isArray(cashflows) || cashflows.length < 2) {
    return {
      value: null,
      status: 'insufficient_data',
      reason: 'Insufficient data',
      assumptions,
    };
  }
  if (cashflows.some((c) => !Number.isFinite(c))) {
    return {
      value: null,
      status: 'insufficient_data',
      reason: 'Insufficient data',
      assumptions,
    };
  }

  const hasPositive = cashflows.some((c) => c > 0);
  const hasNegative = cashflows.some((c) => c < 0);
  if (!hasPositive && !hasNegative) {
    return {
      value: null,
      status: 'insufficient_data',
      reason: 'Insufficient data',
      assumptions,
    };
  }
  if (!hasPositive || !hasNegative) {
    const errMsg =
      cashflows[0] < 0
        ? 'IRR cannot be calculated - negative cashflows'
        : 'IRR cannot be calculated: cash flows do not change sign';
    return {
      value: null,
      status: 'negative_cashflows',
      reason: errMsg,
      assumptions,
    };
  }

  const initialOutflow = cashflows[0];
  if (initialOutflow >= 0) {
    // Sign change exists later without initial outflow
    return {
      value: null,
      status: 'insufficient_data',
      reason: 'Initial cash flow (Year 0) must be negative outflow to compute IRR',
      assumptions,
    };
  }

  const npv = (rate: number): number => {
    let total = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      if (!Number.isFinite(denom) || denom === 0) return NaN;
      total += cashflows[t] / denom;
    }
    return total;
  };

  // Bracket search from -99% to +5000%
  let low = -0.95;
  let high = 50.0;
  let npvLow = npv(low);
  let npvHigh = npv(high);

  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh) || npvLow * npvHigh > 0) {
    const grid = [
      -0.99, -0.95, -0.9, -0.75, -0.5, -0.25, -0.1, -0.02, 0,
      0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3.0, 5.0, 15.0, 50.0,
    ];
    let found = false;
    for (let i = 0; i < grid.length - 1; i++) {
      const a = npv(grid[i]);
      const b = npv(grid[i + 1]);
      if (Number.isFinite(a) && Number.isFinite(b) && a * b <= 0) {
        low = grid[i];
        high = grid[i + 1];
        npvLow = a;
        npvHigh = b;
        found = true;
        break;
      }
    }
    if (!found) {
      return {
        value: null,
        status: 'negative_cashflows',
        reason: 'IRR cannot be calculated - negative cashflows',
        assumptions,
      };
    }
  }

  let converged = false;
  let solvedRate = (low + high) / 2;

  for (let i = 0; i < MAX_IRR_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (!Number.isFinite(npvMid)) {
      return {
        value: null,
        status: 'insufficient_data',
        reason: 'IRR did not converge within 100 iterations',
        assumptions,
      };
    }
    if (Math.abs(npvMid) < 1e-6 || high - low < 1e-9) {
      solvedRate = mid;
      converged = true;
      break;
    }
    if ((npvLow > 0 && npvMid > 0) || (npvLow < 0 && npvMid < 0)) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
      npvHigh = npvMid;
    }
    solvedRate = mid;
  }

  if (!converged && high - low > 1e-4) {
    return {
      value: null,
      status: 'insufficient_data',
      reason: 'IRR did not converge within 100 iterations',
      assumptions,
    };
  }

  const finalPct = Number((solvedRate * 100).toFixed(2));
  if (!Number.isFinite(finalPct)) {
    return {
      value: null,
      status: 'insufficient_data',
      reason: 'Insufficient data',
      assumptions,
    };
  }

  // Exact zero breakeven returns 0; negative total profit returns real negative IRR if valid sign change existed
  const normalizedZero = Math.abs(finalPct) === 0 ? 0 : finalPct;
  return {
    value: normalizedZero,
    status: 'ok',
    assumptions,
  };
}

export function computeIrrFromCashflows(cashflows: number[]): {
  irrPct: number | null;
  status: IrrStatus;
  error: string | null;
} {
  const res = calculateIRRMetric(cashflows);
  return {
    irrPct: res.value,
    status: res.status,
    error: res.reason ?? null,
  };
}

export function validateUnderwritingInputsAndResults(
  inputs: NormalizedInputs,
  metrics: {
    capRate: number | null;
    cashOnCash: number | null;
    irr5Yr: number | null;
    dscrNumeric: number | null;
    annualGrossRentUSD: number;
  }
): string[] {
  const warnings: string[] = [];

  if (inputs.priceUSD > 0 && inputs.rentUSD > 0) {
    const grossYield = (metrics.annualGrossRentUSD / inputs.priceUSD) * 100;
    const priceToAnnualRent =
      metrics.annualGrossRentUSD > 0 ? inputs.priceUSD / metrics.annualGrossRentUSD : Infinity;
    if (
      grossYield > 30 ||
      (inputs.priceUSD < 100_000 && inputs.rentUSD >= 1500) ||
      priceToAnnualRent < 3.0
    ) {
      const suggested = inputs.priceUSD * 100;
      warnings.push(
        `Purchase Price ($${inputs.priceUSD.toLocaleString('en-US')}) looks unusually low vs monthly rent ($${inputs.rentUSD.toLocaleString('en-US')}/mo) — verify you didn't miss zeros (e.g. $${inputs.priceUSD.toLocaleString('en-US')} vs $${suggested.toLocaleString('en-US')}).`
      );
    }
  }

  if (metrics.capRate !== null && metrics.capRate > 30) {
    warnings.push(
      `High Cap Rate warning (${metrics.capRate}% > 30%): verify Annual Rent ($${metrics.annualGrossRentUSD.toLocaleString('en-US')}) vs Acquisition Price ($${inputs.priceUSD.toLocaleString('en-US')}).`
    );
  }

  if (metrics.cashOnCash !== null && metrics.cashOnCash > 100) {
    warnings.push(
      `Extreme Cash-on-Cash warning (${metrics.cashOnCash}% > 100%): verify Down Payment % (${inputs.downPaymentPct}%) and leverage assumptions.`
    );
  }

  if (metrics.irr5Yr !== null && metrics.irr5Yr > 100) {
    warnings.push(
      `Extreme 5-Year IRR warning (${metrics.irr5Yr}% > 100%): verify appreciation, exit cap rate, and equity basis.`
    );
  }

  if (metrics.dscrNumeric !== null && metrics.dscrNumeric > 10) {
    warnings.push(
      `High DSCR warning (${metrics.dscrNumeric.toFixed(2)}x > 10x): verify loan leverage and debt service assumptions.`
    );
  }

  return warnings;
}

export function calculateUnderwriting(rawInputs: UnderwritingInputs): UnderwritingResult {
  const validation = inspectRawUnderwritingInputs(rawInputs);
  const inputs = normalizeUnderwritingInputs(rawInputs);

  const priceUSD = inputs.priceUSD;
  const hasValidPrice = !validation.priceReason && priceUSD > 0;
  const hasValidRent = !validation.rentReason;
  const hasValidExpenses = !validation.expenseReason;
  const hasValidDebt = !validation.debtReason;
  const hasValidEquity = !validation.equityReason;

  const downPaymentUSD = hasValidPrice && hasValidEquity ? priceUSD * (inputs.downPaymentPct / 100) : 0;
  const closingCostsUSD = hasValidPrice && hasValidEquity ? priceUSD * (inputs.closingCostsPct / 100) : 0;
  const totalEquityInvestedUSD = downPaymentUSD + closingCostsUSD;
  const loanAmountUSD = hasValidPrice && hasValidEquity ? Math.max(0, priceUSD - downPaymentUSD) : 0;

  // Build exact assumptions used for THIS run (only formulas & active inputs actually used)
  const runAssumptions: string[] = [
    `Hold horizon: 5 years`,
    `Gross Annual Rent = Monthly Rent * 12`,
    `Vacancy Rate: ${inputs.vacancyRatePct}% of Gross Rent`,
    ...(inputs.operatingExpensePct > 0
      ? [`Base OPEX: ${inputs.operatingExpensePct}% of Effective Gross Income`]
      : []),
    ...(inputs.managementPct > 0
      ? [`Management Fee: ${inputs.managementPct}% of Effective Gross Income`]
      : []),
    ...(inputs.propertyTaxUSD + inputs.insuranceUSD + inputs.maintenanceReserveUSD + inputs.hoaUSD + inputs.annualOperatingExpensesUSD > 0
      ? ['Itemized annual operating expenses deducted before debt service']
      : []),
    `Down Payment: ${inputs.downPaymentPct}%${inputs.closingCostsPct > 0 ? ` + ${inputs.closingCostsPct}% Closing Costs included in initial equity` : ''}`,
    ...(loanAmountUSD > 0
      ? [
          inputs.interestRatePct === 0
            ? `Debt: 0% interest straight-line amortization over ${inputs.amortizationYears} yrs (Loan Term ${inputs.loanTermYears} yrs)`
            : `Debt: ${inputs.interestRatePct}% fixed APR amortized over ${inputs.amortizationYears} yrs (Loan Term ${inputs.loanTermYears} yrs)`,
        ]
      : ['Financing: Unlevered (0% debt, 100% cash purchase)']),
    `Multi-year cashflow escalation: Rent +${inputs.rentGrowthPct}%/yr, Fixed Expenses +${inputs.expenseGrowthPct}%/yr`,
    ...(inputs.noExitValue
      ? ['Exit Valuation: None (operating cash flows only)']
      : inputs.exitCapRatePct > 0
      ? [
          `Exit Valuation: Year 6 NOI / ${inputs.exitCapRatePct}% Exit Cap Rate`,
          `Selling Costs: ${inputs.sellingCostsPct}% deducted from Gross Exit Value`,
        ]
      : [
          `Exit Valuation: Compounded appreciation at ${inputs.appreciationPct}%/yr over 5 years`,
          `Selling Costs: ${inputs.sellingCostsPct}% deducted from Gross Exit Value`,
        ]),
  ];

  // Mortgage & Debt Service
  const mortgageMetric: MetricResult = !hasValidPrice
    ? { value: null, reason: validation.priceReason!, assumptions: runAssumptions }
    : !hasValidEquity
    ? { value: null, reason: validation.equityReason!, assumptions: runAssumptions }
    : !hasValidDebt
    ? { value: null, reason: validation.debtReason!, assumptions: runAssumptions }
    : calculateMonthlyMortgageMetric(loanAmountUSD, inputs.interestRatePct, inputs.amortizationYears);

  const monthlyMortgageUSD = mortgageMetric.value;
  const annualDebtServiceBaseUSD =
    monthlyMortgageUSD !== null && Number.isFinite(monthlyMortgageUSD) ? monthlyMortgageUSD * 12 : null;
  const annualDebtServiceYr1 =
    annualDebtServiceBaseUSD !== null
      ? inputs.loanTermYears >= 1
        ? annualDebtServiceBaseUSD
        : 0
      : null;
  const debtServiceMetric: MetricResult =
    annualDebtServiceYr1 !== null
      ? { value: Math.round(annualDebtServiceYr1), assumptions: mortgageMetric.assumptions }
      : { value: null, reason: mortgageMetric.reason, assumptions: runAssumptions };

  // NOI Waterfall (Year 1)
  const incomeInvalidReason = validation.rentReason || validation.expenseReason;
  const grossRentAnnualRaw = hasValidRent ? inputs.rentUSD * 12 : NaN;
  const noiMetric = incomeInvalidReason
    ? { value: null, reason: incomeInvalidReason, assumptions: runAssumptions }
    : calculateNOIMetric({
        annualGrossRentUSD: grossRentAnnualRaw,
        vacancyRatePct: inputs.vacancyRatePct,
        operatingExpensePct: inputs.operatingExpensePct,
        managementPct: inputs.managementPct,
        propertyTaxUSD: inputs.propertyTaxUSD,
        insuranceUSD: inputs.insuranceUSD,
        maintenanceReserveUSD: inputs.maintenanceReserveUSD,
        hoaUSD: inputs.hoaUSD,
        annualOperatingExpensesUSD: inputs.annualOperatingExpensesUSD,
      });

  let noiBreakdown: NoiBreakdown | null = null;
  if (!incomeInvalidReason && noiMetric.value !== null) {
    const vacancyLossUSD = grossRentAnnualRaw * (inputs.vacancyRatePct / 100);
    const effectiveGrossIncomeUSD = grossRentAnnualRaw - vacancyLossUSD;
    const baseOpexUSD = effectiveGrossIncomeUSD * (inputs.operatingExpensePct / 100);
    const managementFeeUSD = effectiveGrossIncomeUSD * (inputs.managementPct / 100);
    const totalExpensesUSD =
      baseOpexUSD +
      managementFeeUSD +
      inputs.propertyTaxUSD +
      inputs.insuranceUSD +
      inputs.maintenanceReserveUSD +
      inputs.hoaUSD +
      inputs.annualOperatingExpensesUSD;
    const exactNoi = effectiveGrossIncomeUSD - totalExpensesUSD;

    noiBreakdown = {
      grossRentAnnualUSD: Math.round(grossRentAnnualRaw),
      vacancyLossUSD: Math.round(vacancyLossUSD),
      effectiveGrossIncomeUSD: Math.round(effectiveGrossIncomeUSD),
      baseOpexUSD: Math.round(baseOpexUSD),
      managementFeeUSD: Math.round(managementFeeUSD),
      propertyTaxUSD: Math.round(inputs.propertyTaxUSD),
      insuranceUSD: Math.round(inputs.insuranceUSD),
      maintenanceReserveUSD: Math.round(inputs.maintenanceReserveUSD),
      hoaUSD: Math.round(inputs.hoaUSD),
      annualOperatingExpensesUSD: Math.round(inputs.annualOperatingExpensesUSD),
      totalExpensesUSD: Math.round(totalExpensesUSD),
      noiUSD: Math.round(exactNoi),
    };
  }

  const netOperatingIncomeExact =
    noiBreakdown !== null
      ? inputs.rentUSD * 12 * (1 - inputs.vacancyRatePct / 100) *
          (1 - (inputs.operatingExpensePct + inputs.managementPct) / 100) -
        (inputs.propertyTaxUSD +
          inputs.insuranceUSD +
          inputs.maintenanceReserveUSD +
          inputs.hoaUSD +
          inputs.annualOperatingExpensesUSD)
      : null;

  // Cash Flow
  const cashflowFailureReason =
    noiMetric.value === null
      ? noiMetric.reason
      : annualDebtServiceYr1 === null
      ? debtServiceMetric.reason
      : undefined;
  const annualCashflowExact =
    netOperatingIncomeExact !== null && annualDebtServiceYr1 !== null
      ? netOperatingIncomeExact - annualDebtServiceYr1
      : null;
  const annualCashflowMetric: MetricResult =
    annualCashflowExact !== null
      ? { value: Math.round(annualCashflowExact), assumptions: runAssumptions }
      : { value: null, reason: cashflowFailureReason || 'Cash flow unavailable', assumptions: runAssumptions };
  const monthlyCashflowMetric: MetricResult =
    annualCashflowExact !== null
      ? { value: Math.round(annualCashflowExact / 12), assumptions: runAssumptions }
      : { value: null, reason: cashflowFailureReason || 'Cash flow unavailable', assumptions: runAssumptions };

  // Yields, Cap Rate, CoC, DSCR, LTV
  const grossYieldMetric = validation.priceReason
    ? { value: null, reason: validation.priceReason, assumptions: runAssumptions }
    : calculateGrossYieldMetric(
        hasValidRent ? grossRentAnnualRaw : null,
        priceUSD,
        validation.rentReason || undefined
      );

  const capRateMetric = validation.priceReason
    ? { value: null, reason: validation.priceReason, assumptions: runAssumptions }
    : calculateCapRateMetric(netOperatingIncomeExact, priceUSD, noiMetric.reason);

  const netYieldMetric = validation.priceReason
    ? { value: null, reason: validation.priceReason, assumptions: runAssumptions }
    : calculateNetYieldMetric(netOperatingIncomeExact, priceUSD, noiMetric.reason);

  const cashOnCashMetric = !hasValidPrice
    ? { value: null, reason: validation.priceReason!, assumptions: runAssumptions }
    : !hasValidEquity
    ? { value: null, reason: validation.equityReason!, assumptions: runAssumptions }
    : calculateCashOnCashMetric(annualCashflowExact, totalEquityInvestedUSD, cashflowFailureReason);

  const dscrMetric = calculateDSCRMetric(
    netOperatingIncomeExact,
    annualDebtServiceYr1,
    noiMetric.reason || debtServiceMetric.reason
  );

  const ltvMetric = !hasValidPrice
    ? { value: null, reason: validation.priceReason!, assumptions: runAssumptions }
    : !hasValidEquity
    ? { value: null, reason: validation.equityReason!, assumptions: runAssumptions }
    : calculateLTVMetric(loanAmountUSD, priceUSD);

  // Build 5-Year projections when core income & price inputs are finite and non-negative
  const holdYears = 5;
  const yearlyRows: YearlyProjection[] = [];
  const dcfStream: number[] = [-totalEquityInvestedUSD];

  const canProjectYears =
    hasValidPrice &&
    hasValidRent &&
    hasValidExpenses &&
    hasValidDebt &&
    hasValidEquity &&
    !validation.growthReason &&
    annualDebtServiceBaseUSD !== null;

  const computeYearNOI = (yr: number) => {
    const rFactor = Math.pow(1 + inputs.rentGrowthPct / 100, yr - 1);
    const eFactor = Math.pow(1 + inputs.expenseGrowthPct / 100, yr - 1);
    const gRent = inputs.rentUSD * 12 * rFactor;
    const vac = gRent * (inputs.vacancyRatePct / 100);
    const egi = gRent - vac;
    const pctExpenses = egi * ((inputs.operatingExpensePct + inputs.managementPct) / 100);
    const fixedExpenses =
      (inputs.propertyTaxUSD +
        inputs.insuranceUSD +
        inputs.maintenanceReserveUSD +
        inputs.hoaUSD +
        inputs.annualOperatingExpensesUSD) *
      eFactor;
    const totalOpex = pctExpenses + fixedExpenses;
    return {
      grossRentUSD: gRent,
      vacancyLossUSD: vac,
      effectiveGrossIncomeUSD: egi,
      operatingExpensesUSD: totalOpex,
      noiUSD: egi - totalOpex,
    };
  };

  let remainingLoanYr5USD = 0;
  let exitGrossValueUSD: number | null = null;
  let sellingCostsUSD: number | null = null;
  let netExitProceedsUSD: number | null = null;
  let appreciationMetric: MetricResult = {
    value: null,
    reason: validation.priceReason || validation.growthReason || 'Unavailable',
    assumptions: runAssumptions,
  };

  let irrMetric: MetricResult & { status: IrrStatus } = {
    value: null,
    status: 'insufficient_data',
    reason:
      validation.rentReason ||
      validation.expenseReason ||
      validation.debtReason ||
      validation.equityReason ||
      validation.growthReason ||
      'Insufficient data',
    assumptions: runAssumptions,
  };

  let equityMultipleMetric: MetricResult = {
    value: null,
    reason: 'Insufficient data',
    assumptions: runAssumptions,
  };
  let roiMetric: MetricResult = {
    value: null,
    reason: 'Insufficient data',
    assumptions: runAssumptions,
  };

  if (canProjectYears && annualDebtServiceBaseUSD !== null) {
    let cumulativeOperatingCashflowExact = 0;

    for (let yr = 1; yr <= holdYears; yr++) {
      const y = computeYearNOI(yr);
      const debtService = yr <= inputs.loanTermYears ? annualDebtServiceBaseUSD : 0;
      const netCf = y.noiUSD - debtService;
      cumulativeOperatingCashflowExact += netCf;
      const remainingLoan =
        yr <= inputs.loanTermYears
          ? calculateRemainingLoanBalance(
              loanAmountUSD,
              inputs.interestRatePct,
              inputs.amortizationYears,
              yr * 12
            )
          : 0;
      const yrDscr = debtService > 0 ? Number((y.noiUSD / debtService).toFixed(2)) : null;

      yearlyRows.push({
        year: yr,
        grossRentUSD: Math.round(y.grossRentUSD),
        vacancyLossUSD: Math.round(y.vacancyLossUSD),
        effectiveGrossIncomeUSD: Math.round(y.effectiveGrossIncomeUSD),
        operatingExpensesUSD: Math.round(y.operatingExpensesUSD),
        noiUSD: Math.round(y.noiUSD),
        debtServiceUSD: Math.round(debtService),
        netCashflowUSD: Math.round(netCf),
        remainingLoanUSD: Math.round(remainingLoan),
        dscr: yrDscr,
        cumulativeIrrPct: null,
      });
      dcfStream.push(netCf);
    }

    remainingLoanYr5USD =
      inputs.loanTermYears >= holdYears
        ? calculateRemainingLoanBalance(
            loanAmountUSD,
            inputs.interestRatePct,
            inputs.amortizationYears,
            holdYears * 12
          )
        : 0;

    const appEval = calculateAppreciationMetric(priceUSD, inputs.appreciationPct, holdYears);
    appreciationMetric = {
      value: appEval.value,
      ...(appEval.reason ? { reason: appEval.reason } : {}),
      assumptions: appEval.assumptions,
    };

    if (inputs.noExitValue) {
      exitGrossValueUSD = 0;
      sellingCostsUSD = 0;
      netExitProceedsUSD = 0;
    } else if (inputs.exitCapRatePct > 0) {
      const yr6 = computeYearNOI(6);
      exitGrossValueUSD = yr6.noiUSD > 0 ? yr6.noiUSD / (inputs.exitCapRatePct / 100) : 0;
      sellingCostsUSD = exitGrossValueUSD > 0 ? exitGrossValueUSD * (inputs.sellingCostsPct / 100) : 0;
      netExitProceedsUSD = exitGrossValueUSD - sellingCostsUSD - remainingLoanYr5USD;
    } else {
      const grossExitExact = priceUSD * Math.pow(1 + inputs.appreciationPct / 100, holdYears);
      exitGrossValueUSD = Number.isFinite(grossExitExact) ? grossExitExact : 0;
      sellingCostsUSD = exitGrossValueUSD > 0 ? exitGrossValueUSD * (inputs.sellingCostsPct / 100) : 0;
      netExitProceedsUSD = exitGrossValueUSD - sellingCostsUSD - remainingLoanYr5USD;
    }

    // Cumulative IRR per year
    for (let yr = 1; yr <= holdYears; yr++) {
      const partialStream = [-totalEquityInvestedUSD];
      for (let j = 0; j < yr; j++) {
        partialStream.push(yearlyRows[j].netCashflowUSD);
      }
      if (!inputs.noExitValue && exitGrossValueUSD > 0) {
        const yrValue =
          inputs.exitCapRatePct > 0
            ? Math.max(0, computeYearNOI(yr + 1).noiUSD / (inputs.exitCapRatePct / 100))
            : priceUSD * Math.pow(1 + inputs.appreciationPct / 100, yr);
        const yrSell = yrValue * (inputs.sellingCostsPct / 100);
        const yrNetExit = yrValue - yrSell - yearlyRows[yr - 1].remainingLoanUSD;
        partialStream[partialStream.length - 1] += yrNetExit;
      }
      const yrIrr = calculateIRRMetric(partialStream);
      yearlyRows[yr - 1].cumulativeIrrPct = yrIrr.value;
    }

    if (totalEquityInvestedUSD <= 0 || inputs.rentUSD <= 0) {
      irrMetric = {
        value: null,
        status: 'insufficient_data',
        reason: 'Insufficient data',
        assumptions: runAssumptions,
      };
    } else if (inputs.noExitValue && yearlyRows.every((r) => r.netCashflowUSD <= 0)) {
      irrMetric = {
        value: null,
        status: 'negative_cashflows',
        reason: 'IRR cannot be calculated - negative cashflows',
        assumptions: runAssumptions,
      };
    } else if (inputs.noExitValue) {
      const opOnlyIrr = calculateIRRMetric(dcfStream);
      if (opOnlyIrr.value === null) {
        irrMetric = {
          value: null,
          status: 'no_exit_value',
          reason: 'No exit value',
          assumptions: runAssumptions,
        };
      } else {
        irrMetric = { ...opOnlyIrr, assumptions: runAssumptions };
      }
    } else {
      const terminalStream = [...dcfStream];
      terminalStream[terminalStream.length - 1] += netExitProceedsUSD;
      irrMetric = { ...calculateIRRMetric(terminalStream), assumptions: runAssumptions };
      if (irrMetric.value === null && exitGrossValueUSD <= 0) {
        irrMetric = {
          value: null,
          status: 'no_exit_value',
          reason: 'No exit value',
          assumptions: runAssumptions,
        };
      }
    }

    const totalDistributionsUSD = cumulativeOperatingCashflowExact + (netExitProceedsUSD ?? 0);
    equityMultipleMetric = calculateEquityMultipleMetric(
      totalDistributionsUSD,
      totalEquityInvestedUSD
    );
    const totalProfitUSD = totalDistributionsUSD - totalEquityInvestedUSD;
    roiMetric = calculateROIMetric(totalProfitUSD, totalEquityInvestedUSD);
  } else {
    // Still populate explicit appreciation reason when price invalid
    appreciationMetric = calculateAppreciationMetric(priceUSD, inputs.appreciationPct, holdYears);
    if (priceUSD <= 0 && !validation.rentReason && !validation.expenseReason && !validation.debtReason && !validation.equityReason) {
      irrMetric.reason = 'Insufficient data';
    }
  }

  const dscrNumeric = dscrMetric.value;
  const dscrString = dscrNumeric !== null ? dscrNumeric.toFixed(2) : null;

  const warnings = validateUnderwritingInputsAndResults(inputs, {
    capRate: capRateMetric.value,
    cashOnCash: cashOnCashMetric.value,
    irr5Yr: irrMetric.value,
    dscrNumeric,
    annualGrossRentUSD: hasValidRent ? inputs.rentUSD * 12 : 0,
  });

  const metrics: UnderwritingMetricsMap = {
    noi: noiMetric,
    grossYield: grossYieldMetric,
    netYield: netYieldMetric,
    capRate: capRateMetric,
    cashOnCash: cashOnCashMetric,
    dscr: dscrMetric,
    ltv: ltvMetric,
    monthlyMortgage:
      monthlyMortgageUSD !== null
        ? { value: Math.round(monthlyMortgageUSD), assumptions: mortgageMetric.assumptions }
        : { value: null, reason: mortgageMetric.reason, assumptions: runAssumptions },
    annualDebtService: debtServiceMetric,
    annualCashflow: annualCashflowMetric,
    monthlyCashflow: monthlyCashflowMetric,
    irr5Yr: irrMetric,
    equityMultiple: equityMultipleMetric,
    roi: roiMetric,
    appreciation: appreciationMetric,
  };

  return {
    capRate: capRateMetric.value,
    capRateReason: capRateMetric.reason ?? null,
    grossYieldPct: grossYieldMetric.value,
    netYieldPct: netYieldMetric.value,
    cashOnCash: cashOnCashMetric.value,
    cashOnCashReason: cashOnCashMetric.reason ?? null,
    irr5Yr: irrMetric.value,
    irrStatus: irrMetric.status,
    irrError: irrMetric.reason ?? null,
    dscr: dscrString,
    dscrNumeric,
    dscrReason: dscrMetric.reason ?? null,
    ltvPct: ltvMetric.value,
    equityMultiple: equityMultipleMetric.value,
    roiPct: roiMetric.value,
    appreciationUSD: appreciationMetric.value,
    monthlyCashflowUSD: monthlyCashflowMetric.value,
    monthlyCashflowReason: monthlyCashflowMetric.reason ?? null,
    annualCashflowUSD: annualCashflowMetric.value,
    monthlyMortgageUSD: metrics.monthlyMortgage.value,
    netOperatingIncomeUSD: noiBreakdown ? noiBreakdown.noiUSD : noiMetric.value !== null ? Math.round(noiMetric.value) : null,
    noiReason: noiMetric.reason ?? null,
    annualGrossRentUSD: hasValidRent ? Math.round(inputs.rentUSD * 12) : null,
    annualOPEXUSD: noiBreakdown ? noiBreakdown.totalExpensesUSD : null,
    annualDebtServiceUSD: debtServiceMetric.value,
    downPaymentUSD: Math.round(downPaymentUSD),
    closingCostsUSD: Math.round(closingCostsUSD),
    totalEquityInvestedUSD: Math.round(totalEquityInvestedUSD),
    loanAmountUSD: Math.round(loanAmountUSD),
    exitGrossValueUSD: exitGrossValueUSD !== null ? Math.round(exitGrossValueUSD) : null,
    sellingCostsUSD: sellingCostsUSD !== null ? Math.round(sellingCostsUSD) : null,
    remainingLoanYr5USD: Math.round(remainingLoanYr5USD),
    netExitProceedsUSD: netExitProceedsUSD !== null ? Math.round(netExitProceedsUSD) : null,
    noiBreakdown,
    yearByYear: yearlyRows,
    metrics,
    assumptions: runAssumptions,
    warnings,
  };
}

export interface MonteCarloResult {
  cycles: number;
  rateShockBps: number;
  passCount: number;
  failCount: number;
  passRatePct: number;
  positiveCashflowPct: number;
  probNegativeCashflowPct: number;
  probValueDeclinePct: number;
  meanDscr: number | null;
  minDscr: number | null;
  maxDscr: number | null;
  dscrP10: number | null;
  dscrP50: number | null;
  dscrP90: number | null;
  cocP10: number;
  cocP50: number;
  cocP90: number;
  irrP10: number | null;
  irrP50: number | null;
  irrP90: number | null;
  irrMean: number | null;
  irrCalculablePct: number;
  rateShockCoC: number | null;
  vacancySurgeNetYield: number | null;
  combinedStress: {
    label: string;
    shockedRatePct: number;
    rentDropPct: number;
    vacancyPct: number;
    noiUSD: number | null;
    annualCashflowUSD: number | null;
    cocPct: number | null;
    dscr: string | null;
    dscrReason?: string | null;
    irr5Yr: number | null;
    irrError: string | null;
  };
  distribution: Array<{ label: string; count: number; pct: number }>;
  irrDistribution: Array<{ label: string; count: number; pct: number }>;
  assumptions: {
    cycles: number;
    rateShockMeanBps: number;
    rateShockStdBps: number;
    rentShockMeanPct: number;
    rentShockStdPct: number;
    vacancyMeanPct: number;
    vacancyStdPct: number;
    appreciationStdPct: number;
    methodology: string;
  };
}

export function runMonteCarloSimulation(
  rawInputs: UnderwritingInputs,
  options?: { cycles?: number; seedOffset?: number }
): MonteCarloResult {
  const inputs = normalizeUnderwritingInputs(rawInputs);
  const cycles = Math.max(100, Math.min(10000, Math.round(options?.cycles || 1000)));
  const price = Math.max(1, inputs.priceUSD);
  const baseMonthlyRent = Math.max(1, inputs.rentUSD);
  const downUSD = price * (inputs.downPaymentPct / 100);
  const closingUSD = price * (inputs.closingCostsPct / 100);
  const equityUSD = Math.max(1, downUSD + closingUSD);
  const loanUSD = Math.max(0, price - downUSD);

  let seed =
    Math.round(price) ^
    (Math.round(baseMonthlyRent) << 5) ^
    (Math.round(inputs.interestRatePct * 100) << 11) ^
    (options?.seedOffset || 1337);
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randNorm = () => {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const dscrs: number[] = [];
  const cocs: number[] = [];
  const irrs: number[] = [];
  let passCount = 0;
  let positiveCashflowCount = 0;
  let negativeCashflowCount = 0;
  let valueDeclineCount = 0;

  const dscrBuckets = [0, 0, 0, 0, 0]; // <1.0, 1.0-1.2, 1.2-1.5, 1.5-1.8, 1.8+
  const irrBuckets = [0, 0, 0, 0, 0, 0]; // <0%, 0-6%, 6-12%, 12-18%, 18%+, N/A

  const vacancyMean = Math.max(inputs.vacancyRatePct, 5) + 3.5;

  for (let i = 0; i < cycles; i++) {
    const zRate = randNorm();
    const zMacro = randNorm();
    const zVac = randNorm();
    const zApp = randNorm();

    const shockedRate = Math.max(0.5, inputs.interestRatePct + 1.5 + zRate * 0.9);
    const shockedVacancyPct = Math.min(35, Math.max(0, vacancyMean + zVac * 4.0 - zMacro * 1.2));
    const rentMultiplier = Math.min(1.3, Math.max(0.68, 1 - 0.02 + zMacro * 0.075));
    const shockedOpexPct = Math.min(75, Math.max(0, inputs.operatingExpensePct + 0.5 + randNorm() * 2.0));
    const shockedAppreciationPct = inputs.appreciationPct - 0.5 + zApp * 2.8 - zRate * 0.6;
    const shockedExitCapPct =
      inputs.exitCapRatePct > 0 ? Math.max(2.0, inputs.exitCapRatePct + 0.25 + zRate * 0.45) : 0;

    const trialMonthlyRent = baseMonthlyRent * rentMultiplier;
    const trialGross = trialMonthlyRent * 12;
    const trialEgi = trialGross * (1 - shockedVacancyPct / 100);
    const trialFixed =
      inputs.propertyTaxUSD +
      inputs.insuranceUSD +
      inputs.maintenanceReserveUSD +
      inputs.hoaUSD;
    const trialNOI =
      trialEgi * (1 - (shockedOpexPct + inputs.managementPct) / 100) - trialFixed;

    const monthlyDebt = calculateMonthlyMortgage(
      loanUSD,
      shockedRate,
      inputs.amortizationYears
    );
    const annualDebt = inputs.loanTermYears >= 1 ? monthlyDebt * 12 : 0;
    const trialDscr = annualDebt > 0 ? trialNOI / annualDebt : null;
    const trialCashflow = trialNOI - annualDebt;
    const trialCoc = (trialCashflow / equityUSD) * 100;

    cocs.push(trialCoc);

    if (trialDscr !== null && Number.isFinite(trialDscr)) {
      dscrs.push(trialDscr);
      if (trialDscr >= 1.2) passCount++;
      if (trialDscr < 1.0) dscrBuckets[0]++;
      else if (trialDscr < 1.2) dscrBuckets[1]++;
      else if (trialDscr < 1.5) dscrBuckets[2]++;
      else if (trialDscr < 1.8) dscrBuckets[3]++;
      else dscrBuckets[4]++;
    } else if (trialNOI > 0) {
      // Unlevered positive-NOI cycle passes debt coverage cleanly without inventing numeric DSCR
      passCount++;
    }

    if (trialCashflow > 0) positiveCashflowCount++;
    if (trialCashflow < 0) negativeCashflowCount++;

    const cfStream: number[] = [-equityUSD];
    let yr5NOI = trialNOI;
    for (let yr = 1; yr <= 5; yr++) {
      const rF = Math.pow(1 + inputs.rentGrowthPct / 100, yr - 1);
      const eF = Math.pow(1 + inputs.expenseGrowthPct / 100, yr - 1);
      const yEgi = trialGross * rF * (1 - shockedVacancyPct / 100);
      const yNoi =
        yEgi * (1 - (shockedOpexPct + inputs.managementPct) / 100) - trialFixed * eF;
      if (yr === 5) yr5NOI = yNoi;
      const yDebt = yr <= inputs.loanTermYears ? annualDebt : 0;
      cfStream.push(yNoi - yDebt);
    }

    const trialExitValue = inputs.noExitValue
      ? 0
      : shockedExitCapPct > 0
      ? Math.max(0, (yr5NOI * (1 + inputs.rentGrowthPct / 100)) / (shockedExitCapPct / 100))
      : price * Math.pow(1 + shockedAppreciationPct / 100, 5);

    if (!inputs.noExitValue && trialExitValue < price) {
      valueDeclineCount++;
    }

    const remLoanYr5 =
      inputs.loanTermYears >= 5
        ? calculateRemainingLoanBalance(loanUSD, shockedRate, inputs.amortizationYears, 60)
        : 0;
    const trialNetExit = inputs.noExitValue
      ? 0
      : trialExitValue * (1 - inputs.sellingCostsPct / 100) - remLoanYr5;
    cfStream[cfStream.length - 1] += trialNetExit;

    const irrRes = computeIrrFromCashflows(cfStream);
    if (irrRes.irrPct !== null && Number.isFinite(irrRes.irrPct)) {
      irrs.push(irrRes.irrPct);
      if (irrRes.irrPct < 0) irrBuckets[0]++;
      else if (irrRes.irrPct < 6) irrBuckets[1]++;
      else if (irrRes.irrPct < 12) irrBuckets[2]++;
      else if (irrRes.irrPct < 18) irrBuckets[3]++;
      else irrBuckets[4]++;
    } else {
      irrBuckets[5]++;
    }
  }

  dscrs.sort((a, b) => a - b);
  cocs.sort((a, b) => a - b);
  irrs.sort((a, b) => a - b);

  const combinedResult = calculateUnderwriting({
    ...inputs,
    interestRatePct: inputs.interestRatePct + 2.0,
    rentUSD: baseMonthlyRent * 0.9,
    vacancyRatePct: Math.max(inputs.vacancyRatePct, 15),
  });

  const rate200 = calculateUnderwriting({
    ...inputs,
    interestRatePct: inputs.interestRatePct + 2.0,
  });
  const vac15 = calculateUnderwriting({
    ...inputs,
    vacancyRatePct: Math.max(inputs.vacancyRatePct, 15),
  });

  const meanDscr =
    dscrs.length > 0 ? Number((dscrs.reduce((s, x) => s + x, 0) / dscrs.length).toFixed(2)) : null;
  const passRatePct = Number(((passCount / cycles) * 100).toFixed(1));
  const positiveCashflowPct = Number(((positiveCashflowCount / cycles) * 100).toFixed(1));
  const probNegativeCashflowPct = Number(((negativeCashflowCount / cycles) * 100).toFixed(1));
  const probValueDeclinePct = inputs.noExitValue
    ? 0
    : Number(((valueDeclineCount / cycles) * 100).toFixed(1));

  const pctAt = (arr: number[], q: number) =>
    arr.length > 0 ? Number(arr[Math.min(arr.length - 1, Math.floor(arr.length * q))].toFixed(2)) : null;

  return {
    cycles,
    rateShockBps: 200,
    passCount,
    failCount: cycles - passCount,
    passRatePct,
    positiveCashflowPct,
    probNegativeCashflowPct,
    probValueDeclinePct,
    meanDscr,
    minDscr: dscrs.length > 0 ? Number(dscrs[0].toFixed(2)) : null,
    maxDscr: dscrs.length > 0 ? Number(dscrs[dscrs.length - 1].toFixed(2)) : null,
    dscrP10: pctAt(dscrs, 0.1),
    dscrP50: pctAt(dscrs, 0.5),
    dscrP90: pctAt(dscrs, 0.9),
    cocP10: pctAt(cocs, 0.1) ?? 0,
    cocP50: pctAt(cocs, 0.5) ?? 0,
    cocP90: pctAt(cocs, 0.9) ?? 0,
    irrP10: irrs.length > 0 ? Number((pctAt(irrs, 0.1) ?? 0).toFixed(1)) : null,
    irrP50: irrs.length > 0 ? Number((pctAt(irrs, 0.5) ?? 0).toFixed(1)) : null,
    irrP90: irrs.length > 0 ? Number((pctAt(irrs, 0.9) ?? 0).toFixed(1)) : null,
    irrMean:
      irrs.length > 0
        ? Number((irrs.reduce((s, x) => s + x, 0) / irrs.length).toFixed(1))
        : null,
    irrCalculablePct: Number(((irrs.length / cycles) * 100).toFixed(1)),
    rateShockCoC: rate200.cashOnCash,
    vacancySurgeNetYield: vac15.capRate,
    combinedStress: {
      label: '+200bps Rate + -10% Rent + 15% Vacancy',
      shockedRatePct: Number((inputs.interestRatePct + 2.0).toFixed(2)),
      rentDropPct: -10,
      vacancyPct: Math.max(inputs.vacancyRatePct, 15),
      noiUSD: combinedResult.netOperatingIncomeUSD,
      annualCashflowUSD: combinedResult.annualCashflowUSD,
      cocPct: combinedResult.cashOnCash,
      dscr: combinedResult.dscr,
      dscrReason: combinedResult.dscrReason,
      irr5Yr: combinedResult.irr5Yr,
      irrError: combinedResult.irrError,
    },
    distribution: [
      { label: '< 1.0x', count: dscrBuckets[0], pct: Number(((dscrBuckets[0] / cycles) * 100).toFixed(1)) },
      { label: '1.0x-1.2x', count: dscrBuckets[1], pct: Number(((dscrBuckets[1] / cycles) * 100).toFixed(1)) },
      { label: '1.2x-1.5x', count: dscrBuckets[2], pct: Number(((dscrBuckets[2] / cycles) * 100).toFixed(1)) },
      { label: '1.5x-1.8x', count: dscrBuckets[3], pct: Number(((dscrBuckets[3] / cycles) * 100).toFixed(1)) },
      { label: '1.8x+', count: dscrBuckets[4], pct: Number(((dscrBuckets[4] / cycles) * 100).toFixed(1)) },
    ],
    irrDistribution: [
      { label: '< 0%', count: irrBuckets[0], pct: Number(((irrBuckets[0] / cycles) * 100).toFixed(1)) },
      { label: '0%-6%', count: irrBuckets[1], pct: Number(((irrBuckets[1] / cycles) * 100).toFixed(1)) },
      { label: '6%-12%', count: irrBuckets[2], pct: Number(((irrBuckets[2] / cycles) * 100).toFixed(1)) },
      { label: '12%-18%', count: irrBuckets[3], pct: Number(((irrBuckets[3] / cycles) * 100).toFixed(1)) },
      { label: '18%+', count: irrBuckets[4], pct: Number(((irrBuckets[4] / cycles) * 100).toFixed(1)) },
      { label: 'N/A', count: irrBuckets[5], pct: Number(((irrBuckets[5] / cycles) * 100).toFixed(1)) },
    ],
    assumptions: {
      cycles,
      rateShockMeanBps: 150,
      rateShockStdBps: 90,
      rentShockMeanPct: -2.0,
      rentShockStdPct: 7.5,
      vacancyMeanPct: Number(vacancyMean.toFixed(1)),
      vacancyStdPct: 4.0,
      appreciationStdPct: 2.8,
      methodology:
        'Box-Muller correlated stochastic draws across mortgage rate, vacancy, gross rent, operating expense, and exit valuation.',
    },
  };
}

export interface PortfolioAssetInput {
  id?: string;
  price?: number;
  capRate?: number | null;
  noi?: number | null;
  irr?: number | null;
  monthlyCashflow?: number | null;
}

export interface PortfolioAggregationResult {
  trackedAssets: number;
  excludedInvalidCount: number;
  totalAumUSD: number;
  totalAnnualNoiUSD: number;
  monthlyCashflowUSD: number;
  annualCashflowUSD: number;
  weightedCapRate: number;
  weightedCapRateMetric: MetricResult;
  weightedIRR: number | null;
  weightedIRRMetric: MetricResult;
}

/**
 * Computes institutional value-weighted portfolio metrics:
 * Weighted Cap Rate = SUM(NOI_i) / SUM(Value_i) * 100
 * Excludes corrupted/invalid entries (price <= 0, non-finite numbers, or outlier capRate < 0 or > 50%).
 * NEVER averages cap rates unweighted.
 */
export function computePortfolioAggregation(items: PortfolioAssetInput[]): PortfolioAggregationResult {
  const capAssumptions = ['Weighted Cap Rate = SUM(NOI_i) / SUM(Asset Value_i) * 100'];
  const irrAssumptions = ['Weighted IRR = SUM(IRR_i * Value_i) / SUM(Value_i)'];

  if (!Array.isArray(items) || items.length === 0) {
    return {
      trackedAssets: 0,
      excludedInvalidCount: 0,
      totalAumUSD: 0,
      totalAnnualNoiUSD: 0,
      monthlyCashflowUSD: 0,
      annualCashflowUSD: 0,
      weightedCapRate: 0,
      weightedCapRateMetric: { value: null, reason: 'No valid portfolio assets', assumptions: capAssumptions },
      weightedIRR: null,
      weightedIRRMetric: { value: null, reason: 'No valid portfolio assets', assumptions: irrAssumptions },
    };
  }

  let trackedAssets = 0;
  let excludedInvalidCount = 0;
  let totalAumUSD = 0;
  let totalAnnualNoiUSD = 0;
  let monthlyCashflowUSD = 0;
  let irrWeightedSum = 0;
  let irrWeightTotal = 0;

  for (const item of items) {
    const val = Number(item?.price);
    const rawCap = item?.capRate !== undefined && item?.capRate !== null ? Number(item.capRate) : NaN;
    const rawNoi = item?.noi !== undefined && item?.noi !== null ? Number(item.noi) : NaN;

    const derivedNoi =
      Number.isFinite(rawNoi) && rawNoi >= 0
        ? rawNoi
        : Number.isFinite(val) && val > 0 && Number.isFinite(rawCap)
        ? val * (rawCap / 100)
        : NaN;

    const impliedCap = Number.isFinite(derivedNoi) && val > 0 ? (derivedNoi / val) * 100 : rawCap;

    const isValidAsset =
      Number.isFinite(val) &&
      val > 0 &&
      Number.isFinite(derivedNoi) &&
      derivedNoi >= 0 &&
      Number.isFinite(impliedCap) &&
      impliedCap >= 0 &&
      impliedCap <= 50;

    if (!isValidAsset) {
      excludedInvalidCount++;
      continue;
    }

    trackedAssets++;
    totalAumUSD += val;
    totalAnnualNoiUSD += derivedNoi;

    const mCf = Number(item?.monthlyCashflow);
    if (Number.isFinite(mCf)) {
      monthlyCashflowUSD += mCf;
    }

    const irrVal = item?.irr !== undefined && item?.irr !== null ? Number(item.irr) : NaN;
    if (Number.isFinite(irrVal) && irrVal > -100 && irrVal <= 150) {
      irrWeightedSum += irrVal * val;
      irrWeightTotal += val;
    }
  }

  const weightedCapRateExact =
    totalAumUSD > 0 ? Number(((totalAnnualNoiUSD / totalAumUSD) * 100).toFixed(2)) : null;
  const weightedIRR =
    irrWeightTotal > 0 ? Number((irrWeightedSum / irrWeightTotal).toFixed(1)) : null;

  return {
    trackedAssets,
    excludedInvalidCount,
    totalAumUSD: Math.round(totalAumUSD),
    totalAnnualNoiUSD: Math.round(totalAnnualNoiUSD),
    monthlyCashflowUSD: Math.round(monthlyCashflowUSD),
    annualCashflowUSD: Math.round(monthlyCashflowUSD * 12),
    weightedCapRate: weightedCapRateExact ?? 0,
    weightedCapRateMetric:
      weightedCapRateExact !== null
        ? { value: weightedCapRateExact, assumptions: capAssumptions }
        : { value: null, reason: 'Total portfolio AUM must be greater than zero', assumptions: capAssumptions },
    weightedIRR,
    weightedIRRMetric:
      weightedIRR !== null
        ? { value: weightedIRR, assumptions: irrAssumptions }
        : { value: null, reason: 'Insufficient valid asset IRRs', assumptions: irrAssumptions },
  };
}
