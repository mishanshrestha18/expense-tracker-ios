---
name: expenses-context
description: 'Answer questions about this Expenses app, or start work on it, without re-reading the codebase. Use for "where does X live", "what does Siri already answer", "what migration am I on", "how do I see this running", "why does Sideloadly refuse it", and before touching Expo, Swift, Siri, the widget or the web preview. Reads docs/context/MAP.md and docs/context/FACTS.md first, and regenerates the map with npm run map.'
---

# Context for the Expenses app

Two pages hold what would otherwise cost thirty file reads:

| Page                                                    | What is in it                                                                                                                 | Who writes it             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| [docs/context/MAP.md](../../../docs/context/MAP.md)     | Screens, migrations, every exported domain and database function, the Swift modules, the Siri phrases, the snapshot contract  | Generated — `npm run map` |
| [docs/context/FACTS.md](../../../docs/context/FACTS.md) | Sideloadly, free-account limits, Expo inline-module rules, the web preview's two gotchas, what can only be checked on a phone | By hand                   |

## What to do

1. **Read MAP.md first** for anything structural: where a function lives, what
   exists already, which migration is next, what Siri answers today. It is one
   file and it is current as of the last `npm run map`.
2. **Read FACTS.md before touching the platform**: Expo modules, Swift, Siri,
   the widget, signing, or the web preview. It exists so nobody re-derives those
   answers from `node_modules` or Apple's docs a second time.
3. **Only then open source files**, and only the ones MAP.md named.

If MAP.md looks stale (a screen or export you know about is missing), run
`npm run map` and read it again. It takes under a second.

## Commands

```bash
npm run map        # regenerate docs/context/MAP.md
npm run map:check  # only check the TypeScript ↔ Swift snapshot contract
npm run check      # types, lint, formatting, the contract check, tests
npm run preview    # web preview with the headers and a fresh origin
```

`npm run map:check` runs inside `npm run check`. It fails when
`native/SiriInbox.swift` insists on a snapshot field that
`src/siri/budget-snapshot.ts` never writes — the drift that silently breaks
every Siri answer at once.

## Keeping it worth reading

- Learned something about Expo, Swift, signing or the preview that is not in the
  code? **Add it to FACTS.md in the same change**, with how it was established.
  That is the whole point: the next session should not pay for it again.
- Added a screen, a migration, a domain function, an intent? `npm run map` and
  commit the result alongside the change.
- Never edit MAP.md by hand; it is overwritten.

## What this cannot tell you

Siri, the widget, Spotlight, notification actions and Apple Pay only run on a
real phone. Nothing here verifies them. Build them blind, group them, and check
them in one pass after an IPA is installed — see
[docs/install-on-iphone.md](../../../docs/install-on-iphone.md).
