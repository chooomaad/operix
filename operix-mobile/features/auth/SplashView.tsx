import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { APP_VERSION } from '@/constants/config';
import { T } from '@/components/ui';
import { useTheme } from '@/features/theme/ThemeProvider';

export function SplashView() {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, paddingHorizontal: 20 }}>
      <View className="flex-row items-center justify-between pt-2">
        <View className="flex-row items-center">
          <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green" />
          <T variant="overline" className="text-green-dark">HSSE Core Active</T>
        </View>
        <T variant="overline">◇ ISO 45001</T>
      </View>

      <View className="flex-1 items-center justify-center">
        <Image
          source={require('@/assets/operix-logo.png')}
          accessibilityLabel="OPERIX"
          resizeMode="contain"
          style={{ width: 240, height: 160 }}
        />
        <T variant="heading" className="mt-4 font-medium text-muted">
          HSSE Intelligence Platform
        </T>
        <T variant="label" className="mt-2 tracking-[1px] text-navy">
          Report • Understand • Prevent
        </T>
        <View className="mt-6 flex-row items-center rounded-full border border-border bg-surface px-3 py-1.5" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
          <View className="mr-2 h-1.5 w-1.5 rounded-full bg-green" />
          <T variant="caption">Pan-African & Offshore Nodes Sync</T>
        </View>
      </View>

      <View className="mb-4 rounded-2xl border border-border bg-surface p-4" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
        <T variant="bodyStrong">Vérification des protocoles…</T>
        <T variant="caption" className="mb-3">
          Inspection Matrices & ATEX Ready
        </T>
        <View className="h-1.5 overflow-hidden rounded-full bg-divider">
          <Animated.View
            style={{
              height: 6,
              backgroundColor: colors.green,
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        </View>
      </View>
      <View className="items-center pb-4">
        <T variant="caption">v{APP_VERSION} Enterprise Field Edition • Port & Industrie</T>
        <T variant="caption" className="text-faint">
          Infrastructure Sécurisée • Mode Hors-Ligne Prêt
        </T>
      </View>
    </SafeAreaView>
  );
}
