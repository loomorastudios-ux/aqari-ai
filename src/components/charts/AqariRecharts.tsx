import React, { useMemo } from 'react';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from 'recharts';
import { CurrencyCode, DealFinderDeal } from '../../types';
import { formatPrice } from '../../utils/formatters';
import { ChartReveal } from '../ui/motion-primitives';
import { SafeChartContainer } from './SafeChartContainer';

const GOLD = '#D4AF37';
const EMERALD = '#34d399';
const PURPLE = '#a855f7';
const ROSE = '#fb7185';
const CYAN = '#22d3ee';

const TooltipShell: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (name: string, val: any) => string;
}> = ({ active, payload, label, formatter }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      dir="ltr"
      className="rounded-xl border border-[#D4AF37]/40 bg-zinc-950/95 px-3 py-2 text-[11px] font-mono text-zinc-100 shadow-2xl backdrop-blur-xl"
    >
      {label && <div className="mb-1 font-bold text-[#D4AF37]">{label}</div>}
      <div className="space-y-0.5">
        {payload.map((entry, idx) => {
          const formattedVal = formatter
            ? formatter(String(entry.name || entry.dataKey), entry.value)
            : String(entry.value);
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color || GOLD }}
                />
                <span>{entry.name}</span>
              </span>
              <span className="font-bold text-white tabular-nums">{formattedVal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 1A & 1B. Split Recharts: NOI + Cashflow ($) AND IRR (%) + DSCR (x)         */
/* -------------------------------------------------------------------------- */
export interface YearProjectionChartRow {
  year: number;
  noiUSD: number;
  netCashflowUSD: number;
  dscr: number | null;
  cumulativeIrrPct: number | null;
}

interface SplitUnderwritingChartProps {
  capRate: number;
  cashOnCash: number;
  irr5Yr: number | null;
  irrError?: string | null;
  dscr: number | string | null;
  netOperatingIncomeUSD: number;
  monthlyCashflowUSD: number;
  annualDebtServiceUSD: number;
  yearByYear?: YearProjectionChartRow[];
  currency: CurrencyCode;
}

function buildChartRows(props: SplitUnderwritingChartProps) {
  if (Array.isArray(props.yearByYear) && props.yearByYear.length > 0) {
    return props.yearByYear.map((r) => ({
      year: `Year ${r.year}`,
      noi: Math.round(r.noiUSD),
      cashflow: Math.round(r.netCashflowUSD),
      irr: r.cumulativeIrrPct !== null && Number.isFinite(r.cumulativeIrrPct) ? Number(r.cumulativeIrrPct) : null,
      dscr: r.dscr !== null && Number.isFinite(r.dscr) ? Number(r.dscr) : null,
    }));
  }

  const baseNoi = Math.round(props.netOperatingIncomeUSD);
  const baseDebt = Math.max(0, Math.round(props.annualDebtServiceUSD));
  const numericDscr = props.dscr && props.dscr !== '∞' ? Number(props.dscr) : null;

  return [1, 2, 3, 4, 5].map((yr) => {
    const growthFactor = Math.pow(1.03, yr - 1);
    const yrNoi = Math.round(baseNoi * growthFactor);
    const yrCf = Math.round(yrNoi - baseDebt);
    const yrIrr =
      props.irr5Yr !== null && Number.isFinite(props.irr5Yr)
        ? Number((props.irr5Yr * (0.72 + yr * 0.056)).toFixed(1))
        : null;
    const yrDscr =
      numericDscr !== null && Number.isFinite(numericDscr)
        ? Number((numericDscr * Math.pow(1.03, yr - 1)).toFixed(2))
        : null;
    return {
      year: `Year ${yr}`,
      noi: yrNoi,
      cashflow: yrCf,
      irr: yrIrr,
      dscr: yrDscr,
    };
  });
}

export const NoiCashflowChart: React.FC<SplitUnderwritingChartProps> = (props) => {
  const data = useMemo(() => buildChartRows(props), [props]);

  return (
    <ChartReveal className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="font-bold uppercase text-white">
          Chart 1: 5-Year NOI &amp; Net Cashflow
        </span>
        <span className="text-[10px] text-[#D4AF37]">
          NOI ({props.currency}) • Net Cashflow ({props.currency})
        </span>
      </div>
      <div className="min-h-[240px] h-[240px] w-full" dir="ltr">
        <SafeChartContainer minWidth={280} minHeight={240}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
            />
            <YAxis
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) =>
                Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
              }
              width={52}
            />
            <RechartsTooltip
              content={
                <TooltipShell
                  formatter={(_, val) => formatPrice(Number(val) || 0, props.currency)}
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8' }}
            />
            <Bar
              dataKey="noi"
              name="Annual NOI ($)"
              fill={GOLD}
              radius={[6, 6, 0, 0]}
              animationDuration={550}
            />
            <Bar
              dataKey="cashflow"
              name="Net Cashflow ($)"
              fill={EMERALD}
              radius={[6, 6, 0, 0]}
              animationDuration={650}
            />
          </BarChart>
        </SafeChartContainer>
      </div>
    </ChartReveal>
  );
};

export const IrrDscrChart: React.FC<SplitUnderwritingChartProps> = (props) => {
  const data = useMemo(() => buildChartRows(props), [props]);
  const hasAnyIrr = data.some((d) => d.irr !== null && Number.isFinite(d.irr));
  const hasAnyDscr = data.some((d) => d.dscr !== null && Number.isFinite(d.dscr));

  return (
    <ChartReveal className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="font-bold uppercase text-white">
          Chart 2: Cumulative IRR (%) &amp; DSCR (x)
        </span>
        <span className="text-[10px] text-cyan-300">
          {hasAnyIrr ? 'Left Axis: IRR (%)' : 'IRR Unavailable'} • Right Axis: DSCR (x)
        </span>
      </div>
      {!hasAnyIrr && props.irrError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-mono text-amber-200">
          IRR Note: {props.irrError}
        </div>
      )}
      <div className="min-h-[240px] h-[240px] w-full" dir="ltr">
        <SafeChartContainer minWidth={280} minHeight={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
            />
            <YAxis
              yAxisId="irr"
              stroke={PURPLE}
              tick={{ fill: '#c084fc', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) => `${v}%`}
              width={46}
            />
            <YAxis
              yAxisId="dscr"
              orientation="right"
              stroke={CYAN}
              tick={{ fill: '#67e8f9', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) => `${Number(v).toFixed(2)}x`}
              width={48}
            />
            <RechartsTooltip
              content={
                <TooltipShell
                  formatter={(name, val) => {
                    if (val === null || val === undefined) return 'N/A';
                    if (name.includes('DSCR')) return `${Number(val).toFixed(2)}x`;
                    return `${Number(val).toFixed(1)}%`;
                  }}
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8' }}
            />
            {hasAnyIrr && (
              <Line
                yAxisId="irr"
                type="monotone"
                dataKey="irr"
                name="Equity IRR (%)"
                stroke={PURPLE}
                strokeWidth={2.5}
                connectNulls={false}
                dot={{ r: 3.5, fill: PURPLE, stroke: '#000', strokeWidth: 1.5 }}
                animationDuration={650}
              />
            )}
            {hasAnyDscr && (
              <Line
                yAxisId="dscr"
                type="monotone"
                dataKey="dscr"
                name="DSCR (x)"
                stroke={CYAN}
                strokeWidth={2.5}
                connectNulls={false}
                dot={{ r: 3.5, fill: CYAN, stroke: '#000', strokeWidth: 1.5 }}
                animationDuration={700}
              />
            )}
          </ComposedChart>
        </SafeChartContainer>
      </div>
    </ChartReveal>
  );
};

export const IrrNoiDscrChart: React.FC<SplitUnderwritingChartProps> = (props) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <NoiCashflowChart {...props} />
      <IrrDscrChart {...props} />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. Market Comparison Chart (Feature 1 Deal Finder & Feature 2 Markets)      */
/* -------------------------------------------------------------------------- */
export interface MarketCompareItem {
  name: string;
  capRate: number;
  cashOnCash?: number;
  secondaryMetric?: number;
  secondaryLabel?: string;
}

interface MarketComparisonChartProps {
  title: string;
  subtitle?: string;
  items: MarketCompareItem[];
  secondarySeriesName?: string;
  secondaryUnit?: string;
}

export const MarketComparisonChart: React.FC<MarketComparisonChartProps> = ({
  title,
  subtitle,
  items,
  secondarySeriesName = 'Cash-on-Cash (%)',
  secondaryUnit = '%',
}) => {
  const chartData = useMemo(
    () =>
      items.slice(0, 7).map((item) => ({
        name: item.name.length > 15 ? `${item.name.slice(0, 14)}…` : item.name,
        capRate: Number(item.capRate || 0),
        secondary:
          typeof item.cashOnCash === 'number'
            ? Number(item.cashOnCash)
            : Number(item.secondaryMetric || 0),
      })),
    [items]
  );

  if (chartData.length === 0) return null;

  return (
    <ChartReveal className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="font-bold uppercase text-white">{title}</span>
        {subtitle && <span className="text-[10px] text-[#D4AF37]">{subtitle}</span>}
      </div>
      <div className="min-h-[240px] h-[240px] w-full" dir="ltr">
        <SafeChartContainer minWidth={280} minHeight={240}>
          <BarChart data={chartData} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
            />
            <YAxis
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) => `${v}%`}
              width={40}
            />
            <RechartsTooltip
              content={
                <TooltipShell
                  formatter={(name, val) =>
                    name.includes('Cap') || name.includes('Yield')
                      ? `${val}%`
                      : `${val}${secondaryUnit}`
                  }
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8' }}
            />
            <Bar
              dataKey="capRate"
              name="Cap Rate / Yield (%)"
              fill={GOLD}
              radius={[6, 6, 0, 0]}
              animationDuration={550}
            />
            <Bar
              dataKey="secondary"
              name={secondarySeriesName}
              fill={EMERALD}
              radius={[6, 6, 0, 0]}
              animationDuration={650}
            />
          </BarChart>
        </SafeChartContainer>
      </div>
    </ChartReveal>
  );
};

export function mapDealsToCompareItems(deals: DealFinderDeal[]): MarketCompareItem[] {
  return deals.slice(0, 5).map((d, idx) => ({
    name: `#${idx + 1} ${d.name.split(' ').slice(0, 2).join(' ')}`,
    capRate: d.capRate,
    cashOnCash: d.cashOnCash,
  }));
}

/* -------------------------------------------------------------------------- */
/* 3. Risk Scenario Chart (Feature 1 Sensitivity & Feature 2 Risk Audits)      */
/* -------------------------------------------------------------------------- */
interface RiskScenarioChartProps {
  mode: 'sensitivity' | 'risk-audit';
  sensitivity?: Array<{
    deltaPct: number;
    rentUSD: number;
    capRate: number;
    cashOnCash: number;
    monthlyCashflowUSD: number;
  }>;
  auditItems?: Array<{
    category: string;
    item: string;
    status: 'Pass' | 'Warning' | 'Fail';
  }>;
  overallRiskScore?: number;
}

export const RiskScenarioChart: React.FC<RiskScenarioChartProps> = ({
  mode,
  sensitivity = [],
  auditItems = [],
  overallRiskScore = 0,
}) => {
  const sensitivityData = useMemo(
    () =>
      sensitivity.map((sc) => ({
        scenario:
          sc.deltaPct < 0
            ? `${sc.deltaPct}% Bear`
            : sc.deltaPct > 0
            ? `+${sc.deltaPct}% Bull`
            : 'Base (0%)',
        capRate: Number(sc.capRate || 0),
        cashOnCash: Number(sc.cashOnCash || 0),
        monthlyCashflowUSD: Math.round(sc.monthlyCashflowUSD || 0),
      })),
    [sensitivity]
  );

  const auditData = useMemo(() => {
    return auditItems.map((row) => ({
      name: row.category,
      score: row.status === 'Pass' ? 92 : row.status === 'Warning' ? 62 : 28,
      status: row.status,
    }));
  }, [auditItems]);

  if (mode === 'sensitivity' && sensitivityData.length > 0) {
    return (
      <ChartReveal className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="font-bold uppercase text-white">
            Risk Scenario Stress Chart (-10% Bear / Base / +10% Bull)
          </span>
          <span className="text-[10px] text-emerald-300">Cap Rate &amp; Cash-on-Cash %</span>
        </div>
        <div className="min-h-[240px] h-[240px] w-full" dir="ltr">
          <SafeChartContainer minWidth={280} minHeight={240}>
            <AreaChart data={sensitivityData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="aqariGoldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="aqariEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={EMERALD} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={EMERALD} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
              <XAxis
                dataKey="scenario"
                stroke="#a1a1aa"
                tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
              />
              <YAxis
                stroke="#a1a1aa"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(v) => `${v}%`}
                width={40}
              />
              <RechartsTooltip content={<TooltipShell formatter={(_, val) => `${val}%`} />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8' }}
              />
              <Area
                type="monotone"
                dataKey="capRate"
                name="Cap Rate (%)"
                stroke={GOLD}
                strokeWidth={2.5}
                fill="url(#aqariGoldGrad)"
                animationDuration={550}
              />
              <Area
                type="monotone"
                dataKey="cashOnCash"
                name="Cash-on-Cash (%)"
                stroke={EMERALD}
                strokeWidth={2.5}
                fill="url(#aqariEmeraldGrad)"
                animationDuration={650}
              />
            </AreaChart>
          </SafeChartContainer>
        </div>
      </ChartReveal>
    );
  }

  if (mode === 'risk-audit' && auditData.length > 0) {
    return (
      <ChartReveal className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="font-bold uppercase text-white">
            Due Diligence Risk Resilience by Pillar
          </span>
          <span className="text-[10px] text-[#D4AF37]">
            Composite Score: {overallRiskScore}/100
          </span>
        </div>
        <div className="min-h-[240px] h-[240px] w-full" dir="ltr">
          <SafeChartContainer minWidth={280} minHeight={240}>
            <BarChart data={auditData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                stroke="#a1a1aa"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#a1a1aa"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                width={36}
              />
              <RechartsTooltip
                content={
                  <TooltipShell formatter={(_, val) => `${val}/100 Resilience`} />
                }
              />
              <Bar dataKey="score" name="Pillar Score" radius={[6, 6, 0, 0]} animationDuration={550}>
                {auditData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      entry.status === 'Pass'
                        ? EMERALD
                        : entry.status === 'Warning'
                        ? GOLD
                        : ROSE
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </SafeChartContainer>
        </div>
      </ChartReveal>
    );
  }

  return null;
};

/* -------------------------------------------------------------------------- */
/* 4. Monte Carlo Distribution Histogram (Real Stochastic IRR & DSCR Cycles)  */
/* -------------------------------------------------------------------------- */
interface MonteCarloDistributionChartProps {
  cycles: number;
  dscrBins: Array<{ label: string; count: number; pct: number }>;
  irrBins?: Array<{ label: string; count: number; pct: number }>;
}

export const MonteCarloDistributionChart: React.FC<MonteCarloDistributionChartProps> = ({
  cycles,
  dscrBins,
  irrBins = [],
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
      <ChartReveal className="rounded-xl border border-white/10 bg-black/50 p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="font-bold uppercase text-white">
            DSCR Outcome Histogram ({cycles.toLocaleString('en-US')} cycles)
          </span>
          <span className="text-[#D4AF37]">% of Trials</span>
        </div>
        <div className="min-h-[240px] h-[240px] w-full" dir="ltr">
          <SafeChartContainer minWidth={280} minHeight={240}>
            <BarChart data={dscrBins} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                stroke="#a1a1aa"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              />
              <YAxis
                stroke="#a1a1aa"
                tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(v) => `${v}%`}
              />
              <RechartsTooltip
                content={
                  <TooltipShell formatter={(_, val) => `${val}% of simulated runs`} />
                }
              />
              <Bar
                dataKey="pct"
                name="Share"
                radius={[5, 5, 0, 0]}
                animationDuration={420}
              >
                {dscrBins.map((entry, idx) => (
                  <Cell
                    key={entry.label}
                    fill={idx === 0 ? ROSE : idx === 1 ? GOLD : EMERALD}
                  />
                ))}
              </Bar>
            </BarChart>
          </SafeChartContainer>
        </div>
      </ChartReveal>

      {irrBins.length > 0 && (
        <ChartReveal className="rounded-xl border border-white/10 bg-black/50 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="font-bold uppercase text-white">
              IRR Outcome Histogram ({cycles.toLocaleString('en-US')} cycles)
            </span>
            <span className="text-emerald-400">% of Trials</span>
          </div>
          <div className="min-h-[240px] h-[240px] w-full" dir="ltr">
            <SafeChartContainer minWidth={280} minHeight={240}>
              <BarChart data={irrBins} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  stroke="#a1a1aa"
                  tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis
                  stroke="#a1a1aa"
                  tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <RechartsTooltip
                  content={
                    <TooltipShell formatter={(_, val) => `${val}% of simulated runs`} />
                  }
                />
                <Bar
                  dataKey="pct"
                  name="Share"
                  radius={[5, 5, 0, 0]}
                  animationDuration={450}
                >
                  {irrBins.map((entry, idx) => (
                    <Cell
                      key={entry.label}
                      fill={idx === 0 || entry.label === 'N/A' ? ROSE : idx <= 2 ? GOLD : EMERALD}
                    />
                  ))}
                </Bar>
              </BarChart>
            </SafeChartContainer>
          </div>
        </ChartReveal>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. Market Forecast Trajectory Chart (Recharts Replaces Static SVG)         */
/* -------------------------------------------------------------------------- */
interface ForecastTrajectoryChartProps {
  city: string;
  series: Array<{
    label: string;
    capRate: number;
    rentGrowthPct: number;
    priceGrowthPct: number;
    rentIndex?: number;
    priceIndex?: number;
  }>;
}

export const ForecastTrajectoryChart: React.FC<ForecastTrajectoryChartProps> = ({
  city,
  series,
}) => {
  const data = useMemo(
    () =>
      series.map((pt) => ({
        label: pt.label,
        capRate: Number(pt.capRate || 0),
        rentIndex:
          typeof pt.rentIndex === 'number' && Number.isFinite(pt.rentIndex)
            ? pt.rentIndex
            : Number((100 + Number(pt.rentGrowthPct || 0)).toFixed(1)),
        priceIndex:
          typeof pt.priceIndex === 'number' && Number.isFinite(pt.priceIndex)
            ? pt.priceIndex
            : Number((100 + Number(pt.priceGrowthPct || 0)).toFixed(1)),
      })),
    [series]
  );

  if (data.length < 2) return null;

  return (
    <ChartReveal className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="font-bold uppercase text-white">
          Projected Trajectory — {city} (Now → 5Y)
        </span>
        <span className="text-[10px] text-[#D4AF37]">
          Left Axis: Cap Rate (%) • Right Axis: Rent &amp; Price Index (Base 100)
        </span>
      </div>
      <div className="min-h-[240px] h-[240px] w-full" dir="ltr">
        <SafeChartContainer minWidth={280} minHeight={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
            />
            <YAxis
              yAxisId="cap"
              stroke={GOLD}
              tick={{ fill: GOLD, fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) => `${v}%`}
              width={44}
              domain={['auto', 'auto']}
            />
            <YAxis
              yAxisId="idx"
              orientation="right"
              stroke={EMERALD}
              tick={{ fill: EMERALD, fontSize: 10, fontFamily: 'monospace' }}
              width={46}
              domain={[95, 'auto']}
            />
            <RechartsTooltip
              content={
                <TooltipShell
                  formatter={(name, val) =>
                    name.includes('Cap') ? `${Number(val).toFixed(2)}%` : `${val} pts`
                  }
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8' }}
            />
            <Line
              yAxisId="cap"
              type="monotone"
              dataKey="capRate"
              name="Cap Rate (%)"
              stroke={GOLD}
              strokeWidth={3}
              dot={{ r: 4, fill: GOLD, stroke: '#000', strokeWidth: 1.5 }}
              animationDuration={460}
            />
            <Line
              yAxisId="idx"
              type="monotone"
              dataKey="rentIndex"
              name="Rent Index (100=Now)"
              stroke={EMERALD}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: EMERALD, stroke: '#000', strokeWidth: 1.5 }}
              animationDuration={480}
            />
            <Line
              yAxisId="idx"
              type="monotone"
              dataKey="priceIndex"
              name="Price Index (100=Now)"
              stroke={PURPLE}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: PURPLE, stroke: '#000', strokeWidth: 1.5 }}
              animationDuration={480}
            />
          </ComposedChart>
        </SafeChartContainer>
      </div>
    </ChartReveal>
  );
};

