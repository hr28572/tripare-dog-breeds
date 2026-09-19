import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View, type ListRenderItemInfo, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { CachedImage } from '@/components/CachedImage';
import { ImageViewer } from '@/components/ImageViewer';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BreedImage } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { joinNonEmpty } from '@/utils/format';

/** The API ships at most 9 photos per breed; the pager never shows more. */
export const GALLERY_MAX_IMAGES = 9;

export function attributionText(img: BreedImage): string {
  return joinNonEmpty([img.author ? `© ${img.author}` : null, img.license, img.source?.replace(/_/g, ' ')]);
}

/**
 * Swipeable, paged gallery of medium images. Mounting this tab is what
 * triggers the on-demand medium download (cacheOnDemand); tapping a page
 * opens the large variant. Uncached images render a placeholder offline.
 */
export function GalleryTab({ images }: { images: BreedImage[] }) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<BreedImage | null>(null);

  const { pages, largeByImageId } = useMemo(() => {
    const largeByImageId = new Map<string, BreedImage>();
    for (const img of images) if (img.variant === 'large') largeByImageId.set(img.imageId, img);
    const pages = images
      .filter((i) => i.variant === 'medium')
      .sort((a, b) => a.position - b.position)
      .slice(0, GALLERY_MAX_IMAGES);
    return { pages, largeByImageId };
  }, [images]);

  const pageWidth = width;
  const imageWidth = width - Spacing.three * 2;

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth)),
    [pageWidth],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<BreedImage>) => (
      <View style={{ width: pageWidth }} accessibilityLabel={`Photo ${index + 1} of ${pages.length}`}>
        <Pressable
          onPress={() => setSelected(largeByImageId.get(item.imageId) ?? item)}
          accessibilityRole="imagebutton"
          accessibilityLabel={item.author ? `Photo by ${item.author}, opens full screen` : 'Breed photo, opens full screen'}
          style={({ pressed }) => [styles.pagePressable, pressed && styles.pressed]}>
          <CachedImage
            source={{ id: item.id, url: item.url, variant: item.variant, localUri: item.localUri, cachedLocally: item.cachedLocally }}
            cacheOnDemand
            style={[styles.image, { width: imageWidth, height: imageWidth * 0.75 }]}
          />
        </Pressable>
        <Pressable
          onPress={() => item.sourceUrl && WebBrowser.openBrowserAsync(item.sourceUrl)}
          disabled={!item.sourceUrl}
          accessibilityRole="link"
          style={styles.caption}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.captionText}>
            {attributionText(item) || 'No attribution provided'}
          </ThemedText>
        </Pressable>
      </View>
    ),
    [pageWidth, imageWidth, pages.length, largeByImageId],
  );

  if (pages.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText type="small" themeColor="textSecondary">
          No photos available for this breed.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={pages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        initialNumToRender={1}
        windowSize={3}
        getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
      />
      <View style={styles.indicator} accessibilityLabel={`Page ${page + 1} of ${pages.length}`}>
        {pages.map((p, i) => (
          <View key={p.id} style={[styles.dot, { backgroundColor: i === page ? theme.tint : theme.backgroundSelected }]} />
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
          {page + 1} / {pages.length}
        </ThemedText>
      </View>
      <ImageViewer image={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Spacing.three },
  empty: { padding: Spacing.three },
  pagePressable: { paddingHorizontal: Spacing.three },
  pressed: { opacity: 0.85 },
  image: { borderRadius: 16 },
  caption: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  captionText: { fontSize: 12, lineHeight: 16 },
  indicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.three },
  dot: { width: 6, height: 6, borderRadius: 3 },
  counter: { marginLeft: Spacing.two, fontSize: 12, lineHeight: 16 },
});
