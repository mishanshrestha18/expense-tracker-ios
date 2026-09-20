import { describe, expect, it } from '@jest/globals';

import { describeCarry, envelopeLimit, nextCarry } from '../envelopes';

describe('envelopeLimit', () => {
  it('has nothing to add to without a budget', () => {
    expect(envelopeLimit(null, 3000)).toBeNull();
    expect(envelopeLimit(null, 0)).toBeNull();
  });

  it('adds what the category carried in', () => {
    expect(envelopeLimit(20000, 3000)).toBe(23000);
    expect(envelopeLimit(20000, 0)).toBe(20000);
  });

  it('takes a debt off the budget', () => {
    expect(envelopeLimit(20000, -5000)).toBe(15000);
  });

  it('stops at nothing left when the debt is bigger than the budget', () => {
    expect(envelopeLimit(20000, -25000)).toBe(0);
  });
});

describe('nextCarry', () => {
  it('hands on what the period did not spend', () => {
    expect(nextCarry(20000, 0, 17000)).toBe(3000);
    expect(nextCarry(20000, 3000, 15000)).toBe(8000);
  });

  it('hands on a debt when the period went over', () => {
    expect(nextCarry(20000, 0, 23000)).toBe(-3000);
    // A debt shrinks by the whole budget, even though the limit clamped at 0.
    expect(nextCarry(20000, -25000, 0)).toBe(-5000);
  });

  it('hands on nothing when the period lands exactly on the limit', () => {
    expect(nextCarry(20000, 0, 20000)).toBe(0);
    expect(nextCarry(20000, 3000, 23000)).toBe(0);
  });

  it('has nothing to carry without a budget', () => {
    expect(nextCarry(null, 3000, 17000)).toBeNull();
  });
});

describe('describeCarry', () => {
  it('names money waiting in the envelope', () => {
    expect(describeCarry(3000, 'month')).toBe('£30.00 carried in');
  });

  it('names a debt after the period it came from', () => {
    expect(describeCarry(-1200, 'month')).toBe('£12.00 owed from last month');
    expect(describeCarry(-1200, 'period')).toBe('£12.00 owed from last period');
  });

  it('says nothing when nothing is carried', () => {
    expect(describeCarry(0, 'month')).toBeNull();
  });
});
