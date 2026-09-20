import { describe, expect, it } from '@jest/globals';

import type { BudgetSnapshot } from '@/siri/budget-snapshot';

import { widgetPayload } from '../publish';

const snapshot = (over: Partial<BudgetSnapshot> = {}): BudgetSnapshot =>
  ({
    noun: 'month',
    period: { key: '2026-09', start: '2026-09-01', end: '2026-10-01', label: 'September' },
    monthlyLimitPence: 160000,
    spentPence: 119000,
    everydayLimitPence: null,
    everydaySpentPence: 0,
    savingsBalancePence: 42000,
    ...over,
  }) as BudgetSnapshot;

describe('widgetPayload', () => {
  it('says what is left and how far through the budget it is', () => {
    expect(widgetPayload(snapshot())).toEqual({
      left: '£410.00',
      label: 'left for September',
      spent: '£1,190.00',
      savings: '£420.00',
      ratio: 119000 / 160000,
      over: false,
    });
  });

  it('turns an overspend into "over"', () => {
    const payload = widgetPayload(snapshot({ spentPence: 178000 }));
    expect(payload).toMatchObject({ left: '£180.00', label: 'over for September', over: true });
    // The gauge is full rather than past the end.
    expect(payload.ratio).toBe(1);
  });

  it('prefers the everyday money once bills are set aside', () => {
    const payload = widgetPayload(
      snapshot({ everydayLimitPence: 65000, everydaySpentPence: 20000 }),
    );
    expect(payload).toMatchObject({ left: '£450.00', label: 'left for September' });
  });

  it('shows what has been spent when there is no budget', () => {
    expect(widgetPayload(snapshot({ monthlyLimitPence: null }))).toMatchObject({
      left: '£1,190.00',
      label: 'spent this month',
      ratio: 0,
      over: false,
    });
  });

  it('leaves savings out until there are some', () => {
    expect(widgetPayload(snapshot({ savingsBalancePence: 0 })).savings).toBeNull();
  });
});
