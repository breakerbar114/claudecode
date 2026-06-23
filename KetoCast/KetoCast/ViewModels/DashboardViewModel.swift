import Foundation
import Combine
import CoreData

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var todayLogs: [FoodLog] = []
    @Published var todayMacros: DailyMacros = DailyMacros(from: [])
    @Published var profile: UserProfile = UserProfile.load()
    @Published var streak: Int = 0
    @Published var waterOz: Double = 0
    @Published var nudges: [ClaudeCoachingService.CoachingNudge] = []
    @Published var isLoadingNudges = false
    @Published var activeCaloriesBurned: Double = 0

    private let store = LogStore.shared

    init() {
        refresh()
    }

    func refresh() {
        todayLogs  = store.logsForToday()
        todayMacros = DailyMacros(from: todayLogs)
        streak      = store.computeStreak(carbTarget: profile.carbTarget)
        waterOz     = store.todayWaterOz()
    }

    func addLog(_ log: FoodLog) {
        store.add(log)
        refresh()
        KC.impact(.medium)

        // Trigger carb warning if approaching limit
        if todayMacros.netCarbs / profile.carbTarget >= 0.8 {
            NotificationService.shared.scheduleCarbWarning(
                netCarbsConsumed: todayMacros.netCarbs, target: profile.carbTarget)
        }
    }

    func removeLog(_ log: FoodLog) {
        store.remove(log)
        refresh()
    }

    func addWater(oz: Double) {
        store.addWater(oz: oz)
        waterOz = store.todayWaterOz()
        KC.impact(.light)
    }

    func fetchNudges() async {
        guard !isLoadingNudges else { return }
        isLoadingNudges = true
        defer { isLoadingNudges = false }
        let recentLogs   = store.logsForLastDays(7)
        let recentWeight = WeightStore.shared.entries(days: 30)
        nudges = (try? await ClaudeCoachingService.shared.generateNudges(
            profile: profile, recentLogs: recentLogs, recentWeight: recentWeight)) ?? []
    }

    func logsForSlot(_ slot: FoodLog.MealSlot) -> [FoodLog] {
        todayLogs.filter { $0.mealSlot == slot }
    }

    // Electrolyte progress (0.0–1.0) against keto-recommended targets
    var sodiumProgress: Double    { min(1, todayMacros.sodium / 4000) }
    var potassiumProgress: Double { min(1, todayMacros.potassium / 3500) }
    var magnesiumProgress: Double { min(1, todayMacros.magnesium / 400) }

    var sodiumWarning: Bool    { todayMacros.sodium < 2000 }
    var potassiumWarning: Bool { todayMacros.potassium < 2000 }
    var magnesiumWarning: Bool { todayMacros.magnesium < 200 }

    // Macro ring progress ratios (capped at 1.0)
    var fatProgress: Double    { min(1, todayMacros.fat / profile.fatTarget) }
    var proteinProgress: Double{ min(1, todayMacros.protein / profile.proteinTarget) }
    var netCarbProgress: Double{ min(1, todayMacros.netCarbs / profile.carbTarget) }
}
