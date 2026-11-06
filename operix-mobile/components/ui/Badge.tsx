import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { severityLabel, severityTone } from '@/lib/labels';
import type { Severity } from '@/types/api';
import { T } from './Text';
import { useTheme } from '@/features/theme/ThemeProvider';

type Tone = 'green' | 'red' | 'orange' | 'blue' | 'neutral' | 'navy';

const tones: Record<Tone, { box: string; text: string; dot: string }> = {
  green: { box: 'bg-green-soft', text: 'text-green-dark', dot: 'bg-green' },
  red: { box: 'bg-red-soft', text: 'text-red', dot: 'bg-red' },
  orange: { box: 'bg-orange-soft', text: 'text-orange', dot: 'bg-orange' },
  blue: { box: 'bg-blue-soft', text: 'text-blue', dot: 'bg-blue' },
  neutral: { box: 'bg-divider', text: 'text-muted', dot: 'bg-faint' },
  navy: { box: 'bg-navy', text: 'text-white', dot: 'bg-green' },
};

export function StatusBadge({ label, tone = 'neutral', dot = false }: { label: string; tone?: Tone; dot?: boolean }) {
  const theme = useTheme();
  const t = tones[tone];
  const background = {
    green: theme.colors.greenSoft,
    red: theme.colors.redSoft,
    orange: theme.colors.orangeSoft,
    blue: theme.colors.blueSoft,
    neutral: theme.colors.divider,
    navy: theme.scheme === 'dark' ? theme.colors.navySoft : colors.navy,
  }[tone];
  return (
    <View className={`flex-row items-center self-start rounded-full px-2.5 py-1 ${t.box}`} style={{ backgroundColor: background }}>
      {dot ? <View className={`mr-1.5 h-1.5 w-1.5 rounded-full ${t.dot}`} /> : null}
      <T className={`font-semibold text-[11px] leading-[14px] tracking-[0.4px] uppercase ${t.text}`}>{label}</T>
    </View>
  );
}

export function SeverityBadge({ severity, prefix = '' }: { severity: Severity; prefix?: string }) {
  const tone = severityTone[severity];
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: tone.bg }}>
      <T className="font-semibold text-[11px] leading-[14px] tracking-[0.4px] uppercase" style={{ color: tone.fg }}>
        {prefix}
        {severityLabel[severity]}
      </T>
    </View>
  );
}
