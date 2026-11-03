/**
 * Design tokens OPERIX — source unique, partagée par tailwind.config.js.
 * Chaque couleur porte un sens : vert = sécurité / action principale,
 * rouge = risque élevé ou critique uniquement, orange = vigilance,
 * bleu = information / intelligence.
 */
export const colors = {
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  border: '#E6E9F0',
  divider: '#EEF0F5',
  navy: '#0F1B2D',
  navySoft: '#1E2A3D',
  ink: '#1A2333',
  muted: '#667085',
  faint: '#98A2B3',
  green: '#0B8A5E',
  greenDark: '#086B49',
  greenSoft: '#E6F4EE',
  red: '#D3303D',
  redSoft: '#FCEBEC',
  orange: '#D9730D',
  orangeSoft: '#FDF1E3',
  blue: '#2459D6',
  blueSoft: '#EBF1FD',
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;

export const shadow = {
  shadowColor: '#0F1B2D',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
} as const;
