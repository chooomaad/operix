import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_VERSION } from '@/constants/config';
import { colors } from '@/constants/theme';
import { Button, Card, Input, Logo, StatusBadge, T } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/services/api';
import { useTheme } from '@/features/theme/ThemeProvider';

export default function LoginScreen() {
  const theme = useTheme();
  const { login, biometricLogin, biometricAvailable } = useAuth();
  const [matricule, setMatricule] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!matricule.trim() || pin.length < 4) {
      setError('Renseignez votre matricule et votre code PIN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(matricule, pin);
    } catch (e) {
      setError(errorMessage(e, 'Connexion impossible.'));
    } finally {
      setLoading(false);
    }
  };

  const bio = async () => {
    setError(null);
    const ok = await biometricLogin();
    if (!ok) setError('Authentification biométrique annulée.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between">
            <Logo size={30} />
            <View className="h-2 w-2 rounded-full bg-green" />
          </View>

          <View className="mt-8">
            <StatusBadge label="Terminal opérationnel actif" tone="green" dot />
            <T variant="display" className="mt-4">
              Bienvenue sur Operix
            </T>
            <T variant="body" className="mt-1 text-muted">
              Votre sécurité, partout sur le terrain.
            </T>
          </View>

          <Card className="mt-6 p-5">
            <Input
              label="Matricule"
              icon="user"
              placeholder="Ex. MAT-0001"
              autoCapitalize="characters"
              autoCorrect={false}
              value={matricule}
              onChangeText={setMatricule}
              returnKeyType="next"
            />
            <Input
              label="Code PIN"
              icon="lock"
              placeholder="••••••"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error}
            />
            <Button label="Se connecter" trailingIcon="arrow-right" onPress={submit} loading={loading} />

            {biometricAvailable ? (
              <>
                <View className="my-4 flex-row items-center">
                  <View className="h-px flex-1 bg-divider" />
                  <T variant="overline" className="mx-3">
                    ou
                  </T>
                  <View className="h-px flex-1 bg-divider" />
                </View>
                <Button kind="secondary" icon="smartphone" label="Connexion biométrique" onPress={bio} />
              </>
            ) : null}

            <Pressable className="mt-5 items-center" onPress={() => void Linking.openURL('mailto:')} hitSlop={8}>
              <T variant="caption">
                Besoin d'aide ? <T variant="caption" className="font-semibold text-green">Contacter le responsable HSSE</T>
              </T>
            </Pressable>
          </Card>

          <View className="mt-4 flex-row items-center rounded-2xl border border-border bg-surface p-4" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-green-soft">
              <Feather name="shield" size={17} color={colors.green} />
            </View>
            <View className="flex-1">
              <T variant="bodyStrong">Contrôle d'accès chiffré</T>
              <T variant="caption">Jeton stocké dans le coffre sécurisé de l'appareil.</T>
            </View>
          </View>

          <View className="mt-8 items-center">
            <T variant="caption">Certification ISO 45001 & Sécurité Portuaire</T>
            <T variant="caption" className="text-faint">
              Version {APP_VERSION} • Infrastructure Haute Disponibilité
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
