import React from 'react';
import { CurrencyCode, MarketMatrixRow } from '../types';
import { FALLBACK_CROSS_BORDER_DATA } from '../constants';
import { formatPrice } from '../utils/formatters';
import { Globe, ArrowUpRight, ShieldCheck, Scale, Activity } from 'lucide-react';

interface CrossBorderMatrixProps {
  currentCurrency: CurrencyCode;
  matrixData?: MarketMatrixRow[];
  isLive?: boolean;
  lastUpdatedMinutes?: number;
}

export const CrossBorderMatrix: React.FC<CrossBorderMatrixProps> = ({ 
  currentCurrency, 
  matrixData = FALLBACK_CROSS_BORDER_DATA,
  isLive = true,
  lastUpdatedMinutes = 2
}) => {
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
            Compare acquisition valuations per square meter, transfer tax penalties, and sovereign foreign ownership frameworks across prime financial centers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-zinc-300">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isLive ? `Live Feed (updated ${lastUpdatedMinutes}m ago)` : 'Data as of Nov 2026'}</span>
          </div>

          <div className="text-xs font-mono text-zinc-400 bg-white/[0.03] border border-white/[0.08] px-3.5 py-1.5 rounded-xl">
            Base: <strong className="text-[#D4AF37]">{currentCurrency}</strong>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-panel overflow-hidden border border-white/[0.08]">
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
              {matrixData.map((row) => {
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
                    {/* City & Country */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{row.flag}</span>
                        <div>
                          <div className="font-bold text-white group-hover:text-[#D4AF37] transition">
                            {row.city}
                          </div>
                          <div className="text-[10px] text-zinc-400">{row.country}</div>
                        </div>
                      </div>
                    </td>

                    {/* Price / m² */}
                    <td className="py-4 px-5 whitespace-nowrap font-bold text-white text-sm">
                      {convertedPriceSqM}
                    </td>

                    {/* Gross Yield */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold">
                        {row.avgGrossYield}%
                      </span>
                    </td>

                    {/* Transfer Tax */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className={row.transferTaxPct > 10 ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                        {row.transferTaxPct}%
                      </span>
                    </td>

                    {/* Capital Gains Tax */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      {isTaxHaven ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                          0% TAX HAVEN
                        </span>
                      ) : (
                        <span className="text-zinc-400">{row.capitalGainsTax}</span>
                      )}
                    </td>

                    {/* Golden Visa Tier */}
                    <td className="py-4 px-5 whitespace-nowrap text-cyan-400 font-medium">
                      {goldenVisaDisplay}
                    </td>

                    {/* Rental YoY */}
                    <td className="py-4 px-5 whitespace-nowrap text-emerald-400 font-bold">
                      +{row.rentalGrowthYoY}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </section>
  );
};
