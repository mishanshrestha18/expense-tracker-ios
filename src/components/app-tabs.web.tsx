import {
  TabList,
  type TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Web navigation: a floating pill bar at the top of the page. */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Overview</TabButton>
          </TabTrigger>
          <TabTrigger name="budgets" href="/budgets" asChild>
            <TabButton>Budgets</TabButton>
          </TabTrigger>
          <TabTrigger name="insights" href="/insights" asChild>
            <TabButton>Insights</TabButton>
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.tabButton, { backgroundColor: isFocused ? theme.tint : 'transparent' }]}>
        <ThemedText
          type="smallBold"
          style={{ color: isFocused ? theme.onTint : theme.textSecondary }}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function TabBar(props: TabListProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View {...props} style={styles.container}>
      <View style={[styles.bar, { backgroundColor: theme.card, borderColor: theme.separator }]}>
        <View style={styles.brand}>
          <Icon
            name={{ ios: 'sterlingsign.circle.fill', material: 'account_balance_wallet' }}
            size={22}
            color={theme.tint}
          />
          {width >= 480 ? <ThemedText type="headline">Expenses</ThemedText> : null}
        </View>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginRight: 'auto',
  },
  tabButton: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
});
