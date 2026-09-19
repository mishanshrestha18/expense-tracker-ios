import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface SectionProps {
  title: string;
  /** Right-aligned text next to the title, e.g. a day total. */
  detail?: string;
  /** `large` is a bold sentence-case heading, as in Apple's Health and Fitness apps. */
  variant?: 'default' | 'large';
  children: React.ReactNode;
}

export function Section({ title, detail, variant = 'default', children }: SectionProps) {
  const large = variant === 'large';
  return (
    <View style={[styles.section, large && styles.sectionLarge]}>
      <View style={[styles.header, large && styles.headerLarge]}>
        <ThemedText
          type={large ? 'subtitle' : 'footnote'}
          themeColor={large ? 'text' : 'textSecondary'}
          style={large ? undefined : styles.title}
          accessibilityRole="header">
          {title}
        </ThemedText>
        {detail ? (
          <ThemedText
            type={large ? 'amount' : 'footnote'}
            themeColor="textSecondary"
            style={large ? undefined : styles.detail}>
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
  sectionLarge: {
    gap: Spacing.three - 4,
    marginTop: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.three,
  },
  headerLarge: {
    paddingHorizontal: Spacing.one,
  },
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detail: {
    fontVariant: ['tabular-nums'],
  },
});
