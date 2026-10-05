import SwiftUI

@main
struct BloomApp: App {
    @StateObject private var store = GoalStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            TodayView()
                .environmentObject(store)
                .tint(Theme.accent)
        }
        .onChange(of: scenePhase) { _, phase in
            // Pick up check-ins made from the widget while the app was in the background.
            if phase == .active { store.reload() }
        }
    }
}
