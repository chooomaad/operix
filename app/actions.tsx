import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { ActionCard } from '@/components/ActionCard';
import { FilterChips } from '@/components/FilterChips';
import { ListScreen } from '@/components/ListScreen';
import { T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { errorMessage } from '@/services/api';
import { actionsService } from '@/services/actions';
import type { ActionStatus } from '@/types/api';

type Filter = 'all' | ActionStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'todo', label: 'À faire' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'done', label: 'Faites' },
];
const NEXT: Record<ActionStatus, ActionStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

export default function ActionsScreen() {
  const { can } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery(`actions:${filter}`, () => actionsService.all(filter === 'all' ? undefined : filter));

  const toggle = async (incidentId: number, id: number, s: ActionStatus) => {
    try {
      await actionsService.setStatus(incidentId, id, NEXT[s]);
      await q.refresh();
    } catch (e) {
      Alert.alert('Mise à jour impossible', errorMessage(e));
    }
  };

  return (
    <ListScreen
      title="Actions correctives"
      items={q.data ?? []}
      loading={q.loading}
      refreshing={q.refreshing}
      error={q.error}
      onRefresh={q.refresh}
      header={<FilterChips options={FILTERS} value={filter} onChange={setFilter} />}
      keyExtractor={(a) => String(a.id)}
      emptyTitle="Aucune action"
      emptyText="Les plans validés depuis une déclaration apparaissent ici."
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/incidents/${item.incident_id}`)}>
          {item.incident ? (
            <T variant="caption" className="mb-1 ml-1">
              {item.incident.reference} • {item.incident.location}
            </T>
          ) : null}
          <ActionCard
            index={item.position + 1}
            priority={item.priority}
            delayMinutes={item.delay_minutes}
            responsible={item.responsible_role}
            description={item.description}
            status={item.status}
            overdue={item.is_overdue}
            onToggle={can('incidents.update') ? () => void toggle(item.incident_id, item.id, item.status) : undefined}
          />
        </Pressable>
      )}
    />
  );
}
