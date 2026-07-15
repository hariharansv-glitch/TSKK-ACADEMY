/**
 * All monetary amounts are stored in the DB as integer paise (₹ × 100).
 * These helpers are the single source of truth for conversions & formatting.
 */

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

export const paiseToRupees = (paise: number): number => Math.round(paise) / 100;

export function formatINR(paise: number): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** Compute total = amount - discount + tax + lateFee. Never returns a negative value. */
export function computeInvoiceTotal(input: {
  amountPaise: number;
  discountPaise?: number;
  taxPaise?: number;
  lateFeePaise?: number;
}): number {
  const total =
    input.amountPaise -
    (input.discountPaise ?? 0) +
    (input.taxPaise ?? 0) +
    (input.lateFeePaise ?? 0);
  return Math.max(0, total);
}
