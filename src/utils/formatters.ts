import { CurrencyCode } from '../types';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/**
 * Converts Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) digits to Latin English digits (0-9).
 */
export function toEnglishDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EASTERN_ARABIC_DIGITS.indexOf(d)));
}

/**
 * Strips non-[0-9.] characters after converting Arabic digits to English, keeping at most one decimal point.
 */
export function sanitizeEnglishDecimal(raw: string, allowDecimal = true): string {
  const en = toEnglishDigits(raw);
  const stripped = en.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
  if (!allowDecimal) return stripped;
  const parts = stripped.split('.');
  if (parts.length <= 1) return stripped;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

/**
 * Parses any user input (including Arabic digits or commas) into a clean finite JS number.
 */
export function parseEnglishNumber(raw: string | number, fallback = 0): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
  const cleaned = sanitizeEnglishDecimal(raw, true);
  if (!cleaned || cleaned === '.') return fallback;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Formats an integer/USD value for display inside typed text inputs (e.g. "4,200,000").
 */
export function formatUsdInputDisplay(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return Math.round(value).toLocaleString('en-US');
}

export function convertUSDToCurrency(baseUSD: number, _targetCurrency?: CurrencyCode): number {
  return Number.isFinite(baseUSD) ? baseUSD : 0;
}

export function formatPrice(
  baseUSD: number,
  _currency?: CurrencyCode,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number; compact?: boolean }
): string {
  const val = Number.isFinite(baseUSD) ? baseUSD : 0;
  const maxDecimals = options?.maximumFractionDigits ?? 0;
  const minDecimals = options?.minimumFractionDigits ?? 0;

  let formattedNumber: string;

  if (options?.compact && Math.abs(val) >= 1_000_000) {
    formattedNumber = (val / 1_000_000).toFixed(1) + 'M';
  } else if (options?.compact && Math.abs(val) >= 1_000) {
    formattedNumber = (val / 1_000).toFixed(0) + 'K';
  } else {
    formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(val);
  }

  return `$${formattedNumber}`;
}

export function getDaysRemaining(expiryTimestamp: number | null): number {
  if (!expiryTimestamp) return 0;
  const diffMs = expiryTimestamp - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
