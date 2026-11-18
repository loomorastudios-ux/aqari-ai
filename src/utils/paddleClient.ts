import { initializePaddle, Paddle, PaddleEventData } from '@paddle/paddle-js';

declare const process: {
  env: Record<string, string | undefined>;
};

export type PaidPlanId = 'starter' | 'pro' | 'enterprise';

export interface PaddleCheckoutHandlers {
  plan: PaidPlanId;
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

function readClientEnv(key: string): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return String(process.env[key]).trim();
    }
  } catch {}
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv && metaEnv[key]) {
      return String(metaEnv[key]).trim();
    }
  } catch {}
  return '';
}

export function getPaddleClientToken(): string {
  return (
    readClientEnv('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN') ||
    readClientEnv('VITE_PADDLE_CLIENT_TOKEN')
  );
}

export function getPaddleProPriceId(): string {
  return (
    readClientEnv('NEXT_PUBLIC_PADDLE_PRICE_ID') ||
    readClientEnv('VITE_PADDLE_PRICE_ID')
  );
}

async function handlePaddleEvent(event: PaddleEventData) {
  if (!event || !event.name) return;

  if (event.name === 'checkout.closed') {
    activeHandlers?.onClose?.();
    return;
  }

  if (event.name === 'checkout.error' || event.name === 'checkout.failed') {
    const detail = (event as any)?.detail || (event as any)?.error?.detail || 'Paddle checkout encountered an error.';
    activeHandlers?.onError?.(String(detail));
    return;
  }

  if (event.name === 'checkout.completed') {
    if (isVerifyingTransaction) return;
    isVerifyingTransaction = true;
    const handlers = activeHandlers;
    const transactionId = String(event.data?.transaction_id || '').trim();
    const customerEmail = String(
      handlers?.email || event.data?.customer?.email || ''
    )
      .trim()
      .toLowerCase();

    try {
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
        handlers?.onError?.(
          verifyData?.error || 'Unable to verify Paddle payment with server.'
        );
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
      handlers?.onError?.(err?.message || 'Payment verification request failed.');
    } finally {
      isVerifyingTransaction = false;
    }
  }
}

export async function getPaddleClient(): Promise<Paddle | undefined> {
  if (cachedPaddleInstance) return cachedPaddleInstance;

  const token = getPaddleClientToken();
  if (!token) return undefined;

  if (!paddleInstancePromise) {
    paddleInstancePromise = initializePaddle({
      environment: 'sandbox',
      token,
      eventCallback: handlePaddleEvent,
    }).then((paddle) => {
      cachedPaddleInstance = paddle;
      return paddle;
    });
  }

  return paddleInstancePromise;
}

export async function openPaddleCheckout(handlers: PaddleCheckoutHandlers): Promise<void> {
  activeHandlers = handlers;

  let serverPriceId = '';
  try {
    const checkoutRes = await fetch('/api/app?action=checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        plan: handlers.plan,
        email: handlers.email || '',
        userId: handlers.userId || 'guest',
        refundAcceptedAt: handlers.refundAcceptedAt || new Date().toISOString(),
      }),
    });
    if (checkoutRes.ok) {
      const checkoutJson = await checkoutRes.json().catch(() => null);
      if (checkoutJson?.priceId) {
        serverPriceId = String(checkoutJson.priceId).trim();
      }
    }
  } catch {
    // Continue using client env config if checkout log call fails
  }

  const priceId =
    (handlers.plan === 'pro'
      ? getPaddleProPriceId()
      : handlers.plan === 'starter'
      ? readClientEnv('NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID')
      : readClientEnv('NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID')) || serverPriceId || getPaddleProPriceId();

  if (!priceId) {
    throw new Error('Paddle Price ID (NEXT_PUBLIC_PADDLE_PRICE_ID) is not configured.');
  }

  const paddle = await getPaddleClient();
  if (!paddle) {
    throw new Error('Paddle Client Token (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) is not configured.');
  }

  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(handlers.email ? { customer: { email: handlers.email } } : {}),
    customData: {
      plan: handlers.plan,
      ...(handlers.email ? { email: handlers.email, login_email: handlers.email } : {}),
    },
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
    },
  });
}
