import { initializePaddle, Paddle, PaddleEventData } from '@paddle/paddle-js';

export type PaidPlanId = 'starter' | 'pro' | 'enterprise' | 'institutional';
export type CreditPackId = 'pack_25' | 'pack_100' | 'pack_500';

export const LIVE_PADDLE_PRICE_IDS: Record<'starter' | 'pro' | 'enterprise', string> = {
  starter: 'pri_01m7tgfvteegdih2mx4hgyz1c',
  pro: 'pri_01m7tggqhjtgk9fxmmg6mbp5wy',
  enterprise: 'pri_01m7tgj4pp767gacchp49k2qev',
};

export const PADDLE_PRICE_ENV_KEYS: Record<PaidPlanId, string> = {
  starter: 'VITE_PADDLE_STARTER_PRICE / NEXT_PUBLIC_PADDLE_STARTER_PRICE',
  pro: 'VITE_PADDLE_PRICE_ID / NEXT_PUBLIC_PADDLE_PRICE_ID',
  enterprise: 'VITE_PADDLE_SOVEREIGN_PRICE / NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE',
  institutional: 'VITE_PADDLE_ENTERPRISE_PRICE / NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE',
};

export const PADDLE_CREDIT_PACK_ENV_KEYS: Record<CreditPackId, string> = {
  pack_25: 'VITE_PADDLE_CREDIT_25_PRICE / NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE',
  pack_100: 'VITE_PADDLE_CREDIT_100_PRICE / NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE',
  pack_500: 'VITE_PADDLE_CREDIT_500_PRICE / NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE',
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
  priceId?: string;
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
let backendCreditPriceIds: Partial<Record<CreditPackId, string>> = {};

export function setBackendCreditPriceIds(
  ids?: { pack_25?: string | null; pack_100?: string | null; pack_500?: string | null } | null
): void {
  if (!ids || typeof ids !== 'object') return;
  const next: Partial<Record<CreditPackId, string>> = {};
  for (const key of ['pack_25', 'pack_100', 'pack_500'] as CreditPackId[]) {
    const val = typeof ids[key] === 'string' ? ids[key]!.trim() : '';
    if (val && val.startsWith('pri_') && val !== LEGACY_SANDBOX_PRICE_ID) {
      next[key] = val;
    }
  }
  backendCreditPriceIds = next;
}

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

function pickPriceId(candidates: string[], fallbackLiveId?: string): string {
  for (const raw of candidates) {
    const cleaned = cleanEnvStr(raw);
    if (cleaned && cleaned !== LEGACY_SANDBOX_PRICE_ID && cleaned.startsWith('pri_')) {
      return cleaned;
    }
  }
  return fallbackLiveId || '';
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

export function getPaddlePriceId(plan: PaidPlanId): string {
  const metaStarter = cleanEnvStr(
    (import.meta.env &&
      (import.meta.env.VITE_PADDLE_STARTER_PRICE ||
        import.meta.env.VITE_PADDLE_STARTER_PRICE_ID ||
        import.meta.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE ||
        import.meta.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID)) ||
      ''
  );
  const metaPro = cleanEnvStr(
    (import.meta.env &&
      (import.meta.env.VITE_PADDLE_PRICE_ID ||
        import.meta.env.VITE_PADDLE_PRO_PRICE ||
        import.meta.env.VITE_PADDLE_PRO_PRICE_ID ||
        import.meta.env.NEXT_PUBLIC_PADDLE_PRICE_ID ||
        import.meta.env.NEXT_PUBLIC_PADDLE_PRO_PRICE ||
        import.meta.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID)) ||
      ''
  );
  const metaSovereign = cleanEnvStr(
    (import.meta.env &&
      (import.meta.env.VITE_PADDLE_SOVEREIGN_PRICE ||
        import.meta.env.VITE_PADDLE_SOVEREIGN_PRICE_ID ||
        import.meta.env.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE ||
        import.meta.env.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID)) ||
      ''
  );
  const metaEnterprise = cleanEnvStr(
    (import.meta.env &&
      (import.meta.env.VITE_PADDLE_ENTERPRISE_PRICE ||
        import.meta.env.VITE_PADDLE_ENTERPRISE_PRICE_ID ||
        import.meta.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE ||
        import.meta.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE_ID)) ||
      ''
  );

  let procStarter = '';
  let procPro = '';
  let procSovereign = '';
  let procEnterprise = '';
  try {
    procStarter = cleanEnvStr(
      process.env.VITE_PADDLE_STARTER_PRICE ||
        process.env.VITE_PADDLE_STARTER_PRICE_ID ||
        process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE ||
        process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID
    );
  } catch {}
  try {
    procPro = cleanEnvStr(
      process.env.VITE_PADDLE_PRICE_ID ||
        process.env.VITE_PADDLE_PRO_PRICE ||
        process.env.VITE_PADDLE_PRO_PRICE_ID ||
        process.env.NEXT_PUBLIC_PADDLE_PRICE_ID ||
        process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE ||
        process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID
    );
  } catch {}
  try {
    procSovereign = cleanEnvStr(
      process.env.VITE_PADDLE_SOVEREIGN_PRICE ||
        process.env.VITE_PADDLE_SOVEREIGN_PRICE_ID ||
        process.env.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE ||
        process.env.NEXT_PUBLIC_PADDLE_SOVEREIGN_PRICE_ID
    );
  } catch {}
  try {
    procEnterprise = cleanEnvStr(
      process.env.VITE_PADDLE_ENTERPRISE_PRICE ||
        process.env.VITE_PADDLE_ENTERPRISE_PRICE_ID ||
        process.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE ||
        process.env.NEXT_PUBLIC_PADDLE_ENTERPRISE_PRICE_ID
    );
  } catch {}

  const env = getPaddleEnvironment();
  const liveFallback = env === 'production' ? LIVE_PADDLE_PRICE_IDS : undefined;

  if (plan === 'starter') {
    return pickPriceId([metaStarter, procStarter], liveFallback?.starter);
  }

  if (plan === 'enterprise') {
    return pickPriceId([metaSovereign, procSovereign], liveFallback?.enterprise);
  }

  if (plan === 'institutional') {
    return pickPriceId([metaEnterprise, procEnterprise]);
  }

  return pickPriceId([metaPro, procPro], liveFallback?.pro);
}

export function getPaddleProPriceId(): string {
  return getPaddlePriceId('pro');
}

export function getPaddleCreditPriceId(packId: CreditPackId): string {
  const envMeta = (import.meta.env || {}) as Record<string, any>;
  let envProc: Record<string, any> = {};
  try {
    envProc = (process.env || {}) as Record<string, any>;
  } catch {}

  const readEnv = (key: string): string => cleanEnvStr(envMeta[key] || envProc[key]);

  if (packId === 'pack_25') {
    const resolved = pickPriceId([
      readEnv('VITE_PADDLE_CREDIT_25_PRICE'),
      readEnv('NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE'),
      readEnv('VITE_PADDLE_CREDIT_25'),
      readEnv('NEXT_PUBLIC_PADDLE_CREDIT_25'),
      readEnv('VITE_PADDLE_CREDIT_25_PRICE_ID'),
      readEnv('NEXT_PUBLIC_PADDLE_CREDIT_25_PRICE_ID'),
      readEnv('PADDLE_CREDIT_25_PRICE'),
      readEnv('PADDLE_CREDIT_25'),
    ]);
    return resolved || backendCreditPriceIds.pack_25 || '';
  }

  if (packId === 'pack_100') {
    const resolved = pickPriceId([
      readEnv('VITE_PADDLE_CREDIT_100_PRICE'),
      readEnv('NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE'),
      readEnv('VITE_PADDLE_CREDIT_100'),
      readEnv('NEXT_PUBLIC_PADDLE_CREDIT_100'),
      readEnv('VITE_PADDLE_CREDIT_100_PRICE_ID'),
      readEnv('NEXT_PUBLIC_PADDLE_CREDIT_100_PRICE_ID'),
      readEnv('PADDLE_CREDIT_100_PRICE'),
      readEnv('PADDLE_CREDIT_100'),
    ]);
    return resolved || backendCreditPriceIds.pack_100 || '';
  }

  const resolved = pickPriceId([
    readEnv('VITE_PADDLE_CREDIT_500_PRICE'),
    readEnv('NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE'),
    readEnv('VITE_PADDLE_CREDIT_500'),
    readEnv('NEXT_PUBLIC_PADDLE_CREDIT_500'),
    readEnv('VITE_PADDLE_CREDIT_500_PRICE_ID'),
    readEnv('NEXT_PUBLIC_PADDLE_CREDIT_500_PRICE_ID'),
    readEnv('PADDLE_CREDIT_500_PRICE'),
    readEnv('PADDLE_CREDIT_500'),
  ]);
  return resolved || backendCreditPriceIds.pack_500 || '';
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

  if (
    event.name === 'checkout.loaded' ||
    event.name === 'checkout.items.updated' ||
    event.name === 'checkout.updated'
  ) {
    const lockedPriceId = activeHandlers?.priceId;
    const eventItems = Array.isArray((event.data as any)?.items) ? (event.data as any).items : [];
    const needsClamp =
      Boolean(lockedPriceId) &&
      (eventItems.length > 1 ||
        eventItems.some(
          (item: any) => Number(item?.quantity ?? 1) !== 1 || item?.price_id !== lockedPriceId
        ));
    if (needsClamp && lockedPriceId && cachedPaddleInstance?.Checkout?.updateItems) {
      try {
        cachedPaddleInstance.Checkout.updateItems([{ priceId: lockedPriceId, quantity: 1 }]);
      } catch {}
    }
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
    console.warn('Missing VITE_PADDLE_CLIENT_TOKEN / NEXT_PUBLIC_PADDLE_CLIENT_TOKEN');
    return undefined;
  }

  const environment = getPaddleEnvironment();

  if (!paddleInstancePromise) {
    paddleInstancePromise = initializePaddle({
      environment,
      token,
      eventCallback: handlePaddleEvent,
      checkout: {
        settings: {
          successUrl: 'https://aqari-ai-rho.vercel.app/app?checkout=success',
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

export async function openPaddleCheckout(handlers: PaddleCheckoutHandlers): Promise<void> {
  const targetPlan = handlers.plan || 'pro';
  const environment = getPaddleEnvironment();
  const token = getPaddleClientToken();
  if (!token) {
    const msg = 'Missing Paddle client token (VITE_PADDLE_CLIENT_TOKEN / NEXT_PUBLIC_PADDLE_CLIENT_TOKEN).';
    console.warn(msg);
    throw new Error(msg);
  }
  if (environment === 'production' && token.startsWith('test_')) {
    const msg = 'Sandbox client token is not allowed in live mode.';
    console.warn('[Paddle]', msg);
    throw new Error(msg);
  }

  const priceId = getPaddlePriceId(targetPlan);
  const expectedPriceKey = PADDLE_PRICE_ENV_KEYS[targetPlan] || 'VITE_PADDLE_PRICE_ID / NEXT_PUBLIC_PADDLE_PRICE_ID';
  if (!priceId || !priceId.startsWith('pri_') || priceId === LEGACY_SANDBOX_PRICE_ID) {
    const msg = `Missing ${expectedPriceKey}: Paddle Price ID for ${targetPlan} is not configured.`;
    console.warn('[Paddle]', msg, { plan: targetPlan });
    throw new Error(msg);
  }

  activeHandlers = { ...handlers, plan: targetPlan, purchaseType: 'subscription', priceId };

  // Server-enforced entitlement check (Rule A: block buying same active plan before expiry)
  if (typeof fetch === 'function') {
    let blockedError = '';
    try {
      const precheckRes = await fetch('/api/app?action=checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'record',
          plan: targetPlan,
          priceId,
          email: handlers.email || '',
          userId: handlers.userId || 'guest',
          refundAcceptedAt: handlers.refundAcceptedAt || new Date().toISOString(),
        }),
      });
      const precheckData = await precheckRes.json().catch(() => null);
      if (precheckRes && !precheckRes.ok && (precheckRes.status === 409 || precheckRes.status === 403 || precheckData?.code === 'SAME_PLAN_ACTIVE')) {
        blockedError = String(
          precheckData?.error || 'You already own this plan until expiry. You can buy a different plan to switch.'
        );
      }
    } catch {
      // Allow Paddle.js checkout if precheck network request cannot complete offline
    }
    if (blockedError) {
      throw new Error(blockedError);
    }
  }

  let paddle: Paddle | undefined;
  try {
    paddle = await getPaddleClient();
  } catch (initErr: any) {
    console.error('[Paddle] Failed to initialize Paddle client:', initErr);
    throw new Error(initErr?.message || 'Failed to initialize Paddle Checkout.');
  }

  if (!paddle) {
    const msg = 'Failed to initialize Paddle Checkout. Check VITE_PADDLE_CLIENT_TOKEN / NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.';
    console.warn('[Paddle]', msg);
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
        successUrl: 'https://aqari-ai-rho.vercel.app/app?checkout=success',
        displayMode: 'overlay',
        theme: 'dark',
        locale: 'en',
      },
    });
  } catch (openErr: any) {
    console.error('[Paddle] Paddle.Checkout.open failed:', openErr);
    throw new Error(formatPaddleCheckoutErrorMessage(openErr, 'Unable to open Paddle Checkout.'));
  }
}

export async function openPaddleCreditPackCheckout(
  handlers: PaddleCreditCheckoutHandlers
): Promise<void> {
  const environment = getPaddleEnvironment();
  const token = getPaddleClientToken();
  if (!token) {
    const msg = 'Missing Paddle client token (VITE_PADDLE_CLIENT_TOKEN / NEXT_PUBLIC_PADDLE_CLIENT_TOKEN).';
    console.warn(msg);
    throw new Error(msg);
  }
  if (environment === 'production' && token.startsWith('test_')) {
    const msg = 'Sandbox client token is not allowed in live mode.';
    console.warn('[Paddle]', msg);
    throw new Error(msg);
  }

  const priceId = getPaddleCreditPriceId(handlers.packId);
  if (!priceId || !priceId.startsWith('pri_') || priceId === LEGACY_SANDBOX_PRICE_ID) {
    console.warn('[Paddle] Credit pack Price ID unavailable:', {
      packId: handlers.packId,
      tooltip: getCreditPackDisabledTooltip(handlers.packId),
    });
    handlers.onClose?.();
    return;
  }

  activeHandlers = {
    purchaseType: 'credit_pack',
    packId: handlers.packId,
    priceId,
    email: handlers.email,
    userId: handlers.userId,
    refundAcceptedAt: handlers.refundAcceptedAt,
    onVerified: handlers.onVerified,
    onError: handlers.onError,
    onClose: handlers.onClose,
  };

  let paddle: Paddle | undefined;
  try {
    paddle = await getPaddleClient();
  } catch (initErr: any) {
    console.error('[Paddle] Failed to initialize Paddle client for credit pack:', initErr);
    throw new Error(initErr?.message || 'Failed to initialize Paddle Checkout.');
  }

  if (!paddle) {
    const msg = 'Failed to initialize Paddle Checkout. Check VITE_PADDLE_CLIENT_TOKEN / NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.';
    console.warn('[Paddle]', msg);
    throw new Error(msg);
  }

  if (typeof fetch === 'function') {
    fetch('/api/app?action=checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        mode: 'record',
        packId: handlers.packId,
        priceId,
        email: handlers.email || '',
        userId: handlers.userId || 'guest',
        refundAcceptedAt: handlers.refundAcceptedAt || new Date().toISOString(),
      }),
    }).catch(() => {});
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
        successUrl: 'https://aqari-ai-rho.vercel.app/app?checkout=success',
        displayMode: 'overlay',
        theme: 'dark',
        locale: 'en',
      },
    });
  } catch (openErr: any) {
    console.error('[Paddle] Credit pack Checkout.open failed:', openErr);
    throw new Error(formatPaddleCheckoutErrorMessage(openErr, 'Unable to open Paddle Checkout.'));
  }
}
