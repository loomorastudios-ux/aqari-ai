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
      // Check subscription expiry
      if (user.subscriptionExpiry && Date.now() > user.subscriptionExpiry) {
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

export function loginOrCreateUser(
  rawEmail: string,
  provider: 'email' | 'google' | 'guest' = 'email',
  displayName?: string
): { user: User; isNew: boolean } {
  const normEmail = normalizeEmail(rawEmail);
  const existing = getUser(normEmail);

  if (existing) {
    const freeCount = existing.freeAnalysesLeft ?? existing.freeAnalyses ?? 3;
    const updated: User = {
      ...existing,
      lastLoginAt: Date.now(),
      name: displayName || existing.name || normEmail.split('@')[0],
      avatar: (displayName || existing.name || normEmail).charAt(0).toUpperCase(),
      provider: existing.provider || provider,
      freeAnalysesLeft: freeCount,
      freeAnalyses: freeCount,
      analysesUsed: existing.analysesUsed || 0,
      savedAnalyses: existing.savedAnalyses || [],
      portfolio: existing.portfolio || { totalValue: 0, monthlyCashflow: 0 },
    };
    saveUser(updated);
    return { user: updated, isNew: false };
  }

  // Create BRAND NEW user with exactly 3 free analyses
  const name = displayName || (provider === 'guest' ? 'Guest Investor' : normEmail.split('@')[0]);
  const newUser: User = {
    id: 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    email: normEmail,
    name,
    avatar: name.charAt(0).toUpperCase(),
    provider,
    plan: 'free',
    freeAnalysesLeft: 3,
    freeAnalyses: 3,
    analysesUsed: 0,
    analysesLeft: 0,
    subscriptionExpiry: null,
    savedAnalyses: [],
    portfolio: { totalValue: 0, monthlyCashflow: 0 },
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  saveUser(newUser);
  return { user: newUser, isNew: true };
}
