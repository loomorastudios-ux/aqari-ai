import React from 'react';
import { CurrencyCode, PropertyListing, User } from '../types';
import { formatPrice } from '../utils/formatters';
import { 
  Building, 
  MapPin, 
  Percent, 
  Sparkles, 
  Lock, 
  ShieldCheck, 
  Maximize2,
  Bed,
  Bath,
  ArrowRight
} from 'lucide-react';

interface PropertyGridProps {
  properties: PropertyListing[];
  currentCurrency: CurrencyCode;
  selectedCity: string;
  user: User | null;
  onAnalyze: (property: PropertyListing) => void;
  onOpenPricing: () => void;
  onOpenDemo?: (slug: string) => void;
}

export const getPropertyDemoSlug = (p: PropertyListing): string => {
  if (p.id === 'prop-nyc-01') return 'tribeca';
  if (p.id === 'prop-dxb-02') return 'dubai-marina';
  if (p.id === 'prop-mct-03') return 'muscat-wave';
  if (p.id === 'prop-lon-05') return 'london-mayfair';
  if (p.id === 'prop-ruh-04') return 'riyadh-singapore-portfolio';
  const c = p.city?.toLowerCase() || '';
  if (c.includes('muscat')) return 'muscat-wave';
  if (c.includes('dubai')) return 'dubai-marina';
  if (c.includes('york')) return 'tribeca';
  if (c.includes('london')) return 'london-mayfair';
  if (c.includes('riyadh')) return 'riyadh-singapore-portfolio';
  return 'cross-border-portfolio';
};

export const PropertyGrid: React.FC<PropertyGridProps> = ({
  properties,
  currentCurrency,
  selectedCity,
  user,
  onAnalyze,
  onOpenPricing,
  onOpenDemo,
}) => {
  const filtered = selectedCity === 'All'
    ? properties
    : properties.filter((p) => p.city.toLowerCase() === selectedCity.toLowerCase());

  const analysesRemaining = user
    ? user.plan === 'enterprise'
      ? 9999
      : user.plan === 'free'
      ? user.freeAnalysesLeft ?? user.freeAnalyses ?? 3
      : user.analysesLeft ?? user.freeAnalysesLeft ?? user.freeAnalyses ?? 50
    : 3;

  const isLockedForFree = user && user.plan === 'free' && analysesRemaining <= 0;

  return (
    <section id="properties" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto relative z-10">
      
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] mb-2">
            <Building className="w-4 h-4 text-[#D4AF37]" />
            <span>High-Conviction Sovereign Assets</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Institutional Prime Listings
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">
            Pre-audited sovereign assets with verified occupancy, gross yields up to 8.8%, and cross-border tax incentives.
          </p>
        </div>

        {/* Free trial counter banner for quick context */}
        {user && user.plan === 'free' && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
            <span className="text-zinc-400">Analysis credits:</span>
            <span className={`font-mono font-bold ${analysesRemaining > 0 ? 'text-[#D4AF37]' : 'text-rose-400'}`}>
              {analysesRemaining}/3 left
            </span>
            {analysesRemaining <= 0 && (
              <button
                onClick={onOpenPricing}
                className="text-xs text-amber-400 underline font-semibold hover:text-amber-300 ml-1 cursor-pointer"
              >
                Upgrade Plan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((property) => {
          const priceSqM = Math.round(property.basePriceUSD / property.areaSqM);
          return (
            <div
              key={property.id}
              className="glass-panel group relative flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(212,175,55,0.15)]"
            >
              {/* Image & Badges */}
              <div className="relative h-56 w-full overflow-hidden rounded-t-[27px]">
                <img
                  src={property.imageUrl}
                  alt={property.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                {/* Top Tags */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                    {property.city}
                  </span>
                  {property.featuredTag && (
                    <span className="px-2.5 py-1 rounded-lg bg-[#D4AF37] text-black text-[10px] font-mono font-extrabold uppercase tracking-wider shadow-sm">
                      {property.featuredTag}
                    </span>
                  )}
                </div>

                {/* Rating badge */}
                <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>{property.tenantRiskScore}</span>
                </div>

                {/* Converted Price Tag Overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] font-mono text-zinc-300 uppercase tracking-wider">
                      Acquisition Price
                    </div>
                    <div className="text-2xl font-bold font-mono text-white tracking-tight drop-shadow-md">
                      {formatPrice(property.basePriceUSD, currentCurrency)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-zinc-400">Monthly Est. Rent</div>
                    <div className="text-sm font-semibold font-mono text-emerald-400">
                      {formatPrice(property.baseRentMonthlyUSD, currentCurrency)}/mo
                    </div>
                  </div>
                </div>
              </div>

              {/* Property Details */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition leading-snug">
                    {property.title}
                  </h3>
                  
                  <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">{property.location}</span>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-4 text-center">
                    <div>
                      <div className="text-[10px] font-mono text-zinc-400 uppercase">Gross Yield</div>
                      <div className="text-sm font-bold font-mono text-[#D4AF37]">
                        {property.grossYield}%
                      </div>
                    </div>
                    <div className="border-x border-white/[0.06]">
                      <div className="text-[10px] font-mono text-zinc-400 uppercase">Net Cap Rate</div>
                      <div className="text-sm font-bold font-mono text-emerald-400">
                        {property.capRate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-zinc-400 uppercase">Price / m²</div>
                      <div className="text-xs font-semibold font-mono text-zinc-200 mt-0.5">
                        {formatPrice(priceSqM, currentCurrency)}
                      </div>
                    </div>
                  </div>

                  {/* Property Specs */}
                  <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-white/[0.06] pb-3 mb-3">
                    <div className="flex items-center gap-1">
                      <Bed className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{property.bedrooms} Beds</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bath className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{property.bathrooms} Baths</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{property.areaSqM} m²</span>
                    </div>
                  </div>

                  {/* Tax Advantage */}
                  <div className="text-[11px] font-mono text-zinc-300 flex items-center justify-between mb-4">
                    <span className="text-zinc-500">Tax Structure:</span>
                    <span className="text-cyan-400 truncate max-w-[180px]">{property.taxAdvantage}</span>
                  </div>
                </div>

                {/* ANALYZE Action Button - Opens Demo Analysis directly without login gate */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenDemo) {
                      onOpenDemo(getPropertyDemoSlug(property));
                    } else {
                      onAnalyze(property);
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold font-mono tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md min-h-[44px] bg-white/[0.06] hover:bg-[#D4AF37] hover:text-black text-white border border-white/10 hover:border-[#D4AF37] group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] group-hover:text-black transition" />
                  <span>ANALYZE PROPERTY</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
};
