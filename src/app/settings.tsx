import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { FormScreen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Radius, Spacing } from '@/constants/theme';
import { getPaymentAlerts, setPaydayRule, setPaymentAlerts } from '@/db/settings';
import {
  describePaydayRule,
  formatPeriodRange,
  ordinal,
  type PaydayRule,
  periodFor,
} from '@/domain/period';
import { useDbMutation, useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { requestPaymentAlerts } from '@/native/expenses-native';
import { useSelectedPeriod } from '@/state/period';

const DEFAULT_PAYDAY = 25;

export default function SettingsScreen() {
  const theme = useTheme();
  const mutate = useDbMutation();
  const { rule, month } = useSelectedPeriod();
  const alerts = useDbQuery('payment-alerts', getPaymentAlerts).data ?? false;
  const [alertError, setAlertError] = useState<string | null>(null);

  const day = rule.kind === 'day' ? rule.day : DEFAULT_PAYDAY;
  const weekendAdjust = rule.kind === 'day' ? rule.weekendAdjust : true;

  const choose = (next: PaydayRule) => void mutate((db) => setPaydayRule(db, next));

  async function toggleAlerts(on: boolean) {
    setAlertError(null);
    if (on && !(await requestPaymentAlerts())) {
      setAlertError('Turn notifications on for Expenses in the Settings app, then try again.');
      return;
    }
    await mutate((db) => setPaymentAlerts(db, on));
  }

  return (
    <FormScreen>
      <Section title="Budget period" detail={describePaydayRule(rule)}>
        <Card flush>
          <Option
            label="Calendar months"
            detail="The 1st to the end of the month"
            selected={rule.kind === 'calendar'}
            onPress={() => choose({ kind: 'calendar' })}
          />
          <Option
            label="From payday"
            detail={`The ${ordinal(day)} of each month`}
            selected={rule.kind === 'day'}
            onPress={() => choose({ kind: 'day', day, weekendAdjust })}
          />
          <Option
            label="Last working day"
            detail="Paid on the last weekday of the month"
            selected={rule.kind === 'lastWorkingDay'}
            onPress={() => choose({ kind: 'lastWorkingDay' })}
            last
          />
        </Card>

        {rule.kind === 'day' ? (
          <Card style={styles.dayCard}>
            <View style={styles.dayRow}>
              <ThemedText type="callout">Payday</ThemedText>
              <View style={styles.stepper}>
                <IconButton
                  icon={{ ios: 'minus', material: 'remove' }}
                  label="Earlier payday"
                  disabled={day <= 1}
                  onPress={() => choose({ kind: 'day', day: day - 1, weekendAdjust })}
                />
                <ThemedText type="amount" style={styles.dayValue}>
                  {ordinal(day)}
                </ThemedText>
                <IconButton
                  icon={{ ios: 'plus', material: 'add' }}
                  label="Later payday"
                  disabled={day >= 31}
                  onPress={() => choose({ kind: 'day', day: day + 1, weekendAdjust })}
                />
              </View>
            </View>
            <View style={styles.switchRow}>
              <ThemedText type="callout" style={styles.switchLabel}>
                Move weekend paydays to the Friday before
              </ThemedText>
              <Switch
                value={weekendAdjust}
                onValueChange={(value) => choose({ kind: 'day', day, weekendAdjust: value })}
                trackColor={{ true: theme.tint, false: theme.backgroundElement }}
              />
            </View>
          </Card>
        ) : null}

        <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
          {`Budgets, charts and the daily allowance all follow this period. This one runs ${formatPeriodRange(
            periodFor(month, rule),
          )}.`}
        </ThemedText>
      </Section>

      <Section title="Apple Pay">
        <Card>
          <View style={styles.switchRow}>
            <ThemedText type="callout" style={styles.switchLabel}>
              Notify me when a payment is added
            </ThemedText>
            <Switch
              value={alerts}
              onValueChange={(value) => void toggleAlerts(value)}
              trackColor={{ true: theme.tint, false: theme.backgroundElement }}
            />
          </View>
          <ThemedText type="footnote" themeColor="textSecondary">
            Each tap shows the amount, the shop and what is left in that category.
          </ThemedText>
          {alertError ? (
            <ThemedText type="footnote" style={{ color: theme.danger }}>
              {alertError}
            </ThemedText>
          ) : null}
        </Card>
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
          Payments arrive from the Wallet automation in the Shortcuts app. See
          docs/install-on-iphone.md for the one-time setup.
        </ThemedText>
      </Section>
    </FormScreen>
  );
}

interface OptionProps {
  label: string;
  detail: string;
  selected: boolean;
  last?: boolean;
  onPress: () => void;
}

function Option({ label, detail, selected, last = false, onPress }: OptionProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
        },
        pressed && styles.pressed,
      ]}>
      <View style={styles.optionText}>
        <ThemedText type="callout">{label}</ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
      {selected ? (
        <Icon name={{ ios: 'checkmark', material: 'check' }} size={18} color={theme.tint} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  dayCard: {
    gap: Spacing.three,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayValue: {
    minWidth: 56,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 44,
  },
  switchLabel: {
    flex: 1,
  },
  footnote: {
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.control,
  },
});
