import { StyleSheet, View } from 'react-native';

import type { BudgetStatus } from '@/domain/budget';
import { useTheme } from '@/hooks/use-theme';

interface ProgressBarProps {
  /** 0–1; values above 1 render as a full, red bar. */
  ratio: number;
  status: BudgetStatus;
  height?: number;
}

export function ProgressBar({ ratio, status, height = 8 }: ProgressBarProps) {
  const theme = useTheme();
  const fill = status === 'over' ? theme.danger : status === 'warning' ? theme.warning : theme.tint;
  const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: theme.backgroundElement },
      ]}>
      <View
        style={[
          styles.fill,
          { width: `${percent}%`, borderRadius: height / 2, backgroundColor: fill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
