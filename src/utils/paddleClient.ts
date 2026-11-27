import { initializePaddle, Paddle, PaddleEventData } from '@paddle/paddle-js';

export type PaidPlanId = 'starter' | 'pro' | 'enterprise' | 'institutional';
export type CreditPackId = 'pack_25' | 'pack_100' | 'pack_500';

export const CREDIT_PACK_CREDITS: Record<CreditPackId, number> = {
  pack_25: 25,
  pack_100: 100,
  pack_500: 500,
};

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

export interface ServerCheckoutSession {
  transactionId: string;
  checkoutUrl: string;
  environment: 'production' | 'sandbox';
  clientToken?: string;
  purchaseType: 'plan' | 'credit_pack';
}

export const PADDLE_PRO_SUCCESS_MESSAGE = 'Subscription activated! PRO plan is now active.';

let paddleInstancePromise: Promise<Paddle | undefined> | null = null;
let cachedPaddleInstance: Paddle | undefined;
let cachedEnvMode: 'production' | 'sandbox' | null = null;
let cachedTokenUsed: string | null = null;
let activeHandlers: PaddleCheckoutHandlers | null = null;
let activeTransactionId: string | null = null;
let isVerifyingTransaction = false;

export function getCreditPackDisabledTooltip(packId: CreditPackId): string {
  if (packId === 'pack_25') return 'Credits pack 25 coming soon - use +100 / +500';
  if (packId === 'pack_100') return 'Credits pack 100 coming soon - use +25 / +500';
  return 'Credits pack 500 coming soon - use +25 / +100';
}

export function formatPaddleDateMMDDYYYY(ms?: number | null): string {
  if (!ms || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function cleanEnvStr(val: unknown): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return s && s !== 'undefined' && s !== 'null' ? s : '';
}

export function getPaddleEnvironment(): 'production' | 'sandbox' {
  const metaEnv = cleanEnvStr(
    (import.meta.env &&
      (import.meta.env.VITE_PADDLE_ENVIRONMENT || import.meta.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT)) ||
      ''
  );
  let procEnv = '';
  try {
    procEnv = cleanEnvStr(
      process.env.VITE_PADDLE_ENVIRONMENT || process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT
    );
  } catch {}
  const configured = metaEnv || procEnv;
  if (!configured) {
    console.warn(
      'Missing VITE_PADDLE_ENVIRONMENT / NEXT_PUBLIC_PADDLE_ENVIRONMENT, defaulting to "live"'
    );
  }
  const normalized = (configured || 'live').trim().toLowerCase();
  return normalized === 'sandbox' ? 'sandbox' : 'production';
}

export function getPaddleClientToken(): string {
  const metaToken = cleanEnvStr(
    (import.meta.env &&
      (import.meta.env.VITE_PADDLE_CLIENT_TOKEN ||
        import.meta.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN)) ||
      ''
  );
  let procToken = '';
  try {
    procToken = cleanEnvStr(
      process.env.VITE_PADDLE_CLIENT_TOKEN || process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    );
  } catch {}
  return metaToken || procToken;
}

export const PADDLE_CHECKOUT_SUCCESS_URL = 'https://aqari-ai-rho.vercel.app/app?checkout=success';
export const PADDLE_DEFAULT_CHECKOUT_SETTINGS = {
  successUrl: PADDLE_CHECKOUT_SUCCESS_URL,
  displayMode: 'overlay' as const,
  theme: 'dark' as const,
  locale: 'en',
};
export const PADDLE_MISSING_SETTINGS_ERROR =
  'Checkout settings missing in Paddle, contact support loomorastudios@gmail.com';

export function formatPaddleCheckoutErrorMessage(
  raw: unknown,
  fallback = 'Paddle checkout encountered an error.'
): string {
  const serialized =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object'
      ? [
          (raw as any).code,
          (raw as any).error?.code,
          (raw as any).detail,
          (raw as any).error?.detail,
          (raw as any).message,
          JSON.stringify(raw),
        ]
          .filter(Boolean)
          .join(' ')
      : String(raw || '');
  const lower = serialized.toLowerCase();
  if (
    lower.includes('transaction_default_checkout_url_not_set') ||
    lower.includes('default checkout url') ||
    lower.includes('default payment link')
  ) {
    return PADDLE_MISSING_SETTINGS_ERROR;
  }
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object') {
    const detail =
      (raw as any).detail ||
      (raw as any).error?.detail ||
      (raw as any).message ||
      (raw as any).error?.message;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
  }
  return fallback;
}

export function getCheckoutSuccessUrl(transactionId?: string): string {
  const base = PADDLE_CHECKOUT_SUCCESS_URL;
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
    const detail = formatPaddleCheckoutErrorMessage(
      rawError,
      'Paddle checkout encountered an error.'
    );
    activeHandlers?.onError?.(detail);
    return;
  }

  if (event.name === 'checkout.completed') {
    if (isVerifyingTransaction) return;
    isVerifyingTransaction = true;
    const handlers = activeHandlers;
    const transactionId = String(event.data?.transaction_id || activeTransactionId || '').trim();
    const eventCustomData = ((event.data as any)?.custom_data || {}) as Record<string, any>;

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
        verifyData?.switched && verifyData?.message
          ? String(verifyData.message)
          : planKey === 'pro'
          ? PADDLE_PRO_SUCCESS_MESSAGE
          : verifyData?.message ||
            `One-time 30-day access activated! ${verifyData?.plan || planKey} plan is now active.`;

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

      handlers?.onVerified?.({ ...verifyData, message: successMsg }, meData);
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

export async function getPaddleClient(override?: {
  environment?: 'production' | 'sandbox';
  token?: string;
}): Promise<Paddle | undefined> {
  const token = cleanEnvStr(override?.token) || getPaddleClientToken();
  const environment = override?.environment || getPaddleEnvironment();

  if (cachedPaddleInstance && cachedEnvMode === environment && cachedTokenUsed === token) {
    return cachedPaddleInstance;
  }

  if (!token) {
    console.warn('Missing VITE_PADDLE_CLIENT_TOKEN / NEXT_PUBLIC_PADDLE_CLIENT_TOKEN');
    return undefined;
  }

  if (!paddleInstancePromise || cachedEnvMode !== environment || cachedTokenUsed !== token) {
    cachedEnvMode = environment;
    cachedTokenUsed = token;
    cachedPaddleInstance = undefined;
    paddleInstancePromise = initializePaddle({
      environment,
      token,
      eventCallback: handlePaddleEvent,
      checkout: {
        settings: {
          successUrl: PADDLE_CHECKOUT_SUCCESS_URL,
          displayMode: 'overlay',
          theme: 'dark',
          locale: 'en',
        },
      },
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
        throw new Error(formatPaddleCheckoutErrorMessage(err, 'Failed to initialize Paddle Checkout.'));
      });
  }

  return paddleInstancePromise;
}

/**
 * Creates a locked server-side Paddle transaction via /api/app?action=createCheckout.
 * The client sends ONLY the plan or packId; prices, IDs, and quantity=1 are strictly enforced on the server.
 */
export async function createServerCheckoutSession(payload: {
  plan?: PaidPlanId;
  packId?: CreditPackId;
  refundAcceptedAt?: string;
}): Promise<ServerCheckoutSession> {
  const res = await fetch('/api/app?action=createCheckout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      ...(payload.packId ? { packId: payload.packId } : { plan: payload.plan || 'pro' }),
      refundAcceptedAt: payload.refundAcceptedAt || new Date().toISOString(),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success || !data?.transactionId) {
    const errMsg = formatPaddleCheckoutErrorMessage(
      data?.error || data,
      `Unable to start checkout (HTTP ${res.status}).`
    );
    throw new Error(errMsg);
  }

  return {
    transactionId: String(data.transactionId),
    checkoutUrl: String(data.checkoutUrl || data.url || ''),
    environment: data.environment === 'sandbox' ? 'sandbox' : 'production',
    clientToken: data.clientToken ? String(data.clientToken) : undefined,
    purchaseType: data.purchaseType === 'credit_pack' ? 'credit_pack' : 'plan',
  };
}

async function openServerTransactionCheckout(session: ServerCheckoutSession): Promise<void> {
  activeTransactionId = session.transactionId;
  let paddle: Paddle | undefined;
  try {
    paddle = await getPaddleClient({
      environment: session.environment,
      token: session.clientToken,
    });
  } catch (err) {
    if (typeof window !== 'undefined' && session.checkoutUrl) {
      window.location.assign(session.checkoutUrl);
      return;
    }
    throw err;
  }

  if (!paddle) {
    if (typeof window !== 'undefined' && session.checkoutUrl) {
      window.location.assign(session.checkoutUrl);
      return;
    }
    throw new Error('Failed to initialize Paddle Checkout. Check VITE_PADDLE_CLIENT_TOKEN.');
  }

  try {
    paddle.Checkout.open({
      transactionId: session.transactionId,
      settings: {
        successUrl: getCheckoutSuccessUrl(session.transactionId),
        displayMode: 'overlay',
        theme: 'dark',
        locale: 'en',
      },
    });
  } catch (openErr: any) {
    console.error('[Paddle] Paddle.Checkout.open failed:', openErr);
    if (typeof window !== 'undefined' && session.checkoutUrl) {
      window.location.assign(session.checkoutUrl);
      return;
    }
    throw new Error(formatPaddleCheckoutErrorMessage(openErr, 'Unable to open Paddle Checkout.'));
  }
}

export async function openPaddleCheckout(handlers: PaddleCheckoutHandlers): Promise<void> {
  const targetPlan = handlers.plan || 'pro';
  activeHandlers = { ...handlers, plan: targetPlan, purchaseType: 'subscription' };

  const session = await createServerCheckoutSession({
    plan: targetPlan,
    refundAcceptedAt: handlers.refundAcceptedAt,
  });

  await openServerTransactionCheckout(session);
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

  const session = await createServerCheckoutSession({
    packId: handlers.packId,
    refundAcceptedAt: handlers.refundAcceptedAt,
  });

  await openServerTransactionCheckout(session);
}
