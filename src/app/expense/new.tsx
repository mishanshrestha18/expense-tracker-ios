import { useLocalSearchParams, useRouter } from 'expo-router';

import { ExpenseForm } from '@/components/expense-form';
import { FormScreen } from '@/components/ui/screen';
import { addExpense } from '@/db/expenses';
import type { ExpenseInput } from '@/db/types';
import { periodKeyOf } from '@/domain/period';
import { parseQuickAdd } from '@/domain/quick-add';
import { useCategories } from '@/hooks/use-app-data';
import { useDbMutation } from '@/hooks/use-db-query';
import { useSelectedPeriod } from '@/state/period';

/**
 * New expense form. Accepts an optional `text` param that is pre-filled via the
 * quick-add parser, e.g. `expenses://expense/new?text=285%20groceries` — the hook
 * for Shortcuts and Siri later.
 */
export default function NewExpenseScreen() {
  const router = useRouter();
  const { text } = useLocalSearchParams<{ text?: string }>();
  const { categories, loaded } = useCategories();
  const mutate = useDbMutation();
  const { setMonth, rule } = useSelectedPeriod();

  if (!loaded) return <FormScreen />;

  const parsed = text ? parseQuickAdd(text, categories) : null;
  const initial: Partial<ExpenseInput> | undefined = parsed?.ok
    ? {
        amountPence: parsed.amountPence,
        categoryId: parsed.categoryId ?? undefined,
        note: parsed.note,
        spentOn: parsed.spentOn,
        paidWith: parsed.paidWith,
      }
    : undefined;

  async function save(input: ExpenseInput) {
    await mutate((db) => addExpense(db, input));
    setMonth(periodKeyOf(input.spentOn, rule));
    router.back();
  }

  return (
    <FormScreen>
      <ExpenseForm
        categories={categories}
        initial={initial}
        submitLabel="Add expense"
        autoFocusAmount={!initial}
        onSubmit={save}
      />
    </FormScreen>
  );
}
