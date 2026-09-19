import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TRAIT_SCALE, type TraitKey } from '@/types/breed';

interface TraitGaugeProps {
  traitKey: TraitKey;
  label: string;
  value: number | null;
  low?: string;
  high?: string;
}

/**
 * 1–5 traits render as five pips; exerciseMinutes renders as a proportional
 * bar with the minutes printed. Null renders as "No data".
 */
export function TraitGauge({ traitKey, label, value, low, high }: TraitGaugeProps) {
  const theme = useTheme();
  const scale = TRAIT_SCALE[traitKey];
  const isMinutes = traitKey === 'exerciseMinutes';
  const valueLabel = value === null ? 'No data' : isMinutes ? `${value} min/day` : `${value}/${scale.max}`;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${valueLabel}`}
      accessibilityValue={{ min: scale.min, max: scale.max, now: value ?? undefined, text: valueLabel }}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {valueLabel}
        </ThemedText>
      </View>
      {isMinutes ? (
        <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[
              styles.barFill,
              { backgroundColor: theme.tint, width: `${value === null ? 0 : Math.min(100, (value / scale.max) * 100)}%` },
            ]}
          />
        </View>
      ) : (
        <View style={styles.pips}>
          {Array.from({ length: scale.max }, (_, i) => (
            <View
              key={i}
              style={[styles.pip, { backgroundColor: value !== null && i < value ? theme.tint : theme.backgroundSelected }]}
            />
          ))}
        </View>
      )}
      {(low || high) && (
        <View style={styles.header}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {low}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {high}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pips: { flexDirection: 'row', gap: Spacing.one },
  pip: { flex: 1, height: 8, borderRadius: 4 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  hint: { fontSize: 12, lineHeight: 16 },
});
