import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** Pill used for filters and tags. Static (no onPress) or toggleable. */
export function Chip({ label, selected = false, onPress, color, style, accessibilityLabel, accessibilityHint }: ChipProps) {
  const theme = useTheme();
  const accent = color ?? theme.tint;
  const body = (
    <View
      style={[
        styles.chip,
        { backgroundColor: selected ? accent : theme.backgroundElement, borderColor: selected ? accent : theme.border },
        style,
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.onTint : theme.text }}>
        {label}
      </ThemedText>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => pressed && styles.pressed}
      // 48pt tall chip meets both iOS (44pt) and Android (48dp) minimums on its own bounds
      hitSlop={4}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
});
