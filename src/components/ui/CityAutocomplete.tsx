import React, { useMemo, useState } from 'react';
import { CityEntry, findCityEntry, searchCities } from '../../../data/cities';
import { Globe, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';

interface CityAutocompleteProps {
  id?: string;
  value: string;
  cityId?: string;
  onChangeValue: (nextValue: string) => void;
  onSelectCity: (entry: CityEntry) => void;
  onClearSelection?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  error?: string | null;
  limit?: number;
  required?: boolean;
  disabled?: boolean;
  showMatchedBadge?: boolean;
}

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({
  id,
  value,
  cityId,
  onChangeValue,
  onSelectCity,
  onClearSelection,
  placeholder = 'Type 1+ letter (e.g. M -> Muscat, Madrid, Miami...)',
  className = '',
  inputClassName = '',
  dropdownClassName = '',
  error,
  limit = 15,
  disabled = false,
  showMatchedBadge = true,
}) => {
  const [open, setOpen] = useState(false);

  const matchedEntry = useMemo(
    () => findCityEntry(value, cityId),
    [value, cityId]
  );

  const suggestions = useMemo(
    () => searchCities(value, limit),
    [value, limit]
  );

  const trimmed = value.trim();
  const hasUnmatchedText = trimmed.length > 0 && !matchedEntry && !open;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="w-4 h-4 text-[#D4AF37]/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type="text"
          lang="en"
          dir="ltr"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 180);
          }}
          onChange={(e) => {
            const next = e.target.value;
            onChangeValue(next);
            const exact = findCityEntry(next);
            if (exact) {
              onSelectCity(exact);
            } else if (onClearSelection) {
              onClearSelection();
            }
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && open && suggestions.length > 0) {
              e.preventDefault();
              const chosen = suggestions[0];
              onChangeValue(chosen.city);
              onSelectCity(chosen);
              setOpen(false);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className={
            inputClassName ||
            'w-full pl-9 pr-9 py-2.5 rounded-xl bg-black/50 border border-white/15 focus:border-[#D4AF37] text-sm text-white outline-none transition'
          }
        />
        {matchedEntry && (
          <CheckCircle2
            className="w-4 h-4 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          className={
            dropdownClassName ||
            'absolute left-0 right-0 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl bg-[#0D1119] border border-[#D4AF37]/40 shadow-2xl divide-y divide-white/[0.06]'
          }
        >
          {suggestions.map((c) => (
            <button
              key={c.city_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChangeValue(c.city);
                onSelectCity(c);
                setOpen(false);
              }}
              className="w-full px-3.5 py-2.5 text-left hover:bg-[#D4AF37]/15 transition flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="min-w-0">
                <span className="text-xs font-bold text-white">{c.city}</span>{' '}
                <span className="text-[11px] font-mono text-zinc-400">
                  ({c.country} {c.countryCode})
                </span>
              </div>
              <span
                className="text-[11px] font-mono text-[#D4AF37] shrink-0"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {c.avgCapRate}% Cap &bull; {c.currency}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && trimmed.length >= 1 && suggestions.length === 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 px-3.5 py-2.5 rounded-xl bg-[#1A0D10] border border-rose-500/40 text-xs font-mono text-rose-200 shadow-2xl flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>City not found, please select from list</span>
        </div>
      )}

      {showMatchedBadge && matchedEntry && (
        <div
          className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-emerald-300"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>
            {matchedEntry.city} ({matchedEntry.country} {matchedEntry.countryCode}) &mdash;{' '}
            {matchedEntry.avgCapRate}% Cap &bull; {matchedEntry.currency}
          </span>
        </div>
      )}

      {(error || hasUnmatchedText) && (
        <div className="mt-1.5 text-[11px] font-mono text-rose-300 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{error || 'City not found, please select from list'}</span>
        </div>
      )}
    </div>
  );
};
