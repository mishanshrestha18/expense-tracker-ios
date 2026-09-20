/**
 * How big a number can be drawn inside a ring. The ring's content box is the
 * diameter less its stroke on both sides, less a little air, and a long amount
 * has to come down to fit it: `adjustsFontSizeToFit` does that on iOS but not
 * in the web build, where the text truncates to "£266.…" instead.
 *
 * The widths behind the steps were measured in the app's own display face at
 * each size, against a 136pt box (a 188pt ring with a 16pt stroke and 10pt of
 * air): "£99.99" 129, "£181.47" 136, "£1,181.47" 163 and "£11,181.47" 180 at
 * 38pt.
 */
export const RING_DISPLAY_SIZE = 38;

/** The font size for `text` inside a ring, never larger than the default. */
export function ringAmountSize(text: string): number {
  if (text.length <= 6) return RING_DISPLAY_SIZE;
  if (text.length <= 7) return 34;
  if (text.length <= 9) return 28;
  if (text.length <= 10) return 26;
  return 22;
}

/** Size and matching line height, ready to spread into a text style. */
export function ringAmountStyle(text: string): { fontSize: number; lineHeight: number } {
  const fontSize = ringAmountSize(text);
  return { fontSize, lineHeight: Math.round(fontSize * 1.15) };
}
