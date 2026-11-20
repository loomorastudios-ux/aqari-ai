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
  DealFinderDeal,
  MarketForecastResult,
  DueDiligenceResult,
  PortfolioOptimizerResult,
  AdvisorResult,
  LastResultsData,
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
  PieChart,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PWAInstallButton } from './PWAInstallButton';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from './ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from './ui/tooltip';
import { FadeInCard, CountUpNumber } from './ui/motion-primitives';
import {
  IrrNoiDscrChart,
  MarketComparisonChart,
  mapDealsToCompareItems,
  RiskScenarioChart,
} from './charts/AqariRecharts';

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
  onOpenAuth?: () => void;
  onOpenLegal?: (slug: 'terms' | 'privacy' | 'refund' | 'disclaimer') => void;
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
  onOpenAuth,
  onOpenLegal,
  initialToast,
}) => {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'analyze'
    | 'dealfinder'
    | 'forecast'
    | 'duediligence'
    | 'optimizer'
    | 'advisor'
    | 'saved'
    | 'portfolio'
    | 'radar'
    | 'settings'
  >(
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
  const [showRefundPolicyDrawer, setShowRefundPolicyDrawer] = useState(false);
  const [cancelPolicyAck, setCancelPolicyAck] = useState(false);

  // AI Deal Finder state
  const [dfBudgetDraft, setDfBudgetDraft] = useState<string>('500000');
  const [dfBudgetUSD, setDfBudgetUSD] = useState<number>(500000);
  const [dfMinCapDraft, setDfMinCapDraft] = useState<string>('6');
  const [dfMinCapPct, setDfMinCapPct] = useState<number>(6);
  const [dfCityComboInput, setDfCityComboInput] = useState<string>('Muscat (Oman OM)');
  const [dfCityOpen, setDfCityOpen] = useState<boolean>(false);
  const [dfPropType, setDfPropType] = useState<'All' | 'Apartment' | 'Villa' | 'Commercial'>('All');
  const [dfRisk, setDfRisk] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [isFindingDeals, setIsFindingDeals] = useState<boolean>(false);
  const [dfError, setDfError] = useState<string | null>(null);
  const [dfDeals, setDfDeals] = useState<DealFinderDeal[]>([]);
  const [dfDisclaimer, setDfDisclaimer] = useState<string | null>(null);
  const [dfResultsCity, setDfResultsCity] = useState<string>('');
  const [dfCreatedAt, setDfCreatedAt] = useState<string | null>(null);
  const [savingDealId, setSavingDealId] = useState<string | null>(null);

  // AI Market Forecast state
  const [fcCityComboInput, setFcCityComboInput] = useState<string>('Muscat (Oman OM)');
  const [fcCityOpen, setFcCityOpen] = useState<boolean>(false);
  const [fcPropType, setFcPropType] = useState<'Apartment' | 'Villa' | 'Commercial'>('Apartment');
  const [fcPeriod, setFcPeriod] = useState<'12 months' | '3 years' | '5 years'>('12 months');
  const [isGettingForecast, setIsGettingForecast] = useState<boolean>(false);
  const [fcError, setFcError] = useState<string | null>(null);
  const [fcResult, setFcResult] = useState<MarketForecastResult | null>(null);
  const [fcCreatedAt, setFcCreatedAt] = useState<string | null>(null);
  const [isSavingForecast, setIsSavingForecast] = useState<boolean>(false);

  // AI Due Diligence state (PRO / SOVEREIGN)
  const [ddCityComboInput, setDdCityComboInput] = useState<string>('Muscat (Oman OM)');
  const [ddCityOpen, setDdCityOpen] = useState<boolean>(false);
  const [ddPropType, setDdPropType] = useState<'Apartment' | 'Villa' | 'Commercial'>('Apartment');
  const [ddPriceDraft, setDdPriceDraft] = useState<string>('500000');
  const [ddPriceUSD, setDdPriceUSD] = useState<number>(500000);
  const [ddRentDraft, setDdRentDraft] = useState<string>('4000');
  const [ddRentUSD, setDdRentUSD] = useState<number>(4000);
  const [ddOwnershipType, setDdOwnershipType] = useState<'Freehold' | 'Leasehold'>('Freehold');
  const [ddAgeDraft, setDdAgeDraft] = useState<string>('5');
  const [ddBuildingAge, setDdBuildingAge] = useState<number>(5);
  const [isRunningDd, setIsRunningDd] = useState<boolean>(false);
  const [ddError, setDdError] = useState<string | null>(null);
  const [ddResult, setDdResult] = useState<DueDiligenceResult | null>(null);
  const [ddCreatedAt, setDdCreatedAt] = useState<string | null>(null);
  const [isSavingDd, setIsSavingDd] = useState<boolean>(false);

  // Global Portfolio Optimizer state (SOVEREIGN only)
  const [optCapitalDraft, setOptCapitalDraft] = useState<string>('1000000');
  const [optCapitalUSD, setOptCapitalUSD] = useState<number>(1000000);
  const [optSelectedCities, setOptSelectedCities] = useState<string[]>(['Muscat', 'Dubai']);
  const [optCityComboInput, setOptCityComboInput] = useState<string>('');
  const [optCityOpen, setOptCityOpen] = useState<boolean>(false);
  const [optRisk, setOptRisk] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [isRunningOpt, setIsRunningOpt] = useState<boolean>(false);
  const [optError, setOptError] = useState<string | null>(null);
  const [optResult, setOptResult] = useState<PortfolioOptimizerResult | null>(null);
  const [optCreatedAt, setOptCreatedAt] = useState<string | null>(null);
  const [isSavingOpt, setIsSavingOpt] = useState<boolean>(false);

  // Institutional AI Advisor state (SOVEREIGN only)
  const [advQuestion, setAdvQuestion] = useState<string>('Should I invest $1M in Muscat or Dubai?');
  const [advCityComboInput, setAdvCityComboInput] = useState<string>('Muscat (Oman OM)');
  const [advCityOpen, setAdvCityOpen] = useState<boolean>(false);
  const [advBudgetDraft, setAdvBudgetDraft] = useState<string>('1000000');
  const [advBudgetUSD, setAdvBudgetUSD] = useState<number>(1000000);
  const [isAskingAdvisor, setIsAskingAdvisor] = useState<boolean>(false);
  const [advError, setAdvError] = useState<string | null>(null);
  const [advResult, setAdvResult] = useState<AdvisorResult | null>(null);
  const [advCreatedAt, setAdvCreatedAt] = useState<string | null>(null);
  const [isSavingAdv, setIsSavingAdv] = useState<boolean>(false);

  const [isClearingTool, setIsClearingTool] = useState<
    'analysis' | 'deal_finder' | 'forecast' | 'due_diligence' | 'portfolio_optimizer' | 'advisor' | null
  >(null);

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
  const isOwnerAdmin = ['azzamalshmale@gmail.com'].includes(
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
    return Array.isArray(user.customCities) ? user.customCities : [];
  }, [user.customCities]);

  const isTestMode =
    import.meta.env.VITE_PAYMENT_TEST_MODE === 'true' ||
    (import.meta.env.VITE_PAYMENT_TEST_MODE as unknown) === true;

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

  const isCreditsLoaded =
    typeof user.analysesLeft === 'number' ||
    typeof user.freeAnalysesLeft === 'number' ||
    typeof user.freeAnalyses === 'number';

  const dynamicPlanPricing = findPlanPricing(pricingData, normalizePlanKey(user.plan));
  const license = computeLicenseStatus({
    plan: user.plan,
    licenseStart: user.subscriptionStartAt,
    licenseEnd: endsAt,
    analysesUsed: user.analysesUsed,
    freeAnalysesLeft: user.freeAnalysesLeft ?? user.freeAnalyses,
    analysesLeft: user.analysesLeft,
    analysesLimitOverride: user.analysesTotal ?? dynamicPlanPricing?.analysesLimit,
    savedLimitOverride:
      dynamicPlanPricing?.savedLimit === null ? Infinity : dynamicPlanPricing?.savedLimit,
  });

  const planInfo = PLAN_LIMITS[license.planKey] || PLAN_LIMITS.free;
  const daysLeft = license.daysLeft;
  const isPlanEnded = license.isExpired;
  const isExpired = user.subscriptionStatus === 'expired' || isPlanEnded;
  const isEndingIn24h = Boolean(license.planKey !== 'free' && endsAt && msRemaining > 0 && msRemaining <= 24 * 60 * 60 * 1000);
  const countdownText = endsAt ? formatTimeLeft(msRemaining) : null;

  const analysesRemaining = !isCreditsLoaded
    ? 0
    : license.isUnlimitedAnalyses
    ? 9999
    : license.analysesLeft;
  const isAccountLocked = Boolean(
    user.locked ||
      user.status === 'expired' ||
      user.status === 'exhausted' ||
      isExpired ||
      (isCreditsLoaded && !license.isUnlimitedAnalyses && analysesRemaining <= 0)
  );
  const lockReasonKind: 'expired' | 'exhausted' | null = isAccountLocked
    ? user.lockReason === 'expired' || user.status === 'expired' || isExpired
      ? 'expired'
      : 'exhausted'
    : null;
  const analysesLeftStr = !isCreditsLoaded
    ? 'Loading...'
    : license.isUnlimitedAnalyses
    ? 'Unlimited analyses left'
    : `${license.analysesLeft} analyses left`;

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

  const lockBannerMessage =
    user.lockError ||
    (lockReasonKind === 'expired'
      ? `Your ${planDisplayName} expired${endsAt ? ' on ' + new Date(endsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}. Renew to continue.`
      : `No analyses left for ${planDisplayName}. Upgrade to continue.`);

  const applyServerLockFromResponse = (data: any) => {
    if (!data?.locked) return;
    const nextLeft = typeof data.analyses_left === 'number' ? data.analyses_left : 0;
    onUpdateUser({
      ...user,
      status: data.status || data.reason || 'exhausted',
      locked: true,
      lockReason: data.reason || null,
      lockError: data.error || null,
      analysesLeft: nextLeft,
      freeAnalyses: nextLeft,
      freeAnalysesLeft: nextLeft,
      subscriptionStatus: 'expired',
    });
  };

  const canSensitivity =
    !isAccountLocked &&
    (meFeatures.includes('Yield & Sensitivity Calculator') || canUseFeature(license.planKey, 'yieldSensitivity'));
  const canMonteCarlo =
    !isAccountLocked &&
    (meFeatures.includes('Monte Carlo Stress Tests +200bps') || canUseFeature(license.planKey, 'monteCarlo'));
  const canPdfExport =
    !isAccountLocked &&
    (meFeatures.includes('PDF Memorandum Export') || canUseFeature(license.planKey, 'pdfExport'));
  const canPortfolioAgg =
    !isAccountLocked &&
    (meFeatures.includes('Multi-asset Portfolio Aggregation') || canUseFeature(license.planKey, 'portfolioAggregation'));
  const canFullMatrix =
    !isAccountLocked &&
    (meFeatures.includes('Cross-border Tax & Visa Matrix') || canUseFeature(license.planKey, 'crossBorderMatrixFull'));
  const canApiAccess =
    !isAccountLocked &&
    (meFeatures.includes('Full REST API Credentials') || canUseFeature(license.planKey, 'apiAccess'));
  const canAnalystDesk =
    !isAccountLocked &&
    (meFeatures.includes('1-on-1 Dedicated Analyst Desk') || canUseFeature(license.planKey, 'analystDesk'));
  const canCustomUnderwriting =
    !isAccountLocked &&
    (meFeatures.includes('White-glove Custom Underwriting') || canUseFeature(license.planKey, 'customUnderwriting'));
  const canDealFinder =
    !isAccountLocked && (license.planKey === 'pro' || license.planKey === 'enterprise');
  const canMarketForecast =
    !isAccountLocked && (license.planKey === 'pro' || license.planKey === 'enterprise');
  const canDueDiligence =
    !isAccountLocked && (license.planKey === 'pro' || license.planKey === 'enterprise');
  const canPortfolioOptimizer = !isAccountLocked && license.planKey === 'enterprise';
  const canInstitutionalAdvisor = !isAccountLocked && license.planKey === 'enterprise';
  const canSaveProperty = !isAccountLocked && maxSaved > 0;

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

  // Authoritative Run Analysis result state — null until RUN ANALYSIS (-1 CREDIT) succeeds (or hydrated from DB last_results)
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);
  const [stressTestActive, setStressTestActive] = useState(false);
  const [analysisCreatedAt, setAnalysisCreatedAt] = useState<string | null>(null);
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
    setAnalysisCreatedAt(null);
  };

  const formatLastResultTimestamp = (iso?: string | null) => {
    if (!iso) return 'Recent';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return 'Recent';
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent';
    }
  };

  const lastHydratedSigRef = useRef<{
    analysis?: string;
    deal_finder?: string;
    forecast?: string;
    due_diligence?: string;
    portfolio_optimizer?: string;
    advisor?: string;
  }>({});

  const applyPersistedLastResults = (lr?: LastResultsData | null) => {
    if (!lr || typeof lr !== 'object') return;

    if (lr.analysis?.results) {
      const sig = `${lr.analysis.created_at}|${lr.analysis.inputs?.city}|${lr.analysis.inputs?.priceUSD}|${lr.analysis.inputs?.rentUSD}`;
      if (lastHydratedSigRef.current.analysis !== sig) {
        lastHydratedSigRef.current.analysis = sig;
        const inp = lr.analysis.inputs || ({} as any);
        if (inp.propertyTitle) setPropertyName(String(inp.propertyTitle));
        if (inp.city) {
          const entry = resolveCityFromInput(String(inp.city));
          if (entry) {
            setCity(entry.city);
            setCityComboInput(formatCityOptionLabel(entry));
          } else {
            setCity(String(inp.city));
            setCityComboInput(String(inp.city));
          }
        }
        if (typeof inp.priceUSD === 'number' && inp.priceUSD > 0) setPriceUSD(inp.priceUSD);
        if (typeof inp.rentUSD === 'number' && inp.rentUSD > 0) setRentUSD(inp.rentUSD);
        if (typeof inp.downPaymentPct === 'number') {
          setDownPaymentPct(inp.downPaymentPct);
          setDownDraft(String(inp.downPaymentPct));
        }
        if (typeof inp.interestRatePct === 'number') {
          setInterestRatePct(inp.interestRatePct);
          setRateDraft(String(inp.interestRatePct));
        }
        if (typeof inp.operatingExpensePct === 'number') {
          setOperatingExpensePct(inp.operatingExpensePct);
          setOpexDraft(String(inp.operatingExpensePct));
        }
        setRunResult({
          analyzedAt: lr.analysis.created_at || new Date().toISOString(),
          inputs: {
            propertyTitle: String(inp.propertyTitle || 'Institutional Asset'),
            city: String(inp.city || 'Muscat'),
            priceUSD: Number(inp.priceUSD || 0),
            rentUSD: Number(inp.rentUSD || 0),
            downPaymentPct: Number(inp.downPaymentPct ?? 30),
            interestRatePct: Number(inp.interestRatePct ?? 5.5),
            operatingExpensePct: Number(inp.operatingExpensePct ?? 15),
          },
          ...lr.analysis.results,
        });
        setMonteCarloResult(lr.analysis.results.monteCarlo || null);
        setStressTestActive(Boolean(lr.analysis.results.monteCarlo));
        setAnalysisCreatedAt(lr.analysis.created_at || null);
        setHasRunAnalysis(true);
      }
    }

    if (lr.deal_finder && Array.isArray(lr.deal_finder.deals) && lr.deal_finder.deals.length > 0) {
      const dfSig = `${lr.deal_finder.created_at}|${lr.deal_finder.city}|${lr.deal_finder.deals.length}`;
      if (lastHydratedSigRef.current.deal_finder !== dfSig) {
        lastHydratedSigRef.current.deal_finder = dfSig;
        const inp = lr.deal_finder.inputs;
        if (inp?.city || lr.deal_finder.city) {
          const cEntry = resolveCityFromInput(inp?.city || lr.deal_finder.city);
          setDfCityComboInput(cEntry ? formatCityOptionLabel(cEntry) : (inp?.city || lr.deal_finder.city));
        }
        if (typeof inp?.budget === 'number' && inp.budget > 0) {
          setDfBudgetUSD(inp.budget);
          setDfBudgetDraft(String(inp.budget));
        }
        if (typeof inp?.minCapRate === 'number' && inp.minCapRate > 0) {
          setDfMinCapPct(inp.minCapRate);
          setDfMinCapDraft(String(inp.minCapRate));
        }
        if (inp?.propertyType === 'All' || inp?.propertyType === 'Apartment' || inp?.propertyType === 'Villa' || inp?.propertyType === 'Commercial') {
          setDfPropType(inp.propertyType);
        }
        if (inp?.risk === 'Low' || inp?.risk === 'Medium' || inp?.risk === 'High') {
          setDfRisk(inp.risk);
        }
        setDfDeals(lr.deal_finder.deals);
        setDfResultsCity(lr.deal_finder.city || inp?.city || '');
        setDfDisclaimer(
          lr.deal_finder.disclaimer ||
            `AI Deal Finder - Simulated deals based on market avg for ${lr.deal_finder.city} - For illustration, verify with local agent`
        );
        setDfCreatedAt(lr.deal_finder.created_at || null);
      }
    }

    if (lr.forecast?.forecast) {
      const fcSig = `${lr.forecast.created_at}|${lr.forecast.forecast.city}|${lr.forecast.forecast.period}`;
      if (lastHydratedSigRef.current.forecast !== fcSig) {
        lastHydratedSigRef.current.forecast = fcSig;
        const inp = lr.forecast.inputs;
        if (inp?.city || lr.forecast.forecast.city) {
          const cEntry = resolveCityFromInput(inp?.city || lr.forecast.forecast.city);
          setFcCityComboInput(cEntry ? formatCityOptionLabel(cEntry) : (inp?.city || lr.forecast.forecast.city));
        }
        if (inp?.propertyType === 'Apartment' || inp?.propertyType === 'Villa' || inp?.propertyType === 'Commercial') {
          setFcPropType(inp.propertyType);
        }
        if (inp?.period === '12 months' || inp?.period === '3 years' || inp?.period === '5 years') {
          setFcPeriod(inp.period);
        }
        setFcResult(lr.forecast.forecast);
        setFcCreatedAt(lr.forecast.created_at || (lr.forecast.forecast as any).generatedAt || null);
      }
    }

    if (lr.due_diligence?.result) {
      const ddSig = `${lr.due_diligence.created_at}|${lr.due_diligence.result.city}|${lr.due_diligence.result.riskScore}`;
      if (lastHydratedSigRef.current.due_diligence !== ddSig) {
        lastHydratedSigRef.current.due_diligence = ddSig;
        const inp = lr.due_diligence.inputs;
        if (inp?.city || lr.due_diligence.result.city) {
          const cEntry = resolveCityFromInput(inp?.city || lr.due_diligence.result.city);
          setDdCityComboInput(cEntry ? formatCityOptionLabel(cEntry) : (inp?.city || lr.due_diligence.result.city));
        }
        if (inp?.propertyType === 'Apartment' || inp?.propertyType === 'Villa' || inp?.propertyType === 'Commercial') {
          setDdPropType(inp.propertyType);
        }
        if (typeof inp?.price === 'number' && inp.price > 0) {
          setDdPriceUSD(inp.price);
          setDdPriceDraft(String(inp.price));
        }
        if (typeof inp?.monthlyRent === 'number' && inp.monthlyRent > 0) {
          setDdRentUSD(inp.monthlyRent);
          setDdRentDraft(String(inp.monthlyRent));
        }
        if (inp?.ownershipType === 'Freehold' || inp?.ownershipType === 'Leasehold') {
          setDdOwnershipType(inp.ownershipType);
        }
        if (typeof inp?.buildingAge === 'number' && inp.buildingAge >= 0) {
          setDdBuildingAge(inp.buildingAge);
          setDdAgeDraft(String(inp.buildingAge));
        }
        setDdResult(lr.due_diligence.result);
        setDdCreatedAt(lr.due_diligence.created_at || lr.due_diligence.result.generatedAt || null);
      }
    }

    if (lr.portfolio_optimizer?.result) {
      const optSig = `${lr.portfolio_optimizer.created_at}|${(lr.portfolio_optimizer.result.cities || []).join(',')}|${lr.portfolio_optimizer.result.totalCapital}`;
      if (lastHydratedSigRef.current.portfolio_optimizer !== optSig) {
        lastHydratedSigRef.current.portfolio_optimizer = optSig;
        const inp = lr.portfolio_optimizer.inputs;
        if (typeof inp?.totalCapital === 'number' && inp.totalCapital > 0) {
          setOptCapitalUSD(inp.totalCapital);
          setOptCapitalDraft(String(inp.totalCapital));
        }
        if (Array.isArray(inp?.cities) && inp.cities.length >= 2) {
          setOptSelectedCities(inp.cities.slice(0, 3));
        }
        if (inp?.risk === 'Low' || inp?.risk === 'Medium' || inp?.risk === 'High') {
          setOptRisk(inp.risk);
        }
        setOptResult(lr.portfolio_optimizer.result);
        setOptCreatedAt(lr.portfolio_optimizer.created_at || lr.portfolio_optimizer.result.generatedAt || null);
      }
    }

    if (lr.advisor?.result) {
      const advSig = `${lr.advisor.created_at}|${lr.advisor.result.city}|${lr.advisor.result.budget}`;
      if (lastHydratedSigRef.current.advisor !== advSig) {
        lastHydratedSigRef.current.advisor = advSig;
        const inp = lr.advisor.inputs;
        if (inp?.question) setAdvQuestion(String(inp.question));
        if (inp?.city || lr.advisor.result.city) {
          const cEntry = resolveCityFromInput(inp?.city || lr.advisor.result.city);
          setAdvCityComboInput(cEntry ? formatCityOptionLabel(cEntry) : (inp?.city || lr.advisor.result.city));
        }
        if (typeof inp?.budget === 'number' && inp.budget > 0) {
          setAdvBudgetUSD(inp.budget);
          setAdvBudgetDraft(String(inp.budget));
        }
        setAdvResult(lr.advisor.result);
        setAdvCreatedAt(lr.advisor.created_at || lr.advisor.result.generatedAt || null);
      }
    }
  };

  useEffect(() => {
    if (user?.lastResults) {
      applyPersistedLastResults(user.lastResults);
    }
  }, [user?.email, user?.lastResults]);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    fetch(`/api/app?action=get-last-results&login_email=${encodeURIComponent(user.email)}&t=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.success && d?.last_results) {
          applyPersistedLastResults(d.last_results);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const handleClearLastResult = async (
    tool: 'analysis' | 'deal_finder' | 'forecast' | 'due_diligence' | 'portfolio_optimizer' | 'advisor'
  ) => {
    if (!user?.email) return;
    setIsClearingTool(tool);
    try {
      const res = await fetch('/api/app?action=clear-last-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          tool,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        showToast(data?.error || 'Unable to clear saved result.');
        return;
      }
      if (tool === 'analysis') {
        lastHydratedSigRef.current.analysis = 'cleared';
        clearPendingRun();
      } else if (tool === 'deal_finder') {
        lastHydratedSigRef.current.deal_finder = 'cleared';
        setDfDeals([]);
        setDfDisclaimer(null);
        setDfResultsCity('');
        setDfCreatedAt(null);
      } else if (tool === 'forecast') {
        lastHydratedSigRef.current.forecast = 'cleared';
        setFcResult(null);
        setFcCreatedAt(null);
      } else if (tool === 'due_diligence') {
        lastHydratedSigRef.current.due_diligence = 'cleared';
        setDdResult(null);
        setDdCreatedAt(null);
      } else if (tool === 'portfolio_optimizer') {
        lastHydratedSigRef.current.portfolio_optimizer = 'cleared';
        setOptResult(null);
        setOptCreatedAt(null);
      } else if (tool === 'advisor') {
        lastHydratedSigRef.current.advisor = 'cleared';
        setAdvResult(null);
        setAdvCreatedAt(null);
      }
      onUpdateUser({
        ...user,
        lastResults: data.last_results || {},
      });
      showToast('Last result cleared.');
    } catch {
      showToast('Network error clearing result.');
    } finally {
      setIsClearingTool(null);
    }
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

  const dfCityOptions = useMemo(() => {
    const q = dfCityComboInput.trim();
    const matched = resolveCityFromInput(q);
    if (matched && q === formatCityOptionLabel(matched)) {
      return searchCities(matched.city, 25);
    }
    if (q.length >= 2) {
      return searchCities(q, 25);
    }
    const defaults = ['Muscat', 'Dubai', 'Riyadh', 'London', 'New York', 'Singapore', 'Miami', 'Doha', 'Abu Dhabi', 'Cairo'];
    return defaults.map((n) => findCityEntry(n)).filter((c): c is CityEntry => Boolean(c));
  }, [dfCityComboInput]);

  const handleFindDeals = async () => {
    if (isAccountLocked) {
      setDfError(lockBannerMessage);
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canDealFinder) {
      setDfError('AI Deal Finder available in PROFESSIONAL / SOVEREIGN - Upgrade');
      showToast('AI Deal Finder available in PROFESSIONAL / SOVEREIGN - Upgrade');
      onOpenRenewal();
      return;
    }
    if (!isCreditsLoaded || analysesRemaining <= 0) {
      setDfError('No analyses left. Renew / Upgrade.');
      showToast('No analyses left. Renew / Upgrade.');
      onOpenRenewal();
      return;
    }
    const cityEntry = resolveCityFromInput(dfCityComboInput);
    if (!cityEntry) {
      setDfError('City not supported yet. Choose from list.');
      showToast('City not supported yet. Choose from list.');
      return;
    }
    if (!Number.isFinite(dfBudgetUSD) || dfBudgetUSD <= 0 || !Number.isFinite(dfMinCapPct) || dfMinCapPct <= 0) {
      setDfError('Enter valid Budget ($) and Min Cap Rate (%) greater than 0.');
      return;
    }

    setDfError(null);
    setIsFindingDeals(true);
    try {
      const res = await fetch('/api/app?action=find-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          name: user.name,
          city: cityEntry.city,
          budget: dfBudgetUSD,
          minCapRate: dfMinCapPct,
          propertyType: dfPropType,
          risk: dfRisk,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        applyServerLockFromResponse(data);
        setDfError(data?.error || 'AI Deal Finder available in PROFESSIONAL / SOVEREIGN - Upgrade');
        showToast(data?.error || 'Upgrade required');
        onOpenRenewal();
        return;
      }
      if (!res.ok || data?.success === false) {
        setDfError(data?.error || 'Unable to find deals with those inputs.');
        return;
      }

      const nextLeft = Number(data.analyses_left ?? Math.max(0, analysesRemaining - 1));
      const nextTotal = Number(data.analyses_total ?? user.analysesTotal ?? license.analysesLimit);
      const createdAtVal = String(data.created_at || data.last_results?.deal_finder?.created_at || new Date().toISOString());
      const dealsArr = Array.isArray(data.deals) ? data.deals : [];
      const resCity = String(data.city || cityEntry.city);
      lastHydratedSigRef.current.deal_finder = `${createdAtVal}|${resCity}|${dealsArr.length}`;
      onUpdateUser({
        ...user,
        analysesUsed: Number(data.analyses_used ?? (user.analysesUsed || 0) + 1),
        analysesTotal: nextTotal,
        analysesLeft: nextLeft,
        freeAnalyses: nextLeft,
        freeAnalysesLeft: nextLeft,
        successfulAnalyses: Number(data.successful_analyses ?? (user.successfulAnalyses ?? 0) + 1),
        cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
        lastResults: data.last_results ?? user.lastResults,
      });

      setDfDeals(dealsArr);
      setDfResultsCity(resCity);
      setDfCreatedAt(createdAtVal);
      setDfDisclaimer(
        data.disclaimer ||
          `AI Deal Finder - Simulated deals based on market avg for ${resCity} - For illustration, verify with local agent`
      );
      showToast(`Found ${dealsArr.length || 5} simulated deals in ${resCity} (-1 credit, ${nextLeft} left).`);
    } catch {
      setDfError('Network error connecting to AI Deal Finder.');
    } finally {
      setIsFindingDeals(false);
    }
  };

  const fcCityOptions = useMemo(() => {
    const q = fcCityComboInput.trim();
    const matched = resolveCityFromInput(q);
    if (matched && q === formatCityOptionLabel(matched)) {
      return searchCities(matched.city, 25);
    }
    if (q.length >= 2) {
      return searchCities(q, 25);
    }
    const defaults = ['Muscat', 'Dubai', 'Riyadh', 'London', 'New York', 'Singapore', 'Miami', 'Doha', 'Abu Dhabi', 'Cairo'];
    return defaults.map((n) => findCityEntry(n)).filter((c): c is CityEntry => Boolean(c));
  }, [fcCityComboInput]);

  const handleGetForecast = async () => {
    if (isAccountLocked) {
      setFcError(lockBannerMessage);
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canMarketForecast) {
      const msg = 'AI Market Forecast available in PROFESSIONAL / SOVEREIGN - Upgrade';
      setFcError(msg);
      showToast(msg);
      onOpenRenewal();
      return;
    }
    if (!isCreditsLoaded || analysesRemaining <= 0) {
      setFcError('No analyses left. Renew / Upgrade.');
      showToast('No analyses left. Renew / Upgrade.');
      onOpenRenewal();
      return;
    }
    const cityEntry = resolveCityFromInput(fcCityComboInput);
    if (!cityEntry) {
      setFcError('City not supported yet. Choose from list.');
      showToast('City not supported yet. Choose from list.');
      return;
    }

    setFcError(null);
    setIsGettingForecast(true);
    try {
      const res = await fetch('/api/app?action=get-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          name: user.name,
          city: cityEntry.city,
          propertyType: fcPropType,
          period: fcPeriod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        applyServerLockFromResponse(data);
        setFcError(data?.error || 'AI Market Forecast available in PROFESSIONAL / SOVEREIGN - Upgrade');
        showToast(data?.error || 'Upgrade required');
        onOpenRenewal();
        return;
      }
      if (!res.ok || data?.success === false || !data?.forecast) {
        setFcError(data?.error || 'Unable to compute market forecast.');
        return;
      }

      const nextLeft = Number(data.analyses_left ?? Math.max(0, analysesRemaining - 1));
      const nextTotal = Number(data.analyses_total ?? user.analysesTotal ?? license.analysesLimit);
      const fcCreated = String(data.created_at || data.forecast?.generatedAt || new Date().toISOString());
      lastHydratedSigRef.current.forecast = `${fcCreated}|${data.forecast.city}|${data.forecast.period}`;
      onUpdateUser({
        ...user,
        analysesUsed: Number(data.analyses_used ?? (user.analysesUsed || 0) + 1),
        analysesTotal: nextTotal,
        analysesLeft: nextLeft,
        freeAnalyses: nextLeft,
        freeAnalysesLeft: nextLeft,
        successfulAnalyses: Number(data.successful_analyses ?? (user.successfulAnalyses ?? 0) + 1),
        cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
        lastResults: data.last_results ?? user.lastResults,
      });

      setFcResult(data.forecast as MarketForecastResult);
      setFcCreatedAt(fcCreated);
      showToast(`Market forecast ready for ${data.forecast.city} (-1 credit, ${nextLeft} left).`);
    } catch {
      setFcError('Network error connecting to AI Market Forecast.');
    } finally {
      setIsGettingForecast(false);
    }
  };

  const handleSaveForecast = async () => {
    if (!fcResult) return;
    if (isAccountLocked || !canSaveProperty) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    const savedList = user.savedAnalyses || [];
    if (savedList.length >= maxSaved) {
      showToast(`Save limit reached for ${planDisplayName}: ${savedList.length}/${maxSaved}. Upgrade to save more.`);
      onOpenRenewal();
      return;
    }

    const basePrice =
      fcResult.propertyType === 'Commercial'
        ? 950000
        : fcResult.propertyType === 'Villa'
        ? 680000
        : 420000;
    const estMonthlyRent = Math.round((basePrice * (fcResult.currentAvgCapRate / 100)) / 12);
    const estIrr = Number((fcResult.forecastCap5Y + fcResult.priceGrowth12M * 1.4).toFixed(1));
    const estCashflow = Math.round(estMonthlyRent * 0.42);
    const newAnalysis: SavedAnalysis = {
      id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      property: `${fcResult.city} ${fcResult.propertyType} Forecast (${fcResult.period})`,
      city: fcResult.city,
      price: basePrice,
      rent: estMonthlyRent,
      capRate: fcResult.forecastCap12M,
      cashOnCash: Number((fcResult.forecastCap12M + fcResult.rentGrowth12M * 0.6).toFixed(2)),
      irr: estIrr,
      dscr: fcResult.recommendation === 'Buy' ? '1.65' : fcResult.recommendation === 'Hold' ? '1.42' : '1.25',
      monthlyCashflow: estCashflow,
      riskScore: fcResult.confidence === 'High' ? 'AAA' : fcResult.confidence === 'Medium' ? 'AA' : 'A',
      date: Date.now(),
      imageUrl: PROPERTY_LISTINGS[0].imageUrl,
      notes: `AI Market Forecast (${fcResult.period}) | Rec: ${fcResult.recommendation} | Confidence: ${fcResult.confidence} | 12M Rent +${fcResult.rentGrowth12M}% | 12M Price +${fcResult.priceGrowth12M}%`,
    };

    setIsSavingForecast(true);
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
        if (data?.locked) applyServerLockFromResponse(data);
        showToast(data?.error || `Save limit reached (${savedList.length}/${maxSaved}).`);
        onOpenRenewal();
        return;
      }
      const savedItem = data?.savedItem || newAnalysis;
      const newSavedList = [savedItem, ...savedList];
      onUpdateUser({
        ...user,
        savedCount: data?.saved_count ?? newSavedList.length,
        savedAnalyses: newSavedList,
        portfolio: {
          totalValue: newSavedList.reduce((acc, curr) => acc + curr.price, 0),
          monthlyCashflow: newSavedList.reduce((acc, curr) => acc + curr.monthlyCashflow, 0),
        },
      });
      showToast(`Saved forecast "${savedItem.property}" (${newSavedList.length}/${maxSaved}).`);
    } catch {
      showToast('Unable to save forecast right now. Please try again.');
    } finally {
      setIsSavingForecast(false);
    }
  };

  const handleExportForecastPdf = async () => {
    if (!fcResult) return;
    if (isAccountLocked) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canPdfExport) {
      showToast('Available in PROFESSIONAL / SOVEREIGN - Upgrade');
      onOpenRenewal();
      return;
    }
    const title = `${fcResult.city} ${fcResult.propertyType} - AI Market Forecast (${fcResult.period})`;
    const metricsLines = [
      `Target Market: ${fcResult.city}, ${fcResult.country}`,
      `Property Type: ${fcResult.propertyType} | Forecast Horizon: ${fcResult.period}`,
      `Current Avg Cap Rate: ${fcResult.currentAvgCapRate}%`,
      `Forecast Cap Rate (12M / 3Y / 5Y): ${fcResult.forecastCap12M}% / ${fcResult.forecastCap3Y}% / ${fcResult.forecastCap5Y}%`,
      `Forecast Rent Growth (12M): +${fcResult.rentGrowth12M}% | Horizon Total: +${fcResult.rentGrowthSelected}%`,
      `Forecast Property Price Growth (12M): +${fcResult.priceGrowth12M}% | Horizon Total: +${fcResult.priceGrowthSelected}%`,
      `Confidence: ${fcResult.confidence} | Recommendation: ${fcResult.recommendation}`,
      `Disclaimer: ${fcResult.disclaimer}`,
    ];
    try {
      const res = await fetch('/api/app?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          format: 'pdf',
          propertyTitle: title,
        }),
      });
      if (res.status === 403) {
        const err = await res.json().catch(() => ({}));
        if (err?.locked) applyServerLockFromResponse(err);
        showToast(err?.error || 'Available in PROFESSIONAL / SOVEREIGN - Upgrade');
        onOpenRenewal();
        return;
      }
      const data = await res.json().catch(() => ({}));
      const filename = downloadMemorandumPdf({
        title,
        city: fcResult.city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: fcResult.disclaimer,
        watermarkText: data?.watermark,
      });
      showToast(`Exported PDF: ${filename}`);
    } catch {
      const filename = downloadMemorandumPdf({
        title,
        city: fcResult.city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: fcResult.disclaimer,
      });
      showToast(`Exported PDF: ${filename}`);
    }
  };

  // --- AI Due Diligence options & handlers (PRO / SOVEREIGN) ---
  const ddCityOptions = useMemo(() => {
    const q = ddCityComboInput.trim();
    const matched = resolveCityFromInput(q);
    if (matched && q === formatCityOptionLabel(matched)) {
      return searchCities(matched.city, 25);
    }
    if (q.length >= 2) {
      return searchCities(q, 25);
    }
    const defaults = ['Muscat', 'Dubai', 'Riyadh', 'London', 'New York', 'Singapore', 'Miami', 'Doha', 'Abu Dhabi', 'Cairo'];
    return defaults.map((n) => findCityEntry(n)).filter((c): c is CityEntry => Boolean(c));
  }, [ddCityComboInput]);

  const handleRunDueDiligence = async () => {
    if (isAccountLocked) {
      setDdError(lockBannerMessage);
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canDueDiligence) {
      const msg = 'AI Due Diligence available in PROFESSIONAL / SOVEREIGN - Upgrade';
      setDdError(msg);
      showToast(msg);
      onOpenRenewal();
      return;
    }
    if (!isCreditsLoaded || analysesRemaining <= 0) {
      setDdError('No analyses left. Renew / Upgrade.');
      showToast('No analyses left. Renew / Upgrade.');
      onOpenRenewal();
      return;
    }
    const cityEntry = resolveCityFromInput(ddCityComboInput);
    if (!cityEntry) {
      setDdError('City not supported yet. Choose from list.');
      showToast('City not supported yet. Choose from list.');
      return;
    }
    if (!Number.isFinite(ddPriceUSD) || ddPriceUSD <= 0 || !Number.isFinite(ddRentUSD) || ddRentUSD <= 0) {
      setDdError('Enter valid Property Price ($) and Gross Monthly Rent ($/mo) greater than 0.');
      return;
    }

    setDdError(null);
    setIsRunningDd(true);
    try {
      const res = await fetch('/api/app?action=run-due-diligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          name: user.name,
          city: cityEntry.city,
          propertyType: ddPropType,
          price: ddPriceUSD,
          monthlyRent: ddRentUSD,
          ownershipType: ddOwnershipType,
          buildingAge: ddBuildingAge,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        applyServerLockFromResponse(data);
        setDdError(data?.error || 'AI Due Diligence available in PROFESSIONAL / SOVEREIGN - Upgrade');
        showToast(data?.error || 'Upgrade required');
        onOpenRenewal();
        return;
      }
      if (!res.ok || data?.success === false || !data?.result) {
        setDdError(data?.error || 'Unable to run Due Diligence.');
        return;
      }

      const nextLeft = Number(data.analyses_left ?? Math.max(0, analysesRemaining - 1));
      const nextTotal = Number(data.analyses_total ?? user.analysesTotal ?? license.analysesLimit);
      const ddCreated = String(data.created_at || data.result?.generatedAt || new Date().toISOString());
      lastHydratedSigRef.current.due_diligence = `${ddCreated}|${data.result.city}|${data.result.riskScore}`;
      onUpdateUser({
        ...user,
        analysesUsed: Number(data.analyses_used ?? (user.analysesUsed || 0) + 1),
        analysesTotal: nextTotal,
        analysesLeft: nextLeft,
        freeAnalyses: nextLeft,
        freeAnalysesLeft: nextLeft,
        successfulAnalyses: Number(data.successful_analyses ?? (user.successfulAnalyses ?? 0) + 1),
        cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
        lastResults: data.last_results ?? user.lastResults,
      });

      setDdResult(data.result as DueDiligenceResult);
      setDdCreatedAt(ddCreated);
      showToast(`Due Diligence ready for ${data.result.city}: Score ${data.result.riskScore}/100 (-1 credit, ${nextLeft} left).`);
    } catch {
      setDdError('Network error connecting to AI Due Diligence.');
    } finally {
      setIsRunningDd(false);
    }
  };

  const handleSaveDueDiligence = async () => {
    if (!ddResult) return;
    if (isAccountLocked || !canSaveProperty) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    const savedList = user.savedAnalyses || [];
    if (savedList.length >= maxSaved) {
      showToast(`Save limit reached for ${planDisplayName}: ${savedList.length}/${maxSaved}. Upgrade to save more.`);
      onOpenRenewal();
      return;
    }
    const estIrr = Number((ddResult.propertyCapRate + ddResult.estPriceGrowthPct).toFixed(1));
    const estCashflow = Math.round((ddResult.price * (ddResult.propertyCapRate / 100)) / 12);
    const newAnalysis: SavedAnalysis = {
      id: `dd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      property: `${ddResult.city} ${ddResult.propertyType} - Due Diligence`,
      city: ddResult.city,
      price: ddResult.price,
      rent: ddResult.monthlyRent,
      capRate: ddResult.propertyCapRate,
      cashOnCash: ddResult.propertyCapRate,
      irr: estIrr,
      dscr: ddResult.riskScore >= 75 ? '1.70' : ddResult.riskScore >= 50 ? '1.35' : '1.05',
      monthlyCashflow: estCashflow,
      riskScore: ddResult.riskScore >= 75 ? 'AAA' : ddResult.riskScore >= 50 ? 'AA' : 'BBB',
      date: Date.now(),
      imageUrl: PROPERTY_LISTINGS[0].imageUrl,
      notes: `AI Due Diligence: Score ${ddResult.riskScore}/100 (${ddResult.verdict}) | ${ddResult.ownershipType}, Age ${ddResult.buildingAge} yrs`,
    };
    setIsSavingDd(true);
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
        if (data?.locked) applyServerLockFromResponse(data);
        showToast(data?.error || `Save limit reached (${savedList.length}/${maxSaved}).`);
        onOpenRenewal();
        return;
      }
      const savedItem = data?.savedItem || newAnalysis;
      const newSavedList = [savedItem, ...savedList];
      onUpdateUser({
        ...user,
        savedCount: data?.saved_count ?? newSavedList.length,
        savedAnalyses: newSavedList,
        portfolio: {
          totalValue: newSavedList.reduce((acc, curr) => acc + curr.price, 0),
          monthlyCashflow: newSavedList.reduce((acc, curr) => acc + curr.monthlyCashflow, 0),
        },
      });
      showToast(`Saved Due Diligence "${savedItem.property}" (${newSavedList.length}/${maxSaved}).`);
    } catch {
      showToast('Unable to save Due Diligence right now.');
    } finally {
      setIsSavingDd(false);
    }
  };

  const handleExportDueDiligencePdf = async () => {
    if (!ddResult) return;
    if (isAccountLocked) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canPdfExport) {
      showToast('Available in PROFESSIONAL / SOVEREIGN - Upgrade');
      onOpenRenewal();
      return;
    }
    const title = `${ddResult.city} ${ddResult.propertyType} - AI Due Diligence`;
    const metricsLines = [
      `Target City: ${ddResult.city}, ${ddResult.country} | ${ddResult.propertyType}`,
      `Ownership: ${ddResult.ownershipType} | Building Age: ${ddResult.buildingAge} years`,
      `Property Price: ${formatPrice(ddResult.price, 'USD')} | Monthly Rent: ${formatPrice(ddResult.monthlyRent, 'USD')}/mo`,
      `Property Cap Rate: ${ddResult.propertyCapRate}% vs City Avg: ${ddResult.cityAvgCapRate}%`,
      `Risk Score: ${ddResult.riskScore}/100 | Overall Verdict: ${ddResult.verdict}`,
      ...ddResult.checklist.map(
        (row) => `[${row.status.toUpperCase()}] ${row.category} - ${row.item}: ${row.note}`
      ),
    ];
    try {
      const res = await fetch('/api/app?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          format: 'pdf',
          propertyTitle: title,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        if (data?.locked) applyServerLockFromResponse(data);
        showToast(data?.error || 'Available in PROFESSIONAL / SOVEREIGN - Upgrade');
        onOpenRenewal();
        return;
      }
      const filename = downloadMemorandumPdf({
        title,
        city: ddResult.city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: ddResult.disclaimer,
        watermarkText: data?.watermark,
      });
      showToast(`Exported PDF: ${filename}`);
    } catch {
      const filename = downloadMemorandumPdf({
        title,
        city: ddResult.city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: ddResult.disclaimer,
      });
      showToast(`Exported PDF: ${filename}`);
    }
  };

  // --- Global Portfolio Optimizer options & handlers (SOVEREIGN ONLY) ---
  const optCityOptions = useMemo(() => {
    const q = optCityComboInput.trim();
    if (q.length >= 2) {
      return searchCities(q, 25);
    }
    const defaults = ['Muscat', 'Dubai', 'Riyadh', 'London', 'New York', 'Singapore', 'Miami', 'Doha', 'Abu Dhabi', 'Cairo'];
    return defaults.map((n) => findCityEntry(n)).filter((c): c is CityEntry => Boolean(c));
  }, [optCityComboInput]);

  const handleAddOptimizerCity = (entry: CityEntry) => {
    if (optSelectedCities.some((c) => c.toLowerCase() === entry.city.toLowerCase())) {
      setOptCityComboInput('');
      setOptCityOpen(false);
      return;
    }
    if (optSelectedCities.length >= 3) {
      showToast('Maximum 3 target cities allowed. Remove a city first.');
      setOptCityOpen(false);
      return;
    }
    setOptSelectedCities([...optSelectedCities, entry.city]);
    setOptCityComboInput('');
    setOptCityOpen(false);
  };

  const handleRemoveOptimizerCity = (cityName: string) => {
    setOptSelectedCities((prev) => prev.filter((c) => c.toLowerCase() !== cityName.toLowerCase()));
  };

  const handleOptimizePortfolio = async () => {
    if (isAccountLocked) {
      setOptError(lockBannerMessage);
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canPortfolioOptimizer) {
      const msg = 'Global Portfolio Optimizer available in SOVEREIGN only - Upgrade to SOVEREIGN';
      setOptError(msg);
      showToast(msg);
      onOpenRenewal();
      return;
    }
    if (!isCreditsLoaded || analysesRemaining <= 0) {
      setOptError('No analyses left. Renew / Upgrade.');
      showToast('No analyses left. Renew / Upgrade.');
      onOpenRenewal();
      return;
    }
    if (optSelectedCities.length < 2 || optSelectedCities.length > 3) {
      setOptError('Select 2 to 3 target cities from the 750+ city list.');
      return;
    }
    if (!Number.isFinite(optCapitalUSD) || optCapitalUSD <= 0) {
      setOptError('Enter valid Total Capital ($) greater than 0.');
      return;
    }

    setOptError(null);
    setIsRunningOpt(true);
    try {
      const res = await fetch('/api/app?action=optimize-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          name: user.name,
          totalCapital: optCapitalUSD,
          cities: optSelectedCities,
          risk: optRisk,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        applyServerLockFromResponse(data);
        setOptError(data?.error || 'Global Portfolio Optimizer available in SOVEREIGN only - Upgrade to SOVEREIGN');
        showToast(data?.error || 'Upgrade to SOVEREIGN required');
        onOpenRenewal();
        return;
      }
      if (!res.ok || data?.success === false || !data?.result) {
        setOptError(data?.error || 'Unable to optimize portfolio.');
        return;
      }

      const nextLeft = Number(data.analyses_left ?? Math.max(0, analysesRemaining - 1));
      const nextTotal = Number(data.analyses_total ?? user.analysesTotal ?? license.analysesLimit);
      const optCreated = String(data.created_at || data.result?.generatedAt || new Date().toISOString());
      lastHydratedSigRef.current.portfolio_optimizer = `${optCreated}|${(data.result.cities || []).join(',')}|${data.result.totalCapital}`;
      onUpdateUser({
        ...user,
        analysesUsed: Number(data.analyses_used ?? (user.analysesUsed || 0) + 1),
        analysesTotal: nextTotal,
        analysesLeft: nextLeft,
        freeAnalyses: nextLeft,
        freeAnalysesLeft: nextLeft,
        successfulAnalyses: Number(data.successful_analyses ?? (user.successfulAnalyses ?? 0) + 1),
        cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
        lastResults: data.last_results ?? user.lastResults,
      });

      setOptResult(data.result as PortfolioOptimizerResult);
      setOptCreatedAt(optCreated);
      showToast(`Portfolio optimized (${data.result.blendedCapRate}% blended cap) (-1 credit, ${nextLeft} left).`);
    } catch {
      setOptError('Network error connecting to Global Portfolio Optimizer.');
    } finally {
      setIsRunningOpt(false);
    }
  };

  const handleSaveOptimizer = async () => {
    if (!optResult) return;
    if (isAccountLocked || !canSaveProperty) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    const savedList = user.savedAnalyses || [];
    if (savedList.length >= maxSaved) {
      showToast(`Save limit reached for ${planDisplayName}: ${savedList.length}/${maxSaved}.`);
      onOpenRenewal();
      return;
    }
    const monthlyCashflow = Math.round(optResult.totalEstAnnualIncomeUSD / 12);
    const newAnalysis: SavedAnalysis = {
      id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      property: `Global Portfolio (${optResult.cities.join(' + ')})`,
      city: optResult.cities[0] || 'Multi-City',
      price: optResult.totalCapital,
      rent: monthlyCashflow,
      capRate: optResult.blendedCapRate,
      cashOnCash: optResult.blendedCapRate,
      irr: Number((optResult.blendedCapRate + 4.5).toFixed(1)),
      dscr: '1.85',
      monthlyCashflow,
      riskScore: optResult.diversificationScore >= 80 ? 'AAA' : 'AA',
      date: Date.now(),
      imageUrl: PROPERTY_LISTINGS[0].imageUrl,
      notes: optResult.allocations.map((a) => `${a.city}: ${a.allocationPct}% (${formatPrice(a.amountUSD, 'USD')})`).join(' | '),
    };
    setIsSavingOpt(true);
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
        if (data?.locked) applyServerLockFromResponse(data);
        showToast(data?.error || `Save limit reached (${savedList.length}/${maxSaved}).`);
        return;
      }
      const savedItem = data?.savedItem || newAnalysis;
      const newSavedList = [savedItem, ...savedList];
      onUpdateUser({
        ...user,
        savedCount: data?.saved_count ?? newSavedList.length,
        savedAnalyses: newSavedList,
        portfolio: {
          totalValue: newSavedList.reduce((acc, curr) => acc + curr.price, 0),
          monthlyCashflow: newSavedList.reduce((acc, curr) => acc + curr.monthlyCashflow, 0),
        },
      });
      showToast(`Saved optimized portfolio (${newSavedList.length}/${maxSaved}).`);
    } catch {
      showToast('Unable to save portfolio right now.');
    } finally {
      setIsSavingOpt(false);
    }
  };

  const handleExportOptimizerPdf = async () => {
    if (!optResult) return;
    if (isAccountLocked) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canPdfExport) {
      showToast('Available in PROFESSIONAL / SOVEREIGN - Upgrade');
      onOpenRenewal();
      return;
    }
    const title = `Global Portfolio Optimizer - ${optResult.cities.join(' / ')}`;
    const metricsLines = [
      `Total Capital: ${formatPrice(optResult.totalCapital, 'USD')} | Risk Profile: ${optResult.risk}`,
      `Total Est. Annual Income: ${formatPrice(optResult.totalEstAnnualIncomeUSD, 'USD')}/yr`,
      `Blended Cap Rate: ${optResult.blendedCapRate}% | Diversification Score: ${optResult.diversificationScore}/100`,
      ...optResult.allocations.map(
        (a) =>
          `${a.city} (${a.country}): ${a.allocationPct}% | ${formatPrice(a.amountUSD, 'USD')} | Cap ${a.estCapRate}% | Est Rent ${formatPrice(a.estAnnualRentUSD, 'USD')}/yr`
      ),
    ];
    try {
      const res = await fetch('/api/app?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          format: 'pdf',
          propertyTitle: title,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        if (data?.locked) applyServerLockFromResponse(data);
        showToast(data?.error || 'Upgrade required');
        onOpenRenewal();
        return;
      }
      const filename = downloadMemorandumPdf({
        title,
        city: optResult.cities.join(', '),
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: optResult.disclaimer,
        watermarkText: data?.watermark,
      });
      showToast(`Exported PDF: ${filename}`);
    } catch {
      const filename = downloadMemorandumPdf({
        title,
        city: optResult.cities.join(', '),
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: optResult.disclaimer,
      });
      showToast(`Exported PDF: ${filename}`);
    }
  };

  // --- Institutional AI Advisor options & handlers (SOVEREIGN ONLY) ---
  const advCityOptions = useMemo(() => {
    const q = advCityComboInput.trim();
    const matched = resolveCityFromInput(q);
    if (matched && q === formatCityOptionLabel(matched)) {
      return searchCities(matched.city, 25);
    }
    if (q.length >= 2) {
      return searchCities(q, 25);
    }
    const defaults = ['Muscat', 'Dubai', 'Riyadh', 'London', 'New York', 'Singapore', 'Miami', 'Doha', 'Abu Dhabi', 'Cairo'];
    return defaults.map((n) => findCityEntry(n)).filter((c): c is CityEntry => Boolean(c));
  }, [advCityComboInput]);

  const handleAskAdvisor = async () => {
    if (isAccountLocked) {
      setAdvError(lockBannerMessage);
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canInstitutionalAdvisor) {
      const msg = 'Institutional AI Advisor available in SOVEREIGN only - Upgrade to SOVEREIGN';
      setAdvError(msg);
      showToast(msg);
      onOpenRenewal();
      return;
    }
    if (!isCreditsLoaded || analysesRemaining <= 0) {
      setAdvError('No analyses left. Renew / Upgrade.');
      showToast('No analyses left. Renew / Upgrade.');
      onOpenRenewal();
      return;
    }
    const cityEntry = resolveCityFromInput(advCityComboInput);
    if (!cityEntry) {
      setAdvError('City not supported yet. Choose from list.');
      showToast('City not supported yet. Choose from list.');
      return;
    }
    if (advQuestion.trim().length < 4) {
      setAdvError('Enter your investment question (minimum 4 characters).');
      return;
    }
    if (!Number.isFinite(advBudgetUSD) || advBudgetUSD <= 0) {
      setAdvError('Enter valid Budget ($) greater than 0.');
      return;
    }

    setAdvError(null);
    setIsAskingAdvisor(true);
    try {
      const res = await fetch('/api/app?action=ask-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          name: user.name,
          question: advQuestion.trim(),
          city: cityEntry.city,
          budget: advBudgetUSD,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        applyServerLockFromResponse(data);
        setAdvError(data?.error || 'Institutional AI Advisor available in SOVEREIGN only - Upgrade to SOVEREIGN');
        showToast(data?.error || 'Upgrade to SOVEREIGN required');
        onOpenRenewal();
        return;
      }
      if (!res.ok || data?.success === false || !data?.result) {
        setAdvError(data?.error || 'Unable to generate Institutional Advisor memo.');
        return;
      }

      const nextLeft = Number(data.analyses_left ?? Math.max(0, analysesRemaining - 1));
      const nextTotal = Number(data.analyses_total ?? user.analysesTotal ?? license.analysesLimit);
      const advCreated = String(data.created_at || data.result?.generatedAt || new Date().toISOString());
      lastHydratedSigRef.current.advisor = `${advCreated}|${data.result.city}|${data.result.budget}`;
      onUpdateUser({
        ...user,
        analysesUsed: Number(data.analyses_used ?? (user.analysesUsed || 0) + 1),
        analysesTotal: nextTotal,
        analysesLeft: nextLeft,
        freeAnalyses: nextLeft,
        freeAnalysesLeft: nextLeft,
        successfulAnalyses: Number(data.successful_analyses ?? (user.successfulAnalyses ?? 0) + 1),
        cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
        lastResults: data.last_results ?? user.lastResults,
      });

      setAdvResult(data.result as AdvisorResult);
      setAdvCreatedAt(advCreated);
      showToast(`Advisor memo ready for ${data.result.city} (-1 credit, ${nextLeft} left).`);
    } catch {
      setAdvError('Network error connecting to Institutional AI Advisor.');
    } finally {
      setIsAskingAdvisor(false);
    }
  };

  const handleSaveAdvisor = async () => {
    if (!advResult) return;
    if (isAccountLocked || !canSaveProperty) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    const savedList = user.savedAnalyses || [];
    if (savedList.length >= maxSaved) {
      showToast(`Save limit reached for ${planDisplayName}: ${savedList.length}/${maxSaved}.`);
      onOpenRenewal();
      return;
    }
    const newAnalysis: SavedAnalysis = {
      id: `adv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      property: `AI Advisor Memo - ${advResult.city} (${advResult.recommendation})`,
      city: advResult.city,
      price: advResult.budget,
      rent: advResult.estMonthlyIncomeUSD,
      capRate: advResult.cityAvgCapRate,
      cashOnCash: advResult.cityAvgCapRate,
      irr: Number((advResult.cityAvgCapRate + 4.8).toFixed(1)),
      dscr: advResult.recommendation === 'Buy' ? '1.72' : '1.40',
      monthlyCashflow: advResult.estMonthlyIncomeUSD,
      riskScore: advResult.recommendation === 'Buy' ? 'AAA' : 'AA',
      date: Date.now(),
      imageUrl: PROPERTY_LISTINGS[0].imageUrl,
      notes: `Q: ${advResult.question} | ${advResult.headline}`,
    };
    setIsSavingAdv(true);
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
        if (data?.locked) applyServerLockFromResponse(data);
        showToast(data?.error || `Save limit reached (${savedList.length}/${maxSaved}).`);
        return;
      }
      const savedItem = data?.savedItem || newAnalysis;
      const newSavedList = [savedItem, ...savedList];
      onUpdateUser({
        ...user,
        savedCount: data?.saved_count ?? newSavedList.length,
        savedAnalyses: newSavedList,
        portfolio: {
          totalValue: newSavedList.reduce((acc, curr) => acc + curr.price, 0),
          monthlyCashflow: newSavedList.reduce((acc, curr) => acc + curr.monthlyCashflow, 0),
        },
      });
      showToast(`Saved Advisor memo (${newSavedList.length}/${maxSaved}).`);
    } catch {
      showToast('Unable to save Advisor memo right now.');
    } finally {
      setIsSavingAdv(false);
    }
  };

  const handleExportAdvisorPdf = async () => {
    if (!advResult) return;
    if (isAccountLocked) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    if (!canPdfExport) {
      showToast('Available in PROFESSIONAL / SOVEREIGN - Upgrade');
      onOpenRenewal();
      return;
    }
    const title = `Institutional AI Advisor - ${advResult.city} (${advResult.recommendation})`;
    const metricsLines = [
      `Question: ${advResult.question}`,
      `Target Market: ${advResult.city}, ${advResult.country} | Avg Cap Rate: ${advResult.cityAvgCapRate}%`,
      `Budget: ${formatPrice(advResult.budget, 'USD')} | Est. Annual NOI: ${formatPrice(advResult.estAnnualIncomeUSD, 'USD')}/yr`,
      `Recommendation: ${advResult.recommendation} - ${advResult.headline}`,
      ...advResult.reasoning.map((r, i) => `Reasoning ${i + 1}: ${r}`),
      ...advResult.riskFactors.map((r, i) => `Risk ${i + 1}: ${r}`),
      ...advResult.nextSteps.map((s, i) => `Next Step ${i + 1}: ${s}`),
    ];
    try {
      const res = await fetch('/api/app?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          format: 'pdf',
          propertyTitle: title,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        if (data?.locked) applyServerLockFromResponse(data);
        showToast(data?.error || 'Upgrade required');
        onOpenRenewal();
        return;
      }
      const filename = downloadMemorandumPdf({
        title,
        city: advResult.city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: advResult.disclaimer,
        watermarkText: data?.watermark,
      });
      showToast(`Exported PDF: ${filename}`);
    } catch {
      const filename = downloadMemorandumPdf({
        title,
        city: advResult.city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: advResult.disclaimer,
      });
      showToast(`Exported PDF: ${filename}`);
    }
  };

  const handleViewDealInAnalyze = (deal: DealFinderDeal) => {
    setPropertyName(deal.name);
    selectTargetCity(deal.city, true);
    setPriceUSD(deal.price);
    setRentUSD(deal.rent);
    setDownPaymentPct(deal.downPaymentPct);
    setDownDraft(String(deal.downPaymentPct));
    setInterestRatePct(deal.interestRatePct);
    setRateDraft(String(deal.interestRatePct));
    setOperatingExpensePct(deal.operatingExpensePct);
    setOpexDraft(String(deal.operatingExpensePct));

    const annualGross = Math.round(deal.rent * 12 * 0.95);
    const annualOpex = Math.round(annualGross * (deal.operatingExpensePct / 100));
    const noi = Math.round(annualGross - annualOpex);
    const dpUsd = Math.round(deal.price * (deal.downPaymentPct / 100));
    const annualDebt = Math.max(0, noi - deal.monthlyCashflow * 12);

    setRunResult({
      analyzedAt: new Date().toISOString(),
      inputs: {
        propertyTitle: deal.name,
        city: deal.city,
        priceUSD: deal.price,
        rentUSD: deal.rent,
        downPaymentPct: deal.downPaymentPct,
        interestRatePct: deal.interestRatePct,
        operatingExpensePct: deal.operatingExpensePct,
      },
      capRate: deal.capRate,
      cashOnCash: deal.cashOnCash,
      irr5Yr: deal.irr,
      dscr: deal.dscr,
      monthlyCashflowUSD: deal.monthlyCashflow,
      monthlyMortgageUSD: null,
      netOperatingIncomeUSD: noi,
      annualGrossRentUSD: annualGross,
      annualOPEXUSD: annualOpex,
      annualDebtServiceUSD: Math.round(annualDebt),
      downPaymentUSD: dpUsd,
      sensitivity: null,
      monteCarlo: null,
    });
    setHasRunAnalysis(true);
    setActiveTab('analyze');
    showToast(`Opened "${deal.name}" in Analyze (no extra credit deducted).`);
  };

  const handleSaveDealFromFinder = async (deal: DealFinderDeal) => {
    if (isAccountLocked || !canSaveProperty) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
    const savedList = user.savedAnalyses || [];
    if (savedList.length >= maxSaved) {
      showToast(`Save limit reached for ${planDisplayName}: ${savedList.length}/${maxSaved}. Upgrade to save more.`);
      onOpenRenewal();
      return;
    }
    const newAnalysis: SavedAnalysis = {
      id: `saved_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      property: deal.name,
      city: deal.city,
      price: deal.price,
      rent: deal.rent,
      capRate: deal.capRate,
      cashOnCash: deal.cashOnCash,
      irr: deal.irr,
      dscr: deal.dscr,
      monthlyCashflow: deal.monthlyCashflow,
      riskScore: deal.risk === 'Low' ? 'AAA' : deal.risk === 'High' ? 'A' : 'AA',
      date: Date.now(),
      imageUrl: PROPERTY_LISTINGS[0].imageUrl,
      notes: `AI Deal Finder (${deal.propertyType}) - Score ${deal.score}/100 - Risk: ${deal.risk}`,
    };

    setSavingDealId(deal.id);
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
        if (data?.locked) applyServerLockFromResponse(data);
        showToast(data?.error || `Save limit reached (${savedList.length}/${maxSaved}).`);
        onOpenRenewal();
        return;
      }
      const savedItem = data?.savedItem || newAnalysis;
      const newSavedList = [savedItem, ...savedList];
      onUpdateUser({
        ...user,
        savedCount: data?.saved_count ?? newSavedList.length,
        savedAnalyses: newSavedList,
        portfolio: {
          totalValue: newSavedList.reduce((acc, curr) => acc + curr.price, 0),
          monthlyCashflow: newSavedList.reduce((acc, curr) => acc + curr.monthlyCashflow, 0),
        },
      });
      showToast(`Saved "${savedItem.property}" to Portfolio (${newSavedList.length}/${maxSaved}).`);
    } catch {
      showToast('Unable to save deal to portfolio right now. Please try again.');
    } finally {
      setSavingDealId(null);
    }
  };

  const handleExportDealPdf = async (deal: DealFinderDeal) => {
    if (!canPdfExport) {
      showToast('Available in PROFESSIONAL / SOVEREIGN - Upgrade');
      onOpenRenewal();
      return;
    }
    const metricsLines = [
      `Source: AI Deal Finder (Simulated Deal - Verify with Local Agent)`,
      `Deal Score: ${deal.score}/100 | Risk: ${deal.risk} | Type: ${deal.propertyType}`,
      `Target City: ${deal.city}, ${deal.country}`,
      `Acquisition Price: ${formatPrice(deal.price, 'USD')}`,
      `Est. Monthly Rent: ${formatPrice(deal.rent, 'USD')}/mo`,
      `Unlevered Cap Rate: ${deal.capRate}%`,
      `Cash-on-Cash Return: ${deal.cashOnCash}%`,
      `5-Year Equity IRR: ${deal.irr}%`,
      `Debt Service Coverage Ratio (DSCR): ${deal.dscr}x`,
      `Est. Monthly Cashflow: ${formatPrice(deal.monthlyCashflow, 'USD')}`,
    ];
    try {
      const res = await fetch('/api/app?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          login_email: user.email,
          format: 'pdf',
          propertyTitle: deal.name,
        }),
      });
      if (res.status === 403) {
        const err = await res.json().catch(() => ({}));
        showToast(err?.error || 'Available in PROFESSIONAL / SOVEREIGN - Upgrade');
        onOpenRenewal();
        return;
      }
      const data = await res.json().catch(() => ({}));
      const filename = downloadMemorandumPdf({
        title: deal.name,
        city: deal.city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: 'AI Deal Finder Simulated Memorandum',
        watermarkText: data?.watermark,
      });
      showToast(`Exported PDF: ${filename}`);
    } catch {
      const filename = downloadMemorandumPdf({
        title: deal.name,
        city: deal.city,
        userEmail: user.email,
        planDisplay: license.displayName,
        metricsLines,
        notes: 'AI Deal Finder Simulated Memorandum',
      });
      showToast(`Exported PDF: ${filename}`);
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

    if (isAccountLocked) {
      showToast(lockBannerMessage);
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
      if (res.status === 403 || !res.ok || !data?.success || !data?.cityCard) {
        if (data?.locked) {
          applyServerLockFromResponse(data);
          setIsAddCityOpen(false);
          onOpenRenewal();
        }
        setCityError(
          data?.error || 'City not found, try another spelling - المدينة غير موجودة، جرب تهجئة ثانية'
        );
        return;
      }

      const nextCustomCities: CustomCityCard[] = Array.isArray(data.custom_cities)
        ? data.custom_cities
        : [data.cityCard, ...customCities.filter((c) => c.city.toLowerCase() !== data.cityCard.city.toLowerCase())];

      const nextLeft = Number(
        data.analyses_left ?? data.license?.analysesLeft ?? Math.max(0, analysesRemaining - 1)
      );

      onUpdateUser({
        ...user,
        customCities: nextCustomCities,
        analysesUsed: data.analyses_used ?? data.license?.analysesUsed ?? (user.analysesUsed || 0) + 1,
        analysesTotal: data.analyses_total ?? user.analysesTotal,
        freeAnalyses: nextLeft,
        freeAnalysesLeft: nextLeft,
        analysesLeft: nextLeft,
        successfulAnalyses: data.successful_analyses ?? (user.successfulAnalyses ?? 0) + 1,
        cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
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
    if (isAccountLocked) {
      showToast(lockBannerMessage);
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
        applyServerLockFromResponse(data);
        showToast(data?.error || 'No analyses left. Renew / Upgrade.');
        onOpenRenewal();
        return;
      }

      const nextLeft = Number(
        data.analyses_left ?? data?.license?.analysesLeft ?? Math.max(0, analysesRemaining - 1)
      );
      const nextTotal = Number(
        data.analyses_total ?? data?.license?.analysesLimit ?? user.analysesTotal ?? license.analysesLimit
      );
      const nextSucc =
        typeof data.successful_analyses === 'number'
          ? data.successful_analyses
          : (user.successfulAnalyses ?? 0) + 1;
      const analyzedAtStr = String(data.analyzedAt || data.last_results?.analysis?.created_at || new Date().toISOString());
      const resCityName = data.inputs?.city || cleanCityName;
      lastHydratedSigRef.current.analysis = `${analyzedAtStr}|${resCityName}|${priceUSD}|${rentUSD}`;
      onUpdateUser({
        ...user,
        plan: data?.license?.planKey || user.plan,
        analysesUsed: data?.license?.analysesUsed ?? (user.analysesUsed || 0) + 1,
        analysesTotal: nextTotal,
        successfulAnalyses: nextSucc,
        cancellationEligibility: data.cancellationEligibility ?? user.cancellationEligibility,
        freeAnalyses: nextLeft,
        freeAnalysesLeft: nextLeft,
        analysesLeft: nextLeft,
        lastResults: data.last_results ?? user.lastResults,
      });

      if (data?.result) {
        setRunResult({
          analyzedAt: analyzedAtStr,
          inputs: data.inputs || {
            propertyTitle: propertyName,
            city: cleanCityName,
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
        setAnalysisCreatedAt(analyzedAtStr);
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
    if (isAccountLocked) {
      showToast(lockBannerMessage);
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
        if (data?.locked) applyServerLockFromResponse(data);
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

  // Delete saved analysis (Backend Single Source of Truth)
  const handleDeleteSaved = async (id: string) => {
    try {
      const res = await fetch('/api/app?action=delete-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id,
          email: user.email,
          login_email: user.email,
        }),
      });
      const data = await res.json().catch(() => null);
      const updatedList = Array.isArray(data?.saved_analyses)
        ? data.saved_analyses
        : (user.savedAnalyses || []).filter((item) => item.id !== id);
      const newTotalVal = updatedList.reduce((acc: number, curr: SavedAnalysis) => acc + curr.price, 0);
      const newMonthlyCash = updatedList.reduce((acc: number, curr: SavedAnalysis) => acc + curr.monthlyCashflow, 0);
      onUpdateUser({
        ...user,
        savedCount: data?.saved_count ?? updatedList.length,
        savedAnalyses: updatedList,
        portfolio: { totalValue: newTotalVal, monthlyCashflow: newMonthlyCash },
      });
      showToast('Analysis deleted from portfolio.');
    } catch {
      showToast('Unable to delete analysis from server. Please retry.');
    }
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
    if (isAccountLocked) {
      showToast(lockBannerMessage);
      onOpenRenewal();
      return;
    }
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
      showToast(data?.message || 'Subscription cancelled & refund issued via Paddle in 5-10 business days');
    } catch {
      setCancelModalError('Network error processing cancellation. Plan not deactivated.');
    } finally {
      setIsCancellingSub(false);
    }
  };

  return (
    <TooltipProvider delayDuration={180}>
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans select-none relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-zinc-900 border border-[#D4AF37]/50 text-white text-xs font-mono shadow-[0_10px_35px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2.5 backdrop-blur-xl">
          <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unified Account Lock Banner (Expired OR Exhausted) */}
      {isAccountLocked && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 text-rose-200 text-xs py-2.5 px-4 flex items-center justify-between backdrop-blur-md z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto font-mono">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Account Locked:</strong> {lockBannerMessage}
            </span>
          </div>
          <button
            onClick={onOpenRenewal}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold transition cursor-pointer shrink-0 ml-3 shadow-sm"
          >
            Upgrade / Renew
          </button>
        </div>
      )}

      {/* Subscription Ending in 24 Hours Banner */}
      {!isAccountLocked && isEndingIn24h && (
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

      {/* Payment Test Mode Banner */}
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

        {/* Left Sidebar (Desktop fixed, Mobile sliding drawer) using shadcn Sidebar primitives */}
        <Sidebar open={mobileSidebarOpen}>
          <SidebarContent>
            <SidebarHeader>
              {/* Top Navigation: Back to Homepage */}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  onGoToHome();
                }}
                className="w-full min-h-[44px] group"
              >
                <span className="text-sm transition-transform group-hover:-translate-x-0.5">🏠</span>
                <span>Back to Homepage</span>
              </Button>

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
                      {isCreditsLoaded
                        ? license.sidebarText
                        : `LICENSING COUNTDOWN - ${license.displayName} - ${daysLeft} days left - Loading...`}
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
            </SidebarHeader>

            {/* Navigation Tabs */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'dashboard'}
                  onClick={() => { setActiveTab('dashboard'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4" />
                    <span>My Dashboard</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'analyze'}
                  onClick={() => { setActiveTab('analyze'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <Calculator className="w-4 h-4" />
                    <span>Analyze New Property</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'dealfinder'}
                  onClick={() => { setActiveTab('dealfinder'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <Radar className="w-4 h-4" />
                    <span>AI Deal Finder</span>
                  </span>
                  {!canDealFinder && (
                    <Lock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'dealfinder' ? 'text-black' : 'text-[#D4AF37]'}`} />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'forecast'}
                  onClick={() => { setActiveTab('forecast'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <TrendingUp className="w-4 h-4" />
                    <span>AI Market Forecast</span>
                  </span>
                  {!canMarketForecast && (
                    <Lock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'forecast' ? 'text-black' : 'text-[#D4AF37]'}`} />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'duediligence'}
                  onClick={() => { setActiveTab('duediligence'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4" />
                    <span>AI Due Diligence</span>
                  </span>
                  {!canDueDiligence && (
                    <Lock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'duediligence' ? 'text-black' : 'text-[#D4AF37]'}`} />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'optimizer'}
                  onClick={() => { setActiveTab('optimizer'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <PieChart className="w-4 h-4" />
                    <span>Global Portfolio Optimizer</span>
                  </span>
                  {!canPortfolioOptimizer && (
                    <Lock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'optimizer' ? 'text-black' : 'text-[#D4AF37]'}`} />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'advisor'}
                  onClick={() => { setActiveTab('advisor'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <Bot className="w-4 h-4" />
                    <span>Institutional AI Advisor</span>
                  </span>
                  {!canInstitutionalAdvisor && (
                    <Lock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'advisor' ? 'text-black' : 'text-[#D4AF37]'}`} />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'saved'}
                  onClick={() => { setActiveTab('saved'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Saved Analyses</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'portfolio'}
                  onClick={() => { setActiveTab('portfolio'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4" />
                    <span>Portfolio</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'radar'}
                  onClick={() => { setActiveTab('radar'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <Globe className="w-4 h-4" />
                    <span>Market Radar</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === 'settings'}
                  onClick={() => { setActiveTab('settings'); setMobileSidebarOpen(false); }}
                >
                  <span className="flex items-center gap-3">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            {/* Sign Out and Forget Device options */}
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
          </SidebarContent>

          {/* Bottom Upgrade / Renew Button */}
          <SidebarFooter>
            <Button
              type="button"
              onClick={onOpenRenewal}
              className="w-full py-3 px-3 uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] min-h-[44px]"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>Upgrade / Renew Plan</span>
            </Button>
            <div className="text-[11px] text-center text-zinc-500 font-mono">
              30-day licensing • Secure Paddle Checkout
            </div>
          </SidebarFooter>
        </Sidebar>

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
                      <motion.button
                        type="button"
                        whileHover={isAnalyzingApi || isAccountLocked ? undefined : { scale: 1.02 }}
                        whileTap={isAnalyzingApi || isAccountLocked ? undefined : { scale: 0.99 }}
                        transition={{ duration: 0.15 }}
                        onClick={handleRunAnalysis}
                        disabled={isAnalyzingApi || isAccountLocked}
                        className={`flex-1 py-3.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-lg ${
                          isAccountLocked
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed'
                            : 'bg-[#D4AF37] hover:bg-[#F3E5AB] text-black cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                        }`}
                      >
                        {isAccountLocked ? (
                          <>
                            <Lock className="w-4 h-4 text-amber-400" />
                            <span>{lockReasonKind === 'expired' ? 'Plan Expired - Renew' : 'No analyses left. Renew / Upgrade.'}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>{isAnalyzingApi ? 'RUNNING ANALYSIS...' : 'RUN ANALYSIS (-1 CREDIT)'}</span>
                          </>
                        )}
                      </motion.button>

                      <div
                        className={`px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold text-center shrink-0 ${
                          isAccountLocked
                            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                            : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]'
                        }`}
                      >
                        {isAccountLocked
                          ? '0 analyses left'
                          : analysesLeftStr}
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveAnalysis}
                        disabled={!hasRunAnalysis || !runResult || isAccountLocked}
                        className={`py-3.5 px-5 rounded-xl border font-bold text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                          !hasRunAnalysis || !runResult || isAccountLocked
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
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${hasRunAnalysis && runResult ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                      <h3 className="text-sm font-mono font-bold uppercase text-white">Underwriting Model</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        hasRunAnalysis && runResult
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      }`}>
                        {hasRunAnalysis && runResult ? 'VERIFIED RUN' : 'AWAITING RUN'}
                      </span>
                      {hasRunAnalysis && runResult && (
                        <button
                          type="button"
                          disabled={isClearingTool === 'analysis'}
                          onClick={() => handleClearLastResult('analysis')}
                          className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/15 bg-white/[0.04] hover:bg-rose-500/20 hover:border-rose-500/40 text-zinc-300 hover:text-rose-200 cursor-pointer transition"
                        >
                          {isClearingTool === 'analysis' ? 'Clearing...' : 'Clear Last Result'}
                        </button>
                      )}
                    </div>
                  </div>
                  {hasRunAnalysis && runResult && (
                    <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[11px] font-mono text-[#D4AF37]">
                      Last Result - {formatLastResultTimestamp(analysisCreatedAt || runResult.analyzedAt)} - {runResult.inputs?.city || city}
                    </div>
                  )}

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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-help">
                              <div className="text-[10px] font-mono uppercase text-zinc-400">Unlevered Cap Rate</div>
                              <div className="text-2xl font-black font-mono text-[#D4AF37] mt-1">
                                <CountUpNumber value={Number(runResult.capRate) || 0} decimals={2} suffix="%" />
                              </div>
                              <div className="text-[9px] text-zinc-500 font-mono mt-0.5">NOI: {formatPrice(runResult.netOperatingIncomeUSD, currentCurrency)}/yr</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Net Operating Income divided by Purchase Price</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-help">
                              <div className="text-[10px] font-mono uppercase text-zinc-400">Cash-on-Cash Return</div>
                              <div className={`text-2xl font-black font-mono mt-1 ${runResult.cashOnCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                <CountUpNumber value={Number(runResult.cashOnCash) || 0} decimals={2} suffix="%" />
                              </div>
                              <div className="text-[9px] text-zinc-500 font-mono mt-0.5">Equity: {formatPrice(runResult.downPaymentUSD, currentCurrency)}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Annual pre-tax cashflow divided by initial cash equity</TooltipContent>
                        </Tooltip>

                        {canSensitivity ? (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-help">
                                  <div className="text-[10px] font-mono uppercase text-zinc-400">5-Year Equity IRR</div>
                                  <div className="text-2xl font-black font-mono text-purple-400 mt-1">
                                    <CountUpNumber
                                      value={Number(runResult.irr5Yr ?? (runResult.cashOnCash + 4.8).toFixed(1)) || 0}
                                      decimals={1}
                                      suffix="%"
                                    />
                                  </div>
                                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5">DSCR: {runResult.dscr ?? '--'}x</div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Projected 5-Year Internal Rate of Return &amp; Debt Service Coverage Ratio</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] cursor-help">
                                  <div className="text-[10px] font-mono uppercase text-zinc-400">Monthly Net Cashflow</div>
                                  <div className={`text-2xl font-black font-mono mt-1 ${(runResult.monthlyCashflowUSD ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    <CountUpNumber
                                      value={Math.round(runResult.monthlyCashflowUSD ?? 0)}
                                      prefix={(runResult.monthlyCashflowUSD ?? 0) < 0 ? '-$' : '$'}
                                      formatLocale
                                    />
                                  </div>
                                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5">Debt/yr: {formatPrice(runResult.annualDebtServiceUSD, currentCurrency)}</div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Monthly Net Operating Income minus Debt Service</TooltipContent>
                            </Tooltip>
                          </>
                        ) : (
                          <div className="col-span-2 p-3.5 rounded-xl bg-black/50 border border-amber-500/30 flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2 text-zinc-300">
                              <Lock className="w-4 h-4 text-[#D4AF37] shrink-0" />
                              <span>5Y IRR, DSCR &amp; Cashflow Waterfall — Available in STARTER</span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="solidGold"
                              onClick={onOpenRenewal}
                              className="shrink-0 ml-2"
                            >
                              Upgrade
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* PDF Investment Memorandum Export (Professional+) */}
                      <div className="pt-2">
                        {canPdfExport ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleExportPDF(runResult.inputs.propertyTitle || propertyName)}
                            className="w-full"
                          >
                            <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>EXPORT PDF MEMORANDUM</span>
                          </Button>
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

              {/* Feature 1 Recharts: 5-Year IRR / NOI / DSCR Chart after verified underwriting run */}
              {hasRunAnalysis && runResult && (
                <FadeInCard>
                  <Card className="p-5 sm:p-6 border border-[#D4AF37]/25">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-[#D4AF37]">
                        <BarChart3 className="w-4 h-4" />
                        <span>Institutional Cashflow, IRR &amp; DSCR Trajectory</span>
                      </CardTitle>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {runResult.inputs?.city || city} • 5-Year Model
                      </span>
                    </CardHeader>
                    <CardContent>
                      <IrrNoiDscrChart
                        capRate={Number(runResult.capRate) || 0}
                        cashOnCash={Number(runResult.cashOnCash) || 0}
                        irr5Yr={Number(runResult.irr5Yr ?? (runResult.cashOnCash + 4.8).toFixed(1)) || 0}
                        dscr={runResult.dscr ?? 1.25}
                        netOperatingIncomeUSD={Number(runResult.netOperatingIncomeUSD) || 0}
                        monthlyCashflowUSD={Number(runResult.monthlyCashflowUSD) || 0}
                        annualDebtServiceUSD={Number(runResult.annualDebtServiceUSD) || 0}
                        currency={currentCurrency}
                      />
                    </CardContent>
                  </Card>
                </FadeInCard>
              )}

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
                      <Button
                        type="button"
                        variant="solidGold"
                        onClick={onOpenRenewal}
                        className="shrink-0"
                      >
                        Upgrade
                      </Button>
                    </div>
                  ) : runResult?.sensitivity ? (
                    <Tabs defaultValue="chart" className="w-full">
                      <TabsList>
                        <TabsTrigger value="chart">Risk Scenario Chart</TabsTrigger>
                        <TabsTrigger value="table">Sensitivity Table</TabsTrigger>
                      </TabsList>
                      <TabsContent value="chart">
                        <RiskScenarioChart
                          mode="sensitivity"
                          sensitivity={runResult.sensitivity}
                        />
                      </TabsContent>
                      <TabsContent value="table">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Scenario</TableHead>
                              <TableHead>Monthly Rent</TableHead>
                              <TableHead>Cap Rate</TableHead>
                              <TableHead>CoC</TableHead>
                              <TableHead>Cashflow/mo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {runResult.sensitivity.map((sc) => (
                              <TableRow
                                key={sc.deltaPct}
                                className={sc.deltaPct === 0 ? 'bg-[#D4AF37]/10 text-white font-bold' : 'text-zinc-300'}
                              >
                                <TableCell className="py-2">{sc.deltaPct > 0 ? `+${sc.deltaPct}% Bull` : sc.deltaPct < 0 ? `${sc.deltaPct}% Bear` : 'Base (0%)'}</TableCell>
                                <TableCell className="py-2">{formatPrice(sc.rentUSD, currentCurrency)}</TableCell>
                                <TableCell className="py-2 text-[#D4AF37]">{sc.capRate}%</TableCell>
                                <TableCell className="py-2 text-emerald-400">{sc.cashOnCash}%</TableCell>
                                <TableCell className="py-2">{formatPrice(sc.monthlyCashflowUSD, currentCurrency)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TabsContent>
                    </Tabs>
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

          {/* TAB 1B: AI DEAL FINDER (PROFESSIONAL / SOVEREIGN ONLY) */}
          {activeTab === 'dealfinder' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
                    <Radar className="w-3.5 h-3.5" />
                    <span>AI DEAL FINDER • PROFESSIONAL / SOVEREIGN</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    AI Deal Finder
                  </h2>
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  Credits Remaining: <strong className="text-[#D4AF37]">{analysesLeftStr}</strong>
                </div>
              </div>

              {!canDealFinder && (
                <div className="p-5 rounded-2xl bg-amber-950/35 border border-[#D4AF37]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-mono font-bold text-[#D4AF37]">
                        AI Deal Finder available in PROFESSIONAL / SOVEREIGN - Upgrade
                      </div>
                      <div className="text-xs font-mono text-zinc-300">
                        FREE and STARTER accounts cannot scan deals. Upgrade to unlock 5 ranked simulated deals per scan.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenRenewal}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-xs font-mono uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    Upgrade Plan
                  </button>
                </div>
              )}

              {/* Deal Finder Form */}
              <div className={`glass-panel p-6 space-y-5 ${!canDealFinder ? 'opacity-65' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Budget ($) */}
                  <div className="space-y-1.5">
                    <label htmlFor="df-budget" className="text-xs font-mono text-zinc-300 block">
                      Budget ($)
                    </label>
                    <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                      <span className="text-xs font-mono text-zinc-400 mr-1.5">$</span>
                      <input
                        id="df-budget"
                        type="text"
                        disabled={!canDealFinder}
                        lang="en"
                        dir="ltr"
                        inputMode="decimal"
                        autoComplete="off"
                        style={EN_INPUT_STYLE}
                        value={dfBudgetDraft}
                        onChange={(e) => {
                          const clean = sanitizeEnglishDecimal(e.target.value, false);
                          setDfBudgetDraft(clean);
                          setDfBudgetUSD(Math.max(0, parseEnglishNumber(clean, 0)));
                        }}
                        onBlur={() => setDfBudgetDraft(String(dfBudgetUSD || 0))}
                        className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {formatUsdInputDisplay(dfBudgetUSD)}
                    </div>
                  </div>

                  {/* Target City (750+ Searchable Combobox) */}
                  <div className="space-y-1.5 relative">
                    <label htmlFor="df-city" className="text-xs font-mono text-zinc-300 block">
                      Target City ({CITIES.length}+ Cities)
                    </label>
                    <input
                      id="df-city"
                      type="text"
                      disabled={!canDealFinder}
                      lang="en"
                      dir="ltr"
                      autoComplete="off"
                      value={dfCityComboInput}
                      onFocus={() => canDealFinder && setDfCityOpen(true)}
                      onBlur={() => setTimeout(() => setDfCityOpen(false), 180)}
                      onChange={(e) => {
                        setDfCityComboInput(e.target.value);
                        setDfCityOpen(true);
                      }}
                      placeholder="Type city... e.g. Muscat"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    />
                    {dfCityOpen && canDealFinder && (
                      <div className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-zinc-950 border border-[#D4AF37]/40 shadow-2xl">
                        {dfCityOptions.length === 0 ? (
                          <div className="px-3 py-2 text-xs font-mono text-zinc-400">
                            City not supported yet. Try another spelling.
                          </div>
                        ) : (
                          dfCityOptions.map((c) => (
                            <button
                              key={`${c.city}-${c.countryCode}`}
                              type="button"
                              onMouseDown={() => {
                                setDfCityComboInput(formatCityOptionLabel(c));
                                setDfCityOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-200 hover:bg-[#D4AF37] hover:text-black transition cursor-pointer flex items-center justify-between"
                            >
                              <span>{formatCityOptionLabel(c)}</span>
                              <span className="text-[10px] opacity-75">Avg {c.avgCapRate}%</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Min Cap Rate (%) */}
                  <div className="space-y-1.5">
                    <label htmlFor="df-min-cap" className="text-xs font-mono text-zinc-300 block">
                      Min Cap Rate (%)
                    </label>
                    <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                      <input
                        id="df-min-cap"
                        type="text"
                        disabled={!canDealFinder}
                        lang="en"
                        dir="ltr"
                        inputMode="decimal"
                        autoComplete="off"
                        style={EN_INPUT_STYLE}
                        value={dfMinCapDraft}
                        onChange={(e) => {
                          const clean = sanitizeEnglishDecimal(e.target.value, true);
                          setDfMinCapDraft(clean);
                          setDfMinCapPct(Math.max(0, Math.min(50, parseEnglishNumber(clean, 0))));
                        }}
                        onBlur={() => setDfMinCapDraft(String(dfMinCapPct || 0))}
                        className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-mono text-zinc-400">%</span>
                    </div>
                  </div>

                  {/* Property Type */}
                  <div className="space-y-1.5">
                    <label htmlFor="df-prop-type" className="text-xs font-mono text-zinc-300 block">
                      Property Type
                    </label>
                    <select
                      id="df-prop-type"
                      disabled={!canDealFinder}
                      value={dfPropType}
                      onChange={(e) => setDfPropType(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    >
                      <option value="All">All</option>
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>

                  {/* Risk */}
                  <div className="space-y-1.5">
                    <label htmlFor="df-risk" className="text-xs font-mono text-zinc-300 block">
                      Risk
                    </label>
                    <select
                      id="df-risk"
                      disabled={!canDealFinder}
                      value={dfRisk}
                      onChange={(e) => setDfRisk(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                {dfError && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
                    {dfError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <motion.button
                    type="button"
                    whileHover={
                      !canDealFinder ||
                      isFindingDeals ||
                      isExpired ||
                      !isCreditsLoaded ||
                      (!license.isUnlimitedAnalyses && analysesRemaining <= 0)
                        ? undefined
                        : { scale: 1.02 }
                    }
                    whileTap={
                      !canDealFinder ||
                      isFindingDeals ||
                      isExpired ||
                      !isCreditsLoaded ||
                      (!license.isUnlimitedAnalyses && analysesRemaining <= 0)
                        ? undefined
                        : { scale: 0.99 }
                    }
                    transition={{ duration: 0.15 }}
                    disabled={
                      !canDealFinder ||
                      isFindingDeals ||
                      isExpired ||
                      !isCreditsLoaded ||
                      (!license.isUnlimitedAnalyses && analysesRemaining <= 0)
                    }
                    onClick={handleFindDeals}
                    className={`px-6 py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition min-h-[46px] ${
                      !canDealFinder ||
                      isExpired ||
                      !isCreditsLoaded ||
                      (!license.isUnlimitedAnalyses && analysesRemaining <= 0)
                        ? 'bg-zinc-800 text-zinc-500 border border-white/10 cursor-not-allowed'
                        : 'bg-[#D4AF37] hover:bg-[#F3E5AB] text-black cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                    }`}
                  >
                    {!canDealFinder ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Find Deals (-1 CREDIT)</span>
                      </>
                    ) : isFindingDeals ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Scanning Deals...</span>
                      </>
                    ) : !isCreditsLoaded ? (
                      <span>Loading...</span>
                    ) : !license.isUnlimitedAnalyses && analysesRemaining <= 0 ? (
                      <>
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>No analyses left</span>
                      </>
                    ) : (
                      <>
                        <Radar className="w-4 h-4" />
                        <span>Find Deals (-1 CREDIT)</span>
                      </>
                    )}
                  </motion.button>

                  <span className="text-[11px] font-mono text-zinc-400">
                    Returns 5 ranked deals sorted by institutional score (0-100)
                  </span>
                </div>
              </div>

              {/* Deals Results Table + Feature 1 Market Comparison Rechart */}
              {dfDeals.length > 0 && (
                <FadeInCard className="glass-panel p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                    <div>
                      <div className="text-[11px] font-mono text-[#D4AF37]">
                        Last Result - {formatLastResultTimestamp(dfCreatedAt)} - {dfResultsCity}
                      </div>
                      <h3 className="text-sm font-mono font-bold uppercase text-white mt-0.5">
                        Ranked Simulated Deals • {dfResultsCity}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-emerald-400">
                        Sorted by Score Desc
                      </span>
                      <button
                        type="button"
                        disabled={isClearingTool === 'deal_finder'}
                        onClick={() => handleClearLastResult('deal_finder')}
                        className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-rose-500/20 hover:border-rose-500/40 text-xs font-mono text-zinc-300 hover:text-rose-200 cursor-pointer transition"
                      >
                        {isClearingTool === 'deal_finder' ? 'Clearing...' : 'Clear Last Result'}
                      </button>
                    </div>
                  </div>

                  {/* Recharts Deal Yield Comparison */}
                  <MarketComparisonChart
                    title={`Deal Yield & Cash-on-Cash Comparison (${dfResultsCity})`}
                    subtitle="Ranked Simulated Deals"
                    items={mapDealsToCompareItems(dfDeals)}
                    secondarySeriesName="Cash-on-Cash (%)"
                  />

                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Deal Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Price ($)</TableHead>
                        <TableHead>Est. Rent ($/mo)</TableHead>
                        <TableHead>Cap Rate (%)</TableHead>
                        <TableHead>Cash-on-Cash (%)</TableHead>
                        <TableHead>Score (0-100)</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dfDeals.map((deal) => (
                        <TableRow key={deal.id}>
                          <TableCell>
                            <div className="font-bold text-white">{deal.name}</div>
                            <div className="text-[10px] text-zinc-500">{deal.propertyType}</div>
                          </TableCell>
                          <TableCell className="text-zinc-300">{deal.city}</TableCell>
                          <TableCell className="text-white font-semibold">
                            ${deal.price.toLocaleString('en-US')}
                          </TableCell>
                          <TableCell className="text-zinc-200">
                            ${deal.rent.toLocaleString('en-US')}/mo
                          </TableCell>
                          <TableCell className="text-[#D4AF37] font-bold">
                            {deal.capRate}%
                          </TableCell>
                          <TableCell className="text-emerald-400 font-bold">
                            {deal.cashOnCash}%
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] font-bold">
                              {deal.score}/100
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                deal.risk === 'Low'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : deal.risk === 'High'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {deal.risk}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleViewDealInAnalyze(deal)}
                                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-[#D4AF37] hover:text-black text-white font-bold text-[11px] cursor-pointer transition"
                              >
                                View Analysis
                              </button>
                              <button
                                type="button"
                                disabled={savingDealId === deal.id || isAccountLocked}
                                onClick={() => handleSaveDealFromFinder(deal)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-300 font-bold text-[11px] cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {savingDealId === deal.id ? 'Saving...' : 'Save to Portfolio'}
                              </button>
                              <button
                                type="button"
                                disabled={isAccountLocked}
                                onClick={() => handleExportDealPdf(deal)}
                                className="px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500 hover:text-black border border-purple-500/40 text-purple-200 font-bold text-[11px] cursor-pointer transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {(!canPdfExport || isAccountLocked) && <Lock className="w-3 h-3" />}
                                <span>Export PDF</span>
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200">
                    {dfDisclaimer ||
                      `AI Deal Finder - Simulated deals based on market avg for ${dfResultsCity} - For illustration, verify with local agent`}
                  </div>
                </FadeInCard>
              )}
            </div>
          )}

          {/* TAB 1C: AI MARKET FORECAST (PROFESSIONAL / SOVEREIGN ONLY) */}
          {activeTab === 'forecast' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>AI MARKET FORECAST • PROFESSIONAL / SOVEREIGN</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    AI Market Forecast
                  </h2>
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  Credits Remaining: <strong className="text-[#D4AF37]">{isAccountLocked ? '0 analyses left' : analysesLeftStr}</strong>
                </div>
              </div>

              {!canMarketForecast && (
                <div className="p-5 rounded-2xl bg-amber-950/35 border border-[#D4AF37]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-mono font-bold text-[#D4AF37]">
                        {isAccountLocked
                          ? lockBannerMessage
                          : 'AI Market Forecast available in PROFESSIONAL / SOVEREIGN - Upgrade'}
                      </div>
                      <div className="text-xs font-mono text-zinc-300">
                        {isAccountLocked
                          ? 'Upgrade or renew your subscription to unlock city-level Cap Rate, Rent Growth, and Property Appreciation forecasts.'
                          : 'FREE and STARTER accounts cannot run market forecasts. Upgrade to unlock 12M, 3Y, and 5Y projections.'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenRenewal}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-xs font-mono uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    {isAccountLocked ? 'Upgrade / Renew' : 'Upgrade Plan'}
                  </button>
                </div>
              )}

              {/* Forecast Inputs */}
              <div className={`glass-panel p-6 space-y-5 ${!canMarketForecast ? 'opacity-65' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Target City (750+ Searchable Combobox) */}
                  <div className="space-y-1.5 relative">
                    <label htmlFor="fc-city" className="text-xs font-mono text-zinc-300 block">
                      City ({CITIES.length}+ Markets)
                    </label>
                    <input
                      id="fc-city"
                      type="text"
                      disabled={!canMarketForecast}
                      lang="en"
                      dir="ltr"
                      autoComplete="off"
                      value={fcCityComboInput}
                      onFocus={() => canMarketForecast && setFcCityOpen(true)}
                      onBlur={() => setTimeout(() => setFcCityOpen(false), 180)}
                      onChange={(e) => {
                        setFcCityComboInput(e.target.value);
                        setFcCityOpen(true);
                      }}
                      placeholder="Type city... e.g. Muscat"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    />
                    {fcCityOpen && canMarketForecast && (
                      <div className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-zinc-950 border border-[#D4AF37]/40 shadow-2xl">
                        {fcCityOptions.length === 0 ? (
                          <div className="px-3 py-2 text-xs font-mono text-zinc-400">
                            City not supported yet. Try another spelling.
                          </div>
                        ) : (
                          fcCityOptions.map((c) => (
                            <button
                              key={`fc-${c.city}-${c.countryCode}`}
                              type="button"
                              onMouseDown={() => {
                                setFcCityComboInput(formatCityOptionLabel(c));
                                setFcCityOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-200 hover:bg-[#D4AF37] hover:text-black transition cursor-pointer flex items-center justify-between"
                            >
                              <span>{formatCityOptionLabel(c)}</span>
                              <span className="text-[10px] opacity-75">Avg {c.avgCapRate}%</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Property Type */}
                  <div className="space-y-1.5">
                    <label htmlFor="fc-prop-type" className="text-xs font-mono text-zinc-300 block">
                      Property Type
                    </label>
                    <select
                      id="fc-prop-type"
                      disabled={!canMarketForecast}
                      value={fcPropType}
                      onChange={(e) => setFcPropType(e.target.value as 'Apartment' | 'Villa' | 'Commercial')}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>

                  {/* Period */}
                  <div className="space-y-1.5">
                    <label htmlFor="fc-period" className="text-xs font-mono text-zinc-300 block">
                      Forecast Period
                    </label>
                    <select
                      id="fc-period"
                      disabled={!canMarketForecast}
                      value={fcPeriod}
                      onChange={(e) => setFcPeriod(e.target.value as '12 months' | '3 years' | '5 years')}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    >
                      <option value="12 months">12 months</option>
                      <option value="3 years">3 years</option>
                      <option value="5 years">5 years</option>
                    </select>
                  </div>
                </div>

                {fcError && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
                    {fcError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <motion.button
                    type="button"
                    whileHover={
                      !canMarketForecast || isGettingForecast || isAccountLocked || !isCreditsLoaded
                        ? undefined
                        : { scale: 1.02 }
                    }
                    whileTap={
                      !canMarketForecast || isGettingForecast || isAccountLocked || !isCreditsLoaded
                        ? undefined
                        : { scale: 0.99 }
                    }
                    transition={{ duration: 0.15 }}
                    disabled={
                      !canMarketForecast ||
                      isGettingForecast ||
                      isAccountLocked ||
                      !isCreditsLoaded
                    }
                    onClick={handleGetForecast}
                    className={`px-6 py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition min-h-[46px] ${
                      !canMarketForecast || isAccountLocked || !isCreditsLoaded
                        ? 'bg-zinc-800 text-zinc-500 border border-white/10 cursor-not-allowed'
                        : 'bg-[#D4AF37] hover:bg-[#F3E5AB] text-black cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                    }`}
                  >
                    {isAccountLocked ? (
                      <>
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>{lockReasonKind === 'expired' ? 'Plan Expired - Renew' : 'No analyses left'}</span>
                      </>
                    ) : !canMarketForecast ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Get Forecast (-1 CREDIT)</span>
                      </>
                    ) : isGettingForecast ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Computing Forecast...</span>
                      </>
                    ) : !isCreditsLoaded ? (
                      <span>Loading...</span>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        <span>Get Forecast (-1 CREDIT)</span>
                      </>
                    )}
                  </motion.button>

                  <span className="text-[11px] font-mono text-zinc-400">
                    Projects 12M / 3Y / 5Y Cap Rate, Rent Growth (2-5% YoY) &amp; Appreciation (3-7% YoY)
                  </span>
                </div>
              </div>

              {/* Forecast Results & SVG Chart + Recharts Peer Market Comparison */}
              {fcResult && (
                <FadeInCard className="glass-panel p-6 space-y-6 border border-[#D4AF37]/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                    <div>
                      <div className="text-[11px] font-mono text-emerald-400 mb-0.5">
                        Last Result - {formatLastResultTimestamp(fcCreatedAt || (fcResult as any).generatedAt)} - {fcResult.city}
                      </div>
                      <div className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-wider">
                        {fcResult.city}, {fcResult.country} • {fcResult.propertyType} • Horizon: {fcResult.period}
                      </div>
                      <h3 className="text-xl font-bold text-white mt-0.5">
                        Market Yield &amp; Capital Growth Projection
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span
                        className={`px-3 py-1 rounded-lg font-bold border ${
                          fcResult.confidence === 'High'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : fcResult.confidence === 'Medium'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-700/40 border-white/15 text-zinc-300'
                        }`}
                      >
                        Confidence: {fcResult.confidence}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-lg font-black uppercase border ${
                          fcResult.recommendation === 'Buy'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : fcResult.recommendation === 'Hold'
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                            : 'bg-rose-500/20 border-rose-400 text-rose-300'
                        }`}
                      >
                        Recommendation: {fcResult.recommendation}
                      </span>
                      <button
                        type="button"
                        disabled={isClearingTool === 'forecast'}
                        onClick={() => handleClearLastResult('forecast')}
                        className="px-3 py-1 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-rose-500/20 hover:border-rose-500/40 text-xs font-mono text-zinc-300 hover:text-rose-200 cursor-pointer transition"
                      >
                        {isClearingTool === 'forecast' ? 'Clearing...' : 'Clear Last Result'}
                      </button>
                    </div>
                  </div>

                  {/* Metrics Grid with Framer Motion CountUp */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono tabular-nums">
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Current Avg Cap Rate</div>
                      <div className="text-xl font-black text-white mt-1">
                        <CountUpNumber value={Number(fcResult.currentAvgCapRate) || 0} decimals={2} suffix="%" />
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Forecast Cap (12M)</div>
                      <div className="text-xl font-black text-[#D4AF37] mt-1">
                        <CountUpNumber value={Number(fcResult.forecastCap12M) || 0} decimals={2} suffix="%" />
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Forecast Cap (3Y)</div>
                      <div className="text-xl font-black text-emerald-400 mt-1">
                        <CountUpNumber value={Number(fcResult.forecastCap3Y) || 0} decimals={2} suffix="%" />
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Forecast Cap (5Y)</div>
                      <div className="text-xl font-black text-cyan-400 mt-1">
                        <CountUpNumber value={Number(fcResult.forecastCap5Y) || 0} decimals={2} suffix="%" />
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Rent Growth (12M / {fcResult.period})</div>
                      <div className="text-lg font-black text-emerald-300 mt-1">
                        +<CountUpNumber value={Number(fcResult.rentGrowth12M) || 0} decimals={1} suffix="%" />{' '}
                        <span className="text-xs text-zinc-400">(+{fcResult.rentGrowthSelected}%)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Price Growth (12M / {fcResult.period})</div>
                      <div className="text-lg font-black text-purple-300 mt-1">
                        +<CountUpNumber value={Number(fcResult.priceGrowth12M) || 0} decimals={1} suffix="%" />{' '}
                        <span className="text-xs text-zinc-400">(+{fcResult.priceGrowthSelected}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Existing Forecast Curve Chart: Now -> 12M -> 3Y -> 5Y (Preserved) */}
                  {Array.isArray(fcResult.series) && fcResult.series.length >= 2 && (() => {
                    const pts = fcResult.series;
                    const W = 680;
                    const H = 220;
                    const padL = 44;
                    const padR = 24;
                    const padT = 20;
                    const padB = 34;
                    const plotW = W - padL - padR;
                    const plotH = H - padT - padB;
                    const capVals = pts.map((p) => p.capRate);
                    const minCap = Math.max(0, Math.floor((Math.min(...capVals) - 0.8) * 10) / 10);
                    const maxCap = Math.ceil((Math.max(...capVals) + 0.8) * 10) / 10;
                    const spanCap = Math.max(0.5, maxCap - minCap);
                    const minIdx = 100;
                    const maxIdx = Math.max(115, ...pts.map((p) => Math.max(p.priceIndex, p.rentIndex)) ) + 3;
                    const spanIdx = Math.max(10, maxIdx - minIdx);

                    const xAt = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * plotW;
                    const yCap = (v: number) => padT + plotH - ((v - minCap) / spanCap) * plotH;
                    const yIdx = (v: number) => padT + plotH - ((v - minIdx) / spanIdx) * plotH;

                    const capPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yCap(p.capRate).toFixed(1)}`).join(' ');
                    const pricePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yIdx(p.priceIndex).toFixed(1)}`).join(' ');
                    const rentPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yIdx(p.rentIndex).toFixed(1)}`).join(' ');

                    return (
                      <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                          <span className="font-bold text-white uppercase">
                            Projected Trajectory (Now &rarr; 12M &rarr; 3Y &rarr; 5Y)
                          </span>
                          <div className="flex flex-wrap items-center gap-4 text-[11px]">
                            <span className="flex items-center gap-1.5 text-[#D4AF37]">
                              <span className="w-3 h-0.5 bg-[#D4AF37] inline-block" /> Cap Rate (%)
                            </span>
                            <span className="flex items-center gap-1.5 text-purple-300">
                              <span className="w-3 h-0.5 bg-purple-400 inline-block" /> Price Index (100=Now)
                            </span>
                            <span className="flex items-center gap-1.5 text-emerald-300">
                              <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Rent Index (100=Now)
                            </span>
                          </div>
                        </div>

                        <div className="w-full overflow-x-auto">
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[680px] h-auto mx-auto font-mono">
                            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                              const y = padT + plotH * t;
                              return (
                                <line
                                  key={t}
                                  x1={padL}
                                  y1={y}
                                  x2={W - padR}
                                  y2={y}
                                  stroke="rgba(255,255,255,0.08)"
                                  strokeDasharray="3 3"
                                />
                              );
                            })}
                            <path d={pricePath} fill="none" stroke="#c084fc" strokeWidth="2.5" />
                            <path d={rentPath} fill="none" stroke="#34d399" strokeWidth="2.5" />
                            <path d={capPath} fill="none" stroke="#D4AF37" strokeWidth="3" />
                            {pts.map((p, i) => {
                              const x = xAt(i);
                              const yc = yCap(p.capRate);
                              const yp = yIdx(p.priceIndex);
                              const yr = yIdx(p.rentIndex);
                              return (
                                <g key={p.label}>
                                  <circle cx={x} cy={yp} r="3.5" fill="#c084fc" />
                                  <circle cx={x} cy={yr} r="3.5" fill="#34d399" />
                                  <circle cx={x} cy={yc} r="4.5" fill="#D4AF37" stroke="#000" strokeWidth="1.5" />
                                  <text x={x} y={yc - 10} textAnchor="middle" fill="#D4AF37" fontSize="10" fontWeight="bold">
                                    {p.capRate}%
                                  </text>
                                  <text x={x} y={H - 10} textAnchor="middle" fill="#a1a1aa" fontSize="11" fontWeight="bold">
                                    {p.label}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Feature 2 Recharts Companion: Cross-Market Yield & Growth Benchmark */}
                  <MarketComparisonChart
                    title={`${fcResult.city} Forecast vs Global Market Benchmarks`}
                    subtitle="Cap Rate (%) vs Annual Rent Growth (%)"
                    secondarySeriesName="Rent Growth YoY (%)"
                    items={[
                      {
                        name: `${fcResult.city} (5Y)`,
                        capRate: Number(fcResult.forecastCap5Y) || fcResult.currentAvgCapRate,
                        secondaryMetric: Number(fcResult.rentGrowth12M) || 0,
                      },
                      ...CROSS_BORDER_DATA.filter(
                        (r) => r.city.toLowerCase() !== fcResult.city.toLowerCase()
                      )
                        .slice(0, 5)
                        .map((r) => ({
                          name: r.city,
                          capRate: r.avgGrossYield,
                          secondaryMetric: r.rentalGrowthYoY,
                        })),
                    ]}
                  />

                  {/* Actions & Disclaimer */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isSavingForecast || isAccountLocked}
                      onClick={handleSaveForecast}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BookmarkCheck className="w-4 h-4" />
                      <span>{isSavingForecast ? 'Saving...' : `Save to Portfolio (${savedAnalyses.length}/${maxSaved})`}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isAccountLocked}
                      onClick={handleExportForecastPdf}
                      className="px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500 hover:text-black border border-purple-500/40 text-purple-200 font-mono font-bold text-xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(!canPdfExport || isAccountLocked) ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Export PDF</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200">
                    {fcResult.disclaimer ||
                      `Forecast based on market averages for ${fcResult.city} - Not financial advice, verify with local agent`}
                  </div>
                </FadeInCard>
              )}
            </div>
          )}

          {/* TAB 1D: AI DUE DILIGENCE (PROFESSIONAL / SOVEREIGN ONLY) */}
          {activeTab === 'duediligence' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>AI DUE DILIGENCE • PROFESSIONAL / SOVEREIGN</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    AI Due Diligence
                  </h2>
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  Credits Remaining: <strong className="text-[#D4AF37]">{isAccountLocked ? '0 analyses left' : analysesLeftStr}</strong>
                </div>
              </div>

              {!canDueDiligence && (
                <div className="p-5 rounded-2xl bg-amber-950/35 border border-[#D4AF37]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-mono font-bold text-[#D4AF37]">
                        {isAccountLocked
                          ? lockBannerMessage
                          : 'AI Due Diligence available in PROFESSIONAL / SOVEREIGN - Upgrade'}
                      </div>
                      <div className="text-xs font-mono text-zinc-300">
                        {isAccountLocked
                          ? 'Upgrade or renew your subscription to unlock automated Legal, Financial, and Market risk audits.'
                          : 'FREE and STARTER accounts cannot run Due Diligence. Upgrade to audit title, cap rate spreads, and building age risks.'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenRenewal}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-xs font-mono uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    {isAccountLocked ? 'Upgrade / Renew' : 'Upgrade Plan'}
                  </button>
                </div>
              )}

              {/* Due Diligence Inputs */}
              <div className={`glass-panel p-6 space-y-5 ${!canDueDiligence ? 'opacity-65' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Target City */}
                  <div className="space-y-1.5 relative">
                    <label htmlFor="dd-city" className="text-xs font-mono text-zinc-300 block">
                      Target City ({CITIES.length}+ Markets)
                    </label>
                    <input
                      id="dd-city"
                      type="text"
                      disabled={!canDueDiligence}
                      lang="en"
                      dir="ltr"
                      autoComplete="off"
                      value={ddCityComboInput}
                      onFocus={() => canDueDiligence && setDdCityOpen(true)}
                      onBlur={() => setTimeout(() => setDdCityOpen(false), 180)}
                      onChange={(e) => {
                        setDdCityComboInput(e.target.value);
                        setDdCityOpen(true);
                      }}
                      placeholder="Type city... e.g. Muscat"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    />
                    {ddCityOpen && canDueDiligence && (
                      <div className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-zinc-950 border border-[#D4AF37]/40 shadow-2xl">
                        {ddCityOptions.length === 0 ? (
                          <div className="px-3 py-2 text-xs font-mono text-zinc-400">
                            City not supported yet. Try another spelling.
                          </div>
                        ) : (
                          ddCityOptions.map((c) => (
                            <button
                              key={`dd-${c.city}-${c.countryCode}`}
                              type="button"
                              onMouseDown={() => {
                                setDdCityComboInput(formatCityOptionLabel(c));
                                setDdCityOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-200 hover:bg-[#D4AF37] hover:text-black transition cursor-pointer flex items-center justify-between"
                            >
                              <span>{formatCityOptionLabel(c)}</span>
                              <span className="text-[10px] opacity-75">Avg {c.avgCapRate}%</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Property Type */}
                  <div className="space-y-1.5">
                    <label htmlFor="dd-prop-type" className="text-xs font-mono text-zinc-300 block">
                      Property Type
                    </label>
                    <select
                      id="dd-prop-type"
                      disabled={!canDueDiligence}
                      value={ddPropType}
                      onChange={(e) => setDdPropType(e.target.value as 'Apartment' | 'Villa' | 'Commercial')}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>

                  {/* Ownership Type */}
                  <div className="space-y-1.5">
                    <label htmlFor="dd-ownership" className="text-xs font-mono text-zinc-300 block">
                      Ownership Type
                    </label>
                    <select
                      id="dd-ownership"
                      disabled={!canDueDiligence}
                      value={ddOwnershipType}
                      onChange={(e) => setDdOwnershipType(e.target.value as 'Freehold' | 'Leasehold')}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    >
                      <option value="Freehold">Freehold</option>
                      <option value="Leasehold">Leasehold</option>
                    </select>
                  </div>

                  {/* Property Price ($) */}
                  <div className="space-y-1.5">
                    <label htmlFor="dd-price" className="text-xs font-mono text-zinc-300 block">
                      Property Price ($)
                    </label>
                    <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                      <span className="text-xs font-mono text-zinc-400 mr-1.5">$</span>
                      <input
                        id="dd-price"
                        type="text"
                        disabled={!canDueDiligence}
                        lang="en"
                        dir="ltr"
                        inputMode="decimal"
                        autoComplete="off"
                        style={EN_INPUT_STYLE}
                        value={ddPriceDraft}
                        onChange={(e) => {
                          const clean = sanitizeEnglishDecimal(e.target.value, false);
                          setDdPriceDraft(clean);
                          setDdPriceUSD(Math.max(0, parseEnglishNumber(clean, 0)));
                        }}
                        onBlur={() => setDdPriceDraft(String(ddPriceUSD || 0))}
                        className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {formatUsdInputDisplay(ddPriceUSD)}
                    </div>
                  </div>

                  {/* Gross Monthly Rent ($/mo) */}
                  <div className="space-y-1.5">
                    <label htmlFor="dd-rent" className="text-xs font-mono text-zinc-300 block">
                      Gross Monthly Rent ($/mo)
                    </label>
                    <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                      <span className="text-xs font-mono text-zinc-400 mr-1.5">$</span>
                      <input
                        id="dd-rent"
                        type="text"
                        disabled={!canDueDiligence}
                        lang="en"
                        dir="ltr"
                        inputMode="decimal"
                        autoComplete="off"
                        style={EN_INPUT_STYLE}
                        value={ddRentDraft}
                        onChange={(e) => {
                          const clean = sanitizeEnglishDecimal(e.target.value, false);
                          setDdRentDraft(clean);
                          setDdRentUSD(Math.max(0, parseEnglishNumber(clean, 0)));
                        }}
                        onBlur={() => setDdRentDraft(String(ddRentUSD || 0))}
                        className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {formatUsdInputDisplay(ddRentUSD)} / mo
                    </div>
                  </div>

                  {/* Building Age (years) */}
                  <div className="space-y-1.5">
                    <label htmlFor="dd-age" className="text-xs font-mono text-zinc-300 block">
                      Building Age (years)
                    </label>
                    <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                      <input
                        id="dd-age"
                        type="text"
                        disabled={!canDueDiligence}
                        lang="en"
                        dir="ltr"
                        inputMode="numeric"
                        autoComplete="off"
                        style={EN_INPUT_STYLE}
                        value={ddAgeDraft}
                        onChange={(e) => {
                          const clean = sanitizeEnglishDecimal(e.target.value, false);
                          setDdAgeDraft(clean);
                          setDdBuildingAge(Math.max(0, Math.min(200, Math.round(parseEnglishNumber(clean, 0)))));
                        }}
                        onBlur={() => setDdAgeDraft(String(ddBuildingAge))}
                        className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-mono text-zinc-400">yrs</span>
                    </div>
                  </div>
                </div>

                {ddError && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
                    {ddError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <motion.button
                    type="button"
                    whileHover={
                      !canDueDiligence || isRunningDd || isAccountLocked || !isCreditsLoaded
                        ? undefined
                        : { scale: 1.02 }
                    }
                    whileTap={
                      !canDueDiligence || isRunningDd || isAccountLocked || !isCreditsLoaded
                        ? undefined
                        : { scale: 0.99 }
                    }
                    transition={{ duration: 0.15 }}
                    disabled={!canDueDiligence || isRunningDd || isAccountLocked || !isCreditsLoaded}
                    onClick={handleRunDueDiligence}
                    className={`px-6 py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition min-h-[46px] ${
                      !canDueDiligence || isAccountLocked || !isCreditsLoaded
                        ? 'bg-zinc-800 text-zinc-500 border border-white/10 cursor-not-allowed'
                        : 'bg-[#D4AF37] hover:bg-[#F3E5AB] text-black cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                    }`}
                  >
                    {isAccountLocked ? (
                      <>
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>{lockReasonKind === 'expired' ? 'Plan Expired - Renew' : 'No analyses left'}</span>
                      </>
                    ) : !canDueDiligence ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Run Due Diligence (-1 CREDIT)</span>
                      </>
                    ) : isRunningDd ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Auditing Risks...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Run Due Diligence (-1 CREDIT)</span>
                      </>
                    )}
                  </motion.button>

                  <span className="text-[11px] font-mono text-zinc-400">
                    Audits Legal Tenure, Transfer Tax, Cap Rate Spread, Rent Comp, Building Age &amp; Market Risk
                  </span>
                </div>
              </div>

              {/* Due Diligence Output + Feature 2 Risk Scenario Audit Rechart */}
              {ddResult && (
                <FadeInCard className="glass-panel p-6 space-y-6 border border-[#D4AF37]/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                    <div>
                      <div className="text-[11px] font-mono text-emerald-400 mb-0.5">
                        Last Result - {formatLastResultTimestamp(ddCreatedAt || ddResult.generatedAt)} - {ddResult.city}
                      </div>
                      <div className="text-[11px] font-mono text-[#D4AF37] uppercase tracking-wider">
                        {ddResult.city}, {ddResult.country} • {ddResult.propertyType} • {ddResult.ownershipType} • {ddResult.buildingAge} yrs
                      </div>
                      <h3 className="text-xl font-bold text-white mt-0.5">
                        Risk Score &amp; Institutional Checklist
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span
                        className={`px-3 py-1.5 rounded-lg font-black border ${
                          ddResult.riskScore >= 75
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : ddResult.riskScore >= 50
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-rose-500/20 border-rose-400 text-rose-300'
                        }`}
                      >
                        Risk Score: <CountUpNumber value={Number(ddResult.riskScore) || 0} suffix="/100" />
                      </span>
                      <span
                        className={`px-3 py-1.5 rounded-lg font-bold border ${
                          ddResult.verdict.startsWith('Low Risk')
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : ddResult.verdict.startsWith('Medium Risk')
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]'
                            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {ddResult.verdict}
                      </span>
                      <button
                        type="button"
                        disabled={isClearingTool === 'due_diligence'}
                        onClick={() => handleClearLastResult('due_diligence')}
                        className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-rose-500/20 hover:border-rose-500/40 text-xs font-mono text-zinc-300 hover:text-rose-200 cursor-pointer transition"
                      >
                        {isClearingTool === 'due_diligence' ? 'Clearing...' : 'Clear Last Result'}
                      </button>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Property Cap Rate</div>
                      <div className="text-xl font-black text-white mt-1">
                        <CountUpNumber value={Number(ddResult.propertyCapRate) || 0} decimals={2} suffix="%" />
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">{ddResult.city} Avg Cap Rate</div>
                      <div className="text-xl font-black text-[#D4AF37] mt-1">
                        <CountUpNumber value={Number(ddResult.cityAvgCapRate) || 0} decimals={2} suffix="%" />
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Rent vs Market Est.</div>
                      <div className="text-base font-black text-emerald-300 mt-1">
                        ${ddResult.monthlyRent.toLocaleString('en-US')} <span className="text-xs text-zinc-400">/ ${ddResult.marketAvgRent.toLocaleString('en-US')}</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">OPEX / Vacancy / Growth</div>
                      <div className="text-base font-black text-cyan-300 mt-1">
                        {ddResult.estimatedOpexPct}% / {ddResult.estVacancyPct}% / +{ddResult.estPriceGrowthPct}%
                      </div>
                    </div>
                  </div>

                  {/* Recharts Risk Resilience Chart */}
                  <RiskScenarioChart
                    mode="risk-audit"
                    auditItems={ddResult.checklist}
                    overallRiskScore={ddResult.riskScore}
                  />

                  {/* Checklist Table */}
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Category</TableHead>
                        <TableHead>Audit Item</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assessment Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ddResult.checklist.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-bold text-[#D4AF37] whitespace-nowrap">
                            {row.category}
                          </TableCell>
                          <TableCell className="text-white font-semibold whitespace-nowrap">
                            {row.item}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                                row.status === 'Pass'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : row.status === 'Warning'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {row.status === 'Pass' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : row.status === 'Warning' ? (
                                <AlertTriangle className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              <span>{row.status}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-zinc-300 leading-relaxed">{row.note}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Save + Export PDF */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isSavingDd || isAccountLocked}
                      onClick={handleSaveDueDiligence}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BookmarkCheck className="w-4 h-4" />
                      <span>{isSavingDd ? 'Saving...' : `Save to Portfolio (${savedAnalyses.length}/${maxSaved})`}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isAccountLocked}
                      onClick={handleExportDueDiligencePdf}
                      className="px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500 hover:text-black border border-purple-500/40 text-purple-200 font-mono font-bold text-xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(!canPdfExport || isAccountLocked) ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Export PDF</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200">
                    {ddResult.disclaimer}
                  </div>
                </FadeInCard>
              )}
            </div>
          )}

          {/* TAB 1E: GLOBAL PORTFOLIO OPTIMIZER (SOVEREIGN ONLY) */}
          {activeTab === 'optimizer' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-xs font-mono text-purple-300 mb-2">
                    <PieChart className="w-3.5 h-3.5" />
                    <span>GLOBAL PORTFOLIO OPTIMIZER • SOVEREIGN ONLY</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Global Portfolio Optimizer
                  </h2>
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  Credits Remaining: <strong className="text-[#D4AF37]">{isAccountLocked ? '0 analyses left' : analysesLeftStr}</strong>
                </div>
              </div>

              {!canPortfolioOptimizer && (
                <div className="p-5 rounded-2xl bg-amber-950/35 border border-[#D4AF37]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-mono font-bold text-[#D4AF37]">
                        {isAccountLocked
                          ? lockBannerMessage
                          : 'Global Portfolio Optimizer available in SOVEREIGN only - Upgrade to SOVEREIGN'}
                      </div>
                      <div className="text-xs font-mono text-zinc-300">
                        {isAccountLocked
                          ? 'Renew or upgrade your SOVEREIGN plan to allocate capital across global markets.'
                          : 'Multi-city capital allocation optimization is exclusively available on the SOVEREIGN institutional tier.'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenRenewal}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-xs font-mono uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    {isAccountLocked ? 'Upgrade / Renew' : 'Upgrade to SOVEREIGN'}
                  </button>
                </div>
              )}

              {/* Optimizer Inputs */}
              <div className={`glass-panel p-6 space-y-5 ${!canPortfolioOptimizer ? 'opacity-65' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Total Capital ($) */}
                  <div className="space-y-1.5">
                    <label htmlFor="opt-capital" className="text-xs font-mono text-zinc-300 block">
                      Total Capital ($)
                    </label>
                    <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                      <span className="text-xs font-mono text-zinc-400 mr-1.5">$</span>
                      <input
                        id="opt-capital"
                        type="text"
                        disabled={!canPortfolioOptimizer}
                        lang="en"
                        dir="ltr"
                        inputMode="decimal"
                        autoComplete="off"
                        style={EN_INPUT_STYLE}
                        value={optCapitalDraft}
                        onChange={(e) => {
                          const clean = sanitizeEnglishDecimal(e.target.value, false);
                          setOptCapitalDraft(clean);
                          setOptCapitalUSD(Math.max(0, parseEnglishNumber(clean, 0)));
                        }}
                        onBlur={() => setOptCapitalDraft(String(optCapitalUSD || 0))}
                        className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {formatUsdInputDisplay(optCapitalUSD)}
                    </div>
                  </div>

                  {/* Risk Profile */}
                  <div className="space-y-1.5">
                    <label htmlFor="opt-risk" className="text-xs font-mono text-zinc-300 block">
                      Risk Tolerance
                    </label>
                    <select
                      id="opt-risk"
                      disabled={!canPortfolioOptimizer}
                      value={optRisk}
                      onChange={(e) => setOptRisk(e.target.value as 'Low' | 'Medium' | 'High')}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    >
                      <option value="Low">Low (Core Preservation)</option>
                      <option value="Medium">Medium (Balanced Yield &amp; Stability)</option>
                      <option value="High">High (Maximum Yield Tilt)</option>
                    </select>
                  </div>

                  {/* Target Cities (2-3 multi-select) */}
                  <div className="space-y-1.5 relative">
                    <label htmlFor="opt-city-search" className="text-xs font-mono text-zinc-300 block">
                      Target Cities (2-3 from {CITIES.length}+ Markets)
                    </label>
                    <input
                      id="opt-city-search"
                      type="text"
                      disabled={!canPortfolioOptimizer || optSelectedCities.length >= 3}
                      lang="en"
                      dir="ltr"
                      autoComplete="off"
                      value={optCityComboInput}
                      onFocus={() => canPortfolioOptimizer && setOptCityOpen(true)}
                      onBlur={() => setTimeout(() => setOptCityOpen(false), 180)}
                      onChange={(e) => {
                        setOptCityComboInput(e.target.value);
                        setOptCityOpen(true);
                      }}
                      placeholder={
                        optSelectedCities.length >= 3
                          ? '3/3 cities selected'
                          : 'Add city... e.g. London, Singapore'
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    />
                    {optCityOpen && canPortfolioOptimizer && optSelectedCities.length < 3 && (
                      <div className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-zinc-950 border border-[#D4AF37]/40 shadow-2xl">
                        {optCityOptions.length === 0 ? (
                          <div className="px-3 py-2 text-xs font-mono text-zinc-400">
                            City not supported yet. Try another spelling.
                          </div>
                        ) : (
                          optCityOptions.map((c) => {
                            const already = optSelectedCities.some(
                              (sc) => sc.toLowerCase() === c.city.toLowerCase()
                            );
                            return (
                              <button
                                key={`opt-${c.city}-${c.countryCode}`}
                                type="button"
                                disabled={already}
                                onMouseDown={() => handleAddOptimizerCity(c)}
                                className={`w-full text-left px-3 py-2 text-xs font-mono transition flex items-center justify-between ${
                                  already
                                    ? 'text-zinc-500 bg-white/[0.02] cursor-default'
                                    : 'text-zinc-200 hover:bg-[#D4AF37] hover:text-black cursor-pointer'
                                }`}
                              >
                                <span>{formatCityOptionLabel(c)}</span>
                                <span className="text-[10px] opacity-75">
                                  {already ? 'Selected' : `Avg ${c.avgCapRate}%`}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {optSelectedCities.map((cName) => (
                        <span
                          key={cName}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-xs font-mono text-[#D4AF37]"
                        >
                          <span>{cName}</span>
                          {canPortfolioOptimizer && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOptimizerCity(cName)}
                              className="hover:text-white cursor-pointer"
                              aria-label={`Remove ${cName}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                      <span className="text-[10px] font-mono text-zinc-500">
                        ({optSelectedCities.length}/3 cities selected • min 2)
                      </span>
                    </div>
                  </div>
                </div>

                {optError && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
                    {optError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    disabled={!canPortfolioOptimizer || isRunningOpt || isAccountLocked || !isCreditsLoaded}
                    onClick={handleOptimizePortfolio}
                    className={`px-6 py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition min-h-[46px] ${
                      !canPortfolioOptimizer || isAccountLocked || !isCreditsLoaded
                        ? 'bg-zinc-800 text-zinc-500 border border-white/10 cursor-not-allowed'
                        : 'bg-[#D4AF37] hover:bg-[#F3E5AB] text-black cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                    }`}
                  >
                    {isAccountLocked ? (
                      <>
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>{lockReasonKind === 'expired' ? 'Plan Expired - Renew' : 'No analyses left'}</span>
                      </>
                    ) : !canPortfolioOptimizer ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Optimize Portfolio (-1 CREDIT)</span>
                      </>
                    ) : isRunningOpt ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Optimizing Allocation...</span>
                      </>
                    ) : (
                      <>
                        <PieChart className="w-4 h-4" />
                        <span>Optimize Portfolio (-1 CREDIT)</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] font-mono text-zinc-400">
                    Computes optimal 100% cross-border capital weights, blended yield &amp; diversification score
                  </span>
                </div>
              </div>

              {/* Optimizer Output */}
              {optResult && (
                <div className="glass-panel p-6 space-y-6 border border-[#D4AF37]/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                    <div>
                      <div className="text-[11px] font-mono text-emerald-400 mb-0.5">
                        Last Result - {formatLastResultTimestamp(optCreatedAt || optResult.generatedAt)} - {optResult.cities.join(' + ')}
                      </div>
                      <h3 className="text-xl font-bold text-white">
                        Optimal Cross-Border Capital Allocation ({optResult.risk} Risk)
                      </h3>
                    </div>
                    <button
                      type="button"
                      disabled={isClearingTool === 'portfolio_optimizer'}
                      onClick={() => handleClearLastResult('portfolio_optimizer')}
                      className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-rose-500/20 hover:border-rose-500/40 text-xs font-mono text-zinc-300 hover:text-rose-200 cursor-pointer transition self-start sm:self-auto"
                    >
                      {isClearingTool === 'portfolio_optimizer' ? 'Clearing...' : 'Clear Last Result'}
                    </button>
                  </div>

                  {/* Summary KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono tabular-nums">
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Total Capital Allocated</div>
                      <div className="text-xl font-black text-white mt-1">
                        {formatPrice(optResult.totalCapital, 'USD')}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Total Est. Annual Income</div>
                      <div className="text-xl font-black text-emerald-400 mt-1">
                        {formatPrice(optResult.totalEstAnnualIncomeUSD, 'USD')}/yr
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Blended Cap Rate</div>
                      <div className="text-xl font-black text-[#D4AF37] mt-1">
                        {optResult.blendedCapRate}%
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Diversification Score</div>
                      <div className="text-xl font-black text-purple-300 mt-1">
                        {optResult.diversificationScore}/100
                      </div>
                    </div>
                  </div>

                  {/* Pie Chart + Allocation Table */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-black/50 border border-white/10">
                      {(() => {
                        const colors = ['#D4AF37', '#34d399', '#a855f7'];
                        let cumulativePct = 0;
                        const R = 64;
                        const C = 2 * Math.PI * R;
                        return (
                          <>
                            <svg viewBox="0 0 180 180" className="w-44 h-44 -rotate-90">
                              {optResult.allocations.map((row, idx) => {
                                const segLen = (row.allocationPct / 100) * C;
                                const offset = -((cumulativePct / 100) * C);
                                cumulativePct += row.allocationPct;
                                return (
                                  <circle
                                    key={row.city}
                                    cx="90"
                                    cy="90"
                                    r={R}
                                    fill="transparent"
                                    stroke={colors[idx % colors.length]}
                                    strokeWidth="28"
                                    strokeDasharray={`${segLen} ${C}`}
                                    strokeDashoffset={offset}
                                  />
                                );
                              })}
                            </svg>
                            <div className="w-full space-y-1.5 mt-3 font-mono text-xs">
                              {optResult.allocations.map((row, idx) => (
                                <div key={row.city} className="flex items-center justify-between">
                                  <span className="flex items-center gap-2 text-zinc-300">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full inline-block"
                                      style={{ backgroundColor: colors[idx % colors.length] }}
                                    />
                                    <span>{row.city}</span>
                                  </span>
                                  <span className="font-bold text-white">{row.allocationPct}%</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="lg:col-span-8 overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono text-xs tabular-nums">
                        <thead>
                          <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px]">
                            <th className="py-3 pr-3">City</th>
                            <th className="py-3 pr-3">Allocation (%)</th>
                            <th className="py-3 pr-3">Amount ($)</th>
                            <th className="py-3 pr-3">Est. Cap Rate (%)</th>
                            <th className="py-3 text-right">Est. Annual Rent ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {optResult.allocations.map((row) => (
                            <tr key={row.city} className="hover:bg-white/[0.03]">
                              <td className="py-3.5 pr-3">
                                <div className="font-bold text-white">{row.city}</div>
                                <div className="text-[10px] text-zinc-500">{row.country}</div>
                              </td>
                              <td className="py-3.5 pr-3 text-[#D4AF37] font-bold">{row.allocationPct}%</td>
                              <td className="py-3.5 pr-3 text-white font-semibold">
                                {formatPrice(row.amountUSD, 'USD')}
                              </td>
                              <td className="py-3.5 pr-3 text-cyan-300">{row.estCapRate}%</td>
                              <td className="py-3.5 text-right text-emerald-400 font-bold">
                                {formatPrice(row.estAnnualRentUSD, 'USD')}/yr
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Save + Export PDF */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isSavingOpt || isAccountLocked}
                      onClick={handleSaveOptimizer}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BookmarkCheck className="w-4 h-4" />
                      <span>{isSavingOpt ? 'Saving...' : `Save (${savedAnalyses.length}/${maxSaved})`}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isAccountLocked}
                      onClick={handleExportOptimizerPdf}
                      className="px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500 hover:text-black border border-purple-500/40 text-purple-200 font-mono font-bold text-xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(!canPdfExport || isAccountLocked) ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Export PDF</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200">
                    {optResult.disclaimer}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1F: INSTITUTIONAL AI ADVISOR (SOVEREIGN ONLY) */}
          {activeTab === 'advisor' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-xs font-mono text-purple-300 mb-2">
                    <Bot className="w-3.5 h-3.5" />
                    <span>INSTITUTIONAL AI ADVISOR • SOVEREIGN ONLY</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Institutional AI Advisor
                  </h2>
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  Credits Remaining: <strong className="text-[#D4AF37]">{isAccountLocked ? '0 analyses left' : analysesLeftStr}</strong>
                </div>
              </div>

              {!canInstitutionalAdvisor && (
                <div className="p-5 rounded-2xl bg-amber-950/35 border border-[#D4AF37]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-mono font-bold text-[#D4AF37]">
                        {isAccountLocked
                          ? lockBannerMessage
                          : 'Institutional AI Advisor available in SOVEREIGN only - Upgrade to SOVEREIGN'}
                      </div>
                      <div className="text-xs font-mono text-zinc-300">
                        {isAccountLocked
                          ? 'Renew or upgrade your SOVEREIGN plan to consult the Institutional AI Advisor.'
                          : 'Bespoke investment memos comparing global cap rates, tax regimes, and capital budgets are exclusive to SOVEREIGN.'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenRenewal}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-xs font-mono uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    {isAccountLocked ? 'Upgrade / Renew' : 'Upgrade to SOVEREIGN'}
                  </button>
                </div>
              )}

              {/* Advisor Inputs */}
              <div className={`glass-panel p-6 space-y-5 ${!canInstitutionalAdvisor ? 'opacity-65' : ''}`}>
                <div className="space-y-1.5">
                  <label htmlFor="adv-question" className="text-xs font-mono text-zinc-300 block">
                    Investment Question
                  </label>
                  <textarea
                    id="adv-question"
                    rows={3}
                    disabled={!canInstitutionalAdvisor}
                    lang="en"
                    dir="ltr"
                    value={advQuestion}
                    onChange={(e) => setAdvQuestion(e.target.value)}
                    placeholder="e.g. Should I invest $1M in Muscat or Dubai?"
                    className="w-full p-3.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Target City */}
                  <div className="space-y-1.5 relative">
                    <label htmlFor="adv-city" className="text-xs font-mono text-zinc-300 block">
                      Primary Target City ({CITIES.length}+ Markets)
                    </label>
                    <input
                      id="adv-city"
                      type="text"
                      disabled={!canInstitutionalAdvisor}
                      lang="en"
                      dir="ltr"
                      autoComplete="off"
                      value={advCityComboInput}
                      onFocus={() => canInstitutionalAdvisor && setAdvCityOpen(true)}
                      onBlur={() => setTimeout(() => setAdvCityOpen(false), 180)}
                      onChange={(e) => {
                        setAdvCityComboInput(e.target.value);
                        setAdvCityOpen(true);
                      }}
                      placeholder="Type city... e.g. Muscat"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                    />
                    {advCityOpen && canInstitutionalAdvisor && (
                      <div className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-zinc-950 border border-[#D4AF37]/40 shadow-2xl">
                        {advCityOptions.length === 0 ? (
                          <div className="px-3 py-2 text-xs font-mono text-zinc-400">
                            City not supported yet. Try another spelling.
                          </div>
                        ) : (
                          advCityOptions.map((c) => (
                            <button
                              key={`adv-${c.city}-${c.countryCode}`}
                              type="button"
                              onMouseDown={() => {
                                setAdvCityComboInput(formatCityOptionLabel(c));
                                setAdvCityOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-200 hover:bg-[#D4AF37] hover:text-black transition cursor-pointer flex items-center justify-between"
                            >
                              <span>{formatCityOptionLabel(c)}</span>
                              <span className="text-[10px] opacity-75">Avg {c.avgCapRate}%</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Budget ($) */}
                  <div className="space-y-1.5">
                    <label htmlFor="adv-budget" className="text-xs font-mono text-zinc-300 block">
                      Capital Budget ($)
                    </label>
                    <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                      <span className="text-xs font-mono text-zinc-400 mr-1.5">$</span>
                      <input
                        id="adv-budget"
                        type="text"
                        disabled={!canInstitutionalAdvisor}
                        lang="en"
                        dir="ltr"
                        inputMode="decimal"
                        autoComplete="off"
                        style={EN_INPUT_STYLE}
                        value={advBudgetDraft}
                        onChange={(e) => {
                          const clean = sanitizeEnglishDecimal(e.target.value, false);
                          setAdvBudgetDraft(clean);
                          setAdvBudgetUSD(Math.max(0, parseEnglishNumber(clean, 0)));
                        }}
                        onBlur={() => setAdvBudgetDraft(String(advBudgetUSD || 0))}
                        className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {formatUsdInputDisplay(advBudgetUSD)}
                    </div>
                  </div>
                </div>

                {advError && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
                    {advError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    disabled={!canInstitutionalAdvisor || isAskingAdvisor || isAccountLocked || !isCreditsLoaded}
                    onClick={handleAskAdvisor}
                    className={`px-6 py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition min-h-[46px] ${
                      !canInstitutionalAdvisor || isAccountLocked || !isCreditsLoaded
                        ? 'bg-zinc-800 text-zinc-500 border border-white/10 cursor-not-allowed'
                        : 'bg-[#D4AF37] hover:bg-[#F3E5AB] text-black cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                    }`}
                  >
                    {isAccountLocked ? (
                      <>
                        <Lock className="w-4 h-4 text-rose-400" />
                        <span>{lockReasonKind === 'expired' ? 'Plan Expired - Renew' : 'No analyses left'}</span>
                      </>
                    ) : !canInstitutionalAdvisor ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Ask Advisor (-1 CREDIT)</span>
                      </>
                    ) : isAskingAdvisor ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Drafting Institutional Memo...</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4" />
                        <span>Ask Advisor (-1 CREDIT)</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] font-mono text-zinc-400">
                    Generates market-grounded Buy/Hold/Wait memo with cap rate spread, risk factors &amp; next steps
                  </span>
                </div>
              </div>

              {/* Advisor Output */}
              {advResult && (
                <div className="glass-panel p-6 space-y-6 border border-[#D4AF37]/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                    <div>
                      <div className="text-[11px] font-mono text-emerald-400 mb-0.5">
                        Last Result - {formatLastResultTimestamp(advCreatedAt || advResult.generatedAt)} - {advResult.city}
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                        {advResult.headline}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-3 py-1.5 rounded-lg font-mono font-black text-xs uppercase border ${
                          advResult.recommendation === 'Buy'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : advResult.recommendation === 'Hold'
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                            : 'bg-rose-500/20 border-rose-400 text-rose-300'
                        }`}
                      >
                        {advResult.recommendation}
                      </span>
                      <button
                        type="button"
                        disabled={isClearingTool === 'advisor'}
                        onClick={() => handleClearLastResult('advisor')}
                        className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-rose-500/20 hover:border-rose-500/40 text-xs font-mono text-zinc-300 hover:text-rose-200 cursor-pointer transition"
                      >
                        {isClearingTool === 'advisor' ? 'Clearing...' : 'Clear Last Result'}
                      </button>
                    </div>
                  </div>

                  {/* Quick Metrics Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono tabular-nums">
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Target City</div>
                      <div className="text-base font-bold text-white mt-1">
                        {advResult.city}, {advResult.country}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Benchmark Cap Rate</div>
                      <div className="text-xl font-black text-[#D4AF37] mt-1">
                        {advResult.cityAvgCapRate}%
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Deployment Budget</div>
                      <div className="text-xl font-black text-white mt-1">
                        {formatPrice(advResult.budget, 'USD')}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="text-[10px] uppercase text-zinc-400">Est. Annual Net Income</div>
                      <div className="text-xl font-black text-emerald-400 mt-1">
                        {formatPrice(advResult.estAnnualIncomeUSD, 'USD')}/yr
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2.5">
                      <div className="text-xs font-bold uppercase text-[#D4AF37]">
                        Reasoning
                      </div>
                      <ul className="space-y-2 text-xs text-zinc-300 leading-relaxed">
                        {advResult.reasoning.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold mt-0.5">&bull;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2.5">
                      <div className="text-xs font-bold uppercase text-amber-300">
                        Risk Factors
                      </div>
                      <ul className="space-y-2 text-xs text-zinc-300 leading-relaxed">
                        {advResult.riskFactors.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-400 font-bold mt-0.5">&bull;</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2.5">
                      <div className="text-xs font-bold uppercase text-cyan-300">
                        Recommended Next Steps
                      </div>
                      <ul className="space-y-2 text-xs text-zinc-300 leading-relaxed">
                        {advResult.nextSteps.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-cyan-400 font-bold mt-0.5">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Save + Export PDF */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isSavingAdv || isAccountLocked}
                      onClick={handleSaveAdvisor}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BookmarkCheck className="w-4 h-4" />
                      <span>{isSavingAdv ? 'Saving...' : `Save (${savedAnalyses.length}/${maxSaved})`}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isAccountLocked}
                      onClick={handleExportAdvisorPdf}
                      className="px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500 hover:text-black border border-purple-500/40 text-purple-200 font-mono font-bold text-xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(!canPdfExport || isAccountLocked) ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Export PDF</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200">
                    {advResult.disclaimer}
                  </div>
                </div>
              )}
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
                              disabled={isAccountLocked}
                              onClick={() => handleExportPDF(item.property)}
                              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                        setCancelPolicyAck(false);
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

                {/* Collapsible Refund Policy - Read before cancelling */}
                <div className="pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setShowRefundPolicyDrawer((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono font-bold text-[#D4AF37] cursor-pointer transition"
                  >
                    <span>Refund Policy - Read before cancelling</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        showRefundPolicyDrawer ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showRefundPolicyDrawer && (
                    <div className="mt-3 p-4 rounded-xl bg-black/50 border border-white/10 space-y-2.5 text-xs font-mono text-zinc-300 leading-relaxed">
                      <div className="font-bold text-white">
                        AQARI AI - Refund &amp; Cancellation Policy
                      </div>
                      <p>
                        1. 7-Day Cancellation Window: You may cancel within 7 days of activation ONLY if you have completed ZERO (0) successful analyses.
                      </p>
                      <p>
                        2. No Refund After 1 Successful Analysis: If you complete 1 or more successful analyses, your subscription is non-refundable and non-cancellable, even within 7 days.
                      </p>
                      <p>
                        3. No Refund After 7 Days Without Tool Issue: If 7 days have passed since activation and you have not reported a tool issue, you cannot cancel or request a refund, even if you completed 0 analyses.
                      </p>
                      <p>
                        4. Tool Issue Exception: If tool has verified issue and you reported it via Report Tool Issue, and we do NOT resolve it within 7 days of report, AND you completed 0 successful analyses, you may cancel and receive full refund in 5-10 business days. If we resolve within 7 days, standard 7-day window applies.
                      </p>
                      <p>
                        5. How to Cancel: Settings &gt; SUBSCRIPTION &amp; CANCELLATION. If eligible, Cancel button enabled. If not eligible, automatically locked with reason.
                      </p>
                      <p>
                        6. What Happens After Cancellation: Plan reverts to FREE (3 analyses), paid analyses deactivated, refund ($79 / $199 / $599) issued to original payment method via Paddle in 5-10 business days.
                      </p>
                      <p>
                        7. No Partial Refunds for unused days or unused analyses. By purchasing, you agree to this policy.
                      </p>
                      <div className="pt-1">
                        <a
                          href="/refund-policy"
                          onClick={(e) => {
                            e.preventDefault();
                            if (onOpenLegal) {
                              onOpenLegal('refund');
                            } else {
                              window.history.pushState({}, '', '/refund-policy');
                              window.dispatchEvent(new PopStateEvent('popstate'));
                            }
                          }}
                          className="text-[#D4AF37] underline font-bold hover:text-amber-300"
                        >
                          Open public /refund-policy page &rarr;
                        </a>
                      </div>
                    </div>
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
                <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-zinc-400">Official Support Contact (Loomora Studios):</span>
                  <a
                    href="mailto:azzamalshmale@gmail.com"
                    className="text-[#D4AF37] underline font-bold hover:text-amber-300"
                  >
                    azzamalshmale@gmail.com
                  </a>
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
                        https://aqari-ai-rho.vercel.app/api/app?action=paddle-webhook
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('https://aqari-ai-rho.vercel.app/api/app?action=paddle-webhook');
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
                        PAYMENT_WEBHOOK_SECRET present?{' '}
                        <strong className={webhookEnvStatus?.webhookSecretPresent ? 'text-emerald-400' : 'text-rose-400'}>
                          {webhookEnvStatus ? (webhookEnvStatus.webhookSecretPresent ? 'Yes' : 'No') : '...'}
                        </strong>
                      </span>
                      <span className="text-zinc-200">
                        PAYMENT_API_KEY present?{' '}
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
                      'No payment webhook events received yet.'}
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
                      Admin Backup: Manual Payment Order Verification
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={backupOrderId}
                        onChange={(e) => setBackupOrderId(e.target.value)}
                        placeholder="Payment Intent / Order ID (e.g. pi_123456)"
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
                        {isRunningBackupVerify ? 'Checking Payment...' : 'Admin Verify Order'}
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

      {/* Report Tool Issue Modal (Radix Dialog) */}
      <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
        <DialogContent className="border-amber-500/40 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-amber-300">
              <AlertTriangle className="w-4 h-4" />
              <span>Report Tool Issue</span>
            </DialogTitle>
            <DialogDescription className="pt-1">
              Experiencing a bug or calculation failure? Describe the issue below. Reported issues are logged with a timestamp and reviewed by engineering.
            </DialogDescription>
          </DialogHeader>
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsIssueModalOpen(false)}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="solidGold"
                disabled={isSubmittingIssue}
              >
                {isSubmittingIssue ? 'Submitting...' : 'Submit Issue Report'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Cancel Subscription + Refund Modal (Radix Dialog) */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="border-rose-500/40 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Confirm Subscription Cancellation</span>
            </DialogTitle>
            <DialogDescription className="pt-1 text-zinc-200">
              Cancel <strong className="text-[#D4AF37]">{license.displayName}</strong>? Your analyses will be lost,{' '}
              <strong className="text-[#D4AF37]">{license.displayName}</strong> will be deactivated, refund of{' '}
              <strong className="text-emerald-400">
                ${localCancelEligibility.refundableAmountUSD || planPriceUSD}
              </strong>{' '}
              will be issued to original payment method in 5-10 business days. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.04] border border-white/10 cursor-pointer select-none text-xs font-mono text-zinc-200">
            <input
              type="checkbox"
              checked={cancelPolicyAck}
              onChange={(e) => setCancelPolicyAck(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#D4AF37] cursor-pointer shrink-0"
            />
            <span>I have read the Refund Policy above</span>
          </label>
          {cancelModalError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs font-mono text-rose-200">
              {cancelModalError}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Keep Subscription
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isCancellingSub || !cancelPolicyAck}
              onClick={handleCancelSubscription}
              className="w-full sm:w-auto"
            >
              {isCancellingSub ? 'Processing Refund...' : 'Confirm Cancel + Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </TooltipProvider>
  );
};
