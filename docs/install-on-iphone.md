# Installing Expenses on an iPhone without a Mac

Expo Go runs the app for development, but Siri needs a real app build. This
guide builds one in the cloud and installs it with a free Apple ID. It costs
nothing; the catch is that Apple makes free installs expire after 7 days, so
you re-sign every week (a couple of clicks, and your data stays).

## 1. Build the app (GitHub Actions)

1. Push the code to GitHub.
2. Run the **iOS build** workflow: the Actions tab → **iOS build** → **Run
   workflow**, or `gh workflow run ios-build.yml`.
3. When it finishes (about 20–30 minutes), download the **Expenses-ipa**
   artifact from the run page, or with `gh run download --name Expenses-ipa`,
   and unzip it to get `Expenses.ipa`.

The build is only ad-hoc signed; the next step signs it properly for your phone.

## 2. Install it with Sideloadly (Windows)

One-time setup:

1. Install the web (non-Microsoft Store) versions of **iTunes** and **iCloud**;
   Sideloadly can't use the Store versions, so uninstall those first. Apple's
   pages only offer the Store versions now, so use Apple's direct downloads (the
   same links sideloadly.io gives):
   - iTunes 64-bit: <https://www.apple.com/itunes/download/win64>
   - iCloud: <https://updates.cdn-apple.com/2020/windows/001-39935-20200911-1A70AA56-F448-11EA-8CC0-99D41950005E/iCloudSetup.exe>

   Then restart the PC.

2. Install **Sideloadly** from [sideloadly.io](https://sideloadly.io).

> **Security:** Sideloadly asks for an Apple ID and password to sign the app,
> and sends them only to Apple. Download it from the official site only. If you
> prefer, use a second Apple ID just for signing; Siri and the app work the same.

Each install:

1. Connect the iPhone with a cable, unlock it and tap **Trust** if asked.
2. Open Sideloadly and drag `Expenses.ipa` in. Under **Advanced Options**, untick
   **Use automatic bundle ID** and leave the ID as `com.nicklane123.expenses`.
   Siri only recognises the app under its own ID.
3. Enter your Apple ID, press **Start**, and enter the verification code Apple
   sends you.
4. On the iPhone, the first time only, in this order:
   - **Settings → Privacy & Security → Developer Mode** → on, then restart the
     phone and confirm. The switch only appears once an app has been sideloaded.
   - **Settings → General → VPN & Device Management** → under **Developer App**,
     tap your Apple ID → **Trust**.
5. Open **Expenses** once.

## 3. Use Siri

The first time, turn on Siri for the app: open Expenses and say one of the
phrases below. Siri asks **Turn on "Expenses" shortcuts with Siri?** — tap
**Turn On**. (Or: Shortcuts app → **Shortcuts** tab → **Expenses** → turn on
**Siri**.) Until then Siri answers "Expenses hasn't added support for that with
Siri".

Say the category, and Siri asks how much:

- "Hey Siri, add groceries to my expenses" → "How much?" → "285"
- "Hey Siri, add eating out to my budget"
- "Hey Siri, add to my expenses" (Siri asks for the category, then the amount)

"My expenses", "my budget", "my spending" and "Expenses" all work as the app's
name. Siri replies "Added £285.00 to Groceries. £41.00 left for Groceries this
month." and the expense appears the next time you open the app.

Say a whole sentence instead:

- "Hey Siri, tell my expenses what I spent" → "What did you spend?" → "forty
  quid petrol and three pounds fifty on coffee"

"Note a spend in my expenses" and "quick add in my expenses" do the same thing.
Phrases that start with "add" sometimes make Siri ask whether you meant Wallet;
if that happens, use one of the others, or make a personal shortcut named
something short like "Spent" (Shortcuts → **+** → **Quick Add** → rename it),
which Siri never confuses.

On an iPhone with Apple Intelligence that is read on the phone itself and
answered straight away. On other iPhones it is stored as you said it and read
when you next open the app. Nothing is sent anywhere either way.

Ask about your money:

- "Hey Siri, how much can I spend today in my budget?"
- "Hey Siri, what's left for eating out in my expenses?"
- "Hey Siri, can I afford it in my budget?" → "How much are you thinking?"
- "Hey Siri, am I spending more than last month in my expenses?"
- "Hey Siri, what's due in my expenses?"

To use your own words, make a personal shortcut: in the Shortcuts app, tap **+**,
add the **Add Expense** or **Quick Add** action and name the shortcut something
like "I spent money". Then "Hey Siri, I spent money" runs it. The shortcut also
works from the Action Button or Back Tap.

## 4. Add Apple Pay payments automatically

A Wallet automation can add every Apple Pay payment you make with the iPhone,
with its amount and the shop's name:

1. In the Shortcuts app, open **Automation** → **+** → **Transaction**.
2. Pick the cards to watch, choose **Run Immediately**, then tap **Next**.
3. Choose **New Blank Automation**, tap **Add Action**, search for **Expenses**
   and pick **Add Apple Pay Payment**.
4. Tap **Amount** → **Shortcut Input**, then tap the new **Shortcut Input** and
   pick **Amount**. Do the same for **Merchant**, picking **Merchant**.
5. Tap **Done**.

The app files each payment by the shop's name (Tesco → Groceries, Pret → Eating
out, TfL → Transport, …) and keeps the name as the note. Shops it doesn't know go
under Other, and you can change the category in the app. Payments in other
currencies are added as they are, with the original amount in the note. Refunds
and £0.00 transit taps are skipped.

To see each tap as it happens — "£3.50 at Pret · £41.00 left for Eating out this
month" — open **Expenses → Settings** (the gear on the Overview tab) and turn on
**Tell me what's left**. That also sends one nudge a few days before the period
ends when the pace is heading over. The same screen sets your **budget period**,
if your money arrives on payday rather than the 1st, and exports your expenses
as a spreadsheet.

iOS only sees payments made with Apple Pay on the iPhone. Tapping a physical card
doesn't involve the phone, so those payments can't be added automatically.

## Every 7 days

Free installs stop opening after 7 days. Connect the phone and press **Start**
again in Sideloadly with the same `.ipa`, with **Use automatic bundle ID** still
unticked; installing over the top keeps all your data. Sideloadly's auto-refresh
option can do this for you over Wi‑Fi while the PC is on. Deleting the app deletes
its data.

## Limits of a free Apple ID

- Installs last 7 days (above).
- At most 3 sideloaded apps on the phone at once.
- The single-sentence Siri command ("Hey Siri, add £285 to my Groceries list in
  Expenses") needs a build made with Xcode 27, which Expo supports from SDK 58.
