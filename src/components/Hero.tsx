import React, { useState, useEffect } from 'react';
import { CurrencyCode, User } from '../types';
import { formatPrice } from '../utils/formatters';
import { MagneticButton } from './MagneticButton';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  Building2, 
  ArrowUpRight, 
  TrendingUp, 
  Shield, 
  Compass,
  Layers,
  ChevronRight,
  LogIn,
  User as UserIcon
} from 'lucide-react';

interface HeroProps {
  currentCurrency: CurrencyCode;
  selectedCity: string;
  user?: User | null;
  onSelectCity: (city: string) => void;
  onExploreProperties: () => void;
  onExploreSimulator: () => void;
  onOpenAuth: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  currentCurrency,
  selectedCity,
  user,
  onSelectCity,
  onExploreProperties,
  onExploreSimulator,
  onOpenAuth,
}) => {
  const [times, setTimes] = useState<{ mct: string; dxb: string; lon: string; nyc: string; ruh: string; sgp: string }>({
    mct: '',
    dxb: '',
    lon: '',
    nyc: '',
    ruh: '',
    sgp: '',
  });

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      const format = (tz: string) =>
        new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now);

      setTimes({
        mct: format('Asia/Muscat'),
        dxb: format('Asia/Dubai'),
        lon: format('Europe/London'),
        nyc: format('America/New_York'),
        ruh: format('Asia/Riyadh'),
        sgp: format('Asia/Singapore'),
      });
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  // Bottom Ticker Animation with requestAnimationFrame
  useEffect(() => {
    const track = document.getElementById('bottomTickerTrack');
    if (!track) return;

    if (!track.getAttribute('data-running')) {
      track.setAttribute('data-running', 'true');
      // Duplicate for seamless loop
      track.innerHTML = track.innerHTML + track.innerHTML + track.innerHTML;

      let x = 0;
      let animId: number;
      function tick() {
        x -= 1.2; // speed - same as top ticker
        if (track && Math.abs(x) >= track.scrollWidth / 3) x = 0;
        if (track) track.style.transform = 'translateX(' + x + 'px)';
        animId = requestAnimationFrame(tick);
      }
      animId = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(animId);
      };
    }
  }, []);

  return (
    <section className="relative pt-12 pb-16 px-4 lg:px-8 max-w-7xl mx-auto z-10">
      
      {/* Global Terminal World Clocks */}
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-8 text-[11px] font-mono text-zinc-400">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <span className="text-zinc-500">MCT</span>
          <span className="text-white font-semibold">{times.mct || '11:20:25'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <span className="text-zinc-500">DXB</span>
          <span className="text-white font-semibold">{times.dxb || '11:20:25'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <span className="text-zinc-500">RUH</span>
          <span className="text-white font-semibold">{times.ruh || '10:20:25'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <span className="text-zinc-500">LON</span>
          <span className="text-white font-semibold">{times.lon || '07:20:25'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <span className="text-zinc-500">NYC</span>
          <span className="text-white font-semibold">{times.nyc || '02:20:25'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <span className="text-zinc-500">SGP</span>
          <span className="text-white font-semibold">{times.sgp || '15:20:25'}</span>
        </div>
      </div>

      {/* Main Headline */}
      <div className="text-center max-w-4xl mx-auto space-y-6">
        
        {/* Terminal Category Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#D4AF37]/15 via-white/[0.05] to-[#8B5CF6]/15 border border-[#D4AF37]/30 text-xs font-mono text-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.15)]">
          <Compass className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>CROSS-BORDER INSTITUTIONAL ARBITRAGE TERMINAL</span>
          <span className="text-white/40">•</span>
          <span className="text-zinc-300">EST. 2026</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08]">
          The Operating System for{' '}
          <span className="bg-gradient-to-r from-[#D4AF37] via-[#F5D77F] to-[#E2C05E] bg-clip-text text-transparent">
            Global Real Estate
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-zinc-400 font-normal max-w-2xl mx-auto leading-relaxed">
          Bloomberg-grade analytics. <strong className="text-zinc-200 font-semibold">$3.2B+ tracked</strong> across 7 core sovereign markets. Uncover hidden gross-to-net yield spreads, cross-border tax incentives, and instant capitalization multiples.
        </p>

        {/* Action CTAs with Magnetic Physics */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3.5 sm:gap-4 pt-4">
          <MagneticButton
            onClick={onExploreProperties}
            className="w-full sm:w-auto justify-center group px-6 sm:px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#C99D28] to-[#A47614] text-black font-bold text-sm hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all duration-300 flex items-center gap-2 cursor-pointer min-h-[44px]"
          >
            <Building2 className="w-4 h-4 text-black shrink-0" />
            <span>Launch Asset Intelligence</span>
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
          </MagneticButton>

          <MagneticButton
            onClick={onExploreSimulator}
            className="w-full sm:w-auto justify-center px-6 sm:px-7 py-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-[#D4AF37]/50 text-white font-semibold text-sm transition-all duration-300 flex items-center gap-2 backdrop-blur-xl cursor-pointer min-h-[44px]"
          >
            <TrendingUp className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>Open Yield Simulator</span>
            <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
          </MagneticButton>

          {/* Prominent PWA Install App Button */}
          <PWAInstallButton variant="hero" className="w-full sm:w-auto" />

          {/* TASK 1: Mobile-Only Login Button directly below Install App button when logged out */}
          {!user && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="sm:hidden w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl bg-transparent hover:bg-white/[0.04] active:bg-white/[0.08] border border-[#D4AF37]/60 hover:border-[#D4AF37] text-white font-bold text-sm tracking-wide transition-all duration-200 cursor-pointer min-h-[48px] shadow-[0_0_15px_rgba(212,175,55,0.15)]"
              aria-label="تسجيل الدخول إلى تطبيق عقاري"
            >
              <span className="text-sm font-semibold tracking-wide">تسجيل الدخول</span>
              <LogIn className="w-4 h-4 text-[#D4AF37] shrink-0" />
            </button>
          )}
        </div>

      </div>

      {/* Moving Bottom Ticker Bar */}
      <div className="mt-12 -mx-4 lg:-mx-8">
        <div
          id="bottomTicker"
          style={{
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            background: '#000',
            borderTop: '1px solid rgba(212,175,55,0.3)',
            borderBottom: '1px solid rgba(212,175,55,0.3)',
            padding: '12px 0',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div
            id="bottomTickerTrack"
            style={{
              display: 'inline-flex',
              gap: '48px',
              willChange: 'transform',
              fontFamily: 'monospace',
            }}
          >
            <span>🇴🇲 Muscat <b style={{ background: '#D4AF37', color: '#000', padding: '2px 8px', borderRadius: '6px' }}>8.4% Yield</b></span>
            <span>🇦🇪 Dubai <b style={{ background: '#1a3a1a', color: '#4ade80', padding: '2px 8px', borderRadius: '6px' }}>0% Tax</b></span>
            <span>🇬🇧 London <b style={{ background: '#222', color: '#D4AF37', padding: '2px 8px', borderRadius: '6px' }}>Tier-1 Core</b></span>
            <span>🇸🇬 Singapore <b style={{ background: '#222', color: '#D4AF37', padding: '2px 8px', borderRadius: '6px' }}>AAA Hub</b></span>
            <span>🇸🇦 Riyadh <b style={{ background: '#222', color: '#c084fc', padding: '2px 8px', borderRadius: '6px' }}>+14% Growth</b></span>
            <span>🇺🇸 Miami <b style={{ background: '#222', color: '#D4AF37', padding: '2px 8px', borderRadius: '6px' }}>Zero State Tax</b></span>
            <span>🇺🇸 New York <b style={{ background: '#222', color: '#fff', padding: '2px 8px', borderRadius: '6px' }}>Global Financial Core</b></span>
          </div>
        </div>
      </div>

      {/* Institutional High-Level Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
        
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
            <span>Global AUM Tracked</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {formatPrice(3248910000, currentCurrency, { compact: true })}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>+14.2% YoY Capital Inflow</span>
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
            <span>Prime Yield Spread</span>
            <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            8.4% vs 3.9%
          </div>
          <div className="text-[11px] text-[#D4AF37] font-mono mt-1 flex items-center gap-1">
            <span>Muscat vs Singapore Arbitrage</span>
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
            <span>0% Tax Havens</span>
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            Oman & UAE
          </div>
          <div className="text-[11px] text-cyan-400 font-mono mt-1">
            0% CGT • 0% Income Tax
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
            <span>Active Listings</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            1,480+ Units
          </div>
          <div className="text-[11px] text-purple-400 font-mono mt-1">
            Verified Sovereign Portfolios
          </div>
        </div>

      </div>

    </section>
  );
};
