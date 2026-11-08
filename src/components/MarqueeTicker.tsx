import React, { useState, useEffect } from 'react';
import { TICKER_METRICS } from '../constants';
import { CurrencyCode, User } from '../types';
import { TrendingUp, TrendingDown, Activity, Sparkles, Shield, Clock } from 'lucide-react';

interface MarqueeTickerProps {
  lastUpdatedMinutes?: number;
}

export const MarqueeTicker: React.FC<MarqueeTickerProps> = ({ lastUpdatedMinutes = 2 }) => {
  return (
    <div className="w-full bg-black/75 border-y border-white/[0.08] backdrop-blur-md overflow-hidden py-2.5 z-20 relative select-none">
      <div className="flex items-center">
        {/* Terminal Live Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] shrink-0 ml-4 mr-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>LIVE MARKET FEED</span>
          <span className="text-zinc-500">•</span>
          <span className="text-[9px] text-zinc-400 font-normal">Last updated: {lastUpdatedMinutes} min ago</span>
        </div>

        {/* Infinite Scrolling tape with duplicated items for seamless loop */}
        <div className="overflow-hidden flex-1 flex">
          <div className="animate-marquee flex items-center gap-8 text-xs font-mono">
            {[...TICKER_METRICS, ...TICKER_METRICS].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-zinc-300 whitespace-nowrap">
                <span className="text-zinc-500 font-semibold">{item.label}:</span>
                <span className="text-zinc-100 font-bold tracking-tight">{item.value}</span>
                <span
                  className={`flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded ${
                    item.up
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-rose-400 bg-rose-500/10'
                  }`}
                >
                  {item.up ? (
                    <TrendingUp className="w-3 h-3 mr-0.5 inline" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-0.5 inline" />
                  )}
                  {item.change}
                </span>
                <span className="text-zinc-700 ml-3">•</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TerminalSubTickerProps {
  user: User | null;
  currency: CurrencyCode;
}

export const TerminalSubTicker: React.FC<TerminalSubTickerProps> = ({ user, currency }) => {
  const planLabel = user?.plan ? user.plan.toUpperCase() : 'GUEST';
  const analysesCount = user?.plan === 'enterprise' ? 'Unlimited' : user?.freeAnalysesLeft ?? user?.freeAnalyses ?? 3;

  const tickerItems = [
    `AQARI TERMINAL`,
    `LICENSE: ${planLabel}`,
    `ANALYSES REMAINING: ${analysesCount}`,
    `ACTIVE BASE: ${currency}`,
    `LIVE PEGGED FX FEED (USD/OMR/AED/GBP)`,
    `SOVEREIGN ARBITRAGE ACTIVE`,
    `NO-FEE ITC ZONES AUDITED`,
    `30-DAY ENCRYPTED LICENSING`,
  ];

  return (
    <div className="w-full bg-[#D4AF37]/[0.03] border-b border-white/[0.06] overflow-hidden py-1.5 z-20 relative select-none">
      <div className="overflow-hidden flex">
        <div className="animate-marquee flex items-center gap-10 text-[11px] font-mono text-zinc-400">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((text, idx) => (
            <div key={idx} className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-[#D4AF37]" />
              <span className="font-semibold text-zinc-300">{text}</span>
              <span className="text-zinc-700 ml-2">//</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
