import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { formatPence } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

interface OverdueBannerProps {
  count: number;
  totalPence: number;
  onPress: () => void;
}

/** Bills whose day has passed with nothing matched. Loud on purpose. */
export function OverdueBanner({ count, totalPence, onPress }: OverdueBannerProps) {
  const theme = useTheme();
  if (count === 0) return null;

  const what = count === 1 ? '1 bill is overdue' : `${count} bills are overdue`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${what}, ${formatPence(totalPence)}. Open Bills.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: theme.dangerFill, borderColor: theme.danger },
        pressed && styles.pressed,
      ]}>
      <Icon
        name={{ ios: 'exclamationmark.triangle.fill', material: 'warning' }}
        size={18}
        color={theme.danger}
      />
      <View style={styles.text}>
        <ThemedText type="smallBold" style={{ color: theme.danger }}>
          {`${what} · ${formatPence(totalPence)}`}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          Mark them paid, or skip them if they didn’t go out.
        </ThemedText>
      </View>
      <Icon
        name={{ ios: 'chevron.right', material: 'chevron_right' }}
        size={14}
        color={theme.danger}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
