import React from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import { LEMON_LINKS, LEMON_REDIRECT_URLS, PLAN_LIMITS } from '../constants';
import { formatPrice, getDaysRemaining } from '../utils/formatters';
import { 
  X, 
  Sparkles, 
  Zap, 
  Crown, 
  Building2, 
  Check, 
  ArrowRight, 
  ShieldCheck,
  Flame
} from 'lucide-react';

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  config: RemoteConfig;
  currentCurrency: CurrencyCode;
}

export const RenewalModal: React.FC<RenewalModalProps> = ({
  isOpen,
  onClose,
  user,
  config,
  currentCurrency,
}) => {
  if (!isOpen) return null;

  const isDiscountActive = config.discount.active && config.discount.percent > 0;
  const discountMultiplier = isDiscountActive ? 1 - config.discount.percent / 100 : 1;

  const handleRenew = (plan: 'starter' | 'pro' | 'enterprise') => {
    const baseLink = LEMON_LINKS[plan];
    const redirectUrl = LEMON_REDIRECT_URLS[plan];
    const params = new URLSearchParams();
    if (user) {
      params.set('checkout[custom][user_id]', user.id);
      params.set('checkout[custom][plan]', plan);
      params.set('checkout[email]', user.email);
    }
    params.set('checkout[redirect_url]', redirectUrl);
    if (isDiscountActive && config.discount.code) {
      params.set('discount', config.discount.code);
    }
    window.location.href = `${baseLink}?${params.toString()}`;
  };

  const plans: Array<{
    id: 'starter' | 'pro' | 'enterprise';
    name: string;
    baseUSD: number;
    popular?: boolean;
    icon: React.ReactNode;
    features: string[];
    limits: string;
  }> = [
    {
      id: 'starter',
      name: 'Starter Terminal',
      baseUSD: config.prices.starter,
      icon: <Building2 className="w-5 h-5 text-zinc-300" />,
      limits: '50 Analyses / 30 Days',
      features: [
        '50 Deep Analyses per 30 days',
        'Save up to 50 properties',
        'Yield & sensitivity calculator',
        'Cross-border tax & visa matrix',
      ],
    },
    {
      id: 'pro',
      name: 'Professional Terminal',
      baseUSD: config.prices.pro,
      popular: true,
      icon: <Zap className="w-5 h-5 text-[#D4AF37]" />,
      limits: '400 Analyses / 30 Days',
      features: [
        '400 Institutional Analyses',
        'Save up to 200 properties',
        'Monte Carlo stress tests (+200bps)',
        'PDF Memorandum export',
        'Multi-asset portfolio aggregation',
      ],
    },
    {
      id: 'enterprise',
      name: 'Sovereign Enterprise',
      baseUSD: config.prices.enterprise,
      icon: <Crown className="w-5 h-5 text-purple-400" />,
      limits: 'Unlimited Analyses / 30 Days',
      features: [
        'Unlimited institutional analyses',
        'Unlimited saved properties',
        'Full REST API credentials',
        '1-on-1 Dedicated Analyst Desk',
        'White-glove custom underwriting',
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-[32px] glass-dropdown p-6 sm:p-10 border border-[#D4AF37]/40 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Glow */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-xs font-mono text-[#D4AF37] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>INSTITUTIONAL SUBSCRIPTION UPGRADE / RENEWAL</span>
          </div>
          <h3 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Extend Your 30-Day Terminal Access
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-lg mx-auto">
            Choose your institutional tier. Payments process through LemonSqueezy 256-bit SSL encryption and immediately extend your licensing +30 days from today.
          </p>

          {isDiscountActive && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <Flame className="w-3.5 h-3.5" />
              <span>Promo applied: {config.discount.percent}% OFF with code <strong>{config.discount.code}</strong></span>
            </div>
          )}
        </div>

        {/* 3 Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 overflow-y-auto pr-1">
          {plans.map((p) => {
            const originalUSD = p.baseUSD;
            const discountedUSD = isDiscountActive
              ? Math.round(originalUSD * discountMultiplier)
              : originalUSD;
            const isCurrent = user?.plan === p.id;
            const daysRemaining = user?.subscriptionExpiry ? getDaysRemaining(user.subscriptionExpiry) : 30;

            const planRank: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };
            const userRank = user ? (planRank[user.plan] || 0) : 0;
            const thisRank = planRank[p.id] || 0;

            let badgeText: string | null = null;
            let buttonLabel = `Select ${p.name.split(' ')[0]}`;
            let isDisabled = false;

            if (user?.plan === 'enterprise') {
              if (p.id === 'enterprise') {
                badgeText = 'You have all features';
                buttonLabel = 'Renew Enterprise (+30 Days)';
              } else {
                badgeText = 'Included in Enterprise';
                buttonLabel = 'Included in Plan';
                isDisabled = true;
              }
            } else if (user?.plan === 'pro') {
              if (p.id === 'pro') {
                badgeText = `Current Plan: PRO • ${daysRemaining}d left`;
                buttonLabel = 'Renew PRO (+30 Days)';
              } else if (p.id === 'enterprise') {
                buttonLabel = 'Upgrade to Enterprise';
              } else {
                badgeText = 'Included in PRO';
                buttonLabel = 'Included in Plan';
                isDisabled = true;
              }
            } else if (user?.plan === 'starter') {
              if (p.id === 'starter') {
                badgeText = `Current Plan: STARTER • ${daysRemaining}d left`;
                buttonLabel = 'Renew STARTER (+30 Days)';
              } else {
                buttonLabel = `Upgrade to ${p.name.split(' ')[0]}`;
              }
            } else {
              // Free tier
              if (p.popular) {
                badgeText = 'POPULAR';
              }
              buttonLabel = `Upgrade to ${p.name.split(' ')[0]}`;
            }

            return (
              <div
                key={p.id}
                className={`p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                  isCurrent
                    ? 'bg-gradient-to-b from-white/[0.08] to-white/[0.02] border-2 border-[#D4AF37] shadow-[0_0_35px_rgba(212,175,55,0.25)]'
                    : p.popular
                    ? 'bg-white/[0.05] border-2 border-[#D4AF37]/80 shadow-[0_0_35px_rgba(212,175,55,0.2)] md:-translate-y-1'
                    : 'bg-white/[0.02] border border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
                      {p.icon}
                    </div>
                    {badgeText && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider ${
                        isCurrent
                          ? 'bg-[#D4AF37] text-black shadow-sm'
                          : 'bg-white/10 text-zinc-300 border border-white/10'
                      }`}>
                        {badgeText}
                      </span>
                    )}
                  </div>

                  <h4 className="text-lg font-bold text-white tracking-tight">{p.name}</h4>
                  <div className="text-[11px] font-mono text-[#D4AF37] font-semibold mt-0.5 mb-3">
                    {p.limits}
                  </div>

                  {/* Price */}
                  <div className="pb-4 mb-4 border-b border-white/[0.08]">
                    <div className="text-3xl font-black font-mono text-white">
                      {formatPrice(discountedUSD, currentCurrency)}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">30-day licensing window</div>
                    {isDiscountActive && (
                      <div className="text-[11px] font-mono text-zinc-500 line-through mt-0.5">
                        {formatPrice(originalUSD, currentCurrency)}
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-2 mb-6">
                    {p.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => !isDisabled && handleRenew(p.id)}
                  disabled={isDisabled}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${
                    isDisabled
                      ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                      : isCurrent || p.popular
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-black cursor-pointer'
                      : 'bg-white/10 hover:bg-white/20 text-white cursor-pointer'
                  }`}
                >
                  <span>{buttonLabel}</span>
                  {!isDisabled && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted LemonSqueezy Checkout • Automated Webhook +30d Extension</span>
          </div>
          <button onClick={onClose} className="hover:text-white underline cursor-pointer">
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
};
