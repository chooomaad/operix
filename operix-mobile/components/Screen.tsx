import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineBanner } from './OfflineBanner';
import { useTheme } from '@/features/theme/ThemeProvider';

interface ScreenProps {
  header?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Espace réservé sous le contenu pour la barre de navigation flottante. */
  tabBarSpace?: boolean;
}

export function Screen({ header, children, scroll = true, refreshing = false, onRefresh, tabBarSpace }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarSpace ? 120 : 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
    </SafeAreaView>
  );
}
