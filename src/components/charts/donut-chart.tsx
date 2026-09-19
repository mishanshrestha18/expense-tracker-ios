import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { arcPath, donutSegments } from '@/domain/chart-geometry';
import { useTheme } from '@/hooks/use-theme';

export interface DonutDatum {
  key: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: readonly DonutDatum[];
  /** Describes the chart for VoiceOver. */
  accessibilityLabel: string;
  size?: number;
  thickness?: number;
  /** Content centred inside the ring, e.g. the total. */
  children?: React.ReactNode;
}

export function DonutChart({
  data,
  accessibilityLabel,
  size = 200,
  thickness = 22,
  children,
}: DonutChartProps) {
  const theme = useTheme();
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const segments = donutSegments(
    data.map((d) => d.value),
    2.5,
  );

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.backgroundElement}
          strokeWidth={thickness}
          fill="none"
        />
        {segments.map((segment) => {
          const datum = data[segment.index];
          const isFullRing = segment.endAngle - segment.startAngle >= 359.99;
          return isFullRing ? (
            <Circle
              key={datum.key}
              cx={center}
              cy={center}
              r={radius}
              stroke={datum.color}
              strokeWidth={thickness}
              fill="none"
            />
          ) : (
            <Path
              key={datum.key}
              d={arcPath(center, center, radius, segment.startAngle, segment.endAngle)}
              stroke={datum.color}
              strokeWidth={thickness}
              fill="none"
            />
          );
        })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
