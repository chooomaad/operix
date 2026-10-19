import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { shadow } from '@/constants/theme';
import { T } from './Text';

export function Card({ children, className = '', onPress }: { children: ReactNode; className?: string; onPress?: () => void }) {
  const cls = `rounded-2xl border border-border bg-surface p-4 ${className}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={cls} style={({ pressed }) => [shadow, pressed && { opacity: 0.9 }]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={cls} style={shadow}>
      {children}
    </View>
  );
}

export function StatCard({ label, value, tone = 'text-navy', onPress }: { label: string; value: number | string; tone?: string; onPress?: () => void }) {
  return (
    <Card className="flex-1 px-3 py-3.5" onPress={onPress}>
      <T variant="caption">{label}</T>
      <T variant="title" className={`mt-1 text-[24px] ${tone}`}>
        {value}
      </T>
    </Card>
  );
}
