import { Directory, File, Paths } from 'expo-file-system';

import { listMerchantRules } from '@/db/merchant-rules';
import type { Db } from '@/db/types';

import { importInboxEntries, type InboxItem, parseInboxEntry } from './inbox';

/** Must match the folder written by native/LogExpenseIntent.swift. */
const INBOX_DIRECTORY = 'siri-inbox';

/**
 * Moves any expenses logged with Siri into the database and deletes their
 * files. Cheap when the inbox is empty, so it can run whenever the app opens.
 * Returns how many expenses were added.
 */
export async function drainSiriInbox(db: Db): Promise<number> {
  const inbox = new Directory(Paths.document, INBOX_DIRECTORY);
  if (!inbox.exists) return 0;

  const files = inbox
    .list()
    .filter((item): item is File => item instanceof File && item.name.endsWith('.json'));
  if (files.length === 0) return 0;

  const entries: InboxItem[] = [];
  for (const file of files) {
    const entry = parseInboxEntry(await file.text());
    if (entry) entries.push(entry);
  }

  const added = await importInboxEntries(db, entries, await listMerchantRules(db));
  // Only after the import committed; malformed files are dropped too.
  for (const file of files) file.delete();
  return added;
}
