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
import type { Category, CommitmentKind } from '@/db/types';
import { addDays, type IsoDate, monthKeyOf, toIsoDate } from '@/domain/dates';
import { parseAmountToPence, penceToInputValue } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

export interface CommitmentFormValues {
  name: string;
  categoryId: number;
  kind: CommitmentKind;
  dueDay: number;
  everyMonths: number;
  anchorMonth: string;
  amountPence: number;
  /** A price rise or cut that is already known about. */
  change: { amountPence: number; effectiveFrom: IsoDate } | null;
}

interface CommitmentFormProps {
  categories: readonly Category[];
  initial?: Partial<CommitmentFormValues> & { nextDueOn?: IsoDate; changeFrom?: IsoDate };
  submitLabel: string;
  onSubmit: (values: CommitmentFormValues) => Promise<void>;
  onDelete?: () => void;
}

const FREQUENCIES: { label: string; everyMonths: number }[] = [
  { label: 'Monthly', everyMonths: 1 },
  { label: 'Every 3 months', everyMonths: 3 },
  { label: 'Yearly', everyMonths: 12 },
];

/**
 * One repeating cost: what it is, how much, how often, and any change already
 * pencilled in for a future date.
 */
export function CommitmentForm({
  categories,
  initial,
  submitLabel,
  onSubmit,
  onDelete,
}: CommitmentFormProps) {
  const theme = useTheme();
  const today = toIsoDate(new Date());

  const [name, setName] = useState(initial?.name ?? '');
  const [amountText, setAmountText] = useState(
    initial?.amountPence ? penceToInputValue(initial.amountPence) : '',
  );
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [kind, setKind] = useState<CommitmentKind>(initial?.kind ?? 'fixed');
  const [everyMonths, setEveryMonths] = useState(initial?.everyMonths ?? 1);
  const [nextDueOn, setNextDueOn] = useState<IsoDate>(initial?.nextDueOn ?? addDays(today, 7));
  const [changing, setChanging] = useState(initial?.change != null);
  const [changeText, setChangeText] = useState(
    initial?.change ? penceToInputValue(initial.change.amountPence) : '',
  );
  const [changeFrom, setChangeFrom] = useState<IsoDate>(
    initial?.change?.effectiveFrom ?? initial?.changeFrom ?? addDays(today, 30),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const amountPence = parseAmountToPence(amountText);
  const changePence = parseAmountToPence(changeText);
  const nameError = showErrors && name.trim() === '';
  const amountError = showErrors && amountPence === null;
  const categoryError = showErrors && categoryId === null;
  const changeError = showErrors && changing && changePence === null;

  async function save() {
    setShowErrors(true);
    if (amountPence === null || categoryId === null || name.trim() === '') return;
    if (changing && changePence === null) return;

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        categoryId,
        kind,
        dueDay: Number(nextDueOn.slice(8, 10)),
        everyMonths,
        anchorMonth: monthKeyOf(nextDueOn),
        amountPence,
        change:
          changing && changePence !== null
            ? { amountPence: changePence, effectiveFrom: changeFrom }
            : null,
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
          autoFocus={!initial?.amountPence}
          accessibilityLabel="Amount in pounds"
        />
        {amountError ? (
          <ThemedText type="footnote" style={{ color: theme.danger }}>
            Enter an amount, for example 500
          </ThemedText>
        ) : null}
      </Card>

      <Section title="What is it">
        <Card flush>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Rent, Broadband, Car insurance…"
            placeholderTextColor={theme.textTertiary}
            maxLength={60}
            returnKeyType="done"
            accessibilityLabel="Name"
            style={[styles.nameInput, { color: theme.text }]}
          />
        </Card>
        {nameError ? (
          <ThemedText type="footnote" style={[styles.error, { color: theme.danger }]}>
            Give it a name
          </ThemedText>
        ) : null}
      </Section>

      <Section title="Category">
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
        {categoryError ? (
          <ThemedText type="footnote" style={[styles.error, { color: theme.danger }]}>
            Choose a category
          </ThemedText>
        ) : null}
      </Section>

      <Section title="How often">
        <View style={styles.chips}>
          {FREQUENCIES.map((frequency) => (
            <Chip
              key={frequency.everyMonths}
              label={frequency.label}
              selected={everyMonths === frequency.everyMonths}
              onPress={() => setEveryMonths(frequency.everyMonths)}
            />
          ))}
        </View>
      </Section>

      <Section title="Next payment" detail={everyMonths === 1 ? 'Every month on this day' : ''}>
        <DateField value={nextDueOn} onChange={setNextDueOn} />
      </Section>

      <Section title="Amount">
        <View style={styles.chips}>
          <Chip
            label="Same every time"
            selected={kind === 'fixed'}
            onPress={() => setKind('fixed')}
          />
          <Chip label="Varies" selected={kind === 'variable'} onPress={() => setKind('variable')} />
        </View>
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.hint}>
          {kind === 'fixed'
            ? 'Tell me in advance when it changes and I’ll remind you before it does.'
            : 'Energy and water move every month, so this is an estimate and I won’t nag about it.'}
        </ThemedText>
      </Section>

      {kind === 'fixed' ? (
        <Section title="Changing soon?">
          <View style={styles.chips}>
            <Chip label="No" selected={!changing} onPress={() => setChanging(false)} />
            <Chip label="Yes" selected={changing} onPress={() => setChanging(true)} />
          </View>
          {changing ? (
            <View style={styles.change}>
              <Card>
                <ThemedText type="footnote" themeColor="textSecondary">
                  New amount
                </ThemedText>
                <AmountInput
                  value={changeText}
                  onChangeText={setChangeText}
                  accessibilityLabel="New amount in pounds"
                />
                {changeError ? (
                  <ThemedText type="footnote" style={{ color: theme.danger }}>
                    Enter the new amount
                  </ThemedText>
                ) : null}
              </Card>
              <ThemedText type="footnote" themeColor="textSecondary" style={styles.hint}>
                From when?
              </ThemedText>
              <DateField value={changeFrom} onChange={setChangeFrom} />
            </View>
          ) : null}
        </Section>
      ) : null}

      <View style={styles.actions}>
        <Button title={submitLabel} onPress={save} loading={saving} />
        {onDelete ? (
          <Button
            title="Delete"
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
  amountCard: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  nameInput: {
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  change: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  hint: {
    paddingHorizontal: Spacing.one,
  },
  error: {
    paddingHorizontal: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
});
