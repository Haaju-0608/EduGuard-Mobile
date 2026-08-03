import React from 'react';
import { Text, TextProps } from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';

type TextVariant =
  | 'h1'       // Outfit ExtraBold 28px
  | 'h2'       // Outfit ExtraBold 22px
  | 'h3'       // Outfit Bold 18px
  | 'label'    // Jakarta SemiBold 12px uppercase muted
  | 'body'     // Jakarta Regular 15px
  | 'body-sm'  // Jakarta Regular 13px
  | 'semi'     // Jakarta SemiBold 14px
  | 'caption'; // Jakarta Regular 11px muted

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  children: React.ReactNode;
}

const variantStyles: Record<TextVariant, object> = {
  'h1':      { fontFamily: FONTS.heading,    fontSize: 28, lineHeight: 34, color: COLORS.whiteSoft, letterSpacing: -0.5 },
  'h2':      { fontFamily: FONTS.heading,    fontSize: 22, lineHeight: 28, color: COLORS.whiteSoft, letterSpacing: -0.3 },
  'h3':      { fontFamily: FONTS.headingBold,fontSize: 18, lineHeight: 24, color: COLORS.whiteSoft },
  'label':   { fontFamily: FONTS.bodySemi,   fontSize: 11, lineHeight: 16, color: COLORS.muted,     letterSpacing: 0.5, textTransform: 'uppercase' },
  'body':    { fontFamily: FONTS.body,       fontSize: 15, lineHeight: 22, color: COLORS.whiteSoft },
  'body-sm': { fontFamily: FONTS.body,       fontSize: 13, lineHeight: 19, color: COLORS.whiteSoft },
  'semi':    { fontFamily: FONTS.bodySemi,   fontSize: 14, lineHeight: 20, color: COLORS.whiteSoft },
  'caption': { fontFamily: FONTS.body,       fontSize: 11, lineHeight: 16, color: COLORS.muted },
};

export function AppText({ variant = 'body', color, style, children, ...props }: AppTextProps) {
  return (
    <Text
      style={[variantStyles[variant], color ? { color } : undefined, style]}
      {...props}
    >
      {children}
    </Text>
  );
}
