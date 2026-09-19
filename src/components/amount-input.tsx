import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface AmountInputProps {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Large "£ 0.00" entry used by the expense and budget forms. */
export function AmountInput({
  value,
  onChangeText,
  accessibilityLabel,
  placeholder = '0.00',
  autoFocus = false,
}: AmountInputProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedText style={[styles.currency, { color: theme.textSecondary }]}>£</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  currency: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: 600,
  },
  input: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: 700,
    minWidth: 100,
    fontVariant: ['tabular-nums'],
    // Browsers give inputs a wide default size; native inputs grow with their text.
    ...Platform.select({ web: { width: 200, outlineWidth: 0 } }),
  },
});
