import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'largeTitle'
    | 'title'
    | 'subtitle'
    | 'headline'
    | 'body'
    | 'callout'
    | 'footnote'
    | 'caption'
    | 'small'
    | 'smallBold'
    | 'amount'
    | 'amountLarge'
    | 'display'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[type],
        type === 'linkPrimary' && { color: theme.tint },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 400,
  },
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 600,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
  },
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 400,
  },
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 400,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 400,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 500,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  // Money uses SF Pro Rounded with tabular figures, as in Apple's Wallet and Fitness.
  amount: {
    fontFamily: Fonts.rounded,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  amountLarge: {
    fontFamily: Fonts.rounded,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: 700,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  display: {
    fontFamily: Fonts.rounded,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: 700,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontWeight: 600,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
