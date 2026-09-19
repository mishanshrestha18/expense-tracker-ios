// A tiny bridge for the few things JavaScript cannot do on its own. The file
// name has to match the module name for Expo's inline modules to find it.

internal import ExpoModulesCore
import UserNotifications

class ExpensesNative: Module {
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
  }
}
