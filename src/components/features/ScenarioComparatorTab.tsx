import React, { useState, useEffect } from 'react';
import { Scale, Loader2, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { SafeChartContainer } from '../charts/SafeChartContainer';
import type {
  CurrencyCode,
  SavedAnalysis,
  ScenarioCompareInput,
  ScenarioCompareOutput,
} from '../../types';
import { formatPrice } from '../../utils/formatters';

interface ScenarioComparatorTabProps {
  userEmail: string;
  currentCurrency: CurrencyCode;
  savedAnalyses: SavedAnalysis[];
  compareLimit?: number;
  onOpenRenewal?: () => void;
  persistedComparison?: { scenarios: ScenarioCompareOutput[]; created_at: string } | null;
  onComparisonSaved: (payload: { scenarios: ScenarioCompareOutput[]; created_at: string }) => void;
}

const DEFAULT_INPUTS: ScenarioCompareInput[] = [
  {
    id: 'sc-1',
    label: 'Scenario A • Muscat',
    city: 'Muscat',
    priceUSD: 650000,
    monthlyRentUSD: 4550,
    downPaymentPct: 30,
    interestRatePct: 5.65,
    operatingExpensePct: 14,
  },
  {
    id: 'sc-2',
    label: 'Scenario B • Dubai',
    city: 'Dubai',
    priceUSD: 950000,
    monthlyRentUSD: 6950,
    downPaymentPct: 30,
    interestRatePct: 4.85,
    operatingExpensePct: 18,
  },
  {
    id: 'sc-3',
    label: 'Scenario C • Riyadh',
    city: 'Riyadh',
    priceUSD: 820000,
    monthlyRentUSD: 6010,
    downPaymentPct: 30,
    interestRatePct: 5.5,
    operatingExpensePct: 15,
  },
];

export const ScenarioComparatorTab: React.FC<ScenarioComparatorTabProps> = ({
  userEmail,
  currentCurrency,
  savedAnalyses,
  compareLimit = 3,
  onOpenRenewal,
  persistedComparison,
  onComparisonSaved,
}) => {
  const maxAllowedSlots = Math.max(1, compareLimit);
  const initialSlices = DEFAULT_INPUTS.slice(0, Math.min(3, maxAllowedSlots));
  const [inputs, setInputs] = useState<ScenarioCompareInput[]>(initialSlices);
  const [results, setResults] = useState<ScenarioCompareOutput[]>(
    persistedComparison?.scenarios?.slice(0, maxAllowedSlots) || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runComparison = async (customInputs = inputs) => {
    setLoading(true);
    setError(null);
    const payloadInputs = customInputs.slice(0, maxAllowedSlots);
    try {
      const res = await fetch('/api/app?action=scenario-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          login_email: userEmail,
          scenarios: payloadInputs,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Comparison failed.');
        return;
      }
      setResults(data.scenarios || []);
      onComparisonSaved({
        scenarios: data.scenarios || [],
        created_at: data.created_at || new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Network error comparing scenarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!persistedComparison?.scenarios?.length) {
      runComparison(initialSlices);
    }
  }, []);

  const updateField = (idx: number, patch: Partial<ScenarioCompareInput>) => {
    setInputs((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const applySaved = (idx: number, savedId: string) => {
    const found = savedAnalyses.find((a) => a.id === savedId);
    if (!found) return;
    updateField(idx, {
      label: found.property,
      city: found.city,
      priceUSD: found.price,
      monthlyRentUSD: found.rent,
    });
  };

  const chartData = results.map((r) => ({
    name: `${r.city} (${r.label.slice(0, 14)})`,
    NetYield: r.netYieldPct ?? 0,
    CashOnCash: r.cashOnCash ?? 0,
    IRR5Yr: r.irr5Yr ?? 0,
    Liquidity: r.liquidityScore,
  }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
            <Scale className="w-3.5 h-3.5" />
            <span>CROSS-BORDER SCENARIO COMPARATOR</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Compare Properties / Scenarios (Up to {maxAllowedSlots})
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Side-by-side Net Yield, Financing (LTV / Debt Service / DSCR), Risk, Tax &amp; Visa, and Liquidity comparison • 0 AI Credits.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => runComparison(inputs)}
          className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>Compare {inputs.length} {inputs.length === 1 ? 'Scenario' : 'Scenarios'}</span>
        </button>
      </div>

      {maxAllowedSlots < 3 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-amber-200">
          <span>
            FREE plan supports {maxAllowedSlots} scenario preview. Upgrade to STARTER (3 scenarios), PRO (10), SOVEREIGN (25), or ENTERPRISE (50).
          </span>
          {onOpenRenewal && (
            <button
              type="button"
              onClick={onOpenRenewal}
              className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold cursor-pointer"
            >
              Upgrade Plan
            </button>
          )}
        </div>
      )}

      {/* 3 Editable Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        {inputs.map((sc, idx) => (
          <div key={sc.id} className="glass-panel p-4 space-y-3 border border-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#D4AF37]">SCENARIO #{idx + 1}</span>
              {savedAnalyses.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => applySaved(idx, e.target.value)}
                  className="px-2 py-1 rounded bg-black/70 border border-white/15 text-[10px] text-zinc-300 max-w-[140px]"
                >
                  <option value="" disabled>Load saved...</option>
                  {savedAnalyses.map((a) => (
                    <option key={a.id} value={a.id}>{a.property}</option>
                  ))}
                </select>
              )}
            </div>

            <input
              type="text"
              value={sc.label}
              onChange={(e) => updateField(idx, { label: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs font-bold"
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-zinc-400">City</label>
                <select
                  value={sc.city}
                  onChange={(e) => updateField(idx, { city: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/70 border border-white/15 text-white"
                >
                  <option value="Muscat">Muscat</option>
                  <option value="Dubai">Dubai</option>
                  <option value="Riyadh">Riyadh</option>
                  <option value="London">London</option>
                  <option value="Singapore">Singapore</option>
                  <option value="New York">New York</option>
                  <option value="Miami">Miami</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400">Price (USD)</label>
                <input
                  type="number"
                  value={sc.priceUSD}
                  onChange={(e) => updateField(idx, { priceUSD: Number(e.target.value) || 0 })}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400">Monthly Rent ($)</label>
                <input
                  type="number"
                  value={sc.monthlyRentUSD}
                  onChange={(e) => updateField(idx, { monthlyRentUSD: Number(e.target.value) || 0 })}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400">Down Pmt % / Rate %</label>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    value={sc.downPaymentPct}
                    onChange={(e) => updateField(idx, { downPaymentPct: Number(e.target.value) || 0 })}
                    className="w-full px-1.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={sc.interestRatePct}
                    onChange={(e) => updateField(idx, { interestRatePct: Number(e.target.value) || 0 })}
                    className="w-full px-1.5 py-2 rounded-lg bg-black/50 border border-white/15 text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Comparison Table */}
          <div className="glass-panel overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/[0.03] border-b border-white/[0.08] text-zinc-400 uppercase">
                <tr>
                  <th className="py-3.5 px-4">Metric</th>
                  {results.map((r) => (
                    <th key={r.id} className="py-3.5 px-4 text-[#D4AF37]">
                      {r.label} ({r.city})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                <tr>
                  <td className="py-3 px-4 font-bold text-zinc-300">Acquisition Price</td>
                  {results.map((r) => (
                    <td key={r.id} className="py-3 px-4 text-white font-bold">
                      {formatPrice(r.priceUSD, currentCurrency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-zinc-300">Net Yield (Cap Rate)</td>
                  {results.map((r) => (
                    <td key={r.id} className="py-3 px-4 text-[#D4AF37] font-black text-sm">
                      {r.netYieldPct !== null ? `${r.netYieldPct}%` : 'Not available'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-zinc-300">Cash-on-Cash / 5Y IRR</td>
                  {results.map((r) => (
                    <td key={r.id} className="py-3 px-4 text-emerald-300 font-bold">
                      {r.cashOnCash !== null ? `${r.cashOnCash}% CoC` : 'Not available'} / {r.irr5Yr !== null ? `${r.irr5Yr}% IRR` : 'Not available'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-zinc-300">Financing (LTV / Debt / DSCR)</td>
                  {results.map((r) => (
                    <td key={r.id} className="py-3 px-4 text-cyan-300">
                      {r.ltvPct}% LTV • {formatPrice(r.monthlyDebtServiceUSD, currentCurrency)}/mo •{' '}
                      <strong>{r.dscr ? `${r.dscr}x` : 'Not available: No debt'}</strong>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-zinc-300">Monthly Net Cashflow</td>
                  {results.map((r) => (
                    <td
                      key={r.id}
                      className={`py-3 px-4 font-bold ${
                        (r.monthlyCashflowUSD ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {r.monthlyCashflowUSD !== null ? `${formatPrice(r.monthlyCashflowUSD, currentCurrency)}/mo` : 'Not available'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-zinc-300">Risk &amp; Liquidity Score</td>
                  {results.map((r) => (
                    <td key={r.id} className="py-3 px-4 text-zinc-200">
                      Risk <strong>{r.riskScore}/100</strong> • Liquidity <strong>{r.liquidityScore}/100</strong>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-zinc-300">Tax &amp; Residency (Not Tax Advice)</td>
                  {results.map((r) => (
                    <td key={r.id} className="py-3 px-4 text-zinc-300">
                      <div>
                        Transfer {r.transferTaxPct}% • CGT: {r.capitalGainsTax}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Golden Visa:{' '}
                        {r.goldenVisaUSD ? formatPrice(r.goldenVisaUSD, currentCurrency) : 'N/A'} • {r.taxSource}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Comparative Recharts Bar Chart */}
          <div className="glass-panel p-5 space-y-2">
            <div className="text-xs font-mono font-bold text-[#D4AF37] uppercase">
              Yield, IRR &amp; Liquidity Benchmark Comparison
            </div>
            <div className="min-h-[256px] h-64 w-full">
              <SafeChartContainer minWidth={280} minHeight={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={10} />
                  <RechartsTooltip
                    contentStyle={{ background: '#09090b', border: '1px solid #D4AF37', fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="NetYield" name="Net Yield (%)" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="CashOnCash" name="Cash-on-Cash (%)" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="IRR5Yr" name="5-Yr IRR (%)" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </SafeChartContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
