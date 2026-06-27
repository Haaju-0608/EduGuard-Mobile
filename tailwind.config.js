/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './index.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ── EduGuard core palette (dark mode defaults) ──
        navy:          '#0A0F2E',
        'navy-mid':    '#111736',
        'navy-card':   '#161D3F',
        blue:          '#2563EB',
        'blue-bright': '#3B82F6',
        cyan:          '#06B6D4',
        gold:          '#F59E0B',
        green:         '#10B981',
        red:           '#EF4444',
        'white-soft':  '#F1F5FF',
        // ── Semantic alphas (use inline style for rgba) ──
        'muted':       'rgba(241,245,255,0.78)',
        'border-color':'rgba(59,130,246,0.18)',
        'cyan-glow':   'rgba(6,182,212,0.18)',
      },
      fontFamily: {
        // Headings — Outfit ExtraBold
        heading:      ['Outfit_800ExtraBold'],
        'heading-bold':['Outfit_700Bold'],
        // Body — Plus Jakarta Sans
        body:         ['PlusJakartaSans_400Regular'],
        'body-semi':  ['PlusJakartaSans_600SemiBold'],
        'body-bold':  ['PlusJakartaSans_700Bold'],
      },
      borderRadius: {
        '3':  3,
        '6':  6,
        '8':  8,
        '10': 10,
        '12': 12,
        '14': 14,
        '16': 16,
        '18': 18,
        '20': 20,
        '24': 24,
        '999': 999,
      },
      spacing: {
        '1.5': 6,
        '2.5': 10,
        '3.5': 14,
        '4.5': 18,
        '13':  52,
        '15':  60,
        '18':  72,
        '22':  88,
        '26':  104,
        '34':  136,
        '38':  152,
        '52':  208,
      },
      boxShadow: {
        'blue-glow': '0 4px 20px rgba(37,99,235,0.4)',
        'cyan-glow': '0 4px 20px rgba(6,182,212,0.3)',
        'card':      '0 8px 32px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};
