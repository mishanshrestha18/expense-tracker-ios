# Expenses

[![CI](https://github.com/mishanshrestha18/expense-tracker-ios/actions/workflows/ci.yml/badge.svg)](https://github.com/mishanshrestha18/expense-tracker-ios/actions/workflows/ci.yml)
[![iOS build](https://github.com/mishanshrestha18/expense-tracker-ios/actions/workflows/ios-build.yml/badge.svg)](https://github.com/mishanshrestha18/expense-tracker-ios/actions/workflows/ios-build.yml)
![Expo SDK 57](https://img.shields.io/badge/Expo-SDK%2057-000?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Swift App Intents](https://img.shields.io/badge/Swift-App%20Intents-f05138?logo=swift&logoColor=white)

A personal expense tracker for iPhone, built with **Expo (React Native) and TypeScript**, with
**Swift App Intents** for Siri and Apple Pay.

Log spending the way you would say it — _"285 groceries"_, _"a tenner on lunch"_ — or don't log
it at all: Apple Pay taps add themselves, and Siri answers what is left before you spend.

Everything is stored on the device. No account, no server.

**The bit no other tracker does:** it answers back.

- Tap to pay → _"£3.50 at Pret · £41.00 left for Eating out this month."_
- _"Hey Siri, how much can I spend today in my budget?"_ → _"£23 a day keeps you on track."_
- _"Hey Siri, can I afford it?"_ → _"That would put you £12 over for the rest of the month."_
- _"Hey Siri, am I spending more than last month?"_ → _"£120 more than this time last month."_

## Features

- **Plain-English quick add** — type or dictate `285 groceries`, `spent 12 on lunch with Sam` or
  `50p sweets`. Amount, category, note and date are parsed on-device with a live preview before
  saving.
- **Budgets** — one overall monthly budget, a limit per category, or both. Warnings at 80%, an
  over-budget state, a "£X per day to stay on track" allowance, and a check that the category
  limits fit inside the monthly budget.
- **Payday budgets** — a budget period can run payday to payday instead of the 1st to the 31st,
  including "the last working day" and moving a weekend payday to the Friday before. Budgets,
  charts and the daily allowance all follow it.
- **Insights** — spending by category (donut chart), change versus the same point last month,
  monthly average and a six-month trend with the monthly budget marked (bar chart).
- **Native feel** — iOS tab bar (Liquid Glass on iOS 26+), modal sheets, the native date picker,
  haptics, light and dark mode, and VoiceOver labels throughout.
- **Offline-first** — SQLite on the device with versioned schema migrations.
- **Siri** — "Hey Siri, add groceries to my expenses" → "How much?" → "285", through native
  Swift App Intents ([native/LogExpenseIntent.swift](native/LogExpenseIntent.swift)).
- **Siri answers back** — "How much can I spend today?" → "£23 a day keeps you on track", and
  "What's left for eating out?" → "£41 left". Answers come from a small budget summary the app
  publishes, so nothing has to open.
- **Apple Pay, automatically** — a Wallet automation hands each Apple Pay payment to the app,
  which files it by merchant (Tesco → Groceries, Pret → Eating out), and the tap replies with
  what is left in that category.
- **On-device AI** — "quick add" takes a whole sentence, read by Apple's on-device model on
  iPhones with Apple Intelligence, and by the app's own parser everywhere else. Nothing leaves
  the phone either way.
- **Recurring fees** — regular payments are spotted from your history and listed as "still to
  come this month", and that money is set aside before the daily allowance is worked out.
- **Cash and cards in one place** — each expense records how it was paid, so the split that
  bank apps miss is right there.
- **It learns** — re-file a shop once and every later payment from it goes to the same place,
  in the parser, in Apple Pay and in what Siri says.
- **Forecast** — "on pace to finish £64 over", and one notification a few days before the period
  ends when that is where it is heading.
- **Then versus now** — the same number of days into last period and into last year, plus the
  categories that actually moved ("Eating out £70 less").
- **Bills, and what's actually yours** — rent, the car, subscriptions, monthly, quarterly or
  yearly. The app sets that money aside, so the daily allowance only offers what is genuinely
  free, and tells you a week before a price you already know about goes up.
- **Your data leaves whenever you like** — export every expense as CSV from Settings.

## Tech stack

| Area       | Choice                                                                              |
| ---------- | ----------------------------------------------------------------------------------- |
| App        | Expo SDK 57, React Native 0.86, React 19.2 with the React Compiler                  |
| Language   | TypeScript 6 in strict mode                                                         |
| Navigation | Expo Router (file-based), native tabs and modal screens                             |
| Storage    | `expo-sqlite` with versioned migrations; money stored as integer pence              |
| Charts     | Hand-rolled SVG with `react-native-svg`; the geometry is unit tested                |
| Testing    | Jest (`jest-expo`) + `sql.js`, so repository tests run against a real SQLite engine |
| Quality    | ESLint (`eslint-config-expo`), Prettier and GitHub Actions CI                       |
| Siri       | Swift App Intents compiled into the app target via Expo inline modules              |
| iOS builds | IPA built on a GitHub-hosted Mac, installed with Sideloadly — no Mac needed         |

## Architecture

```mermaid
flowchart LR
  subgraph UI
    Routes["app/ (Expo Router screens)"] --> Components["components/"]
  end
  Routes --> Hooks["hooks/ — useDbQuery + typed data hooks"]
  Hooks --> Repos["db/ — repositories + migrations"]
  Repos --> Db[("Db interface")]
  Db --> ExpoSQLite["expo-sqlite (device)"]
  Db --> SqlJs["sql.js (tests)"]
  Routes --> Domain["domain/ — pure logic"]
  Hooks -. "writes bump a data version" .-> Routes
```

```
src/
├── app/          Screens and navigation (Expo Router)
├── components/   UI components; ui/ holds the design-system primitives
├── domain/       Pure business logic: money, dates, quick-add parser, budgets, chart geometry
├── db/           Schema, migrations and repositories
├── hooks/        Data hooks built on useDbQuery / useDbMutation
├── siri/         The App Intents bridge: inbox import and the budget summary
├── state/        App-wide context: selected period, data version
└── test-utils/   In-memory SQLite for tests
```

Key decisions:

- **Money is integer pence.** `0.1 + 0.2 !== 0.3` in floating point; pence never drift.
  Formatting to `£285.50` happens only at the edges.
- **Expenses store a local calendar date** (`2026-09-19`), not a timestamp, so monthly totals
  never shift with time zones or daylight saving.
- **Repositories depend on a small `Db` interface**, not on `expo-sqlite` directly. The
  same SQL runs on the phone and against an in-memory `sql.js` database in Jest.
- **The quick-add parser is pure and exhaustively tested**, because it also reads what Siri
  hears on iPhones without Apple Intelligence.
- **The App Intents never touch SQLite.** Two copies of SQLite writing one file can corrupt it,
  so intents drop JSON files in `Documents/siri-inbox/` and read a budget summary the app
  publishes to `Documents/budget-snapshot.json`.
- **No state library.** Reads go through `useDbQuery`; every write bumps a version in context,
  and queries re-run. It is small, explicit and enough for a single-user, on-device app.

## Getting started

You need Node.js 22+ and the free **Expo Go** app on your iPhone. No Mac is required.

```bash
npm install
npm start
```

Scan the QR code with the iPhone Camera app to open the project in Expo Go. The phone and the
computer must be on the same Wi-Fi network; if they cannot see each other, run
`npx expo start --tunnel` instead.

In development builds, the empty Overview screen offers **Load sample data**, which fills six
months of realistic expenses and budgets so the charts have something to show.

### Scripts

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `npm start`         | Start the dev server (open in Expo Go)                   |
| `npm test`          | Run the Jest suite                                       |
| `npm run typecheck` | Type-check with `tsc`                                    |
| `npm run lint`      | Lint with ESLint                                         |
| `npm run format`    | Format with Prettier                                     |
| `npm run check`     | Type-check, lint, check formatting and test — same as CI |

## Installing on an iPhone

Siri needs a real build rather than Expo Go. [docs/install-on-iphone.md](docs/install-on-iphone.md)
builds one on a GitHub-hosted Mac and installs it with a free Apple ID through Sideloadly.

## Roadmap

- [x] **Siri** — "Hey Siri, add groceries to my expenses" → "How much?" → "285".
- [x] **Apple Pay** — payments added automatically through a Wallet transaction automation.
- [x] **Siri questions** — what's left today, what's left for a category, and "can I afford it?".
- [x] **Payday budget periods**, recurring-fee detection, and a cash versus card split.
- [x] **Learned categories**, an end-of-period forecast and CSV export.
- [x] **Comparisons** — against last period, a year ago, and by category, in the app and by voice.
- [x] **Committed costs** — bills with future price changes, a committed/everyday split, and
      reminders ([design](docs/design/committed-costs.md)).
- [ ] **Screenshots and a 20-second demo clip** — see [docs/demo/SHOT-LIST.md](docs/demo/SHOT-LIST.md).
- [ ] **Siri in one sentence** — "Hey Siri, add £285 to my Groceries list in Expenses", using the
      iOS 27 Reminders schema (needs Expo SDK 58 and Xcode 27).
- [ ] **Action Button and Back Tap** — one press, say "285 groceries", done.
- [ ] Shortcuts deep link: `expenses://expense/new?text=285%20groceries` already pre-fills the
      form.
- [ ] Custom categories, CSV export and receipt photos.
- [ ] TestFlight release.
