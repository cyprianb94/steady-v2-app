import { Platform } from 'react-native';

// Font family names — must match the names registered via expo-font
export const FONTS = {
  serif: Platform.select({ ios: 'PlayfairDisplay', default: 'PlayfairDisplay' }),
  serifBold: Platform.select({ ios: 'PlayfairDisplay-Bold', default: 'PlayfairDisplay-Bold' }),
  mono: Platform.select({ ios: 'SpaceMono', default: 'SpaceMono' }),
  monoBold: Platform.select({ ios: 'SpaceMono-Bold', default: 'SpaceMono-Bold' }),
  sans: Platform.select({ ios: 'DMSans', default: 'DMSans' }),
  sansMedium: Platform.select({ ios: 'DMSans-Medium', default: 'DMSans-Medium' }),
  sansSemiBold: Platform.select({ ios: 'DMSans-SemiBold', default: 'DMSans-SemiBold' }),
} as const;

// Type scale presets
export const TYPE_SCALE = {
  screenTitle: { fontFamily: FONTS.serifBold, fontSize: 24 },
  sectionHeader: { fontFamily: FONTS.serifBold, fontSize: 19 },
  sessionName: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  dataValue: { fontFamily: FONTS.monoBold, fontSize: 15 },
  dataValueLarge: { fontFamily: FONTS.monoBold, fontSize: 18 },
  label: { fontFamily: FONTS.sansSemiBold, fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase' as const },
  body: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 20 },
  meta: { fontFamily: FONTS.sans, fontSize: 11 },
} as const;
