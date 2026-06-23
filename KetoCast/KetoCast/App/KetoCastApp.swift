import SwiftUI

@main
struct KetoCastApp: App {
    @StateObject private var appState = AppState()
    private let persistenceController = PersistenceController.shared

    var body: some Scene {
        WindowGroup {
            if appState.hasCompletedOnboarding {
                MainTabView()
                    .environmentObject(appState)
                    .environment(\.managedObjectContext, persistenceController.container.viewContext)
                    .preferredColorScheme(.dark)
            } else {
                OnboardingContainerView()
                    .environmentObject(appState)
                    .environment(\.managedObjectContext, persistenceController.container.viewContext)
                    .preferredColorScheme(.dark)
            }
        }
    }
}
