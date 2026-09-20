// Putting the expenses into iOS search: type "Pret" in Spotlight and the
// payment is there, with a tap that lands on it inside the app.

internal import ExpoModulesCore
import CoreSpotlight
import UniformTypeIdentifiers

/// One expense as Spotlight sees it.
struct SpotlightRecord: Record {
  @Field var id: Int = 0
  @Field var title: String = ""
  @Field var detail: String = ""
  /// Comma separated, so a shop can be found by its category too.
  @Field var keywords: String = ""
}

/// Remembers the expense Spotlight was asked to open. The app asks for it the
/// next time it runs, which covers both a cold launch and a tap while the app
/// was only in the background.
private class SpotlightRouter: ExpoAppDelegateSubscriber {
  static let shared = SpotlightRouter()
  static var registered = false
  static let prefix = "expense-"

  private var pendingId: Int?

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    guard userActivity.activityType == CSSearchableItemActionType,
      let identifier = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
      identifier.hasPrefix(Self.prefix),
      let id = Int(identifier.dropFirst(Self.prefix.count))
    else { return false }

    pendingId = id
    return true
  }

  /// Reads the waiting expense once; asking again gives nothing.
  func take() -> Int {
    defer { pendingId = nil }
    return pendingId ?? 0
  }
}

class ExpensesSpotlight: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpensesSpotlight")

    OnCreate {
      // Registering twice is a fatal error in Expo, and the module is rebuilt
      // on every reload in development.
      if !SpotlightRouter.registered {
        SpotlightRouter.registered = true
        ExpoAppDelegateSubscriberRepository.registerSubscriber(SpotlightRouter.shared)
      }
    }

    // Replaces what is indexed for the expenses handed over. Anything deleted
    // in the app is dropped separately by `forget`.
    AsyncFunction("index") { (records: [SpotlightRecord], promise: Promise) in
      let items = records.map { record -> CSSearchableItem in
        let attributes = CSSearchableItemAttributeSet(contentType: UTType.text)
        attributes.title = record.title
        attributes.contentDescription = record.detail
        attributes.keywords = record.keywords.split(separator: ",").map(String.init)

        return CSSearchableItem(
          uniqueIdentifier: SpotlightRouter.prefix + String(record.id),
          domainIdentifier: "expenses",
          attributeSet: attributes)
      }
      CSSearchableIndex.default().indexSearchableItems(items) { error in
        promise.resolve(error == nil)
      }
    }

    AsyncFunction("forget") { (ids: [Int], promise: Promise) in
      let identifiers = ids.map { SpotlightRouter.prefix + String($0) }
      CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: identifiers) { _ in
        promise.resolve(true)
      }
    }

    AsyncFunction("clear") { (promise: Promise) in
      CSSearchableIndex.default().deleteAllSearchableItems { _ in
        promise.resolve(true)
      }
    }

    /// The expense a Spotlight result asked for, or 0.
    AsyncFunction("takePending") { () -> Int in
      SpotlightRouter.shared.take()
    }
  }
}
