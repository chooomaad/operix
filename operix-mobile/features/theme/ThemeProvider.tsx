import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { colors as lightColors } from '@/constants/theme';

export type ThemeScheme = 'light' | 'dark';
type ThemeColors = Record<keyof typeof lightColors, string>;

const darkColors: ThemeColors = {
  ...lightColors,
  bg: '#252B34',
  surface: '#303741',
  border: '#4A5360',
  divider: '#414A56',
  navy: '#E4E8EE',
  navySoft: '#3B444F',
  ink: '#E0E4EA',
  muted: '#A7B0BD',
  faint: '#8993A2',
  greenDark: '#66C49A',
  greenSoft: '#30463C',
  redSoft: '#49383B',
  orangeSoft: '#4A4233',
  blueSoft: '#333F52',
  green: '#55B78E',
  red: '#F0767E',
  orange: '#F2A64F',
  blue: '#88A7F2',
};

interface ThemeContextValue {
  scheme: ThemeScheme;
  colors: ThemeColors;
  setScheme: (scheme: ThemeScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'operix-mobile-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ThemeScheme>('light');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && (saved === 'light' || saved === 'dark')) setSchemeState(saved);
      })
      .catch((error: unknown) => console.error('Impossible de charger le thème enregistré.', error));
    return () => {
      active = false;
    };
  }, []);

  const setScheme = useCallback((next: ThemeScheme) => {
    setSchemeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch((error: unknown) => {
      console.error('Impossible d’enregistrer le thème.', error);
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    setScheme,
  }), [scheme, setScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme doit être utilisé dans ThemeProvider.');
  return context;
}
