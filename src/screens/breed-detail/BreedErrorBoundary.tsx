import { useRouter, type ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Route-level error boundary for app/breed/[id]. A bad id or a render error
 * here is contained to this screen; the list underneath keeps working.
 */
export function BreedErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <ThemedView style={styles.center}>
      <ThemedText type="smallBold" style={styles.title}>
        Couldn’t show this breed
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
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Back to breeds</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  title: { fontSize: 18 },
  message: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  button: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: 10 },
});
