import React, { useState, useEffect, useRef } from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import { formatPrice } from '../utils/formatters';
import { MagneticButton } from './MagneticButton';
import { 
  Check, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Building2, 
  Crown,
  ArrowRight,
  Loader2,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface PricingSectionProps {
  currentCurrency: CurrencyCode;
  config: RemoteConfig;
  user: User | null;
  onOpenAuth: () => void;
  onTestUnlock?: (plan: 'starter' | 'pro' | 'enterprise') => void;
  onGoToTerminal?: () => void;
  isStandalonePage?: boolean;
}

// 5-minute prefetch cache stored in client memory
interface CachedCheckout {
  url: string;
  timestamp: number;
}
const checkoutPrefetchCache: Record<string, CachedCheckout> = {};

export const PricingSection: React.FC<PricingSectionProps> = ({
  currentCurrency,
  config,
  user,
  onOpenAuth,
  onGoToTerminal,
  isStandalonePage = false,
}) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Check if Lemon Squeezy test mode is active
  const isTestMode = 
    typeof window !== 'undefined' && 
    (import.meta.env.VITE_LEMON_TEST_MODE === 'true' || import.meta.env.VITE_LEMON_TEST_MODE === true);

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 6000);
  };

  // Prefetch a plan checkout URL in background
  const prefetchPlan = async (plan: 'starter' | 'pro' | 'enterprise') => {
    const cached = checkoutPrefetchCache[plan];
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.url;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('/api/checkout', {
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
          checkoutPrefetchCache[plan] = {
            url: data.url,
            timestamp: Date.now(),
          };
          return data.url;
        }
      }
    } catch {
      // Prefetch fails silently without disturbing user
    }
    return null;
  };

  // Prefetch on mount for all 3 paid plans in parallel
  useEffect(() => {
    const plans: Array<'starter' | 'pro' | 'enterprise'> = ['starter', 'pro', 'enterprise'];
    plans.forEach((p) => {
      prefetchPlan(p);
    });
  }, [user]);

  // Handle plan selection with 8s timeout + 1 automatic retry
  const handleChoosePlan = async (planId: 'free' | 'starter' | 'pro' | 'enterprise') => {
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

    if (!user) {
      onOpenAuth();
      return;
    }

    // Check if immediate cached checkout URL is ready
    const cached = checkoutPrefetchCache[planId];
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log(`[Aqari Checkout] Using prefetch cache for plan: ${planId}`);
      window.location.href = cached.url;
      return;
    }

    // Immediate button loading state: "Creating Secure Checkout..." disabled with spinner
    setLoadingPlan(planId);
    setErrorToast(null);

    const callCheckoutApi = async (): Promise<string | null> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: planId,
            email: user.email,
            userId: user.id || user.googleId,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            checkoutPrefetchCache[planId] = {
              url: data.url,
              timestamp: Date.now(),
            };
            return data.url;
          }
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        throw err;
      }
      return null;
    };

    const startTime = Date.now();

    try {
      // Attempt 1
      const url = await callCheckoutApi();
      if (url) {
        console.log(`[Aqari Checkout] Generated in ${Date.now() - startTime}ms, Test Mode: ${isTestMode}`);
        window.location.href = url;
        return;
      }
    } catch {
      // Attempt 2 (Retry once with fresh 8s timeout)
      try {
        console.warn(`[Aqari Checkout] Attempt 1 timed out or failed. Retrying once...`);
        const retryUrl = await callCheckoutApi();
        if (retryUrl) {
          console.log(`[Aqari Checkout] Retry successful in ${Date.now() - startTime}ms`);
          window.location.href = retryUrl;
          return;
        }
      } catch (retryErr) {
        console.error(`[Aqari Checkout] Retry failed:`, retryErr);
      }
    }

    // Direct fallback to hosted Lemon Squeezy URL so user is never stuck
    try {
      const buyUrls: Record<'starter' | 'pro' | 'enterprise', string> = {
        starter: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/da826632-dcb4-4885-966e-aac1fab84cb3',
        pro: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/404c54cb-29c5-477a-b8c2-772092f5459a',
        enterprise: 'https://aqari-ai.lemonsqueezy.com/checkout/buy/ce8dfbdb-cedd-4445-a947-e821522472bb',
      };
      const direct = `${buyUrls[planId]}?checkout[email]=${encodeURIComponent(user.email)}&checkout[custom][user_id]=${encodeURIComponent(user.id || user.googleId || '')}&checkout[custom][plan]=${planId}${isTestMode ? '&checkout[test_mode]=1' : ''}`;
      window.location.href = direct;
      return;
    } catch {
      showError('Checkout is taking longer, please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const tiers: Array<{
    id: 'free' | 'starter' | 'pro' | 'enterprise';
    name: string;
    subtitle: string;
    baseUSD: number;
    popular?: boolean;
    analysesLimit: string;
    icon: React.ReactNode;
    features: string[];
    ctaLabel: string;
  }> = [
    {
      id: 'free',
      name: 'Aqari AI - Free',
      subtitle: 'For exploratory property underwriting',
      baseUSD: 0,
      analysesLimit: '3 Free Analyses Total',
      icon: <Building2 className="w-5 h-5 text-zinc-400" />,
      features: [
        '3 Free Institutional Analyses with Google sign-in',
        'Basic Yield Calculator (Cap Rate, CoC, IRR, Cashflow)',
        'Save up to 3 properties in personal portfolio',
        'Standard Currency Switcher (USD, OMR, AED, GBP)',
        'Zero credit card required to start',
      ],
      ctaLabel: user ? 'Current Free Plan' : 'Get Started Free',
    },
    {
      id: 'starter',
      name: 'Aqari AI - Standard',
      subtitle: 'For individual cross-border real estate investors',
      baseUSD: 89,
      analysesLimit: '50 Deep Analyses / 30 Days',
      icon: <Building2 className="w-5 h-5 text-zinc-300" />,
      features: [
        '50 Deep Asset Intelligence analyses',
        'Real-time currency converter across 4 currencies',
        'Yield & sensitivity simulator with mortgage model',
        'Cross-border tax & visa matrix (7 markets)',
        'Transfer Tax, OPEX & Insurance Modeling',
        'Multi-asset Portfolio Aggregation (up to 50 saved properties)',
        'Standard email support',
      ],
      ctaLabel: 'Upgrade to Standard',
    },
    {
      id: 'pro',
      name: 'Aqari AI - Pro',
      subtitle: 'For family offices, active syndicators & brokers',
      baseUSD: 249,
      popular: true,
      analysesLimit: '400 Deep Analyses / 30 Days',
      icon: <Zap className="w-5 h-5 text-[#D4AF37]" />,
      features: [
        '400 Institutional Asset Intelligence analyses',
        'Full Monte Carlo stress tests (+200bps rate shocks)',
        'Tenant default probability index & credit ratings',
        'Sovereign wealth fund capital flow tracking',
        'Priority 24/7 dedicated analyst desk',
        'Downloadable PDF investment memoranda',
        'Full Cash Flow Waterfall Breakdown',
        'Save up to 200 properties',
      ],
      ctaLabel: 'Upgrade to Professional',
    },
    {
      id: 'enterprise',
      name: 'Aqari AI - Agency',
      subtitle: 'For institutional funds, REITs & sovereign wealth',
      baseUSD: 749,
      analysesLimit: 'Unlimited Analyses / 30 Days',
      icon: <Crown className="w-5 h-5 text-purple-400" />,
      features: [
        'Unlimited institutional underwriting dossiers',
        'Real-time API access to global transaction data',
        'Custom multi-jurisdiction portfolio stress-testing',
        'Dedicated real estate underwriting director',
        'Bespoke macro legal & tax opinion integration',
        'White-glove data ingestion & custom reporting',
        'Unlimited saved properties',
      ],
      ctaLabel: 'Upgrade to Sovereign Agency',
    },
  ];

  return (
    <section id="pricing" className={`py-16 px-4 lg:px-8 max-w-7xl mx-auto relative z-10 ${isStandalonePage ? 'pt-24' : ''}`}>
      
      {/* Test Mode Badge Header if active */}
      {isTestMode && (
        <div className="mb-6 mx-auto max-w-md p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse">
          <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold">TEST MODE - Use card 4242 4242 4242 4242</span>
        </div>
      )}

      {/* Error Toast if checkout is taking long */}
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-rose-950/95 border border-rose-500 text-white text-xs font-mono flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="text-zinc-400 hover:text-white ml-2 text-sm font-bold">×</button>
        </div>
      )}

      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-xs font-mono text-[#D4AF37] mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL SUBSCRIPTION ACCESS</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
          Transparent Terminal Pricing
        </h2>
        <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
          Unlock institutional real estate underwriting. Real Lemon Squeezy payment with 30-day automated licensing.
        </p>
      </div>

      {/* Pricing Cards Grid - 4 Tiers: Free / Standard / Pro / Agency */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {tiers.map((tier) => {
          const isCurrentPlan = user?.plan === tier.id && (tier.id === 'free' || user?.subscriptionStatus === 'active');
          const isLoadingThis = loadingPlan === tier.id;
          const isAnyLoading = Boolean(loadingPlan);

          return (
            <div
              key={tier.id}
              onMouseEnter={() => {
                if (tier.id !== 'free') prefetchPlan(tier.id);
              }}
              className={`glass-panel relative rounded-[28px] p-6 flex flex-col justify-between transition-all duration-300 ${
                tier.popular
                  ? 'border-[#D4AF37] shadow-[0_0_50px_rgba(212,175,55,0.2)] bg-white/[0.05] lg:-translate-y-2'
                  : 'hover:border-white/20'
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] text-black text-[10px] font-mono font-black tracking-wider uppercase shadow-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-black fill-black" />
                  <span>MOST POPULAR</span>
                </div>
              )}

              {/* Skeleton Loader overlay when this card is loading checkout (does NOT freeze UI) */}
              {isLoadingThis && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[28px] z-20 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
                  <div className="text-xs font-mono font-bold text-white">
                    Creating Secure Checkout...
                  </div>
                  <div className="w-3/4 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#D4AF37] to-amber-200 animate-pulse w-full" />
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400">
                    Encrypting session with Lemon Squeezy
                  </div>
                </div>
              )}

              <div>
                {/* Tier Title & Subtitle */}
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
                    {tier.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{tier.name}</h3>
                    <p className="text-[10px] text-zinc-400 font-normal leading-tight">{tier.subtitle}</p>
                  </div>
                </div>

                {/* Price Display */}
                <div className="my-5 pb-5 border-b border-white/[0.08]">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                      {tier.baseUSD === 0 ? 'FREE' : formatPrice(tier.baseUSD, currentCurrency)}
                    </span>
                    {tier.baseUSD > 0 && <span className="text-xs font-mono text-zinc-400">/ 30 days</span>}
                  </div>

                  <div className="text-[11px] font-mono text-[#D4AF37] mt-1.5 font-semibold">
                    {tier.analysesLimit}
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2.5 mb-6">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Included Capabilities:
                  </div>
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-300 font-sans leading-tight">
                      <div className="p-0.5 rounded-full bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isLoadingThis || isCurrentPlan}
                  onClick={() => handleChoosePlan(tier.id)}
                  className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg min-h-[46px] ${
                    isCurrentPlan
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : tier.popular
                      ? 'bg-gradient-to-r from-[#D4AF37] via-[#E6C65A] to-[#B8860B] hover:brightness-110 text-black font-black shadow-[0_0_20px_rgba(212,175,55,0.35)]'
                      : 'bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/10 hover:border-[#D4AF37]/50'
                  }`}
                >
                  {isLoadingThis ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-current" />
                      <span>Creating Secure Checkout...</span>
                    </>
                  ) : isCurrentPlan ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>CURRENT PLAN</span>
                    </>
                  ) : (
                    <>
                      <span>{tier.ctaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Trust & Guarantee Footer */}
      <div className="mt-12 text-center text-xs text-zinc-400 font-mono flex flex-wrap items-center justify-center gap-6">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Real Lemon Squeezy 256-Bit SSL Checkout</span>
        </span>
        <span className="text-zinc-600">•</span>
        <span>Instant Automated Webhook Provisioning</span>
        <span className="text-zinc-600">•</span>
        <span>30-Day Subscription Window</span>
        <span className="text-zinc-600">•</span>
        <span>Cancel Anytime</span>
      </div>

    </section>
  );
};
