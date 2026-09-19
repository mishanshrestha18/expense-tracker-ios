import { useLocalSearchParams, useRouter } from 'expo-router';

import { BudgetForm } from '@/components/budget-form';
import { CategoryBadge } from '@/components/category-badge';
import { EmptyState } from '@/components/empty-state';
import { FormScreen } from '@/components/ui/screen';
import { removeBudget, setBudget } from '@/db/budgets';
import { formatMonthName } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { useBudgets, useCategories, useMonthSpending } from '@/hooks/use-app-data';
import { useDbMutation } from '@/hooks/use-db-query';
import { useSelectedMonth } from '@/state/selected-month';

export default function CategoryBudgetScreen() {
  const router = useRouter();
  const mutate = useDbMutation();
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

  const spentPence = spending.find((s) => s.categoryId === id)?.totalPence ?? 0;

  return (
    <FormScreen>
      <BudgetForm
        key={category.id}
        icon={<CategoryBadge category={category} size={52} />}
        title={category.name}
        subtitle={`${formatPence(spentPence)} spent in ${formatMonthName(month)}`}
        currentLimitPence={budgets.find((b) => b.categoryId === id)?.monthlyLimitPence ?? null}
        inputLabel={`Monthly limit for ${category.name} in pounds`}
        onSave={async (limitPence) => {
          await mutate((db) => setBudget(db, id, limitPence));
          router.back();
        }}
        onRemove={async () => {
          await mutate((db) => removeBudget(db, id));
          router.back();
        }}
      />
    </FormScreen>
  );
}
