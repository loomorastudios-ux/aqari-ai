import React, { useState } from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import { LEMON_LINKS } from '../constants';
import { PLANS, PricingPublicPayload, findPlanPricing } from '../../lib/plans';
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
  pricingData?: PricingPublicPayload | null;
  currentCurrency: CurrencyCode;
}

export const RenewalModal: React.FC<RenewalModalProps> = ({
  isOpen,
  onClose,
  user,
  config,
  pricingData,
  currentCurrency,
}) => {
  const [refundAccepted, setRefundAccepted] = useState(false);
  const [policyError, setPolicyError] = useState(false);

  if (!isOpen) return null;

  const launchActive = pricingData?.launchDiscountActive ?? true;
  const starterPricing = findPlanPricing(pricingData, 'starter');
  const proPricing = findPlanPricing(pricingData, 'pro');
  const enterprisePricing = findPlanPricing(pricingData, 'enterprise');

  const handleRenew = async (plan: 'starter' | 'pro' | 'enterprise') => {
    if (!refundAccepted) {
      setPolicyError(true);
      return;
    }
    setPolicyError(false);

    const baseLink = LEMON_LINKS[plan];
    const successUrl = 'https://aqari-ai-rho.vercel.app/app?checkout=success';
    const cancelUrl = 'https://aqari-ai-rho.vercel.app/pricing?checkout=cancelled';

    if (user?.email) {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            email: user.email,
            userId: user.id || user.googleId,
            refundAcceptedAt: new Date().toISOString(),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        }
      } catch {}
    }

    const params = new URLSearchParams();
    if (user) {
      params.set('checkout[custom][user_id]', user.id || user.googleId || '');
      params.set('checkout[custom][plan]', plan);
      params.set('checkout[email]', user.email);
    }
    params.set('checkout[redirect_url]', successUrl);
    params.set('checkout[cancel_url]', cancelUrl);
    window.location.href = `${baseLink}?${params.toString()}`;
  };

  const plans: Array<{
    id: 'starter' | 'pro' | 'enterprise';
    name: string;
    originalUSD: number;
    activeUSD: number;
    popular?: boolean;
    icon: React.ReactNode;
    features: string[];
    limits: string;
  }> = [
    {
      id: 'starter',
      name: 'Starter Terminal',
      originalUSD: starterPricing?.originalPrice ?? PLANS.starter.originalPrice,
      activeUSD: starterPricing?.activePrice ?? (launchActive ? PLANS.starter.launchPrice : PLANS.starter.originalPrice),
      icon: <Building2 className="w-5 h-5 text-zinc-300" />,
      limits: `${starterPricing?.analysesLimit ?? PLANS.starter.analysesLimit} Analyses / 30 Days`,
      features: starterPricing?.features ?? PLANS.starter.features,
    },
    {
      id: 'pro',
      name: 'Professional Terminal',
      originalUSD: proPricing?.originalPrice ?? PLANS.pro.originalPrice,
      activeUSD: proPricing?.activePrice ?? (launchActive ? PLANS.pro.launchPrice : PLANS.pro.originalPrice),
      popular: true,
      icon: <Zap className="w-5 h-5 text-[#D4AF37]" />,
      limits: `${proPricing?.analysesLimit ?? PLANS.pro.analysesLimit} Analyses / 30 Days`,
      features: proPricing?.features ?? PLANS.pro.features,
    },
    {
      id: 'enterprise',
      name: 'Sovereign Enterprise',
      originalUSD: enterprisePricing?.originalPrice ?? PLANS.enterprise.originalPrice,
      activeUSD: enterprisePricing?.activePrice ?? (launchActive ? PLANS.enterprise.launchPrice : PLANS.enterprise.originalPrice),
      icon: <Crown className="w-5 h-5 text-purple-400" />,
      limits: `${enterprisePricing?.analysesLimit ?? PLANS.enterprise.analysesLimit} Analyses / 30 Days`,
      features: enterprisePricing?.features ?? PLANS.enterprise.features,
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

          {launchActive && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <Flame className="w-3.5 h-3.5" />
              <span>{pricingData?.launchBadgeText || 'LAUNCH -40% - First 30 users only'} • Offer ends in {pricingData?.daysRemaining ?? 7} days</span>
            </div>
          )}
        </div>

        {/* 3 Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 overflow-y-auto pr-1">
          {plans.map((p) => {
            const originalUSD = p.originalUSD;
            const discountedUSD = p.activeUSD;
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
                    {launchActive && originalUSD > discountedUSD && (
                      <div className="text-[11px] font-mono text-zinc-500 line-through mb-0.5">
                        {formatPrice(originalUSD, currentCurrency)}
                      </div>
                    )}
                    <div className="text-3xl font-black font-mono text-white">
                      {formatPrice(discountedUSD, currentCurrency)}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">30-day licensing window</div>
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

                <div className="space-y-1.5">
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
                  <div className="text-[10px] font-mono text-zinc-400 text-center">
                    5-7 Day Refund - If technical issue, max 3 analyses
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Required Refund Policy Consent */}
        <div className={`mb-4 p-3.5 rounded-2xl border transition ${
          policyError
            ? 'bg-rose-950/40 border-rose-500 text-rose-200'
            : 'bg-white/[0.03] border-white/10 text-zinc-200'
        }`}>
          <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs font-mono">
            <input
              type="checkbox"
              checked={refundAccepted}
              onChange={(e) => {
                setRefundAccepted(e.target.checked);
                if (e.target.checked) setPolicyError(false);
              }}
              className="mt-0.5 w-4 h-4 accent-[#D4AF37] cursor-pointer shrink-0"
            />
            <span>
              I agree to the <strong className="text-[#D4AF37]">5-7 Day Refund Policy - Max 3 analyses</strong>
              {policyError && <span className="block text-rose-300 mt-0.5 font-bold">Please check this box before continuing to checkout.</span>}
            </span>
          </label>
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
