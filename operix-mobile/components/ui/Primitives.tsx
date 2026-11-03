import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { initials } from '@/lib/format';
import { T } from './Text';
import { Button } from './Button';

export function SectionHeader({ title, action, onAction, right }: { title: string; action?: string; onAction?: () => void; right?: ReactNode }) {
  return (
    <View className="mb-3 mt-7 flex-row items-center justify-between">
      <T variant="heading">{title}</T>
      {right}
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <T variant="label" className="text-green">
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Avatar({ name, uri, size = 36 }: { name?: string; uri?: string | null; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View className="items-center justify-center rounded-full bg-navy" style={{ width: size, height: size }}>
      <T className="font-semibold text-white" style={{ fontSize: size * 0.38 }}>
        {initials(name) || '·'}
      </T>
    </View>
  );
}

export function ProgressBar({ value, color = colors.green, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View className="w-full overflow-hidden rounded-full bg-divider" style={{ height }}>
      <View style={{ width: `${pct}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export interface TimelineItem {
  time: string;
  title: string;
  detail?: string;
  state: 'done' | 'current' | 'upcoming';
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const dot = it.state === 'done' ? colors.green : it.state === 'current' ? colors.blue : colors.border;
        return (
          <View key={`${it.time}-${i}`} className="flex-row">
            <T variant="caption" className="w-12 pt-0.5 font-medium text-navy">
              {it.time}
            </T>
            <View className="items-center" style={{ width: 20 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 4, backgroundColor: dot, borderWidth: it.state === 'upcoming' ? 2 : 0, borderColor: colors.faint }} />
              {!last ? <View style={{ width: 1.5, flex: 1, backgroundColor: colors.border, marginVertical: 2 }} /> : null}
            </View>
            <View className="flex-1 pb-5 pl-2">
              <T variant="bodyStrong" className={it.state === 'upcoming' ? 'text-muted' : ''}>
                {it.title}
              </T>
              {it.detail ? <T variant="caption">{it.detail}</T> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View className="items-center justify-center py-16">
      <ActivityIndicator color={colors.green} />
      <T variant="caption" className="mt-3">
        {label}
      </T>
    </View>
  );
}

export function EmptyState({ icon = 'inbox', title, text }: { icon?: keyof typeof Feather.glyphMap; title: string; text?: string }) {
  return (
    <View className="items-center px-6 py-14">
      <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-green-soft">
        <Feather name={icon} size={22} color={colors.green} />
      </View>
      <T variant="heading" className="text-center">
        {title}
      </T>
      {text ? (
        <T variant="caption" className="mt-1 text-center">
          {text}
        </T>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="items-center px-6 py-12">
      <Feather name="wifi-off" size={22} color={colors.muted} />
      <T variant="body" className="mt-3 text-center text-muted">
        {message}
      </T>
      {onRetry ? <Button kind="secondary" label="Réessayer" onPress={onRetry} className="mt-4 min-h-[44px]" /> : null}
    </View>
  );
}

export function Divider() {
  return <View className="my-3 h-px bg-divider" />;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2">
      <T variant="caption">{label}</T>
      <T variant="label" className="ml-4 flex-1 text-right" numberOfLines={2}>
        {value}
      </T>
    </View>
  );
}
