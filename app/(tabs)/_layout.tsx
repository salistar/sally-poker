/**
 * @file (tabs)/_layout.tsx
 * @description Tab navigator layout for the Poker app. Defines the bottom tab bar with Play, Leaderboard, and Profile tabs.
 * @author Idriss Kriouile
 * @date 2026-04-05
 * @project SallyCards - Poker
 */

import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * TabIcon - Renders an emoji icon for a tab bar item.
 * @param name - The emoji string to display
 */
function TabIcon({ name }: { name: string }) {
  return <Text style={{ fontSize: 20 }}>{name}</Text>;
}

export default function TabsLayout() {
  const { t } = useTranslation();

  useEffect(() => {
    console.log('[Poker/TabsLayout] Component mounted');
  }, []);

  return (
    /* Main bottom tab navigator with custom dark styling */
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: 'rgba(255,255,255,0.1)',
          /* Adjust tab bar height for iOS (includes home indicator) vs Android */
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#16A34A',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {/* Play tab - main game screen */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('play'),
          tabBarIcon: () => <TabIcon name="🎮" />,
        }}
      />
      {/* Leaderboard tab - player rankings */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('leaderboard'),
          tabBarIcon: () => <TabIcon name="🏆" />,
        }}
      />
            {/* Maps tab - hkim / position du joueur */}
      <Tabs.Screen
        name="maps"
        options={{
          title: t('map') ?? 'Carte',
          tabBarIcon: () => <TabIcon name="🗺️" />,
        }}
      />
      {/* Profile tab - user stats and account info */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: () => <TabIcon name="👤" />,
        }}
      />
    </Tabs>
  );
}

/* === End of (tabs)/_layout.tsx — Poker — SallyCards === */
