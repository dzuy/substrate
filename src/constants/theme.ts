/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#261820',
    textMuted: '#776C72',
    background: '#F8F3EF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F1E3E8',
    border: '#E9DDE0',
    accent: '#9C2D68',
    accentDeep: '#682246',
    accentSoft: '#E8B8CD',
    blush: '#F6E7E7',
    plumSoft: '#EFE4EF',
    warningSoft: '#FFF3E7',
    successSoft: '#EAF3EA',
    textSecondary: '#776C72',
  },
  dark: {
    text: '#F8F3EF',
    textMuted: '#C5B7BE',
    background: '#1A1217',
    backgroundElement: '#261820',
    backgroundSelected: '#3A2430',
    border: '#4A303C',
    accent: '#E58AB7',
    accentDeep: '#F0B0CE',
    accentSoft: '#63324A',
    blush: '#322126',
    plumSoft: '#302032',
    warningSoft: '#3A2A20',
    successSoft: '#243426',
    textSecondary: '#C5B7BE',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
