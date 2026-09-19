import { Stack, useLocalSearchParams, type Href } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { CachedImage } from '@/components/CachedImage';
import { EmptyState } from '@/components/EmptyState';
import { SizeBadge } from '@/components/SizeBadge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBreedDetail } from '@/hooks/useBreedDetail';
import { useTheme } from '@/hooks/use-theme';
import { BreedDetailProvider } from '@/screens/breed-detail/BreedDetailContext';
import { joinNonEmpty } from '@/utils/format';

/**
 * Route layout for app/breed/[id]/. Loads the breed once, renders the hero
 * and title, and hosts Expo Router's headless tabs: Overview (index), Traits
 * and Gallery are real nested routes, so deep links and back navigation
 * follow the same routing model as the rest of the app.
 */
export function BreedDetailLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { detail, refreshing } = useBreedDetail(id);

  if (!id || !detail) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: 'Breed' }} />
        {refreshing ? (
          <ActivityIndicator style={styles.flex} color={theme.tint} />
        ) : (
          <EmptyState icon="paw" title="Breed not found" message="This breed is not in the local cache. Sync from the list to load it." />
        )}
      </ThemedView>
    );
  }

  const { breed, groupName, images } = detail;
  const primaryThumb = images.find((i) => i.variant === 'thumb' && i.position === 0) ?? null;
  const hero = primaryThumb
    ? { id: primaryThumb.id, url: primaryThumb.url, variant: primaryThumb.variant, localUri: primaryThumb.localUri, cachedLocally: primaryThumb.cachedLocally }
    : null;
  const subtitle = joinNonEmpty([groupName, breed.originCountry]);
  const base = `/breed/${id}`;

  return (
    <BreedDetailProvider value={{ id, detail, refreshing }}>
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: breed.name }} />
        <Tabs>
          {/* TabList must be a direct child of Tabs: expo-router only looks for triggers
              inside TabList/Fragment children, not inside arbitrary Views. */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {/* The list already cached this thumb, so the hero never needs the network. */}
              <CachedImage source={hero} style={styles.hero} compactPlaceholder accessibilityLabel={`Photo of ${breed.name}`} />
              <View style={styles.titleBlock}>
                <ThemedText type="subtitle" style={styles.name} numberOfLines={2}>
                  {breed.name}
                </ThemedText>
                <View style={styles.meta}>
                  <SizeBadge band={breed.sizeBand} />
                  {refreshing && <ActivityIndicator size="small" color={theme.textSecondary} />}
                </View>
                {subtitle ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {subtitle}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </View>
          <TabList style={[styles.tabList, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
            <TabTrigger name="overview" href={base as Href} asChild>
              <TabButton index={1}>Overview</TabButton>
            </TabTrigger>
            <TabTrigger name="traits" href={`${base}/traits` as Href} asChild>
              <TabButton index={2}>Traits</TabButton>
            </TabTrigger>
            <TabTrigger name="gallery" href={`${base}/gallery` as Href} asChild>
              <TabButton index={3}>Gallery</TabButton>
            </TabTrigger>
          </TabList>
          <TabSlot />
        </Tabs>
      </ThemedView>
    </BreedDetailProvider>
  );
}

function TabButton({ children, isFocused, index, ...props }: TabTriggerSlotProps & { index: number }) {
  const theme = useTheme();
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={`${children}, tab ${index} of 3`}
      accessibilityHint={isFocused ? undefined : `Shows the ${String(children).toLowerCase()} tab`}
      hitSlop={4}
      style={[styles.tab, isFocused && { backgroundColor: theme.background, ...styles.tabSelected }]}>
      <ThemedText type={isFocused ? 'smallBold' : 'small'} themeColor={isFocused ? 'text' : 'textSecondary'}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.three },
  titleRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  hero: { width: 96, height: 96, borderRadius: 16 },
  titleBlock: { flex: 1, gap: Spacing.one },
  name: { fontSize: 24, lineHeight: 30 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  tabList: { flexDirection: 'row', padding: 3, borderRadius: 10, marginHorizontal: Spacing.three, marginBottom: Spacing.two },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.two - 2, borderRadius: 8 },
  tabSelected: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});
