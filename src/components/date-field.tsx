import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { addDays, formatDate, type IsoDate, toIsoDate } from '@/domain/dates';

export interface DateFieldProps {
  value: IsoDate;
  onChange: (date: IsoDate) => void;
}

/** Portable date field (web/Android): quick chips plus a day stepper. iOS uses the native picker. */
export function DateField({ value, onChange }: DateFieldProps) {
  const today = toIsoDate(new Date());
  const yesterday = addDays(today, -1);

  return (
    <View style={styles.column}>
      <View style={styles.row}>
        <Chip label="Today" selected={value === today} onPress={() => onChange(today)} />
        <Chip
          label="Yesterday"
          selected={value === yesterday}
          onPress={() => onChange(yesterday)}
        />
      </View>
      <View style={styles.row}>
        <IconButton
          icon={{ ios: 'chevron.left', material: 'chevron_left' }}
          label="Previous day"
          onPress={() => onChange(addDays(value, -1))}
        />
        <ThemedText type="body" style={styles.date}>
          {formatDate(value)}
        </ThemedText>
        <IconButton
          icon={{ ios: 'chevron.right', material: 'chevron_right' }}
          label="Next day"
          disabled={value >= today}
          onPress={() => onChange(addDays(value, 1))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  date: {
    minWidth: 120,
    textAlign: 'center',
  },
});
