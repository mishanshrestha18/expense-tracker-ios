import { useLocalSearchParams, useRouter } from 'expo-router';

import { CommitmentForm, type CommitmentFormValues } from '@/components/commitment-form';
import { EmptyState } from '@/components/empty-state';
import { FormScreen } from '@/components/ui/screen';
import {
  deleteCommitment,
  removeCommitmentAmount,
  setCommitmentAmount,
  updateCommitment,
} from '@/db/commitments';
import { amountOn, dueDatesBetween, nextAmountChange } from '@/domain/commitments';
import { addDays, toIsoDate } from '@/domain/dates';
import { useCategories } from '@/hooks/use-app-data';
import { useCommitments } from '@/hooks/use-commitments';
import { useDbMutation } from '@/hooks/use-db-query';
import { confirmDestructive } from '@/utils/confirm';

export default function EditCommitmentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const commitmentId = Number(id);
  const { categories, loaded } = useCategories();
  const commitments = useCommitments().data;
  const mutate = useDbMutation();

  if (!loaded || commitments === undefined) return <FormScreen />;

  const commitment = commitments.find((c) => c.id === commitmentId);
  if (!commitment) {
    return (
      <FormScreen>
        <EmptyState
          icon={{ ios: 'questionmark.circle', material: 'help' }}
          title="Not found"
          message="It may already have been deleted."
        />
      </FormScreen>
    );
  }

  const today = toIsoDate(new Date());
  const current = amountOn(commitment, today);
  const change = nextAmountChange(commitment, new Date());
  // The row the current amount lives on, so editing it rewrites history rather
  // than pretending the old price never existed.
  const currentFrom =
    [...commitment.amounts].reverse().find((a) => a.effectiveFrom <= today)?.effectiveFrom ??
    commitment.amounts[0]?.effectiveFrom ??
    today;
  const [nextDueOn] = dueDatesBetween(commitment, today, addDays(today, 400));

  async function save(values: CommitmentFormValues) {
    await mutate(async (db) => {
      await updateCommitment(db, commitmentId, {
        name: values.name,
        categoryId: values.categoryId,
        kind: values.kind,
        dueDay: values.dueDay,
        everyMonths: values.everyMonths,
        anchorMonth: values.anchorMonth,
        endedOn: null,
      });
      await setCommitmentAmount(db, commitmentId, currentFrom, values.amountPence);

      if (values.change) {
        await setCommitmentAmount(
          db,
          commitmentId,
          values.change.effectiveFrom,
          values.change.amountPence,
        );
        // A change moved to a new date leaves the old row behind otherwise.
        if (change && change.effectiveFrom !== values.change.effectiveFrom) {
          await removeCommitmentAmount(db, commitmentId, change.effectiveFrom);
        }
      } else if (change) {
        await removeCommitmentAmount(db, commitmentId, change.effectiveFrom);
      }
    });
    router.back();
  }

  function remove() {
    confirmDestructive({
      title: `Delete ${commitment!.name}?`,
      message: 'Expenses already recorded for it stay; only the schedule goes.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        router.back();
        void mutate((db) => deleteCommitment(db, commitmentId));
      },
    });
  }

  return (
    <FormScreen>
      <CommitmentForm
        key={commitment.id}
        categories={categories}
        initial={{
          name: commitment.name,
          categoryId: commitment.categoryId,
          kind: commitment.kind,
          everyMonths: commitment.everyMonths,
          amountPence: current ?? undefined,
          nextDueOn,
          change: change
            ? { amountPence: change.toPence, effectiveFrom: change.effectiveFrom }
            : null,
        }}
        submitLabel="Save changes"
        onSubmit={save}
        onDelete={remove}
      />
    </FormScreen>
  );
}
