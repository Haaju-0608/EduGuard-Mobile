// EduGuard design tokens — mirrors the web CSS variables
export const COLORS = {
  navy:         '#0A0F2E',
  navyMid:      '#111736',
  navyCard:     '#161D3F',
  blue:         '#2563EB',
  blueBright:   '#3B82F6',
  cyan:         '#06B6D4',
  gold:         '#F59E0B',
  green:        '#10B981',
  red:          '#EF4444',
  whiteSoft:    '#F1F5FF',
  muted:        'rgba(241,245,255,0.78)',
  border:       'rgba(59,130,246,0.18)',
  cyanGlow:     'rgba(6,182,212,0.18)',
  blueGlow:     'rgba(37,99,235,0.12)',
};

export const GRADIENTS = {
  primary:  ['#2563EB', '#06B6D4'] as const,
  success:  ['#10B981', '#06B6D4'] as const,
  heading:  ['#3B82F6', '#06B6D4'] as const,
};

export const FONTS = {
  heading:    'Outfit_800ExtraBold',
  headingBold:'Outfit_700Bold',
  body:       'PlusJakartaSans_400Regular',
  bodySemi:   'PlusJakartaSans_600SemiBold',
  bodyBold:   'PlusJakartaSans_700Bold',
};

export const RADIUS = {
  xs:  6,
  sm:  8,
  md:  12,
  lg:  14,
  xl:  18,
  '2xl': 20,
  '3xl': 24,
  full: 999,
};
