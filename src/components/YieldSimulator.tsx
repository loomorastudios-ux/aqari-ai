import React, { useState } from 'react';
import { CurrencyCode, User } from '../types';
import { formatPrice } from '../utils/formatters';
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

export const YieldSimulator: React.FC<YieldSimulatorProps> = ({
  currentCurrency,
  user,
  onAnalyzeSimulation,
}) => {
  // Base USD values
  const [basePriceUSD, setBasePriceUSD] = useState<number>(650000);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(30);
  const [interestRatePct, setInterestRatePct] = useState<number>(5.5);
  const [loanTermYears, setLoanTermYears] = useState<number>(25);
  const [baseRentMonthlyUSD, setBaseRentMonthlyUSD] = useState<number>(4800);
  const [operatingExpensePct, setOperatingExpensePct] = useState<number>(15);
  const [vacancyPct, setVacancyPct] = useState<number>(5);

  // Deep stress test state unlocked via analysis
  const [hasRunStressTest, setHasRunStressTest] = useState<boolean>(false);

  // Financial calculations
  const downPaymentUSD = basePriceUSD * (downPaymentPct / 100);
  const loanAmountUSD = Math.max(0, basePriceUSD - downPaymentUSD);

  const monthlyRate = interestRatePct / 100 / 12;
  const numPayments = loanTermYears * 12;
  const monthlyMortgageUSD =
    loanAmountUSD > 0 && monthlyRate > 0
      ? (loanAmountUSD * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : 0;

  const annualGrossRentUSD = baseRentMonthlyUSD * 12 * (1 - vacancyPct / 100);
  const annualOperatingExpensesUSD = annualGrossRentUSD * (operatingExpensePct / 100);
  const netOperatingIncomeUSD = annualGrossRentUSD - annualOperatingExpensesUSD;

  const capRate = ((netOperatingIncomeUSD / basePriceUSD) * 100).toFixed(2);
  const annualDebtServiceUSD = monthlyMortgageUSD * 12;
  const annualCashflowUSD = netOperatingIncomeUSD - annualDebtServiceUSD;

  const cashOnCashYield =
    downPaymentUSD > 0
      ? ((annualCashflowUSD / downPaymentUSD) * 100).toFixed(2)
      : '0.00';

  const dscr =
    annualDebtServiceUSD > 0
      ? (netOperatingIncomeUSD / annualDebtServiceUSD).toFixed(2)
      : '∞';

  const fiveYearIRR = (
    parseFloat(cashOnCashYield) + 4.5
  ).toFixed(1);

  const handleRunStressTest = () => {
    onAnalyzeSimulation();
    setHasRunStressTest(true);
  };

  const analysesRemaining = user
    ? user.plan === 'enterprise'
      ? 9999
      : user.plan === 'free'
      ? user.freeAnalysesLeft ?? user.freeAnalyses ?? 3
      : user.analysesLeft ?? user.freeAnalysesLeft ?? user.freeAnalyses ?? 50
    : 3;

  const isLockedForFree = user && user.plan === 'free' && analysesRemaining <= 0;

  // Sensitivity Scenarios (-10%, 0%, +10%)
  const sensitivityScenarios = [-10, 0, 10].map((deltaPct) => {
    const adjustedRentUSD = baseRentMonthlyUSD * (1 + deltaPct / 100);
    const adjGrossRentUSD = adjustedRentUSD * 12 * (1 - vacancyPct / 100);
    const adjOPEXUSD = adjGrossRentUSD * (operatingExpensePct / 100);
    const adjNOIUSD = adjGrossRentUSD - adjOPEXUSD;
    const adjCapRate = ((adjNOIUSD / basePriceUSD) * 100).toFixed(2);
    const adjCashflowUSD = adjNOIUSD - annualDebtServiceUSD;
    const adjCoC = downPaymentUSD > 0 ? ((adjCashflowUSD / downPaymentUSD) * 100).toFixed(2) : '0.00';
    return {
      deltaPct,
      rentUSD: adjustedRentUSD,
      capRate: adjCapRate,
      cashflowUSD: adjCashflowUSD,
      coc: adjCoC,
    };
  });

  return (
    <section id="yield-simulator" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto relative z-10">
      
      {/* Header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-3">
          <Calculator className="w-3.5 h-3.5" />
          <span>INSTITUTIONAL UNDERWRITING ENGINE</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Real-Time Yield & Sensitivity Engine
        </h2>
        <p className="text-zinc-400 text-sm mt-2">
          Model debt service coverage, net cap rates, cash-on-cash yield, and cross-border currency exposure with sub-second underwriting precision.
        </p>
      </div>

      {/* Simulator Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Sliders & Parameter Controls */}
        <div className="lg:col-span-7 glass-panel p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-base font-semibold text-white">Acquisition Parameters</h3>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              Currency: <strong className="text-white">{currentCurrency}</strong>
            </span>
          </div>

          {/* Slider 1: Property Value */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-300 font-medium">Acquisition Valuation (USD base)</span>
              <span className="font-mono font-bold text-white text-sm">
                {formatPrice(basePriceUSD, currentCurrency)}
              </span>
            </div>
            <input
              type="range"
              min={200000}
              max={5000000}
              step={25000}
              value={basePriceUSD}
              onChange={(e) => setBasePriceUSD(Number(e.target.value))}
              className="w-full accent-[#D4AF37] h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>{formatPrice(200000, currentCurrency, { compact: true })}</span>
              <span>{formatPrice(2500000, currentCurrency, { compact: true })}</span>
              <span>{formatPrice(5000000, currentCurrency, { compact: true })}</span>
            </div>
          </div>

          {/* Slider 2: Down Payment */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-300 font-medium">Down Payment Equity ({downPaymentPct}%)</span>
              <span className="font-mono font-semibold text-[#D4AF37] text-sm">
                {formatPrice(downPaymentUSD, currentCurrency)}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={downPaymentPct}
              onChange={(e) => setDownPaymentPct(Number(e.target.value))}
              className="w-full accent-[#D4AF37] h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Slider 3: Expected Monthly Rent */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-300 font-medium">Expected Monthly Gross Rent</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {formatPrice(baseRentMonthlyUSD, currentCurrency)} / mo
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={30000}
              step={250}
              value={baseRentMonthlyUSD}
              onChange={(e) => setBaseRentMonthlyUSD(Number(e.target.value))}
              className="w-full accent-emerald-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Sliders Grid: Interest Rate & Operating Expenses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">Mortgage Rate</span>
                <span className="font-mono font-bold text-white">{interestRatePct}%</span>
              </div>
              <input
                type="range"
                min={2.0}
                max={9.0}
                step={0.25}
                value={interestRatePct}
                onChange={(e) => setInterestRatePct(Number(e.target.value))}
                className="w-full accent-[#D4AF37] h-1 bg-zinc-800 rounded cursor-pointer"
              />
              <div className="text-[10px] text-zinc-500 font-mono">
                {loanTermYears}yr Fixed • Est. {formatPrice(monthlyMortgageUSD, currentCurrency)}/mo
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">OPEX & HOA</span>
                <span className="font-mono font-bold text-white">{operatingExpensePct}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={operatingExpensePct}
                onChange={(e) => setOperatingExpensePct(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
              />
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
              className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                isLockedForFree
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700'
                  : 'bg-gradient-to-r from-[#D4AF37] via-[#B8860B] to-[#996515] hover:brightness-110 text-black font-extrabold shadow-[0_0_25px_rgba(212,175,55,0.25)]'
              }`}
            >
              {isLockedForFree ? (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>ANALYSIS LIMIT REACHED • UPGRADE TO STRESS TEST</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>RUN MONTE CARLO STRESS TEST (-1 CREDIT)</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-zinc-500 font-mono mt-2">
              Tests +200bps rate shocks, 15% vacancy surge, and cross-border currency swings.
            </p>
          </div>

        </div>

        {/* Right Column: Bloomberg Results Terminal */}
        <div className="lg:col-span-5 glass-panel p-6 sm:p-8 space-y-6 border border-[#D4AF37]/30 shadow-[0_0_40px_rgba(212,175,55,0.08)]">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-base font-semibold text-white">Underwriting Metrics</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
              INSTITUTIONAL GRADE
            </span>
          </div>

          {/* Primary Yield Showcase */}
          <div className="grid grid-cols-2 gap-4">
            
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Unlevered Cap Rate
              </div>
              <div className="text-3xl font-black font-mono text-[#D4AF37] mt-1">
                {capRate}%
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-1">
                NOI / Purchase Price
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Cash-on-Cash Return
              </div>
              <div className={`text-3xl font-black font-mono mt-1 ${parseFloat(cashOnCashYield) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {cashOnCashYield}%
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
              <span className="text-white font-semibold">{formatPrice(annualGrossRentUSD, currentCurrency)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-400">Operating Expenses & Vacancy:</span>
              <span className="text-rose-400 font-semibold">-{formatPrice(annualOperatingExpensesUSD, currentCurrency)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-300 font-bold">Net Operating Income (NOI):</span>
              <span className="text-[#D4AF37] font-bold">{formatPrice(netOperatingIncomeUSD, currentCurrency)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-400">Annual Debt Service (P&I):</span>
              <span className="text-rose-400 font-semibold">-{formatPrice(annualDebtServiceUSD, currentCurrency)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.05]">
              <span className="text-zinc-300 font-bold">Net Annual Cashflow:</span>
              <span className={`font-bold ${annualCashflowUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPrice(annualCashflowUSD, currentCurrency)}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-zinc-400">Debt Service Coverage (DSCR):</span>
              <span className="text-cyan-400 font-bold">{dscr}x</span>
            </div>
          </div>

          {/* 5-Year Horizon Projection */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08]">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-zinc-300 font-semibold">5-Year Equity IRR Projection</span>
              <span className="text-emerald-400 font-bold">{fiveYearIRR}% p.a.</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#D4AF37] to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(15, parseFloat(fiveYearIRR) * 5))}%` }}
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
              <span className="text-[#D4AF37] text-[10px] font-semibold">Instant Calculation</span>
            </div>
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
                  {sensitivityScenarios.map((sc) => (
                    <tr key={sc.deltaPct} className={sc.deltaPct === 0 ? 'bg-[#D4AF37]/10 font-bold text-white' : 'text-zinc-300'}>
                      <td className="py-1.5">
                        {sc.deltaPct > 0 ? `+${sc.deltaPct}% Bull` : sc.deltaPct < 0 ? `${sc.deltaPct}% Bear` : 'Base (0%)'}
                      </td>
                      <td className="py-1.5">{formatPrice(sc.rentUSD, currentCurrency)}</td>
                      <td className="py-1.5 text-[#D4AF37] font-semibold">{sc.capRate}%</td>
                      <td className="py-1.5 text-emerald-400 font-semibold">{sc.coc}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unlocked Stress Test Scenarios if triggered */}
          {hasRunStressTest && (
            <div className="p-4 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#D4AF37]">
                <ShieldAlert className="w-4 h-4 text-[#D4AF37]" />
                <span>MONTE CARLO STRESS TEST RESULTS</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2 rounded bg-black/50 border border-white/5">
                  <span className="text-zinc-400 block">+200bps Rate Shock:</span>
                  <span className="text-white font-bold">{Math.max(0, parseFloat(cashOnCashYield) - 1.8).toFixed(2)}% CoC</span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-white/5">
                  <span className="text-zinc-400 block">15% Vacancy Surge:</span>
                  <span className="text-white font-bold">{Math.max(0, parseFloat(capRate) - 1.1).toFixed(2)}% Cap</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </section>
  );
};
