// Siri support: "Hey Siri, add groceries to my expenses" → "How much?" → "285".
// Apple Pay support: a Wallet "Transaction" automation in the Shortcuts app runs
// AddPaymentIntent each time you pay, with the amount and the merchant.
//
// App Intents run inside the app's process without opening it. Instead of
// writing to the app's SQLite database directly (a second copy of SQLite in the
// same process can corrupt a shared file), the intents drop each expense into
// Documents/siri-inbox/ as a small JSON file. The app imports and removes those
// files whenever it becomes active; see src/siri/inbox.ts.
//
// This folder is compiled into the main app target through Expo's inline modules
// (`experiments.inlineModules` in app.json), which is also where App Intents
// metadata has to live for Siri to find it.

import AppIntents
import Foundation

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
    try SiriInbox.add(SiriInbox.Entry(amountPence: pence, category: category.storedName))
    let spoken = SiriInbox.formatPounds(pence)
    return .result(dialog: "Added \(spoken) to \(category.storedName).")
  }
}

/// Records an Apple Pay payment the moment you tap, without opening the app.
/// Meant for a Wallet "Transaction" automation in the Shortcuts app. The app
/// picks the category from the merchant when it next opens.
struct AddPaymentIntent: AppIntent {
  static let title: LocalizedStringResource = "Add Apple Pay Payment"
  static let description: IntentDescription? = IntentDescription(
    "Adds a payment to Expenses. Use it in a Wallet transaction automation and pass the transaction's Amount and Merchant."
  )

  /// Wallet passes the amount as formatted text, such as "£3.50"; the app parses it.
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
    guard amountText.rangeOfCharacter(from: CharacterSet(charactersIn: "123456789")) != nil else {
      return .result(dialog: "No amount to add.")
    }
    let place = (merchant ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    try SiriInbox.add(SiriInbox.Entry(amountText: amountText, merchant: place))
    if place.isEmpty {
      return .result(dialog: "Added \(amountText).")
    }
    return .result(dialog: "Added \(amountText) at \(place).")
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
  }
}

/// Hands expenses from Siri and Apple Pay to the app through small JSON files.
enum SiriInbox {
  /// Siri sends `amountPence` and `category`. Apple Pay payments send
  /// `amountText` as Wallet formats it and the `merchant`; the app works out
  /// the pence and the category.
  struct Entry: Encodable {
    var amountPence: Int?
    var amountText: String?
    var category: String?
    var merchant: String?
    /// Local calendar date, `yyyy-MM-dd`.
    var spentOn = ""
    var createdAt = ""
  }

  static func add(_ entry: Entry) throws {
    let directory = try FileManager.default
      .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("siri-inbox", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

    let now = Date()
    let day = DateFormatter()
    day.calendar = Calendar(identifier: .gregorian)
    day.locale = Locale(identifier: "en_US_POSIX")
    day.timeZone = TimeZone.current
    day.dateFormat = "yyyy-MM-dd"

    var dated = entry
    dated.spentOn = day.string(from: now)
    dated.createdAt = ISO8601DateFormatter().string(from: now)
    let data = try JSONEncoder().encode(dated)
    // One file per expense, written atomically, so the app never reads half a file.
    try data.write(to: directory.appendingPathComponent("\(UUID().uuidString).json"), options: .atomic)
  }

  static func formatPounds(_ pence: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "GBP"
    formatter.locale = Locale(identifier: "en_GB")
    return formatter.string(from: NSNumber(value: Double(pence) / 100)) ?? "£\(Double(pence) / 100)"
  }
}
