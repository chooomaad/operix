// Les tokens sont dupliqués depuis constants/theme.ts (Tailwind se charge en CommonJS).
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // L'app est en thème clair forcé (app.json) : sur le web, NativeWind exige le mode 'class'.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#F7F8FC',
        surface: '#FFFFFF',
        border: '#E6E9F0',
        divider: '#EEF0F5',
        navy: { DEFAULT: '#0F1B2D', soft: '#1E2A3D' },
        ink: '#1A2333',
        muted: '#667085',
        faint: '#98A2B3',
        green: { DEFAULT: '#0B8A5E', dark: '#086B49', soft: '#E6F4EE' },
        red: { DEFAULT: '#D3303D', soft: '#FCEBEC' },
        orange: { DEFAULT: '#D9730D', soft: '#FDF1E3' },
        blue: { DEFAULT: '#2459D6', soft: '#EBF1FD' },
      },
      fontFamily: {
        regular: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};
