import { describe, expect, it } from '@jest/globals';

import { ringAmountSize, ringAmountStyle, RING_DISPLAY_SIZE } from '../type-scale';

describe('ringAmountSize', () => {
  it('leaves a short amount at full size', () => {
    expect(ringAmountSize('£9.99')).toBe(RING_DISPLAY_SIZE);
    expect(ringAmountSize('£99.99')).toBe(RING_DISPLAY_SIZE);
  });

  it('steps down as the amount grows', () => {
    // £181.47 at 38pt measures 136 against a 136 box: exactly touching.
    expect(ringAmountSize('£181.47')).toBe(34);
    expect(ringAmountSize('£1,181.47')).toBe(28);
    expect(ringAmountSize('£11,181.47')).toBe(26);
    expect(ringAmountSize('£111,181.47')).toBe(22);
  });

  it('never grows as the text gets longer', () => {
    const sizes = [
      '£1',
      '£9.99',
      '£99.99',
      '£181.47',
      '£1,181.47',
      '£11,181.47',
      '£111,181.47',
    ].map(ringAmountSize);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    }
  });

  it('gives a line height that matches the size', () => {
    expect(ringAmountStyle('£1,181.47')).toEqual({ fontSize: 28, lineHeight: 32 });
  });
});
