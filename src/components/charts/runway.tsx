import { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatDayHeading } from '@/domain/dates';
import { formatPenceShort } from '@/domain/money';
import type { Runway } from '@/domain/runway';
import { useTheme } from '@/hooks/use-theme';

/** Tall enough to show the slope, short enough to sit under the ring. */
const HEIGHT = 92;
const GAP = 2;
const MIN_BAR = 3;

interface RunwayChartProps {
  runway: Runway;
}

/**
 * The days ahead as a row of soft bars: one per day, as tall as the money that
 * will still be there on it. The days that have happened are solid, the ones
 * to come are lighter, a bill shows up as the day the bars suddenly get
 * shorter, and anything past the end of the money hangs below the line.
 * Hold a day to hear what it will be worth.
 */
export function RunwayChart({ runway }: RunwayChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [held, setHeld] = useState<number | null>(null);

  const count = runway.days.length;
  const barWidth = count > 0 ? Math.max((width - GAP * (count - 1)) / count, 1) : 0;
  const ceiling = Math.max(runway.startPence, 1);
  const floor = Math.min(0, ...runway.days.map((day) => day.balancePence));
  const span = Math.max(ceiling - floor, 1);
  // Where zero sits: the budget gets the height, an overspend hangs under it.
  const line = HEIGHT * (ceiling / span);

  const scrub = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // A drag that starts here belongs here, not to the tab swipe.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => setHeld(dayAt(event.nativeEvent.locationX)),
        onPanResponderMove: (event) => setHeld(dayAt(event.nativeEvent.locationX)),
        onPanResponderRelease: () => setHeld(null),
        onPanResponderTerminate: () => setHeld(null),
      }).panHandlers,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, count],
  );

  function dayAt(locationX: number): number {
    if (width === 0 || count === 0) return 0;
    const index = Math.floor((locationX / width) * count);
    return Math.min(Math.max(index, 0), count - 1);
  }

  const todayIndex = Math.max(0, runway.days.findIndex((day) => !day.past) - 1);
  const picked = runway.days[held ?? todayIndex];
  const pickedCliff = runway.cliffs.find((cliff) => cliff.dueOn === picked?.on);

  /**
   * A bill gets a chip over the day it leaves. Two bills a few days apart would
   * sit on top of each other, so each one is nudged clear of the one before.
   */
  const CHIP_WIDTH = 104;
  const chips = runway.cliffs
    .slice(0, 3)
    .reduce<{ cliff: (typeof runway.cliffs)[number]; left: number }[]>((placed, cliff) => {
      const index = runway.days.findIndex((day) => day.on === cliff.dueOn);
      if (index === -1 || width === 0) return placed;

      const wanted = (index / Math.max(count, 1)) * width - CHIP_WIDTH / 3;
      const after = placed.length > 0 ? placed[placed.length - 1].left + CHIP_WIDTH + 6 : 0;
      const left = Math.min(Math.max(wanted, after, 0), Math.max(width - CHIP_WIDTH, 0));
      // No room left on the row: the rest are found by holding the day instead.
      if (placed.length > 0 && left < after) return placed;
      return [...placed, { cliff, left }];
    }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.lead}>
        <ThemedText type="amountLarge">
          {/* "£262 short" reads better than a minus sign in front of money. */}
          {(picked?.balancePence ?? 0) < 0
            ? `${formatPenceShort(Math.abs(picked.balancePence))} short`
            : formatPenceShort(picked?.balancePence ?? 0)}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {held === null
            ? runway.headline
            : `${formatDayHeading(picked.on)}${pickedCliff ? ` · after ${pickedCliff.label}` : picked.past ? '' : ' · if the pace holds'}`}
        </ThemedText>
      </View>

      {chips.length > 0 && width > 0 ? (
        <View style={styles.chips}>
          {chips.map(({ cliff, left }) => (
            <View
              key={`${cliff.label}-${cliff.dueOn}`}
              style={[styles.chip, { backgroundColor: theme.backgroundElement, left }]}>
              <ThemedText type="caption" numberOfLines={1}>
                {cliff.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      <View
        style={styles.plot}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${runway.headline} ${formatPenceShort(runway.todayPence)} left today, out of ${formatPenceShort(runway.startPence)}.`}
        {...scrub}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {runway.days.map((day, index) => {
              const short = day.balancePence < 0;
              const size = Math.max((Math.abs(day.balancePence) / span) * HEIGHT, MIN_BAR);
              const lit = held === index || (held === null && index === todayIndex);

              return (
                <Rect
                  key={day.on}
                  x={index * (barWidth + GAP)}
                  y={short ? line : line - size}
                  width={barWidth}
                  height={size}
                  rx={Math.min(barWidth / 2, 4)}
                  fill={
                    short ? theme.danger : lit ? theme.tint : day.past ? theme.tint : theme.tintSoft
                  }
                  opacity={short ? 0.6 : lit ? 1 : day.past ? 0.55 : 1}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>

      <View style={styles.ends}>
        <ThemedText type="caption" themeColor="textTertiary">
          {formatPenceShort(runway.startPence)} to start
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary">
          hold a day to peek
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  lead: {
    gap: 2,
  },
  chips: {
    height: 26,
  },
  chip: {
    position: 'absolute',
    maxWidth: 104,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  plot: {
    height: HEIGHT,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
