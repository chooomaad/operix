import { Feather } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useTheme } from '@/features/theme/ThemeProvider';
import { formatDelay } from '@/lib/format';
import { actionStatusLabel, priorityLabel, priorityTone } from '@/lib/labels';
import type { ActionPriority, ActionStatus } from '@/types/api';
import { StatusBadge } from './ui/Badge';
import { T } from './ui/Text';

interface Props {
  index: number;
  priority: ActionPriority;
  delayMinutes: number | null;
  responsible: string | null;
  description: string;
  status?: ActionStatus;
  overdue?: boolean;
  onToggle?: () => void;
}

export const ActionCard = memo(function ActionCard({ index, priority, delayMinutes, responsible, description, status, overdue, onToggle }: Props) {
  const theme = useTheme();
  const tone = priorityTone[priority];
  const done = status === 'done';
  return (
    <View className="mb-2.5 flex-row rounded-2xl border border-border bg-surface p-3.5" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
      <View className="mr-3 w-1 rounded-full" style={{ backgroundColor: tone }} />
      <View className="flex-1">
        <View className="flex-row items-center">
          <T className="font-semibold text-[11px] uppercase tracking-[0.5px]" style={{ color: tone }}>
            {priorityLabel[priority]} • {formatDelay(delayMinutes)}
          </T>
          {overdue && !done ? (
            <T className="ml-2 font-semibold text-[11px] text-red">EN RETARD</T>
          ) : null}
        </View>
        <T variant="bodyStrong" className={`mt-1 ${done ? 'text-muted line-through' : ''}`}>
          {index}. {description}
        </T>
        {responsible ? (
          <View className="mt-1.5 flex-row items-center">
            <Feather name="user" size={12} color={theme.colors.muted} />
            <T variant="caption" className="ml-1">
              {responsible}
            </T>
          </View>
        ) : null}
      </View>
      {status ? (
        <Pressable onPress={onToggle} disabled={!onToggle} hitSlop={8} className="ml-2 self-start">
          <StatusBadge label={actionStatusLabel[status]} tone={done ? 'green' : status === 'in_progress' ? 'blue' : 'neutral'} />
        </Pressable>
      ) : null}
    </View>
  );
});
