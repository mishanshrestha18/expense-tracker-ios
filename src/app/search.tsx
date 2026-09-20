import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AmountInput } from '@/components/amount-input';
import { DateField } from '@/components/date-field';
import { EmptyState } from '@/components/empty-state';
import { ExpenseRow } from '@/components/expense-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { FormScreen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Radius, Spacing } from '@/constants/theme';
import { addDays, formatDayHeading, type IsoDate, toIsoDate } from '@/domain/dates';
import { formatPence, parseAmountToPence } from '@/domain/money';
import { type PaidWith, paidWithLabel } from '@/domain/paid-with';
import { describeFilter, type ExpenseFilter, summariseResult } from '@/domain/search';
import { groupByDay } from '@/domain/summary';
import { useCategories } from '@/hooks/use-app-data';
import { useSearch } from '@/hooks/use-search';
import { useTheme } from '@/hooks/use-theme';

const PAID_WITH_CHOICES: readonly PaidWith[] = ['cash', 'card', 'apple-pay'];

/** Quick date ranges, counted back from today so nothing depends on the budget period. */
const QUICK_RANGES: readonly { label: string; days: number }[] = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last year', days: 365 },
];

/**
 * "How much do I spend at Tesco?" — free text over notes and category names,
 * narrowed by category, amount, how it was paid and when, with the total and
 * the count of everything that matched.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { categories, byId } = useCategories();
  const { filter, setFilter, clear, isEmpty, result, topNotes, loaded } = useSearch();
  // The amount fields keep what was typed, since "12." is not an amount yet.
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');

  const today = toIsoDate(new Date());
  const chips = describeFilter(filter, categories);
  const summary = summariseResult(result.totalPence, result.count);
  const days = groupByDay(result.expenses);
  const dated = filter.from !== null || filter.to !== null;
  const capped = result.expenses.length < result.count;

  const update = (patch: Partial<ExpenseFilter>) => setFilter({ ...filter, ...patch });

  function clearEverything() {
    setMinText('');
    setMaxText('');
    clear();
  }

  function toggleCategory(id: number) {
    update({
      categoryIds: filter.categoryIds.includes(id)
        ? filter.categoryIds.filter((other) => other !== id)
        : [...filter.categoryIds, id],
    });
  }

  // A range the wrong way round would quietly match nothing, so each end pushes the other.
  function chooseFrom(date: IsoDate) {
    update({ from: date, to: filter.to !== null && filter.to < date ? date : filter.to });
  }

  function chooseTo(date: IsoDate) {
    update({ to: date, from: filter.from !== null && filter.from > date ? date : filter.from });
  }

  return (
    <FormScreen>
      <Card flush style={styles.search}>
        <Icon
          name={{ ios: 'magnifyingglass', material: 'search' }}
          size={18}
          color={theme.textSecondary}
        />
        <TextInput
          value={filter.text}
          onChangeText={(text) => update({ text })}
          placeholder="Shop, note or category"
          placeholderTextColor={theme.textTertiary}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          accessibilityLabel="Search expenses"
          style={[styles.searchInput, { color: theme.text }]}
        />
        {filter.text === '' ? null : (
          <IconButton
            icon={{ ios: 'xmark', material: 'close' }}
            label="Clear the search text"
            onPress={() => update({ text: '' })}
          />
        )}
      </Card>

      {chips.length === 0 ? null : (
        <View style={styles.chipRow}>
          {chips.map((chip, index) => (
            <View
              // Chips are labels rather than controls, so a repeated word is fine.
              key={`${index}-${chip}`}
              style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">{chip}</ThemedText>
            </View>
          ))}
          <IconButton
            icon={{ ios: 'xmark', material: 'close' }}
            label="Clear every filter"
            onPress={clearEverything}
          />
        </View>
      )}

      <Section title="Category">
        <View style={styles.chipRow}>
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={filter.categoryIds.includes(category.id)}
              onPress={() => toggleCategory(category.id)}
            />
          ))}
        </View>
      </Section>

      <Section title="Paid with">
        <View style={styles.chipRow}>
          {PAID_WITH_CHOICES.map((value) => (
            <Chip
              key={value}
              label={paidWithLabel(value)}
              selected={filter.paidWith === value}
              // Tapping the chosen one again clears it.
              onPress={() => update({ paidWith: filter.paidWith === value ? null : value })}
            />
          ))}
        </View>
      </Section>

      <Section title="Amount" detail="Optional">
        <Card style={styles.amounts}>
          <View style={styles.amountCell}>
            <ThemedText type="footnote" themeColor="textSecondary">
              At least
            </ThemedText>
            <AmountInput
              value={minText}
              onChangeText={(text) => {
                setMinText(text);
                update({ minPence: parseAmountToPence(text) });
              }}
              placeholder="0"
              accessibilityLabel="Smallest amount in pounds"
            />
          </View>
          <View style={styles.amountCell}>
            <ThemedText type="footnote" themeColor="textSecondary">
              At most
            </ThemedText>
            <AmountInput
              value={maxText}
              onChangeText={(text) => {
                setMaxText(text);
                update({ maxPence: parseAmountToPence(text) });
              }}
              placeholder="0"
              accessibilityLabel="Largest amount in pounds"
            />
          </View>
        </Card>
      </Section>

      <Section title="Dates" detail="Optional">
        <View style={styles.chipRow}>
          <Chip
            label="Any time"
            selected={!dated}
            onPress={() => update({ from: null, to: null })}
          />
          {QUICK_RANGES.map((range) => {
            const start = addDays(today, -(range.days - 1));
            return (
              <Chip
                key={range.label}
                label={range.label}
                selected={filter.from === start && filter.to === today}
                onPress={() => update({ from: start, to: today })}
              />
            );
          })}
        </View>
        {dated ? (
          <Card style={styles.dates}>
            <View style={styles.dateField}>
              <ThemedText type="footnote" themeColor="textSecondary">
                From
              </ThemedText>
              <DateField value={filter.from ?? addDays(today, -29)} onChange={chooseFrom} />
            </View>
            <View style={styles.dateField}>
              <ThemedText type="footnote" themeColor="textSecondary">
                To
              </ThemedText>
              <DateField value={filter.to ?? today} onChange={chooseTo} />
            </View>
          </Card>
        ) : null}
      </Section>

      {isEmpty ? (
        <EmptyState
          icon={{ ios: 'magnifyingglass', material: 'search' }}
          title="What are you looking for?"
          message="Type a shop or a note, pick a category, or set an amount or a date range. The total and the count follow along."
        />
      ) : result.count === 0 ? (
        loaded ? (
          <EmptyState
            icon={{ ios: 'tray', material: 'search_off' }}
            title="Nothing matches"
            message="No expense fits all of that. Try a shorter word, or take a filter off.">
            <Button title="Clear filters" variant="secondary" onPress={clearEverything} />
          </EmptyState>
        ) : null
      ) : (
        <>
          <Card
            style={styles.summary}
            accessible
            accessibilityLabel={
              capped
                ? `Total ${summary.spoken}. Showing the newest ${result.expenses.length}.`
                : `Total ${summary.spoken}`
            }>
            <ThemedText type="footnote" themeColor="textSecondary">
              Total
            </ThemedText>
            <ThemedText type="amountLarge">{summary.total}</ThemedText>
            <ThemedText type="footnote" themeColor="textSecondary">
              {summary.detail}
            </ThemedText>
            {capped ? (
              <ThemedText type="footnote" themeColor="textTertiary">
                {`Showing the newest ${result.expenses.length}.`}
              </ThemedText>
            ) : null}
          </Card>

          {topNotes.length > 1 ? (
            <Section title="Where it went">
              <Card flush>
                {topNotes.map((note, index) => (
                  <View
                    key={note.note}
                    style={[
                      styles.noteRow,
                      index < topNotes.length - 1 && {
                        borderBottomColor: theme.separator,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}>
                    <View style={styles.noteText}>
                      <ThemedText type="body" numberOfLines={1}>
                        {note.note}
                      </ThemedText>
                      <ThemedText type="footnote" themeColor="textSecondary">
                        {summariseResult(note.totalPence, note.count).detail}
                      </ThemedText>
                    </View>
                    <ThemedText type="amount">{formatPence(note.totalPence)}</ThemedText>
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}

          {days.map((day) => (
            <Section
              key={day.date}
              title={formatDayHeading(day.date)}
              detail={formatPence(day.totalPence)}>
              <Card flush>
                {day.items.map((expense, index) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    category={byId.get(expense.categoryId)}
                    showSeparator={index < day.items.length - 1}
                    onPress={() => router.push(`/expense/${expense.id}`)}
                  />
                ))}
              </Card>
            </Section>
          ))}
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    minHeight: 56,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    paddingVertical: Spacing.three - 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pill: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three - 4,
    borderRadius: Radius.pill,
  },
  amounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  amountCell: {
    flexGrow: 1,
    flexBasis: 130,
    gap: Spacing.half,
  },
  dates: {
    gap: Spacing.three,
  },
  dateField: {
    gap: Spacing.two,
  },
  summary: {
    gap: Spacing.one,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  noteText: {
    flex: 1,
    gap: 1,
  },
});
