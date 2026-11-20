import React, { useState, useEffect } from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import {
  PLANS,
  PricingPublicPayload,
  PlanKey,
  DEFAULT_LAUNCH_BADGE,
  EXTRA_CREDIT_PACKS,
  CREDIT_COSTS,
  findPlanPricing,
} from '../../lib/plans';
import { formatPrice } from '../utils/formatters';
import { openPaddleCheckout, PADDLE_PRO_SUCCESS_MESSAGE } from '../utils/paddleClient';
import {
  Check,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  Building2,
  Crown,
  ArrowRight,
  Loader2,
  AlertCircle,
  CreditCard,
  Lock,
  Clock,
  Flame,
  Coins,
  Briefcase,
  X,
} from 'lucide-react';

interface PricingSectionProps {
  currentCurrency: CurrencyCode;
  config: RemoteConfig;
  pricingData?: PricingPublicPayload | null;
  user: User | null;
  onOpenAuth: () => void;
  onTestUnlock?: (plan: 'starter' | 'pro' | 'enterprise') => void;
  onGoToTerminal?: () => void;
  onOpenLegal?: (page: 'terms' | 'privacy' | 'refund' | 'disclaimer') => void;
  isStandalonePage?: boolean;
}

interface CachedCheckout {
  url: string;
  timestamp: number;
  pricingVersion: number;
}
const checkoutPrefetchCache: Record<string, CachedCheckout> = {};

export const PricingSection: React.FC<PricingSectionProps> = ({
  currentCurrency,
  pricingData: externalPricing,
  user,
  onOpenAuth,
  onGoToTerminal,
  onOpenLegal,
  isStandalonePage = false,
}) => {
  const [livePricing, setLivePricing] = useState<PricingPublicPayload | null>(externalPricing || null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [refundAccepted, setRefundAccepted] = useState<boolean>(false);
  const [highlightPolicy, setHighlightPolicy] = useState<boolean>(false);

  // Enterprise Contract Inquiry Modal State
  const [showEnterpriseModal, setShowEnterpriseModal] = useState<boolean>(false);
  const [entCompany, setEntCompany] = useState<string>('');
  const [entEmail, setEntEmail] = useState<string>(user?.email || '');
  const [entSeats, setEntSeats] = useState<string>('50');
  const [entAssets, setEntAssets] = useState<string>('1000');
  const [entNotes, setEntNotes] = useState<string>('');
  const [entSubmitting, setEntSubmitting] = useState<boolean>(false);

  // Production credit pack txn input modal state
  const [pendingCreditPack, setPendingCreditPack] = useState<(typeof EXTRA_CREDIT_PACKS)[number] | null>(null);
  const [creditTxnId, setCreditTxnId] = useState<string>('');

  const isTestMode =
    typeof window !== 'undefined' &&
    (import.meta.env.VITE_PAYMENT_TEST_MODE === 'true' ||
      (import.meta.env.VITE_PAYMENT_TEST_MODE as unknown) === true);

  useEffect(() => {
    if (externalPricing) {
      setLivePricing(externalPricing);
    }
  }, [externalPricing]);

  useEffect(() => {
    if (user?.email && !entEmail) {
      setEntEmail(user.email);
    }
  }, [user?.email]);

  const refreshPricing = async () => {
    try {
      const res = await fetch(`/api/app?action=pricing&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data: PricingPublicPayload = await res.json();
        setLivePricing(data);
      }
    } catch {
      // Fall back gracefully if offline
    }
  };

  useEffect(() => {
    refreshPricing();
    const onUpdated = () => refreshPricing();
    const onFocus = () => refreshPricing();
    window.addEventListener('aqari:pricing-updated', onUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('aqari:pricing-updated', onUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 6500);
  };

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 8000);
  };

  const pricingVersion = livePricing?.updatedAt || 0;
  const launchActive = livePricing?.launchDiscountActive ?? true;
  const launchBadgeText = livePricing?.launchBadgeText || DEFAULT_LAUNCH_BADGE;
  const daysRemaining = livePricing?.daysRemaining ?? 7;
  const launchEndsAt = livePricing?.launchEndsAt || Date.now() + 7 * 86_400_000;
  const launchEndDateStr = new Date(launchEndsAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const getPrefetchKey = (plan: 'starter' | 'pro' | 'enterprise') =>
    `${user?.email?.toLowerCase() || 'anon'}:${plan}:${pricingVersion}`;

  const prefetchPlan = async (plan: 'starter' | 'pro' | 'enterprise') => {
    const cacheKey = getPrefetchKey(plan);
    const cached = checkoutPrefetchCache[cacheKey];
    if (
      cached &&
      cached.pricingVersion === pricingVersion &&
      Date.now() - cached.timestamp < 5 * 60 * 1000
    ) {
      return cached.url;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('/api/app?action=checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          email: user?.email || '',
          userId: user?.id || user?.googleId || 'guest',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          checkoutPrefetchCache[cacheKey] = {
            url: data.url,
            timestamp: Date.now(),
            pricingVersion,
          };
          return data.url;
        }
      }
    } catch {
      // Prefetch fails silently
    }
    return null;
  };

  useEffect(() => {
    const plans: Array<'starter' | 'pro' | 'enterprise'> = ['starter', 'pro', 'enterprise'];
    plans.forEach((p) => {
      prefetchPlan(p);
    });
  }, [user?.email, pricingVersion]);

  const handlePayPaddle = async (planId: 'starter' | 'pro' | 'enterprise') => {
    if (!user) {
      onOpenAuth();
      return;
    }

    if (!refundAccepted) {
      setHighlightPolicy(true);
      showError('Please agree to the "7-Day Refund & Issue Policy" checkbox below before checkout.');
      setTimeout(() => setHighlightPolicy(false), 3000);
      return;
    }

    const acceptedAt = new Date().toISOString();
    setLoadingPlan(planId);
    setErrorToast(null);
    setSuccessToast(null);

    try {
      await openPaddleCheckout({
        plan: planId,
        email: user.email,
        userId: user.id || user.googleId,
        refundAcceptedAt: acceptedAt,
        onVerified: (verifyData) => {
          setLoadingPlan(null);
          showSuccess(verifyData?.message || PADDLE_PRO_SUCCESS_MESSAGE);
        },
        onError: (msg) => {
          console.error('[Paddle] Checkout failed in PricingSection:', msg);
          setLoadingPlan(null);
          showError(msg);
        },
        onClose: () => {
          setLoadingPlan(null);
        },
      });
    } catch (err: any) {
      console.error('[Paddle] Checkout exception in PricingSection:', err);
      showError(err?.message || 'Checkout is temporarily unavailable. Please try again.');
      setLoadingPlan(null);
    }
  };

  const handleChoosePlan = async (planId: PlanKey) => {
    if (planId === 'free') {
      if (!user) {
        onOpenAuth();
      } else if (onGoToTerminal) {
        onGoToTerminal();
      } else {
        window.location.hash = '#/terminal';
      }
      return;
    }

    if (planId === 'institutional') {
      setShowEnterpriseModal(true);
      return;
    }

    await handlePayPaddle(planId);
  };

  const handleBuyCreditPack = async (packId: string, transactionId?: string) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setBuyingPackId(packId);
    try {
      const res = await fetch('/api/app?action=buy-credits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId,
          email: user.email,
          transaction_id: transactionId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 && data?.requiresPayment) {
        const packObj = EXTRA_CREDIT_PACKS.find((p) => p.id === packId) || null;
        setPendingCreditPack(packObj);
        setCreditTxnId('');
        return;
      }
      if (!res.ok || !data?.success) {
        showError(data?.error || 'Unable to process credit pack purchase.');
        return;
      }
      setPendingCreditPack(null);
      showSuccess(
        data?.message || `Added extra AI credits. Current balance: ${data.analyses_left} credits.`
      );
      window.dispatchEvent(new CustomEvent('aqari:user-updated', { detail: data }));
    } catch (err: any) {
      showError(err?.message || 'Network error while purchasing credit pack.');
    } finally {
      setBuyingPackId(null);
    }
  };

  const handleSubmitEnterpriseInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entCompany.trim() || !entEmail.trim()) {
      showError('Please enter your company/organization name and business email.');
      return;
    }
    setEntSubmitting(true);
    try {
      const res = await fetch('/api/app?action=enterprise-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: entCompany.trim(),
          email: entEmail.trim(),
          seats: Number(entSeats || 50),
          assetsCount: Number(entAssets || 1000),
          notes: entNotes.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        showError(data?.error || 'Unable to submit enterprise request.');
        return;
      }
      setShowEnterpriseModal(false);
      showSuccess(data?.message || 'Enterprise contract inquiry submitted.');
      setEntNotes('');
    } catch (err: any) {
      showError(err?.message || 'Network error submitting enterprise request.');
    } finally {
      setEntSubmitting(false);
    }
  };

  const getTierData = (key: PlanKey) => {
    const dyn = findPlanPricing(livePricing, key);
    const fallback = PLANS[key];
    const originalPrice = dyn ? dyn.originalPrice : fallback.originalPrice;
    const launchPrice = dyn ? dyn.launchPrice : fallback.launchPrice;
    const activePrice =
      key === 'free'
        ? 0
        : dyn
        ? dyn.activePrice
        : launchActive
        ? fallback.launchPrice
        : fallback.originalPrice;
    const analysesLimit = dyn ? dyn.analysesLimit : fallback.analysesLimit;
    const features = dyn ? dyn.features : fallback.features;
    return { originalPrice, launchPrice, activePrice, analysesLimit, features };
  };

  const free = getTierData('free');
  const starter = getTierData('starter');
  const pro = getTierData('pro');
  const enterprise = getTierData('enterprise');
  const institutional = getTierData('institutional');

  const currentPlanKey: PlanKey | null = user
    ? user.plan === 'starter' ||
      user.plan === 'pro' ||
      user.plan === 'enterprise' ||
      user.plan === 'institutional' ||
      user.plan === 'free'
      ? user.plan
      : 'free'
    : null;
  const hasActivePaidPlan = Boolean(
    user && currentPlanKey && currentPlanKey !== 'free' && user.subscriptionStatus !== 'expired'
  );

  const tiers: Array<{
    id: PlanKey;
    name: string;
    subtitle: string;
    badge?: string;
    originalPrice: number;
    launchPrice: number;
    activePrice: number;
    popular?: boolean;
    highValue?: boolean;
    contractOnly?: boolean;
    analysesLimitText: string;
    icon: React.ReactNode;
    features: string[];
    ctaLabel: string;
  }> = [
    {
      id: 'free',
      name: 'FREE',
      subtitle: 'Exploratory trial underwriting',
      originalPrice: free.originalPrice,
      launchPrice: free.launchPrice,
      activePrice: 0,
      analysesLimitText: `${free.analysesLimit} Analyses / mo`,
      icon: <Building2 className="w-5 h-5 text-zinc-400" />,
      features: free.features,
      ctaLabel: !user
        ? `Start FREE (${free.analysesLimit}/mo)`
        : currentPlanKey === 'free'
        ? 'Current Plan'
        : 'Switch to FREE',
    },
    {
      id: 'starter',
      name: 'STARTER',
      subtitle: 'Individual cross-border investors',
      originalPrice: starter.originalPrice,
      launchPrice: starter.launchPrice,
      activePrice: starter.activePrice,
      analysesLimitText: `${starter.analysesLimit} Analyses / mo`,
      icon: <Building2 className="w-5 h-5 text-zinc-300" />,
      features: starter.features,
      ctaLabel: hasActivePaidPlan
        ? `Switch to STARTER (${formatPrice(starter.activePrice, currentCurrency)})`
        : `Buy STARTER (${formatPrice(starter.activePrice, currentCurrency)})`,
    },
    {
      id: 'pro',
      name: 'PROFESSIONAL',
      subtitle: 'Brokers, syndicators & family offices',
      badge: 'MAIN MARKETING PLAN',
      originalPrice: pro.originalPrice,
      launchPrice: pro.launchPrice,
      activePrice: pro.activePrice,
      popular: true,
      analysesLimitText: `${pro.analysesLimit} Analyses / mo`,
      icon: <Zap className="w-5 h-5 text-[#D4AF37]" />,
      features: pro.features,
      ctaLabel: hasActivePaidPlan
        ? `Switch to PRO (${formatPrice(pro.activePrice, currentCurrency)})`
        : `Subscribe PRO (${formatPrice(pro.activePrice, currentCurrency)})`,
    },
    {
      id: 'enterprise',
      name: 'SOVEREIGN',
      subtitle: 'Funds, REITs & institutional desks',
      badge: 'HIGHEST INSTITUTIONAL VALUE',
      highValue: true,
      originalPrice: enterprise.originalPrice,
      launchPrice: enterprise.launchPrice,
      activePrice: enterprise.activePrice,
      analysesLimitText: `${enterprise.analysesLimit} Analyses / mo`,
      icon: <Crown className="w-5 h-5 text-purple-400" />,
      features: enterprise.features,
      ctaLabel: hasActivePaidPlan
        ? `Switch to SOVEREIGN (${formatPrice(enterprise.activePrice, currentCurrency)})`
        : `Subscribe SOVEREIGN (${formatPrice(enterprise.activePrice, currentCurrency)})`,
    },
    {
      id: 'institutional',
      name: 'ENTERPRISE',
      subtitle: 'Custom SLA & contract pricing',
      badge: 'CONTRACT PRICING',
      contractOnly: true,
      originalPrice: institutional.originalPrice,
      launchPrice: institutional.launchPrice,
      activePrice: institutional.activePrice,
      analysesLimitText: `${institutional.analysesLimit.toLocaleString('en-US')} Analyses / mo`,
      icon: <Briefcase className="w-5 h-5 text-sky-400" />,
      features: institutional.features,
      ctaLabel: `Request Contract (${formatPrice(institutional.activePrice, currentCurrency)}+)`,
    },
  ];

  return (
    <section
      id="pricing"
      className={`py-16 px-4 lg:px-6 max-w-[1440px] mx-auto relative z-10 ${isStandalonePage ? 'pt-24' : ''}`}
    >
      {isTestMode && (
        <div className="mb-6 mx-auto max-w-xl p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold">TEST MODE - No real money - Test card 4242 4242 4242 4242</span>
        </div>
      )}

      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-emerald-950/95 border border-emerald-500 text-white text-xs font-mono flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-bold">{successToast}</span>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-zinc-400 hover:text-white ml-2 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-rose-950/95 border border-rose-500 text-white text-xs font-mono flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-w-md">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorToast}</span>
          <button
            onClick={() => setErrorToast(null)}
            className="text-zinc-400 hover:text-white ml-2 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-xs font-mono text-[#D4AF37] mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL SUBSCRIPTION ACCESS</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
          Transparent Terminal Pricing
        </h2>
        <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
          All subscription quotas &amp; AI credit balances are enforced server-side. Launch discounts and standard renewal pricing are disclosed upfront before checkout.
        </p>

        {launchActive && (
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#D4AF37]/20 via-amber-500/15 to-[#D4AF37]/20 border border-[#D4AF37]/50 shadow-[0_0_30px_rgba(212,175,55,0.2)]">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black text-[#D4AF37] uppercase tracking-wider">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>{launchBadgeText}</span>
            </span>
            <span className="text-zinc-500">•</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Launch ends {launchEndDateStr} ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left)
              </span>
            </span>
          </div>
        )}
      </div>

      {/* 5-Tier Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
        {tiers.map((tier) => {
          const isCurrentPlan = Boolean(
            user &&
              currentPlanKey === tier.id &&
              (tier.id === 'free' || user.subscriptionStatus !== 'expired')
          );
          const isLoadingThis = loadingPlan === tier.id;
          const showLaunchStrike =
            launchActive && tier.id !== 'free' && tier.originalPrice > tier.activePrice;

          return (
            <div
              key={tier.id}
              onMouseEnter={() => {
                if (tier.id === 'starter' || tier.id === 'pro' || tier.id === 'enterprise') {
                  prefetchPlan(tier.id);
                }
              }}
              className={`glass-panel relative rounded-[24px] p-5 flex flex-col justify-between transition-all duration-300 ${
                tier.popular
                  ? 'border-[#D4AF37] shadow-[0_0_50px_rgba(212,175,55,0.22)] bg-white/[0.05] xl:-translate-y-2'
                  : tier.highValue
                  ? 'border-purple-500/50 bg-purple-950/10 hover:border-purple-400/70'
                  : tier.contractOnly
                  ? 'border-sky-500/40 bg-sky-950/10 hover:border-sky-400/70'
                  : 'hover:border-white/20'
              }`}
            >
              {tier.badge && (
                <div
                  className={`-top-3 left-1/2 -translate-x-1/2 absolute px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black tracking-wider uppercase shadow-md flex items-center gap-1 whitespace-nowrap ${
                    tier.popular
                      ? 'bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] text-black'
                      : tier.highValue
                      ? 'bg-purple-500 text-white'
                      : 'bg-sky-500 text-black'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{tier.badge}</span>
                </div>
              )}

              {isLoadingThis && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm rounded-[24px] z-20 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
                  <div className="text-xs font-mono font-bold text-white">Creating Secure Checkout...</div>
                  <div className="text-[10px] font-mono text-zinc-400">Connecting with Paddle</div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2.5 mb-2.5 mt-1">
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 shrink-0">
                    {tier.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">{tier.name}</h3>
                    <p className="text-[10px] text-zinc-400 font-normal leading-tight">{tier.subtitle}</p>
                  </div>
                </div>

                {/* Price Block with Explicit Real + Launch + Renewal Disclosure */}
                <div className="my-3.5 pb-3.5 border-b border-white/[0.08]">
                  {showLaunchStrike && (
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-zinc-500 line-through">
                        {formatPrice(tier.originalPrice, currentCurrency)}
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        LAUNCH PRICE
                      </span>
                    </div>
                  )}

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black font-mono text-white tracking-tight">
                      {tier.activePrice === 0
                        ? 'FREE'
                        : formatPrice(tier.activePrice, currentCurrency)}
                    </span>
                    {tier.activePrice > 0 && (
                      <span className="text-[11px] font-mono text-zinc-400">/ 30 days</span>
                    )}
                  </div>

                  {tier.id !== 'free' && (
                    <div className="mt-1.5 text-[10px] font-mono text-amber-200/90 leading-snug">
                      {tier.contractOnly ? (
                        <span>
                          Renews at {formatPrice(tier.originalPrice, currentCurrency)}/mo standard contract rate (Launch ends {launchEndDateStr})
                        </span>
                      ) : (
                        <span>
                          Standard renewal: {formatPrice(tier.originalPrice, currentCurrency)}/mo • Launch ends {launchEndDateStr}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] font-mono text-[#D4AF37] mt-2 font-semibold">
                    {tier.analysesLimitText}
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2 mb-5">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Included Quotas &amp; Capabilities:
                  </div>
                  {tier.features.map((feature, i) => {
                    const isExclusion = feature.toLowerCase().startsWith('no ');
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 text-[11px] leading-tight ${
                          isExclusion ? 'text-zinc-500 font-mono text-[10px] pt-0.5' : 'text-zinc-300 font-sans'
                        }`}
                      >
                        {isExclusion ? (
                          <Lock className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                        ) : (
                          <div className="p-0.5 rounded-full bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        <span>{feature}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={isLoadingThis || isCurrentPlan}
                  onClick={() => handleChoosePlan(tier.id)}
                  className={`w-full py-3 px-3 rounded-xl text-[11px] font-bold font-mono tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg min-h-[44px] ${
                    isCurrentPlan
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : tier.popular
                      ? 'bg-gradient-to-r from-[#D4AF37] via-[#E6C65A] to-[#B8860B] hover:brightness-110 text-black font-black shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                      : tier.contractOnly
                      ? 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/50'
                      : 'bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/10 hover:border-[#D4AF37]/50'
                  }`}
                >
                  {isLoadingThis ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-current" />
                      <span>Checkout...</span>
                    </>
                  ) : isCurrentPlan ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Current Plan</span>
                    </>
                  ) : (
                    <>
                      <span>{tier.ctaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </>
                  )}
                </button>
                {tier.activePrice > 0 && !tier.contractOnly && (
                  <p className="text-[9px] font-mono text-zinc-400 text-center leading-snug">
                    7-Day Refund - 0 successful analyses or unresolved issue
                  </p>
                )}
                {tier.contractOnly && (
                  <p className="text-[9px] font-mono text-sky-300/80 text-center leading-snug">
                    Bounded contract terms • Dedicated SLA &amp; Onboarding
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Extra AI Credits Top-Up Packs & Credit Cost Transparency */}
      <div className="mt-10 glass-panel rounded-[24px] p-6 border border-[#D4AF37]/30 bg-white/[0.03]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#D4AF37] mb-1.5">
              <Coins className="w-4 h-4" />
              <span>AI CREDIT METERING &amp; EXTRA CREDIT PACKS</span>
            </div>
            <h3 className="text-lg font-bold text-white">Need Extra AI Credits Without Changing Your Plan?</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Credits deduct by AI compute cost: Standard Underwriting / Deal Finder / Forecast / File Extraction / PDF Export ={' '}
              <strong className="text-white">{CREDIT_COSTS['run-analysis']} cr</strong> • AI Due Diligence / Portfolio Optimizer / Advisor / AI Studio ={' '}
              <strong className="text-white">{CREDIT_COSTS['run-due-diligence']} cr</strong> • Multi-Document Due Diligence Audit ={' '}
              <strong className="text-white">{CREDIT_COSTS['due-diligence-docs']} cr</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            {EXTRA_CREDIT_PACKS.map((pack) => {
              const isBuying = buyingPackId === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  disabled={isBuying}
                  onClick={() => handleBuyCreditPack(pack.id)}
                  className="p-3.5 rounded-xl bg-black/50 hover:bg-[#D4AF37]/15 border border-white/10 hover:border-[#D4AF37]/60 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-black text-white">{pack.label}</span>
                    <span className="text-sm font-mono font-black text-[#D4AF37]">
                      {formatPrice(pack.priceUSD, currentCurrency)}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 mt-1 group-hover:text-zinc-200 flex items-center justify-between">
                    <span>{pack.badge || 'Instant top-up'}</span>
                    {isBuying ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Required Checkout Policy Checkbox */}
      <div
        className={`mt-8 max-w-xl mx-auto p-4 rounded-2xl border transition-all ${
          highlightPolicy
            ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.3)]'
            : 'bg-white/[0.03] border-white/10'
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={refundAccepted}
            onChange={(e) => {
              setRefundAccepted(e.target.checked);
              if (e.target.checked) setHighlightPolicy(false);
            }}
            className="mt-0.5 w-4 h-4 accent-[#D4AF37] rounded cursor-pointer shrink-0"
          />
          <span className="text-xs font-mono text-zinc-200 leading-relaxed">
            By purchasing, you agree to{' '}
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
              className="text-[#D4AF37] underline font-bold hover:text-amber-300 cursor-pointer"
            >
              Refund Policy
            </a>{' '}
            and{' '}
            <button
              type="button"
              onClick={() => {
                if (onOpenLegal) onOpenLegal('terms');
                else window.location.hash = '#/terms';
              }}
              className="text-[#D4AF37] underline hover:text-amber-300 cursor-pointer"
            >
              Terms of Service
            </button>
            .
          </span>
        </label>
      </div>

      {/* Trust & Honesty Footer */}
      <div className="mt-8 text-center text-xs text-zinc-400 font-mono flex flex-wrap items-center justify-center gap-4">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Secure Paddle 256-Bit SSL Checkout</span>
        </span>
        <span className="text-zinc-600">•</span>
        <span>Server-Enforced Quotas &amp; Credits</span>
        <span className="text-zinc-600">•</span>
        <span>Cited Benchmark Sources Only (No live exchange claims or legal/tax guarantees)</span>
      </div>

      {/* Enterprise Contract Inquiry Modal */}
      {showEnterpriseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <div className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-sky-500/40 p-6 sm:p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowEnterpriseModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-sky-400 font-bold mb-1">
              <Briefcase className="w-4 h-4" />
              <span>AQARI ENTERPRISE CONTRACT DESK</span>
            </div>
            <h3 className="text-xl font-bold text-white">Request Enterprise Contract</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Standard Contract: <strong className="text-zinc-300 line-through">$2,499/mo</strong>{' '}
              <strong className="text-sky-300">$1,499/mo Launch Rate</strong> (until {launchEndDateStr}).
              Includes 1,000 analyses/mo, 1,000 portfolio assets, 1,000 saves, 50 seats, 10,000 API req/day &amp; SLA.
            </p>
            <form onSubmit={handleSubmitEnterpriseInquiry} className="mt-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono text-zinc-300 mb-1">Organization / Fund Name *</label>
                <input
                  type="text"
                  required
                  value={entCompany}
                  onChange={(e) => setEntCompany(e.target.value)}
                  placeholder="e.g. Muscat Sovereign Capital LLC"
                  className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-sm text-white focus:border-sky-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-300 mb-1">Corporate Email *</label>
                <input
                  type="email"
                  required
                  value={entEmail}
                  onChange={(e) => setEntEmail(e.target.value)}
                  placeholder="allocations@institution.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-sm text-white focus:border-sky-400 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-300 mb-1">Team Seats (Contract: 50)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={entSeats}
                    onChange={(e) => setEntSeats(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-sm text-white font-mono focus:border-sky-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-300 mb-1">Assets Scope (Baseline: 1,000)</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={entAssets}
                    onChange={(e) => setEntAssets(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-sm text-white font-mono focus:border-sky-400 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-300 mb-1">ERP/CRM, Custom Risk Model &amp; SLA Notes</label>
                <textarea
                  rows={3}
                  value={entNotes}
                  onChange={(e) => setEntNotes(e.target.value)}
                  placeholder="Specify ERP/CRM integration needs, custom underwriting templates, or onboarding timeline..."
                  className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-sm text-white focus:border-sky-400 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={entSubmitting}
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                {entSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Submit Enterprise Contract Request</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Production Credit Pack Transaction / Invoice Modal */}
      {pendingCreditPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <div className="relative w-full max-w-md rounded-3xl bg-zinc-950 border border-[#D4AF37]/40 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setPendingCreditPack(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] font-bold mb-1">
              <Coins className="w-4 h-4" />
              <span>ACTIVATE EXTRA CREDIT PACK</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              {pendingCreditPack.label} ({formatPrice(pendingCreditPack.priceUSD, currentCurrency)})
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Enter your completed Paddle Transaction ID (<code className="text-zinc-200">txn_...</code>) to apply credits immediately, or request a billing invoice top-up.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={creditTxnId}
                onChange={(e) => setCreditTxnId(e.target.value)}
                placeholder="txn_01..."
                className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-sm font-mono text-white focus:border-[#D4AF37] outline-none"
              />
              <button
                type="button"
                disabled={!creditTxnId.trim() || buyingPackId === pendingCreditPack.id}
                onClick={() => handleBuyCreditPack(pendingCreditPack.id, creditTxnId.trim())}
                className="w-full py-2.5 rounded-xl bg-[#D4AF37] text-black font-mono font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                Verify Paddle Transaction &amp; Add Credits
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = pendingCreditPack;
                  setPendingCreditPack(null);
                  setEntCompany(user?.name || 'Credit Top-Up');
                  setEntEmail(user?.email || '');
                  setEntNotes(`Extra Credit Pack Request: ${p.label} ($${p.priceUSD} USD)`);
                  setShowEnterpriseModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs cursor-pointer"
              >
                Request Invoice / Account Top-Up Link
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
