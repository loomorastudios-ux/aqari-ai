import React, { useState, useEffect } from 'react';
import { Globe2, TrendingUp, Percent, Activity, ShieldAlert, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import type { CurrencyCode, GlobalMarketIntelCity } from '../../types';
import { formatPrice } from '../../utils/formatters';

interface MarketIntelligencePanelProps {
  currentCurrency: CurrencyCode;
  onOpenRenewal?: () => void;
}

export const MarketIntelligencePanel: React.FC<MarketIntelligencePanelProps> = ({
  currentCurrency,
  onOpenRenewal,
}) => {
  const [markets, setMarkets] = useState<GlobalMarketIntelCity[]>([]);
  const [selectedCityName, setSelectedCityName] = useState<string>('Muscat');
  const [isBasicMarket, setIsBasicMarket] = useState(false);
  const [marketDisclaimer, setMarketDisclaimer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/app?action=market-intelligence', { credentials: 'include' });
        const data = await res.json();
        if (active && res.ok && data.success && Array.isArray(data.markets)) {
          setMarkets(data.markets);
          setIsBasicMarket(Boolean(data.isBasicMarket));
          setMarketDisclaimer(data.disclaimer ? String(data.disclaimer) : null);
        }
      } catch {
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const selected =
    markets.find((m) => m.city === selectedCityName) || markets[0] || null;

  return (
    <div className="space-y-6 pt-6 border-t border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-1.5">
            <Globe2 className="w-3.5 h-3.5" />
            <span>GLOBAL MARKET INTELLIGENCE • SOURCE &amp; DATE VERIFIED</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Rent Growth, Historical Prices, Vacancy, Rates, Volume &amp; Risk
          </h3>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />}
          <select
            value={selected?.city || selectedCityName}
            onChange={(e) => setSelectedCityName(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-black/70 border border-[#D4AF37]/40 text-white font-bold"
          >
            {markets.map((m) => (
              <option key={m.city} value={m.city}>
                {m.flag} {m.city} ({m.country})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isBasicMarket && marketDisclaimer && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-amber-200">
          <span>{marketDisclaimer}</span>
          {onOpenRenewal && (
            <button
              type="button"
              onClick={onOpenRenewal}
              className="px-3 py-1 rounded-lg bg-[#D4AF37] text-black font-bold cursor-pointer shrink-0"
            >
              Upgrade for Full Global Benchmarks
            </button>
          )}
        </div>
      )}

      {selected && (
        <>
          {/* 6 Granular Indicator Cards with Individual Source + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
            <div className="glass-panel p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase">
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-400" /> Rent Growth YoY</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">[Estimated]</span>
              </div>
              <div className="text-2xl font-black text-emerald-300">+{selected.rentGrowthYoY}%</div>
              <div className="text-[10px] text-zinc-400">
                Source: {selected.rentGrowthSource} • Date: {selected.rentGrowthDate}
              </div>
            </div>

            <div className="glass-panel p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase">
                <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-cyan-400" /> Market Vacancy Rate</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">[Estimated]</span>
              </div>
              <div className="text-2xl font-black text-cyan-300">{selected.vacancyPct}%</div>
              <div className="text-[10px] text-zinc-400">
                Source: {selected.vacancySource} • Date: {selected.vacancyDate}
              </div>
            </div>

            <div className="glass-panel p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase">
                <span className="flex items-center gap-1"><Percent className="w-3 h-3 text-[#D4AF37]" /> Benchmark Mortgage Rate</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">[Estimated]</span>
              </div>
              <div className="text-2xl font-black text-[#D4AF37]">{selected.interestRatePct}%</div>
              <div className="text-[10px] text-zinc-400">
                Source: {selected.interestRateSource} • Date: {selected.interestRateDate}
              </div>
            </div>

            <div className="glass-panel p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase">
                <span>Annual Transaction Volume</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">[Estimated]</span>
              </div>
              <div className="text-xl font-black text-white">
                {formatPrice(selected.transactionVolumeUSD, currentCurrency, { compact: true })}
              </div>
              <div className="text-[11px] text-zinc-300">{selected.transactionVolumeLabel}</div>
              <div className="text-[10px] text-zinc-400">
                Source: {selected.transactionSource} • Date: {selected.transactionDate}
              </div>
            </div>

            <div className="glass-panel p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase">
                <span>Supply / Demand Forecast</span>
                <span className="px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold">
                  {selected.supplyDemandBalance}
                </span>
              </div>
              <div className="text-xs text-white font-bold">Supply: {selected.supplyForecast}</div>
              <div className="text-xs text-emerald-300">Demand: {selected.demandForecast}</div>
              <div className="text-[10px] text-zinc-400">
                Source: {selected.supplyDemandSource} • Date: {selected.supplyDemandDate}
              </div>
            </div>

            <div className="glass-panel p-4 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase">
                <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-amber-400" /> Political / Economic Risk</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold">
                  {selected.politicalEconomicRisk} ({selected.riskScore}/100)
                </span>
              </div>
              <div className="text-2xl font-black text-white">{selected.riskScore}/100 Stability</div>
              <div className="text-[10px] text-zinc-400">
                Source: {selected.riskSource} • Date: {selected.riskDate}
              </div>
            </div>
          </div>

          {/* 5-Year Historical Price Index Chart */}
          <div className="glass-panel p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
              <div className="font-bold text-[#D4AF37] uppercase">
                5-Year Historical Price Index ({selected.city}, Base 2022 = 100)
              </div>
              <div className="text-[11px] text-zinc-400">
                Source: {selected.historicalSource} • Updated: {selected.historicalDate}
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selected.historicalPriceIndex}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="year" stroke="#9ca3af" fontSize={11} />
                  <YAxis domain={['auto', 'auto']} stroke="#9ca3af" fontSize={11} />
                  <RechartsTooltip
                    contentStyle={{ background: '#09090b', border: '1px solid #D4AF37', fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="index"
                    name="Price Index"
                    stroke="#D4AF37"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#D4AF37' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Cross-Market Intelligence Table */}
      {markets.length > 0 && (
        <div className="glass-panel overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-white/[0.03] border-b border-white/[0.08] text-zinc-400 uppercase">
              <tr>
                <th className="py-3 px-4">Market</th>
                <th className="py-3 px-4">Rent Growth</th>
                <th className="py-3 px-4">Vacancy</th>
                <th className="py-3 px-4">Mortgage Rate</th>
                <th className="py-3 px-4">Volume</th>
                <th className="py-3 px-4">Supply / Demand</th>
                <th className="py-3 px-4">Pol/Econ Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {markets.map((m) => (
                <tr
                  key={m.city}
                  onClick={() => setSelectedCityName(m.city)}
                  className={`cursor-pointer hover:bg-white/[0.03] ${
                    selected?.city === m.city ? 'bg-[#D4AF37]/[0.06]' : ''
                  }`}
                >
                  <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                    {m.flag} {m.city}
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-emerald-300 font-bold">+{m.rentGrowthYoY}%</div>
                    <div className="text-[10px] text-zinc-500">{m.rentGrowthSource} ({m.rentGrowthDate})</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-cyan-300 font-bold">{m.vacancyPct}%</div>
                    <div className="text-[10px] text-zinc-500">{m.vacancyDate}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-[#D4AF37] font-bold">{m.interestRatePct}%</div>
                    <div className="text-[10px] text-zinc-500">{m.interestRateDate}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-white">{formatPrice(m.transactionVolumeUSD, currentCurrency, { compact: true })}</div>
                    <div className="text-[10px] text-zinc-500">{m.transactionDate}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-zinc-200">{m.supplyDemandBalance}</div>
                    <div className="text-[10px] text-zinc-500">{m.supplyDemandDate}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-emerald-300">{m.politicalEconomicRisk} ({m.riskScore})</div>
                    <div className="text-[10px] text-zinc-500">{m.riskDate}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
