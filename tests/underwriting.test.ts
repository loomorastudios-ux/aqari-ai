import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  calculateUnderwriting,
  computePortfolioAggregation,
  runMonteCarloSimulation,
} from '../lib/underwriting';

// In-process Upstash Redis REST server for deterministic persistent-storage tests
interface MockRedisState {
  kv: Map<string, string>;
  expiresAt: Map<string, number>;
  lists: Map<string, string[]>;
  sets: Map<string, Set<string>>;
}

const mockRedisState: MockRedisState = {
  kv: new Map(),
  expiresAt: new Map(),
  lists: new Map(),
  sets: new Map(),
};

function pruneIfExpired(key: string): void {
  const exp = mockRedisState.expiresAt.get(key);
  if (exp !== undefined && Date.now() >= exp) {
    mockRedisState.expiresAt.delete(key);
    mockRedisState.kv.delete(key);
    mockRedisState.lists.delete(key);
    mockRedisState.sets.delete(key);
  }
}

function keyExistsInMock(key: string): boolean {
  pruneIfExpired(key);
  return (
    mockRedisState.kv.has(key) ||
    mockRedisState.lists.has(key) ||
    mockRedisState.sets.has(key)
  );
}

function execMockRedisCommand(cmdArr: any[]): any {
  if (!Array.isArray(cmdArr) || cmdArr.length === 0) return null;
  const cmd = String(cmdArr[0] || '').toUpperCase();
  const args = cmdArr.slice(1);

  switch (cmd) {
    case 'PING':
      return 'PONG';
    case 'MULTI':
      return 'OK';
    case 'EXEC':
      return [];
    case 'GET': {
      const k = String(args[0]);
      pruneIfExpired(k);
      return mockRedisState.kv.has(k) ? mockRedisState.kv.get(k)! : null;
    }
    case 'MGET': {
      return args.map((rawK) => {
        const k = String(rawK);
        pruneIfExpired(k);
        return mockRedisState.kv.has(k) ? mockRedisState.kv.get(k)! : null;
      });
    }
    case 'SET': {
      const k = String(args[0]);
      const v = String(args[1] ?? '');
      pruneIfExpired(k);
      let nx = false;
      let ttlMs: number | null = null;
      for (let i = 2; i < args.length; i++) {
        const flag = String(args[i]).toUpperCase();
        if (flag === 'NX') nx = true;
        else if (flag === 'EX' && args[i + 1] !== undefined) {
          ttlMs = Math.max(1, Number(args[++i])) * 1000;
        } else if (flag === 'PX' && args[i + 1] !== undefined) {
          ttlMs = Math.max(1, Number(args[++i]));
        }
      }
      if (nx && keyExistsInMock(k)) {
        return null;
      }
      mockRedisState.kv.set(k, v);
      if (ttlMs !== null && Number.isFinite(ttlMs)) {
        mockRedisState.expiresAt.set(k, Date.now() + ttlMs);
      } else {
        mockRedisState.expiresAt.delete(k);
      }
      return 'OK';
    }
    case 'DEL': {
      let count = 0;
      for (const rawK of args) {
        const k = String(rawK);
        if (keyExistsInMock(k)) count++;
        mockRedisState.kv.delete(k);
        mockRedisState.lists.delete(k);
        mockRedisState.sets.delete(k);
        mockRedisState.expiresAt.delete(k);
      }
      return count;
    }
    case 'EXISTS': {
      let count = 0;
      for (const rawK of args) {
        if (keyExistsInMock(String(rawK))) count++;
      }
      return count;
    }
    case 'INCR': {
      const k = String(args[0]);
      pruneIfExpired(k);
      const cur = Number(mockRedisState.kv.get(k) ?? '0');
      const next = (Number.isFinite(cur) ? Math.trunc(cur) : 0) + 1;
      mockRedisState.kv.set(k, String(next));
      return next;
    }
    case 'INCRBY': {
      const k = String(args[0]);
      const delta = Math.trunc(Number(args[1] || 0));
      pruneIfExpired(k);
      const cur = Number(mockRedisState.kv.get(k) ?? '0');
      const next = (Number.isFinite(cur) ? Math.trunc(cur) : 0) + delta;
      mockRedisState.kv.set(k, String(next));
      return next;
    }
    case 'DECRBY': {
      const k = String(args[0]);
      const delta = Math.trunc(Number(args[1] || 0));
      pruneIfExpired(k);
      const cur = Number(mockRedisState.kv.get(k) ?? '0');
      const next = (Number.isFinite(cur) ? Math.trunc(cur) : 0) - delta;
      mockRedisState.kv.set(k, String(next));
      return next;
    }
    case 'PEXPIRE': {
      const k = String(args[0]);
      const ms = Math.trunc(Number(args[1] || 0));
      if (!keyExistsInMock(k)) return 0;
      mockRedisState.expiresAt.set(k, Date.now() + ms);
      return 1;
    }
    case 'EXPIRE': {
      const k = String(args[0]);
      const sec = Math.trunc(Number(args[1] || 0));
      if (!keyExistsInMock(k)) return 0;
      mockRedisState.expiresAt.set(k, Date.now() + sec * 1000);
      return 1;
    }
    case 'PTTL': {
      const k = String(args[0]);
      pruneIfExpired(k);
      if (!keyExistsInMock(k)) return -2;
      const exp = mockRedisState.expiresAt.get(k);
      if (exp === undefined) return -1;
      return Math.max(0, exp - Date.now());
    }
    case 'SADD': {
      const k = String(args[0]);
      pruneIfExpired(k);
      let s = mockRedisState.sets.get(k);
      if (!s) {
        s = new Set();
        mockRedisState.sets.set(k, s);
      }
      let added = 0;
      for (const m of args.slice(1)) {
        const val = String(m);
        if (!s.has(val)) {
          s.add(val);
          added++;
        }
      }
      return added;
    }
    case 'SREM': {
      const k = String(args[0]);
      pruneIfExpired(k);
      const s = mockRedisState.sets.get(k);
      if (!s) return 0;
      let removed = 0;
      for (const m of args.slice(1)) {
        if (s.delete(String(m))) removed++;
      }
      return removed;
    }
    case 'SMEMBERS': {
      const k = String(args[0]);
      pruneIfExpired(k);
      const s = mockRedisState.sets.get(k);
      return s ? Array.from(s) : [];
    }
    case 'LPUSH': {
      const k = String(args[0]);
      pruneIfExpired(k);
      let arr = mockRedisState.lists.get(k);
      if (!arr) {
        arr = [];
        mockRedisState.lists.set(k, arr);
      }
      for (const v of args.slice(1)) {
        arr.unshift(String(v));
      }
      return arr.length;
    }
    case 'LLEN': {
      const k = String(args[0]);
      pruneIfExpired(k);
      return (mockRedisState.lists.get(k) || []).length;
    }
    case 'LSET': {
      const k = String(args[0]);
      const idx = Math.trunc(Number(args[1]));
      const val = String(args[2] ?? '');
      const arr = mockRedisState.lists.get(k);
      if (!arr || idx < 0 || idx >= arr.length) return null;
      arr[idx] = val;
      return 'OK';
    }
    case 'LTRIM': {
      const k = String(args[0]);
      const arr = mockRedisState.lists.get(k);
      if (!arr) return 'OK';
      let start = Math.trunc(Number(args[1]));
      let stop = Math.trunc(Number(args[2]));
      if (start < 0) start = Math.max(0, arr.length + start);
      if (stop < 0) stop = arr.length + stop;
      if (start > stop || start >= arr.length) {
        mockRedisState.lists.set(k, []);
      } else {
        mockRedisState.lists.set(k, arr.slice(start, stop + 1));
      }
      return 'OK';
    }
    case 'LRANGE': {
      const k = String(args[0]);
      pruneIfExpired(k);
      const arr = mockRedisState.lists.get(k) || [];
      let start = Math.trunc(Number(args[1]));
      let stop = Math.trunc(Number(args[2]));
      if (start < 0) start = Math.max(0, arr.length + start);
      if (stop < 0) stop = arr.length + stop;
      if (start > stop || start >= arr.length) return [];
      return arr.slice(start, stop + 1);
    }
    case 'EVAL': {
      const script = String(args[0] || '');
      const numKeys = Math.max(0, Math.trunc(Number(args[1] || 0)));
      const keys = args.slice(2, 2 + numKeys).map(String);
      const argv = args.slice(2 + numKeys).map(String);

      if (script.includes('DECRBY')) {
        const key = keys[0];
        pruneIfExpired(key);
        const raw = mockRedisState.kv.get(key);
        if (raw === undefined) return [-1, 0];
        const cur = Number(raw);
        const amt = Number(argv[0]);
        if (!Number.isFinite(amt) || amt < 0) return [-2, Number.isFinite(cur) ? cur : 0];
        if (amt === 0) return [1, Number.isFinite(cur) ? cur : 0];
        if (!Number.isFinite(cur) || cur < amt) return [0, Number.isFinite(cur) ? cur : 0];
        const nextVal = cur - amt;
        mockRedisState.kv.set(key, String(nextVal));
        return [1, nextVal];
      }

      if (script.includes('SADD') && script.includes('EXISTS')) {
        const payKey = keys[0];
        const legKey = keys[1];
        const idxKey = keys[2];
        if (keyExistsInMock(payKey) || keyExistsInMock(legKey)) {
          return 0;
        }
        mockRedisState.kv.set(payKey, argv[0]);
        let s = mockRedisState.sets.get(idxKey);
        if (!s) {
          s = new Set();
          mockRedisState.sets.set(idxKey, s);
        }
        s.add(argv[1]);
        return 1;
      }

      if (script.includes('PTTL') && script.includes('INCR')) {
        const key = keys[0];
        const win = Math.max(1000, Math.trunc(Number(argv[0] || 60000)));
        pruneIfExpired(key);
        const cur = Number(mockRedisState.kv.get(key) ?? '0');
        const count = (Number.isFinite(cur) ? Math.trunc(cur) : 0) + 1;
        mockRedisState.kv.set(key, String(count));
        let pttl = execMockRedisCommand(['PTTL', key]);
        if (count === 1 || pttl <= 0) {
          mockRedisState.expiresAt.set(key, Date.now() + win);
          pttl = win;
        }
        return [count, pttl];
      }

      return null;
    }
    default:
      throw new Error(`Unsupported mock Redis command: ${cmd}`);
  }
}

const mockRedisServer = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try {
      const bodyStr = Buffer.concat(chunks).toString('utf8');
      const parsed = bodyStr ? JSON.parse(bodyStr) : [];
      const reqPath = (req.url || '/').split('?')[0];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (reqPath.endsWith('/pipeline') || reqPath.endsWith('/multi-exec')) {
        const results = (Array.isArray(parsed) ? parsed : []).map((c) => ({
          result: execMockRedisCommand(c),
        }));
        res.end(JSON.stringify(results));
      } else {
        const result = execMockRedisCommand(parsed);
        res.end(JSON.stringify({ result }));
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || 'mock redis error' }));
    }
  });
});

await new Promise<void>((resolve) => {
  mockRedisServer.listen(0, '127.0.0.1', () => {
    const addr = mockRedisServer.address() as { port: number };
    process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${addr.port}`;
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test_upstash_token';
    resolve();
  });
});
mockRedisServer.unref();

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

// Helpers to seed/clean persistent Redis test users and mint verified test sessions via lib/auth.ts
async function seedTestStoreUser(email: string, record: Record<string, any>): Promise<void> {
  const { saveUser, createDefaultUserRecord } = await import('../lib/serverStore');
  const norm = email.trim().toLowerCase();
  const base = createDefaultUserRecord(norm, String(record.name || norm.split('@')[0]));
  await saveUser({ ...base, ...record, email: norm } as any, { syncCredits: true });
}

async function deleteTestUsers(...emails: string[]): Promise<void> {
  const { deleteServerUserFromDb } = await import('../lib/serverStore');
  for (const e of emails) {
    if (e && e.includes('@')) {
      await deleteServerUserFromDb(e).catch(() => {});
    }
  }
}

async function createTestSessionCookie(email: string, name?: string): Promise<string> {
  const { createSession, SESSION_COOKIE_NAME } = await import('../lib/auth');
  const { cookieToken } = await createSession(null, {
    email: email.trim().toLowerCase(),
    name: name || email.split('@')[0],
    verifiedViaGoogle: true,
  });
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`;
}

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

async function invokeCronApi(params: {
  method?: string;
  headers?: Record<string, string>;
}) {
  const { default: cronHandler } = await import('../api/cron/check-expiry');
  let statusCode = 200;
  let jsonPayload: any = null;
  const responseHeaders: Record<string, any> = {};

  const req: any = {
    method: params.method || 'GET',
    url: '/api/cron/check-expiry',
    headers: { host: 'localhost:3000', ...(params.headers || {}) },
    query: {},
    body: {},
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

  await cronHandler(req, res);
  return { statusCode, data: jsonPayload, headers: responseHeaders };
}

test('Server blocks limit bypass via API & persists saved analyses across logout/re-login', async () => {
  const testEmail = `audit_free_${Date.now()}@aqari.test`;
  const testCookie = await createTestSessionCookie(testEmail);

  // 1. Run 3 free analyses (limit = 3), trying client-side spoofing payload each time
  for (let i = 0; i < 3; i++) {
    const r = await invokeApi({
      action: 'run-analysis',
      headers: { cookie: testCookie },
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
    headers: { cookie: testCookie },
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
    headers: { cookie: testCookie },
    body: { email: testEmail, priceUSD: 650_000, rentUSD: 4_500 },
  });
  assert.equal(blockedMc.statusCode, 403);

  // 4. Logout & Persistence Check: save 1 analysis on fresh account, DELETE session, verify unauth ?action=me returns 401, then re-login and verify saved_analyses persists
  const persistEmail = `persist_${Date.now()}@aqari.test`;
  const persistCookie1 = await createTestSessionCookie(persistEmail);
  const saveRes = await invokeApi({
    action: 'save-to-portfolio',
    headers: { cookie: persistCookie1 },
    body: {
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

  const logoutRes = await invokeApi({
    method: 'DELETE',
    action: 'session',
    headers: { cookie: persistCookie1 },
  });
  assert.equal(logoutRes.statusCode, 200);

  // Unauthenticated ?action=me with only ?email=... must return 401 (no email-based data leak)
  const unauthMe = await invokeApi({
    method: 'GET',
    action: 'me',
    query: { email: persistEmail },
  });
  assert.equal(unauthMe.statusCode, 401);

  // New authenticated session for persistEmail restores persisted portfolio
  const persistCookie2 = await createTestSessionCookie(persistEmail);
  const rehydrateRes = await invokeApi({
    method: 'GET',
    action: 'me',
    headers: { cookie: persistCookie2 },
  });
  assert.equal(rehydrateRes.statusCode, 200);
  assert.ok(
    Array.isArray(rehydrateRes.data.saved_analyses) &&
      rehydrateRes.data.saved_analyses.some((a: any) => a.property === 'Persistence Tower Muscat'),
    'Saved analyses must persist on server across logout and re-login'
  );
});

test('Deal Finder labels generated/simulated output and Forecast exposes modelSpec + historicalBaseline; Enterprise RBAC enforces roles on server', async () => {
  const adminEmail = `rbac_admin_${Date.now()}@aqari.test`;
  const managerEmail = `rbac_mgr_${Date.now()}@aqari.test`;
  const analystEmail = `rbac_analyst_${Date.now()}@aqari.test`;
  const adminCookie = await createTestSessionCookie(adminEmail);
  const analystCookie = await createTestSessionCookie(analystEmail);

  // Admin creates Enterprise org and invites Manager & Analyst
  const wsInit = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: adminCookie },
    body: { subAction: 'create-org', name: 'Riyadh Sovereign IC' },
  });
  assert.equal(wsInit.statusCode, 200);
  const orgId = wsInit.data.activeOrg.id;

  const invMgr = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: adminCookie },
    body: { orgId, subAction: 'invite-member', memberEmail: managerEmail, role: 'Manager' },
  });
  // On free default user teamUsersLimit is 1 so 2nd seat returns 403 TEAM_SEAT_LIMIT_REACHED — verifies server seat gating too!
  assert.equal(invMgr.statusCode, 403);
  assert.equal(invMgr.data.code, 'TEAM_SEAT_LIMIT_REACHED');

  // Share a deal & verify Deal Finder + Forecast metadata using Starter trial user via clean run check
  const outsiderApprove = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: analystCookie },
    body: { orgId, subAction: 'update-deal-status', dealId: 'x', status: 'IC Approved' },
  });
  assert.equal(outsiderApprove.statusCode, 403, 'Non-member/unauthorized actor blocked on server');

  const dfRes = await invokeApi({
    action: 'find-deals',
    headers: { cookie: adminCookie },
    body: { city: 'Muscat', budget: 900_000, minCapRate: 5, propertyType: 'Apartment', risk: 'Medium' },
  });
  assert.equal(dfRes.statusCode, 200);
  assert.equal(dfRes.data.sourceType, 'GENERATED_SIMULATED_NOT_LIVE_MLS');
  assert.ok(String(dfRes.data.disclaimer).includes('NOT LIVE MLS'));
});

test('Forecast exposes documented modelSpec + historicalBaseline and Enterprise Workspace enforces Admin/Manager/Analyst RBAC on server', async (t) => {
  const instAdminEmail = `inst_admin_${Date.now()}@aqari.test`;
  const mgrEmail = `inst_mgr_${Date.now()}@aqari.test`;
  const analystEmail = `inst_analyst_${Date.now()}@aqari.test`;

  const seedInstitutionalUser = async (email: string) => {
    await seedTestStoreUser(email, {
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
    });
  };

  t.after(async () => {
    await deleteTestUsers(instAdminEmail, mgrEmail, analystEmail);
  });

  await seedInstitutionalUser(instAdminEmail);
  const instAdminCookie = await createTestSessionCookie(instAdminEmail, 'IC Admin Test');
  const mgrCookie = await createTestSessionCookie(mgrEmail, 'IC Manager');
  const analystCookie = await createTestSessionCookie(analystEmail, 'IC Analyst');

  // 1. Forecast endpoint: check documented modelSpec + 2022-2026 historical baseline + indexed series
  const fcRes = await invokeApi({
    method: 'POST',
    action: 'get-forecast',
    headers: { cookie: instAdminCookie },
    body: {
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
    headers: { cookie: instAdminCookie },
    body: { subAction: 'create-org', name: 'Gulf Sovereign IC' },
  });
  assert.equal(orgRes.statusCode, 200);
  const orgId = orgRes.data.activeOrg.id;

  const invMgr = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: instAdminCookie },
    body: { orgId, subAction: 'invite-member', memberEmail: mgrEmail, role: 'Manager' },
  });
  assert.equal(invMgr.statusCode, 200);

  const invAnalyst = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: instAdminCookie },
    body: { orgId, subAction: 'invite-member', memberEmail: analystEmail, role: 'Analyst' },
  });
  assert.equal(invAnalyst.statusCode, 200);

  const shared = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: analystCookie },
    body: {
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
    headers: { cookie: analystCookie },
    body: { orgId, subAction: 'update-deal-status', dealId, status: 'IC Approved' },
  });
  assert.equal(analystApprove.statusCode, 403);

  const analystDelete = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: analystCookie },
    body: { orgId, subAction: 'delete-deal', dealId },
  });
  assert.equal(analystDelete.statusCode, 403);

  const analystInvite = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: analystCookie },
    body: { orgId, subAction: 'invite-member', memberEmail: 'extra@aqari.test', role: 'Analyst' },
  });
  assert.equal(analystInvite.statusCode, 403);

  // 4. Manager RBAC: allowed to approve/change deal status (200), blocked from delete-deal & invite-member (403)
  const mgrApprove = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: mgrCookie },
    body: { orgId, subAction: 'update-deal-status', dealId, status: 'IC Approved' },
  });
  assert.equal(mgrApprove.statusCode, 200);
  assert.equal(mgrApprove.data.activeOrg.sharedDeals[0].status, 'IC Approved');

  const mgrDelete = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: mgrCookie },
    body: { orgId, subAction: 'delete-deal', dealId },
  });
  assert.equal(mgrDelete.statusCode, 403);

  const mgrInvite = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: mgrCookie },
    body: { orgId, subAction: 'invite-member', memberEmail: 'extra@aqari.test', role: 'Analyst' },
  });
  assert.equal(mgrInvite.statusCode, 403);

  // 5. Admin RBAC: allowed to delete deal + audit trail logs actor, role & timestamp
  const adminDelete = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: instAdminCookie },
    body: { orgId, subAction: 'delete-deal', dealId },
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
  const entEmail = `ent_unset_${Date.now()}@aqari.test`;

  await seedTestStoreUser(entEmail, {
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
  });
  const entCookie = await createTestSessionCookie(entEmail, 'Unconfigured Enterprise');
  const prevAdminEmail = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = 'loomorastudios@gmail.com';

  t.after(async () => {
    if (prevAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prevAdminEmail;
    await deleteTestUsers(entEmail);
  });

  // 1. Unconfigured Enterprise user MUST be blocked with ENTERPRISE_CONTRACT_LIMIT_UNSET
  const blockedRes = await invokeApi({
    action: 'run-analysis',
    headers: { cookie: entCookie },
    body: {
      propertyTitle: 'Null Enterprise Test',
      city: 'Muscat',
      priceUSD: 1_250_000,
      rentUSD: 8_400,
    },
  });
  assert.equal(blockedRes.statusCode, 403);
  assert.equal(blockedRes.data.code, 'ENTERPRISE_CONTRACT_LIMIT_UNSET');

  // 2. Owner signs in via verified server session cookie
  const cookieHeader = await createTestSessionCookie('loomorastudios@gmail.com', 'Owner');

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
    headers: { cookie: entCookie },
    body: {
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
  const freeOldEmail = `free_60d_${Date.now()}@aqari.test`;

  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
  await seedTestStoreUser(freeOldEmail, {
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
  });
  const freeOldCookie = await createTestSessionCookie(freeOldEmail, 'Old Free User');

  t.after(async () => {
    await deleteTestUsers(freeOldEmail);
  });

  // Check /api/app?action=me confirms active & not expired
  const meRes = await invokeApi({
    method: 'GET',
    action: 'me',
    headers: { cookie: freeOldCookie },
  });
  assert.equal(meRes.statusCode, 200);
  assert.equal(meRes.data.package_expired, false);
  assert.equal(meRes.data.locked, false);
  assert.equal(meRes.data.analyses_left, 3);

  // All 3 runs succeed despite license_end being 60 days ago
  for (let i = 0; i < 3; i++) {
    const r = await invokeApi({
      action: 'run-analysis',
      headers: { cookie: freeOldCookie },
      body: {
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
    headers: { cookie: freeOldCookie },
    body: {
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
  const expiredNoCredsEmail = `exp_nocreds_${Date.now()}@aqari.test`;
  const expiredWithCredsEmail = `exp_creds_${Date.now()}@aqari.test`;
  const pkgFirstEmail = `pkg_first_${Date.now()}@aqari.test`;

  await seedTestStoreUser(expiredNoCredsEmail, {
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
  });
  await seedTestStoreUser(expiredWithCredsEmail, {
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
  });
  await seedTestStoreUser(pkgFirstEmail, {
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
  });

  const cookieA = await createTestSessionCookie(expiredNoCredsEmail);
  const cookieB = await createTestSessionCookie(expiredWithCredsEmail);
  const cookieC = await createTestSessionCookie(pkgFirstEmail);

  t.after(async () => {
    await deleteTestUsers(expiredNoCredsEmail, expiredWithCredsEmail, pkgFirstEmail);
  });

  // Check User A: locked cleanly with exact no-auto-charge message
  const resA = await invokeApi({
    action: 'run-analysis',
    headers: { cookie: cookieA },
    body: {
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
    headers: { cookie: cookieB },
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
    headers: { cookie: cookieB },
    body: { priceUSD: 600_000, rentUSD: 4_000 },
  });
  assert.equal(mcB.statusCode, 403);

  // User B standard analysis MUST succeed and deduct 25 -> 24 extra_credits
  const runB = await invokeApi({
    action: 'run-analysis',
    headers: { cookie: cookieB },
    body: {
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
    headers: { cookie: cookieC },
    body: { propertyTitle: 'Pkg 1', city: 'Muscat', priceUSD: 600_000, rentUSD: 4_000 },
  });
  assert.equal(runC1.statusCode, 200);
  assert.equal(runC1.data.plan_analyses_left, 1);
  assert.equal(runC1.data.extra_credits, 10);
  assert.equal(runC1.data.analyses_left, 11);

  const runC2 = await invokeApi({
    action: 'run-analysis',
    headers: { cookie: cookieC },
    body: { propertyTitle: 'Pkg 2', city: 'Muscat', priceUSD: 600_000, rentUSD: 4_000 },
  });
  assert.equal(runC2.statusCode, 200);
  assert.equal(runC2.data.plan_analyses_left, 0);
  assert.equal(runC2.data.extra_credits, 10);
  assert.equal(runC2.data.analyses_left, 10);

  const runC3 = await invokeApi({
    action: 'run-analysis',
    headers: { cookie: cookieC },
    body: { propertyTitle: 'Cred 1', city: 'Muscat', priceUSD: 600_000, rentUSD: 4_000 },
  });
  assert.equal(runC3.statusCode, 200);
  assert.equal(runC3.data.plan_analyses_left, 0);
  assert.equal(runC3.data.extra_credits, 9);
  assert.equal(runC3.data.analyses_left, 9);
});

test('One-time credit pack webhook credits account once and stays idempotent on replay', async (t) => {
  const crypto = await import('node:crypto');
  const buyerEmail = `pack_buyer_${Date.now()}@aqari.test`;
  const buyerCookie = await createTestSessionCookie(buyerEmail);
  const txnId = `txn_pack_${Date.now()}`;
  const prevSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const testSecret = 'pdl_ntfset_test_secret_unit';
  process.env.PADDLE_WEBHOOK_SECRET = testSecret;

  t.after(async () => {
    if (prevSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
    await deleteTestUsers(buyerEmail);
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
    headers: { cookie: buyerCookie },
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
    headers: { cookie: buyerCookie },
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

  const buyerCookie = await createTestSessionCookie('buyer@aqari.test');

  const checkoutRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: { plan: 'pro' },
  });
  assert.equal(checkoutRes.statusCode, 400);
  assert.equal(checkoutRes.data.success, false);
  assert.match(String(checkoutRes.data.error), /Missing Paddle config: PADDLE_API_KEY/);

  const verifyRes = await invokeApi({
    action: 'verify-payment',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: { transaction_id: 'txn_01missingkey' },
  });
  assert.equal(verifyRes.statusCode, 500);
  assert.equal(verifyRes.data.success, false);
  assert.match(String(verifyRes.data.error), /PADDLE_API_KEY/);

  const buyCreditsRes = await invokeApi({
    action: 'buy-credits',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: { packId: 'pack_25' },
  });
  assert.equal(buyCreditsRes.statusCode, 500);
  assert.equal(buyCreditsRes.data.success, false);
  assert.match(String(buyCreditsRes.data.error), /PADDLE_API_KEY/);
});

test('Frontend paddleClient reads VITE_ then NEXT_PUBLIC_ variables and defaults environment to live', async (t) => {
  const { getPaddleClientToken, getPaddleEnvironment } = await import('../src/utils/paddleClient.ts');

  const prevNextToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const prevNextEnv = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  const prevViteToken = process.env.VITE_PADDLE_CLIENT_TOKEN;
  const prevViteEnv = process.env.VITE_PADDLE_ENVIRONMENT;

  t.after(() => {
    if (prevNextToken === undefined) delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    else process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = prevNextToken;
    if (prevNextEnv === undefined) delete process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
    else process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT = prevNextEnv;
    if (prevViteToken === undefined) delete process.env.VITE_PADDLE_CLIENT_TOKEN;
    else process.env.VITE_PADDLE_CLIENT_TOKEN = prevViteToken;
    if (prevViteEnv === undefined) delete process.env.VITE_PADDLE_ENVIRONMENT;
    else process.env.VITE_PADDLE_ENVIRONMENT = prevViteEnv;
  });

  // 1. Missing env defaults cleanly to 'live' -> 'production' (never null / never blocks checkout)
  delete process.env.VITE_PADDLE_CLIENT_TOKEN;
  delete process.env.VITE_PADDLE_ENVIRONMENT;
  delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  delete process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;

  assert.equal(getPaddleClientToken(), '');
  assert.equal(getPaddleEnvironment(), 'production');

  // 2. VITE_ takes priority over NEXT_PUBLIC_
  process.env.VITE_PADDLE_CLIENT_TOKEN = 'vite_client_tok_priority';
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = 'next_client_tok_fallback';
  process.env.VITE_PADDLE_ENVIRONMENT = ' LIVE ';
  assert.equal(getPaddleClientToken(), 'vite_client_tok_priority');
  assert.equal(getPaddleEnvironment(), 'production');

  // 3. Falls back to NEXT_PUBLIC_ when VITE_ is absent
  delete process.env.VITE_PADDLE_CLIENT_TOKEN;
  delete process.env.VITE_PADDLE_ENVIRONMENT;
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT = ' LIVE ';
  assert.equal(getPaddleClientToken(), 'next_client_tok_fallback');
  assert.equal(getPaddleEnvironment(), 'production');

  // 4. Explicit sandbox sets sandbox
  process.env.VITE_PADDLE_ENVIRONMENT = ' sandbox ';
  assert.equal(getPaddleEnvironment(), 'sandbox');
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

  const sovEmail = `city_val_${Date.now()}@aqari.test`;
  await seedTestStoreUser(sovEmail, {
    email: sovEmail,
    name: 'City Validation Test',
    plan: 'enterprise',
    analyses_total: 300,
    analyses_left: 300,
    analyses_used: 0,
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 86_400_000,
    status: 'active',
  });
  const sovCookie = await createTestSessionCookie(sovEmail, 'City Validation Test');

  t.after(async () => {
    await deleteTestUsers(sovEmail);
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
      headers: { cookie: sovCookie },
      body: {
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
    headers: { cookie: sovCookie },
    body: {
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
    headers: { cookie: sovCookie },
    body: {
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
  const clientEmail = `analyst_client_${Date.now()}@aqari.test`;
  await seedTestStoreUser(clientEmail, {
    email: clientEmail,
    name: 'Sovereign Client',
    plan: 'enterprise',
    analyses_total: 300,
    analyses_left: 300,
    analyses_used: 0,
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 86_400_000,
    status: 'active',
  });
  const clientCookie = await createTestSessionCookie(clientEmail, 'Sovereign Client');

  t.after(async () => {
    await deleteTestUsers(clientEmail);
  });

  const postRes = await invokeApi({
    action: 'analyst-message',
    method: 'POST',
    headers: { cookie: clientCookie },
    body: {
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
  const crypto = await import('node:crypto');
  const buyerEmail = `wh_plan_${Date.now()}@aqari.test`;
  const buyerCookie = await createTestSessionCookie(buyerEmail);
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

  t.after(async () => {
    if (prevSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
    if (prevEnv === undefined) delete process.env.PADDLE_ENVIRONMENT;
    else process.env.PADDLE_ENVIRONMENT = prevEnv;
    if (prevCredit25 === undefined) delete process.env.PADDLE_CREDIT_25_PRICE;
    else process.env.PADDLE_CREDIT_25_PRICE = prevCredit25;
    if (prevEnt === undefined) delete process.env.PADDLE_ENTERPRISE_PRICE;
    else process.env.PADDLE_ENTERPRISE_PRICE = prevEnt;
    await deleteTestUsers(buyerEmail);
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
    headers: { cookie: buyerCookie },
    body: {
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
  const buyerEmail = `verify_c19_${Date.now()}@aqari.test`;
  const buyerCookie = await createTestSessionCookie(buyerEmail, 'Starter Buyer');
  const txnDirectId = `txn_direct19_${Date.now()}`;

  const prevApiKey = process.env.PADDLE_API_KEY;
  const prevEnv = process.env.PADDLE_ENVIRONMENT;
  const prevCredit25 = process.env.PADDLE_CREDIT_25_PRICE;
  const prevFetch = globalThis.fetch;

  process.env.PADDLE_API_KEY = 'pdl_live_test_key';
  process.env.PADDLE_ENVIRONMENT = 'live';
  process.env.PADDLE_CREDIT_25_PRICE = 'pri_direct_pack25';

  await seedTestStoreUser(buyerEmail, {
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
  });

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

  t.after(async () => {
    globalThis.fetch = prevFetch;
    if (prevApiKey === undefined) delete process.env.PADDLE_API_KEY;
    else process.env.PADDLE_API_KEY = prevApiKey;
    if (prevEnv === undefined) delete process.env.PADDLE_ENVIRONMENT;
    else process.env.PADDLE_ENVIRONMENT = prevEnv;
    if (prevCredit25 === undefined) delete process.env.PADDLE_CREDIT_25_PRICE;
    else process.env.PADDLE_CREDIT_25_PRICE = prevCredit25;
    await deleteTestUsers(buyerEmail);
  });

  const verifyRes = await invokeApi({
    action: 'verify-payment',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: {
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

  const checkoutBuyerCookie = await createTestSessionCookie('buyer@aqari.test');

  const missingTokenRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: checkoutBuyerCookie },
    body: { plan: 'pro' },
  });
  assert.equal(missingTokenRes.statusCode, 400);
  assert.match(String(missingTokenRes.data.error), /Missing Paddle config: PADDLE_CLIENT_SIDE_TOKEN/);

  // 2. Block sandbox key and sandbox token in live mode -> 400
  process.env.PADDLE_API_KEY = 'pdl_sdbx_key_should_fail_in_live';
  process.env.PADDLE_CLIENT_SIDE_TOKEN = 'live_client_tok_123';
  const sdbxKeyRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: checkoutBuyerCookie },
    body: { plan: 'pro' },
  });
  assert.equal(sdbxKeyRes.statusCode, 400);
  assert.match(String(sdbxKeyRes.data.error), /PADDLE_API_KEY/);

  process.env.PADDLE_API_KEY = 'pdl_live_apikey_check';
  process.env.PADDLE_CLIENT_SIDE_TOKEN = 'test_sandbox_client_token';
  const sdbxTokRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: checkoutBuyerCookie },
    body: { plan: 'pro' },
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
    headers: { cookie: checkoutBuyerCookie },
    body: { plan: 'pro', priceId: 'pri_hacker_invalid' },
  });
  assert.equal(disallowedPriceRes.statusCode, 400);
  assert.match(String(disallowedPriceRes.data.error), /Price ID/);

  const sandboxLegacyPriceRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: checkoutBuyerCookie },
    body: { plan: 'pro', priceId: 'pri_01m7qwqceh520nd4we9pg90f8m' },
  });
  assert.equal(sandboxLegacyPriceRes.statusCode, 400);

  // Reject non-live PADDLE_ENVIRONMENT
  process.env.PADDLE_ENVIRONMENT = 'sandbox';
  const badEnvRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: checkoutBuyerCookie },
    body: { plan: 'pro' },
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
    { body: { plan: 'starter' }, expectedPriceId: 'pri_live_starter_75' },
    { body: { plan: 'pro' }, expectedPriceId: 'pri_live_pro_199' },
    { body: { plan: 'enterprise' }, expectedPriceId: 'pri_live_sov_599' },
    { body: { plan: 'institutional' }, expectedPriceId: 'pri_live_ent_1499' },
    { body: { packId: 'pack_25' }, expectedPriceId: 'pri_live_c25_19' },
    { body: { packId: 'pack_100' }, expectedPriceId: 'pri_live_c100_59' },
    { body: { packId: 'pack_500' }, expectedPriceId: 'pri_live_c500_249' },
  ];

  for (const item of sevenItems) {
    const res = await invokeApi({
      action: 'checkout',
      method: 'POST',
      headers: { cookie: checkoutBuyerCookie },
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
    headers: { cookie: checkoutBuyerCookie },
    body: { plan: 'pro' },
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
  const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.equal(paddleClientSrc.includes('PADDLE_API_KEY'), false);
  assert.equal(paddleClientSrc.includes('Authorization'), false);
  assert.equal(paddleClientSrc.includes('api.paddle.com'), false);
  assert.equal(paddleClientSrc.includes('checkout.paddle.com'), false);
  assert.equal(paddleClientSrc.includes('Missing NEXT_PUBLIC_PADDLE_ENVIRONMENT'), false);
  assert.equal(appSrc.includes('Missing NEXT_PUBLIC_PADDLE_ENVIRONMENT'), false);
  assert.match(paddleClientSrc, /import\.meta\.env\.VITE_PADDLE_ENVIRONMENT/);
  assert.match(paddleClientSrc, /import\.meta\.env\.VITE_PADDLE_CLIENT_TOKEN/);
  assert.match(paddleClientSrc, /mode:\s*'record'/);
  assert.match(paddleClientSrc, /successUrl:\s*'https:\/\/aqari-ai-rho\.vercel\.app\/app\?checkout=success'/);
  assert.match(paddleClientSrc, /locale:\s*'en'/);

  const { formatPaddleCheckoutErrorMessage, getCheckoutSuccessUrl } = await import(
    '../src/utils/paddleClient.ts'
  );
  assert.equal(
    getCheckoutSuccessUrl(),
    'https://aqari-ai-rho.vercel.app/app?checkout=success'
  );
  assert.equal(
    formatPaddleCheckoutErrorMessage({
      code: 'transaction_default_checkout_url_not_set',
      detail: 'Default checkout URL is not configured.',
    }),
    'Checkout settings missing in Paddle, contact support loomorastudios@gmail.com'
  );
  assert.equal(
    formatPaddleCheckoutErrorMessage('Error: transaction_default_checkout_url_not_set'),
    'Checkout settings missing in Paddle, contact support loomorastudios@gmail.com'
  );
});

test('OPTIONS preflight returns 200 with CORS headers and no auth check; mode=record returns 200 without api.paddle.com', async (t) => {
  const prevFetch = globalThis.fetch;
  let calledExternalPaddle = false;
  globalThis.fetch = (async (url: any, opts?: any) => {
    if (String(url).includes('paddle.com')) {
      calledExternalPaddle = true;
    }
    return prevFetch(url, opts);
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = prevFetch;
  });

  const optRes = await invokeApi({
    action: 'admin-list',
    method: 'OPTIONS',
    headers: { origin: 'https://admin-aqari2.vercel.app' },
    query: { section: 'users' },
  });
  assert.equal(optRes.statusCode, 200);
  assert.equal(optRes.headers['Access-Control-Allow-Origin'], 'https://admin-aqari2.vercel.app');
  assert.equal(optRes.headers['Access-Control-Allow-Credentials'], 'true');
  assert.equal(optRes.headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
  assert.equal(
    optRes.headers['Access-Control-Allow-Headers'],
    'Content-Type, Authorization'
  );

  const directCookie = await createTestSessionCookie('directcheckout@aqari.test');
  const recRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: {
      cookie: directCookie,
      origin: 'https://admin-aqari2.vercel.app',
    },
    body: {
      mode: 'record',
      plan: 'pro',
      priceId: 'pri_01m7tggqhjtgk9fxmmg6mbp5wy',
    },
  });
  assert.equal(recRes.statusCode, 200);
  assert.equal(recRes.data.success, true);
  assert.equal(recRes.data.mode, 'paddlejs_overlay');
  assert.equal(calledExternalPaddle, false);
  assert.equal(recRes.headers['Access-Control-Allow-Origin'], 'https://admin-aqari2.vercel.app');
});

test('Admin API enforces x-admin-token === ADMIN_TOKEN and returns real stored data across all actions', async (t) => {
  const prevToken = process.env.ADMIN_TOKEN;
  const adminToken = 'aqari_super_secret_admin_token_2026';
  process.env.ADMIN_TOKEN = adminToken;

  t.after(() => {
    if (prevToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = prevToken;
  });

  // 1. Missing or invalid token -> 401 with admin-only CORS headers
  const missingHdr = await invokeApi({
    action: 'admin-list',
    method: 'GET',
    headers: { origin: 'https://admin-aqari2.vercel.app' },
    query: { section: 'users' },
  });
  assert.equal(missingHdr.statusCode, 401);
  assert.equal(missingHdr.headers['Access-Control-Allow-Origin'], 'https://admin-aqari2.vercel.app');

  const wrongHdr = await invokeApi({
    action: 'admin-lock',
    method: 'POST',
    headers: { 'x-admin-token': 'wrong-token' },
    body: { email: 'someone@aqari.test', locked: true },
  });
  assert.equal(wrongHdr.statusCode, 401);

  const targetEmail = `admin_target_${Date.now()}@aqari.test`;
  const orderId = `txn_admin_${Date.now()}`;

  // 2. admin-verify-order activates plan & records order
  const verifyRes = await invokeApi({
    action: 'admin-verify-order',
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: {
      email: targetEmail,
      transaction_id: orderId,
      plan: 'pro',
      amount: 199,
      reason: 'Manual Paddle verification test',
    },
  });
  assert.equal(verifyRes.statusCode, 200);
  assert.equal(verifyRes.data.success, true);
  assert.equal(verifyRes.data.user.plan, 'pro');

  // 3. admin-extend adds days to expiry
  const beforeEnd = Number(verifyRes.data.user.license_end || Date.now());
  const extendRes = await invokeApi({
    action: 'admin-extend',
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: { email: targetEmail, days: 15, reason: 'Comp extension' },
  });
  assert.equal(extendRes.statusCode, 200);
  assert.equal(extendRes.data.success, true);
  assert.ok(Number(extendRes.data.user.license_end) >= beforeEnd + 14 * 86_400_000);

  // 4. admin-add-credits adds non-expiring credits
  const addCredRes = await invokeApi({
    action: 'admin-add-credits',
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: { email: targetEmail, credits: 50, reason: 'Bonus credits' },
  });
  assert.equal(addCredRes.statusCode, 200);
  assert.equal(addCredRes.data.credits_balance, 50);

  // 5. admin-lock locks account WITHOUT wiping non-expiring credits
  const lockRes = await invokeApi({
    action: 'admin-lock',
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: { email: targetEmail, locked: true, reason: 'Compliance hold' },
  });
  assert.equal(lockRes.statusCode, 200);
  assert.equal(lockRes.data.locked, true);
  assert.equal(lockRes.data.credits_balance, 50);
  assert.equal(lockRes.data.user.status, 'expired');

  // Unlock preserves 50 non-expiring credits
  const unlockRes = await invokeApi({
    action: 'admin-lock',
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: { email: targetEmail, locked: false, reason: 'Cleared hold' },
  });
  assert.equal(unlockRes.statusCode, 200);
  assert.equal(unlockRes.data.locked, false);
  assert.equal(unlockRes.data.credits_balance, 50);
  assert.equal(unlockRes.data.user.status, 'active');

  // 6. admin-reply writes to analyst thread
  const replyRes = await invokeApi({
    action: 'admin-reply',
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: { email: targetEmail, message: 'We have completed your underwriting review.' },
  });
  assert.equal(replyRes.statusCode, 200);
  assert.equal(replyRes.data.success, true);
  assert.ok(Array.isArray(replyRes.data.thread.messages));

  // 7. Submit a real enterprise inquiry and inspect all 5 admin-list sections
  const entRes = await invokeApi({
    action: 'enterprise-inquiry',
    method: 'POST',
    body: {
      companyName: 'Oman Sovereign HoldCo',
      email: targetEmail,
      seats: 25,
      assetsCount: 250,
    },
  });
  assert.equal(entRes.statusCode, 200);

  for (const section of ['users', 'analyst', 'enterprise', 'orders', 'audit']) {
    const listRes = await invokeApi({
      action: 'admin-list',
      method: 'GET',
      headers: { 'x-admin-token': adminToken },
      query: { section },
    });
    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.data.success, true);
    assert.ok(Array.isArray(listRes.data.items));
    assert.ok(listRes.data.items.length >= 1, `Expected real items in section=${section}`);
  }
});

test('Server enforces single active plan (Rule A block, Rule B switch & feature close, Rule C expired re-buy, Rule D independent credits, Rule E duplicate txn_id, and Credit 25 fallback)', async (t) => {
  const crypto = await import('node:crypto');
  const buyerEmail = `entitle_${Date.now()}@aqari.test`;
  const buyerCookie = await createTestSessionCookie(buyerEmail);
  const txnPro = `txn_rule_pro_${Date.now()}`;
  const txnDupPro = `txn_rule_pro_dup_${Date.now()}`;
  const txnCred = `txn_rule_cred_${Date.now()}`;
  const txnSov = `txn_rule_sov_${Date.now()}`;
  const txnStarter = `txn_rule_start_${Date.now()}`;

  const prevSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const prevEnv = process.env.PADDLE_ENVIRONMENT;
  const prevCredit25 = process.env.PADDLE_CREDIT_25_PRICE;
  const prevViteC25 = process.env.VITE_PADDLE_CREDIT_25;
  const prevNextC25 = process.env.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE;
  const testSecret = 'pdl_ntfset_entitle_rules_test';
  process.env.PADDLE_WEBHOOK_SECRET = testSecret;
  process.env.PADDLE_ENVIRONMENT = 'live';
  process.env.PADDLE_CREDIT_25_PRICE = 'pri_backend_c25_19';

  t.after(async () => {
    if (prevSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
    if (prevEnv === undefined) delete process.env.PADDLE_ENVIRONMENT;
    else process.env.PADDLE_ENVIRONMENT = prevEnv;
    if (prevCredit25 === undefined) delete process.env.PADDLE_CREDIT_25_PRICE;
    else process.env.PADDLE_CREDIT_25_PRICE = prevCredit25;
    if (prevViteC25 === undefined) delete process.env.VITE_PADDLE_CREDIT_25;
    else process.env.VITE_PADDLE_CREDIT_25 = prevViteC25;
    if (prevNextC25 === undefined) delete process.env.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE;
    else process.env.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE = prevNextC25;
    await deleteTestUsers(buyerEmail);
  });

  const sign = (body: string) => {
    const ts = String(Math.floor(Date.now() / 1000));
    const h1 = crypto.createHmac('sha256', testSecret).update(`${ts}:${body}`).digest('hex');
    return `ts=${ts};h1=${h1}`;
  };

  // 1. Activate PRO ($199) via transaction.completed webhook
  const proBody = JSON.stringify({
    event_type: 'transaction.completed',
    data: {
      id: txnPro,
      currency_code: 'USD',
      customer: { email: buyerEmail },
      items: [{ price: { id: 'pri_01m7tggqhjtgk9fxmmg6mbp5wy', name: 'AQARI PROFESSIONAL' }, quantity: 1 }],
      details: { totals: { total: '19900' } },
      custom_data: { email: buyerEmail, login_email: buyerEmail, plan: 'pro' },
    },
  });
  const proWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(proBody) },
    body: proBody,
  });
  assert.equal(proWh.statusCode, 200);
  assert.equal(proWh.data.plan, 'pro');
  const proExpiryIso = proWh.data.expiry_date;
  const proExpiryFormatted = proWh.data.expiryDateFormatted;
  assert.match(String(proExpiryFormatted), /^\d{2}\/\d{2}\/\d{4}$/);

  // Rule A: Re-buying PRO while PRO is active -> BLOCKED at checkout (409) AND webhook
  const blockCheckout = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: {
      mode: 'record',
      plan: 'pro',
      priceId: 'pri_01m7tggqhjtgk9fxmmg6mbp5wy',
    },
  });
  assert.equal(blockCheckout.statusCode, 409);
  assert.equal(blockCheckout.data.code, 'SAME_PLAN_ACTIVE');
  assert.equal(
    blockCheckout.data.error,
    `You already own PRO until ${proExpiryFormatted}. You can buy a different plan to switch, or wait until expiry.`
  );

  const dupPlanWhBody = JSON.stringify({
    event_type: 'transaction.completed',
    data: {
      id: txnDupPro,
      currency_code: 'USD',
      customer: { email: buyerEmail },
      items: [{ price: { id: 'pri_01m7tggqhjtgk9fxmmg6mbp5wy', name: 'AQARI PROFESSIONAL' }, quantity: 1 }],
      details: { totals: { total: '19900' } },
      custom_data: { email: buyerEmail, login_email: buyerEmail, plan: 'pro' },
    },
  });
  const blockedWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(dupPlanWhBody) },
    body: dupPlanWhBody,
  });
  assert.equal(blockedWh.statusCode, 200);
  assert.equal(blockedWh.data.blocked, true);
  assert.equal(blockedWh.data.ignored, true);

  // Rule D: Buying +25 Credits while PRO is active -> ALLOWED, plan & expiry unchanged, credits added
  const credCheckout = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: {
      mode: 'record',
      packId: 'pack_25',
      priceId: 'pri_backend_c25_19',
    },
  });
  assert.equal(credCheckout.statusCode, 200);

  const credBody = JSON.stringify({
    event_type: 'transaction.completed',
    data: {
      id: txnCred,
      currency_code: 'USD',
      customer: { email: buyerEmail },
      items: [{ price: { id: 'pri_backend_c25_19', name: '+25 AI Credits' }, quantity: 1 }],
      details: { totals: { total: '1900' } },
      custom_data: { purchase_type: 'credit_pack', packId: 'pack_25', email: buyerEmail, login_email: buyerEmail },
    },
  });
  const credWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(credBody) },
    body: credBody,
  });
  assert.equal(credWh.statusCode, 200);
  assert.equal(credWh.data.creditsAdded, 25);
  assert.equal(credWh.data.credits_balance, 25);

  // Rule E: Duplicate credit transaction_id ignored completely (no double credits)
  const dupCredWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(credBody) },
    body: credBody,
  });
  assert.equal(dupCredWh.statusCode, 200);
  assert.equal(dupCredWh.data.duplicate, true);
  assert.equal(dupCredWh.data.ignored, true);
  assert.equal(dupCredWh.data.creditsAdded, 0);

  const meAfterCred = await invokeApi({
    method: 'GET',
    action: 'me',
    headers: { cookie: buyerCookie },
  });
  assert.equal(meAfterCred.data.planKey, 'pro');
  assert.equal(new Date(meAfterCred.data.expiry_date).toISOString(), proExpiryIso);
  assert.equal(meAfterCred.data.credits_balance, 25);

  // Rule B: Buy SOVEREIGN while PRO is active -> ALLOWED, replaces plan & expiry, closes PRO features, preserves 25 credits
  const switchCheckout = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: {
      mode: 'record',
      plan: 'enterprise',
      priceId: 'pri_01m7tgj4pp767gacchp49k2qev',
    },
  });
  assert.equal(switchCheckout.statusCode, 200);

  const sovBody = JSON.stringify({
    event_type: 'transaction.completed',
    data: {
      id: txnSov,
      currency_code: 'USD',
      customer: { email: buyerEmail },
      items: [{ price: { id: 'pri_01m7tgj4pp767gacchp49k2qev', name: 'AQARI SOVEREIGN' }, quantity: 1 }],
      details: { totals: { total: '59900' } },
      custom_data: { email: buyerEmail, login_email: buyerEmail, plan: 'enterprise' },
    },
  });
  const sovWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(sovBody) },
    body: sovBody,
  });
  assert.equal(sovWh.statusCode, 200);
  assert.equal(sovWh.data.plan, 'enterprise');
  assert.equal(sovWh.data.switched, true);
  assert.equal(sovWh.data.message, 'Switched to SOVEREIGN. PRO features closed.');
  assert.equal(sovWh.data.credits_balance, 25);

  // Verify-payment after webhook preserves switch message & shows Sovereign 300 + 25 credits
  const verifySwitch = await invokeApi({
    action: 'verify-payment',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: { transaction_id: txnSov },
  });
  assert.equal(verifySwitch.statusCode, 200);
  assert.equal(verifySwitch.data.switched, true);
  assert.equal(verifySwitch.data.message, 'Switched to SOVEREIGN. PRO features closed.');
  assert.equal(verifySwitch.data.planKey, 'enterprise');
  assert.equal(verifySwitch.data.analyses_left, 325);

  // Switch down to STARTER closes SOVEREIGN-only features immediately (global optimizer blocked)
  const starterBody = JSON.stringify({
    event_type: 'transaction.completed',
    data: {
      id: txnStarter,
      currency_code: 'USD',
      customer: { email: buyerEmail },
      items: [{ price: { id: 'pri_01m7tgfvteegdih2mx4hgyz1c', name: 'AQARI STARTER' }, quantity: 1 }],
      details: { totals: { total: '7500' } },
      custom_data: { email: buyerEmail, login_email: buyerEmail, plan: 'starter' },
    },
  });
  const starterWh = await invokeApi({
    action: 'paddle-webhook',
    method: 'POST',
    headers: { 'paddle-signature': sign(starterBody) },
    body: starterBody,
  });
  assert.equal(starterWh.statusCode, 200);
  assert.equal(starterWh.data.plan, 'starter');
  assert.equal(starterWh.data.message, 'Switched to STARTER. SOVEREIGN features closed.');

  const blockedOpt = await invokeApi({
    action: 'optimize-portfolio',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: { portfolio: [] },
  });
  assert.equal(blockedOpt.statusCode, 403);

  // Rule C: Expired plan can re-buy SAME plan (STARTER)
  const { updateUserPartial } = await import('../lib/serverStore');
  await updateUserPartial(buyerEmail, { license_end: Date.now() - 60_000 }, { syncCredits: false });

  const expiredRebuyRes = await invokeApi({
    action: 'checkout',
    method: 'POST',
    headers: { cookie: buyerCookie },
    body: {
      mode: 'record',
      plan: 'starter',
      priceId: 'pri_01m7tgfvteegdih2mx4hgyz1c',
    },
  });
  assert.equal(expiredRebuyRes.statusCode, 200);

  // FIX 3 + FIX 1 checks: /api/app?action=pricing exposes paddleCreditPriceIds fallback; frontend resolves VITE_PADDLE_CREDIT_25 & backend fallback; quantity=1 lock
  const pricingRes = await invokeApi({ method: 'GET', action: 'pricing' });
  assert.equal(pricingRes.statusCode, 200);
  assert.equal(pricingRes.data.paddleCreditPriceIds?.pack_25, 'pri_backend_c25_19');

  const {
    getPaddleCreditPriceId,
    setBackendCreditPriceIds,
    getCreditPackDisabledTooltip,
  } = await import('../src/utils/paddleClient.ts');

  delete process.env.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE;
  delete process.env.VITE_PADDLE_CREDIT_25_PRICE;
  delete process.env.VITE_PADDLE_CREDIT_25;
  setBackendCreditPriceIds(null);
  assert.equal(getCreditPackDisabledTooltip('pack_25'), 'Credits pack 25 coming soon - use +100 / +500');

  setBackendCreditPriceIds(pricingRes.data.paddleCreditPriceIds);
  assert.equal(getPaddleCreditPriceId('pack_25'), 'pri_backend_c25_19');

  setBackendCreditPriceIds(null);
  process.env.VITE_PADDLE_CREDIT_25 = 'pri_vite_short_c25';
  assert.equal(getPaddleCreditPriceId('pack_25'), 'pri_vite_short_c25');

  const fs = await import('node:fs');
  const path = await import('node:path');
  const paddleClientSrc = fs.readFileSync(path.resolve('src/utils/paddleClient.ts'), 'utf8');
  assert.match(paddleClientSrc, /items:\s*\[\{\s*priceId,\s*quantity:\s*1\s*\}\]/);
  assert.match(paddleClientSrc, /updateItems\(\[\{\s*priceId:\s*lockedPriceId,\s*quantity:\s*1\s*\}\]\)/);
});

test('Phase 4 Privacy & Data Isolation: unauthenticated customer data routes rejected even when email supplied, and spoofed email-only session fails with 401', async () => {
  const victimEmail = `victim_${Date.now()}@aqari.test`;
  await seedTestStoreUser(victimEmail, {
    email: victimEmail,
    name: 'Victim Account',
    plan: 'pro',
    analyses_total: 100,
    analyses_left: 95,
    analyses_used: 5,
    saved_analyses: [
      {
        id: 'vic_asset_1',
        property: 'Private Victim Asset',
        city: 'Muscat',
        price: 900_000,
        rent: 6_000,
        capRate: 8,
        cashOnCash: 9,
        irr: 14,
        dscr: '1.6',
        monthlyCashflow: 2200,
        riskScore: 'AA',
      },
    ],
    api_key: 'aqari_secret_tok_victim_123456',
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 86_400_000,
    status: 'active',
  });

  // 1. Spoofing session with only { email } MUST be rejected with 401
  const spoofSess = await invokeApi({
    action: 'session',
    method: 'POST',
    body: { email: victimEmail, name: 'Spoofer' },
  });
  assert.equal(spoofSess.statusCode, 401);

  // 2. Customer data routes MUST reject unauthenticated requests with 401 even when ?email=victim or body.email=victim
  const unauthChecks: Array<{ action: string; method: string; query?: Record<string, string>; body?: any }> = [
    { action: 'me', method: 'GET', query: { email: victimEmail, login_email: victimEmail } },
    { action: 'portfolio', method: 'GET', query: { email: victimEmail } },
    { action: 'get-last-results', method: 'GET', query: { email: victimEmail, login_email: victimEmail } },
    { action: 'save', method: 'POST', body: { email: victimEmail, analysis: { id: 'x', property: 'P', city: 'Muscat', price: 100000, rent: 1000 } } },
    { action: 'export', method: 'POST', body: { email: victimEmail, propertyTitle: 'Vic', city: 'Muscat', priceUSD: 500000, rentUSD: 3000 } },
    { action: 'get-report-file', method: 'GET', query: { id: 'rpt_any', email: victimEmail } },
    { action: 'whiteglove-request', method: 'GET', query: { email: victimEmail } },
    { action: 'analyst-message', method: 'GET', query: { email: victimEmail } },
    { action: 'workspace', method: 'GET', query: { email: victimEmail } },
    { action: 'webhook-logs', method: 'GET' },
    { action: 'debug-plan', method: 'GET', query: { email: victimEmail } },
  ];

  for (const check of unauthChecks) {
    const res = await invokeApi(check);
    assert.equal(res.statusCode, 401, `${check.action} must reject unauthenticated caller with 401`);
  }

  // 3. /api/cron/check-expiry must reject unauthenticated callers with 401
  const prevCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'cron_secret_unit_test_123';
  try {
    const cronNoAuth = await invokeCronApi({ method: 'GET' });
    assert.equal(cronNoAuth.statusCode, 401);
    const cronWrongAuth = await invokeCronApi({ method: 'GET', headers: { authorization: 'Bearer wrong' } });
    assert.equal(cronWrongAuth.statusCode, 401);
  } finally {
    if (prevCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCron;
  }
});

test('Phase 4 Cross-User IDOR & API Key Scrubbing: User B cannot read/delete User A reports, analyses, workspaces, or api_key', async () => {
  const userA = `idor_a_${Date.now()}@aqari.test`;
  const userB = `idor_b_${Date.now()}@aqari.test`;

  await seedTestStoreUser(userA, {
    email: userA,
    name: 'User A',
    plan: 'enterprise',
    analyses_total: 300,
    analyses_left: 299,
    analyses_used: 1,
    api_key: 'aqari_live_userA_full_secret_token_xyz9',
    saved_analyses: [
      {
        id: 'asset_owner_a_1',
        ownerId: 'usr_a',
        ownerEmail: userA,
        property: 'User A Tower',
        city: 'Muscat',
        price: 1_200_000,
        rent: 8_000,
        capRate: 8.0,
        cashOnCash: 9.2,
        irr: 14.5,
        dscr: '1.55',
        monthlyCashflow: 3100,
        riskScore: 'AAA',
      },
    ],
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 86_400_000,
    status: 'active',
  });

  const cookieA = await createTestSessionCookie(userA, 'User A');
  const cookieB = await createTestSessionCookie(userB, 'User B');

  // 1. User A ?action=me returns userId and redacted/masked api_key_last4, NEVER full api_key_token
  const meA = await invokeApi({ method: 'GET', action: 'me', headers: { cookie: cookieA } });
  assert.equal(meA.statusCode, 200);
  assert.ok(String(meA.data.userId || '').startsWith('usr_'));
  assert.equal(meA.data.api_key_token, undefined);
  assert.equal(JSON.stringify(meA.data).includes('aqari_live_userA_full_secret_token_xyz9'), false);
  assert.match(String(meA.data.user?.api_key || ''), /^\*\*\*\*[a-f0-9]{4}$/i);

  // 2. User B tries ?action=me&email=userA -> receives ONLY User B profile, NEVER User A
  const meCross = await invokeApi({
    method: 'GET',
    action: 'me',
    headers: { cookie: cookieB },
    query: { email: userA, login_email: userA },
  });
  assert.equal(meCross.statusCode, 200);
  assert.equal(meCross.data.email, userB);

  // 3. User B tries to delete User A's saved analysis -> uniform 404 { error: 'not found' }
  const delCross = await invokeApi({
    method: 'POST',
    action: 'delete-saved',
    headers: { cookie: cookieB },
    body: { email: userA, id: 'asset_owner_a_1' },
  });
  assert.equal(delCross.statusCode, 404);
  assert.equal(delCross.data.error, 'not found');

  // 4. User A exports report, User B tries to fetch that report -> uniform 404 { error: 'not found' }, User A succeeds
  const exportRes = await invokeApi({
    method: 'POST',
    action: 'export',
    headers: { cookie: cookieA },
    body: {
      propertyTitle: 'User A Confidential Memo',
      city: 'Muscat',
      priceUSD: 1_200_000,
      rentUSD: 8_000,
      format: 'pdf',
    },
  });
  assert.equal(exportRes.statusCode, 200);
  const reportId = exportRes.data.reportId;
  assert.ok(reportId);

  const reportCross = await invokeApi({
    method: 'GET',
    action: 'get-report-file',
    headers: { cookie: cookieB },
    query: { id: reportId, email: userA },
  });
  assert.equal(reportCross.statusCode, 404);
  assert.equal(reportCross.data.error, 'not found');

  const reportOwner = await invokeApi({
    method: 'GET',
    action: 'get-report-file',
    headers: { cookie: cookieA },
    query: { id: reportId },
  });
  assert.equal(reportOwner.statusCode, 200);
  assert.equal(reportOwner.data.report.id, reportId);

  // 5. User A creates private workspace org, User B calls GET ?action=workspace&orgId=... -> uniform 404 { error: 'not found' }
  const wsA = await invokeApi({
    method: 'POST',
    action: 'workspace',
    headers: { cookie: cookieA },
    body: { subAction: 'create-org', name: 'Private A Org' },
  });
  assert.equal(wsA.statusCode, 200);
  const orgAId = wsA.data.activeOrg.id;

  const wsCross = await invokeApi({
    method: 'GET',
    action: 'workspace',
    headers: { cookie: cookieB },
    query: { orgId: orgAId },
  });
  assert.equal(wsCross.statusCode, 404);
  assert.equal(wsCross.data.error, 'not found');
});

test('Phase 4 Input Validation, Branding Logo Safety, Persistent Rate Limiting, and Production Error Sanitization', async () => {
  const userEmail = `val_sec_${Date.now()}@aqari.test`;
  await seedTestStoreUser(userEmail, {
    email: userEmail,
    name: 'Validation User',
    plan: 'enterprise',
    analyses_total: 300,
    analyses_left: 300,
    analyses_used: 0,
    white_label_enabled: true,
    license_start: Date.now() - 1000,
    license_end: Date.now() + 30 * 86_400_000,
    status: 'active',
  });
  const userCookie = await createTestSessionCookie(userEmail, 'Validation User');

  // 1. Script / XSS payloads rejected cleanly with 400
  const xssSave = await invokeApi({
    method: 'POST',
    action: 'save-to-portfolio',
    headers: { cookie: userCookie },
    body: {
      analysis: {
        id: 'bad_xss_1',
        property: '<script>alert(1)</script>',
        city: 'Muscat',
        price: 500_000,
        rent: 3_500,
      },
    },
  });
  assert.equal(xssSave.statusCode, 400);

  // 2. Path traversal / unsafe ID rejected with 400
  const badReportId = await invokeApi({
    method: 'GET',
    action: 'get-report-file',
    headers: { cookie: userCookie },
    query: { id: '../../etc/passwd' },
  });
  assert.equal(badReportId.statusCode, 400);

  // 3. Negative / absurd / NaN financial numbers rejected with 400
  const badNumbers = await invokeApi({
    method: 'POST',
    action: 'run-analysis',
    headers: { cookie: userCookie },
    body: {
      propertyTitle: 'Invalid Price Property',
      city: 'Muscat',
      priceUSD: -500,
      rentUSD: 4000,
    },
  });
  assert.equal(badNumbers.statusCode, 400);

  const hugeNumbers = await invokeApi({
    method: 'POST',
    action: 'run-analysis',
    headers: { cookie: userCookie },
    body: {
      propertyTitle: 'Overflow Property',
      city: 'Muscat',
      priceUSD: 1e15,
      rentUSD: 4000,
    },
  });
  assert.equal(hugeNumbers.statusCode, 400);

  // 4. Dangerous branding URLs (image/svg+xml and javascript:) rejected with 400
  for (const badLogo of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zy8+']) {
    const brandBad = await invokeApi({
      method: 'POST',
      action: 'update-branding',
      headers: { cookie: userCookie },
      body: { firmName: 'Safe Firm', logoUrl: badLogo },
    });
    assert.equal(brandBad.statusCode, 400);
  }

  // 5. Persistent rateLimit stays enforced after reload / multiple invocations
  const { rateLimit } = await import('../lib/serverStore');
  const rlKey = `test_rl_${Date.now()}`;
  for (let i = 0; i < 10; i++) {
    const r = await rateLimit(rlKey, 10, 600_000);
    assert.equal(r.allowed, true);
  }
  const rlBlocked = await rateLimit(rlKey, 10, 600_000);
  assert.equal(rlBlocked.allowed, false);
  assert.ok(rlBlocked.retryAfterSec >= 1);

  // 6. Production sanitization: errors do not leak secret env names, /tmp paths, or stack traces
  const prevVercelEnv = process.env.VERCEL_ENV;
  const prevResend = process.env.RESEND_API_KEY;
  process.env.VERCEL_ENV = 'production';
  delete process.env.RESEND_API_KEY;
  try {
    const prevAdminToken = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = 'prod_san_admin_tok';
    try {
      const emailRes = await invokeAdminApi({
        action: 'email',
        method: 'POST',
        headers: { 'x-admin-token': 'prod_san_admin_tok' },
        body: { email: userEmail, subject: 'Test', body: 'Hello' },
      });
      assert.equal(emailRes.data.key_prefix, undefined);
      assert.equal(String(emailRes.data.error || '').includes('RESEND_API_KEY'), false);
    } finally {
      if (prevAdminToken === undefined) delete process.env.ADMIN_TOKEN;
      else process.env.ADMIN_TOKEN = prevAdminToken;
    }

    await deleteTestUsers(userEmail);
  } finally {
    if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercelEnv;
    if (prevResend !== undefined) process.env.RESEND_API_KEY = prevResend;
  }
});

test('Admin CORS & Cross-Domain Session: strict https://admin-aqari2.vercel.app origin, OPTIONS 200, SameSite=None only for admin origin', async (t) => {
  const {
    ADMIN_ALLOWED_ORIGIN,
    createSession,
    destroySession,
    isAdminRequestOrigin,
  } = await import('../lib/auth');

  assert.equal(ADMIN_ALLOWED_ORIGIN, 'https://admin-aqari2.vercel.app');

  // 1. OPTIONS preflight returns 200 with admin CORS headers and NO auth check on both /api/app and /api/admin
  for (const fn of [invokeApi, invokeAdminApi]) {
    const optAllowed = await fn({
      action: 'users',
      method: 'OPTIONS',
      headers: { origin: 'https://admin-aqari2.vercel.app' },
    });
    assert.equal(optAllowed.statusCode, 200);
    assert.equal(optAllowed.headers['Access-Control-Allow-Origin'], 'https://admin-aqari2.vercel.app');
    assert.equal(optAllowed.headers['Access-Control-Allow-Credentials'], 'true');
    assert.equal(optAllowed.headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
    assert.equal(optAllowed.headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization');

    // Disallowed / arbitrary origins NEVER get * or reflected Access-Control-Allow-Origin
    for (const badOrigin of [
      'https://evil.com',
      'https://other-admin.vercel.app',
      'https://aqari-ai-rho.vercel.app',
      'http://localhost:5173',
    ]) {
      const optBlocked = await fn({
        action: 'users',
        method: 'OPTIONS',
        headers: { origin: badOrigin },
      });
      assert.equal(optBlocked.statusCode, 200);
      assert.equal(optBlocked.headers['Access-Control-Allow-Origin'], undefined);
      assert.equal(optBlocked.headers['Access-Control-Allow-Credentials'], undefined);
      assert.notEqual(optBlocked.headers['Access-Control-Allow-Origin'], '*');
    }
  }

  // 2. Session cookie uses HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800 ONLY when Origin is admin origin
  const makeMockRes = () => {
    const headers: Record<string, any> = {};
    return {
      headers,
      setHeader(k: string, v: any) {
        headers[k] = v;
        return this;
      },
      getHeader(k: string) {
        return headers[k];
      },
    };
  };

  const adminReq = { headers: { origin: 'https://admin-aqari2.vercel.app' } };
  const mainAppReq = { headers: { origin: 'https://aqari-ai-rho.vercel.app' } };
  const evilReq = { headers: { origin: 'https://evil.com' } };
  const noOriginReq = { headers: {} };

  assert.equal(isAdminRequestOrigin(adminReq), true);
  assert.equal(isAdminRequestOrigin(mainAppReq), false);
  assert.equal(isAdminRequestOrigin(evilReq), false);
  assert.equal(isAdminRequestOrigin(noOriginReq), false);

  const adminRes = makeMockRes();
  const { cookieToken: adminCookieTok } = await createSession(
    adminRes,
    {
      email: 'cors_admin@aqari.test',
      name: 'Admin User',
      verifiedViaGoogle: true,
    },
    { req: adminReq }
  );
  const adminSetCookie = String(adminRes.headers['Set-Cookie'] || '');
  assert.ok(adminSetCookie.includes('HttpOnly'));
  assert.ok(adminSetCookie.includes('Secure'));
  assert.ok(adminSetCookie.includes('SameSite=None'));
  assert.ok(adminSetCookie.includes('Path=/'));
  assert.ok(adminSetCookie.includes('Max-Age=604800'));

  // Main app request keeps SameSite=Lax (no SameSite=None)
  const mainRes = makeMockRes();
  await createSession(
    mainRes,
    {
      email: 'cors_main@aqari.test',
      name: 'Main User',
      verifiedViaGoogle: true,
    },
    { req: mainAppReq }
  );
  const mainSetCookie = String(mainRes.headers['Set-Cookie'] || '');
  assert.ok(mainSetCookie.includes('HttpOnly'));
  assert.ok(mainSetCookie.includes('SameSite=Lax'));
  assert.equal(mainSetCookie.includes('SameSite=None'), false);
  assert.ok(mainSetCookie.includes('Path=/'));
  assert.ok(mainSetCookie.includes('Max-Age=604800'));

  // No-origin request also keeps SameSite=Lax
  const noOriginRes = makeMockRes();
  await createSession(
    noOriginRes,
    {
      email: 'cors_noorigin@aqari.test',
      verifiedViaGoogle: true,
    },
    { req: noOriginReq }
  );
  assert.ok(String(noOriginRes.headers['Set-Cookie'] || '').includes('SameSite=Lax'));
  assert.equal(String(noOriginRes.headers['Set-Cookie'] || '').includes('SameSite=None'), false);

  // destroySession mirrors SameSite=None; Secure for admin origin
  const destroyAdminRes = makeMockRes();
  await destroySession(
    { headers: { origin: 'https://admin-aqari2.vercel.app', cookie: `aqari_session=${adminCookieTok}` } },
    destroyAdminRes
  );
  const destroyCookieStr = String(destroyAdminRes.headers['Set-Cookie'] || '');
  assert.ok(destroyCookieStr.includes('SameSite=None'));
  assert.ok(destroyCookieStr.includes('Secure'));
  assert.ok(destroyCookieStr.includes('Max-Age=0'));

  // 3. Cross-domain authenticated GET /api/admin?action=users works for configured admin with admin Origin
  const prevAdminEmail = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = 'cors_admin@aqari.test';
  t.after(() => {
    if (prevAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prevAdminEmail;
  });

  const adminSessionRes = makeMockRes();
  const { cookieToken: liveAdminTok } = await createSession(
    adminSessionRes,
    {
      email: 'cors_admin@aqari.test',
      name: 'Owner Admin',
      verifiedViaGoogle: true,
    },
    { req: adminReq }
  );
  const usersRes = await invokeAdminApi({
    action: 'users',
    method: 'GET',
    headers: {
      origin: 'https://admin-aqari2.vercel.app',
      cookie: `aqari_session=${encodeURIComponent(liveAdminTok)}`,
    },
  });
  assert.equal(usersRes.statusCode, 200);
  assert.equal(usersRes.headers['Access-Control-Allow-Origin'], 'https://admin-aqari2.vercel.app');
  assert.equal(usersRes.headers['Access-Control-Allow-Credentials'], 'true');
  assert.ok(Array.isArray(usersRes.data?.users));

  // Evil origin calling GET /api/admin gets 401/403 and NO Access-Control-Allow-Origin
  const evilUsersRes = await invokeAdminApi({
    action: 'users',
    method: 'GET',
    headers: {
      origin: 'https://evil.com',
    },
  });
  assert.equal(evilUsersRes.statusCode, 401);
  assert.equal(evilUsersRes.headers['Access-Control-Allow-Origin'], undefined);
});

test('Phase 4 Account Deletion & Endpoint Rate Limits: deleteMyAccount purges data/sessions -> 401 on me; 11th google-login -> 429', async () => {
  // 1. Unauthenticated deleteMyAccount returns 401
  const unauthDel = await invokeApi({
    action: 'deleteMyAccount',
    method: 'POST',
  });
  assert.equal(unauthDel.statusCode, 401);

  // 2. Authenticated deleteMyAccount purges user data, invalidates session, logs audit, subsequent me -> 401
  const delEmail = `del_user_${Date.now()}@aqari.test`;
  const delCookie = await createTestSessionCookie(delEmail);

  const meBefore = await invokeApi({
    action: 'me',
    method: 'GET',
    headers: { cookie: delCookie },
  });
  assert.equal(meBefore.statusCode, 200);
  assert.equal(meBefore.data.email, delEmail);

  const saveRes = await invokeApi({
    action: 'save-to-portfolio',
    method: 'POST',
    headers: { cookie: delCookie },
    body: {
      analysis: {
        id: `del_item_${Date.now()}`,
        property: 'Private Deleted Asset',
        city: 'Muscat',
        priceUSD: 400_000,
      },
    },
  });
  assert.equal(saveRes.statusCode, 200);

  const delRes = await invokeApi({
    action: 'deleteMyAccount',
    method: 'POST',
    headers: { cookie: delCookie },
  });
  assert.equal(delRes.statusCode, 200);
  assert.equal(delRes.data.ok, true);

  // Subsequent /api/app?action=me with the deleted session cookie MUST return 401
  const meAfter = await invokeApi({
    action: 'me',
    method: 'GET',
    headers: { cookie: delCookie },
  });
  assert.equal(meAfter.statusCode, 401);

  // Verify audit log recorded DELETE_MY_ACCOUNT without keeping the plaintext deleted email
  const { getAuditLogsFromDb } = await import('../lib/serverStore');
  const auditRes = await getAuditLogsFromDb({ page: 1, limit: 20 });
  const delAudit = auditRes.logs.find((l) => l.action === 'DELETE_MY_ACCOUNT');
  assert.ok(delAudit);
  assert.ok(delAudit.targetEmail.startsWith('deleted_') && delAudit.targetEmail.endsWith('@deleted.local'));

  // 3. Rate limit: 11th google-login attempt from same IP within 10 min returns 429
  const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
  for (let i = 0; i < 10; i++) {
    const attempt = await invokeApi({
      action: 'session',
      method: 'POST',
      headers: { 'x-forwarded-for': testIp },
      body: {},
    });
    assert.equal(attempt.statusCode, 401);
  }
  const eleventhLogin = await invokeApi({
    action: 'session',
    method: 'POST',
    headers: { 'x-forwarded-for': testIp },
    body: {},
  });
  assert.equal(eleventhLogin.statusCode, 429);
  assert.equal(eleventhLogin.data.error, 'too many requests');

  // 4. Rate limit on read (60/min), createAnalysis (20/min), and upload (10/min)
  const rlEmail = `rl_phase4_${Date.now()}@aqari.test`;
  const rlCookie = await createTestSessionCookie(rlEmail);

  for (let i = 0; i < 10; i++) {
    const up = await invokeApi({
      action: 'extract-from-file',
      method: 'POST',
      headers: { cookie: rlCookie },
      body: {},
    });
    assert.notEqual(up.statusCode, 429);
  }
  const eleventhUpload = await invokeApi({
    action: 'extract-from-file',
    method: 'POST',
    headers: { cookie: rlCookie },
    body: {},
  });
  assert.equal(eleventhUpload.statusCode, 429);
});

test('Phase 5 Persistent Storage: atomic decrementCredits prevents negative balance under concurrency (1 credit left -> 200 vs 402)', async (t) => {
  const {
    decrementCredits,
    getCredits,
    getUserIdForEmail,
  } = await import('../lib/serverStore');

  const unitEmail = `race_unit_${Date.now()}@aqari.test`;
  const unitUserId = getUserIdForEmail(unitEmail);
  await seedTestStoreUser(unitEmail, {
    email: unitEmail,
    userId: unitUserId,
    name: 'Race Unit User',
    plan: 'starter',
    analyses_total: 30,
    analyses_left: 1,
    analyses_used: 29,
    extra_credits: 0,
    license_start: Date.now() - 86_400_000,
    license_end: Date.now() + 29 * 86_400_000,
    status: 'active',
  });

  const apiEmail = `race_api_${Date.now()}@aqari.test`;
  await seedTestStoreUser(apiEmail, {
    email: apiEmail,
    name: 'Race API User',
    plan: 'starter',
    analyses_total: 30,
    analyses_left: 1,
    analyses_used: 29,
    extra_credits: 0,
    license_start: Date.now() - 86_400_000,
    license_end: Date.now() + 29 * 86_400_000,
    status: 'active',
  });
  const apiCookie = await createTestSessionCookie(apiEmail, 'Race API User');

  t.after(async () => {
    await deleteTestUsers(unitEmail, apiEmail);
  });

  // 1. Direct Lua decrementCredits concurrency with 1 credit left -> exactly 1 succeeds, 2 get insufficient, balance === 0
  const unitResults = await Promise.all([
    decrementCredits(unitUserId, 1),
    decrementCredits(unitUserId, 1),
    decrementCredits(unitUserId, 1),
  ]);
  const unitOkCount = unitResults.filter((r) => r.ok).length;
  const unitFailCount = unitResults.filter((r) => !r.ok && r.error === 'insufficient').length;
  assert.equal(unitOkCount, 1);
  assert.equal(unitFailCount, 2);
  assert.equal(await getCredits(unitUserId), 0);

  // Also check Redis key schema directly: credits:{userId} exists in mock Redis
  assert.equal(mockRedisState.kv.get(`credits:${unitUserId}`), '0');

  // 2. Concurrent POST /api/app?action=run-analysis with 1 credit left -> one 200, one 402 { error: 'insufficient credits' }
  const apiResults = await Promise.all([
    invokeApi({
      action: 'run-analysis',
      method: 'POST',
      headers: { cookie: apiCookie },
      body: { propertyTitle: 'Concurrent Deal A', city: 'Muscat', priceUSD: 500_000, rentUSD: 3_500 },
    }),
    invokeApi({
      action: 'run-analysis',
      method: 'POST',
      headers: { cookie: apiCookie },
      body: { propertyTitle: 'Concurrent Deal B', city: 'Muscat', priceUSD: 500_000, rentUSD: 3_500 },
    }),
  ]);
  const statuses = apiResults.map((r) => r.statusCode).sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 402]);
  const failedResp = apiResults.find((r) => r.statusCode === 402)!;
  assert.equal(failedResp.data.error, 'insufficient credits');
  assert.equal(await getCredits(getUserIdForEmail(apiEmail)), 0);
});

test('Phase 5 Persistent Storage: atomic savePayment NX + concurrent paddle-webhook apply payment once only', async (t) => {
  const crypto = await import('node:crypto');
  const { savePayment, getPayment, getUser } = await import('../lib/serverStore');

  const nxOrderId = `txn_nx_unit_${Date.now()}`;
  const [p1, p2, p3] = await Promise.all([
    savePayment(nxOrderId, {
      login_email: 'nx_user@aqari.test',
      payment_email: 'nx_user@aqari.test',
      plan: 'free',
      plan_display: '+25 AI Credits',
      purchase_type: 'credit_pack',
      pack_id: 'pack_25',
      analyses: 25,
      amount: 19,
      test_mode: true,
      used_at: Date.now(),
    }),
    savePayment(nxOrderId, {
      login_email: 'nx_user@aqari.test',
      payment_email: 'nx_user@aqari.test',
      plan: 'free',
      plan_display: '+25 AI Credits',
      purchase_type: 'credit_pack',
      pack_id: 'pack_25',
      analyses: 25,
      amount: 19,
      test_mode: true,
      used_at: Date.now(),
    }),
    savePayment(nxOrderId, {
      login_email: 'nx_user@aqari.test',
      payment_email: 'nx_user@aqari.test',
      plan: 'free',
      plan_display: '+25 AI Credits',
      purchase_type: 'credit_pack',
      pack_id: 'pack_25',
      analyses: 25,
      amount: 19,
      test_mode: true,
      used_at: Date.now(),
    }),
  ]);
  assert.equal([p1.ok, p2.ok, p3.ok].filter(Boolean).length, 1);
  assert.ok(await getPayment(nxOrderId));
  assert.ok(mockRedisState.kv.has(`payment:${nxOrderId.toUpperCase()}`) || mockRedisState.kv.has(`payment:${nxOrderId}`));

  // Concurrent Paddle webhook calls for same transaction_id must credit ONCE only
  const whEmail = `wh_conc_${Date.now()}@aqari.test`;
  const whTxn = `txn_wh_conc_${Date.now()}`;
  const prevSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const testSecret = 'pdl_ntfset_phase5_conc';
  process.env.PADDLE_WEBHOOK_SECRET = testSecret;

  t.after(async () => {
    if (prevSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
    await deleteTestUsers(whEmail);
  });

  const whPayload = JSON.stringify({
    event_type: 'transaction.completed',
    data: {
      id: whTxn,
      currency_code: 'USD',
      customer: { email: whEmail },
      details: { totals: { total: '1900' } },
      custom_data: {
        email: whEmail,
        login_email: whEmail,
        purchase_type: 'credit_pack',
        packId: 'pack_25',
      },
    },
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const h1 = crypto.createHmac('sha256', testSecret).update(`${ts}:${whPayload}`).digest('hex');
  const sig = `ts=${ts};h1=${h1}`;

  const [w1, w2] = await Promise.all([
    invokeApi({ action: 'paddle-webhook', method: 'POST', headers: { 'paddle-signature': sig }, body: whPayload }),
    invokeApi({ action: 'paddle-webhook', method: 'POST', headers: { 'paddle-signature': sig }, body: whPayload }),
  ]);
  assert.equal(w1.statusCode, 200);
  assert.equal(w2.statusCode, 200);
  const creditsAddedTotal = Number(w1.data.creditsAdded || 0) + Number(w2.data.creditsAdded || 0);
  assert.equal(creditsAddedTotal, 25);

  const savedUser = await getUser(whEmail);
  assert.equal(savedUser?.extra_credits, 25);
});

test('Phase 5 Persistent Storage: transactional updatePlan, schema keys (user/credits/session/analysis/payment/audit), and cross-read persistence', async (t) => {
  const {
    saveUser,
    getUser,
    updatePlan,
    saveAnalysis,
    getAnalyses,
    createSessionRecord,
    getSessionRecord,
    getAuditLogsFromDb,
    getUserIdForEmail,
  } = await import('../lib/serverStore');

  const email = `persist_schema_${Date.now()}@aqari.test`;
  const userId = getUserIdForEmail(email);

  t.after(async () => {
    await deleteTestUsers(email);
  });

  await seedTestStoreUser(email, {
    email,
    userId,
    name: 'Schema Test User',
    plan: 'free',
    analyses_total: 3,
    analyses_left: 3,
    extra_credits: 10,
  });

  // Transactional updatePlan via Redis MULTI/EXEC
  const { user: upgraded } = await updatePlan({
    emailOrUserId: email,
    newPlan: 'pro',
    adminEmail: 'admin_test@aqari.test',
    reason: 'Phase 5 multi-key transaction test',
    actionName: 'plan_update',
  });
  assert.equal(upgraded.plan, 'pro');
  assert.equal(upgraded.analyses_left, 110); // 100 plan + 10 extra credits

  // Save analysis & session
  const anaRec = await saveAnalysis(userId, {
    id: `ana_p5_${Date.now()}`,
    property: 'Corniche Office Tower',
    city: 'Muscat',
    priceUSD: 1_500_000,
    capRate: 8.1,
  });
  const sessId = `sess_p5_${Date.now()}`;
  await createSessionRecord({
    sessionId: sessId,
    userId,
    email,
    name: 'Schema Test User',
    verifiedViaGoogle: true,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600_000,
  });

  // Verify exact key schema in Redis
  assert.ok(mockRedisState.kv.has(`user:${email}`), 'user:{email} key must exist');
  assert.equal(mockRedisState.kv.get(`credits:${userId}`), '110', 'credits:{userId} key must match');
  assert.ok(mockRedisState.kv.has(`session:${sessId}`), 'session:{sessionId} key must exist');
  assert.ok(mockRedisState.kv.has(`analysis:${userId}:${anaRec.id}`), 'analysis:{userId}:{analysisId} key must exist');

  // Read back cleanly
  const fetchedUser = await getUser(email);
  assert.equal(fetchedUser?.plan, 'pro');
  const fetchedAnalyses = await getAnalyses(userId);
  assert.ok(fetchedAnalyses.some((a) => a.id === anaRec.id && a.payload.property === 'Corniche Office Tower'));
  const fetchedSession = await getSessionRecord(sessId);
  assert.equal(fetchedSession?.email, email);
  const audits = await getAuditLogsFromDb({ page: 1, limit: 20 });
  assert.ok(audits.logs.some((l) => l.targetEmail === email && l.action === 'plan_update'));
});

test('Phase 5 Persistent Storage: fails loud with HTTP 500 storage unavailable when Redis is unconfigured/down', async () => {
  const { healthCheckStorage } = await import('../lib/serverStore');

  const prevUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevTok = process.env.UPSTASH_REDIS_REST_TOKEN;
  const prevKvUrl = process.env.KV_REST_API_URL;
  const prevKvTok = process.env.KV_REST_API_TOKEN;
  const cookie = await createTestSessionCookie(`outage_${Date.now()}@aqari.test`);

  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;

  try {
    const health = await healthCheckStorage();
    assert.deepEqual(health, { ok: false, error: 'storage unavailable' });

    const healthApi = await invokeApi({ method: 'GET', action: 'health' });
    assert.equal(healthApi.statusCode, 500);
    assert.equal(healthApi.data.ok, false);
    assert.equal(healthApi.data.error, 'storage unavailable');

    const meOutage = await invokeApi({
      method: 'GET',
      action: 'me',
      headers: { cookie },
    });
    assert.equal(meOutage.statusCode, 500);
    assert.equal(meOutage.data.error, 'storage unavailable');

    const adminOutage = await invokeAdminApi({
      method: 'GET',
      action: 'users',
      headers: { cookie },
    });
    assert.equal(adminOutage.statusCode, 500);
    assert.equal(adminOutage.data.error, 'storage unavailable');
  } finally {
    if (prevUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = prevUrl;
    if (prevTok !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = prevTok;
    if (prevKvUrl !== undefined) process.env.KV_REST_API_URL = prevKvUrl;
    if (prevKvTok !== undefined) process.env.KV_REST_API_TOKEN = prevKvTok;
  }

  // After restore, ?action=health returns 200 { ok: true }
  const recovered = await invokeApi({ method: 'GET', action: 'health' });
  assert.equal(recovered.statusCode, 200);
  assert.equal(recovered.data.ok, true);
});

test('Phase 5 Backup Utility: exportAllData & /api/admin?action=backup allow Admin only and scrub secret tokens', async (t) => {
  const { exportAllData } = await import('../lib/backup');
  const prevAdminEmail = process.env.ADMIN_EMAIL;
  const adminEmail = 'backup_admin@aqari.test';
  const normalEmail = `backup_normal_${Date.now()}@aqari.test`;
  process.env.ADMIN_EMAIL = adminEmail;

  await seedTestStoreUser(normalEmail, {
    email: normalEmail,
    name: 'Normal Backup Subject',
    plan: 'pro',
    api_key_token: 'secret_live_api_key_should_not_leak',
  });

  t.after(async () => {
    if (prevAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prevAdminEmail;
    await deleteTestUsers(normalEmail);
  });

  // 1. Direct exportAllData rejects non-admin caller
  await assert.rejects(
    () => exportAllData({ email: normalEmail, name: 'Normal User' }),
    /Admin authentication required/i
  );

  // 2. Non-admin HTTP call to /api/admin?action=backup gets 403
  const normalCookie = await createTestSessionCookie(normalEmail);
  const forbiddenBackup = await invokeAdminApi({
    action: 'backup',
    method: 'GET',
    headers: { cookie: normalCookie },
  });
  assert.equal(forbiddenBackup.statusCode, 403);

  // 3. Admin HTTP call to /api/admin?action=backup returns 200 scrubbed snapshot
  const adminCookie = await createTestSessionCookie(adminEmail);
  const adminBackupRes = await invokeAdminApi({
    action: 'backup',
    method: 'GET',
    headers: { cookie: adminCookie },
  });
  assert.equal(adminBackupRes.statusCode, 200);
  assert.equal(adminBackupRes.data.exportedBy, adminEmail);
  assert.equal(adminBackupRes.data.storageProvider, 'upstash-redis');
  const backedUser = adminBackupRes.data.users.find((u: any) => u.email === normalEmail);
  assert.ok(backedUser);
  assert.equal(backedUser.api_key_token, undefined);
});

