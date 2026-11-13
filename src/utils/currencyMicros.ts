/**
 * Currency amount <-> micros conversion.
 *
 * Mirrors the behaviour of Twenty's amount-micros convention (amount * 1,000,000,
 * rounded to the nearest integer) so values stay exact integers in the database
 * (`deals.amount_micros`) while the UI works in major units. Written from scratch.
 */
export const MICROS_PER_UNIT = 1_000_000;

export const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'CHF', 'CNY', 'BRL', 'MXN'] as const;

/** Major units (e.g. 1500.25) -> integer micros (1500250000). */
export const toMicros = (amount: number): number => Math.round(amount * MICROS_PER_UNIT);

/** Integer micros -> major units. */
export const fromMicros = (micros: number): number => micros / MICROS_PER_UNIT;

/** Parse user text such as "$1,234.50" or "1 234,5" into a major-unit number; null when invalid. */
export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^\d.,\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return null;
  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal mark.
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (lastComma > -1) {
    // "1,5" -> decimal; "1,234" / "1,234,567" -> thousands
    const parts = cleaned.split(',');
    normalized = parts.length === 2 && parts[1].length !== 3 ? `${parts[0]}.${parts[1]}` : cleaned.replace(/,/g, '');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(amount: number, currencyCode = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString('en-US')}`;
  }
}
