/**
 * Design tokens for light and dark mode. Values follow iOS conventions
 * (grouped backgrounds, card surfaces) with an emerald brand tint.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#6E6E73',
    textTertiary: '#A1A1A6',
    background: '#F2F2F7',
    card: '#FFFFFF',
    backgroundElement: '#E9E9EE',
    backgroundSelected: '#DCDCE1',
    separator: '#E3E3E8',
    tint: '#047857',
    tintSoft: '#D1FAE5',
    onTint: '#FFFFFF',
    /** Warning text; dark enough to read on white. */
    warning: '#B54708',
    /** Warning fills such as progress bars, where brightness matters more than text contrast. */
    warningFill: '#F79009',
    /** Quiet amber wash behind a warning. */
    warningSoft: '#FDF0E3',
    danger: '#D92D20',
    /** Quiet red wash behind an alert, so the red text still reads. */
    dangerFill: '#FEE4E2',
  },
  dark: {
    text: '#F4F6F5',
    textSecondary: '#9AA8A1',
    textTertiary: '#6C7C75',
    /** A green-black, so the emerald reads as the same family rather than a sticker. */
    background: '#0A0D0B',
    card: '#131A16',
    backgroundElement: '#1B241E',
    backgroundSelected: '#22302A',
    separator: '#22302A',
    tint: '#34D399',
    tintSoft: '#14312A',
    onTint: '#04241A',
    warning: '#FBBF24',
    warningFill: '#F59E0B',
    warningSoft: '#2E2108',
    danger: '#FCA5A5',
    dangerFill: '#2B1412',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = { [K in ThemeColor]: string };

/**
 * Space Grotesk carries the headings and every amount: geometric, a little
 * mechanical, and unmistakable next to the system face the body text uses.
 */
export const DisplayFont = {
  bold: 'SpaceGrotesk_700Bold',
  medium: 'SpaceGrotesk_500Medium',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  control: 14,
  card: 22,
  pill: 999,
} as const;

/** Space the floating tab bar covers at the bottom of each tab screen. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
/** Space the web tab bar covers at the top of each tab screen. */
export const TopTabInset = Platform.select({ web: 88 }) ?? 0;
export const MaxContentWidth = 720;
