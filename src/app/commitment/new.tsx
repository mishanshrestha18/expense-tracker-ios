import { useLocalSearchParams, useRouter } from 'expo-router';

import { CommitmentForm, type CommitmentFormValues } from '@/components/commitment-form';
import { FormScreen } from '@/components/ui/screen';
import { addCommitment, setCommitmentAmount } from '@/db/commitments';
import { toIsoDate } from '@/domain/dates';
import { useCategories } from '@/hooks/use-app-data';
import { useDbMutation } from '@/hooks/use-db-query';

/**
 * A new repeating cost. The starter chips on the Bills tab pre-fill `name`
 * and `category`, because a blank form is where setting up a budget dies.
 */
export default function NewCommitmentScreen() {
  const router = useRouter();
  const { name, category } = useLocalSearchParams<{ name?: string; category?: string }>();
  const { categories, loaded } = useCategories();
  const mutate = useDbMutation();

  if (!loaded) return <FormScreen />;

  const suggested = categories.find((c) => c.name.toLowerCase() === category?.toLowerCase());

  async function save(values: CommitmentFormValues) {
    const today = toIsoDate(new Date());
    // A bill dated earlier this period still needs an amount on its due date.
    const from = values.anchorMonth < today.slice(0, 7) ? `${values.anchorMonth}-01` : today;

    await mutate(async (db) => {
      const id = await addCommitment(
        db,
        {
          name: values.name,
          categoryId: values.categoryId,
          kind: values.kind,
          dueDay: values.dueDay,
          everyMonths: values.everyMonths,
          anchorMonth: values.anchorMonth,
          endedOn: null,
        },
        values.amountPence,
        from,
      );
      if (values.change) {
        await setCommitmentAmount(db, id, values.change.effectiveFrom, values.change.amountPence);
      }
    });
    router.back();
  }

  return (
    <FormScreen>
      <CommitmentForm
        categories={categories}
        initial={{ name: name ?? '', categoryId: suggested?.id }}
        submitLabel="Add it"
        onSubmit={save}
      />
    </FormScreen>
  );
}
