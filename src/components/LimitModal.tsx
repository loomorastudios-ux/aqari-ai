import React from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import {
  PLANS,
  PricingPublicPayload,
  normalizePlanKey,
} from '../../lib/plans';
import {
  X,
  Lock,
  ArrowRight,
  Crown,
  ShieldCheck,
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
  onOpenPricing,
  mode = 'quota',
  onRequestEnterpriseDemo,
}) => {
  if (!isOpen) return null;

  const formatMMDDYYYY = (ms: number): string => {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

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
            <div
              className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-400"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              Custom limits, ERP/CRM integrations, White Label platform, and dedicated SLA configured per contract ($1,499/30-day one-time launch starting price &bull; No auto-renew).
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
  const creditsBalance = Math.max(0, Number(user?.creditsBalance ?? user?.extraCredits ?? 0));
  const endsAt = user?.subscriptionEndsAt ?? user?.subscriptionExpiry ?? null;
  const isPackageExpired =
    planKey !== 'free' &&
    (Boolean(user?.packageExpired) ||
      user?.status === 'expired' ||
      user?.subscriptionStatus === 'expired' ||
      Boolean(endsAt && Date.now() > endsAt));
  const isCreditsOnly = isPackageExpired && creditsBalance > 0;
  const expiryDateStr = user?.expiryDateFormatted || (endsAt ? formatMMDDYYYY(endsAt) : '');
  const creditsLeft = Math.max(0, Number(user?.analysesLeft ?? 0));
  const creditsTotal = Math.max(1, Number(user?.analysesTotal ?? (PLANS[planKey].analysesLimit || creditsLeft || 1)));

  const statusHeadline =
    planKey === 'free' && creditsLeft <= 0
      ? 'You used your 3 free analyses. View our plans or Extra Credits on the homepage to continue.'
      : isCreditsOnly
      ? `Your ${planDisplay} plan expired. You still have ${creditsBalance} Extra Credits. Extend a 30-day pass to unlock full tier features.`
      : isPackageExpired
      ? `Your ${planDisplay} pass expired${expiryDateStr ? ` on ${expiryDateStr}` : ''}. Renew manually when ready — no auto-charge was made.`
      : `Balance on ${planDisplay}: ${creditsLeft} / ${creditsTotal} analyses remaining.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-[32px] glass-dropdown p-7 sm:p-10 border border-[#D4AF37]/40 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden my-auto">
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-1 mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.25)]">
            <Lock className="w-7 h-7 text-[#D4AF37]" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider">
            {isPackageExpired ? `${planDisplay} 30-Day Pass Expired` : `${planDisplay} Quota / Access`}
          </span>

          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Extend Your 30-Day Terminal Access
          </h3>

          <p
            className="text-sm text-zinc-300 max-w-md mx-auto font-mono leading-relaxed"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {statusHeadline}
          </p>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-300">
            All plans are one-time 30-day passes. No auto-renew. Extra Credits never expire.
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPricing();
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-110 text-black font-black text-xs sm:text-sm font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(212,175,55,0.25)]"
            >
              <span>View Plans &amp; Pricing on Homepage</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-400 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Single pricing source at /#pricing
            </span>
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
