import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { type PropsWithChildren, useMemo } from 'react';
import { PanResponder, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { neighbourTab } from '@/domain/tabs';
import { useTheme } from '@/hooks/use-theme';

/** How far a finger has to travel sideways before it counts as a swipe. */
const SWIPE_CLAIM = 24;
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 0.4;

/**
 * Swipe left or right to move along the tab bar. The gesture is only claimed
 * once a drag is clearly sideways, so scrolling the page still wins, and the
 * ends of the bar do not wrap round.
 */
function useTabSwipe() {
  const router = useRouter();
  const pathname = usePathname();

  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > SWIPE_CLAIM && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderRelease: (_event, gesture) => {
          const meant =
            Math.abs(gesture.dx) > SWIPE_DISTANCE || Math.abs(gesture.vx) > SWIPE_VELOCITY;
          if (!meant) return;

          // Dragging the page to the left brings the next tab in from the right.
          const next = neighbourTab(pathname, gesture.dx < 0 ? 1 : -1);
          if (!next) return;

          void Haptics.selectionAsync();
          router.navigate(next.path);
        },
      }).panHandlers,
    [pathname, router],
  );
}

/** Scrollable page for tab screens: safe areas, tab bar clearance and a readable max width. */
export function Screen({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const swipe = useTabSwipe();

  return (
    <View style={styles.fill} {...swipe}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + TopTabInset + Spacing.two,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'never' : undefined}>
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </View>
  );
}

/** Scrollable body for modal forms. */
export function FormScreen({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  form: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
});
