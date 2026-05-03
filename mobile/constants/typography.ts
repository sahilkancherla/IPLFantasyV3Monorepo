import { TextStyle } from 'react-native'

// Font family identifiers — must match the keys passed to useFonts() in _layout.tsx
export const FONT = {
  sans400: 'Inter_400Regular',
  sans500: 'Inter_500Medium',
  sans600: 'Inter_600SemiBold',
  sans700: 'Inter_700Bold',
  sans800: 'Inter_800ExtraBold',
  mono500: 'JetBrainsMono_500Medium',
  mono700: 'JetBrainsMono_700Bold',
} as const

// Reusable text style presets
export const type = {
  // Tiny uppercase tracked label — "WEEK 4 · MATCHUP", "MY SQUAD"
  eyebrow: {
    fontFamily: FONT.sans700,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase' as const,
  } satisfies TextStyle,

  // Card title
  sectionTitle: {
    fontFamily: FONT.sans700,
    fontSize: 16,
    letterSpacing: -0.2,
  } satisfies TextStyle,

  // Body text
  body: {
    fontFamily: FONT.sans500,
    fontSize: 14,
    letterSpacing: -0.1,
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: FONT.sans600,
    fontSize: 14,
    letterSpacing: -0.1,
  } satisfies TextStyle,
  bodySm: {
    fontFamily: FONT.sans500,
    fontSize: 13,
    letterSpacing: -0.1,
  } satisfies TextStyle,

  // Names, team labels
  teamName: {
    fontFamily: FONT.sans700,
    fontSize: 16,
    letterSpacing: -0.3,
  } satisfies TextStyle,
  teamNameSm: {
    fontFamily: FONT.sans600,
    fontSize: 14,
    letterSpacing: -0.2,
  } satisfies TextStyle,

  // Caption / meta
  caption: {
    fontFamily: FONT.sans500,
    fontSize: 12,
    letterSpacing: 0,
  } satisfies TextStyle,

  // Display / scoreboard numbers (mono, tabular)
  statXL: {
    fontFamily: FONT.mono700,
    fontSize: 44,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
  statL: {
    fontFamily: FONT.mono700,
    fontSize: 36,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
  statM: {
    fontFamily: FONT.mono700,
    fontSize: 28,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
  statSm: {
    fontFamily: FONT.mono500,
    fontSize: 13,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
}
