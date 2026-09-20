import { type Ref, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { DonutChart } from '@/components/charts/donut-chart';
import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatPenceShort } from '@/domain/money';
import type { Wrapped } from '@/domain/wrapped';
import { useTheme } from '@/hooks/use-theme';

type Slice = Wrapped['slices'][number];

/**
 * The card is drawn against this width and grows or shrinks from it, so the
 * same design reads at thumbnail size on the screen and at full resolution in
 * the shared picture.
 */
const BASE_WIDTH = 360;
/** Portrait, the shape a shared picture wants. */
const ASPECT_RATIO = 9 / 16;
/** Below this the leftover ring is not worth a legend line of its own. */
const REST_VISIBLE = 0.01;
/**
 * The ring grows into whatever height the rest of the card leaves it, between
 * these, so a card with little to say is not a small ring in a large gap and a
 * full one never squeezes the legend beside it.
 */
const RING_MIN = 100;
const RING_MAX = 152;
/** Ring thickness as a share of its width. */
const RING_WEIGHT = 0.115;

interface WrapCardProps {
  wrapped: Wrapped;
  /** The view the share button captures. */
  ref?: Ref<View>;
}

/**
 * The end-of-period card: the sentence in the brand band up top, then the
 * category ring, the stats and what changed. One fixed portrait shape, scaled
 * to whatever width it is given, so a screenshot of it is the same design.
 */
export function WrapCard({ wrapped, ref }: WrapCardProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [chartHeight, setChartHeight] = useState(0);
  const scale = width / BASE_WIDTH;
  const s = (value: number) => value * scale;

  const covered = wrapped.slices.reduce((sum, slice) => sum + slice.share, 0);
  // What the five biggest categories left behind. With nothing spent at all
  // there is no remainder either, only a bare ring.
  const rest = wrapped.slices.length === 0 ? 0 : Math.max(0, 1 - covered);
  const top = wrapped.slices[0];
  const ring = Math.min(s(RING_MAX), Math.max(s(RING_MIN), chartHeight));

  return (
    <View
      ref={ref}
      // Android flattens plain views out of the tree, and a flattened view
      // cannot be captured.
      collapsable={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={cardLabel(wrapped)}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.separator, borderRadius: s(30) },
      ]}>
      {width === 0 ? null : (
        <>
          <View
            style={{
              backgroundColor: theme.tint,
              paddingHorizontal: s(Spacing.four - 2),
              paddingTop: s(Spacing.four),
              paddingBottom: s(Spacing.four + 4),
              gap: s(Spacing.four - 4),
            }}>
            <View style={styles.bandTop}>
              <CardText
                type="smallBold"
                themeColor="onTint"
                size={s(10)}
                style={[styles.overline, { letterSpacing: s(1.8), opacity: 0.75 }]}>
                Expenses
              </CardText>
              <CardText
                type="smallBold"
                themeColor="onTint"
                size={s(10)}
                style={[styles.overline, { letterSpacing: s(1.4), opacity: 0.75 }]}>
                {wrapped.periodLabel}
              </CardText>
            </View>
            <CardText
              type="title"
              themeColor="onTint"
              size={s(28)}
              leading={s(33)}
              numberOfLines={3}
              adjustsFontSizeToFit>
              {wrapped.headline}
            </CardText>
          </View>

          <View
            style={[
              styles.body,
              {
                paddingHorizontal: s(Spacing.four - 2),
                paddingTop: s(Spacing.three),
                paddingBottom: s(Spacing.four - 4),
                gap: s(Spacing.three - 2),
              },
            ]}>
            <View
              onLayout={(event: LayoutChangeEvent) =>
                setChartHeight(event.nativeEvent.layout.height)
              }
              style={[styles.split, { gap: s(Spacing.four - 6) }]}>
              <DonutChart
                data={[
                  ...wrapped.slices.map((slice) => ({
                    key: slice.name,
                    // Shares, not pence: the ring only cares about proportions.
                    value: slice.share,
                    color: slice.color,
                  })),
                  ...(rest > 0
                    ? [{ key: '__rest', value: rest, color: theme.backgroundElement }]
                    : []),
                ]}
                size={ring}
                thickness={ring * RING_WEIGHT}
                accessibilityLabel={ringLabel(wrapped.slices)}>
                <CardText type="amount" size={ring * 0.16}>
                  {top ? `${percent(top.share)}%` : '—'}
                </CardText>
                <CardText
                  type="caption"
                  themeColor="textSecondary"
                  size={ring * 0.068}
                  numberOfLines={1}
                  style={[styles.overline, { letterSpacing: s(0.6), maxWidth: ring * 0.62 }]}>
                  {top ? top.name : 'Nothing yet'}
                </CardText>
              </DonutChart>

              <View style={[styles.legend, { gap: s(Spacing.two - 1) }]}>
                {wrapped.slices.map((slice) => (
                  <LegendRow
                    key={slice.name}
                    color={slice.color}
                    name={slice.name}
                    value={formatPenceShort(slice.pence)}
                    s={s}
                  />
                ))}
                {rest >= REST_VISIBLE ? (
                  <LegendRow
                    color={theme.backgroundElement}
                    name="Other"
                    value={`${percent(rest)}%`}
                    s={s}
                  />
                ) : null}
                {wrapped.slices.length === 0 ? (
                  <CardText type="callout" themeColor="textSecondary" size={s(12)}>
                    No spending recorded.
                  </CardText>
                ) : null}
              </View>
            </View>

            <Rule color={theme.separator} />

            <View style={styles.stats}>
              {wrapped.stats.map((stat, index) => (
                <View
                  key={stat.label}
                  style={[
                    styles.stat,
                    { gap: s(1), paddingHorizontal: s(Spacing.one) },
                    index > 0 && {
                      borderLeftWidth: StyleSheet.hairlineWidth,
                      borderLeftColor: theme.separator,
                    },
                  ]}>
                  <CardText
                    type="caption"
                    themeColor="textSecondary"
                    size={s(9)}
                    numberOfLines={1}
                    style={[styles.overline, { letterSpacing: s(0.6) }]}>
                    {stat.label}
                  </CardText>
                  <CardText type="amount" size={s(15)} numberOfLines={1} adjustsFontSizeToFit>
                    {stat.value}
                  </CardText>
                  {stat.detail === undefined ? null : (
                    <CardText
                      type="caption"
                      themeColor="textTertiary"
                      size={s(9)}
                      numberOfLines={1}>
                      {stat.detail}
                    </CardText>
                  )}
                </View>
              ))}
            </View>

            {wrapped.movers.length === 0 ? null : (
              <>
                <Rule color={theme.separator} />
                <View
                  style={{
                    gap: s(2),
                    paddingLeft: s(Spacing.two + 2),
                    borderLeftWidth: s(2),
                    borderLeftColor: theme.tint,
                  }}>
                  {wrapped.movers.map((mover) => (
                    <CardText key={mover} size={s(12)} leading={s(17)} numberOfLines={1}>
                      {mover}
                    </CardText>
                  ))}
                </View>
              </>
            )}

            {wrapped.footer === null ? null : (
              <CardText
                type="footnote"
                themeColor="textSecondary"
                size={s(11)}
                numberOfLines={2}
                style={styles.footer}>
                {wrapped.footer}
              </CardText>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function LegendRow({
  color,
  name,
  value,
  s,
}: {
  color: string;
  name: string;
  value: string;
  s: (value: number) => number;
}) {
  return (
    <View style={[styles.legendRow, { gap: s(Spacing.two - 1) }]}>
      <View style={{ width: s(7), height: s(7), borderRadius: s(3.5), backgroundColor: color }} />
      <CardText type="callout" size={s(12)} numberOfLines={1} style={styles.legendName}>
        {name}
      </CardText>
      <CardText type="amount" size={s(12)}>
        {value}
      </CardText>
    </View>
  );
}

function Rule({ color }: { color: string }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color }} />;
}

/**
 * Type sized in card units rather than points, and pinned against the system
 * text size so the fixed shape of the card holds whatever the phone is set to.
 */
function CardText({
  size,
  leading,
  style,
  ...rest
}: ThemedTextProps & { size: number; leading?: number }) {
  return (
    <ThemedText
      allowFontScaling={false}
      style={[{ fontSize: size, lineHeight: leading ?? size * 1.3 }, style]}
      {...rest}
    />
  );
}

const percent = (share: number) => Math.round(share * 100);

/** The picture said out loud, since VoiceOver cannot read a screenshot. */
function cardLabel(wrapped: Wrapped): string {
  const stats = wrapped.stats.map((stat) => `${stat.label} ${stat.value}`).join(', ');
  return [
    `${wrapped.periodLabel}, wrapped.`,
    wrapped.headline,
    stats === '' ? null : `${stats}.`,
    ...wrapped.movers.map((mover) => `${mover}.`),
    wrapped.footer,
  ]
    .filter((part) => part !== null)
    .join(' ');
}

function ringLabel(slices: readonly Slice[]): string {
  if (slices.length === 0) return 'No spending to break down.';
  return `Spending by category: ${slices
    .map((slice) => `${slice.name} ${percent(slice.share)}%`)
    .join(', ')}.`;
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: ASPECT_RATIO,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  bandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  legend: {
    flex: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendName: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  overline: {
    textTransform: 'uppercase',
  },
  footer: {
    textAlign: 'center',
  },
});
