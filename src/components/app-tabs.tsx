import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

/** Native iOS tab bar (Liquid Glass on iOS 26+). The web version lives in `app-tabs.web.tsx`. */
export default function AppTabs() {
  const theme = useTheme();

  return (
    <NativeTabs tintColor={theme.tint}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="budgets">
        <NativeTabs.Trigger.Label>Budgets</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.pie', selected: 'chart.pie.fill' }}
          md="donut_small"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bills">
        <NativeTabs.Trigger.Label>Bills</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'calendar', selected: 'calendar.badge.clock' }}
          md="event_repeat"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="savings">
        <NativeTabs.Trigger.Label>Savings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'banknote', selected: 'banknote.fill' }}
          md="savings"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="insights">
        <NativeTabs.Trigger.Label>Insights</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.pie', selected: 'chart.pie.fill' }}
          md="pie_chart"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
