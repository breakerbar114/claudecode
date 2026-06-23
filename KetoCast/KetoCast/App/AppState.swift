import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    @Published var hasCompletedOnboarding: Bool
    @Published var selectedTab: Tab = .home
    @Published var isLoggingPresented = false
    @Published var activeAlert: AppAlert?

    enum Tab: Int, CaseIterable {
        case home, log, analytics, profile
        var icon: String {
            switch self {
            case .home: return "house.fill"
            case .log: return "plus.circle.fill"
            case .analytics: return "chart.xyaxis.line"
            case .profile: return "person.fill"
            }
        }
        var label: String {
            switch self {
            case .home: return "Home"
            case .log: return "Log"
            case .analytics: return "Analytics"
            case .profile: return "Profile"
            }
        }
    }

    enum AppAlert: Identifiable {
        case error(String)
        case info(String)
        var id: String {
            switch self { case .error(let m), .info(let m): return m }
        }
    }

    init() {
        hasCompletedOnboarding = UserDefaults.standard.bool(forKey: "onboardingComplete")
    }

    func completeOnboarding() {
        UserDefaults.standard.set(true, forKey: "onboardingComplete")
        hasCompletedOnboarding = true
    }

    func resetOnboarding() {
        UserDefaults.standard.set(false, forKey: "onboardingComplete")
        hasCompletedOnboarding = false
    }
}
