// A tiny bridge for the few things JavaScript cannot do on its own. The file
// name has to match the module name for Expo's inline modules to find it.

internal import ExpoModulesCore
import UserNotifications

/// One scheduled reminder, as the app describes it.
struct AlertRecord: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var body: String = ""
  /// Seconds since 1970, local time applied by the calendar trigger.
  @Field var at: Double = 0
  /// The bill this reminder is about, so it can be marked paid from the
  /// notification itself. Zero when the reminder is not about a bill.
  @Field var billId: Int = 0
  /// Which occurrence of that bill, `YYYY-MM-DD`.
  @Field var billDueOn: String = ""
}

/// Written when someone taps "Paid" on a bill reminder. The app imports and
/// deletes these the next time it opens (see src/siri/bill-inbox.ts).
private struct BillInbox {
  static let directory = "bill-inbox"

  static func add(billId: Int, dueOn: String) {
    guard
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
    else { return }
    let folder = documents.appendingPathComponent(directory, isDirectory: true)
    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    let payload: [String: Any] = [
      "commitmentId": billId,
      "dueOn": dueOn,
      "settledAt": ISO8601DateFormatter().string(from: Date()),
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
    try? data.write(to: folder.appendingPathComponent("\(UUID().uuidString).json"))
  }
}

/// Handles the buttons on a reminder. Marking a bill paid has to work without
/// the app coming to the front, so the answer is written to a file and read
/// back the next time the app runs.
///
/// The delegate is assigned as the module is created, which happens while the
/// app is still launching — iOS requires it to be in place by then, or a
/// response that launched the app is dropped.
private class AlertActions: NSObject, UNUserNotificationCenterDelegate {
  static let shared = AlertActions()
  static let billCategory = "expenses.bill"
  static let markPaid = "expenses.mark-paid"

  static var category: UNNotificationCategory {
    UNNotificationCategory(
      identifier: billCategory,
      actions: [
        UNNotificationAction(identifier: markPaid, title: "Paid", options: [])
      ],
      intentIdentifiers: [],
      options: [])
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let info = response.notification.request.content.userInfo
    if response.actionIdentifier == Self.markPaid,
      let billId = info["billId"] as? Int,
      let dueOn = info["billDueOn"] as? String
    {
      BillInbox.add(billId: billId, dueOn: dueOn)
    }
    completionHandler()
  }

  /// Reminders are worth seeing even with the app open.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .list])
  }
}

class ExpensesNative: Module {
  private static let alertPrefix = "expenses."
  public func definition() -> ModuleDefinition {
    Name("ExpensesNative")

    OnCreate {
      let center = UNUserNotificationCenter.current()
      center.delegate = AlertActions.shared
      center.setNotificationCategories([AlertActions.category])
    }

    // Asked for from Settings, so the Apple Pay action can say what a tap left
    // behind while the phone is still in your hand.
    AsyncFunction("requestNotificationPermission") { (promise: Promise) in
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) {
        granted, _ in
        promise.resolve(granted)
      }
    }

    // The whole reminder schedule in one call: bills due, amounts changing, and
    // the nudge before the period ends. Replaces whatever was booked before, so
    // nothing lingers after a budget changes.
    AsyncFunction("setAlerts") { (alerts: [AlertRecord], promise: Promise) in
      let center = UNUserNotificationCenter.current()
      center.getPendingNotificationRequests { pending in
        let ours = pending.map { $0.identifier }.filter { $0.hasPrefix(Self.alertPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: ours)

        let now = Date().timeIntervalSince1970
        for alert in alerts where alert.at > now {
          let content = UNMutableNotificationContent()
          content.title = alert.title
          content.body = alert.body
          // A bill reminder carries a "Paid" button and what it would settle.
          if alert.billId > 0 {
            content.categoryIdentifier = AlertActions.billCategory
            content.userInfo = ["billId": alert.billId, "billDueOn": alert.billDueOn]
          }
          let when = Date(timeIntervalSince1970: alert.at)
          let parts = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute], from: when)
          center.add(
            UNNotificationRequest(
              identifier: Self.alertPrefix + alert.id,
              content: content,
              trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)))
        }
        promise.resolve(true)
      }
    }
  }
}
