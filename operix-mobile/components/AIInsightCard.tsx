import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useTheme } from '@/features/theme/ThemeProvider';
import { T } from './ui/Text';

interface Props {
  eyebrow: string;
  title: string;
  text: string;
  tone?: 'blue' | 'orange' | 'green';
  link?: string;
  onLink?: () => void;
  children?: ReactNode;
}

const toneMap = {
  blue: { bg: 'bg-blue-soft', fg: colors.blue, cls: 'text-blue' },
  orange: { bg: 'bg-orange-soft', fg: colors.orange, cls: 'text-orange' },
  green: { bg: 'bg-green-soft', fg: colors.green, cls: 'text-green-dark' },
};

/** Carte « intelligence » : bleu = analyse / donnée, jamais un chatbot. */
export function AIInsightCard({ eyebrow, title, text, tone = 'blue', link, onLink, children }: Props) {
  const theme = useTheme();
  const t = toneMap[tone];
  return (
    <View className="mb-3 rounded-2xl border border-border bg-surface p-4" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
      <View className="flex-row items-center">
        <View className={`mr-2 h-7 w-7 items-center justify-center rounded-lg ${t.bg}`}>
          <Feather name="cpu" size={14} color={t.fg} />
        </View>
        <T className={`font-semibold text-[11px] uppercase tracking-[0.8px] ${t.cls}`}>{eyebrow}</T>
      </View>
      <T variant="heading" className="mt-3">
        {title}
      </T>
      <T variant="body" className="mt-1 text-muted">
        {text}
      </T>
      {children}
      {link ? (
        <Pressable onPress={onLink} className="mt-3 flex-row items-center" hitSlop={8}>
          <T variant="label" className="text-green">
            {link}
          </T>
          <Feather name="arrow-right" size={14} color={colors.green} style={{ marginLeft: 4 }} />
        </Pressable>
      ) : null}
    </View>
  );
}
