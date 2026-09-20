import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { FormScreen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import type { SavingsGoal, SavingsGoalInput } from '@/db/types';
import {
  currentMonthKey,
  formatMonth,
  type MonthKey,
  monthKeyOf,
  shiftMonth,
} from '@/domain/dates';
import { parseAmountToPence, penceToInputValue } from '@/domain/money';
import { useGoals } from '@/hooks/use-goals';
import { useTheme } from '@/hooks/use-theme';
import { confirmDestructive } from '@/utils/confirm';

/** How far ahead "by a month" starts when a date is first switched on. */
const DEFAULT_MONTHS_AHEAD = 6;

/**
 * One savings goal: what the money is for, how much of it, and when it is
 * wanted by. `?id=` edits an existing goal; without one this adds a goal at
 * the end of the queue.
 */
export default function GoalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goalId = id === undefined ? null : Number(id);
  const { goals, loaded, add, update, remove } = useGoals();

  if (goalId !== null && !loaded) return <FormScreen />;

  const existing = goalId === null ? null : (goals.find((goal) => goal.id === goalId) ?? null);

  if (goalId !== null && existing === null) {
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

  async function save(input: SavingsGoalInput) {
    if (existing) await update(existing.id, input);
    else await add(input);
    router.back();
  }

  function confirmDelete() {
    if (!existing) return;
    confirmDestructive({
      title: `Delete ${existing.name}?`,
      message: 'Your savings balance stays exactly as it is. Only the plan for it goes.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        router.back();
        void remove(existing.id);
      },
    });
  }

  return (
    <FormScreen>
      <GoalForm
        key={existing?.id ?? 'new'}
        goal={existing}
        onSubmit={save}
        onDelete={existing ? confirmDelete : undefined}
      />
    </FormScreen>
  );
}

interface GoalFormProps {
  goal: SavingsGoal | null;
  onSubmit: (input: SavingsGoalInput) => Promise<void>;
  onDelete?: () => void;
}

function GoalForm({ goal, onSubmit, onDelete }: GoalFormProps) {
  const theme = useTheme();
  const thisMonth = currentMonthKey(new Date());

  const [name, setName] = useState(goal?.name ?? '');
  const [amountText, setAmountText] = useState(goal ? penceToInputValue(goal.targetPence) : '');
  const [month, setMonth] = useState<MonthKey | null>(
    goal?.targetDate ? monthKeyOf(goal.targetDate) : null,
  );
  const [note, setNote] = useState(goal?.note ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetPence = parseAmountToPence(amountText);
  const nameError = showErrors && name.trim() === '';
  const amountError = showErrors && targetPence === null;

  async function save() {
    setShowErrors(true);
    if (targetPence === null || name.trim() === '') return;

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        targetPence,
        // A goal is judged by the month it lands in, so the day is the first.
        targetDate: month === null ? null : `${month}-01`,
        note: note.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Card style={styles.amountCard}>
        <AmountInput
          value={amountText}
          onChangeText={setAmountText}
          autoFocus={goal === null}
          accessibilityLabel="Target amount in pounds"
        />
        {amountError ? (
          <ThemedText type="footnote" style={{ color: theme.danger }}>
            Enter a target, for example 2000
          </ThemedText>
        ) : null}
      </Card>

      <Section title="What is it for">
        <Card flush>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Japan, New laptop, Rainy day…"
            placeholderTextColor={theme.textTertiary}
            maxLength={60}
            returnKeyType="done"
            accessibilityLabel="Goal name"
            style={[styles.textInput, { color: theme.text }]}
          />
        </Card>
        {nameError ? (
          <ThemedText type="footnote" style={[styles.error, { color: theme.danger }]}>
            Give it a name
          </ThemedText>
        ) : null}
      </Section>

      <Section title="By when" detail="Optional">
        <View style={styles.chips}>
          <Chip label="No rush" selected={month === null} onPress={() => setMonth(null)} />
          <Chip
            label="By a month"
            selected={month !== null}
            onPress={() => setMonth(month ?? shiftMonth(thisMonth, DEFAULT_MONTHS_AHEAD))}
          />
        </View>
        {month !== null ? (
          <Card style={styles.monthCard}>
            <IconButton
              icon={{ ios: 'chevron.left', material: 'chevron_left' }}
              label="A month earlier"
              size={44}
              disabled={month <= thisMonth}
              onPress={() => setMonth(shiftMonth(month, -1))}
            />
            <ThemedText
              type="body"
              style={styles.month}
              accessibilityLabel={`Wanted by ${formatMonth(month)}`}>
              {formatMonth(month)}
            </ThemedText>
            <IconButton
              icon={{ ios: 'chevron.right', material: 'chevron_right' }}
              label="A month later"
              size={44}
              onPress={() => setMonth(shiftMonth(month, 1))}
            />
          </Card>
        ) : null}
      </Section>

      <Section title="Note" detail="Optional">
        <Card flush>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Two weeks in spring"
            placeholderTextColor={theme.textTertiary}
            maxLength={80}
            returnKeyType="done"
            accessibilityLabel="Note"
            style={[styles.textInput, { color: theme.text }]}
          />
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button title={goal ? 'Save changes' : 'Add goal'} onPress={save} loading={saving} />
        {onDelete ? (
          <Button
            title="Delete"
            variant="destructive"
            icon={{ ios: 'trash', material: 'delete' }}
            onPress={onDelete}
          />
        ) : null}
      </View>

      <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
        Goals share the one savings balance and fill from the top: the first goal takes what it
        needs, and whatever is left flows to the next.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
  },
  amountCard: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  textInput: {
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  month: {
    flex: 1,
    textAlign: 'center',
  },
  error: {
    paddingHorizontal: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
  footnote: {
    paddingHorizontal: Spacing.one,
  },
});
