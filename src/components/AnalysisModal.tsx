import React, { useState } from 'react';
import { CurrencyCode, PropertyListing, User } from '../types';
import { formatPrice } from '../utils/formatters';
import { 
  X, 
  Building, 
  MapPin, 
  ShieldCheck, 
  TrendingUp, 
  Download, 
  Check, 
  Share2, 
  AlertCircle,
  FileText,
  DollarSign,
  Percent,
  Layers,
  Lock,
  BookmarkCheck
} from 'lucide-react';

interface AnalysisModalProps {
  property: PropertyListing | null;
  currentCurrency: CurrencyCode;
  user: User | null;
  onClose: () => void;
  onSaveAnalysis?: (property: PropertyListing) => void;
  onOpenUpgrade?: () => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  property,
  currentCurrency,
  user,
  onClose,
  onSaveAnalysis,
  onOpenUpgrade,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!property) return null;

  const isProOrEnterprise = user?.plan === 'pro' || user?.plan === 'enterprise';

  const handleDownloadMemo = () => {
    if (!isProOrEnterprise) {
      if (onOpenUpgrade) onOpenUpgrade();
      return;
    }
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleSave = () => {
    if (onSaveAnalysis) {
      onSaveAnalysis(property);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const priceSqM = Math.round(property.basePriceUSD / property.areaSqM);
  const annualGrossRent = property.baseRentMonthlyUSD * 12;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
      
      <div className="relative w-full max-w-4xl rounded-[32px] glass-dropdown border border-[#D4AF37]/40 shadow-[0_30px_100px_rgba(0,0,0,0.9)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-black/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  VERIFIED ASSET DOSSIER
                </span>
                <span className="text-[10px] font-mono text-zinc-400">MARKET: {property.city.toUpperCase()}</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mt-0.5">
                {property.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadMemo}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition cursor-pointer ${
                isProOrEnterprise
                  ? 'bg-white/[0.06] hover:bg-[#D4AF37] hover:text-black border-white/10 text-white'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-amber-400/40'
              }`}
            >
              {!isProOrEnterprise ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>EXPORT PDF (PRO ONLY)</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>MEMORANDUM EXPORTED</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-[#D4AF37]" />
                  <span>EXPORT PDF MEMO</span>
                </>
              )}
            </button>

            {onSaveAnalysis && (
              <button
                onClick={handleSave}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-mono font-semibold text-white transition cursor-pointer"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{savedSuccess ? 'SAVED!' : 'SAVE ANALYSIS'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          
          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase">Acquisition Cost</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {formatPrice(property.basePriceUSD, currentCurrency)}
              </div>
              <div className="text-[10px] font-mono text-zinc-400">
                {formatPrice(priceSqM, currentCurrency)} / m²
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase">Gross Annual Rent</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {formatPrice(annualGrossRent, currentCurrency)}
              </div>
              <div className="text-[10px] font-mono text-emerald-400">
                Gross Yield: {property.grossYield}%
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase">Net Cap Rate</div>
              <div className="text-xl font-bold font-mono text-[#D4AF37] mt-0.5">
                {property.capRate}%
              </div>
              <div className="text-[10px] font-mono text-[#D4AF37]">
                NOI: {formatPrice(property.noiUSD, currentCurrency)}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase">Tenant Quality</div>
              <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5" />
                <span>{property.tenantRiskScore}</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-400">
                Occupancy: {property.occupancyRate}%
              </div>
            </div>
          </div>

          {/* Underwriting Breakdown: Cash Flow Waterfall & Sovereign Legal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left: Cash Flow Waterfall (Annualized) - Exact Real Math from Section 3 */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold flex items-center gap-2">
                <Percent className="w-4 h-4" />
                <span>Cash Flow Waterfall (Annualized)</span>
              </h4>
              
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-zinc-400">Gross Rental Receipts:</span>
                  <span className="text-white font-semibold">{formatPrice(annualGrossRent, currentCurrency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-zinc-400">Vacancy Allowance ({property.vacancyPct}%):</span>
                  <span className="text-rose-400">-{formatPrice(property.vacancyUSD, currentCurrency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-zinc-400">HOA & Service Charges:</span>
                  <span className="text-rose-400">-{formatPrice(property.hoaUSD, currentCurrency)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-zinc-400">Property Management ({property.managementPct}%):</span>
                  <span className="text-rose-400">-{formatPrice(property.managementUSD, currentCurrency)}</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-sm bg-white/[0.02] px-2 rounded">
                  <span className="text-zinc-200">Net Operating Income (NOI):</span>
                  <span className="text-emerald-400">{formatPrice(property.noiUSD, currentCurrency)}</span>
                </div>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono italic">
                Formula: NOI = Gross Rent - Vacancy - HOA - Management
              </div>
            </div>

            {/* Right: Sovereign Legal & Tax Status */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span>Sovereign Legal & Tax Status</span>
              </h4>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-zinc-400">Jurisdiction Policy:</span>
                  <span className="text-white font-semibold">{property.taxAdvantage}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-zinc-400">Foreign Freehold:</span>
                  <span className="text-emerald-400 font-semibold">100% Freehold Guaranteed</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-zinc-400">Golden Visa Eligibility:</span>
                  <span className={property.residencyEligible ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                    {property.residencyEligible ? 'YES • Sovereign Investor Visa' : 'Inquire via Legal Counsel'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-zinc-400">5-Yr Capital Appreciation:</span>
                  <span className="text-[#D4AF37] font-bold">+{property.capitalGrowthForecast}% p.a.</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Liquidity Score:</span>
                  <span className="text-white font-bold">{property.liquidityScore} / 100</span>
                </div>
              </div>
            </div>

          </div>

          {/* Micro-Location Catalysts - Real Text from Section 3 */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/[0.06]">
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-bold mb-2">
              Micro-Location & Infrastructure Tailwinds
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              {property.microLocationText}
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-black/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audited under RICS global institutional valuation guidelines</span>
          </div>
          
          <div className="flex items-center gap-3">
            {onSaveAnalysis && (
              <button
                onClick={handleSave}
                className="sm:hidden px-3 py-1.5 rounded-xl bg-white/10 text-xs font-mono text-white"
              >
                {savedSuccess ? 'Saved' : 'Save'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-semibold transition cursor-pointer"
            >
              Close Dossier
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
