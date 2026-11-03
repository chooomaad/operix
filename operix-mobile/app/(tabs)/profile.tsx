import { Feather } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { Avatar, Button, Card, KeyValue, SectionHeader, StatusBadge, T, TopBar } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUnreadCount } from '@/hooks/useUnread';
import { roleLabel } from '@/lib/labels';
import { formatDateTime } from '@/lib/format';
import { confirmAction } from '@/lib/alert';

const LINKS: { href: Href; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { href: '/notifications', icon: 'bell', label: 'Notifications' },
  { href: '/actions', icon: 'check-square', label: 'Actions correctives' },
  { href: '/settings', icon: 'settings', label: 'Paramètres' },
];

export default function ProfileScreen() {
  const { session, logout } = useAuth();
  const unread = useUnreadCount();
  const u = session?.user;

  const confirmLogout = () =>
    confirmAction('Déconnexion', 'Fermer la session sur cet appareil ?', 'Se déconnecter', () => void logout());

  return (
    <Screen header={<TopBar title="Profil" unread={unread} />} tabBarSpace>
      <Card className="mt-2 items-center py-6">
        <Avatar name={u?.name} uri={u?.avatar} size={64} />
        <T variant="title" className="mt-3">
          {u?.name}
        </T>
        <T variant="caption">{u?.matricule ?? u?.email}</T>
        <View className="mt-3">
          <StatusBadge label={roleLabel[u?.role ?? ''] ?? u?.role ?? ''} tone="green" dot />
        </View>
      </Card>

      <SectionHeader title="Organisation" />
      <Card>
        <KeyValue label="Entreprise" value={session?.tenant?.name ?? '—'} />
        <KeyValue label="Pays" value={session?.tenant?.country ?? '—'} />
        <KeyValue label="Dernière connexion" value={formatDateTime(u?.last_login_at)} />
      </Card>

      <SectionHeader title="Raccourcis" />
      <Card className="p-0">
        {LINKS.map((l, i) => (
          <View key={l.label}>
            {i > 0 ? <View className="ml-14 h-px bg-divider" /> : null}
            <Pressable className="min-h-[52px] flex-row items-center px-4 py-3.5" onPress={() => router.push(l.href)}>
              <Feather name={l.icon} size={18} color={colors.navy} />
              <T variant="body" className="ml-4 flex-1">
                {l.label}
              </T>
              <Feather name="chevron-right" size={18} color={colors.faint} />
            </Pressable>
          </View>
        ))}
      </Card>

      <Button className="mt-6" kind="secondary" icon="log-out" label="Se déconnecter" onPress={confirmLogout} />
    </Screen>
  );
}
