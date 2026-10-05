import Foundation
import WidgetKit

/// Reads and writes `BloomData` in the App Group so the app and widget share it.
enum BloomStorage {
    private static let key = "bloom.data.v1"

    /// Set per-target in Config/*-Info.plist from the BUNDLE_ID_PREFIX build setting.
    static var appGroupID: String? {
        Bundle.main.object(forInfoDictionaryKey: "AppGroupID") as? String
    }

    private static var defaults: UserDefaults {
        appGroupID.flatMap { UserDefaults(suiteName: $0) } ?? .standard
    }

    static func load() -> BloomData {
        guard let raw = defaults.data(forKey: key) else { return .sample }
        return (try? JSONDecoder().decode(BloomData.self, from: raw)) ?? .sample
    }

    static func save(_ data: BloomData) {
        guard let raw = try? JSONEncoder().encode(data) else { return }
        defaults.set(raw, forKey: key)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func update(_ change: (inout BloomData) -> Void) {
        var data = load()
        change(&data)
        save(data)
    }
}
