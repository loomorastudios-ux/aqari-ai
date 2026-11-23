import React, { useState } from 'react';
import {
  Building2,
  Sparkles,
  FileText,
  Download,
  AlertTriangle,
  Loader2,
  Check,
  ShieldAlert,
  Phone,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import { SafeChartContainer } from '../charts/SafeChartContainer';
import type { PropertyStudioDraft } from '../../types';
import { downloadPropertyStudioPdf } from '../../utils/pdfExport';
import { CityAutocomplete } from '../ui/CityAutocomplete';
import { findCityEntry } from '../../../data/cities';

interface PropertyStudioTabProps {
  userEmail: string;
  userName?: string;
  aiListingsUsed?: number;
  aiListingLimit?: number;
  isAccountLocked?: boolean;
  isFreeTier?: boolean;
  canMemorandumPdf?: boolean;
  branding?: { firmName?: string; logoUrl?: string; accentColor?: string } | null;
  persistedDraft: PropertyStudioDraft | null;
  onDraftSaved: (
    draft: PropertyStudioDraft,
    billingPatch?: {
      analysesLeft?: number;
      analysesUsed?: number;
      aiListingsUsed?: number;
      pdfsUsed?: number;
    }
  ) => void;
  onUsageUpdate?: (patch: {
    analysesLeft?: number;
    analysesUsed?: number;
    aiListingsUsed?: number;
    pdfsUsed?: number;
  }) => void;
  onOpenRenewal?: () => void;
}

const AMENITY_OPTIONS = [
  'Concierge Lobby',
  'Private Pool',
  'Rooftop Lounge',
  'EV Charging Bays',
  'Smart Home Automation',
  'Waterfront / Marina View',
  'Fitness & Wellness Spa',
  '24/7 Institutional Security',
  'Underground Parking',
  'Turnkey Furnished Package',
];

export const PropertyStudioTab: React.FC<PropertyStudioTabProps> = ({
  userEmail,
  userName,
  aiListingsUsed = 0,
  aiListingLimit = 1,
  isAccountLocked = false,
  isFreeTier = false,
  canMemorandumPdf = false,
  branding = null,
  persistedDraft,
  onDraftSaved,
  onUsageUpdate,
  onOpenRenewal,
}) => {
  const [docType, setDocType] = useState<'listing' | 'memorandum'>(
    persistedDraft?.docType || 'listing'
  );
  const [isVirtual, setIsVirtual] = useState<boolean>(persistedDraft?.isVirtual ?? true);
  const [title, setTitle] = useState(
    persistedDraft?.title || 'Muscat Al Mouj Marina Residences Concept'
  );
  const [country, setCountry] = useState(persistedDraft?.country || 'Oman');
  const [city, setCity] = useState(persistedDraft?.city || 'Muscat');
  const [cityId, setCityId] = useState<string>(
    () => findCityEntry(persistedDraft?.city || 'Muscat')?.city_id || 'om-muscat'
  );
  const [cityError, setCityError] = useState<string | null>(null);
  const [areaDistrict, setAreaDistrict] = useState(
    persistedDraft?.areaDistrict || 'Al Mouj Waterfront District'
  );
  const [propertyType, setPropertyType] = useState<
    'Apartment' | 'Villa' | 'Commercial' | 'Land' | 'Hotel'
  >(persistedDraft?.propertyType || 'Apartment');
  const [budgetUSD, setBudgetUSD] = useState(String(persistedDraft?.budgetUSD ?? 680000));
  const [areaSqM, setAreaSqM] = useState(String(persistedDraft?.areaSqM ?? 185));
  const [bedrooms, setBedrooms] = useState(String(persistedDraft?.bedrooms ?? 3));
  const [bathrooms, setBathrooms] = useState(String(persistedDraft?.bathrooms ?? 3));
  const [expectedMonthlyRentUSD, setExpectedMonthlyRentUSD] = useState(
    String(persistedDraft?.expectedMonthlyRentUSD ?? 4650)
  );
  const [targetYieldPct, setTargetYieldPct] = useState(
    String(persistedDraft?.targetYieldPct ?? 8.2)
  );
  const [finishing, setFinishing] = useState<
    'Shell & Core' | 'Standard' | 'Luxury' | 'Ultra-Prime Turnkey'
  >(persistedDraft?.finishing || 'Luxury');
  const [amenities, setAmenities] = useState<string[]>(
    persistedDraft?.amenities || ['Concierge Lobby', 'Waterfront / Marina View', 'Underground Parking']
  );
  const [targetAudience, setTargetAudience] = useState(
    persistedDraft?.targetAudience || 'Yield Investors & GCC Residency Buyers'
  );
  const [contactName, setContactName] = useState(
    persistedDraft?.contactName || userName || 'loomorastudios'
  );
  const [contactEmail, setContactEmail] = useState(
    persistedDraft?.contactEmail || userEmail || 'loomorastudios@gmail.com'
  );
  const [contactPhone, setContactPhone] = useState(
    persistedDraft?.contactPhone === '+968 9000 0000' || !persistedDraft?.contactPhone
      ? '+968 78900731'
      : persistedDraft.contactPhone
  );
  const [contactFirm, setContactFirm] = useState(persistedDraft?.contactFirm || 'AQARI Capital Sponsor');

  const [description, setDescription] = useState(persistedDraft?.description || '');
  const [locationNarrative, setLocationNarrative] = useState(persistedDraft?.locationNarrative || '');
  const [highlights, setHighlights] = useState<string[]>(persistedDraft?.investmentHighlights || []);
  const [riskNotes, setRiskNotes] = useState<string[]>(persistedDraft?.riskNotes || []);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  const budgetNum = Math.max(0, Number(budgetUSD) || 0);
  const areaNum = Math.max(0, Number(areaSqM) || 0);
  const rentNum = Math.max(0, Number(expectedMonthlyRentUSD) || 0);
  const targetYieldNum = Math.max(0, Number(targetYieldPct) || 0);
  const impliedGrossYield =
    budgetNum > 0 && rentNum > 0 ? Number((((rentNum * 12) / budgetNum) * 100).toFixed(2)) : null;
  const isRentYieldReliable = Boolean(
    impliedGrossYield !== null && impliedGrossYield >= 1 && impliedGrossYield <= 25
  );
  const pricePerSqM = budgetNum > 0 && areaNum > 0 ? Math.round(budgetNum / areaNum) : null;

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleGenerate = async (useAiEnhance: boolean) => {
    const matchedCity = findCityEntry(city, cityId);
    if (!matchedCity) {
      setCityError('City not found, please select from list');
      setError('City not found, please select from list');
      return;
    }
    setCityError(null);
    setIsGenerating(true);
    setError(null);
    setPdfNotice(null);
    try {
      const res = await fetch('/api/app?action=studio-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          login_email: userEmail,
          docType,
          isVirtual,
          title,
          country: matchedCity.country,
          city: matchedCity.city,
          city_id: matchedCity.city_id,
          areaDistrict,
          propertyType,
          budgetUSD: budgetNum,
          areaSqM: areaNum,
          bedrooms: Number(bedrooms) || 0,
          bathrooms: Number(bathrooms) || 0,
          expectedMonthlyRentUSD: rentNum,
          targetYieldPct: targetYieldNum,
          finishing,
          amenities,
          targetAudience,
          contactName,
          contactEmail,
          contactPhone,
          contactFirm,
          useAiEnhance,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.draft) {
        setError(data.error || 'Failed to generate Property Studio dossier.');
        return;
      }
      setDescription(data.draft.description);
      setLocationNarrative(data.draft.locationNarrative);
      setHighlights(data.draft.investmentHighlights || []);
      setRiskNotes(data.draft.riskNotes || []);
      onDraftSaved(data.draft, {
        analysesLeft: typeof data.analyses_left === 'number' ? data.analyses_left : undefined,
        analysesUsed: typeof data.analyses_used === 'number' ? data.analyses_used : undefined,
        aiListingsUsed: typeof data.ai_listings_used === 'number' ? data.ai_listings_used : undefined,
      });
    } catch (err: any) {
      setError(err?.message || 'Network error generating dossier.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async (chosenType: 'listing' | 'memorandum') => {
    if (isAccountLocked) {
      onOpenRenewal?.();
      return;
    }
    if (chosenType === 'memorandum' && !canMemorandumPdf) {
      setError('Investment Memorandum PDF requires PROFESSIONAL, SOVEREIGN, or ENTERPRISE tier.');
      onOpenRenewal?.();
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/app?action=export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          login_email: userEmail,
          format: 'pdf',
          docType: chosenType === 'memorandum' ? 'memorandum' : 'pdf',
          propertyTitle: title,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setError(data?.error || 'PDF quota exceeded or upgrade required.');
        onOpenRenewal?.();
        return;
      }
      if (onUsageUpdate && (typeof data?.analyses_left === 'number' || typeof data?.pdfs_used === 'number')) {
        onUsageUpdate({
          analysesLeft: data.analyses_left,
          analysesUsed: data.analyses_used,
          pdfsUsed: data.pdfs_used,
        });
      }
    } catch {}

    const safeDesc =
      description.trim() ||
      `${isVirtual ? 'Virtual Concept - Not a real listing. ' : ''}${finishing} ${propertyType} in ${areaDistrict}, ${city}, ${country} spanning ${areaNum.toLocaleString('en-US')} m2 tailored for ${targetAudience}.`;
    const safeLoc =
      locationNarrative.trim() ||
      `${areaDistrict} within ${city}, ${country} offers institutional connectivity and cross-border investor depth. Exact parcel identifiers withheld.`;
    const safeHighlights =
      highlights.length > 0
        ? highlights
        : [
            `${finishing} architectural specification across ${areaNum.toLocaleString('en-US')} m2.`,
            `Indicative budget of $${budgetNum.toLocaleString('en-US')} aligned with ${targetAudience}.`,
            isRentYieldReliable
              ? `Indicative gross yield ${impliedGrossYield}% (unverified estimate; not guaranteed).`
              : `Target yield objective: ${targetYieldNum}% (subject to lease execution).`,
          ];
    const safeRisks =
      riskNotes.length > 0
        ? riskNotes
        : [
            isVirtual
              ? 'Virtual Concept - Not a real listing. No verified street address, photography, or binding offer.'
              : 'Indicative financials remain subject to title deed audit and formal valuation.',
            'Returns are not guaranteed and fluctuate with interest rates and occupancy.',
          ];

    const file = downloadPropertyStudioPdf({
      docType: chosenType,
      isVirtual,
      title,
      country,
      city,
      areaDistrict,
      propertyType,
      budgetUSD: budgetNum,
      areaSqM: areaNum,
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      expectedMonthlyRentUSD: rentNum,
      targetYieldPct: targetYieldNum,
      finishing,
      amenities,
      targetAudience,
      description: safeDesc,
      locationNarrative: safeLoc,
      investmentHighlights: safeHighlights,
      riskNotes: safeRisks,
      isRentYieldReliable,
      rentYieldBasisNote: isRentYieldReliable
        ? `Indicative Gross Yield (${impliedGrossYield}%) based on supplied rent & budget. Not guaranteed.`
        : 'Monthly rent / yield unverified or omitted from formal projections.',
      contactName,
      contactEmail,
      contactPhone,
      contactFirm,
      isWatermarked: Boolean(isFreeTier),
      branding: branding || null,
    });
    setPdfNotice(`Downloaded ${file}`);
  };

  const chartData = isRentYieldReliable
    ? [
        { metric: 'Implied Gross Yield', pct: impliedGrossYield || 0 },
        { metric: 'Target Yield Hurdle', pct: targetYieldNum },
        { metric: 'Indicative Net Yield', pct: Number(((impliedGrossYield || 0) * 0.82).toFixed(2)) },
      ]
    : [{ metric: 'Target Yield Hurdle', pct: targetYieldNum }];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>AI PROPERTY STUDIO • BESPOKE PDF BUILDER</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            AI Property Studio (Listing &amp; Memorandum PDFs)
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Build client-ready black &amp; gold Property Listing PDFs or Investment Memorandum PDFs with strict virtual-concept truth guardrails.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-zinc-300">
            AI Listings: <strong className="text-[#D4AF37]">{aiListingsUsed} / {aiListingLimit}</strong>
          </span>
          <div className="flex items-center gap-2 bg-black/50 p-1 rounded-xl border border-white/15 font-mono text-xs">
            <button
              type="button"
              onClick={() => setDocType('listing')}
              className={`px-3 py-2 rounded-lg font-bold cursor-pointer transition ${
                docType === 'listing' ? 'bg-[#D4AF37] text-black' : 'text-zinc-300 hover:text-white'
              }`}
            >
              Property Listing PDF
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canMemorandumPdf) {
                  onOpenRenewal?.();
                  return;
                }
                setDocType('memorandum');
              }}
              className={`px-3 py-2 rounded-lg font-bold cursor-pointer transition ${
                docType === 'memorandum' ? 'bg-[#D4AF37] text-black' : 'text-zinc-300 hover:text-white'
              }`}
            >
              {canMemorandumPdf ? 'Investment Memorandum PDF' : 'Investment Memo PDF (PRO+)'}
            </button>
          </div>
        </div>
      </div>

      {/* Virtual Disclosure Switch */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isVirtual
            ? 'bg-amber-950/35 border-amber-500/50 text-amber-200'
            : 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
        }`}
      >
        <div className="flex items-start gap-2.5 text-xs font-mono">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <div className="font-bold">
              {isVirtual
                ? 'VIRTUAL CONCEPT MODE: Clearly labeled "Virtual Concept - Not a real listing"'
                : 'VERIFIED SPONSOR OFFERING: Real addresses/photos are still never fabricated by AI'}
            </div>
            <div className="text-[11px] opacity-85">
              Zero fabricated addresses, zero fake photography, zero guaranteed-return claims.
            </div>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 font-mono text-xs font-bold cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={isVirtual}
            onChange={(e) => setIsVirtual(e.target.checked)}
            className="accent-[#D4AF37] w-4 h-4"
          />
          <span>Virtual Concept</span>
        </label>
      </div>

      {/* Studio Inputs */}
      <div className="glass-panel p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <div className="lg:col-span-2 space-y-1">
            <label className="text-xs text-zinc-300 block">Dossier / Concept Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">City (Global 1,273+ Markets)</label>
            <CityAutocomplete
              value={city}
              cityId={cityId}
              onChangeValue={(val) => {
                setCity(val);
                setCityError(null);
              }}
              onSelectCity={(entry) => {
                setCity(entry.city);
                setCityId(entry.city_id);
                setCountry(entry.country);
                setCityError(null);
              }}
              onClearSelection={() => setCityId('')}
              error={cityError}
              placeholder="Type city (e.g. M -> Muscat, Madrid...)"
              inputClassName="w-full pl-9 pr-9 py-2.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-white text-sm outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Country (Auto-Filled)</label>
            <input
              type="text"
              readOnly
              lang="en"
              dir="ltr"
              value={country}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-zinc-300 text-sm outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Area / District</label>
            <input
              type="text"
              lang="en"
              value={areaDistrict}
              onChange={(e) => setAreaDistrict(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Property Type</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-sm"
            >
              <option value="Apartment">Apartment</option>
              <option value="Villa">Villa</option>
              <option value="Commercial">Commercial</option>
              <option value="Land">Land</option>
              <option value="Hotel">Hotel</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Budget (USD)</label>
            <input
              type="number"
              inputMode="numeric"
              lang="en"
              dir="ltr"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              value={budgetUSD}
              onChange={(e) => setBudgetUSD(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Built-up / Land Area (m²)</label>
            <input
              type="number"
              inputMode="numeric"
              lang="en"
              dir="ltr"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              value={areaSqM}
              onChange={(e) => setAreaSqM(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Rooms (Beds / Baths)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="numeric"
                lang="en"
                dir="ltr"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                placeholder="Beds"
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
              />
              <input
                type="number"
                inputMode="numeric"
                lang="en"
                dir="ltr"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                placeholder="Baths"
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Indicative Monthly Rent (USD/mo)</label>
            <input
              type="number"
              inputMode="numeric"
              lang="en"
              dir="ltr"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              value={expectedMonthlyRentUSD}
              onChange={(e) => setExpectedMonthlyRentUSD(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Target Yield (%)</label>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              lang="en"
              dir="ltr"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              value={targetYieldPct}
              onChange={(e) => setTargetYieldPct(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Finishing Specification</label>
            <select
              value={finishing}
              onChange={(e) => setFinishing(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-sm"
            >
              <option value="Shell & Core">Shell &amp; Core</option>
              <option value="Standard">Standard</option>
              <option value="Luxury">Luxury</option>
              <option value="Ultra-Prime Turnkey">Ultra-Prime Turnkey</option>
            </select>
          </div>
          <div className="lg:col-span-2 space-y-1">
            <label className="text-xs text-zinc-300 block">Target Audience</label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-sm"
            >
              <option value="Yield Investors & GCC Residency Buyers">Yield Investors &amp; GCC Residency Buyers</option>
              <option value="Institutional REIT & Family Offices">Institutional REIT &amp; Family Offices</option>
              <option value="End-User Luxury Family Buyers">End-User Luxury Family Buyers</option>
              <option value="Hospitality & Short-Stay Operators">Hospitality &amp; Short-Stay Operators</option>
            </select>
          </div>
          <div className="lg:col-span-2 space-y-1">
            <label className="text-xs text-zinc-300 block">Sponsor Contact (Name / Firm / Email / Phone)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                type="text"
                lang="en"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name"
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
              />
              <input
                type="text"
                lang="en"
                value={contactFirm}
                onChange={(e) => setContactFirm(e.target.value)}
                placeholder="Firm"
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
              />
              <input
                type="email"
                lang="en"
                dir="ltr"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email"
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
              />
              <input
                type="tel"
                inputMode="tel"
                lang="en"
                dir="ltr"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+968 78900731"
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
              />
            </div>
          </div>
        </div>

        {/* Amenities Selector */}
        <div className="space-y-2">
          <div className="text-xs font-mono text-zinc-300">Amenities</div>
          <div className="flex flex-wrap gap-2">
            {AMENITY_OPTIONS.map((am) => {
              const selected = amenities.includes(am);
              return (
                <button
                  key={am}
                  type="button"
                  onClick={() => toggleAmenity(am)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border cursor-pointer transition flex items-center gap-1.5 ${
                    selected
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] font-bold'
                      : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {selected && <Check className="w-3 h-3" />}
                  <span>{am}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editable Narrative Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Architectural Description (Editable)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Click 'Generate Copy with Gemini AI' or write bespoke property description..."
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-300 block">Location &amp; Market Positioning (Editable)</label>
            <textarea
              rows={3}
              value={locationNarrative}
              onChange={(e) => setLocationNarrative(e.target.value)}
              placeholder="Sub-market positioning narrative (no invented street numbers)..."
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isGenerating || isAccountLocked}
            onClick={() => handleGenerate(true)}
            className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isGenerating ? 'Generating Copy...' : 'Generate Copy with Gemini AI (-2 CREDITS)'}</span>
          </button>

          <button
            type="button"
            disabled={isGenerating || isAccountLocked}
            onClick={() => handleGenerate(false)}
            className="px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white font-mono text-xs cursor-pointer disabled:opacity-50"
          >
            Save Structured Draft (-2 CREDITS)
          </button>

          <button
            type="button"
            disabled={isAccountLocked}
            onClick={() => handleDownloadPdf('listing')}
            className="px-4 py-3 rounded-xl bg-purple-500/20 hover:bg-purple-500 hover:text-black border border-purple-500/40 text-purple-200 font-mono font-bold text-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isFreeTier ? 'Export Watermarked Listing PDF (-1 CR)' : 'Export Property Listing PDF (-1 CR)'}</span>
          </button>

          <button
            type="button"
            disabled={isAccountLocked}
            onClick={() => handleDownloadPdf('memorandum')}
            className="px-4 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-200 font-mono font-bold text-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{canMemorandumPdf ? 'Export Investment Memo PDF (-1 CR)' : 'Investment Memo PDF (PRO+)'}</span>
          </button>
        </div>

        {pdfNotice && (
          <div className="text-xs font-mono text-emerald-300">{pdfNotice}</div>
        )}
      </div>

      {/* Live Black & Gold Dossier Preview */}
      <div className="rounded-2xl bg-[#070709] border border-[#D4AF37]/40 p-6 sm:p-8 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4AF37]/30 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              {docType === 'listing' ? 'AQARI PROPERTY STUDIO • PROPERTY LISTING PREVIEW' : 'AQARI PROPERTY STUDIO • INVESTMENT MEMORANDUM PREVIEW'}
            </div>
            <h3 className="text-2xl font-bold text-white mt-1">{title}</h3>
            <div className="text-xs font-mono text-zinc-400">
              {propertyType} • {areaDistrict}, {city}, {country} • Target: {targetAudience}
            </div>
          </div>
          {isVirtual && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-400 text-xs font-mono font-black text-amber-300 shrink-0">
              Virtual Concept - Not a real listing
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] text-zinc-400 uppercase">Indicative Budget</div>
            <div className="text-lg font-black text-[#D4AF37] mt-1">${budgetNum.toLocaleString('en-US')}</div>
            {pricePerSqM && <div className="text-[10px] text-zinc-500">${pricePerSqM.toLocaleString('en-US')}/m²</div>}
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] text-zinc-400 uppercase">Area &amp; Specs</div>
            <div className="text-lg font-black text-white mt-1">{areaNum.toLocaleString('en-US')} m²</div>
            <div className="text-[10px] text-zinc-500">{bedrooms} Beds / {bathrooms} Baths • {finishing}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] text-zinc-400 uppercase">Rent &amp; Yield</div>
            <div className="text-lg font-black text-emerald-300 mt-1">
              {isRentYieldReliable ? `${impliedGrossYield}% Gross` : `${targetYieldNum}% Target`}
            </div>
            <div className="text-[10px] text-zinc-500">
              {isRentYieldReliable ? `$${rentNum.toLocaleString('en-US')}/mo (Indicative)` : 'Unverified / Excluded'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="text-[10px] text-zinc-400 uppercase">Sponsor Contact</div>
            <div className="text-sm font-bold text-white mt-1 truncate">{contactName || 'loomorastudios'}</div>
            <a
              href={`mailto:${contactEmail || 'loomorastudios@gmail.com'}`}
              className="block text-[10px] text-zinc-300 hover:text-[#D4AF37] truncate transition"
            >
              {contactEmail || 'loomorastudios@gmail.com'}
            </a>
            <a
              href={`tel:${(contactPhone || '+968 78900731').replace(/[^+\d]/g, '')}`}
              dir="ltr"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              className="block text-[10px] text-emerald-300 hover:text-emerald-200 truncate transition mt-0.5"
            >
              {contactPhone || '+968 78900731'}
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="space-y-3 text-xs font-mono text-zinc-300 leading-relaxed">
            <p>{description || 'Click "Generate Copy with Gemini AI" to author bespoke institutional prose with strict truthfulness controls.'}</p>
            {locationNarrative && <p className="text-zinc-400">{locationNarrative}</p>}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex flex-wrap gap-4 text-[11px] text-zinc-300">
              <span className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-[#D4AF37]" /> {contactName}</span>
              <a
                href={`mailto:${contactEmail || 'loomorastudios@gmail.com'}`}
                className="flex items-center gap-1.5 hover:text-[#D4AF37] transition"
              >
                <Mail className="w-3.5 h-3.5 text-[#D4AF37]" /> {contactEmail || 'loomorastudios@gmail.com'}
              </a>
              <a
                href={`tel:${(contactPhone || '+968 78900731').replace(/[^+\d]/g, '')}`}
                dir="ltr"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                className="flex items-center gap-1.5 hover:text-emerald-300 transition"
              >
                <Phone className="w-3.5 h-3.5 text-[#D4AF37]" /> {contactPhone || '+968 78900731'}
              </a>
              <a
                href="https://wa.me/96878900731"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-300 underline hover:text-emerald-200"
              >
                WhatsApp Direct
              </a>
            </div>
          </div>

          <div className="min-h-[268px] w-full bg-black/40 rounded-xl border border-white/10 p-3">
            <div className="text-[10px] font-mono text-zinc-400 uppercase mb-1">
              Indicative Yield Comparison (%) — Not Guaranteed
            </div>
            <SafeChartContainer minWidth={280} minHeight={240} height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="metric" stroke="#9ca3af" fontSize={10} />
                <YAxis stroke="#9ca3af" fontSize={10} unit="%" />
                <RechartsTooltip
                  contentStyle={{ background: '#09090b', border: '1px solid #D4AF37', fontSize: 11 }}
                />
                <Bar dataKey="pct" fill="#D4AF37" radius={[6, 6, 0, 0]} />
              </BarChart>
            </SafeChartContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
