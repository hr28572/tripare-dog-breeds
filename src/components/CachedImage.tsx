import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCachedImage, type CachedImageSource } from '@/hooks/useCachedImage';
import { useTheme } from '@/hooks/use-theme';
import { useSyncStore } from '@/stores/syncStore';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  source: CachedImageSource | null;
  /** Download into the LRU cache if not already local (medium/large on demand). */
  cacheOnDemand?: boolean;
  /** Shown when the image is not cached and the device is offline (or the load fails). */
  placeholderLabel?: string;
  /** Hide the placeholder text (e.g. for small thumbs). */
  compactPlaceholder?: boolean;
}

export const OFFLINE_PLACEHOLDER_LABEL = 'Not available offline';

/**
 * expo-image that prefers the locally cached file and falls back to the
 * remote url. When nothing is cached and the device is offline, it renders a
 * clear placeholder instead of a broken image or an endless spinner.
 */
export function CachedImage({
  source,
  cacheOnDemand = false,
  placeholderLabel = OFFLINE_PLACEHOLDER_LABEL,
  compactPlaceholder = false,
  style,
  testID,
  ...rest
}: CachedImageProps) {
  const theme = useTheme();
  const isOnline = useSyncStore((s) => s.isOnline);
  const { uri, onError } = useCachedImage(source, cacheOnDemand);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const isLocal = !!uri && uri.startsWith('file:');
  const failed = failedFor !== null && failedFor === (source?.id ?? null);
  const unavailable = !uri || failed || (!isLocal && !isOnline);

  if (unavailable) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: theme.backgroundSelected }, style]}
        accessibilityRole="image"
        accessibilityLabel={placeholderLabel}
        testID={testID ?? 'image-placeholder'}>
        <Ionicons name={isOnline ? 'image-outline' : 'cloud-offline-outline'} size={compactPlaceholder ? 20 : 32} color={theme.textSecondary} />
        {!compactPlaceholder && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.placeholderText}>
            {placeholderLabel}
          </ThemedText>
        )}
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      onError={() => {
        if (source && uri !== source.url) onError();
        else setFailedFor(source?.id ?? null);
      }}
      testID={testID}
      recyclingKey={source?.id ?? undefined}
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={150}
      style={[{ backgroundColor: theme.backgroundSelected }, style]}
      accessibilityIgnoresInvertColors
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one, overflow: 'hidden' },
  placeholderText: { fontSize: 12, lineHeight: 16, textAlign: 'center', paddingHorizontal: Spacing.two },
});
