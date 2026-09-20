import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/screen';
import { WrapCard } from '@/components/wrap-card';
import { Spacing } from '@/constants/theme';
import { formatMonth, type IsoDate, type MonthKey, shiftMonth } from '@/domain/dates';
import {
  currentPeriodKey,
  daysInPeriod,
  periodFor,
  periodNoun,
  samePointLastPeriod,
} from '@/domain/period';
import { carryPence } from '@/domain/savings';
import { buildWrapped, wrappedText } from '@/domain/wrapped';
import {
  useCategories,
  useDailyTotals,
  useOverallBudget,
  usePeriodSpending,
  useSpendingBetween,
  useTotalBetween,
} from '@/hooks/use-app-data';
import { useSavings } from '@/hooks/use-savings';
import { useSelectedPeriod } from '@/state/period';

/** Wide enough to read, narrow enough that the portrait card still fits a screen. */
const CARD_MAX_WIDTH = 380;

/** A period's wrap-up, as one card that can be shared as a picture. */
export default function WrappedScreen() {
  const { rule } = useSelectedPeriod();
  const cardRef = useRef<View>(null);
  const [picked, setPicked] = useState<MonthKey | null>(null);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentKey = currentPeriodKey(rule);
  const finishedKey = shiftMonth(currentKey, -1);
  const finished = periodFor(finishedKey, rule);
  // The wrap-up people want is the one that has just ended; a new app has
  // nothing there yet, so it falls back to the period in progress.
  const finishedTotal = useTotalBetween(finished.start, finished.end).data;
  const month = picked ?? (finishedTotal === 0 ? currentKey : finishedKey);
  const period = periodFor(month, rule);

  const { categories } = useCategories();
  const spending = usePeriodSpending(period).data ?? [];
  const totalPence = useTotalBetween(period.start, period.end).data ?? 0;
  const limitPence = useOverallBudget().data ?? null;
  const days = useDailyTotals(period.start, period.end).data ?? [];

  const before = samePointLastPeriod(month, rule);
  const lastSpending = useSpendingBetween(before.start, before.end).data ?? [];
  const beforeTotal = useTotalBetween(before.start, before.end).data;
  // Nothing recorded then is not a 100% rise, it is nothing to compare with.
  const lastPeriodPence = beforeTotal === undefined || beforeTotal === 0 ? null : beforeTotal;

  // A closed period has its carry written down; an unfinished one is measured
  // against the budget as it stands.
  const { entries } = useSavings();
  const closed = entries.find((entry) => entry.kind === 'carry' && entry.periodKey === month);
  const carry = closed ? closed.amountPence : carryPence(limitPence, totalPence);

  const wrapped = buildWrapped({
    periodLabel: formatMonth(month),
    noun: periodNoun(rule),
    totalPence,
    limitPence,
    carryPence: carry,
    lastPeriodPence,
    spending,
    lastSpending,
    categories,
    dayCount: daysInPeriod(period),
    busiestDay: busiestDayOf(days),
  });

  async function share() {
    setMessage(null);
    setSharing(true);
    try {
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        const captured = await captureRef(cardRef, { format: 'png', quality: 1 });
        await Sharing.shareAsync(fileUri(captured), {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: `${wrapped.periodLabel} in one card`,
        });
      } else {
        // No share sheet to hand a picture to: the words do the same job.
        await Share.share({ message: wrappedText(wrapped) });
      }
    } catch (error) {
      setMessage(
        error instanceof Error && error.message !== ''
          ? error.message
          : "Sharing isn't available here.",
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <FormScreen>
      <MonthSwitcher
        title="Wrapped"
        month={month}
        isCurrent={month === currentKey}
        noun={periodNoun(rule)}
        onChange={setPicked}
      />

      <View style={styles.stage}>
        <WrapCard ref={cardRef} wrapped={wrapped} />
      </View>

      <Button
        title={sharing ? 'Sharing…' : 'Share'}
        icon={{ ios: 'square.and.arrow.up', material: 'ios_share' }}
        loading={sharing}
        onPress={() => void share()}
      />

      <ThemedText type="footnote" themeColor="textSecondary" style={styles.note}>
        {Platform.OS === 'web'
          ? 'The browser preview shares the summary as text. On your phone it shares the card as a picture.'
          : 'Shares the card above as a picture.'}
      </ThemedText>

      {message === null ? null : (
        <ThemedText type="footnote" themeColor="warning" style={styles.note}>
          {message}
        </ThemedText>
      )}
    </FormScreen>
  );
}

/** The day the most went out, for the stat row. */
function busiestDayOf(
  days: readonly { day: IsoDate; totalPence: number }[],
): { date: IsoDate; totalPence: number } | null {
  let busiest: { date: IsoDate; totalPence: number } | null = null;
  for (const day of days) {
    if (day.totalPence > 0 && (busiest === null || day.totalPence > busiest.totalPence)) {
      busiest = { date: day.day, totalPence: day.totalPence };
    }
  }
  return busiest;
}

/** `captureRef` hands back a bare path on iOS; the share sheet wants a URL. */
function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  note: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
});
