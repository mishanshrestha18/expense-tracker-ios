import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Category } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

interface CategoryPickerProps {
  categories: readonly Category[];
  value: number | null;
  onChange: (categoryId: number) => void;
  /** Smaller chips for inline use, e.g. in the quick-add bar. */
  compact?: boolean;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  compact = false,
}: CategoryPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {categories.map((category) => {
        const selected = category.id === value;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={category.name}
            onPress={() => onChange(category.id)}
            style={({ pressed }) => [
              styles.chip,
              compact && styles.chipCompact,
              {
                backgroundColor: selected ? theme.tintSoft : theme.backgroundElement,
                borderColor: selected ? theme.tint : 'transparent',
              },
              pressed && styles.pressed,
            ]}>
            <CategoryBadge category={category} size={compact ? 22 : 26} />
            <ThemedText type={compact ? 'footnote' : 'small'} numberOfLines={1}>
              {category.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
    paddingLeft: Spacing.one + 2,
    paddingRight: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 2,
  },
  chipCompact: {
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.two + 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
