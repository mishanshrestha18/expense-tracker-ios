import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = ViewProps & {
  /** Remove the inner padding, e.g. for edge-to-edge list rows. */
  flush?: boolean;
};

export function Card({ style, flush = false, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.card }, !flush && styles.padded, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  padded: {
    padding: Spacing.three,
  },
});
