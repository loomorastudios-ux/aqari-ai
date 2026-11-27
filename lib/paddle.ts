// © 2026 Loomora Studios - AQARI TERMINAL - Server-Only Paddle Billing Engine
import crypto from 'crypto';
import { PlanKey, PLANS, EXTRA_CREDIT_PACKS, ExtraCreditPack } from './plans';

const LEGACY_SANDBOX_PRICE_ID = 'pri_01m7qwqceh520nd4we9pg90f8m';
const WEBHOOK_TIMESTAMP_TOLERANCE_SEC = 300;

export type CheckoutPlanKey = Exclude<PlanKey, 'free'>;
export type CreditPackKey = 'pack_25' | 'pack_100' | 'pack_500';

export interface ServerPlanPriceConfig {
  planKey: CheckoutPlanKey;
  code: 'STARTER' | 'PRO' | 'SOVEREIGN' | 'ENTERPRISE';
  priceId: string;
  amount: number;
  originalAmount: number;
  credits: number;
}

export interface ServerCreditPackConfig {
  packId: CreditPackKey;
  priceId: string;
  amount: number;
  credits: number;
  label: string;
}

function getEnv(key: string): string {
  try {
    return typeof process !== 'undefined' && process?.env ? String(process.env[key] || '') : '';
  } catch {
    return '';
  }
}

export function cleanEnvStr(value?: string | null): string {
  return (value || '').replace(/^["']|["']$/g, '').trim();
}

export function cleanPaddleApiKey(value?: string | null): string {
  return cleanEnvStr(value)
    .replace(/^(?:bearer|token|basic)\s+/i, '')
    .replace(/[\r\n\t\s]+/g, '')
    .trim();
}

function pickPriceIdFromEnv(keys: string[], liveFallback = '', isSandbox = false): string {
  for (const k of keys) {
    const val = cleanEnvStr(getEnv(k));
    if (!val || val === 'undefined' || val === 'null') continue;
    if (!isSandbox && val === LEGACY_SANDBOX_PRICE_ID) continue;
    if (val.startsWith('pri_')) return val;
  }
  return isSandbox ? '' : liveFallback;
}

export function resolvePaddleEnv(): {
  configured: boolean;
  raw: string;
  normalized: 'live' | 'sandbox';
  baseUrl: string;
  isSandbox: boolean;
  invalidEnv?: string;
} {
  const raw = cleanEnvStr(getEnv('PADDLE_ENVIRONMENT')).toLowerCase();
  if (!raw || raw === 'live' || raw === 'production') {
    return {
      configured: raw === 'live' || raw === 'production',
      raw: raw || 'live',
      normalized: 'live',
      baseUrl: 'https://api.paddle.com',
      isSandbox: false,
    };
  }
  if (raw === 'sandbox') {
    return {
      configured: true,
      raw: 'sandbox',
      normalized: 'sandbox',
      baseUrl: 'https://sandbox-api.paddle.com',
      isSandbox: true,
    };
  }
  return {
    configured: false,
    raw,
    normalized: 'live',
    baseUrl: 'https://api.paddle.com',
    isSandbox: false,
    invalidEnv: raw,
  };
}

export function getServerPrices(isSandboxOverride?: boolean): {
  plans: Record<CheckoutPlanKey, ServerPlanPriceConfig>;
  packs: Record<CreditPackKey, ServerCreditPackConfig>;
  STARTER: ServerPlanPriceConfig;
  PRO: ServerPlanPriceConfig;
  SOVEREIGN: ServerPlanPriceConfig;
  ENTERPRISE: ServerPlanPriceConfig;
} {
  const envInfo = resolvePaddleEnv();
  const isSandbox = typeof isSandboxOverride === 'boolean' ? isSandboxOverride : envInfo.isSandbox;

  const starterId = pickPriceIdFromEnv(
    [
      'PADDLE_PRICE_STARTER',
      'PADDLE_STARTER_PRICE',
      'PADDLE_STARTER_PRICE_ID',
      'VITE_PADDLE_STARTER_PRICE',
      'NEXT_PUBLIC_PADDLE_STARTER_PRICE',
    ],
    'pri_01m7tgfvteegdih2mx4hgyz1c',
    isSandbox
  );
  const proId = pickPriceIdFromEnv(
    [
      'PADDLE_PRICE_PRO',
      'PADDLE_PRO_PRICE',
      'PADDLE_PRO_PRICE_ID',
      'VITE_PADDLE_PRICE_ID',
      'NEXT_PUBLIC_PADDLE_PRICE_ID',
    ],
    'pri_01m7tggqhjtgk9fxmmg6mbp5wy',
    isSandbox
  );
  const sovereignId = pickPriceIdFromEnv(
    [
      'PADDLE_PRICE_SOVEREIGN',
      'PADDLE_SOVEREIGN_PRICE',
      'PADDLE_SOVEREIGN_PRICE_ID',
      'VITE_PADDLE_SOVEREIGN_PRICE',
      'NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE',
    ],
    'pri_01m7tgj4pp767gacchp49k2qev',
    isSandbox
  );
  const enterpriseId = pickPriceIdFromEnv(
    [
      'PADDLE_PRICE_ENTERPRISE',
      'PADDLE_ENTERPRISE_PRICE',
      'PADDLE_ENTERPRISE_PRICE_ID',
      'VITE_PADDLE_ENTERPRISE_PRICE',
      'NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE',
    ],
    '',
    isSandbox
  );

  const starterCfg: ServerPlanPriceConfig = {
    planKey: 'starter',
    code: 'STARTER',
    priceId: starterId,
    amount: PLANS.starter.launchPrice,
    originalAmount: PLANS.starter.originalPrice,
    credits: PLANS.starter.analysesLimit,
  };
  const proCfg: ServerPlanPriceConfig = {
    planKey: 'pro',
    code: 'PRO',
    priceId: proId,
    amount: PLANS.pro.launchPrice,
    originalAmount: PLANS.pro.originalPrice,
    credits: PLANS.pro.analysesLimit,
  };
  const sovereignCfg: ServerPlanPriceConfig = {
    planKey: 'enterprise',
    code: 'SOVEREIGN',
    priceId: sovereignId,
    amount: PLANS.enterprise.launchPrice,
    originalAmount: PLANS.enterprise.originalPrice,
    credits: PLANS.enterprise.analysesLimit,
  };
  const enterpriseCfg: ServerPlanPriceConfig = {
    planKey: 'institutional',
    code: 'ENTERPRISE',
    priceId: enterpriseId,
    amount: PLANS.institutional.launchPrice,
    originalAmount: PLANS.institutional.originalPrice,
    credits: PLANS.institutional.analysesLimit,
  };

  const c25Id = pickPriceIdFromEnv(
    ['PADDLE_PRICE_CREDIT_25', 'PADDLE_CREDIT_25_PRICE', 'PADDLE_CREDIT_25_PRICE_ID', 'PADDLE_CREDIT_25'],
    '',
    isSandbox
  );
  const c100Id = pickPriceIdFromEnv(
    ['PADDLE_PRICE_CREDIT_100', 'PADDLE_CREDIT_100_PRICE', 'PADDLE_CREDIT_100_PRICE_ID', 'PADDLE_CREDIT_100'],
    '',
    isSandbox
  );
  const c500Id = pickPriceIdFromEnv(
    ['PADDLE_PRICE_CREDIT_500', 'PADDLE_CREDIT_500_PRICE', 'PADDLE_CREDIT_500_PRICE_ID', 'PADDLE_CREDIT_500'],
    '',
    isSandbox
  );

  return {
    STARTER: starterCfg,
    PRO: proCfg,
    SOVEREIGN: sovereignCfg,
    ENTERPRISE: enterpriseCfg,
    plans: {
      starter: starterCfg,
      pro: proCfg,
      enterprise: sovereignCfg,
      institutional: enterpriseCfg,
    },
    packs: {
      pack_25: {
        packId: 'pack_25',
        priceId: c25Id,
        amount: EXTRA_CREDIT_PACKS[0].priceUSD,
        credits: EXTRA_CREDIT_PACKS[0].credits,
        label: EXTRA_CREDIT_PACKS[0].label,
      },
      pack_100: {
        packId: 'pack_100',
        priceId: c100Id,
        amount: EXTRA_CREDIT_PACKS[1].priceUSD,
        credits: EXTRA_CREDIT_PACKS[1].credits,
        label: EXTRA_CREDIT_PACKS[1].label,
      },
      pack_500: {
        packId: 'pack_500',
        priceId: c500Id,
        amount: EXTRA_CREDIT_PACKS[2].priceUSD,
        credits: EXTRA_CREDIT_PACKS[2].credits,
        label: EXTRA_CREDIT_PACKS[2].label,
      },
    },
  };
}

/**
 * Dynamic server-only price catalog snapshot. Never import lib/paddle in src/.
 */
export const SERVER_PRICES = {
  get STARTER() {
    return getServerPrices().STARTER;
  },
  get PRO() {
    return getServerPrices().PRO;
  },
  get SOVEREIGN() {
    return getServerPrices().SOVEREIGN;
  },
  get ENTERPRISE() {
    return getServerPrices().ENTERPRISE;
  },
  get PACK_25() {
    return getServerPrices().packs.pack_25;
  },
  get PACK_100() {
    return getServerPrices().packs.pack_100;
  },
  get PACK_500() {
    return getServerPrices().packs.pack_500;
  },
};

export function parseAllowlistedCheckoutPlan(rawPlan: unknown): CheckoutPlanKey | null {
  if (typeof rawPlan !== 'string') return null;
  const trimmed = rawPlan.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'starter' || lower === 'standard') return 'starter';
  if (lower === 'pro' || lower === 'professional') return 'pro';
  if (lower === 'sovereign' || lower === 'agency') return 'enterprise';
  if (trimmed === 'ENTERPRISE' || lower === 'institutional' || lower === 'enterprise_contract') {
    return 'institutional';
  }
  if (lower === 'enterprise') return 'enterprise';
  return null;
}

export function parseAllowlistedCreditPack(rawPackId: unknown): CreditPackKey | null {
  if (typeof rawPackId !== 'string') return null;
  const clean = rawPackId.trim().toLowerCase();
  if (clean === 'pack_25' || clean === 'pack_100' || clean === 'pack_500') {
    return clean;
  }
  return null;
}

export interface WebhookVerifyResult {
  valid: boolean;
  status: 200 | 401;
  error?: string;
}

export function verifyPaddleWebhookSignature(
  rawBody: string,
  sigHeader: string,
  secretOverride?: string
): WebhookVerifyResult {
  const webhookSecret = cleanEnvStr(secretOverride ?? getEnv('PADDLE_WEBHOOK_SECRET'));
  if (!webhookSecret) {
    return {
      valid: false,
      status: 401,
      error: 'Missing required server environment variable: PADDLE_WEBHOOK_SECRET.',
    };
  }
  const header = String(sigHeader || '').trim();
  if (!header) {
    return {
      valid: false,
      status: 401,
      error: 'Missing Paddle-Signature header.',
    };
  }

  let ts = '';
  const signatures: string[] = [];
  for (const seg of header.split(';')) {
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) continue;
    const k = seg.slice(0, eqIdx).trim();
    const v = seg.slice(eqIdx + 1).trim();
    if (k === 'ts' && v) ts = v;
    if (k === 'h1' && v) signatures.push(v);
  }

  if (!ts || signatures.length === 0) {
    return {
      valid: false,
      status: 401,
      error: 'Malformed Paddle-Signature header.',
    };
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || tsNum <= 0) {
    return {
      valid: false,
      status: 401,
      error: 'Invalid webhook signature timestamp.',
    };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > WEBHOOK_TIMESTAMP_TOLERANCE_SEC) {
    return {
      valid: false,
      status: 401,
      error: 'Webhook signature timestamp expired.',
    };
  }

  const expectedHex = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${ts}:${rawBody}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  let matched = false;
  for (const sig of signatures) {
    try {
      const providedBuf = Buffer.from(sig, 'hex');
      if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        matched = true;
        break;
      }
    } catch {
      // Ignore malformed hex candidate
    }
  }

  if (!matched) {
    return {
      valid: false,
      status: 401,
      error: 'Invalid HMAC signature mismatch.',
    };
  }

  return { valid: true, status: 200 };
}

export function validatePaddleServerCredentials():
  | {
      ok: true;
      isSandbox: boolean;
      environment: 'production' | 'sandbox';
      baseUrl: string;
      apiKey: string;
      clientToken: string;
    }
  | { ok: false; status: 400; error: string } {
  const envInfo = resolvePaddleEnv();
  if (envInfo.invalidEnv) {
    return {
      ok: false,
      status: 400,
      error: `Missing Paddle config: PADDLE_ENVIRONMENT (invalid "${envInfo.invalidEnv}", expected "live" or "sandbox")`,
    };
  }

  const isProdDeploy = cleanEnvStr(getEnv('VERCEL_ENV')).toLowerCase() === 'production';
  if (isProdDeploy && envInfo.isSandbox) {
    return {
      ok: false,
      status: 400,
      error: 'Missing Paddle config: PADDLE_ENVIRONMENT (must be "live" in production)',
    };
  }

  const apiKey = cleanPaddleApiKey(getEnv('PADDLE_API_KEY'));
  if (!apiKey) {
    return {
      ok: false,
      status: 400,
      error: 'Missing Paddle config: PADDLE_API_KEY',
    };
  }

  if (!envInfo.isSandbox && (apiKey.startsWith('pdl_sdbx') || apiKey.toLowerCase().includes('sandbox'))) {
    return {
      ok: false,
      status: 400,
      error: 'Missing Paddle config: PADDLE_API_KEY (sandbox key not allowed in live mode)',
    };
  }
  if (envInfo.isSandbox && apiKey.startsWith('pdl_live')) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid Paddle config: PADDLE_ENVIRONMENT=sandbox cannot use live PADDLE_API_KEY',
    };
  }

  const clientToken = cleanEnvStr(
    getEnv('PADDLE_CLIENT_SIDE_TOKEN') ||
      getEnv('VITE_PADDLE_CLIENT_TOKEN') ||
      getEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN') ||
      getEnv('PADDLE_CLIENT_TOKEN')
  );
  if (!clientToken) {
    return {
      ok: false,
      status: 400,
      error: 'Missing Paddle config: PADDLE_CLIENT_SIDE_TOKEN',
    };
  }
  if (!envInfo.isSandbox && clientToken.startsWith('test_')) {
    return {
      ok: false,
      status: 400,
      error: 'Missing Paddle config: PADDLE_CLIENT_SIDE_TOKEN (sandbox token not allowed in live mode)',
    };
  }
  if (envInfo.isSandbox && clientToken.startsWith('live_')) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid Paddle config: PADDLE_ENVIRONMENT=sandbox cannot use live client token',
    };
  }

  return {
    ok: true,
    isSandbox: envInfo.isSandbox,
    environment: envInfo.isSandbox ? 'sandbox' : 'production',
    baseUrl: envInfo.baseUrl,
    apiKey,
    clientToken,
  };
}

export async function createPaddleServerTransaction(params: {
  priceId: string;
  email: string;
  userId: string;
  customData: Record<string, any>;
  baseUrl: string;
  apiKey: string;
  isSandbox: boolean;
}): Promise<
  | { ok: true; transactionId: string; checkoutUrl: string }
  | { ok: false; status: number; code?: string | null; detail?: string; raw?: any }
> {
  const paddleTxnRes = await fetch(`${params.baseUrl}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      // SECURITY: Quantity is hardcoded to 1 on server; customer & customData bound server-side
      items: [{ price_id: params.priceId, quantity: 1 }],
      custom_data: {
        ...params.customData,
        email: params.email,
        login_email: params.email,
        userId: params.userId,
        quantity: 1,
      },
    }),
  });

  const paddleRawText = await paddleTxnRes.text();
  let paddleTxnJson: any = null;
  try {
    paddleTxnJson = paddleRawText ? JSON.parse(paddleRawText) : null;
  } catch {}

  if (paddleTxnRes.status === 401) {
    return {
      ok: false,
      status: 401,
      code: paddleTxnJson?.error?.code || null,
      detail: 'Paddle auth failed - check API key in Vercel',
      raw: paddleTxnJson?.error || paddleTxnJson || paddleRawText || null,
    };
  }

  if (!paddleTxnRes.ok || !paddleTxnJson?.data?.id) {
    const paddleCode = String(paddleTxnJson?.error?.code || '').trim() || null;
    const paddleDetail =
      paddleTxnJson?.error?.detail ||
      paddleTxnJson?.error?.message ||
      paddleRawText ||
      `Paddle transactions API returned ${paddleTxnRes.status}`;
    return {
      ok: false,
      status: paddleTxnRes.status >= 400 && paddleTxnRes.status < 600 ? paddleTxnRes.status : 400,
      code: paddleCode,
      detail: paddleDetail,
      raw: paddleTxnJson?.error || paddleTxnJson || paddleRawText || null,
    };
  }

  const transactionId = String(paddleTxnJson.data.id);
  const apiCheckoutUrl = cleanEnvStr(paddleTxnJson?.data?.checkout?.url);
  const fallbackCheckoutUrl = `${
    params.isSandbox ? 'https://sandbox-buy.paddle.com' : 'https://buy.paddle.com'
  }/checkout?_ptxn=${encodeURIComponent(transactionId)}`;

  return {
    ok: true,
    transactionId,
    checkoutUrl: apiCheckoutUrl || fallbackCheckoutUrl,
  };
}

export function parsePaddleAmountUSD(rawTotal: unknown, fallbackUSD = 0): number {
  if (rawTotal === undefined || rawTotal === null || rawTotal === '') return fallbackUSD;
  const numericVal = Number(rawTotal);
  if (!Number.isFinite(numericVal) || numericVal <= 0) return fallbackUSD;
  if (typeof rawTotal === 'string' && rawTotal.trim() !== '' && !rawTotal.includes('.')) {
    return Number((numericVal / 100).toFixed(2));
  }
  return numericVal >= 1000 ? Number((numericVal / 100).toFixed(2)) : Number(numericVal.toFixed(2));
}

export function resolveServerItemFromPriceId(
  itemPriceId: string,
  isSandbox = false
):
  | { type: 'plan'; plan: CheckoutPlanKey }
  | { type: 'credit_pack'; pack: ExtraCreditPack }
  | null {
  const pid = String(itemPriceId || '').trim();
  if (!pid) return null;
  const catalog = getServerPrices(isSandbox);

  if (catalog.packs.pack_25.priceId && pid === catalog.packs.pack_25.priceId) {
    return { type: 'credit_pack', pack: EXTRA_CREDIT_PACKS[0] };
  }
  if (catalog.packs.pack_100.priceId && pid === catalog.packs.pack_100.priceId) {
    return { type: 'credit_pack', pack: EXTRA_CREDIT_PACKS[1] };
  }
  if (catalog.packs.pack_500.priceId && pid === catalog.packs.pack_500.priceId) {
    return { type: 'credit_pack', pack: EXTRA_CREDIT_PACKS[2] };
  }

  if (catalog.plans.starter.priceId && pid === catalog.plans.starter.priceId) {
    return { type: 'plan', plan: 'starter' };
  }
  if (catalog.plans.pro.priceId && pid === catalog.plans.pro.priceId) {
    return { type: 'plan', plan: 'pro' };
  }
  if (catalog.plans.enterprise.priceId && pid === catalog.plans.enterprise.priceId) {
    return { type: 'plan', plan: 'enterprise' };
  }
  if (catalog.plans.institutional.priceId && pid === catalog.plans.institutional.priceId) {
    return { type: 'plan', plan: 'institutional' };
  }

  return null;
}
