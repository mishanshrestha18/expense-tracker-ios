import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface BudgetRingProps {
  /** Share of the budget used, 0–1 (values above 1 draw a full ring). */
  ratio: number;
  color: string;
  trackColor: string;
  /** Describes the ring for VoiceOver. */
  accessibilityLabel: string;
  size?: number;
  thickness?: number;
  /** Content centred inside the ring. */
  children?: React.ReactNode;
}

/** An activity-style ring that sweeps round to the budget used. */
export function BudgetRing({
  ratio,
  color,
  trackColor,
  accessibilityLabel,
  size = 188,
  thickness = 16,
  children,
}: BudgetRingProps) {
  const reduceMotion = useReducedMotion();
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.min(Math.max(ratio, 0), 1);

  const progress = useSharedValue(reduceMotion ? target : 0);
  useEffect(() => {
    progress.set(
      reduceMotion
        ? target
        : withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, reduceMotion, target]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get()),
    // A round cap on a zero-length arc would leave a stray dot.
    strokeOpacity: progress.get() > 0.002 ? 1 : 0,
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      {/* Rotate so the arc starts at 12 o'clock. */}
      <View style={styles.rotated}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={trackColor}
            strokeWidth={thickness}
            fill="none"
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            fill="none"
            animatedProps={animatedProps}
          />
        </Svg>
      </View>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rotated: {
    transform: [{ rotate: '-90deg' }],
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
