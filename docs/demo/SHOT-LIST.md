# Demo shot list

What to capture on the iPhone for the README. Everything here is a phone
recording or screenshot: Siri's reply and the Apple Pay banner can't be shown
from a simulator or the web build.

Before recording:

- Load a period that looks lived-in, with a monthly budget set and a few
  categories over and under.
- Settings → Notifications → **Tell me what's left** on.
- Do Not Disturb on, so nothing else interrupts the recording.
- Screen recording: Control Centre → the record button. Stop it from the red
  pill in the status bar.

## The 20-second clip

| Time | What happens | What the viewer sees |
| --- | --- | --- |
| 0:00–0:03 | Hold the phone near the card reader and pay | The Apple Pay "Done" tick |
| 0:03–0:07 | The notification arrives | "£3.50 at Pret · £41.00 left for Eating out this month" |
| 0:07–0:12 | "Hey Siri, how much can I spend today in my budget?" | Siri answers out loud with the daily allowance |
| 0:12–0:17 | Open Expenses | The tap is already in the list, filed under Eating out |
| 0:17–0:20 | Budgets tab | The ring, "on pace to finish …", and "still to come this month" |

Keep it silent-friendly: the notification and Siri's reply are both on screen as
text, so it still reads with the sound off.

If a real payment isn't convenient, the same clip works with
"Hey Siri, add groceries to my expenses" → "twelve fifty" as the opening beat.

## Screenshots

Take these with Side + Volume Up, in dark mode, on the same data:

| File | Screen | Make sure it shows |
| --- | --- | --- |
| `overview.png` | Overview tab | the spent headline, the cash/card split, a few days of expenses |
| `budgets.png` | Budgets tab | the gradient ring, the pace line, "still to come this month" |
| `insights.png` | Insights tab | the donut, the six-period trend with the budget line |
| `siri.png` | Siri, mid-answer | "£23 a day keeps you on track …" |
| `settings.png` | Settings | the budget period options and the payday stepper |

Drop them in `docs/screenshots/` with exactly those names; the README gallery
picks them up from there.

## Putting the video in the README

GitHub doesn't host video from a repo path, but it does host uploads:

1. Open a new issue in the repo (don't submit it).
2. Drag the `.mov` into the comment box and wait for the upload to finish.
3. Copy the `https://github.com/user-attachments/...` URL it inserts.
4. Paste that URL on its own line in the README, then close the issue draft.

A looping GIF also works and plays inline everywhere: export the clip at
640 px wide, under about 8 MB, and commit it as `docs/demo/demo.gif`.
