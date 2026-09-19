import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { currentMonthKey, formatMonth, type MonthKey, shiftMonth } from '@/domain/dates';

interface MonthSwitcherProps {
  title: string;
  month: MonthKey;
  onChange: (month: MonthKey) => void;
  /** Extra controls on the right, e.g. an add button. */
  accessory?: React.ReactNode;
}

/** Screen header: large title with the selected month and previous/next controls. */
export function MonthSwitcher({ title, month, onChange, accessory }: MonthSwitcherProps) {
  const isCurrent = month >= currentMonthKey();

  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <ThemedText type="largeTitle" accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText type="headline" themeColor="textSecondary">
          {formatMonth(month)}
        </ThemedText>
      </View>
      <View style={styles.controls}>
        <IconButton
          icon={{ ios: 'chevron.left', material: 'chevron_left' }}
          label="Previous month"
          onPress={() => onChange(shiftMonth(month, -1))}
        />
        <IconButton
          icon={{ ios: 'chevron.right', material: 'chevron_right' }}
          label="Next month"
          disabled={isCurrent}
          onPress={() => onChange(shiftMonth(month, 1))}
        />
        {accessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titles: {
    flexShrink: 1,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.half,
  },
});
