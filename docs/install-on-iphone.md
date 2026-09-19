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
2. Open Sideloadly, drag `Expenses.ipa` in, enter your Apple ID, press **Start**,
   and enter the verification code Apple sends you.
3. On the iPhone, the first time only, in this order:
   - **Settings → Privacy & Security → Developer Mode** → on, then restart the
     phone and confirm. The switch only appears once an app has been sideloaded.
   - **Settings → General → VPN & Device Management** → under **Developer App**,
     tap your Apple ID → **Trust**.
4. Open **Expenses** once.

## 3. Use Siri

- "Hey Siri, log groceries in Expenses" → "How much?" → "285"
- "Hey Siri, record eating out in Expenses"
- "Hey Siri, log an expense in Expenses" (Siri asks for the category, then the amount)

Siri replies "Logged £285.00 to Groceries." The expense appears the next time
you open the app. The phrases also show up in the Shortcuts app, where you can
add a shortcut to the Action Button or Back Tap.

## Every 7 days

Free installs stop opening after 7 days. Connect the phone and press **Start**
again in Sideloadly with the same `.ipa`; installing over the top keeps all your
data. Sideloadly's auto-refresh option can do this for you over Wi‑Fi while the
PC is on. Deleting the app deletes its data.

## Limits of a free Apple ID

- Installs last 7 days (above).
- At most 3 sideloaded apps on the phone at once.
- The single-sentence Siri command ("Hey Siri, add £285 to my Groceries list in
  Expenses") needs a build made with Xcode 27, which Expo supports from SDK 58.
