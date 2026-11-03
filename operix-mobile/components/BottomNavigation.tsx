import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '@/constants/theme';
import { T } from './ui/Text';

const ITEMS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  index: { label: 'Accueil', icon: 'home' },
  security: { label: 'Sécurité', icon: 'shield' },
  insights: { label: 'Insights', icon: 'activity' },
  profile: { label: 'Profil', icon: 'user' },
};

/** Barre : Accueil • Sécurité • (+) • Insights • Profil. Le « + » ouvre la déclaration. */
export function BottomNavigation({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => ITEMS[r.name]);

  const tab = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    const item = ITEMS[name];
    if (!route || !item) return null;
    const focused = state.routes[state.index]?.name === name;
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => navigation.navigate(route.name)}
        className="min-h-[52px] flex-1 items-center justify-center"
      >
        <Feather name={item.icon} size={21} color={focused ? colors.green : colors.faint} />
        <T className={`mt-1 text-[11px] ${focused ? 'font-semibold text-green' : 'font-medium text-faint'}`}>{item.label}</T>
      </Pressable>
    );
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 flex-row items-center border-t border-border bg-surface px-2 pt-1.5" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
      {routes.slice(0, 2).map((r) => tab(r.name))}
      <View className="flex-1 items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Déclarer un incident"
          onPress={() => router.push('/declare')}
          className="-mt-7 h-16 w-16 items-center justify-center rounded-full border-4 border-bg bg-green"
          style={[shadow, { shadowOpacity: 0.18, elevation: 6 }]}
        >
          <Feather name="plus" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
      {routes.slice(2).map((r) => tab(r.name))}
    </View>
  );
}
