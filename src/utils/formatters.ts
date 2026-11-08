import { CurrencyCode } from '../types';
import { CURRENCY_RATES, CURRENCY_SYMBOLS } from '../constants';

export function convertUSDToCurrency(baseUSD: number, targetCurrency: CurrencyCode): number {
  const rate = CURRENCY_RATES[targetCurrency] || 1;
  const usdRate = CURRENCY_RATES.USD || 1;
  return (baseUSD * rate) / usdRate;
}

export function formatPrice(
  baseUSD: number,
  currency: CurrencyCode,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number; compact?: boolean }
): string {
  const converted = convertUSDToCurrency(baseUSD, currency);
  const info = CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.USD;

  const maxDecimals = options?.maximumFractionDigits ?? (currency === 'OMR' ? 1 : 0);
  const minDecimals = options?.minimumFractionDigits ?? 0;

  let formattedNumber: string;

  if (options?.compact && Math.abs(converted) >= 1_000_000) {
    formattedNumber = (converted / 1_000_000).toFixed(1) + 'M';
  } else if (options?.compact && Math.abs(converted) >= 1_000) {
    formattedNumber = (converted / 1_000).toFixed(0) + 'K';
  } else {
    formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(converted);
  }

  if (info.position === 'prefix') {
    return `${info.symbol}${formattedNumber}`;
  } else {
    return `${formattedNumber} ${info.symbol}`;
  }
}

export function getDaysRemaining(expiryTimestamp: number | null): number {
  if (!expiryTimestamp) return 0;
  const diffMs = expiryTimestamp - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
