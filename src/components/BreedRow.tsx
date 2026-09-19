import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CachedImage } from '@/components/CachedImage';
import { SizeBadge } from '@/components/SizeBadge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BreedListRow } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';
import type { TraitKey } from '@/types/breed';
import { capitalize, formatLifeSpan, joinNonEmpty, spokenRange } from '@/utils/format';

/** Measured rendered height (see docs/PERFORMANCE.md); fixed so recycling never re-measures. */
export const BREED_ROW_HEIGHT = 88;
const THUMB = 64;

/** Three key traits shown as icon + score. Kept to three to keep the row payload small. */
export const ROW_TRAITS: { key: TraitKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'energy', icon: 'flash', label: 'Energy' },
  { key: 'goodWithChildren', icon: 'people', label: 'Good with children' },
  { key: 'shedding', icon: 'leaf', label: 'Shedding' },
];

interface BreedRowProps {
  breed: BreedListRow;
  onPress: (id: string) => void;
}

function BreedRowInner({ breed, onPress }: BreedRowProps) {
  const theme = useTheme();
  const thumb = breed.thumbId && breed.thumbUrl
    ? { id: breed.thumbId, url: breed.thumbUrl, variant: 'thumb' as const, localUri: breed.thumbLocalUri, cachedLocally: breed.thumbCached }
    : null;
  const subtitle = joinNonEmpty([breed.groupName, formatLifeSpan(breed.lifeMin, breed.lifeMax)]);
  const traits = ROW_TRAITS.filter((t) => breed[t.key] !== null);
  const traitsLabel = traits.map((t) => `${t.label} ${breed[t.key]} of 5`).join(', ');
  // One sentence per fact so a screen reader pauses between them; no glyphs or dashes.
  const accessibilityLabel = joinNonEmpty(
    [
      breed.name,
      breed.sizeBand ? `${capitalize(breed.sizeBand)} size` : null,
      breed.groupName,
      breed.lifeMin !== null || breed.lifeMax !== null ? `lives ${spokenRange(breed.lifeMin, breed.lifeMax, 'years')}` : null,
      traitsLabel || null,
      breed.hypoallergenic ? 'hypoallergenic' : null,
    ],
    '. ',
  );

  return (
    <Pressable
      onPress={() => onPress(breed.id)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens breed details"
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <CachedImage source={thumb} style={styles.thumb} />
      <View style={styles.body}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name} maxFontSizeMultiplier={1.4}>
          {breed.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {subtitle}
        </ThemedText>
        <View style={styles.badges}>
          <SizeBadge band={breed.sizeBand} />
          {traits.map((t) => (
            <View key={t.key} style={styles.trait} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name={t.icon} size={12} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.traitText}>
                {breed[t.key]}
              </ThemedText>
            </View>
          ))}
          {breed.hypoallergenic && (
            <ThemedText type="small" themeColor="success" style={styles.traitText}>
              Hypoallergenic
            </ThemedText>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
  );
}

export const BreedRow = memo(BreedRowInner);

const styles = StyleSheet.create({
  row: {
    height: BREED_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: 12 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 16 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  trait: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  traitText: { fontSize: 12, lineHeight: 16 },
});
