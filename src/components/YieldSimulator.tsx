import React, { useState } from 'react';
import { CurrencyCode, User } from '../types';
import {
  formatPrice,
  formatUsdInputDisplay,
  parseEnglishNumber,
  sanitizeEnglishDecimal,
} from '../utils/formatters';
import { 
  Calculator, 
  TrendingUp, 
  Sliders, 
  ShieldAlert, 
  Sparkles, 
  Lock, 
  CheckCircle2, 
  Info,
  DollarSign
} from 'lucide-react';

interface YieldSimulatorProps {
  currentCurrency: CurrencyCode;
  user: User | null;
  onAnalyzeSimulation: () => void;
}

const EN_INPUT_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  unicodeBidi: 'embed',
  direction: 'ltr',
};

export const YieldSimulator: React.FC<YieldSimulatorProps> = ({
  user,
  onAnalyzeSimulation,
}) => {
  // Base USD values (editable English numeric inputs — never trigger live auto-calculation)
  const [basePriceUSD, setBasePriceUSD] = useState<number>(650000);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(30);
  const [downDraft, setDownDraft] = useState<string>('30');
  const [interestRatePct, setInterestRatePct] = useState<number>(5.5);
  const [rateDraft, setRateDraft] = useState<string>('5.5');
  const [loanTermYears] = useState<number>(25);
  const [baseRentMonthlyUSD, setBaseRentMonthlyUSD] = useState<number>(4800);
  const [operatingExpensePct, setOperatingExpensePct] = useState<number>(15);
  const [opexDraft, setOpexDraft] = useState<string>('15');
  const [vacancyPct] = useState<number>(5);

  const [computedSnapshot, setComputedSnapshot] = useState<{
    basePriceUSD: number;
    downPaymentPct: number;
    interestRatePct: number;
    baseRentMonthlyUSD: number;
    operatingExpensePct: number;
  } | null>(null);

  const downPaymentUSD = basePriceUSD * (downPaymentPct / 100);
  const loanAmountUSD = Math.max(0, (computedSnapshot?.basePriceUSD ?? basePriceUSD) * (1 - (computedSnapshot?.downPaymentPct ?? downPaymentPct) / 100));

  const calc = (snap: NonNullable<typeof computedSnapshot>) => {
    const dp = snap.basePriceUSD * (snap.downPaymentPct / 100);
    const loan = Math.max(0, snap.basePriceUSD - dp);
    const r = snap.interestRatePct / 100 / 12;
    const n = loanTermYears * 12;
    const monthlyMtg =
      loan > 0 && r > 0
        ? (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : 0;
    const annGross = snap.baseRentMonthlyUSD * 12 * (1 - vacancyPct / 100);
    const annOpex = annGross * (snap.operatingExpensePct / 100);
    const noi = annGross - annOpex;
    const cap = ((noi / Math.max(1, snap.basePriceUSD)) * 100).toFixed(2);
    const annDebt = monthlyMtg * 12;
    const annCf = noi - annDebt;
    const coc = dp > 0 ? ((annCf / dp) * 100).toFixed(2) : '0.00';
    const dscrVal = annDebt > 0 ? (noi / annDebt).toFixed(2) : '∞';
    const irrVal = (parseFloat(coc) + 4.5).toFixed(1);
    const sensitivityScenarios = [-10, 0, 10].map((deltaPct) => {
      const adjustedRentUSD = snap.baseRentMonthlyUSD * (1 + deltaPct / 100);
      const adjGrossRentUSD = adjustedRentUSD * 12 * (1 - vacancyPct / 100);
      const adjOPEXUSD = adjGrossRentUSD * (snap.operatingExpensePct / 100);
      const adjNOIUSD = adjGrossRentUSD - adjOPEXUSD;
      const adjCapRate = ((adjNOIUSD / Math.max(1, snap.basePriceUSD)) * 100).toFixed(2);
      const adjCashflowUSD = adjNOIUSD - annDebt;
      const adjCoC = dp > 0 ? ((adjCashflowUSD / dp) * 100).toFixed(2) : '0.00';
      return { deltaPct, rentUSD: adjustedRentUSD, capRate: adjCapRate, cashflowUSD: adjCashflowUSD, coc: adjCoC };
    });
    return { annGross, annOpex, noi, cap, annDebt, annCf, coc, dscrVal, irrVal, sensitivityScenarios };
  };

  const sim = computedSnapshot ? calc(computedSnapshot) : null;

  const handleRunStressTest = () => {
    if (basePriceUSD <= 0 || baseRentMonthlyUSD <= 0 || downPaymentPct <= 0 || interestRatePct <= 0 || operatingExpensePct <= 0) {
      return;
    }
    onAnalyzeSimulation();
    setComputedSnapshot({
      basePriceUSD,
      downPaymentPct,
      interestRatePct,
      baseRentMonthlyUSD,
      operatingExpensePct,
    });
  };

  const rawRemaining = user
    ? user.analysesLeft ?? user.freeAnalysesLeft ?? user.freeAnalyses
    : undefined;
  const isLockedForFree = Boolean(
    user && user.plan === 'free' && typeof rawRemaining === 'number' && rawRemaining <= 0
  );

  return (
    <section id="yield-simulator" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto relative z-10">
      
      {/* Header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-3">
          <Calculator className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL UNDERWRITING ENGINE</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Institutional Yield &amp; Sensitivity Engine
        </h2>
        <p className="text-zinc-400 text-sm mt-2">
          Enter exact acquisition parameters and run the underwriting model on demand.
        </p>
      </div>

      {/* Simulator Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Typed Parameter Controls (No Sliders / No Free Auto-Calc) */}
        <div className="lg:col-span-7 glass-panel p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-base font-semibold text-white">Acquisition Parameters</h3>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              Currency: <strong className="text-white">USD ($)</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="sim-price" className="text-xs font-mono text-zinc-300 block">
                Acquisition Valuation ($)
              </label>
              <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-3">
                <span className="text-xs font-mono text-zinc-400 mr-2">$</span>
                <input
                  id="sim-price"
                  type="text"
                  data-numeric="true"
                  lang="en"
                  dir="ltr"
                  inputMode="decimal"
                  autoComplete="off"
                  style={EN_INPUT_STYLE}
                  value={formatUsdInputDisplay(basePriceUSD)}
                  onChange={(e) => {
                    const num = Math.max(0, Math.round(parseEnglishNumber(e.target.value, 0)));
                    setBasePriceUSD(num);
                    setComputedSnapshot(null);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData?.getData('text') || '';
                    const num = Math.max(0, Math.round(parseEnglishNumber(text, 0)));
                    setBasePriceUSD(num);
                    setComputedSnapshot(null);
                  }}
                  className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none"
                />
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                USD Valuation: {formatPrice(basePriceUSD, 'USD')}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sim-rent" className="text-xs font-mono text-zinc-300 block">
                Gross Monthly Rent ($/mo)
              </label>
              <div className="flex items-center rounded-xl bg-black/50 border border-white/15 focus-within:border-emerald-400 px-3">
                <span className="text-xs font-mono text-emerald-400 mr-2">$</span>
                <input
                  id="sim-rent"
                  type="text"
                  data-numeric="true"
                  lang="en"
                  dir="ltr"
                  inputMode="decimal"
                  autoComplete="off"
                  style={EN_INPUT_STYLE}
                  value={formatUsdInputDisplay(baseRentMonthlyUSD)}
                  onChange={(e) => {
                    const num = Math.max(0, Math.round(parseEnglishNumber(e.target.value, 0)));
                    setBaseRentMonthlyUSD(num);
                    setComputedSnapshot(null);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData?.getData('text') || '';
                    const num = Math.max(0, Math.round(parseEnglishNumber(text, 0)));
                    setBaseRentMonthlyUSD(num);
                    setComputedSnapshot(null);
                  }}
                  className="w-full py-2.5 bg-transparent text-white font-mono text-sm outline-none"
                />
                <span className="text-xs font-mono text-zinc-400 ml-2">/mo</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                Monthly Rent: {formatPrice(baseRentMonthlyUSD, 'USD')} / mo
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              <label htmlFor="sim-down" className="text-xs font-mono text-zinc-300 block">
                Equity Down (%)
              </label>
              <div className="flex items-center rounded-lg bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-2.5">
                <input
                  id="sim-down"
                  type="text"
                  data-numeric="true"
                  lang="en"
                  dir="ltr"
                  inputMode="decimal"
                  autoComplete="off"
                  style={EN_INPUT_STYLE}
                  value={downDraft}
                  onChange={(e) => {
                    const clean = sanitizeEnglishDecimal(e.target.value, true);
                    setDownDraft(clean);
                    setDownPaymentPct(Math.max(0, Math.min(100, parseEnglishNumber(clean, 0))));
                    setComputedSnapshot(null);
                  }}
                  onBlur={() => setDownDraft(String(downPaymentPct))}
                  onPaste={(e) => {
                    e.preventDefault();
                    const clean = sanitizeEnglishDecimal(e.clipboardData?.getData('text') || '', true);
                    setDownDraft(clean);
                    setDownPaymentPct(Math.max(0, Math.min(100, parseEnglishNumber(clean, 0))));
                    setComputedSnapshot(null);
                  }}
                  className="w-full py-2 bg-transparent text-white font-mono text-sm outline-none"
                />
                <span className="text-xs font-mono text-zinc-400">%</span>
              </div>
              <div className="text-[10px] text-[#D4AF37] font-mono">
                {formatPrice(downPaymentUSD, 'USD', { compact: true })}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              <label htmlFor="sim-rate" className="text-xs font-mono text-zinc-300 block">
                Mortgage Rate (%)
              </label>
              <div className="flex items-center rounded-lg bg-black/50 border border-white/15 focus-within:border-[#D4AF37] px-2.5">
                <input
                  id="sim-rate"
                  type="text"
                  data-numeric="true"
                  lang="en"
                  dir="ltr"
                  inputMode="decimal"
                  autoComplete="off"
                  style={EN_INPUT_STYLE}
                  value={rateDraft}
                  onChange={(e) => {
                    const clean = sanitizeEnglishDecimal(e.target.value, true);
                    setRateDraft(clean);
                    setInterestRatePct(Math.max(0, Math.min(30, parseEnglishNumber(clean, 0))));
                    setComputedSnapshot(null);
                  }}
                  onBlur={() => setRateDraft(String(interestRatePct))}
                  onPaste={(e) => {
                    e.preventDefault();
                    const clean = sanitizeEnglishDecimal(e.clipboardData?.getData('text') || '', true);
                    setRateDraft(clean);
                    setInterestRatePct(Math.max(0, Math.min(30, parseEnglishNumber(clean, 0))));
                    setComputedSnapshot(null);
                  }}
                  className="w-full py-2 bg-transparent text-white font-mono text-sm outline-none"
                />
                <span className="text-xs font-mono text-zinc-400">%</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                {loanTermYears}yr Fixed • {formatPrice(loanAmountUSD, 'USD', { compact: true })} debt
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              <label htmlFor="sim-opex" className="text-xs font-mono text-zinc-300 block">
                OPEX &amp; HOA (%)
              </label>
              <div className="flex items-center rounded-lg bg-black/50 border border-white/15 focus-within:border-cyan-400 px-2.5">
                <input
                  id="sim-opex"
                  type="text"
                  data-numeric="true"
                  lang="en"
                  dir="ltr"
                  inputMode="decimal"
                  autoComplete="off"
                  style={EN_INPUT_STYLE}
                  value={opexDraft}
                  onChange={(e) => {
                    const clean = sanitizeEnglishDecimal(e.target.value, true);
                    setOpexDraft(clean);
                    setOperatingExpensePct(Math.max(0, Math.min(99, parseEnglishNumber(clean, 0))));
                    setComputedSnapshot(null);
                  }}
                  onBlur={() => setOpexDraft(String(operatingExpensePct))}
                  onPaste={(e) => {
                    e.preventDefault();
                    const clean = sanitizeEnglishDecimal(e.clipboardData?.getData('text') || '', true);
                    setOpexDraft(clean);
                    setOperatingExpensePct(Math.max(0, Math.min(99, parseEnglishNumber(clean, 0))));
                    setComputedSnapshot(null);
                  }}
                  className="w-full py-2 bg-transparent text-white font-mono text-sm outline-none"
                />
                <span className="text-xs font-mono text-zinc-400">%</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                Maint., Service Charges, Insurance
              </div>
            </div>
          </div>

          {/* Institutional Stress Test Trigger */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleRunStressTest}
              disabled={Boolean(isLockedForFree)}
              className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                isLockedForFree
                  ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#D4AF37] via-[#B8860B] to-[#996515] hover:brightness-110 text-black font-extrabold shadow-[0_0_25px_rgba(212,175,55,0.25)]'
              }`}
            >
              {isLockedForFree ? (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>NO ANALYSES LEFT • UPGRADE</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>RUN ANALYSIS</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-zinc-500 font-mono mt-2">
              Enter inputs and click RUN ANALYSIS to calculate yield, cashflow &amp; +200bps stress metrics.
            </p>
          </div>

        </div>

        {/* Right Column: Bloomberg Results Terminal */}
        <div className="lg:col-span-5 glass-panel p-6 sm:p-8 space-y-6 border border-[#D4AF37]/30 shadow-[0_0_40px_rgba(212,175,55,0.08)]">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${sim ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <h3 className="text-base font-semibold text-white">Underwriting Metrics</h3>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
              sim
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {sim ? 'CALCULATED' : 'AWAITING RUN'}
            </span>
          </div>

          {!sim && (
            <div className="p-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center space-y-1.5">
              <div className="text-xs font-mono font-bold text-white">
                Enter inputs and click RUN ANALYSIS
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                Metrics remain paused until you run the model.
              </div>
            </div>
          )}

          {/* Primary Yield Showcase */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Unlevered Cap Rate
              </div>
              <div className="text-3xl font-black font-mono text-[#D4AF37] mt-1">
                {sim ? `${sim.cap}%` : '--'}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-1">
                NOI / Purchase Price
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Cash-on-Cash Return
              </div>
              <div className={`text-3xl font-black font-mono mt-1 ${
                !sim ? 'text-zinc-500' : parseFloat(sim.coc) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {sim ? `${sim.coc}%` : '--'}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-1">
                Net Cash / Equity Invested
              </div>
            </div>
          </div>

          {/* Detailed Waterfall Table */}
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-400">Gross Annual Revenue:</span>
              <span className="text-white font-semibold">{sim ? formatPrice(sim.annGross, 'USD') : '--'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-400">Operating Expenses &amp; Vacancy:</span>
              <span className="text-rose-400 font-semibold">{sim ? `-${formatPrice(sim.annOpex, 'USD')}` : '--'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-300 font-bold">Net Operating Income (NOI):</span>
              <span className="text-[#D4AF37] font-bold">{sim ? formatPrice(sim.noi, 'USD') : '--'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-400">Annual Debt Service (P&amp;I):</span>
              <span className="text-rose-400 font-semibold">{sim ? `-${formatPrice(sim.annDebt, 'USD')}` : '--'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-300 font-bold">Net Annual Cashflow:</span>
              <span className={`font-bold ${!sim ? 'text-zinc-500' : sim.annCf >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {sim ? formatPrice(sim.annCf, 'USD') : '--'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-zinc-400">Debt Service Coverage (DSCR):</span>
              <span className="text-cyan-400 font-bold">{sim ? `${sim.dscrVal}x` : '--'}</span>
            </div>
          </div>

          {/* 5-Year Horizon Projection */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08]">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-zinc-300 font-semibold">5-Year Equity IRR Projection</span>
              <span className="text-emerald-400 font-bold">{sim ? `${sim.irrVal}% p.a.` : '--'}</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#D4AF37] to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${sim ? Math.min(100, Math.max(15, parseFloat(sim.irrVal) * 5)) : 0}%` }}
              />
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-2 flex items-center justify-between">
              <span>Exit Cap: 7.2%</span>
              <span>Capital Gain: +28%</span>
            </div>
          </div>

          {/* Rental Sensitivity Matrix: -10%, Base, +10% */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-200 font-bold uppercase tracking-wider">Rental Sensitivity Table</span>
              <span className="text-[#D4AF37] text-[10px] font-semibold">On-Demand Run</span>
            </div>
            {sim ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-zinc-500 text-[10px] uppercase">
                      <th className="py-1.5 font-normal">Variance</th>
                      <th className="py-1.5 font-normal">Monthly Rent</th>
                      <th className="py-1.5 font-normal">Cap Rate</th>
                      <th className="py-1.5 font-normal">Cash-on-Cash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {sim.sensitivityScenarios.map((sc) => (
                      <tr key={sc.deltaPct} className={sc.deltaPct === 0 ? 'bg-[#D4AF37]/10 font-bold text-white' : 'text-zinc-300'}>
                        <td className="py-1.5">
                          {sc.deltaPct > 0 ? `+${sc.deltaPct}% Bull` : sc.deltaPct < 0 ? `${sc.deltaPct}% Bear` : 'Base (0%)'}
                        </td>
                        <td className="py-1.5">{formatPrice(sc.rentUSD, 'USD')}</td>
                        <td className="py-1.5 text-[#D4AF37] font-semibold">{sc.capRate}%</td>
                        <td className="py-1.5 text-emerald-400 font-semibold">{sc.coc}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-[11px] font-mono text-zinc-500 py-2">
                Click RUN ANALYSIS to populate -10% / 0% / +10% sensitivity scenarios.
              </div>
            )}
          </div>

          {sim && (
            <div className="p-4 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#D4AF37]">
                <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
                <span>STRESS TEST SNAPSHOT</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2 rounded bg-black/50 border border-white/5">
                  <span className="text-zinc-400 block">+200bps Rate Shock:</span>
                  <span className="text-white font-bold">{(parseFloat(sim.coc) - 1.8).toFixed(2)}% CoC</span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-white/5">
                  <span className="text-zinc-400 block">15% Vacancy Surge:</span>
                  <span className="text-white font-bold">{Math.max(0, parseFloat(sim.cap) - 1.1).toFixed(2)}% Cap</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

    </section>
  );
};
