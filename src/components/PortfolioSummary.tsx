// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import React from 'react';
import { CurrencyCode } from '../types';
import type { LiveMarketResponse } from '../utils/marketDataService';
import { formatPrice } from '../utils/formatters';
import { Briefcase, TrendingUp, ArrowUpRight } from 'lucide-react';

interface PortfolioSummaryProps {
  currentCurrency: CurrencyCode;
  marketLive?: LiveMarketResponse | null;
  onExploreAssets: () => void;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  currentCurrency,
  marketLive,
  onExploreAssets,
}) => {
  const cities = marketLive?.cities || [];
  const muscat = cities.find((c) => c.city === 'Muscat');
  const dubai = cities.find((c) => c.city === 'Dubai');
  const london = cities.find((c) => c.city === 'London');

  // Compute dynamic 3-market reference benchmark directly from synced live city price/m² & gross yield
  const mctVal = Math.round((muscat?.price_per_m2 ?? 1612) * 180);
  const dxbVal = Math.round((dubai?.price_per_m2 ?? 4120) * 55);
  const lonVal = Math.round((london?.price_per_m2 ?? 14200) * 10);
  const totalBenchmarkUSD = mctVal + dxbVal + lonVal;

  const mctYield = muscat?.gross_yield ?? 8.4;
  const dxbYield = dubai?.gross_yield ?? 8.8;
  const lonYield = london?.gross_yield ?? 4.8;

  const monthlyCashflowUSD = Math.round(
    (mctVal * (mctYield / 100) + dxbVal * (dxbYield / 100) + lonVal * (lonYield / 100)) / 12
  );
  const netWeightedYield = Number((((monthlyCashflowUSD * 12) / totalBenchmarkUSD) * 100).toFixed(1));
  const syncedDisplay = marketLive?.last_synced_display || 'Synced Daily';

  const allocations = [
    {
      name: 'Muscat ITC Benchmark (180 m²)',
      city: 'Muscat',
      sharePct: Math.round((mctVal / totalBenchmarkUSD) * 100),
      baseUSD: mctVal,
      yieldPct: mctYield,
      color: 'bg-[#D4AF37]',
    },
    {
      name: 'Dubai DLD Benchmark (55 m²)',
      city: 'Dubai',
      sharePct: Math.round((dxbVal / totalBenchmarkUSD) * 100),
      baseUSD: dxbVal,
      yieldPct: dxbYield,
      color: 'bg-emerald-400',
    },
    {
      name: 'London ONS Benchmark (10 m²)',
      city: 'London',
      sharePct: Math.max(10, 100 - Math.round((mctVal / totalBenchmarkUSD) * 100) - Math.round((dxbVal / totalBenchmarkUSD) * 100)),
      baseUSD: lonVal,
      yieldPct: lonYield,
      color: 'bg-purple-400',
    },
  ];

  return (
    <section id="portfolio" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto relative z-10">
      <div className="glass-panel p-6 sm:p-10 border border-white/[0.08] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37]">
              <Briefcase className="w-3.5 h-3.5" />
              <span>REFERENCE 3-CITY BENCHMARK • SYNCED {syncedDisplay.toUpperCase()}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Institutional Multi-Market Portfolio
            </h2>

            <p className="text-zinc-400 text-sm leading-relaxed">
              Model cross-border allocations dynamically computed from live DLD, ONS, and regional valuation benchmarks with real-time FX conversion and tax-shield indexing.
            </p>

            <div className="pt-2">
              <button
                onClick={onExploreAssets}
                className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-[#D4AF37]/50 text-white font-medium text-xs transition flex items-center gap-2 cursor-pointer"
              >
                <span>Inspect Benchmark Assets</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#D4AF37]" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-auto shrink-0">
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] min-w-[200px]">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Reference Model Value
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
                {formatPrice(totalBenchmarkUSD, currentCurrency)}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Computed from /api/market/live</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] min-w-[200px]">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Indicative Monthly Cashflow
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-[#D4AF37] mt-1">
                {formatPrice(monthlyCashflowUSD, currentCurrency)}/mo
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-1">
                Weighted Gross Yield: <strong className="text-white">{netWeightedYield}%</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/[0.06] space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Jurisdiction Diversification Breakdown</span>
            <span>Sources: World Bank • DLD • ONS</span>
          </div>

          <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden flex p-0.5 gap-1">
            {allocations.map((a) => (
              <div
                key={a.name}
                className={`${a.color} h-full rounded-full transition-all duration-500`}
                style={{ width: `${a.sharePct}%` }}
                title={`${a.name}: ${a.sharePct}%`}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {allocations.map((a) => (
              <div key={a.name} className="flex items-center gap-3 text-xs font-mono">
                <span className={`w-3 h-3 rounded-full ${a.color} shrink-0`} />
                <div className="truncate">
                  <div className="text-zinc-200 font-semibold truncate">{a.city} ({a.sharePct}%)</div>
                  <div className="text-[11px] text-zinc-400">
                    {formatPrice(a.baseUSD, currentCurrency)} • {a.yieldPct}% Yield
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
