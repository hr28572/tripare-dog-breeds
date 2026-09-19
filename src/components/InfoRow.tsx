import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
}

/** Label/value line for the Overview tab. Hidden when there is no value. */
export function InfoRow({ label, value }: InfoRowProps) {
  const theme = useTheme();
  if (!value || value === '—') return null;
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { width: 120 },
  value: { flex: 1 },
});
