import { Feather } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card, SectionHeader, T, TopBar } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useQuery } from '@/hooks/useQuery';
import { useUnreadCount } from '@/hooks/useUnread';
import { dashboardService } from '@/services/dashboard';
import { useTheme } from '@/features/theme/ThemeProvider';

interface Entry {
  href: Href;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text: string;
  count?: number;
  ability: string;
}

export default function SecurityHub() {
  const theme = useTheme();
  const { can } = useAuth();
  const unread = useUnreadCount();
  const s = useQuery('dashboard:summary', dashboardService.summary).data?.safety;

  const entries: Entry[] = [
    { href: '/incidents', icon: 'alert-triangle', title: 'Incidents', text: 'Registre et investigations', count: s?.incidents_ouverts, ability: 'incidents.view' },
    { href: '/near-miss', icon: 'eye', title: 'Near-Miss', text: 'Presqu’accidents signalés', count: s?.near_miss_ouverts, ability: 'near_miss.view' },
    { href: '/actions', icon: 'check-square', title: 'Actions correctives', text: 'Plans déployés et échéances', ability: 'incidents.view' },
    { href: '/employees', icon: 'users', title: 'Employés', text: 'Recherche du personnel', ability: can('employees.view') ? 'employees.view' : 'employees.agent_search' },
  ];

  return (
    <Screen header={<TopBar title="Sécurité" unread={unread} />} tabBarSpace>
      <T variant="display" className="mt-2">
        Sécurité terrain
      </T>
      <T variant="body" className="mt-1 text-muted">
        Registres et plans d'actions du site.
      </T>

      <SectionHeader title="Modules" />
      {entries
        .filter((e) => can(e.ability))
        .map((e) => (
          <Card key={e.title} className="mb-2.5 flex-row items-center" onPress={() => router.push(e.href)}>
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-bg" style={{ backgroundColor: theme.colors.bg }}>
              <Feather name={e.icon} size={18} color={theme.colors.navy} />
            </View>
            <View className="flex-1">
              <T variant="bodyStrong">{e.title}</T>
              <T variant="caption">{e.text}</T>
            </View>
            {e.count ? (
              <View className="mr-2 min-w-[26px] items-center rounded-full bg-orange-soft px-2 py-0.5">
                <T className="font-semibold text-[12px] text-orange">{e.count}</T>
              </View>
            ) : null}
            <Feather name="chevron-right" size={18} color={theme.colors.faint} />
          </Card>
        ))}

      <Pressable onPress={() => router.push('/declare')} className="mt-4 flex-row items-center justify-center rounded-xl bg-green py-4">
        <Feather name="plus" size={18} color="#fff" />
        <T className="ml-2 font-semibold text-[15px] text-white">Déclarer un événement</T>
      </Pressable>
    </Screen>
  );
}
