import { useState } from 'react';
import { FilterChips } from '@/components/FilterChips';
import { IncidentCard } from '@/components/IncidentCard';
import { ListScreen } from '@/components/ListScreen';
import { usePaginated } from '@/hooks/usePaginated';
import { statusLabel } from '@/lib/labels';
import { nearMissService } from '@/services/incidents';
import type { RecordStatus } from '@/types/api';

type Filter = 'all' | RecordStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'open', label: 'Ouverts' },
  { key: 'closed', label: 'Clôturés' },
];

export default function NearMissList() {
  const [filter, setFilter] = useState<Filter>('all');
  const q = usePaginated(`near-miss:${filter}`, (page) => nearMissService.list({ page, per_page: 20, status: filter === 'all' ? undefined : filter }));
  return (
    <ListScreen
      title="Near-Miss"
      {...q}
      onRefresh={q.refresh}
      onEndReached={q.loadMore}
      header={<FilterChips options={FILTERS} value={filter} onChange={setFilter} />}
      keyExtractor={(i) => String(i.id)}
      emptyTitle="Aucun near-miss"
      emptyText="Signalez les situations dangereuses : elles nourrissent la prévention."
      renderItem={({ item }) => (
        <IncidentCard
          overline={`${item.reference} • ${statusLabel[item.status]}`}
          title={item.description}
          subtitle={item.location}
          severity={item.severity}
          resolved={item.status === 'closed'}
          icon="eye"
        />
      )}
    />
  );
}
