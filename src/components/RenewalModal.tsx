import React from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import { PLANS, PricingPublicPayload, normalizePlanKey } from '../../lib/plans';
import { X, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  config: RemoteConfig;
  pricingData?: PricingPublicPayload | null;
  currentCurrency: CurrencyCode;
  onOpenLegal?: (slug: 'terms' | 'privacy' | 'refund' | 'disclaimer') => void;
  onOpenPricing?: () => void;
}

export const RenewalModal: React.FC<RenewalModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenPricing,
}) => {
  if (!isOpen) return null;

  const formatMMDDYYYY = (ms: number): string => {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
  };

  const userPlanKey = normalizePlanKey(user?.plan || 'free');
  const endsAtMs = user?.subscriptionEndsAt ?? user?.subscriptionExpiry ?? null;
  const msLeftForDay29 = endsAtMs ? endsAtMs - Date.now() : 0;
  const isDay29 =
    userPlanKey !== 'free' &&
    (Boolean(user?.day29Reminder) || (msLeftForDay29 > 0 && msLeftForDay29 <= 24 * 60 * 60 * 1000));
  const userPlanDisplay = user?.planName || PLANS[userPlanKey].displayName;
  const expiryDateDisplay = user?.expiryDateFormatted || (endsAtMs ? formatMMDDYYYY(endsAtMs) : '');
  const creditsBalance = Math.max(0, Number(user?.creditsBalance ?? user?.extraCredits ?? 0));

  const handleViewPricing = () => {
    onClose();
    if (onOpenPricing) {
      onOpenPricing();
    } else {
      window.history.pushState({}, '', '/#pricing');
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

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
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-xs font-mono text-[#D4AF37]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>30-DAY ONE-TIME ACCESS &bull; NO AUTO-RENEW</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Extend Your 30-Day Terminal Access
          </h3>

          <p className="text-sm text-zinc-300 leading-relaxed max-w-md mx-auto">
            All plans are one-time 30-day passes. No auto-renew. Extra Credits never expire.
          </p>

          <div
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-300 space-y-1.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <div>
              Current Plan: <strong className="text-white">{userPlanDisplay}</strong>
              {expiryDateDisplay ? (
                <span>
                  {' '}
                  &bull; Expires <strong className="text-[#D4AF37]">{expiryDateDisplay}</strong>
                </span>
              ) : null}
            </div>
            <div>
              Extra Credits Balance: <strong className="text-emerald-300">{creditsBalance} credits</strong> (never expire)
            </div>
          </div>

          {isDay29 && (
            <div
              className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-mono leading-relaxed"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              <strong className="text-white">Day 29 Expiry Reminder:</strong> Your {userPlanDisplay} pass expires tomorrow{' '}
              <strong className="text-white">{expiryDateDisplay}</strong>. Renew manually whenever ready &mdash; no automatic charge will occur.
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={handleViewPricing}
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
