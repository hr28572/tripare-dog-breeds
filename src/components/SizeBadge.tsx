import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SizeBandColors, Spacing } from '@/constants/theme';
import type { SizeBand } from '@/types/breed';
import { capitalize } from '@/utils/format';

export function SizeBadge({ band }: { band: SizeBand | null }) {
  if (!band) return null;
  return (
    <View style={[styles.badge, { backgroundColor: SizeBandColors[band] }]}>
      <ThemedText type="smallBold" style={styles.text}>
        {capitalize(band)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  text: { color: '#fff', fontSize: 12, lineHeight: 16 },
});
