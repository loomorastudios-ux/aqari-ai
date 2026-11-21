import { initializePaddle, Paddle, PaddleEventData } from '@paddle/paddle-js';

export type PaidPlanId = 'starter' | 'pro' | 'enterprise';
export type CreditPackId = 'pack_25' | 'pack_100' | 'pack_500';

export const LIVE_PADDLE_PRICE_IDS: Record<PaidPlanId, string> = {
  starter: 'pri_01m7tgfvteegdih2mx4hgyz1c',
  pro: 'pri_01m7tggqhjtgk9fxmmg6mbp5wy',
  enterprise: 'pri_01m7tgj4pp767gacchp49k2qev',
};

export const PADDLE_PRICE_ENV_KEYS: Record<PaidPlanId, string> = {
  starter: 'VITE_PADDLE_STARTER_PRICE',
  pro: 'VITE_PADDLE_PRICE_ID',
  enterprise: 'VITE_PADDLE_SOVEREIGN_PRICE',
};

export const PADDLE_CREDIT_PACK_ENV_KEYS: Record<CreditPackId, string> = {
  pack_25: 'VITE_PADDLE_CREDIT_25_PRICE',
  pack_100: 'VITE_PADDLE_CREDIT_100_PRICE',
  pack_500: 'VITE_PADDLE_CREDIT_500_PRICE',
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

export const PADDLE_PRO_SUCCESS_MESSAGE = 'تم الاشتراك بنجاح! تم تفعيل باقة Pro';

let paddleInstancePromise: Promise<Paddle | undefined> | null = null;
let cachedPaddleInstance: Paddle | undefined;
let activeHandlers: PaddleCheckoutHandlers | null = null;
let isVerifyingTransaction = false;

function cleanEnvStr(val: unknown): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return s && s !== 'undefined' && s !== 'null' ? s : '';
}

function pickLivePriceId(candidates: string[], fallbackLiveId: string): string {
  for (const raw of candidates) {
    const cleaned = cleanEnvStr(raw);
    if (cleaned && cleaned !== LEGACY_SANDBOX_PRICE_ID && cleaned.startsWith('pri_')) {
      return cleaned;
    }
  }
  return fallbackLiveId;
}

export function getPaddleEnvironment(): 'production' {
  return 'production';
}

export function getPaddleClientToken(): string {
  const viteClientToken = cleanEnvStr(import.meta.env?.VITE_PADDLE_CLIENT_TOKEN);
  const viteNextToken = cleanEnvStr(import.meta.env?.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
  let procViteToken = '';
  let procNextToken = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      procViteToken = cleanEnvStr(process.env.VITE_PADDLE_CLIENT_TOKEN);
      procNextToken = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN);
    }
  } catch {}
  return viteClientToken || procViteToken || viteNextToken || procNextToken;
}

export function getPaddlePriceId(plan: PaidPlanId): string {
  let procStarter = '';
  let procStarterAlt = '';
  let procPro = '';
  let procProAlt = '';
  let procSovereign = '';
  let procSovereignAlt = '';
  let procNextStarter = '';
  let procNextPro = '';
  let procNextSovereign = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      procStarter = cleanEnvStr(process.env.VITE_PADDLE_STARTER_PRICE);
      procStarterAlt = cleanEnvStr(process.env.VITE_PADDLE_STARTER_PRICE_ID);
      procPro = cleanEnvStr(process.env.VITE_PADDLE_PRICE_ID);
      procProAlt = cleanEnvStr(process.env.VITE_PADDLE_PRO_PRICE_ID);
      procSovereign = cleanEnvStr(process.env.VITE_PADDLE_SOVEREIGN_PRICE);
      procSovereignAlt = cleanEnvStr(process.env.VITE_PADDLE_SOVEREIGN_PRICE_ID);
      procNextStarter = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID);
      procNextPro = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_PRICE_ID);
      procNextSovereign = cleanEnvStr(process.env.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID);
    }
  } catch {}

  if (plan === 'starter') {
    return pickLivePriceId(
      [
        cleanEnvStr(import.meta.env?.VITE_PADDLE_STARTER_PRICE),
        cleanEnvStr(import.meta.env?.VITE_PADDLE_STARTER_PRICE_ID),
        procStarter,
        procStarterAlt,
        cleanEnvStr(import.meta.env?.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID),
        procNextStarter,
      ],
      LIVE_PADDLE_PRICE_IDS.starter
    );
  }

  if (plan === 'enterprise') {
    return pickLivePriceId(
      [
        cleanEnvStr(import.meta.env?.VITE_PADDLE_SOVEREIGN_PRICE),
        cleanEnvStr(import.meta.env?.VITE_PADDLE_SOVEREIGN_PRICE_ID),
        procSovereign,
        procSovereignAlt,
        cleanEnvStr(import.meta.env?.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID),
        procNextSovereign,
      ],
      LIVE_PADDLE_PRICE_IDS.enterprise
    );
  }

  return pickLivePriceId(
    [
      cleanEnvStr(import.meta.env?.VITE_PADDLE_PRICE_ID),
      cleanEnvStr(import.meta.env?.VITE_PADDLE_PRO_PRICE_ID),
      procPro,
      procProAlt,
      cleanEnvStr(import.meta.env?.NEXT_PUBLIC_PADDLE_PRICE_ID),
      procNextPro,
    ],
    LIVE_PADDLE_PRICE_IDS.pro
  );
}

export function getPaddleProPriceId(): string {
  return getPaddlePriceId('pro');
}

export function getPaddleCreditPriceId(packId: CreditPackId): string {
  let proc25 = '';
  let proc100 = '';
  let proc500 = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      proc25 = cleanEnvStr(process.env.VITE_PADDLE_CREDIT_25_PRICE);
      proc100 = cleanEnvStr(process.env.VITE_PADDLE_CREDIT_100_PRICE);
      proc500 = cleanEnvStr(process.env.VITE_PADDLE_CREDIT_500_PRICE);
    }
  } catch {}

  const candidates =
    packId === 'pack_25'
      ? [cleanEnvStr(import.meta.env?.VITE_PADDLE_CREDIT_25_PRICE), proc25]
      : packId === 'pack_100'
      ? [cleanEnvStr(import.meta.env?.VITE_PADDLE_CREDIT_100_PRICE), proc100]
      : [cleanEnvStr(import.meta.env?.VITE_PADDLE_CREDIT_500_PRICE), proc500];

  for (const raw of candidates) {
    const cleaned = cleanEnvStr(raw);
    if (cleaned && cleaned !== LEGACY_SANDBOX_PRICE_ID && cleaned.startsWith('pri_')) {
      return cleaned;
    }
  }
  return '';
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
          : verifyData?.message || `تم الاشتراك بنجاح! تم تفعيل باقة ${verifyData?.plan || planKey}`;

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
    console.error('[Paddle] Missing VITE_PADDLE_CLIENT_TOKEN');
    return undefined;
  }

  const environment = getPaddleEnvironment();

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

  const token = getPaddleClientToken();
  if (!token) {
    const msg = 'Missing VITE_PADDLE_CLIENT_TOKEN';
    console.error('[Paddle]', msg);
    throw new Error(msg);
  }

  const expectedPriceKey = PADDLE_PRICE_ENV_KEYS[targetPlan] || 'VITE_PADDLE_PRICE_ID';
  const priceId = getPaddlePriceId(targetPlan);
  if (!priceId || !priceId.startsWith('pri_')) {
    const msg = `Missing ${expectedPriceKey}: Paddle Price ID for ${targetPlan} is not configured.`;
    console.error('[Paddle]', msg, { plan: targetPlan, priceId });
    throw new Error(msg);
  }

  let paddle: Paddle | undefined;
  try {
    paddle = await getPaddleClient();
  } catch (initErr: any) {
    console.error('[Paddle] Failed to initialize Paddle client:', initErr);
    throw new Error(initErr?.message || 'Failed to initialize Paddle Checkout.');
  }

  if (!paddle) {
    const msg = 'Missing VITE_PADDLE_CLIENT_TOKEN or Paddle failed to initialize.';
    console.error('[Paddle]', msg);
    throw new Error(msg);
  }

  fetch('/api/app?action=checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      plan: targetPlan,
      email: handlers.email || '',
      userId: handlers.userId || 'guest',
      refundAcceptedAt: handlers.refundAcceptedAt || new Date().toISOString(),
    }),
  }).catch((err) => {
    console.warn('[Paddle] Background checkout pre-log warning:', err);
  });

  try {
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(handlers.email ? { customer: { email: handlers.email } } : {}),
      customData: {
        plan: targetPlan,
        ...(handlers.email ? { email: handlers.email, login_email: handlers.email } : {}),
      },
      settings: {
        displayMode: 'overlay',
        theme: 'dark',
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

  const token = getPaddleClientToken();
  if (!token) {
    const msg = 'Missing VITE_PADDLE_CLIENT_TOKEN';
    console.error('[Paddle]', msg);
    throw new Error(msg);
  }

  const expectedKey = PADDLE_CREDIT_PACK_ENV_KEYS[handlers.packId];
  const priceId = getPaddleCreditPriceId(handlers.packId);
  if (!priceId || !priceId.startsWith('pri_')) {
    const msg = `Missing ${expectedKey}: One-time Paddle Price ID for ${handlers.packId} is not configured.`;
    console.error('[Paddle]', msg, { packId: handlers.packId });
    throw new Error(msg);
  }

  const paddle = await getPaddleClient();
  if (!paddle) {
    const msg = 'Missing VITE_PADDLE_CLIENT_TOKEN or Paddle failed to initialize.';
    console.error('[Paddle]', msg);
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
      },
    });
  } catch (openErr: any) {
    console.error('[Paddle] Credit pack Checkout.open failed:', openErr);
    throw openErr;
  }
}
