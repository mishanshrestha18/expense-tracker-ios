import type { Category, Db } from './types';

interface CategoryRow {
  id: number;
  name: string;
  icon: string;
  color: string;
  aliases: string;
  sort_order: number;
}

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  color: row.color,
  aliases: row.aliases
    .split(',')
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0),
  sortOrder: row.sort_order,
});

export async function listCategories(db: Db): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT id, name, icon, color, aliases, sort_order FROM categories ORDER BY sort_order, name',
    [],
  );
  return rows.map(toCategory);
}
