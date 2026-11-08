import React from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import { LEMON_LINKS, LEMON_REDIRECT_URLS } from '../constants';
import { formatPrice } from '../utils/formatters';
import { MagneticButton } from './MagneticButton';
import { 
  Check, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Building2, 
  Crown,
  ArrowRight
} from 'lucide-react';

interface PricingSectionProps {
  currentCurrency: CurrencyCode;
  config: RemoteConfig;
  user: User | null;
  onOpenAuth: () => void;
  onTestUnlock: (plan: 'starter' | 'pro' | 'enterprise') => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  currentCurrency,
  config,
  user,
  onOpenAuth,
  onTestUnlock,
}) => {
  const isDiscountActive = config.discount.active && config.discount.percent > 0;
  const discountMultiplier = isDiscountActive ? 1 - config.discount.percent / 100 : 1;

  const handleChoosePlan = (plan: 'starter' | 'pro' | 'enterprise') => {
    if (!user) {
      onOpenAuth();
      return;
    }

    const baseLink = LEMON_LINKS[plan];
    const redirectUrl = LEMON_REDIRECT_URLS[plan];
    const params = new URLSearchParams();
    params.set('checkout[custom][user_id]', user.id);
    params.set('checkout[custom][plan]', plan);
    params.set('checkout[email]', user.email);
    params.set('checkout[redirect_url]', redirectUrl);

    if (isDiscountActive && config.discount.code) {
      params.set('discount', config.discount.code);
    }

    const finalUrl = `${baseLink}?${params.toString()}`;
    window.location.href = finalUrl;
  };

  const tiers: Array<{
    id: 'starter' | 'pro' | 'enterprise';
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
      id: 'starter',
      name: 'Starter Terminal',
      subtitle: 'For individual cross-border real estate investors',
      baseUSD: config.prices.starter,
      analysesLimit: '50 Deep Analyses / month',
      icon: <Building2 className="w-5 h-5 text-zinc-300" />,
      features: [
        '50 Deep Asset Intelligence analyses',
        'Real-time currency converter across 4 currencies',
        'Yield & sensitivity simulator with mortgage model',
        'Cross-border tax & visa matrix (7 markets)',
        'Standard email support',
      ],
      ctaLabel: 'Choose Starter Plan',
    },
    {
      id: 'pro',
      name: 'Professional Terminal',
      subtitle: 'For family offices, active syndicators & brokers',
      baseUSD: config.prices.pro,
      popular: true,
      analysesLimit: '400 Deep Analyses / month',
      icon: <Zap className="w-5 h-5 text-[#D4AF37]" />,
      features: [
        '400 Institutional Asset Intelligence analyses',
        'Full Monte Carlo stress tests (+200bps rate shocks)',
        'Tenant default probability index & credit ratings',
        'Sovereign wealth fund capital flow tracking',
        'Priority 24/7 dedicated analyst desk',
        'Downloadable PDF investment memoranda',
      ],
      ctaLabel: 'Choose Pro Terminal',
    },
    {
      id: 'enterprise',
      name: 'Sovereign Enterprise',
      subtitle: 'For institutional funds, REITs & sovereign wealth',
      baseUSD: config.prices.enterprise,
      analysesLimit: 'Unlimited Institutional Analyses',
      icon: <Crown className="w-5 h-5 text-purple-400" />,
      features: [
        'Unlimited institutional underwriting dossiers',
        'Real-time API access to global transaction data',
        'Custom multi-jurisdiction portfolio stress-testing',
        'Dedicated real estate underwriting director',
        'Bespoke macro legal & tax opinion integration',
        'White-glove data ingestion & custom reporting',
      ],
      ctaLabel: 'Choose Enterprise Plan',
    },
  ];

  return (
    <section id="pricing" className="py-20 px-4 lg:px-8 max-w-7xl mx-auto relative z-10">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-xs font-mono text-[#D4AF37] mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL SUBSCRIPTION ACCESS</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
          Transparent Terminal Pricing
        </h2>
        <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
          Unlock institutional real estate underwriting. Real LemonSqueezy payment links with automated 30-day licensing and zero duplicate currencies.
        </p>

        {isDiscountActive && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
            <span>Special Promotion: {config.discount.percent}% OFF applied with code <strong>{config.discount.code}</strong></span>
          </div>
        )}
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {tiers.map((tier) => {
          const originalPriceUSD = tier.baseUSD;
          const discountedPriceUSD = isDiscountActive
            ? Math.round(originalPriceUSD * discountMultiplier)
            : originalPriceUSD;

          const isCurrentPlan = user?.plan === tier.id;

          return (
            <div
              key={tier.id}
              className={`glass-panel relative rounded-[32px] p-7 sm:p-9 flex flex-col justify-between transition-all duration-300 ${
                tier.popular
                  ? 'border-[#D4AF37] shadow-[0_0_50px_rgba(212,175,55,0.2)] bg-white/[0.05] lg:-translate-y-2'
                  : 'hover:border-white/20'
              }`}
            >
              {/* Shimmer Light on Popular Card */}
              {tier.popular && (
                <div className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 animate-shimmer" />
                </div>
              )}

              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] text-black text-[11px] font-mono font-black tracking-wider uppercase shadow-md flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-black fill-black" />
                  <span>MOST POPULAR • INSTITUTIONAL CHOICE</span>
                </div>
              )}

              <div>
                {/* Tier Title & Subtitle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
                      {tier.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">{tier.name}</h3>
                      <p className="text-[11px] text-zinc-400 font-normal">{tier.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* SINGLE PRICE DISPLAY - NO DUPLICATE OMR TEXT */}
                <div className="my-6 pb-6 border-b border-white/[0.08]">
                  <div className="flex items-baseline gap-2">
                    {/* Main Active Converted Price */}
                    <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight">
                      {formatPrice(discountedPriceUSD, currentCurrency)}
                    </span>
                    <span className="text-xs font-mono text-zinc-400">/ 30 days</span>
                  </div>

                  {/* If discount is active, show crossed-out original price */}
                  {isDiscountActive && (
                    <div className="flex items-center gap-2 mt-1.5 text-xs font-mono">
                      <span className="text-zinc-500 line-through">
                        {formatPrice(originalPriceUSD, currentCurrency)}
                      </span>
                      <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                        Save {config.discount.percent}%
                      </span>
                    </div>
                  )}

                  {/* Limit note */}
                  <div className="text-[11px] font-mono text-[#D4AF37] mt-2 font-semibold">
                    {tier.analysesLimit}
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-8">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Included Capabilities:
                  </div>
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                      <div className="p-0.5 rounded-full bg-emerald-500/10 text-emerald-400 mt-0.5 shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <MagneticButton
                  type="button"
                  onClick={() => handleChoosePlan(tier.id)}
                  className={`w-full py-4 px-6 rounded-2xl text-xs font-bold font-mono tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                    isCurrentPlan
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : tier.popular
                      ? 'bg-gradient-to-r from-[#D4AF37] via-[#E6C65A] to-[#B8860B] hover:brightness-110 text-black font-black shadow-[0_0_25px_rgba(212,175,55,0.4)]'
                      : 'bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/10 hover:border-[#D4AF37]/50'
                  }`}
                >
                  {isCurrentPlan ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>CURRENT ACTIVE PLAN</span>
                    </>
                  ) : (
                    <>
                      <span>{tier.ctaLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </MagneticButton>
              </div>

            </div>
          );
        })}
      </div>

      {/* Trust & Guarantee Footer */}
      <div className="mt-12 text-center text-xs text-zinc-400 font-mono flex flex-wrap items-center justify-center gap-6">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Real LemonSqueezy 256-Bit SSL Checkout</span>
        </span>
        <span className="text-zinc-600">•</span>
        <span>Instant Automated Webhook Provisioning</span>
        <span className="text-zinc-600">•</span>
        <span>30-Day Subscription Window</span>
        <span className="text-zinc-600">•</span>
        <span>Cancel Anytime in Customer Portal</span>
      </div>

    </section>
  );
};
