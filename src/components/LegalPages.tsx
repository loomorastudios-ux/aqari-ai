// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import React from 'react';
import { ArrowLeft, FileText, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';

export type LegalDocSlug = 'terms' | 'privacy' | 'refund' | 'disclaimer';

interface LegalPagesProps {
  slug: LegalDocSlug;
  onGoHome: () => void;
  onNavigateLegal: (slug: LegalDocSlug) => void;
}

export const LegalPages: React.FC<LegalPagesProps> = ({
  slug,
  onGoHome,
  onNavigateLegal,
}) => {
  const navItems: Array<{ id: LegalDocSlug; label: string }> = [
    { id: 'terms', label: 'Terms of Service' },
    { id: 'privacy', label: 'Privacy Policy' },
    { id: 'refund', label: 'Refund Policy' },
    { id: 'disclaimer', label: 'Disclaimer' },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 py-10 px-4 lg:px-8 relative z-20">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Back Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-white cursor-pointer transition"
          >
            <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
            <span>Back to AQARI Home</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigateLegal(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition ${
                  slug === item.id
                    ? 'bg-[#D4AF37] text-black font-bold'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Card */}
        <div className="glass-panel p-6 sm:p-10 border border-white/10 space-y-6 leading-relaxed">
          {slug === 'terms' && (
            <>
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-[#D4AF37]" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">
                    LEGAL AGREEMENT • LOOMORA STUDIOS
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Terms of Service</h1>
                </div>
              </div>
              <div className="space-y-4 text-sm text-zinc-300">
                <p>
                  <strong>Operator &amp; Company:</strong> AQARI TERMINAL is operated by{' '}
                  <strong>Loomora Studios</strong>, owned by <strong>Hamed Al Shami</strong>, Oman.
                  Official support and legal correspondence:{' '}
                  <a href="mailto:loomora.studios@gmail.com" className="text-[#D4AF37] underline">
                    loomora.studios@gmail.com
                  </a>
                  .
                </p>
                <p>
                  <strong>1. Nature of Service:</strong> AQARI TERMINAL is a Software-as-a-Service (SaaS)
                  real estate underwriting, yield sensitivity, and macro-data analytical tool. Access is
                  provided on a non-transferable <strong>30-day software licensing</strong> basis. AQARI
                  TERMINAL does not own, broker, custody, sell, or convey ownership of any real estate
                  properties.
                </p>
                <p>
                  <strong>2. Eligibility (18+):</strong> By registering or purchasing a license, you confirm
                  that you are at least <strong>18 years of age</strong> and legally capable of entering
                  binding agreements in your jurisdiction.
                </p>
                <p>
                  <strong>3. No Guarantee of Investment Returns:</strong> All cap rates, cash-on-cash yields,
                  IRR projections, tax matrix summaries, and Monte Carlo stress simulations are mathematical
                  models based on user inputs and public third-party benchmarks. Loomora Studios makes{' '}
                  <strong>no guarantee of future investment returns, rental occupancy, or capital appreciation</strong>.
                </p>
                <p>
                  <strong>4. Intellectual Property &amp; Acceptable Use:</strong> All software code, UI
                  workflows, calculation engines, and exported PDF memoranda remain the exclusive
                  intellectual property of Loomora Studios. Account sharing, automated scraping, or
                  bypassing plan quotas/gating is strictly prohibited and terminates access immediately.
                </p>
              </div>
            </>
          )}

          {slug === 'privacy' && (
            <>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                    DATA GOVERNANCE • LOOMORA STUDIOS
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Privacy Policy</h1>
                </div>
              </div>
              <div className="space-y-4 text-sm text-zinc-300">
                <p>
                  <strong>1. Data We Collect:</strong> We collect only the minimum operational data
                  required to authenticate your account and enforce licensing:
                </p>
                <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
                  <li>
                    <strong>Account Identity:</strong> Your email address, display name, and profile avatar
                    provided via Google OAuth.
                  </li>
                  <li>
                    <strong>Usage &amp; Underwriting Inputs:</strong> Property inputs, underwriting metrics
                    executed, saved property portfolios, and PDF Memorandum export timestamps.
                  </li>
                  <li>
                    <strong>Billing Metadata:</strong> Payment email, order ID, plan tier, and timestamp
                    received via Lemon Squeezy webhooks. <strong>We NEVER store, process, or have access
                    to credit or debit card numbers.</strong>
                  </li>
                </ul>
                <p>
                  <strong>2. Zero Sale of Data:</strong> Loomora Studios does <strong>NOT</strong> sell,
                  rent, or trade user personal data or underwriting inputs to third parties.
                </p>
                <p>
                  <strong>3. Storage &amp; Cookies:</strong> Application data and audit logs are stored on
                  secure Vercel cloud infrastructure and encrypted databases. We use{' '}
                  <strong>session cookies only</strong> (strictly necessary HttpOnly authentication cookies
                  and local currency/account preferences)—no third-party advertising trackers.
                </p>
                <p>
                  <strong>4. Data Deletion Requests:</strong> You may request permanent deletion of your
                  account and stored underwriting history at any time by emailing{' '}
                  <a href="mailto:loomora.studios@gmail.com" className="text-[#D4AF37] underline">
                    loomora.studios@gmail.com
                  </a>
                  .
                </p>
              </div>
            </>
          )}

          {slug === 'refund' && (
            <>
              <div className="flex items-center gap-3">
                <RefreshCw className="w-6 h-6 text-[#D4AF37]" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">
                    OFFICIAL BINDING POLICY • AUTOMATED RULES A–E
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Subscription Cancellation &amp; Refund Policy</h1>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-[#D4AF37]/40 text-xs font-mono text-amber-200">
                IMPORTANT: Cancellation &amp; automatic Lemon Squeezy refund is strictly server-verified under
                our 7-Day No-Usage &amp; Unresolved Technical Issue Policy. Self-serve cancellation is
                available directly inside Settings &rarr; Subscription &amp; Cancellation.
              </div>
              <div className="space-y-4 text-sm text-zinc-300">
                <p>
                  <strong>1. Refund Eligibility Conditions (Rules C &amp; D):</strong> A full refund to the
                  original payment method via Lemon Squeezy is issued automatically when:
                </p>
                <ul className="list-disc pl-6 space-y-1.5">
                  <li>
                    <strong>7-Day No-Usage Window (Rule C):</strong> You cancel within{' '}
                    <strong>7 calendar days</strong> of subscription activation AND have{' '}
                    <strong>0 successful underwriting analyses</strong> run; <strong>OR</strong>
                  </li>
                  <li>
                    <strong>Unresolved Technical Issue (Rule D):</strong> You reported a tool issue via the
                    in-app <em>Report Tool Issue</em> button, the issue remained{' '}
                    <strong>unresolved for 7+ days</strong> from the report date, AND you still have{' '}
                    <strong>0 successful analyses</strong>.
                  </li>
                </ul>
                <p>
                  <strong>2. Strict Non-Refundable / Locked Conditions (Rules A, B &amp; E):</strong>
                </p>
                <ul className="list-disc pl-6 space-y-1.5 text-rose-200">
                  <li>
                    <strong>Rule A — Any Successful Analysis Run:</strong> Once{' '}
                    <strong>1 or more successful analyses</strong> are completed (Cap Rate / Cash-on-Cash / IRR
                    output generated), cancellation with refund is permanently locked.
                  </li>
                  <li>
                    <strong>Rule B — 7-Day Window Expired Without Issue Report:</strong> After{' '}
                    <strong>7 calendar days</strong> from activation with no reported tool issue, refund is
                    no longer eligible.
                  </li>
                  <li>
                    <strong>Rule E — Issue Resolved Within 7 Days:</strong> If a reported technical issue is
                    resolved by our engineering team within 7 days and the initial 7-day window has passed,
                    refund eligibility ends.
                  </li>
                </ul>
                <p>
                  <strong>3. Checkout Consent Record:</strong> Every paid checkout requires explicit
                  acceptance of:{' '}
                  <em>&ldquo;I agree to the 7-Day No-Usage Refund Policy (0 successful analyses)&rdquo;</em>,
                  whose timestamp is logged alongside server analysis and issue resolution audit records.
                </p>
                <p>
                  <strong>4. Processing &amp; Contact:</strong> Approved refunds are issued immediately via
                  the Lemon Squeezy API and settle to your original payment method in{' '}
                  <strong>5–10 business days</strong>. Contact:{' '}
                  <a href="mailto:loomora.studios@gmail.com" className="text-[#D4AF37] underline">
                    loomora.studios@gmail.com
                  </a>
                  .
                </p>
              </div>
            </>
          )}

          {slug === 'disclaimer' && (
            <>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    MARKET DATA &amp; INVESTMENT NOTICE
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Financial &amp; Market Disclaimer</h1>
                </div>
              </div>
              <div className="space-y-4 text-sm text-zinc-300">
                <p>
                  <strong>1. Indicative Market Data:</strong> Macro-economic and regional real estate
                  metrics displayed on AQARI TERMINAL are indicative benchmarks synced daily from public
                  and institutional sources including the <strong>World Bank</strong>,{' '}
                  <strong>FRED (Federal Reserve Economic Data)</strong>,{' '}
                  <strong>Dubai Land Department (DLD)</strong>, <strong>ONS</strong>,{' '}
                  <strong>JLL</strong>, <strong>Savills</strong>, <strong>IRAS</strong>, and{' '}
                  <strong>StreetEasy</strong>.
                </p>
                <p>
                  <strong>2. Not Financial, Legal, or Tax Advice:</strong> Nothing in AQARI TERMINAL,
                  its underwriting calculators, cross-border tax &amp; visa matrix, or PDF memoranda
                  constitutes personalized financial, investment, legal, or tax advice. Always consult a
                  licensed financial advisor, attorney, or tax specialist before executing cross-border
                  property transactions.
                </p>
                <p>
                  <strong>3. Past Yield Warning:</strong> Historical rental yields, cap rates, and capital
                  appreciation figures do not guarantee future yield, liquidity, or capital preservation.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
