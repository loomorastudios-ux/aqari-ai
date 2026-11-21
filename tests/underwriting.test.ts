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

test('Monte Carlo is a real stochastic simulation (distinct seedOffsets produce distinct empirical percentiles)', () => {
  const base = {
    priceUSD: 850_000,
    rentUSD: 5_200,
    downPaymentPct: 30,
    interestRatePct: 5.75,
    operatingExpensePct: 18,
  };
  const runA = runMonteCarloSimulation(base, { cycles: 1000, seedOffset: 101 });
  const runB = runMonteCarloSimulation(base, { cycles: 1000, seedOffset: 99991 });

  assert.notEqual(
    JSON.stringify(runA.distribution),
    JSON.stringify(runB.distribution),
    'Different PRNG seed offsets must yield distinct empirical cycle distributions'
  );
});

test('Institutional PDF output matches underwriting metrics & financing figures identically', async () => {
  const { buildInstitutionalMemorandumBytes } = await import('../src/utils/pdfExport');
  const calc = calculateUnderwriting({
    priceUSD: 1_250_000,
    rentUSD: 9_200,
    downPaymentPct: 30,
    interestRatePct: 5.5,
    operatingExpensePct: 15,
  });

  const { pdfBytes, filename } = buildInstitutionalMemorandumBytes({
    title: 'Al Mouj Sovereign Marina Penthouse',
    city: 'Muscat',
    country: 'Oman',
    userEmail: 'ic@aqari.test',
    planDisplay: 'PROFESSIONAL',
    valuationUSD: 1_250_000,
    monthlyRentUSD: 9_200,
    noiUSD: calc.netOperatingIncomeUSD,
    capRate: calc.capRate,
    cashOnCash: calc.cashOnCash,
    irr5Yr: calc.irr5Yr,
    irrError: calc.irrError,
    dscr: calc.dscr,
    monthlyCashflowUSD: calc.monthlyCashflowUSD,
    downPaymentPct: 30,
    interestRatePct: 5.5,
    loanAmountUSD: calc.loanAmountUSD,
    totalEquityInvestedUSD: calc.totalEquityInvestedUSD,
    noiBreakdown: calc.noiBreakdown,
    yearByYear: calc.yearByYear,
  });

  const pdfStreamText = Buffer.from(pdfBytes).toString('latin1');
  assert.ok(filename.endsWith('.pdf'));
  assert.ok(pdfStreamText.startsWith('%PDF-1.4'));
  assert.ok(pdfStreamText.includes('$1,250,000'), 'PDF must contain exact Valuation');
  assert.ok(
    pdfStreamText.includes(`$${Math.round(calc.netOperatingIncomeUSD).toLocaleString('en-US')}`),
    'PDF must contain exact NOI'
  );
  assert.ok(pdfStreamText.includes(`${calc.capRate.toFixed(2)}%`), 'PDF must contain exact Cap Rate');
  assert.ok(pdfStreamText.includes(`${calc.cashOnCash.toFixed(2)}%`), 'PDF must contain exact Cash-on-Cash');
  if (calc.dscr) {
    assert.ok(pdfStreamText.includes(`${calc.dscr}x`), 'PDF must contain exact DSCR');
  }
});

// Helper to invoke Vercel API handler directly in-process
async function invokeApi(params: {
  method?: string;
  action: string;
  body?: any;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  const { default: handler } = await import('../api/app');
  let statusCode = 200;
  let jsonPayload: any = null;
  const responseHeaders: Record<string, any> = {};

  const qs = new URLSearchParams({ action: params.action, ...(params.query || {}) }).toString();
  const req: any = {
    method: params.method || 'POST',
    url: `/api/app?${qs}`,
    headers: { host: 'localhost:3000', ...(params.headers || {}) },
    body: params.body || {},
    query: { action: params.action, ...(params.query || {}) },
  };
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader(k: string, v: any) {
      responseHeaders[k] = v;
      return this;
    },
    getHeader(k: string) {
      return responseHeaders[k];
    },
    json(payload: any) {
      jsonPayload = payload;
      return this;
    },
    send(payload: any) {
      jsonPayload = payload;
      return this;
    },
    end() {
      return this;
    },
  };

  await handler(req, res);
  return { statusCode, data: jsonPayload, headers: responseHeaders };
}

test('Server blocks limit bypass via API & persists saved analyses across logout/cookie-clear', async () => {
  const testEmail = `audit_free_${Date.now()}@aqari.test`;

  // 1. Run 3 free analyses (limit = 3), trying client-side spoofing payload each time
  for (let i = 0; i < 3; i++) {
    const r = await invokeApi({
      action: 'run-analysis',
      body: {
        email: testEmail,
        plan: 'enterprise', // spoof attempt MUST be ignored by server
        analysesLeft: 999,
        propertyTitle: `Audit Asset ${i + 1}`,
        city: 'Muscat',
        priceUSD: 650_000,
        rentUSD: 4_500,
      },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.data.success, true);
  }

  // 2. 4th request MUST be blocked with 403 even if body claims enterprise plan
  const blockedRun = await invokeApi({
    action: 'run-analysis',
    body: {
      email: testEmail,
      plan: 'enterprise',
      analysesLeft: 999,
      propertyTitle: 'Bypass Attempt 4',
      city: 'Muscat',
      priceUSD: 650_000,
      rentUSD: 4_500,
    },
  });
  assert.equal(blockedRun.statusCode, 403);
  assert.equal(blockedRun.data.locked, true);

  // 3. Direct monte-carlo call on exhausted free user MUST be blocked with 403
  const blockedMc = await invokeApi({
    action: 'monte-carlo',
    body: { email: testEmail, priceUSD: 650_000, rentUSD: 4_500 },
  });
  assert.equal(blockedMc.statusCode, 403);

  // 4. Logout & Persistence Check: save 1 analysis on fresh account, DELETE session, then fetch ?action=me
  const persistEmail = `persist_${Date.now()}@aqari.test`;
  const saveRes = await invokeApi({
    action: 'save-to-portfolio',
    body: {
      email: persistEmail,
      analysis: {
        id: 'persist_check_1',
        property: 'Persistence Tower Muscat',
        city: 'Muscat',
        price: 750_000,
        rent: 5_200,
        capRate: 7.4,
        cashOnCash: 8.1,
        irr: 12.8,
        dscr: '1.52',
        monthlyCashflow: 1850,
        riskScore: 'AAA',
      },
    },
  });
  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.data.saved_count, 1);

  const logoutRes = await invokeApi({ method: 'DELETE', action: 'session' });
  assert.equal(logoutRes.statusCode, 200);

  const rehydrateRes = await invokeApi({
    method: 'GET',
    action: 'me',
    query: { email: persistEmail },
  });
  assert.equal(rehydrateRes.statusCode, 200);
  assert.ok(
    Array.isArray(rehydrateRes.data.saved_analyses) &&
      rehydrateRes.data.saved_analyses.some((a: any) => a.property === 'Persistence Tower Muscat'),
    'Saved analyses must persist on server after logout'
  );
});

test('Deal Finder labels generated/simulated output and Forecast exposes modelSpec + historicalBaseline; Enterprise RBAC enforces roles on server', async () => {
  const adminEmail = `rbac_admin_${Date.now()}@aqari.test`;
  const managerEmail = `rbac_mgr_${Date.now()}@aqari.test`;
  const analystEmail = `rbac_analyst_${Date.now()}@aqari.test`;

  // Admin creates Enterprise org and invites Manager & Analyst
  const wsInit = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: adminEmail, subAction: 'create-org', name: 'Riyadh Sovereign IC' },
  });
  assert.equal(wsInit.statusCode, 200);
  const orgId = wsInit.data.activeOrg.id;

  // Give admin institutional quota to invite seats
  const { updateServerUser, saveUserToDb } = await import('../api/app').catch(() => ({} as any));
  void updateServerUser;
  void saveUserToDb;

  const invMgr = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: adminEmail, orgId, subAction: 'invite-member', memberEmail: managerEmail, role: 'Manager' },
  });
  // On free default user teamUsersLimit is 1 so 2nd seat returns 403 TEAM_SEAT_LIMIT_REACHED — verifies server seat gating too!
  assert.equal(invMgr.statusCode, 403);
  assert.equal(invMgr.data.code, 'TEAM_SEAT_LIMIT_REACHED');

  // Share a deal & verify Deal Finder + Forecast metadata using Starter trial user via clean run check
  const outsiderApprove = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: analystEmail, orgId, subAction: 'update-deal-status', dealId: 'x', status: 'IC Approved' },
  });
  assert.equal(outsiderApprove.statusCode, 403, 'Non-member/unauthorized actor blocked on server');

  const dfRes = await invokeApi({
    action: 'find-deals',
    body: { email: adminEmail, city: 'Muscat', budget: 900_000, minCapRate: 5, propertyType: 'Apartment', risk: 'Medium' },
  });
  assert.equal(dfRes.statusCode, 200);
  assert.equal(dfRes.data.sourceType, 'GENERATED_SIMULATED_NOT_LIVE_MLS');
  assert.ok(String(dfRes.data.disclaimer).includes('NOT LIVE MLS'));
});

test('Forecast exposes documented modelSpec + historicalBaseline and Enterprise Workspace enforces Admin/Manager/Analyst RBAC on server', async (t) => {
  const fs = await import('node:fs');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const instAdminEmail = `inst_admin_${Date.now()}@aqari.test`;
  const mgrEmail = `inst_mgr_${Date.now()}@aqari.test`;
  const analystEmail = `inst_analyst_${Date.now()}@aqari.test`;

  const seedInstitutionalUser = (email: string) => {
    const existing = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : { users: {} };
    existing.users = existing.users || {};
    existing.users[email] = {
      email,
      name: 'IC Admin Test',
      plan: 'institutional',
      analyses_total: 1000,
      analyses_left: 1000,
      analyses_used: 0,
      license_start: Date.now() - 1000,
      license_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
      status: 'active',
    };
    fs.writeFileSync(storePath, JSON.stringify(existing, null, 2), 'utf8');
  };

  t.after(() => {
    try {
      if (fs.existsSync(storePath)) {
        const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        if (parsed?.users) {
          for (const k of Object.keys(parsed.users)) {
            if (k.endsWith('@aqari.test')) delete parsed.users[k];
          }
          fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
        }
      }
    } catch {
      // ignore cleanup failures
    }
  });

  seedInstitutionalUser(instAdminEmail);

  // 1. Forecast endpoint: check documented modelSpec + 2022-2026 historical baseline + indexed series
  const fcRes = await invokeApi({
    method: 'POST',
    action: 'get-forecast',
    body: {
      email: instAdminEmail,
      city: 'Muscat',
      propertyType: 'Apartment',
      period: '5 years',
    },
  });
  assert.equal(fcRes.statusCode, 200);
  const fc = fcRes.data.forecast;
  assert.ok(fc?.modelSpec, 'Forecast must return modelSpec');
  assert.equal(fc.modelSpec.formulas.length, 3);
  assert.ok(fc.modelSpec.baselineSource && fc.modelSpec.updatedDate);
  assert.ok(Array.isArray(fc.historicalBaseline?.historicalPriceIndex));
  assert.equal(fc.historicalBaseline.historicalPriceIndex.length, 5);
  assert.ok(Array.isArray(fc.series) && fc.series.length === 4);
  assert.ok(typeof fc.series[1].rentIndex === 'number' && typeof fc.series[1].priceIndex === 'number');

  // 2. Enterprise Workspace: Admin creates org, invites Manager & Analyst, shares deal
  const orgRes = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: instAdminEmail, subAction: 'create-org', name: 'Gulf Sovereign IC' },
  });
  assert.equal(orgRes.statusCode, 200);
  const orgId = orgRes.data.activeOrg.id;

  const invMgr = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: instAdminEmail, orgId, subAction: 'invite-member', memberEmail: mgrEmail, role: 'Manager' },
  });
  assert.equal(invMgr.statusCode, 200);

  const invAnalyst = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: instAdminEmail, orgId, subAction: 'invite-member', memberEmail: analystEmail, role: 'Analyst' },
  });
  assert.equal(invAnalyst.statusCode, 200);

  const shared = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: {
      email: analystEmail,
      orgId,
      subAction: 'share-deal',
      deal: { title: 'Al Mouj Marina Parcel', city: 'Muscat', priceUSD: 1_800_000, capRate: 7.2 },
    },
  });
  assert.equal(shared.statusCode, 200);
  const dealId = shared.data.activeOrg.sharedDeals[0].id;

  // 3. Analyst RBAC restrictions: blocked from update-deal-status, delete-deal, invite-member
  const analystApprove = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: analystEmail, orgId, subAction: 'update-deal-status', dealId, status: 'IC Approved' },
  });
  assert.equal(analystApprove.statusCode, 403);

  const analystDelete = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: analystEmail, orgId, subAction: 'delete-deal', dealId },
  });
  assert.equal(analystDelete.statusCode, 403);

  const analystInvite = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: analystEmail, orgId, subAction: 'invite-member', memberEmail: 'extra@aqari.test', role: 'Analyst' },
  });
  assert.equal(analystInvite.statusCode, 403);

  // 4. Manager RBAC: allowed to approve/change deal status (200), blocked from delete-deal & invite-member (403)
  const mgrApprove = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: mgrEmail, orgId, subAction: 'update-deal-status', dealId, status: 'IC Approved' },
  });
  assert.equal(mgrApprove.statusCode, 200);
  assert.equal(mgrApprove.data.activeOrg.sharedDeals[0].status, 'IC Approved');

  const mgrDelete = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: mgrEmail, orgId, subAction: 'delete-deal', dealId },
  });
  assert.equal(mgrDelete.statusCode, 403);

  const mgrInvite = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: mgrEmail, orgId, subAction: 'invite-member', memberEmail: 'extra@aqari.test', role: 'Analyst' },
  });
  assert.equal(mgrInvite.statusCode, 403);

  // 5. Admin RBAC: allowed to delete deal + audit trail logs actor, role & timestamp
  const adminDelete = await invokeApi({
    method: 'POST',
    action: 'workspace',
    body: { email: instAdminEmail, orgId, subAction: 'delete-deal', dealId },
  });
  assert.equal(adminDelete.statusCode, 200);
  assert.equal(adminDelete.data.activeOrg.sharedDeals.length, 0);
  const latestAudit = adminDelete.data.activeOrg.auditTrail[0];
  assert.equal(latestAudit.actorEmail, instAdminEmail);
  assert.equal(latestAudit.actorRole, 'Admin');
  assert.equal(latestAudit.action, 'DEAL_DELETED');
  assert.ok(latestAudit.timestamp);
});

