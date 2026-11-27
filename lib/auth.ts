// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import crypto from 'crypto';
import {
  ServerSessionRecord,
  saveSessionToDb,
  getSessionFromDb,
  deleteSessionFromDb,
} from './serverStore';

export const SESSION_COOKIE_NAME = 'aqari_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_ALLOWED_ORIGIN = 'https://admin-aqari2.vercel.app';

export function isAdminRequestOrigin(req: any): boolean {
  const origin = String(req?.headers?.origin || req?.headers?.Origin || '').trim();
  return origin === ADMIN_ALLOWED_ORIGIN;
}

export function applyAdminOnlyCors(req: any, res: any): void {
  res?.setHeader?.('X-Content-Type-Options', 'nosniff');
  res?.setHeader?.('Vary', 'Origin');

  const origin = String(req?.headers?.origin || req?.headers?.Origin || '').trim();
  if (!origin || origin === ADMIN_ALLOWED_ORIGIN) {
    res?.setHeader?.('Access-Control-Allow-Origin', ADMIN_ALLOWED_ORIGIN);
    res?.setHeader?.('Access-Control-Allow-Credentials', 'true');
    res?.setHeader?.('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res?.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

export type AuthSessionUser = ServerSessionRecord;

export interface VerifiedGoogleClaims {
  email: string;
  name?: string;
  picture?: string;
  sub: string;
  email_verified: boolean;
}

export type AdminGuardResult =
  | { ok: true; user: AuthSessionUser }
  | { ok: false; status: 401 | 403 | 500; error: string; code: string };

function cleanEnvValue(value?: string | null): string {
  return (value || '').replace(/^["']|["']$/g, '').trim();
}

function getEnv(key: string): string {
  try {
    return typeof process !== 'undefined' && process?.env ? cleanEnvValue(process.env[key]) : '';
  } catch {
    return '';
  }
}

export function isProductionDeployment(): boolean {
  return getEnv('VERCEL_ENV') === 'production';
}

export function isStrictSecretRuntime(): boolean {
  return getEnv('NODE_ENV') === 'production' || getEnv('VERCEL_ENV') === 'production';
}

function getSessionSecret(): string | null {
  const secret = getEnv('SESSION_SECRET') || getEnv('NEXTAUTH_SECRET');
  if (!secret || secret.length < 16) {
    return null;
  }
  return secret;
}

export function getConfiguredAdminEmail(): string {
  const raw = getEnv('ADMIN_EMAIL').toLowerCase();
  if (!raw || !raw.includes('@')) return '';
  return raw;
}

function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
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

function appendSetCookieHeader(res: any, cookieStr: string): void {
  if (!res?.setHeader) return;
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

// Cached Google OIDC public JWKS keys
let cachedGoogleJwks: { keys: any[]; expiresAt: number } | null = null;

async function fetchGoogleJwks(forceRefresh = false): Promise<any[]> {
  if (!forceRefresh && cachedGoogleJwks && cachedGoogleJwks.expiresAt > Date.now()) {
    return cachedGoogleJwks.keys;
  }
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) {
    throw new Error(`Failed to fetch Google JWKS (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { keys?: any[] };
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Math.min(3600, Math.max(60, Number(maxAgeMatch[1]))) * 1000 : 300_000;
  cachedGoogleJwks = { keys, expiresAt: Date.now() + ttlMs };
  return keys;
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleClaims> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Google ID token');
  }
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Google ID token');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header: any;
  let payload: any;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid Google ID token encoding');
  }

  if (header?.alg !== 'RS256' || !header?.kid) {
    throw new Error('Unsupported Google ID token algorithm or missing kid');
  }

  let keys = await fetchGoogleJwks(false);
  let jwk = keys.find((k) => k?.kid === header.kid && k?.kty === 'RSA');
  if (!jwk) {
    keys = await fetchGoogleJwks(true);
    jwk = keys.find((k) => k?.kid === header.kid && k?.kty === 'RSA');
  }
  if (!jwk) {
    throw new Error('Google ID token signing key not found');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8');
  const signature = Buffer.from(encodedSignature, 'base64url');
  const verified = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
  if (!verified) {
    throw new Error('Invalid Google ID token signature');
  }

  const allowedAudiences = [
    getEnv('GOOGLE_CLIENT_ID'),
    getEnv('VITE_GOOGLE_CLIENT_ID'),
    getEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID'),
  ].filter(Boolean);

  if (allowedAudiences.length === 0) {
    throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
  }

  const aud = String(payload?.aud || '');
  if (!allowedAudiences.includes(aud)) {
    throw new Error('Google ID token audience mismatch');
  }

  const iss = String(payload?.iss || '');
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw new Error('Google ID token issuer mismatch');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = Number(payload?.exp || 0);
  if (!Number.isFinite(exp) || exp + 60 < nowSec) {
    throw new Error('Google ID token expired');
  }

  const email = String(payload?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Google ID token missing valid email');
  }
  if (payload?.email_verified !== true) {
    throw new Error('Google account email is not verified');
  }

  return {
    email,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    sub: String(payload.sub || ''),
    email_verified: true,
  };
}

function signSessionId(sessionId: string): string {
  const secret = getSessionSecret();
  if (!secret) {
    if (isStrictSecretRuntime()) {
      throw new Error('SESSION_SECRET is missing or too short in production');
    }
    return sessionId;
  }
  const sig = crypto.createHmac('sha256', secret).update(sessionId).digest('base64url');
  return `${sessionId}.${sig}`;
}

function extractVerifiedSessionId(rawToken?: string | null): string | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const trimmed = rawToken.trim();
  if (!trimmed) return null;

  const secret = getSessionSecret();
  if (secret) {
    if (!trimmed.includes('.')) return null;
    const dotIdx = trimmed.indexOf('.');
    const sessionId = trimmed.slice(0, dotIdx);
    const sig = trimmed.slice(dotIdx + 1);
    if (!/^[a-f0-9]{64}$/i.test(sessionId) || !sig) return null;
    try {
      const expected = crypto.createHmac('sha256', secret).update(sessionId).digest('base64url');
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      return sessionId;
    } catch {
      return null;
    }
  }

  if (isStrictSecretRuntime()) {
    return null;
  }

  // In local dev/test without SESSION_SECRET, only opaque 256-bit hex session IDs stored on server are accepted
  const maybeId = trimmed.includes('.') ? trimmed.split('.')[0] : trimmed;
  if (!/^[a-f0-9]{64}$/i.test(maybeId)) return null;
  return maybeId;
}

export async function createSession(
  res: any,
  user: {
    email: string;
    name?: string;
    picture?: string;
    verifiedViaGoogle: boolean;
  },
  options?: { req?: any; crossSiteAdmin?: boolean }
): Promise<{ session: AuthSessionUser; cookieToken: string }> {
  const email = (user?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Valid email is required to create session');
  }

  const now = Date.now();
  const sessionId = crypto.randomBytes(32).toString('hex');
  const session: AuthSessionUser = {
    sessionId,
    email,
    name: user.name,
    picture: user.picture,
    verifiedViaGoogle: Boolean(user.verifiedViaGoogle),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  await saveSessionToDb(session);

  const cookieToken = signSessionId(sessionId);
  if (res) {
    const useCrossSiteAdminCookie = Boolean(
      options?.crossSiteAdmin || (options?.req && isAdminRequestOrigin(options.req))
    );
    const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
    const flags = useCrossSiteAdminCookie
      ? [
          `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`,
          'HttpOnly',
          'Secure',
          'SameSite=None',
          'Path=/',
          `Max-Age=${maxAgeSec}`,
        ]
      : [
          `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`,
          'Path=/',
          'HttpOnly',
          'SameSite=Lax',
          `Max-Age=${maxAgeSec}`,
          ...(isStrictSecretRuntime() ? ['Secure'] : []),
        ];
    appendSetCookieHeader(res, flags.join('; '));
  }

  return { session, cookieToken };
}

export async function getSessionFromRequest(req: any): Promise<AuthSessionUser | null> {
  if (!req) return null;

  const cookies = parseCookies(req?.headers?.cookie || '');
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  let sessionId = extractVerifiedSessionId(cookieToken);

  if (!sessionId) {
    const authHeader = req?.headers?.authorization || req?.headers?.Authorization || '';
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      sessionId = extractVerifiedSessionId(authHeader.slice(7).trim());
    }
  }

  if (!sessionId) return null;
  const session = await getSessionFromDb(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    return null;
  }
  return session;
}

export async function destroySession(req: any, res: any): Promise<void> {
  try {
    const cookies = parseCookies(req?.headers?.cookie || '');
    const sessionId = extractVerifiedSessionId(cookies[SESSION_COOKIE_NAME]);
    if (sessionId) {
      await deleteSessionFromDb(sessionId);
    }
  } catch {}

  if (res) {
    const useCrossSiteAdminCookie = isAdminRequestOrigin(req);
    const flags = useCrossSiteAdminCookie
      ? [
          `${SESSION_COOKIE_NAME}=`,
          'HttpOnly',
          'Secure',
          'SameSite=None',
          'Path=/',
          'Max-Age=0',
        ]
      : [
          `${SESSION_COOKIE_NAME}=`,
          'Path=/',
          'HttpOnly',
          'SameSite=Lax',
          'Max-Age=0',
          ...(isStrictSecretRuntime() ? ['Secure'] : []),
        ];
    appendSetCookieHeader(res, flags.join('; '));
  }
}

export function isAdminUser(user?: Partial<AuthSessionUser> | null): boolean {
  if (!user || !user.email) return false;
  if (user.verifiedViaGoogle !== true) return false;
  const configuredAdminEmail = getConfiguredAdminEmail();
  if (!configuredAdminEmail) return false;
  return user.email.trim().toLowerCase() === configuredAdminEmail;
}

export async function requireAdmin(req: any): Promise<AdminGuardResult> {
  const configuredAdminEmail = getConfiguredAdminEmail();
  if (isProductionDeployment() && !configuredAdminEmail) {
    return {
      ok: false,
      status: 500,
      error: 'admin not configured',
      code: 'ADMIN_NOT_CONFIGURED',
    };
  }

  const session = await getSessionFromRequest(req);
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized: Valid authenticated session required',
      code: 'UNAUTHORIZED',
    };
  }

  if (!configuredAdminEmail) {
    return {
      ok: false,
      status: 500,
      error: 'admin not configured',
      code: 'ADMIN_NOT_CONFIGURED',
    };
  }

  if (!isAdminUser(session)) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Admin access restricted to configured owner account',
      code: 'FORBIDDEN',
    };
  }

  return { ok: true, user: session };
}
