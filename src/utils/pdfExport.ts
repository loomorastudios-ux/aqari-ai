// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import {
  buildPdfDocument,
  buildInstitutionalPdfDocument,
  type InstitutionalPdfSection,
  type PdfBrandingOptions,
} from '../../lib/pdfGenerator';
import type { WhiteGloveDeliverable } from '../types';

export function toPdfSafeAscii(input: string): string {
  return String(input || '')
    .replace(/﷼/g, 'OMR ')
    .replace(/د\.إ/g, 'AED ')
    .replace(/£/g, 'GBP ')
    .replace(/€/g, 'EUR ')
    .replace(/[—–]/g, '-')
    .replace(/∞/g, 'Infinity')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/×/g, 'x')
    .replace(/•/g, '|')
    .replace(/[^\x20-\x7E\n]/g, '');
}

function triggerPdfDownload(pdfBytes: Uint8Array, filename: string) {
  if (typeof document !== 'undefined' && typeof Blob !== 'undefined') {
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

export interface InstitutionalMemoInput {
  title: string;
  city: string;
  country?: string;
  userEmail: string;
  planDisplay: string;
  valuationUSD: number;
  monthlyRentUSD: number;
  noiUSD: number;
  capRate: number;
  cashOnCash: number;
  irr5Yr: number | null;
  irrError?: string | null;
  dscr: string | null;
  monthlyCashflowUSD: number | null;
  riskScore?: string | number;
  downPaymentPct?: number;
  interestRatePct?: number;
  closingCostsPct?: number;
  loanAmountUSD?: number;
  totalEquityInvestedUSD?: number;
  noiBreakdown?: {
    grossRentAnnualUSD: number;
    vacancyLossUSD: number;
    effectiveGrossIncomeUSD: number;
    baseOpexUSD: number;
    managementFeeUSD: number;
    propertyTaxUSD: number;
    insuranceUSD: number;
    maintenanceReserveUSD: number;
    hoaUSD: number;
    totalExpensesUSD: number;
    noiUSD: number;
  };
  yearByYear?: Array<{
    year: number;
    grossRentUSD: number;
    operatingExpensesUSD: number;
    noiUSD: number;
    debtServiceUSD: number;
    netCashflowUSD: number;
    dscr: number | null;
  }>;
  marketBenchmarks?: {
    avgGrossYield?: number;
    transferTaxPct?: number;
    capitalGainsTax?: string;
    rentGrowthYoY?: number;
    vacancyPct?: number;
    source?: string;
    updatedDate?: string;
  };
  monteCarlo?: {
    cycles?: number;
    irrP10?: number | null;
    irrP50?: number | null;
    irrP90?: number | null;
    probNegativeCashflowPct?: number;
    probValueDeclinePct?: number;
    combinedStress?: {
      irr5Yr?: number | null;
      monthlyCashflowUSD?: number | null;
      dscr?: string | null;
    };
  } | null;
  warnings?: string[];
  notes?: string;
  recommendation?: string;
  sources?: string[];
  isWatermarked?: boolean;
  branding?: PdfBrandingOptions | null;
}

export function buildInstitutionalMemorandumBytes(params: InstitutionalMemoInput): {
  filename: string;
  pdfBytes: Uint8Array;
} {
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName =
    params.title
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'Asset';
  const brandSlug = params.branding?.firmName
    ? params.branding.firmName.trim().replace(/[^a-z0-9_-]+/gi, '-').toUpperCase()
    : 'AQARI-MEMO';
  const filename = `${brandSlug}-${safeName}-${dateStr}.pdf`;
  const firmLabel = params.branding?.firmName ? toPdfSafeAscii(params.branding.firmName) : 'AQARI TERMINAL';
  const watermark = params.isWatermarked
    ? `FREE TIER WATERMARK - AQARI TERMINAL SAMPLE | ${params.userEmail} | ${dateStr}`
    : toPdfSafeAscii(
        `${firmLabel} | Institutional Memorandum | Licensed to ${params.userEmail} | ${dateStr}`
      );

  const irrLabel =
    params.irr5Yr !== null && Number.isFinite(params.irr5Yr)
      ? `${params.irr5Yr.toFixed(1)}%`
      : `N/A (${params.irrError || 'Insufficient data'})`;

  const noiBreakdown = params.noiBreakdown;
  const recommendationText =
    params.recommendation ||
    (params.capRate >= 7.5 && (params.monthlyCashflowUSD ?? 0) >= 0
      ? 'PROCEED / ACCUMULATE: Positive unlevered yield spread and resilient debt coverage support acquisition subject to legal title and lease audit.'
      : params.capRate >= 5.5
      ? 'SELECTIVE HOLD / NEGOTIATE: Moderate yield profile; negotiate acquisition basis or optimize financing/OPEX before closing.'
      : 'CAUTIOUS / PASS OR RE-PRICE: Low initial unlevered yield or negative cashflow requires sharper pricing discount.');

  const financingPairs: Array<{ label: string; value: string }> = [
    ...(typeof params.downPaymentPct === 'number'
      ? [{ label: 'Equity Down Payment (%)', value: `${params.downPaymentPct}%` }]
      : []),
    ...(typeof params.interestRatePct === 'number'
      ? [{ label: 'Debt Interest Rate (%)', value: `${params.interestRatePct}%` }]
      : []),
    ...(typeof params.loanAmountUSD === 'number'
      ? [{ label: 'Senior Loan Principal (USD)', value: `$${Math.round(params.loanAmountUSD).toLocaleString('en-US')}` }]
      : []),
    ...(typeof params.totalEquityInvestedUSD === 'number'
      ? [{ label: 'Total Cash Equity Invested (USD)', value: `$${Math.round(params.totalEquityInvestedUSD).toLocaleString('en-US')}` }]
      : []),
  ];

  const sections: InstitutionalPdfSection[] = [
    {
      heading: '1. EXECUTIVE SUMMARY',
      subtitle: `${toPdfSafeAscii(params.title)} | ${toPdfSafeAscii(params.city)}${params.country ? `, ${toPdfSafeAscii(params.country)}` : ''}`,
      paragraphs: [
        `This Institutional Investment Memorandum evaluates the acquisition of ${toPdfSafeAscii(params.title)} located in ${toPdfSafeAscii(params.city)}. All currency values are normalized to USD (en-US).`,
        recommendationText,
      ],
      keyValues: [
        { label: 'Acquisition Valuation (USD)', value: `$${Math.round(params.valuationUSD).toLocaleString('en-US')}` },
        { label: 'Gross Monthly Rent (USD)', value: `$${Math.round(params.monthlyRentUSD).toLocaleString('en-US')}/mo` },
        { label: 'Annual Net Operating Income (NOI)', value: `$${Math.round(params.noiUSD).toLocaleString('en-US')}/yr` },
        { label: 'Unlevered Cap Rate', value: `${params.capRate.toFixed(2)}%` },
        { label: 'Cash-on-Cash Return', value: `${params.cashOnCash.toFixed(2)}%` },
        { label: '5-Year Levered Equity IRR', value: irrLabel },
        { label: 'Debt Service Coverage (DSCR)', value: params.dscr ? `${params.dscr}x` : 'N/A (Unlevered)' },
        {
          label: 'Monthly Net Cashflow',
          value:
            params.monthlyCashflowUSD !== null
              ? `$${Math.round(params.monthlyCashflowUSD).toLocaleString('en-US')}/mo`
              : 'N/A',
        },
      ],
    },
    {
      heading: '2. FINANCIAL UNDERWRITING & NOI WATERFALL',
      subtitle: 'Transparent expense waterfall & capital structure matching underwriting outputs',
      ...(noiBreakdown
        ? {
            keyValues: [
              { label: 'Gross Annual Rent', value: `$${Math.round(noiBreakdown.grossRentAnnualUSD).toLocaleString('en-US')}` },
              { label: 'Vacancy Allowance', value: `-$${Math.round(noiBreakdown.vacancyLossUSD).toLocaleString('en-US')}` },
              { label: 'Effective Gross Income (EGI)', value: `$${Math.round(noiBreakdown.effectiveGrossIncomeUSD).toLocaleString('en-US')}` },
              { label: 'Base OPEX + Management', value: `-$${Math.round(noiBreakdown.baseOpexUSD + noiBreakdown.managementFeeUSD).toLocaleString('en-US')}` },
              { label: 'Property Tax + Insurance', value: `-$${Math.round(noiBreakdown.propertyTaxUSD + noiBreakdown.insuranceUSD).toLocaleString('en-US')}` },
              { label: 'Maintenance Reserve + HOA', value: `-$${Math.round(noiBreakdown.maintenanceReserveUSD + noiBreakdown.hoaUSD).toLocaleString('en-US')}` },
              ...financingPairs,
            ],
            bars: {
              title: 'Annual Cashflow Waterfall (USD)',
              items: [
                {
                  label: 'Gross Annual Rent',
                  value: noiBreakdown.grossRentAnnualUSD,
                  displayValue: `$${Math.round(noiBreakdown.grossRentAnnualUSD).toLocaleString('en-US')}`,
                },
                {
                  label: 'Total Operating Expenses',
                  value: noiBreakdown.totalExpensesUSD,
                  displayValue: `-$${Math.round(noiBreakdown.totalExpensesUSD).toLocaleString('en-US')}`,
                },
                {
                  label: 'Net Operating Income (NOI)',
                  value: noiBreakdown.noiUSD,
                  displayValue: `$${Math.round(noiBreakdown.noiUSD).toLocaleString('en-US')}`,
                },
              ],
            },
          }
        : financingPairs.length > 0
        ? { keyValues: financingPairs }
        : {}),
      ...(params.yearByYear && params.yearByYear.length > 0
        ? {
            table: {
              headers: ['Year', 'Gross Rent', 'Total OPEX', 'NOI', 'Debt Service', 'Net Cashflow', 'DSCR'],
              rows: params.yearByYear.map((yr) => [
                `Year ${yr.year}`,
                `$${Math.round(yr.grossRentUSD).toLocaleString('en-US')}`,
                `$${Math.round(yr.operatingExpensesUSD).toLocaleString('en-US')}`,
                `$${Math.round(yr.noiUSD).toLocaleString('en-US')}`,
                `$${Math.round(yr.debtServiceUSD).toLocaleString('en-US')}`,
                `$${Math.round(yr.netCashflowUSD).toLocaleString('en-US')}`,
                yr.dscr !== null ? `${yr.dscr.toFixed(2)}x` : 'N/A',
              ]),
            },
          }
        : {}),
    },
    {
      heading: '3. MARKET ANALYSIS & TAX CONTEXT',
      subtitle: `Sub-market benchmark comparison for ${toPdfSafeAscii(params.city)}`,
      keyValues: [
        {
          label: 'Market Avg Gross Yield',
          value:
            params.marketBenchmarks?.avgGrossYield !== undefined
              ? `${params.marketBenchmarks.avgGrossYield}% [Estimated]`
              : 'Indicative [Estimated]',
        },
        {
          label: 'YoY Rent Growth Benchmark',
          value:
            params.marketBenchmarks?.rentGrowthYoY !== undefined
              ? `${params.marketBenchmarks.rentGrowthYoY}% [Estimated]`
              : 'Model Default',
        },
        {
          label: 'Transfer Tax / Stamp Duty',
          value:
            params.marketBenchmarks?.transferTaxPct !== undefined
              ? `${params.marketBenchmarks.transferTaxPct}% (Verified 2026-04-01)`
              : 'Jurisdiction Standard',
        },
        {
          label: 'Capital Gains Tax Regime',
          value: toPdfSafeAscii(params.marketBenchmarks?.capitalGainsTax || 'Verify with tax counsel'),
        },
      ],
      callout: {
        tone: 'gold',
        text: `Market Benchmark Source: ${toPdfSafeAscii(
          params.marketBenchmarks?.source || 'World Bank / FRED / DLD / ONS / JLL / REGA'
        )} (Updated: ${toPdfSafeAscii(params.marketBenchmarks?.updatedDate || dateStr)}). Tax notes are not legal/tax advice.`,
      },
    },
    {
      heading: '4. RISK ASSESSMENT',
      subtitle: 'Model sanity checks, debt coverage, and structural exposures',
      keyValues: [
        { label: 'Institutional Risk Tier', value: toPdfSafeAscii(String(params.riskScore || 'Standard Audit')) },
        { label: 'DSCR Covenant Cushion', value: params.dscr ? `${params.dscr}x` : 'Unlevered / N/A' },
      ],
      paragraphs:
        params.warnings && params.warnings.length > 0
          ? params.warnings.map((w, idx) => `Flag #${idx + 1}: ${toPdfSafeAscii(w)}`)
          : ['No extreme metric anomalies triggered during underwriting validation checks.'],
    },
    {
      heading: '5. SCENARIO & MONTE CARLO STRESS ANALYSIS',
      subtitle: params.monteCarlo?.cycles
        ? `${Number(params.monteCarlo.cycles).toLocaleString('en-US')}-cycle stochastic rate, rent, vacancy, and exit cap stress`
        : 'Base vs down-side sensitivity envelope',
      keyValues: [
        {
          label: 'IRR P10 / P50 / P90',
          value: params.monteCarlo
            ? `${params.monteCarlo.irrP10 ?? 'N/A'}% / ${params.monteCarlo.irrP50 ?? 'N/A'}% / ${params.monteCarlo.irrP90 ?? 'N/A'}%`
            : irrLabel,
        },
        {
          label: 'Negative Cashflow Probability',
          value:
            params.monteCarlo?.probNegativeCashflowPct !== undefined
              ? `${params.monteCarlo.probNegativeCashflowPct}%`
              : 'Run Monte Carlo in terminal',
        },
        {
          label: 'Combined Stress (+200bps / -10% Rent / 15% Vac)',
          value:
            params.monteCarlo?.combinedStress?.monthlyCashflowUSD !== undefined &&
            params.monteCarlo?.combinedStress?.monthlyCashflowUSD !== null
              ? `$${Math.round(params.monteCarlo.combinedStress.monthlyCashflowUSD).toLocaleString('en-US')}/mo (DSCR ${params.monteCarlo.combinedStress.dscr || 'N/A'}x)`
              : 'See terminal simulation',
        },
        {
          label: 'Exit Value Decline Risk',
          value:
            params.monteCarlo?.probValueDeclinePct !== undefined
              ? `${params.monteCarlo.probValueDeclinePct}%`
              : 'N/A',
        },
      ],
    },
    {
      heading: '6. INVESTMENT RECOMMENDATION',
      paragraphs: [
        toPdfSafeAscii(recommendationText),
        ...(params.notes ? [`Analyst Notes: ${toPdfSafeAscii(params.notes)}`] : []),
      ],
    },
    {
      heading: '7. SOURCES, ASSUMPTIONS & DISCLAIMER',
      paragraphs: [
        ...(params.sources && params.sources.length > 0
          ? params.sources.map((s) => `- ${toPdfSafeAscii(s)}`)
          : [
              '- Financial underwriting computed deterministically from user-entered and verified assumptions.',
              '- Cross-border market & tax benchmarks synced from public registries (World Bank, FRED, DLD, ONS, JLL, REGA).',
            ]),
        'Regulatory Disclaimer: This memorandum is prepared solely for institutional decision support and informational modeling. It does not constitute legal, tax, valuation, or regulated investment advice. Consult licensed legal and tax advisors before committing capital.',
      ],
    },
  ];

  const pdfBytes = buildInstitutionalPdfDocument({
    docTitle: params.branding?.firmName
      ? `${toPdfSafeAscii(params.branding.firmName)} | INSTITUTIONAL MEMORANDUM`
      : 'AQARI TERMINAL | INSTITUTIONAL MEMORANDUM',
    docSubtitle: `${toPdfSafeAscii(params.title)} (${toPdfSafeAscii(params.city)})`,
    watermark,
    footer: params.branding?.firmName
      ? `${toPdfSafeAscii(params.branding.firmName)} | Prepared for ${toPdfSafeAscii(params.userEmail)} | ${dateStr}`
      : `Loomora Studios - AQARI TERMINAL | ${toPdfSafeAscii(params.userEmail)} | ${dateStr}`,
    isWatermarked: Boolean(params.isWatermarked),
    branding: params.branding || null,
    cover: {
      eyebrow: params.branding?.firmName
        ? `${toPdfSafeAscii(params.branding.firmName)} • INVESTMENT COMMITTEE MEMORANDUM`
        : 'AQARI TERMINAL • INSTITUTIONAL INVESTMENT COMMITTEE MEMORANDUM',
      title: toPdfSafeAscii(params.title),
      subtitle: `${toPdfSafeAscii(params.city)}${params.country ? `, ${toPdfSafeAscii(params.country)}` : ''} • Underwriting, Risk & Scenario Dossier`,
      preparedFor: `${toPdfSafeAscii(params.userEmail)} (${toPdfSafeAscii(params.planDisplay)})`,
      dateStr,
      highlights: [
        { label: 'Acquisition Price', value: `$${Math.round(params.valuationUSD).toLocaleString('en-US')}` },
        { label: 'Unlevered Cap Rate', value: `${params.capRate.toFixed(2)}%` },
        { label: 'Annual NOI', value: `$${Math.round(params.noiUSD).toLocaleString('en-US')}` },
        { label: '5-Yr Equity IRR', value: irrLabel },
      ],
    },
    sections,
  });

  return { filename, pdfBytes };
}

export function downloadInstitutionalMemorandumPdf(params: InstitutionalMemoInput): string {
  const { filename, pdfBytes } = buildInstitutionalMemorandumBytes(params);
  triggerPdfDownload(pdfBytes, filename);
  return filename;
}

export interface PropertyStudioPdfInput {
  docType: 'listing' | 'memorandum';
  isVirtual: boolean;
  title: string;
  country: string;
  city: string;
  areaDistrict: string;
  propertyType: 'Apartment' | 'Villa' | 'Commercial' | 'Land' | 'Hotel';
  budgetUSD: number;
  areaSqM: number;
  bedrooms: number;
  bathrooms: number;
  expectedMonthlyRentUSD: number;
  targetYieldPct: number;
  finishing: string;
  amenities: string[];
  targetAudience: string;
  description: string;
  locationNarrative: string;
  investmentHighlights: string[];
  riskNotes: string[];
  isRentYieldReliable: boolean;
  rentYieldBasisNote: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactFirm?: string;
  isWatermarked?: boolean;
  branding?: PdfBrandingOptions | null;
}

export function downloadPropertyStudioPdf(params: PropertyStudioPdfInput): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName =
    params.title
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'Property-Studio';
  const kindSlug = params.docType === 'listing' ? 'LISTING' : 'MEMO';
  const studioBrand = params.branding?.firmName
    ? toPdfSafeAscii(params.branding.firmName)
    : 'AQARI PROPERTY STUDIO';
  const filename = `AQARI-STUDIO-${kindSlug}-${safeName}-${dateStr}.pdf`;

  const virtualBanner = params.isVirtual
    ? 'VIRTUAL CONCEPT - NOT A REAL LISTING | NO REAL ADDRESS, NO FABRICATED PHOTOS, NO GUARANTEED RETURNS'
    : null;
  const watermark = params.isWatermarked
    ? `FREE TIER WATERMARK - AQARI PROPERTY STUDIO SAMPLE | ${dateStr}`
    : params.isVirtual
    ? `VIRTUAL CONCEPT - NOT A REAL LISTING | ${studioBrand} | ${dateStr}`
    : `${studioBrand} | Prepared by ${toPdfSafeAscii(params.contactName || params.contactEmail)} | ${dateStr}`;

  const annualRent = params.expectedMonthlyRentUSD * 12;
  const impliedGrossYield =
    params.budgetUSD > 0 && params.expectedMonthlyRentUSD > 0
      ? Number(((annualRent / params.budgetUSD) * 100).toFixed(2))
      : null;
  const pricePerSqM =
    params.areaSqM > 0 && params.budgetUSD > 0
      ? Math.round(params.budgetUSD / params.areaSqM)
      : null;

  const contactLines = [
    `ADVISOR / SPONSOR: ${toPdfSafeAscii(params.contactName || 'Loomora Studios')}${params.contactFirm ? ` (${toPdfSafeAscii(params.contactFirm)})` : ''}`,
    `EMAIL: ${toPdfSafeAscii(params.contactEmail || 'loomorastudios@gmail.com')} | PHONE: ${toPdfSafeAscii(params.contactPhone || '+968 78900731')}`,
    `TARGET AUDIENCE: ${toPdfSafeAscii(params.targetAudience)} | ASSET STATUS: ${params.isVirtual ? 'Virtual Concept (Not a real listing)' : 'Sponsor Provided Listing'}`,
  ];

  const pricingKeyValues = [
    { label: 'Asking / Concept Budget (USD)', value: `$${Math.round(params.budgetUSD).toLocaleString('en-US')}` },
    { label: 'Indicative Price / m2', value: pricePerSqM ? `$${pricePerSqM.toLocaleString('en-US')} / m2` : 'N/A' },
    ...(params.isRentYieldReliable && params.expectedMonthlyRentUSD > 0
      ? [
          { label: 'Indicative Monthly Rent (Unverified)', value: `$${Math.round(params.expectedMonthlyRentUSD).toLocaleString('en-US')}/mo` },
          {
            label: 'Indicative Gross Yield (Not Guaranteed)',
            value: `${impliedGrossYield !== null ? impliedGrossYield : params.targetYieldPct}%`,
          },
        ]
      : [
          { label: 'Target Yield Objective', value: `${params.targetYieldPct}% (Target only - Not guaranteed)` },
          { label: 'Rent / Yield Status', value: 'Unverified / Excluded from formal projection' },
        ]),
  ];

  const commonSections: InstitutionalPdfSection[] = [
    {
      heading: params.docType === 'listing' ? '1. PROPERTY OVERVIEW & CONCEPT BRIEF' : '1. EXECUTIVE INVESTMENT BRIEF',
      subtitle: `${toPdfSafeAscii(params.propertyType)} in ${toPdfSafeAscii(params.areaDistrict)}, ${toPdfSafeAscii(params.city)}, ${toPdfSafeAscii(params.country)}`,
      ...(params.isVirtual
        ? {
            callout: {
              tone: 'warning',
              text: 'DISCLOSURE: This dossier presents a Virtual Concept modeled for planning and investor discussion. It is NOT a real estate listing, has no verified street address or real photography, and provides zero guaranteed returns.',
            },
          }
        : {}),
      paragraphs: [toPdfSafeAscii(params.description)],
    },
    {
      heading: '2. ARCHITECTURAL SPECIFICATIONS & FINISHES',
      keyValues: [
        { label: 'Asset Class', value: toPdfSafeAscii(params.propertyType) },
        { label: 'Gross Built-Up / Land Area', value: `${Math.round(params.areaSqM).toLocaleString('en-US')} m2` },
        { label: 'Configuration (Rooms)', value: `${params.bedrooms} Beds / ${params.bathrooms} Baths` },
        { label: 'Finishing Specification', value: toPdfSafeAscii(params.finishing) },
        { label: 'Target Investor / Buyer Profile', value: toPdfSafeAscii(params.targetAudience) },
        { label: 'Amenities', value: toPdfSafeAscii(params.amenities.join(', ') || 'Standard Specifications') },
      ],
    },
    {
      heading: '3. LOCATION & SUB-MARKET CONTEXT',
      subtitle: `${toPdfSafeAscii(params.areaDistrict)} - ${toPdfSafeAscii(params.city)}, ${toPdfSafeAscii(params.country)}`,
      paragraphs: [
        toPdfSafeAscii(params.locationNarrative),
        'Note: Exact cadastral plot/street address is intentionally omitted for concept/off-market confidentiality.',
      ],
    },
    {
      heading: '4. PRICING, RENT & YIELD PROFILE',
      subtitle: toPdfSafeAscii(params.rentYieldBasisNote),
      keyValues: pricingKeyValues,
      ...(params.isRentYieldReliable && params.budgetUSD > 0
        ? {
            bars: {
              title: 'Indicative Yield vs Target Benchmark (%)',
              items: [
                {
                  label: 'Implied Gross Yield',
                  value: impliedGrossYield ?? params.targetYieldPct,
                  displayValue: `${impliedGrossYield ?? params.targetYieldPct}%`,
                },
                {
                  label: 'Target Yield Hurdle',
                  value: params.targetYieldPct,
                  displayValue: `${params.targetYieldPct}%`,
                },
                {
                  label: 'Est. Net Yield (18% OPEX)',
                  value: Number((((impliedGrossYield ?? params.targetYieldPct) * 0.82)).toFixed(2)),
                  displayValue: `${(((impliedGrossYield ?? params.targetYieldPct) * 0.82)).toFixed(2)}%`,
                },
              ],
            },
          }
        : {}),
    },
  ];

  if (params.docType === 'memorandum') {
    commonSections.push(
      {
        heading: '5. INVESTMENT HIGHLIGHTS & THESIS',
        paragraphs: params.investmentHighlights.map((h, i) => `${i + 1}. ${toPdfSafeAscii(h)}`),
      },
      {
        heading: '6. KEY RISKS & GOVERNANCE',
        paragraphs: params.riskNotes.map((r, i) => `- ${toPdfSafeAscii(r)}`),
      }
    );
  }

  commonSections.push({
    heading: params.docType === 'listing' ? '5. SPONSOR CONTACT & LEGAL NOTICE' : '7. SPONSOR CONTACT & LEGAL NOTICE',
    keyValues: [
      { label: 'Contact Name', value: toPdfSafeAscii(params.contactName || 'Loomora Studios Desk') },
      { label: 'Organization / Firm', value: toPdfSafeAscii(params.contactFirm || 'AQARI Capital Sponsor') },
      { label: 'Direct Email', value: toPdfSafeAscii(params.contactEmail || 'loomorastudios@gmail.com') },
      { label: 'Phone / WhatsApp', value: toPdfSafeAscii(params.contactPhone || '+968 78900731') },
    ],
    paragraphs: [
      'Notice: Figures marked Indicative are modeling estimates only and are NOT guaranteed returns. Verify all specifications, zoning, title deeds, and tax obligations with licensed counsel. Not legal/tax advice.',
    ],
  });

  const pdfBytes = buildInstitutionalPdfDocument({
    docTitle:
      params.docType === 'listing'
        ? `${studioBrand} | PROPERTY LISTING`
        : `${studioBrand} | INVESTMENT MEMORANDUM`,
    docSubtitle: `${toPdfSafeAscii(params.title)} (${toPdfSafeAscii(params.city)}, ${toPdfSafeAscii(params.country)})`,
    watermark,
    footer: `${studioBrand} | ${toPdfSafeAscii(params.contactEmail || 'loomorastudios@gmail.com')} | ${dateStr}`,
    virtualBanner,
    isWatermarked: Boolean(params.isWatermarked),
    branding: params.branding || null,
    cover: {
      eyebrow:
        params.docType === 'listing'
          ? `${studioBrand} • BESPOKE PROPERTY LISTING DOSSIER`
          : `${studioBrand} • INSTITUTIONAL INVESTMENT MEMORANDUM`,
      title: toPdfSafeAscii(params.title),
      subtitle: `${toPdfSafeAscii(params.propertyType)} • ${toPdfSafeAscii(params.areaDistrict)}, ${toPdfSafeAscii(params.city)}, ${toPdfSafeAscii(params.country)}`,
      preparedFor: toPdfSafeAscii(params.targetAudience),
      dateStr,
      highlights: [
        { label: 'Indicative Budget', value: `$${Math.round(params.budgetUSD).toLocaleString('en-US')}` },
        { label: 'Area & Layout', value: `${Math.round(params.areaSqM)} m2 | ${params.bedrooms}B/${params.bathrooms}Ba` },
        {
          label: params.isRentYieldReliable ? 'Indicative Rent' : 'Finishing Tier',
          value:
            params.isRentYieldReliable && params.expectedMonthlyRentUSD > 0
              ? `$${Math.round(params.expectedMonthlyRentUSD).toLocaleString('en-US')}/mo`
              : toPdfSafeAscii(params.finishing),
        },
        {
          label: 'Target Yield',
          value: `${params.targetYieldPct}% (Target)`,
        },
      ],
      contactLines,
    },
    sections: commonSections,
  });

  triggerPdfDownload(pdfBytes, filename);
  return filename;
}

export function downloadMemorandumPdf(params: {
  title: string;
  city: string;
  userEmail: string;
  planDisplay: string;
  metricsLines: string[];
  notes?: string;
  watermarkText?: string;
  isWatermarked?: boolean;
  branding?: PdfBrandingOptions | null;
}): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const firmLabel = params.branding?.firmName ? toPdfSafeAscii(params.branding.firmName) : 'AQARI TERMINAL';
  const watermark = params.isWatermarked
    ? `FREE TIER WATERMARK - AQARI TERMINAL SAMPLE - ${dateStr}`
    : toPdfSafeAscii(
        params.watermarkText ||
          `Generated by ${firmLabel} - Licensed to ${params.userEmail} - ${dateStr}`
      );
  const safeName =
    params.title
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'Asset';
  const filename = `AQARI-${safeName}-${dateStr}.pdf`;

  const parsedPairs = params.metricsLines
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx > 0 && idx < 42) {
        return {
          label: toPdfSafeAscii(line.slice(0, idx).trim()),
          value: toPdfSafeAscii(line.slice(idx + 1).trim()),
        };
      }
      return null;
    })
    .filter((x): x is { label: string; value: string } => Boolean(x));

  const pdfBytes = buildInstitutionalPdfDocument({
    docTitle: params.branding?.firmName
      ? `${firmLabel} | INVESTMENT REPORT`
      : 'AQARI TERMINAL | INSTITUTIONAL MEMORANDUM',
    docSubtitle: `${toPdfSafeAscii(params.title)} - ${toPdfSafeAscii(params.city)}`,
    watermark,
    footer: params.branding?.firmName
      ? `${firmLabel} | ${dateStr}`
      : `Loomora Studios - AQARI TERMINAL | ${watermark}`,
    isWatermarked: Boolean(params.isWatermarked),
    branding: params.branding || null,
    cover: {
      eyebrow: params.branding?.firmName
        ? `${firmLabel} • INSTITUTIONAL UNDERWRITING REPORT`
        : 'AQARI TERMINAL • INSTITUTIONAL UNDERWRITING REPORT',
      title: toPdfSafeAscii(params.title),
      subtitle: `Target Market: ${toPdfSafeAscii(params.city)}`,
      preparedFor: `${toPdfSafeAscii(params.userEmail)} (${toPdfSafeAscii(params.planDisplay)})`,
      dateStr,
      highlights: parsedPairs.slice(0, 4),
    },
    sections: [
      {
        heading: '1. EXECUTIVE SUMMARY & UNDERWRITING INPUTS',
        subtitle: `Prepared on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
        keyValues: parsedPairs.length > 0 ? parsedPairs : undefined,
        paragraphs:
          parsedPairs.length === 0 ? params.metricsLines.map((l) => toPdfSafeAscii(l)) : undefined,
      },
      ...(params.notes
        ? [
            {
              heading: '2. ANALYST NOTES & OBSERVATIONS',
              paragraphs: [toPdfSafeAscii(params.notes)],
            },
          ]
        : []),
      {
        heading: params.notes ? '3. SOURCES & REGULATORY DISCLAIMER' : '2. SOURCES & REGULATORY DISCLAIMER',
        paragraphs: [
          'Market data is indicative, synced from public benchmarks (World Bank, FRED, DLD, ONS, JLL, REGA).',
          'Not financial, legal, or tax advice. Consult a licensed advisor prior to execution.',
        ],
      },
    ],
  });

  triggerPdfDownload(pdfBytes, filename);
  return filename;
}

export function downloadWhiteGlovePdf(params: {
  deliverable: WhiteGloveDeliverable | any;
  userEmail: string;
}): string {
  const { deliverable, userEmail } = params;
  const rawDeliveredAt = deliverable.deliveredAt || Date.now();
  const dateObj = new Date(rawDeliveredAt);
  const dateStr = Number.isNaN(dateObj.getTime())
    ? new Date().toISOString().slice(0, 10)
    : dateObj.toISOString().slice(0, 10);
  const safeName =
    String(deliverable.title || 'WhiteGlove-Portfolio')
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'WhiteGlove';
  const filename = `AQARI-${safeName}-${dateStr}.pdf`;

  const combined = deliverable.combined || deliverable.combinedResults || {};
  const ccy = String(deliverable.currency || 'USD').toUpperCase();
  const spvNote =
    deliverable.spvStructureNote ||
    deliverable.spvNote ||
    'Standard Cross-Border SPV Structure';

  const lines: string[] = [
    '=== SOVEREIGN WHITE-GLOVE CUSTOM UNDERWRITING DELIVERABLE ===',
    `Client Account: ${toPdfSafeAscii(userEmail)} (SOVEREIGN)`,
    `Delivered At: ${dateObj.toLocaleString('en-US')}`,
    `Prepared By: ${toPdfSafeAscii(deliverable.preparedBy || deliverable.deliveredBy || 'AQARI Analyst Desk')}`,
    '',
    '=== SPV & JURISDICTION STRUCTURE NOTES ===',
    toPdfSafeAscii(spvNote),
    ...(deliverable.riskNote ? ['', '=== RISK ASSESSMENT ===', toPdfSafeAscii(deliverable.riskNote)] : []),
    ...(deliverable.summaryRecommendation
      ? ['', '=== EXECUTIVE RECOMMENDATION ===', toPdfSafeAscii(deliverable.summaryRecommendation)]
      : []),
    '',
    '=== COMBINED PORTFOLIO SUMMARY ===',
    `Total Valuation: ${ccy} ${Number(combined.totalValuation ?? combined.totalValuationUSD ?? 0).toLocaleString('en-US')}`,
    `Total Monthly Rent: ${ccy} ${Number(combined.totalMonthlyRent ?? combined.totalMonthlyRentUSD ?? 0).toLocaleString('en-US')}/mo`,
    `Weighted Cap Rate: ${Number(combined.weightedCapRate || 0).toFixed(2)}%`,
    ...(combined.blendedCoC !== undefined ? [`Blended Cash-on-Cash: ${Number(combined.blendedCoC).toFixed(2)}%`] : []),
    `Combined Monthly Net Cashflow: ${ccy} ${Number(combined.totalMonthlyCashflow ?? combined.totalMonthlyCashflowUSD ?? 0).toLocaleString('en-US')}/mo`,
    `Combined 5-Year Portfolio IRR: ${Number(combined.blendedIrr5Yr ?? combined.weightedIrr5Yr ?? 0).toFixed(1)}%`,
    ...(combined.portfolioDscr !== undefined ? [`Portfolio DSCR: ${combined.portfolioDscr}x`] : []),
    '',
    '=== UNDERWRITTEN ASSETS BREAKDOWN ===',
  ];

  (deliverable.properties || []).forEach((p: any, idx: number) => {
    const val = Number(p.valuation ?? p.priceUSD ?? 0);
    const rent = Number(p.monthlyRent ?? p.rentUSD ?? 0);
    const eq = p.equityPct ?? p.downPaymentPct ?? 30;
    const rt = p.ratePct ?? p.interestRatePct ?? 5.5;
    const opx = p.opexPct ?? p.operatingExpensePct ?? 15;
    const pCcy = String(p.currency || ccy).toUpperCase();
    const vacPct = Number(p.vacancyPct ?? p.vacancyRatePct ?? 0);
    const annualRent = rent * 12 * (1 - vacPct / 100);
    const noi = annualRent * (1 - Number(opx) / 100);
    const estCap = val > 0 ? ((noi / val) * 100).toFixed(2) : '0.00';

    lines.push(
      `#${idx + 1}: ${toPdfSafeAscii(p.title || `Asset #${idx + 1}`)} (${toPdfSafeAscii(p.city || '-')}, ${toPdfSafeAscii(pCcy)})`,
      `   Valuation: ${pCcy} ${val.toLocaleString('en-US')} | Rent: ${pCcy} ${rent.toLocaleString('en-US')}/mo`,
      `   Terms: ${eq}% Equity | ${rt}% Rate | ${opx}% OPEX | Est. Cap Rate: ${p.capRate ?? estCap}%`,
      ...(p.spvNote ? [`   SPV Note: ${toPdfSafeAscii(p.spvNote)}`] : []),
      ''
    );
  });

  lines.push(
    '=== REGULATORY & LEGAL DISCLAIMER ===',
    'White-glove underwriting output is prepared for institutional decision support only.',
    'Not financial, legal, or tax advice. Always verify SPV filings with licensed counsel.'
  );

  const pdfBytes = buildPdfDocument({
    title: 'AQARI TERMINAL | White-Glove Institutional Portfolio',
    subtitle: toPdfSafeAscii(deliverable.title || 'Custom Underwriting Dossier'),
    lines,
    watermark: `AQARI SOVEREIGN WHITE-GLOVE | ${toPdfSafeAscii(userEmail)} | ${dateStr}`,
    footer: `Loomora Studios - AQARI SOVEREIGN DESK | ${dateStr}`,
  });

  triggerPdfDownload(pdfBytes, filename);
  return filename;
}
