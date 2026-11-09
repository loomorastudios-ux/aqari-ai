import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CurrencyCode, PropertyListing, RemoteConfig, User } from './types';
import { 
  CONFIG_URL, 
  DEFAULT_CONFIG, 
  PLAN_LIMITS, 
  PROPERTY_LISTINGS 
} from './constants';
import { fetchLiveExchangeRates, fetchMarketData } from './utils/marketDataService';
import { getSessionUser, saveUser, clearSession, getUser } from './utils/userStorage';
import { AmbientBackground } from './components/AmbientBackground';
import { CustomCursor } from './components/CustomCursor';
import { Navbar } from './components/Navbar';
import { MarqueeTicker } from './components/MarqueeTicker';
import { Hero } from './components/Hero';
import { PropertyGrid } from './components/PropertyGrid';
import { YieldSimulator } from './components/YieldSimulator';
import { CrossBorderMatrix } from './components/CrossBorderMatrix';
import { PortfolioSummary } from './components/PortfolioSummary';
import { PricingSection } from './components/PricingSection';
import { AuthModal } from './components/AuthModal';
import { LimitModal } from './components/LimitModal';
import { AnalysisModal } from './components/AnalysisModal';
import { AdminModal } from './components/AdminModal';
import { RenewalModal } from './components/RenewalModal';
import { TerminalDashboard } from './components/TerminalDashboard';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { checkAndSendExpiryEmail } from './utils/emailService';
import { 
  Building2, 
  Sparkles, 
  X, 
  AlertOctagon, 
  Settings, 
  ShieldCheck, 
  FileCode,
  CheckCircle2
} from 'lucide-react';

// Global Announcement Banner Text (Set to empty string "" to hide)
export const ANNOUNCEMENT = "Institutional Spring Cycle: Muscat + Dubai Gross Yield Spread reaches +450bps. Sovereign Terminal 3.0 Live.";

export default function App() {
  // Currency State (saved in localStorage)
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('aqari_currency');
    if (saved && ['USD', 'OMR', 'AED', 'GBP'].includes(saved)) {
      return saved as CurrencyCode;
    }
    return 'USD';
  });

  // User Auth & Session State (per-user database)
  const [user, setUser] = useState<User | null>(() => {
    return getSessionUser();
  });

  // App Routing State: 'landing' vs 'terminal'
  const [route, setRoute] = useState<'landing' | 'terminal'>(() => {
    const sessionUser = getSessionUser();
    // Directly show Terminal if existing session exists
    if (sessionUser) {
      if (typeof window !== 'undefined' && window.location.hash !== '#/terminal') {
        window.location.hash = '#/terminal';
      }
      return 'terminal';
    }
    return 'landing';
  });

  // Remote Config State
  const [config, setConfig] = useState<RemoteConfig>(() => {
    const localOverride = localStorage.getItem('aqari_remote_config');
    if (localOverride) {
      try {
        return JSON.parse(localOverride);
      } catch (e) {
        console.error(e);
      }
    }
    const cached = localStorage.getItem('aqari_remote_config_cached');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_CONFIG;
  });

  // Modals State
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isRenewalOpen, setIsRenewalOpen] = useState(false);
  const [activePropertyAnalysis, setActivePropertyAnalysis] = useState<PropertyListing | null>(null);

  // Filter state for landing page
  const [selectedCity, setSelectedCity] = useState<string>('All');

  // Announcement Toast state
  const [showToast, setShowToast] = useState(true);

  // Success Unlock Banner (when returning from LemonSqueezy)
  const [unlockSuccessMsg, setUnlockSuccessMsg] = useState<string | null>(null);

  // Terminal welcome toast state
  const [terminalToast, setTerminalToast] = useState<string | null>(null);

  // Listen to hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const currentUser = getSessionUser();
      if (hash === '#/terminal') {
        if (currentUser) {
          setRoute('terminal');
        } else {
          setIsAuthOpen(true);
          setRoute('landing');
        }
      } else if (hash === '#/landing' || hash === '' || hash === '#') {
        if (!currentUser) {
          setRoute('landing');
        } else {
          // If session exists, stay on terminal
          window.location.hash = '#/terminal';
          setRoute('terminal');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Save Currency
  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    setCurrency(newCurrency);
    localStorage.setItem('aqari_currency', newCurrency);
  };

  // Fetch Remote Config on load
  useEffect(() => {
    const fetchRemoteConfig = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: RemoteConfig = await res.json();
          const localOverride = localStorage.getItem('aqari_remote_config');
          if (!localOverride) {
            setConfig(data);
          }
          localStorage.setItem('aqari_remote_config_cached', JSON.stringify(data));
        }
      } catch (e) {
        // Fallback silently
      }
    };

    fetchRemoteConfig();
  }, []);

  // Poll live exchange rates and market data (every 5 min)
  useEffect(() => {
    fetchLiveExchangeRates();
    fetchMarketData();

    const intervalId = setInterval(() => {
      fetchLiveExchangeRates();
      fetchMarketData();
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // 1-Day Expiration Reminder Modal Check (shows once per day)
  useEffect(() => {
    if (user && user.plan !== 'free' && user.subscriptionExpiry) {
      const msLeft = user.subscriptionExpiry - Date.now();
      if (msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000) {
        const todayStr = new Date().toISOString().slice(0, 10);
        if (user.lastReminderDate !== todayStr) {
          const updated: User = {
            ...user,
            lastReminderDate: todayStr,
          };
          setUser(updated);
          localStorage.setItem('aqari_user', JSON.stringify(updated));
          setIsRenewalOpen(true);
        }
      }
    }
  }, [user]);

  // Check URL params on load (LemonSqueezy redirect: ?success=true&plan=starter|pro|enterprise)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      const returnedPlan = (urlParams.get('plan') as 'starter' | 'pro' | 'enterprise') || 'pro';
      const sessionUser = getSessionUser();
      const targetEmail = sessionUser?.email || urlParams.get('email') || 'investor@global-capital.io';
      const existingUser = getUser(targetEmail);
      const planQuota = PLAN_LIMITS[returnedPlan]?.analyses || 400;

      const baseUser: User = existingUser || sessionUser || {
        id: 'user_' + Date.now(),
        email: targetEmail,
        name: targetEmail.split('@')[0],
        avatar: targetEmail.charAt(0).toUpperCase(),
        provider: 'email',
        plan: 'free',
        freeAnalysesLeft: 3,
        freeAnalyses: 3,
        analysesUsed: 0,
        analysesLeft: 0,
        subscriptionExpiry: null,
        savedAnalyses: [],
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };

      const now = Date.now();
      const subscriptionDuration = 30 * 24 * 60 * 60 * 1000;
      const updatedUser: User = {
        ...baseUser,
        plan: returnedPlan,
        subscriptionStartAt: now,
        subscriptionEndsAt: now + subscriptionDuration,
        subscriptionExpiry: now + subscriptionDuration,
        expiryEmailSent: false,
        freeAnalyses: planQuota,
        freeAnalysesLeft: planQuota,
        analysesLeft: planQuota,
      };

      saveUser(updatedUser);
      setUser(updatedUser);

      // Fire confetti
      try {
        confetti({
          particleCount: 160,
          spread: 85,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#F3E5AB', '#8B5CF6', '#06B6D4'],
        });
      } catch (e) {}

      setUnlockSuccessMsg(`Welcome to ${returnedPlan.toUpperCase()} — 30 Days Unlocked! Redirecting to Terminal...`);

      // Auto redirect to #/terminal dashboard in 1.5 seconds as requested in prompt section 1
      setTimeout(() => {
        window.location.hash = '#/terminal';
        setRoute('terminal');
      }, 1500);

      // Clean query params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Save User Helper (persists to aqari_users_db_v2 per email)
  const handleSaveUser = (updatedUser: User | null) => {
    if (updatedUser) {
      saveUser(updatedUser);
      setUser(updatedUser);
    } else {
      clearSession();
      setUser(null);
    }
  };

  // Sign In Action -> Immediately direct to #/terminal dashboard
  const handleSignIn = (newUser: User) => {
    handleSaveUser(newUser);
    setIsAuthOpen(false);

    // Direct DOM manipulation as requested for testing and instant transition
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.style.display = 'none';
    document.body.classList.remove('modal-open');

    const landingEl = document.getElementById('landingPage');
    if (landingEl) landingEl.style.display = 'none';

    const terminalEl = document.getElementById('terminalPage');
    if (terminalEl) terminalEl.style.display = 'block';

    window.location.hash = '#/terminal';
    setRoute('terminal');
    window.scrollTo(0, 0);

    const left = newUser.plan === 'free' 
      ? (newUser.freeAnalysesLeft ?? newUser.freeAnalyses ?? 3)
      : (newUser.analysesLeft ?? 50);
    const toastText = `Welcome back, ${newUser.name || newUser.email.split('@')[0]} - ${left} analyses left`;
    setTerminalToast(toastText);
    setTimeout(() => {
      setTerminalToast(null);
    }, 3000);
  };

  // Sign Out (clears session ONLY, keeps DB)
  const handleSignOut = () => {
    clearSession();
    setUser(null);
    setTerminalToast(null);

    const terminalEl = document.getElementById('terminalPage');
    if (terminalEl) terminalEl.style.display = 'none';

    const landingEl = document.getElementById('landingPage');
    if (landingEl) landingEl.style.display = 'block';

    window.location.hash = '#/landing';
    setRoute('landing');
    window.scrollTo(0, 0);
  };

  // Switch to Terminal Dashboard
  const handleGoToTerminal = () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    window.location.hash = '#/terminal';
    setRoute('terminal');
  };

  // Switch back to Landing page
  const handleGoToHome = () => {
    window.location.hash = '#/landing';
    setRoute('landing');
  };

  // Auto check and send 24h expiry notification email on mount and user update
  useEffect(() => {
    if (user && user.plan !== 'free') {
      const { user: updatedUser } = checkAndSendExpiryEmail(user);
      if (updatedUser.expiryEmailSent !== user.expiryEmailSent) {
        setUser(updatedUser);
      }
    }
  }, [user]);

  // Admin Testing Unlock (strictly kept for Admin in AdminModal)
  const handleAdminTestUnlock = (plan: 'starter' | 'pro' | 'enterprise') => {
    const planQuota = PLAN_LIMITS[plan]?.analyses || 400;
    const now = Date.now();
    const subscriptionDuration = 30 * 24 * 60 * 60 * 1000;
    const updated: User = user
      ? {
          ...user,
          plan,
          subscriptionStartAt: now,
          subscriptionEndsAt: now + subscriptionDuration,
          subscriptionExpiry: now + subscriptionDuration,
          expiryEmailSent: false,
          freeAnalyses: planQuota,
        }
      : {
          id: 'user_' + Date.now(),
          email: 'admin.tester@gmail.com',
          plan,
          subscriptionStartAt: now,
          subscriptionEndsAt: now + subscriptionDuration,
          subscriptionExpiry: now + subscriptionDuration,
          expiryEmailSent: false,
          freeAnalyses: planQuota,
          analysesUsed: 0,
          createdAt: Date.now(),
        };

    handleSaveUser(updated);

    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#F3E5AB', '#8B5CF6'],
      });
    } catch (e) {}

    setUnlockSuccessMsg(`Admin Sandbox: ${plan.toUpperCase()} Unlocked for 30 Days!`);
    window.location.hash = '#/terminal';
    setRoute('terminal');
  };

  // Central authoritative analysis credit consumption logic
  // ONLY called when user clicks "ANALYZE PROPERTY" on property card OR "RUN ANALYSIS" in Underwriter
  const consumeAnalysis = (): boolean => {
    if (!user) {
      setIsAuthOpen(true);
      return false;
    }

    const currentUser = getUser(user.email) || user;
    const endsAt = currentUser.subscriptionEndsAt || currentUser.subscriptionExpiry;

    if (currentUser.plan !== 'free' && endsAt && Date.now() >= endsAt) {
      const expiredUser: User = {
        ...currentUser,
        plan: 'free',
        freeAnalyses: 0,
        freeAnalysesLeft: 0,
        analysesLeft: 0,
      };
      handleSaveUser(expiredUser);
      setIsRenewalOpen(true);
      return false;
    }

    const freeRemaining = currentUser.freeAnalysesLeft ?? currentUser.freeAnalyses ?? 0;
    if (currentUser.plan === 'free' && freeRemaining <= 0) {
      setIsRenewalOpen(true);
      return false;
    }

    const paidRemaining = currentUser.analysesLeft ?? currentUser.freeAnalyses ?? 0;
    if (currentUser.plan !== 'free' && currentUser.plan !== 'enterprise' && paidRemaining <= 0) {
      setIsRenewalOpen(true);
      return false;
    }

    let updatedUser: User = { ...currentUser };
    if (currentUser.plan === 'free') {
      const newFree = Math.max(0, freeRemaining - 1);
      updatedUser = {
        ...updatedUser,
        freeAnalyses: newFree,
        freeAnalysesLeft: newFree,
        analysesUsed: (currentUser.analysesUsed || 0) + 1,
      };
    } else if (currentUser.plan !== 'enterprise') {
      const newPaid = Math.max(0, paidRemaining - 1);
      updatedUser = {
        ...updatedUser,
        analysesLeft: newPaid,
        freeAnalyses: newPaid,
        freeAnalysesLeft: newPaid,
        analysesUsed: (currentUser.analysesUsed || 0) + 1,
      };
    } else {
      updatedUser = {
        ...updatedUser,
        analysesUsed: (currentUser.analysesUsed || 0) + 1,
      };
    }

    handleSaveUser(updatedUser);
    return true;
  };

  // Analyze Click Checker on Landing Page - Deducts 1 credit via consumeAnalysis
  const handleAnalyzeProperty = (property: PropertyListing) => {
    if (!consumeAnalysis()) return;
    setActivePropertyAnalysis(property);
  };

  const handleAnalyzeSimulation = () => {
    // Simulator runs calculations live without deducting credits
  };

  // Admin Config Handlers
  const handleSaveConfig = (updated: RemoteConfig) => {
    setConfig(updated);
    localStorage.setItem('aqari_remote_config', JSON.stringify(updated));
  };

  const handleResetConfig = () => {
    localStorage.removeItem('aqari_remote_config');
    localStorage.removeItem('aqari_remote_config_cached');
    setConfig(DEFAULT_CONFIG);
  };

  // Maintenance Screen if enabled in remote config
  if (config.maintenance) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden select-none">
        <AmbientBackground />
        <div className="z-10 max-w-lg glass-panel p-10 border border-rose-500/30">
          <AlertOctagon className="w-16 h-16 text-rose-500 mx-auto mb-4 animate-pulse" />
          <h1 className="text-3xl font-bold tracking-tight text-white">
            TERMINAL UNDER MAINTENANCE
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-mono leading-relaxed">
            Global market feeds and institutional real estate indices are being calibrated for Q4 2026 reporting. Access will resume momentarily.
          </p>
          <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>Status: 503 Maintenance</span>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="text-[#D4AF37] underline hover:text-amber-300 cursor-pointer"
            >
              Admin Override
            </button>
          </div>
        </div>

        {isAdminOpen && (
          <AdminModal
            isOpen={isAdminOpen}
            onClose={() => setIsAdminOpen(false)}
            config={config}
            onSaveConfig={handleSaveConfig}
            onResetConfig={handleResetConfig}
            onTestUnlock={handleAdminTestUnlock}
          />
        )}
      </div>
    );
  }

  const isTerminal = route === 'terminal' && !!user;

  return (
    <>
      {/* PART 5: Global Announcements Banner */}
      <AnnouncementBanner text={ANNOUNCEMENT} />

      {/* Toast Notification Container */}
      {terminalToast && (
        <div id="terminalToast" className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-zinc-900 border border-[#D4AF37]/50 text-white text-xs font-mono shadow-[0_10px_35px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2.5 backdrop-blur-xl">
          <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span>{terminalToast}</span>
        </div>
      )}

      {/* VIEW 2: TERMINAL DASHBOARD APP */}
      <div
        id="terminalPage"
        style={{ display: isTerminal ? 'block' : 'none' }}
        className="min-h-screen bg-black text-slate-100 selection:bg-[#D4AF37]/30 selection:text-white relative"
      >
        {user && (
          <>
            <AmbientBackground />
            <CustomCursor />
            <TerminalDashboard
              user={user}
              currentCurrency={currency}
              onCurrencyChange={handleCurrencyChange}
              config={config}
              onSignOut={handleSignOut}
              onGoToHome={handleGoToHome}
              onOpenRenewal={() => setIsRenewalOpen(true)}
              onUpdateUser={handleSaveUser}
              onConsumeAnalysis={consumeAnalysis}
              onOpenAuth={() => setIsAuthOpen(true)}
              initialToast={terminalToast}
            />
          </>
        )}
      </div>

      {/* VIEW 1: LANDING PAGE (When unauthenticated or on landing route) */}
      <div
        id="landingPage"
        style={{ display: isTerminal ? 'none' : 'block' }}
        className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#D4AF37]/30 selection:text-white relative"
      >
      
      {/* Ambient background with SVG grain and 3 blurred floating orbs */}
      <AmbientBackground />

      {/* 20px Gold Cursor with lag */}
      <CustomCursor />

      {/* Top Navbar */}
      <Navbar
        currentCurrency={currency}
        onCurrencyChange={handleCurrencyChange}
        user={user}
        config={config}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={handleSignOut}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onGoToTerminal={handleGoToTerminal}
        onOpenPricing={() => {
          const el = document.getElementById('pricing');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Real-time Infinite Marquee Ticker */}
      <MarqueeTicker />

      {/* Success Notification Banner */}
      {unlockSuccessMsg && (
        <div className="max-w-4xl mx-auto px-4 mt-6 z-20 w-full animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#D4AF37]/20 via-emerald-500/20 to-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-between gap-3 backdrop-blur-xl shadow-[0_0_30px_rgba(212,175,55,0.2)]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-white font-mono">
                {unlockSuccessMsg}
              </span>
            </div>
            <button
              onClick={() => setUnlockSuccessMsg(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Landing Page Content */}
      <main className="flex-1 space-y-10">
        
        {/* Hero Section */}
        <Hero
          currentCurrency={currency}
          selectedCity={selectedCity}
          user={user}
          onSelectCity={(city) => setSelectedCity(city)}
          onExploreProperties={() => {
            const el = document.getElementById('properties');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          onExploreSimulator={() => {
            const el = document.getElementById('yield-simulator');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          onOpenAuth={() => setIsAuthOpen(true)}
        />

        {/* High-Conviction Institutional Property Listings */}
        <PropertyGrid
          properties={PROPERTY_LISTINGS}
          currentCurrency={currency}
          selectedCity={selectedCity}
          user={user}
          onAnalyze={handleAnalyzeProperty}
          onOpenPricing={() => {
            const el = document.getElementById('pricing');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Interactive Yield Simulator */}
        <YieldSimulator
          currentCurrency={currency}
          user={user}
          onAnalyzeSimulation={handleAnalyzeSimulation}
        />

        {/* Sovereign Cross-Border Capital Matrix */}
        <CrossBorderMatrix currentCurrency={currency} />

        {/* Multi-Market Institutional Portfolio Dashboard */}
        <PortfolioSummary
          currentCurrency={currency}
          onExploreAssets={() => {
            const el = document.getElementById('properties');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Pricing Section with real Lemon links */}
        <PricingSection
          currentCurrency={currency}
          config={config}
          user={user}
          onOpenAuth={() => setIsAuthOpen(true)}
          onTestUnlock={handleAdminTestUnlock}
        />

      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/[0.08] bg-black/90 backdrop-blur-2xl py-12 px-4 lg:px-8 relative z-20 text-xs text-zinc-400 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#D4AF37] flex items-center justify-center text-black font-black font-mono text-xs">
              AQ
            </div>
            <div>
              <span className="text-white font-bold tracking-tight">AQARI GLOBAL TERMINAL</span>
              <p className="text-[10px] text-zinc-400 mt-0.5">The Operating System for Global Real Estate • All Rights Reserved</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            {user && (
              <button
                onClick={handleGoToTerminal}
                className="text-[#D4AF37] font-bold hover:underline cursor-pointer"
              >
                Go to Terminal Dashboard &rarr;
              </button>
            )}

            <button
              onClick={() => setIsAdminOpen(true)}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-[#D4AF37] transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Admin Config</span>
            </button>

            <span className="text-zinc-700">•</span>
            <span className="text-zinc-400">LemonSqueezy Webhook Sync: Active</span>
          </div>
        </div>
      </footer>
      </div>

      {/* Bottom Toast Announcement */}
      {config.announcement.active && showToast && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm rounded-2xl glass-dropdown p-4 border border-cyan-500/30 shadow-[0_15px_40px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  Terminal Broadcast
                </div>
                <div className="text-xs text-white mt-0.5 font-medium">
                  {config.announcement.text}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="text-zinc-500 hover:text-white transition p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSignIn={handleSignIn}
      />

      <LimitModal
        isOpen={isLimitOpen}
        onClose={() => setIsLimitOpen(false)}
        user={user}
        config={config}
        currentCurrency={currency}
        onTestUnlock={handleAdminTestUnlock}
        onOpenPricing={() => {
          const el = document.getElementById('pricing');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      <RenewalModal
        isOpen={isRenewalOpen}
        onClose={() => setIsRenewalOpen(false)}
        user={user}
        config={config}
        currentCurrency={currency}
      />

      <AnalysisModal
        property={activePropertyAnalysis}
        currentCurrency={currency}
        user={user}
        onClose={() => setActivePropertyAnalysis(null)}
        onOpenUpgrade={() => setIsRenewalOpen(true)}
        onSaveAnalysis={(prop) => {
          if (!user) {
            setIsAuthOpen(true);
            return;
          }
          const maxLimit = PLAN_LIMITS[user.plan]?.maxSaved || 3;
          const currentSaved = user.savedAnalyses || [];
          if (currentSaved.length >= maxLimit) {
            setIsRenewalOpen(true);
            return;
          }
          const newAnalysis = {
            id: 'saved_' + Date.now(),
            property: prop.title,
            city: prop.city,
            price: prop.basePriceUSD,
            rent: prop.baseRentMonthlyUSD,
            capRate: prop.capRate,
            cashOnCash: Number((prop.capRate + 1.2).toFixed(2)),
            irr: Number((prop.capRate + 5.0).toFixed(1)),
            dscr: '1.75',
            monthlyCashflow: Math.round(prop.baseRentMonthlyUSD * 0.8),
            riskScore: prop.tenantRiskScore,
            date: Date.now(),
            imageUrl: prop.imageUrl,
          };
          handleSaveUser({
            ...user,
            savedAnalyses: [newAnalysis, ...currentSaved],
          });
        }}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onResetConfig={handleResetConfig}
        onTestUnlock={handleAdminTestUnlock}
      />

    </>
  );
}
