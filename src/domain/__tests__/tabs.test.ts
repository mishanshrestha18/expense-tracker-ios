import { describe, expect, it } from '@jest/globals';

import { neighbourTab, TABS, tabIndexOf } from '../tabs';

describe('tabIndexOf', () => {
  it('finds each tab by its path', () => {
    expect(tabIndexOf('/')).toBe(0);
    expect(tabIndexOf('/budgets')).toBe(1);
    expect(tabIndexOf('/insights')).toBe(TABS.length - 1);
  });

  it('ignores a trailing slash', () => {
    expect(tabIndexOf('/budgets/')).toBe(1);
    expect(tabIndexOf('//')).toBe(0);
  });

  it('does not recognise the rest of the app', () => {
    expect(tabIndexOf('/settings')).toBe(-1);
    expect(tabIndexOf('/expense/new')).toBe(-1);
    expect(tabIndexOf('/savings/goal')).toBe(-1);
  });
});

describe('neighbourTab', () => {
  it('steps along the bar in both directions', () => {
    expect(neighbourTab('/', 1)?.path).toBe('/budgets');
    expect(neighbourTab('/budgets', 1)?.path).toBe('/bills');
    expect(neighbourTab('/bills', -1)?.path).toBe('/budgets');
    expect(neighbourTab('/budgets', -1)?.path).toBe('/');
  });

  it('stops at both ends rather than wrapping round', () => {
    expect(neighbourTab('/', -1)).toBeNull();
    expect(neighbourTab('/insights', 1)).toBeNull();
  });

  it('does nothing away from the tabs', () => {
    expect(neighbourTab('/settings', 1)).toBeNull();
    expect(neighbourTab('/expense/new', -1)).toBeNull();
  });
});
