// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CurrencyCode,
  RemoteConfig,
  User,
  SavedAnalysis,
  MarketMatrixRow,
  CustomCityCard,
  AnalystThread,
  WhiteGloveRequest,
  WhiteGloveDeliverable,
} from '../types';
import {
  PLAN_LIMITS,
  PROPERTY_LISTINGS,
  CROSS_BORDER_DATA,
} from '../constants';
import {
  PLANS,
  PricingPublicPayload,
  findPlanPricing,
  normalizePlanKey,
  computeLicenseStatus,
  canUseFeature,
} from '../../lib/plans';
import { CITIES, findCityEntry, searchCities, CityEntry } from '../../data/cities';
import {
  formatPrice,
  formatUsdInputDisplay,
  parseEnglishNumber,
  sanitizeEnglishDecimal,
} from '../utils/formatters';
import { formatTimeLeft } from '../utils/emailService';
import { downloadMemorandumPdf, downloadWhiteGlovePdf } from '../utils/pdfExport';
import type { LiveMarketResponse } from '../utils/marketDataService';
import {
  Building2,
  Calculator,
  BookmarkCheck,
  Briefcase,
  Globe,
  Settings,
  Sparkles,
  Zap,
  Crown,
  Lock,
  LogOut,
  Home,
  ChevronDown,
  Search,
  Trash2,
  Download,
  Eye,
  Plus,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Check,
  Sliders,
  BarChart3,
  FileText,
  Headphones,
  Key,
  ExternalLink,
  Flame,
  ArrowRight,
  Menu,
  X,
  MapPin,
  Loader2,
  Bot,
  Radar,
  Calendar,
  RefreshCw,
  Send,
  MessageSquare,
  Copy,
  Mail,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

function resolveCityFromInput(rawInput: string): CityEntry | null {
  const cleaned = String(rawInput || '').trim();
  if (!cleaned) return null;
  const direct = findCityEntry(cleaned);
  if (direct) return direct;
  const strippedParen = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const byParen = findCityEntry(strippedParen);
  if (byParen) return byParen;
  const beforeComma = cleaned.split(',')[0].trim();
  return findCityEntry(beforeComma);
}

function formatCityOptionLabel(entry: CityEntry): string {
  return `${entry.city} (${entry.country} ${entry.countryCode})`;
}

// Institutional Demo Benchmarks shown in Empty Saved/Portfolio and kept accessible
const DEMO_SAVED_BENCHMARKS: SavedAnalysis[] = [
  {
    id: 'demo-dubai-marina',
    property: 'Dubai Marina Waterfront Tower (DEMO)',
    city: 'Dubai',
    price: 1240000,
    rent: 9093,
    capRate: 8.8,
    cashOnCash: 9.4,
    irr: 14.9,
    dscr: '1.82',
    monthlyCashflow: 3920,
    riskScore: 'AAA',
    date: Date.now() - 86400000,
    imageUrl: PROPERTY_LISTINGS[1].imageUrl,
    notes: 'Demo institutional benchmark — 8.8% Gross Yield',
  },
  {
    id: 'demo-muscat-khuwair',
    property: 'Muscat Al Khuwair Residences (DEMO)',
    city: 'Muscat',
    price: 652800,
    rent: 4570,
    capRate: 8.4,
    cashOnCash: 9.8,
    irr: 14.6,
    dscr: '1.85',
    monthlyCashflow: 2150,
    riskScore: 'AAA',
    date: Date.now() - 2 * 86400000,
    imageUrl: PROPERTY_LISTINGS[0].imageUrl,
    notes: 'Demo institutional benchmark — 8.4% Gross Yield',
  },
  {
    id: 'demo-riyadh-olaya',
    property: 'Riyadh Al Olaya Sovereign Suite (DEMO)',
    city: 'Riyadh',
    price: 980000,
    rent: 7186,
    capRate: 8.8,
    cashOnCash: 9.6,
    irr: 15.2,
    dscr: '1.79',
    monthlyCashflow: 3250,
    riskScore: 'AAA',
    date: Date.now() - 3 * 86400000,
    imageUrl: PROPERTY_LISTINGS[5]?.imageUrl || PROPERTY_LISTINGS[0].imageUrl,
    notes: 'Demo institutional benchmark — 8.8% Gross Yield',
  },
];

const COMING_SOON_AI_MODULES = [
  {
    title: 'AI Deal Finder',
    arabicDesc: 'ابحث عن أفضل الصفقات العقارية تلقائياً',
    badge: 'PROFESSIONAL / SOVEREIGN',
  },
  {
    title: 'AI Market Forecast',
    arabicDesc: 'توقعات الأسعار والإيجارات بالذكاء الاصطناعي',
    badge: 'PROFESSIONAL / SOVEREIGN',
  },
  {
    title: 'AI Due Diligence',
    arabicDesc: 'فحص شامل للمخاطر القانونية والمالية',
    badge: 'PROFESSIONAL / SOVEREIGN',
  },
  {
    title: 'Global Portfolio Optimizer',
    arabicDesc: 'توزيع ذكي لرأس المال بين الأسواق العالمية',
    badge: 'SOVEREIGN',
  },
  {
    title: 'Institutional AI Advisor',
    arabicDesc: 'مستشارك الاستثماري الشخصي بالذكاء الاصطناعي',
    badge: 'SOVEREIGN',
  },
];

interface TerminalDashboardProps {
  user: User;
  currentCurrency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
  config: RemoteConfig;
  pricingData?: PricingPublicPayload | null;
  marketLive?: LiveMarketResponse | null;
  onSignOut: (forgetDevice?: boolean) => void;
  onGoToHome: () => void;
  onGoToPricing?: () => void;
  onOpenRenewal: () => void;
  onUpdateUser: (u: User) => void;
  onConsumeAnalysis?: () => boolean;
  onOpenAuth?: () => void;
  initialToast?: string | null;
}

const EN_INPUT_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  unicodeBidi: 'embed',
  direction: 'ltr',
};

export const TerminalDashboard: React.FC<TerminalDashboardProps> = ({
  user,
  currentCurrency,
  config,
  pricingData,
  marketLive,
  onSignOut,
  onGoToHome,
  onGoToPricing,
  onOpenRenewal,
  onUpdateUser,
  onConsumeAnalysis,
  onOpenAuth,
  initialToast,
}) => {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analyze' | 'saved' | 'portfolio' | 'radar' | 'settings'>(
    initialToast?.startsWith('Welcome to AQARI') ? 'dashboard' : 'analyze'
  );

  // Mobile sidebar drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Tool Issue & Subscription Cancellation modal states
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueDescInput, setIssueDescInput] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueModalError, setIssueModalError] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancellingSub, setIsCancellingSub] = useState(false);
  const [cancelModalError, setCancelModalError] = useState<string | null>(null);

  // Success / notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(initialToast || null);

  useEffect(() => {
    if (initialToast) {
      setToastMessage(initialToast);
      if (initialToast.startsWith('Welcome to AQARI')) {
        setActiveTab('dashboard');
      }
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [initialToast]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Webhook & email audit logs for Settings/Admin view
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [webhookDebug, setWebhookDebug] = useState<string | null>(null);
  const [webhookEnvStatus, setWebhookEnvStatus] = useState<{
    webhookSecretPresent: boolean;
    apiKeyPresent: boolean;
    resendKeyPresent?: boolean;
    resendKeyPrefix?: string;
    lastResendAttempt?: string | null;
    lastResendError?: string | null;
  } | null>(null);
  const [isRefreshingWebhookLogs, setIsRefreshingWebhookLogs] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [isAnalyzingApi, setIsAnalyzingApi] = useState(false);
  const [backupOrderId, setBackupOrderId] = useState('');
  const [backupTargetEmail, setBackupTargetEmail] = useState('');
  const [backupVerifyMsg, setBackupVerifyMsg] = useState<string | null>(null);
  const [isRunningBackupVerify, setIsRunningBackupVerify] = useState(false);
  const isOwnerAdmin = ['loomora.studios@gmail.com', 'loomorastudios@gmail.com'].includes(
    (user?.email || '').trim().toLowerCase()
  );

  // Add Your City state & persistence
  const [isAddCityOpen, setIsAddCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<
    Array<{ city: string; country: string; displayName: string }>
  >([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [isAnalyzingCity, setIsAnalyzingCity] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [macroSyncInfo, setMacroSyncInfo] = useState<{
    source: string;
    last_updated: string;
    data_as_of: string;
    real_estate_note: string;
  } | null>(null);

  const customCities: CustomCityCard[] = useMemo(() => {
    if (Array.isArray(user.customCities) && user.customCities.length > 0) {
      return user.customCities;
    }
    try {
      const raw = localStorage.getItem(`aqari_custom_cities_${user.email.toLowerCase()}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [user.customCities, user.email]);

  const isTestMode =
    import.meta.env.VITE_LEMON_TEST_MODE === 'true' ||
    (import.meta.env.VITE_LEMON_TEST_MODE as unknown) === true;

  // Plan info & Live 1-minute countdown interval
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setMinuteTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const endsAt = user.subscriptionEndsAt || user.subscriptionExpiry;
  const msRemaining = endsAt ? Math.max(0, endsAt - Date.now()) : 0;

  const dynamicPlanPricing = findPlanPricing(pricingData, normalizePlanKey(user.plan));
  const license = computeLicenseStatus({
    plan: user.plan,
    licenseStart: user.subscriptionStartAt,
    licenseEnd: endsAt,
    analysesUsed: user.analysesUsed,
    freeAnalysesLeft: user.freeAnalysesLeft ?? user.freeAnalyses,
    analysesLeft: user.analysesLeft,
    analysesLimitOverride: dynamicPlanPricing?.analysesLimit,
    savedLimitOverride:
      dynamicPlanPricing?.savedLimit === null ? Infinity : dynamicPlanPricing?.savedLimit,
  });

  const planInfo = PLAN_LIMITS[license.planKey] || PLAN_LIMITS.free;
  const daysLeft = license.daysLeft;
  const isPlanEnded = license.isExpired;
  const isExpired = user.subscriptionStatus === 'expired' || isPlanEnded;
  const isEndingIn24h = Boolean(license.planKey !== 'free' && endsAt && msRemaining > 0 && msRemaining <= 24 * 60 * 60 * 1000);
  const countdownText = endsAt ? formatTimeLeft(msRemaining) : null;

  const analysesRemaining = license.isUnlimitedAnalyses ? 9999 : license.analysesLeft;
  const analysesLeftStr = license.isUnlimitedAnalyses ? 'Unlimited analyses left' : `${license.analysesLeft} analyses left`;

  const meFeatures: string[] = useMemo(() => {
    if (Array.isArray(user.features) && user.features.length > 0) {
      return user.features;
    }
    if (Array.isArray(dynamicPlanPricing?.features) && dynamicPlanPricing.features.length > 0) {
      return dynamicPlanPricing.features;
    }
    return PLANS[license.planKey].features;
  }, [user.features, dynamicPlanPricing?.features, license.planKey]);

  const maxSaved = useMemo(() => {
    if (typeof user.maxSaved === 'number' && user.maxSaved > 0) {
      return user.maxSaved;
    }
    const parsedSaveFeature = meFeatures
      .map((f) => /^save\s+(\d+)$/i.exec(f.trim()))
      .find((m) => Boolean(m));
    if (parsedSaveFeature) return Number(parsedSaveFeature[1]);
    if (meFeatures.some((f) => /^unlimited\s+saved$/i.test(f.trim()))) return 400;
    return PLANS[license.planKey].savedLimit;
  }, [user.maxSaved, meFeatures, license.planKey]);

  const planDisplayName = user.planName || license.displayName;
  const planPriceUSD =
    license.planKey === 'free'
      ? 0
      : typeof user.planPrice === 'number'
      ? user.planPrice
      : dynamicPlanPricing?.activePrice ?? PLANS[license.planKey].priceUSD;

  const canSensitivity =
    !isPlanEnded &&
    (meFeatures.includes('Yield & Sensitivity Calculator') || canUseFeature(license.planKey, 'yieldSensitivity'));
  const canMonteCarlo =
    !isPlanEnded &&
    (meFeatures.includes('Monte Carlo Stress Tests +200bps') || canUseFeature(license.planKey, 'monteCarlo'));
  const canPdfExport =
    !isPlanEnded &&
    (meFeatures.includes('PDF Memorandum Export') || canUseFeature(license.planKey, 'pdfExport'));
  const canPortfolioAgg =
    !isPlanEnded &&
    (meFeatures.includes('Multi-asset Portfolio Aggregation') || canUseFeature(license.planKey, 'portfolioAggregation'));
  const canFullMatrix =
    !isPlanEnded &&
    (meFeatures.includes('Cross-border Tax & Visa Matrix') || canUseFeature(license.planKey, 'crossBorderMatrixFull'));
  const canApiAccess =
    !isPlanEnded &&
    (meFeatures.includes('Full REST API Credentials') || canUseFeature(license.planKey, 'apiAccess'));
  const canAnalystDesk =
    !isPlanEnded &&
    (meFeatures.includes('1-on-1 Dedicated Analyst Desk') || canUseFeature(license.planKey, 'analystDesk'));
  const canCustomUnderwriting =
    !isPlanEnded &&
    (meFeatures.includes('White-glove Custom Underwriting') || canUseFeature(license.planKey, 'customUnderwriting'));
  const canSaveProperty = !isPlanEnded && maxSaved > 0;

  const loadWebhookLogs = async () => {
    setIsRefreshingWebhookLogs(true);
    try {
      const res = await fetch(`/api/app?action=webhook-logs&t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setWebhookLogs(data.logs || data.webhooks || []);
        setEmailLogs(data.emailLogs || data.emails || []);
        setWebhookDebug(data.debug || null);
        if (data.envStatus) {
          setWebhookEnvStatus(data.envStatus);
        }
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setIsRefreshingWebhookLogs(false);
    }
  };

  const handleAdminBackupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerAdmin) return;
    setBackupVerifyMsg(null);
    if (!backupOrderId.trim() && !backupTargetEmail.trim()) {
      setBackupVerifyMsg('Enter Order ID or Payment Email.');
      return;
    }
    setIsRunningBackupVerify(true);
    try {
      const res = await fetch('/api/app?action=verify-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          order_id: backupOrderId.trim() || undefined,
          email: backupTargetEmail.trim() || user.email,
          login_email: backupTargetEmail.trim() || user.email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setBackupVerifyMsg(`Verified ${data.plan || data.planKey} (Order #${data.order_id || data.order_id_used || backupOrderId}).`);
        loadWebhookLogs();
      } else {
        setBackupVerifyMsg(data?.error || 'Verification did not find a paid order.');
      }
    } catch {
      setBackupVerifyMsg('Backup verify request failed.');
    } finally {
      setIsRunningBackupVerify(false);
    }
  };

  // Load webhook & email audit logs when Settings tab opens
  useEffect(() => {
    if (activeTab === 'settings') {
      loadWebhookLogs();
    }
  }, [activeTab]);

  // Verify portfolio endpoint when opening Portfolio tab if entitled
  useEffect(() => {
    if (activeTab === 'portfolio' && canPortfolioAgg && user?.email) {
      fetch('/api/app?action=portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          userPlan: user.plan,
          licenseStart: user.subscriptionStartAt,
          licenseEnd: endsAt,
          analysesUsed: user.analysesUsed,
          savedAnalyses: user.savedAnalyses || [],
        }),
      }).catch(() => {});
    }
  }, [activeTab, canPortfolioAgg]);

  // Analyzer Form State (in base USD — never auto-computes on edit)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PROPERTY_LISTINGS[0].id);
  const [priceUSD, setPriceUSD] = useState<number>(PROPERTY_LISTINGS[0].basePriceUSD);
  const [rentUSD, setRentUSD] = useState<number>(PROPERTY_LISTINGS[0].baseRentMonthlyUSD);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(30);
  const [downDraft, setDownDraft] = useState<string>('30');
  const [interestRatePct, setInterestRatePct] = useState<number>(5.5);
  const [rateDraft, setRateDraft] = useState<string>('5.5');
  const [operatingExpensePct, setOperatingExpensePct] = useState<number>(15);
  const [opexDraft, setOpexDraft] = useState<string>('15');
  const initialCityEntry = resolveCityFromInput(PROPERTY_LISTINGS[0].city);
  const [city, setCity] = useState<string>(initialCityEntry?.city || PROPERTY_LISTINGS[0].city);
  const [cityComboInput, setCityComboInput] = useState<string>(
    initialCityEntry ? formatCityOptionLabel(initialCityEntry) : PROPERTY_LISTINGS[0].city
  );
  const [cityComboOpen, setCityComboOpen] = useState<boolean>(false);
  const cityComboInputRef = useRef<HTMLInputElement | null>(null);
  const [propertyName, setPropertyName] = useState<string>(PROPERTY_LISTINGS[0].title);
  const [propertyImageUrl, setPropertyImageUrl] = useState<string>(PROPERTY_LISTINGS[0].imageUrl);

  // Authoritative Run Analysis result state — null until RUN ANALYSIS (-1 CREDIT) succeeds
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);
  const [stressTestActive, setStressTestActive] = useState(false);
  const [runResult, setRunResult] = useState<{
    analyzedAt: string;
    inputs: {
      propertyTitle: string;
      city: string;
      priceUSD: number;
      rentUSD: number;
      downPaymentPct: number;
      interestRatePct: number;
      operatingExpensePct: number;
    };
    capRate: number;
    cashOnCash: number;
    irr5Yr: number | null;
    dscr: string | null;
    monthlyCashflowUSD: number | null;
    monthlyMortgageUSD: number | null;
    netOperatingIncomeUSD: number;
    annualGrossRentUSD: number;
    annualOPEXUSD: number;
    annualDebtServiceUSD: number;
    downPaymentUSD: number;
    sensitivity: Array<{
      deltaPct: number;
      rentUSD: number;
      capRate: number;
      cashOnCash: number;
      monthlyCashflowUSD: number;
    }> | null;
    monteCarlo: {
      cycles: number;
      passCount: number;
      failCount: number;
      passRatePct: number;
      positiveCashflowPct: number;
      meanDscr: number;
      minDscr: number;
      maxDscr: number;
      dscrP10: number;
      dscrP50: number;
      dscrP90: number;
      rateShockCoC: number;
      vacancySurgeNetYield: number;
      distribution: Array<{ label: string; count: number; pct: number }>;
    } | null;
  } | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<{
    cycles: number;
    passCount: number;
    failCount: number;
    passRatePct: number;
    positiveCashflowPct: number;
    meanDscr: number;
    minDscr: number;
    maxDscr: number;
    dscrP10: number;
    dscrP50: number;
    dscrP90: number;
    rateShockCoC: number;
    vacancySurgeNetYield: number;
    distribution: Array<{ label: string; count: number; pct: number }>;
  } | null>(null);
  const [isRunningMonteCarlo, setIsRunningMonteCarlo] = useState(false);

  // Sovereign Suite states (REST API Docs + Analyst Desk Text Chat + White-Glove Intake & Deliverables)
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [showApiDocs, setShowApiDocs] = useState(false);
  const [analystThread, setAnalystThread] = useState<AnalystThread | null>(null);
  const [analystUnread, setAnalystUnread] = useState<number>(user.analystUnread || 0);
  const [analystChatOpen, setAnalystChatOpen] = useState<boolean>(false);
  const [analystMsgInput, setAnalystMsgInput] = useState<string>('');
  const [analystAttachedId, setAnalystAttachedId] = useState<string>('');
  const [analystReplyBy, setAnalystReplyBy] = useState<string>('');
  const [isSendingAnalystMsg, setIsSendingAnalystMsg] = useState<boolean>(false);

  const [wgPropertyTitle, setWgPropertyTitle] = useState<string>('');
  const [wgDealLink, setWgDealLink] = useState<string>('');
  const [wgTargetCity, setWgTargetCity] = useState<string>('Muscat (Oman OM)');
  const [wgCityOpen, setWgCityOpen] = useState<boolean>(false);
  const [wgValuation, setWgValuation] = useState<string>('');
  const [wgExpectedRent, setWgExpectedRent] = useState<string>('');
  const [wgGoalNotes, setWgGoalNotes] = useState<string>('');
  const [isSubmittingWg, setIsSubmittingWg] = useState<boolean>(false);
  const [wgStatusMsg, setWgStatusMsg] = useState<string | null>(null);
  const [wgRequests, setWgRequests] = useState<WhiteGloveRequest[]>(user.whiteGloveRequests || []);
  const [wgDeliverables, setWgDeliverables] = useState<WhiteGloveDeliverable[]>(
    user.whiteGloveDeliverables || []
  );

  const clearPendingRun = () => {
    setHasRunAnalysis(false);
    setRunResult(null);
    setMonteCarloResult(null);
    setStressTestActive(false);
  };

  const selectedCityEntry = useMemo(
    () => resolveCityFromInput(cityComboInput) || resolveCityFromInput(city),
    [cityComboInput, city]
  );

  const cityDropdownOptions = useMemo(() => {
    const q = cityComboInput.trim();
    const matched = resolveCityFromInput(q);
    if (matched && q === formatCityOptionLabel(matched)) {
      return searchCities(matched.city, 25);
    }
    if (q.length >= 2) {
      return searchCities(q, 25);
    }
    const defaults = ['Muscat', 'Dubai', 'Riyadh', 'London', 'New York', 'Singapore', 'Miami', 'Doha', 'Abu Dhabi', 'Cairo'];
    return defaults.map((n) => findCityEntry(n)).filter((c): c is CityEntry => Boolean(c));
  }, [cityComboInput]);

  const wgCityOptions = useMemo(() => {
    const q = wgTargetCity.trim();
    if (q.length >= 2 && !resolveCityFromInput(q)) {
      return searchCities(q, 20);
    }
    if (q.length >= 2) {
      const m = resolveCityFromInput(q);
      if (m && q === formatCityOptionLabel(m)) return searchCities(m.city, 15);
      return searchCities(q, 20);
    }
    return ['Muscat', 'Dubai', 'Riyadh', 'London', 'New York', 'Singapore', 'Miami']
      .map((n) => findCityEntry(n))
      .filter((c): c is CityEntry => Boolean(c));
  }, [wgTargetCity]);

  const selectTargetCity = (entryOrRaw: CityEntry | string, _syncCurrency = true) => {
    const entry = typeof entryOrRaw === 'string' ? resolveCityFromInput(entryOrRaw) : entryOrRaw;
    if (entry) {
      setCity(entry.city);
      setCityComboInput(formatCityOptionLabel(entry));
    } else if (typeof entryOrRaw === 'string') {
      setCity(entryOrRaw);
      setCityComboInput(entryOrRaw);
    }
  };

  useEffect(() => {
    if (!canAnalystDesk || !user?.email) return;
    let active = true;

    const fetchWhiteGloveAndUnread = async () => {
      try {
        const [wgRes, meRes] = await Promise.all([
          fetch(`/api/app?action=whiteglove-request&email=${encodeURIComponent(user.email)}&t=${Date.now()}`, {
            credentials: 'include',
          }),
          fetch(`/api/app?action=me&t=${Date.now()}`, { credentials: 'include' }),
        ]);
        if (!active) return;
        if (wgRes.ok) {
          const wgData = await wgRes.json().catch(() => null);
          if (wgData?.success) {
            setWgRequests(Array.isArray(wgData.requests) ? wgData.requests : []);
            setWgDeliverables(Array.isArray(wgData.deliverables) ? wgData.deliverables : []);
          }
        }
        if (meRes.ok) {
          const meData = await meRes.json().catch(() => null);
          if (meData?.success) {
            if (meData.analyst_thread) setAnalystThread(meData.analyst_thread);
            const nextUnread = Number(meData.analyst_unread || 0);
            setAnalystUnread((prev) => {
              if (nextUnread > prev && !analystChatOpen) {
                showToast('Analyst replied');
              }
              return nextUnread;
            });
          }
        }
      } catch {}
    };

    fetchWhiteGloveAndUnread();
    const timer = setInterval(fetchWhiteGloveAndUnread, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [canAnalystDesk, user?.email, analystChatOpen]);

  const handleOpenAnalystChat = async () => {
    setAnalystChatOpen(true);
    if (!canAnalystDesk || !user?.email) return;
    try {
      const res = await fetch(
        `/api/app?action=analyst-chat&email=${encodeURIComponent(user.email)}&t=${Date.now()}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.thread) {
          setAnalystThread(data.thread);
          setAnalystUnread(0);
        }
      }
    } catch {}
  };

  const handleSendAnalystChat = async () => {
    if (!canAnalystDesk) {
      showToast('Available in SOVEREIGN - Upgrade');
      onOpenRenewal();
      return;
    }
    const text = analystMsgInput.trim();
    if (!text) {
      showToast('Please enter your question for the analyst first.');
      return;
    }
    const attachedObj = (user.savedAnalyses || []).find((s) => s.id === analystAttachedId) || null;
    setIsSendingAnalystMsg(true);
    try {
      const res = await fetch('/api/app?action=analyst-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          message: text,
          attachedAnalysisId: attachedObj?.id || undefined,
          attachedAnalysisTitle: attachedObj ? `${attachedObj.property} (${attachedObj.city})` : undefined,
          attachedAnalysisSummary: attachedObj
            ? `Price: $${attachedObj.price.toLocaleString('en-US')} | Cap: ${attachedObj.capRate}% | IRR: ${attachedObj.irr}% | DSCR: ${attachedObj.dscr}x`
            : undefined,
          replyByDate: analystReplyBy.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        showToast(data?.error || 'Unable to send message to analyst desk.');
        return;
      }
      if (data?.thread) setAnalystThread(data.thread);
      setAnalystMsgInput('');
      setAnalystAttachedId('');
      setAnalystReplyBy('');
      setAnalystChatOpen(true);
      showToast('Sent - Analyst will reply within 24h');
    } catch {
      showToast('Network error sending message to analyst.');
    } finally {
      setIsSendingAnalystMsg(false);
    }
  };

  const handleSubmitWhiteGloveRequest = async () => {
    if (!canCustomUnderwriting) {
      showToast('Available in SOVEREIGN - Upgrade');
      onOpenRenewal();
      return;
    }
    const title = wgPropertyTitle.trim();
    const cityEntry = resolveCityFromInput(wgTargetCity);
    const resolvedCity = cityEntry ? cityEntry.city : wgTargetCity.trim();
    if (!title || !resolvedCity) {
      showToast('Please enter Property Title and Target City.');
      return;
    }
    setIsSubmittingWg(true);
    setWgStatusMsg(null);
    try {
      const res = await fetch('/api/app?action=whiteglove-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          propertyTitle: title,
          dealLink: wgDealLink.trim() || undefined,
          targetCity: resolvedCity,
          currency: 'USD',
          valuation: parseEnglishNumber(wgValuation, 0),
          expectedMonthlyRent: parseEnglishNumber(wgExpectedRent, 0),
          goalNotes: wgGoalNotes.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        showToast(data?.error || 'Unable to submit White-Glove brief.');
        return;
      }
      if (data?.request) {
        setWgRequests((prev) => [data.request, ...prev]);
      }
      setWgPropertyTitle('');
      setWgDealLink('');
      setWgValuation('');
      setWgExpectedRent('');
      setWgGoalNotes('');
      setWgStatusMsg('Request received. Analysis will be delivered in 48h.');
      showToast('Request received. Analysis will be delivered in 48h.');
    } catch {
      showToast('Network error submitting White-Glove brief.');
    } finally {
      setIsSubmittingWg(false);
    }
  };

  // Saved Analyses filter
  const [savedSearch, setSavedSearch] = useState('');
  const [savedCityFilter, setSavedCityFilter] = useState('All');

  // Load macro sync status honestly (Source + Last updated + Data as of date)
  useEffect(() => {
    fetch('/api/app?action=macro-sync', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) {
          setMacroSyncInfo({
            source: d.source || 'FRED / World Bank / ExchangeRate API',
            last_updated: d.last_updated || marketLive?.last_synced_display || 'Today',
            data_as_of: d.data_as_of || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            real_estate_note: d.real_estate_note || 'Estimated / Demo data - بيانات تقديرية',
          });
        }
      })
      .catch(() => {});
  }, [activeTab]);

  // Debounced city search autocomplete via /api/app?action=city-search
  useEffect(() => {
    if (!isAddCityOpen) return;
    const q = cityQuery.trim();
    if (q.length < 2) {
      setCitySuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCity(true);
      try {
        const res = await fetch(`/api/app?action=city-search&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setCitySuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
        }
      } catch {
        setCitySuggestions([]);
      } finally {
        setIsSearchingCity(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [cityQuery, isAddCityOpen]);

  // Analyze custom city via /api/app?action=city-analyze (consumes 1 credit, persists to DB + localStorage)
  const handleAnalyzeCustomCity = async (explicitName?: string) => {
    const targetCity = (explicitName || cityQuery).trim();
    if (!targetCity) {
      setCityError('City not found, try another spelling - المدينة غير موجودة، جرب تهجئة ثانية');
      return;
    }

    if (isExpired || (!license.isUnlimitedAnalyses && analysesRemaining <= 0)) {
      showToast('Licensing window expired or quota reached - Renew');
      setIsAddCityOpen(false);
      onOpenRenewal();
      return;
    }

    setCityError(null);
    setIsAnalyzingCity(true);
    try {
      const res = await fetch('/api/app?action=city-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          city: targetCity,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !data?.cityCard) {
        setCityError(
          data?.error || 'City not found, try another spelling - المدينة غير موجودة، جرب تهجئة ثانية'
        );
        return;
      }

      const nextCustomCities: CustomCityCard[] = Array.isArray(data.custom_cities)
        ? data.custom_cities
        : [data.cityCard, ...customCities.filter((c) => c.city.toLowerCase() !== data.cityCard.city.toLowerCase())];

      try {
        localStorage.setItem(
          `aqari_custom_cities_${user.email.toLowerCase()}`,
          JSON.stringify(nextCustomCities)
        );
      } catch {}

      const nextLeft = data.license?.isUnlimitedAnalyses
        ? 999999
        : data.license?.analysesLeft ?? Math.max(0, analysesRemaining - 1);

      onUpdateUser({
        ...user,
        customCities: nextCustomCities,
        analysesUsed: data.license?.analysesUsed ?? (user.analysesUsed || 0) + 1,
        freeAnalyses: nextLeft,
        freeAnalysesLeft: nextLeft,
        analysesLeft: nextLeft,
      });

      const card: CustomCityCard = data.cityCard;
      setSelectedPresetId(card.id);
      setPropertyName(`${card.city} Prime Residential`);
      setCity(card.city);
      setPriceUSD(card.estimatedAvgPriceUSD);
      setRentUSD(card.estimatedAvgRentUSD);
      setStressTestActive(false);
      setHasRunAnalysis(true);

      setIsAddCityOpen(false);
      setCityQuery('');
      setCitySuggestions([]);
      showToast(`Added ${card.city} (${card.grossYield}% Gross Estimated) • 1 credit deducted`);
    } catch {
      setCityError('City not found, try another spelling - المدينة غير موجودة، جرب تهجئة ثانية');
    } finally {
      setIsAnalyzingCity(false);
    }
  };

  const handleSelectCustomCity = (card: CustomCityCard) => {
    setSelectedPresetId(card.id);
    setPropertyName(`${card.city} Prime Residential`);
    selectTargetCity(card.city, false);
    setPriceUSD(card.estimatedAvgPriceUSD);
    setRentUSD(card.estimatedAvgRentUSD);
    clearPendingRun();
    showToast(`Loaded ${card.city} inputs - click RUN ANALYSIS (-1 CREDIT) to calculate`);
  };

  // Load a preset property into analyzer (does NOT deduct credit or auto-run)
  const handleSelectPreset = (id: string) => {
    const prop = PROPERTY_LISTINGS.find((p) => p.id === id);
    if (!prop) return;
    setSelectedPresetId(prop.id);
    setPropertyName(prop.title);
    selectTargetCity(prop.city, true);
    setPriceUSD(prop.basePriceUSD);
    setRentUSD(prop.baseRentMonthlyUSD);
    setPropertyImageUrl(prop.imageUrl);
    clearPendingRun();
  };

  // Run Analysis Action (Backend enforced + Consumes 1 Credit — ONLY way metrics calculate)
  const handleRunAnalysis = async () => {
    if (isExpired) {
      showToast('No analyses left. Renew / Upgrade.');
      onOpenRenewal();
      return;
    }

    if (!license.isUnlimitedAnalyses && analysesRemaining <= 0) {
      showToast('No analyses left. Renew / Upgrade.');
      onOpenRenewal();
      return;
    }

    const validatedCity = resolveCityFromInput(cityComboInput);
    if (!validatedCity) {
      showToast('City not supported yet. Choose from list.');
      return;
    }
    const cleanCityName = validatedCity.city;
    if (city !== cleanCityName) {
      setCity(cleanCityName);
    }

    if (
      !Number.isFinite(priceUSD) ||
      priceUSD <= 0 ||
      !Number.isFinite(rentUSD) ||
      rentUSD <= 0 ||
      !Number.isFinite(downPaymentPct) ||
      downPaymentPct <= 0 ||
      downPaymentPct > 100 ||
      !Number.isFinite(interestRatePct) ||
      interestRatePct <= 0 ||
      !Number.isFinite(operatingExpensePct) ||
      operatingExpensePct <= 0 ||
      operatingExpensePct >= 100
    ) {
      showToast('Please enter valid numeric values greater than 0 for all inputs.');
      return;
    }

    setIsAnalyzingApi(true);
    try {
      const res = await fetch('/api/app?action=run-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          name: user.name,
          propertyTitle: propertyName.trim() || 'Institutional Asset',
          city: cleanCityName,
          priceUSD,
          rentUSD,
          downPaymentPct,
          interestRatePct,
          operatingExpensePct,
          useSensitivity: canSensitivity,
          useMonteCarlo: false,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        showToast(data?.error || 'Rate limit exceeded. Please wait.');
        return;
      }
      if (res.status === 400) {
        showToast(data?.error || 'Invalid inputs. All numeric fields must be > 0.');
        return;
      }
      if (res.status === 403 || !res.ok || data?.success === false) {
        showToast(data?.error || 'No analyses left. Renew / Upgrade.');
        onOpenRenewal();
        return;
      }

      if (data?.license) {
        const nextLeft = data.license.isUnlimitedAnalyses
          ? 999999
          : data.license.analysesLeft ?? Math.max(0, analysesRemaining - 1);
        const nextSucc =
          typeof data.successful_analyses === 'number'
            ? data.successful_analyses
            : (user.successfulAnalyses ?? 0) + 1;
        onUpdateUser({
          ...user,
          plan: data.license.planKey || user.plan,
          analysesUsed: data.license.analysesUsed ?? (user.analysesUsed || 0) + 1,
          successfulAnalyses: nextSucc,
          cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
          freeAnalyses: nextLeft,
          freeAnalysesLeft: nextLeft,
          analysesLeft: nextLeft,
        });
      } else if (onConsumeAnalysis) {
        onConsumeAnalysis();
      }

      if (data?.result) {
        setRunResult({
          analyzedAt: data.analyzedAt || new Date().toISOString(),
          inputs: data.inputs || {
            propertyTitle: propertyName,
            city,
            priceUSD,
            rentUSD,
            downPaymentPct,
            interestRatePct,
            operatingExpensePct,
          },
          ...data.result,
        });
        setMonteCarloResult(data.result.monteCarlo || null);
        setStressTestActive(Boolean(data.result.monteCarlo));
      }
      setHasRunAnalysis(true);
      const nextRemaining =
        data?.analyses_left ?? data?.license?.analysesLeft ?? Math.max(0, analysesRemaining - 1);
      showToast(`Analysis complete. 1 credit deducted (${nextRemaining} left).`);
    } catch {
      showToast('Network error while running underwriting analysis. Please try again.');
    } finally {
      setIsAnalyzingApi(false);
    }
  };

  // Trigger 1000-Cycle Monte Carlo Scenario (Backend Gated to Professional+)
  const handleToggleMonteCarlo = async () => {
    if (!canMonteCarlo) {
      showToast('Available in PROFESSIONAL - Upgrade');
      onOpenRenewal();
      return;
    }
    setIsRunningMonteCarlo(true);
    try {
      const targetInputs = runResult?.inputs || {
        priceUSD,
        rentUSD,
        downPaymentPct,
        interestRatePct,
        operatingExpensePct,
      };
      const res = await fetch('/api/app?action=monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          priceUSD: targetInputs.priceUSD,
          rentUSD: targetInputs.rentUSD,
          downPaymentPct: targetInputs.downPaymentPct,
          interestRatePct: targetInputs.interestRatePct,
          operatingExpensePct: targetInputs.operatingExpensePct,
          seedOffset: Date.now() % 100000,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 || !res.ok || data?.success === false) {
        showToast(data?.error || 'Available in PROFESSIONAL - Upgrade');
        onOpenRenewal();
        return;
      }
      if (data?.monteCarlo) {
        setMonteCarloResult(data.monteCarlo);
        setStressTestActive(true);
        showToast('1000-cycle Monte Carlo stress test completed.');
      }
    } catch {
      showToast('Unable to run Monte Carlo simulation. Please retry.');
    } finally {
      setIsRunningMonteCarlo(false);
    }
  };

  // Save Analysis to Portfolio (Strict Save <= Analyses Limit Enforced by Server)
  const handleSaveAnalysis = async () => {
    if (isExpired) {
      showToast('Licensing window expired - Renew');
      onOpenRenewal();
      return;
    }

    if (!hasRunAnalysis || !runResult) {
      showToast('Click RUN ANALYSIS (-1 CREDIT) first before saving to portfolio.');
      return;
    }

    const savedList = user.savedAnalyses || [];
    if (!canSaveProperty || savedList.length >= maxSaved) {
      showToast(
        `Save limit reached for ${planDisplayName}: ${savedList.length}/${maxSaved}. Upgrade to save more.`
      );
      onOpenRenewal();
      return;
    }

    const newAnalysis: SavedAnalysis = {
      id: 'saved_' + Date.now(),
      property: runResult.inputs.propertyTitle || propertyName,
      city: runResult.inputs.city || city,
      price: runResult.inputs.priceUSD,
      rent: runResult.inputs.rentUSD,
      capRate: runResult.capRate,
      cashOnCash: runResult.cashOnCash,
      irr: runResult.irr5Yr ?? Number((runResult.cashOnCash + 4.8).toFixed(1)),
      dscr: runResult.dscr ?? '0.00',
      monthlyCashflow: runResult.monthlyCashflowUSD ?? 0,
      riskScore: runResult.capRate > 7 ? 'AAA' : 'AA',
      date: Date.now(),
      imageUrl: propertyImageUrl,
      notes: `${runResult.inputs.downPaymentPct}% down, ${runResult.inputs.interestRatePct}% rate, ${runResult.inputs.operatingExpensePct}% OPEX`,
    };

    try {
      const res = await fetch('/api/app?action=save-to-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          name: user.name,
          currentSavedCount: savedList.length,
          analysis: newAnalysis,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) {
        showToast(
          data?.error ||
            `Save limit reached for ${planDisplayName}: ${savedList.length}/${maxSaved}.`
        );
        onOpenRenewal();
        return;
      }

      const savedItem = data?.savedItem || newAnalysis;
      const newSavedList = [savedItem, ...savedList];
      const newTotalVal = newSavedList.reduce((acc, curr) => acc + curr.price, 0);
      const newMonthlyCash = newSavedList.reduce((acc, curr) => acc + curr.monthlyCashflow, 0);

      onUpdateUser({
        ...user,
        savedCount: data?.saved_count ?? newSavedList.length,
        savedAnalyses: newSavedList,
        portfolio: { totalValue: newTotalVal, monthlyCashflow: newMonthlyCash },
      });
      showToast(`Saved "${savedItem.property}" (${newSavedList.length}/${maxSaved})!`);
    } catch {
      showToast('Unable to save to portfolio right now. Please try again.');
    }
  };

  // Delete saved analysis
  const handleDeleteSaved = (id: string) => {
    const updatedList = (user.savedAnalyses || []).filter((item) => item.id !== id);
    const newTotalVal = updatedList.reduce((acc, curr) => acc + curr.price, 0);
    const newMonthlyCash = updatedList.reduce((acc, curr) => acc + curr.monthlyCashflow, 0);
    onUpdateUser({
      ...user,
      savedCount: updatedList.length,
      savedAnalyses: updatedList,
      portfolio: { totalValue: newTotalVal, monthlyCashflow: newMonthlyCash },
    });
    showToast('Analysis deleted from portfolio.');
  };

  // Load saved analysis back into calculator
  const handleLoadSaved = (item: SavedAnalysis) => {
    setPropertyName(item.property);
    selectTargetCity(item.city, false);
    setPriceUSD(item.price);
    setRentUSD(item.rent);
    if (item.imageUrl) setPropertyImageUrl(item.imageUrl);
    if (item.id.startsWith('demo-')) {
      clearPendingRun();
      showToast(`Loaded demo inputs for ${item.property} — click RUN ANALYSIS (-1 CREDIT) to run.`);
    } else {
      const dp = item.price * (downPaymentPct / 100);
      const gross = item.rent * 12 * 0.95;
      const opex = gross * (operatingExpensePct / 100);
      const noi = gross - opex;
      setRunResult({
        analyzedAt: new Date(item.date || Date.now()).toISOString(),
        inputs: {
          propertyTitle: item.property,
          city: item.city,
          priceUSD: item.price,
          rentUSD: item.rent,
          downPaymentPct,
          interestRatePct,
          operatingExpensePct,
        },
        capRate: item.capRate,
        cashOnCash: item.cashOnCash,
        irr5Yr: item.irr,
        dscr: item.dscr,
        monthlyCashflowUSD: item.monthlyCashflow,
        monthlyMortgageUSD: null,
        netOperatingIncomeUSD: Math.round(noi),
        annualGrossRentUSD: Math.round(gross),
        annualOPEXUSD: Math.round(opex),
        annualDebtServiceUSD: Math.round(Math.max(0, noi - item.monthlyCashflow * 12)),
        downPaymentUSD: Math.round(dp),
        sensitivity: null,
        monteCarlo: null,
      });
      setHasRunAnalysis(true);
      showToast(`Loaded saved report: ${item.property}`);
    }
    setActiveTab('analyze');
  };

  // Seed sample portfolio if empty
  const handleSeedSamplePortfolio = () => {
    const sampleItems: SavedAnalysis[] = [
      {
        id: 'seed-1',
        property: 'The Wave Marina Sky Residence',
        city: 'Muscat',
        price: 652800,
        rent: 4570,
        capRate: 8.4,
        cashOnCash: 9.8,
        irr: 14.6,
        dscr: '1.85',
        monthlyCashflow: 2150,
        riskScore: 'AAA',
        date: Date.now() - 2 * 24 * 60 * 60 * 1000,
        imageUrl: PROPERTY_LISTINGS[0].imageUrl,
      },
      {
        id: 'seed-2',
        property: 'Downtown Burj Crown Skyline Suite',
        city: 'Dubai',
        price: 1240000,
        rent: 8160,
        capRate: 7.9,
        cashOnCash: 8.4,
        irr: 13.2,
        dscr: '1.68',
        monthlyCashflow: 3840,
        riskScore: 'AAA',
        date: Date.now() - 5 * 24 * 60 * 60 * 1000,
        imageUrl: PROPERTY_LISTINGS[1].imageUrl,
      },
      {
        id: 'seed-3',
        property: 'Mayfair Sovereign Residences',
        city: 'London',
        price: 3180000,
        rent: 12720,
        capRate: 4.8,
        cashOnCash: 5.1,
        irr: 9.9,
        dscr: '1.42',
        monthlyCashflow: 4100,
        riskScore: 'AA',
        date: Date.now() - 10 * 24 * 60 * 60 * 1000,
        imageUrl: PROPERTY_LISTINGS[2].imageUrl,
      },
    ];

    const newTotalVal = sampleItems.reduce((acc, curr) => acc + curr.price, 0);
    const newMonthlyCash = sampleItems.reduce((acc, curr) => acc + curr.monthlyCashflow, 0);

    onUpdateUser({
      ...user,
      savedAnalyses: sampleItems,
      portfolio: { totalValue: newTotalVal, monthlyCashflow: newMonthlyCash },
    });
    showToast('Loaded 3 institutional sample assets into portfolio.');
  };

  // Backend-enforced PDF Memorandum Export with real watermarked PDF download
  const handleExportPDF = async (title: string) => {
    if (!canPdfExport) {
      showToast('Available in PROFESSIONAL - Upgrade');
      onOpenRenewal();
      return;
    }
    if (!hasRunAnalysis || !runResult) {
      showToast('Please run analysis first before exporting PDF.');
      return;
    }
    const r = runResult;
    const mc = monteCarloResult || r.monteCarlo;
    const metricsLines = [
      `Analysis Timestamp: ${new Date(r.analyzedAt).toLocaleString('en-US')}`,
      `Acquisition Price: ${formatPrice(r.inputs.priceUSD, currentCurrency)}`,
      `Gross Monthly Rent: ${formatPrice(r.inputs.rentUSD, currentCurrency)}`,
      `Equity Down: ${r.inputs.downPaymentPct}% (${formatPrice(r.downPaymentUSD, currentCurrency)})`,
      `Mortgage Interest Rate: ${r.inputs.interestRatePct}% | OPEX & HOA: ${r.inputs.operatingExpensePct}%`,
      `Net Operating Income (NOI): ${formatPrice(r.netOperatingIncomeUSD, currentCurrency)} / yr`,
      `Unlevered Cap Rate: ${r.capRate}%`,
      `Cash-on-Cash Return: ${r.cashOnCash}%`,
      `5-Year Equity IRR: ${r.irr5Yr ?? '--'}%`,
      `Monthly Net Cashflow: ${r.monthlyCashflowUSD !== null ? formatPrice(r.monthlyCashflowUSD, currentCurrency) : '--'}`,
      `Debt Service Coverage Ratio (DSCR): ${r.dscr ?? '--'}x`,
      ...(mc
        ? [
            `1000-Cycle Monte Carlo Pass Rate (DSCR >= 1.20x): ${mc.passRatePct}% (${mc.passCount}/${mc.cycles})`,
            `DSCR Percentiles: P10 ${mc.dscrP10}x | P50 ${mc.dscrP50}x | P90 ${mc.dscrP90}x`,
            `+200bps Rate Shock CoC: ${mc.rateShockCoC}% | 15% Vacancy Net Yield: ${mc.vacancySurgeNetYield}%`,
          ]
        : []),
    ];
    const pdfNotes = `${r.inputs.downPaymentPct}% Equity Down | ${r.inputs.interestRatePct}% Interest Rate | ${r.inputs.operatingExpensePct}% OPEX`;

    try {
      const res = await fetch('/api/app?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          format: 'pdf',
          propertyTitle: title,
        }),
      });
      if (res.status === 403) {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error || 'Available in PROFESSIONAL - Upgrade');
        onOpenRenewal();
        return;
      }
      const data = await res.json().catch(() => ({}));
      const filename = downloadMemorandumPdf({
        title,
        city: r.inputs.city || city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: pdfNotes,
        watermarkText: data?.watermark,
      });
      showToast(`Downloaded watermarked PDF: ${filename}`);
    } catch {
      const filename = downloadMemorandumPdf({
        title,
        city: r.inputs.city || city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: pdfNotes,
      });
      showToast(`Downloaded watermarked PDF: ${filename}`);
    }
  };

  // Portfolio calculations
  const savedAnalyses = user.savedAnalyses || [];
  const portfolioTotalValUSD = savedAnalyses.reduce((acc, curr) => acc + curr.price, 0);
  const portfolioMonthlyCashflowUSD = savedAnalyses.reduce((acc, curr) => acc + curr.monthlyCashflow, 0);
  const portfolioAvgCapRate = savedAnalyses.length
    ? (savedAnalyses.reduce((acc, curr) => acc + curr.capRate, 0) / savedAnalyses.length).toFixed(2)
    : '0.00';
  const portfolioAvgIRR = savedAnalyses.length
    ? (savedAnalyses.reduce((acc, curr) => acc + curr.irr, 0) / savedAnalyses.length).toFixed(1)
    : '0.0';

  // Filtered saved list
  const filteredSaved = useMemo(() => {
    return savedAnalyses.filter((item) => {
      const matchCity = savedCityFilter === 'All' || item.city.toLowerCase() === savedCityFilter.toLowerCase();
      const matchSearch = item.property.toLowerCase().includes(savedSearch.toLowerCase()) ||
                          item.city.toLowerCase().includes(savedSearch.toLowerCase());
      return matchCity && matchSearch;
    });
  }, [savedAnalyses, savedCityFilter, savedSearch]);

  // Computed Rules A-E cancellation & refund eligibility (mirrored with backend /api/app)
  const localCancelEligibility = useMemo(() => {
    const serverElig = user.cancellationEligibility;
    const succ = Math.max(
      Number(user.successfulAnalyses ?? 0),
      Number(serverElig?.successfulAnalyses ?? 0)
    );
    const hasIssue = Boolean(user.hasReportedIssue || serverElig?.hasReportedIssue);
    const issueReportedAt = user.issueReportedAt ?? serverElig?.issueReportedAt ?? null;
    const issueResolvedAt = user.issueResolvedAt ?? serverElig?.issueResolvedAt ?? null;
    const issueStatus = String(user.issueStatus || serverElig?.issueStatus || (hasIssue ? (issueResolvedAt ? 'resolved' : 'reported') : 'none'));
    const activatedAt = user.subscriptionStartAt || Date.now();
    const daysSinceActivation = Math.max(0, Math.floor((Date.now() - activatedAt) / (24 * 60 * 60 * 1000)));
    const refundableAmountUSD = Number(serverElig?.refundableAmountUSD ?? planPriceUSD ?? 0);

    if (license.planKey === 'free') {
      return {
        canCancel: false,
        rule: 'FREE',
        reason: 'Free plan does not have an active paid subscription.',
        buttonText: 'No Active Paid Subscription',
        daysSinceActivation: 0,
        successfulAnalyses: succ,
        hasReportedIssue: hasIssue,
        issueStatus,
        refundableAmountUSD: 0,
      };
    }

    if (succ >= 1) {
      return {
        canCancel: false,
        rule: 'A',
        reason: 'Cancellation unavailable - You completed 1 successful analysis. Refund not eligible.',
        buttonText: 'Cancellation Locked (Analysis Used)',
        daysSinceActivation,
        successfulAnalyses: succ,
        hasReportedIssue: hasIssue,
        issueStatus,
        refundableAmountUSD,
      };
    }

    if (hasIssue && issueReportedAt && !issueResolvedAt) {
      const daysSinceReport = (Date.now() - issueReportedAt) / (24 * 60 * 60 * 1000);
      if (daysSinceReport >= 7) {
        return {
          canCancel: true,
          rule: 'D',
          reason: 'Cancel - Tool issue not resolved in 7 days. Eligible for full refund.',
          buttonText: 'Cancel - Tool issue not resolved in 7 days',
          daysSinceActivation,
          successfulAnalyses: succ,
          hasReportedIssue: hasIssue,
          issueStatus,
          refundableAmountUSD,
        };
      }
      if (daysSinceActivation > 7) {
        return {
          canCancel: false,
          rule: 'PENDING_REVIEW',
          reason: 'Issue reported - Under 7-day review.',
          buttonText: 'Issue Reported - Under 7-Day Review',
          daysSinceActivation,
          successfulAnalyses: succ,
          hasReportedIssue: hasIssue,
          issueStatus,
          refundableAmountUSD,
        };
      }
    }

    if (
      hasIssue &&
      issueReportedAt &&
      issueResolvedAt &&
      issueResolvedAt - issueReportedAt <= 7 * 24 * 60 * 60 * 1000 &&
      daysSinceActivation > 7
    ) {
      return {
        canCancel: false,
        rule: 'E',
        reason: 'Cancellation unavailable - Tool issue resolved within 7 days and 7-day window passed.',
        buttonText: 'Cancellation Locked (Issue Resolved)',
        daysSinceActivation,
        successfulAnalyses: succ,
        hasReportedIssue: hasIssue,
        issueStatus,
        refundableAmountUSD,
      };
    }

    if (daysSinceActivation <= 7) {
      return {
        canCancel: true,
        rule: 'C',
        reason: 'Cancel within 7 days - No successful analysis yet',
        buttonText: 'Cancel within 7 days - No successful analysis yet',
        daysSinceActivation,
        successfulAnalyses: succ,
        hasReportedIssue: hasIssue,
        issueStatus,
        refundableAmountUSD,
      };
    }

    return {
      canCancel: false,
      rule: 'B',
      reason: 'Cancellation unavailable - 7-day window passed and no tool issue reported.',
      buttonText: 'Cancellation Locked (7-Day Window Passed)',
      daysSinceActivation,
      successfulAnalyses: succ,
      hasReportedIssue: hasIssue,
      issueStatus,
      refundableAmountUSD,
    };
  }, [user, license.planKey, planPriceUSD]);

  const handleReportToolIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = issueDescInput.trim();
    if (desc.length < 5) {
      setIssueModalError('Please describe the technical issue (at least 5 characters).');
      return;
    }
    setIsSubmittingIssue(true);
    setIssueModalError(null);
    try {
      const res = await fetch('/api/app?action=report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          description: desc,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        setIssueModalError(data?.error || 'Unable to submit issue report.');
        return;
      }
      onUpdateUser({
        ...user,
        hasReportedIssue: true,
        issueReportedAt: data.issue_reported_at ?? Date.now(),
        issueResolvedAt: null,
        issueDescription: desc,
        issueStatus: 'reported',
        cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
      });
      setIsIssueModalOpen(false);
      setIssueDescInput('');
      showToast('Tool issue reported. Our team has been notified.');
    } catch {
      setIssueModalError('Network error submitting issue report.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancellingSub(true);
    setCancelModalError(null);
    try {
      const res = await fetch('/api/app?action=cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        setCancelModalError(
          data?.error || 'Refund API failed. Your subscription remains active.'
        );
        return;
      }

      const freeCfg = PLANS.free;
      onUpdateUser({
        ...user,
        plan: 'free',
        planName: freeCfg.displayName,
        planPrice: 0,
        features: [...freeCfg.features],
        maxSaved: freeCfg.savedLimit,
        subscriptionPlan: 'free',
        subscriptionStatus: 'free',
        subscriptionEndsAt: null,
        subscriptionExpiry: null,
        analysesUsed: 0,
        successfulAnalyses: 0,
        freeAnalyses: freeCfg.analysesLimit,
        freeAnalysesLeft: freeCfg.analysesLimit,
        analysesLeft: freeCfg.analysesLimit,
        cancelStatus: 'refunded',
        cancellationEligibility: data.cancellationEligibility ?? null,
      });
      setIsCancelModalOpen(false);
      showToast(data?.message || 'Subscription cancelled & refund issued via Lemon Squeezy');
    } catch {
      setCancelModalError('Network error processing cancellation. Plan not deactivated.');
    } finally {
      setIsCancellingSub(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans select-none relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-zinc-900 border border-[#D4AF37]/50 text-white text-xs font-mono shadow-[0_10px_35px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2.5 backdrop-blur-xl">
          <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Subscription Expired / Plan Ended Lock Banner */}
      {isPlanEnded && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 text-rose-200 text-xs py-2.5 px-4 flex items-center justify-between backdrop-blur-md z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Your plan has ended.</strong> Renew to continue your underwriting analyses and portfolio tracking.
            </span>
          </div>
          <button
            onClick={onOpenRenewal}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold transition cursor-pointer shrink-0 ml-3 shadow-sm"
          >
            Renew Plan
          </button>
        </div>
      )}

      {/* Subscription Ending in 24 Hours Banner */}
      {!isPlanEnded && isEndingIn24h && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 text-amber-200 text-xs py-2 px-4 flex items-center justify-between backdrop-blur-md z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Your plan ends tomorrow. Renew to keep your analyses.
            </span>
          </div>
          <button
            onClick={onOpenRenewal}
            className="px-3 py-1 bg-[#D4AF37] hover:bg-[#F3E5AB] text-black rounded text-xs font-bold font-mono transition cursor-pointer shrink-0 ml-3"
          >
            Renew Now
          </button>
        </div>
      )}

      {/* Guest Mode Banner */}
      {user.provider === 'guest' && (
        <div className="bg-amber-950/80 border-b border-amber-500/40 text-amber-200 text-xs py-2.5 px-4 flex items-center justify-between backdrop-blur-md z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Guest Mode:</strong> Sign in to save your analyses permanently across devices and sessions.
            </span>
          </div>
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1 bg-[#D4AF37] hover:bg-amber-400 text-black rounded text-xs font-bold font-mono transition cursor-pointer shrink-0 ml-3"
            >
              Sign In to Save
            </button>
          )}
        </div>
      )}

      {/* Lemon Test Mode Banner */}
      {isTestMode && (
        <div className="bg-amber-950/95 border-b border-amber-500/40 text-amber-200 text-[11px] font-mono py-1.5 px-4 flex items-center justify-center gap-2 z-50">
          <span className="font-bold">⚠️ TEST MODE - No real money - Test card 4242 4242 4242 4242</span>
        </div>
      )}

      {/* Top Header */}
      <header className="h-16 border-b border-white/[0.08] bg-black/80 backdrop-blur-2xl px-4 lg:px-6 flex items-center justify-between shrink-0 sticky top-0 z-40">
        
        {/* Brand / Logo + Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition"
            aria-label="Toggle terminal menu"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5 text-[#D4AF37]" /> : <Menu className="w-5 h-5 text-white" />}
          </button>

          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#B8860B] to-[#996515] p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)] shrink-0">
            <div className="w-full h-full bg-black rounded-[10px] flex items-center justify-center">
              <span className="font-mono font-black text-xs text-[#D4AF37]">AQ</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-tight text-sm sm:text-base whitespace-nowrap">AQARI TERMINAL</span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
              LIVE APP
            </span>
          </div>
        </div>

        {/* Status Indicators & User Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* Unified Plan Badge: PLAN + days left */}
          {isEndingIn24h ? (
            <button
              onClick={onOpenRenewal}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-950/80 border border-red-500/60 text-xs font-mono text-red-400 font-bold uppercase animate-pulse cursor-pointer"
              title="Subscription ends tomorrow - Click to renew"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>{license.displayName} • 1 days left - Renew</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${license.planKey === 'free' ? 'bg-[#D4AF37]' : 'bg-emerald-400'} animate-pulse`} />
              <span className="font-bold uppercase text-white tracking-wide">
                {license.displayName}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-300">{daysLeft} days left</span>
            </div>
          )}

          {/* Analyses Left Badge */}
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-mono ${
            !license.isUnlimitedAnalyses && analysesRemaining <= 0
              ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'
          }`}>
            <strong className="text-white">{analysesLeftStr}</strong>
          </div>

          <div className="hidden xs:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-zinc-200">
            <span>🇺🇸</span>
            <span className="font-semibold">USD</span>
          </div>
        </div>

      </header>

      {/* Main Terminal Layout: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Mobile Sidebar Overlay Backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden animate-in fade-in duration-200"
          />
        )}

        {/* Left Sidebar (Desktop fixed, Mobile sliding drawer) */}
        <aside
          className={`fixed md:static top-16 bottom-0 left-0 z-40 w-64 md:w-64 border-r border-white/[0.08] bg-black/95 md:bg-black/60 backdrop-blur-2xl md:backdrop-blur-xl p-4 flex flex-col justify-between shrink-0 transition-transform duration-300 ease-in-out ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          
          <div className="space-y-4">
            
            {/* Top Navigation: Back to Homepage */}
            <button
              type="button"
              onClick={() => {
                setMobileSidebarOpen(false);
                onGoToHome();
              }}
              className="w-full flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/10 hover:border-[#D4AF37]/50 text-white font-mono text-xs font-semibold transition cursor-pointer shadow-sm group min-h-[44px]"
            >
              <span className="text-sm transition-transform group-hover:-translate-x-0.5">🏠</span>
              <span>Back to Homepage</span>
            </button>

            {/* Test Mode Badge in Sidebar if active */}
            {isTestMode && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono text-center leading-tight">
                ⚠️ TEST MODE - No real money - Test card 4242 4242 4242 4242
              </div>
            )}
            
            {/* User Profile Overview */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || user.email}
                  className="w-10 h-10 rounded-xl object-cover border border-[#D4AF37]/40 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#8B5CF6] flex items-center justify-center text-black font-black font-mono text-sm uppercase shadow-sm shrink-0">
                  {user.email.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="truncate flex-1">
                <div className="text-xs font-bold text-white truncate">{user.email}</div>
                <div className="text-[10px] font-mono text-[#D4AF37] flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="uppercase">{license.displayName} TERMINAL</span>
                </div>
              </div>
            </div>

            {/* Live 30-Day Licensing Countdown & Quota Progress Bar Widget */}
            <div className="px-3.5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] font-mono text-[11px] space-y-2">
              <div className="text-zinc-400 uppercase text-[9px] font-bold tracking-wider flex items-center justify-between">
                <span>LICENSING COUNTDOWN</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isPlanEnded ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
              </div>
              {isPlanEnded ? (
                <div className="text-rose-400 font-bold leading-tight">
                  Licensing window expired - Renew
                </div>
              ) : (
                <>
                  <div className="text-[#D4AF37] font-bold leading-snug">
                    {license.sidebarText}
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#D4AF37] to-emerald-400 transition-all duration-500 rounded-full"
                      style={{ width: `${license.progressPct}%` }}
                    />
                  </div>
                  {countdownText && license.planKey !== 'free' && (
                    <div className="text-[10px] text-zinc-400">{countdownText}</div>
                  )}
                </>
              )}
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1 text-xs font-mono">
              <button
                onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] ${
                  activeTab === 'dashboard'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>My Dashboard</span>
              </button>

              <button
                onClick={() => { setActiveTab('analyze'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] ${
                  activeTab === 'analyze'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Analyze New Property</span>
              </button>

              <button
                onClick={() => { setActiveTab('saved'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] ${
                  activeTab === 'saved'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <BookmarkCheck className="w-4 h-4" />
                <span>Saved Analyses</span>
              </button>

              <button
                onClick={() => { setActiveTab('portfolio'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] ${
                  activeTab === 'portfolio'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Portfolio</span>
              </button>

              <button
                onClick={() => { setActiveTab('radar'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] ${
                  activeTab === 'radar'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Market Radar</span>
              </button>

              <button
                onClick={() => { setActiveTab('settings'); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition cursor-pointer min-h-[44px] ${
                  activeTab === 'settings'
                    ? 'bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </nav>

            {/* PART 1 & 4: Sign Out and Forget Device options in sidebar menu - ENGLISH ONLY */}
            <div className="pt-2 space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  onSignOut(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 hover:text-rose-200 transition cursor-pointer min-h-[44px] font-mono text-xs font-bold"
                aria-label="Sign Out"
              >
                <span className="font-semibold tracking-wide">Sign Out</span>
                <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  onSignOut(true);
                }}
                className="w-full text-center py-1 text-[10px] font-mono text-zinc-500 hover:text-rose-400 hover:underline transition cursor-pointer"
                title="Sign out and remove from remembered accounts on this device"
              >
                Sign out and forget this device
              </button>
            </div>

          </div>

          {/* Bottom Upgrade / Renew Button - Always Visible Gold Button (PWA Install moved exclusively to bottom page Footer) */}
          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            <button
              onClick={onOpenRenewal}
              className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] text-black font-black text-xs font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>Upgrade / Renew Plan</span>
            </button>
            <div className="text-[11px] text-center text-zinc-500 font-mono">
              30-day licensing • Real Lemon Checkout
            </div>
          </div>

        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
          {license.planKey !== 'free' && !isExpired && user.lockedLaunchPrice && (
            <div className="max-w-6xl mx-auto p-3.5 rounded-2xl bg-gradient-to-r from-[#D4AF37]/15 via-emerald-500/10 to-[#D4AF37]/15 border border-[#D4AF37]/40 text-xs font-mono text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>
                  You locked Launch Price <strong className="text-white">{user.lockedLaunchPrice}$</strong> - Your next renewal will be at same launch price if you renew before expiry
                </span>
              </div>
              <span className="text-[10px] text-emerald-300 font-bold shrink-0">
                {daysLeft}d left
              </span>
            </div>
          )}
          
          {/* TAB 1: ANALYZE NEW PROPERTY */}
          {activeTab === 'analyze' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>INSTITUTIONAL UNDERWRITING MODULE</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Underwrite New Property
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIssueModalError(null);
                      setIsIssueModalOpen(true);
                    }}
                    className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Report Tool Issue</span>
                  </button>
                  <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]">
                    {license.displayName}
                  </span>
                  <span className="text-xs font-mono text-white bg-white/[0.04] px-3 py-1.5 rounded-xl border border-white/[0.08]">
                    {analysesLeftStr}
                  </span>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    {daysLeft} days left
                  </span>
                </div>
              </div>

              {/* Presets & Add Your City */}
              <div className="glass-panel p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm font-mono text-zinc-300">
                  <span>Quick Load Verified Sovereign Listing:</span>
                  <span className="text-[#D4AF37] font-bold">7 Prime Global Assets</span>
                </div>

                {/* Searchable City Shortcut Button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setCityComboOpen(true);
                      cityComboInputRef.current?.focus();
                      cityComboInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-mono text-sm font-bold transition cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>+ Select From {CITIES.length.toLocaleString('en-US')}+ Global Cities</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {PROPERTY_LISTINGS.map((p) => {
                    const isSelected = selectedPresetId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPreset(p.id)}
                        className={`p-3 rounded-xl text-left transition border cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                            : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold uppercase text-[#D4AF37] truncate">{p.city}</div>
                        <div className="text-sm font-semibold truncate text-white mt-0.5">{p.title.split(' ')[0]}</div>
                        <div className="text-xs font-mono text-zinc-300 font-bold mt-1">{p.grossYield}% Gross</div>
                      </button>
                    );
                  })}

                  {customCities.map((c) => {
                    const isSelected = selectedPresetId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCustomCity(c)}
                        className={`p-3 rounded-xl text-left transition border cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                            : 'bg-emerald-950/20 border-emerald-500/30 text-zinc-300 hover:border-[#D4AF37]/60 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold uppercase text-emerald-400 truncate">
                          {c.city.toUpperCase()}
                        </div>
                        <div className="text-sm font-semibold truncate text-white mt-0.5">City</div>
                        <div className="text-xs font-mono text-[#D4AF37] font-bold mt-1">{c.grossYield}% Gross</div>
                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">Estimated • {c.country}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Your City Modal */}
              {isAddCityOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                  onClick={() => setIsAddCityOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-3xl bg-zinc-950 border border-[#D4AF37]/40 p-6 space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-5 h-5 text-[#D4AF37]" />
                        <h3 className="text-lg font-bold text-white">Add Your City</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddCityOpen(false)}
                        className="p-2 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 relative">
                      <label className="text-xs font-mono text-zinc-400 uppercase block">
                        City Name (Worldwide)
                      </label>
                      <input
                        type="text"
                        value={cityQuery}
                        onChange={(e) => {
                          setCityQuery(e.target.value);
                          setCityError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAnalyzeCustomCity();
                          }
                        }}
                        placeholder="Type your city... e.g. Salalah, Sohar, Jeddah, Doha, Abu Dhabi"
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/15 text-white text-sm font-mono outline-none focus:border-[#D4AF37]"
                        autoFocus
                      />

                      {isSearchingCity && (
                        <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5 pt-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                          <span>Searching global cities...</span>
                        </div>
                      )}

                      {citySuggestions.length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-xl bg-black/95 border border-white/15 divide-y divide-white/[0.06]">
                          {citySuggestions.map((s, idx) => (
                            <button
                              key={`${s.city}-${idx}`}
                              type="button"
                              onClick={() => {
                                setCityQuery(s.displayName);
                                setCitySuggestions([]);
                                handleAnalyzeCustomCity(s.displayName);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-mono text-zinc-200 hover:bg-[#D4AF37]/15 hover:text-white flex items-center justify-between cursor-pointer"
                            >
                              <span>{s.city}</span>
                              <span className="text-xs text-zinc-400">{s.country}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {cityError && (
                      <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-sm font-mono text-rose-200">
                        {cityError}
                      </div>
                    )}

                    <div className="text-xs font-mono text-zinc-400">
                      Estimated / Demo data - بيانات تقديرية • Consumes 1 analysis credit if valid city is found.
                    </div>

                    <button
                      type="button"
                      disabled={isAnalyzingCity}
                      onClick={() => handleAnalyzeCustomCity()}
                      className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-black text-sm font-mono transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 min-h-[48px]"
                    >
                      {isAnalyzingCity ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analyzing City...</span>
                        </>
                      ) : (
                        <span>Analyze My City - حلل مدينتي</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Typed Parameter Controls & Underwriting Model */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left: Explicit Typed Numeric Input Controls (ZERO sliders, ZERO auto-calc) */}
                <div className="lg:col-span-7 glass-panel p-6 space-y-5">
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white border-b border-white/[0.06] pb-3 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#D4AF37]" />
                    <span>Acquisition &amp; Financing Inputs</span>
                  </h3>

                  {/* Property Name & Searchable City Combobox (1,273 Global Cities) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="td-asset-title" className="text-xs font-mono text-zinc-400 block mb-1 uppercase">
                        Asset Title
                      </label>
                      <input
                        id="td-asset-title"
                        type="text"
                        value={propertyName}
                        onChange={(e) => {
                          setPropertyName(e.target.value);
                          clearPendingRun();
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm font-mono outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div className="relative">
                      <label htmlFor="td-target-city" className="text-xs font-mono text-zinc-400 block mb-1 uppercase">
                        Target Market / City ({CITIES.length.toLocaleString('en-US')}+ Cities)
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          ref={cityComboInputRef}
                          id="td-target-city"
                          type="text"
                          value={cityComboInput}
                          onFocus={() => setCityComboOpen(true)}
                          onBlur={() => setTimeout(() => setCityComboOpen(false), 180)}
                          onChange={(e) => {
                            setCityComboInput(e.target.value);
                            setCityComboOpen(true);
                            clearPendingRun();
                          }}
                          placeholder="Type city... e.g. Muscat"
                          autoComplete="off"
                          className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-zinc-900 border border-white/15 focus:border-[#D4AF37] text-white text-sm font-mono outline-none"
                        />
                        {cityComboInput && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCityComboInput('');
                              setCityComboOpen(true);
                              cityComboInputRef.current?.focus();
                              clearPendingRun();
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                            aria-label="Clear city"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {cityComboOpen && (
                        <div className="absolute z-40 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl bg-zinc-950 border border-[#D4AF37]/40 shadow-[0_14px_40px_rgba(0,0,0,0.9)] divide-y divide-white/[0.06]">
                          {cityDropdownOptions.length === 0 ? (
                            <div className="px-3.5 py-3 text-xs font-mono text-rose-300">
                              City not supported yet. Choose from list.
                            </div>
                          ) : (
                            cityDropdownOptions.map((c) => (
                              <button
                                key={`${c.city}-${c.countryCode}`}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectTargetCity(c, true);
                                  setCityComboOpen(false);
                                  clearPendingRun();
                                }}
                                className="w-full text-left px-3.5 py-2.5 text-xs font-mono text-zinc-200 hover:bg-[#D4AF37]/20 hover:text-white flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <span className="font-bold">{formatCityOptionLabel(c)}</span>
                                <span className="text-[11px] text-[#D4AF37] shrink-0">
                                  {c.avgCapRate}% Cap • {c.currency}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {selectedCityEntry ? (
                        <div className="text-[10px] font-mono text-emerald-400 mt-1 truncate">
                          Market: {selectedCityEntry.city}, {selectedCityEntry.country} - Avg Cap Rate {selectedCityEntry.avgCapRate}% - Display in USD
                        </div>
                      ) : cityComboInput.trim() ? (
                        <div className="text-[10px] font-mono text-rose-400 mt-1">
                          City not supported yet. Choose from list.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Typed English Number Inputs: Acquisition Valuation ($) & Gross Monthly Rent ($/mo) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="td-price-usd" className="text-xs font-mono text-zinc-300 block">
                        Acquisition Valuation ($)
                      </label>
                      <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                        <span className="text-xs font-mono text-[#D4AF37] mr-2">$</span>
                        <input
                          id="td-price-usd"
                          type="text"
                          data-numeric="true"
                          lang="en"
                          dir="ltr"
                          inputMode="decimal"
                          autoComplete="off"
                          style={EN_INPUT_STYLE}
                          value={formatUsdInputDisplay(priceUSD)}
                          onChange={(e) => {
                            const num = Math.max(0, Math.round(parseEnglishNumber(e.target.value, 0)));
                            setPriceUSD(num);
                            clearPendingRun();
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData?.getData('text') || '';
                            const num = Math.max(0, Math.round(parseEnglishNumber(text, 0)));
                            setPriceUSD(num);
                            clearPendingRun();
                          }}
                          className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none"
                        />
                        <span className="text-[11px] font-mono text-zinc-400 ml-2">USD</span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        USD Valuation: {formatPrice(priceUSD, 'USD')}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="td-rent-usd" className="text-xs font-mono text-zinc-300 block">
                        Gross Monthly Rent ($/mo)
                      </label>
                      <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-emerald-400 px-3">
                        <span className="text-xs font-mono text-emerald-400 mr-2">$</span>
                        <input
                          id="td-rent-usd"
                          type="text"
                          data-numeric="true"
                          lang="en"
                          dir="ltr"
                          inputMode="decimal"
                          autoComplete="off"
                          style={EN_INPUT_STYLE}
                          value={formatUsdInputDisplay(rentUSD)}
                          onChange={(e) => {
                            const num = Math.max(0, Math.round(parseEnglishNumber(e.target.value, 0)));
                            setRentUSD(num);
                            clearPendingRun();
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData?.getData('text') || '';
                            const num = Math.max(0, Math.round(parseEnglishNumber(text, 0)));
                            setRentUSD(num);
                            clearPendingRun();
                          }}
                          className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none"
                        />
                        <span className="text-[11px] font-mono text-zinc-400 ml-2">$/mo</span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        Monthly Rent: {formatPrice(rentUSD, 'USD')} / mo
                      </div>
                    </div>
                  </div>

                  {/* Typed English Number Inputs: Equity Down (%), Mortgage Rate (%), OPEX & HOA (%) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                      <label htmlFor="td-down-pct" className="text-xs font-mono text-zinc-300 block">
                        Equity Down (%)
                      </label>
                      <div className="flex items-center rounded-lg bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-2.5">
                        <input
                          id="td-down-pct"
                          type="text"
                          data-numeric="true"
                          lang="en"
                          dir="ltr"
                          inputMode="decimal"
                          autoComplete="off"
                          style={EN_INPUT_STYLE}
                          value={downDraft}
                          onChange={(e) => {
                            const clean = sanitizeEnglishDecimal(e.target.value, true);
                            setDownDraft(clean);
                            setDownPaymentPct(Math.max(0, Math.min(100, parseEnglishNumber(clean, 0))));
                            clearPendingRun();
                          }}
                          onBlur={() => setDownDraft(String(downPaymentPct))}
                          onPaste={(e) => {
                            e.preventDefault();
                            const clean = sanitizeEnglishDecimal(e.clipboardData?.getData('text') || '', true);
                            setDownDraft(clean);
                            setDownPaymentPct(Math.max(0, Math.min(100, parseEnglishNumber(clean, 0))));
                            clearPendingRun();
                          }}
                          className="w-full py-2 bg-transparent text-white font-mono text-sm outline-none"
                        />
                        <span className="text-xs font-mono text-zinc-400">%</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                      <label htmlFor="td-rate-pct" className="text-xs font-mono text-zinc-300 block">
                        Mortgage Rate (%)
                      </label>
                      <div className="flex items-center rounded-lg bg-black/50 border border-white/15 focus-within:border-purple-400 px-2.5">
                        <input
                          id="td-rate-pct"
                          type="text"
                          data-numeric="true"
                          lang="en"
                          dir="ltr"
                          inputMode="decimal"
                          autoComplete="off"
                          style={EN_INPUT_STYLE}
                          value={rateDraft}
                          onChange={(e) => {
                            const clean = sanitizeEnglishDecimal(e.target.value, true);
                            setRateDraft(clean);
                            setInterestRatePct(Math.max(0, Math.min(30, parseEnglishNumber(clean, 0))));
                            clearPendingRun();
                          }}
                          onBlur={() => setRateDraft(String(interestRatePct))}
                          onPaste={(e) => {
                            e.preventDefault();
                            const clean = sanitizeEnglishDecimal(e.clipboardData?.getData('text') || '', true);
                            setRateDraft(clean);
                            setInterestRatePct(Math.max(0, Math.min(30, parseEnglishNumber(clean, 0))));
                            clearPendingRun();
                          }}
                          className="w-full py-2 bg-transparent text-white font-mono text-sm outline-none"
                        />
                        <span className="text-xs font-mono text-zinc-400">%</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                      <label htmlFor="td-opex-pct" className="text-xs font-mono text-zinc-300 block">
                        OPEX &amp; HOA (%)
                      </label>
                      <div className="flex items-center rounded-lg bg-black/50 border border-white/15 focus-within:border-cyan-400 px-2.5">
                        <input
                          id="td-opex-pct"
                          type="text"
                          data-numeric="true"
                          lang="en"
                          dir="ltr"
                          inputMode="decimal"
                          autoComplete="off"
                          style={EN_INPUT_STYLE}
                          value={opexDraft}
                          onChange={(e) => {
                            const clean = sanitizeEnglishDecimal(e.target.value, true);
                            setOpexDraft(clean);
                            setOperatingExpensePct(Math.max(0, Math.min(99, parseEnglishNumber(clean, 0))));
                            clearPendingRun();
                          }}
                          onBlur={() => setOpexDraft(String(operatingExpensePct))}
                          onPaste={(e) => {
                            e.preventDefault();
                            const clean = sanitizeEnglishDecimal(e.clipboardData?.getData('text') || '', true);
                            setOpexDraft(clean);
                            setOperatingExpensePct(Math.max(0, Math.min(99, parseEnglishNumber(clean, 0))));
                            clearPendingRun();
                          }}
                          className="w-full py-2 bg-transparent text-white font-mono text-sm outline-none"
                        />
                        <span className="text-xs font-mono text-zinc-400">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Action Buttons + Live Remaining Credits Counter */}
                  <div className="pt-3 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        type="button"
                        onClick={handleRunAnalysis}
                        disabled={
                          isAnalyzingApi ||
                          isExpired ||
                          (!license.isUnlimitedAnalyses && analysesRemaining <= 0)
                        }
                        className={`flex-1 py-3.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-lg ${
                          isExpired || (!license.isUnlimitedAnalyses && analysesRemaining <= 0)
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed'
                            : 'bg-[#D4AF37] hover:bg-[#F3E5AB] text-black cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                        }`}
                      >
                        {isExpired || (!license.isUnlimitedAnalyses && analysesRemaining <= 0) ? (
                          <>
                            <Lock className="w-4 h-4 text-amber-400" />
                            <span>No analyses left. Renew / Upgrade.</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>{isAnalyzingApi ? 'RUNNING ANALYSIS...' : 'RUN ANALYSIS (-1 CREDIT)'}</span>
                          </>
                        )}
                      </button>

                      <div
                        className={`px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold text-center shrink-0 ${
                          isExpired || (!license.isUnlimitedAnalyses && analysesRemaining <= 0)
                            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                            : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'
                        }`}
                      >
                        {isExpired || (!license.isUnlimitedAnalyses && analysesRemaining <= 0)
                          ? '0 analyses left'
                          : analysesLeftStr}
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveAnalysis}
                        disabled={!hasRunAnalysis || !runResult}
                        className={`py-3.5 px-5 rounded-xl border font-bold text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                          !hasRunAnalysis || !runResult
                            ? 'bg-white/[0.02] border-white/5 text-zinc-600 cursor-not-allowed'
                            : !canSaveProperty || savedAnalyses.length >= maxSaved
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 cursor-pointer'
                            : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white cursor-pointer'
                        }`}
                      >
                        {canSaveProperty && savedAnalyses.length < maxSaved ? (
                          <BookmarkCheck className="w-4 h-4 text-[#D4AF37]" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-400" />
                        )}
                        <span>
                          {`SAVE TO PORTFOLIO (${savedAnalyses.length}/${maxSaved})`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Authoritative Backend Underwriting Output */}
                <div className="lg:col-span-5 glass-panel p-6 space-y-5 border border-[#D4AF37]/30 shadow-[0_0_35px_rgba(212,175,55,0.08)]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${hasRunAnalysis && runResult ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                      <h3 className="text-sm font-mono font-bold uppercase text-white">Underwriting Model</h3>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      hasRunAnalysis && runResult
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    }`}>
                      {hasRunAnalysis && runResult ? 'VERIFIED RUN' : 'AWAITING RUN'}
                    </span>
                  </div>

                  {!hasRunAnalysis || !runResult ? (
                    <>
                      <div className="p-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.015] text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 mx-auto flex items-center justify-center text-[#D4AF37]">
                          <Calculator className="w-5 h-5" />
                        </div>
                        <div className="text-sm font-mono font-bold text-white">
                          Enter inputs and click RUN ANALYSIS
                        </div>
                        <p className="text-xs font-mono text-zinc-400 max-w-sm mx-auto leading-relaxed">
                          Editing inputs pauses calculation. Click <strong className="text-[#D4AF37]">RUN ANALYSIS (-1 CREDIT)</strong> to generate results.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">Unlevered Cap Rate</div>
                          <div className="text-2xl font-black font-mono text-zinc-500 mt-1">--</div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">NOI / Purchase Price</div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">Cash-on-Cash Return</div>
                          <div className="text-2xl font-black font-mono text-zinc-500 mt-1">--</div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">Net Cash / Equity</div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">5-Year Equity IRR</div>
                          <div className="text-2xl font-black font-mono text-zinc-500 mt-1">--</div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">DSCR: --</div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">Monthly Net Cashflow</div>
                          <div className="text-2xl font-black font-mono text-zinc-500 mt-1">--</div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">Net After Debt Service</div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => showToast('Run analysis first')}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-mono font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/10 cursor-pointer flex items-center justify-center gap-2 transition"
                        >
                          <Download className="w-3.5 h-3.5 text-zinc-400" />
                          <span>EXPORT PDF (Run analysis first)</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">Unlevered Cap Rate</div>
                          <div className="text-2xl font-black font-mono text-[#D4AF37] mt-1">{runResult.capRate}%</div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">NOI: {formatPrice(runResult.netOperatingIncomeUSD, currentCurrency)}/yr</div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <div className="text-[10px] font-mono uppercase text-zinc-400">Cash-on-Cash Return</div>
                          <div className={`text-2xl font-black font-mono mt-1 ${runResult.cashOnCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {runResult.cashOnCash}%
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">Equity: {formatPrice(runResult.downPaymentUSD, currentCurrency)}</div>
                        </div>

                        {canSensitivity ? (
                          <>
                            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                              <div className="text-[10px] font-mono uppercase text-zinc-400">5-Year Equity IRR</div>
                              <div className="text-2xl font-black font-mono text-purple-400 mt-1">
                                {runResult.irr5Yr ?? Number((runResult.cashOnCash + 4.8).toFixed(1))}%
                              </div>
                              <div className="text-[9px] text-zinc-500 font-mono mt-0.5">DSCR: {runResult.dscr ?? '--'}x</div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                              <div className="text-[10px] font-mono uppercase text-zinc-400">Monthly Net Cashflow</div>
                              <div className={`text-2xl font-black font-mono mt-1 ${(runResult.monthlyCashflowUSD ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatPrice(runResult.monthlyCashflowUSD ?? 0, currentCurrency)}
                              </div>
                              <div className="text-[9px] text-zinc-500 font-mono mt-0.5">Debt/yr: {formatPrice(runResult.annualDebtServiceUSD, currentCurrency)}</div>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2 p-3.5 rounded-xl bg-black/50 border border-amber-500/30 flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2 text-zinc-300">
                              <Lock className="w-4 h-4 text-[#D4AF37] shrink-0" />
                              <span>5Y IRR, DSCR &amp; Cashflow Waterfall — Available in STARTER</span>
                            </div>
                            <button
                              type="button"
                              onClick={onOpenRenewal}
                              className="px-2.5 py-1 rounded bg-[#D4AF37] text-black font-bold text-[11px] cursor-pointer shrink-0 ml-2"
                            >
                              Upgrade
                            </button>
                          </div>
                        )}
                      </div>

                      {/* PDF Investment Memorandum Export (Professional+) */}
                      <div className="pt-2">
                        {canPdfExport ? (
                          <button
                            type="button"
                            onClick={() => handleExportPDF(runResult.inputs.propertyTitle || propertyName)}
                            className="w-full py-2.5 px-4 rounded-xl text-xs font-mono font-semibold bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/10 transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>EXPORT PDF MEMORANDUM</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              showToast('PDF Export available in PROFESSIONAL / SOVEREIGN - Upgrade');
                              onOpenRenewal();
                            }}
                            className="w-full py-2.5 px-4 rounded-xl text-xs font-mono font-semibold bg-white/[0.03] text-amber-300 border border-amber-500/30 hover:border-amber-400/60 transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>PDF Export available in PROFESSIONAL / SOVEREIGN - Upgrade</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* REAL GATED CAPABILITY WORKSPACE (Immediate Unlock / Explicit Locked Cards) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Yield & Sensitivity Matrix (STARTER+) */}
                <div className="glass-panel p-6 space-y-4 border border-white/[0.08]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2 text-sm font-mono font-bold text-white uppercase">
                      <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                      <span>Yield &amp; Sensitivity Calculator</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300">
                      STARTER+
                    </span>
                  </div>
                  {!canSensitivity ? (
                    <div className="p-5 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs font-mono text-zinc-300 space-y-1">
                          <div className="font-bold text-white">Available in STARTER - Upgrade</div>
                          <div className="text-zinc-400">
                            Unlock 5-Year IRR, DSCR covenant ratios, and -10% / Base / +10% rent sensitivity modeling.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenRenewal}
                        className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono shrink-0 cursor-pointer"
                      >
                        Upgrade
                      </button>
                    </div>
                  ) : runResult?.sensitivity ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-zinc-500 text-[10px] uppercase">
                            <th className="py-2">Scenario</th>
                            <th className="py-2">Monthly Rent</th>
                            <th className="py-2">Cap Rate</th>
                            <th className="py-2">CoC</th>
                            <th className="py-2">Cashflow/mo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {runResult.sensitivity.map((sc) => (
                            <tr key={sc.deltaPct} className={sc.deltaPct === 0 ? 'bg-[#D4AF37]/10 text-white font-bold' : 'text-zinc-300'}>
                              <td className="py-2">{sc.deltaPct > 0 ? `+${sc.deltaPct}% Bull` : sc.deltaPct < 0 ? `${sc.deltaPct}% Bear` : 'Base (0%)'}</td>
                              <td className="py-2">{formatPrice(sc.rentUSD, currentCurrency)}</td>
                              <td className="py-2 text-[#D4AF37]">{sc.capRate}%</td>
                              <td className="py-2 text-emerald-400">{sc.cashOnCash}%</td>
                              <td className="py-2">{formatPrice(sc.monthlyCashflowUSD, currentCurrency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-zinc-400 py-3">
                      Click <strong className="text-[#D4AF37]">RUN ANALYSIS (-1 CREDIT)</strong> above to generate -10% / 0% / +10% sensitivity scenarios.
                    </div>
                  )}
                </div>

                {/* 2. Cross-Border Tax & Visa Matrix Card (STARTER+) */}
                <div className="glass-panel p-6 space-y-4 border border-white/[0.08]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2 text-sm font-mono font-bold text-white uppercase">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span>Cross-Border Tax &amp; Visa Matrix</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300">
                      STARTER+
                    </span>
                  </div>
                  {!canFullMatrix ? (
                    <div className="p-5 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs font-mono text-zinc-300 space-y-1">
                          <div className="font-bold text-white">Available in STARTER - Upgrade</div>
                          <div className="text-zinc-400">
                            Unlock transfer tax, capital gains rules, and Golden Visa thresholds across 7 global jurisdictions.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenRenewal}
                        className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono shrink-0 cursor-pointer"
                      >
                        Upgrade
                      </button>
                    </div>
                  ) : (
                    (() => {
                      const matchedEntry = resolveCityFromInput(city) || selectedCityEntry || findCityEntry('Muscat')!;
                      const matchedRadar = CROSS_BORDER_DATA.find(
                        (row) => row.city.toLowerCase() === matchedEntry.city.toLowerCase()
                      );
                      return (
                        <div className="space-y-3 text-xs font-mono">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-white font-bold text-sm">
                              {matchedRadar?.flag || matchedEntry.countryCode} {matchedEntry.city}, {matchedEntry.country} ({matchedEntry.currency})
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('radar')}
                              className="text-[#D4AF37] underline cursor-pointer font-bold shrink-0"
                            >
                              Open Market Radar
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                              <div className="text-[10px] text-zinc-400">Avg Cap Rate</div>
                              <div className="text-sm font-bold text-[#D4AF37]">
                                {matchedRadar?.avgGrossYield ?? matchedEntry.avgCapRate}%
                              </div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                              <div className="text-[10px] text-zinc-400">Transfer Tax</div>
                              <div className="text-sm font-bold text-white">
                                {matchedRadar?.transferTaxPct ?? matchedEntry.taxRate}%
                              </div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                              <div className="text-[10px] text-zinc-400">Currency</div>
                              <div className="text-xs font-bold text-emerald-400 truncate">
                                {matchedEntry.currency}
                              </div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                              <div className="text-[10px] text-zinc-400">Residency / Visa</div>
                              <div className="text-[11px] font-bold text-cyan-400 truncate" title={matchedEntry.visaNote}>
                                {matchedEntry.visaNote}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* 3. 1000-Cycle Monte Carlo Stress Test (PROFESSIONAL+) */}
                <div className="glass-panel p-6 space-y-4 border border-white/[0.08]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2 text-sm font-mono font-bold text-white uppercase">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      <span>1000-Cycle Monte Carlo Stress Test (+200bps)</span>
                    </div>
                    {canMonteCarlo && (
                      <button
                        type="button"
                        onClick={handleToggleMonteCarlo}
                        disabled={isRunningMonteCarlo}
                        className="px-3 py-1 rounded-lg bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-bold text-[11px] font-mono cursor-pointer disabled:opacity-60"
                      >
                        {isRunningMonteCarlo ? 'Running 1000...' : 'Run 1000-Cycle Simulation'}
                      </button>
                    )}
                  </div>
                  {!canMonteCarlo ? (
                    <div className="p-5 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs font-mono text-zinc-300 space-y-1">
                          <div className="font-bold text-white">Available in PROFESSIONAL - Upgrade</div>
                          <div className="text-zinc-400">
                            Simulate 1,000 interest-rate (+200bps) &amp; vacancy cycles with DSCR p10/p50/p90 distribution.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenRenewal}
                        className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono shrink-0 cursor-pointer"
                      >
                        Upgrade
                      </button>
                    </div>
                  ) : monteCarloResult ? (
                    <div className="space-y-3 text-xs font-mono">
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="text-[10px] text-zinc-400">DSCR &gt;= 1.20x Pass Rate</div>
                          <div className="text-base font-black text-emerald-400">
                            {monteCarloResult.passRatePct}% ({monteCarloResult.passCount}/{monteCarloResult.cycles})
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                          <div className="text-[10px] text-zinc-400">+200bps Rate Shock</div>
                          <div className="text-base font-black text-white">{monteCarloResult.rateShockCoC}% CoC</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                          <div className="text-[10px] text-zinc-400">DSCR P10 / P50 / P90</div>
                          <div className="text-xs font-bold text-[#D4AF37] mt-0.5">
                            {monteCarloResult.dscrP10}x / {monteCarloResult.dscrP50}x / {monteCarloResult.dscrP90}x
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] text-zinc-400 uppercase">DSCR Distribution ({monteCarloResult.cycles} Cycles)</div>
                        {monteCarloResult.distribution.map((b) => (
                          <div key={b.label} className="flex items-center gap-2 text-[11px]">
                            <span className="w-28 text-zinc-400 shrink-0">{b.label}</span>
                            <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#D4AF37] to-emerald-400 rounded-full"
                                style={{ width: `${Math.max(4, b.pct)}%` }}
                              />
                            </div>
                            <span className="w-16 text-right text-white font-bold">{b.pct}% ({b.count})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-zinc-400 py-3">
                      Click <strong className="text-[#D4AF37]">Run 1000-Cycle Simulation</strong> or run underwriting to inspect DSCR &amp; rate-shock pass rates.
                    </div>
                  )}
                </div>

                {/* 4. Multi-Asset Portfolio Aggregation & PDF Summary (PROFESSIONAL+) */}
                <div className="glass-panel p-6 space-y-4 border border-white/[0.08]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2 text-sm font-mono font-bold text-white uppercase">
                      <Briefcase className="w-4 h-4 text-emerald-400" />
                      <span>Multi-Asset Portfolio Aggregation</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300">
                      PROFESSIONAL+
                    </span>
                  </div>
                  {!canPortfolioAgg ? (
                    <div className="p-5 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs font-mono text-zinc-300 space-y-1">
                          <div className="font-bold text-white">Available in PROFESSIONAL - Upgrade</div>
                          <div className="text-zinc-400">
                            Aggregate AUM, weighted Cap Rate, weighted IRR, and institutional PDF memorandums across saved assets.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenRenewal}
                        className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono shrink-0 cursor-pointer"
                      >
                        Upgrade
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs font-mono">
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <div className="text-[10px] text-zinc-400">Tracked Assets</div>
                          <div className="text-base font-bold text-white">{savedAnalyses.length} / {maxSaved}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <div className="text-[10px] text-zinc-400">Total AUM</div>
                          <div className="text-sm font-bold text-[#D4AF37]">{formatPrice(portfolioTotalValUSD, currentCurrency, { compact: true })}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <div className="text-[10px] text-zinc-400">Weighted Cap</div>
                          <div className="text-base font-bold text-emerald-400">{portfolioAvgCapRate}%</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('portfolio')}
                        className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs cursor-pointer"
                      >
                        Open Portfolio Intelligence
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. SOVEREIGN EXECUTIVE SUITE (REST API + 1-on-1 Analyst Desk + White-Glove Underwriting) */}
              <div className="glass-panel p-6 space-y-4 border border-purple-500/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2 text-sm font-mono font-bold text-purple-300 uppercase">
                    <Crown className="w-4 h-4 text-[#D4AF37]" />
                    <span>Sovereign Executive Suite: REST API, 1-on-1 Analyst Desk &amp; White-Glove Underwriting</span>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    SOVEREIGN
                  </span>
                </div>

                {!canApiAccess ? (
                  <div className="p-5 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs font-mono text-zinc-300 space-y-1">
                        <div className="font-bold text-white">Available in SOVEREIGN - Upgrade</div>
                        <div className="text-zinc-400">
                          Unlock Full REST API Credentials, 1-on-1 Dedicated Analyst Desk messaging, and White-glove Custom Underwriting intake.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenRenewal}
                      className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono shrink-0 cursor-pointer"
                    >
                      Upgrade to SOVEREIGN
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* REST API Token + API Docs */}
                    <div className="p-4 rounded-xl bg-black/50 border border-purple-500/25 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-mono uppercase text-zinc-300 font-bold flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-purple-400" />
                          <span>Full REST API Bearer Token</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowApiDocs((v) => !v)}
                          className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[11px] font-mono text-zinc-200 cursor-pointer"
                        >
                          {showApiDocs ? 'Hide API Docs' : 'API Docs'}
                        </button>
                      </div>

                      <div className="p-3 rounded-lg bg-black/70 font-mono text-xs text-zinc-200 border border-white/10 break-all flex items-center justify-between gap-3">
                        <span>{user.apiKey ? `Bearer ${user.apiKey}` : 'Loading active API credential...'}</span>
                        {user.apiKey && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(user.apiKey || '');
                              setCopiedApiKey(true);
                              showToast('Copied');
                              setTimeout(() => setCopiedApiKey(false), 2000);
                            }}
                            className="px-3 py-1 rounded bg-purple-500/25 text-purple-200 hover:bg-purple-500/35 text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedApiKey ? 'Copied' : 'COPY KEY'}</span>
                          </button>
                        )}
                      </div>

                      {showApiDocs && (
                        <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-2.5 text-xs font-mono text-zinc-300">
                          <div className="text-purple-300 font-bold">REST API Quickstart</div>
                          <div className="text-[11px] text-zinc-400">
                            Endpoint: <code className="text-white">POST https://aqari-ai-rho.vercel.app/api/analyze</code>
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            Header: <code className="text-white">Authorization: Bearer {user.apiKey || 'aqari_live_...'}</code>
                          </div>
                          <pre className="p-2.5 rounded-lg bg-black border border-white/10 text-[11px] text-emerald-300 overflow-x-auto">
{`// Request JSON
{
  "city": "Muscat",
  "valuation": 650000,
  "rent": 4500,
  "equity": 30,
  "rate": 5.5,
  "opex": 15
}`}
                          </pre>
                          <div className="text-[11px] text-amber-300 font-semibold">
                            Your developer needs to integrate this. Not automatic.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 1-on-1 Dedicated Analyst Desk - Ask Analyst (Async Chat Thread) */}
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-[#D4AF37]/30 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#D4AF37]">
                          <MessageSquare className="w-4 h-4" />
                          <span>1-on-1 Dedicated Analyst Desk - Ask Analyst</span>
                          {analystUnread > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-black">
                              ({analystUnread}) New Reply
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAnalystChat}
                          className="px-3 py-1 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-mono font-bold cursor-pointer"
                        >
                          {analystChatOpen ? 'Refresh Thread' : 'Open Chat History'}
                        </button>
                      </div>

                      {analystThread && analystThread.messages.length > 0 && (
                        <div className="max-h-60 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-black/50 border border-white/10">
                          {analystThread.messages.map((m) => (
                            <div
                              key={m.id}
                              className={`flex flex-col ${m.sender === 'client' ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs font-mono space-y-1 ${
                                  m.sender === 'client'
                                    ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-white'
                                    : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-100'
                                }`}
                              >
                                <div className="text-[10px] font-bold uppercase text-zinc-400">
                                  {m.sender === 'client' ? 'You' : 'AQARI Dedicated Analyst'} •{' '}
                                  {new Date(m.timestamp).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                                {m.attachedAnalysisTitle && (
                                  <div className="text-[10px] px-2 py-1 rounded bg-black/40 border border-white/10 text-[#D4AF37]">
                                    Attached: {m.attachedAnalysisTitle}
                                  </div>
                                )}
                                {m.replyByDate && (
                                  <div className="text-[10px] text-amber-300">
                                    Need reply by: {m.replyByDate}
                                  </div>
                                )}
                                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                        <select
                          value={analystAttachedId}
                          onChange={(e) => setAnalystAttachedId(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white outline-none"
                        >
                          <option value="">Attach Saved Analysis (optional)</option>
                          {savedAnalyses.map((sa) => (
                            <option key={sa.id} value={sa.id}>
                              {sa.property} ({sa.city}) - {sa.capRate}% Cap
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-400 shrink-0">Need reply by:</span>
                          <input
                            type="date"
                            lang="en"
                            dir="ltr"
                            value={analystReplyBy}
                            onChange={(e) => setAnalystReplyBy(e.target.value)}
                            className="flex-1 px-2.5 py-2 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-mono outline-none"
                          />
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={analystMsgInput}
                        onChange={(e) => setAnalystMsgInput(e.target.value)}
                        placeholder="Ask your analyst about a deal, market, portfolio..."
                        className="w-full p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs font-mono text-white outline-none focus:border-[#D4AF37]"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-mono text-zinc-400">
                          Replies arrive directly in this chat + email notification.
                        </span>
                        <button
                          type="button"
                          disabled={isSendingAnalystMsg}
                          onClick={handleSendAnalystChat}
                          className="px-4 py-2 rounded-lg bg-[#D4AF37] text-black font-bold text-xs font-mono cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSendingAnalystMsg ? 'Sending...' : 'Send Question'}</span>
                        </button>
                      </div>
                    </div>

                    {/* White-Glove Custom Underwriting Intake + Deliverables */}
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-emerald-500/30 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                          <FileText className="w-4 h-4" />
                          <span>White-glove Custom Underwriting</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">48h Institutional Turnaround</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                        <input
                          type="text"
                          value={wgPropertyTitle}
                          onChange={(e) => setWgPropertyTitle(e.target.value)}
                          placeholder="Asset / Portfolio Title"
                          className="px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white outline-none focus:border-emerald-400"
                        />
                        <input
                          type="text"
                          value={wgDealLink}
                          onChange={(e) => setWgDealLink(e.target.value)}
                          placeholder="Listing / Deal Room URL (optional)"
                          className="px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white outline-none focus:border-emerald-400"
                        />
                        <div className="relative">
                          <input
                            type="text"
                            value={wgTargetCity}
                            onFocus={() => setWgCityOpen(true)}
                            onBlur={() => setTimeout(() => setWgCityOpen(false), 180)}
                            onChange={(e) => {
                              setWgTargetCity(e.target.value);
                              setWgCityOpen(true);
                            }}
                            placeholder="Target City (type 2+ chars)"
                            className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white outline-none focus:border-emerald-400"
                          />
                          {wgCityOpen && wgCityOptions.length > 0 && (
                            <div className="absolute z-40 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg bg-zinc-950 border border-emerald-500/40 divide-y divide-white/[0.06]">
                              {wgCityOptions.map((c) => (
                                <button
                                  key={`wg-${c.city}-${c.countryCode}`}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setWgTargetCity(formatCityOptionLabel(c));
                                    setWgCityOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs font-mono text-zinc-200 hover:bg-emerald-500/20 cursor-pointer"
                                >
                                  {formatCityOptionLabel(c)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            id="td-wg-val"
                            type="text"
                            data-numeric="true"
                            lang="en"
                            dir="ltr"
                            inputMode="decimal"
                            autoComplete="off"
                            style={EN_INPUT_STYLE}
                            value={wgValuation}
                            onChange={(e) => setWgValuation(sanitizeEnglishDecimal(e.target.value, true))}
                            onPaste={(e) => {
                              e.preventDefault();
                              setWgValuation(sanitizeEnglishDecimal(e.clipboardData?.getData('text') || '', true));
                            }}
                            placeholder="Valuation (USD $)"
                            className="px-2.5 py-2 rounded-lg bg-black/50 border border-white/10 text-white outline-none"
                          />
                          <input
                            id="td-wg-rent"
                            type="text"
                            data-numeric="true"
                            lang="en"
                            dir="ltr"
                            inputMode="decimal"
                            autoComplete="off"
                            style={EN_INPUT_STYLE}
                            value={wgExpectedRent}
                            onChange={(e) => setWgExpectedRent(sanitizeEnglishDecimal(e.target.value, true))}
                            onPaste={(e) => {
                              e.preventDefault();
                              setWgExpectedRent(sanitizeEnglishDecimal(e.clipboardData?.getData('text') || '', true));
                            }}
                            placeholder="Rent/mo (USD $)"
                            className="px-2.5 py-2 rounded-lg bg-black/50 border border-white/10 text-white outline-none"
                          />
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={wgGoalNotes}
                        onChange={(e) => setWgGoalNotes(e.target.value)}
                        placeholder="Describe SPV structure, financing constraints, tax jurisdiction & target IRR..."
                        className="w-full p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs font-mono text-white outline-none focus:border-emerald-400"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={isSubmittingWg}
                          onClick={handleSubmitWhiteGloveRequest}
                          className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs font-mono cursor-pointer disabled:opacity-60"
                        >
                          {isSubmittingWg ? 'Submitting...' : 'Submit White-Glove Deal Brief'}
                        </button>
                        {wgStatusMsg && (
                          <span className="text-xs font-mono text-emerald-300">{wgStatusMsg}</span>
                        )}
                      </div>

                      {(wgRequests.length > 0 || wgDeliverables.length > 0) && (
                        <div className="pt-3 border-t border-white/10 space-y-2">
                          <div className="text-[11px] font-mono uppercase text-zinc-400 font-bold">
                            Your White-Glove Briefs &amp; Deliverables ({wgRequests.length})
                          </div>
                          {wgRequests.map((reqItem) => (
                            <div
                              key={reqItem.id}
                              className="p-2.5 rounded-lg bg-black/50 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                            >
                              <div>
                                <span className="font-bold text-white">{reqItem.propertyTitle || reqItem.id}</span>{' '}
                                <span className="text-zinc-400">({reqItem.targetCity || '-'})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    reqItem.status === 'Done'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {reqItem.status}
                                </span>
                                {reqItem.status === 'Done' && reqItem.deliverable && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadWhiteGlovePdf({
                                        deliverable: reqItem.deliverable!,
                                        userEmail: user.email,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded bg-[#D4AF37] text-black font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Download Custom PDF</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: MY SAVED ANALYSES */}
          {activeTab === 'saved' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>PORTFOLIO ASSET REGISTRY</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    My Saved Analyses ({savedAnalyses.length} / {maxSaved})
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('analyze')}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-bold text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Analysis</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 glass-panel p-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={savedSearch}
                    onChange={(e) => setSavedSearch(e.target.value)}
                    placeholder="Search saved properties or cities..."
                    className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-mono outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="flex items-center gap-1 text-xs font-mono">
                  {['All', 'Muscat', 'Dubai', 'London', 'Riyadh'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setSavedCityFilter(c)}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        savedCityFilter === c ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Empty State with 3 DEMO Reference Cards + Accessible Benchmarks */}
              {savedAnalyses.length === 0 ? (
                <div className="space-y-6">
                  <div className="glass-panel p-6 sm:p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
                      <BookmarkCheck className="w-7 h-7 text-[#D4AF37]" />
                    </div>
                    <h3 className="text-xl font-bold text-white">No Real Analyses Saved Yet</h3>
                    <p className="text-sm text-zinc-400 max-w-lg mx-auto font-mono">
                      These are demos, your real analyses will appear here
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-1">
                      <button
                        onClick={() => setActiveTab('analyze')}
                        className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold text-sm font-mono cursor-pointer min-h-[44px]"
                      >
                        Start Your First Real Analysis
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {DEMO_SAVED_BENCHMARKS.map((demo) => (
                      <div
                        key={demo.id}
                        className="glass-panel rounded-2xl p-5 flex flex-col justify-between border border-amber-500/25 hover:border-[#D4AF37]/60 transition"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-xs font-mono text-amber-300 font-bold">
                              DEMO - تجريبي
                            </span>
                            <span className="text-xs font-mono text-zinc-400">{demo.city}</span>
                          </div>
                          <h4 className="text-base font-bold text-white tracking-tight mt-2">{demo.property}</h4>
                          <div className="text-xl font-black font-mono text-[#D4AF37] mt-1">
                            {demo.capRate}% Gross • {formatPrice(demo.price, currentCurrency)}
                          </div>
                          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] my-4 text-center font-mono">
                            <div>
                              <span className="text-xs text-zinc-400 block uppercase">Gross %</span>
                              <span className="text-lg font-bold text-[#D4AF37]">{demo.capRate}%</span>
                            </div>
                            <div>
                              <span className="text-xs text-zinc-400 block uppercase">IRR</span>
                              <span className="text-lg font-bold text-purple-400">{demo.irr}%</span>
                            </div>
                            <div>
                              <span className="text-xs text-zinc-400 block uppercase">DSCR</span>
                              <span className="text-lg font-bold text-emerald-400">{demo.dscr}x</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleLoadSaved(demo)}
                          className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-[#D4AF37] hover:text-black text-white font-mono text-sm font-bold transition cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Open Demo Analysis</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Grid of Saved Properties */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredSaved.map((item) => (
                      <div
                        key={item.id}
                        className="glass-panel rounded-2xl p-5 flex flex-col justify-between hover:border-[#D4AF37]/50 transition duration-300"
                      >
                        <div>
                          {/* Header & City */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2.5 py-0.5 rounded bg-black/60 border border-white/10 text-xs font-mono text-[#D4AF37] font-bold uppercase">
                              {item.city}
                            </span>
                            <span className="text-xs font-mono text-zinc-500">
                              {new Date(item.date).toLocaleDateString('en-US')}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-white tracking-tight line-clamp-1">{item.property}</h4>
                          <div className="text-xl font-black font-mono text-white mt-1">
                            {formatPrice(item.price, currentCurrency)}
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] my-4 text-center font-mono">
                            <div>
                              <span className="text-xs text-zinc-400 block uppercase">Cap Rate</span>
                              <span className="text-lg font-bold text-[#D4AF37]">{item.capRate}%</span>
                            </div>
                            <div>
                              <span className="text-xs text-zinc-400 block uppercase">5Y IRR</span>
                              <span className="text-lg font-bold text-purple-400">{item.irr}%</span>
                            </div>
                            <div>
                              <span className="text-xs text-zinc-400 block uppercase">DSCR</span>
                              <span className="text-lg font-bold text-emerald-400">{item.dscr}x</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleLoadSaved(item)}
                            className="flex items-center gap-1.5 text-sm font-mono text-[#D4AF37] hover:underline cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Model</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleExportPDF(item.property)}
                              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                              title="Export PDF Memo (PROFESSIONAL / SOVEREIGN)"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSaved(item.id)}
                              className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Delete Analysis"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Keep Demo Reference Analyses accessible even after saving real ones */}
                  <div className="pt-4 border-t border-white/[0.08] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-bold text-zinc-300 uppercase">
                        Reference Demo Benchmarks (DEMO - تجريبي)
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        Always accessible • Not counted toward saved limit
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {DEMO_SAVED_BENCHMARKS.map((demo) => (
                        <div
                          key={demo.id}
                          className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <span className="text-[11px] font-mono text-amber-300 font-bold block">
                              DEMO - تجريبي • {demo.city}
                            </span>
                            <div className="text-sm font-bold text-white truncate">{demo.property}</div>
                            <div className="text-sm font-mono text-[#D4AF37] font-bold">{demo.capRate}% Gross</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleLoadSaved(demo)}
                            className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-[#D4AF37] hover:text-black text-xs font-mono font-bold text-white shrink-0 cursor-pointer"
                          >
                            Open Demo
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: PORTFOLIO AGGREGATION */}
          {activeTab === 'portfolio' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {!canPortfolioAgg ? (
                <div className="glass-panel p-10 sm:p-16 text-center space-y-6 border border-[#D4AF37]/40 shadow-[0_20px_60px_rgba(212,175,55,0.15)] relative overflow-hidden">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-[#D4AF37]/50 flex items-center justify-center mx-auto text-[#D4AF37] shadow-[0_0_25px_rgba(212,175,55,0.3)]">
                    <Lock className="w-8 h-8 text-[#D4AF37]" />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                      <Crown className="w-3.5 h-3.5" />
                      <span>PROFESSIONAL &amp; SOVEREIGN EXCLUSIVE</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                      Multi-Asset Portfolio Aggregation
                    </h3>
                    <p className="text-sm text-zinc-400 font-mono leading-relaxed">
                      Upgrade to Professional to unlock multi-asset portfolio yield aggregation, weighted IRR tracking, and institutional PDF exports.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={onOpenRenewal}
                      className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-black text-xs font-mono uppercase tracking-wider transition cursor-pointer shadow-lg"
                    >
                      Upgrade to Professional to unlock
                    </button>
                  </div>
                </div>
              ) : savedAnalyses.length === 0 ? (
                <div className="space-y-6">
                  <div className="glass-panel p-6 sm:p-10 text-center space-y-4 border border-dashed border-white/15">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-[#D4AF37]">
                      <Briefcase className="w-7 h-7 text-[#D4AF37]" />
                    </div>
                    <div className="max-w-lg mx-auto space-y-2">
                      <h3 className="text-xl font-bold text-white tracking-tight">No real assets in portfolio yet</h3>
                      <p className="text-sm text-zinc-400 font-mono leading-relaxed">
                        These are demos, your real analyses will appear here
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 pt-1">
                      <button
                        onClick={() => setActiveTab('analyze')}
                        className="px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-black font-bold text-sm font-mono uppercase tracking-wider transition cursor-pointer"
                      >
                        Start Your First Real Analysis
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {DEMO_SAVED_BENCHMARKS.map((demo) => (
                      <div key={demo.id} className="glass-panel p-5 border border-amber-500/25 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-xs font-mono text-amber-300 font-bold">
                            DEMO - تجريبي
                          </span>
                          <span className="text-xs font-mono text-zinc-400">{demo.city}</span>
                        </div>
                        <div className="text-base font-bold text-white">{demo.property}</div>
                        <div className="text-lg font-black font-mono text-[#D4AF37]">{demo.capRate}% Gross</div>
                        <button
                          type="button"
                          onClick={() => handleLoadSaved(demo)}
                          className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-[#D4AF37] hover:text-black text-white font-mono text-sm font-bold transition cursor-pointer"
                        >
                          Open Demo Analysis
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>SOVEREIGN WEALTH AGGREGATOR</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Total Portfolio Intelligence ({savedAnalyses.length} properties)
                      </h2>
                    </div>
                  </div>

              {/* Macro Portfolio Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5">
                  <div className="text-[10px] font-mono uppercase text-zinc-400">Total Portfolio AUM</div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
                    {formatPrice(portfolioTotalValUSD, currentCurrency)}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-1">
                    {savedAnalyses.length} Properties Tracked
                  </div>
                </div>

                <div className="glass-panel p-5">
                  <div className="text-[10px] font-mono uppercase text-zinc-400">Monthly Net Cashflow</div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-[#D4AF37] mt-1">
                    {formatPrice(portfolioMonthlyCashflowUSD, currentCurrency)}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-1">
                    Annual: {formatPrice(portfolioMonthlyCashflowUSD * 12, currentCurrency)}
                  </div>
                </div>

                <div className="glass-panel p-5">
                  <div className="text-[10px] font-mono uppercase text-zinc-400">Weighted Cap Rate</div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-400 mt-1">
                    {portfolioAvgCapRate}%
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono mt-1">
                    Unlevered Net Yield
                  </div>
                </div>

                <div className="glass-panel p-5">
                  <div className="text-[10px] font-mono uppercase text-zinc-400">Weighted 5Y IRR</div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-purple-400 mt-1">
                    {portfolioAvgIRR}%
                  </div>
                  <div className="text-[10px] text-purple-400 font-mono mt-1">
                    Equity Compound Benchmark
                  </div>
                </div>
              </div>

              {/* Geographic Diversification Bar */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-xs font-mono font-bold uppercase text-white tracking-wider">
                  Jurisdictional Allocation Breakdown
                </h3>

                <div className="space-y-3">
                  <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden flex gap-0.5">
                    {savedAnalyses.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`h-full ${idx % 3 === 0 ? 'bg-[#D4AF37]' : idx % 3 === 1 ? 'bg-emerald-400' : 'bg-purple-400'}`}
                        style={{ width: `${Math.max(10, Math.round((item.price / (portfolioTotalValUSD || 1)) * 100))}%` }}
                        title={`${item.property}: ${formatPrice(item.price, currentCurrency)}`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {savedAnalyses.map((item) => (
                      <div key={item.id} className="text-xs font-mono p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                        <span className="font-bold text-white block truncate">{item.property}</span>
                        <span className="text-[10px] text-zinc-400">{item.city} • {item.capRate}% Cap</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: MARKET RADAR */}
          {activeTab === 'radar' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
                    <Globe className="w-3.5 h-3.5" />
                    <span>CROSS-BORDER ARBITRAGE RADAR</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Sovereign Real Estate Capital Matrix
                  </h2>
                  <div className="text-xs font-mono text-zinc-400 mt-1.5 flex flex-wrap items-center gap-2">
                    <span>
                      Source: {macroSyncInfo?.source || 'World Bank / FRED / DLD / JLL'} • Last updated:{' '}
                      {macroSyncInfo?.last_updated || marketLive?.last_synced_display || 'Daily'} • Data as of{' '}
                      {macroSyncInfo?.data_as_of || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-zinc-400">
                      (Estimated / Demo data - بيانات تقديرية)
                    </span>
                  </div>
                </div>
                {!canFullMatrix && (
                  <button
                    onClick={onOpenRenewal}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono cursor-pointer shrink-0"
                  >
                    Upgrade to Starter to unlock full matrix
                  </button>
                )}
              </div>

              <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm font-mono">
                    <thead className="bg-white/[0.03] border-b border-white/[0.06] text-zinc-400 uppercase text-xs">
                      <tr>
                        <th className="py-3.5 px-4 font-semibold">City</th>
                        <th className="py-3.5 px-4 font-semibold">Price / m² ({currentCurrency})</th>
                        <th className="py-3.5 px-4 font-semibold">Gross Yield</th>
                        <th className="py-3.5 px-4 font-semibold">Transfer Tax</th>
                        <th className="py-3.5 px-4 font-semibold">Capital Gains Tax</th>
                        <th className="py-3.5 px-4 font-semibold">Golden Visa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {(canFullMatrix ? CROSS_BORDER_DATA : CROSS_BORDER_DATA.slice(0, 2)).map((row: MarketMatrixRow) => (
                        <tr key={row.city} className="hover:bg-white/[0.02]">
                          <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                            <span className="mr-2">{row.flag}</span>
                            {row.city}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-zinc-200">
                            {formatPrice(row.basePriceSqMUSD, currentCurrency)}
                          </td>
                          <td className="py-3.5 px-4 text-[#D4AF37] font-bold text-lg">
                            {row.avgGrossYield}%
                          </td>
                          <td className="py-3.5 px-4 text-zinc-300">
                            {canFullMatrix ? `${row.transferTaxPct}%` : '🔒 Starter'}
                          </td>
                          <td className="py-3.5 px-4 text-emerald-400 font-semibold">
                            {canFullMatrix ? row.capitalGainsTax : '🔒 Starter'}
                          </td>
                          <td className="py-3.5 px-4 text-cyan-400">
                            {canFullMatrix
                              ? row.goldenVisaUSD
                                ? formatPrice(row.goldenVisaUSD, currentCurrency, { compact: true })
                                : 'N/A'
                              : '🔒 Starter'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!canFullMatrix && (
                  <div className="p-4 bg-black/70 border-t border-[#D4AF37]/30 flex items-center justify-between text-xs font-mono text-amber-200">
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#D4AF37]" />
                      <span>5 additional markets + full tax &amp; visa rules locked on FREE tier.</span>
                    </span>
                    <button onClick={onOpenRenewal} className="text-[#D4AF37] font-bold underline cursor-pointer">
                      Upgrade to Starter
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MY DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              
              {/* Expiration Notice if subscription ended */}
              {isExpired && (
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">30-Day Subscription Has Expired</div>
                      <div className="text-xs text-rose-300 font-mono mt-0.5">
                        Premium underwriting features are locked. Renew your subscription to restore instant access.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={onOpenRenewal}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-black text-xs font-mono uppercase tracking-wider shrink-0 cursor-pointer shadow-lg"
                  >
                    Renew Subscription Now
                  </button>
                </div>
              )}

              {/* Dedicated Subscription Details Card: Plan Name, Status, Days Left, End Date, Renew */}
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/[0.08] pb-6">
                  <div>
                    <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                      AQARI AI LICENSE OVERVIEW
                    </div>
                    <h3 className="text-2xl font-bold text-white mt-1">
                      {`Aqari AI - ${planDisplayName} ($${planPriceUSD}/30d)`}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${
                      isExpired
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : license.planKey !== 'free'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40'
                    }`}>
                      {isExpired ? 'STATUS: EXPIRED' : license.planKey !== 'free' ? 'STATUS: ACTIVE' : 'STATUS: FREE TIER'}
                    </span>

                    <button
                      onClick={onOpenRenewal}
                      className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-black font-bold text-xs font-mono tracking-wide cursor-pointer transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                    >
                      <Zap className="w-3.5 h-3.5 fill-black" />
                      <span>Switch / Renew Plan</span>
                    </button>
                  </div>
                </div>

                {/* 5 Metadata Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-6">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">PLAN TIER</span>
                    <strong className="text-base font-bold font-mono text-[#D4AF37]">{planDisplayName} Terminal</strong>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">ANALYSES LEFT</span>
                    <strong className="text-base font-bold font-mono text-white">{analysesLeftStr}</strong>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Subscription Status</span>
                    <strong className={`text-base font-bold font-mono ${
                      isExpired ? 'text-rose-400' : license.planKey !== 'free' ? 'text-emerald-400' : 'text-zinc-300'
                    }`}>
                      {isExpired ? 'Expired' : license.planKey !== 'free' ? 'Active (30 Days)' : 'Trial'}
                    </strong>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Days Left</span>
                    <strong className={`text-base font-bold font-mono ${
                      isExpired ? 'text-rose-400' : isEndingIn24h ? 'text-amber-400' : 'text-white'
                    }`}>
                      {isExpired ? '0 days (Expired)' : daysLeft !== null ? `${daysLeft} days left` : '30 days left'}
                    </strong>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">End Date</span>
                    <strong className="text-sm font-bold font-mono text-zinc-200">
                      {endsAt ? new Date(endsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No Expiry'}
                    </strong>
                  </div>
                </div>

                {/* INCLUDED CAPABILITIES for Current Active Plan Only */}
                <div className="pt-6 mt-6 border-t border-white/[0.08]">
                  <div className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold mb-3">
                    INCLUDED CAPABILITIES:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {meFeatures.map((cap, idx) => {
                      const isExclusion = cap.toLowerCase().startsWith('no ');
                      return (
                        <div
                          key={`${cap}_${idx}`}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs font-mono ${
                            isExclusion
                              ? 'bg-black/30 border-white/[0.04] text-zinc-500'
                              : 'bg-emerald-500/[0.06] border-emerald-500/20 text-zinc-200'
                          }`}
                        >
                          {isExclusion ? (
                            <Lock className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                          ) : (
                            <div className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <span>{cap}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section A: MARKET HIGHLIGHTS - LIVE MACRO SYNC */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                      Market Highlights • Data as of{' '}
                      {macroSyncInfo?.data_as_of ||
                        new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">
                      Estimated / Demo data - بيانات تقديرية
                    </span>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Source: {macroSyncInfo?.source || 'FRED / World Bank / DLD / JLL'}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="glass-panel p-5 border border-white/[0.08]">
                    <span className="text-xs font-mono uppercase text-zinc-400">Muscat vs US 10Y Spread</span>
                    <div className="text-xl font-black font-mono text-[#D4AF37] mt-1">
                      +{marketLive?.metrics?.muscat_vs_us10y_bps ?? 412} bps • {marketLive?.cities?.find((c) => c.city === 'Muscat')?.gross_yield ?? 8.4}%
                    </div>
                    <p className="text-xs text-zinc-400 font-mono mt-1.5">
                      FRED US10Y: {marketLive?.macro?.us_10y_yield ?? 4.28}% • Last updated: {macroSyncInfo?.last_updated || marketLive?.last_synced_display || 'Today'}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">Estimated / Demo data - بيانات تقديرية</p>
                  </div>

                  <div className="glass-panel p-5 border border-white/[0.08]">
                    <span className="text-xs font-mono uppercase text-zinc-400">Dubai DLD Residential Index</span>
                    <div className="text-xl font-black font-mono text-emerald-400 mt-1">
                      {marketLive?.metrics?.dubai_dld_index ?? 184.2} pts • {marketLive?.cities?.find((c) => c.city === 'Dubai')?.gross_yield ?? 8.8}%
                    </div>
                    <p className="text-xs text-zinc-400 font-mono mt-1.5">
                      Source: Dubai Land Department • Data as of {macroSyncInfo?.data_as_of || 'Today'}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">Estimated / Demo data - بيانات تقديرية</p>
                  </div>

                  <div className="glass-panel p-5 border border-white/[0.08]">
                    <span className="text-xs font-mono uppercase text-zinc-400">Riyadh KAFD Rental Spread</span>
                    <div className="text-xl font-black font-mono text-purple-400 mt-1">
                      Riyadh • +{marketLive?.cities?.find((c) => c.city === 'Riyadh')?.rental_yoy ?? 14.8}% YoY
                    </div>
                    <p className="text-xs text-zinc-400 font-mono mt-1.5">
                      Source: JLL KSA Baseline • Data as of {macroSyncInfo?.data_as_of || 'Today'}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">Estimated / Demo data - بيانات تقديرية</p>
                  </div>
                </div>
              </div>

              {/* Section B: MY PORTFOLIO */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                      My Portfolio
                    </span>
                  </div>
                  {savedAnalyses.length > 0 && (
                    <button
                      onClick={() => setActiveTab('portfolio')}
                      className="text-xs font-mono text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Full Portfolio ({savedAnalyses.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {savedAnalyses.length === 0 ? (
                  <div className="glass-panel p-8 sm:p-10 border border-dashed border-white/15 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-base font-bold text-white">No analyses yet - Your portfolio is empty</div>
                        <p className="text-xs text-zinc-400 font-mono max-w-xl">
                          Your portfolio is empty. Analyze a property and save it to track yields, cashflow, and risk covenants.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('analyze')}
                        className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-black font-bold text-xs font-mono shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow-lg"
                      >
                        <span>Run Your First Analysis</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/[0.06]">
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">Total Value</div>
                        <div className="text-lg font-bold font-mono text-zinc-500 mt-0.5">{formatPrice(0, currentCurrency)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">Monthly Cashflow</div>
                        <div className="text-lg font-bold font-mono text-zinc-500 mt-0.5">{formatPrice(0, currentCurrency)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">Avg Cap Rate</div>
                        <div className="text-lg font-bold font-mono text-zinc-500 mt-0.5">--</div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">Saved</div>
                        <div className="text-lg font-bold font-mono text-zinc-500 mt-0.5">0 properties</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="glass-panel p-4">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">Total Value</div>
                        <div className="text-xl font-bold font-mono text-white mt-1">
                          {formatPrice(portfolioTotalValUSD, currentCurrency)}
                        </div>
                      </div>
                      <div className="glass-panel p-4">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">Monthly Cashflow</div>
                        <div className="text-xl font-bold font-mono text-[#D4AF37] mt-1">
                          {formatPrice(portfolioMonthlyCashflowUSD, currentCurrency)}
                        </div>
                      </div>
                      <div className="glass-panel p-4">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">Avg Cap Rate</div>
                        <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                          {portfolioAvgCapRate}%
                        </div>
                      </div>
                      <div className="glass-panel p-4">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">Tracked Assets</div>
                        <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                          {savedAnalyses.length} properties
                        </div>
                      </div>
                    </div>

                    {/* Mini Cards of Top 3 Saved Properties */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {savedAnalyses.slice(0, 3).map((item) => (
                        <div key={item.id} className="glass-panel p-4 space-y-2 border border-white/[0.08] hover:border-[#D4AF37]/40 transition">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-[#D4AF37] font-semibold">{item.city}</span>
                            <span className="text-emerald-400">{item.capRate}% Cap</span>
                          </div>
                          <div className="text-sm font-bold text-white truncate">{item.property}</div>
                          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-1 border-t border-white/[0.05]">
                            <span>{formatPrice(item.price, currentCurrency)}</span>
                            <button
                              onClick={() => handleLoadSaved(item)}
                              className="text-[#D4AF37] hover:underline cursor-pointer text-[11px] flex items-center gap-1"
                            >
                              <span>Open in Model</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 6: SETTINGS & ENTITLEMENTS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Account & Entitlements</h2>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">Manage your active 30-day licensing, plan limits, and payment audit logs.</p>
                </div>
                {isTestMode && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 font-mono text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>TEST MODE - No real money - Test card 4242 4242 4242 4242</span>
                  </div>
                )}
              </div>

              {/* Subscription Management Card (Start Date, End Date, Days Left, Extend CTA) */}
              <div className="glass-panel p-6 space-y-5 border border-[#D4AF37]/30">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2 text-base font-mono font-bold uppercase text-white">
                    <Calendar className="w-5 h-5 text-[#D4AF37]" />
                    <span>Subscription &amp; 30-Day Licensing</span>
                  </div>
                  <span className="text-xs font-mono font-bold uppercase px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]">
                    {license.displayName}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-zinc-400 uppercase block mb-1">Plan</span>
                    <strong className="text-lg font-bold text-[#D4AF37]">{license.displayName}</strong>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-zinc-400 uppercase block mb-1">Start Date</span>
                    <strong className="text-sm font-bold text-white">
                      {user.subscriptionStartAt
                        ? new Date(user.subscriptionStartAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Active Today'}
                    </strong>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-zinc-400 uppercase block mb-1">End Date</span>
                    <strong className="text-sm font-bold text-white">
                      {endsAt
                        ? new Date(endsAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '30-Day Window'}
                    </strong>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-xs text-zinc-400 uppercase block mb-1">Days Left</span>
                    <strong className={`text-lg font-bold ${isPlanEnded ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isPlanEnded ? '0 days' : `${daysLeft} days`}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                  <p className="text-sm font-mono text-zinc-300">
                    Your access ends on{' '}
                    <strong className="text-white">
                      {endsAt
                        ? new Date(endsAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'end of cycle'}
                    </strong>
                    , renew anytime, your saved analyses stay
                  </p>
                  <button
                    type="button"
                    onClick={() => (onGoToPricing ? onGoToPricing() : onOpenRenewal())}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C99D28] hover:brightness-110 text-black font-black text-sm font-mono transition cursor-pointer shadow-lg shrink-0 min-h-[44px]"
                  >
                    Extend Your 30-Day Terminal Access - جدد اشتراكك
                  </button>
                </div>
              </div>

              {/* SUBSCRIPTION & CANCELLATION (Rules A–E + Report Tool Issue + Auto-Locked Cancel) */}
              <div className="glass-panel p-6 space-y-5 border border-white/15">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2 text-base font-mono font-bold uppercase text-white">
                    <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                    <span>SUBSCRIPTION &amp; CANCELLATION</span>
                  </div>
                  <span
                    className={`text-xs font-mono font-bold uppercase px-3 py-1 rounded-full border ${
                      localCancelEligibility.canCancel
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-900 border-white/15 text-zinc-400'
                    }`}
                  >
                    {localCancelEligibility.canCancel ? 'ELIGIBLE FOR REFUND' : 'REFUND LOCKED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] text-zinc-400 uppercase block">Plan</span>
                    <strong className="text-sm font-bold text-[#D4AF37]">{license.displayName}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] text-zinc-400 uppercase block">Activated</span>
                    <strong className="text-sm font-bold text-white">
                      {user.subscriptionStartAt
                        ? new Date(user.subscriptionStartAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '-'}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] text-zinc-400 uppercase block">Days Active</span>
                    <strong className="text-sm font-bold text-white">
                      {localCancelEligibility.daysSinceActivation}d
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] text-zinc-400 uppercase block">Analyses Used</span>
                    <strong className="text-sm font-bold text-white">
                      {user.analysesUsed ?? 0} / {license.isUnlimitedAnalyses ? 'Unlimited' : license.analysesLimit}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] text-zinc-400 uppercase block">Successful Runs</span>
                    <strong className={`text-sm font-bold ${localCancelEligibility.successfulAnalyses > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {localCancelEligibility.successfulAnalyses}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-[10px] text-zinc-400 uppercase block">Tool Status</span>
                    <strong
                      className={`text-sm font-bold uppercase ${
                        localCancelEligibility.issueStatus === 'reported'
                          ? 'text-amber-300'
                          : localCancelEligibility.issueStatus === 'resolved'
                          ? 'text-cyan-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {localCancelEligibility.issueStatus === 'reported'
                        ? 'Reported Issue'
                        : localCancelEligibility.issueStatus === 'resolved'
                        ? 'Resolved'
                        : 'Working'}
                    </strong>
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
                    localCancelEligibility.canCancel
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-zinc-900/70 border-white/10 text-zinc-300'
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      localCancelEligibility.canCancel ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  />
                  <span>{localCancelEligibility.reason}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIssueModalError(null);
                      setIsIssueModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs font-mono transition cursor-pointer flex items-center gap-2 min-h-[44px]"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Report Tool Issue</span>
                  </button>

                  {license.planKey !== 'free' && (
                    <button
                      type="button"
                      disabled={!localCancelEligibility.canCancel}
                      onClick={() => {
                        setCancelModalError(null);
                        setIsCancelModalOpen(true);
                      }}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs font-mono transition min-h-[44px] flex items-center gap-2 ${
                        localCancelEligibility.canCancel
                          ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg'
                          : 'bg-zinc-800/80 text-zinc-500 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {!localCancelEligibility.canCancel && <Lock className="w-3.5 h-3.5" />}
                      <span>{localCancelEligibility.buttonText}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Account Card */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-sm font-mono font-bold uppercase text-white">Profile Credentials</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm font-mono">
                  <div>
                    <span className="text-zinc-500 block mb-0.5">User ID</span>
                    <span className="text-white truncate block">{user.id}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Email Address</span>
                    <span className="text-white truncate block">{user.email}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Current Plan</span>
                    <span className="text-[#D4AF37] font-bold uppercase">{license.displayName}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Licensing Expiry &amp; Countdown</span>
                    <span className={isPlanEnded ? 'text-rose-400 font-bold' : 'text-[#D4AF37] font-bold'}>
                      {isPlanEnded
                        ? 'Licensing window expired - Renew'
                        : `${daysLeft} days left`}
                    </span>
                    {endsAt && license.planKey !== 'free' && (
                      <span className="text-xs text-zinc-500 block mt-0.5">
                        Ends: {new Date(endsAt).toLocaleString('en-US')}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Analyses Quota</span>
                    <span className="text-emerald-400 font-bold">
                      {analysesLeftStr}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Saved Properties Limit</span>
                    <span className="text-white">
                      {savedAnalyses.length} / {maxSaved}
                    </span>
                  </div>
                </div>
              </div>

              {/* Plan Feature Matrix */}
              <div className="glass-panel p-6 space-y-4">
                <h3 className="text-sm font-mono font-bold uppercase text-white">Feature Entitlements Checklist</h3>
                <div className="space-y-2 text-sm font-mono">
                  {[
                    { label: 'Basic Cap Rate & Cash-on-Cash', unlocked: true, req: 'FREE' },
                    { label: 'Yield & Sensitivity Calculator + Full Matrix', unlocked: canSensitivity, req: 'STARTER' },
                    { label: 'Monte Carlo Stress Tests (+200bps)', unlocked: canMonteCarlo, req: 'PROFESSIONAL' },
                    { label: 'PDF Memorandum Export', unlocked: canPdfExport, req: 'PROFESSIONAL' },
                    { label: 'Multi-Asset Portfolio Aggregation', unlocked: canPortfolioAgg, req: 'PROFESSIONAL' },
                    { label: 'Full REST API Credentials', unlocked: canApiAccess, req: 'SOVEREIGN' },
                    { label: '1-on-1 Dedicated Analyst Desk & Custom Underwriting', unlocked: canAnalystDesk && canCustomUnderwriting, req: 'SOVEREIGN' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        {item.unlocked ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-400" />
                        )}
                        <span>{item.label}</span>
                      </div>
                      {item.unlocked ? (
                        <span className="text-emerald-400 font-bold">UNLOCKED</span>
                      ) : (
                        <span className="text-zinc-500 font-semibold">LOCKED ({item.req})</span>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={onOpenRenewal}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm font-mono cursor-pointer"
                >
                  Upgrade / Renew Subscription
                </button>
              </div>

              {/* Sovereign API Credentials & Dedicated Analyst Desk */}
              {canApiAccess ? (
                <div className="glass-panel p-6 border border-purple-500/40 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold uppercase">
                      <Key className="w-4 h-4" />
                      <span>Sovereign REST API Credentials &amp; Executive Services</span>
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold">
                      WHITE-GLOVE UNDERWRITING ACTIVE
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono uppercase text-zinc-400">Full REST API Bearer Token</span>
                      <button
                        type="button"
                        onClick={() => setShowApiDocs((v) => !v)}
                        className="text-[11px] font-mono text-purple-300 underline cursor-pointer"
                      >
                        {showApiDocs ? 'Hide API Docs' : 'API Docs'}
                      </button>
                    </div>
                    <div className="p-3 rounded-lg bg-black/60 font-mono text-xs text-zinc-200 border border-white/10 break-all flex items-center justify-between gap-3">
                      <span>{user.apiKey ? `Bearer ${user.apiKey}` : 'Loading active API credential...'}</span>
                      {user.apiKey && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(user.apiKey || '');
                            setCopiedApiKey(true);
                            showToast('Copied');
                            setTimeout(() => setCopiedApiKey(false), 2000);
                          }}
                          className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          {copiedApiKey ? 'Copied' : 'COPY KEY'}
                        </button>
                      )}
                    </div>
                    {showApiDocs && (
                      <div className="mt-2 p-3 rounded-lg bg-zinc-950 border border-white/10 text-[11px] font-mono text-zinc-300 space-y-1">
                        <div>POST /api/analyze • Header: Authorization: Bearer {user.apiKey || 'aqari_live_...'}</div>
                        <div className="text-amber-300">Your developer needs to integrate this. Not automatic.</div>
                      </div>
                    )}
                  </div>

                  {canAnalystDesk && (
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('analyze');
                          handleOpenAnalystChat();
                        }}
                        className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono cursor-pointer flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Open 1-on-1 Analyst Desk Chat {analystUnread > 0 ? `(${analystUnread})` : ''}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('analyze')}
                        className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs font-mono cursor-pointer"
                      >
                        Open White-Glove Custom Underwriting ({wgRequests.length})
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-panel p-6 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs font-mono text-zinc-300 space-y-1">
                      <div className="font-bold text-white">Available in SOVEREIGN - Upgrade</div>
                      <div className="text-zinc-400">
                        Unlock Full REST API Credentials, 1-on-1 Dedicated Analyst Desk, and White-glove Custom Underwriting.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenRenewal}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono shrink-0 cursor-pointer"
                  >
                    Upgrade to SOVEREIGN
                  </button>
                </div>
              )}

              {/* Webhook & Day-29 Email Audit Logs (Shows Event, Signature, Error for Debugging) */}
              <div className="glass-panel p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-mono font-bold uppercase text-white">
                    Payment Webhook &amp; Email Audit Logs
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadWebhookLogs}
                      disabled={isRefreshingWebhookLogs}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded bg-white/10 hover:bg-white/15 text-white border border-white/15 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingWebhookLogs ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingWebhookLogs ? 'Refreshing...' : 'Refresh Logs'}</span>
                    </button>
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/5 text-zinc-300">
                      {webhookLogs.length} webhooks • {emailLogs.length} emails
                    </span>
                  </div>
                </div>

                {/* Yellow Webhook Setup & Env Status Box (never shows full keys) */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-400/40 space-y-3 text-xs font-mono">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-amber-300 font-bold uppercase tracking-wider">
                        Webhook URL to copy:
                      </div>
                      <div className="text-white break-all select-all">
                        https://aqari-ai-rho.vercel.app/api/webhooks/lemonsqueezy
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('https://aqari-ai-rho.vercel.app/api/webhooks/lemonsqueezy');
                        setCopiedWebhookUrl(true);
                        setTimeout(() => setCopiedWebhookUrl(false), 2000);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition cursor-pointer shrink-0"
                    >
                      {copiedWebhookUrl ? 'Copied URL!' : 'Copy Webhook URL'}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-amber-400/25 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-amber-200 font-bold">Status:</span>
                      <span className="text-zinc-200">
                        LEMON_WEBHOOK_SECRET present?{' '}
                        <strong className={webhookEnvStatus?.webhookSecretPresent ? 'text-emerald-400' : 'text-rose-400'}>
                          {webhookEnvStatus ? (webhookEnvStatus.webhookSecretPresent ? 'Yes' : 'No') : '...'}
                        </strong>
                      </span>
                      <span className="text-zinc-200">
                        LEMON_API_KEY present?{' '}
                        <strong className={webhookEnvStatus?.apiKeyPresent ? 'text-emerald-400' : 'text-rose-400'}>
                          {webhookEnvStatus ? (webhookEnvStatus.apiKeyPresent ? 'Yes' : 'No') : '...'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {webhookLogs.length === 0 ? (
                  <div className="text-sm font-mono text-zinc-300 p-4 rounded-xl bg-black/40 border border-white/10">
                    {webhookDebug ||
                      'No webhook received - Check Lemon > Settings > Webhooks URL is https://aqari-ai-rho.vercel.app/api/webhooks/lemonsqueezy'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm font-mono">
                      <thead className="text-zinc-500 border-b border-white/10 uppercase text-xs">
                        <tr>
                          <th className="py-2.5 pr-3">Event</th>
                          <th className="py-2.5 pr-3">Order ID</th>
                          <th className="py-2.5 pr-3">Plan</th>
                          <th className="py-2.5 pr-3">Email</th>
                          <th className="py-2.5 pr-3">Amount</th>
                          <th className="py-2.5 pr-3">Signature</th>
                          <th className="py-2.5 pr-3">Mode</th>
                          <th className="py-2.5">Timestamp / Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-300">
                        {webhookLogs.slice(0, 20).map((w) => (
                          <tr key={w.id}>
                            <td className="py-2.5 pr-3 text-xs text-white font-semibold">{w.event || w.event_name || 'order_created'}</td>
                            <td className="py-2.5 pr-3 text-xs">{w.order_id}</td>
                            <td className="py-2.5 pr-3 uppercase text-[#D4AF37] font-bold">{w.plan}</td>
                            <td className="py-2.5 pr-3 text-xs">{w.payment_email || w.email}</td>
                            <td className="py-2.5 pr-3">${w.amount} {w.currency}</td>
                            <td className="py-2.5 pr-3">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  w.signature_valid === false
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-emerald-500/20 text-emerald-300'
                                }`}
                              >
                                {w.signature_valid === false ? 'FAILED' : 'VALID'}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${w.test_mode ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                {w.test_mode ? 'TEST' : 'LIVE'}
                              </span>
                            </td>
                            <td className="py-2.5 text-xs">
                              <div className="text-zinc-400">
                                {w.timestamp ? new Date(w.timestamp).toLocaleString('en-US') : '-'}
                              </div>
                              {(w.raw_error || w.error) && (
                                <div className="text-rose-400 mt-0.5">{w.raw_error || w.error}</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Email Dispatch & Admin Alert Audit Logs */}
                <div className="pt-4 border-t border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-zinc-300">
                    <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Email Dispatch &amp; Admin Alert Logs ({emailLogs.length})</span>
                  </div>
                  {emailLogs.length === 0 ? (
                    <div className="text-xs font-mono text-zinc-400 p-3 rounded-xl bg-black/40 border border-white/10">
                      No email notifications logged yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-zinc-500 border-b border-white/10 uppercase text-[11px]">
                          <tr>
                            <th className="py-2 pr-3">Event</th>
                            <th className="py-2 pr-3">Recipient</th>
                            <th className="py-2 pr-3">Subject</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                          {emailLogs.slice(0, 20).map((em) => (
                            <tr key={em.id}>
                              <td className="py-2 pr-3 text-[#D4AF37] font-bold">{em.event_type || 'alert'}</td>
                              <td className="py-2 pr-3">{em.to}</td>
                              <td className="py-2 pr-3 max-w-[260px] truncate">{em.subject}</td>
                              <td className="py-2 pr-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    em.status === 'sent'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : em.status === 'simulated'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {em.status || 'logged'}
                                </span>
                              </td>
                              <td className="py-2 text-zinc-400">
                                {em.timestamp ? new Date(em.timestamp).toLocaleString('en-US') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {isOwnerAdmin && (
                  <form
                    onSubmit={handleAdminBackupVerify}
                    className="pt-4 border-t border-white/10 space-y-2.5 text-xs font-mono"
                  >
                    <div className="text-zinc-400 uppercase font-bold">
                      Admin Backup: Manual Lemon Order Verification
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={backupOrderId}
                        onChange={(e) => setBackupOrderId(e.target.value)}
                        placeholder="Lemon Order ID (e.g. 5165758)"
                        className="px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white outline-none focus:border-[#D4AF37]"
                      />
                      <input
                        type="email"
                        value={backupTargetEmail}
                        onChange={(e) => setBackupTargetEmail(e.target.value)}
                        placeholder="Account / Payment Email"
                        className="px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white outline-none focus:border-[#D4AF37]"
                      />
                      <button
                        type="submit"
                        disabled={isRunningBackupVerify}
                        className="px-3 py-2 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#D4AF37] font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {isRunningBackupVerify ? 'Checking Lemon...' : 'Admin Verify Order'}
                      </button>
                    </div>
                    {backupVerifyMsg && (
                      <div className="text-zinc-300 bg-black/40 border border-white/10 rounded-lg px-3 py-2">
                        {backupVerifyMsg}
                      </div>
                    )}
                  </form>
                )}
              </div>

            </div>
          )}

          {/* Roadmap Section: Coming Soon - قريباً (5 Locked AI Modules Only) */}
          <section className="max-w-6xl mx-auto pt-6 border-t border-white/[0.08] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Coming Soon - قريباً
                </h3>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Institutional Intelligence Roadmap • Locked Preview
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMING_SOON_AI_MODULES.map((mod) => (
                <button
                  key={mod.title}
                  type="button"
                  onClick={() => showToast('Coming Soon - Available for PROFESSIONAL / SOVEREIGN soon')}
                  className="text-left p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] hover:border-[#D4AF37]/40 transition space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#D4AF37] uppercase">
                      <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>LOCKED • {mod.badge}</span>
                    </span>
                    <Radar className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="text-base font-bold text-white">{mod.title}</div>
                  <div className="text-sm font-arabic text-zinc-400 leading-relaxed">
                    {mod.arabicDesc}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Bottom Dashboard Footer with Single Centered PWA Install Button */}
          <footer className="max-w-6xl mx-auto pt-8 pb-4 border-t border-white/[0.08] space-y-5 text-center">
            <div className="flex justify-center">
              <PWAInstallButton variant="footer" />
            </div>
            <div className="text-xs font-mono text-zinc-500">
              © 2026 Loomora Studios - AQARI TERMINAL. All rights reserved.
            </div>
          </footer>

        </main>

      </div>

      {/* Report Tool Issue Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-amber-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-300 font-mono font-bold text-sm uppercase">
                <AlertTriangle className="w-4 h-4" />
                <span>Report Tool Issue</span>
              </div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-mono text-zinc-300 leading-relaxed">
              Experiencing a bug or calculation failure? Describe the issue below. Reported issues are logged with a timestamp and reviewed by engineering.
            </p>
            <form onSubmit={handleReportToolIssue} className="space-y-3">
              <textarea
                rows={4}
                value={issueDescInput}
                onChange={(e) => setIssueDescInput(e.target.value)}
                placeholder="Describe what happened, e.g., error message, city input, or failed output..."
                className="w-full p-3 rounded-xl bg-black/60 border border-white/15 focus:border-amber-400 text-xs font-mono text-white outline-none"
              />
              {issueModalError && (
                <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
                  {issueModalError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-300 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs font-mono cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingIssue ? 'Submitting...' : 'Submit Issue Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Cancel Subscription + Refund Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-rose-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-mono font-bold text-sm uppercase">
                <AlertTriangle className="w-4 h-4" />
                <span>Confirm Subscription Cancellation</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-mono text-zinc-200 leading-relaxed">
              Cancel <strong className="text-[#D4AF37]">{license.displayName}</strong>? Your analyses will be lost,{' '}
              <strong className="text-[#D4AF37]">{license.displayName}</strong> will be deactivated, refund of{' '}
              <strong className="text-emerald-400">
                ${localCancelEligibility.refundableAmountUSD || planPriceUSD}
              </strong>{' '}
              will be issued to original payment method in 5-10 business days. This cannot be undone.
            </p>
            {cancelModalError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs font-mono text-rose-200">
                {cancelModalError}
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono font-bold text-white cursor-pointer"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                disabled={isCancellingSub}
                onClick={handleCancelSubscription}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-mono font-bold text-white cursor-pointer disabled:opacity-60"
              >
                {isCancellingSub ? 'Processing Refund...' : 'Confirm Cancel + Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
