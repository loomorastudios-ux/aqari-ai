import React, { useState } from 'react';
import { CurrencyCode } from '../types';
import { formatPrice } from '../utils/formatters';
import { DEMO_ANALYSES, DemoAnalysisItem } from '../constants/demoAnalyses';
import { 
  Building2, 
  Sparkles, 
  ArrowLeft, 
  Lock, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Shield, 
  Calculator, 
  DollarSign, 
  BarChart3, 
  Layers, 
  LogIn, 
  FileText,
  PieChart,
  Activity,
  Globe2
} from 'lucide-react';

interface DemoAnalysisViewProps {
  slug: string;
  currentCurrency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
  onOpenAuth: () => void;
  onGoHome: () => void;
  onSelectOtherDemo: (slug: string) => void;
}

export const DemoAnalysisView: React.FC<DemoAnalysisViewProps> = ({
  slug,
  currentCurrency,
  onCurrencyChange,
  onOpenAuth,
  onGoHome,
  onSelectOtherDemo,
}) => {
  const demo: DemoAnalysisItem = DEMO_ANALYSES[slug] || DEMO_ANALYSES['tribeca'];
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'stress' | 'tax'>('overview');

  const availableDemos = [
    { slug: 'tribeca', label: 'Tribeca Loft', tier: 'Free', flag: '🇺🇸' },
    { slug: 'dubai-marina', label: 'Dubai Marina', tier: 'Standard', flag: '🇦🇪' },
    { slug: 'muscat-wave', label: 'Muscat The Wave', tier: 'Pro', flag: '🇴🇲' },
    { slug: 'london-mayfair', label: 'London Mayfair', tier: 'Pro', flag: '🇬🇧' },
    { slug: 'cross-border-portfolio', label: 'GCC & UK Portfolio', tier: 'Agency', flag: '🌐' },
    { slug: 'riyadh-singapore-portfolio', label: 'Riyadh & SGP Pair', tier: 'Agency', flag: '🇸🇦 🇸🇬' },
  ];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Free': return 'border-zinc-500 text-zinc-300 bg-zinc-800/60';
      case 'Standard': return 'border-blue-500 text-blue-300 bg-blue-900/40';
      case 'Pro': return 'border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/15';
      case 'Agency': return 'border-purple-500 text-purple-300 bg-purple-900/40';
      default: return 'border-zinc-500 text-zinc-300 bg-zinc-800/60';
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white font-sans selection:bg-[#D4AF37] selection:text-black pb-20 relative">
      
      {/* 1. TOP WATERMARK BANNER (Fixed / Sticky) */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-600 via-[#D4AF37] to-amber-600 text-black py-2.5 px-4 shadow-[0_4px_20px_rgba(212,175,55,0.4)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wide">
            <span className="px-2 py-0.5 rounded bg-black text-[#D4AF37] text-[10px] font-black uppercase tracking-wider">
              PUBLIC DEMO • 0 CREDITS
            </span>
            <span>{demo.watermarkNote}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1 rounded-lg bg-black text-[#D4AF37] hover:bg-zinc-900 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02]"
            >
              <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Sign in to run your own</span>
            </button>
            <button
              onClick={onGoHome}
              className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-black text-xs font-mono font-bold transition cursor-pointer"
            >
              Exit Demo
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 space-y-6">
        
        {/* Navigation & Demo Switcher Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <button
              onClick={onGoHome}
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 hover:text-white transition flex items-center gap-2 text-xs font-mono cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Homepage</span>
            </button>

            <div className="h-6 w-px bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500">Tier:</span>
              <span className={`text-[11px] font-mono uppercase font-bold px-2.5 py-0.5 rounded-full border ${getTierColor(demo.tier)}`}>
                {demo.tier} Plan Sample
              </span>
            </div>
          </div>

          {/* Quick Switcher across all 6 Demos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-[11px] font-mono text-zinc-500 shrink-0 hidden lg:inline mr-1">Other Demos:</span>
            {availableDemos.map((d) => (
              <button
                key={d.slug}
                onClick={() => onSelectOtherDemo(d.slug)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  d.slug === slug
                    ? 'bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
                }`}
              >
                <span>{d.flag}</span>
                <span>{d.label}</span>
                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                  d.slug === slug ? 'bg-black text-[#D4AF37]' : 'bg-white/10 text-zinc-400'
                }`}>
                  {d.tier}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Hero Section of this Demo Property */}
        <div className="glass-panel p-6 sm:p-8 rounded-[28px] relative overflow-hidden border border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.08)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Image & Quick Badges */}
            <div className="lg:col-span-5 relative rounded-2xl overflow-hidden aspect-[4/3] border border-white/10 shadow-2xl">
              <img
                src={demo.imageUrl}
                alt={demo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-white/20 text-white font-mono text-xs font-bold flex items-center gap-1.5">
                  <span>{demo.flag}</span>
                  <span>{demo.city}</span>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#D4AF37] text-black font-mono text-xs font-black uppercase">
                  {demo.grossYield}% Gross Yield
                </span>
              </div>

              <div className="absolute bottom-3 left-3 right-3 text-xs font-mono text-zinc-300">
                <div className="flex items-center justify-between">
                  <span>{demo.propertyType}</span>
                  <span>{demo.areaSqM} m²</span>
                </div>
              </div>
            </div>

            {/* Info & Metrics */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] uppercase tracking-wider mb-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Institutional Underwriting Audit Dossier</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {demo.title}
                </h1>
                <p className="text-zinc-400 text-xs sm:text-sm mt-1">
                  {demo.subtitle}
                </p>
              </div>

              {/* Price & Monthly Rent Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">Valuation (USD)</div>
                  <div className="text-base sm:text-lg font-mono font-bold text-white mt-0.5">
                    {formatPrice(demo.priceUSD, currentCurrency)}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    ${Math.round(demo.priceUSD / demo.areaSqM).toLocaleString()}/m²
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">Monthly Rent</div>
                  <div className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-0.5">
                    {formatPrice(demo.rentMonthlyUSD, currentCurrency)}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    {demo.occupancyRate}% Occupancy
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">Cap Rate</div>
                  <div className="text-base sm:text-lg font-mono font-bold text-[#D4AF37] mt-0.5">
                    {demo.capRate}%
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    Net: {demo.netYield}%
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">5-Yr Leveraged IRR</div>
                  <div className="text-base sm:text-lg font-mono font-bold text-cyan-400 mt-0.5">
                    {demo.irr5Yr}%
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    CoC: {demo.cashOnCash}%
                  </div>
                </div>
              </div>

              {/* Tax & Visa Highlights */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div>
                  <span className="text-zinc-500">Tax Optimization: </span>
                  <span className="text-white font-semibold">{demo.taxStructure}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Residency: </span>
                  <span className="text-[#D4AF37] font-semibold">{demo.goldenVisa}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] text-black font-black text-xs font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-black" />
                  <span>Run Custom Analysis on Your Properties</span>
                </button>
                <div className="text-[11px] font-mono text-zinc-500 text-center sm:text-left">
                  Sign in with Google • 3 Free Credits on Free Tier
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Detailed Breakdown Tabs */}
        <div className="glass-panel rounded-[24px] p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-xs font-mono overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'overview' ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Underwriting Metrics</span>
            </button>
            <button
              onClick={() => setActiveTab('financials')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'financials' ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Cash Flow Waterfall</span>
            </button>
            <button
              onClick={() => setActiveTab('stress')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'stress' ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Monte Carlo & Stress Test</span>
            </button>
            <button
              onClick={() => setActiveTab('tax')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'tax' ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Tax & Jurisdiction Audit</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="text-xs font-mono text-zinc-500 uppercase">Annual NOI (Net Operating Income)</div>
                  <div className="text-2xl font-mono font-bold text-white">
                    {formatPrice(demo.noiAnnualUSD, currentCurrency)}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    After 5% vacancy allowance and institutional OPEX reserve
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="text-xs font-mono text-zinc-500 uppercase">Debt Service Coverage (DSCR)</div>
                  <div className="text-2xl font-mono font-bold text-emerald-400">
                    {demo.dscr}x
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    Required institutional benchmark: &gt; 1.25x
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="text-xs font-mono text-zinc-500 uppercase">Tenant Risk Score</div>
                  <div className="text-2xl font-mono font-bold text-[#D4AF37] flex items-center gap-2">
                    <span>{demo.tenantRisk}</span>
                    <span className="text-xs font-mono text-zinc-400 font-normal">({demo.liquidityScore}/100 Liquidity)</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    Cross-border institutional counterparty stability rating
                  </div>
                </div>
              </div>

              {/* Portfolio Breakdown if Agency tier */}
              {demo.portfolioBreakdown && (
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-purple-300 font-bold uppercase flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-purple-400" />
                      Multi-Asset Portfolio Allocation Breakdown
                    </span>
                    <span className="text-zinc-400">Agency Tier Feature</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {demo.portfolioBreakdown.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 text-xs font-mono">
                        <div className="text-white font-bold">{item.asset}</div>
                        <div className="text-zinc-400 flex justify-between">
                          <span>City: {item.city}</span>
                          <span className="text-purple-300 font-semibold">{item.allocationPct}% Weight</span>
                        </div>
                        <div className="text-zinc-400 flex justify-between">
                          <span>Value: {formatPrice(item.valueUSD, currentCurrency)}</span>
                          <span className="text-emerald-400 font-semibold">{item.yieldPct}% Yield</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unlocked vs Locked Features in this Tier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                  <div className="text-xs font-mono text-emerald-400 font-bold uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Unlocked in {demo.tier} Plan</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-zinc-300 font-mono">
                    {demo.featuresUnlocked.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-emerald-400">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                  <div className="text-xs font-mono text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#D4AF37]" />
                    <span>Higher Tier Capabilities</span>
                  </div>
                  {demo.featuresLocked.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-zinc-400 font-mono">
                      {demo.featuresLocked.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-[#D4AF37]">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs font-mono text-purple-300">
                      All institutional capabilities fully unlocked in this Tier!
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: FINANCIALS WATERFALL */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3 font-mono text-xs">
                <div className="text-xs font-mono text-[#D4AF37] uppercase font-bold">Annual Cash Flow Waterfall</div>
                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                  <div className="flex justify-between text-zinc-300">
                    <span>Gross Scheduled Rent</span>
                    <span className="font-bold text-white">{formatPrice(demo.rentMonthlyUSD * 12, currentCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>Vacancy Allowance (5%)</span>
                    <span>-{formatPrice(demo.rentMonthlyUSD * 12 * 0.05, currentCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>Effective Gross Income (EGI)</span>
                    <span className="font-bold text-white">{formatPrice(demo.rentMonthlyUSD * 12 * 0.95, currentCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>Operating Expenses (OPEX ~15%)</span>
                    <span>-{formatPrice(demo.rentMonthlyUSD * 12 * 0.95 * 0.15, currentCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold border-t border-white/10 pt-2 text-sm">
                    <span>Net Operating Income (NOI)</span>
                    <span>{formatPrice(demo.noiAnnualUSD, currentCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>Annual Debt Service (Mortgage)</span>
                    <span>-{formatPrice(demo.noiAnnualUSD - (demo.monthlyCashflowUSD * 12), currentCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-[#D4AF37] font-bold border-t border-[#D4AF37]/30 pt-2 text-sm">
                    <span>Net Cash Flow (Pre-Tax)</span>
                    <span>{formatPrice(demo.monthlyCashflowUSD * 12, currentCurrency)} / yr ({formatPrice(demo.monthlyCashflowUSD, currentCurrency)} / mo)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRESS TEST & MONTE CARLO */}
          {activeTab === 'stress' && (
            <div className="space-y-4 font-mono text-xs">
              {demo.monteCarlo ? (
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-[#D4AF37]/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#D4AF37] font-bold uppercase text-sm">Monte Carlo Stochastic Analysis</span>
                    <span className="text-emerald-400 font-bold">{demo.monteCarlo.simulationsCount} Iterations</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-zinc-500 text-[10px] uppercase">Positive Yield Probability</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">{demo.monteCarlo.positiveYieldProbabilityPct}%</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-zinc-500 text-[10px] uppercase">Interest Rate Shock</div>
                      <div className="text-xl font-bold text-amber-400 mt-1">+{demo.monteCarlo.rateShockStressBps} bps</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-zinc-500 text-[10px] uppercase">Median Simulated IRR</div>
                      <div className="text-xl font-bold text-white mt-1">{demo.monteCarlo.medianIRR}%</div>
                    </div>
                  </div>
                  <div className="text-zinc-400 text-[11px] leading-relaxed">
                    Stochastic simulation accounts for 10-year historical interest rate shocks, vacancy spikes up to 15%, and sovereign tax regime shifts.
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-3">
                  <Lock className="w-6 h-6 text-[#D4AF37] mx-auto" />
                  <div className="text-sm font-bold text-white">Monte Carlo Stress Testing is a Pro / Agency Feature</div>
                  <p className="text-zinc-400 max-w-md mx-auto text-xs">
                    This {demo.tier} tier sample demonstrates basic yield analysis. Upgrade to Pro or Agency to run full 200-iteration stochastic simulations.
                  </p>
                  <button
                    onClick={onOpenAuth}
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold hover:brightness-110 transition cursor-pointer"
                  >
                    Unlock Pro Capabilities
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TAX & JURISDICTION */}
          {activeTab === 'tax' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Sovereign Tax Classification: {demo.country}</span>
                </div>
                <div className="text-zinc-300 leading-relaxed text-xs">
                  {demo.taxStructure}
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <span className="text-zinc-400">Residency & Investor Visa Pathway:</span>
                  <span className="text-[#D4AF37] font-bold">{demo.goldenVisa}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Bottom CTA Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-[28px] border border-[#D4AF37]/40 text-center space-y-4 bg-gradient-to-b from-black via-black to-[#D4AF37]/10">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Ready to Underwrite Your Own Real Estate Assets?
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed font-mono">
            Sign in to access the full Aqari AI Terminal. Save portfolios, model cross-border tax shields, and export institutional PDF memoranda.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenAuth}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] text-black font-black text-xs font-mono uppercase tracking-wider shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:scale-[1.02] transition cursor-pointer"
            >
              Sign In to Aqari Terminal &rarr;
            </button>
            <button
              onClick={onGoHome}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white border border-white/10 text-xs font-mono font-semibold transition cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
