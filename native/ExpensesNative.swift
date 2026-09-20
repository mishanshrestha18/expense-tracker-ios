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
}

class ExpensesNative: Module {
  private static let alertPrefix = "expenses."
  public func definition() -> ModuleDefinition {
    Name("ExpensesNative")

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
