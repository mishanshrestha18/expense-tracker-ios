import { StyleSheet, View } from 'react-native';

import { stackedSegments } from '@/domain/chart-geometry';
import { useTheme } from '@/hooks/use-theme';

export interface StackedBarItem {
  key: string;
  value: number;
  color: string;
}

interface StackedBarProps {
  items: readonly StackedBarItem[];
  /** What a full bar represents, e.g. the budget. Spending beyond it stretches the bar. */
  capacity: number;
  /** Describes the bar for VoiceOver. */
  accessibilityLabel: string;
  height?: number;
}

const MARKER_OVERHANG = 4;

/**
 * One bar split into coloured segments (like the iPhone storage bar), showing
 * where a budget went. Over budget, a red marker shows where the limit was.
 */
export function StackedBar({ items, capacity, accessibilityLabel, height = 14 }: StackedBarProps) {
  const theme = useTheme();
  const { segments, limitAt } = stackedSegments(
    items.map((item) => item.value),
    capacity,
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrapper, { height: height + MARKER_OVERHANG * 2 }]}>
      <View
        style={[
          styles.track,
          { height, borderRadius: height / 2, backgroundColor: theme.backgroundElement },
        ]}>
        {segments.map((segment, i) => (
          <View
            key={items[segment.index].key}
            style={[
              styles.segment,
              {
                left: `${segment.start * 100}%`,
                width: `${segment.width * 100}%`,
                backgroundColor: items[segment.index].color,
                // A thin gap between segments, in the card colour.
                borderRightWidth: i < segments.length - 1 ? 2 : 0,
                borderColor: theme.card,
              },
            ]}
          />
        ))}
      </View>
      {limitAt !== null ? (
        <View
          style={[
            styles.limit,
            { left: `${limitAt * 100}%`, height: height + MARKER_OVERHANG * 2 },
            { backgroundColor: theme.danger },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  limit: {
    position: 'absolute',
    top: 0,
    width: 3,
    marginLeft: -1.5,
    borderRadius: 1.5,
  },
});
