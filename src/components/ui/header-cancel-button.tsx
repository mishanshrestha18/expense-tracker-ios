import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "Cancel" for the left side of modal headers. */
export function HeaderCancelButton() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => router.back()}
      style={styles.button}>
      <ThemedText type="body" style={{ color: theme.tint }}>
        Cancel
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Native headers already inset their items; the web header does not.
  button: Platform.select({ web: { paddingHorizontal: Spacing.three }, default: {} }),
});
