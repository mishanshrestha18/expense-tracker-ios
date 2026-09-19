import { Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

interface IconButtonProps {
  icon: IconName;
  /** Read by VoiceOver, since the button has no visible text. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'plain' | 'filled';
  size?: number;
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  variant = 'plain',
  size = 36,
}: IconButtonProps) {
  const theme = useTheme();
  const filled = variant === 'filled';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: filled ? theme.tint : theme.backgroundElement,
        },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Icon name={icon} size={size * 0.46} color={filled ? theme.onTint : theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.4,
  },
});
