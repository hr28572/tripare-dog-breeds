import { useRouter, type ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Route-level error boundary for a feature area. Expo Router renders it in place of
 * the route subtree that threw, so the rest of the app stays navigable.
 */
export function RouteErrorBoundary({ error, retry, title = 'Something went wrong' }: ErrorBoundaryProps & { title?: string }) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <ThemedView style={styles.center}>
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
        {error.message}
      </ThemedText>
      <View style={styles.actions}>
        <Pressable onPress={() => void retry()} accessibilityRole="button" style={[styles.button, { backgroundColor: theme.tint }]}>
          <ThemedText type="smallBold" style={{ color: theme.onTint }}>
            Try again
          </ThemedText>
        </Pressable>
        {router.canGoBack() && (
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">Go back</ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  title: { fontSize: 18 },
  message: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  button: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: 10 },
});
