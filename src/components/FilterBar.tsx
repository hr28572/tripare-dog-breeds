import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { ThemedText } from '@/components/themed-text';
import { SizeBandColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countActiveFilters, useFilterStore } from '@/stores/filterStore';
import { SIZE_BANDS } from '@/types/breed';
import { capitalize } from '@/utils/format';

interface FilterBarProps {
  onOpenSheet: () => void;
  resultCount: number;
  groupCount: number;
}

/** Quick size-band chips plus a button (with active count) that opens the full FilterSheet. */
export function FilterBar({ onOpenSheet, resultCount, groupCount }: FilterBarProps) {
  const theme = useTheme();
  const activeFilters = useFilterStore((s) => s.activeFilters);
  const toggleSizeBand = useFilterStore((s) => s.toggleSizeBand);
  const clearAll = useFilterStore((s) => s.clearAll);
  const active = countActiveFilters(activeFilters);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={onOpenSheet}
          accessibilityRole="button"
          accessibilityLabel={`Filters, ${active} active`}
          accessibilityHint="Opens group, size, coat and trait filters"
          style={({ pressed }) => [
            styles.filterButton,
            { backgroundColor: active > 0 ? theme.tint : theme.backgroundElement, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="options" size={16} color={active > 0 ? theme.onTint : theme.text} />
          <ThemedText type="small" style={{ color: active > 0 ? theme.onTint : theme.text }}>
            {active > 0 ? `Filters · ${active}` : 'Filters'}
          </ThemedText>
        </Pressable>
        {SIZE_BANDS.map((band) => (
          <Chip
            key={band}
            label={capitalize(band)}
            color={SizeBandColors[band]}
            selected={activeFilters.sizeBands.includes(band)}
            onPress={() => toggleSizeBand(band)}
          />
        ))}
        {active > 0 && <Chip label="Clear all" onPress={clearAll} accessibilityLabel="Clear all filters" />}
      </ScrollView>
      <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
        {resultCount} {resultCount === 1 ? 'breed' : 'breeds'} · {groupCount} {groupCount === 1 ? 'group' : 'groups'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  chips: { gap: Spacing.two, paddingHorizontal: Spacing.three, alignItems: 'center' },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
  count: { paddingHorizontal: Spacing.three },
});
