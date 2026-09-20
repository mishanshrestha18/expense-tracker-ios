/**
 * The Home Screen and Lock Screen widget reads a small, already-formatted
 * summary out of the shared App Group — it never opens the database. The
 * writing side is here; the widget itself is in targets/widget/index.swift.
 *
 * Everything degrades to nothing when the widget was not built: the native
 * side of `ExtensionStorage` is absent, and its calls quietly do nothing.
 */
import { ExtensionStorage } from '@bacons/apple-targets';

import { formatPence } from '@/domain/money';
import { type BudgetSnapshot, remainingPence } from '@/siri/budget-snapshot';

/** Must match `appGroup` in targets/widget/index.swift. */
const APP_GROUP = 'group.com.nicklane123.expenses';
const STORAGE_KEY = 'budget';
const WIDGET_KIND = 'ExpensesWidget';

export interface WidgetBudget {
  left: string;
  label: string;
  spent: string;
  savings: string | null;
  /** Spent ÷ budget, clamped to 0–1 for the gauge. */
  ratio: number;
  over: boolean;
}

export function widgetPayload(snapshot: BudgetSnapshot): WidgetBudget {
  const left = remainingPence(snapshot);
  const over = left !== null && left < 0;
  const limit = snapshot.monthlyLimitPence;

  return {
    left: left === null ? formatPence(snapshot.spentPence) : formatPence(Math.abs(left)),
    label:
      left === null
        ? `spent this ${snapshot.noun}`
        : `${over ? 'over' : 'left'} for ${snapshot.period.label}`,
    spent: formatPence(snapshot.spentPence),
    savings: snapshot.savingsBalancePence > 0 ? formatPence(snapshot.savingsBalancePence) : null,
    ratio: limit === null || limit <= 0 ? 0 : Math.min(Math.max(snapshot.spentPence / limit, 0), 1),
    over,
  };
}

/** Hands the widget its numbers and asks iOS to redraw it. */
export function publishWidget(snapshot: BudgetSnapshot): void {
  const storage = new ExtensionStorage(APP_GROUP);
  storage.set(STORAGE_KEY, JSON.stringify(widgetPayload(snapshot)));
  ExtensionStorage.reloadWidget(WIDGET_KIND);
}
