import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import type { Category } from '@/db/types';

const CATEGORY_ICONS: Record<string, IconName> = {
  groceries: { ios: 'cart.fill', material: 'shopping_cart' },
  dining: { ios: 'fork.knife', material: 'restaurant' },
  transport: { ios: 'bus.fill', material: 'directions_bus' },
  bills: { ios: 'bolt.fill', material: 'bolt' },
  shopping: { ios: 'bag.fill', material: 'shopping_bag' },
  entertainment: { ios: 'film.fill', material: 'movie' },
  health: { ios: 'cross.case.fill', material: 'medical_services' },
  other: { ios: 'square.grid.2x2.fill', material: 'category' },
};

export function categoryIcon(key: string): IconName {
  return CATEGORY_ICONS[key] ?? CATEGORY_ICONS.other;
}

/** The category's glyph on its colour, as a rounded square (like iOS Settings icons). */
export function CategoryBadge({
  category,
  size = 36,
}: {
  category: Pick<Category, 'icon' | 'color'>;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          backgroundColor: category.color,
        },
      ]}>
      <Icon name={categoryIcon(category.icon)} size={size * 0.5} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
