import type { ReactElement, ReactNode } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { errorMessage } from '@/services/api';
import { EmptyState, ErrorState, LoadingState, TopBar } from './ui';
import { OfflineBanner } from './OfflineBanner';

interface Props<T> {
  title: string;
  items: T[];
  loading: boolean;
  refreshing: boolean;
  error: unknown;
  onRefresh: () => void;
  onEndReached?: () => void;
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T) => string;
  emptyTitle: string;
  emptyText?: string;
  header?: ReactNode;
}

export function ListScreen<T>(p: Props<T>): ReactElement {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title={p.title} back />
      <OfflineBanner />
      <FlatList
        data={p.items}
        keyExtractor={p.keyExtractor}
        renderItem={p.renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListHeaderComponent={p.header ? <View className="mb-2">{p.header}</View> : undefined}
        ListEmptyComponent={
          p.loading ? <LoadingState /> : p.error ? <ErrorState message={errorMessage(p.error)} onRetry={p.onRefresh} /> : <EmptyState title={p.emptyTitle} text={p.emptyText} />
        }
        onEndReached={p.onEndReached}
        onEndReachedThreshold={0.4}
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={colors.green} />}
      />
    </SafeAreaView>
  );
}
