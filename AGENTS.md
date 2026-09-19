# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Project notes

- Personal iPhone expense tracker. Development happens on Windows without a Mac: test in Expo Go
  and build in the cloud with GitHub Actions (`docs/install-on-iphone.md`). Do not suggest steps
  that need Xcode locally.
- Run `npm run check` (type-check, lint, format check, tests) before considering work done.
- Money is always integer pence; format with `src/domain/money.ts` only at the UI edge.
- Expenses store a local calendar date (`YYYY-MM-DD`); use the helpers in `src/domain/dates.ts`.
- Business logic lives in `src/domain` as pure functions with tests in `__tests__`.
- Repositories in `src/db` take the `Db` interface so tests can run them on sql.js. Schema
  changes are new entries appended to `MIGRATIONS` in `src/db/schema.ts`; never edit a shipped
  migration.
- Screens read data with the hooks in `src/hooks/use-app-data.ts` and write through
  `useDbMutation`, which refreshes every query.
- Tests import `describe`/`it`/`expect` from `@jest/globals` (TypeScript 6 does not load global
  types automatically).
