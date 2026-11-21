import React, { useState, useEffect } from 'react';
import {
  MapPin,
  TrendingUp,
  AlertTriangle,
  Landmark,
  ShieldCheck,
  Leaf,
  Navigation,
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { CurrencyCode, PortfolioAssetPostPurchase, SavedAnalysis } from '../../types';
import { formatPrice } from '../../utils/formatters';

interface PortfolioIntelligencePanelProps {
  userEmail: string;
  currentCurrency: CurrencyCode;
  savedAnalyses: SavedAnalysis[];
  initialAssets?: PortfolioAssetPostPurchase[];
  portfolioAssetsLimit?: number;
}

export const PortfolioIntelligencePanel: React.FC<PortfolioIntelligencePanelProps> = ({
  userEmail,
  currentCurrency,
  savedAnalyses,
  initialAssets,
  portfolioAssetsLimit,
}) => {
  const [assets, setAssets] = useState<PortfolioAssetPostPurchase[]>(initialAssets || []);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add post-purchase asset form
  const [propName, setPropName] = useState('');
  const [city, setCity] = useState('Muscat');
  const [purchaseDate, setPurchaseDate] = useState('2025-01-15');
  const [purchasePriceUSD, setPurchasePriceUSD] = useState('650000');
  const [currentValueUSD, setCurrentValueUSD] = useState('705000');
  const [forecastRentMonthlyUSD, setForecastRentMonthlyUSD] = useState('4550');
  const [actualRentMonthlyUSD, setActualRentMonthlyUSD] = useState('4720');
  const [loanBalanceUSD, setLoanBalanceUSD] = useState('420000');
  const [interestRatePct, setInterestRatePct] = useState('5.5');
  const [loanMaturityDate, setLoanMaturityDate] = useState('2030-06-30');
  const [error, setError] = useState<string | null>(null);

  const fetchIntel = async () => {
    if (!userEmail) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/app?action=portfolio-intelligence&email=${encodeURIComponent(userEmail)}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setAssets(data.assets || []);
        setSummary(data.summary || null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load portfolio intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntel();
  }, [userEmail]);

  const postAction = async (payload: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/app?action=portfolio-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: userEmail, ...payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed updating post-purchase portfolio.');
        return;
      }
      setAssets(data.assets || []);
      setSummary(data.summary || null);
      setShowAddForm(false);
    } catch (err: any) {
      setError(err?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await postAction({
      subAction: 'add',
      asset: {
        property: propName.trim() || `${city} Acquired Asset`,
        city,
        purchaseDate,
        purchasePriceUSD: Number(purchasePriceUSD) || 500000,
        currentValueUSD: Number(currentValueUSD) || 500000,
        forecastRentMonthlyUSD: Number(forecastRentMonthlyUSD) || 3500,
        actualRentMonthlyUSD: Number(actualRentMonthlyUSD) || 3500,
        loanBalanceUSD: Number(loanBalanceUSD) || 0,
        interestRatePct: Number(interestRatePct) || 5.5,
        loanMaturityDate,
      },
    });
    setPropName('');
  };

  const chartData = assets.map((a) => ({
    name: a.property.slice(0, 16),
    ForecastRent: a.forecastRentMonthlyUSD,
    ActualRent: a.actualRentMonthlyUSD,
  }));

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0] || null;

  return (
    <div className="space-y-6 pt-4 border-t border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>POST-PURCHASE PORTFOLIO INTELLIGENCE</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Asset Performance, Loan Obligations &amp; ESG/Climate Tracking
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-zinc-300">
            Assets: <strong className="text-[#D4AF37]">{assets.length} / {portfolioAssetsLimit ?? 10}</strong>
          </span>
          {savedAnalyses.length > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => postAction({ subAction: 'seed-from-saved' })}
              className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-mono text-zinc-200 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Import Saved Analyses</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-mono font-bold text-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Track Acquired Asset</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
          {error}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAdd} className="glass-panel p-5 space-y-4 border border-[#D4AF37]/30 font-mono">
          <div className="text-xs font-bold text-[#D4AF37] uppercase">
            Add Post-Purchase Holding (Persists to Account)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <input
              type="text"
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
              placeholder="Asset Name (e.g. Al Mouj Villa 4)"
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black/70 border border-white/15 text-white"
            >
              <option value="Muscat">Muscat</option>
              <option value="Dubai">Dubai</option>
              <option value="Riyadh">Riyadh</option>
              <option value="London">London</option>
              <option value="Singapore">Singapore</option>
              <option value="New York">New York</option>
              <option value="Miami">Miami</option>
            </select>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <input
              type="number"
              value={purchasePriceUSD}
              onChange={(e) => setPurchasePriceUSD(e.target.value)}
              placeholder="Purchase Price $"
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <input
              type="number"
              value={currentValueUSD}
              onChange={(e) => setCurrentValueUSD(e.target.value)}
              placeholder="Current Valuation $"
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <input
              type="number"
              value={forecastRentMonthlyUSD}
              onChange={(e) => setForecastRentMonthlyUSD(e.target.value)}
              placeholder="Forecast Rent $/mo"
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <input
              type="number"
              value={actualRentMonthlyUSD}
              onChange={(e) => setActualRentMonthlyUSD(e.target.value)}
              placeholder="Actual Rent $/mo"
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <input
              type="number"
              value={loanBalanceUSD}
              onChange={(e) => setLoanBalanceUSD(e.target.value)}
              placeholder="Loan Balance $"
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <input
              type="number"
              step="0.1"
              value={interestRatePct}
              onChange={(e) => setInterestRatePct(e.target.value)}
              placeholder="Loan Rate %"
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <input
              type="date"
              value={loanMaturityDate}
              onChange={(e) => setLoanMaturityDate(e.target.value)}
              placeholder="Loan Maturity"
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs cursor-pointer"
          >
            {loading ? 'Saving...' : 'Save Post-Purchase Asset'}
          </button>
        </form>
      )}

      {loading && assets.length === 0 ? (
        <div className="glass-panel p-8 text-center font-mono text-xs text-zinc-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
          <span>Loading Post-Purchase Intelligence...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="glass-panel p-8 text-center space-y-3 border border-dashed border-white/15">
          <div className="text-sm font-bold text-white">No post-purchase assets tracked yet</div>
          <p className="text-xs font-mono text-zinc-400">
            Click &ldquo;Track Acquired Asset&rdquo; or &ldquo;Import Saved Analyses&rdquo; to monitor Actual vs Forecast rent, loan maturities, ESG/Climate scores, and cluster concentration.
          </p>
        </div>
      ) : (
        <>
          {/* Intelligence Scorecards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
            <div className="glass-panel p-4">
              <div className="text-[10px] text-zinc-400 uppercase">Portfolio Score</div>
              <div className="text-2xl font-black text-[#D4AF37] mt-1">
                {summary?.avgScores?.overall ?? 0}/100
              </div>
              <div className="text-[10px] text-zinc-500">Top Cluster: {summary?.topCluster?.cluster || 'N/A'}</div>
            </div>
            <div className="glass-panel p-4">
              <div className="text-[10px] text-zinc-400 uppercase flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Demand
              </div>
              <div className="text-2xl font-black text-emerald-300 mt-1">{summary?.avgScores?.demand ?? 0}</div>
              <div className="text-[10px] text-zinc-500">Tenant absorption</div>
            </div>
            <div className="glass-panel p-4">
              <div className="text-[10px] text-zinc-400 uppercase flex items-center gap-1">
                <Navigation className="w-3 h-3 text-cyan-400" /> Mobility
              </div>
              <div className="text-2xl font-black text-cyan-300 mt-1">{summary?.avgScores?.mobility ?? 0}</div>
              <div className="text-[10px] text-zinc-500">Transit &amp; access</div>
            </div>
            <div className="glass-panel p-4">
              <div className="text-[10px] text-zinc-400 uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-400" /> Climate
              </div>
              <div className="text-2xl font-black text-amber-300 mt-1">{summary?.avgScores?.climate ?? 0}</div>
              <div className="text-[10px] text-zinc-500">{(summary?.climateFlags || []).length} flags</div>
            </div>
            <div className="glass-panel p-4">
              <div className="text-[10px] text-zinc-400 uppercase flex items-center gap-1">
                <Leaf className="w-3 h-3 text-emerald-400" /> ESG
              </div>
              <div className="text-2xl font-black text-emerald-200 mt-1">{summary?.avgScores?.esg ?? 0}</div>
              <div className="text-[10px] text-zinc-500">Efficiency rating</div>
            </div>
            <div className="glass-panel p-4">
              <div className="text-[10px] text-zinc-400 uppercase flex items-center gap-1">
                <Landmark className="w-3 h-3 text-purple-400" /> Debt Load
              </div>
              <div className="text-lg font-black text-white mt-1">
                {formatPrice(summary?.totalLoanUSD || 0, currentCurrency, { compact: true })}
              </div>
              <div className="text-[10px] text-zinc-500">
                {formatPrice(summary?.totalMonthlyDebtUSD || 0, currentCurrency)}/mo svc
              </div>
            </div>
          </div>

          {/* Geo Map + Actual vs Forecast Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="glass-panel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-[#D4AF37] uppercase">
                  Spatial Asset Map &amp; Top Cluster ({summary?.topCluster?.cluster || 'Global'})
                </div>
                <span className="text-[10px] font-mono text-zinc-400">{assets.length} active pins</span>
              </div>
              <div className="relative w-full h-56 rounded-xl bg-[#050608] border border-white/10 overflow-hidden">
                <svg viewBox="0 0 360 180" className="w-full h-full">
                  {/* Subtle lat/lng graticule */}
                  {[30, 60, 90, 120, 150].map((y) => (
                    <line key={`lat-${y}`} x1="0" y1={y} x2="360" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                  ))}
                  {[60, 120, 180, 240, 300].map((x) => (
                    <line key={`lng-${x}`} x1={x} y1="0" x2={x} y2="180" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                  ))}
                  {assets.map((a) => {
                    const cx = Math.max(12, Math.min(348, a.lng + 180));
                    const cy = Math.max(12, Math.min(168, 90 - a.lat));
                    const isSelected = selectedAsset?.id === a.id;
                    return (
                      <g
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedAssetId(a.id)}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 10 : 7}
                          fill="rgba(212,175,55,0.22)"
                          stroke="#D4AF37"
                          strokeWidth={isSelected ? 1.5 : 0.8}
                        />
                        <circle cx={cx} cy={cy} r={3} fill="#D4AF37" />
                        <text
                          x={cx + 7}
                          y={cy + 3}
                          fill="#e4e4e7"
                          fontSize="7"
                          fontFamily="monospace"
                        >
                          {a.city}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              {selectedAsset && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-white">{selectedAsset.property}</span>{' '}
                    <span className="text-zinc-400">({selectedAsset.cluster})</span>
                  </div>
                  <div className="text-[#D4AF37] font-bold">
                    Score {selectedAsset.overallScore}/100 • Actual Yield {selectedAsset.actualYieldPct}%
                  </div>
                </div>
              )}
            </div>

            <div className="glass-panel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-[#D4AF37] uppercase">
                  Actual vs Forecast Monthly Rent (USD)
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    (summary?.rentVarianceMonthlyUSD || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  Variance: {(summary?.rentVarianceMonthlyUSD || 0) >= 0 ? '+' : ''}
                  {formatPrice(summary?.rentVarianceMonthlyUSD || 0, currentCurrency)}/mo
                </span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
                    <YAxis stroke="#9ca3af" fontSize={10} />
                    <RechartsTooltip
                      contentStyle={{ background: '#09090b', border: '1px solid #D4AF37', fontSize: 11 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ForecastRent" name="Forecast ($/mo)" fill="#71717a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ActualRent" name="Actual ($/mo)" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Performers + Climate Flags + Risk Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 font-mono text-xs">
            <div className="glass-panel p-4 space-y-2.5">
              <div className="font-bold text-[#D4AF37] flex items-center gap-1.5 uppercase">
                <Award className="w-4 h-4" /> Top Performers
              </div>
              {(summary?.topPerformers || []).map((tp: PortfolioAssetPostPurchase, i: number) => (
                <div key={tp.id} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold">#{i + 1} {tp.property}</div>
                    <div className="text-[10px] text-zinc-400">{tp.city} • Actual {tp.actualYieldPct}% vs {tp.forecastYieldPct}%</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    {tp.overallScore}
                  </span>
                </div>
              ))}
            </div>

            <div className="glass-panel p-4 space-y-2.5">
              <div className="font-bold text-amber-300 flex items-center gap-1.5 uppercase">
                <ShieldCheck className="w-4 h-4" /> Climate &amp; ESG Flags
              </div>
              {(summary?.climateFlags || []).slice(0, 4).map((flag: string, i: number) => (
                <div key={i} className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px]">
                  • {flag}
                </div>
              ))}
            </div>

            <div className="glass-panel p-4 space-y-2.5">
              <div className="font-bold text-rose-300 flex items-center gap-1.5 uppercase">
                <AlertTriangle className="w-4 h-4" /> Risk &amp; Debt Covenant Alerts
              </div>
              {(summary?.riskAlerts || []).length === 0 ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px]">
                  All tracked holdings are performing within rent, LTV, and maturity covenants.
                </div>
              ) : (
                (summary?.riskAlerts || []).slice(0, 4).map((al: any, i: number) => (
                  <div key={i} className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 text-[11px]">
                    <strong>{al.asset}:</strong> {al.message}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detailed Holdings & Loan Obligations Table */}
          <div className="glass-panel overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/[0.03] border-b border-white/[0.08] text-zinc-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Asset / Cluster</th>
                  <th className="py-3 px-4">Purchase → Current Val</th>
                  <th className="py-3 px-4">Actual vs Forecast Rent</th>
                  <th className="py-3 px-4">Yield (Act / Fcst)</th>
                  <th className="py-3 px-4">Loan Obligation &amp; Maturity</th>
                  <th className="py-3 px-4">Scores (D/M/C/E)</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {assets.map((a) => {
                  const valDelta = a.currentValueUSD - a.purchasePriceUSD;
                  return (
                    <tr key={a.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{a.property}</div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#D4AF37]" />
                          {a.city} • {a.cluster}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-bold">{formatPrice(a.currentValueUSD, currentCurrency)}</div>
                        <div className={`text-[10px] ${valDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          From {formatPrice(a.purchasePriceUSD, currentCurrency)} ({valDelta >= 0 ? '+' : ''}
                          {formatPrice(valDelta, currentCurrency)})
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-bold">{formatPrice(a.actualRentMonthlyUSD, currentCurrency)}/mo</div>
                        <div className="text-[10px] text-zinc-400">
                          Fcst: {formatPrice(a.forecastRentMonthlyUSD, currentCurrency)}/mo
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[#D4AF37] font-bold">{a.actualYieldPct}%</span>{' '}
                        <span className="text-zinc-500">/ {a.forecastYieldPct}%</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-zinc-200">
                          {formatPrice(a.loanBalanceUSD, currentCurrency)} ({a.interestRatePct}%)
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {formatPrice(a.monthlyDebtServiceUSD, currentCurrency)}/mo • Due {a.loanMaturityDate}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-zinc-300">
                        {a.demandScore}/{a.mobilityScore}/{a.climateScore}/{a.esgScore}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => postAction({ subAction: 'delete', id: a.id })}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
                          title="Remove holding"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
