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
    danger: '#D92D20',
    /** Quiet red wash behind an alert, so the red text still reads. */
    dangerFill: '#FEE4E2',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#98989F',
    textTertiary: '#636366',
    background: '#000000',
    card: '#1C1C1E',
    backgroundElement: '#2C2C2E',
    backgroundSelected: '#3A3A3C',
    separator: '#38383A',
    tint: '#34D399',
    tintSoft: '#0B3B2C',
    onTint: '#04241A',
    warning: '#FFB340',
    warningFill: '#FFB340',
    danger: '#FF6961',
    dangerFill: '#3A1512',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = { [K in ThemeColor]: string };

/**
 * Gradient hero cards, shared by light and dark mode. Every stop keeps white
 * text above 4.5:1 contrast.
 */
export const HeroGradients = {
  good: ['#064E3B', '#047857'],
  warning: ['#78350F', '#B45309'],
  danger: ['#7F1D1D', '#B91C1C'],
} as const;

export type HeroTone = keyof typeof HeroGradients;

/** Foreground colours for content placed on a hero gradient. */
export const OnHero = {
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.78)',
  track: 'rgba(255, 255, 255, 0.22)',
  surface: 'rgba(255, 255, 255, 0.16)',
  divider: 'rgba(255, 255, 255, 0.2)',
} as const;

export function heroGradient(tone: HeroTone): string {
  const [from, to] = HeroGradients[tone];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

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
  control: 12,
  card: 18,
  pill: 999,
} as const;

/** Space the floating tab bar covers at the bottom of each tab screen. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
/** Space the web tab bar covers at the top of each tab screen. */
export const TopTabInset = Platform.select({ web: 88 }) ?? 0;
export const MaxContentWidth = 720;
