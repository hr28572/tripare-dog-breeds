import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { InfoRow } from '@/components/InfoRow';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Breed } from '@/db/schema';
import { capitalize, formatLifeSpan, formatRange, joinNonEmpty } from '@/utils/format';

interface OverviewTabProps {
  breed: Breed;
  groupName: string | null;
}

export function OverviewTab({ breed, groupName }: OverviewTabProps) {
  const origin = joinNonEmpty([breed.originCountry, breed.originRegion, breed.originEra], ', ');
  const coat = joinNonEmpty([breed.coatLength ? `${capitalize(breed.coatLength)} length` : null, breed.coatType ? `${breed.coatType} coat` : null], ', ');

  return (
    <View style={styles.container}>
      {breed.description && <ThemedText style={styles.description}>{breed.description}</ThemedText>}

      {breed.otherNames.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Also known as {breed.otherNames.join(', ')}
        </ThemedText>
      )}

      <View>
        <InfoRow label="Group" value={groupName} />
        <InfoRow label="Life span" value={formatLifeSpan(breed.lifeMin, breed.lifeMax)} />
        <InfoRow label="Weight (male)" value={formatRange(breed.maleWeightMin, breed.maleWeightMax, 'kg')} />
        <InfoRow label="Weight (female)" value={formatRange(breed.femaleWeightMin, breed.femaleWeightMax, 'kg')} />
        <InfoRow label="Height (male)" value={formatRange(breed.maleHeightMin, breed.maleHeightMax, 'cm')} />
        <InfoRow label="Height (female)" value={formatRange(breed.femaleHeightMin, breed.femaleHeightMax, 'cm')} />
        <InfoRow label="Origin" value={origin} />
        <InfoRow label="Coat" value={coat} />
        <InfoRow label="Colors" value={breed.coatColors.length > 0 ? breed.coatColors.join(', ') : null} />
        <InfoRow label="Hypoallergenic" value={breed.hypoallergenic ? 'Yes' : 'No'} />
      </View>

      {breed.recognizedBy.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Recognized by</ThemedText>
          <View style={styles.wrap}>
            {breed.recognizedBy.map((club) => (
              <Chip key={club} label={club} />
            ))}
          </View>
        </View>
      )}

      {breed.sources.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold">Sources</ThemedText>
          {breed.sources.map((s) => (
            <Pressable key={s.url} onPress={() => WebBrowser.openBrowserAsync(s.url)} accessibilityRole="link">
              <ThemedText type="small" themeColor="tint" numberOfLines={2}>
                {s.title}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.four },
  description: { lineHeight: 24 },
  section: { gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
