import React from 'react';
import { CurrencyCode, MarketMatrixRow, User } from '../types';
import { FALLBACK_CROSS_BORDER_DATA } from '../constants';
import { formatPrice } from '../utils/formatters';
import { canUseFeature } from '../../lib/plans';
import { Scale, Activity, Lock, Zap } from 'lucide-react';

interface CrossBorderMatrixProps {
  currentCurrency: CurrencyCode;
  matrixData?: MarketMatrixRow[];
  isLive?: boolean;
  lastSyncedDisplay?: string;
  user?: User | null;
  onOpenPricing?: () => void;
}

export const CrossBorderMatrix: React.FC<CrossBorderMatrixProps> = ({
  currentCurrency,
  matrixData = FALLBACK_CROSS_BORDER_DATA,
  isLive = true,
  lastSyncedDisplay = 'Synced Daily',
  user,
  onOpenPricing,
}) => {
  const isLockedFreeUser = Boolean(user && !canUseFeature(user.plan, 'crossBorderMatrixFull'));
  const visibleRows = isLockedFreeUser ? matrixData.slice(0, 2) : matrixData;
  const lockedRows = isLockedFreeUser ? matrixData.slice(2) : [];

  return (
    <section id="matrix" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto relative z-10">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] mb-2">
            <Scale className="w-4 h-4 text-[#D4AF37]" />
            <span>Sovereign Arbitrage Radar</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Cross-Border Capital Matrix
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">
            Compare acquisition valuations per square meter, World Bank CPI inflation, transfer tax penalties, and sovereign frameworks across 7 prime financial centers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Market Feed • Synced {lastSyncedDisplay} • Sources: World Bank / DLD / ONS / JLL</span>
          </div>

          <div className="text-xs font-mono text-zinc-400 bg-white/[0.03] border border-white/[0.08] px-3.5 py-1.5 rounded-xl">
            Base: <strong className="text-[#D4AF37]">{currentCurrency}</strong>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-panel overflow-hidden border border-white/[0.08] relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-white/[0.04] border-b border-white/[0.08] text-zinc-400 uppercase tracking-wider text-[11px]">
                <th className="py-4 px-5 font-semibold">City & Market</th>
                <th className="py-4 px-5 font-semibold">Price / m² ({currentCurrency})</th>
                <th className="py-4 px-5 font-semibold">Gross Yield</th>
                <th className="py-4 px-5 font-semibold">Transfer Tax</th>
                <th className="py-4 px-5 font-semibold">Capital Gains Tax</th>
                <th className="py-4 px-5 font-semibold">Golden Visa Tier</th>
                <th className="py-4 px-5 font-semibold">Rental YoY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-zinc-300">
              {visibleRows.map((row) => {
                const convertedPriceSqM = formatPrice(row.basePriceSqMUSD, currentCurrency);
                const goldenVisaDisplay = row.goldenVisaUSD
                  ? formatPrice(row.goldenVisaUSD, currentCurrency, { compact: true })
                  : 'N/A';

                const isTaxHaven = row.capitalGainsTax.includes('0%');

                return (
                  <tr
                    key={row.city}
                    className="hover:bg-white/[0.03] transition-colors duration-150 group"
                  >
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{row.flag}</span>
                        <div>
                          <div className="font-bold text-white group-hover:text-[#D4AF37] transition">
                            {row.city}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {row.country}
                            {row.inflationPct != null ? ` • CPI ${row.inflationPct}%` : ''}
                            {row.source ? ` • ${row.source}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5 whitespace-nowrap font-bold text-white text-sm">
                      {convertedPriceSqM}
                    </td>

                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold">
                        {row.avgGrossYield}%
                      </span>
                    </td>

                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className={row.transferTaxPct > 10 ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                        {isLockedFreeUser ? '🔒 Starter' : `${row.transferTaxPct}%`}
                      </span>
                    </td>

                    <td className="py-4 px-5 whitespace-nowrap">
                      {isLockedFreeUser ? (
                        <span className="text-zinc-500">🔒 Locked (FREE)</span>
                      ) : isTaxHaven ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                          0% TAX HAVEN
                        </span>
                      ) : (
                        <span className="text-zinc-400">{row.capitalGainsTax}</span>
                      )}
                    </td>

                    <td className="py-4 px-5 whitespace-nowrap text-cyan-400 font-medium">
                      {isLockedFreeUser ? '🔒 Starter+' : goldenVisaDisplay}
                    </td>

                    <td className="py-4 px-5 whitespace-nowrap text-emerald-400 font-bold">
                      +{row.rentalGrowthYoY}%
                    </td>
                  </tr>
                );
              })}

              {lockedRows.map((row) => (
                <tr key={row.city} className="opacity-30 blur-[2px] select-none pointer-events-none">
                  <td className="py-4 px-5 whitespace-nowrap">{row.flag} {row.city}</td>
                  <td className="py-4 px-5 whitespace-nowrap">--</td>
                  <td className="py-4 px-5 whitespace-nowrap">--%</td>
                  <td className="py-4 px-5 whitespace-nowrap">--%</td>
                  <td className="py-4 px-5 whitespace-nowrap">LOCKED</td>
                  <td className="py-4 px-5 whitespace-nowrap">LOCKED</td>
                  <td className="py-4 px-5 whitespace-nowrap">--%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLockedFreeUser && (
          <div className="p-4 bg-gradient-to-r from-black/90 via-zinc-900/95 to-black/90 border-t border-[#D4AF37]/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-200">
              <Lock className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Full Cross-border Tax &amp; Visa Matrix is locked on FREE plan.</span>
            </div>
            {onOpenPricing && (
              <button
                type="button"
                onClick={onOpenPricing}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span>Upgrade to Starter</span>
              </button>
            )}
          </div>
        )}
      </div>

    </section>
  );
};
