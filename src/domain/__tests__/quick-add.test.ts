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
      paidWith: '',
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

  it.each([
    ['forty quid', 4000],
    ['twelve pounds fifty', 1250],
    ['three fifty', 350],
    ['a hundred and twenty', 12000],
    ['a hundred and twenty five quid', 12500],
    ['two thousand', 200000],
    ['twenty-five', 2500],
    ['eighty pence', 80],
  ])('understands spoken money in %p', (text, amountPence) => {
    expect(parse(text)).toMatchObject({ ok: true, amountPence, note: '' });
  });

  it('reads a bare "twelve fifty" as pounds and pence', () => {
    expect(parse('twelve fifty')).toMatchObject({ amountPence: 1250, note: '' });
    expect(parse('twelve fifty five')).toMatchObject({ amountPence: 1255, note: '' });
    // A scale word is one number, not pounds and pence.
    expect(parse('two hundred')).toMatchObject({ amountPence: 20000, note: '' });
    // The second half has to sound like pence.
    expect(parse('twelve five')).toMatchObject({ amountPence: 1200, note: 'Five' });
  });

  it.each([
    ['a fiver', 500],
    ['tenner', 1000],
    ['a ton', 10000],
    ['two grand', 200000],
    ['a quid', 100],
    ['2k', 200000],
    ['1.5k', 150000],
  ])('understands the slang amount %p', (text, amountPence) => {
    expect(parse(text)).toMatchObject({ ok: true, amountPence, note: '' });
  });

  it.each([
    ['spent a tenner on lunch', 1000, 'Eating out', 'Lunch'],
    ['forty quid petrol', 4000, 'Transport', 'Petrol'],
    ['twelve fifty at tesco', 1250, 'Groceries', 'Tesco'],
    ['two grand rent', 200000, 'Bills', 'Rent'],
    ['a hundred and twenty quid on clothes', 12000, 'Shopping', 'Clothes'],
  ])('reads %p as a whole sentence', (text, amountPence, category, note) => {
    expect(parse(text)).toMatchObject({ amountPence, categoryId: idOf(category), note });
  });

  it('treats "a" before a slang amount as part of the amount', () => {
    expect(parse('a fiver on coffee')).toEqual({
      ok: true,
      amountPence: 500,
      categoryId: idOf('Eating out'),
      note: 'Coffee',
      spentOn: '2026-09-19',
      paidWith: '',
    });
  });

  it('prefers a spoken amount over a bare number elsewhere', () => {
    expect(parse('2 coffees a fiver')).toMatchObject({ amountPence: 500, note: '2 coffees' });
    expect(parse('3 tickets forty quid')).toMatchObject({ amountPence: 4000, note: '3 tickets' });
  });

  it('still reads digit amounts when words are around them', () => {
    expect(parse('50p sweets')).toMatchObject({ amountPence: 50, note: 'Sweets' });
    expect(parse('2 coffees at £3.50')).toMatchObject({ amountPence: 350, note: '2 coffees' });
    expect(parse('two coffees at £3.50')).toMatchObject({ amountPence: 350, note: 'Two coffees' });
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
