import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { CategoryPicker } from '@/components/category-picker';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Radius, Spacing } from '@/constants/theme';
import type { Category, ExpenseInput } from '@/db/types';
import { formatDayHeading } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { parseQuickAdd } from '@/domain/quick-add';
import { useTheme } from '@/hooks/use-theme';

interface QuickAddBarProps {
  categories: readonly Category[];
  onAdd: (input: ExpenseInput) => Promise<void>;
}

type Feedback = { kind: 'success' | 'error'; text: string };

/**
 * One-line entry: type or dictate "285 groceries" and press return.
 * Shows a live preview of how the text was understood before saving.
 */
export function QuickAddBar({ categories, onAdd }: QuickAddBarProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [pickedCategoryId, setPickedCategoryId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = parseQuickAdd(text, categories);
  const categoryId = parsed.ok ? (parsed.categoryId ?? pickedCategoryId) : null;
  const category = categories.find((c) => c.id === categoryId);

  // Confirmations fade out on their own; errors stay until the text changes.
  useEffect(() => {
    if (feedback?.kind !== 'success') return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const onChangeText = (value: string) => {
    setText(value);
    setFeedback(null);
  };

  async function submit() {
    if (!parsed.ok) {
      if (parsed.reason === 'no-amount') {
        setFeedback({ kind: 'error', text: 'Include an amount, e.g. “12.50 coffee”.' });
      }
      return;
    }
    if (!category) {
      setFeedback({ kind: 'error', text: 'Pick a category below.' });
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        amountPence: parsed.amountPence,
        categoryId: category.id,
        note: parsed.note,
        spentOn: parsed.spentOn,
      });
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setText('');
      setPickedCategoryId(null);
      setFeedback({
        kind: 'success',
        text: `Added ${formatPence(parsed.amountPence)} to ${category.name}.`,
      });
    } catch {
      setFeedback({ kind: 'error', text: 'Could not save that expense. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={[styles.inputRow, { backgroundColor: theme.backgroundElement }]}>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          onSubmitEditing={submit}
          placeholder="Try “285 groceries” or “4.20 coffee”"
          placeholderTextColor={theme.textTertiary}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Quick add an expense"
          accessibilityHint="Type an amount and a category, for example 285 groceries"
          style={[styles.input, { color: theme.text }]}
        />
        <IconButton
          icon={{ ios: 'plus', material: 'add' }}
          label="Add expense"
          variant="filled"
          size={34}
          disabled={saving || !parsed.ok || !category}
          onPress={submit}
        />
      </View>

      {parsed.ok ? (
        <View style={styles.preview} accessibilityLiveRegion="polite">
          <ThemedText type="amount">{formatPence(parsed.amountPence)}</ThemedText>
          {category ? (
            <View style={styles.previewCategory}>
              <CategoryBadge category={category} size={20} />
              <ThemedText type="small">{category.name}</ThemedText>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Choose a category
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {formatDayHeading(parsed.spentOn)}
          </ThemedText>
          {parsed.note ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              style={styles.note}>
              “{parsed.note}”
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {parsed.ok && parsed.categoryId === null ? (
        <CategoryPicker
          compact
          categories={categories}
          value={pickedCategoryId}
          onChange={setPickedCategoryId}
        />
      ) : null}

      {feedback ? (
        <ThemedText
          type="footnote"
          style={{ color: feedback.kind === 'success' ? theme.tint : theme.danger }}
          accessibilityLiveRegion="polite">
          {feedback.text}
        </ThemedText>
      ) : text === '' ? (
        <ThemedText type="footnote" themeColor="textSecondary">
          Tip: tap the microphone on your keyboard and just say it.
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three - 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one + 2,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: Spacing.two + 2,
  },
  preview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
  previewCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  note: {
    flexShrink: 1,
  },
});
