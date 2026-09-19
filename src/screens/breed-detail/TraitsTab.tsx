import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { ThemedText } from '@/components/themed-text';
import { TraitGauge } from '@/components/TraitGauge';
import { Spacing } from '@/constants/theme';
import { TRAIT_META } from '@/constants/traits';
import type { Breed } from '@/db/schema';

export function TraitsTab({ breed }: { breed: Breed }) {
  const hasAny = TRAIT_META.some((t) => breed[t.key] !== null);
  return (
    <View style={styles.container}>
      {!hasAny && (
        <ThemedText type="small" themeColor="textSecondary">
          No trait scores are available for this breed yet.
        </ThemedText>
      )}
      {TRAIT_META.map((t) => (
        <TraitGauge key={t.key} traitKey={t.key} label={t.label} value={breed[t.key]} low={t.low} high={t.high} />
      ))}
      {breed.temperament.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Temperament</ThemedText>
          <View style={styles.wrap}>
            {breed.temperament.map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.four },
  section: { gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
