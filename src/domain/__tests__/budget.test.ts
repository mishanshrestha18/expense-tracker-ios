import { describe, expect, it } from '@jest/globals';

import { budgetOverview, budgetProgress, type BudgetStatus, dailyAllowancePence } from '../budget';

describe('budgetProgress', () => {
  it('reports no budget', () => {
    expect(budgetProgress(1200, null)).toEqual({
      spentPence: 1200,
      limitPence: null,
      remainingPence: null,
      ratio: null,
      status: 'none',
    });
  });

  it.each<[number, BudgetStatus]>([
    [0, 'ok'],
    [7999, 'ok'],
    [8000, 'warning'],
    [10000, 'warning'],
    [10001, 'over'],
  ])('spending %p of £100 is %p', (spent, status) => {
    expect(budgetProgress(spent, 10000).status).toBe(status);
  });

  it('allows negative remaining when over budget', () => {
    expect(budgetProgress(12500, 10000)).toMatchObject({ remainingPence: -2500, ratio: 1.25 });
  });
});

describe('dailyAllowancePence', () => {
  it('splits what is left across the remaining days', () => {
    expect(dailyAllowancePence(12000, 12)).toBe(1000);
    expect(dailyAllowancePence(1000, 3)).toBe(333);
  });

  it('has nothing to offer when over budget or out of days', () => {
    expect(dailyAllowancePence(-500, 10)).toBeNull();
    expect(dailyAllowancePence(0, 10)).toBeNull();
    expect(dailyAllowancePence(5000, null)).toBeNull();
    expect(dailyAllowancePence(null, 10)).toBeNull();
  });
});

describe('budgetOverview', () => {
  it('separates budgeted and unbudgeted spending', () => {
    const overview = budgetOverview(
      [
        { categoryId: 1, totalPence: 30000 },
        { categoryId: 2, totalPence: 5000 },
        { categoryId: 3, totalPence: 2500 },
      ],
      [
        { categoryId: 1, monthlyLimitPence: 45000 },
        { categoryId: 2, monthlyLimitPence: 20000 },
      ],
    );
    expect(overview).toMatchObject({
      totalLimitPence: 65000,
      budgetedSpentPence: 35000,
      unbudgetedSpentPence: 2500,
    });
    expect(overview.progress).toMatchObject({ remainingPence: 30000, status: 'ok' });
  });

  it('has no overall progress without budgets', () => {
    expect(budgetOverview([{ categoryId: 1, totalPence: 100 }], []).progress.status).toBe('none');
  });
});
