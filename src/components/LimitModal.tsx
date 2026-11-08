import React from 'react';
import { CurrencyCode, RemoteConfig, User } from '../types';
import { LEMON_LINKS, LEMON_REDIRECT_URLS } from '../constants';
import { formatPrice } from '../utils/formatters';
import { 
  X, 
  Lock, 
  Sparkles, 
  Zap, 
  ArrowRight, 
  ShieldCheck, 
  Crown,
  CheckCircle2
} from 'lucide-react';

interface LimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  config: RemoteConfig;
  currentCurrency: CurrencyCode;
  onTestUnlock: (plan: 'starter' | 'pro' | 'enterprise') => void;
  onOpenPricing: () => void;
}

export const LimitModal: React.FC<LimitModalProps> = ({
  isOpen,
  onClose,
  user,
  config,
  currentCurrency,
  onTestUnlock,
  onOpenPricing,
}) => {
  if (!isOpen) return null;

  const isDiscountActive = config.discount.active && config.discount.percent > 0;
  const discountMultiplier = isDiscountActive ? 1 - config.discount.percent / 100 : 1;

  const handleCheckout = (plan: 'starter' | 'pro' | 'enterprise') => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-2xl rounded-[32px] glass-dropdown p-7 sm:p-10 border border-[#D4AF37]/40 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden">
        
        {/* Glow */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Banner */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-1 mx-auto mb-3 flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.25)]">
            <Lock className="w-7 h-7 text-[#D4AF37]" />
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider">
            Free Limit Reached
          </span>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-2">
            Upgrade to Continue Analysis
          </h3>
          <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
            You've used <strong className="text-white font-mono">3/3</strong> free analyses. Select an institutional subscription tier to unlock unlimited underwriting.
          </p>
        </div>

        {/* Pricing Options in Modal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          
          {/* Pro Card (Recommended) */}
          <div className="p-5 rounded-2xl bg-white/[0.04] border-2 border-[#D4AF37] relative flex flex-col justify-between shadow-[0_0_25px_rgba(212,175,55,0.15)]">
            <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-[#D4AF37] text-black text-[10px] font-mono font-black uppercase">
              RECOMMENDED
            </div>
            <div>
              <div className="flex items-center justify-between mb-2 mt-1">
                <span className="font-bold text-white text-base">Pro Terminal</span>
                <Zap className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {formatPrice(
                  isDiscountActive
                    ? Math.round(config.prices.pro * discountMultiplier)
                    : config.prices.pro,
                  currentCurrency
                )}
                <span className="text-xs font-normal text-zinc-400 font-sans"> / 30 days</span>
              </div>
              <p className="text-xs text-zinc-300 font-mono mb-3">
                400 Deep Analyses • Monte Carlo Stress Tests • Export Memoranda
              </p>
            </div>

            <button
              onClick={() => handleCheckout('pro')}
              className="w-full py-2.5 px-3 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>Unlock Pro Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Starter Card */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-base">Starter</span>
                <span className="text-[10px] text-zinc-400 font-mono">50 ANALYSES</span>
              </div>
              <div className="text-2xl font-black font-mono text-white mb-2">
                {formatPrice(
                  isDiscountActive
                    ? Math.round(config.prices.starter * discountMultiplier)
                    : config.prices.starter,
                  currentCurrency
                )}
                <span className="text-xs font-normal text-zinc-400 font-sans"> / 30 days</span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mb-3">
                Essential cross-border yields & tax rates across all 7 cities.
              </p>
            </div>

            <button
              onClick={() => handleCheckout('starter')}
              className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs font-mono uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Unlock Starter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => {
              onClose();
              onOpenPricing();
            }}
            className="text-xs text-zinc-400 hover:text-white underline font-mono cursor-pointer"
          >
            View all 3 pricing tiers & sovereign enterprise options &rarr;
          </button>
        </div>

      </div>

    </div>
  );
};
