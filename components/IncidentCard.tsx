import { Feather } from '@expo/vector-icons';
import { memo } from 'react';
import { View } from 'react-native';
import { colors } from '@/constants/theme';
import { timeAgo } from '@/lib/format';
import type { Severity } from '@/types/api';
import { Card } from './ui/Card';
import { SeverityBadge, StatusBadge } from './ui/Badge';
import { T } from './ui/Text';

interface Props {
  overline: string;
  title: string;
  subtitle?: string;
  severity?: Severity | null;
  resolved?: boolean;
  createdAt?: string | null;
  icon?: keyof typeof Feather.glyphMap;
  onPress?: () => void;
}

export const IncidentCard = memo(function IncidentCard({ overline, title, subtitle, severity, resolved, createdAt, icon = 'alert-triangle', onPress }: Props) {
  const iconColor = resolved ? colors.green : severity === 'high' || severity === 'critical' ? colors.red : severity === 'medium' ? colors.orange : colors.muted;
  return (
    <Card className="mb-2.5 flex-row items-center" onPress={onPress}>
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-bg">
        <Feather name={resolved ? 'check-circle' : icon} size={18} color={iconColor} />
      </View>
      <View className="flex-1">
        <T variant="overline" className="text-[10px]">
          {overline}
          {createdAt ? ` • ${timeAgo(createdAt)}` : ''}
        </T>
        <T variant="bodyStrong" numberOfLines={1} className="mt-0.5">
          {title}
        </T>
        {subtitle ? (
          <T variant="caption" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      <View className="ml-2">{resolved ? <StatusBadge label="Résolu" tone="green" /> : severity ? <SeverityBadge severity={severity} /> : null}</View>
    </Card>
  );
});
