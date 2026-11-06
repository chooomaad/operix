import { Stack } from 'expo-router';
import { useTheme } from '@/features/theme/ThemeProvider';

export default function DeclareLayout() {
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }} />;
}
