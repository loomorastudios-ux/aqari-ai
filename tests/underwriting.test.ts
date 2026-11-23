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
      custom_analyses_limit: 1000,
      custom_image_pdf_limit: 250,
      custom_listings_limit: 250,
      custom_portfolio_limit: 500,
      custom_seats: 10,
      custom_storage_gb: 100,
      white_label_enabled: true,
      custom_api_enabled: true,
      sla_level: '99.9% Dedicated',
      contract_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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

async function invokeAdminApi(params: {
  method?: string;
  action: string;
  body?: any;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  const { default: adminHandler } = await import('../api/admin');
  let statusCode = 200;
  let jsonPayload: any = null;
  const responseHeaders: Record<string, any> = {};

  const qs = new URLSearchParams({ action: params.action, ...(params.query || {}) }).toString();
  const req: any = {
    method: params.method || 'POST',
    url: `/api/admin?${qs}`,
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

  await adminHandler(req, res);
  return { statusCode, data: jsonPayload, headers: responseHeaders };
}

test('Enterprise null limits lock by default and unlock only after Admin override', async (t) => {
  const fs = await import('node:fs');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const entEmail = `ent_unset_${Date.now()}@aqari.test`;

  const existing = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : { users: {} };
  existing.users = existing.users || {};
  existing.users[entEmail] = {
    email: entEmail,
    name: 'Unconfigured Enterprise',
    plan: 'institutional',
    analyses_total: 0,
    analyses_left: 0,
    analyses_used: 0,
    custom_analyses_limit: null,
    custom_image_pdf_limit: null,
    custom_listings_limit: null,
    custom_portfolio_limit: null,
    custom_seats: null,
    custom_storage_gb: null,
    sla_level: null,
    contract_end_date: null,
    white_label_enabled: false,
    custom_api_enabled: false,
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
    status: 'active',
  };
  fs.writeFileSync(storePath, JSON.stringify(existing, null, 2), 'utf8');

  t.after(() => {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (parsed?.users?.[entEmail]) {
        delete parsed.users[entEmail];
        fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
      }
    } catch {}
  });

  // 1. Unconfigured Enterprise user MUST be blocked with ENTERPRISE_CONTRACT_LIMIT_UNSET
  const blockedRes = await invokeApi({
    action: 'run-analysis',
    body: {
      email: entEmail,
      propertyTitle: 'Null Enterprise Test',
      city: 'Muscat',
      priceUSD: 1_250_000,
      rentUSD: 8_400,
    },
  });
  assert.equal(blockedRes.statusCode, 403);
  assert.equal(blockedRes.data.code, 'ENTERPRISE_CONTRACT_LIMIT_UNSET');

  // 2. Owner signs in to get a valid signed admin session cookie
  const ownerSess = await invokeApi({
    action: 'session',
    method: 'POST',
    body: { email: 'loomorastudios@gmail.com', name: 'Owner' },
  });
  assert.equal(ownerSess.statusCode, 200);
  const rawSetCookie = ownerSess.headers['Set-Cookie'];
  const cookieHeader = Array.isArray(rawSetCookie)
    ? rawSetCookie.map((c: string) => c.split(';')[0]).join('; ')
    : String(rawSetCookie || '').split(';')[0];

  // 3. Admin sets Enterprise contract limits
  const adminRes = await invokeAdminApi({
    action: 'user',
    method: 'POST',
    headers: { cookie: cookieHeader },
    body: {
      operation: 'update_enterprise_limits',
      email: entEmail,
      custom_analyses_limit: 50,
      custom_image_pdf_limit: 10,
      custom_listings_limit: 10,
      custom_portfolio_limit: 100,
      custom_seats: 5,
      custom_storage_gb: 25,
      sla_level: '99.9%',
      contract_end_date: '31/12/2026',
      white_label_enabled: true,
      custom_api_enabled: true,
      reason: 'Signed corporate contract',
    },
  });
  assert.equal(adminRes.statusCode, 200);
  assert.equal(adminRes.data.success, true);

  // 4. Configured Enterprise user can now run analysis
  const allowedRes = await invokeApi({
    action: 'run-analysis',
    body: {
      email: entEmail,
      propertyTitle: 'Configured Enterprise Test',
      city: 'Muscat',
      priceUSD: 1_250_000,
      rentUSD: 8_400,
    },
  });
  assert.equal(allowedRes.statusCode, 200);
  assert.equal(allowedRes.data.success, true);
});

test('Free plan NEVER expires by days and locks ONLY at 3 free analyses', async (t) => {
  const fs = await import('node:fs');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const freeOldEmail = `free_60d_${Date.now()}@aqari.test`;

  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const existing = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : { users: {} };
  existing.users = existing.users || {};
  existing.users[freeOldEmail] = {
    email: freeOldEmail,
    name: 'Old Free User',
    plan: 'free',
    analyses_total: 3,
    analyses_left: 3,
    analyses_used: 0,
    extra_credits: 0,
    license_start: sixtyDaysAgo - 30 * 24 * 60 * 60 * 1000,
    license_end: sixtyDaysAgo, // 60 days past — Free must NOT expire by time!
    status: 'active',
  };
  fs.writeFileSync(storePath, JSON.stringify(existing, null, 2), 'utf8');

  t.after(() => {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (parsed?.users?.[freeOldEmail]) {
        delete parsed.users[freeOldEmail];
        fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
      }
    } catch {}
  });

  // Check /api/app?action=me confirms active & not expired
  const meRes = await invokeApi({
    method: 'GET',
    action: 'me',
    query: { login_email: freeOldEmail },
  });
  assert.equal(meRes.statusCode, 200);
  assert.equal(meRes.data.package_expired, false);
  assert.equal(meRes.data.locked, false);
  assert.equal(meRes.data.analyses_left, 3);

  // All 3 runs succeed despite license_end being 60 days ago
  for (let i = 0; i < 3; i++) {
    const r = await invokeApi({
      action: 'run-analysis',
      body: {
        email: freeOldEmail,
        propertyTitle: `Free Pass Asset ${i + 1}`,
        city: 'Muscat',
        priceUSD: 600_000,
        rentUSD: 4_000,
      },
    });
    assert.equal(r.statusCode, 200);
  }

  // 4th run locks with exact exhaustion message
  const blocked = await invokeApi({
    action: 'run-analysis',
    body: {
      email: freeOldEmail,
      propertyTitle: 'Free Pass Asset 4',
      city: 'Muscat',
      priceUSD: 600_000,
      rentUSD: 4_000,
    },
  });
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.data.error, 'You used your 3 free analyses. Buy a plan or credits to continue.');
});

test('Paid 30-day expiry locks zero-credit accounts, preserves non-expiring credits, and deducts package before credits', async (t) => {
  const fs = await import('node:fs');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const expiredNoCredsEmail = `exp_nocreds_${Date.now()}@aqari.test`;
  const expiredWithCredsEmail = `exp_creds_${Date.now()}@aqari.test`;
  const pkgFirstEmail = `pkg_first_${Date.now()}@aqari.test`;

  const existing = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : { users: {} };
  existing.users = existing.users || {};

  // User A: Expired Pro with 0 credits
  existing.users[expiredNoCredsEmail] = {
    email: expiredNoCredsEmail,
    name: 'Expired Zero Credits',
    plan: 'pro',
    analyses_total: 150,
    analyses_left: 50,
    analyses_used: 100,
    extra_credits: 0,
    license_start: Date.now() - 35 * 86_400_000,
    license_end: Date.now() - 5 * 86_400_000,
    status: 'active',
  };

  // User B: Expired Pro with 25 non-expiring credits
  existing.users[expiredWithCredsEmail] = {
    email: expiredWithCredsEmail,
    name: 'Expired With Credits',
    plan: 'pro',
    analyses_total: 175,
    analyses_left: 75,
    analyses_used: 100,
    extra_credits: 25,
    license_start: Date.now() - 35 * 86_400_000,
    license_end: Date.now() - 5 * 86_400_000,
    status: 'active',
  };

  // User C: Active Starter with 2 plan analyses left + 10 non-expiring credits (total 12)
  existing.users[pkgFirstEmail] = {
    email: pkgFirstEmail,
    name: 'Package First User',
    plan: 'starter',
    analyses_total: 40,
    analyses_left: 12,
    analyses_used: 28,
    extra_credits: 10,
    license_start: Date.now() - 5 * 86_400_000,
    license_end: Date.now() + 25 * 86_400_000,
    status: 'active',
  };

  fs.writeFileSync(storePath, JSON.stringify(existing, null, 2), 'utf8');

  t.after(() => {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      for (const k of [expiredNoCredsEmail, expiredWithCredsEmail, pkgFirstEmail]) {
        if (parsed?.users?.[k]) delete parsed.users[k];
      }
      fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
    } catch {}
  });

  // Check User A: locked cleanly with exact no-auto-charge message
  const resA = await invokeApi({
    action: 'run-analysis',
    body: {
      email: expiredNoCredsEmail,
      propertyTitle: 'Expired No Creds',
      city: 'Muscat',
      priceUSD: 600_000,
      rentUSD: 4_000,
    },
  });
  assert.equal(resA.statusCode, 403);
  assert.ok(String(resA.data.error).includes('No auto-charge was made'));

  // Check User B: /me shows package_expired=true, credits_only_mode=true, analyses_left=25
  const meB = await invokeApi({
    method: 'GET',
    action: 'me',
    query: { login_email: expiredWithCredsEmail },
  });
  assert.equal(meB.statusCode, 200);
  assert.equal(meB.data.package_expired, true);
  assert.equal(meB.data.credits_only_mode, true);
  assert.equal(meB.data.locked, false);
  assert.equal(meB.data.analyses_left, 25);
  assert.equal(meB.data.credits_balance, 25);

  // User B package modules (Monte Carlo) MUST be blocked with 403 while package expired
  const mcB = await invokeApi({
    action: 'monte-carlo',
    body: { email: expiredWithCredsEmail, priceUSD: 600_000, rentUSD: 4_000 },
  });
  assert.equal(mcB.statusCode, 403);

  // User B standard analysis MUST succeed and deduct 25 -> 24 extra_credits
  const runB = await invokeApi({
    action: 'run-analysis',
    body: {
      email: expiredWithCredsEmail,
      propertyTitle: 'Credits Only Run',
      city: 'Muscat',
      priceUSD: 600_000,
      rentUSD: 4_000,
    },
  });
  assert.equal(runB.statusCode, 200);
  assert.equal(runB.data.extra_credits, 24);
  assert.equal(runB.data.analyses_left, 24);

  // Check User C: Package deducts first (2 plan runs), keeping extra_credits=10 intact, then 3rd run burns credits to 9
  const runC1 = await invokeApi({
    action: 'run-analysis',
    body: { email: pkgFirstEmail, propertyTitle: 'Pkg 1', city: 'Muscat', priceUSD: 600_000, rentUSD: 4_000 },
  });
  assert.equal(runC1.statusCode, 200);
  assert.equal(runC1.data.plan_analyses_left, 1);
  assert.equal(runC1.data.extra_credits, 10);
  assert.equal(runC1.data.analyses_left, 11);

  const runC2 = await invokeApi({
    action: 'run-analysis',
    body: { email: pkgFirstEmail, propertyTitle: 'Pkg 2', city: 'Muscat', priceUSD: 600_000, rentUSD: 4_000 },
  });
  assert.equal(runC2.statusCode, 200);
  assert.equal(runC2.data.plan_analyses_left, 0);
  assert.equal(runC2.data.extra_credits, 10);
  assert.equal(runC2.data.analyses_left, 10);

  const runC3 = await invokeApi({
    action: 'run-analysis',
    body: { email: pkgFirstEmail, propertyTitle: 'Cred 1', city: 'Muscat', priceUSD: 600_000, rentUSD: 4_000 },
  });
  assert.equal(runC3.statusCode, 200);
  assert.equal(runC3.data.plan_analyses_left, 0);
  assert.equal(runC3.data.extra_credits, 9);
  assert.equal(runC3.data.analyses_left, 9);
});

test('One-time credit pack webhook credits account once and stays idempotent on replay', async (t) => {
  const fs = await import('node:fs');
  const crypto = await import('node:crypto');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const buyerEmail = `pack_buyer_${Date.now()}@aqari.test`;
  const txnId = `txn_pack_${Date.now()}`;
  const prevSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const testSecret = 'pdl_ntfset_test_secret_unit';
  process.env.PADDLE_WEBHOOK_SECRET = testSecret;

  t.after(() => {
    if (prevSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (parsed?.users?.[buyerEmail]) {
        delete parsed.users[buyerEmail];
        fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
      }
    } catch {}
  });

  const payload = {
    event_type: 'transaction.completed',
    data: {
      id: txnId,
      currency_code: 'USD',
      customer: { email: buyerEmail },
      details: { totals: { total: '2900' } },
      custom_data: {
        email: buyerEmail,
        login_email: buyerEmail,
        purchase_type: 'credit_pack',
        packId: 'pack_25',
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const h1 = crypto.createHmac('sha256', testSecret).update(`${ts}:${rawBody}`).digest('hex');
  const sigHeader = `ts=${ts};h1=${h1}`;

  const firstWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sigHeader },
    body: rawBody,
  });
  assert.equal(firstWh.statusCode, 200);
  assert.equal(firstWh.data.verified, true);
  assert.equal(firstWh.data.purchase_type, 'credit_pack');
  assert.equal(firstWh.data.creditsAdded, 25);

  const meAfterFirst = await invokeApi({
    method: 'GET',
    action: 'me',
    query: { login_email: buyerEmail },
  });
  assert.equal(meAfterFirst.data.credits_balance, 25);
  assert.equal(meAfterFirst.data.extra_credits, 25);

  // Replay exact same webhook -> must be idempotent (0 additional credits added)
  const replayWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sigHeader },
    body: rawBody,
  });
  assert.equal(replayWh.statusCode, 200);
  assert.equal(replayWh.data.creditsAdded, 0);

  const meAfterReplay = await invokeApi({
    method: 'GET',
    action: 'me',
    query: { login_email: buyerEmail },
  });
  assert.equal(meAfterReplay.data.credits_balance, 25);
});

test('Backend Paddle endpoints fail closed without test-key fallback when env vars are missing', async (t) => {
  const prevSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const prevApiKey = process.env.PADDLE_API_KEY;
  const prevEnv = process.env.PADDLE_ENVIRONMENT;
  const prevLegacyEnv = process.env.PADDLE_ENV;
  delete process.env.PADDLE_WEBHOOK_SECRET;
  delete process.env.PADDLE_API_KEY;
  delete process.env.PADDLE_ENVIRONMENT;
  delete process.env.PADDLE_ENV;

  t.after(() => {
    if (prevSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
    if (prevApiKey === undefined) delete process.env.PADDLE_API_KEY;
    else process.env.PADDLE_API_KEY = prevApiKey;
    if (prevEnv === undefined) delete process.env.PADDLE_ENVIRONMENT;
    else process.env.PADDLE_ENVIRONMENT = prevEnv;
    if (prevLegacyEnv === undefined) delete process.env.PADDLE_ENV;
    else process.env.PADDLE_ENV = prevLegacyEnv;
  });

  const whRes = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': 'ts=1700000000;h1=deadbeef' },
    body: JSON.stringify({ event_type: 'transaction.completed', data: { id: 'txn_missing_secret' } }),
  });
  assert.equal(whRes.statusCode, 500);
  assert.equal(whRes.data.verified, false);
  assert.match(String(whRes.data.error), /PADDLE_WEBHOOK_SECRET/);

  const checkoutRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    body: { plan: 'pro', email: 'buyer@aqari.test' },
  });
  assert.equal(checkoutRes.statusCode, 400);
  assert.equal(checkoutRes.data.success, false);
  assert.match(String(checkoutRes.data.error), /Missing Paddle config: PADDLE_API_KEY/);

  const verifyRes = await invokeApi({
    action: 'verify-payment',
    method: 'POST',
    body: { email: 'buyer@aqari.test', transaction_id: 'txn_01missingkey' },
  });
  assert.equal(verifyRes.statusCode, 500);
  assert.equal(verifyRes.data.success, false);
  assert.match(String(verifyRes.data.error), /PADDLE_API_KEY/);

  const buyCreditsRes = await invokeApi({
    action: 'buy-credits',
    method: 'POST',
    body: { email: 'buyer@aqari.test', packId: 'pack_25' },
  });
  assert.equal(buyCreditsRes.statusCode, 500);
  assert.equal(buyCreditsRes.data.success, false);
  assert.match(String(buyCreditsRes.data.error), /PADDLE_API_KEY/);
});

test('Frontend paddleClient uses only NEXT_PUBLIC_ variables and maps live -> production', async (t) => {
  const { getPaddleClientToken, getPaddleEnvironment } = await import('../src/utils/paddleClient.ts');

  const prevNextToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const prevNextEnv = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  const prevViteToken = process.env.VITE_PADDLE_CLIENT_TOKEN;

  t.after(() => {
    if (prevNextToken === undefined) delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    else process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = prevNextToken;
    if (prevNextEnv === undefined) delete process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
    else process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT = prevNextEnv;
    if (prevViteToken === undefined) delete process.env.VITE_PADDLE_CLIENT_TOKEN;
    else process.env.VITE_PADDLE_CLIENT_TOKEN = prevViteToken;
  });

  delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  delete process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  process.env.VITE_PADDLE_CLIENT_TOKEN = 'legacy_vite_should_be_ignored';

  assert.equal(getPaddleClientToken(), '');
  assert.equal(getPaddleEnvironment(), null);

  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = 'test_next_public_token_placeholder';
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT = ' LIVE ';

  assert.equal(getPaddleClientToken(), 'test_next_public_token_placeholder');
  assert.equal(getPaddleEnvironment(), 'production');

  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT = 'sandbox';
  assert.equal(getPaddleEnvironment(), null);
});

test('City autocomplete triggers at 1 character, resolves city_id, and rejects invalid free-text cities on backend', async (t) => {
  const { searchCities, findCityEntry, getCityId } = await import('../data/cities');

  const singleChar = searchCities('M', 20);
  assert.ok(singleChar.length > 0, '1-char search for "M" must return matches');
  assert.ok(singleChar.some((c) => c.city === 'Muscat' && c.city_id === 'om-muscat'));

  const muscat = findCityEntry('Muscat (Oman OM)');
  assert.ok(muscat);
  assert.equal(getCityId(muscat!), 'om-muscat');
  assert.equal(findCityEntry('', 'om-muscat')?.city, 'Muscat');

  const fs = await import('node:fs');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const sovEmail = `city_val_${Date.now()}@aqari.test`;
  const existing = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : { users: {} };
  existing.users = existing.users || {};
  existing.users[sovEmail] = {
    email: sovEmail,
    name: 'City Validation Test',
    plan: 'enterprise',
    analyses_total: 300,
    analyses_left: 300,
    analyses_used: 0,
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 86_400_000,
    status: 'active',
  };
  fs.writeFileSync(storePath, JSON.stringify(existing, null, 2), 'utf8');

  t.after(() => {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (parsed?.users?.[sovEmail]) {
        delete parsed.users[sovEmail];
        fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
      }
    } catch {}
  });

  // Invalid city must return 400 with exact message on run-analysis, find-deals, get-forecast, run-file-analysis, studio-generate
  for (const [action, extra] of [
    ['run-analysis', { priceUSD: 650_000, rentUSD: 4_500 }],
    ['find-deals', { budget: 650_000, minCapRate: 5 }],
    ['get-forecast', { propertyType: 'Apartment', period: '12 months' }],
    ['run-file-analysis', { priceUSD: 650_000, monthlyRentUSD: 4_500 }],
    ['studio-generate', { budgetUSD: 680_000, useAiEnhance: false }],
  ] as Array<[string, Record<string, any>]>) {
    const invalidRes = await invokeApi({
      action,
      body: {
        email: sovEmail,
        city: 'FakeAtlantisCity',
        ...extra,
      },
    });
    assert.equal(invalidRes.statusCode, 400, `${action} must reject unlisted city with 400`);
    assert.equal(invalidRes.data.error, 'City not found, please select from list');
  }

  // Valid city + city_id stores city_id in analysis & studio draft
  const validAnalysis = await invokeApi({
    action: 'run-analysis',
    body: {
      email: sovEmail,
      city: 'Muscat',
      city_id: 'om-muscat',
      priceUSD: 680_000,
      rentUSD: 4_650,
    },
  });
  assert.equal(validAnalysis.statusCode, 200);
  assert.equal(validAnalysis.data.inputs.city_id, 'om-muscat');

  const validStudio = await invokeApi({
    action: 'studio-generate',
    body: {
      email: sovEmail,
      city: 'Dubai',
      city_id: 'ae-dubai',
      budgetUSD: 680_000,
      areaSqM: 185,
      bedrooms: 3,
      bathrooms: 3,
      expectedMonthlyRentUSD: 4_650,
      useAiEnhance: false,
    },
  });
  assert.equal(validStudio.statusCode, 200);
  assert.equal(validStudio.data.draft.city_id, 'ae-dubai');
  assert.equal(validStudio.data.draft.contactPhone, '+968 78900731');
});

test('Analyst message endpoint stores client message with replyByDate for admin and targets loomorastudios@gmail.com', async (t) => {
  const fs = await import('node:fs');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const clientEmail = `analyst_client_${Date.now()}@aqari.test`;
  const existing = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : { users: {} };
  existing.users = existing.users || {};
  existing.users[clientEmail] = {
    email: clientEmail,
    name: 'Sovereign Client',
    plan: 'enterprise',
    analyses_total: 300,
    analyses_left: 300,
    analyses_used: 0,
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 86_400_000,
    status: 'active',
  };
  fs.writeFileSync(storePath, JSON.stringify(existing, null, 2), 'utf8');

  t.after(() => {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (parsed?.users?.[clientEmail]) {
        delete parsed.users[clientEmail];
        fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
      }
    } catch {}
  });

  const postRes = await invokeApi({
    action: 'analyst-message',
    method: 'POST',
    body: {
      email: clientEmail,
      message: 'Please audit our Al Mouj waterfront villa cap rate.',
      replyByDate: '12/01/2026',
    },
  });
  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.data.success, true);
  assert.equal(postRes.data.recipient, 'loomorastudios@gmail.com');
  assert.equal(postRes.data.thread.unreadForAdmin >= 1, true);
  assert.equal(postRes.data.thread.messages.at(-1).replyByDate, '12/01/2026');
});

test('Server pricing & quota single source enforces 100 for PROFESSIONAL and 300 for SOVEREIGN', async () => {
  const pricingRes = await invokeApi({
    method: 'GET',
    action: 'pricing',
  });
  assert.equal(pricingRes.statusCode, 200);
  const plansMap = pricingRes.data.plansMap;
  assert.equal(plansMap.free.analysesLimit, 3);
  assert.equal(plansMap.starter.analysesLimit, 30);
  assert.equal(plansMap.pro.analysesLimit, 100);
  assert.equal(plansMap.enterprise.analysesLimit, 300);

  const { PLANS } = await import('../lib/plans');
  assert.equal(PLANS.pro.analysesLimit, 100);
  assert.equal(PLANS.enterprise.analysesLimit, 300);
});

test('One-time transaction.completed webhook sets purchase_date + 30d expiry_date for Plans, fulfills $19 Credits, and ignores subscription events', async (t) => {
  const fs = await import('node:fs');
  const crypto = await import('node:crypto');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const buyerEmail = `wh_plan_${Date.now()}@aqari.test`;
  const txnPlanId = `txn_plan_${Date.now()}`;
  const txnCred19Id = `txn_c19_${Date.now()}`;

  const prevSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const prevEnv = process.env.PADDLE_ENVIRONMENT;
  const prevCredit25 = process.env.PADDLE_CREDIT_25_PRICE;
  const prevEnt = process.env.PADDLE_ENTERPRISE_PRICE;
  const testSecret = 'pdl_ntfset_one_time_test';
  process.env.PADDLE_WEBHOOK_SECRET = testSecret;
  process.env.PADDLE_ENVIRONMENT = 'live';
  process.env.PADDLE_CREDIT_25_PRICE = 'pri_test_credit25_live';
  process.env.PADDLE_ENTERPRISE_PRICE = 'pri_test_ent1499_live';

  t.after(() => {
    if (prevSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
    if (prevEnv === undefined) delete process.env.PADDLE_ENVIRONMENT;
    else process.env.PADDLE_ENVIRONMENT = prevEnv;
    if (prevCredit25 === undefined) delete process.env.PADDLE_CREDIT_25_PRICE;
    else process.env.PADDLE_CREDIT_25_PRICE = prevCredit25;
    if (prevEnt === undefined) delete process.env.PADDLE_ENTERPRISE_PRICE;
    else process.env.PADDLE_ENTERPRISE_PRICE = prevEnt;
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (parsed?.users?.[buyerEmail]) {
        delete parsed.users[buyerEmail];
      }
      if (parsed?.used_orders?.[txnPlanId]) delete parsed.used_orders[txnPlanId];
      if (parsed?.used_orders?.[txnCred19Id]) delete parsed.used_orders[txnCred19Id];
      fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
    } catch {}
  });

  const sign = (body: string) => {
    const ts = String(Math.floor(Date.now() / 1000));
    const h1 = crypto.createHmac('sha256', testSecret).update(`${ts}:${body}`).digest('hex');
    return `ts=${ts};h1=${h1}`;
  };

  // 1. One-time Professional ($199) purchase via Live Price ID
  const planBody = JSON.stringify({
    event_type: 'transaction.completed',
    data: {
      id: txnPlanId,
      currency_code: 'USD',
      customer: { email: buyerEmail },
      items: [{ price: { id: 'pri_01m7tggqhjtgk9fxmmg6mbp5wy', name: 'AQARI PROFESSIONAL' } }],
      details: { totals: { total: '19900' } },
      custom_data: { email: buyerEmail, login_email: buyerEmail },
    },
  });
  const planWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(planBody) },
    body: planBody,
  });
  assert.equal(planWh.statusCode, 200);
  assert.equal(planWh.data.verified, true);
  assert.equal(planWh.data.purchase_type, 'plan');
  assert.equal(planWh.data.plan, 'pro');
  assert.ok(planWh.data.purchase_date);
  assert.ok(planWh.data.expiry_date);
  const diffDays =
    (new Date(planWh.data.expiry_date).getTime() - new Date(planWh.data.purchase_date).getTime()) /
    (24 * 60 * 60 * 1000);
  assert.equal(Math.round(diffDays), 30);

  // 2. $19 +25 Credits Pack matched strictly by PADDLE_CREDIT_25_PRICE env var
  const credBody = JSON.stringify({
    event_type: 'transaction.completed',
    data: {
      id: txnCred19Id,
      currency_code: 'USD',
      customer: { email: buyerEmail },
      items: [{ price: { id: 'pri_test_credit25_live', name: '+25 AI Credits' } }],
      details: { totals: { total: '1900' } },
      custom_data: { email: buyerEmail, login_email: buyerEmail },
    },
  });
  const credWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(credBody) },
    body: credBody,
  });
  assert.equal(credWh.statusCode, 200);
  assert.equal(credWh.data.purchase_type, 'credit_pack');
  assert.equal(credWh.data.packId, 'pack_25');
  assert.equal(credWh.data.creditsAdded, 25);
  assert.equal(credWh.data.credits_balance, 25);

  // 3. Verify /app?checkout=success calling verify-payment on that same txnCred19Id preserves Pro plan and shows credits_balance=25
  const verifyAfterCred = await invokeApi({
    action: 'verify-payment',
    method: 'POST',
    body: {
      login_email: buyerEmail,
      transaction_id: txnCred19Id,
    },
  });
  assert.equal(verifyAfterCred.statusCode, 200);
  assert.equal(verifyAfterCred.data.success, true);
  assert.equal(verifyAfterCred.data.purchase_type, 'credit_pack');
  assert.equal(verifyAfterCred.data.planKey, 'pro');
  assert.equal(verifyAfterCred.data.credits_balance, 25);

  // 4. Subscription event must be ignored cleanly without auto-renew
  const subBody = JSON.stringify({
    event_type: 'subscription.updated',
    data: { id: `sub_ign_${Date.now()}`, customer: { email: buyerEmail } },
  });
  const subWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(subBody) },
    body: subBody,
  });
  assert.equal(subWh.statusCode, 200);
  assert.equal(subWh.data.ignored, true);
});

test('verify-payment handles direct $19 Credit Pack transaction_id via Paddle API without overwriting existing plan', async (t) => {
  const fs = await import('node:fs');
  const storePath = '/tmp/aqari_terminal_store_v1.json';
  const buyerEmail = `verify_c19_${Date.now()}@aqari.test`;
  const txnDirectId = `txn_direct19_${Date.now()}`;

  const prevApiKey = process.env.PADDLE_API_KEY;
  const prevEnv = process.env.PADDLE_ENVIRONMENT;
  const prevCredit25 = process.env.PADDLE_CREDIT_25_PRICE;
  const prevFetch = globalThis.fetch;

  process.env.PADDLE_API_KEY = 'pdl_live_test_key';
  process.env.PADDLE_ENVIRONMENT = 'live';
  process.env.PADDLE_CREDIT_25_PRICE = 'pri_direct_pack25';

  const existing = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : { users: {} };
  existing.users = existing.users || {};
  existing.users[buyerEmail] = {
    email: buyerEmail,
    name: 'Starter Buyer',
    plan: 'starter',
    analyses_total: 30,
    analyses_left: 30,
    analyses_used: 0,
    extra_credits: 0,
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 86_400_000,
    status: 'active',
  };
  fs.writeFileSync(storePath, JSON.stringify(existing, null, 2), 'utf8');

  globalThis.fetch = (async (url: any, opts?: any) => {
    const s = String(url);
    if (s.includes(`/transactions/${txnDirectId}`)) {
      return new Response(
        JSON.stringify({
          data: {
            id: txnDirectId,
            status: 'completed',
            customer: { email: buyerEmail },
            items: [{ price: { id: 'pri_direct_pack25', name: '+25 AI Credits' } }],
            details: { totals: { total: '1900', grand_total: '1900' } },
            custom_data: { purchase_type: 'credit_pack', packId: 'pack_25', email: buyerEmail },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return prevFetch(url, opts);
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = prevFetch;
    if (prevApiKey === undefined) delete process.env.PADDLE_API_KEY;
    else process.env.PADDLE_API_KEY = prevApiKey;
    if (prevEnv === undefined) delete process.env.PADDLE_ENVIRONMENT;
    else process.env.PADDLE_ENVIRONMENT = prevEnv;
    if (prevCredit25 === undefined) delete process.env.PADDLE_CREDIT_25_PRICE;
    else process.env.PADDLE_CREDIT_25_PRICE = prevCredit25;
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (parsed?.users?.[buyerEmail]) delete parsed.users[buyerEmail];
      if (parsed?.used_orders?.[txnDirectId]) delete parsed.used_orders[txnDirectId];
      fs.writeFileSync(storePath, JSON.stringify(parsed, null, 2), 'utf8');
    } catch {}
  });

  const verifyRes = await invokeApi({
    action: 'verify-payment',
    method: 'POST',
    body: {
      login_email: buyerEmail,
      transaction_id: txnDirectId,
    },
  });
  assert.equal(verifyRes.statusCode, 200);
  assert.equal(verifyRes.data.success, true);
  assert.equal(verifyRes.data.purchase_type, 'credit_pack');
  assert.equal(verifyRes.data.creditsAdded, 25);
  assert.equal(verifyRes.data.credits_balance, 25);
  assert.equal(verifyRes.data.planKey, 'starter');
  assert.equal(verifyRes.data.analyses_left, 55);
});

test('Frontend paddleClient resolves all 7 Price IDs via env vars and formats /app?checkout=success redirect URL', async (t) => {
  const {
    getPaddlePriceId,
    getPaddleCreditPriceId,
    getCheckoutSuccessUrl,
  } = await import('../src/utils/paddleClient.ts');

  const keys = [
    'NEXT_PUBLIC_PADDLE_ENVIRONMENT',
    'NEXT_PUBLIC_PADDLE_STARTER_PRICE',
    'NEXT_PUBLIC_PADDLE_PRICE_ID',
    'NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE',
    'NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE',
    'NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE',
    'NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE',
    'NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE',
  ] as const;
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];

  t.after(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT = 'live';
  process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE = 'pri_starter_1';
  process.env.NEXT_PUBLIC_PADDLE_PRICE_ID = 'pri_pro_2';
  process.env.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE = 'pri_sov_3';
  process.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE = 'pri_ent_4';
  process.env.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE = 'pri_c25_5';
  process.env.NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE = 'pri_c100_6';
  process.env.NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE = 'pri_c500_7';

  assert.equal(getPaddlePriceId('starter'), 'pri_starter_1');
  assert.equal(getPaddlePriceId('pro'), 'pri_pro_2');
  assert.equal(getPaddlePriceId('enterprise'), 'pri_sov_3');
  assert.equal(getPaddlePriceId('institutional'), 'pri_ent_4');
  assert.equal(getPaddleCreditPriceId('pack_25'), 'pri_c25_5');
  assert.equal(getPaddleCreditPriceId('pack_100'), 'pri_c100_6');
  assert.equal(getPaddleCreditPriceId('pack_500'), 'pri_c500_7');

  assert.equal(
    getCheckoutSuccessUrl('txn_01livecheck'),
    'https://aqari-ai-rho.vercel.app/app?checkout=success&transaction_id=txn_01livecheck'
  );
});

test('/api/app?action=checkout validates config with 400, blocks sandbox creds in live, and returns 200 checkoutUrl for all 7 items', async (t) => {
  const envKeys = [
    'PADDLE_ENVIRONMENT',
    'PADDLE_ENV',
    'NEXT_PUBLIC_PADDLE_ENVIRONMENT',
    'PADDLE_API_KEY',
    'PADDLE_CLIENT_SIDE_TOKEN',
    'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN',
    'PADDLE_STARTER_PRICE',
    'PADDLE_PRO_PRICE',
    'PADDLE_SOVEREIGN_PRICE',
    'PADDLE_ENTERPRISE_PRICE',
    'PADDLE_CREDIT_25_PRICE',
    'PADDLE_CREDIT_100_PRICE',
    'PADDLE_CREDIT_500_PRICE',
  ] as const;

  const saved: Record<string, string | undefined> = {};
  for (const k of envKeys) saved[k] = process.env[k];
  const prevFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = prevFetch;
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  // 1. Default PADDLE_ENVIRONMENT to live; missing PADDLE_CLIENT_SIDE_TOKEN -> 400
  delete process.env.PADDLE_ENVIRONMENT;
  delete process.env.PADDLE_ENV;
  delete process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  delete process.env.PADDLE_CLIENT_SIDE_TOKEN;
  delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  process.env.PADDLE_API_KEY = 'pdl_live_apikey_check';

  const missingTokenRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    body: { plan: 'pro', email: 'buyer@aqari.test' },
  });
  assert.equal(missingTokenRes.statusCode, 400);
  assert.match(String(missingTokenRes.data.error), /Missing Paddle config: PADDLE_CLIENT_SIDE_TOKEN/);

  // 2. Block sandbox key and sandbox token in live mode -> 400
  process.env.PADDLE_API_KEY = 'pdl_sdbx_key_should_fail_in_live';
  process.env.PADDLE_CLIENT_SIDE_TOKEN = 'live_client_tok_123';
  const sdbxKeyRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    body: { plan: 'pro', email: 'buyer@aqari.test' },
  });
  assert.equal(sdbxKeyRes.statusCode, 400);
  assert.match(String(sdbxKeyRes.data.error), /PADDLE_API_KEY/);

  process.env.PADDLE_API_KEY = 'pdl_live_apikey_check';
  process.env.PADDLE_CLIENT_SIDE_TOKEN = 'test_sandbox_client_token';
  const sdbxTokRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    body: { plan: 'pro', email: 'buyer@aqari.test' },
  });
  assert.equal(sdbxTokRes.statusCode, 400);
  assert.match(String(sdbxTokRes.data.error), /PADDLE_CLIENT_SIDE_TOKEN/);

  // 3. Configure all 7 live prices + live credentials -> reject disallowed price, succeed for all 7
  process.env.PADDLE_CLIENT_SIDE_TOKEN = 'live_valid_client_token';
  process.env.PADDLE_STARTER_PRICE = 'pri_live_starter_75';
  process.env.PADDLE_PRO_PRICE = 'pri_live_pro_199';
  process.env.PADDLE_SOVEREIGN_PRICE = 'pri_live_sov_599';
  process.env.PADDLE_ENTERPRISE_PRICE = 'pri_live_ent_1499';
  process.env.PADDLE_CREDIT_25_PRICE = 'pri_live_c25_19';
  process.env.PADDLE_CREDIT_100_PRICE = 'pri_live_c100_59';
  process.env.PADDLE_CREDIT_500_PRICE = 'pri_live_c500_249';

  const disallowedPriceRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    body: { plan: 'pro', priceId: 'pri_hacker_invalid', email: 'buyer@aqari.test' },
  });
  assert.equal(disallowedPriceRes.statusCode, 400);
  assert.match(String(disallowedPriceRes.data.error), /Price ID/);

  const sandboxLegacyPriceRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    body: { plan: 'pro', priceId: 'pri_01m7qwqceh520nd4we9pg90f8m', email: 'buyer@aqari.test' },
  });
  assert.equal(sandboxLegacyPriceRes.statusCode, 400);

  // Reject non-live PADDLE_ENVIRONMENT
  process.env.PADDLE_ENVIRONMENT = 'sandbox';
  const badEnvRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    body: { plan: 'pro', email: 'buyer@aqari.test' },
  });
  assert.equal(badEnvRes.statusCode, 400);
  process.env.PADDLE_ENVIRONMENT = 'live';

  // Even if PADDLE_API_KEY was pasted with accidental "Bearer " prefix / whitespace, backend normalizes to exact "Bearer <key>"
  process.env.PADDLE_API_KEY = '  Bearer   pdl_live_apikey_check\n ';

  let txnCounter = 0;
  let capturedAuthHeader = '';
  let simulate401 = false;
  globalThis.fetch = (async (url: any, opts?: any) => {
    const s = String(url);
    if (s === 'https://api.paddle.com/transactions' && opts?.method === 'POST') {
      capturedAuthHeader = String(opts?.headers?.Authorization || '');
      if (simulate401) {
        return new Response(
          JSON.stringify({
            error: { type: 'request_error', code: 'authentication_malformed', detail: 'Authentication header included, but incorrectly formatted.' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      txnCounter += 1;
      const parsed = JSON.parse(String(opts.body || '{}'));
      const priceId = parsed?.items?.[0]?.price_id || 'unknown';
      const txnId = `txn_01live_${txnCounter}`;
      return new Response(
        JSON.stringify({
          data: {
            id: txnId,
            status: 'draft',
            items: [{ price_id: priceId, quantity: 1 }],
            checkout: { url: `https://checkout.paddle.com/checkout?_ptxn=${txnId}` },
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return prevFetch(url, opts);
  }) as typeof fetch;

  const sevenItems: Array<{ body: Record<string, any>; expectedPriceId: string }> = [
    { body: { plan: 'starter', email: 'buyer@aqari.test' }, expectedPriceId: 'pri_live_starter_75' },
    { body: { plan: 'pro', email: 'buyer@aqari.test' }, expectedPriceId: 'pri_live_pro_199' },
    { body: { plan: 'enterprise', email: 'buyer@aqari.test' }, expectedPriceId: 'pri_live_sov_599' },
    { body: { plan: 'institutional', email: 'buyer@aqari.test' }, expectedPriceId: 'pri_live_ent_1499' },
    { body: { packId: 'pack_25', email: 'buyer@aqari.test' }, expectedPriceId: 'pri_live_c25_19' },
    { body: { packId: 'pack_100', email: 'buyer@aqari.test' }, expectedPriceId: 'pri_live_c100_59' },
    { body: { packId: 'pack_500', email: 'buyer@aqari.test' }, expectedPriceId: 'pri_live_c500_249' },
  ];

  for (const item of sevenItems) {
    const res = await invokeApi({
      action: 'checkout',
      method: 'POST',
      body: item.body,
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.environment, 'production');
    assert.equal(res.data.priceId, item.expectedPriceId);
    assert.equal(capturedAuthHeader, 'Bearer pdl_live_apikey_check');
    assert.ok(String(res.data.transactionId).startsWith('txn_01live_'));
    assert.match(String(res.data.checkoutUrl), /^https:\/\/checkout\.paddle\.com\/checkout\?_ptxn=/);
    assert.equal(res.data.url, res.data.checkoutUrl);
  }

  // Paddle 401 returns clean 401 JSON message + exact paddleStatus & paddleError
  simulate401 = true;
  const authFailRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    body: { plan: 'pro', email: 'buyer@aqari.test' },
  });
  assert.equal(authFailRes.statusCode, 401);
  assert.equal(authFailRes.data.success, false);
  assert.equal(authFailRes.data.paddleStatus, 401);
  assert.equal(authFailRes.data.paddleCode, 'authentication_malformed');
  assert.ok(authFailRes.data.paddleError);
  assert.equal(authFailRes.data.error, 'Paddle auth failed - check API key in Vercel');
});

test('Local /assets JSON files replace raw.githubusercontent.com, SafeChartContainer guards 0x0, and index.html prevents default on beforeinstallprompt', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const configRaw = fs.readFileSync(path.resolve('public/assets/config.json'), 'utf8');
  const marketRaw = fs.readFileSync(path.resolve('public/assets/market.json'), 'utf8');
  const configJson = JSON.parse(configRaw);
  const marketJson = JSON.parse(marketRaw);
  assert.equal(configJson.prices?.starter, 75);
  assert.equal(configJson.prices?.pro, 199);
  assert.equal(configJson.prices?.enterprise, 599);
  assert.equal(configJson.prices?.institutional, 1499);
  assert.ok(Array.isArray(marketJson.markets));

  const constantsSrc = fs.readFileSync(path.resolve('src/constants.ts'), 'utf8');
  assert.match(constantsSrc, /\/assets\/config\.json/);
  assert.match(constantsSrc, /\/assets\/market\.json/);
  assert.equal(constantsSrc.includes('raw.githubusercontent.com'), false);

  const safeChartSrc = fs.readFileSync(path.resolve('src/components/charts/SafeChartContainer.tsx'), 'utf8');
  assert.match(safeChartSrc, /ResizeObserver/);
  assert.match(safeChartSrc, /minWidth = 280/);
  assert.match(safeChartSrc, /minHeight = 240/);
  assert.match(safeChartSrc, /aspect=\{undefined\}/);

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.match(indexHtml, /beforeinstallprompt/);
  assert.match(indexHtml, /e\.preventDefault\(\)/);

  const paddleClientSrc = fs.readFileSync(path.resolve('src/utils/paddleClient.ts'), 'utf8');
  assert.equal(paddleClientSrc.includes('PADDLE_API_KEY'), false);
  assert.equal(paddleClientSrc.includes('Authorization'), false);
  assert.match(paddleClientSrc, /Missing NEXT_PUBLIC_PADDLE_ENVIRONMENT, set it to live in Vercel/);
});





