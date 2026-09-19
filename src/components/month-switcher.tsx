import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { formatMonth, type MonthKey, shiftMonth } from '@/domain/dates';

interface MonthSwitcherProps {
  title: string;
  month: MonthKey;
  /** Dates of the period, shown when periods are not calendar months. */
  subtitle?: string;
  /** Disables "next" on the period we are living in. */
  isCurrent: boolean;
  /** What a period is called here: "month" by default, "period" after payday. */
  noun?: string;
  onChange: (month: MonthKey) => void;
  /** Extra controls on the right, e.g. an add button. */
  accessory?: React.ReactNode;
}

/** Screen header: large title with the selected period and previous/next controls. */
export function MonthSwitcher({
  title,
  month,
  subtitle,
  isCurrent,
  noun = 'month',
  onChange,
  accessory,
}: MonthSwitcherProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <ThemedText type="largeTitle" accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText type="headline" themeColor="textSecondary">
          {formatMonth(month)}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="footnote" themeColor="textTertiary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.controls}>
        <IconButton
          icon={{ ios: 'chevron.left', material: 'chevron_left' }}
          label={`Previous ${noun}`}
          onPress={() => onChange(shiftMonth(month, -1))}
        />
        <IconButton
          icon={{ ios: 'chevron.right', material: 'chevron_right' }}
          label={`Next ${noun}`}
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
