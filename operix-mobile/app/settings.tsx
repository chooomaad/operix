import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Linking, Switch, View } from 'react-native';
import { API_URL, APP_VERSION } from '@/constants/config';
import { Screen } from '@/components/Screen';
import { Button, Card, KeyValue, SectionHeader, T, TopBar } from '@/components/ui';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useTheme } from '@/features/theme/ThemeProvider';

export default function SettingsScreen() {
  const { online, pending, syncing, sync } = useOfflineQueue();
  const theme = useTheme();
  const [notif, setNotif] = useState(false);

  useEffect(() => {
    void Notifications.getPermissionsAsync().then((p) => setNotif(p.granted));
  }, []);

  const toggleNotif = async () => {
    if (notif) {
      // La révocation se fait dans les réglages système.
      void Linking.openSettings();
      return;
    }
    const p = await Notifications.requestPermissionsAsync();
    setNotif(p.granted);
  };

  return (
    <Screen header={<TopBar title="Paramètres" back showBell={false} />}>
      <SectionHeader title="Apparence" />
      <Card className="flex-row items-center">
        <View className="flex-1 pr-3">
          <T variant="bodyStrong">Mode sombre</T>
          <T variant="caption">Confort visuel avec des tons gris anthracite.</T>
        </View>
        <Switch
          value={theme.scheme === 'dark'}
          onValueChange={(enabled) => theme.setScheme(enabled ? 'dark' : 'light')}
          trackColor={{ true: '#0B8A5E', false: theme.colors.border }}
          thumbColor="#FFFFFF"
        />
      </Card>

      <SectionHeader title="Synchronisation" />
      <Card>
        <KeyValue label="Réseau" value={online ? 'En ligne' : 'Hors ligne'} />
        <KeyValue label="Déclarations en attente" value={String(pending)} />
        <Button className="mt-3" kind="secondary" icon="refresh-cw" label={syncing ? 'Synchronisation…' : 'Synchroniser maintenant'} onPress={sync} disabled={!online || pending === 0} loading={syncing} />
      </Card>

      <SectionHeader title="Notifications" />
      <Card className="flex-row items-center">
        <View className="flex-1 pr-3">
          <T variant="bodyStrong">Alertes sur l'appareil</T>
          <T variant="caption">Les alertes HSSE restent consultables dans l'onglet Notifications.</T>
        </View>
        <Switch value={notif} onValueChange={toggleNotif} trackColor={{ true: '#0B8A5E', false: theme.colors.border }} thumbColor="#fff" />
      </Card>

      <SectionHeader title="À propos" />
      <Card>
        <KeyValue label="Version" value={APP_VERSION} />
        <KeyValue label="Serveur" value={API_URL.replace(/^https?:\/\//, '')} />
        <KeyValue label="Stockage du jeton" value="Coffre sécurisé (SecureStore)" />
      </Card>
    </Screen>
  );
}
