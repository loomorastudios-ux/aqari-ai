import React, { useState, useRef, useEffect } from 'react';
import { CurrencyCode, User, RemoteConfig } from '../types';
import { CURRENCY_SYMBOLS, LEMON_LINKS } from '../constants';
import { getDaysRemaining } from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  Globe2, 
  ChevronDown, 
  Sparkles, 
  LogOut, 
  Settings, 
  Check, 
  ShieldCheck, 
  Flame,
  AlertTriangle,
  RefreshCw,
  Zap,
  Menu,
  X
} from 'lucide-react';

interface NavbarProps {
  currentCurrency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
  user: User | null;
  config: RemoteConfig;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenAdmin: () => void;
  onGoToTerminal: () => void;
  onOpenPricing: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentCurrency,
  onCurrencyChange,
  user,
  config,
  onOpenAuth,
  onSignOut,
  onOpenAdmin,
  onGoToTerminal,
  onOpenPricing,
}) => {
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currencies: CurrencyCode[] = ['USD', 'OMR', 'AED', 'GBP'];
  const activeCurrencyInfo = CURRENCY_SYMBOLS[currentCurrency];

  const daysLeft = user?.subscriptionExpiry ? getDaysRemaining(user.subscriptionExpiry) : 0;
  const msLeft = user?.subscriptionExpiry ? user.subscriptionExpiry - Date.now() : 0;
  const isExpired = Boolean(user && user.plan !== 'free' && user.subscriptionExpiry && Date.now() > user.subscriptionExpiry);
  const isExpiringIn1Day = Boolean(user && user.plan !== 'free' && user.subscriptionExpiry && msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000);

  const freeLeft = user?.plan === 'free' 
    ? (user.freeAnalysesLeft ?? user.freeAnalyses ?? 0)
    : (user?.analysesLeft ?? user?.freeAnalysesLeft ?? user?.freeAnalyses ?? 0);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* 1-Day Expiration Reminder Top Banner */}
      {isExpiringIn1Day && (
        <div className="bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white text-xs font-semibold py-2 px-4 flex items-center justify-between shadow-lg animate-pulse z-50">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            <span>
              ⚠️ Your <strong className="uppercase">{user?.plan}</strong> subscription ends in 1 day (Tomorrow) — Renew now to keep terminal access without interruption.
            </span>
          </div>
          <a
            href={LEMON_LINKS[user?.plan === 'free' ? 'pro' : (user?.plan || 'pro')]}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-black text-[#D4AF37] hover:bg-zinc-900 rounded text-xs font-mono font-bold transition shrink-0 ml-2"
          >
            Renew Now &rarr;
          </a>
        </div>
      )}

      {/* Top Remote Discount Banner if active */}
      {!isExpiringIn1Day && config.discount.active && (
        <div className="bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] text-black text-xs font-semibold py-1.5 px-4 text-center tracking-wide flex items-center justify-center gap-2 shadow-lg animate-pulse">
          <Flame className="w-4 h-4 fill-amber-900 text-amber-900" />
          <span>{config.discount.banner}</span>
          <span className="bg-black text-[#D4AF37] px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ml-1">
            CODE: {config.discount.code} (-{config.discount.percent}%)
          </span>
          <button 
            onClick={onOpenPricing}
            className="ml-3 underline font-bold hover:opacity-80 transition cursor-pointer text-[11px]"
          >
            Claim Offer &rarr;
          </button>
        </div>
      )}

      {/* Subscription Expired Warning Banner */}
      {isExpired && (
        <div className="bg-rose-950/95 border-b border-rose-500/50 text-rose-200 text-xs py-2 px-4 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Subscription expired — Renew to continue accessing institutional feeds and underwriting.
            </span>
          </div>
          <a
            href={LEMON_LINKS[user?.plan === 'free' ? 'pro' : (user?.plan || 'pro')]}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold transition shrink-0 ml-2"
          >
            Renew Subscription
          </a>
        </div>
      )}

      {/* Main Navigation Bar */}
      <nav className="bg-black/80 backdrop-blur-2xl border-b border-white/[0.08] px-3 sm:px-4 lg:px-8 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          
          {/* Brand Logo & Bloomberg Status Indicator */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <a href="#" className="flex items-center gap-2 sm:gap-2.5 group">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#B8860B] to-[#996515] p-0.5 shadow-[0_0_15px_rgba(212,175,55,0.4)] group-hover:shadow-[0_0_25px_rgba(212,175,55,0.7)] transition-all duration-300 shrink-0">
                <div className="w-full h-full bg-black rounded-[10px] flex items-center justify-center">
                  <span className="font-mono font-black text-xs sm:text-sm text-[#D4AF37] tracking-tighter">AQ</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold tracking-tight text-white text-sm sm:text-base lg:text-lg group-hover:text-[#D4AF37] transition whitespace-nowrap">
                    AQARI
                  </span>
                  <span className="text-[9px] sm:text-[10px] uppercase font-mono px-1 sm:px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 tracking-wider hidden xs:inline-block">
                    TERMINAL
                  </span>
                </div>
                <div className="text-[9px] sm:text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">BLOOMBERG EDITION v2.6 • </span>
                  <span className="text-emerald-400 font-semibold">LIVE</span>
                </div>
              </div>
            </a>

            {/* Quick Links */}
            <div className="hidden xl:flex items-center gap-1 ml-6 text-xs text-zinc-400 font-medium">
              <a href="#properties" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">
                Asset Intelligence
              </a>
              <a href="#yield-simulator" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">
                Yield Simulator
              </a>
              <a href="#matrix" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">
                Cross-Border Matrix
              </a>
              <a href="#portfolio" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition">
                Portfolio AUM
              </a>
              <a href="#pricing" className="px-3 py-1.5 rounded-lg text-[#D4AF37] hover:bg-[#D4AF37]/10 transition font-semibold">
                Pricing Tiers
              </a>
            </div>
          </div>

          {/* Controls: Currency Switcher & User Auth */}
          <div className="flex items-center gap-3">
            
            {/* Custom Glass Currency Switcher */}
            <div className="relative" ref={currencyRef}>
              <button
                type="button"
                onClick={() => setCurrencyOpen(!currencyOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#D4AF37]/50 text-xs font-medium text-white transition-all duration-200 cursor-pointer shadow-sm group min-h-[40px] sm:min-h-[44px]"
                aria-label="Select currency"
              >
                <Globe2 className="w-3.5 h-3.5 text-[#D4AF37] hidden xs:inline-block" />
                <span className="text-sm">{activeCurrencyInfo.flag}</span>
                <span className="font-mono font-semibold tracking-wide text-xs">{currentCurrency}</span>
                <span className="text-zinc-400 text-[10px] font-mono hidden md:inline">({activeCurrencyInfo.symbol})</span>
                <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-400 transition-transform duration-200 ${currencyOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Glass Dropdown Menu */}
              {currencyOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl glass-dropdown p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase text-zinc-400 tracking-wider border-b border-white/[0.06] mb-1">
                    Select Base Currency
                  </div>
                  {currencies.map((c) => {
                    const info = CURRENCY_SYMBOLS[c];
                    const isSelected = currentCurrency === c;
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          onCurrencyChange(c);
                          setCurrencyOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4AF37]/15 text-[#D4AF37] font-semibold'
                            : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{info.flag}</span>
                          <span className="font-mono">{info.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#D4AF37]" />}
                      </button>
                    );
                  })}
                  <div className="px-2.5 py-1 text-[10px] text-zinc-400 border-t border-white/[0.06] mt-1 font-mono">
                    Live peg: 1 USD = 0.385 OMR
                  </div>
                </div>
              )}
            </div>

            {/* Trial Status or Plan Badge */}
            {user ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                {user.plan === 'free' ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400 font-mono">Free analyses:</span>
                    <span className={`font-mono font-bold ${freeLeft > 0 ? 'text-[#D4AF37]' : 'text-rose-400'}`}>
                      {freeLeft}/3
                    </span>
                    {/* 3 Dots: filled gold = remaining, grey = used */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((dot) => {
                        const isAvailable = dot <= freeLeft;
                        return (
                          <span
                            key={dot}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${
                              isAvailable
                                ? 'bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]'
                                : 'bg-zinc-700'
                            }`}
                            title={isAvailable ? 'Analysis Credit Available' : 'Credit Used'}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : isExpiringIn1Day ? (
                  <button
                    onClick={onOpenPricing}
                    className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-lg bg-red-950/80 border border-red-500/60 text-red-300 hover:text-white transition animate-pulse cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-red-400 font-bold uppercase tracking-wider">
                      {user.plan} • 1d left - Renew
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-bold uppercase tracking-wider">
                      {user.plan}
                    </span>
                    <span className="text-zinc-400">•</span>
                    <span className="text-zinc-300 font-medium">
                      {daysLeft}d left
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {/* User Auth Button / User Dropdown */}
            {!user ? (
              <button
                type="button"
                onClick={onOpenAuth}
                className="relative inline-flex items-center justify-center p-0.5 overflow-hidden rounded-xl group cursor-pointer min-h-[40px] sm:min-h-[44px] shrink-0"
                title="Sign in to Terminal - تسجيل الدخول"
              >
                <span className="w-full h-full bg-gradient-to-br from-[#D4AF37] via-[#C5A028] to-[#996515] group-hover:from-[#F3E5AB] group-hover:to-[#D4AF37] absolute"></span>
                <span className="relative px-2.5 sm:px-4 py-1.5 sm:py-2 transition-all ease-out bg-black rounded-[10px] group-hover:bg-opacity-0 duration-300 flex items-center gap-1.5 sm:gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] group-hover:text-black transition shrink-0" />
                  <span className="text-xs font-bold text-white group-hover:text-black tracking-wide whitespace-nowrap">
                    <span className="inline sm:hidden">Sign In / دخول</span>
                    <span className="hidden sm:inline">Sign in to Terminal</span>
                  </span>
                </span>
              </button>
            ) : (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#D4AF37]/50 text-xs text-white transition cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#8B5CF6] flex items-center justify-center text-black font-bold text-xs uppercase shadow-sm">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-semibold leading-tight text-zinc-200">Terminal</div>
                    <div className="text-[10px] text-zinc-400 truncate max-w-[110px]">
                      {user.email}
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-dropdown p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] mb-2">
                      <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                        Active Profile
                      </div>
                      <div className="text-xs font-medium text-white truncate mt-0.5">
                        {user.email}
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Subscription:</span>
                        {user.plan === 'free' ? (
                          <span className="text-amber-400 font-semibold font-mono">
                            Free ({freeLeft} left)
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold uppercase font-mono">
                            {user.plan} • {daysLeft}d left
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Plan Upgrade */}
                    {user.plan === 'free' && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenPricing();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-white bg-white/[0.06] hover:bg-white/[0.12] transition mb-1 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>Upgrade Subscription</span>
                      </button>
                    )}

                    <div className="border-t border-white/[0.06] my-1" />

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-white/[0.06] transition cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Terminal Admin Config</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Install App PWA Button (Prominent in navbar) */}
            <PWAInstallButton variant="navbar" className="hidden sm:inline-flex" />

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition"
              aria-label="Toggle mobile navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-[#D4AF37]" /> : <Menu className="w-5 h-5 text-white" />}
            </button>

          </div>

        </div>

        {/* Mobile Navigation Drawer / Menu (Collapsible) */}
        {mobileMenuOpen && (
          <div className="xl:hidden mt-3 pt-3 border-t border-white/[0.08] flex flex-col gap-2 pb-2 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* User Auth primary action inside mobile drawer */}
            {!user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-black font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 cursor-pointer shadow-md min-h-[44px]"
              >
                <Sparkles className="w-4 h-4 text-black shrink-0" />
                <span>Sign In to Terminal - تسجيل الدخول</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignOut();
                }}
                className="w-full py-3 px-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-xs uppercase tracking-wider font-mono flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Log Out / تسجيل الخروج</span>
              </button>
            )}

            {/* Install App button on mobile inside drawer */}
            <div className="sm:hidden mb-1">
              <PWAInstallButton variant="navbar" className="w-full justify-center" />
            </div>

            {/* Navigation links */}
            <a
              href="#properties"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition flex items-center justify-between"
            >
              <span>Asset Intelligence</span>
              <span className="text-[10px] font-mono text-zinc-500">PROPERTIES</span>
            </a>
            <a
              href="#yield-simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition flex items-center justify-between"
            >
              <span>Yield Simulator</span>
              <span className="text-[10px] font-mono text-zinc-500">CALCULATOR</span>
            </a>
            <a
              href="#matrix"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition flex items-center justify-between"
            >
              <span>Cross-Border Matrix</span>
              <span className="text-[10px] font-mono text-zinc-500">RADAR</span>
            </a>
            <a
              href="#portfolio"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition flex items-center justify-between"
            >
              <span>Portfolio AUM</span>
              <span className="text-[10px] font-mono text-zinc-500">ALLOCATION</span>
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-sm text-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 transition flex items-center justify-between font-semibold"
            >
              <span>Pricing Tiers</span>
              <span className="text-[10px] font-mono text-[#D4AF37]">LEMONSQUEEZY</span>
            </a>

            {/* Trial count indicator on mobile */}
            {user && user.plan === 'free' && (
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
                <span className="text-zinc-400">Free analyses remaining:</span>
                <span className="font-bold text-[#D4AF37]">{freeLeft} / 3</span>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
};
