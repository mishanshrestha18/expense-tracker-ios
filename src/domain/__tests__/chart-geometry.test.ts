import { describe, expect, it } from '@jest/globals';

import {
  arcPath,
  barLayout,
  donutSegments,
  niceCeiling,
  polarToCartesian,
} from '../chart-geometry';

describe('polarToCartesian', () => {
  it('starts at 12 o’clock and goes clockwise', () => {
    const top = polarToCartesian(50, 50, 10, 0);
    const right = polarToCartesian(50, 50, 10, 90);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(40);
    expect(right.x).toBeCloseTo(60);
    expect(right.y).toBeCloseTo(50);
  });
});

describe('arcPath', () => {
  it('draws a quarter arc with the small-arc flag', () => {
    expect(arcPath(50, 50, 10, 0, 90)).toBe('M 50 40 A 10 10 0 0 1 60 50');
  });

  it('sets the large-arc flag past 180°', () => {
    expect(arcPath(50, 50, 10, 0, 270)).toContain(' 0 1 1 ');
  });
});

describe('donutSegments', () => {
  it('splits the circle proportionally with gaps', () => {
    const segments = donutSegments([1, 3], 0);
    expect(segments).toEqual([
      { index: 0, startAngle: 0, endAngle: 90 },
      { index: 1, startAngle: 90, endAngle: 360 },
    ]);
  });

  it('leaves gaps between segments and skips zero values', () => {
    const segments = donutSegments([1, 0, 1], 4);
    expect(segments.map((s) => s.index)).toEqual([0, 2]);
    expect(segments[0].endAngle - segments[0].startAngle).toBeCloseTo(176);
    expect(segments[1].startAngle).toBeCloseTo(180);
  });

  it('fills the ring for a single value and nothing for no data', () => {
    expect(donutSegments([5], 4)).toEqual([{ index: 0, startAngle: 0, endAngle: 360 }]);
    expect(donutSegments([0, 0])).toEqual([]);
  });
});

describe('niceCeiling', () => {
  it.each([
    [0, 1],
    [7, 10],
    [12, 20],
    [23, 25],
    [240, 250],
    [251, 500],
    [1000, 1000],
    [98765, 100000],
  ])('rounds %p up to %p', (value, expected) => {
    expect(niceCeiling(value)).toBe(expected);
  });
});

describe('barLayout', () => {
  it('scales bars to the tallest value and centres them in their slots', () => {
    const bars = barLayout([50, 100], 200, 100, { gapRatio: 0.5 });
    expect(bars).toEqual([
      { x: 25, y: 50, width: 50, height: 50 },
      { x: 125, y: 0, width: 50, height: 100 },
    ]);
  });

  it('uses a provided axis maximum and handles all-zero data', () => {
    expect(barLayout([50], 100, 100, { maxValue: 200 })[0].height).toBe(25);
    expect(barLayout([0, 0], 100, 100).every((b) => b.height === 0)).toBe(true);
    expect(barLayout([], 100, 100)).toEqual([]);
  });
});
