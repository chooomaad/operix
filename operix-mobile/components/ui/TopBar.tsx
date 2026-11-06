import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/features/theme/ThemeProvider';
import { LogoMark } from './Logo';
import { Avatar } from './Primitives';
import { T } from './Text';

interface TopBarProps {
  title: string;
  back?: boolean;
  status?: string;
  unread?: number;
  showBell?: boolean;
}

export function TopBar({ title, back, status, unread = 0, showBell = true }: TopBarProps) {
  const { session } = useAuth();
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center px-4 pb-3 pt-2">
      {back ? (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} className="mr-2 h-10 w-10 items-center justify-center rounded-full border border-border bg-surface" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Feather name="arrow-left" size={18} color={colors.navy} />
        </Pressable>
      ) : (
        <LogoMark size={30} />
      )}
      <View className="ml-2 flex-1">
        <T className="font-bold text-[15px] leading-[19px] text-navy">
          <T className="font-bold tracking-[1.5px] text-navy">OPERIX</T> <T className="font-regular text-muted">{title}</T>
        </T>
        {status ? (
          <View className="mt-0.5 flex-row items-center">
            <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green" />
            <T className="font-semibold text-[10px] tracking-[0.8px] text-green-dark">{status}</T>
          </View>
        ) : null}
      </View>
      {showBell ? (
        <Pressable onPress={() => router.push('/notifications')} hitSlop={10} className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-border bg-surface" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Feather name="bell" size={18} color={colors.navy} />
          {unread > 0 ? <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red" /> : null}
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.push('/profile')}>
        <Avatar name={session?.user.name} uri={session?.user.avatar} />
      </Pressable>
    </View>
  );
}
