/**
 * Authoritative Real Estate Underwriting, Validation, Weighted Portfolio & Monte Carlo Engine
 * Shared cleanly by /api/app and frontend components.
 */

export interface UnderwritingInputs {
  priceUSD: number;
  rentUSD: number; // monthly gross rent ($)
  downPaymentPct: number;
  interestRatePct: number;
  operatingExpensePct: number; // Base OPEX % (set 0 when entering all expenses individually)
  loanTermYears?: number;
  amortizationYears?: number;
  vacancyRatePct?: number;
  managementPct?: number;
  propertyTaxUSD?: number; // annual $
  insuranceUSD?: number; // annual $
  maintenanceReserveUSD?: number; // annual $
  hoaUSD?: number; // annual $
  closingCostsPct?: number;
  rentGrowthPct?: number;
  expenseGrowthPct?: number;
  appreciationPct?: number;
  exitCapRatePct?: number; // 0 = derive exit from appreciationPct
  sellingCostsPct?: number;
  noExitValue?: boolean;
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

export interface UnderwritingResult {
  capRate: number;
  cashOnCash: number;
  irr5Yr: number | null;
  irrStatus: IrrStatus;
  irrError: string | null;
  dscr: string | null;
  dscrNumeric: number | null;
  monthlyCashflowUSD: number;
  monthlyMortgageUSD: number;
  netOperatingIncomeUSD: number;
  annualGrossRentUSD: number;
  annualOPEXUSD: number;
  annualDebtServiceUSD: number;
  downPaymentUSD: number;
  closingCostsUSD: number;
  totalEquityInvestedUSD: number;
  loanAmountUSD: number;
  exitGrossValueUSD: number;
  sellingCostsUSD: number;
  remainingLoanYr5USD: number;
  netExitProceedsUSD: number;
  noiBreakdown: NoiBreakdown;
  yearByYear: YearlyProjection[];
  warnings: string[];
}

export interface NormalizedInputs extends Required<UnderwritingInputs> {}

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
    closingCostsPct: Math.max(0, Math.min(25, num(raw.closingCostsPct, 0))),
    rentGrowthPct: Math.max(-20, Math.min(30, num(raw.rentGrowthPct, 3.0))),
    expenseGrowthPct: Math.max(-10, Math.min(30, num(raw.expenseGrowthPct, 2.5))),
    appreciationPct: Math.max(-50, Math.min(30, num(raw.appreciationPct, 3.0))),
    exitCapRatePct: Math.max(0, Math.min(40, num(raw.exitCapRatePct, 0))),
    sellingCostsPct: Math.max(0, Math.min(20, num(raw.sellingCostsPct, 3.0))),
    noExitValue: Boolean(raw.noExitValue),
  };
}

export function calculateMonthlyMortgage(
  loanUSD: number,
  annualInterestPct: number,
  amortizationYears: number
): number {
  if (loanUSD <= 0) return 0;
  const n = Math.max(1, Math.round(amortizationYears * 12));
  const r = annualInterestPct / 100 / 12;
  if (r <= 0) return loanUSD / n;
  const factor = Math.pow(1 + r, n);
  return (loanUSD * r * factor) / (factor - 1);
}

export function calculateRemainingLoanBalance(
  loanUSD: number,
  annualInterestPct: number,
  amortizationYears: number,
  monthsElapsed: number
): number {
  if (loanUSD <= 0) return 0;
  const n = Math.max(1, Math.round(amortizationYears * 12));
  const p = Math.max(0, Math.min(n, Math.round(monthsElapsed)));
  if (p >= n) return 0;
  const r = annualInterestPct / 100 / 12;
  if (r <= 0) return loanUSD * (1 - p / n);
  const fN = Math.pow(1 + r, n);
  const fP = Math.pow(1 + r, p);
  return Math.max(0, (loanUSD * (fN - fP)) / (fN - 1));
}

export function computeIrrFromCashflows(cashflows: number[]): {
  irrPct: number | null;
  status: IrrStatus;
  error: string | null;
} {
  if (!Array.isArray(cashflows) || cashflows.length < 2) {
    return { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  }
  if (cashflows.some((c) => !Number.isFinite(c))) {
    return { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  }
  const initialOutflow = cashflows[0];
  if (initialOutflow >= 0) {
    return { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  }

  const inflows = cashflows.slice(1);
  const hasPositiveInflow = inflows.some((c) => c > 0);
  if (!hasPositiveInflow) {
    return {
      irrPct: null,
      status: 'negative_cashflows',
      error: 'IRR cannot be calculated - negative cashflows',
    };
  }

  const npv = (rate: number): number => {
    let total = 0;
    for (let t = 0; t < cashflows.length; t++) {
      total += cashflows[t] / Math.pow(1 + rate, t);
    }
    return total;
  };

  // Bracket search from -95% to +5000%
  let low = -0.95;
  let high = 50.0;
  let npvLow = npv(low);
  let npvHigh = npv(high);

  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh) || npvLow * npvHigh > 0) {
    // Try refined scan for sign change
    const grid = [-0.9, -0.75, -0.5, -0.25, -0.1, 0, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3.0, 5.0, 15.0, 50.0];
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
        irrPct: null,
        status: 'negative_cashflows',
        error: 'IRR cannot be calculated - negative cashflows',
      };
    }
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 1e-6) {
      const pct = Number((mid * 100).toFixed(1));
      if (pct === 0) {
        return { irrPct: 0.1, status: 'ok', error: null };
      }
      return { irrPct: pct, status: 'ok', error: null };
    }
    if ((npvLow > 0 && npvMid > 0) || (npvLow < 0 && npvMid < 0)) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
      npvHigh = npvMid;
    }
  }

  const finalRate = (low + high) / 2;
  const finalPct = Number((finalRate * 100).toFixed(1));
  if (!Number.isFinite(finalPct)) {
    return { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  }
  // Never emit exact 0% as an IRR result if capital is flat/negative
  if (Math.abs(finalPct) < 0.05) {
    const netProfit = cashflows.reduce((s, c) => s + c, 0);
    if (netProfit <= 0) {
      return {
        irrPct: null,
        status: 'negative_cashflows',
        error: 'IRR cannot be calculated - negative cashflows',
      };
    }
    return { irrPct: 0.1, status: 'ok', error: null };
  }
  return { irrPct: finalPct, status: 'ok', error: null };
}

export function validateUnderwritingInputsAndResults(
  inputs: NormalizedInputs,
  metrics: {
    capRate: number;
    cashOnCash: number;
    irr5Yr: number | null;
    dscrNumeric: number | null;
    annualGrossRentUSD: number;
  }
): string[] {
  const warnings: string[] = [];

  if (inputs.priceUSD > 0 && inputs.rentUSD > 0) {
    const grossYield = (metrics.annualGrossRentUSD / inputs.priceUSD) * 100;
    const priceToAnnualRent = metrics.annualGrossRentUSD > 0 ? inputs.priceUSD / metrics.annualGrossRentUSD : Infinity;
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

  if (metrics.capRate > 30) {
    warnings.push(
      `High Cap Rate warning (${metrics.capRate}% > 30%): verify Annual Rent ($${metrics.annualGrossRentUSD.toLocaleString('en-US')}) vs Acquisition Price ($${inputs.priceUSD.toLocaleString('en-US')}).`
    );
  }

  if (metrics.cashOnCash > 100) {
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
  const inputs = normalizeUnderwritingInputs(rawInputs);
  const priceUSD = inputs.priceUSD;
  const downPaymentUSD = priceUSD * (inputs.downPaymentPct / 100);
  const closingCostsUSD = priceUSD * (inputs.closingCostsPct / 100);
  const totalEquityInvestedUSD = downPaymentUSD + closingCostsUSD;
  const loanAmountUSD = Math.max(0, priceUSD - downPaymentUSD);

  const monthlyMortgageUSD = calculateMonthlyMortgage(
    loanAmountUSD,
    inputs.interestRatePct,
    inputs.amortizationYears
  );
  const annualDebtServiceBaseUSD = monthlyMortgageUSD * 12;

  // Year-1 exact breakdown (NO hidden 0.95 vacancy!)
  const grossRentAnnualUSD = inputs.rentUSD * 12;
  const vacancyLossUSD = grossRentAnnualUSD * (inputs.vacancyRatePct / 100);
  const effectiveGrossIncomeUSD = grossRentAnnualUSD - vacancyLossUSD;
  const baseOpexUSD = effectiveGrossIncomeUSD * (inputs.operatingExpensePct / 100);
  const managementFeeUSD = effectiveGrossIncomeUSD * (inputs.managementPct / 100);
  const propertyTaxUSD = inputs.propertyTaxUSD;
  const insuranceUSD = inputs.insuranceUSD;
  const maintenanceReserveUSD = inputs.maintenanceReserveUSD;
  const hoaUSD = inputs.hoaUSD;
  const totalExpensesUSD =
    baseOpexUSD +
    managementFeeUSD +
    propertyTaxUSD +
    insuranceUSD +
    maintenanceReserveUSD +
    hoaUSD;
  const netOperatingIncomeUSD = effectiveGrossIncomeUSD - totalExpensesUSD;

  const annualDebtServiceYr1 = inputs.loanTermYears >= 1 ? annualDebtServiceBaseUSD : 0;
  const annualCashflowUSD = netOperatingIncomeUSD - annualDebtServiceYr1;
  const monthlyCashflowUSD = annualCashflowUSD / 12;

  const capRate =
    priceUSD > 0 ? Number(((netOperatingIncomeUSD / priceUSD) * 100).toFixed(2)) : 0;
  const cashOnCash =
    totalEquityInvestedUSD > 0
      ? Number(((annualCashflowUSD / totalEquityInvestedUSD) * 100).toFixed(2))
      : 0;
  const dscrNumeric =
    annualDebtServiceYr1 > 0
      ? Number((netOperatingIncomeUSD / annualDebtServiceYr1).toFixed(2))
      : null;
  const dscr = dscrNumeric !== null ? dscrNumeric.toFixed(2) : null;

  // Build 5-Year projections (plus Year 6 NOI if exitCapRatePct > 0)
  const holdYears = 5;
  const yearlyRows: YearlyProjection[] = [];
  const dcfStream: number[] = [-totalEquityInvestedUSD];

  const computeYearNOI = (yr: number) => {
    const rFactor = Math.pow(1 + inputs.rentGrowthPct / 100, yr - 1);
    const eFactor = Math.pow(1 + inputs.expenseGrowthPct / 100, yr - 1);
    const gRent = grossRentAnnualUSD * rFactor;
    const vac = gRent * (inputs.vacancyRatePct / 100);
    const egi = gRent - vac;
    const pctExpenses = egi * ((inputs.operatingExpensePct + inputs.managementPct) / 100);
    const fixedExpenses =
      (propertyTaxUSD + insuranceUSD + maintenanceReserveUSD + hoaUSD) * eFactor;
    const totalOpex = pctExpenses + fixedExpenses;
    return {
      grossRentUSD: gRent,
      vacancyLossUSD: vac,
      effectiveGrossIncomeUSD: egi,
      operatingExpensesUSD: totalOpex,
      noiUSD: egi - totalOpex,
    };
  };

  for (let yr = 1; yr <= holdYears; yr++) {
    const y = computeYearNOI(yr);
    const debtService = yr <= inputs.loanTermYears ? annualDebtServiceBaseUSD : 0;
    const netCf = y.noiUSD - debtService;
    const remainingLoan =
      yr <= inputs.loanTermYears
        ? calculateRemainingLoanBalance(
            loanAmountUSD,
            inputs.interestRatePct,
            inputs.amortizationYears,
            yr * 12
          )
        : 0;
    const yrDscr =
      debtService > 0 ? Number((y.noiUSD / debtService).toFixed(2)) : null;

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

  const remainingLoanYr5USD =
    inputs.loanTermYears >= holdYears
      ? calculateRemainingLoanBalance(
          loanAmountUSD,
          inputs.interestRatePct,
          inputs.amortizationYears,
          holdYears * 12
        )
      : 0;

  let exitGrossValueUSD = 0;
  if (!inputs.noExitValue) {
    if (inputs.exitCapRatePct > 0) {
      const yr6 = computeYearNOI(6);
      exitGrossValueUSD = yr6.noiUSD > 0 ? yr6.noiUSD / (inputs.exitCapRatePct / 100) : 0;
    } else if (priceUSD > 0) {
      exitGrossValueUSD = priceUSD * Math.pow(1 + inputs.appreciationPct / 100, holdYears);
    }
  }

  const sellingCostsUSD =
    exitGrossValueUSD > 0 ? exitGrossValueUSD * (inputs.sellingCostsPct / 100) : 0;
  const netExitProceedsUSD = inputs.noExitValue
    ? 0
    : exitGrossValueUSD - sellingCostsUSD - remainingLoanYr5USD;

  // Populate cumulative IRR per year using mark-to-market exit at year t
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
    const yrIrr = computeIrrFromCashflows(partialStream);
    yearlyRows[yr - 1].cumulativeIrrPct = yrIrr.irrPct;
  }

  let irrEval: { irrPct: number | null; status: IrrStatus; error: string | null };
  if (priceUSD <= 0 || totalEquityInvestedUSD <= 0 || inputs.rentUSD <= 0) {
    irrEval = { irrPct: null, status: 'insufficient_data', error: 'Insufficient data' };
  } else if (inputs.noExitValue && yearlyRows.every((r) => r.netCashflowUSD <= 0)) {
    irrEval = {
      irrPct: null,
      status: 'negative_cashflows',
      error: 'IRR cannot be calculated - negative cashflows',
    };
  } else if (inputs.noExitValue) {
    const opOnlyIrr = computeIrrFromCashflows(dcfStream);
    if (opOnlyIrr.irrPct === null) {
      irrEval = {
        irrPct: null,
        status: 'no_exit_value',
        error: 'No exit value',
      };
    } else {
      irrEval = opOnlyIrr;
    }
  } else {
    const terminalStream = [...dcfStream];
    terminalStream[terminalStream.length - 1] += netExitProceedsUSD;
    irrEval = computeIrrFromCashflows(terminalStream);
    if (irrEval.irrPct === null && exitGrossValueUSD <= 0) {
      irrEval = {
        irrPct: null,
        status: 'no_exit_value',
        error: 'No exit value',
      };
    }
  }

  const warnings = validateUnderwritingInputsAndResults(inputs, {
    capRate,
    cashOnCash,
    irr5Yr: irrEval.irrPct,
    dscrNumeric,
    annualGrossRentUSD: grossRentAnnualUSD,
  });

  return {
    capRate,
    cashOnCash,
    irr5Yr: irrEval.irrPct,
    irrStatus: irrEval.status,
    irrError: irrEval.error,
    dscr,
    dscrNumeric,
    monthlyCashflowUSD: Math.round(monthlyCashflowUSD),
    monthlyMortgageUSD: Math.round(monthlyMortgageUSD),
    netOperatingIncomeUSD: Math.round(netOperatingIncomeUSD),
    annualGrossRentUSD: Math.round(grossRentAnnualUSD),
    annualOPEXUSD: Math.round(totalExpensesUSD),
    annualDebtServiceUSD: Math.round(annualDebtServiceYr1),
    downPaymentUSD: Math.round(downPaymentUSD),
    closingCostsUSD: Math.round(closingCostsUSD),
    totalEquityInvestedUSD: Math.round(totalEquityInvestedUSD),
    loanAmountUSD: Math.round(loanAmountUSD),
    exitGrossValueUSD: Math.round(exitGrossValueUSD),
    sellingCostsUSD: Math.round(sellingCostsUSD),
    remainingLoanYr5USD: Math.round(remainingLoanYr5USD),
    netExitProceedsUSD: Math.round(netExitProceedsUSD),
    noiBreakdown: {
      grossRentAnnualUSD: Math.round(grossRentAnnualUSD),
      vacancyLossUSD: Math.round(vacancyLossUSD),
      effectiveGrossIncomeUSD: Math.round(effectiveGrossIncomeUSD),
      baseOpexUSD: Math.round(baseOpexUSD),
      managementFeeUSD: Math.round(managementFeeUSD),
      propertyTaxUSD: Math.round(propertyTaxUSD),
      insuranceUSD: Math.round(insuranceUSD),
      maintenanceReserveUSD: Math.round(maintenanceReserveUSD),
      hoaUSD: Math.round(hoaUSD),
      totalExpensesUSD: Math.round(totalExpensesUSD),
      noiUSD: Math.round(netOperatingIncomeUSD),
    },
    yearByYear: yearlyRows,
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
  meanDscr: number;
  minDscr: number;
  maxDscr: number;
  dscrP10: number;
  dscrP50: number;
  dscrP90: number;
  cocP10: number;
  cocP50: number;
  cocP90: number;
  irrP10: number | null;
  irrP50: number | null;
  irrP90: number | null;
  irrMean: number | null;
  irrCalculablePct: number;
  rateShockCoC: number;
  vacancySurgeNetYield: number;
  combinedStress: {
    label: string;
    shockedRatePct: number;
    rentDropPct: number;
    vacancyPct: number;
    noiUSD: number;
    annualCashflowUSD: number;
    cocPct: number;
    dscr: string;
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

    // Correlated macro factor: higher rates mildly weigh on appreciation and rent growth
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
    const trialDscr = annualDebt > 0 ? trialNOI / annualDebt : 4.0;
    const trialCashflow = trialNOI - annualDebt;
    const trialCoc = (trialCashflow / equityUSD) * 100;

    dscrs.push(trialDscr);
    cocs.push(trialCoc);

    if (trialDscr >= 1.2) passCount++;
    if (trialCashflow > 0) positiveCashflowCount++;
    if (trialCashflow < 0) negativeCashflowCount++;

    if (trialDscr < 1.0) dscrBuckets[0]++;
    else if (trialDscr < 1.2) dscrBuckets[1]++;
    else if (trialDscr < 1.5) dscrBuckets[2]++;
    else if (trialDscr < 1.8) dscrBuckets[3]++;
    else dscrBuckets[4]++;

    // 5-Year trial IRR & exit valuation
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

  // Deterministic Combined Rate (+200bps) + Rent (-10%) + Vacancy (15%) Stress Test
  const combinedResult = calculateUnderwriting({
    ...inputs,
    interestRatePct: inputs.interestRatePct + 2.0,
    rentUSD: baseMonthlyRent * 0.9,
    vacancyRatePct: Math.max(inputs.vacancyRatePct, 15),
  });

  // Legacy single-axis deterministic helpers kept for backwards display compatibility
  const rate200 = calculateUnderwriting({
    ...inputs,
    interestRatePct: inputs.interestRatePct + 2.0,
  });
  const vac15 = calculateUnderwriting({
    ...inputs,
    vacancyRatePct: Math.max(inputs.vacancyRatePct, 15),
  });

  const meanDscr = Number((dscrs.reduce((s, x) => s + x, 0) / cycles).toFixed(2));
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
    minDscr: Number(dscrs[0].toFixed(2)),
    maxDscr: Number(dscrs[cycles - 1].toFixed(2)),
    dscrP10: pctAt(dscrs, 0.1) ?? 0,
    dscrP50: pctAt(dscrs, 0.5) ?? 0,
    dscrP90: pctAt(dscrs, 0.9) ?? 0,
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
      annualCashflowUSD: combinedResult.monthlyCashflowUSD * 12,
      cocPct: combinedResult.cashOnCash,
      dscr: combinedResult.dscr ?? '∞',
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
  capRate?: number;
  noi?: number;
  irr?: number | null;
  monthlyCashflow?: number;
}

export interface PortfolioAggregationResult {
  trackedAssets: number;
  excludedInvalidCount: number;
  totalAumUSD: number;
  totalAnnualNoiUSD: number;
  monthlyCashflowUSD: number;
  annualCashflowUSD: number;
  weightedCapRate: number;
  weightedIRR: number | null;
}

/**
 * Computes institutional value-weighted portfolio metrics:
 * Weighted Cap Rate = SUM(NOI_i) / SUM(Value_i) * 100
 * Excludes corrupted/invalid entries (price <= 0, non-finite numbers, or outlier capRate < 0 or > 50%).
 * NEVER averages cap rates unweighted.
 */
export function computePortfolioAggregation(items: PortfolioAssetInput[]): PortfolioAggregationResult {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      trackedAssets: 0,
      excludedInvalidCount: 0,
      totalAumUSD: 0,
      totalAnnualNoiUSD: 0,
      monthlyCashflowUSD: 0,
      annualCashflowUSD: 0,
      weightedCapRate: 0,
      weightedIRR: null,
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
    const rawCap = Number(item?.capRate);
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

  const weightedCapRate =
    totalAumUSD > 0 ? Number(((totalAnnualNoiUSD / totalAumUSD) * 100).toFixed(2)) : 0;
  const weightedIRR =
    irrWeightTotal > 0 ? Number((irrWeightedSum / irrWeightTotal).toFixed(1)) : null;

  return {
    trackedAssets,
    excludedInvalidCount,
    totalAumUSD: Math.round(totalAumUSD),
    totalAnnualNoiUSD: Math.round(totalAnnualNoiUSD),
    monthlyCashflowUSD: Math.round(monthlyCashflowUSD),
    annualCashflowUSD: Math.round(monthlyCashflowUSD * 12),
    weightedCapRate,
    weightedIRR,
  };
}
