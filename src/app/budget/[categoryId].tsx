import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { CategoryBadge } from '@/components/category-badge';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { removeBudget, setBudget } from '@/db/budgets';
import type { Category } from '@/db/types';
import { formatMonthName } from '@/domain/dates';
import { formatPence, parseAmountToPence, penceToInputValue } from '@/domain/money';
import { useBudgets, useCategories, useMonthSpending } from '@/hooks/use-app-data';
import { useDbMutation } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { useSelectedMonth } from '@/state/selected-month';

export default function BudgetScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const id = Number(categoryId);
  const { byId, loaded } = useCategories();
  const budgets = useBudgets().data;
  const { month } = useSelectedMonth();
  const spending = useMonthSpending(month).data ?? [];

  if (!loaded || budgets === undefined) return <FormScreen />;

  const category = byId.get(id);
  if (!category) {
    return (
      <FormScreen>
        <EmptyState
          icon={{ ios: 'questionmark.circle', material: 'help' }}
          title="Category not found"
          message="Go back and pick a category from the list."
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <BudgetForm
        key={category.id}
        category={category}
        currentLimitPence={budgets.find((b) => b.categoryId === id)?.monthlyLimitPence ?? null}
        spentPence={spending.find((s) => s.categoryId === id)?.totalPence ?? 0}
        monthName={formatMonthName(month)}
      />
    </FormScreen>
  );
}

interface BudgetFormProps {
  category: Category;
  currentLimitPence: number | null;
  spentPence: number;
  monthName: string;
}

function BudgetForm({ category, currentLimitPence, spentPence, monthName }: BudgetFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const mutate = useDbMutation();
  const [limitText, setLimitText] = useState(
    currentLimitPence === null ? '' : penceToInputValue(currentLimitPence),
  );
  const [showError, setShowError] = useState(false);
  const limitPence = parseAmountToPence(limitText);

  async function save() {
    setShowError(true);
    if (limitPence === null) return;
    await mutate((db) => setBudget(db, category.id, limitPence));
    router.back();
  }

  async function remove() {
    await mutate((db) => removeBudget(db, category.id));
    router.back();
  }

  return (
    <View style={styles.form}>
      <View style={styles.header}>
        <CategoryBadge category={category} size={52} />
        <ThemedText type="title">{category.name}</ThemedText>
        <ThemedText type="callout" themeColor="textSecondary">
          {formatPence(spentPence)} spent in {monthName}
        </ThemedText>
      </View>

      <Card style={styles.amountCard}>
        <ThemedText type="footnote" themeColor="textSecondary">
          Monthly limit
        </ThemedText>
        <AmountInput
          value={limitText}
          onChangeText={setLimitText}
          placeholder="0"
          autoFocus={currentLimitPence === null}
          accessibilityLabel={`Monthly limit for ${category.name} in pounds`}
        />
        {showError && limitPence === null ? (
          <ThemedText type="footnote" style={{ color: theme.danger }}>
            Enter a limit, for example 300
          </ThemedText>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button title="Save budget" onPress={save} />
        {currentLimitPence !== null ? (
          <Button title="Remove budget" variant="destructive" onPress={remove} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  amountCard: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  actions: {
    gap: Spacing.two,
  },
});
