import { describe, expect, it } from '@jest/globals';

import { DEFAULT_CATEGORIES } from '@/db/schema';

import { type CategoryMatcher, parseQuickAdd } from '../quick-add';

const categories: CategoryMatcher[] = DEFAULT_CATEGORIES.map((c, i) => ({
  id: i + 1,
  name: c.name,
  aliases: c.aliases,
}));
const idOf = (name: string) => categories.find((c) => c.name === name)!.id;

const today = new Date(2026, 8, 19, 9, 30);
const parse = (text: string) => parseQuickAdd(text, categories, today);

describe('parseQuickAdd', () => {
  it('reads the basic "amount category" form', () => {
    expect(parse('285 groceries')).toEqual({
      ok: true,
      amountPence: 28500,
      categoryId: idOf('Groceries'),
      note: '',
      spentOn: '2026-09-19',
    });
  });

  it.each([
    ['record £285 in groceries', 28500],
    ['Record 285£ in groceries', 28500],
    ['add £ 285 to groceries', 28500],
    ['groceries 285', 28500],
    ['I spent 285 pounds on groceries', 28500],
    ['285 pounds 50 in groceries', 28550],
    ['£285.50 groceries.', 28550],
    ['grocery 12.5', 1250],
  ])('understands %p', (text, amountPence) => {
    expect(parse(text)).toMatchObject({
      ok: true,
      amountPence,
      categoryId: idOf('Groceries'),
      note: '',
    });
  });

  it('keeps alias words as the note', () => {
    expect(parse('4.20 coffee')).toMatchObject({
      amountPence: 420,
      categoryId: idOf('Eating out'),
      note: 'Coffee',
    });
    expect(parse('Tesco 45.20')).toMatchObject({
      amountPence: 4520,
      categoryId: idOf('Groceries'),
      note: 'Tesco',
    });
  });

  it('keeps free text as the note and drops connecting words', () => {
    expect(parse('spent 12 on lunch with Sam')).toMatchObject({
      amountPence: 1200,
      categoryId: idOf('Eating out'),
      note: 'Lunch with Sam',
    });
    expect(parse("Sam's birthday present 25")).toMatchObject({
      amountPence: 2500,
      categoryId: null,
      note: "Sam's birthday present",
    });
  });

  it('prefers the longest matching phrase', () => {
    expect(parse('18 uber eats')).toMatchObject({ categoryId: idOf('Eating out') });
    expect(parse('18 uber')).toMatchObject({ categoryId: idOf('Transport') });
    expect(parse('60 council tax')).toMatchObject({ categoryId: idOf('Bills') });
  });

  it('matches multi-word category names', () => {
    expect(parse('32 eating out')).toMatchObject({
      categoryId: idOf('Eating out'),
      note: '',
    });
  });

  it('understands pence', () => {
    expect(parse('50p sweets')).toMatchObject({ amountPence: 50, note: 'Sweets' });
    expect(parse('80 pence parking')).toMatchObject({
      amountPence: 80,
      categoryId: idOf('Transport'),
    });
    expect(parse('£3 and 50p coffee')).toMatchObject({ amountPence: 350, note: 'Coffee' });
  });

  it('does not glue unrelated numbers onto the amount', () => {
    expect(parse('£20 3 coffees')).toMatchObject({ amountPence: 2000, note: '3 coffees' });
    expect(parse('£3 and 4 coffees')).toMatchObject({ amountPence: 300 });
  });

  it('prefers an explicit currency amount over a bare number', () => {
    expect(parse('2 cinema tickets £25')).toMatchObject({
      amountPence: 2500,
      categoryId: idOf('Entertainment'),
      note: '2 cinema tickets',
    });
  });

  it('handles thousands separators', () => {
    expect(parse('1,250 rent')).toMatchObject({ amountPence: 125000, categoryId: idOf('Bills') });
  });

  it('understands yesterday and today', () => {
    expect(parse('9.99 netflix yesterday')).toMatchObject({
      spentOn: '2026-09-18',
      categoryId: idOf('Entertainment'),
      note: 'Netflix',
    });
    expect(parse('today 5 bus')).toMatchObject({ spentOn: '2026-09-19', amountPence: 500 });
  });

  it('returns no category when nothing matches', () => {
    expect(parse('42')).toMatchObject({ ok: true, amountPence: 4200, categoryId: null, note: '' });
  });

  it('explains why parsing failed', () => {
    expect(parse('')).toEqual({ ok: false, reason: 'empty' });
    expect(parse('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(parse('groceries')).toEqual({ ok: false, reason: 'no-amount' });
    expect(parse('0 groceries')).toEqual({ ok: false, reason: 'no-amount' });
  });
});
