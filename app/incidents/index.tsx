import { router } from 'expo-router';
import { useState } from 'react';
import { FilterChips } from '@/components/FilterChips';
import { IncidentCard } from '@/components/IncidentCard';
import { ListScreen } from '@/components/ListScreen';
import { usePaginated } from '@/hooks/usePaginated';
import { statusLabel } from '@/lib/labels';
import { incidentsService } from '@/services/incidents';
import type { RecordStatus } from '@/types/api';

type Filter = 'all' | RecordStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'open', label: 'Ouverts' },
  { key: 'in_progress', label: 'En investigation' },
  { key: 'closed', label: 'Clôturés' },
];

export default function IncidentsList() {
  const [filter, setFilter] = useState<Filter>('all');
  const q = usePaginated(`incidents:${filter}`, (page) => incidentsService.list({ page, per_page: 20, status: filter === 'all' ? undefined : filter }));
  return (
    <ListScreen
      title="Incidents"
      {...q}
      onRefresh={q.refresh}
      onEndReached={q.loadMore}
      header={<FilterChips options={FILTERS} value={filter} onChange={setFilter} />}
      keyExtractor={(i) => String(i.id)}
      emptyTitle="Aucun incident"
      emptyText="Aucun incident ne correspond à ce filtre."
      renderItem={({ item }) => (
        <IncidentCard
          overline={`${item.reference} • ${statusLabel[item.status]}`}
          title={item.ai_analysis?.category ?? item.description}
          subtitle={item.location}
          severity={item.severity}
          resolved={item.status === 'closed'}
          onPress={() => router.push(`/incidents/${item.id}`)}
        />
      )}
    />
  );
}
