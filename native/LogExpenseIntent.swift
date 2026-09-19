// What Siri can do with Expenses:
//   "Hey Siri, add groceries to my expenses"        → asks how much, then logs it
//   "Hey Siri, quick add in my expenses"            → say it however you like
//   "Hey Siri, what's left for eating out …"        → answers from the budget
//   "Hey Siri, how much can I spend today …"        → the daily allowance
// plus an action for the Wallet "Transaction" automation, which logs every
// Apple Pay tap. The plumbing lives in SiriInbox.swift.
//
// This folder is compiled into the main app target through Expo's inline
// modules (`experiments.inlineModules` in app.json), which is also where App
// Intents metadata has to live for Siri to find it.

import AppIntents
import Foundation

#if canImport(FoundationModels)
  import FoundationModels
#endif

/// The categories Siri understands. The names must match `DEFAULT_CATEGORIES`
/// in src/db/schema.ts; a Jest test keeps them in sync.
enum ExpenseCategory: String, AppEnum {
  case groceries
  case eatingOut
  case transport
  case bills
  case shopping
  case entertainment
  case health
  case other

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Category"

  static let caseDisplayRepresentations: [ExpenseCategory: DisplayRepresentation] = [
    .groceries: "Groceries",
    .eatingOut: "Eating out",
    .transport: "Transport",
    .bills: "Bills",
    .shopping: "Shopping",
    .entertainment: "Entertainment",
    .health: "Health",
    .other: "Other",
  ]

  /// The category's name in the app's database.
  var storedName: String {
    switch self {
    case .groceries: return "Groceries"
    case .eatingOut: return "Eating out"
    case .transport: return "Transport"
    case .bills: return "Bills"
    case .shopping: return "Shopping"
    case .entertainment: return "Entertainment"
    case .health: return "Health"
    case .other: return "Other"
    }
  }

  /// The closest category to a name said out loud or written by the model.
  static func storedName(matching name: String) -> String {
    let wanted = name.trimmingCharacters(in: .whitespacesAndNewlines)
    let match = allCases.first { $0.storedName.caseInsensitiveCompare(wanted) == .orderedSame }
    return (match ?? .other).storedName
  }
}

struct LogExpenseIntent: AppIntent {
  static let title: LocalizedStringResource = "Add Expense"

  @Parameter(title: "Category", requestValueDialog: "Which category?")
  var category: ExpenseCategory

  @Parameter(title: "Amount", requestValueDialog: "How much?")
  var amount: Double

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let pence = Int((amount * 100).rounded())
    guard pence > 0, pence <= 100_000_000 else {
      throw LogExpenseError.invalidAmount
    }
    let name = category.storedName
    try SiriInbox.add(InboxEntry(amountPence: pence, category: name))

    let added = "Added \(Money.pounds(pence)) to \(name)."
    guard let left = Budget()?.leftLine(category: name) else {
      return .result(dialog: "\(added)")
    }
    return .result(dialog: "\(added) \(left)")
  }
}

/// Records an Apple Pay payment the moment you tap, without opening the app.
/// Meant for a Wallet "Transaction" automation in the Shortcuts app.
struct AddPaymentIntent: AppIntent {
  static let title: LocalizedStringResource = "Add Apple Pay Payment"
  static let description: IntentDescription? = IntentDescription(
    "Adds a payment to Expenses. Use it in a Wallet transaction automation and pass the transaction's Amount and Merchant."
  )

  /// Wallet passes the amount as formatted text, such as "£3.50".
  @Parameter(title: "Amount")
  var amount: String

  @Parameter(title: "Merchant")
  var merchant: String?

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let amountText = amount.trimmingCharacters(in: .whitespacesAndNewlines)
    // Transit taps can report £0.00 and refunds are negative. Skip them quietly
    // rather than failing, so the automation doesn't show an error each time.
    if amountText.contains("-") || amountText.contains("−") {
      return .result(dialog: "Refunds aren't added.")
    }
    guard let pence = Money.parseWallet(amountText) else {
      return .result(dialog: "No amount to add.")
    }

    let place = (merchant ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let budget = Budget()
    // The category is worked out here as well as in the app, so the reply and
    // the notification can name it straight away.
    let category = place.isEmpty ? nil : budget?.categoryName(forMerchant: place)
    try SiriInbox.add(
      InboxEntry(amountPence: pence, category: category, merchant: place.isEmpty ? nil : place))

    let where_ = place.isEmpty ? "" : " at \(place)"
    let added = "Added \(Money.pounds(pence))\(where_)."
    let left = Budget()?.leftLine(category: category)
    if budget?.snapshot.paymentAlerts == true {
      PaymentAlert.post(
        title: "\(Money.pounds(pence))\(where_)", body: left ?? "Added to Expenses.")
    }
    guard let left else {
      return .result(dialog: "\(added)")
    }
    return .result(dialog: "\(added) \(left)")
  }
}

/// Say it however you like: "forty quid petrol and three pounds coffee at Shell".
struct QuickAddIntent: AppIntent {
  static let title: LocalizedStringResource = "Quick Add"
  static let description: IntentDescription? = IntentDescription(
    "Records what you say in your own words. On iPhones with Apple Intelligence it is read on the device; otherwise the app reads it when you next open it."
  )

  @Parameter(title: "What you spent", requestValueDialog: "What did you spend?")
  var text: String

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let said = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !said.isEmpty else {
      return .result(dialog: "I didn't catch that.")
    }

    #if canImport(FoundationModels)
      if #available(iOS 26.0, *), let items = await OnDeviceParser.parse(said), !items.isEmpty {
        for item in items {
          try SiriInbox.add(
            InboxEntry(amountPence: item.pence, category: item.category, note: item.note))
        }
        let summary = items
          .map { "\(Money.pounds($0.pence)) to \($0.category)" }
          .joined(separator: " and ")
        let onlyCategory = items.count == 1 ? items[0].category : nil
        guard let left = Budget()?.leftLine(category: onlyCategory) else {
          return .result(dialog: "Added \(summary).")
        }
        return .result(dialog: "Added \(summary). \(left)")
      }
    #endif

    // Older iPhones: the app's own parser reads it the next time it opens.
    try SiriInbox.add(InboxEntry(text: said))
    return .result(dialog: "Got it. I'll add that the next time you open Expenses.")
  }
}

/// "Hey Siri, what's left for eating out in my expenses?"
struct BudgetLeftIntent: AppIntent {
  static let title: LocalizedStringResource = "Check a Category"
  static let description: IntentDescription? = IntentDescription(
    "Says how much is left for one category this month.")

  @Parameter(title: "Category", requestValueDialog: "Which category?")
  var category: ExpenseCategory

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let budget = Budget() else {
      return .result(dialog: "Open Expenses once and I'll be able to tell you.")
    }
    let name = category.storedName
    let spent = budget.spentPence(category: name)
    let spentText = "You've spent \(Money.pounds(spent)) on \(name) this \(budget.noun)"

    guard let limit = budget.limitPence(category: name) else {
      return .result(dialog: "\(spentText). It has no budget yet.")
    }
    let remaining = limit - spent
    let line =
      remaining >= 0
      ? "\(Money.pounds(remaining)) left for \(name) this \(budget.noun). \(spentText) of \(Money.pounds(limit))."
      : "\(Money.pounds(-remaining)) over on \(name). \(spentText), and the budget is \(Money.pounds(limit))."
    return .result(dialog: "\(line)")
  }
}

/// "Hey Siri, how much can I spend today in my budget?"
struct SpendTodayIntent: AppIntent {
  static let title: LocalizedStringResource = "Check Today's Allowance"
  static let description: IntentDescription? = IntentDescription(
    "Says what is safe to spend today to stay on budget.")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let budget = Budget() else {
      return .result(dialog: "Open Expenses once and I'll be able to tell you.")
    }
    let spent = Money.pounds(budget.totalSpentPence)
    guard let remaining = budget.remainingPence else {
      return .result(
        dialog: "You've spent \(spent) this \(budget.noun). Set a monthly budget in Expenses and I can tell you what's left."
        ))
    }
    guard remaining >= 0 else {
      return .result(
        dialog: "You're \(Money.pounds(-remaining)) over budget this \(budget.noun), with \(spent) spent."
        ))
    }

    let days = budget.daysLeft ?? 0
    let daysText = days == 1 ? "1 day" : "\(days) days"
    var line = "\(Money.pounds(remaining)) left with \(daysText) to go."
    if let allowance = budget.dailyAllowancePence {
      line = "\(Money.pounds(allowance)) a day keeps you on track: \(line)"
    }
    if budget.upcomingPence > 0 {
      line += " That's after \(Money.pounds(budget.upcomingPence)) of fees still to come out."
    }
    return .result(dialog: "\(line)")
  }
}

enum LogExpenseError: Error, CustomLocalizedStringResourceConvertible {
  case invalidAmount

  var localizedStringResource: LocalizedStringResource {
    switch self {
    case .invalidAmount:
      return "That amount doesn't look right. Try again with a number of pounds."
    }
  }
}

#if canImport(FoundationModels)
  /// One purchase the on-device model pulled out of a sentence.
  @available(iOS 26.0, *)
  @Generable
  struct ParsedExpense {
    @Guide(description: "Amount in pounds as a number, for example 12.5. Use 0 if no amount was said.")
    var pounds: Double

    @Guide(description: "What was bought, in one to three words, for example petrol or coffee")
    var item: String

    @Guide(
      description:
        "One of: Groceries, Eating out, Transport, Bills, Shopping, Entertainment, Health, Other")
    var category: String
  }

  @available(iOS 26.0, *)
  @Generable
  struct ParsedExpenses {
    @Guide(description: "One entry for each separate purchase mentioned")
    var items: [ParsedExpense]
  }

  /// Reads a spoken sentence with Apple's on-device model. Nothing leaves the
  /// phone, and it is only available on iPhones with Apple Intelligence.
  @available(iOS 26.0, *)
  enum OnDeviceParser {
    struct Item {
      let pence: Int
      let category: String
      let note: String
    }

    static func parse(_ said: String) async -> [Item]? {
      guard SystemLanguageModel.default.isAvailable else { return nil }

      let session = LanguageModelSession {
        """
        You turn what someone says they spent into expense entries for a British budgeting app.
        Amounts are in pounds sterling. "quid" means pounds, "a fiver" is 5, "a tenner" is 10, \
        "a grand" is 1000, and "twelve fifty" means 12.50. Split a sentence into one entry per \
        purchase, and leave out anything with no amount.
        """
      }
      guard
        let response = try? await session.respond(to: Prompt(said), generating: ParsedExpenses.self)
      else {
        return nil
      }

      return response.content.items.compactMap { parsed in
        let pence = Int((parsed.pounds * 100).rounded())
        guard pence > 0, pence <= 100_000_000 else { return nil }
        return Item(
          pence: pence,
          category: ExpenseCategory.storedName(matching: parsed.category),
          note: parsed.item.trimmingCharacters(in: .whitespacesAndNewlines))
      }
    }
  }
#endif

/// Every phrase has to name the app. `.applicationName` also matches the
/// alternative names in app.json (`INAlternativeAppNames`): "my expenses",
/// "my budget" and "my spending".
struct ExpensesShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: LogExpenseIntent(),
      phrases: [
        "Add \(\.$category) to \(.applicationName)",
        "Add \(\.$category) in \(.applicationName)",
        "Record \(\.$category) in \(.applicationName)",
        "Log \(\.$category) in \(.applicationName)",
        "Add to \(.applicationName)",
        "Add an expense to \(.applicationName)",
        "New expense in \(.applicationName)",
      ]
    )
    AppShortcut(
      intent: QuickAddIntent(),
      phrases: [
        "Quick add in \(.applicationName)",
        "Quick add to \(.applicationName)",
        "I spent money in \(.applicationName)",
      ]
    )
    AppShortcut(
      intent: BudgetLeftIntent(),
      phrases: [
        "What's left for \(\.$category) in \(.applicationName)",
        "How much is left for \(\.$category) in \(.applicationName)",
        "How much have I spent on \(\.$category) in \(.applicationName)",
      ]
    )
    AppShortcut(
      intent: SpendTodayIntent(),
      phrases: [
        "How much can I spend today in \(.applicationName)",
        "How much is left in \(.applicationName)",
        "What's left in \(.applicationName)",
        "How am I doing in \(.applicationName)",
      ]
    )
  }
}
