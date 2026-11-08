import React from 'react';
import { CurrencyCode } from '../types';
import { formatPrice } from '../utils/formatters';
import { PieChart, Briefcase, TrendingUp, DollarSign, Shield, ArrowUpRight } from 'lucide-react';

interface PortfolioSummaryProps {
  currentCurrency: CurrencyCode;
  onExploreAssets: () => void;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  currentCurrency,
  onExploreAssets,
}) => {
  const basePortfolioUSD = 652400;
  const baseMonthlyCashflowUSD = 4680;
  const netWeightedYield = 8.4;

  const allocations = [
    { name: 'Muscat Waterfront Penthouse', city: 'Muscat', sharePct: 45, baseUSD: 293580, yieldPct: 8.4, color: 'bg-[#D4AF37]' },
    { name: 'Dubai Marina Horizon Suite', city: 'Dubai', sharePct: 35, baseUSD: 228340, yieldPct: 7.9, color: 'bg-emerald-400' },
    { name: 'London Prime Sovereign Bond', city: 'London', sharePct: 20, baseUSD: 130480, yieldPct: 4.8, color: 'bg-purple-400' },
  ];

  return (
    <section id="portfolio" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto relative z-10">
      
      <div className="glass-panel p-6 sm:p-10 border border-white/[0.08] relative overflow-hidden">
        
        {/* Glow Accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          
          {/* Left Info */}
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37]">
              <Briefcase className="w-3.5 h-3.5" />
              <span>SOVEREIGN PORTFOLIO ALLOCATION ENGINE</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Institutional Multi-Market Portfolio
            </h2>

            <p className="text-zinc-400 text-sm leading-relaxed">
              Track global cross-border allocations with real-time currency conversion, automated tax shield indexing, and unified cash flow reconciliation.
            </p>

            <div className="pt-2">
              <button
                onClick={onExploreAssets}
                className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-[#D4AF37]/50 text-white font-medium text-xs transition flex items-center gap-2 cursor-pointer"
              >
                <span>Rebalance Portfolio Assets</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#D4AF37]" />
              </button>
            </div>
          </div>

          {/* Right Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-auto shrink-0">
            
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] min-w-[200px]">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Total Portfolio AUM
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
                {formatPrice(basePortfolioUSD, currentCurrency)}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>+9.2% Net IRR Benchmark</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] min-w-[200px]">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Monthly Net Cashflow
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-[#D4AF37] mt-1">
                {formatPrice(baseMonthlyCashflowUSD, currentCurrency)}/mo
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-1">
                Weighted Yield: <strong className="text-white">{netWeightedYield}%</strong>
              </div>
            </div>

          </div>

        </div>

        {/* Allocation Bar */}
        <div className="mt-8 pt-8 border-t border-white/[0.06] space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Jurisdiction Diversification Breakdown</span>
            <span>Risk Score: Low • Sovereign Hedged</span>
          </div>

          {/* Segmented Progress Bar */}
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

          {/* Allocation Legend */}
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
