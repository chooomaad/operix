import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ListScreen } from '@/components/ListScreen';
import { Avatar, Card, Input, StatusBadge, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { employeesService } from '@/services/employees';
import type { EmployeeLite } from '@/types/api';

export default function EmployeesScreen() {
  const { can } = useAuth();
  const full = can('employees.view');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<unknown>(null);

  // Les agents recherchent uniquement; l'encadrement autorisé peut parcourir la liste.
  useEffect(() => {
    const query = q.trim();
    if (!full && query.length < 2) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        if (full) {
          const result = await employeesService.list(query, 1);
          if (!active) return;
          setItems(result.items);
          setPage(result.page);
          setLastPage(result.lastPage);
        } else {
          const result = await employeesService.search(query);
          if (!active) return;
          setItems(result);
          setPage(1);
          setLastPage(1);
        }
      } catch (e) {
        if (active) setError(e);
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, full, reload]);

  const loadMore = async () => {
    if (!full || loading || loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    try {
      const result = await employeesService.list(q.trim(), page + 1);
      setItems((current) => [...current, ...result.items]);
      setPage(result.page);
      setLastPage(result.lastPage);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    setReload((current) => current + 1);
  };

  return (
    <ListScreen
      title="Employés"
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      onEndReached={full ? () => void loadMore() : undefined}
      header={<Input icon="search" placeholder={full ? 'Filtrer par matricule ou nom' : 'Matricule ou nom (2 caractères min.)'} value={q} onChangeText={setQ} autoCorrect={false} />}
      keyExtractor={(e) => String(e.id)}
      emptyTitle={!full && q.trim().length < 2 ? 'Rechercher un employé' : 'Aucun résultat'}
      emptyText={!full && q.trim().length < 2 ? 'Saisissez au moins 2 caractères du nom ou du matricule.' : loadingMore ? 'Chargement des employés…' : undefined}
      renderItem={({ item }) => (
        <Card className="mb-2 flex-row items-center p-3">
          <Avatar name={item.name} size={34} />
          <View className="ml-3 flex-1">
            <T variant="bodyStrong">{item.name}</T>
            <T variant="caption">{item.matricule ?? '—'}</T>
          </View>
          <StatusBadge label={item.status === 'active' ? 'Actif' : 'Inactif'} tone={item.status === 'active' ? 'green' : 'neutral'} />
        </Card>
      )}
    />
  );
}
