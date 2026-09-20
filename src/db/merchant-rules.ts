/**
 * What the app has learned about shops. When someone re-files "Shell" under
 * Eating out because it was a coffee, the next Shell payment goes there too.
 */
import { phraseWords } from '@/domain/quick-add';

import type { Db } from './types';

export interface MerchantRule {
  /** Normalised words of the shop name, e.g. `"pret a manger"`. */
  words: string;
  categoryId: number;
}

/** The key a rule is stored under; `null` when there are no usable words. */
export function ruleKey(text: string): string | null {
  const words = phraseWords(text);
  return words.length === 0 ? null : words.join(' ');
}

export async function listMerchantRules(db: Db): Promise<MerchantRule[]> {
  return db.getAllAsync<MerchantRule>(
    'SELECT words, category_id AS categoryId FROM merchant_rules',
    [],
  );
}

/** Remembers a correction. Does nothing for text with no words in it. */
export async function rememberMerchantRule(
  db: Db,
  text: string,
  categoryId: number,
): Promise<void> {
  const key = ruleKey(text);
  if (key === null) return;
  await db.runAsync(
    `INSERT INTO merchant_rules (words, category_id) VALUES (?, ?)
     ON CONFLICT (words) DO UPDATE SET
       category_id = excluded.category_id,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [key, categoryId],
  );
}

export async function forgetMerchantRule(db: Db, words: string): Promise<void> {
  await db.runAsync('DELETE FROM merchant_rules WHERE words = ?', [words]);
}
