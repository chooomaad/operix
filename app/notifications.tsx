import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { ListScreen } from '@/components/ListScreen';
import { Card, T } from '@/components/ui';
import { usePaginated } from '@/hooks/usePaginated';
import { invalidate } from '@/hooks/useQuery';
import { timeAgo } from '@/lib/format';
import { notificationsService } from '@/services/notifications';
import type { AppNotification } from '@/types/api';

export default function NotificationsScreen() {
  const q = usePaginated('notifications', (page) => notificationsService.list(page));

  const open = async (n: AppNotification) => {
    if (!n.read_at) {
      await notificationsService.markRead(n.id).catch(() => undefined);
      invalidate('notifications:unread');
    }
    if (n.data.resource_kind === 'incident' && n.data.resource_id) router.push(`/incidents/${n.data.resource_id}`);
    else void q.refresh();
  };

  const readAll = async () => {
    await notificationsService.markAllRead().catch(() => undefined);
    invalidate('notifications:unread');
    void q.refresh();
  };

  return (
    <ListScreen
      title="Notifications"
      {...q}
      onRefresh={q.refresh}
      onEndReached={q.loadMore}
      header={
        q.items.some((n) => !n.read_at) ? (
          <Pressable onPress={readAll} className="items-end py-1" hitSlop={8}>
            <T variant="label" className="text-green">
              Tout marquer comme lu
            </T>
          </Pressable>
        ) : null
      }
      keyExtractor={(n) => n.id}
      emptyTitle="Aucune notification"
      emptyText="Les alertes HSSE du site s'afficheront ici."
      renderItem={({ item }) => {
        const critical = item.data.severity === 'high' || item.data.severity === 'critical';
        return (
          <Card className="mb-2.5 flex-row" onPress={() => void open(item)}>
            <View className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${critical ? 'bg-red-soft' : 'bg-blue-soft'}`}>
              <Feather name={critical ? 'alert-octagon' : 'bell'} size={16} color={critical ? colors.red : colors.blue} />
            </View>
            <View className="flex-1">
              <T variant="bodyStrong">{item.data.title ?? 'Notification'}</T>
              {item.data.body ? (
                <T variant="caption" numberOfLines={2}>
                  {item.data.body}
                </T>
              ) : null}
              <T variant="caption" className="mt-1 text-faint">
                {timeAgo(item.created_at)}
              </T>
            </View>
            {!item.read_at ? <View className="ml-2 mt-1 h-2 w-2 rounded-full bg-green" /> : null}
          </Card>
        );
      }}
    />
  );
}
