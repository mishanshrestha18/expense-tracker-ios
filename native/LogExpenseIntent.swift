// Siri support: "Hey Siri, log groceries in Expenses" → "How much?" → "285".
//
// App Intents run inside the app's process without opening it. Instead of
// writing to the app's SQLite database directly (a second copy of SQLite in the
// same process can corrupt a shared file), the intent drops each expense into
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
  static let title: LocalizedStringResource = "Log Expense"

  @Parameter(title: "Category", requestValueDialog: "Which category?")
  var category: ExpenseCategory

  @Parameter(title: "Amount", requestValueDialog: "How much?")
  var amount: Double

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let pence = Int((amount * 100).rounded())
    guard pence > 0, pence <= 100_000_000 else {
      throw LogExpenseError.invalidAmount
    }
    try SiriInbox.add(amountPence: pence, category: category.storedName)
    let spoken = SiriInbox.formatPounds(pence)
    return .result(dialog: "Logged \(spoken) to \(category.storedName).")
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

struct ExpensesShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: LogExpenseIntent(),
      phrases: [
        "Log \(\.$category) in \(.applicationName)",
        "Record \(\.$category) in \(.applicationName)",
        "Add \(\.$category) to \(.applicationName)",
        "Log an expense in \(.applicationName)",
        "Add an expense to \(.applicationName)",
      ]
    )
  }
}

/// Hands expenses from Siri to the app through small JSON files.
enum SiriInbox {
  struct Entry: Codable {
    let amountPence: Int
    let category: String
    /// Local calendar date, `yyyy-MM-dd`.
    let spentOn: String
    let createdAt: String
  }

  static func add(amountPence: Int, category: String) throws {
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

    let entry = Entry(
      amountPence: amountPence,
      category: category,
      spentOn: day.string(from: now),
      createdAt: ISO8601DateFormatter().string(from: now)
    )
    let data = try JSONEncoder().encode(entry)
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
