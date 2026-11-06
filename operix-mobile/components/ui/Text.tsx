import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '@/features/theme/ThemeProvider';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'overline' | 'label';

const variants: Record<Variant, string> = {
  display: 'font-bold text-[26px] leading-[32px] text-navy',
  title: 'font-bold text-[20px] leading-[26px] text-navy',
  heading: 'font-semibold text-[16px] leading-[22px] text-navy',
  body: 'font-regular text-[14px] leading-[21px] text-ink',
  bodyStrong: 'font-semibold text-[14px] leading-[20px] text-ink',
  caption: 'font-regular text-[12px] leading-[17px] text-muted',
  overline: 'font-semibold text-[11px] leading-[14px] tracking-[1px] uppercase text-muted',
  label: 'font-medium text-[13px] leading-[18px] text-navy',
};

/** Une classe de COULEUR de texte (text-white, text-green-dark, text-[#AEB7C7]…), pas de taille (text-[12px]). */
const COLOR_CLASS = /(^|\s)text-(white|black|navy|ink|muted|faint|green(?:-dark|-soft)?|red(?:-soft)?|orange(?:-soft)?|blue(?:-soft)?|\[#)/;
const VARIANT_COLOR = /\stext-(navy|ink|muted|faint)\b/g;

export function T({ variant = 'body', className = '', ...rest }: TextProps & { variant?: Variant; className?: string }) {
  const { colors, scheme } = useTheme();
  // Deux couleurs sur un même texte : NativeWind ne garantit pas que la dernière gagne
  // (texte sombre sur fond navy). La couleur passée par l'écran remplace celle de la variante.
  const base = COLOR_CLASS.test(className) ? ` ${variants[variant]}`.replace(VARIANT_COLOR, '').trim() : variants[variant];
  const classColor = className.match(/(?:^|\s)text-(white|black|navy|ink|muted|faint|green(?:-dark|-soft)?|red(?:-soft)?|orange(?:-soft)?|blue(?:-soft)?)(?:\s|$)/)?.[1];
  const variantColor: Record<Variant, string> = {
    display: colors.navy,
    title: colors.navy,
    heading: colors.navy,
    body: colors.ink,
    bodyStrong: colors.ink,
    caption: colors.muted,
    overline: colors.muted,
    label: colors.navy,
  };
  const classColorMap: Record<string, string> = {
    white: '#FFFFFF',
    black: '#E4E8EE',
    navy: colors.navy,
    ink: colors.ink,
    muted: colors.muted,
    faint: colors.faint,
    green: colors.green,
    'green-dark': colors.greenDark,
    'green-soft': colors.greenSoft,
    red: colors.red,
    'red-soft': colors.redSoft,
    orange: colors.orange,
    'orange-soft': colors.orangeSoft,
    blue: colors.blue,
    'blue-soft': colors.blueSoft,
  };
  const hasArbitraryColor = /(?:^|\s)text-\[#/.test(className);
  const color = scheme === 'dark'
    ? classColor ? classColorMap[classColor] : hasArbitraryColor ? undefined : variantColor[variant]
    : undefined;
  return <RNText {...rest} style={color ? [{ color }, rest.style] : rest.style} className={`${base} ${className}`} />;
}
