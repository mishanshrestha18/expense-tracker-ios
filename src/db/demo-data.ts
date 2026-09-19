/**
 * Realistic sample data so the charts have something to show on a fresh
 * install (offered from the empty state in development builds only).
 * Uses a seeded PRNG, so the same day always produces the same data.
 */
import { addDays, toIsoDate } from '@/domain/dates';

import { setBudget, setOverallBudget } from './budgets';
import { listCategories } from './categories';
import type { Db } from './types';

/** Leaves room above the category budgets (which total £1,210) for unbudgeted spending. */
const DEMO_MONTHLY_BUDGET_POUNDS = 1600;

interface Pattern {
  perMonth: [min: number, max: number];
  amountPounds: [min: number, max: number];
  notes: string[];
  budgetPounds?: number;
}

const PATTERNS: Record<string, Pattern> = {
  Groceries: {
    perMonth: [7, 10],
    amountPounds: [12, 95],
    notes: ['Tesco', "Sainsbury's", 'Aldi', 'Weekly shop', 'Lidl', ''],
    budgetPounds: 450,
  },
  'Eating out': {
    perMonth: [5, 9],
    amountPounds: [4, 48],
    notes: ['Coffee', 'Lunch with Sam', 'Pizza', 'Pub', 'Brunch', ''],
    budgetPounds: 200,
  },
  Transport: {
    perMonth: [4, 8],
    amountPounds: [3, 60],
    notes: ['Train to London', 'Uber', 'Petrol', 'Bus pass', ''],
    budgetPounds: 150,
  },
  Bills: {
    perMonth: [3, 4],
    amountPounds: [25, 140],
    notes: ['Electricity', 'Broadband', 'Phone', 'Water'],
    budgetPounds: 350,
  },
  Shopping: {
    perMonth: [1, 4],
    amountPounds: [8, 120],
    notes: ['Amazon', 'Shoes', 'Birthday gift', ''],
  },
  Entertainment: {
    perMonth: [1, 3],
    amountPounds: [6, 45],
    notes: ['Cinema', 'Netflix', 'Concert tickets'],
    budgetPounds: 60,
  },
  Health: {
    perMonth: [0, 2],
    amountPounds: [5, 40],
    notes: ['Gym', 'Pharmacy'],
  },
};

/** Small, fast, deterministic PRNG (mulberry32). */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
  };
}

/** Adds ~6 months of expenses ending today, plus a few budgets. Returns the number of expenses added. */
export async function loadDemoData(db: Db, today: Date = new Date(), months = 6): Promise<number> {
  const categories = await listCategories(db);
  const todayIso = toIsoDate(today);
  const random = createRandom(Number(todayIso.replace(/-/g, '')));
  const daysBack = months * 30;
  let added = 0;

  await db.withTransactionAsync(async () => {
    for (const category of categories) {
      const pattern = PATTERNS[category.name];
      if (!pattern) continue;

      const count = random.int(pattern.perMonth[0], pattern.perMonth[1]) * months;
      for (let i = 0; i < count; i++) {
        const spentOn = addDays(todayIso, -random.int(0, daysBack));
        const pence = random.int(pattern.amountPounds[0] * 100, pattern.amountPounds[1] * 100);
        await db.runAsync(
          'INSERT INTO expenses (amount_pence, category_id, note, spent_on) VALUES (?, ?, ?, ?)',
          [pence, category.id, random.pick(pattern.notes), spentOn],
        );
        added++;
      }

      if (pattern.budgetPounds) {
        await setBudget(db, category.id, pattern.budgetPounds * 100);
      }
    }
    await setOverallBudget(db, DEMO_MONTHLY_BUDGET_POUNDS * 100);
  });

  return added;
}

/** Deletes every expense and budget. Categories are kept. */
export async function clearAllData(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM expenses; DELETE FROM budgets; DELETE FROM overall_budget;');
  });
}
