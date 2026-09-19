import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BudgetForm } from '@/components/budget-form';
import { Icon } from '@/components/ui/icon';
import { FormScreen } from '@/components/ui/screen';
import { removeOverallBudget, setOverallBudget } from '@/db/budgets';
import { formatMonthName } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { useBudgets, useMonthSpending, useOverallBudget } from '@/hooks/use-app-data';
import { useDbMutation } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { useSelectedMonth } from '@/state/selected-month';

/** The overall monthly budget: one limit covering every category. */
export default function MonthlyBudgetScreen() {
  const theme = useTheme();
  const router = useRouter();
  const mutate = useDbMutation();
  const { month } = useSelectedMonth();
  const monthlyLimitPence = useOverallBudget().data;
  const budgets = useBudgets().data;
  const spending = useMonthSpending(month).data ?? [];

  if (monthlyLimitPence === undefined || budgets === undefined) return <FormScreen />;

  const spentPence = spending.reduce((sum, s) => sum + s.totalPence, 0);
  const categoryLimitsPence = budgets.reduce((sum, b) => sum + b.monthlyLimitPence, 0);

  return (
    <FormScreen>
      <BudgetForm
        icon={
          <View style={[styles.icon, { backgroundColor: theme.tint }]}>
            <Icon
              name={{ ios: 'sterlingsign', material: 'account_balance_wallet' }}
              size={26}
              color={theme.onTint}
            />
          </View>
        }
        title="Monthly budget"
        subtitle={`${formatPence(spentPence)} spent in ${formatMonthName(month)} across all categories`}
        currentLimitPence={monthlyLimitPence}
        inputLabel="Monthly budget in pounds"
        hint={
          categoryLimitsPence > 0
            ? `Your category budgets add up to ${formatPence(categoryLimitsPence)}.`
            : 'One limit for everything you spend in a month.'
        }
        onSave={async (limitPence) => {
          await mutate((db) => setOverallBudget(db, limitPence));
          router.back();
        }}
        onRemove={async () => {
          await mutate((db) => removeOverallBudget(db));
          router.back();
        }}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
