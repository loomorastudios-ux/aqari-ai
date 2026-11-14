// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'loomora.studios@gmail.com').trim().toLowerCase();
const OWNER_ADMIN_EMAILS = new Set([
  ADMIN_EMAIL,
  'loomora.studios@gmail.com',
  'loomorastudios@gmail.com',
]);
export const SESSION_COOKIE_NAME = 'aqari_session';
export const ENTITLEMENT_COOKIE_NAME = 'aqari_entitlement';

export function cleanEnvValue(value?: string | null): string {
  return (value || '').replace(/^["']|["']$/g, '').trim();
}

function getSessionSecret(): string {
  return (
    cleanEnvValue(process.env.SESSION_SECRET) ||
    cleanEnvValue(process.env.NEXTAUTH_SECRET) ||
    cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET) ||
    'aqari-terminal-sovereign-hmac-2026'
  );
}

export interface SignedEntitlementPayload {
  email: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  orderId: string;
  licenseStart: number;
  licenseEnd: number;
  amountUSD: number;
  testMode: boolean;
  lemonCustomerEmail?: string | null;
  exp: number;
}

export function signEntitlementToken(data: Omit<SignedEntitlementPayload, 'exp'>): string {
  const payloadObj: SignedEntitlementPayload = {
    ...data,
    email: (data.email || '').trim().toLowerCase(),
    exp: Math.max(data.licenseEnd, Date.now() + 24 * 60 * 60 * 1000),
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyEntitlementToken(token?: string | null): SignedEntitlementPayload | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const expected = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedEntitlementPayload;
    if (!decoded?.email || !decoded?.plan || (decoded.exp && Date.now() > decoded.exp)) {
      return null;
    }
    return {
      ...decoded,
      email: String(decoded.email).trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function getEntitlementFromReq(req: any): SignedEntitlementPayload | null {
  const cookies = parseCookies(req?.headers?.cookie || '');
  return verifyEntitlementToken(cookies[ENTITLEMENT_COOKIE_NAME]);
}

function appendSetCookieHeader(res: any, cookieStr: string): void {
  const prev = res.getHeader?.('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', cookieStr);
    return;
  }
  const arr = Array.isArray(prev) ? prev.map(String) : [String(prev)];
  const cookieName = cookieStr.split('=')[0] + '=';
  const filtered = arr.filter((c) => !c.startsWith(cookieName));
  filtered.push(cookieStr);
  res.setHeader('Set-Cookie', filtered);
}

export function isAdminEmail(email?: string | null): boolean {
  const norm = (email || '').trim().toLowerCase();
  return Boolean(norm && OWNER_ADMIN_EMAILS.has(norm));
}

export function signSessionToken(email: string): string {
  const norm = (email || '').trim().toLowerCase();
  const payload = Buffer.from(
    JSON.stringify({
      email: norm,
      iat: Date.now(),
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string | null): string | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const expected = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded?.email || (decoded.exp && Date.now() > decoded.exp)) {
      return null;
    }
    return String(decoded.email).trim().toLowerCase();
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

export function getSessionEmailFromReq(req: any): string | null {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  const fromCookie = verifySessionToken(cookieToken);
  if (fromCookie) return fromCookie;

  const authHeader = req?.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const bearerEmail = verifySessionToken(authHeader.slice(7).trim());
    if (bearerEmail) return bearerEmail;
  }
  return null;
}

export function setSessionCookie(res: any, email: string): string {
  const token = signSessionToken(email);
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const flags = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
    ...(isProd ? ['Secure'] : []),
  ];
  appendSetCookieHeader(res, flags.join('; '));
  return token;
}

export function setEntitlementCookie(res: any, data: Omit<SignedEntitlementPayload, 'exp'>): string {
  const token = signEntitlementToken(data);
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const flags = [
    `${ENTITLEMENT_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
    ...(isProd ? ['Secure'] : []),
  ];
  appendSetCookieHeader(res, flags.join('; '));
  return token;
}

export function clearSessionCookie(res: any): void {
  const flags = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  appendSetCookieHeader(res, flags.join('; '));
  appendSetCookieHeader(res, `${ENTITLEMENT_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export const PENDING_CODES_COOKIE_NAME = 'aqari_pending_codes';
export const USED_CODES_COOKIE_NAME = 'aqari_used_codes';

export interface SignedPendingCodeEntry {
  code: string;
  payment_email: string;
  order_id: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  plan_display: 'STARTER' | 'PROFESSIONAL' | 'SOVEREIGN';
  analyses: number;
  amount: number;
  test_mode: boolean;
  created_at: number;
  expires_at: number;
}

function signCookieJson(obj: unknown): string {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyCookieJson<T>(token?: string | null): T | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const expected = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function getPendingCodesFromReq(req: any): SignedPendingCodeEntry[] {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const raw = verifyCookieJson<{ items?: SignedPendingCodeEntry[] }>(cookies[PENDING_CODES_COOKIE_NAME]);
  if (!raw || !Array.isArray(raw.items)) return [];
  const now = Date.now();
  return raw.items.filter((item) => item?.code && Number(item.expires_at || 0) > now);
}

export function appendPendingCodeCookie(req: any, res: any, entry: SignedPendingCodeEntry): void {
  try {
    const existing = getPendingCodesFromReq(req).filter((item) => item?.code !== entry.code);
    const items = [entry, ...existing].slice(0, 10);
    const token = signCookieJson({ items });
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    const flags = [
      `${PENDING_CODES_COOKIE_NAME}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${24 * 60 * 60}`,
      ...(isProd ? ['Secure'] : []),
    ];
    appendSetCookieHeader(res, flags.join('; '));
  } catch (err) {
    console.warn('[Security] Failed setting pending codes cookie:', err);
  }
}

export function getUsedCodesFromReq(req: any): string[] {
  const cookies = parseCookies(req?.headers?.cookie || '');
  const raw = verifyCookieJson<{ codes?: string[] }>(cookies[USED_CODES_COOKIE_NAME]);
  if (!raw || !Array.isArray(raw.codes)) return [];
  return raw.codes.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean);
}

export function appendUsedCodeCookie(req: any, res: any, code: string): void {
  const norm = String(code || '').trim().toUpperCase();
  const existing = getUsedCodesFromReq(req).filter((c) => c !== norm);
  const codes = [norm, ...existing].slice(0, 20);
  const token = signCookieJson({ codes });
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const flags = [
    `${USED_CODES_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${7 * 24 * 60 * 60}`,
    ...(isProd ? ['Secure'] : []),
  ];
  appendSetCookieHeader(res, flags.join('; '));
}

// Sliding window rate limiter
const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (rateBuckets.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateBuckets.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - timestamps.length),
    retryAfterSec: 0,
  };
}

export function getClientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || '127.0.0.1';
}
