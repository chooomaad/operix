import { Pressable, ScrollView } from 'react-native';
import { T } from './ui/Text';
import { useTheme } from '@/features/theme/ThemeProvider';

export function FilterChips<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} className={`min-h-[36px] justify-center rounded-full border px-4 ${active ? 'border-navy bg-navy' : 'border-border bg-surface'}`} style={{ backgroundColor: active ? theme.colors.navy : theme.colors.surface, borderColor: active ? theme.colors.navy : theme.colors.border }}>
            <T className={`font-semibold text-[12px] ${active ? 'text-white' : 'text-navy'}`}>{o.label}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
