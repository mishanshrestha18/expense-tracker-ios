import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { parseAmountToPence, penceToInputValue } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

interface BudgetFormProps {
  icon: React.ReactNode;
  title: string;
  /** Context under the title, e.g. how much has been spent so far. */
  subtitle: string;
  currentLimitPence: number | null;
  /** VoiceOver label for the amount field. */
  inputLabel: string;
  /** Guidance under the amount, e.g. how the category budgets add up. */
  hint?: string;
  onSave: (limitPence: number) => Promise<void>;
  onRemove: () => Promise<void>;
}

/** Editor shared by the overall monthly budget and the per-category budgets. */
export function BudgetForm({
  icon,
  title,
  subtitle,
  currentLimitPence,
  inputLabel,
  hint,
  onSave,
  onRemove,
}: BudgetFormProps) {
  const theme = useTheme();
  const [limitText, setLimitText] = useState(
    currentLimitPence === null ? '' : penceToInputValue(currentLimitPence),
  );
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);
  const limitPence = parseAmountToPence(limitText);

  async function save() {
    setShowError(true);
    if (limitPence === null) return;
    setSaving(true);
    try {
      await onSave(limitPence);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.header}>
        {icon}
        <ThemedText type="title">{title}</ThemedText>
        <ThemedText type="callout" themeColor="textSecondary" style={styles.center}>
          {subtitle}
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
          accessibilityLabel={inputLabel}
        />
        {showError && limitPence === null ? (
          <ThemedText type="footnote" style={{ color: theme.danger }}>
            Enter a limit, for example 300
          </ThemedText>
        ) : null}
        {hint ? (
          <ThemedText type="footnote" themeColor="textSecondary" style={styles.center}>
            {hint}
          </ThemedText>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button title="Save budget" onPress={save} loading={saving} />
        {currentLimitPence !== null ? (
          <Button title="Remove budget" variant="destructive" onPress={() => void onRemove()} />
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
  center: {
    textAlign: 'center',
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
