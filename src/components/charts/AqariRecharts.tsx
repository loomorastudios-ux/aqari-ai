import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
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
/* 1. IRR / NOI / DSCR Projection Chart (Feature 1 Underwriting)               */
/* -------------------------------------------------------------------------- */
interface IrrNoiDscrChartProps {
  capRate: number;
  cashOnCash: number;
  irr5Yr: number;
  dscr: number | string;
  netOperatingIncomeUSD: number;
  monthlyCashflowUSD: number;
  annualDebtServiceUSD: number;
  currency: CurrencyCode;
}

export const IrrNoiDscrChart: React.FC<IrrNoiDscrChartProps> = ({
  irr5Yr,
  dscr,
  netOperatingIncomeUSD,
  monthlyCashflowUSD,
  annualDebtServiceUSD,
  currency,
}) => {
  const numericDscr = Number(dscr) || 1.25;

  const data = useMemo(() => {
    const baseNoi = Math.max(0, Math.round(netOperatingIncomeUSD));
    const baseDebt = Math.max(0, Math.round(annualDebtServiceUSD));
    const baseCf = Math.round(monthlyCashflowUSD * 12);

    return [1, 2, 3, 4, 5].map((yr) => {
      const growthFactor = Math.pow(1.032, yr - 1);
      const yrNoi = Math.round(baseNoi * growthFactor);
      const yrCf = Math.round(yrNoi - baseDebt || baseCf * growthFactor);
      const yrIrr = Number((irr5Yr * (0.62 + yr * 0.076)).toFixed(2));
      const yrDscr = Number((numericDscr * Math.pow(1.028, yr - 1)).toFixed(2));
      return {
        year: `Year ${yr}`,
        noi: yrNoi,
        cashflow: yrCf,
        irr: yrIrr,
        dscr: yrDscr,
      };
    });
  }, [netOperatingIncomeUSD, annualDebtServiceUSD, monthlyCashflowUSD, irr5Yr, numericDscr]);

  return (
    <ChartReveal className="rounded-2xl border border-white/10 bg-black/50 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="font-bold uppercase text-white">
          5-Year IRR, NOI &amp; DSCR Projection
        </span>
        <span className="text-[10px] text-[#D4AF37]">
          NOI / Cashflow ({currency}) • IRR (%) • DSCR (x)
        </span>
      </div>
      <div className="h-[220px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%" minWidth={240}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <XAxis
              dataKey="year"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
            />
            <YAxis
              yAxisId="usd"
              stroke="#a1a1aa"
              tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) =>
                Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
              }
              width={48}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              stroke={PURPLE}
              tick={{ fill: '#c084fc', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(v) => `${v}%`}
              width={40}
            />
            <RechartsTooltip
              content={
                <TooltipShell
                  formatter={(name, val) => {
                    if (name.includes('IRR')) return `${val}%`;
                    if (name.includes('DSCR')) return `${val}x`;
                    return formatPrice(Number(val) || 0, currency);
                  }}
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#d4d4d8' }}
            />
            <Bar
              yAxisId="usd"
              dataKey="noi"
              name="Annual NOI"
              fill={GOLD}
              radius={[6, 6, 0, 0]}
              animationDuration={550}
            />
            <Bar
              yAxisId="usd"
              dataKey="cashflow"
              name="Net Cashflow"
              fill={EMERALD}
              radius={[6, 6, 0, 0]}
              animationDuration={650}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="irr"
              name="Equity IRR (%)"
              stroke={PURPLE}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: PURPLE, stroke: '#000', strokeWidth: 1.5 }}
              animationDuration={700}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="dscr"
              name="DSCR (x)"
              stroke={CYAN}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 3, fill: CYAN }}
              animationDuration={700}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartReveal>
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
      <div className="h-[225px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%" minWidth={240}>
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
        </ResponsiveContainer>
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
        <div className="h-[205px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%" minWidth={240}>
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
          </ResponsiveContainer>
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
        <div className="h-[205px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%" minWidth={240}>
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
          </ResponsiveContainer>
        </div>
      </ChartReveal>
    );
  }

  return null;
};
