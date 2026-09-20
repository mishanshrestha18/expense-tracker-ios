import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { FormScreen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Radius, Spacing } from '@/constants/theme';
import { dumpDatabase, restoreDatabase } from '@/db/backup';
import { listCategories } from '@/db/categories';
import { listExpensesBetween } from '@/db/expenses';
import {
  getPaymentAlerts,
  getWeeklyReview,
  setPaydayRule,
  setPaymentAlerts,
  setWeeklyReview,
} from '@/db/settings';
import {
  type BackupFile,
  backupFileName,
  describeBackup,
  parseBackup,
  serialiseBackup,
} from '@/domain/backup';
import { exportFileName, toCsv } from '@/domain/export';
import {
  describePaydayRule,
  formatPeriodRange,
  ordinal,
  type PaydayRule,
  periodFor,
} from '@/domain/period';
import { useDbMutation, useDbQuery } from '@/hooks/use-db-query';
import { useEnvelopesSetting } from '@/hooks/use-envelopes';
import { useTheme } from '@/hooks/use-theme';
import { requestPaymentAlerts } from '@/native/expenses-native';
import { useSelectedPeriod } from '@/state/period';
import { confirmDestructive } from '@/utils/confirm';
import { shareCsv } from '@/utils/share-file';

const DEFAULT_PAYDAY = 25;

export default function SettingsScreen() {
  const theme = useTheme();
  const mutate = useDbMutation();
  const { rule, month } = useSelectedPeriod();
  const alerts = useDbQuery('payment-alerts', getPaymentAlerts).data ?? false;
  const weekly = useDbQuery('weekly-review', getWeeklyReview).data ?? true;
  const envelopes = useEnvelopesSetting();
  const [alertError, setAlertError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupContents, setBackupContents] = useState<string | null>(null);

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

  async function exportCsv() {
    setExportMessage(null);
    setExporting(true);
    try {
      // A read, but `mutate` is how a screen reaches the database outside a query.
      const { expenses, categories } = await mutate(async (db) => ({
        expenses: await listExpensesBetween(db, '1970-01-01', '2999-12-31'),
        categories: await listCategories(db),
      }));
      const outcome = await shareCsv(exportFileName(new Date()), toCsv(expenses, categories));
      if (outcome === 'unavailable') setExportMessage("Sharing isn't available here.");
    } finally {
      setExporting(false);
    }
  }

  /**
   * Writes the whole database next to the app's own files, where it survives
   * until it is deleted, then offers it to the share sheet so it can be put
   * somewhere that survives the phone: Files, iCloud Drive, an email.
   */
  async function backUpEverything() {
    setBackingUp(true);
    try {
      // A read, but `mutate` is how a screen reaches the database outside a query.
      const backup = await mutate(dumpDatabase);
      const file = new File(Paths.document, backupFileName(backup.exportedAt));
      file.create({ overwrite: true });
      file.write(serialiseBackup(backup));
      setBackupContents(describeBackup(backup));

      if (!(await Sharing.isAvailableAsync())) {
        // The web preview has no share sheet; the file is written all the same.
        tell('Backup saved', `Sharing isn't available here. The file is called ${file.name}.`);
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    } catch {
      tell(
        'That backup was not saved',
        'Something went wrong while writing the file. Nothing in the app has changed, so it is safe to try again.',
      );
    } finally {
      setBackingUp(false);
    }
  }

  /** Reads a chosen file and asks before anything is replaced. */
  async function chooseBackup() {
    setRestoring(true);
    let backup: BackupFile;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      let text: string;
      try {
        text = await new File(picked.assets[0].uri).text();
      } catch {
        throw new Error('That file could not be opened.');
      }
      backup = parseBackup(text);
    } catch (error) {
      // Everything thrown above says something a person can act on.
      tell('That backup was not restored', reason(error));
      return;
    } finally {
      setRestoring(false);
    }

    confirmDestructive({
      title: 'Restore this backup?',
      message: `This replaces everything in the app with the backup: ${describeBackup(backup)}. It cannot be undone.`,
      confirmLabel: 'Replace everything',
      onConfirm: () => void putBackupBack(backup),
    });
  }

  async function putBackupBack(backup: BackupFile) {
    const contents = describeBackup(backup);
    setRestoring(true);
    try {
      // `mutate` refreshes every query afterwards, so all the screens catch up.
      await mutate((db) => restoreDatabase(db, backup));
      setBackupContents(contents);
      tell('Restored', `Everything in the app now comes from that backup: ${contents}.`);
    } catch (error) {
      tell('That backup was not restored', reason(error));
    } finally {
      setRestoring(false);
    }
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

      <Section title="Notifications">
        <Card>
          <View style={styles.switchRow}>
            <ThemedText type="callout" style={styles.switchLabel}>
              Tell me what&rsquo;s left
            </ThemedText>
            <Switch
              value={alerts}
              onValueChange={(value) => void toggleAlerts(value)}
              trackColor={{ true: theme.tint, false: theme.backgroundElement }}
            />
          </View>
          <ThemedText type="footnote" themeColor="textSecondary">
            Every Apple Pay tap shows the amount, the shop and what is left in that category, and a
            few days before the period ends you hear if it is heading over. A bill due today comes
            with a <ThemedText type="footnote">Paid</ThemedText> button, so it can be settled
            without opening the app.
          </ThemedText>
          <View style={styles.switchRow}>
            <ThemedText type="callout" style={styles.switchLabel}>
              Sunday round-up
            </ThemedText>
            <Switch
              value={alerts && weekly}
              disabled={!alerts}
              onValueChange={(value) => void mutate((db) => setWeeklyReview(db, value))}
              trackColor={{ true: theme.tint, false: theme.backgroundElement }}
            />
          </View>
          <ThemedText type="footnote" themeColor="textSecondary">
            One notification on Sunday evening: what is left, how it compares with last month, and
            what the savings stand to gain.
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
      <Section title="Budgets">
        <Card>
          <View style={styles.switchRow}>
            <ThemedText type="callout" style={styles.switchLabel}>
              Roll leftovers over
            </ThemedText>
            <Switch
              value={envelopes.enabled}
              onValueChange={(value) => void envelopes.setEnabled(value)}
              trackColor={{ true: theme.tint, false: theme.backgroundElement }}
            />
          </View>
          <ThemedText type="footnote" themeColor="textSecondary">
            A category that ends the period under its limit hands the difference to the next one,
            and an overspend is taken off it. Switching this off forgets what has been carried.
          </ThemedText>
        </Card>
      </Section>

      <Section title="Your data">
        <Card style={styles.actionCard}>
          <ThemedText type="callout">Every expense, as a spreadsheet file you can keep.</ThemedText>
          <Button
            title="Export as CSV"
            variant="secondary"
            icon={{ ios: 'square.and.arrow.up', material: 'share' }}
            loading={exporting}
            onPress={() => void exportCsv()}
          />
          {exportMessage ? (
            <ThemedText type="footnote" themeColor="textSecondary">
              {exportMessage}
            </ThemedText>
          ) : null}
        </Card>
      </Section>

      <Section title="Backup">
        <Card style={styles.actionCard}>
          <ThemedText type="callout">
            The whole app in one file: expenses, budgets, bills and savings.
          </ThemedText>
          <Button
            title="Back up everything"
            variant="secondary"
            icon={{ ios: 'square.and.arrow.up', material: 'backup' }}
            loading={backingUp}
            onPress={() => void backUpEverything()}
          />
          {backupContents ? (
            <ThemedText type="footnote" themeColor="textSecondary">
              {backupContents}
            </ThemedText>
          ) : null}
          <Button
            title="Restore from a backup"
            variant="secondary"
            icon={{ ios: 'square.and.arrow.down', material: 'restore' }}
            loading={restoring}
            onPress={() => void chooseBackup()}
          />
          <ThemedText type="footnote" themeColor="textSecondary">
            Restoring replaces everything in the app with what the file holds, so it asks first.
          </ThemedText>
        </Card>
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
          Keep the file in Files or iCloud Drive and a new phone can pick up where this one left
          off.
        </ThemedText>
      </Section>
    </FormScreen>
  );
}

/** The native alert on a phone, the browser's own in the web preview. */
function tell(title: string, message: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Backing up and restoring throw messages written for a person to read; a
 * stray failure from anywhere else gets a plain sentence instead of its
 * innards.
 */
function reason(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message.length > 0 && message.length <= 160
    ? `${message} Nothing in the app has changed.`
    : 'That backup could not be read. Nothing in the app has changed.';
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
  actionCard: {
    gap: Spacing.three,
  },
  footnote: {
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.control,
  },
});
