import React, { useState } from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import {
  PLANS,
  PricingPublicPayload,
  EXTRA_CREDIT_PACKS,
  findPlanPricing,
  normalizePlanKey,
} from '../../lib/plans';
import { formatPrice } from '../utils/formatters';
import {
  openPaddleCheckout,
  openPaddleCreditPackCheckout,
  CreditPackId,
  PADDLE_PRO_SUCCESS_MESSAGE,
} from '../utils/paddleClient';
import {
  X,
  Lock,
  Zap,
  ArrowRight,
  Coins,
  Loader2,
  Crown,
} from 'lucide-react';

interface LimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  config: RemoteConfig;
  pricingData?: PricingPublicPayload | null;
  currentCurrency: CurrencyCode;
  onTestUnlock: (plan: 'starter' | 'pro' | 'enterprise') => void;
  onOpenPricing: () => void;
  mode?: 'quota' | 'enterprise_showcase';
  onRequestEnterpriseDemo?: () => void;
}

export const LimitModal: React.FC<LimitModalProps> = ({
  isOpen,
  onClose,
  user,
  pricingData,
  currentCurrency,
  onOpenPricing,
  mode = 'quota',
  onRequestEnterpriseDemo,
}) => {
  const [refundAccepted, setRefundAccepted] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);

  if (!isOpen) return null;

  const launchActive = pricingData?.launchDiscountActive ?? true;
  const launchEndsAt = pricingData?.launchEndsAt || new Date('2026-11-28T23:59:59Z').getTime();
  const launchEndDateStr = new Date(launchEndsAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  if (mode === 'enterprise_showcase') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
        <div className="relative w-full max-w-xl rounded-[32px] glass-dropdown p-7 sm:p-10 border border-[#D4AF37]/50 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden my-auto">
          <div className="absolute top-0 right-1/4 w-64 h-64 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.25)]">
              <Crown className="w-7 h-7 text-[#D4AF37]" />
            </div>
            <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[11px] font-mono font-bold uppercase tracking-wider">
              ENTERPRISE CONTRACT SHOWCASE
            </span>
            <h3 className="text-2xl font-bold tracking-tight text-white">
              Enterprise Contract Access Required
            </h3>
            <p className="text-sm text-zinc-200 font-mono leading-relaxed max-w-md mx-auto">
              Enterprise showcase. Upgrade to Enterprise to unlock Portfolio Optimization + Custom Risk Models.
            </p>
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-400">
              Custom limits, ERP/CRM integrations, White Label platform, and dedicated SLA configured per contract ($1,499/mo launch starting price).
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onRequestEnterpriseDemo) {
                    onRequestEnterpriseDemo();
                  } else {
                    onOpenPricing();
                    window.dispatchEvent(new Event('aqari:open-enterprise-modal'));
                  }
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <span>Request Enterprise Demo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPricing();
                }}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs cursor-pointer"
              >
                Compare All Plans
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const planKey = normalizePlanKey(user?.plan || 'free');
  const planDisplay = PLANS[planKey].displayName;
  const creditsLeft = Math.max(0, Number(user?.analysesLeft ?? 0));
  const creditsTotal = Math.max(1, Number(user?.analysesTotal ?? (PLANS[planKey].analysesLimit || creditsLeft || 1)));

  const starterPlan = findPlanPricing(pricingData, 'starter');
  const proPlan = findPlanPricing(pricingData, 'pro');
  const starterUSD = starterPlan?.activePrice ?? (launchActive ? PLANS.starter.launchPrice : PLANS.starter.originalPrice);
  const proUSD = proPlan?.activePrice ?? (launchActive ? PLANS.pro.launchPrice : PLANS.pro.originalPrice);
  const starterOrigUSD = starterPlan?.originalPrice ?? PLANS.starter.originalPrice;
  const proOrigUSD = proPlan?.originalPrice ?? PLANS.pro.originalPrice;
  const starterAnalyses = starterPlan?.analysesLimit ?? PLANS.starter.analysesLimit;
  const proAnalyses = proPlan?.analysesLimit ?? PLANS.pro.analysesLimit;

  const handlePaddleCheckout = async (plan: 'starter' | 'pro' | 'enterprise') => {
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
          console.error('[Paddle] Checkout failed in LimitModal:', msg);
          setCheckoutNotice(msg);
        },
      });
    } catch (err: any) {
      console.error('[Paddle] Checkout exception in LimitModal:', err);
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
          setCheckoutSuccess(data?.message || `Added extra AI credits (${data?.analyses_left ?? ''} left).`);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-[32px] glass-dropdown p-7 sm:p-10 border border-[#D4AF37]/40 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden my-auto">
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Banner */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-1 mx-auto mb-3 flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.25)]">
            <Lock className="w-7 h-7 text-[#D4AF37]" />
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider">
            {planDisplay} Credits / Quota Reached
          </span>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-2">
            Upgrade Tier or Add Extra Credits
          </h3>
          <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
            Balance on <strong className="text-white font-mono">{planDisplay}</strong>:{' '}
            <strong className="text-[#D4AF37] font-mono">{creditsLeft} / {creditsTotal}</strong> AI credits remaining.
            Upgrade below or add an extra credit pack.
          </p>
        </div>

        {/* Extra Credit Pack Bar */}
        <div className="mb-5 p-3.5 rounded-2xl bg-white/[0.03] border border-[#D4AF37]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-200">
            <Coins className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>Buy Extra AI Credits:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXTRA_CREDIT_PACKS.map((pk) => (
              <button
                key={pk.id}
                type="button"
                disabled={buyingPackId === pk.id}
                onClick={() => handleBuyCreditPack(pk.id)}
                className="px-2.5 py-1.5 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-mono font-bold cursor-pointer"
              >
                {buyingPackId === pk.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  `${pk.label} (${formatPrice(pk.priceUSD, currentCurrency)})`
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Pricing Options in Modal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* Pro Card (Recommended) */}
          <div className="p-5 rounded-2xl bg-white/[0.04] border-2 border-[#D4AF37] relative flex flex-col justify-between shadow-[0_0_25px_rgba(212,175,55,0.15)]">
            <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-[#D4AF37] text-black text-[10px] font-mono font-black uppercase">
              MAIN MARKETING PLAN
            </div>
            <div>
              <div className="flex items-center justify-between mb-2 mt-1">
                <span className="font-bold text-white text-base">PROFESSIONAL</span>
                <Zap className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-2xl font-black font-mono text-white mb-1">
                {launchActive && proOrigUSD > proUSD && (
                  <span className="text-xs text-zinc-500 line-through mr-2">
                    {formatPrice(proOrigUSD, currentCurrency)}
                  </span>
                )}
                {formatPrice(proUSD, currentCurrency)}
                <span className="text-xs font-normal text-zinc-400 font-sans"> / 30 days</span>
              </div>
              <div className="text-[10px] font-mono text-amber-200/90 mb-2">
                Renews at {formatPrice(proOrigUSD, currentCurrency)}/mo after launch (ends {launchEndDateStr})
              </div>
              <p className="text-xs text-zinc-300 font-mono mb-3">
                {proAnalyses} Analyses/mo • AI Due Diligence • Portfolio Optimizer • Memorandum PDF • Limited API (100/day)
              </p>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => handlePaddleCheckout('pro')}
                className="w-full py-2.5 px-3 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Unlock PROFESSIONAL</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Starter Card */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-base">STARTER</span>
                <span className="text-[10px] text-zinc-400 font-mono">{starterAnalyses} ANALYSES/MO</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-1">
                {launchActive && starterOrigUSD > starterUSD && (
                  <span className="text-xs text-zinc-500 line-through mr-2">
                    {formatPrice(starterOrigUSD, currentCurrency)}
                  </span>
                )}
                {formatPrice(starterUSD, currentCurrency)}
                <span className="text-xs font-normal text-zinc-400 font-sans"> / 30 days</span>
              </div>
              <div className="text-[10px] font-mono text-amber-200/90 mb-2">
                Renews at {formatPrice(starterOrigUSD, currentCurrency)}/mo after launch (ends {launchEndDateStr})
              </div>
              <p className="text-xs text-zinc-400 font-mono mb-3">
                DSCR, Cash-on-Cash, IRR, 5 Investment PDFs, Deal Finder, Market Radar &amp; MC 1,000 cycles.
              </p>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => handlePaddleCheckout('starter')}
                className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Unlock STARTER</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <div className="text-[10px] font-mono text-zinc-400 text-center">
                7-Day Refund - 0 successful analyses or unresolved issue
              </div>
            </div>
          </div>
        </div>

        {/* Required Checkout Agreement Checkbox */}
        <div
          className={`mb-4 p-3 rounded-xl border text-xs font-mono ${
            policyError
              ? 'bg-rose-950/40 border-rose-500 text-rose-200'
              : 'bg-white/[0.03] border-white/10 text-zinc-300'
          }`}
        >
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
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
              I agree to the{' '}
              <strong className="text-[#D4AF37]">7-Day No-Usage Refund Policy (0 successful analyses)</strong>
              {policyError && (
                <span className="block text-rose-300 mt-0.5 font-bold">
                  Please agree to the refund policy first.
                </span>
              )}
            </span>
          </label>
        </div>

        {checkoutSuccess && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-mono font-bold text-emerald-200 text-center">
            {checkoutSuccess}
          </div>
        )}

        {checkoutNotice && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs font-mono text-amber-200 text-center">
            {checkoutNotice}
          </div>
        )}

        <div className="text-center mt-2">
          <button
            onClick={() => {
              onClose();
              onOpenPricing();
            }}
            className="text-xs text-zinc-400 hover:text-white underline font-mono cursor-pointer"
          >
            View all 5 tiers (FREE, STARTER, PROFESSIONAL, SOVEREIGN, ENTERPRISE) &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
