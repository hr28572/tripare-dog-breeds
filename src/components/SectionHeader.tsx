import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const SECTION_HEADER_HEIGHT = 36;

interface SectionHeaderProps {
  title: string;
  count: number;
}

/** Sticky group header for the breed list. */
export function SectionHeader({ title, count }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.header, { backgroundColor: theme.backgroundElement, borderBottomColor: theme.border }]}
      accessibilityRole="header"
      accessibilityLabel={`${title}, ${count} ${count === 1 ? 'breed' : 'breeds'}`}>
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {count}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: SECTION_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 13, letterSpacing: 0.3, textTransform: 'uppercase' },
});
