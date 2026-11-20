import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateUnderwriting,
  computePortfolioAggregation,
  runMonteCarloSimulation,
} from '../lib/underwriting';

test('NOI exact breakdown: Rent $193,200/yr ($16,100/mo), Expenses 15% => NOI $164,220 with no hidden deductions', () => {
  const res = calculateUnderwriting({
    priceUSD: 2_500_000,
    rentUSD: 16_100, // 16,100 * 12 = 193,200
    downPaymentPct: 30,
    interestRatePct: 5.5,
    operatingExpensePct: 15,
    vacancyRatePct: 0,
    managementPct: 0,
    propertyTaxUSD: 0,
    insuranceUSD: 0,
    maintenanceReserveUSD: 0,
    hoaUSD: 0,
  });

  assert.equal(res.annualGrossRentUSD, 193_200);
  assert.equal(res.noiBreakdown.vacancyLossUSD, 0);
  assert.equal(res.noiBreakdown.baseOpexUSD, 28_980);
  assert.equal(res.netOperatingIncomeUSD, 164_220);
  assert.equal(res.noiBreakdown.noiUSD, 164_220);
});

test('NOI itemized breakdown deducts Vacancy, Management, Tax, Insurance, Maintenance, and HOA transparently', () => {
  const res = calculateUnderwriting({
    priceUSD: 1_000_000,
    rentUSD: 10_000, // 120,000 gross
    downPaymentPct: 30,
    interestRatePct: 5.5,
    operatingExpensePct: 0,
    vacancyRatePct: 5, // -6,000 => EGI 114,000
    managementPct: 8, // -9,120
    propertyTaxUSD: 6_000,
    insuranceUSD: 2_400,
    maintenanceReserveUSD: 3_600,
    hoaUSD: 4_800,
  });

  assert.equal(res.noiBreakdown.grossRentAnnualUSD, 120_000);
  assert.equal(res.noiBreakdown.vacancyLossUSD, 6_000);
  assert.equal(res.noiBreakdown.effectiveGrossIncomeUSD, 114_000);
  assert.equal(res.noiBreakdown.managementFeeUSD, 9_120);
  assert.equal(res.noiBreakdown.propertyTaxUSD, 6_000);
  assert.equal(res.noiBreakdown.insuranceUSD, 2_400);
  assert.equal(res.noiBreakdown.maintenanceReserveUSD, 3_600);
  assert.equal(res.noiBreakdown.hoaUSD, 4_800);
  assert.equal(res.noiBreakdown.noiUSD, 114_000 - (9_120 + 6_000 + 2_400 + 3_600 + 4_800));
});

test('IRR calculates positive multi-year DCF IRR and NEVER returns 0% when negative cashflows + no exit', () => {
  const validDeal = calculateUnderwriting({
    priceUSD: 1_000_000,
    rentUSD: 7_500,
    downPaymentPct: 30,
    interestRatePct: 5.5,
    operatingExpensePct: 15,
    rentGrowthPct: 3,
    expenseGrowthPct: 2,
    appreciationPct: 3,
    sellingCostsPct: 3,
  });

  assert.equal(validDeal.irrStatus, 'ok');
  assert.ok(validDeal.irr5Yr !== null && validDeal.irr5Yr > 5 && validDeal.irr5Yr < 40);

  // Negative cashflows + no exit value -> MUST NOT return 0%
  const negativeNoExit = calculateUnderwriting({
    priceUSD: 1_000_000,
    rentUSD: 2_000,
    downPaymentPct: 20,
    interestRatePct: 8.5,
    operatingExpensePct: 30,
    noExitValue: true,
  });

  assert.equal(negativeNoExit.irr5Yr, null);
  assert.equal(negativeNoExit.irrError, 'IRR cannot be calculated - negative cashflows');

  // Insufficient data
  const insufficient = calculateUnderwriting({
    priceUSD: 0,
    rentUSD: 0,
    downPaymentPct: 30,
    interestRatePct: 5.5,
    operatingExpensePct: 15,
  });
  assert.equal(insufficient.irr5Yr, null);
  assert.equal(insufficient.irrError, 'Insufficient data');
});

test('DSCR & Cash-on-Cash calculations match mortgage amortization and closing costs', () => {
  const res = calculateUnderwriting({
    priceUSD: 500_000,
    rentUSD: 4_000, // 48,000 gross
    downPaymentPct: 25, // 125,000 down
    closingCostsPct: 3, // 15,000 closing => 140,000 equity
    interestRatePct: 6.0,
    loanTermYears: 25,
    amortizationYears: 25,
    operatingExpensePct: 20, // NOI = 38,400
  });

  const expectedNOI = 48_000 * 0.8;
  assert.equal(res.netOperatingIncomeUSD, expectedNOI);
  assert.equal(res.totalEquityInvestedUSD, 140_000);
  const expectedDscr = Number((expectedNOI / res.annualDebtServiceUSD).toFixed(2));
  assert.equal(res.dscrNumeric, expectedDscr);
  const expectedCoc = Number(
    (((expectedNOI - res.annualDebtServiceUSD) / 140_000) * 100).toFixed(2)
  );
  assert.equal(res.cashOnCash, expectedCoc);
});

test('Validation warns for Cap Rate >30%, CoC >100%, IRR >100%, DSCR >10x, and 42,000 vs 4,200,000 price typo', () => {
  const typoDeal = calculateUnderwriting({
    priceUSD: 42_000,
    rentUSD: 13_000, // intended for $4,200,000 property
    downPaymentPct: 30,
    interestRatePct: 5.5,
    operatingExpensePct: 15,
  });

  assert.ok(typoDeal.warnings.some((w) => w.includes('42,000') && w.includes('4,200,000')));
  assert.ok(typoDeal.warnings.some((w) => w.includes('Cap Rate')));
  assert.ok(typoDeal.warnings.some((w) => w.includes('Cash-on-Cash')));
  assert.ok(typoDeal.warnings.some((w) => w.includes('IRR')));
  assert.ok(typoDeal.warnings.some((w) => w.includes('DSCR')));
});

test('Weighted Cap Rate uses SUM(NOI)/SUM(Value)*100 and excludes invalid assets (fixes 187.58% bug)', () => {
  const portfolio = computePortfolioAggregation([
    { id: 'valid-1', price: 2_000_000, capRate: 3.71, monthlyCashflow: 3_000, irr: 8.5 },
    { id: 'corrupt-1', price: 42_000, capRate: 371.45, monthlyCashflow: 10_000, irr: 400 },
    { id: 'invalid-zero', price: 0, capRate: 12, monthlyCashflow: 0, irr: 10 },
  ]);

  assert.equal(portfolio.trackedAssets, 1);
  assert.equal(portfolio.excludedInvalidCount, 2);
  assert.equal(portfolio.totalAumUSD, 2_000_000);
  assert.equal(portfolio.weightedCapRate, 3.71);

  const twoAssets = computePortfolioAggregation([
    { id: 'a1', price: 1_000_000, capRate: 4.0, monthlyCashflow: 2000, irr: 8.0 },
    { id: 'a2', price: 3_000_000, capRate: 8.0, monthlyCashflow: 12000, irr: 16.0 },
  ]);
  // SUM(NOI) = 40,000 + 240,000 = 280,000; SUM(Val) = 4,000,000 => 7.00% (not unweighted 6.00%)
  assert.equal(twoAssets.weightedCapRate, 7.0);
  assert.equal(twoAssets.weightedIRR, 14.0);
});

test('Monte Carlo runs 1000 cycles (Starter/Pro) and 10000 cycles (Sovereign) with IRR distribution & stress probabilities', () => {
  const mc1000 = runMonteCarloSimulation(
    {
      priceUSD: 650_000,
      rentUSD: 4_500,
      downPaymentPct: 30,
      interestRatePct: 5.5,
      operatingExpensePct: 15,
    },
    { cycles: 1000 }
  );
  assert.equal(mc1000.cycles, 1000);
  assert.equal(mc1000.irrDistribution.length, 6);
  assert.ok(mc1000.probNegativeCashflowPct >= 0 && mc1000.probNegativeCashflowPct <= 100);
  assert.ok(mc1000.probValueDeclinePct >= 0 && mc1000.probValueDeclinePct <= 100);
  assert.ok(mc1000.combinedStress.shockedRatePct === 7.5);
  assert.ok(mc1000.assumptions.cycles === 1000);

  const mc10000 = runMonteCarloSimulation(
    {
      priceUSD: 650_000,
      rentUSD: 4_500,
      downPaymentPct: 30,
      interestRatePct: 5.5,
      operatingExpensePct: 15,
    },
    { cycles: 10000 }
  );
  assert.equal(mc10000.cycles, 10000);
  const irrCountSum = mc10000.irrDistribution.reduce((s, b) => s + b.count, 0);
  assert.equal(irrCountSum, 10000);
});
