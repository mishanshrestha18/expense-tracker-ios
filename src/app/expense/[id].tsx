import { useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { ExpenseForm } from '@/components/expense-form';
import { FormScreen } from '@/components/ui/screen';
import { deleteExpense, updateExpense } from '@/db/expenses';
import type { ExpenseInput } from '@/db/types';
import { formatPence } from '@/domain/money';
import { useCategories, useExpense } from '@/hooks/use-app-data';
import { useDbMutation } from '@/hooks/use-db-query';
import { confirmDestructive } from '@/utils/confirm';

export default function EditExpenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);
  const { categories, loaded } = useCategories();
  const { data: expense } = useExpense(expenseId);
  const mutate = useDbMutation();

  if (!loaded || expense === undefined) return <FormScreen />;

  if (expense === null) {
    return (
      <FormScreen>
        <EmptyState
          icon={{ ios: 'questionmark.circle', material: 'help' }}
          title="Expense not found"
          message="It may already have been deleted."
        />
      </FormScreen>
    );
  }

  async function save(input: ExpenseInput) {
    await mutate((db) => updateExpense(db, expenseId, input));
    router.back();
  }

  function remove() {
    confirmDestructive({
      title: 'Delete this expense?',
      message: `${formatPence(expense!.amountPence)} will be removed. This can’t be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => {
        // Close first so the sheet never flashes the "not found" state.
        router.back();
        void mutate((db) => deleteExpense(db, expenseId));
      },
    });
  }

  return (
    <FormScreen>
      <ExpenseForm
        key={expense.id}
        categories={categories}
        initial={expense}
        submitLabel="Save changes"
        onSubmit={save}
        onDelete={remove}
      />
    </FormScreen>
  );
}
