import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { BudgetStatus } from '@/domain/budget';
import { useTheme } from '@/hooks/use-theme';

interface ProgressBarProps {
  /** 0–1; values above 1 render as a full bar. */
  ratio: number;
  status: BudgetStatus;
  height?: number;
  /** Fill while within budget; defaults to the tint. Warning and over-budget colours always win. */
  color?: string;
}

/** Fills from the left when it appears or the value changes. */
export function ProgressBar({ ratio, status, height = 8, color }: ProgressBarProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const fill =
    status === 'over'
      ? theme.danger
      : status === 'warning'
        ? theme.warningFill
        : (color ?? theme.tint);
  const target = Math.min(Math.max(ratio, 0), 1);

  const progress = useSharedValue(reduceMotion ? target : 0);
  const trackWidth = useSharedValue(0);

  useEffect(() => {
    progress.set(
      reduceMotion
        ? target
        : withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, reduceMotion, target]);

  // Slide a full-width fill in from the left: animating a transform keeps it on
  // the UI thread and, unlike scaleX, never squashes the rounded end.
  const fillStyle = useAnimatedStyle(() => ({
    // Hidden until measured, so it never flashes full-width on the first frame.
    opacity: trackWidth.get() > 0 ? 1 : 0,
    transform: [{ translateX: -(1 - progress.get()) * trackWidth.get() }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      onLayout={(event) => trackWidth.set(event.nativeEvent.layout.width)}
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: theme.backgroundElement },
      ]}>
      <Animated.View
        style={[styles.fill, { borderRadius: height / 2, backgroundColor: fill }, fillStyle]}
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
    width: '100%',
    height: '100%',
  },
});
