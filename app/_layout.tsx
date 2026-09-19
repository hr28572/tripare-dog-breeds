import { QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, useColorScheme } from 'react-native';

import { queryClient } from '@/api/queryClient';
import { SyncBootstrap } from '@/components/SyncBootstrap';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';

/** Catches render errors anywhere under the root and offers a retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ThemedView style={styles.center}>
      <ThemedText type="title">Something went wrong</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        {error.message}
      </ThemedText>
      <Pressable onPress={() => void retry()} accessibilityRole="button" style={styles.retry}>
        <ThemedText themeColor="tint">Try again</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="title">Database error</ThemedText>
        <ThemedText themeColor="textSecondary">{error.message}</ThemedText>
      </ThemedView>
    );
  }
  if (!success) {
    // Migrations take a few ms on first launch; splash screen stays visible.
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SyncBootstrap />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Breeds' }} />
          <Stack.Screen name="breed/[id]" options={{ title: 'Breed' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  centerText: { textAlign: 'center' },
  retry: { marginTop: 16, padding: 12 },
});
