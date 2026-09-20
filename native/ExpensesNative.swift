// A tiny bridge for the few things JavaScript cannot do on its own. The file
// name has to match the module name for Expo's inline modules to find it.

internal import ExpoModulesCore
import UserNotifications

class ExpensesNative: Module {
  private static let alertIdentifier = "budget-forecast"
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

    // One nudge before the period ends, replaced every time the budget changes.
    AsyncFunction("scheduleBudgetAlert") { (body: String, at: Double, promise: Promise) in
      let center = UNUserNotificationCenter.current()
      center.removePendingNotificationRequests(withIdentifiers: [Self.alertIdentifier])

      let when = Date(timeIntervalSince1970: at)
      guard when > Date() else {
        promise.resolve(false)
        return
      }
      let content = UNMutableNotificationContent()
      content.title = "Before payday"
      content.body = body
      let parts = Calendar.current.dateComponents(
        [.year, .month, .day, .hour, .minute], from: when)
      let request = UNNotificationRequest(
        identifier: Self.alertIdentifier,
        content: content,
        trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false))
      center.add(request) { _ in promise.resolve(true) }
    }

    Function("cancelBudgetAlert") {
      UNUserNotificationCenter.current()
        .removePendingNotificationRequests(withIdentifiers: [Self.alertIdentifier])
    }
  }
}
