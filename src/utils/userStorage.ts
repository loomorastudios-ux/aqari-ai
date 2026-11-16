import { User } from '../types';

export const SESSION_KEY = 'aqari_session_email';
const PROFILE_CACHE_KEY = 'aqari_profile_cache_v1';
const LEGACY_DB_KEY = 'aqari_users_db_v2';

interface CachedIdentity {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  picture?: string;
  provider?: 'email' | 'google' | 'guest';
  googleId?: string;
  createdAt?: number;
  lastLoginAt?: number;
}

function getProfileCache(): Record<string, CachedIdentity> {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveProfileCache(cache: Record<string, CachedIdentity>): void {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cache));
    localStorage.removeItem(LEGACY_DB_KEY);
    localStorage.removeItem('aqari_user');
  } catch {}
}

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function buildIdentityOnlyUser(identity: CachedIdentity): User {
  const norm = normalizeEmail(identity.email);
  return {
    id: identity.id || 'user_' + norm,
    googleId: identity.googleId,
    email: norm,
    name: identity.name || norm.split('@')[0],
    avatar: identity.avatar || (identity.name || norm).charAt(0).toUpperCase(),
    picture: identity.picture,
    provider: identity.provider || 'google',
    plan: 'free',
    subscriptionPlan: 'free',
    subscriptionStatus: 'free',
    analysesUsed: 0,
    analysesLeft: undefined,
    freeAnalysesLeft: undefined,
    freeAnalyses: undefined,
    analysesTotal: undefined,
    subscriptionExpiry: null,
    createdAt: identity.createdAt || Date.now(),
    lastLoginAt: identity.lastLoginAt || Date.now(),
    savedAnalyses: [],
    portfolio: { totalValue: 0, monthlyCashflow: 0 },
  };
}

export function getUser(email: string): User | null {
  const norm = normalizeEmail(email);
  if (!norm) return null;
  const cache = getProfileCache();
  const identity = cache[norm];
  return identity ? buildIdentityOnlyUser(identity) : null;
}

// Identity-only persistence: NEVER persist plan, analysesLeft, maxSaved, or savedAnalyses to localStorage
export function saveUser(user: User): void {
  const norm = normalizeEmail(user.email);
  if (!norm) return;
  const cache = getProfileCache();
  cache[norm] = {
    id: user.id || 'user_' + norm,
    email: norm,
    name: user.name || norm.split('@')[0],
    avatar: user.avatar || (user.name || norm).charAt(0).toUpperCase(),
    picture: user.picture,
    provider: user.provider || 'google',
    googleId: user.googleId,
    createdAt: user.createdAt || Date.now(),
    lastLoginAt: user.lastLoginAt || Date.now(),
  };
  saveProfileCache(cache);
  try {
    localStorage.setItem(SESSION_KEY, norm);
  } catch {}
}

export function getSessionUser(): User | null {
  try {
    const sessionEmail = localStorage.getItem(SESSION_KEY);
    if (!sessionEmail) return null;
    const norm = normalizeEmail(sessionEmail);
    if (!norm) return null;
    const cache = getProfileCache();
    const identity = cache[norm] || {
      id: 'user_' + norm,
      email: norm,
      name: norm.split('@')[0],
      avatar: norm.charAt(0).toUpperCase(),
      provider: 'google' as const,
    };
    // Authoritative plan & credits always come from GET /api/app?action=me
    return buildIdentityOnlyUser(identity);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_DB_KEY);
    localStorage.removeItem('aqari_user');
  } catch {}
}

export const REMEMBERED_ACCOUNTS_KEY = 'remembered_accounts';

export interface RememberedAccount {
  name: string;
  email: string;
  avatar?: string;
  picture?: string;
  googleId?: string;
  lastLoginAt?: number;
}

export function getRememberedAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a: RememberedAccount, b: RememberedAccount) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
  } catch (e) {
    console.error('Failed to parse remembered_accounts', e);
    return [];
  }
}

export function saveRememberedAccount(user: User): void {
  try {
    const norm = normalizeEmail(user.email);
    if (!norm) return;
    const existingList = getRememberedAccounts();
    const existingIndex = existingList.findIndex((item) => normalizeEmail(item.email) === norm);

    const accountData: RememberedAccount = {
      name: user.name || norm.split('@')[0],
      email: norm,
      avatar: user.picture || user.avatar || user.name?.charAt(0).toUpperCase() || norm.charAt(0).toUpperCase(),
      picture: user.picture,
      googleId: user.googleId,
      lastLoginAt: Date.now(),
    };

    if (existingIndex >= 0) {
      existingList[existingIndex] = accountData;
    } else {
      existingList.unshift(accountData);
    }

    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(existingList));
  } catch (e) {
    console.error('Failed to save remembered account', e);
  }
}

export function removeRememberedAccount(email: string): void {
  try {
    const norm = normalizeEmail(email);
    const existingList = getRememberedAccounts();
    const filtered = existingList.filter((item) => normalizeEmail(item.email) !== norm);
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to remove remembered account', e);
  }
}

export function signOutAndForget(email: string): void {
  clearSession();
  removeRememberedAccount(email);
}

export function getUserEmail(): string | null {
  const user = getSessionUser();
  return user ? user.email : null;
}

export function loginOrCreateUser(
  rawEmail: string,
  provider: 'email' | 'google' | 'guest' = 'google',
  displayName?: string,
  pictureUrl?: string,
  googleId?: string
): { user: User; isNew: boolean } {
  const normEmail = normalizeEmail(rawEmail);
  const existing = getUser(normEmail);
  const name = displayName || existing?.name || normEmail.split('@')[0];

  const userIdentity: User = {
    id: existing?.id || (googleId ? `google_${googleId}` : 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
    googleId: googleId || existing?.googleId,
    email: normEmail,
    name,
    avatar: pictureUrl || existing?.avatar || name.charAt(0).toUpperCase(),
    picture: pictureUrl || existing?.picture,
    provider: provider || 'google',
    plan: 'free',
    subscriptionPlan: 'free',
    subscriptionStatus: 'free',
    subscriptionEndsAt: null,
    freeAnalysesLeft: undefined,
    freeAnalyses: undefined,
    analysesLeft: undefined,
    analysesTotal: undefined,
    analysesUsed: 0,
    subscriptionExpiry: null,
    subscriptionStartAt: null,
    expiryEmailSent: false,
    savedAnalyses: [],
    portfolio: { totalValue: 0, monthlyCashflow: 0 },
    createdAt: existing?.createdAt || Date.now(),
    lastLoginAt: Date.now(),
  };

  saveUser(userIdentity);
  saveRememberedAccount(userIdentity);
  return { user: userIdentity, isNew: !existing };
}
