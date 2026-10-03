import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { MiniPlayer } from '@/components/mini-player';
import { Colors } from '@/constants/theme';
import { useAppMode } from '@/state/app-mode-context';

export default function TabsLayout() {
  const { creatorProfile, creatorLoading } = useAppMode();
  const showStudio = !creatorLoading && creatorProfile?.status === 'ACTIVE';
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.text,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: { backgroundColor: Colors.background, borderTopColor: Colors.elevated },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={22} /> }} />
        <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={color} size={22} /> }} />
        <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'books.vertical.fill', android: 'library_books', web: 'library_books' }} tintColor={color} size={22} /> }} />
        <Tabs.Screen name="upload" options={{ href: null }} />
        <Tabs.Screen name="studio" options={{ href: showStudio ? '/studio' : null, title: 'Studio', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'rectangle.3.group.fill', android: 'dashboard', web: 'dashboard' }} tintColor={color} size={22} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} tintColor={color} size={22} /> }} />
      </Tabs>
      <MiniPlayer />
    </>
  );
}
