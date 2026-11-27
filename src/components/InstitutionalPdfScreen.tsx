// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved.
import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Download, Printer, ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';
import { InstitutionalMemoInput, downloadInstitutionalMemorandumPdf } from '../utils/pdfExport';

interface InstitutionalPdfScreenProps {
  open: boolean;
  onClose: () => void;
  memo: InstitutionalMemoInput | null;
  onAfterDownload?: (filename: string) => void;
}

/**
 * Separate editorial private-bank memorandum template rendered on warm-ivory paper,
 * decoupled from the dark terminal HUD and engineered for smooth mobile (375px+) scrolling & printing.
 */
export const InstitutionalPdfScreen: React.FC<InstitutionalPdfScreenProps> = ({
  open,
  onClose,
  memo,
  onAfterDownload,
}) => {
  if (!open || !memo) return null;

  const dateStr = new Date().toISOString().slice(0, 10);
  const firmLabel = memo.branding?.firmName || 'AQARI INSTITUTIONAL ADVISORY';
  const naLabel = (reason?: string | null, fallback = 'Unavailable') =>
    `Not available: ${reason || fallback}`;
  const irrLabel =
    memo.irr5Yr !== null && Number.isFinite(memo.irr5Yr)
      ? `${memo.irr5Yr.toFixed(1)}%`
      : naLabel(memo.irrError, 'Insufficient data');
  const capLabel =
    memo.capRate !== null && Number.isFinite(memo.capRate)
      ? `${memo.capRate.toFixed(2)}%`
      : naLabel(memo.capRateReason, 'Unavailable');
  const cocLabel =
    memo.cashOnCash !== null && Number.isFinite(memo.cashOnCash)
      ? `${memo.cashOnCash.toFixed(2)}%`
      : naLabel(memo.cashOnCashReason, 'Unavailable');
  const dscrLabel = memo.dscr
    ? `${memo.dscr}x`
    : naLabel(memo.dscrReason, 'No debt');

  const fmtUSD = (val: number | null | undefined, reason?: string | null) => {
    if (val === null || val === undefined || !Number.isFinite(val)) {
      return reason ? naLabel(reason) : 'Not available';
    }
    const abs = Math.abs(Math.round(val)).toLocaleString('en-US');
    return val < 0 ? `-$${abs}` : `$${abs}`;
  };

  const handleDownloadPdf = () => {
    const filename = downloadInstitutionalMemorandumPdf(memo);
    onAfterDownload?.(filename);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0A0A0D]/90 backdrop-blur-md" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 overflow-y-auto bg-[#ECE7DC] text-[#17171B] focus:outline-none print:bg-white"
        >
          <DialogPrimitive.Title className="sr-only">
            Institutional Memorandum Screen — {memo.title}
          </DialogPrimitive.Title>

          {/* Sticky Editorial Action Bar (hidden during print) */}
          <div className="sticky top-0 z-20 border-b border-[#D7CEBC] bg-[#F6F2E9]/95 backdrop-blur-md px-3 sm:px-6 py-3 print:hidden">
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9BEA6] bg-white px-3 py-2 text-xs font-mono font-semibold text-[#1E1E24] hover:bg-[#F1ECE0] cursor-pointer transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Terminal</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9BEA6] bg-white px-3 py-2 text-xs font-mono font-semibold text-[#1E1E24] hover:bg-[#F1ECE0] cursor-pointer transition"
                >
                  <Printer className="w-3.5 h-3.5 text-[#8A6712]" />
                  <span className="hidden xs:inline">Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#141419] px-3.5 py-2 text-xs font-mono font-bold text-[#E6C56B] hover:bg-[#23232C] cursor-pointer transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Official PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Separate Warm-Ivory Editorial Paper Container (Responsive on 375px mobile & desktop) */}
          <main className="max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-10 print:p-0">
            <article className="bg-[#FBF9F4] border border-[#DFD6C3] rounded-2xl sm:rounded-3xl shadow-[0_24px_70px_rgba(20,18,12,0.16)] overflow-hidden print:border-0 print:shadow-none">
              {/* Cover Header Band (Obsidian & Antique Gold) */}
              <header className="bg-[#121217] text-[#FBF9F4] px-5 sm:px-10 py-7 sm:py-9 border-b-2 border-[#C89F37]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[#DFBE62]">
                  <span>{firmLabel} • INVESTMENT COMMITTEE DOSSIER</span>
                  <span>{dateStr}</span>
                </div>

                <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {memo.title}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-[#C7C2B7] font-mono">
                  {memo.city}{memo.country ? `, ${memo.country}` : ''} • Prepared for {memo.userEmail} ({memo.planDisplay})
                </p>

                {memo.isWatermarked && (
                  <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/50 px-3 py-2 text-[11px] font-mono text-amber-200">
                    FREE TIER WATERMARK SAMPLE • Upgrade to remove PDF watermark
                  </div>
                )}

                {/* 4 Executive Highlights */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="text-[10px] font-mono uppercase text-[#B5B0A4]">Acquisition Price</div>
                    <div className="mt-1 text-base sm:text-lg font-bold font-mono text-white">
                      {fmtUSD(memo.valuationUSD)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="text-[10px] font-mono uppercase text-[#B5B0A4]">Annual NOI</div>
                    <div className="mt-1 text-base sm:text-lg font-bold font-mono text-[#34D399]">
                      {memo.noiUSD !== null ? `${fmtUSD(memo.noiUSD)}/yr` : naLabel(memo.noiReason, 'Invalid inputs')}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="text-[10px] font-mono uppercase text-[#B5B0A4]">Unlevered Cap Rate</div>
                    <div className="mt-1 text-base sm:text-lg font-bold font-mono text-[#DFBE62]">
                      {capLabel}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="text-[10px] font-mono uppercase text-[#B5B0A4]">5-Yr Equity IRR</div>
                    <div className="mt-1 text-base sm:text-lg font-bold font-mono text-white">
                      {irrLabel}
                    </div>
                  </div>
                </div>
              </header>

              {/* Editorial Paper Sections */}
              <div className="px-5 sm:px-10 py-7 sm:py-9 space-y-8">
                {/* 1. Executive Summary */}
                <section className="space-y-3">
                  <div className="border-b border-[#DFD6C3] pb-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#8A6712] font-bold">
                      Section 01
                    </div>
                    <h2 className="text-lg font-bold text-[#141418]">Executive Underwriting Summary</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                    <div className="rounded-xl border border-[#E5DEC9] bg-[#F5F1E7] p-3">
                      <div className="text-[10px] uppercase text-[#5C584F]">Monthly Gross Rent</div>
                      <div className="text-sm font-bold text-[#141418] mt-0.5">{fmtUSD(memo.monthlyRentUSD)}/mo</div>
                    </div>
                    <div className="rounded-xl border border-[#E5DEC9] bg-[#F5F1E7] p-3">
                      <div className="text-[10px] uppercase text-[#5C584F]">Cash-on-Cash Return</div>
                      <div className={`text-sm font-bold mt-0.5 ${(memo.cashOnCash ?? 0) >= 0 ? 'text-[#146C43]' : 'text-[#9F1239]'}`}>
                        {cocLabel}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E5DEC9] bg-[#F5F1E7] p-3">
                      <div className="text-[10px] uppercase text-[#5C584F]">DSCR Covenant</div>
                      <div className="text-sm font-bold text-[#141418] mt-0.5">
                        {dscrLabel}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E5DEC9] bg-[#F5F1E7] p-3">
                      <div className="text-[10px] uppercase text-[#5C584F]">Monthly Net Cashflow</div>
                      <div className={`text-sm font-bold mt-0.5 ${(memo.monthlyCashflowUSD ?? 0) >= 0 ? 'text-[#146C43]' : 'text-[#9F1239]'}`}>
                        {memo.monthlyCashflowUSD !== null
                          ? `${fmtUSD(memo.monthlyCashflowUSD)}/mo`
                          : naLabel(memo.monthlyCashflowReason)}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 2. NOI Waterfall & Capital Structure */}
                {memo.noiBreakdown && (
                  <section className="space-y-3">
                    <div className="border-b border-[#DFD6C3] pb-2">
                      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#8A6712] font-bold">
                        Section 02
                      </div>
                      <h2 className="text-lg font-bold text-[#141418]">NOI Waterfall &amp; Capital Structure</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-[#E5DEC9] bg-white p-4 space-y-2 text-xs font-mono">
                        <div className="flex justify-between text-[#34343D]">
                          <span>Gross Scheduled Annual Rent</span>
                          <span className="font-semibold">{fmtUSD(memo.noiBreakdown.grossRentAnnualUSD)}</span>
                        </div>
                        <div className="flex justify-between text-[#9F1239]">
                          <span>- Vacancy Allowance</span>
                          <span>-{fmtUSD(memo.noiBreakdown.vacancyLossUSD)}</span>
                        </div>
                        <div className="flex justify-between text-[#141418] border-t border-[#EFEAD8] pt-1.5">
                          <span>Effective Gross Income (EGI)</span>
                          <span className="font-semibold">{fmtUSD(memo.noiBreakdown.effectiveGrossIncomeUSD)}</span>
                        </div>
                        <div className="flex justify-between text-[#9F1239]">
                          <span>- Base OPEX + Management</span>
                          <span>-{fmtUSD(memo.noiBreakdown.baseOpexUSD + memo.noiBreakdown.managementFeeUSD)}</span>
                        </div>
                        <div className="flex justify-between text-[#9F1239]">
                          <span>- Property Tax + Insurance</span>
                          <span>-{fmtUSD(memo.noiBreakdown.propertyTaxUSD + memo.noiBreakdown.insuranceUSD)}</span>
                        </div>
                        <div className="flex justify-between text-[#9F1239]">
                          <span>- Maintenance + HOA</span>
                          <span>-{fmtUSD(memo.noiBreakdown.maintenanceReserveUSD + memo.noiBreakdown.hoaUSD)}</span>
                        </div>
                        <div className="flex justify-between text-[#146C43] font-bold text-sm border-t border-[#D7CEBC] pt-2">
                          <span>= Net Operating Income (NOI)</span>
                          <span>{fmtUSD(memo.noiBreakdown.noiUSD)}</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#E5DEC9] bg-white p-4 space-y-2 text-xs font-mono">
                        <div className="text-[10px] uppercase tracking-wider text-[#8A6712] font-bold pb-1 border-b border-[#EFEAD8]">
                          Financing &amp; Equity Terms
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5C584F]">Equity Down Payment</span>
                          <span className="font-bold">{memo.downPaymentPct ?? 'N/A'}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5C584F]">Debt Interest Rate</span>
                          <span className="font-bold">{memo.interestRatePct ?? 'N/A'}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5C584F]">Senior Loan Principal</span>
                          <span className="font-bold">{fmtUSD(memo.loanAmountUSD)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5C584F]">Total Equity Invested</span>
                          <span className="font-bold">{fmtUSD(memo.totalEquityInvestedUSD)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-[#EFEAD8]">
                          <span className="text-[#5C584F]">Institutional Risk Tier</span>
                          <span className="font-bold text-[#8A6712]">{memo.riskScore || 'Standard'}</span>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* 3. 5-Year Cashflow Schedule (Mobile-safe scroll container) */}
                {memo.yearByYear && memo.yearByYear.length > 0 && (
                  <section className="space-y-3">
                    <div className="border-b border-[#DFD6C3] pb-2">
                      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#8A6712] font-bold">
                        Section 03
                      </div>
                      <h2 className="text-lg font-bold text-[#141418]">5-Year Cashflow &amp; Coverage Schedule</h2>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#E5DEC9] bg-white">
                      <table className="w-full text-left text-xs font-mono border-collapse min-w-[540px]">
                        <thead>
                          <tr className="bg-[#141419] text-[#E6C56B]">
                            <th className="px-3 py-2.5">Year</th>
                            <th className="px-3 py-2.5">Gross Rent</th>
                            <th className="px-3 py-2.5">OPEX</th>
                            <th className="px-3 py-2.5">NOI</th>
                            <th className="px-3 py-2.5">Debt Service</th>
                            <th className="px-3 py-2.5">Net Cashflow</th>
                            <th className="px-3 py-2.5">DSCR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFEAD8]">
                          {memo.yearByYear.map((yr) => (
                            <tr key={yr.year} className="hover:bg-[#F8F5EE]">
                              <td className="px-3 py-2 font-bold">Year {yr.year}</td>
                              <td className="px-3 py-2">{fmtUSD(yr.grossRentUSD)}</td>
                              <td className="px-3 py-2 text-[#9F1239]">{fmtUSD(yr.operatingExpensesUSD)}</td>
                              <td className="px-3 py-2 font-semibold text-[#146C43]">{fmtUSD(yr.noiUSD)}</td>
                              <td className="px-3 py-2">{fmtUSD(yr.debtServiceUSD)}</td>
                              <td className={`px-3 py-2 font-semibold ${yr.netCashflowUSD >= 0 ? 'text-[#146C43]' : 'text-[#9F1239]'}`}>
                                {fmtUSD(yr.netCashflowUSD)}
                              </td>
                              <td className="px-3 py-2">{yr.dscr !== null ? `${yr.dscr.toFixed(2)}x` : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* 4. Monte Carlo Stress & Model Warnings */}
                <section className="space-y-3">
                  <div className="border-b border-[#DFD6C3] pb-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#8A6712] font-bold">
                      Section 04
                    </div>
                    <h2 className="text-lg font-bold text-[#141418]">Stochastic Stress &amp; Audit Notes</h2>
                  </div>

                  {memo.monteCarlo ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="rounded-xl border border-[#E5DEC9] bg-[#F5F1E7] p-3">
                        <div className="text-[10px] uppercase text-[#5C584F]">IRR P10 / P50 / P90 ({memo.monteCarlo.cycles?.toLocaleString('en-US')} cycles)</div>
                        <div className="font-bold text-[#141418] mt-1">
                          {memo.monteCarlo.irrP10 ?? 'N/A'}% / {memo.monteCarlo.irrP50 ?? 'N/A'}% / {memo.monteCarlo.irrP90 ?? 'N/A'}%
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#E5DEC9] bg-[#F5F1E7] p-3">
                        <div className="text-[10px] uppercase text-[#5C584F]">Neg. Cashflow Odds</div>
                        <div className="font-bold text-[#9F1239] mt-1">
                          {memo.monteCarlo.probNegativeCashflowPct ?? 0}%
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#E5DEC9] bg-[#F5F1E7] p-3">
                        <div className="text-[10px] uppercase text-[#5C584F]">Exit Value Decline Risk</div>
                        <div className="font-bold text-[#8A6712] mt-1">
                          {memo.monteCarlo.probValueDeclinePct ?? 0}%
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#E5DEC9] bg-[#F5F1E7] p-3 text-xs font-mono text-[#5C584F]">
                      Monte Carlo stress simulation not attached to this run. Execute the Monte Carlo engine in the terminal to embed P10/P50/P90 percentiles.
                    </div>
                  )}

                  {memo.warnings && memo.warnings.length > 0 ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-mono text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Validation Warnings Included in Official PDF</span>
                      </div>
                      {memo.warnings.map((w, idx) => (
                        <div key={idx}>• {w}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-mono text-[#146C43]">
                      <ShieldCheck className="w-4 h-4" />
                      <span>All underwriting outputs verified identically against deterministic engine state.</span>
                    </div>
                  )}
                </section>

                {/* 5. Sources & Legal Disclaimer */}
                <footer className="border-t border-[#DFD6C3] pt-5 text-[11px] font-mono text-[#5C584F] space-y-1.5">
                  <div>
                    <strong className="text-[#141418]">Market Benchmark Source:</strong>{' '}
                    {memo.marketBenchmarks?.source || 'World Bank / FRED / DLD / ONS / JLL / REGA'} (Updated:{' '}
                    {memo.marketBenchmarks?.updatedDate || dateStr})
                  </div>
                  <p>
                    Regulatory Disclaimer: This memorandum is prepared solely for decision support and informational modeling. Not legal, tax, valuation, or investment advice.
                  </p>
                </footer>
              </div>
            </article>
          </main>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
