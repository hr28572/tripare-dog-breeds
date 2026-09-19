import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={theme.textSecondary} />
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      {message && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
          {message}
        </ThemedText>
      )}
      {actionLabel && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" style={[styles.button, { backgroundColor: theme.tint }]}>
          <ThemedText type="smallBold" style={{ color: theme.onTint }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.two },
  title: { fontSize: 18, textAlign: 'center' },
  message: { textAlign: 'center' },
  button: { marginTop: Spacing.two, paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: 10 },
});
