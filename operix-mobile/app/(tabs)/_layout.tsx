import { Tabs } from 'expo-router';
import { BottomNavigation } from '@/components/BottomNavigation';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomNavigation {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="security" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
