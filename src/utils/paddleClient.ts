import { initializePaddle, Paddle, PaddleEventData } from '@paddle/paddle-js';

export type PaidPlanId = 'starter' | 'pro' | 'enterprise' | 'institutional';
export type CreditPackId = 'pack_25' | 'pack_100' | 'pack_500';

export const LIVE_PADDLE_PRICE_IDS: Record<'starter' | 'pro' | 'enterprise', string> = {
  starter: 'pri_01m7tgfvteegdih2mx4hgyz1c',
  pro: 'pri_01m7tggqhjtgk9fxmmg6mbp5wy',
  enterprise: 'pri_01m7tgj4pp767gacchp49k2qev',
};

export const PADDLE_PRICE_ENV_KEYS: Record<PaidPlanId, string> = {
  starter: 'NEXT_PUBLIC_PADDLE_STARTER_PRICE',
  pro: 'NEXT_PUBLIC_PADDLE_PRICE_ID',
  enterprise: 'NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE',
  institutional: 'NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE',
};

export const PADDLE_CREDIT_PACK_ENV_KEYS: Record<CreditPackId, string> = {
  pack_25: 'NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE',
  pack_100: 'NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE',
  pack_500: 'NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE',
};

export const CREDIT_PACK_CREDITS: Record<CreditPackId, number> = {
  pack_25: 25,
  pack_100: 100,
  pack_500: 500,
};

const LEGACY_SANDBOX_PRICE_ID = 'pri_01m7qwqceh520nd4we9pg90f8m';

export interface PaddleCheckoutHandlers {
  plan?: PaidPlanId;
  purchaseType?: 'subscription' | 'credit_pack';
  packId?: CreditPackId;
  email?: string;
  userId?: string;
  refundAcceptedAt?: string;
  onVerified?: (verifyData: any, meData?: any) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

export interface PaddleCreditCheckoutHandlers {
  packId: CreditPackId;
  email?: string;
  userId?: string;
  refundAcceptedAt?: string;
  onVerified?: (verifyData: any, meData?: any) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

export const PADDLE_PRO_SUCCESS_MESSAGE = 'Subscription activated! PRO plan is now active.';

let paddleInstancePromise: Promise<Paddle | undefined> | null = null;
let cachedPaddleInstance: Paddle | undefined;
let activeHandlers: PaddleCheckoutHandlers | null = null;
let isVerifyingTransaction = false;

function cleanEnvStr(val: unknown): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return s && s !== 'undefined' && s !== 'null' ? s : '';
}

function pickPriceId(candidates: string[], fallbackLiveId?: string): string {
  for (const raw of candidates) {
    const cleaned = cleanEnvStr(raw);
    if (cleaned && cleaned !== LEGACY_SANDBOX_PRICE_ID && cleaned.startsWith('pri_')) {
      return cleaned;
    }
  }
  return fallbackLiveId || '';
}

export function getPaddleEnvironment(): 'production' | 'sandbox' | null {
  let procEnv = '';
  try {
    procEnv = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || '').trim().toLowerCase();
  } catch {}
  const viteEnv = cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_ENVIRONMENT)
    .trim()
    .toLowerCase();
  const raw = procEnv || viteEnv;
  if (raw === 'live') return 'production';
  return null;
}

export function getPaddleClientToken(): string {
  let procNextToken = '';
  try {
    procNextToken = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
  } catch {}
  const viteNextToken = cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
  return procNextToken || viteNextToken;
}

export function getPaddlePriceId(plan: PaidPlanId): string {
  let procNextStarter = '';
  let procNextStarterAlt = '';
  let procNextPro = '';
  let procNextProAlt = '';
  let procNextProAlt2 = '';
  let procNextSovereign = '';
  let procNextSovereignAlt = '';
  let procNextEnterprise = '';
  let procNextEnterpriseAlt = '';
  try {
    procNextStarter = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE);
  } catch {}
  try {
    procNextStarterAlt = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID);
  } catch {}
  try {
    procNextPro = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_PRICE_ID);
  } catch {}
  try {
    procNextProAlt = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE);
  } catch {}
  try {
    procNextProAlt2 = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID);
  } catch {}
  try {
    procNextSovereign = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE);
  } catch {}
  try {
    procNextSovereignAlt = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID);
  } catch {}
  try {
    procNextEnterprise = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE);
  } catch {}
  try {
    procNextEnterpriseAlt = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE_ID);
  } catch {}

  const env = getPaddleEnvironment();
  const liveFallback = env === 'production' ? LIVE_PADDLE_PRICE_IDS : undefined;

  if (plan === 'starter') {
    return pickPriceId(
      [
        procNextStarter,
        procNextStarterAlt,
        cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_STARTER_PRICE),
        cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID),
      ],
      liveFallback?.starter
    );
  }

  if (plan === 'enterprise') {
    return pickPriceId(
      [
        procNextSovereign,
        procNextSovereignAlt,
        cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE),
        cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID),
      ],
      liveFallback?.enterprise
    );
  }

  if (plan === 'institutional') {
    return pickPriceId([
      procNextEnterprise,
      procNextEnterpriseAlt,
      cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE),
      cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE_ID),
    ]);
  }

  return pickPriceId(
    [
      procNextPro,
      procNextProAlt,
      procNextProAlt2,
      cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_PRICE_ID),
      cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_PRO_PRICE),
      cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID),
    ],
    liveFallback?.pro
  );
}

export function getPaddleProPriceId(): string {
  return getPaddlePriceId('pro');
}

export function getPaddleCreditPriceId(packId: CreditPackId): string {
  let proc25 = '';
  let proc25Alt = '';
  let proc100 = '';
  let proc100Alt = '';
  let proc500 = '';
  let proc500Alt = '';
  try {
    proc25 = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE);
  } catch {}
  try {
    proc25Alt = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE_ID);
  } catch {}
  try {
    proc100 = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE);
  } catch {}
  try {
    proc100Alt = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE_ID);
  } catch {}
  try {
    proc500 = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE);
  } catch {}
  try {
    proc500Alt = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE_ID);
  } catch {}

  const candidates =
    packId === 'pack_25'
      ? [
          cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE),
          cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE_ID),
          proc25,
          proc25Alt,
        ]
      : packId === 'pack_100'
      ? [
          cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE),
          cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE_ID),
          proc100,
          proc100Alt,
        ]
      : [
          cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE),
          cleanEnvStr((import.meta as any).env?.NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE_ID),
          proc500,
          proc500Alt,
        ];

  return pickPriceId(candidates);
}

export function getCheckoutSuccessUrl(transactionId?: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://aqari-ai-rho.vercel.app';
  const base = `${origin}/app?checkout=success`;
  return transactionId ? `${base}&transaction_id=${encodeURIComponent(transactionId)}` : base;
}

async function handlePaddleEvent(event: PaddleEventData) {
  if (!event || !event.name) return;

  if (event.name === 'checkout.closed') {
    activeHandlers?.onClose?.();
    return;
  }

  if (event.name === 'checkout.error' || event.name === 'checkout.failed' || (event as any)?.error) {
    console.error('[Paddle] Checkout error event:', event);
    const rawError = (event as any)?.error || (event as any)?.detail || event;
    const detail =
      (typeof rawError === 'object'
        ? rawError?.detail || rawError?.message || JSON.stringify(rawError)
        : String(rawError)) || 'Paddle checkout encountered an error.';
    activeHandlers?.onError?.(detail);
    return;
  }

  if (event.name === 'checkout.completed') {
    if (isVerifyingTransaction) return;
    isVerifyingTransaction = true;
    const handlers = activeHandlers;
    const transactionId = String(event.data?.transaction_id || '').trim();
    const eventCustomData = ((event.data as any)?.custom_data || {}) as Record<string, any>;
    const customerEmail = String(
      handlers?.email || event.data?.customer?.email || eventCustomData?.email || ''
    )
      .trim()
      .toLowerCase();

    const isCreditPack =
      handlers?.purchaseType === 'credit_pack' ||
      eventCustomData?.purchase_type === 'credit_pack' ||
      Boolean(handlers?.packId || eventCustomData?.packId);

    try {
      if (isCreditPack) {
        const packId = (handlers?.packId || eventCustomData?.packId || 'pack_25') as CreditPackId;
        const creditRes = await fetch('/api/app?action=buy-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            packId,
            transaction_id: transactionId,
            order_id: transactionId,
            email: customerEmail,
            login_email: customerEmail,
          }),
        });
        const creditData = await creditRes.json().catch(() => null);
        if (!creditRes.ok || !creditData?.success) {
          const msg = creditData?.error || 'Unable to verify Paddle credit pack transaction.';
          console.error('[Paddle] Credit pack verification error:', {
            status: creditRes.status,
            creditData,
          });
          handlers?.onError?.(msg);
          return;
        }

        let meData: any = null;
        try {
          const meRes = await fetch(`/api/app?action=me&t=${Date.now()}`, {
            credentials: 'include',
            cache: 'no-store',
          });
          if (meRes.ok) {
            meData = await meRes.json().catch(() => null);
          }
        } catch {}

        try {
          cachedPaddleInstance?.Checkout.close();
        } catch {}

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('aqari:user-updated', { detail: creditData }));
        }
        handlers?.onVerified?.(creditData, meData);
        if (typeof window !== 'undefined' && transactionId) {
          const alreadyOnSuccess =
            window.location.pathname === '/app' &&
            new URLSearchParams(window.location.search).get('checkout') === 'success';
          if (!alreadyOnSuccess) {
            window.location.assign(getCheckoutSuccessUrl(transactionId));
          }
        }
        return;
      }

      const verifyRes = await fetch('/api/app?action=verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transaction_id: transactionId,
          order_id: transactionId,
          email: customerEmail,
          login_email: customerEmail,
          plan: handlers?.plan || 'pro',
          refundAcceptedAt: handlers?.refundAcceptedAt || new Date().toISOString(),
        }),
      });
      const verifyData = await verifyRes.json().catch(() => null);

      if (!verifyRes.ok || !verifyData?.success) {
        const msg = verifyData?.error || 'Unable to verify Paddle payment with server.';
        console.error('[Paddle] Payment verification error:', { verifyStatus: verifyRes.status, verifyData });
        handlers?.onError?.(msg);
        return;
      }

      let meData: any = null;
      try {
        const meRes = await fetch(`/api/app?action=me&t=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (meRes.ok) {
          meData = await meRes.json().catch(() => null);
        }
      } catch {}

      try {
        cachedPaddleInstance?.Checkout.close();
      } catch {}

      const planKey = String(verifyData?.planKey || handlers?.plan || 'pro');
      const successMsg =
        planKey === 'pro'
          ? PADDLE_PRO_SUCCESS_MESSAGE
          : verifyData?.message || `One-time 30-day access activated! ${verifyData?.plan || planKey} plan is now active.`;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('aqari:paddle-verified', {
            detail: {
              message: successMsg,
              verifyData,
              meData,
            },
          })
        );
      }

      handlers?.onVerified?.(
        { ...verifyData, message: successMsg },
        meData
      );
      if (typeof window !== 'undefined' && transactionId) {
        const alreadyOnSuccess =
          window.location.pathname === '/app' &&
          new URLSearchParams(window.location.search).get('checkout') === 'success';
        if (!alreadyOnSuccess) {
          window.location.assign(getCheckoutSuccessUrl(transactionId));
        }
      }
    } catch (err: any) {
      console.error('[Paddle] Payment verification exception:', err);
      handlers?.onError?.(err?.message || 'Payment verification request failed.');
    } finally {
      isVerifyingTransaction = false;
    }
  }
}

export async function getPaddleClient(): Promise<Paddle | undefined> {
  if (cachedPaddleInstance) return cachedPaddleInstance;

  const token = getPaddleClientToken();
  if (!token) {
    console.warn('Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, set it in Vercel');
    return undefined;
  }

  const environment = getPaddleEnvironment();
  if (!environment) {
    console.warn('Missing NEXT_PUBLIC_PADDLE_ENVIRONMENT, set it to live in Vercel');
    return undefined;
  }

  if (!paddleInstancePromise) {
    paddleInstancePromise = initializePaddle({
      environment,
      token,
      eventCallback: handlePaddleEvent,
    })
      .then((paddle) => {
        if (!paddle) {
          console.error('[Paddle] initializePaddle resolved with undefined instance.');
          paddleInstancePromise = null;
          return undefined;
        }
        cachedPaddleInstance = paddle;
        return paddle;
      })
      .catch((err) => {
        console.error('[Paddle] initializePaddle error:', err);
        paddleInstancePromise = null;
        throw err;
      });
  }

  return paddleInstancePromise;
}

export async function openPaddleCheckout(handlers: PaddleCheckoutHandlers): Promise<void> {
  const targetPlan = handlers.plan || 'pro';
  activeHandlers = { ...handlers, plan: targetPlan, purchaseType: 'subscription' };

  const localPriceId = getPaddlePriceId(targetPlan);
  const checkoutRes = await fetch('/api/app?action=checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      plan: targetPlan,
      ...(localPriceId ? { priceId: localPriceId } : {}),
      email: handlers.email || '',
      userId: handlers.userId || 'guest',
      refundAcceptedAt: handlers.refundAcceptedAt || new Date().toISOString(),
    }),
  });

  const checkoutData: any = await checkoutRes.json().catch(() => null);
  if (!checkoutRes.ok || !checkoutData?.success) {
    const msg = checkoutData?.error || `Checkout failed (${checkoutRes.status}).`;
    console.error('[Paddle] /api/app?action=checkout error:', msg);
    throw new Error(msg);
  }

  const priceId = cleanEnvStr(checkoutData?.priceId) || localPriceId;
  const expectedPriceKey = PADDLE_PRICE_ENV_KEYS[targetPlan] || 'NEXT_PUBLIC_PADDLE_PRICE_ID';
  if (!priceId || !priceId.startsWith('pri_')) {
    const msg = `Missing ${expectedPriceKey}: Paddle Price ID for ${targetPlan} is not configured.`;
    console.error('[Paddle]', msg, { plan: targetPlan });
    throw new Error(msg);
  }

  const token = getPaddleClientToken();
  const environment = getPaddleEnvironment();
  let paddle: Paddle | undefined;
  if (token && environment) {
    try {
      paddle = await getPaddleClient();
    } catch (initErr: any) {
      console.error('[Paddle] Failed to initialize Paddle client:', initErr);
      if (!checkoutData?.checkoutUrl?.startsWith('https://')) {
        throw new Error(initErr?.message || 'Failed to initialize Paddle Checkout.');
      }
    }
  }

  if (!paddle) {
    const hostedUrl = cleanEnvStr(checkoutData?.checkoutUrl || checkoutData?.url);
    if (hostedUrl && hostedUrl.startsWith('https://') && hostedUrl.includes('paddle.com')) {
      window.location.assign(hostedUrl);
      return;
    }
    const msg = !token
      ? 'Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN'
      : 'Missing NEXT_PUBLIC_PADDLE_ENVIRONMENT, set it to live in Vercel';
    console.warn(msg);
    throw new Error(msg);
  }

  try {
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(handlers.email ? { customer: { email: handlers.email } } : {}),
      customData: {
        purchase_type: 'plan',
        plan: targetPlan,
        ...(handlers.email ? { email: handlers.email, login_email: handlers.email } : {}),
      },
      settings: {
        displayMode: 'overlay',
        theme: 'dark',
        successUrl: getCheckoutSuccessUrl(),
      },
    });
  } catch (openErr: any) {
    console.error('[Paddle] Paddle.Checkout.open failed:', openErr);
    throw openErr;
  }
}

export async function openPaddleCreditPackCheckout(
  handlers: PaddleCreditCheckoutHandlers
): Promise<void> {
  activeHandlers = {
    purchaseType: 'credit_pack',
    packId: handlers.packId,
    email: handlers.email,
    userId: handlers.userId,
    refundAcceptedAt: handlers.refundAcceptedAt,
    onVerified: handlers.onVerified,
    onError: handlers.onError,
    onClose: handlers.onClose,
  };

  const localPriceId = getPaddleCreditPriceId(handlers.packId);
  const checkoutRes = await fetch('/api/app?action=checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      packId: handlers.packId,
      ...(localPriceId ? { priceId: localPriceId } : {}),
      email: handlers.email || '',
      userId: handlers.userId || 'guest',
      refundAcceptedAt: handlers.refundAcceptedAt || new Date().toISOString(),
    }),
  });

  const checkoutData: any = await checkoutRes.json().catch(() => null);
  if (!checkoutRes.ok || !checkoutData?.success) {
    const msg = checkoutData?.error || `Credit pack checkout failed (${checkoutRes.status}).`;
    console.error('[Paddle] /api/app?action=checkout credit error:', msg);
    throw new Error(msg);
  }

  const expectedKey = PADDLE_CREDIT_PACK_ENV_KEYS[handlers.packId];
  const priceId = cleanEnvStr(checkoutData?.priceId) || localPriceId;
  if (!priceId || !priceId.startsWith('pri_')) {
    const msg = `Missing ${expectedKey}: One-time Paddle Price ID for ${handlers.packId} is not configured.`;
    console.error('[Paddle]', msg, { packId: handlers.packId });
    throw new Error(msg);
  }

  const token = getPaddleClientToken();
  const environment = getPaddleEnvironment();
  let paddle: Paddle | undefined;
  if (token && environment) {
    try {
      paddle = await getPaddleClient();
    } catch (initErr: any) {
      console.error('[Paddle] Failed to initialize Paddle client for credit pack:', initErr);
      if (!checkoutData?.checkoutUrl?.startsWith('https://')) {
        throw new Error(initErr?.message || 'Failed to initialize Paddle Checkout.');
      }
    }
  }

  if (!paddle) {
    const hostedUrl = cleanEnvStr(checkoutData?.checkoutUrl || checkoutData?.url);
    if (hostedUrl && hostedUrl.startsWith('https://') && hostedUrl.includes('paddle.com')) {
      window.location.assign(hostedUrl);
      return;
    }
    const msg = !token
      ? 'Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN'
      : 'Missing NEXT_PUBLIC_PADDLE_ENVIRONMENT, set it to live in Vercel';
    console.warn(msg);
    throw new Error(msg);
  }

  try {
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(handlers.email ? { customer: { email: handlers.email } } : {}),
      customData: {
        purchase_type: 'credit_pack',
        packId: handlers.packId,
        credits: CREDIT_PACK_CREDITS[handlers.packId],
        ...(handlers.email ? { email: handlers.email, login_email: handlers.email } : {}),
      },
      settings: {
        displayMode: 'overlay',
        theme: 'dark',
        successUrl: getCheckoutSuccessUrl(),
      },
    });
  } catch (openErr: any) {
    console.error('[Paddle] Credit pack Checkout.open failed:', openErr);
    throw openErr;
  }
}
