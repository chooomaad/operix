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
  const [error, setError] = useState<unknown>(null);

  // L'endpoint agent exige au moins 2 caractères et est limité à 30 req/min : on temporise.
  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setItems(await employeesService.search(q.trim(), full));
        setError(null);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q, full]);

  return (
    <ListScreen
      title="Employés"
      items={items}
      loading={loading}
      refreshing={false}
      error={error}
      onRefresh={() => setQ((v) => `${v}`)}
      header={<Input icon="search" placeholder="Matricule ou nom (2 caractères min.)" value={q} onChangeText={setQ} autoCorrect={false} />}
      keyExtractor={(e) => String(e.id)}
      emptyTitle={q.trim().length < 2 ? 'Rechercher un employé' : 'Aucun résultat'}
      emptyText="Recherche limitée au matricule, au nom et au statut."
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
