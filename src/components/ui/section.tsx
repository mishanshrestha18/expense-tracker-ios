import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface SectionProps {
  title: string;
  /** Right-aligned text next to the title, e.g. a day total. */
  detail?: string;
  children: React.ReactNode;
}

export function Section({ title, detail, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText
          type="footnote"
          themeColor="textSecondary"
          style={styles.title}
          accessibilityRole="header">
          {title}
        </ThemedText>
        {detail ? (
          <ThemedText type="footnote" themeColor="textSecondary">
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
