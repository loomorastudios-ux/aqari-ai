// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CurrencyCode, PropertyListing, RemoteConfig, User, MarketMatrixRow } from './types';
import {
  CONFIG_URL,
  DEFAULT_CONFIG,
  PROPERTY_LISTINGS,
  FALLBACK_CROSS_BORDER_DATA,
} from './constants';
import {
  fetchLiveExchangeRates,
  fetchLiveMarketData,
  fetchLiveNews,
  mapLiveCitiesToMatrix,
  LiveMarketResponse,
  MarketNewsArticle,
} from './utils/marketDataService';
import {
  getSessionUser,
  saveUser,
  clearSession,
  getUser,
  removeRememberedAccount,
  loginOrCreateUser,
} from './utils/userStorage';
import { verifyGoogleAccessToken, verifyGoogleIdToken } from './utils/oauthConfig';
import {
  canUseFeature,
  findPlanPricing,
  normalizePlanKey,
  PLANS,
  PricingPublicPayload,
  PRODUCTION_URL,
} from '../lib/plans';
import { AmbientBackground } from './components/AmbientBackground';
import { CustomCursor } from './components/CustomCursor';
import { Navbar } from './components/Navbar';
import { MarqueeTicker } from './components/MarqueeTicker';
import { Hero } from './components/Hero';
import { PropertyGrid } from './components/PropertyGrid';
import { YieldSimulator } from './components/YieldSimulator';
import { CrossBorderMatrix } from './components/CrossBorderMatrix';
import { PortfolioSummary } from './components/PortfolioSummary';
import { PricingSection } from './components/PricingSection';
import { AuthModal } from './components/AuthModal';
import { LimitModal } from './components/LimitModal';
import { AnalysisModal } from './components/AnalysisModal';
import { AdminModal } from './components/AdminModal';
import { RenewalModal } from './components/RenewalModal';
import { TerminalDashboard } from './components/TerminalDashboard';
import { PaymentSuccessView } from './components/PaymentSuccessView';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { DemoAnalysisView } from './components/DemoAnalysisView';
import { LegalPages, LegalDocSlug } from './components/LegalPages';
import { AdminDashboard } from './components/AdminDashboard';
import { PWAInstallButton } from './components/PWAInstallButton';
import { checkAndSendExpiryEmail } from './utils/emailService';
import {
  Sparkles,
  X,
  AlertOctagon,
  CheckCircle2,
  Loader2,
  Newspaper,
  ExternalLink,
} from 'lucide-react';

type AppRoute =
  | 'landing'
  | 'terminal'
  | 'pricing'
  | 'payment-success'
  | 'demo'
  | 'terms'
  | 'privacy'
  | 'refund'
  | 'disclaimer'
  | 'admin'
  | 'checkout-verifying';

const OWNER_ADMIN_EMAILS = ['loomora.studios@gmail.com', 'loomorastudios@gmail.com'];
const isOwnerAdminEmail = (email?: string | null) =>
  Boolean(email && OWNER_ADMIN_EMAILS.includes(email.trim().toLowerCase()));

export default function App() {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('aqari_currency');
    if (saved && ['USD', 'OMR', 'AED', 'GBP'].includes(saved)) {
      return saved as CurrencyCode;
    }
    return 'USD';
  });

  const [user, setUser] = useState<User | null>(() => getSessionUser());

  const [demoSlug, setDemoSlug] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.startsWith('/demo/')) {
        return path.replace('/demo/', '').split('?')[0] || 'tribeca';
      }
      if (hash.startsWith('#/demo/')) {
        return hash.replace('#/demo/', '').split('?')[0] || 'tribeca';
      }
    }
    return 'tribeca';
  });

  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);

      if (path === '/terms' || hash === '#/terms') return 'terms';
      if (path === '/privacy' || hash === '#/privacy') return 'privacy';
      if (path === '/refund' || hash === '#/refund') return 'refund';
      if (path === '/disclaimer' || hash === '#/disclaimer') return 'disclaimer';
      if (path === '/admin' || hash === '#/admin') return 'admin';
      if (path === '/payment-success' || hash.startsWith('#/payment-success')) return 'payment-success';
      if (path === '/pricing' || hash === '#/pricing') return 'pricing';
      if (path.startsWith('/demo/') || hash.startsWith('#/demo/')) return 'demo';

      if (params.get('checkout') === 'success' || params.get('success') === 'true') {
        return 'checkout-verifying';
      }

      if (path === '/app' || hash === '#/terminal') {
        const sessionUser = getSessionUser();
        if (sessionUser) return 'terminal';
      }
    }
    return 'landing';
  });

  const [verifyingPlanName, setVerifyingPlanName] = useState<string>('SUBSCRIPTION');

  const [config, setConfig] = useState<RemoteConfig>(() => {
    const localOverride = localStorage.getItem('aqari_remote_config');
    if (localOverride) {
      try {
        return JSON.parse(localOverride);
      } catch {}
    }
    const cached = localStorage.getItem('aqari_remote_config_cached');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    return DEFAULT_CONFIG;
  });

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isRenewalOpen, setIsRenewalOpen] = useState(false);
  const [activePropertyAnalysis, setActivePropertyAnalysis] = useState<PropertyListing | null>(null);

  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [pricingData, setPricingData] = useState<PricingPublicPayload | null>(null);
  const [marketLive, setMarketLive] = useState<LiveMarketResponse | null>(null);
  const [matrixData, setMatrixData] = useState<MarketMatrixRow[]>(FALLBACK_CROSS_BORDER_DATA);
  const [newsArticles, setNewsArticles] = useState<MarketNewsArticle[]>([]);

  const [showToast, setShowToast] = useState(true);
  const [unlockSuccessMsg, setUnlockSuccessMsg] = useState<string | null>(() => {
    try {
      const msg = sessionStorage.getItem('aqari_unlock_msg');
      if (msg) sessionStorage.removeItem('aqari_unlock_msg');
      return msg;
    } catch {
      return null;
    }
  });
  const [terminalToast, setTerminalToast] = useState<string | null>(() => {
    try {
      const msg = sessionStorage.getItem('aqari_unlock_toast');
      if (msg) sessionStorage.removeItem('aqari_unlock_toast');
      return msg;
    } catch {
      return null;
    }
  });
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyDebug, setVerifyDebug] = useState<{
    email_searched?: string;
    total_orders_checked?: number;
    lemon_status?: number | string;
    key_present?: boolean;
  } | null>(null);
  const [manualPaymentEmail, setManualPaymentEmail] = useState('');
  const [manualOrderId, setManualOrderId] = useState('');
  const [verifyFailCount, setVerifyFailCount] = useState(0);
  const [isRetryingVerify, setIsRetryingVerify] = useState(false);
  const [serverSynced, setServerSynced] = useState<boolean>(() => !getSessionUser());

  const showTempToast = (msg: string, duration = 3500) => {
    setTerminalToast(msg);
    setTimeout(() => setTerminalToast(null), duration);
  };

  // Force production Vercel domain redirect immediately if accessed via any preview .vercel.app host
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host.includes('vercel.app') && host !== 'aqari-ai-rho.vercel.app') {
        window.location.replace(
          `${PRODUCTION_URL}${window.location.pathname}${window.location.search}${window.location.hash}`
        );
      }
    }
  }, []);

  // Navigation helpers supporting both clean pathnames and hash fallbacks
  const navigateLegal = (slug: LegalDocSlug) => {
    window.history.pushState({}, '', `/${slug}`);
    setRoute(slug);
    window.scrollTo(0, 0);
  };

  const handleGoToHome = () => {
    window.history.pushState({}, '', '/');
    setRoute('landing');
    window.scrollTo(0, 0);
  };

  const handleGoToTerminal = () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    window.history.pushState({}, '', '/app');
    setRoute('terminal');
    window.scrollTo(0, 0);
  };

  const handleGoToPricing = () => {
    window.history.pushState({}, '', '/pricing');
    setRoute('pricing');
    window.scrollTo(0, 0);
  };

  // Listen to hash and pathname changes
  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      const currentUser = getSessionUser();

      if (path === '/terms' || hash === '#/terms') return setRoute('terms');
      if (path === '/privacy' || hash === '#/privacy') return setRoute('privacy');
      if (path === '/refund' || hash === '#/refund') return setRoute('refund');
      if (path === '/disclaimer' || hash === '#/disclaimer') return setRoute('disclaimer');
      if (path === '/admin' || hash === '#/admin') return setRoute('admin');
      if (path === '/payment-success' || hash.startsWith('#/payment-success')) return setRoute('payment-success');
      if (path === '/pricing' || hash === '#/pricing') return setRoute('pricing');

      if (path.startsWith('/demo/') || hash.startsWith('#/demo/')) {
        const s = (path.startsWith('/demo/') ? path.replace('/demo/', '') : hash.replace('#/demo/', '')).split('?')[0] || 'tribeca';
        setDemoSlug(s);
        setRoute('demo');
        return;
      }
      if (hash === '#/terminal' || path === '/app') {
        if (currentUser) {
          setRoute('terminal');
        } else {
          setIsAuthOpen(true);
          setRoute('landing');
        }
        return;
      }
      if (path === '/' || hash === '#/landing' || hash === '' || hash === '#') {
        setRoute('landing');
      }
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Protect /admin route strictly for owner email
  useEffect(() => {
    if (route === 'admin') {
      if (!isOwnerAdminEmail(user?.email)) {
        window.history.replaceState({}, document.title, '/');
        setRoute('landing');
        showTempToast('403 Forbidden: Restricted access', 4000);
      }
    }
  }, [route, user?.email]);

  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    setCurrency(newCurrency);
    localStorage.setItem('aqari_currency', newCurrency);
  };

  // Fetch Dynamic Pricing from /api/pricing (single source) immediately on mount, focus, or admin update
  useEffect(() => {
    const fetchDynamicPricing = async () => {
      try {
        const res = await fetch(`/api/app?action=pricing&t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data: PricingPublicPayload = await res.json();
          setPricingData(data);
        }
      } catch {}
    };
    fetchDynamicPricing();
    const onUpdated = () => fetchDynamicPricing();
    const onFocus = () => fetchDynamicPricing();
    window.addEventListener('aqari:pricing-updated', onUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('aqari:pricing-updated', onUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Fetch Remote Config on load
  useEffect(() => {
    const fetchRemoteConfig = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: RemoteConfig = await res.json();
          const localOverride = localStorage.getItem('aqari_remote_config');
          if (!localOverride) setConfig(data);
          localStorage.setItem('aqari_remote_config_cached', JSON.stringify(data));
        }
      } catch {}
    };
    fetchRemoteConfig();
  }, []);

  // Poll live FX, live market metrics (/api/market/live), and live Google News RSS (/api/news)
  useEffect(() => {
    const loadLiveFeeds = async () => {
      await fetchLiveExchangeRates();
      const live = await fetchLiveMarketData();
      setMarketLive(live);
      const mapped = mapLiveCitiesToMatrix(live);
      if (mapped.length > 0) setMatrixData(mapped);
    };

    loadLiveFeeds();
    fetchLiveNews().then((res) => {
      if (res?.success && Array.isArray(res.articles) && res.articles.length > 0) {
        setNewsArticles(res.articles);
      }
    });

    const intervalId = setInterval(loadLiveFeeds, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  // 1-Day Expiration Reminder Modal Check
  useEffect(() => {
    if (user && user.plan !== 'free' && user.subscriptionExpiry) {
      const msLeft = user.subscriptionExpiry - Date.now();
      if (msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (user.lastReminderDate !== todayStr) {
          const updated: User = { ...user, lastReminderDate: todayStr };
          setUser(updated);
          localStorage.setItem('aqari_user', JSON.stringify(updated));
          setIsRenewalOpen(true);
        }
      }
    }
  }, [user]);

  const runCheckoutVerification = async (overrides?: { email?: string; orderId?: string }) => {
    const urlParams = new URLSearchParams(window.location.search);
    const parsedPlan = normalizePlanKey(urlParams.get('plan'));
    const returnedPlan: 'starter' | 'pro' | 'enterprise' =
      parsedPlan === 'free' ? 'pro' : parsedPlan;
    const planCfg = PLANS[returnedPlan];
    setVerifyingPlanName(urlParams.get('plan') ? planCfg.displayName : 'TERMINAL');
    setVerifyError(null);
    setVerifyDebug(null);
    setIsRetryingVerify(true);

    const sessionUser = getSessionUser();
    const loginEmail = (sessionUser?.email || '').trim().toLowerCase();
    const targetEmail = (overrides?.email || urlParams.get('email') || loginEmail || '').trim().toLowerCase();
    const checkoutId = urlParams.get('checkout_id') || '';
    const orderId = (overrides?.orderId || urlParams.get('order_id') || '').trim();
    const chargedPrice = urlParams.get('charged_price') || '';
    const launchLocked = urlParams.get('launch_locked') || '';
    const testModeParam = urlParams.get('test_mode') || '';

    const qs = new URLSearchParams({ action: 'verify-checkout' });
    if (targetEmail) qs.set('email', targetEmail);
    if (orderId) qs.set('order_id', orderId);

    try {
      const res = await fetch(`/api/app?${qs.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: targetEmail || undefined,
          login_email: loginEmail || undefined,
          plan: urlParams.get('plan') ? returnedPlan : undefined,
          checkout_id: checkoutId || undefined,
          order_id: orderId || undefined,
          charged_price: chargedPrice ? Number(chargedPrice) : undefined,
          launch_locked: launchLocked ? Number(launchLocked) : undefined,
          test_mode: testModeParam || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data?.debug) {
        setVerifyDebug(data.debug);
      }

      if (res.ok && data?.verified && data?.user) {
        // Force refresh session directly from authoritative /api/app?action=me
        const meRes = await fetch(`/api/app?action=me&t=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const meData = meRes.ok ? await meRes.json().catch(() => data) : data;

        const verifiedPlan = normalizePlanKey(meData?.planKey || data.user.plan);
        const verifiedCfg = PLANS[verifiedPlan];
        const serverLimit = meData?.license?.analysesLimit ?? data.license?.analysesLimit ?? verifiedCfg.analysesLimit;
        const serverUsed = Number(meData?.analyses_used ?? data.user.analyses_used ?? 0);
        const serverLeft = Number.isFinite(serverLimit)
          ? Math.max(0, serverLimit - serverUsed)
          : 999999;

        const existing = (data.user.email && getUser(data.user.email)) || sessionUser;
        const lockedPriceVal = meData?.locked_launch_price ?? data.user.locked_launch_price ?? null;
        const serverCustomCities = Array.isArray(meData?.custom_cities)
          ? meData.custom_cities
          : Array.isArray(data?.custom_cities)
          ? data.custom_cities
          : existing?.customCities || [];

        const updatedUser: User = {
          ...(existing || {
            id: 'user_' + Date.now(),
            email: data.user.email,
            name: data.user.name || data.user.email.split('@')[0],
            avatar: data.user.email.charAt(0).toUpperCase(),
            provider: 'google',
            createdAt: Date.now(),
            savedAnalyses: [],
          }),
          email: data.user.email,
          plan: verifiedPlan,
          subscriptionPlan: verifiedPlan,
          subscriptionStatus: verifiedPlan === 'free' ? 'free' : 'active',
          subscriptionStartAt: meData?.license_start ?? data.user.license_start ?? Date.now(),
          subscriptionEndsAt: meData?.license_end ?? data.user.license_end ?? null,
          subscriptionExpiry: meData?.license_end ?? data.user.license_end ?? null,
          analysesUsed: serverUsed,
          freeAnalyses: serverLeft,
          freeAnalysesLeft: serverLeft,
          analysesLeft: serverLeft,
          lockedLaunchPrice: lockedPriceVal,
          customCities: serverCustomCities,
          expiryEmailSent: false,
        };

        saveUser(updatedUser);
        setUser(updatedUser);
        setVerifyingPlanName(verifiedCfg.displayName);

        try {
          confetti({
            particleCount: 160,
            spread: 85,
            origin: { y: 0.6 },
            colors: ['#D4AF37', '#F3E5AB', '#8B5CF6', '#06B6D4'],
          });
        } catch {}

        const unlockBanner = lockedPriceVal
          ? `Welcome to ${verifiedCfg.displayName} — You locked Launch Price ${lockedPriceVal}$ - Your next renewal will be at same launch price if you renew before expiry`
          : `Welcome to ${verifiedCfg.displayName} — Payment Successful! Your Terminal is unlocked.`;
        const unlockToast = `Welcome to AQARI ${verifiedCfg.displayName} — Unlocked for 30 Days!`;
        try {
          sessionStorage.setItem('aqari_unlock_msg', unlockBanner);
          sessionStorage.setItem('aqari_unlock_toast', unlockToast);
        } catch {}

        setIsRetryingVerify(false);
        window.location.replace('/app');
        return;
      }

      setVerifyFailCount((c) => c + 1);
      setVerifyError(
        data?.error ||
          `No order found for email ${targetEmail || 'your account'} - Try entering your payment email or Order ID below`
      );
    } catch (err) {
      console.error('Checkout verification error:', err);
      setVerifyFailCount((c) => c + 1);
      setVerifyError('Unable to reach verification server. Click below to retry.');
    } finally {
      setIsRetryingVerify(false);
    }
  };

  // Verify post-checkout success & Google OAuth redirect tokens on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('checkout') === 'cancelled') {
      setRoute('pricing');
      window.history.replaceState({}, document.title, '/pricing');
      showTempToast('Checkout cancelled — no charge was made.', 4000);
    }

    if (urlParams.get('success') === 'true' || urlParams.get('checkout') === 'success') {
      setRoute('checkout-verifying');
      runCheckoutVerification();
    }

    // Check if returning from Google OAuth redirect
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    const hashParams = new URLSearchParams(rawHash.includes('=') ? rawHash : '');
    const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
    const idToken = hashParams.get('id_token') || urlParams.get('id_token');
    const oauthCredential = urlParams.get('credential') || hashParams.get('credential');

    const handleVerifyRedirectToken = async () => {
      try {
        let verified: { googleId: string; email: string; name: string; avatar: string; picture?: string } | null = null;
        if (accessToken) {
          verified = await verifyGoogleAccessToken(accessToken);
        } else if (idToken) {
          verified = await verifyGoogleIdToken(idToken);
        } else if (oauthCredential) {
          verified = await verifyGoogleIdToken(oauthCredential);
        }

        if (verified && verified.email) {
          const { user: authedUser } = loginOrCreateUser(
            verified.email,
            'google',
            verified.name,
            verified.picture || verified.avatar,
            verified.googleId
          );
          await handleSignIn(authedUser);
          window.history.replaceState({}, document.title, '/app');
        }
      } catch (err) {
        console.warn('Google OAuth verification failed on redirect:', err);
      }
    };

    if (accessToken || idToken || oauthCredential) {
      handleVerifyRedirectToken();
    }
  }, []);

  const handleSaveUser = (updatedUser: User | null) => {
    if (updatedUser) {
      saveUser(updatedUser);
      setUser(updatedUser);
    } else {
      clearSession();
      setUser(null);
    }
  };

  // Sign In Action -> create signed HttpOnly cookie + redirect to /app
  const handleSignIn = async (newUser: User) => {
    handleSaveUser(newUser);
    setIsAuthOpen(false);

    let resolvedUser = newUser;
    // Issue server HttpOnly signed session cookie & sync server-authoritative plan
    try {
      const res = await fetch('/api/app?action=session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: newUser.email, name: newUser.name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          const serverPlan = normalizePlanKey(data.user.plan);
          const serverLimit = data.license?.analysesLimit ?? PLANS[serverPlan].analysesLimit;
          const serverUsed = Number(data.user.analyses_used ?? 0);
          const serverLeft = Number.isFinite(serverLimit)
            ? Math.max(0, serverLimit - serverUsed)
            : 999999;
          const syncedUser: User = {
            ...newUser,
            plan: serverPlan,
            subscriptionPlan: serverPlan,
            subscriptionStatus: serverPlan === 'free' && data.license?.isExpired ? 'expired' : 'active',
            subscriptionStartAt: data.user.license_start ?? undefined,
            subscriptionEndsAt: data.user.license_end ?? null,
            subscriptionExpiry: data.user.license_end ?? null,
            analysesUsed: serverUsed,
            freeAnalyses: serverLeft,
            freeAnalysesLeft: serverLeft,
            analysesLeft: serverLeft,
            lockedLaunchPrice: data.user.locked_launch_price ?? null,
          };
          handleSaveUser(syncedUser);
          resolvedUser = syncedUser;
        }
      }
    } catch {}

    window.history.pushState({}, '', '/app');
    setRoute('terminal');
    window.scrollTo(0, 0);

    const left = resolvedUser.plan === 'free'
      ? (resolvedUser.freeAnalysesLeft ?? resolvedUser.freeAnalyses ?? 3)
      : (resolvedUser.analysesLeft ?? 30);
    showTempToast(`Welcome back, ${resolvedUser.name || resolvedUser.email.split('@')[0]} - ${left} analyses left`, 3000);
  };

  // Sign Out (clears session cookie & localStorage session, stays cleanly on '/')
  const handleSignOut = async (forgetDevice = false) => {
    if (user && forgetDevice) {
      removeRememberedAccount(user.email);
    }
    clearSession();
    setUser(null);
    setTerminalToast(null);
    try {
      await fetch('/api/app?action=session', { method: 'DELETE', credentials: 'include' });
    } catch {}
    window.history.pushState({}, '', '/');
    setRoute('landing');
    window.scrollTo(0, 0);
  };

  // Server-authoritative /api/me Sync: ALWAYS read plan & limits from server DB, NEVER localStorage
  useEffect(() => {
    const syncMeFromServer = async () => {
      try {
        let res = await fetch(`/api/app?action=me&t=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store',
        });

        // If cookie hasn't been established for this signed-in user yet, establish HttpOnly cookie first
        if (res.status === 401 && user?.email) {
          await fetch('/api/app?action=session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: user.email, name: user.name }),
          });
          res = await fetch(`/api/app?action=me&t=${Date.now()}`, {
            credentials: 'include',
            cache: 'no-store',
          });
        }

        if (!res.ok) {
          setServerSynced(true);
          return;
        }
        const data = await res.json();
        if (!data?.authenticated || !data?.email) {
          setServerSynced(true);
          return;
        }

        const serverPlan = normalizePlanKey(data.planKey || data.user?.plan);
        const serverUsed = Number(data.analyses_used ?? 0);
        const serverEnd = data.license_end ?? null;
        const serverLimit = data.license?.analysesLimit ?? PLANS[serverPlan].analysesLimit;
        const serverLeft = Number.isFinite(serverLimit) ? Math.max(0, serverLimit - serverUsed) : 999999;
        const serverLockedLaunch = data.locked_launch_price ?? null;
        const serverCustomCities = Array.isArray(data.custom_cities)
          ? data.custom_cities
          : Array.isArray(data.user?.custom_cities)
          ? data.user.custom_cities
          : [];

        const baseUser: User = user || {
          id: 'user_' + Date.now(),
          email: data.email,
          name: data.name || data.email.split('@')[0],
          avatar: data.email.charAt(0).toUpperCase(),
          provider: 'google',
          createdAt: Date.now(),
          savedAnalyses: [],
          plan: 'free',
          subscriptionExpiry: null,
          analysesUsed: 0,
          freeAnalyses: 3,
          freeAnalysesLeft: 3,
          analysesLeft: 3,
          customCities: [],
        };

        const changed =
          !user ||
          normalizePlanKey(user.plan) !== serverPlan ||
          (user.analysesUsed ?? 0) !== serverUsed ||
          (user.subscriptionEndsAt ?? null) !== serverEnd ||
          (user.lockedLaunchPrice ?? null) !== serverLockedLaunch ||
          (serverCustomCities.length !== (user.customCities?.length ?? 0)) ||
          (Number.isFinite(serverLimit) && (user.analysesLeft ?? -1) !== serverLeft);

        if (changed) {
          const mergedCities =
            serverCustomCities.length > 0 ? serverCustomCities : baseUser.customCities || [];
          const syncedUser: User = {
            ...baseUser,
            email: data.email,
            name: baseUser.name || data.name || data.email.split('@')[0],
            plan: serverPlan,
            subscriptionPlan: serverPlan,
            subscriptionStatus: serverPlan === 'free' && data.license?.isExpired ? 'expired' : serverPlan === 'free' ? 'free' : 'active',
            subscriptionStartAt: data.license_start ?? undefined,
            subscriptionEndsAt: serverEnd,
            subscriptionExpiry: serverEnd,
            analysesUsed: serverUsed,
            freeAnalyses: serverLeft,
            freeAnalysesLeft: serverLeft,
            analysesLeft: serverLeft,
            lockedLaunchPrice: serverLockedLaunch,
            customCities: mergedCities,
          };
          saveUser(syncedUser);
          setUser(syncedUser);
        }
      } catch {
      } finally {
        setServerSynced(true);
      }
    };

    syncMeFromServer();
    const onFocus = () => syncMeFromServer();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.email, route, pricingData?.updatedAt]);

  // 24h expiry email check
  useEffect(() => {
    if (user && user.plan !== 'free') {
      const { user: updatedUser } = checkAndSendExpiryEmail(user);
      if (updatedUser.expiryEmailSent !== user.expiryEmailSent) {
        setUser(updatedUser);
      }
    }
  }, [user]);

  const handleAdminTestUnlock = (plan: 'starter' | 'pro' | 'enterprise') => {
    if (!user || !isOwnerAdminEmail(user.email)) {
      showTempToast('Admin sandbox unlock is restricted to owner email.', 4000);
      return;
    }
    const dynamicPlan = findPlanPricing(pricingData, plan);
    const planCfg = PLANS[plan];
    const limit = dynamicPlan ? (dynamicPlan.analysesLimit === null ? Infinity : dynamicPlan.analysesLimit) : planCfg.analysesLimit;
    const planQuota = Number.isFinite(limit) ? limit : 999999;
    const now = Date.now();
    const subscriptionDuration = 30 * 24 * 60 * 60 * 1000;
    const updated: User = {
      ...user,
      plan,
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      subscriptionStartAt: now,
      subscriptionEndsAt: now + subscriptionDuration,
      subscriptionExpiry: now + subscriptionDuration,
      expiryEmailSent: false,
      analysesUsed: 0,
      freeAnalyses: planQuota,
      freeAnalysesLeft: planQuota,
      analysesLeft: planQuota,
    };
    handleSaveUser(updated);
    showTempToast(`Admin Sandbox: ${planCfg.displayName} updated locally.`);
  };

  // Authoritative analysis credit consumption (delegates to server DB when analyzing from TerminalDashboard)
  const consumeAnalysis = (): boolean => {
    if (!user) {
      setIsAuthOpen(true);
      return false;
    }

    const currentUser = getUser(user.email) || user;
    const serverPlan = normalizePlanKey(currentUser.plan);
    const cfg = PLANS[serverPlan];
    const limit = cfg.analysesLimit;
    const used = Number(currentUser.analysesUsed || 0);
    const left = Number.isFinite(limit) ? Math.max(0, limit - used) : 999999;

    if (serverPlan !== 'free' && currentUser.subscriptionEndsAt && Date.now() >= currentUser.subscriptionEndsAt) {
      showTempToast('Licensing window expired - Renew');
      setIsRenewalOpen(true);
      return false;
    }

    if (Number.isFinite(limit) && left <= 0) {
      setIsRenewalOpen(true);
      return false;
    }

    const nextUsed = used + 1;
    const nextLeft = Number.isFinite(limit) ? Math.max(0, limit - nextUsed) : 999999;

    handleSaveUser({
      ...currentUser,
      analysesUsed: nextUsed,
      freeAnalyses: nextLeft,
      freeAnalysesLeft: nextLeft,
      analysesLeft: nextLeft,
    });
    return true;
  };

  const handleAnalyzeProperty = (property: PropertyListing) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    fetch('/api/app?action=underwrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: user.email,
        name: user.name,
        propertyTitle: property.title,
        city: property.city,
        priceUSD: property.basePriceUSD,
        rentUSD: property.baseRentMonthlyUSD,
      }),
    })
      .then(async (res) => {
        if (res.status === 429) {
          showTempToast('Rate limit exceeded (10 analyses/min). Please wait.');
          return;
        }
        if (res.status === 403) {
          setIsRenewalOpen(true);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data?.license) {
          const nextLeft = data.license.isUnlimitedAnalyses ? 999999 : data.license.analysesLeft;
          handleSaveUser({
            ...user,
            plan: data.license.planKey || user.plan,
            analysesUsed: data.license.analysesUsed,
            freeAnalyses: nextLeft,
            freeAnalysesLeft: nextLeft,
            analysesLeft: nextLeft,
          });
        } else {
          consumeAnalysis();
        }
        setActivePropertyAnalysis(property);
      })
      .catch(() => {
        if (consumeAnalysis()) setActivePropertyAnalysis(property);
      });
  };

  const handleSaveConfig = (updated: RemoteConfig) => {
    setConfig(updated);
    localStorage.setItem('aqari_remote_config', JSON.stringify(updated));
  };

  const handleResetConfig = () => {
    localStorage.removeItem('aqari_remote_config');
    localStorage.removeItem('aqari_remote_config_cached');
    setConfig(DEFAULT_CONFIG);
  };

  const lastSyncDisplay = marketLive?.last_synced_display || 'Synced Daily';
  const liveAnnouncementText = marketLive
    ? `LIVE MACRO SYNC (${lastSyncDisplay}): US 10Y ${marketLive.macro.us_10y_yield}% (FRED) • Muscat vs US10Y +${marketLive.metrics.muscat_vs_us10y_bps} bps • Dubai DLD Index ${marketLive.metrics.dubai_dld_index} pts`
    : 'AQARI TERMINAL • Syncing World Bank, FRED, DLD, ONS & JLL Market Feeds...';

  // Reusable Legal Footer across public views
  const renderLegalFooter = () => (
    <footer className="mt-20 border-t border-white/[0.08] bg-black/95 backdrop-blur-2xl py-10 px-4 lg:px-8 relative z-20 text-xs text-zinc-400 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-center">
          <PWAInstallButton variant="footer" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <div className="text-white font-bold tracking-tight">
              © 2026 Loomora Studios - AQARI TERMINAL. All rights reserved.
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              Bloomberg-style UI, not affiliated with Bloomberg L.P.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <button onClick={() => navigateLegal('terms')} className="hover:text-[#D4AF37] underline cursor-pointer">
              Terms
            </button>
            <span className="text-zinc-700">|</span>
            <button onClick={() => navigateLegal('privacy')} className="hover:text-[#D4AF37] underline cursor-pointer">
              Privacy
            </button>
            <span className="text-zinc-700">|</span>
            <button onClick={() => navigateLegal('refund')} className="hover:text-[#D4AF37] underline cursor-pointer">
              Refund
            </button>
            <span className="text-zinc-700">|</span>
            <button onClick={() => navigateLegal('disclaimer')} className="hover:text-[#D4AF37] underline cursor-pointer">
              Disclaimer
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-white/[0.06] text-[11px] text-zinc-500 text-center md:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Market data is indicative, synced daily from public sources. Not financial advice. Data as of {lastSyncDisplay}.
          </span>
          <a href="mailto:loomora.studios@gmail.com" className="text-zinc-400 hover:text-[#D4AF37]">
            loomora.studios@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );

  // Maintenance Screen
  if (config.maintenance) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden select-none">
        <AmbientBackground />
        <div className="z-10 max-w-lg glass-panel p-10 border border-rose-500/30">
          <AlertOctagon className="w-16 h-16 text-rose-500 mx-auto mb-4 animate-pulse" />
          <h1 className="text-3xl font-bold tracking-tight text-white">TERMINAL UNDER MAINTENANCE</h1>
          <p className="text-sm text-zinc-400 mt-2 font-mono leading-relaxed">
            Global market feeds and institutional real estate indices are undergoing scheduled maintenance. Access will resume momentarily.
          </p>
        </div>
      </div>
    );
  }

  // View: Post-Checkout Full-Screen Unlocking Verification Screen (/app?checkout=success)
  if (route === 'checkout-verifying') {
    const activeEmail = user?.email || new URLSearchParams(window.location.search).get('email') || 'your account';
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
        <AmbientBackground />
        <div className="z-10 max-w-lg w-full glass-panel p-8 sm:p-10 rounded-[32px] border border-[#D4AF37]/40 text-center space-y-5 shadow-[0_0_60px_rgba(212,175,55,0.2)]">
          <Loader2 className={`w-12 h-12 text-[#D4AF37] mx-auto ${isRetryingVerify ? 'animate-spin' : ''}`} />
          <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
            {verifyError ? 'VERIFICATION PENDING' : 'PAYMENT SUCCESSFUL • VERIFYING LICENSE'}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome to AQARI TERMINAL
          </h1>
          <p className="text-sm font-mono text-zinc-200 leading-relaxed">
            {isRetryingVerify
              ? `Unlocking for ${activeEmail}...`
              : verifyError
              ? `Verifying order for ${activeEmail}`
              : `Welcome to AQARI ${verifyingPlanName} — Unlocking for ${activeEmail}...`}
          </p>

          {verifyError && (
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-left text-xs font-mono text-rose-200 leading-relaxed space-y-2">
              <div className="font-bold text-rose-400 uppercase">Verification Error</div>
              <div>{verifyError}</div>
              {verifyDebug && (
                <div className="text-[11px] text-zinc-300 pt-1 border-t border-rose-500/20">
                  Checked: {verifyDebug.email_searched || activeEmail} • Orders checked:{' '}
                  {verifyDebug.total_orders_checked ?? 0} • Lemon status: {String(verifyDebug.lemon_status ?? '-')} • Key present:{' '}
                  {verifyDebug.key_present ? 'true' : 'false'}
                </div>
              )}
              {verifyFailCount >= 3 && (
                <div className="pt-2 border-t border-rose-500/30 text-amber-300 font-semibold">
                  Still locked? Go to Settings &gt; PAYMENT WEBHOOK LOGS and screenshot the error
                </div>
              )}
            </div>
          )}

          {verifyError && (
            <div className="space-y-4 pt-1 text-left">
              <button
                type="button"
                disabled={isRetryingVerify}
                onClick={() => runCheckoutVerification()}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-black text-xs font-mono uppercase tracking-wider transition cursor-pointer shadow-lg disabled:opacity-60 min-h-[48px]"
              >
                {isRetryingVerify ? 'Unlocking Terminal...' : 'CLICK TO UNLOCK - RETRY'}
              </button>

              {/* Fallback Input 1: Email used for payment */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <label className="block text-xs font-mono font-bold text-[#D4AF37]">
                  Email used for payment (if different)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={manualPaymentEmail}
                    onChange={(e) => setManualPaymentEmail(e.target.value)}
                    placeholder="Email used for payment (if different)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="button"
                    disabled={isRetryingVerify || !manualPaymentEmail.trim()}
                    onClick={() => runCheckoutVerification({ email: manualPaymentEmail.trim() })}
                    className="px-4 py-2.5 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs font-mono transition cursor-pointer disabled:opacity-50 shrink-0 min-h-[44px]"
                  >
                    Retry with this email
                  </button>
                </div>
              </div>

              {/* Fallback Input 2: Order ID from Lemon receipt email */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <label className="block text-xs font-mono font-bold text-[#D4AF37]">
                  Order ID from Lemon receipt email (optional)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={manualOrderId}
                    onChange={(e) => setManualOrderId(e.target.value)}
                    placeholder="Order ID from Lemon receipt email (optional)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-mono outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="button"
                    disabled={isRetryingVerify || !manualOrderId.trim()}
                    onClick={() => runCheckoutVerification({ orderId: manualOrderId.trim() })}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono transition cursor-pointer disabled:opacity-50 shrink-0 min-h-[44px]"
                  >
                    Verify with Order ID
                  </button>
                </div>
                <p className="text-[11px] font-mono text-zinc-400 leading-relaxed">
                  Check your Gmail for Lemon receipt - The order ID looks like 123456789 - انسخ Order ID من إيميل فاتورة Lemon
                </p>
              </div>

              {verifyFailCount >= 3 && user && (
                <button
                  type="button"
                  onClick={() => {
                    window.history.replaceState({}, document.title, '/app');
                    setRoute('terminal');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-zinc-200 font-mono text-xs transition cursor-pointer"
                >
                  Open Terminal Settings &amp; Webhook Logs
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // View: Public Legal Pages (/terms, /privacy, /refund, /disclaimer) - No login required
  if (route === 'terms' || route === 'privacy' || route === 'refund' || route === 'disclaimer') {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#D4AF37]/30 selection:text-white relative">
        <AmbientBackground />
        <CustomCursor />
        <Navbar
          currentCurrency={currency}
          onCurrencyChange={handleCurrencyChange}
          user={user}
          config={config}
          onOpenAuth={() => setIsAuthOpen(true)}
          onSignOut={handleSignOut}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onGoToTerminal={handleGoToTerminal}
          onOpenPricing={handleGoToPricing}
          onGoToHome={handleGoToHome}
        />
        <div className="flex-1">
          <LegalPages
            slug={route}
            onGoHome={handleGoToHome}
            onNavigateLegal={navigateLegal}
          />
        </div>
        {renderLegalFooter()}
        {isAuthOpen && (
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => setIsAuthOpen(false)}
            onSignIn={handleSignIn}
          />
        )}
      </div>
    );
  }

  // View: Owner-Only Forensic Admin Dashboard (/admin)
  if (route === 'admin') {
    if (!isOwnerAdminEmail(user?.email)) {
      return null;
    }
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col relative">
        <AmbientBackground />
        <AdminDashboard
          currentUser={user}
          onRedirectHome={(reason) => {
            if (reason) showTempToast(reason, 4000);
            handleGoToHome();
          }}
          onPricingUpdated={(updated) => setPricingData(updated)}
        />
      </div>
    );
  }

  // View: Public Demo Analyses (No Login Required)
  if (route === 'demo') {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#D4AF37]/30 selection:text-white relative">
        <AmbientBackground />
        <CustomCursor />
        <DemoAnalysisView
          slug={demoSlug}
          currentCurrency={currency}
          onCurrencyChange={handleCurrencyChange}
          onOpenAuth={() => setIsAuthOpen(true)}
          onGoHome={handleGoToHome}
          onSelectOtherDemo={(s) => {
            setDemoSlug(s);
            window.history.pushState({}, '', `/demo/${s}`);
          }}
        />
        {renderLegalFooter()}
        {isAuthOpen && (
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => setIsAuthOpen(false)}
            onSignIn={handleSignIn}
          />
        )}
      </div>
    );
  }

  // View: Payment Success
  if (route === 'payment-success') {
    return (
      <PaymentSuccessView
        currentUser={user}
        onEnterTerminal={handleGoToTerminal}
        onGoToHome={handleGoToHome}
      />
    );
  }

  // View: Standalone Pricing Page
  if (route === 'pricing') {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#D4AF37]/30 selection:text-white relative">
        <AmbientBackground />
        <CustomCursor />
        <Navbar
          currentCurrency={currency}
          onCurrencyChange={handleCurrencyChange}
          user={user}
          config={config}
          onOpenAuth={() => setIsAuthOpen(true)}
          onSignOut={handleSignOut}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onGoToTerminal={handleGoToTerminal}
          onOpenPricing={handleGoToPricing}
          onGoToHome={handleGoToHome}
        />
        <div className="flex-1">
          <PricingSection
            isStandalonePage={true}
            currentCurrency={currency}
            config={config}
            pricingData={pricingData}
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
            onTestUnlock={handleAdminTestUnlock}
            onGoToTerminal={handleGoToTerminal}
            onOpenLegal={navigateLegal}
          />
        </div>
        {renderLegalFooter()}
        {isAuthOpen && (
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => setIsAuthOpen(false)}
            onSignIn={handleSignIn}
          />
        )}
      </div>
    );
  }

  const isTerminal = route === 'terminal' && !!user;

  return (
    <>
      <AnnouncementBanner text={liveAnnouncementText} />

      {terminalToast && (
        <div id="terminalToast" className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-zinc-900 border border-[#D4AF37]/50 text-white text-xs font-mono shadow-[0_10px_35px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2.5 backdrop-blur-xl">
          <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span>{terminalToast}</span>
        </div>
      )}

      {/* VIEW: TERMINAL DASHBOARD APP */}
      <div
        id="terminalPage"
        style={{ display: isTerminal ? 'block' : 'none' }}
        className="min-h-screen bg-black text-slate-100 selection:bg-[#D4AF37]/30 selection:text-white relative"
      >
        {user && !serverSynced ? (
          <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
            <div className="text-center space-y-3">
              <Loader2 className="w-10 h-10 text-[#D4AF37] animate-spin mx-auto" />
              <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Synchronizing Server License Entitlements...
              </div>
            </div>
          </div>
        ) : user ? (
          <>
            <AmbientBackground />
            <CustomCursor />
            <TerminalDashboard
              user={user}
              currentCurrency={currency}
              onCurrencyChange={handleCurrencyChange}
              config={config}
              pricingData={pricingData}
              marketLive={marketLive}
              onSignOut={handleSignOut}
              onGoToHome={handleGoToHome}
              onGoToPricing={handleGoToPricing}
              onOpenRenewal={() => setIsRenewalOpen(true)}
              onUpdateUser={handleSaveUser}
              onConsumeAnalysis={consumeAnalysis}
              onOpenAuth={() => setIsAuthOpen(true)}
              initialToast={terminalToast}
            />
          </>
        ) : null}
      </div>

      {/* VIEW: LANDING PAGE */}
      <div
        id="landingPage"
        style={{ display: isTerminal ? 'none' : 'block' }}
        className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#D4AF37]/30 selection:text-white relative"
      >
        <AmbientBackground />
        <CustomCursor />

        <Navbar
          currentCurrency={currency}
          onCurrencyChange={handleCurrencyChange}
          user={user}
          config={config}
          onOpenAuth={() => setIsAuthOpen(true)}
          onSignOut={handleSignOut}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onGoToTerminal={handleGoToTerminal}
          onOpenPricing={() => {
            const el = document.getElementById('pricing');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          onGoToHome={handleGoToHome}
        />

        <MarqueeTicker marketLive={marketLive} />

        {unlockSuccessMsg && (
          <div className="max-w-4xl mx-auto px-4 mt-6 z-20 w-full animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#D4AF37]/20 via-emerald-500/20 to-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-between gap-3 backdrop-blur-xl shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-white font-mono">
                  {unlockSuccessMsg}
                </span>
              </div>
              <button
                onClick={() => setUnlockSuccessMsg(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 space-y-10">
          <Hero
            currentCurrency={currency}
            selectedCity={selectedCity}
            user={user}
            marketLive={marketLive}
            onSelectCity={(city) => setSelectedCity(city)}
            onExploreProperties={() => {
              const el = document.getElementById('properties');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            onExploreSimulator={() => {
              const el = document.getElementById('yield-simulator');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            onOpenAuth={() => setIsAuthOpen(true)}
            onSignOut={() => handleSignOut(false)}
            onGoToTerminal={handleGoToTerminal}
          />

          <PropertyGrid
            properties={PROPERTY_LISTINGS}
            currentCurrency={currency}
            selectedCity={selectedCity}
            user={user}
            onAnalyze={handleAnalyzeProperty}
            onOpenPricing={() => {
              const el = document.getElementById('pricing');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            onOpenDemo={(slug) => {
              setDemoSlug(slug);
              setRoute('demo');
              window.history.pushState({}, '', `/demo/${slug}`);
            }}
          />

          <YieldSimulator
            currentCurrency={currency}
            user={user}
            onAnalyzeSimulation={() => {}}
          />

          <CrossBorderMatrix
            currentCurrency={currency}
            matrixData={matrixData}
            lastSyncedDisplay={lastSyncDisplay}
            user={user}
            onOpenPricing={() => {
              const el = document.getElementById('pricing');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          <PortfolioSummary
            currentCurrency={currency}
            marketLive={marketLive}
            onExploreAssets={() => {
              const el = document.getElementById('properties');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* Live Google News RSS Real Estate Headlines (hidden cleanly if RSS unavailable) */}
          {newsArticles.length > 0 && (
            <section className="py-12 px-4 lg:px-8 max-w-7xl mx-auto relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] mb-1">
                    <Newspaper className="w-4 h-4" />
                    <span>LIVE REAL ESTATE WIRE • GOOGLE NEWS RSS</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Global Property Market Headlines
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  Top {newsArticles.length} headlines
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {newsArticles.map((article, i) => (
                  <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-panel p-5 border border-white/[0.08] hover:border-[#D4AF37]/50 transition flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#D4AF37]">
                        <span className="uppercase font-bold">{article.source}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                      </div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-[#D4AF37] transition line-clamp-2 leading-snug">
                        {article.title}
                      </h3>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {article.pubDate}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          <PricingSection
            currentCurrency={currency}
            config={config}
            pricingData={pricingData}
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
            onTestUnlock={handleAdminTestUnlock}
            onGoToTerminal={handleGoToTerminal}
            onOpenLegal={navigateLegal}
          />
        </main>

        {renderLegalFooter()}
      </div>

      {/* Bottom Toast Announcement */}
      {config.announcement.active && showToast && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm rounded-2xl glass-dropdown p-4 border border-cyan-500/30 shadow-[0_15px_40px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  Terminal Broadcast
                </div>
                <div className="text-xs text-white mt-0.5 font-medium">
                  {config.announcement.text}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="text-zinc-500 hover:text-white transition p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSignIn={handleSignIn}
      />

      <LimitModal
        isOpen={isLimitOpen}
        onClose={() => setIsLimitOpen(false)}
        user={user}
        config={config}
        pricingData={pricingData}
        currentCurrency={currency}
        onTestUnlock={handleAdminTestUnlock}
        onOpenPricing={() => {
          const el = document.getElementById('pricing');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      <RenewalModal
        isOpen={isRenewalOpen}
        onClose={() => setIsRenewalOpen(false)}
        user={user}
        config={config}
        pricingData={pricingData}
        currentCurrency={currency}
      />

      <AnalysisModal
        property={activePropertyAnalysis}
        currentCurrency={currency}
        user={user}
        onClose={() => setActivePropertyAnalysis(null)}
        onOpenUpgrade={() => setIsRenewalOpen(true)}
        onSaveAnalysis={(prop) => {
          if (!user) {
            setIsAuthOpen(true);
            return;
          }
          const planCfg = PLANS[normalizePlanKey(user.plan)];
          const currentSaved = user.savedAnalyses || [];
          const overLimit =
            !canUseFeature(user.plan, 'saveProperty') ||
            (Number.isFinite(planCfg.savedLimit) && currentSaved.length >= planCfg.savedLimit);
          if (overLimit) {
            showTempToast('Upgrade to save more', 3000);
            setIsRenewalOpen(true);
            return;
          }
          const newAnalysis = {
            id: 'saved_' + Date.now(),
            property: prop.title,
            city: prop.city,
            price: prop.basePriceUSD,
            rent: prop.baseRentMonthlyUSD,
            capRate: prop.capRate,
            cashOnCash: Number((prop.capRate + 1.2).toFixed(2)),
            irr: Number((prop.capRate + 5.0).toFixed(1)),
            dscr: '1.75',
            monthlyCashflow: Math.round(prop.baseRentMonthlyUSD * 0.8),
            riskScore: prop.tenantRiskScore,
            date: Date.now(),
            imageUrl: prop.imageUrl,
          };
          handleSaveUser({
            ...user,
            savedAnalyses: [newAnalysis, ...currentSaved],
          });
          fetch('/api/app?action=save-property', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              email: user.email,
              savedCount: currentSaved.length,
              analysis: newAnalysis,
            }),
          }).catch(() => {});
        }}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onResetConfig={handleResetConfig}
        onTestUnlock={handleAdminTestUnlock}
      />
    </>
  );
}
