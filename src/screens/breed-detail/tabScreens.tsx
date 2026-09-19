import { ScrollView, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useBreedDetailContext } from '@/screens/breed-detail/BreedDetailContext';
import { GalleryTab } from '@/screens/breed-detail/GalleryTab';
import { OverviewTab } from '@/screens/breed-detail/OverviewTab';
import { TraitsTab } from '@/screens/breed-detail/TraitsTab';

/** Route bodies for app/breed/[id]/{index,traits,gallery}.tsx. */

export function OverviewTabScreen() {
  const { detail } = useBreedDetailContext();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <OverviewTab breed={detail.breed} groupName={detail.groupName} />
    </ScrollView>
  );
}

export function TraitsTabScreen() {
  const { detail } = useBreedDetailContext();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TraitsTab breed={detail.breed} />
    </ScrollView>
  );
}

export function GalleryTabScreen() {
  const { detail } = useBreedDetailContext();
  return <GalleryTab images={detail.images} />;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
});
