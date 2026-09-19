import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { Chip } from '@/components/Chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SizeBandColors, Spacing } from '@/constants/theme';
import { TRAIT_META } from '@/constants/traits';
import type { Group } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { countActiveFilters, useFilterStore } from '@/stores/filterStore';
import { COAT_FILTERS, SIZE_BANDS } from '@/types/breed';
import { capitalize } from '@/utils/format';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  groups: Group[];
}

const TRAIT_MIN_OPTIONS = [3, 4, 5];
/** Exercise is minutes, not a 1–5 score, so it is not offered as a threshold. */
const THRESHOLD_TRAITS = TRAIT_META.filter((t) => t.key !== 'exerciseMinutes');

export function FilterSheet({ visible, onClose, groups }: FilterSheetProps) {
  const theme = useTheme();
  const f = useFilterStore(
    useShallow((s) => ({
      active: s.activeFilters,
      toggleGroup: s.toggleGroup,
      toggleSizeBand: s.toggleSizeBand,
      toggleCoatLength: s.toggleCoatLength,
      setHypoallergenicOnly: s.setHypoallergenicOnly,
      toggleTrait: s.toggleTrait,
      setTraitMin: s.setTraitMin,
      clearAll: s.clearAll,
    })),
  );
  const count = countActiveFilters(f.active);
  const traitMin = f.active.traitThresholds[0]?.min ?? 4;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={styles.flex}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Pressable
              onPress={f.clearAll}
              disabled={count === 0}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              accessibilityState={{ disabled: count === 0 }}
              style={styles.headerButton}
              hitSlop={4}>
              <ThemedText type="small" themeColor={count === 0 ? 'textSecondary' : 'tint'}>
                Clear all
              </ThemedText>
            </Pressable>
            <ThemedText type="smallBold" accessibilityRole="header">
              {count > 0 ? `Filters (${count})` : 'Filters'}
            </ThemedText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters" style={styles.headerButton} hitSlop={4}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Section title="Group">
              <View style={styles.wrap}>
                {groups.map((g) => (
                  <Chip
                    key={g.id}
                    label={g.name}
                    selected={f.active.groupIds.includes(g.id)}
                    onPress={() => f.toggleGroup(g.id)}
                    accessibilityHint="Filters the list by breed group"
                  />
                ))}
              </View>
            </Section>

            <Section title="Size">
              <View style={styles.wrap}>
                {SIZE_BANDS.map((band) => (
                  <Chip
                    key={band}
                    label={capitalize(band)}
                    color={SizeBandColors[band]}
                    selected={f.active.sizeBands.includes(band)}
                    onPress={() => f.toggleSizeBand(band)}
                    accessibilityLabel={`${capitalize(band)} size`}
                    accessibilityHint="Filters the list by size"
                  />
                ))}
              </View>
            </Section>

            <Section title="Coat">
              <View style={styles.wrap}>
                {COAT_FILTERS.map((length) => (
                  <Chip
                    key={length}
                    label={capitalize(length)}
                    selected={f.active.coatLengths.includes(length)}
                    onPress={() => f.toggleCoatLength(length)}
                    accessibilityLabel={`${capitalize(length)} coat`}
                    accessibilityHint="Filters the list by coat length"
                  />
                ))}
              </View>
            </Section>

            <Section title="Allergies">
              <View style={styles.switchRow}>
                <ThemedText>Hypoallergenic only</ThemedText>
                <Switch
                  value={f.active.hypoallergenicOnly}
                  onValueChange={f.setHypoallergenicOnly}
                  trackColor={{ true: theme.tint }}
                  accessibilityLabel="Hypoallergenic only"
                />
              </View>
            </Section>

            <Section title="Traits">
              <ThemedText type="small" themeColor="textSecondary">
                Show breeds scoring at least the minimum on every selected trait.
              </ThemedText>
              <View style={styles.wrap}>
                {THRESHOLD_TRAITS.map((t) => (
                  <Chip
                    key={t.key}
                    label={t.label}
                    selected={f.active.traitThresholds.some((x) => x.trait === t.key)}
                    onPress={() => f.toggleTrait(t.key)}
                    accessibilityLabel={`${t.label} trait`}
                    accessibilityHint={`Only show breeds scoring at least ${traitMin} out of 5`}
                  />
                ))}
              </View>
              {f.active.traitThresholds.length > 0 && (
                <View style={styles.switchRow}>
                  <ThemedText type="small">Minimum score</ThemedText>
                  <View style={styles.wrap}>
                    {TRAIT_MIN_OPTIONS.map((min) => (
                      <Chip
                        key={min}
                        label={`${min}+`}
                        selected={traitMin === min}
                        onPress={() => f.setTraitMin(min)}
                        accessibilityLabel={`Minimum score ${min}`}
                        accessibilityHint="Applies to every selected trait"
                      />
                    ))}
                  </View>
                </View>
              )}
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [styles.doneButton, { backgroundColor: theme.tint }, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: theme.onTint }}>
                Show results
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle} accessibilityRole="header">
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 12, letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  footer: { padding: Spacing.three },
  doneButton: { borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' },
  pressed: { opacity: 0.8 },
});
