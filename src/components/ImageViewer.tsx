import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CachedImage } from '@/components/CachedImage';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BreedImage } from '@/db/schema';
import { joinNonEmpty } from '@/utils/format';

interface ImageViewerProps {
  image: BreedImage | null;
  onClose: () => void;
}

/** Full-screen view of the large variant (cached on demand) with attribution. */
export function ImageViewer({ image, onClose }: ImageViewerProps) {
  // SafeAreaView does not reliably inset inside a translucent Modal on iOS, so pad by hand.
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={image !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.flex, { paddingTop: Math.max(insets.top, 20), paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
          {image && (
            <CachedImage
              source={{ id: image.id, url: image.url, variant: image.variant, localUri: image.localUri, cachedLocally: image.cachedLocally }}
              cacheOnDemand
              contentFit="contain"
              accessibilityLabel={image.author ? `Breed photo by ${image.author}` : 'Breed photo'}
              style={styles.image}
            />
          )}
          {image && (
            <Pressable
              onPress={() => image.sourceUrl && WebBrowser.openBrowserAsync(image.sourceUrl)}
              disabled={!image.sourceUrl}
              style={styles.caption}
              accessibilityRole="link">
              <ThemedText type="small" style={styles.captionText}>
                {joinNonEmpty([image.author ? `© ${image.author}` : null, image.license, image.source?.replace(/_/g, ' ')])}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#000' },
  // Top-left so it never collides with floating overlays (e.g. Expo Go's dev button).
  header: { flexDirection: 'row', justifyContent: 'flex-start', padding: Spacing.three },
  image: { flex: 1, backgroundColor: '#000' },
  caption: { padding: Spacing.three },
  captionText: { color: '#ddd', textAlign: 'center' },
});
