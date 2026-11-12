import { User, SavedAnalysis } from '../types';

export const DB_KEY = 'aqari_users_db_v2';
export const SESSION_KEY = 'aqari_session_email';

export function getDB(): Record<string, User> {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse user DB', e);
    return {};
  }
}

export function saveDB(db: Record<string, User>): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save user DB', e);
  }
}

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export function getUser(email: string): User | null {
  const norm = normalizeEmail(email);
  if (!norm) return null;
  const db = getDB();
  return db[norm] || null;
}

export function saveUser(user: User): void {
  const norm = normalizeEmail(user.email);
  if (!norm) return;
  const db = getDB();
  db[norm] = {
    ...user,
    email: norm,
  };
  saveDB(db);
  localStorage.setItem(SESSION_KEY, norm);
}

export function getSessionUser(): User | null {
  try {
    const sessionEmail = localStorage.getItem(SESSION_KEY);
    if (!sessionEmail) return null;
    const user = getUser(sessionEmail);
    if (user) {
      // Check subscription expiry (exact 30 x 24h)
      const expiry = user.subscriptionEndsAt || user.subscriptionExpiry;
      if (expiry && Date.now() >= expiry && user.plan !== 'free') {
        user.plan = 'free';
        user.freeAnalysesLeft = 0;
        user.freeAnalyses = 0;
        user.analysesLeft = 0;
        saveUser(user);
      }
    }
    return user;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
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

  if (existing) {
    const freeCount = existing.freeAnalysesLeft ?? existing.freeAnalyses ?? 3;
    const endsAt = existing.subscriptionEndsAt || existing.subscriptionExpiry || null;
    let subStatus = existing.subscriptionStatus || (existing.plan !== 'free' ? 'active' : 'free');
    if (existing.plan !== 'free' && endsAt && Date.now() >= endsAt) {
      subStatus = 'expired';
    }

    const updated: User = {
      ...existing,
      googleId: googleId || existing.googleId,
      lastLoginAt: Date.now(),
      name: displayName || existing.name || normEmail.split('@')[0],
      avatar: pictureUrl || existing.avatar || (displayName || existing.name || normEmail).charAt(0).toUpperCase(),
      picture: pictureUrl || existing.picture,
      provider: 'google',
      subscriptionStatus: subStatus,
      subscriptionEndsAt: endsAt,
      freeAnalysesLeft: freeCount,
      freeAnalyses: freeCount,
      analysesUsed: existing.analysesUsed || 0,
      savedAnalyses: existing.savedAnalyses || [],
      portfolio: existing.portfolio || { totalValue: 0, monthlyCashflow: 0 },
    };
    saveUser(updated);
    saveRememberedAccount(updated);
    return { user: updated, isNew: false };
  }

  // Create BRAND NEW user with exactly 3 free analyses
  const name = displayName || normEmail.split('@')[0];
  const newUser: User = {
    id: googleId ? `google_${googleId}` : 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    googleId: googleId || undefined,
    email: normEmail,
    name,
    avatar: pictureUrl || name.charAt(0).toUpperCase(),
    picture: pictureUrl,
    provider: 'google',
    plan: 'free',
    subscriptionStatus: 'free',
    subscriptionEndsAt: null,
    freeAnalysesLeft: 3,
    freeAnalyses: 3,
    analysesUsed: 0,
    analysesLeft: 0,
    subscriptionExpiry: null,
    subscriptionStartAt: null,
    expiryEmailSent: false,
    savedAnalyses: [],
    portfolio: { totalValue: 0, monthlyCashflow: 0 },
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  saveUser(newUser);
  saveRememberedAccount(newUser);
  return { user: newUser, isNew: true };
}
