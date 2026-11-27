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
import { getPaddleClient, getPaddleClientToken, getPaddleEnvironment } from './utils/paddleClient';
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

const OWNER_ADMIN_EMAILS = ['loomorastudios@gmail.com', 'azzamalshmale@gmail.com'];
const isOwnerAdminEmail = (email?: string | null) =>
  Boolean(email && OWNER_ADMIN_EMAILS.includes(email.trim().toLowerCase()));

export default function App() {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    try {
      localStorage.removeItem('aqari_currency');
    } catch {}
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
      if (path === '/refund' || path === '/refund-policy' || hash === '#/refund' || hash === '#/refund-policy') return 'refund';
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
  const [limitModalMode, setLimitModalMode] = useState<'quota' | 'enterprise_showcase'>('quota');
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
  const [verifyState, setVerifyState] = useState<'verifying' | 'activated' | 'error'>('verifying');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [checkoutUrlOrderId, setCheckoutUrlOrderId] = useState<string | null>(null);
  const [manualOrderId, setManualOrderId] = useState<string>('');
  const [verifiedSummary, setVerifiedSummary] = useState<{
    plan: string;
    analysesLeft: number | string;
    purchaseType?: 'plan' | 'credit_pack';
    creditsBalance?: number;
  } | null>(null);
  const [serverSynced, setServerSynced] = useState<boolean>(() => !getSessionUser());
  const [meError, setMeError] = useState<string | null>(null);
  const [syncTrigger, setSyncTrigger] = useState<number>(0);

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
    window.history.pushState({}, '', slug === 'refund' ? '/refund-policy' : `/${slug}`);
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

  const handleGoToHomePricing = () => {
    window.history.pushState({}, '', '/#pricing');
    setRoute('landing');
    window.setTimeout(() => {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    }, 90);
  };

  // Listen to hash and pathname changes
  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      const currentUser = getSessionUser();

      if (path === '/terms' || hash === '#/terms') return setRoute('terms');
      if (path === '/privacy' || hash === '#/privacy') return setRoute('privacy');
      if (path === '/refund' || path === '/refund-policy' || hash === '#/refund' || hash === '#/refund-policy') return setRoute('refund');
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
      if (hash === '#pricing') {
        setRoute('landing');
        window.setTimeout(() => {
          document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
        }, 90);
        return;
      }
      if (path === '/' || hash === '#/landing' || hash === '' || hash === '#') {
        setRoute('landing');
      }
    };

    if (window.location.pathname === '/' && window.location.hash === '#pricing') {
      window.setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }

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

  const handleCurrencyChange = (_newCurrency: CurrencyCode) => {
    setCurrency('USD');
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

  // Day 29 Expiration Reminder Modal Check (paid 30-day plans only, once per day)
  useEffect(() => {
    if (user && user.plan !== 'free') {
      const expiry = user.subscriptionEndsAt ?? user.subscriptionExpiry;
      const msLeft = expiry ? expiry - Date.now() : 0;
      const isDay29 = Boolean(user.day29Reminder) || (msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000);
      if (isDay29) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (user.lastReminderDate !== todayStr) {
          const updated: User = { ...user, lastReminderDate: todayStr };
          setUser(updated);
          saveUser(updated);
          setIsRenewalOpen(true);
        }
      }
    }
  }, [user]);

  const cleanPlaceholderOrderId = (raw?: string | null): string => {
    const cleaned = String(raw || '').replace(/^#/, '').trim();
    const lower = cleaned.toLowerCase();
    if (
      !cleaned ||
      cleaned === '{ORDER_ID}' ||
      cleaned === '[order_id]' ||
      cleaned === '{order_id}' ||
      lower === 'null' ||
      lower === 'undefined' ||
      lower === 'none' ||
      lower === 'empty'
    ) {
      return '';
    }
    return cleaned;
  };

  const applyVerifiedUserPayload = (data: any, meData: any, fallbackEmail: string) => {
    const sessionUser = getSessionUser();
    const existing = sessionUser || user;
    const verifiedPlan = normalizePlanKey(
      meData?.planKey || data?.planKey || data?.user?.plan
    );
    const verifiedCfg = PLANS[verifiedPlan];
    const planDisplay =
      meData?.plan_name ||
      meData?.plan ||
      data?.plan_name ||
      data?.plan ||
      verifiedCfg.displayName;
    const planPrice =
      typeof meData?.price === 'number'
        ? meData.price
        : typeof data?.price === 'number'
        ? data.price
        : verifiedCfg.priceUSD;
    const planFeatures: string[] = Array.isArray(meData?.features)
      ? meData.features
      : Array.isArray(data?.features)
      ? data.features
      : verifiedCfg.features;
    const analysesLeftVal =
      meData?.analyses_left ??
      data?.analyses_left ??
      (Number.isFinite(verifiedCfg.analysesLimit) ? verifiedCfg.analysesLimit : 999999);

    const serverUsed = Number(meData?.analyses_used ?? data?.user?.analyses_used ?? 0);
    const numericLeft =
      typeof analysesLeftVal === 'number'
        ? analysesLeftVal
        : Number.isFinite(verifiedCfg.analysesLimit)
        ? verifiedCfg.analysesLimit
        : 999999;

    const licenseStartVal = meData?.license_start ?? data?.user?.license_start ?? Date.now();
    const licenseEndVal =
      meData?.license_end ?? data?.license_end ?? data?.user?.license_end ?? null;

    const maxSavedVal =
      typeof meData?.maxSaved === 'number'
        ? meData.maxSaved
        : verifiedCfg.savedLimit;
    const serverSavedList =
      Array.isArray(meData?.saved_analyses) && meData.saved_analyses.length > 0
        ? meData.saved_analyses
        : existing?.savedAnalyses || [];

    const resolvedEmail = meData?.email || data?.login_email || fallbackEmail || existing?.email || '';
    const updatedUser: User = {
      ...(existing || {
        id: 'user_' + Date.now(),
        email: resolvedEmail,
        name: resolvedEmail.split('@')[0],
        avatar: resolvedEmail.charAt(0).toUpperCase(),
        provider: 'google',
        createdAt: Date.now(),
        savedAnalyses: [],
      }),
      email: resolvedEmail,
      plan: verifiedPlan,
      planName: planDisplay,
      planPrice,
      features: planFeatures,
      maxSaved: maxSavedVal,
      savedCount:
        typeof meData?.saved_count === 'number'
          ? meData.saved_count
          : serverSavedList.length,
      savedAnalyses: serverSavedList,
      apiKey: meData?.api_key ?? null,
      apiKeyLast4: meData?.api_key_last4 ?? existing?.apiKeyLast4 ?? null,
      subscriptionPlan: verifiedPlan,
      subscriptionStatus:
        verifiedPlan === 'free'
          ? 'free'
          : Boolean(meData?.package_expired ?? data?.package_expired)
          ? 'expired'
          : 'active',
      subscriptionStartAt: licenseStartVal,
      subscriptionEndsAt: licenseEndVal,
      subscriptionExpiry: licenseEndVal,
      analysesUsed: serverUsed,
      analysesTotal: Number(meData?.analyses_total ?? data?.analyses_total ?? verifiedCfg.analysesLimit),
      successfulAnalyses: Number(meData?.successful_analyses ?? data?.user?.successful_analyses ?? 0),
      freeAnalyses: numericLeft,
      freeAnalysesLeft: numericLeft,
      analysesLeft: numericLeft,
      planAnalysesLeft: typeof (meData?.plan_analyses_left ?? data?.plan_analyses_left) === 'number'
        ? Number(meData?.plan_analyses_left ?? data?.plan_analyses_left)
        : existing?.planAnalysesLeft,
      extraCredits: Number(meData?.extra_credits ?? data?.extra_credits ?? data?.user?.extra_credits ?? existing?.extraCredits ?? 0),
      creditsBalance: Number(meData?.credits_balance ?? meData?.extra_credits ?? data?.extra_credits ?? data?.user?.extra_credits ?? existing?.creditsBalance ?? 0),
      packageExpired: Boolean(meData?.package_expired ?? data?.package_expired ?? false),
      creditsOnlyMode: Boolean(meData?.credits_only_mode ?? data?.credits_only_mode ?? false),
      day29Reminder: Boolean(meData?.day29Reminder ?? false),
      expiryBanner: meData?.expiryBanner ?? null,
      expiryDateFormatted: meData?.expiryDateFormatted ?? null,
      imagePdfUsed: Number(meData?.image_pdf_used ?? data?.image_pdf_used ?? data?.user?.image_pdf_used ?? existing?.imagePdfUsed ?? 0),
      imagePdfLimit: Number(meData?.image_pdf_limit ?? data?.image_pdf_limit ?? verifiedCfg.imagePdfLimit),
      aiListingsUsed: Number(meData?.ai_listings_used ?? data?.ai_listings_used ?? data?.user?.ai_listings_used ?? existing?.aiListingsUsed ?? 0),
      aiListingLimit: Number(meData?.ai_listing_limit ?? data?.ai_listing_limit ?? verifiedCfg.aiListingLimit),
      pdfsUsed: Number(meData?.pdfs_used ?? data?.pdfs_used ?? data?.user?.pdfs_used ?? existing?.pdfsUsed ?? 0),
      investmentPdfLimit: Number(meData?.investment_pdf_limit ?? data?.investment_pdf_limit ?? verifiedCfg.investmentPdfLimit),
      portfolioAssetsLimit: Number(meData?.portfolio_assets_limit ?? data?.portfolio_assets_limit ?? verifiedCfg.portfolioAssetsLimit),
      compareLimit: Number(meData?.compare_limit ?? data?.compare_limit ?? verifiedCfg.compareLimit),
      teamUsersLimit: Number(meData?.team_users_limit ?? data?.team_users_limit ?? verifiedCfg.teamUsersLimit),
      apiDailyLimit: Number(meData?.api_daily_limit ?? data?.api_daily_limit ?? verifiedCfg.apiDailyLimit),
      apiCallsToday: Number(meData?.api_calls_today ?? data?.api_calls_today ?? existing?.apiCallsToday ?? 0),
      branding: meData?.branding ?? data?.branding ?? data?.user?.branding ?? existing?.branding ?? null,
      status: String(meData?.status ?? data?.status ?? 'active'),
      locked: Boolean(meData?.locked ?? data?.locked ?? false),
      lockReason: meData?.lockReason ?? data?.lockReason ?? null,
      lockError: meData?.lockError ?? data?.lockError ?? null,
      lockedLaunchPrice:
        meData?.locked_launch_price ?? data?.user?.locked_launch_price ?? null,
      customCities: Array.isArray(meData?.custom_cities)
        ? meData.custom_cities
        : Array.isArray(data?.user?.custom_cities)
        ? data.user.custom_cities
        : existing?.customCities || [],
      analystUnread: typeof meData?.analyst_unread === 'number' ? meData.analyst_unread : existing?.analystUnread || 0,
      whiteGloveRequests: Array.isArray(meData?.whiteglove_requests) ? meData.whiteglove_requests : existing?.whiteGloveRequests || [],
      whiteGloveDeliverables: Array.isArray(meData?.whiteglove_deliverables) ? meData.whiteglove_deliverables : existing?.whiteGloveDeliverables || [],
      hasReportedIssue: Boolean(meData?.has_reported_issue ?? data?.user?.has_reported_issue),
      issueReportedAt: meData?.issue_reported_at ?? data?.user?.issue_reported_at ?? null,
      issueResolvedAt: meData?.issue_resolved_at ?? data?.user?.issue_resolved_at ?? null,
      issueDescription: meData?.issue_description ?? data?.user?.issue_description ?? '',
      issueStatus: meData?.issue_status ?? data?.user?.issue_status ?? 'none',
      cancelStatus: meData?.cancel_status ?? data?.user?.cancel_status ?? 'none',
      lastOrderId: meData?.last_order_id ?? data?.user?.last_order_id ?? null,
      lastResults: meData?.last_results ?? data?.user?.last_results ?? null,
      portfolioAssets: Array.isArray(meData?.portfolio_assets)
        ? meData.portfolio_assets
        : Array.isArray(data?.user?.portfolio_assets)
        ? data.user.portfolio_assets
        : existing?.portfolioAssets || [],
      whiteLabelEnabled:
        typeof meData?.white_label_enabled === 'boolean'
          ? meData.white_label_enabled
          : typeof data?.user?.white_label_enabled === 'boolean'
          ? data.user.white_label_enabled
          : existing?.whiteLabelEnabled,
      customApiEnabled:
        typeof meData?.custom_api_enabled === 'boolean'
          ? meData.custom_api_enabled
          : typeof data?.user?.custom_api_enabled === 'boolean'
          ? data.user.custom_api_enabled
          : existing?.customApiEnabled,
      customAnalysesLimit: meData?.custom_analyses_limit ?? data?.user?.custom_analyses_limit ?? existing?.customAnalysesLimit ?? null,
      customImagePdfLimit: meData?.custom_image_pdf_limit ?? data?.user?.custom_image_pdf_limit ?? existing?.customImagePdfLimit ?? null,
      customListingsLimit: meData?.custom_listings_limit ?? data?.user?.custom_listings_limit ?? existing?.customListingsLimit ?? null,
      customPortfolioLimit: meData?.custom_portfolio_limit ?? data?.user?.custom_portfolio_limit ?? existing?.customPortfolioLimit ?? null,
      customSeats: meData?.custom_seats ?? data?.user?.custom_seats ?? existing?.customSeats ?? null,
      customStorageGb: meData?.custom_storage_gb ?? data?.user?.custom_storage_gb ?? existing?.customStorageGb ?? null,
      slaLevel: meData?.sla_level ?? data?.user?.sla_level ?? existing?.slaLevel ?? null,
      contractEndDate: meData?.contract_end_date ?? data?.user?.contract_end_date ?? existing?.contractEndDate ?? null,
      cancellationEligibility: meData?.cancellationEligibility ?? data?.cancellationEligibility ?? null,
      expiryEmailSent: false,
    };

    saveUser(updatedUser);
    setUser(updatedUser);
    setServerSynced(true);
    return { updatedUser, planDisplay, analysesLeftVal, verifiedPlan };
  };

  const runAutoVerifyCheckout = async (overrideOrderId?: string) => {
    setVerifyState('verifying');
    setVerifyError(null);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlOrderId = cleanPlaceholderOrderId(
        urlParams.get('transaction_id') ||
          urlParams.get('_ptxn') ||
          urlParams.get('order_id') ||
          urlParams.get('order')
      );
      setCheckoutUrlOrderId(urlOrderId || null);

      // 1. Get login_email from /api/app?action=me
      let loginEmail = '';
      try {
        const meRes = await fetch(`/api/app?action=me&t=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (meRes.ok) {
          const meJson = await meRes.json().catch(() => null);
          if (meJson?.email) {
            loginEmail = String(meJson.email).trim().toLowerCase();
          }
        }
      } catch {}

      const sessionUser = getSessionUser();
      if (!loginEmail) {
        loginEmail = String(user?.email || sessionUser?.email || '').trim().toLowerCase();
      }

      if (!loginEmail) {
        setVerifyState('error');
        setVerifyError('Please sign in first to activate your terminal.');
        return;
      }

      const targetOrderId =
        overrideOrderId && overrideOrderId !== 'LAST'
          ? cleanPlaceholderOrderId(overrideOrderId)
          : urlOrderId;

      // 2. Verify checkout with /api/app?action=verify-payment when txn ID present, or checkPaymentStatus via DB
      const verifyRes = await fetch(
        targetOrderId
          ? '/api/app?action=verify-payment'
          : `/api/app?action=checkPaymentStatus&t=${Date.now()}`,
        targetOrderId
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                transaction_id: targetOrderId,
              }),
            }
          : {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            }
      );

      const rawText = await verifyRes.text().catch(() => '');
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (verifyRes.ok && data?.success && (targetOrderId || data?.verified)) {
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

        const isCreditPackCheckout = data?.purchase_type === 'credit_pack';
        const { planDisplay, analysesLeftVal, verifiedPlan, updatedUser } = applyVerifiedUserPayload(
          data,
          meData,
          loginEmail
        );
        const summaryLabel = isCreditPackCheckout
          ? String(data?.pack?.label || '+25 AI Credits')
          : planDisplay;
        setVerifyingPlanName(summaryLabel);
        setVerifiedSummary({
          plan: summaryLabel,
          analysesLeft: analysesLeftVal,
          purchaseType: isCreditPackCheckout ? 'credit_pack' : 'plan',
          creditsBalance: updatedUser.creditsBalance ?? updatedUser.extraCredits ?? 0,
        });
        setVerifyState('activated');

        try {
          confetti({
            particleCount: 160,
            spread: 85,
            origin: { y: 0.6 },
            colors: ['#D4AF37', '#F3E5AB', '#8B5CF6', '#06B6D4'],
          });
        } catch {}

        const unlockBanner = isCreditPackCheckout
          ? data?.message ||
            `Added ${summaryLabel} — Credits Balance: ${updatedUser.creditsBalance ?? 0} (Never expires)`
          : data?.switched && data?.message
          ? String(data.message)
          : verifiedPlan === 'pro'
          ? 'One-time 30-day PRO access activated! PRO plan is now active.'
          : data?.message || `Welcome to ${planDisplay} — Payment Successful!`;
        const unlockToast = isCreditPackCheckout
          ? `${summaryLabel} added to your balance!`
          : data?.switched && data?.message
          ? String(data.message)
          : verifiedPlan === 'pro'
          ? 'One-time 30-day PRO access activated!'
          : `Welcome to AQARI ${planDisplay} - Unlocked for 30 Days!`;
        try {
          sessionStorage.setItem('aqari_unlock_msg', unlockBanner);
          sessionStorage.setItem('aqari_unlock_toast', unlockToast);
        } catch {}

        setTimeout(() => {
          setUnlockSuccessMsg(unlockBanner);
          showTempToast(unlockToast, 5000);
          window.history.replaceState({}, document.title, '/app');
          setRoute('terminal');
          window.scrollTo(0, 0);
        }, 850);
        return;
      }

      const realError = rawText.includes('FUNCTION_INVOCATION_FAILED')
        ? `Server function failed to start. Check Vercel > Logs > FUNCTION_INVOCATION_FAILED for first Error line.\n\n${rawText.trim().slice(0, 350)}`
        : data?.error ||
          data?.message ||
          (rawText && !rawText.trim().startsWith('<') ? rawText.trim().slice(0, 350) : '') ||
          `Unable to verify payment (status ${verifyRes.status})`;
      setVerifyState('error');
      setVerifyError(realError);
    } catch (err: any) {
      setVerifyState('error');
      setVerifyError(err?.message || 'Unable to verify payment with server.');
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
      runAutoVerifyCheckout();
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

    getPaddleEnvironment();
    if (getPaddleClientToken()) {
      void getPaddleClient().catch((err) => {
        console.warn('[Paddle] Startup init warning:', err);
      });
    } else {
      console.warn('Missing VITE_PADDLE_CLIENT_TOKEN / NEXT_PUBLIC_PADDLE_CLIENT_TOKEN');
    }

    const handlePaddleVerified = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (!detail?.verifyData) return;
      const { verifyData, meData, message } = detail;
      const fallbackEmail = String(verifyData?.login_email || user?.email || '').trim().toLowerCase();
      applyVerifiedUserPayload(verifyData, meData, fallbackEmail);
      const successMsg = message || 'Subscription activated! PRO plan is now active.';
      setUnlockSuccessMsg(successMsg);
      showTempToast(successMsg, 6000);
      setIsLimitOpen(false);
      setIsRenewalOpen(false);
      try {
        confetti({
          particleCount: 160,
          spread: 85,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#F3E5AB', '#8B5CF6', '#06B6D4'],
        });
      } catch {}
    };

    const handleUserUpdatedEvent = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (!detail || typeof detail !== 'object') return;
      setUser((prev) => {
        if (!prev) return prev;
        const nextLeft =
          typeof detail.analyses_left === 'number'
            ? detail.analyses_left
            : prev.analysesLeft;
        const nextExtra =
          typeof detail.credits_balance === 'number'
            ? detail.credits_balance
            : typeof detail.extra_credits === 'number'
            ? detail.extra_credits
            : prev.creditsBalance ?? prev.extraCredits;
        const nextTotal =
          typeof detail.analyses_total === 'number'
            ? detail.analyses_total
            : prev.analysesTotal;
        const nextPlanLeft =
          typeof detail.plan_analyses_left === 'number'
            ? detail.plan_analyses_left
            : prev.planAnalysesLeft;
        const unlocked = typeof nextLeft === 'number' && nextLeft > 0;
        const nextUser: User = {
          ...prev,
          analysesLeft: nextLeft,
          freeAnalyses: nextLeft,
          freeAnalysesLeft: nextLeft,
          analysesTotal: nextTotal,
          planAnalysesLeft: nextPlanLeft,
          extraCredits: nextExtra,
          creditsBalance: nextExtra,
          packageExpired:
            typeof detail.package_expired === 'boolean' ? detail.package_expired : prev.packageExpired,
          creditsOnlyMode:
            typeof detail.credits_only_mode === 'boolean'
              ? detail.credits_only_mode
              : Boolean((typeof detail.package_expired === 'boolean' ? detail.package_expired : prev.packageExpired) && (nextExtra ?? 0) > 0),
          branding: detail.branding !== undefined ? detail.branding : prev.branding,
          status: unlocked ? (detail.package_expired ? 'expired' : 'active') : prev.status,
          locked: unlocked ? false : prev.locked,
          lockReason: unlocked ? null : prev.lockReason,
          lockError: unlocked ? null : prev.lockError,
        };
        saveUser(nextUser);
        return nextUser;
      });
      if (detail.message) {
        showTempToast(String(detail.message), 5000);
      }
      if (typeof detail.analyses_left === 'number' && detail.analyses_left > 0) {
        setIsLimitOpen(false);
        setIsRenewalOpen(false);
      }
      setSyncTrigger((c) => c + 1);
    };

    window.addEventListener('aqari:paddle-verified', handlePaddleVerified);
    window.addEventListener('aqari:user-updated', handleUserUpdatedEvent);
    return () => {
      window.removeEventListener('aqari:paddle-verified', handlePaddleVerified);
      window.removeEventListener('aqari:user-updated', handleUserUpdatedEvent);
    };
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

  // Sign In Action -> send verified Google token to server to create signed HttpOnly cookie
  const handleSignIn = async (
    newUser: User,
    authTokens?: { accessToken?: string; idToken?: string }
  ) => {
    setIsAuthOpen(false);
    setMeError(null);
    setServerSynced(false);

    if (!authTokens?.idToken && !authTokens?.accessToken) {
      handleSaveUser(null);
      setMeError('Google token verification is required to sign in.');
      setServerSynced(true);
      return;
    }

    let resolvedUser: User | null = null;
    try {
      const res = await fetch('/api/app?action=session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          idToken: authTokens?.idToken,
          accessToken: authTokens?.accessToken,
        }),
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => null);
        handleSaveUser(null);
        setMeError(errPayload?.error || 'Google authentication failed. Please sign in again.');
        setServerSynced(true);
        return;
      }
      const data = await res.json();
      if (data?.user) {
          const serverPlan = normalizePlanKey(data.planKey || data.user.plan);
          const serverCfg = PLANS[serverPlan];
          const serverTotal = Number(
            data.analyses_total ?? data.user.analyses_total ?? serverCfg.analysesLimit
          );
          const serverUsed = Number(data.analyses_used ?? data.user.analyses_used ?? 0);
          const serverLeft = Number(
            data.analyses_left ??
              data.user.analyses_left ??
              Math.max(0, serverTotal - serverUsed)
          );
          const serverMaxSaved =
            typeof data.maxSaved === 'number'
              ? data.maxSaved
              : typeof data.user.max_saved === 'number'
              ? data.user.max_saved
              : typeof data.user.maxSaved === 'number'
              ? data.user.maxSaved
              : serverCfg.savedLimit;
          const serverSaved = Array.isArray(data.saved_analyses)
            ? data.saved_analyses
            : Array.isArray(data.user.saved_analyses)
            ? data.user.saved_analyses
            : [];
          const serverLocked = Boolean(data.locked || data.status === 'expired' || data.status === 'exhausted' || data.license?.isExpired);
          const serverStatus = String(data.status || (serverLocked ? (data.license?.isExpired ? 'expired' : 'exhausted') : 'active'));
          const serverLockReason = data.lockReason ?? data.reason ?? null;
          const serverLockError = data.lockError ?? data.error ?? null;
          const syncedUser: User = {
            ...newUser,
            plan: serverPlan,
            planName: data.plan_name || data.license?.displayName || serverCfg.displayName,
            planPrice: serverPlan === 'free' ? 0 : serverCfg.priceUSD,
            features: Array.isArray(data.features) ? data.features : serverCfg.features,
            maxSaved: serverMaxSaved,
            savedCount:
              typeof data.saved_count === 'number'
                ? data.saved_count
                : typeof data.user.saved_count === 'number'
                ? data.user.saved_count
                : serverSaved.length,
            savedAnalyses: serverSaved,
            customCities: Array.isArray(data.custom_cities)
              ? data.custom_cities
              : Array.isArray(data.user.custom_cities)
              ? data.user.custom_cities
              : [],
            apiKey: data.api_key ?? data.user?.api_key ?? null,
            apiKeyLast4: data.api_key_last4 ?? data.user?.api_key_last4 ?? null,
            subscriptionPlan: serverPlan,
            subscriptionStatus: serverStatus === 'expired' || serverStatus === 'exhausted' ? 'expired' : serverPlan === 'free' ? 'free' : 'active',
            subscriptionStartAt: data.license_start ?? data.user.license_start ?? undefined,
            subscriptionEndsAt: data.license_end ?? data.user.license_end ?? null,
            subscriptionExpiry: data.license_end ?? data.user.license_end ?? null,
            analysesUsed: serverUsed,
            analysesTotal: serverTotal,
            successfulAnalyses: Number(data.successful_analyses ?? data.user.successful_analyses ?? 0),
            freeAnalyses: serverLeft,
            freeAnalysesLeft: serverLeft,
            analysesLeft: serverLeft,
            planAnalysesLeft: typeof data.plan_analyses_left === 'number' ? data.plan_analyses_left : undefined,
            extraCredits: Number(data.extra_credits ?? data.user?.extra_credits ?? 0),
            creditsBalance: Number(data.credits_balance ?? data.extra_credits ?? data.user?.extra_credits ?? 0),
            packageExpired: Boolean(data.package_expired || serverStatus === 'expired'),
            creditsOnlyMode: Boolean(data.credits_only_mode),
            day29Reminder: Boolean(data.day29Reminder),
            expiryBanner: data.expiryBanner ?? null,
            expiryDateFormatted: data.expiryDateFormatted ?? null,
            imagePdfUsed: Number(data.image_pdf_used ?? data.user?.image_pdf_used ?? 0),
            imagePdfLimit: Number(data.image_pdf_limit ?? serverCfg.imagePdfLimit),
            aiListingsUsed: Number(data.ai_listings_used ?? data.user?.ai_listings_used ?? 0),
            aiListingLimit: Number(data.ai_listing_limit ?? serverCfg.aiListingLimit),
            pdfsUsed: Number(data.pdfs_used ?? data.user?.pdfs_used ?? 0),
            investmentPdfLimit: Number(data.investment_pdf_limit ?? serverCfg.investmentPdfLimit),
            portfolioAssetsLimit: Number(data.portfolio_assets_limit ?? serverCfg.portfolioAssetsLimit),
            compareLimit: Number(data.compare_limit ?? serverCfg.compareLimit),
            teamUsersLimit: Number(data.team_users_limit ?? serverCfg.teamUsersLimit),
            apiDailyLimit: Number(data.api_daily_limit ?? serverCfg.apiDailyLimit),
            apiCallsToday: Number(data.api_calls_today ?? 0),
            branding: data.branding ?? data.user?.branding ?? null,
            lockedLaunchPrice: data.user.locked_launch_price ?? null,
            hasReportedIssue: Boolean(data.user.has_reported_issue),
            issueReportedAt: data.user.issue_reported_at ?? null,
            issueResolvedAt: data.user.issue_resolved_at ?? null,
            issueDescription: data.user.issue_description ?? '',
            issueStatus: data.user.issue_status ?? 'none',
            cancelStatus: data.user.cancel_status ?? 'none',
            lastOrderId: data.user.last_order_id ?? null,
            cancellationEligibility: data.cancellationEligibility ?? null,
            status: serverStatus,
            locked: serverLocked,
            lockReason: serverLockReason,
            lockError: serverLockError,
            paymentProvider: data.payment_provider ?? data.user?.payment_provider ?? 'paddle',
            paymentIntentId: data.payment_intent_id ?? data.user?.payment_intent_id ?? null,
            lastResults: data.last_results ?? data.user?.last_results ?? null,
            portfolioAssets: Array.isArray(data.portfolio_assets)
              ? data.portfolio_assets
              : Array.isArray(data.user?.portfolio_assets)
              ? data.user.portfolio_assets
              : [],
            whiteLabelEnabled:
              typeof data.white_label_enabled === 'boolean'
                ? data.white_label_enabled
                : data.user?.white_label_enabled,
            customApiEnabled:
              typeof data.custom_api_enabled === 'boolean'
                ? data.custom_api_enabled
                : data.user?.custom_api_enabled,
            customAnalysesLimit: data.custom_analyses_limit ?? data.user?.custom_analyses_limit ?? null,
            customImagePdfLimit: data.custom_image_pdf_limit ?? data.user?.custom_image_pdf_limit ?? null,
            customListingsLimit: data.custom_listings_limit ?? data.user?.custom_listings_limit ?? null,
            customPortfolioLimit: data.custom_portfolio_limit ?? data.user?.custom_portfolio_limit ?? null,
            customSeats: data.custom_seats ?? data.user?.custom_seats ?? null,
            customStorageGb: data.custom_storage_gb ?? data.user?.custom_storage_gb ?? null,
            slaLevel: data.sla_level ?? data.user?.sla_level ?? null,
            contractEndDate: data.contract_end_date ?? data.user?.contract_end_date ?? null,
          };
          handleSaveUser(syncedUser);
          resolvedUser = syncedUser;
          setServerSynced(true);
        }
    } catch {
      handleSaveUser(null);
      setMeError('Unable to synchronize credits from server. Please retry.');
    } finally {
      setServerSynced(true);
    }

    if (!resolvedUser) {
      return;
    }

    window.history.pushState({}, '', '/app');
    setRoute('terminal');
    window.scrollTo(0, 0);

    const welcomeQuota =
      typeof resolvedUser.analysesLeft === 'number'
        ? `${resolvedUser.analysesLeft} analyses left`
        : 'Syncing credits...';
    showTempToast(`Welcome back, ${resolvedUser.name || resolvedUser.email.split('@')[0]} - ${welcomeQuota}`, 3000);
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

  // Server-authoritative /api/app?action=me Sync: ALWAYS use verified HttpOnly session cookie
  useEffect(() => {
    const syncMeFromServer = async () => {
      try {
        const res = await fetch(`/api/app?action=me&t=${Date.now()}`, {
          credentials: 'include',
          cache: 'no-store',
        });

        if (res.status === 401) {
          if (user?.email) {
            clearSession();
            setUser(null);
          }
          setServerSynced(true);
          return;
        }

        if (!res.ok) {
          if (user?.email && typeof user.analysesLeft !== 'number') {
            setMeError(`Unable to load credits from server (HTTP ${res.status}).`);
          }
          setServerSynced(true);
          return;
        }
        const data = await res.json();
        if (!data?.authenticated || !data?.email) {
          if (user?.email) {
            clearSession();
            setUser(null);
          }
          setServerSynced(true);
          return;
        }

        setMeError(null);
        const serverPlan = normalizePlanKey(data.planKey || data.user?.plan);
        const serverPlanName = data.plan_name || data.plan || PLANS[serverPlan].displayName;
        const serverPlanPrice =
          typeof data.price === 'number'
            ? data.price
            : serverPlan === 'free'
            ? 0
            : PLANS[serverPlan].priceUSD;
        const serverFeatures: string[] = Array.isArray(data.features)
          ? data.features
          : PLANS[serverPlan].features;
        const serverTotal = Number(
          data.analyses_total ?? data.license?.analysesLimit ?? PLANS[serverPlan].analysesLimit
        );
        const serverUsed = Number(data.analyses_used ?? 0);
        const serverEnd = data.license_end ?? null;
        const serverLeft = Number(
          data.analyses_left ?? Math.max(0, serverTotal - serverUsed)
        );
        const serverLockedLaunch = data.locked_launch_price ?? null;
        const serverCustomCities = Array.isArray(data.custom_cities)
          ? data.custom_cities
          : Array.isArray(data.user?.custom_cities)
          ? data.user.custom_cities
          : [];

        const serverMaxSaved =
          typeof data.maxSaved === 'number'
            ? data.maxSaved
            : PLANS[serverPlan].savedLimit;
        const serverSavedList = Array.isArray(data.saved_analyses)
          ? data.saved_analyses
          : [];
        const serverApiKey = typeof data.api_key === 'string' ? data.api_key : null;

        const baseUser: User = user || {
          id: 'user_' + data.email,
          email: data.email,
          name: data.name || data.email.split('@')[0],
          avatar: data.email.charAt(0).toUpperCase(),
          provider: 'google',
          createdAt: Date.now(),
          savedAnalyses: [],
          plan: serverPlan,
          planName: serverPlanName,
          planPrice: serverPlanPrice,
          features: serverFeatures,
          maxSaved: serverMaxSaved,
          savedCount: serverSavedList.length,
          apiKey: serverApiKey,
          apiKeyLast4: typeof data.api_key_last4 === 'string' ? data.api_key_last4 : null,
          subscriptionExpiry: serverEnd,
          analysesUsed: serverUsed,
          analysesTotal: serverTotal,
          freeAnalyses: serverLeft,
          freeAnalysesLeft: serverLeft,
          analysesLeft: serverLeft,
          customCities: serverCustomCities,
        };

        const serverAnalystUnread = typeof data.analyst_unread === 'number' ? data.analyst_unread : 0;
        const serverWgReqs = Array.isArray(data.whiteglove_requests) ? data.whiteglove_requests : [];
        const serverWgDelivs = Array.isArray(data.whiteglove_deliverables) ? data.whiteglove_deliverables : [];

        const serverSuccessfulAnalyses = Number(data.successful_analyses ?? data.user?.successful_analyses ?? 0);
        const serverHasReportedIssue = Boolean(data.has_reported_issue ?? data.user?.has_reported_issue);
        const serverIssueStatus = String(data.issue_status ?? data.user?.issue_status ?? 'none');
        const serverIssueResolvedAt = data.issue_resolved_at ?? data.user?.issue_resolved_at ?? null;
        const serverCancelStatus = String(data.cancel_status ?? data.user?.cancel_status ?? 'none');
        const serverEligibility = data.cancellationEligibility ?? null;
        const serverLocked = Boolean(
          data.locked || data.status === 'expired' || data.status === 'exhausted' || data.license?.isExpired
        );
        const serverStatus = String(
          data.status || (serverLocked ? (data.license?.isExpired ? 'expired' : 'exhausted') : 'active')
        );
        const serverLockReason = data.lockReason ?? data.reason ?? null;
        const serverLockError = data.lockError ?? data.error ?? null;
        const serverPaymentProvider = String(data.payment_provider ?? data.user?.payment_provider ?? 'paddle');
        const serverPaymentIntentId = data.payment_intent_id ?? data.user?.payment_intent_id ?? null;
        const serverLastResults = data.last_results ?? data.user?.last_results ?? null;
        const serverCfg = PLANS[serverPlan];
        const serverExtraCredits = Number(data.extra_credits ?? data.user?.extra_credits ?? 0);
        const serverImagePdfUsed = Number(data.image_pdf_used ?? data.user?.image_pdf_used ?? 0);
        const serverImagePdfLimit = Number(data.image_pdf_limit ?? serverCfg.imagePdfLimit);
        const serverAiListingsUsed = Number(data.ai_listings_used ?? data.user?.ai_listings_used ?? 0);
        const serverAiListingLimit = Number(data.ai_listing_limit ?? serverCfg.aiListingLimit);
        const serverPdfsUsed = Number(data.pdfs_used ?? data.user?.pdfs_used ?? 0);
        const serverInvestmentPdfLimit = Number(data.investment_pdf_limit ?? serverCfg.investmentPdfLimit);
        const serverPortfolioAssetsLimit = Number(data.portfolio_assets_limit ?? serverCfg.portfolioAssetsLimit);
        const serverCompareLimit = Number(data.compare_limit ?? serverCfg.compareLimit);
        const serverTeamUsersLimit = Number(data.team_users_limit ?? serverCfg.teamUsersLimit);
        const serverApiDailyLimit = Number(data.api_daily_limit ?? serverCfg.apiDailyLimit);
        const serverApiCallsToday = Number(data.api_calls_today ?? 0);
        const serverBranding = data.branding ?? data.user?.branding ?? null;

        const serverWhiteLabelEnabled =
          typeof data.white_label_enabled === 'boolean'
            ? data.white_label_enabled
            : data.user?.white_label_enabled;
        const serverCustomApiEnabled =
          typeof data.custom_api_enabled === 'boolean'
            ? data.custom_api_enabled
            : data.user?.custom_api_enabled;
        const serverCustomAnalysesLimit = data.custom_analyses_limit ?? data.user?.custom_analyses_limit ?? null;
        const serverCustomImagePdfLimit = data.custom_image_pdf_limit ?? data.user?.custom_image_pdf_limit ?? null;
        const serverCustomListingsLimit = data.custom_listings_limit ?? data.user?.custom_listings_limit ?? null;
        const serverCustomPortfolioLimit = data.custom_portfolio_limit ?? data.user?.custom_portfolio_limit ?? null;
        const serverCustomSeats = data.custom_seats ?? data.user?.custom_seats ?? null;
        const serverCustomStorageGb = data.custom_storage_gb ?? data.user?.custom_storage_gb ?? null;
        const serverSlaLevel = data.sla_level ?? data.user?.sla_level ?? null;
        const serverContractEndDate = data.contract_end_date ?? data.user?.contract_end_date ?? null;
        const serverPlanAnalysesLeft =
          typeof data.plan_analyses_left === 'number' ? data.plan_analyses_left : undefined;
        const serverCreditsBalance = Number(data.credits_balance ?? serverExtraCredits);
        const serverPackageExpired = Boolean(data.package_expired || serverStatus === 'expired');
        const serverCreditsOnlyMode = Boolean(data.credits_only_mode);
        const serverDay29Reminder = Boolean(data.day29Reminder);
        const serverExpiryBanner = data.expiryBanner ?? null;
        const serverExpiryDateFormatted = data.expiryDateFormatted ?? null;

        const changed =
          !user ||
          typeof user.analysesLeft !== 'number' ||
          normalizePlanKey(user.plan) !== serverPlan ||
          user.planName !== serverPlanName ||
          user.planPrice !== serverPlanPrice ||
          JSON.stringify(user.features || []) !== JSON.stringify(serverFeatures) ||
          (user.maxSaved ?? -1) !== serverMaxSaved ||
          (user.savedCount ?? -1) !== Number(data.saved_count ?? serverSavedList.length) ||
          (user.apiKey ?? null) !== serverApiKey ||
          (user.analysesUsed ?? -1) !== serverUsed ||
          (user.analysesTotal ?? -1) !== serverTotal ||
          (user.extraCredits ?? -1) !== serverExtraCredits ||
          (user.creditsBalance ?? -1) !== serverCreditsBalance ||
          user.planAnalysesLeft !== serverPlanAnalysesLeft ||
          Boolean(user.packageExpired) !== serverPackageExpired ||
          Boolean(user.creditsOnlyMode) !== serverCreditsOnlyMode ||
          Boolean(user.day29Reminder) !== serverDay29Reminder ||
          (user.expiryBanner ?? null) !== serverExpiryBanner ||
          (user.expiryDateFormatted ?? null) !== serverExpiryDateFormatted ||
          (user.imagePdfUsed ?? -1) !== serverImagePdfUsed ||
          (user.imagePdfLimit ?? -1) !== serverImagePdfLimit ||
          (user.aiListingsUsed ?? -1) !== serverAiListingsUsed ||
          (user.aiListingLimit ?? -1) !== serverAiListingLimit ||
          (user.pdfsUsed ?? -1) !== serverPdfsUsed ||
          (user.investmentPdfLimit ?? -1) !== serverInvestmentPdfLimit ||
          (user.portfolioAssetsLimit ?? -1) !== serverPortfolioAssetsLimit ||
          (user.compareLimit ?? -1) !== serverCompareLimit ||
          (user.teamUsersLimit ?? -1) !== serverTeamUsersLimit ||
          (user.apiDailyLimit ?? -1) !== serverApiDailyLimit ||
          (user.apiCallsToday ?? -1) !== serverApiCallsToday ||
          Boolean(user.whiteLabelEnabled) !== Boolean(serverWhiteLabelEnabled) ||
          Boolean(user.customApiEnabled) !== Boolean(serverCustomApiEnabled) ||
          (user.customAnalysesLimit ?? null) !== serverCustomAnalysesLimit ||
          (user.customImagePdfLimit ?? null) !== serverCustomImagePdfLimit ||
          (user.customListingsLimit ?? null) !== serverCustomListingsLimit ||
          (user.customPortfolioLimit ?? null) !== serverCustomPortfolioLimit ||
          (user.customSeats ?? null) !== serverCustomSeats ||
          (user.customStorageGb ?? null) !== serverCustomStorageGb ||
          (user.slaLevel ?? null) !== serverSlaLevel ||
          (user.contractEndDate ?? null) !== serverContractEndDate ||
          JSON.stringify(user.branding || null) !== JSON.stringify(serverBranding) ||
          (user.successfulAnalyses ?? -1) !== serverSuccessfulAnalyses ||
          Boolean(user.hasReportedIssue) !== serverHasReportedIssue ||
          (user.issueStatus ?? 'none') !== serverIssueStatus ||
          (user.issueResolvedAt ?? null) !== serverIssueResolvedAt ||
          (user.cancelStatus ?? 'none') !== serverCancelStatus ||
          JSON.stringify(user.cancellationEligibility || null) !== JSON.stringify(serverEligibility) ||
          (user.subscriptionEndsAt ?? null) !== serverEnd ||
          (user.lockedLaunchPrice ?? null) !== serverLockedLaunch ||
          (user.analystUnread ?? 0) !== serverAnalystUnread ||
          (serverWgReqs.length !== (user.whiteGloveRequests?.length ?? 0)) ||
          (serverWgDelivs.length !== (user.whiteGloveDeliverables?.length ?? 0)) ||
          (serverCustomCities.length !== (user.customCities?.length ?? 0)) ||
          (serverSavedList.length !== (user.savedAnalyses?.length ?? 0)) ||
          Boolean(user.locked) !== serverLocked ||
          (user.status ?? 'active') !== serverStatus ||
          (user.lockReason ?? null) !== serverLockReason ||
          (user.lockError ?? null) !== serverLockError ||
          (user.paymentProvider ?? 'paddle') !== serverPaymentProvider ||
          (user.paymentIntentId ?? null) !== serverPaymentIntentId ||
          JSON.stringify(user.lastResults || null) !== JSON.stringify(serverLastResults) ||
          user.analysesLeft !== serverLeft;

        if (changed) {
          const syncedUser: User = {
            ...baseUser,
            email: data.email,
            name: baseUser.name || data.name || data.email.split('@')[0],
            plan: serverPlan,
            planName: serverPlanName,
            planPrice: serverPlanPrice,
            features: serverFeatures,
            maxSaved: serverMaxSaved,
            savedCount:
              typeof data.saved_count === 'number'
                ? data.saved_count
                : serverSavedList.length,
            savedAnalyses: serverSavedList,
            apiKey: serverApiKey,
            apiKeyLast4: typeof data.api_key_last4 === 'string' ? data.api_key_last4 : baseUser.apiKeyLast4 ?? null,
            subscriptionPlan: serverPlan,
            subscriptionStatus:
              serverStatus === 'expired' || serverStatus === 'exhausted'
                ? 'expired'
                : serverPlan === 'free'
                ? 'free'
                : 'active',
            subscriptionStartAt: data.license_start ?? undefined,
            subscriptionEndsAt: serverEnd,
            subscriptionExpiry: serverEnd,
            analysesUsed: serverUsed,
            analysesTotal: serverTotal,
            successfulAnalyses: serverSuccessfulAnalyses,
            freeAnalyses: serverLeft,
            freeAnalysesLeft: serverLeft,
            analysesLeft: serverLeft,
            planAnalysesLeft: serverPlanAnalysesLeft,
            extraCredits: serverExtraCredits,
            creditsBalance: serverCreditsBalance,
            packageExpired: serverPackageExpired,
            creditsOnlyMode: serverCreditsOnlyMode,
            day29Reminder: serverDay29Reminder,
            expiryBanner: serverExpiryBanner,
            expiryDateFormatted: serverExpiryDateFormatted,
            imagePdfUsed: serverImagePdfUsed,
            imagePdfLimit: serverImagePdfLimit,
            aiListingsUsed: serverAiListingsUsed,
            aiListingLimit: serverAiListingLimit,
            pdfsUsed: serverPdfsUsed,
            investmentPdfLimit: serverInvestmentPdfLimit,
            portfolioAssetsLimit: serverPortfolioAssetsLimit,
            compareLimit: serverCompareLimit,
            teamUsersLimit: serverTeamUsersLimit,
            apiDailyLimit: serverApiDailyLimit,
            apiCallsToday: serverApiCallsToday,
            whiteLabelEnabled: serverWhiteLabelEnabled,
            customApiEnabled: serverCustomApiEnabled,
            customAnalysesLimit: serverCustomAnalysesLimit,
            customImagePdfLimit: serverCustomImagePdfLimit,
            customListingsLimit: serverCustomListingsLimit,
            customPortfolioLimit: serverCustomPortfolioLimit,
            customSeats: serverCustomSeats,
            customStorageGb: serverCustomStorageGb,
            slaLevel: serverSlaLevel,
            contractEndDate: serverContractEndDate,
            branding: serverBranding,
            lockedLaunchPrice: serverLockedLaunch,
            customCities: serverCustomCities,
            analystUnread: serverAnalystUnread,
            whiteGloveRequests: serverWgReqs,
            whiteGloveDeliverables: serverWgDelivs,
            hasReportedIssue: serverHasReportedIssue,
            issueReportedAt: data.issue_reported_at ?? data.user?.issue_reported_at ?? null,
            issueResolvedAt: serverIssueResolvedAt,
            issueDescription: data.issue_description ?? data.user?.issue_description ?? '',
            issueStatus: serverIssueStatus,
            cancelStatus: serverCancelStatus,
            lastOrderId: data.last_order_id ?? data.user?.last_order_id ?? null,
            cancellationEligibility: serverEligibility,
            status: serverStatus,
            locked: serverLocked,
            lockReason: serverLockReason,
            lockError: serverLockError,
            paymentProvider: serverPaymentProvider,
            paymentIntentId: serverPaymentIntentId,
            lastResults: serverLastResults,
            portfolioAssets: Array.isArray(data.portfolio_assets)
              ? data.portfolio_assets
              : Array.isArray(data.user?.portfolio_assets)
              ? data.user.portfolio_assets
              : baseUser.portfolioAssets || [],
          };
          saveUser(syncedUser);
          setUser(syncedUser);
        }
      } catch {
        if (user?.email && typeof user.analysesLeft !== 'number') {
          setMeError('Network error loading account credits from server. Please retry.');
        }
      } finally {
        setServerSynced(true);
      }
    };

    syncMeFromServer();
    const onFocus = () => syncMeFromServer();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.email, route, pricingData?.updatedAt, syncTrigger]);

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

  const handleAnalyzeProperty = (property: PropertyListing) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    fetch('/api/app?action=run-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: user.name,
        propertyTitle: property.title,
        city: property.city,
        priceUSD: property.basePriceUSD,
        rentUSD: property.baseRentMonthlyUSD,
        downPaymentPct: 30,
        interestRatePct: 5.5,
        operatingExpensePct: 15,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          showTempToast(data?.error || 'Rate limit exceeded. Please wait.');
          return;
        }
        if (res.status === 403 || !res.ok || data?.success === false) {
          if (data?.locked) {
            handleSaveUser({
              ...user,
              status: data.status || data.reason || 'exhausted',
              locked: true,
              lockReason: data.reason || null,
              lockError: data.error || null,
              analysesLeft: typeof data.analyses_left === 'number' ? data.analyses_left : 0,
              freeAnalyses: typeof data.analyses_left === 'number' ? data.analyses_left : 0,
              freeAnalysesLeft: typeof data.analyses_left === 'number' ? data.analyses_left : 0,
              subscriptionStatus: 'expired',
            });
          }
          showTempToast(data?.error || 'No analyses left. Renew / Upgrade.');
          setIsRenewalOpen(true);
          return;
        }
        const nextLeft = Number(data?.analyses_left ?? data?.license?.analysesLeft ?? 0);
        const nextTotal = Number(data?.analyses_total ?? data?.license?.analysesLimit ?? user.analysesTotal ?? 0);
        const nextExtra = typeof data?.extra_credits === 'number' ? data.extra_credits : user.creditsBalance ?? user.extraCredits;
        const nextPlanLeft = typeof data?.plan_analyses_left === 'number' ? data.plan_analyses_left : user.planAnalysesLeft;
        handleSaveUser({
          ...user,
          plan: data?.license?.planKey || user.plan,
          analysesUsed: Number(data?.license?.analysesUsed ?? user.analysesUsed + 1),
          analysesTotal: nextTotal,
          successfulAnalyses: Number(data?.successful_analyses ?? (user.successfulAnalyses ?? 0) + 1),
          cancellationEligibility: data?.cancellationEligibility ?? user.cancellationEligibility,
          freeAnalyses: nextLeft,
          freeAnalysesLeft: nextLeft,
          analysesLeft: nextLeft,
          planAnalysesLeft: nextPlanLeft,
          extraCredits: nextExtra,
          creditsBalance: nextExtra,
          lastResults: data?.last_results ?? user.lastResults,
        });
        setActivePropertyAnalysis(property);
      })
      .catch(() => {
        showTempToast('Network error contacting underwriting server. Please retry.');
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
    ? `MACRO SYNC (${lastSyncDisplay}): US 10Y ${marketLive.macro.us_10y_yield}% (FRED [Actual]) • Muscat vs US10Y +${marketLive.metrics.muscat_vs_us10y_bps} bps [Estimated] • Dubai DLD Index ${marketLive.metrics.dubai_dld_index} pts [Estimated]`
    : 'AQARI TERMINAL • Syncing World Bank, FRED, DLD, ONS & JLL Market Benchmarks...';

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
              Refund Policy
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
          <a href="mailto:loomorastudios@gmail.com" className="text-zinc-400 hover:text-[#D4AF37]">
            loomorastudios@gmail.com
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

  // View: Post-Checkout Auto-Activation Screen (/app?checkout=success&order_id=...)
  if (route === 'checkout-verifying') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
        <AmbientBackground />
        <div className="z-10 max-w-lg w-full glass-panel p-8 sm:p-10 rounded-[32px] border border-[#D4AF37]/40 text-center space-y-5 shadow-[0_0_60px_rgba(212,175,55,0.2)]">
          <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
            AQARI GLOBAL TERMINAL • AUTO-ACTIVATION
          </div>

          {verifyState === 'verifying' && (
            <>
              <div className="flex justify-center py-2">
                <div className="w-12 h-12 rounded-full border-4 border-[#D4AF37]/25 border-t-[#D4AF37] animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Activating Your Terminal...
              </h1>
              <p className="text-sm font-mono text-zinc-200 leading-relaxed">
                Please wait, verifying your payment with Paddle...
              </p>
            </>
          )}

          {verifyState === 'activated' && (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xl font-bold mx-auto">
                ✓
              </div>
              <h1 className="text-2xl font-bold text-emerald-300 tracking-tight">
                Activated
              </h1>
              <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 font-mono text-sm space-y-1.5 text-emerald-100">
                <div>
                  {verifiedSummary?.purchaseType === 'credit_pack' ? 'Pack Added:' : 'Plan:'}{' '}
                  <span className="text-[#D4AF37] font-bold">{verifiedSummary?.plan || verifyingPlanName}</span>
                </div>
                {verifiedSummary?.purchaseType === 'credit_pack' && (
                  <div>
                    Credits Balance:{' '}
                    <span className="text-emerald-300 font-bold">{verifiedSummary?.creditsBalance ?? 0} credits (Never expires)</span>
                  </div>
                )}
                <div>
                  Analyses Left:{' '}
                  <span className="text-white font-bold">{verifiedSummary?.analysesLeft ?? 'Loading...'}</span>
                </div>
              </div>
              <p className="text-xs font-mono text-zinc-400">Redirecting to terminal...</p>
            </>
          )}

          {verifyState === 'error' && (
            <>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Terminal Activation
              </h1>
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-left text-xs font-mono text-rose-200 leading-relaxed break-words">
                {verifyError || 'Unable to verify checkout'}
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                Order ID from URL: <span className="text-zinc-200">{checkoutUrlOrderId || 'Not found'}</span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const cleaned = cleanPlaceholderOrderId(manualOrderId);
                  if (!cleaned) {
                    setVerifyError('Please enter your Paddle Transaction / Order ID (e.g. txn_123456) from your Paddle invoice.');
                    return;
                  }
                  runAutoVerifyCheckout(cleaned);
                }}
                className="space-y-2.5 text-left p-4 rounded-2xl bg-zinc-900/80 border border-white/15"
              >
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-bold">
                  Enter Paddle Transaction / Order ID (from invoice)
                </label>
                <input
                  type="text"
                  value={manualOrderId}
                  onChange={(e) => setManualOrderId(e.target.value)}
                  placeholder="Enter Paddle Transaction / Order ID (e.g. txn_123456)"
                  className="w-full px-3.5 py-3 rounded-xl bg-black/70 border border-white/20 text-white font-mono text-sm placeholder:text-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm font-mono uppercase tracking-wider transition cursor-pointer shadow-lg"
                >
                  ACTIVATE WITH ORDER ID
                </button>
              </form>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => runAutoVerifyCheckout()}
                  className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-black text-sm font-mono uppercase tracking-wider transition cursor-pointer shadow-lg min-h-[52px]"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => runAutoVerifyCheckout('LAST')}
                  className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-200 font-bold text-xs font-mono uppercase tracking-wider transition cursor-pointer"
                >
                  Use Last Order From Webhook Logs
                </button>
              </div>
            </>
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
                Loading Server License &amp; Credits...
              </div>
            </div>
          </div>
        ) : user && meError && typeof user.analysesLeft !== 'number' ? (
          <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
            <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-rose-500/40 text-center space-y-4">
              <AlertOctagon className="w-10 h-10 text-rose-400 mx-auto" />
              <div className="text-sm font-mono font-bold text-white">
                Failed to Sync Credits from Server
              </div>
              <p className="text-xs font-mono text-zinc-300 leading-relaxed">{meError}</p>
              <button
                type="button"
                onClick={() => {
                  setServerSynced(false);
                  setMeError(null);
                  setSyncTrigger((c) => c + 1);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs font-mono uppercase tracking-wider cursor-pointer"
              >
                Retry Sync
              </button>
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
              onGoToPricing={handleGoToHomePricing}
              onOpenRenewal={() => setIsRenewalOpen(true)}
              onUpdateUser={handleSaveUser}
              onOpenAuth={() => setIsAuthOpen(true)}
              onOpenLegal={navigateLegal}
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
            onEnterpriseShowcaseLock={() => {
              setLimitModalMode('enterprise_showcase');
              setIsLimitOpen(true);
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
                    <span>REAL ESTATE WIRE • GOOGLE NEWS RSS FEED</span>
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
        mode={limitModalMode}
        onClose={() => {
          setIsLimitOpen(false);
          setLimitModalMode('quota');
        }}
        user={user}
        config={config}
        pricingData={pricingData}
        currentCurrency={currency}
        onTestUnlock={handleAdminTestUnlock}
        onOpenPricing={handleGoToHomePricing}
        onRequestEnterpriseDemo={() => {
          handleGoToHomePricing();
          setTimeout(() => {
            window.dispatchEvent(new Event('aqari:open-enterprise-modal'));
          }, 250);
        }}
      />

      <RenewalModal
        isOpen={isRenewalOpen}
        onClose={() => setIsRenewalOpen(false)}
        user={user}
        config={config}
        pricingData={pricingData}
        currentCurrency={currency}
        onOpenLegal={navigateLegal}
        onOpenPricing={handleGoToHomePricing}
      />

      <AnalysisModal
        property={activePropertyAnalysis}
        currentCurrency={currency}
        user={user}
        onClose={() => setActivePropertyAnalysis(null)}
        onOpenUpgrade={() => setIsRenewalOpen(true)}
        onSaveAnalysis={async (prop) => {
          if (!user) {
            setIsAuthOpen(true);
            return;
          }
          const planCfg = PLANS[normalizePlanKey(user.plan)];
          const currentSaved = user.savedAnalyses || [];
          const hasMeFeatures = Array.isArray(user.features) && user.features.length > 0;
          const parsedSaveFeature = hasMeFeatures
            ? user.features!
                .map((f) => /^save\s+(\d+)$/i.exec(f.trim()))
                .find((m) => Boolean(m))
            : null;
          const effectiveSavedLimit =
            typeof user.maxSaved === 'number'
              ? user.maxSaved
              : parsedSaveFeature
              ? Number(parsedSaveFeature[1])
              : hasMeFeatures && user.features!.some((f) => /^unlimited\s+saved$/i.test(f.trim()))
              ? 400
              : planCfg.savedLimit;

          if (currentSaved.length >= effectiveSavedLimit) {
            showTempToast(
              `Save limit reached for ${user.planName || planCfg.displayName}: ${currentSaved.length}/${effectiveSavedLimit}.`,
              4000
            );
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

          try {
            const res = await fetch('/api/app?action=save-to-portfolio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                currentSavedCount: currentSaved.length,
                analysis: newAnalysis,
              }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || data?.success === false) {
              showTempToast(
                data?.error ||
                  `Save limit reached for ${user.planName || planCfg.displayName}: ${currentSaved.length}/${effectiveSavedLimit}.`,
                4000
              );
              setIsRenewalOpen(true);
              return;
            }
            const nextList = [data?.savedItem || newAnalysis, ...currentSaved];
            handleSaveUser({
              ...user,
              savedCount: data?.saved_count ?? nextList.length,
              savedAnalyses: nextList,
            });
            showTempToast(`Saved "${prop.title}" to portfolio (${nextList.length}/${effectiveSavedLimit}).`);
          } catch {
            showTempToast('Unable to save to portfolio right now. Please try again.');
          }
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
