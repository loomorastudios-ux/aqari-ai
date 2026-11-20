import React, { useState, useRef } from 'react';
import {
  FileUp,
  Image as ImageIcon,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Loader2,
  Download,
  BookmarkCheck,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import type {
  CurrencyCode,
  ExtractedFilePropertyDraft,
  FieldProvenanceTag,
  FileAnalysisReport,
} from '../../types';
import { formatPrice } from '../../utils/formatters';
import { downloadInstitutionalMemorandumPdf } from '../../utils/pdfExport';
import { IrrNoiDscrChart } from '../charts/AqariRecharts';

interface AnalyzeFromFileTabProps {
  userEmail: string;
  planDisplay: string;
  currentCurrency: CurrencyCode;
  isAccountLocked: boolean;
  lockBannerMessage: string;
  analysesLeftStr: string;
  canPdfExport: boolean;
  persistedReport: FileAnalysisReport | null;
  onReportCreated: (report: FileAnalysisReport, billingPatch?: { analysesLeft?: number; analysesUsed?: number }) => void;
  onClearPersisted: () => void;
  onSaveToPortfolio: (report: FileAnalysisReport) => Promise<void>;
  onOpenRenewal: () => void;
}

function ProvenanceBadge({ tag }: { tag?: FieldProvenanceTag }) {
  const t = tag || 'Missing';
  const cls =
    t === 'Extracted'
      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
      : t === 'User Confirmed'
      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
      : t === 'AI Estimated'
      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
      : 'bg-rose-500/15 border-rose-500/40 text-rose-300';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${cls}`}>
      [{t}]
    </span>
  );
}

export const AnalyzeFromFileTab: React.FC<AnalyzeFromFileTabProps> = ({
  userEmail,
  planDisplay,
  currentCurrency,
  isAccountLocked,
  lockBannerMessage,
  analysesLeftStr,
  canPdfExport,
  persistedReport,
  onReportCreated,
  onClearPersisted,
  onSaveToPortfolio,
  onOpenRenewal,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    fileName: string;
    mimeType: string;
    base64Data: string;
    previewUrl: string | null;
  } | null>(null);
  const [textHint, setTextHint] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExtractedFilePropertyDraft | null>(null);

  // Editable confirmation form fields
  const [propertyTitle, setPropertyTitle] = useState('');
  const [city, setCity] = useState('Muscat');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [areaSqM, setAreaSqM] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [priceUSD, setPriceUSD] = useState('');
  const [monthlyRentUSD, setMonthlyRentUSD] = useState('');
  const [downPaymentPct, setDownPaymentPct] = useState('30');
  const [interestRatePct, setInterestRatePct] = useState('5.5');
  const [operatingExpensePct, setOperatingExpensePct] = useState('15');
  const [hoaUSD, setHoaUSD] = useState('0');
  const [propertyTaxUSD, setPropertyTaxUSD] = useState('0');
  const [vacancyRatePct, setVacancyRatePct] = useState('5');
  const [provenance, setProvenance] = useState<Record<string, FieldProvenanceTag>>({});

  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const report = persistedReport;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractError(null);
    setRunError(null);
    if (file.size > 3.5 * 1024 * 1024) {
      setExtractError('File exceeds 3.5 MB limit. Please upload a smaller image or PDF.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const isImg = file.type.startsWith('image/');
      setSelectedFile({
        fileName: file.name,
        mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        base64Data: result,
        previewUrl: isImg ? result : null,
      });
    };
    reader.readAsDataURL(file);
  };

  const applyDraftToForm = (d: ExtractedFilePropertyDraft) => {
    setDraft(d);
    setPropertyTitle(d.propertyTitle || '');
    setCity(d.city || 'Muscat');
    setPropertyType(d.propertyType || 'Apartment');
    setAreaSqM(d.areaSqM !== null ? String(d.areaSqM) : '');
    setBedrooms(d.bedrooms !== null ? String(d.bedrooms) : '');
    setBathrooms(d.bathrooms !== null ? String(d.bathrooms) : '');
    setPriceUSD(d.priceUSD !== null ? String(d.priceUSD) : '');
    setMonthlyRentUSD(d.monthlyRentUSD !== null ? String(d.monthlyRentUSD) : '');
    setHoaUSD(d.hoaUSD !== null ? String(d.hoaUSD) : '0');
    setPropertyTaxUSD(d.propertyTaxUSD !== null ? String(d.propertyTaxUSD) : '0');
    setVacancyRatePct(d.vacancyRatePct !== null ? String(d.vacancyRatePct) : '5');
    setProvenance(d.provenance || {});
  };

  const handleExtract = async () => {
    if (isAccountLocked) {
      onOpenRenewal();
      return;
    }
    if (!selectedFile && !textHint.trim()) {
      setExtractError('Upload a property image/PDF or paste listing brochure notes first.');
      return;
    }
    setIsExtracting(true);
    setExtractError(null);
    setRunError(null);
    try {
      const res = await fetch('/api/app?action=extract-from-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          login_email: userEmail,
          fileName: selectedFile?.fileName || 'listing-notes.txt',
          mimeType: selectedFile?.mimeType || 'text/plain',
          base64Data: selectedFile?.base64Data || '',
          textExtract: textHint.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.draft) {
        setExtractError(data.error || 'Could not extract data from file.');
        return;
      }
      applyDraftToForm(data.draft);
    } catch (err: any) {
      setExtractError(err?.message || 'Network error during file extraction.');
    } finally {
      setIsExtracting(false);
    }
  };

  const markConfirmed = (fieldKey: string) => {
    setProvenance((prev) => ({
      ...prev,
      [fieldKey]: 'User Confirmed',
    }));
  };

  const handleRunAnalysis = async () => {
    if (isAccountLocked) {
      onOpenRenewal();
      return;
    }
    const pNum = Number(priceUSD);
    const rNum = Number(monthlyRentUSD);
    if (!Number.isFinite(pNum) || pNum <= 0 || !Number.isFinite(rNum) || rNum <= 0) {
      setRunError('Confirm Property Price ($) and Gross Monthly Rent ($) > 0 before creating the analysis.');
      return;
    }
    setIsRunning(true);
    setRunError(null);
    try {
      const finalProvenance: Record<string, FieldProvenanceTag> = { ...provenance };
      if (!finalProvenance.priceUSD || finalProvenance.priceUSD === 'Missing') {
        finalProvenance.priceUSD = 'User Confirmed';
      }
      if (!finalProvenance.monthlyRentUSD || finalProvenance.monthlyRentUSD === 'Missing') {
        finalProvenance.monthlyRentUSD = 'User Confirmed';
      }
      if (!finalProvenance.city || finalProvenance.city === 'Missing') {
        finalProvenance.city = 'User Confirmed';
      }

      const res = await fetch('/api/app?action=run-file-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          login_email: userEmail,
          fileName: draft?.fileName || selectedFile?.fileName || 'Property File',
          isImageOnly: Boolean(draft?.isImageOnly ?? selectedFile?.mimeType.startsWith('image/')),
          propertyTitle: propertyTitle.trim() || `${city} File Analysis`,
          city,
          propertyType,
          areaSqM: Number(areaSqM) || 0,
          bedrooms: Number(bedrooms) || 0,
          bathrooms: Number(bathrooms) || 0,
          priceUSD: pNum,
          monthlyRentUSD: rNum,
          downPaymentPct: Number(downPaymentPct) || 30,
          interestRatePct: Number(interestRatePct) || 5.5,
          operatingExpensePct: Number(operatingExpensePct) || 15,
          hoaUSD: Number(hoaUSD) || 0,
          propertyTaxUSD: Number(propertyTaxUSD) || 0,
          vacancyRatePct: Number(vacancyRatePct) || 5,
          provenance: finalProvenance,
          extractedQuotes: draft?.extractedQuotes || {},
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.report) {
        setRunError(data.error || 'Failed to generate underwriting analysis.');
        return;
      }
      onReportCreated(data.report, {
        analysesLeft: data.analyses_left,
        analysesUsed: data.analyses_used,
      });
    } catch (err: any) {
      setRunError(err?.message || 'Network error generating report.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
            <FileUp className="w-3.5 h-3.5" />
            <span>ANALYZE FROM IMAGE / PDF • GEMINI MULTIMODAL</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Analyze Property from Image or PDF
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Upload a brochure PDF, floorplan, or listing screenshot → Review [Extracted / AI Estimated / Missing] fields → Generate full underwriting (-1 Credit).
          </p>
        </div>
        <div className="text-xs font-mono text-zinc-400">
          Credits Remaining:{' '}
          <strong className="text-[#D4AF37]">{isAccountLocked ? '0 analyses left' : analysesLeftStr}</strong>
        </div>
      </div>

      {isAccountLocked && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-mono text-rose-200">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{lockBannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={onOpenRenewal}
            className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs font-mono uppercase cursor-pointer"
          >
            Upgrade / Renew
          </button>
        </div>
      )}

      {/* Upload + Extraction Step */}
      <div className="glass-panel p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#D4AF37]/40 hover:border-[#D4AF37] rounded-2xl p-6 bg-black/40 flex flex-col items-center justify-center text-center cursor-pointer transition min-h-[190px]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div className="space-y-3">
                {selectedFile.previewUrl ? (
                  <img
                    src={selectedFile.previewUrl}
                    alt="Uploaded property"
                    className="max-h-32 rounded-xl border border-white/15 mx-auto object-contain"
                  />
                ) : (
                  <FileText className="w-10 h-10 text-[#D4AF37] mx-auto" />
                )}
                <div className="text-xs font-mono font-bold text-white">{selectedFile.fileName}</div>
                <div className="text-[11px] font-mono text-zinc-400">Click to replace image or PDF</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto text-[#D4AF37]">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-white">Click to upload Image (PNG/JPG/WEBP) or PDF</div>
                <div className="text-xs font-mono text-zinc-400">
                  Max 3.5 MB • Brochure, rent roll, valuation sheet, or screenshot
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 block">
                Optional Brochure / Listing Notes (supplements image or PDF)
              </label>
              <textarea
                rows={5}
                value={textHint}
                onChange={(e) => setTextHint(e.target.value)}
                placeholder="Paste brochure text, asking price, monthly rent, or service fee figures..."
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-white font-mono text-xs outline-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Truthfulness Rule:</strong> An image alone does NOT prove property price or rental income. Confirm missing or estimated financial numbers in Step 2 before underwriting.
              </span>
            </div>
          </div>
        </div>

        {extractError && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
            {extractError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isExtracting || isAccountLocked}
            onClick={handleExtract}
            className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isExtracting ? 'Extracting via Gemini...' : 'Step 1: Extract Location & Financials'}</span>
          </button>

          {!draft && (
            <button
              type="button"
              onClick={() =>
                applyDraftToForm({
                  fileName: selectedFile?.fileName || 'Manual Entry',
                  mimeType: selectedFile?.mimeType || 'image/jpeg',
                  isImageOnly: Boolean(selectedFile?.mimeType.startsWith('image/')),
                  propertyTitle: 'Uploaded Property Review',
                  locationText: 'Muscat',
                  city: 'Muscat',
                  country: 'Oman',
                  propertyType: 'Apartment',
                  areaSqM: null,
                  bedrooms: null,
                  bathrooms: null,
                  priceUSD: null,
                  monthlyRentUSD: null,
                  annualOpexUSD: null,
                  hoaUSD: null,
                  propertyTaxUSD: null,
                  vacancyRatePct: 5,
                  extractedQuotes: {},
                  provenance: {
                    priceUSD: 'Missing',
                    monthlyRentUSD: 'Missing',
                    areaSqM: 'Missing',
                    city: 'User Confirmed',
                  },
                  missingFields: ['priceUSD', 'monthlyRentUSD', 'areaSqM'],
                  imagePriceWarning: 'Image alone does NOT prove price or rent. Enter & confirm exact numbers below.',
                  aiSummary: 'Ready for manual confirmation.',
                })
              }
              className="px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-zinc-200 font-mono text-xs cursor-pointer"
            >
              Skip to Manual Confirmation Form
            </button>
          )}
        </div>
      </div>

      {/* Step 2: Confirm Extracted & Missing Fields */}
      {draft && (
        <div className="glass-panel p-6 space-y-5 border border-[#D4AF37]/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div>
              <h3 className="text-lg font-bold text-white">
                Step 2: Confirm Extracted &amp; Missing Financials
              </h3>
              <p className="text-xs font-mono text-amber-300 mt-0.5">{draft.imagePriceWarning}</p>
            </div>
            {draft.missingFields.length > 0 && (
              <span className="px-3 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-[11px] font-mono text-rose-300">
                Missing: {draft.missingFields.join(', ')}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-300">
            <strong className="text-[#D4AF37]">Extraction Notes:</strong> {draft.aiSummary}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Property Title</span>
                <ProvenanceBadge tag={provenance.propertyTitle} />
              </div>
              <input
                type="text"
                value={propertyTitle}
                onChange={(e) => {
                  setPropertyTitle(e.target.value);
                  markConfirmed('propertyTitle');
                }}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>City / Market</span>
                <ProvenanceBadge tag={provenance.city} />
              </div>
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  markConfirmed('city');
                }}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Property Type</span>
                <ProvenanceBadge tag={provenance.propertyType || 'Extracted'} />
              </div>
              <select
                value={propertyType}
                onChange={(e) => {
                  setPropertyType(e.target.value);
                  markConfirmed('propertyType');
                }}
                className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/15 text-white text-sm"
              >
                <option value="Apartment">Apartment</option>
                <option value="Villa">Villa</option>
                <option value="Commercial">Commercial</option>
                <option value="Land">Land</option>
                <option value="Hotel">Hotel</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Purchase Price (USD) *</span>
                <ProvenanceBadge tag={provenance.priceUSD} />
              </div>
              <input
                type="number"
                lang="en"
                dir="ltr"
                placeholder="Required — Confirm USD"
                value={priceUSD}
                onChange={(e) => {
                  setPriceUSD(e.target.value);
                  markConfirmed('priceUSD');
                }}
                className={`w-full px-3 py-2 rounded-xl bg-black/50 border text-white text-sm ${
                  !priceUSD ? 'border-rose-500/70' : 'border-white/15'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Gross Monthly Rent (USD/mo) *</span>
                <ProvenanceBadge tag={provenance.monthlyRentUSD} />
              </div>
              <input
                type="number"
                lang="en"
                dir="ltr"
                placeholder="Required — Confirm USD/mo"
                value={monthlyRentUSD}
                onChange={(e) => {
                  setMonthlyRentUSD(e.target.value);
                  markConfirmed('monthlyRentUSD');
                }}
                className={`w-full px-3 py-2 rounded-xl bg-black/50 border text-white text-sm ${
                  !monthlyRentUSD ? 'border-rose-500/70' : 'border-white/15'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Area (m²)</span>
                <ProvenanceBadge tag={provenance.areaSqM} />
              </div>
              <input
                type="number"
                lang="en"
                dir="ltr"
                value={areaSqM}
                onChange={(e) => {
                  setAreaSqM(e.target.value);
                  markConfirmed('areaSqM');
                }}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Bedrooms / Bathrooms</span>
                <ProvenanceBadge tag={provenance.bedrooms} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Beds"
                  value={bedrooms}
                  onChange={(e) => {
                    setBedrooms(e.target.value);
                    markConfirmed('bedrooms');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
                />
                <input
                  type="number"
                  placeholder="Baths"
                  value={bathrooms}
                  onChange={(e) => {
                    setBathrooms(e.target.value);
                    markConfirmed('bathrooms');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Down Payment % / Rate %</span>
                <ProvenanceBadge tag="User Confirmed" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={downPaymentPct}
                  onChange={(e) => setDownPaymentPct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
                />
                <input
                  type="number"
                  step="0.1"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>OPEX % / Vacancy % / HOA ($/yr)</span>
                <ProvenanceBadge tag={provenance.hoaUSD || 'User Confirmed'} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={operatingExpensePct}
                  onChange={(e) => setOperatingExpensePct(e.target.value)}
                  title="OPEX %"
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
                />
                <input
                  type="number"
                  value={vacancyRatePct}
                  onChange={(e) => setVacancyRatePct(e.target.value)}
                  title="Vacancy %"
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
                />
                <input
                  type="number"
                  value={hoaUSD}
                  onChange={(e) => {
                    setHoaUSD(e.target.value);
                    markConfirmed('hoaUSD');
                  }}
                  title="Annual HOA $"
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {runError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
              {runError}
            </div>
          )}

          <button
            type="button"
            disabled={isRunning || isAccountLocked}
            onClick={handleRunAnalysis}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-mono font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{isRunning ? 'Running Underwriting...' : 'Step 3: Create Full Analysis Report (-1 CREDIT)'}</span>
          </button>
        </div>
      )}

      {/* Step 3: Full Underwriting Report with Provenance Badges */}
      {report && (
        <div className="glass-panel p-6 space-y-6 border border-emerald-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <div className="text-[11px] font-mono text-emerald-400">
                Persisted File Analysis • {report.fileName} • {new Date(report.createdAt).toLocaleString('en-US')}
              </div>
              <h3 className="text-xl font-bold text-white mt-0.5">
                {report.inputs.propertyTitle} ({report.inputs.city}, {report.inputs.country})
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-xs font-mono font-bold text-[#D4AF37]">
                Risk Score: {report.riskScore}/100 ({report.verdict})
              </span>
              <button
                type="button"
                onClick={onClearPersisted}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 border border-white/15 text-xs font-mono text-zinc-300 cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Per-Field Provenance Audit Strip */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
            <div className="text-xs font-mono font-bold text-[#D4AF37] uppercase tracking-wider">
              Source Attribution Per Field ([Extracted / AI Estimated / User Confirmed])
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2">
                <span>Price: {formatPrice(report.inputs.priceUSD, currentCurrency)}</span>
                <ProvenanceBadge tag={report.provenance.priceUSD || 'User Confirmed'} />
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2">
                <span>Rent: {formatPrice(report.inputs.rentUSD, currentCurrency)}/mo</span>
                <ProvenanceBadge tag={report.provenance.monthlyRentUSD || 'User Confirmed'} />
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2">
                <span>City: {report.inputs.city}</span>
                <ProvenanceBadge tag={report.provenance.city || 'Extracted'} />
              </div>
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2">
                <span>Area: {report.inputs.areaSqM || 'N/A'} m²</span>
                <ProvenanceBadge tag={report.provenance.areaSqM || 'User Confirmed'} />
              </div>
            </div>
          </div>

          {/* Headline Underwriting Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono tabular-nums">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[10px] uppercase text-zinc-400">Cap Rate</div>
              <div className="text-xl font-black text-[#D4AF37] mt-1">{report.results.capRate}%</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[10px] uppercase text-zinc-400">Annual NOI</div>
              <div className="text-xl font-black text-white mt-1">
                {formatPrice(report.results.netOperatingIncomeUSD, currentCurrency)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[10px] uppercase text-zinc-400">DSCR</div>
              <div className="text-xl font-black text-cyan-300 mt-1">
                {report.results.dscr ? `${report.results.dscr}x` : 'N/A'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[10px] uppercase text-zinc-400">Cash-on-Cash</div>
              <div className="text-xl font-black text-emerald-300 mt-1">{report.results.cashOnCash}%</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[10px] uppercase text-zinc-400">5-Yr Equity IRR</div>
              <div className="text-xl font-black text-purple-300 mt-1">
                {report.results.irr5Yr !== null ? `${report.results.irr5Yr}%` : 'N/A'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[10px] uppercase text-zinc-400">Monthly Cashflow</div>
              <div className="text-xl font-black text-white mt-1">
                {report.results.monthlyCashflowUSD !== null
                  ? formatPrice(report.results.monthlyCashflowUSD, currentCurrency)
                  : 'N/A'}
              </div>
            </div>
          </div>

          {report.results.yearByYear && (
            <IrrNoiDscrChart
              capRate={report.results.capRate}
              cashOnCash={report.results.cashOnCash}
              irr5Yr={report.results.irr5Yr}
              irrError={report.results.irrError}
              dscr={report.results.dscr}
              netOperatingIncomeUSD={report.results.netOperatingIncomeUSD}
              monthlyCashflowUSD={report.results.monthlyCashflowUSD ?? 0}
              annualDebtServiceUSD={report.results.annualDebtServiceUSD ?? 0}
              yearByYear={report.results.yearByYear}
              currency={currentCurrency}
            />
          )}

          {/* Market Benchmark + Warnings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5">
              <div className="font-bold text-[#D4AF37]">
                Market Context ({report.inputs.city}) [Estimated]
              </div>
              <div className="text-zinc-300">
                City Avg Cap Rate: <strong>{report.marketContext.cityAvgCapRate}%</strong> • Avg Price/m²:{' '}
                <strong>{formatPrice(report.marketContext.marketAvgPriceSqM, currentCurrency)}</strong>
              </div>
              <div className="text-zinc-400">
                YoY Rent Growth: {report.marketContext.rentGrowthYoY}% • Transfer Tax:{' '}
                {report.marketContext.transferTaxPct}% • CGT: {report.marketContext.capitalGainsTax}
              </div>
              <div className="text-[10px] text-zinc-500">
                Source: {report.marketContext.source} • Updated: {report.marketContext.updatedDate} • Not legal/tax advice.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-amber-200">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Audit &amp; Truthfulness Flags</span>
              </div>
              {report.warnings.map((w, i) => (
                <div key={i} className="text-[11px]">
                  • {w}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                setSaveSuccess(null);
                try {
                  await onSaveToPortfolio(report);
                  setSaveSuccess('Saved to Portfolio.');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-300 font-mono font-bold text-xs cursor-pointer flex items-center gap-2"
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save to Portfolio'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!canPdfExport) {
                  onOpenRenewal();
                  return;
                }
                downloadInstitutionalMemorandumPdf({
                  title: report.inputs.propertyTitle,
                  city: report.inputs.city,
                  country: report.inputs.country,
                  userEmail,
                  planDisplay,
                  valuationUSD: report.inputs.priceUSD,
                  monthlyRentUSD: report.inputs.rentUSD,
                  noiUSD: report.results.netOperatingIncomeUSD,
                  capRate: report.results.capRate,
                  cashOnCash: report.results.cashOnCash,
                  irr5Yr: report.results.irr5Yr,
                  irrError: report.results.irrError,
                  dscr: report.results.dscr,
                  monthlyCashflowUSD: report.results.monthlyCashflowUSD,
                  riskScore: `${report.riskScore}/100 (${report.verdict})`,
                  noiBreakdown: report.results.noiBreakdown,
                  yearByYear: report.results.yearByYear,
                  marketBenchmarks: {
                    avgGrossYield: report.marketContext.cityAvgCapRate,
                    transferTaxPct: report.marketContext.transferTaxPct,
                    capitalGainsTax: report.marketContext.capitalGainsTax,
                    rentGrowthYoY: report.marketContext.rentGrowthYoY,
                    source: report.marketContext.source,
                    updatedDate: report.marketContext.updatedDate,
                  },
                  monteCarlo: report.results.monteCarlo,
                  warnings: report.warnings,
                  sources: [
                    `Source file: ${report.fileName} (Provenance tracked per field)`,
                    `Market benchmark: ${report.marketContext.source} (${report.marketContext.updatedDate})`,
                  ],
                });
              }}
              className="px-4 py-2.5 rounded-xl bg-[#D4AF37]/20 hover:bg-[#D4AF37] hover:text-black border border-[#D4AF37]/40 text-[#D4AF37] font-mono font-bold text-xs cursor-pointer flex items-center gap-2"
            >
              {canPdfExport ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>Export Institutional Memorandum PDF</span>
            </button>

            {saveSuccess && <span className="text-xs font-mono text-emerald-300">{saveSuccess}</span>}
          </div>
        </div>
      )}
    </div>
  );
};
