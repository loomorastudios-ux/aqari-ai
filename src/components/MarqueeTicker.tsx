// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import React from 'react';
import { CurrencyCode, User } from '../types';
import type { LiveMarketResponse } from '../utils/marketDataService';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface MarqueeTickerProps {
  marketLive?: LiveMarketResponse | null;
}

export const MarqueeTicker: React.FC<MarqueeTickerProps> = ({ marketLive }) => {
  const cities = marketLive?.cities || [];
  const muscat = cities.find((c) => c.city === 'Muscat');
  const dubai = cities.find((c) => c.city === 'Dubai');
  const london = cities.find((c) => c.city === 'London');
  const riyadh = cities.find((c) => c.city === 'Riyadh');
  const singapore = cities.find((c) => c.city === 'Singapore');
  const nyc = cities.find((c) => c.city === 'New York');
  const miami = cities.find((c) => c.city === 'Miami');

  const us10y = marketLive?.macro?.us_10y_yield ?? 4.28;
  const muscatSpread = marketLive?.metrics?.muscat_vs_us10y_bps ?? 412;
  const fxOmr = marketLive?.metrics?.fx_usd_omr ?? 0.385;
  const fxGbp = marketLive?.metrics?.fx_usd_gbp ?? 0.79;
  const dldIdx = marketLive?.metrics?.dubai_dld_index ?? 184.2;
  const syncedText = marketLive?.last_synced_display || 'Syncing...';

  const items = [
    { label: 'US 10Y TREASURY (FRED)', value: `${us10y}%`, change: 'Benchmark', up: true },
    { label: 'MUSCAT VS US 10Y SPREAD', value: `+${muscatSpread} bps`, change: `${muscat?.gross_yield ?? 8.4}% Yield`, up: true },
    { label: 'USD / OMR FX', value: `${fxOmr} OMR`, change: 'Pegged', up: true },
    { label: 'USD / GBP FX', value: `${fxGbp} GBP`, change: 'Live FX', up: true },
    { label: 'DUBAI DLD INDEX', value: `${dldIdx} pts`, change: `${dubai?.gross_yield ?? 8.8}% Gross`, up: true },
    { label: 'LONDON PRIME P/E (ONS)', value: london?.benchmark_label || '20.8x P/E', change: `${london?.gross_yield ?? 4.8}% Gross`, up: false },
    { label: 'RIYADH KAFD SPREAD (JLL)', value: riyadh?.benchmark_label || '+380 bps vs Sov', change: `+${riyadh?.rental_yoy ?? 14.8}% YoY`, up: true },
    { label: 'SINGAPORE ABSD (IRAS)', value: `${singapore?.transfer_tax ?? 60}%`, change: `${singapore?.gross_yield ?? 3.9}% Gross`, up: false },
    { label: 'MIAMI MARKET VELOCITY', value: miami?.benchmark_label || '26 DOM', change: `${miami?.gross_yield ?? 6.7}% Gross`, up: true },
    { label: 'NYC CORE YIELD (STREETEASY)', value: `${nyc?.gross_yield ?? 4.6}%`, change: `+${nyc?.rental_yoy ?? 4.9}% YoY`, up: true },
  ];

  return (
    <div className="w-full bg-black/75 border-y border-white/[0.08] backdrop-blur-md overflow-hidden py-2.5 z-20 relative select-none">
      <div className="flex items-center">
        {/* Market Feed Sync Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full text-[10px] font-mono uppercase tracking-wider text-[#D4AF37] shrink-0 ml-4 mr-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>MARKET FEED</span>
          <span className="text-zinc-500">•</span>
          <span className="text-[9px] text-zinc-300 font-normal">
            LAST SYNCED: {syncedText.toUpperCase()} • SOURCES: WORLD BANK / FRED / DLD / ONS / JLL
          </span>
        </div>

        {/* Infinite Scrolling tape */}
        <div className="overflow-hidden flex-1 flex">
          <div className="animate-marquee flex items-center gap-8 text-xs font-mono">
            {[...items, ...items].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-zinc-300 whitespace-nowrap">
                <span className="text-zinc-500 font-semibold">{item.label}:</span>
                <span className="text-zinc-100 font-bold tracking-tight">{item.value}</span>
                <span
                  className={`flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded ${
                    item.up
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-amber-300 bg-amber-500/10'
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
    `LIVE FX FEED (USD/OMR/AED/GBP)`,
    `SOVEREIGN ARBITRAGE ACTIVE`,
    `WORLD BANK / FRED / DLD SYNCED`,
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
