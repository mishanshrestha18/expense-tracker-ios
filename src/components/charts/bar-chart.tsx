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
}

const AXIS_WIDTH = 44;
const LABEL_HEIGHT = 16;

export function BarChart({ data, formatValue, accessibilityLabel, height = 150 }: BarChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const axisMax = niceCeiling(Math.max(0, ...data.map((d) => d.value)));
  const bars = barLayout(
    data.map((d) => d.value),
    width,
    height,
    { maxValue: axisMax, gapRatio: 0.38 },
  );

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
});
