import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { User, CurrencyCode } from '../types';
import { PLAN_LIMITS } from '../constants';
import { getUser, saveUser, getSessionUser, loginOrCreateUser } from '../utils/userStorage';
import { 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  ArrowRight, 
  Zap, 
  Clock, 
  FileText 
} from 'lucide-react';

interface PaymentSuccessViewProps {
  currentUser: User | null;
  onEnterTerminal: () => void;
  onGoToHome: () => void;
}

export const PaymentSuccessView: React.FC<PaymentSuccessViewProps> = ({
  currentUser,
  onEnterTerminal,
  onGoToHome,
}) => {
  const [activatedUser, setActivatedUser] = useState<User | null>(currentUser);
  const [planKey, setPlanKey] = useState<'starter' | 'pro' | 'enterprise'>('pro');

  useEffect(() => {
    // 1. Fire celebration confetti
    try {
      confetti({
        particleCount: 180,
        spread: 90,
        origin: { y: 0.55 },
        colors: ['#D4AF37', '#F3E5AB', '#8B5CF6', '#10B981'],
      });
    } catch {}

    // 2. Parse query parameters
    const params = new URLSearchParams(window.location.search);
    const planParam = (params.get('plan') as 'starter' | 'pro' | 'enterprise') || 'pro';
    const emailParam = params.get('email') || currentUser?.email || 'investor@global-capital.io';
    setPlanKey(planParam);

    // 3. Activate 30-day subscription
    const now = Date.now();
    const duration30Days = 30 * 24 * 60 * 60 * 1000;
    const endsAt = now + duration30Days;
    const planQuota = PLAN_LIMITS[planParam]?.analyses || 150;

    let userToUpdate = currentUser || getUser(emailParam);
    if (!userToUpdate) {
      const { user: newUser } = loginOrCreateUser(emailParam, 'google');
      userToUpdate = newUser;
    }

    const updatedUser: User = {
      ...userToUpdate,
      plan: planParam,
      subscriptionPlan: planParam,
      subscriptionStatus: 'active',
      subscriptionStartAt: now,
      subscriptionEndsAt: endsAt,
      subscriptionExpiry: endsAt,
      analysesUsed: 0,
      freeAnalyses: planQuota,
      freeAnalysesLeft: planQuota,
      analysesLeft: planQuota,
      expiryEmailSent: false,
    };

    saveUser(updatedUser);
    setActivatedUser(updatedUser);

    fetch('/api/app?action=license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: updatedUser.email,
        name: updatedUser.name,
        plan: planParam,
        license_start: now,
        license_end: endsAt,
        analyses_used: 0,
      }),
    }).catch(() => {});
  }, []);

  const planInfo = PLAN_LIMITS[planKey] || PLAN_LIMITS.pro;
  const endsAtFormatted = activatedUser?.subscriptionEndsAt 
    ? new Date(activatedUser.subscriptionEndsAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '30 Days from today';

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-xl rounded-[36px] glass-panel border border-[#D4AF37]/40 p-8 sm:p-12 shadow-[0_20px_90px_rgba(212,175,55,0.25)] text-center animate-in zoom-in-95 duration-300">
        
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] p-0.5 mx-auto mb-6 shadow-[0_0_30px_rgba(212,175,55,0.5)]">
          <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#D4AF37]" />
          </div>
        </div>

        {/* Title */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>PAYMENT VERIFIED • 30 DAYS ACTIVE</span>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
          Subscription Activated!
        </h1>
        
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-8 leading-relaxed">
          Your payment was processed successfully via Lemon Squeezy. Your institutional license is unlocked and ready for underwriting.
        </p>

        {/* Subscription Details Box */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5 text-left mb-8">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Account:</span>
            <span className="text-white font-semibold truncate max-w-[200px]">{activatedUser?.email}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Plan:</span>
            <span className="text-[#D4AF37] font-bold uppercase">{planInfo.label}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Analyses Quota:</span>
            <span className="text-emerald-400 font-bold">{planInfo.analyses} Institutional Analyses</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Subscription Status:</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase">
              Active (30 Days)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono border-t border-white/[0.08] pt-2">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>Valid Until:</span>
            </span>
            <span className="text-white font-bold">{endsAtFormatted}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={onEnterTerminal}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#B8860B] hover:brightness-110 text-black font-black text-sm font-mono tracking-wider transition-all shadow-[0_0_30px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2 cursor-pointer active:scale-98 min-h-[48px]"
          >
            <span>LAUNCH TERMINAL NOW</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onGoToHome}
            className="w-full py-3 text-xs font-mono text-zinc-400 hover:text-white transition cursor-pointer"
          >
            ← Back to Aqari Home
          </button>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-[11px] font-mono text-zinc-400 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Receipt and invoice sent to your email by Lemon Squeezy</span>
        </div>

      </div>
    </div>
  );
};
