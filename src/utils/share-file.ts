/**
 * The input/output half of exporting: writing the file and handing it to the
 * system share sheet. Kept out of `src/domain` so the CSV itself stays pure.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Saves `contents` in the cache directory, where the system is free to clear it
 * once the share sheet has passed the file on, then offers it for sharing.
 * Returns `'unavailable'` instead of throwing where there is no share sheet
 * (the web preview), so nothing is written for nothing.
 */
export async function shareCsv(
  fileName: string,
  contents: string,
): Promise<'shared' | 'unavailable'> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(contents);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
  return 'shared';
}
