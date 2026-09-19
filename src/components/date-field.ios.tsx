import DateTimePicker from '@react-native-community/datetimepicker';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { addDays, fromIsoDate, toIsoDate } from '@/domain/dates';
import { useTheme } from '@/hooks/use-theme';

import type { DateFieldProps } from './date-field';

/** Quick chips plus the native compact iOS date picker. */
export function DateField({ value, onChange }: DateFieldProps) {
  const theme = useTheme();
  const today = toIsoDate(new Date());
  const yesterday = addDays(today, -1);

  return (
    <View style={styles.row}>
      <Chip label="Today" selected={value === today} onPress={() => onChange(today)} />
      <Chip label="Yesterday" selected={value === yesterday} onPress={() => onChange(yesterday)} />
      <DateTimePicker
        value={fromIsoDate(value)}
        mode="date"
        display="compact"
        maximumDate={new Date()}
        accentColor={theme.tint}
        onValueChange={(_event, date) => onChange(toIsoDate(date))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
