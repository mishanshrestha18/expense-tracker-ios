import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon, title, message, children }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: theme.tintSoft }]}>
        <Icon name={icon} size={26} color={theme.tint} />
      </View>
      <ThemedText type="headline" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  center: {
    textAlign: 'center',
  },
});
