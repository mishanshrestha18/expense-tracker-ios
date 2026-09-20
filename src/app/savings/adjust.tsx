import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { FormScreen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import { parseAmountToPence } from '@/domain/money';
import { useSavings } from '@/hooks/use-savings';
import { useTheme } from '@/hooks/use-theme';

/** Moving money in or out of savings by hand, for anything the budget can't see. */
export default function AdjustSavingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { direction } = useLocalSearchParams<{ direction?: string }>();
  const { adjust } = useSavings();

  const [paying, setPaying] = useState(direction !== 'out');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);

  const amountPence = parseAmountToPence(amountText);

  async function save() {
    setShowError(true);
    if (amountPence === null) return;
    setSaving(true);
    try {
      await adjust(paying ? amountPence : -amountPence, note.trim());
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScreen>
      <View style={styles.form}>
        <Card style={styles.amountCard}>
          <AmountInput
            value={amountText}
            onChangeText={setAmountText}
            autoFocus
            accessibilityLabel="Amount in pounds"
          />
          {showError && amountPence === null ? (
            <ThemedText type="footnote" style={{ color: theme.danger }}>
              Enter an amount, for example 50
            </ThemedText>
          ) : null}
        </Card>

        <Section title="Which way">
          <View style={styles.chips}>
            <Chip label="Into savings" selected={paying} onPress={() => setPaying(true)} />
            <Chip label="Out of savings" selected={!paying} onPress={() => setPaying(false)} />
          </View>
        </Section>

        <Section title="Note" detail="Optional">
          <Card flush>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={paying ? 'Birthday money' : 'Car repair'}
              placeholderTextColor={theme.textTertiary}
              maxLength={80}
              returnKeyType="done"
              accessibilityLabel="Note"
              style={[styles.noteInput, { color: theme.text }]}
            />
          </Card>
        </Section>

        <Button title={paying ? 'Add to savings' : 'Take out'} onPress={save} loading={saving} />

        <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
          This only moves the number in the app. Nothing leaves or reaches a bank.
        </ThemedText>
      </View>
    </FormScreen>
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
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  noteInput: {
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
  },
  footnote: {
    paddingHorizontal: Spacing.one,
  },
});
