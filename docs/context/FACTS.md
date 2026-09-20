# Things that cost a day to learn

Everything here was found the hard way and is not visible in the code. Written
by hand — unlike [MAP.md](MAP.md), which is generated. Each entry says how it
was established, so it can be re-checked cheaply rather than re-discovered
expensively.

If you are an agent: read this before reading `node_modules`, Apple docs or
Expo docs. If something here turns out to be wrong, fix the entry in the same
change.

## Building and installing (no Mac)

**A binary with no code signature at all makes Sideloadly fail with "Guru
Meditation … Invalid file".** Sideloadly re-signs what is already signed; it
cannot sign something that was never signed. The workflow therefore ad-hoc signs
every framework, then every `.appex`, then the app itself (`codesign --force
--sign -`), after `xattr -cr`. Verified by unzipping the IPA and checking for
`LC_CODE_SIGNATURE` in each Mach-O. See `.github/workflows/ios-build.yml`.

**"Use automatic bundle ID" in Sideloadly must stay unticked.** Ticking it
rewrites the bundle identifier, and the App Intents metadata then refers to an
app that no longer exists, so Siri answers "Expenses hasn't added support for
that". Found by comparing the installed app's identifier with
`ios.bundleIdentifier` in `app.json`.

**A free Apple ID install stops opening after 7 days**, three sideloaded apps at
a time. Re-running Sideloadly over the top keeps the database.

**Xcode 26 is required and Xcode 27 is not yet supported** by Expo SDK 57. The
workflow picks the newest `Xcode_26*.app` explicitly.

## Siri and App Intents

**iOS 26 leaves an app's shortcuts switched off until someone taps "Turn On"**
in Settings → Apps → Expenses → Siri. Until then every phrase answers "hasn't
added support". This is not a code problem and no rebuild fixes it.

**Every App Shortcut phrase must contain `\(.applicationName)`.** A phrase
without it is dropped silently at build time. Check the built app with
`unzip -p Expenses.ipa 'Payload/Expenses.app/Metadata.appintents/extract.actionsdata'`
— the phrase count there is the truth.

**`INAlternativeAppNames` accepts at most three**, currently "My Expenses",
"My Budget", "My Spending" in `app.json`.

**The App Intents never open SQLite.** Two processes writing one SQLite file can
corrupt it, so the app publishes `Documents/budget-snapshot.json` and the
intents only read. `npm run map:check` guards that contract.

## Expo inline modules (Swift in `native/`)

**A module file needs `internal import ExpoModulesCore` and a non-public
class.** `import ExpoModulesCore` on its own fails the build with "ambiguous
implicit access level for import", and a `public` class fails for the same
reason. This matches Expo's own documented example.

**Only classes with `func definition() -> ModuleDefinition` are registered.**
`expo-modules-autolinking` scans the watched directory
(`experiments.inlineModules.watchedDirectories` in `app.json`) for that exact
shape — see `node_modules/expo-modules-autolinking/build/inlineModules/inlineModules.js`.
Other Swift files in the folder are compiled but are not modules.

**Inline modules cannot declare an app delegate subscriber.** The subscriber
list comes from each package's `expo-module.config.json` by way of the generated
modules provider, and an inline module has no such file. Register one by hand
from `OnCreate` with `ExpoAppDelegateSubscriberRepository.registerSubscriber`,
guarded by a static flag because registering twice is a `fatalError` and the
module is rebuilt on every reload. This is how Spotlight results reach the app
(`native/ExpensesSpotlight.swift`).

**Anything that must be in place before the app finishes launching is a race.**
`OnCreate` runs while the React host is being created, inside
`didFinishLaunchingWithOptions`, which is early enough in practice for the
notification delegate and the Spotlight subscriber — but if a notification
action or a search result is ever silently ignored on a cold launch, this is
why.

## What a free account cannot do

**App Groups may not be signable**, which is the only way a widget extension can
read the app's data. That is why the widget is opt-in behind `EXPENSES_WIDGET=1`
(`app.config.js`) and why the default build is the one known to install. Untested
on a real phone as of 2026-09-20.

**Push notifications, HealthKit and Wallet passes are out** for the same reason.
Local notifications, which is what the app uses, need nothing.

**Physical card taps are invisible to iOS.** Only Apple Pay taps can be caught,
through a Wallet "Transaction" automation in Shortcuts, and it hands over the
amount as already-formatted text ("£3.50") plus the merchant name — hence
`parseWalletAmount` in `src/domain/money.ts`. Real card transactions need
FinanceKit: a paid developer account, the Finance category, and App Store
distribution.

## The web preview

**It needs cross-origin isolation.** `expo-sqlite` on web runs SQLite in a
worker over SharedArrayBuffer, and the dev server sends no COOP/COEP headers.
`npm run preview` proxies the dev server and adds them.

**One tab per origin.** The web database lives in OPFS, which allows a single
sync access handle: a tab left open from an earlier run makes the next one throw
`NoModificationAllowedError: createSyncAccessHandle`. `npm run preview` prints a
different `127.0.0.x` address each run to sidestep it — the cost is an empty
database each time, so reload the sample data.

**Typed routes only regenerate while the dev server runs.** A new screen fails
`tsc` with "not assignable to parameter of type …" until Metro has rewritten
`.expo/types/router.d.ts`. Start the dev server for a moment, then re-run the
check; it is not a real type error.

**Metro caches module resolution.** A package installed while the server is
running may not be found (`react-native-view-shot` → `html2canvas` was missing
until a restart). Restart with `--clear` after any install.

**Read the page, do not photograph it.** `get_page_text` and `read_page` cost a
fraction of a screenshot and say more about what actually rendered. Screenshots
are for layout, and even then one is usually enough.

## What cannot be checked here at all

Siri, the widget, Spotlight, notification actions and Apple Pay only exist on a
real phone. They are built blind and verified in one pass after a build, so
group them rather than building one at a time. Everything else — money maths,
dates, budget periods, parsing, the database — is covered by `npm run check` and
should never need a phone.
