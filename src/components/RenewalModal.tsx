import React, { useState } from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import {
  PLANS,
  PricingPublicPayload,
  EXTRA_CREDIT_PACKS,
  DEFAULT_LAUNCH_END_DATE_MS,
  findPlanPricing,
} from '../../lib/plans';
import { formatPrice, getDaysRemaining } from '../utils/formatters';
import {
  openPaddleCheckout,
  openPaddleCreditPackCheckout,
  CreditPackId,
  PADDLE_PRO_SUCCESS_MESSAGE,
} from '../utils/paddleClient';
import {
  X,
  Sparkles,
  Zap,
  Crown,
  Building2,
  Check,
  ArrowRight,
  ShieldCheck,
  Flame,
  Coins,
  Loader2,
} from 'lucide-react';

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  config: RemoteConfig;
  pricingData?: PricingPublicPayload | null;
  currentCurrency: CurrencyCode;
  onOpenLegal?: (slug: 'terms' | 'privacy' | 'refund' | 'disclaimer') => void;
}

export const RenewalModal: React.FC<RenewalModalProps> = ({
  isOpen,
  onClose,
  user,
  pricingData,
  currentCurrency,
  onOpenLegal,
}) => {
  const [refundAccepted, setRefundAccepted] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);

  if (!isOpen) return null;

  const launchActive = pricingData?.launchDiscountActive ?? true;
  const launchEndsAt = pricingData?.launchEndsAt || DEFAULT_LAUNCH_END_DATE_MS;
  const formatDDMMYYYY = (ms: number): string => {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  };
  const launchEndDateStr = formatDDMMYYYY(launchEndsAt);
  const starterPricing = findPlanPricing(pricingData, 'starter');
  const proPricing = findPlanPricing(pricingData, 'pro');
  const enterprisePricing = findPlanPricing(pricingData, 'enterprise');

  const userPlanKey = user?.plan || 'free';
  const endsAtMs = user?.subscriptionEndsAt ?? user?.subscriptionExpiry ?? null;
  const msLeftForDay29 = endsAtMs ? endsAtMs - Date.now() : 0;
  const isDay29 =
    userPlanKey !== 'free' &&
    (Boolean(user?.day29Reminder) || (msLeftForDay29 > 0 && msLeftForDay29 <= 24 * 60 * 60 * 1000));
  const userPlanDisplay = user?.planName || PLANS[userPlanKey === 'pro' || userPlanKey === 'starter' || userPlanKey === 'enterprise' || userPlanKey === 'institutional' ? userPlanKey : 'free'].displayName;
  const expiryDateDisplay = user?.expiryDateFormatted || (endsAtMs ? formatDDMMYYYY(endsAtMs) : '');

  const handleRenewPaddle = async (plan: 'starter' | 'pro' | 'enterprise') => {
    if (!refundAccepted) {
      setPolicyError(true);
      return;
    }
    setPolicyError(false);
    setCheckoutNotice(null);
    setCheckoutSuccess(null);

    try {
      await openPaddleCheckout({
        plan,
        email: user?.email,
        userId: user?.id || user?.googleId,
        refundAcceptedAt: new Date().toISOString(),
        onVerified: (verifyData) => {
          setCheckoutSuccess(verifyData?.message || PADDLE_PRO_SUCCESS_MESSAGE);
        },
        onError: (msg) => {
          console.error('[Paddle] Checkout failed in RenewalModal:', msg);
          setCheckoutNotice(msg);
        },
      });
    } catch (err: any) {
      console.error('[Paddle] Checkout exception in RenewalModal:', err);
      setCheckoutNotice(err?.message || 'Unable to launch Paddle Checkout.');
    }
  };

  const handleBuyCreditPack = async (packId: CreditPackId) => {
    if (!user?.email) return;
    setBuyingPackId(packId);
    setCheckoutNotice(null);
    setCheckoutSuccess(null);
    try {
      await openPaddleCreditPackCheckout({
        packId,
        email: user.email,
        userId: user.id || user.googleId,
        refundAcceptedAt: new Date().toISOString(),
        onVerified: (data) => {
          setBuyingPackId(null);
          setCheckoutSuccess(data?.message || `Added credits. Balance: ${data?.analyses_left ?? ''} credits.`);
        },
        onError: (msg) => {
          setBuyingPackId(null);
          setCheckoutNotice(msg);
        },
        onClose: () => {
          setBuyingPackId(null);
        },
      });
    } catch (err: any) {
      setBuyingPackId(null);
      setCheckoutNotice(err?.message || 'Unable to launch Paddle Checkout for credit pack.');
    }
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
      name: 'STARTER',
      originalUSD: starterPricing?.originalPrice ?? PLANS.starter.originalPrice,
      activeUSD: starterPricing?.activePrice ?? (launchActive ? PLANS.starter.launchPrice : PLANS.starter.originalPrice),
      icon: <Building2 className="w-5 h-5 text-zinc-300" />,
      limits: `${starterPricing?.analysesLimit ?? PLANS.starter.analysesLimit} Analyses / 30 Days`,
      features: starterPricing?.features ?? PLANS.starter.features,
    },
    {
      id: 'pro',
      name: 'PROFESSIONAL',
      originalUSD: proPricing?.originalPrice ?? PLANS.pro.originalPrice,
      activeUSD: proPricing?.activePrice ?? (launchActive ? PLANS.pro.launchPrice : PLANS.pro.originalPrice),
      popular: true,
      icon: <Zap className="w-5 h-5 text-[#D4AF37]" />,
      limits: `${proPricing?.analysesLimit ?? PLANS.pro.analysesLimit} Analyses / 30 Days`,
      features: proPricing?.features ?? PLANS.pro.features,
    },
    {
      id: 'enterprise',
      name: 'SOVEREIGN',
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
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-xs font-mono text-[#D4AF37] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>30-DAY ONE-TIME ACCESS • NO AUTO-RENEW</span>
          </div>
          <h3 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Extend Your 30-Day Terminal Access
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-lg mx-auto">
            All plans are one-time 30-day purchases with no automatic charges. Purchased Extra Credits never expire.
          </p>

          {isDay29 && (
            <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-mono leading-relaxed tabular-nums">
              <strong className="text-white">Day 29 Expiry Reminder:</strong> Your {userPlanDisplay} expires tomorrow{' '}
              <strong className="text-white">{expiryDateDisplay}</strong>. Renew now to keep access. No auto-charge will happen.
            </div>
          )}

          {launchActive && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono tabular-nums">
              <Flame className="w-3.5 h-3.5" />
              <span>
                {pricingData?.launchBadgeText || 'LAUNCH OFFER'} • Ends {launchEndDateStr} ({pricingData?.daysRemaining ?? 7} days left)
              </span>
            </div>
          )}
        </div>

        {/* 3 Paid Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5 overflow-y-auto pr-1">
          {plans.map((p) => {
            const originalUSD = p.originalUSD;
            const discountedUSD = p.activeUSD;
            const isCurrent = user?.plan === p.id && user?.subscriptionStatus !== 'expired';
            const daysRemaining = user?.subscriptionExpiry ? getDaysRemaining(user.subscriptionExpiry) : 30;
            const tierDisplayName = p.name;

            let badgeText: string | null = null;
            let buttonLabel =
              user && user.plan !== 'free'
                ? `Switch to ${tierDisplayName}`
                : `Buy ${tierDisplayName}`;

            if (isCurrent) {
              badgeText = `Current Plan: ${tierDisplayName} • ${daysRemaining}d left`;
              buttonLabel = `Renew ${tierDisplayName} (+30 Days)`;
            } else if (p.popular) {
              badgeText = 'MAIN MARKETING PLAN';
            }

            return (
              <div
                key={p.id}
                className={`p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                  isCurrent
                    ? 'bg-gradient-to-b from-white/[0.08] to-white/[0.02] border-2 border-[#D4AF37] shadow-[0_0_35px_rgba(212,175,55,0.25)]'
                    : p.popular
                    ? 'bg-white/[0.05] border-2 border-[#D4AF37]/80 shadow-[0_0_35px_rgba(212,175,55,0.2)]'
                    : 'bg-white/[0.02] border border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
                      {p.icon}
                    </div>
                    {badgeText && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase tracking-wider ${
                          isCurrent
                            ? 'bg-[#D4AF37] text-black shadow-sm'
                            : 'bg-white/10 text-zinc-300 border border-white/10'
                        }`}
                      >
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
                    <div className="text-[10px] font-mono text-amber-200/90 mt-1">
                      One-time 30-day rate (Std {formatPrice(originalUSD, currentCurrency)} after launch ends {launchEndDateStr}) • No auto-renew
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-1.5 mb-5">
                    {p.features.slice(0, 8).map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <button
                    onClick={() => handleRenewPaddle(p.id)}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${
                      isCurrent || p.popular
                        ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-black cursor-pointer'
                        : 'bg-white/10 hover:bg-white/20 text-white cursor-pointer'
                    }`}
                  >
                    <span>{buttonLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-[10px] font-mono text-zinc-400 text-center">
                    7-Day Refund - 0 successful analyses or unresolved tool issue
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Extra AI Credit Top-Ups */}
        <div className="mb-4 p-3 rounded-2xl bg-black/40 border border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
            <Coins className="w-4 h-4 text-[#D4AF37]" />
            <span>Extra Credits (Never Expire):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXTRA_CREDIT_PACKS.map((pk) => (
              <button
                key={pk.id}
                type="button"
                disabled={buyingPackId === pk.id}
                onClick={() => handleBuyCreditPack(pk.id)}
                className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-mono font-bold cursor-pointer flex items-center gap-1"
              >
                {buyingPackId === pk.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span>
                    {pk.label} ({formatPrice(pk.priceUSD, currentCurrency)})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Required Refund Policy Consent */}
        <div
          className={`mb-4 p-3.5 rounded-2xl border transition ${
            policyError
              ? 'bg-rose-950/40 border-rose-500 text-rose-200'
              : 'bg-white/[0.03] border-white/10 text-zinc-200'
          }`}
        >
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
              By purchasing, you agree to{' '}
              <a
                href="/refund-policy"
                onClick={(e) => {
                  e.preventDefault();
                  onClose();
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
              </a>
              {policyError && (
                <span className="block text-rose-300 mt-0.5 font-bold">
                  Please check this box before continuing to checkout.
                </span>
              )}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 font-mono">
          <div className="flex flex-wrap items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {checkoutSuccess && (
              <span className="text-emerald-300 font-bold mr-2">{checkoutSuccess}</span>
            )}
            {checkoutNotice && (
              <span className="text-amber-300 font-bold mr-2">{checkoutNotice}</span>
            )}
            <span>
              Encrypted Paddle Checkout • Enterprise Contracts ($1,499+ Launch) available on Pricing page
            </span>
          </div>
          <button onClick={onClose} className="hover:text-white underline cursor-pointer">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
