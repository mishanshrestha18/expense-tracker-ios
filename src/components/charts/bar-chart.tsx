import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { barLayout, niceCeiling } from '@/domain/chart-geometry';
import { useTheme } from '@/hooks/use-theme';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  highlighted?: boolean;
}

interface BarChartProps {
  data: readonly BarDatum[];
  formatValue: (value: number) => string;
  /** Describes the chart for VoiceOver. */
  accessibilityLabel: string;
  height?: number;
  /** A dashed horizontal line, e.g. the monthly budget. */
  reference?: { value: number; label: string };
}

const AXIS_WIDTH = 44;
const LABEL_HEIGHT = 16;
const REFERENCE_DASH = '6 4';

export function BarChart({
  data,
  formatValue,
  accessibilityLabel,
  height = 150,
  reference,
}: BarChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const axisMax = niceCeiling(Math.max(0, reference?.value ?? 0, ...data.map((d) => d.value)));
  const bars = barLayout(
    data.map((d) => d.value),
    width,
    height,
    { maxValue: axisMax, gapRatio: 0.38 },
  );
  const referenceY = reference ? height - (reference.value / axisMax) * height : null;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.plotRow}>
        <View
          style={[styles.plot, { height }]}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Svg width={width} height={height}>
              {[0, 0.5].map((fraction) => (
                <Line
                  key={fraction}
                  x1={0}
                  x2={width}
                  y1={fraction * height + 0.5}
                  y2={fraction * height + 0.5}
                  stroke={theme.separator}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              ))}
              <Line
                x1={0}
                x2={width}
                y1={height - 0.5}
                y2={height - 0.5}
                stroke={theme.separator}
                strokeWidth={1}
              />
              {bars.map((bar, i) => {
                const datum = data[i];
                const barHeight = datum.value > 0 ? Math.max(bar.height, 3) : 0;
                return (
                  <Rect
                    key={datum.key}
                    x={bar.x}
                    y={height - barHeight}
                    width={bar.width}
                    height={barHeight}
                    rx={Math.min(6, bar.width / 2)}
                    fill={datum.highlighted ? theme.tint : theme.backgroundSelected}
                  />
                );
              })}
              {referenceY !== null ? (
                <Line
                  x1={0}
                  x2={width}
                  y1={referenceY}
                  y2={referenceY}
                  stroke={theme.warning}
                  strokeWidth={1.5}
                  strokeDasharray={REFERENCE_DASH}
                />
              ) : null}
            </Svg>
          ) : null}
        </View>
        <View style={[styles.axis, { height }]}>
          <ThemedText
            type="caption"
            themeColor="textSecondary"
            style={[styles.axisLabel, { top: -LABEL_HEIGHT / 2 }]}>
            {formatValue(axisMax)}
          </ThemedText>
          <ThemedText
            type="caption"
            themeColor="textSecondary"
            style={[styles.axisLabel, { top: height / 2 - LABEL_HEIGHT / 2 }]}>
            {formatValue(axisMax / 2)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.labels}>
        {data.map((datum) => (
          <ThemedText
            key={datum.key}
            type="caption"
            themeColor={datum.highlighted ? 'text' : 'textSecondary'}
            style={styles.label}>
            {datum.label}
          </ThemedText>
        ))}
      </View>
      {reference ? (
        <View style={styles.legend}>
          <Svg width={22} height={4}>
            <Line
              x1={0}
              x2={22}
              y1={2}
              y2={2}
              stroke={theme.warning}
              strokeWidth={1.5}
              strokeDasharray={REFERENCE_DASH}
            />
          </Svg>
          <ThemedText type="caption" themeColor="textSecondary">
            {reference.label}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plotRow: {
    flexDirection: 'row',
    marginTop: LABEL_HEIGHT / 2,
  },
  plot: {
    flex: 1,
  },
  axis: {
    width: AXIS_WIDTH,
  },
  axisLabel: {
    position: 'absolute',
    right: 0,
    lineHeight: LABEL_HEIGHT,
  },
  labels: {
    flexDirection: 'row',
    marginTop: Spacing.two,
    marginRight: AXIS_WIDTH,
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
