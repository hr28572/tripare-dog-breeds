import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { useTheme } from '@/hooks/use-theme';

// Error boundary for the list/settings feature area; the detail route has its own.
export { RouteErrorBoundary as ErrorBoundary };

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Breeds',
          tabBarAccessibilityLabel: 'Breeds',
          tabBarIcon: ({ color, size }) => <Ionicons name="paw" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
