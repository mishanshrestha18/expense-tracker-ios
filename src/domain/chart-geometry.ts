/**
 * Geometry for the hand-rolled SVG charts. Kept separate from the React
 * components so the maths can be unit tested without rendering anything.
 */

export interface Point {
  x: number;
  y: number;
}

/** Angle in degrees, 0° at 12 o'clock, increasing clockwise. */
export function polarToCartesian(cx: number, cy: number, radius: number, angle: number): Point {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** SVG path for a clockwise arc (meant to be stroked, not filled). */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${round(start.x)} ${round(start.y)} A ${radius} ${radius} 0 ${largeArc} 1 ${round(end.x)} ${round(end.y)}`;
}

export interface DonutSegment {
  index: number;
  startAngle: number;
  endAngle: number;
}

/**
 * Splits 360° between `values` proportionally, leaving `gap` degrees between
 * segments. Zero values get no segment. A single value fills the whole ring.
 */
export function donutSegments(values: readonly number[], gap = 2): DonutSegment[] {
  const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0);
  if (total <= 0) return [];

  const visible = values.filter((v) => v > 0).length;
  const effectiveGap = visible > 1 ? gap : 0;
  const available = 360 - effectiveGap * visible;

  const segments: DonutSegment[] = [];
  let cursor = 0;
  values.forEach((value, index) => {
    if (value <= 0) return;
    const sweep = (value / total) * available;
    segments.push({ index, startAngle: cursor, endAngle: cursor + sweep });
    cursor += sweep + effectiveGap;
  });
  return segments;
}

/** Rounds up to a "nice" axis maximum: 1, 2, 2.5 or 5 × 10ⁿ. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 2, 2.5, 5, 10].find((s) => normalized <= s) ?? 10;
  return step * magnitude;
}

export interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Evenly spaced bars growing up from the bottom of a `width × height` plot. */
export function barLayout(
  values: readonly number[],
  width: number,
  height: number,
  { gapRatio = 0.35, maxValue }: { gapRatio?: number; maxValue?: number } = {},
): Bar[] {
  if (values.length === 0) return [];
  const max = maxValue ?? Math.max(...values, 0);
  const slot = width / values.length;
  const barWidth = slot * (1 - gapRatio);
  return values.map((value, i) => {
    const barHeight = max > 0 ? (Math.max(value, 0) / max) * height : 0;
    return {
      x: i * slot + (slot - barWidth) / 2,
      y: height - barHeight,
      width: barWidth,
      height: barHeight,
    };
  });
}
