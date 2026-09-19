import {
  DarkTheme,
  DefaultTheme,
  type ErrorBoundaryProps,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { HeaderCancelButton } from '@/components/ui/header-cancel-button';
import { Colors, Spacing } from '@/constants/theme';
import { migrate } from '@/db/migrate';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { DataVersionProvider } from '@/state/data-version';
import { SelectedMonthProvider } from '@/state/selected-month';

void SplashScreen.preventAutoHideAsync();

const DATABASE_NAME = 'expenses.db';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.tint,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.separator,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
        <DataVersionProvider>
          <SelectedMonthProvider>
            <HideSplashScreen />
            <Stack
              screenOptions={{
                headerTintColor: colors.tint,
                headerTitleStyle: { color: colors.text },
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="expense/new"
                options={{
                  presentation: 'modal',
                  title: 'New expense',
                  headerLeft: HeaderCancelButton,
                }}
              />
              <Stack.Screen
                name="expense/[id]"
                options={{
                  presentation: 'modal',
                  title: 'Edit expense',
                  headerLeft: HeaderCancelButton,
                }}
              />
              <Stack.Screen
                name="budget/monthly"
                options={{
                  presentation: 'modal',
                  title: 'Monthly budget',
                  headerLeft: HeaderCancelButton,
                }}
              />
              <Stack.Screen
                name="budget/[categoryId]"
                options={{
                  presentation: 'modal',
                  title: 'Category budget',
                  headerLeft: HeaderCancelButton,
                }}
              />
            </Stack>
          </SelectedMonthProvider>
        </DataVersionProvider>
      </SQLiteProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

/** Rendered once the database is open and migrated, so the splash covers start-up. */
function HideSplashScreen() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return null;
}

/** Shown by Expo Router if start-up fails, e.g. the database cannot be opened. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={[styles.error, { backgroundColor: theme.background }]}>
      <ThemedText type="title">Something went wrong</ThemedText>
      <ThemedText type="callout" themeColor="textSecondary">
        {error.message}
      </ThemedText>
      <Button title="Try again" onPress={() => void retry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
