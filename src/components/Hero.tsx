// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import React, { useState, useEffect } from 'react';
import { CurrencyCode, User } from '../types';
import type { LiveMarketResponse } from '../utils/marketDataService';
import { MagneticButton } from './MagneticButton';
import {
  Building2,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  Shield,
  Compass,
  Layers,
  ChevronRight,
  LogIn,
  LogOut,
} from 'lucide-react';

interface HeroProps {
  currentCurrency: CurrencyCode;
  selectedCity: string;
  user?: User | null;
  marketLive?: LiveMarketResponse | null;
  onSelectCity: (city: string) => void;
  onExploreProperties: () => void;
  onExploreSimulator: () => void;
  onOpenAuth: () => void;
  onSignOut?: () => void;
  onGoToTerminal?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  user,
  marketLive,
  onExploreProperties,
  onExploreSimulator,
  onOpenAuth,
  onSignOut,
  onGoToTerminal,
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
      track.innerHTML = track.innerHTML + track.innerHTML + track.innerHTML;

      let x = 0;
      let animId: number;
      function tick() {
        x -= 1.2;
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

  const cities = marketLive?.cities || [];
  const muscat = cities.find((c) => c.city === 'Muscat');
  const dubai = cities.find((c) => c.city === 'Dubai');
  const singapore = cities.find((c) => c.city === 'Singapore');
  const us10y = marketLive?.macro?.us_10y_yield ?? 4.28;
  const us2y = marketLive?.macro?.us_2y_yield ?? 4.15;
  const muscatSpreadBps = marketLive?.metrics?.muscat_vs_us10y_bps ?? 412;
  const dubaiDld = marketLive?.metrics?.dubai_dld_index ?? 184.2;
  const fxOmr = marketLive?.metrics?.fx_usd_omr ?? 0.385;
  const fxAed = marketLive?.metrics?.fx_usd_aed ?? 3.6725;
  const syncedText = marketLive?.last_synced_display || 'Synced Daily';

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
          <span className="text-zinc-300">7 MARKETS</span>
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
          Bloomberg-grade analytics across <strong className="text-zinc-200 font-semibold">7 sovereign property markets</strong>. Macro rates, inflation &amp; FX synced{' '}
          <span className="text-emerald-400 font-mono text-sm">{syncedText}</span> from World Bank, FRED, DLD, ONS &amp; JLL.
        </p>

        {/* Row 1: Primary Product Action CTAs */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3.5 sm:gap-4 pt-4">
          <MagneticButton
            onClick={onExploreProperties}
            className="w-full sm:w-auto justify-center group px-6 sm:px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#C99D28] to-[#A47614] text-black font-bold text-sm hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all duration-300 flex items-center gap-2 cursor-pointer min-h-[48px]"
          >
            <Building2 className="w-4 h-4 text-black shrink-0" />
            <span>Launch Asset Intelligence</span>
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
          </MagneticButton>

          <MagneticButton
            onClick={onExploreSimulator}
            className="w-full sm:w-auto justify-center px-6 sm:px-7 py-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-[#D4AF37]/50 text-white font-semibold text-sm transition-all duration-300 flex items-center gap-2 backdrop-blur-xl cursor-pointer min-h-[48px]"
          >
            <TrendingUp className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>Open Yield Simulator</span>
            <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
          </MagneticButton>
        </div>

        {/* Row 2: Centered Terminal Auth / App Entry Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          {user ? (
            <>
              <button
                type="button"
                onClick={onGoToTerminal}
                className="w-full sm:w-auto min-w-[210px] h-[48px] px-7 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C99D28] hover:brightness-110 text-black font-bold text-sm font-mono tracking-wide transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-[0_0_25px_rgba(212,175,55,0.35)]"
              >
                <span>Enter App</span>
                <ArrowRight className="w-4 h-4 text-black shrink-0" />
              </button>

              <button
                type="button"
                onClick={onSignOut}
                className="w-full sm:w-auto min-w-[180px] h-[48px] px-7 rounded-2xl bg-rose-950/60 hover:bg-rose-900/70 active:bg-rose-900 border border-rose-500/45 hover:border-rose-400 text-rose-200 font-semibold text-sm font-mono tracking-wide transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.15)]"
              >
                <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full sm:w-auto min-w-[230px] h-[48px] px-7 rounded-2xl bg-transparent hover:bg-white/[0.06] active:bg-white/[0.1] border border-[#D4AF37]/70 hover:border-[#D4AF37] text-white font-semibold text-sm font-mono tracking-wide transition-all duration-300 backdrop-blur-xl cursor-pointer flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
            >
              <LogIn className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Sign In to Terminal</span>
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
            <span>🇴🇲 Muscat <b style={{ background: '#D4AF37', color: '#000', padding: '2px 8px', borderRadius: '6px' }}>{muscat?.gross_yield ?? 8.4}% Yield</b></span>
            <span>🇦🇪 Dubai DLD <b style={{ background: '#1a3a1a', color: '#4ade80', padding: '2px 8px', borderRadius: '6px' }}>{dubaiDld} pts</b></span>
            <span>🇺🇸 US 10Y (FRED) <b style={{ background: '#222', color: '#D4AF37', padding: '2px 8px', borderRadius: '6px' }}>{us10y}%</b></span>
            <span>🇬🇧 London ONS <b style={{ background: '#222', color: '#D4AF37', padding: '2px 8px', borderRadius: '6px' }}>20.8x P/E</b></span>
            <span>🇸🇦 Riyadh JLL <b style={{ background: '#222', color: '#c084fc', padding: '2px 8px', borderRadius: '6px' }}>+380 bps</b></span>
            <span>🇸🇬 Singapore IRAS <b style={{ background: '#222', color: '#D4AF37', padding: '2px 8px', borderRadius: '6px' }}>60% ABSD</b></span>
            <span>🇺🇸 New York <b style={{ background: '#222', color: '#fff', padding: '2px 8px', borderRadius: '6px' }}>4.6% Gross Yield</b></span>
          </div>
        </div>
      </div>

      {/* Live Macro & Benchmark Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
            <span>US 10Y Treasury (FRED)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {us10y}%
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>US 2Y: {us2y}% • Risk-Free Base</span>
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
            <span>Muscat vs US10Y Spread</span>
            <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            +{muscatSpreadBps} bps
          </div>
          <div className="text-[11px] text-[#D4AF37] font-mono mt-1">
            {muscat?.gross_yield ?? 8.4}% Muscat vs {singapore?.gross_yield ?? 3.9}% SGP
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
            <span>Dubai DLD Index</span>
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {dubaiDld} pts
          </div>
          <div className="text-[11px] text-cyan-400 font-mono mt-1">
            Dubai {dubai?.gross_yield ?? 8.8}% • 0% CGT (Oman/UAE)
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 flex items-center justify-between">
            <span>Live FX Peg Feed</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {fxOmr} OMR
          </div>
          <div className="text-[11px] text-purple-400 font-mono mt-1">
            1 USD = {fxAed} AED • Synced {syncedText}
          </div>
        </div>

      </div>

    </section>
  );
};
