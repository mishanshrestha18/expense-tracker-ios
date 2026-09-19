import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { CategoryPicker } from '@/components/category-picker';
import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import type { Category, ExpenseInput } from '@/db/types';
import { toIsoDate } from '@/domain/dates';
import { parseAmountToPence, penceToInputValue } from '@/domain/money';
import { type PaidWith, paidWithLabel } from '@/domain/paid-with';
import { useTheme } from '@/hooks/use-theme';

interface ExpenseFormProps {
  categories: readonly Category[];
  initial?: Partial<ExpenseInput>;
  submitLabel: string;
  autoFocusAmount?: boolean;
  onSubmit: (input: ExpenseInput) => Promise<void>;
  onDelete?: () => void;
}

export function ExpenseForm({
  categories,
  initial,
  submitLabel,
  autoFocusAmount = false,
  onSubmit,
  onDelete,
}: ExpenseFormProps) {
  const theme = useTheme();
  const [amountText, setAmountText] = useState(
    initial?.amountPence ? penceToInputValue(initial.amountPence) : '',
  );
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [spentOn, setSpentOn] = useState(initial?.spentOn ?? toIsoDate(new Date()));
  const [paidWith, setPaidWith] = useState<PaidWith>(initial?.paidWith ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const amountPence = parseAmountToPence(amountText);
  const amountError = showErrors && amountPence === null;
  const categoryError = showErrors && categoryId === null;

  async function save() {
    setShowErrors(true);
    if (amountPence === null || categoryId === null) return;
    setSaving(true);
    try {
      await onSubmit({ amountPence, categoryId, note, spentOn, paidWith });
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
          autoFocus={autoFocusAmount}
          accessibilityLabel="Amount in pounds"
        />
        {amountError ? (
          <ThemedText type="footnote" style={{ color: theme.danger }}>
            Enter an amount, for example 12.50
          </ThemedText>
        ) : null}
      </Card>

      <Section title="Category">
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
        {categoryError ? (
          <ThemedText type="footnote" style={[styles.error, { color: theme.danger }]}>
            Choose a category
          </ThemedText>
        ) : null}
      </Section>

      <Section title="Note">
        <Card flush>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional, e.g. Weekly shop"
            placeholderTextColor={theme.textTertiary}
            maxLength={120}
            returnKeyType="done"
            accessibilityLabel="Note"
            style={[styles.noteInput, { color: theme.text }]}
          />
        </Card>
      </Section>

      <Section title="Date">
        <DateField value={spentOn} onChange={setSpentOn} />
      </Section>

      <Section title="Paid with" detail="Optional">
        <View style={styles.chips}>
          {(['cash', 'card', 'apple-pay'] as const).map((value) => (
            <Chip
              key={value}
              label={paidWithLabel(value)}
              selected={paidWith === value}
              // Tapping the chosen one again clears it.
              onPress={() => setPaidWith(paidWith === value ? '' : value)}
            />
          ))}
        </View>
      </Section>

      <View style={styles.actions}>
        <Button title={submitLabel} onPress={save} loading={saving} />
        {onDelete ? (
          <Button
            title="Delete expense"
            variant="destructive"
            icon={{ ios: 'trash', material: 'delete' }}
            onPress={onDelete}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  amountCard: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  noteInput: {
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
  },
  error: {
    paddingHorizontal: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
});
