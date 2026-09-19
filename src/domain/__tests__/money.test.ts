import { describe, expect, it } from '@jest/globals';

import {
  formatPence,
  formatPenceCompact,
  formatPenceShort,
  MAX_AMOUNT_PENCE,
  parseAmountToPence,
  penceToInputValue,
} from '../money';

describe('parseAmountToPence', () => {
  it.each([
    ['285', 28500],
    ['285.5', 28550],
    ['285.50', 28550],
    ['£285', 28500],
    ['£ 285.99', 28599],
    ['1,234.56', 123456],
    ['12,50', 1250],
    ['.75', 75],
    ['0.01', 1],
    ['50p', 50],
    ['50 pence', 50],
    ['  42  ', 4200],
  ])('parses %p as %p pence', (input, expected) => {
    expect(parseAmountToPence(input)).toBe(expected);
  });

  it.each(['', ' ', '£', 'abc', '12.345', '-5', '0', '0.00', '1.2.3', '12a'])(
    'rejects %p',
    (input) => {
      expect(parseAmountToPence(input)).toBeNull();
    },
  );

  it('rejects amounts above the maximum', () => {
    expect(parseAmountToPence(String(MAX_AMOUNT_PENCE / 100 + 1))).toBeNull();
    expect(parseAmountToPence(String(MAX_AMOUNT_PENCE / 100))).toBe(MAX_AMOUNT_PENCE);
  });
});

describe('formatting', () => {
  it('formats pence as pounds', () => {
    expect(formatPence(28550)).toBe('£285.50');
    expect(formatPence(5)).toBe('£0.05');
    expect(formatPence(123456789)).toBe('£1,234,567.89');
  });

  it('drops zero pence in the short format', () => {
    expect(formatPenceShort(28500)).toBe('£285');
    expect(formatPenceShort(28550)).toBe('£285.50');
  });

  it('abbreviates thousands for chart axes', () => {
    expect(formatPenceCompact(28550)).toBe('£286');
    expect(formatPenceCompact(100000)).toBe('£1k');
    expect(formatPenceCompact(123456)).toBe('£1.2k');
    expect(formatPenceCompact(15000000)).toBe('£150k');
  });

  it('round-trips through the input format', () => {
    for (const pence of [1, 50, 100, 28550, 28500, 123456]) {
      expect(parseAmountToPence(penceToInputValue(pence))).toBe(pence);
    }
    expect(penceToInputValue(28505)).toBe('285.05');
  });
});
