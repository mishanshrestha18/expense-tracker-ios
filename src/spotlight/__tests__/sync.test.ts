import { describe, expect, it } from '@jest/globals';

import type { SpotlightRow } from '@/db/spotlight';

import { spotlightRecord } from '../sync';

const row = (over: Partial<SpotlightRow> = {}): SpotlightRow => ({
  id: 12,
  amountPence: 350,
  note: 'Pret coffee',
  spentOn: '2026-09-19',
  paidWith: 'card',
  categoryName: 'Eating out',
  ...over,
});

describe('spotlightRecord', () => {
  it('reads like a search result', () => {
    expect(spotlightRecord(row())).toEqual({
      id: 12,
      title: 'Pret coffee',
      detail: '£3.50 · Eating out · 19 Sept 2026',
      keywords: ['eating out', 'pret', 'coffee', 'card'],
    });
  });

  it('falls back to the category when there is no note', () => {
    const record = spotlightRecord(row({ note: '   ' }));
    expect(record.title).toBe('Eating out');
    expect(record.keywords).toEqual(['eating out', 'card']);
  });

  it('keeps each keyword once', () => {
    expect(spotlightRecord(row({ note: 'Pret pret PRET' })).keywords).toEqual([
      'eating out',
      'pret',
      'card',
    ]);
  });
});
