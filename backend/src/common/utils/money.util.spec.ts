import { computeInvoiceTotal, formatINR, paiseToRupees, rupeesToPaise } from './money.util';

describe('money.util', () => {
  describe('rupeesToPaise', () => {
    it('converts rupees to integer paise', () => {
      expect(rupeesToPaise(1)).toBe(100);
      expect(rupeesToPaise(12.5)).toBe(1250);
      expect(rupeesToPaise(0)).toBe(0);
    });
    it('rounds half-way values', () => {
      expect(rupeesToPaise(1.235)).toBe(124);
      expect(rupeesToPaise(1.234)).toBe(123);
    });
  });

  describe('paiseToRupees', () => {
    it('converts back cleanly', () => {
      expect(paiseToRupees(100)).toBe(1);
      expect(paiseToRupees(1234)).toBe(12.34);
    });
  });

  describe('formatINR', () => {
    it('formats using the INR locale', () => {
      const formatted = formatINR(150000);
      expect(formatted).toContain('1,500');
      expect(formatted).toMatch(/₹/);
    });
  });

  describe('computeInvoiceTotal', () => {
    it('subtracts discount and adds tax + late fee', () => {
      expect(
        computeInvoiceTotal({
          amountPaise: 100000,
          discountPaise: 10000,
          taxPaise: 5000,
          lateFeePaise: 2500,
        }),
      ).toBe(97500);
    });

    it('never returns a negative value', () => {
      expect(
        computeInvoiceTotal({
          amountPaise: 1000,
          discountPaise: 10000,
        }),
      ).toBe(0);
    });

    it('handles missing optional fields', () => {
      expect(computeInvoiceTotal({ amountPaise: 5000 })).toBe(5000);
    });
  });
});
