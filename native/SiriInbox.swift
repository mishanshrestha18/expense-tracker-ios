// The bridge between the App Intents and the app.
//
// Intents run in the app's process without opening it, so they never touch the
// app's SQLite database (a second copy of SQLite writing the same file can
// corrupt it). Instead:
//   • expenses are dropped into Documents/siri-inbox/ as small JSON files,
//     which the app imports and deletes when it next becomes active;
//   • the app publishes Documents/budget-snapshot.json after every change, so
//     Siri can say what is left without opening anything.
// See src/siri/inbox.ts and src/siri/budget-snapshot.ts.

import Foundation
import UserNotifications

/// Local calendar dates, `yyyy-MM-dd`, exactly as the app stores them.
enum CalendarDate {
  private static let formatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
  }()

  static func string(from date: Date) -> String {
    formatter.string(from: date)
  }

  static func today() -> String {
    string(from: Date())
  }

  /// "25 September", for reading a date out loud.
  static func spoken(_ iso: String) -> String {
    guard let date = formatter.date(from: iso) else { return iso }
    let spoken = DateFormatter()
    spoken.locale = Locale(identifier: "en_GB")
    spoken.dateFormat = "d MMMM"
    return spoken.string(from: date)
  }

  /// Whole days between two calendar dates, ignoring the time of day.
  static func days(from start: String, to end: String) -> Int? {
    guard let first = formatter.date(from: start), let last = formatter.date(from: end) else {
      return nil
    }
    return Calendar(identifier: .gregorian).dateComponents([.day], from: first, to: last).day
  }
}

/// One expense handed to the app. Siri fills in `amountPence` and `category`;
/// Apple Pay fills in `amountText` as Wallet formats it plus the `merchant`;
/// dictation that could not be understood here arrives as `text`.
struct InboxEntry: Codable {
  var amountPence: Int?
  var amountText: String?
  var category: String?
  var merchant: String?
  var text: String?
  var note: String?
  /// Local calendar date, `yyyy-MM-dd`.
  var spentOn = ""
  var createdAt = ""

  /// What this entry adds to the total, as far as the intents can tell.
  var pence: Int? {
    if let amountPence { return amountPence }
    if let amountText { return Money.parseWallet(amountText) }
    return nil
  }
}

enum SiriInbox {
  private static let directoryName = "siri-inbox"

  private static func directory(create: Bool) throws -> URL {
    let documents = try FileManager.default.url(
      for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: create)
    let inbox = documents.appendingPathComponent(directoryName, isDirectory: true)
    if create {
      try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
    }
    return inbox
  }

  static func add(_ entry: InboxEntry) throws {
    var dated = entry
    let now = Date()
    dated.spentOn = CalendarDate.string(from: now)
    dated.createdAt = ISO8601DateFormatter().string(from: now)

    let data = try JSONEncoder().encode(dated)
    let file = try directory(create: true).appendingPathComponent("\(UUID().uuidString).json")
    // Written atomically, so the app never reads half a file.
    try data.write(to: file, options: .atomic)
  }

  /// Everything logged since the app last caught up, so answers stay current.
  static func pending() -> [InboxEntry] {
    guard let inbox = try? directory(create: false),
      let files = try? FileManager.default.contentsOfDirectory(
        at: inbox, includingPropertiesForKeys: nil)
    else {
      return []
    }
    return files.filter { $0.pathExtension == "json" }.compactMap { file in
      guard let data = try? Data(contentsOf: file) else { return nil }
      return try? JSONDecoder().decode(InboxEntry.self, from: data)
    }
  }
}

enum Money {
  private static let formatter: NumberFormatter = {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "GBP"
    formatter.locale = Locale(identifier: "en_GB")
    return formatter
  }()

  static func pounds(_ pence: Int) -> String {
    formatter.string(from: NSNumber(value: Double(pence) / 100)) ?? "£\(Double(pence) / 100)"
  }

  /// Reads an amount the way Wallet writes it: "£3.50", "£1,234.56", "€12,00".
  /// Refunds and zero amounts return nil, matching parseWalletAmount in TypeScript.
  static func parseWallet(_ text: String) -> Int? {
    guard !text.contains("-"), !text.contains("−") else { return nil }
    var digits = String(text.filter { $0.isNumber || $0 == "." || $0 == "," })
    // A comma with two digits after it is a decimal separator, not thousands.
    if !digits.contains("."), let comma = digits.lastIndex(of: ","),
      digits.distance(from: digits.index(after: comma), to: digits.endIndex) == 2
    {
      digits.replaceSubrange(comma...comma, with: ".")
    }
    digits = digits.replacingOccurrences(of: ",", with: "")
    guard let value = Decimal(string: digits) else { return nil }
    let pence = NSDecimalNumber(decimal: value * 100).rounding(accordingToBehavior: nil).intValue
    return pence > 0 && pence <= 100_000_000 ? pence : nil
  }
}

/// Matches a shop name against the category words the app publishes. It mirrors
/// `matchCategory` in src/domain/quick-add.ts: same words, same plural rule,
/// longest phrase wins.
enum Matching {
  static func words(_ text: String) -> [String] {
    let folded = text.folding(options: [.diacriticInsensitive], locale: Locale(identifier: "en_GB"))
    let stripped = folded.lowercased().replacingOccurrences(
      of: "['’]", with: "", options: .regularExpression)
    return
      stripped
      .split(whereSeparator: { !$0.isLetter && !$0.isNumber && $0 != "-" })
      .map { singular(String($0)) }
  }

  static func singular(_ word: String) -> String {
    if word.count > 4, word.hasSuffix("ies") { return String(word.dropLast(3)) + "y" }
    if word.count > 3, word.hasSuffix("s"), !word.hasSuffix("ss") { return String(word.dropLast()) }
    return word
  }

  static func contains(_ words: [String], phrase: [String]) -> Bool {
    guard !phrase.isEmpty, words.count >= phrase.count else { return false }
    for start in 0...(words.count - phrase.count) where Array(words[start..<start + phrase.count]) == phrase {
      return true
    }
    return false
  }
}

/// The budget summary the app publishes after every change.
struct BudgetSnapshot: Decodable {
  struct PeriodInfo: Decodable {
    let key: String
    let start: String
    /// Exclusive.
    let end: String
    let label: String
  }

  struct Committed: Decodable {
    let duePence: Int
    let paidPence: Int
    let outstandingPence: Int
    let overduePence: Int
    let setAsidePence: Int
  }

  struct Bill: Decodable {
    let name: String
    let dueOn: String
    let amountPence: Int
    let overdue: Bool
  }

  struct CategoryInfo: Decodable {
    let name: String
    let limitPence: Int?
    let spentPence: Int
    let phrases: [[String]]
    /// Shops filed here by hand. Optional so an older summary still decodes.
    let learned: [[String]]?
  }

  let version: Int
  let today: String
  /// "month" or "period", so Siri uses the same word as the app.
  let noun: String
  let period: PeriodInfo
  let next: PeriodInfo
  let monthlyLimitPence: Int?
  let spentPence: Int
  let upcomingPence: Int
  /// Optional so an older summary still decodes after an update.
  let paymentAlerts: Bool?
  let forecastPence: Int?
  /// The bills side of the budget. Optional so an older summary still decodes.
  let committed: Committed?
  let everydayLimitPence: Int?
  let everydaySpentPence: Int?
  let bills: [Bill]?
  /// What had been spent by this point in earlier periods. Optional so an
  /// older summary still decodes.
  let lastPeriodPence: Int?
  let lastYearPence: Int?
  let categories: [CategoryInfo]

  static func load() -> BudgetSnapshot? {
    guard
      let documents = try? FileManager.default.url(
        for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false),
      let data = try? Data(contentsOf: documents.appendingPathComponent("budget-snapshot.json"))
    else {
      return nil
    }
    return try? JSONDecoder().decode(BudgetSnapshot.self, from: data)
  }
}

/// The published summary plus anything logged since, so an answer includes the
/// expense Siri has just added.
struct Budget {
  let snapshot: BudgetSnapshot
  let period: BudgetSnapshot.PeriodInfo
  /// True when a new period has started but the app has not opened since, so
  /// its totals start again at zero.
  let rolledOver: Bool
  let pending: [InboxEntry]
  let today: String

  init?(today: String = CalendarDate.today()) {
    guard let snapshot = BudgetSnapshot.load() else { return nil }
    // Worked out in locals first: a closure below cannot capture a property
    // while the rest are still uninitialised.
    let current: BudgetSnapshot.PeriodInfo
    let rolled: Bool
    if today < snapshot.period.end {
      current = snapshot.period
      rolled = false
    } else if today < snapshot.next.end {
      current = snapshot.next
      rolled = true
    } else {
      return nil  // Too old to be worth repeating.
    }

    self.snapshot = snapshot
    self.today = today
    period = current
    rolledOver = rolled
    pending = SiriInbox.pending().filter {
      $0.spentOn >= current.start && $0.spentOn < current.end
    }
  }

  var noun: String { snapshot.noun }

  private func category(_ name: String) -> BudgetSnapshot.CategoryInfo? {
    snapshot.categories.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }
  }

  private func pendingPence(category name: String?) -> Int {
    pending.reduce(0) { total, entry in
      guard let pence = entry.pence else { return total }
      guard let name else { return total + pence }
      let matches = entry.category?.caseInsensitiveCompare(name) == .orderedSame
      return matches ? total + pence : total
    }
  }

  func spentPence(category name: String) -> Int {
    let published = rolledOver ? 0 : (category(name)?.spentPence ?? 0)
    return published + pendingPence(category: name)
  }

  func limitPence(category name: String) -> Int? {
    category(name)?.limitPence
  }

  var totalSpentPence: Int {
    (rolledOver ? 0 : snapshot.spentPence) + pendingPence(category: nil)
  }

  /// What the bills take this period, due money plus what is set aside for the
  /// ones that are not monthly.
  var committedPence: Int {
    guard !rolledOver, let committed = snapshot.committed else { return 0 }
    return committed.duePence + committed.setAsidePence
  }

  var bills: [BudgetSnapshot.Bill] { rolledOver ? [] : (snapshot.bills ?? []) }

  var upcomingPence: Int { rolledOver ? 0 : snapshot.upcomingPence }

  /// What is left of the money that is genuinely free: the budget with the
  /// bills taken out, less everyday spending.
  var remainingPence: Int? {
    if committedPence > 0, let everydayLimit = snapshot.everydayLimitPence {
      let spent = (snapshot.everydaySpentPence ?? snapshot.spentPence) + pendingPence(category: nil)
      return everydayLimit - spent
    }
    guard let limit = snapshot.monthlyLimitPence else { return nil }
    return limit - totalSpentPence
  }

  var daysLeft: Int? {
    guard let days = CalendarDate.days(from: today, to: period.end) else { return nil }
    return max(days, 0)
  }

  /// What is safe to spend each day once the fees still to come are set aside.
  var dailyAllowancePence: Int? {
    guard let remaining = remainingPence, let days = daysLeft, days > 0 else { return nil }
    let safe = remaining - upcomingPence
    return safe > 0 ? safe / days : nil
  }

  func categoryName(forMerchant merchant: String) -> String? {
    let words = Matching.words(merchant)

    // What the person has filed by hand wins over the built-in word lists.
    for category in snapshot.categories {
      for phrase in category.learned ?? [] where Matching.contains(words, phrase: phrase) {
        return category.name
      }
    }

    var best: (name: String, length: Int)?
    for category in snapshot.categories {
      for phrase in category.phrases where Matching.contains(words, phrase: phrase) {
        if best == nil || phrase.count > best!.length {
          best = (category.name, phrase.count)
        }
      }
    }
    return best?.name
  }

  /// "£120 more than this time last month", or nil with nothing to compare against.
  func comparedWith(_ pence: Int?, label: String) -> String? {
    guard let pence, pence > 0 else { return nil }
    let difference = totalSpentPence - pence
    if abs(difference) < 500 { return "about the same as \(label)" }
    return difference > 0
      ? "\(Money.pounds(difference)) more than \(label)"
      : "\(Money.pounds(-difference)) less than \(label)"
  }

  /// "At this pace you'll finish £64 over." `nil` when it is too early to say.
  var forecastLine: String? {
    guard !rolledOver, let projected = snapshot.forecastPence,
      let limit = snapshot.monthlyLimitPence
    else {
      return nil
    }
    let difference = projected - limit
    return difference > 0
      ? "At this pace you'll finish \(Money.pounds(difference)) over."
      : "At this pace you'll finish \(Money.pounds(-difference)) under."
  }

  /// "£41 left for Eating out this month." — the line that follows a new expense.
  func leftLine(category name: String?) -> String? {
    if let name, let limit = limitPence(category: name) {
      let remaining = limit - spentPence(category: name)
      return remaining >= 0
        ? "\(Money.pounds(remaining)) left for \(name) this \(noun)."
        : "\(Money.pounds(-remaining)) over on \(name)."
    }
    guard let remaining = remainingPence else { return nil }
    return remaining >= 0
      ? "\(Money.pounds(remaining)) left this \(noun)."
      : "\(Money.pounds(-remaining)) over your budget."
  }
}

/// Notifications for payments added while the phone is in a pocket.
enum PaymentAlert {
  static func post(title: String, body: String) {
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { settings in
      guard settings.authorizationStatus == .authorized else { return }
      let content = UNMutableNotificationContent()
      content.title = title
      content.body = body
      center.add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }
  }
}
