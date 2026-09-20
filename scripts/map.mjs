#!/usr/bin/env node
/**
 * Writes docs/context/MAP.md: one page that says what this app is made of, so
 * a person (or an agent) can answer "where does X live" without opening thirty
 * files. Regenerate with `npm run map`.
 *
 * `npm run map:check` skips the writing and only checks the one thing that has
 * silently broken before: the budget snapshot is written by TypeScript and read
 * by Swift, and nothing but this compares the two.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'context', 'MAP.md');

const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8');
const posix = (path) => path.split(sep).join('/');

/** Every file under `dir` matching `test`, as project-relative posix paths. */
function walk(dir, test = () => true) {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => posix(relative(ROOT, join(entry.parentPath, entry.name))))
    .filter((path) => !path.includes('__tests__') && test(path))
    .sort();
}

/**
 * The body of `header { … }` or `header [ … ]`, matched by counting the
 * bracket the header ends with rather than guessing where it closes.
 */
function block(source, header) {
  const start = source.indexOf(header);
  if (start === -1) return null;

  const open = header.trimEnd().at(-1);
  const close = open === '[' ? ']' : '}';

  let depth = 0;
  for (let i = start + header.length - 1; i < source.length; i++) {
    if (source[i] === open) depth++;
    else if (source[i] === close && --depth === 0) {
      return source.slice(start + header.length, i);
    }
  }
  return null;
}

/** Lines at the top level of a block: nested braces are skipped over. */
function topLevelLines(body) {
  const lines = [];
  let depth = 0;
  for (const line of body.split('\n')) {
    const opens = (line.match(/[{([]/g) ?? []).length;
    const closes = (line.match(/[})\]]/g) ?? []).length;
    if (depth === 0) lines.push(line);
    depth += opens - closes;
    if (depth < 0) depth = 0;
  }
  return lines;
}

// ---------------------------------------------------------------- the pieces

/** Screens, as expo-router turns file names into routes. */
function routes() {
  const layout = read('src', 'app', '_layout.tsx');
  const titles = new Map(
    [...layout.matchAll(/name="([^"]+)"\s*(?:\n\s*)?options=\{\{([\s\S]*?)\}\}/g)].map(
      ([, name, options]) => [name, options.match(/title: '([^']+)'/)?.[1] ?? ''],
    ),
  );
  const modal = new Set(
    [...layout.matchAll(/name="([^"]+)"\s*(?:\n\s*)?options=\{\{([\s\S]*?)\}\}/g)]
      .filter(([, , options]) => options.includes("presentation: 'modal'"))
      .map(([, name]) => name),
  );

  return walk('src/app', (path) => path.endsWith('.tsx') && !path.endsWith('_layout.tsx')).map(
    (path) => {
      const name = path.replace('src/app/', '').replace(/\.tsx$/, '');
      const route = `/${name.replace(/\/index$/, '').replace(/^\(tabs\)\/?/, '')}` || '/';
      return {
        route: route === '/' ? '/ (overview)' : route,
        file: path,
        kind: modal.has(name) ? 'modal' : name.startsWith('(tabs)') ? 'tab' : 'screen',
        title: titles.get(name) ?? '',
      };
    },
  );
}

/**
 * The template strings in a list, each with the comment written above it.
 * Line based, because the comments themselves quote column names in backticks
 * and a naive scan for pairs of them goes badly wrong. Prettier keeps the
 * opening and closing backticks on their own lines, which is what this leans on.
 */
function quotedEntries(body) {
  const entries = [];
  let comment = [];
  let sql = null;

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (sql === null) {
      if (trimmed.startsWith('//')) comment.push(trimmed.replace(/^\/\/\s?/, ''));
      else if (trimmed.startsWith('`')) sql = [];
      continue;
    }
    if (/^`,?$/.test(trimmed)) {
      entries.push({ note: comment.join(' ').trim(), sql: sql.join('\n') });
      comment = [];
      sql = null;
      continue;
    }
    sql.push(line);
  }
  return entries;
}

/** What each migration adds. Never edit a shipped one; append instead. */
function migrations() {
  const source = read('src', 'db', 'schema.ts');
  const body = block(source, 'export const MIGRATIONS: readonly string[] = [') ?? '';
  const entries = quotedEntries(body);

  return entries.map(({ sql, note: comment }, index) => {
    // "v3: app settings (payday rule, alerts), how each expense was paid…"
    const note = index === 0 ? 'the first schema' : comment.replace(/^v\d+:\s*/, '');
    const changes = [
      ...[...sql.matchAll(/CREATE TABLE (\w+)/g)].map(([, name]) => `+${name}`),
      ...[...sql.matchAll(/ALTER TABLE (\w+) ADD COLUMN (\w+)/g)].map(
        ([, table, column]) => `${table}.${column}`,
      ),
      ...[...sql.matchAll(/CREATE (?:UNIQUE )?INDEX (\w+)/g)].map(([, name]) => `index ${name}`),
    ];
    return { version: index + 1, note: note.trim(), changes };
  });
}

/** Exported functions, one line each, for every file in a folder. */
function api(dir) {
  return walk(dir, (path) => path.endsWith('.ts') || path.endsWith('.tsx'))
    .map((path) => {
      const source = readFileSync(join(ROOT, path), 'utf8');
      const exports = [...source.matchAll(/^export (?:async )?function (\w+)/gm)].map(
        ([, name]) => name,
      );
      const types = [...source.matchAll(/^export (?:interface|type) (\w+)/gm)].map(
        ([, name]) => name,
      );
      const purpose = source.match(/^\/\*\*\s*\n?\s*\*?\s*([^\n*][^\n]*)/)?.[1]?.trim() ?? '';
      return { path, exports, types, purpose: purpose.replace(/\s*\*\/$/, '') };
    })
    .filter((file) => file.exports.length > 0 || file.types.length > 0);
}

/** The Swift side: modules the app can call, and what Siri can be asked. */
function native() {
  return walk('native', (path) => path.endsWith('.swift')).map((path) => {
    const source = readFileSync(join(ROOT, path), 'utf8');
    return {
      path,
      module: source.match(/Name\("(\w+)"\)/)?.[1] ?? null,
      functions: [...source.matchAll(/(?:Async)?Function\("(\w+)"\)/g)].map(([, name]) => name),
      intents: [
        ...source.matchAll(
          /struct (\w+): AppIntent[\s\S]{0,200}?title: LocalizedStringResource = "([^"]+)"/g,
        ),
      ].map(([, name, title]) => ({ name, title })),
      // Swift interpolation read back as English: the app name, and the slots
      // Siri asks for.
      phrases: [...source.matchAll(/"([^"]*\\\(\.applicationName\)[^"]*)"/g)].map(([, phrase]) =>
        phrase
          .replace('\\(.applicationName)', 'Expenses')
          .replace(/\\\(\\\.\$(\w+)\)/g, (_, slot) => `<${slot}>`),
      ),
    };
  });
}

// ------------------------------------------------- the contract that can drift

/**
 * The snapshot the app writes and the App Intents read. TypeScript owns the
 * shape; Swift decodes it. A field Swift insists on but TypeScript never writes
 * means Siri silently answers "open Expenses once and I'll be able to tell you".
 */
function snapshotContract() {
  const ts = block(read('src', 'siri', 'budget-snapshot.ts'), 'export interface BudgetSnapshot {');
  const swift = block(read('native', 'SiriInbox.swift'), 'struct BudgetSnapshot: Decodable {');
  if (ts === null || swift === null) {
    return { written: [], read: [], missing: [], ignored: [], unreadable: true };
  }

  const written = topLevelLines(ts)
    .map((line) => line.match(/^\s*(\w+)(\??):/))
    .filter(Boolean)
    .map(([, name, optional]) => ({ name, optional: optional === '?' }));

  const read_ = topLevelLines(swift)
    .map((line) => line.match(/^\s*let (\w+): ([^\n=]+)$/))
    .filter(Boolean)
    .map(([, name, type]) => ({ name, required: !type.trim().endsWith('?') }));

  const writtenNames = new Set(written.map((field) => field.name));
  const readNames = new Set(read_.map((field) => field.name));

  return {
    written,
    read: read_,
    // Swift cannot decode the file at all without these.
    missing: read_.filter((field) => field.required && !writtenNames.has(field.name)),
    ignored: written.filter((field) => !readNames.has(field.name)),
    unreadable: false,
  };
}

// ------------------------------------------------------------------- the page

/**
 * Test blocks rather than tests: `it.each` expands into several, which only
 * jest knows about, so the number here is a floor and says so on the page.
 */
function countTests() {
  const files = readdirSync(join(ROOT, 'src'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
    .map((entry) => join(entry.parentPath, entry.name));
  const blocks = files.reduce(
    (total, file) => total + (readFileSync(file, 'utf8').match(/it(?:\.each)?\(/g) ?? []).length,
    0,
  );
  return { suites: files.length, blocks };
}

function table(rows, headers) {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

function buildPage() {
  const contract = snapshotContract();
  const counts = countTests();
  const nativeFiles = native();

  const sections = [
    `<!-- Generated by scripts/map.mjs. Run \`npm run map\` after changing the app; do not edit by hand. -->

# What this app is made of

A map of the code as it stands, so a question like "where does the budget
period live" or "what does Siri already answer" costs one file instead of
thirty. Hard-won facts that are **not** in the code — Sideloadly, free-account
limits, Expo quirks — live next door in [FACTS.md](FACTS.md).

At least ${counts.blocks} tests across ${counts.suites} suites (\`it.each\` expands
into more; \`npm test\` prints the real number). ${routes().length} screens,
${migrations().length} migrations.`,

    `## Screens

${table(
  routes().map((route) => [
    `\`${route.route}\``,
    route.kind,
    route.title || '—',
    `\`${route.file}\``,
  ]),
  ['Route', 'Kind', 'Title', 'File'],
)}`,

    `## Database

Migrations are append-only: a shipped one is never edited. \`PRAGMA user_version\`
records how many have run.

${table(
  migrations().map((migration) => [
    `v${migration.version}`,
    migration.note || '—',
    migration.changes.join(', ') || '—',
  ]),
  ['Version', 'What it is for', 'Tables and indexes'],
)}`,

    `## Pure logic (\`src/domain\`)

Every one of these is a pure function with tests. Reach for one before writing
maths in a screen.

${table(
  api('src/domain').map((file) => [
    `\`${file.path.replace('src/domain/', '')}\``,
    file.exports.map((name) => `\`${name}\``).join(', '),
  ]),
  ['File', 'Exports'],
)}`,

    `## Repositories (\`src/db\`)

All of them take the \`Db\` interface, so the tests run them on sql.js.

${table(
  api('src/db').map((file) => [
    `\`${file.path.replace('src/db/', '')}\``,
    file.exports.map((name) => `\`${name}\``).join(', '),
  ]),
  ['File', 'Exports'],
)}`,

    `## Hooks (\`src/hooks\`)

${table(
  api('src/hooks').map((file) => [
    `\`${file.path.replace('src/hooks/', '')}\``,
    file.exports.map((name) => `\`${name}\``).join(', '),
  ]),
  ['File', 'Exports'],
)}`,

    `## Native (\`native/\`, compiled into the app target)

${table(
  nativeFiles
    .filter((file) => file.module || file.functions.length > 0)
    .map((file) => [
      `\`${file.path}\``,
      file.module ? `\`${file.module}\`` : '—',
      file.functions.map((name) => `\`${name}\``).join(', ') || '—',
    ]),
  ['File', 'Expo module', 'Functions'],
)}

### What Siri already answers

${table(
  nativeFiles.flatMap((file) => file.intents).map((intent) => [`\`${intent.name}\``, intent.title]),
  ['Intent', 'Title'],
)}

${nativeFiles
  .flatMap((file) => file.phrases)
  .map((phrase) => `- "${phrase}"`)
  .join('\n')}`,

    `## The contract that can drift

\`src/siri/budget-snapshot.ts\` writes \`Documents/budget-snapshot.json\`;
\`native/SiriInbox.swift\` decodes it. Changing one side means changing the other,
and \`npm run map:check\` fails the build when a field Swift insists on is not
written.

- TypeScript writes **${contract.written.length}** fields.
- Swift reads **${contract.read.length}** of them${contract.ignored.length > 0 ? `, ignoring ${contract.ignored.map((field) => `\`${field.name}\``).join(', ')}` : ''}.
- Fields Swift requires but nothing writes: **${contract.missing.length === 0 ? 'none' : contract.missing.map((field) => `\`${field.name}\``).join(', ')}**.`,

    `## Seeing it run

There is no Mac here, so the loop is:

| What | How |
| --- | --- |
| Logic | \`npm run check\` — types, lint, formatting, tests |
| Screens | \`npm run preview\`, then open the printed address |
| Siri, widget, Spotlight, notification actions | Only on a phone: build the IPA and sideload it (docs/install-on-iphone.md) |

Read the preview with page text before reaching for a screenshot; it costs a
fraction as much and says more about what is actually rendered.`,
  ];

  return `${sections.join('\n\n')}\n`;
}

// ---------------------------------------------------------------------- entry

const checkOnly = process.argv.includes('--check');
const contract = snapshotContract();

if (contract.unreadable) {
  console.error('Could not find BudgetSnapshot on one side of the contract.');
  process.exit(1);
}

if (contract.missing.length > 0) {
  console.error('The budget snapshot Swift reads is not the one TypeScript writes.');
  for (const field of contract.missing) {
    console.error(`  native/SiriInbox.swift needs \`${field.name}\`, which nothing writes.`);
  }
  console.error('Add it in src/siri/budget-snapshot.ts, or make the Swift property optional.');
  process.exit(1);
}

if (checkOnly) {
  const ignored =
    contract.ignored.length > 0
      ? ` (Swift ignores ${contract.ignored.map((field) => field.name).join(', ')})`
      : '';
  console.log(`Snapshot contract fine: ${contract.read.length} fields read${ignored}.`);
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, buildPage(), 'utf8');
console.log(`Wrote ${posix(relative(ROOT, OUT))}`);
