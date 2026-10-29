import { z } from 'zod';

export const minorUnitsSchema = z
  .number()
  .int('Amount must be an integer in minor units')
  .positive('Amount must be greater than zero')
  .max(10_000_000_000_000, 'Amount is above the supported maximum');

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a three-letter ISO code');

export function minorUnitsToDecimal(amountMinor: number): string {
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export function amountsEqual(a: number, b: number): boolean {
  return Number.isSafeInteger(a) && Number.isSafeInteger(b) && a === b;
}

export function formatMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${minorUnitsToDecimal(amountMinor)}`;
  }
}
