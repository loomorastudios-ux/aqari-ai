import React from 'react';
import { CurrencyCode, MarketMatrixRow, User } from '../types';
import { FALLBACK_CROSS_BORDER_DATA } from '../constants';
import { formatPrice } from '../utils/formatters';
import { canUseFeature } from '../../lib/plans';
import { Scale, Activity, Lock, Zap } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui/table';
import { FadeInCard } from './ui/motion-primitives';
import { Button } from './ui/button';

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
  const hasFullMatrixFeature = user
    ? Array.isArray(user.features) && user.features.length > 0
      ? user.features.includes('Cross-border Tax & Visa Matrix') && user.subscriptionStatus !== 'expired'
      : canUseFeature(user.plan, 'crossBorderMatrixFull') && user.subscriptionStatus !== 'expired'
    : true;
  const isLockedFreeUser = Boolean(user && !hasFullMatrixFeature);
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

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>
              Updated: {lastSyncedDisplay} • Sources: World Bank / DLD / ONS / JLL
            </span>
          </div>

          <div className="text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-xl">
            Type: [Estimated] • Base: <strong className="text-[#D4AF37]">{currentCurrency}</strong>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <FadeInCard className="glass-panel overflow-hidden border border-white/[0.08] relative">
        <Table>
          <TableHeader className="bg-white/[0.04] border-b border-white/[0.08]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-4 px-5 text-[11px]">City & Market</TableHead>
              <TableHead className="py-4 px-5 text-[11px]">Price / m² ({currentCurrency})</TableHead>
              <TableHead className="py-4 px-5 text-[11px]">Gross Yield</TableHead>
              <TableHead className="py-4 px-5 text-[11px]">Transfer Tax</TableHead>
              <TableHead className="py-4 px-5 text-[11px]">Capital Gains Tax</TableHead>
              <TableHead className="py-4 px-5 text-[11px]">Golden Visa Tier</TableHead>
              <TableHead className="py-4 px-5 text-[11px]">Rental YoY</TableHead>
              <TableHead className="py-4 px-5 text-[11px]">Source &amp; Verified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-white/[0.05] text-zinc-300">
            {visibleRows.map((row) => {
              const convertedPriceSqM = formatPrice(row.basePriceSqMUSD, currentCurrency);
              const goldenVisaDisplay = row.goldenVisaUSD
                ? formatPrice(row.goldenVisaUSD, currentCurrency, { compact: true })
                : 'N/A';

              const isTaxHaven = row.capitalGainsTax.includes('0%');
              const dataType = row.dataType || 'Estimated';
              const updatedDate = row.updatedDate || '2026-04-01';
              const taxVerified = row.taxVerifiedDate || '2026-04-01';

              return (
                <TableRow
                  key={row.city}
                  className="hover:bg-white/[0.03] transition-colors duration-150 group"
                >
                  <TableCell className="py-4 px-5 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{row.flag}</span>
                      <div>
                        <div className="font-bold text-white group-hover:text-[#D4AF37] transition flex items-center gap-1.5">
                          <span>{row.city}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-mono">
                            [{dataType}]
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {row.country}
                          {row.inflationPct != null ? ` • CPI ${row.inflationPct}%` : ''}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-4 px-5 whitespace-nowrap font-bold text-white text-sm">
                    {convertedPriceSqM}
                  </TableCell>

                  <TableCell className="py-4 px-5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold">
                      {row.avgGrossYield}%
                    </span>
                  </TableCell>

                  <TableCell className="py-4 px-5 whitespace-nowrap">
                    <span className={row.transferTaxPct > 10 ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                      {isLockedFreeUser ? '🔒 Starter' : `${row.transferTaxPct}%`}
                    </span>
                  </TableCell>

                  <TableCell className="py-4 px-5 whitespace-nowrap">
                    {isLockedFreeUser ? (
                      <span className="text-zinc-500">🔒 Locked (FREE)</span>
                    ) : isTaxHaven ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        0% TAX HAVEN
                      </span>
                    ) : (
                      <span className="text-zinc-400">{row.capitalGainsTax}</span>
                    )}
                  </TableCell>

                  <TableCell className="py-4 px-5 whitespace-nowrap text-cyan-400 font-medium">
                    {isLockedFreeUser ? '🔒 Starter+' : goldenVisaDisplay}
                  </TableCell>

                  <TableCell className="py-4 px-5 whitespace-nowrap text-emerald-400 font-bold">
                    +{row.rentalGrowthYoY}%
                  </TableCell>

                  <TableCell className="py-4 px-5 text-[10px] font-mono text-zinc-400 max-w-[220px]">
                    <div className="truncate text-zinc-300" title={row.taxSource || row.source}>
                      {row.taxSource || row.source || 'Official Registry'}
                    </div>
                    <div className="text-zinc-500">
                      Updated: {updatedDate} • Tax verified: {taxVerified}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {lockedRows.map((row) => (
              <TableRow key={row.city} className="opacity-30 blur-[2px] select-none pointer-events-none">
                <TableCell className="py-4 px-5 whitespace-nowrap">{row.flag} {row.city}</TableCell>
                <TableCell className="py-4 px-5 whitespace-nowrap">--</TableCell>
                <TableCell className="py-4 px-5 whitespace-nowrap">--%</TableCell>
                <TableCell className="py-4 px-5 whitespace-nowrap">--%</TableCell>
                <TableCell className="py-4 px-5 whitespace-nowrap">LOCKED</TableCell>
                <TableCell className="py-4 px-5 whitespace-nowrap">LOCKED</TableCell>
                <TableCell className="py-4 px-5 whitespace-nowrap">--%</TableCell>
                <TableCell className="py-4 px-5 whitespace-nowrap">LOCKED</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="px-5 py-3 bg-amber-500/[0.06] border-t border-amber-500/20 text-[11px] font-mono text-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Official Tax/Visa Sources: Oman MoHUP, Dubai DLD/FTA, Saudi REGA/ZATCA, IRS/Florida/NYS, UK HMRC, Singapore IRAS (Verified 2026-04-01).
          </span>
          <span className="font-bold text-amber-300 shrink-0">
            Not legal/tax advice. Verify rates with licensed local counsel.
          </span>
        </div>

        {isLockedFreeUser && (
          <div className="p-4 bg-gradient-to-r from-black/90 via-zinc-900/95 to-black/90 border-t border-[#D4AF37]/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-200">
              <Lock className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Full Cross-border Tax &amp; Visa Matrix is locked on FREE plan.</span>
            </div>
            {onOpenPricing && (
              <Button
                type="button"
                variant="solidGold"
                onClick={onOpenPricing}
                className="uppercase tracking-wider shrink-0"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span>Upgrade to Starter</span>
              </Button>
            )}
          </div>
        )}
      </FadeInCard>

    </section>
  );
};
