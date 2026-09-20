// "£41 left for September" on the Home Screen and the Lock Screen. The app
// writes the numbers into the shared App Group whenever anything changes
// (see src/widget/publish.ts); this only reads them.

import SwiftUI
import WidgetKit

private let appGroup = "group.com.nicklane123.expenses"
private let storageKey = "budget"

struct Budget: Decodable {
  /// Already formatted, so the widget never has to know about pence.
  let left: String
  /// "left for September" or "over for September".
  let label: String
  let spent: String
  let savings: String?
  /// Spent ÷ budget, 0–1 for the gauge.
  let ratio: Double
  let over: Bool

  static let placeholder = Budget(
    left: "£41.00", label: "left for September", spent: "£1,240.00", savings: "£420.00",
    ratio: 0.72, over: false)

  static func read() -> Budget? {
    guard let defaults = UserDefaults(suiteName: appGroup),
      let json = defaults.string(forKey: storageKey),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(Budget.self, from: data)
  }
}

struct BudgetEntry: TimelineEntry {
  let date: Date
  let budget: Budget?
}

struct BudgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> BudgetEntry {
    BudgetEntry(date: Date(), budget: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (BudgetEntry) -> Void) {
    completion(BudgetEntry(date: Date(), budget: context.isPreview ? .placeholder : Budget.read()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BudgetEntry>) -> Void) {
    // The app reloads the timeline whenever the figures change; this is only
    // the fallback for a phone that has not been opened in a while.
    let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
    completion(Timeline(entries: [BudgetEntry(date: Date(), budget: Budget.read())], policy: .after(next)))
  }
}

/// Shown until the app has been opened once.
private struct Waiting: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("Expenses").font(.headline)
      Text("Open the app once to see what is left.")
        .font(.caption)
        .foregroundStyle(.secondary)
    }
  }
}

private struct SmallBudget: View {
  let budget: Budget

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(budget.left)
        .font(.system(.title, design: .rounded, weight: .bold))
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .foregroundStyle(budget.over ? Color.red : Color("WidgetTint"))
      Text(budget.label)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
      Spacer(minLength: 0)
      if let savings = budget.savings {
        Text("\(savings) saved")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct MediumBudget: View {
  let budget: Budget

  var body: some View {
    HStack(spacing: 16) {
      SmallBudget(budget: budget)
      VStack(alignment: .trailing, spacing: 6) {
        Gauge(value: min(max(budget.ratio, 0), 1)) {
          EmptyView()
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .tint(budget.over ? Color.red : Color("WidgetTint"))
        Text("\(budget.spent) spent")
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
    }
  }
}

struct ExpensesWidgetView: View {
  @Environment(\.widgetFamily) var family
  var entry: BudgetProvider.Entry

  var body: some View {
    Group {
      if let budget = entry.budget {
        switch family {
        case .accessoryCircular:
          Gauge(value: min(max(budget.ratio, 0), 1)) {
            Text(budget.over ? "over" : "left")
          }
          .gaugeStyle(.accessoryCircular)
        case .accessoryRectangular:
          VStack(alignment: .leading, spacing: 1) {
            Text(budget.left).font(.headline)
            Text(budget.label).font(.caption).foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        case .systemMedium:
          MediumBudget(budget: budget)
        default:
          SmallBudget(budget: budget)
        }
      } else {
        Waiting()
      }
    }
    .containerBackground(for: .widget) {
      Color("WidgetBackground")
    }
  }
}

struct ExpensesWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ExpensesWidget", provider: BudgetProvider()) { entry in
      ExpensesWidgetView(entry: entry)
    }
    .configurationDisplayName("What's left")
    .description("How much of this month's budget is still yours to spend.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
  }
}

@main
struct ExpensesWidgetBundle: WidgetBundle {
  var body: some Widget {
    ExpensesWidget()
  }
}
