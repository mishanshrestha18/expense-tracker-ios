import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { DisplayFont, Fonts, ThemeColor } from '@/constants/theme';
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
    fontFamily: DisplayFont.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: DisplayFont.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: DisplayFont.bold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.3,
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
    fontFamily: DisplayFont.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  // Money is always the display face with tabular figures, so columns line up
  // and the number is the loudest thing on the screen.
  amount: {
    fontFamily: DisplayFont.bold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  amountLarge: {
    fontFamily: DisplayFont.bold,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  display: {
    fontFamily: DisplayFont.bold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1,
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
