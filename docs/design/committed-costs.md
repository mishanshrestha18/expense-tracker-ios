# Design: committed costs

Status: **proposed**, awaiting a choice between the variants below.
Author: drafted 2026-09-20.

## Problem

The app tracks what has been spent. It says nothing about what is already
spoken for. Rent, council tax, the car, the phone and a dozen subscriptions
leave the account whether or not anyone opens the app, so "£274 left" is a lie
when £900 of it belongs to the landlord.

Two things follow from that:

1. A person cannot answer "what is actually mine to spend?" without doing the
   sums in their head every time.
2. Fixed costs change on a date known months in advance — a rent review, a
   fixed-rate energy deal ending, a season ticket going up in January — and
   nothing reminds them until the money is gone.

The second one is not solved well anywhere. Quicken users still ask for an
"effective date" on a bill amount, and the workaround is to remember to edit it
by hand ([Quicken community](https://community.quicken.com/discussion/7976053/need-an-effective-date-to-change-amounts-on-bill-income-reminders)).

## Goals

- Record what leaves every month regardless of behaviour: rent, utilities,
  transport, car, insurance, subscriptions, loan repayments.
- Handle a **known future change**: £500 until October 2027, £700 after, set
  once, remembered by the app, announced before it happens.
- Separate money that is spoken for from money that is genuinely free, so the
  daily allowance stops over-promising.
- Handle costs that recur but vary (energy, water) without pretending they are
  fixed, and without nagging when they differ.
- Handle costs that are not monthly (annual car insurance, MOT) without a
  surprise in the month they land.
- Stay honest offline and on-device: no bank feed, no account.

## Non-goals

- Paying bills, or knowing whether a payment cleared. The app is not connected
  to a bank.
- Forecasting variable spending beyond the pace maths that already exists.
- Shared or household budgets. One phone, one person, for now.
- Replacing the existing recurring-payment detection, which already spots
  Netflix from history; this is the deliberate, up-front counterpart to it.

## What people actually have

Worth having as a starter list in the app, because a blank screen is the enemy
of setup. UK-shaped:

| Group         | Typical items                                                                                         | Nature                                            |
| ------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Home          | Rent or mortgage, council tax, service charge, contents insurance, TV licence                         | fixed, changes on a date                          |
| Utilities     | Energy, water, broadband, mobile                                                                      | broadband and mobile fixed; energy and water vary |
| Transport     | Car finance, car insurance, road tax, MOT and service, season ticket, breakdown cover, parking permit | mixed, several annual                             |
| Money         | Loan repayment, credit card minimum, savings or pension standing order                                | fixed                                             |
| Life          | Childcare, school fees, gym, pet insurance, professional fees                                         | fixed                                             |
| Subscriptions | Streaming, music, cloud storage, news, software                                                       | fixed, often annual                               |

Two properties fall out of that table: a cost is **fixed or variable**, and it
is **monthly or less often**. Every variant below has to answer both.

## Variant A — Bills list

A `commitments` table and a Bills screen. Each commitment has a name, category,
amount, day of the month, and an optional schedule of future amounts. The app
shows the list, the monthly total, and reminds before each due date and when a
scheduled change takes effect. Budget maths is untouched.

- **For:** small, obvious, one screen, no risk to the numbers people already
  trust. Ships in a day.
- **Against:** the budget still says "£274 left" when rent has not gone out. It
  answers "what do I pay?" but not "what can I spend?".

## Variant B — Committed versus everyday

Variant A's data, plus the budget splits in two: **committed** (what the
commitments add up to this period) and **everyday** (the rest). The headline
ring, the daily allowance and Siri all work from everyday money only. The app
can then say "bills are covered, £23 a day is yours", which is the sentence
people actually want. This is roughly how Monzo's Summary separates committed
spending from [left to spend](https://monzo.com/help/budgeting-overdrafts-savings/what-is-left-to-spend).

- **For:** turns the app into a daily answer rather than a ledger. Fits what is
  already built: `safeToSpendPence` and the recurring "still to come" already
  set money aside; this makes it deliberate and complete.
- **Against:** needs care when a commitment is paid mid-period — the money must
  not be counted twice, once as a commitment and once as the actual payment.
  Requires matching a real expense to a commitment (see "Matching" below).

## Variant C — Plan and confirm (YNAB-style true expenses)

Variant B, plus non-monthly costs are spread: a £600 annual insurance becomes
£50 set aside every month, and the app tracks the pot it has notionally built
up. Each period the app produces an expected list, and the person confirms each
one as it happens. This is YNAB's second rule, [true expenses](https://www.ynab.com/blog/understanding-your-true-expenses-the-power-of-rule-two),
without the envelopes.

- **For:** the annual bills stop being a shock, which is the single biggest
  cause of "the budget was going fine until March".
- **Against:** the most new concepts for the person (set-aside, pot, confirm),
  the most screens, and the most to get wrong. A month of work, not a day.

## Variant D — Promote what is already detected

No new model. The recurring detector already finds monthly payments from
history; let people **pin** one, correct its amount and day, and give it a
future change. Everything shows up in the existing "still to come this period".

- **For:** almost free, and nothing new to learn.
- **Against:** nothing exists until it has been paid three times, so a new
  phone or a new flat starts empty — exactly when the information matters most.
  Cannot express "rent goes up in October 2027" for a rent it has never seen.

## Recommendation

**B, built on A's model, with C's set-aside as a later step.** In order:

1. The `commitments` model, the Bills screen, due and change reminders (A).
2. The committed/everyday split across the ring, the daily allowance, Siri and
   the Apple Pay reply (B).
3. Monthly set-aside for annual costs, once the first two have been lived with
   (C).

D gets folded in as a shortcut: a detected series offers "make this a
commitment", which pre-fills the form. That keeps the clever part of D without
depending on it.

## Data model

```sql
CREATE TABLE commitments (
  id            INTEGER PRIMARY KEY NOT NULL,
  name          TEXT    NOT NULL,
  category_id   INTEGER NOT NULL REFERENCES categories (id),
  -- 'fixed'    same every time, changes only on a date we know about
  -- 'variable' recurs but the amount moves (energy, water)
  kind          TEXT    NOT NULL DEFAULT 'fixed',
  -- 1–31, clamped to the length of the month
  due_day       INTEGER NOT NULL,
  -- 1 = monthly, 3 = quarterly, 12 = annual
  every_months  INTEGER NOT NULL DEFAULT 1,
  -- the month the first payment lands in, for non-monthly costs
  anchor_month  TEXT    NOT NULL,
  ended_on      TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A timeline, not a single amount: "£500 until October 2027, £700 after".
CREATE TABLE commitment_amounts (
  commitment_id  INTEGER NOT NULL REFERENCES commitments (id) ON DELETE CASCADE,
  effective_from TEXT    NOT NULL,       -- YYYY-MM-DD
  amount_pence   INTEGER NOT NULL CHECK (amount_pence > 0),
  PRIMARY KEY (commitment_id, effective_from)
);

-- What has actually been paid against a commitment, so nothing is double counted.
CREATE TABLE commitment_payments (
  commitment_id INTEGER NOT NULL REFERENCES commitments (id) ON DELETE CASCADE,
  expense_id    INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  PRIMARY KEY (commitment_id, expense_id)
);
```

The amount for a date is the latest row in `commitment_amounts` with
`effective_from <= date`. A rent rise is one extra row, entered today, dated
2027-10-01. Nothing has to be remembered afterwards.

Variable commitments keep the same shape; their amount is an estimate, updated
from the last three payments, and they are shown with a "≈" so the number is
never mistaken for a promise.

## Matching

A commitment is "done" for a period when a payment is linked to it. Three ways,
cheapest first:

1. **Automatic:** an Apple Pay payment or a typed expense whose shop words match
   the commitment's name, in the same category, within a few days of the due
   date and within 20% of the expected amount.
2. **Suggested:** anything close but not certain appears as "is this your
   Vodafone bill?" on the Bills screen, one tap to confirm.
3. **Manual:** mark it paid.

This reuses the merchant matching already written for Apple Pay and the learned
rules, so a confirmation also teaches the categoriser.

## Reminders

Local notifications only, on the schedule the app already owns:

- **Due soon:** the morning of the due date, for fixed commitments over a
  threshold, and only when nothing has been matched yet.
- **Amount change:** a week before `effective_from`, and again on the day —
  "Rent goes from £500 to £700 on 1 October". Fixed commitments only; variable
  ones never nag, which is the point of the `kind` column.
- **Nothing else.** One idle notification too many and the app gets muted,
  which costs more than the feature is worth.

In-app, the same information is a banner on Overview and a row on Bills, so the
reminder survives a dismissed notification.

## What it changes elsewhere

- `budgetOverview` gains committed and everyday totals; the ring and
  `dailyAllowancePence` work from everyday.
- The Siri snapshot gains the committed total and the next due item, so
  "how much can I spend today" answers from everyday money, and "what's coming
  out?" becomes answerable.
- The recurring detector stays, minus anything already covered by a commitment,
  so the two never show the same fee twice.

## Making it a daily habit

Worth stating plainly, because this is the point of the feature:

- **One number, always true.** "Yours to spend today" after bills, on the
  Overview, in Siri, and in the Apple Pay reply.
- **Reassurance, not guilt.** "Bills are covered until payday" is what brings
  someone back tomorrow; "you overspent" is what makes them delete the app.
- **Tell them something they cannot see elsewhere.** A rent rise three weeks
  out, an annual renewal, a subscription unused for 90 days.
- **The month-end note.** One screen on payday: what went out, what changed,
  what is coming next month.

## Open questions

1. Does a commitment create an expense automatically on its due date, or only
   when matched? Automatic keeps totals honest offline; matching keeps them
   true. The recommendation is: count it in committed money from the due date,
   but only create an expense when matched or manually confirmed.
2. Should committed money be shown inside the monthly budget or beside it?
   Monzo puts it inside; YNAB gives it its own envelope.
3. How far ahead should the Bills screen show — this period, or a rolling
   twelve months with the annual costs visible?

## Sources

- [Design docs — a design doc](https://www.industrialempathy.com/posts/design-doc-a-design-doc/) for the shape of this document.
- [Monzo: what is "Left to Spend"](https://monzo.com/help/budgeting-overdrafts-savings/what-is-left-to-spend) and [how Summary works](https://monzo.com/help/budgeting-overdrafts-savings/what-is-summary).
- [YNAB: understanding your true expenses](https://www.ynab.com/blog/understanding-your-true-expenses-the-power-of-rule-two).
- [Quicken: request for an effective date on bill amounts](https://community.quicken.com/discussion/7976053/need-an-effective-date-to-change-amounts-on-bill-income-reminders).
