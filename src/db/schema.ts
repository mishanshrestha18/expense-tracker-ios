/**
 * Schema migrations, applied in order. `PRAGMA user_version` records how many
 * have run, so each one runs exactly once per device. Never edit a shipped
 * migration — append a new one instead.
 */

interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
  aliases: string[];
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  {
    name: 'Groceries',
    icon: 'groceries',
    color: '#30A46C',
    aliases: [
      'grocery',
      'supermarket',
      'food shop',
      'food shopping',
      'tesco',
      'sainsburys',
      'asda',
      'aldi',
      'lidl',
      'morrisons',
      'waitrose',
      'co-op',
      'ocado',
    ],
  },
  {
    name: 'Eating out',
    icon: 'dining',
    color: '#F76B15',
    aliases: [
      'restaurant',
      'takeaway',
      'lunch',
      'dinner',
      'breakfast',
      'brunch',
      'coffee',
      'cafe',
      'pub',
      'drinks',
      'deliveroo',
      'just eat',
      'uber eats',
    ],
  },
  {
    name: 'Transport',
    icon: 'transport',
    color: '#0090FF',
    aliases: [
      'travel',
      'train',
      'bus',
      'tube',
      'taxi',
      'uber',
      'fuel',
      'petrol',
      'diesel',
      'parking',
      'oyster',
    ],
  },
  {
    name: 'Bills',
    icon: 'bills',
    color: '#FFB224',
    aliases: [
      'rent',
      'mortgage',
      'electricity',
      'gas',
      'water',
      'council tax',
      'internet',
      'broadband',
      'phone',
      'insurance',
      'utilities',
    ],
  },
  {
    name: 'Shopping',
    icon: 'shopping',
    color: '#8E4EC6',
    aliases: ['clothes', 'amazon', 'shoes', 'gift', 'gifts', 'electronics'],
  },
  {
    name: 'Entertainment',
    icon: 'entertainment',
    color: '#E5484D',
    aliases: [
      'cinema',
      'movie',
      'movies',
      'netflix',
      'spotify',
      'games',
      'concert',
      'tickets',
      'subscription',
    ],
  },
  {
    name: 'Health',
    icon: 'health',
    color: '#12A594',
    aliases: ['pharmacy', 'boots', 'gym', 'doctor', 'dentist', 'medicine', 'prescription'],
  },
  {
    name: 'Other',
    icon: 'other',
    color: '#8B8D98',
    aliases: ['misc', 'miscellaneous'],
  },
];

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

const seedCategories = DEFAULT_CATEGORIES.map(
  (c, i) =>
    `INSERT INTO categories (name, icon, color, aliases, sort_order) VALUES (${sqlString(c.name)}, ${sqlString(c.icon)}, ${sqlString(c.color)}, ${sqlString(c.aliases.join(','))}, ${i});`,
).join('\n');

export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE categories (
    id          INTEGER PRIMARY KEY NOT NULL,
    name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    icon        TEXT    NOT NULL,
    color       TEXT    NOT NULL,
    aliases     TEXT    NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE expenses (
    id           INTEGER PRIMARY KEY NOT NULL,
    amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
    category_id  INTEGER NOT NULL REFERENCES categories (id),
    note         TEXT    NOT NULL DEFAULT '',
    spent_on     TEXT    NOT NULL CHECK (spent_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX expenses_by_date ON expenses (spent_on);
  CREATE INDEX expenses_by_category ON expenses (category_id, spent_on);

  CREATE TABLE budgets (
    category_id         INTEGER PRIMARY KEY NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    monthly_limit_pence INTEGER NOT NULL CHECK (monthly_limit_pence > 0)
  );

  ${seedCategories}
  `,

  // v2: one overall monthly budget across all categories (a single-row table).
  `
  CREATE TABLE overall_budget (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    monthly_limit_pence INTEGER NOT NULL CHECK (monthly_limit_pence > 0)
  );
  `,

  // v3: app settings (payday rule, alerts), how each expense was paid, and
  // recurring series the person has dismissed.
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  ALTER TABLE expenses ADD COLUMN paid_with TEXT NOT NULL DEFAULT '';

  CREATE TABLE recurring_ignored (
    key        TEXT PRIMARY KEY NOT NULL,
    ignored_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  `,

  // v4: what the app has learned about where a shop belongs, from the
  // categories a person corrects by hand.
  `
  CREATE TABLE merchant_rules (
    words       TEXT    PRIMARY KEY NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  `,

  // v5: committed costs — the bills that leave whether or not anyone opens the
  // app. An amount is a timeline rather than one number, so "rent goes up in
  // October 2027" is a row entered today (see docs/design/committed-costs.md).
  `
  CREATE TABLE commitments (
    id           INTEGER PRIMARY KEY NOT NULL,
    name         TEXT    NOT NULL,
    category_id  INTEGER NOT NULL REFERENCES categories (id),
    kind         TEXT    NOT NULL DEFAULT 'fixed',
    due_day      INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    every_months INTEGER NOT NULL DEFAULT 1 CHECK (every_months > 0),
    anchor_month TEXT    NOT NULL,
    ended_on     TEXT,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE commitment_amounts (
    commitment_id  INTEGER NOT NULL REFERENCES commitments (id) ON DELETE CASCADE,
    effective_from TEXT    NOT NULL,
    amount_pence   INTEGER NOT NULL CHECK (amount_pence > 0),
    PRIMARY KEY (commitment_id, effective_from)
  );

  CREATE TABLE commitment_settlements (
    commitment_id INTEGER NOT NULL REFERENCES commitments (id) ON DELETE CASCADE,
    due_on        TEXT    NOT NULL,
    status        TEXT    NOT NULL CHECK (status IN ('paid', 'skipped')),
    expense_id    INTEGER REFERENCES expenses (id) ON DELETE SET NULL,
    recorded_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (commitment_id, due_on)
  );
  `,
];
