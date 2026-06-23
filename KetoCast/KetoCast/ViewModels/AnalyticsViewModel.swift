import Foundation
import SwiftUI

@MainActor
final class AnalyticsViewModel: ObservableObject {
    @Published var selectedTimeRange: TimeRange = .week
    @Published var weeklyData:  [DayData] = []
    @Published var monthlyData: [DayData] = []
    @Published var weightEntries: [WeightEntry] = []
    @Published var measurements: [BodyMeasurement] = []
    @Published var ketosisScore: Int = 0

    enum TimeRange: String, CaseIterable {
        case day = "Day"; case week = "Week"; case month = "Month"
    }

    struct DayData: Identifiable {
        let id = UUID()
        let date: Date
        let macros: DailyMacros
        let hadWorkout: Bool
        var netCarbZone: DailyMacros.KetosisZone { macros.ketosisZone }
    }

    private let store = LogStore.shared
    private let weightStore = WeightStore.shared

    init() { refresh() }

    func refresh() {
        loadWeeklyData()
        loadMonthlyData()
        weightEntries = weightStore.entries(days: 90)
        measurements  = MeasurementStore.shared.all()
        ketosisScore  = computeKetosisScore()
    }

    private func loadWeeklyData() {
        weeklyData = (0..<7).reversed().compactMap { daysAgo -> DayData? in
            guard let date = Calendar.current.date(byAdding: .day, value: -daysAgo, to: .now) else { return nil }
            let logs = store.logsForDate(date)
            return DayData(date: date, macros: DailyMacros(from: logs), hadWorkout: false)
        }
    }

    private func loadMonthlyData() {
        monthlyData = (0..<30).reversed().compactMap { daysAgo -> DayData? in
            guard let date = Calendar.current.date(byAdding: .day, value: -daysAgo, to: .now) else { return nil }
            let logs = store.logsForDate(date)
            return DayData(date: date, macros: DailyMacros(from: logs), hadWorkout: false)
        }
    }

    // Ketosis Probability Score (0–100): days under target, protein moderation, calorie adequacy
    func computeKetosisScore() -> Int {
        guard !weeklyData.isEmpty else { return 0 }
        let profile = UserProfile.load()

        let carbScore  = weeklyData.filter { $0.macros.netCarbs < profile.carbTarget }.count
        let protScore  = weeklyData.filter { $0.macros.protein > 50 }.count     // ensure enough protein
        let calScore   = weeklyData.filter { $0.macros.calories > 1200 }.count  // not starving

        let raw = Double(carbScore + protScore + calScore) / Double(weeklyData.count * 3)
        return Int(raw * 100)
    }

    // Weight trend: linear regression slope (kg/day, negative = losing)
    var weightTrendKgPerWeek: Double {
        let pts = weightEntries.suffix(30)
        guard pts.count >= 3 else { return 0 }
        let n = Double(pts.count)
        let xs = pts.enumerated().map { Double($0.offset) }
        let ys = pts.map { $0.weightKg }
        let xBar = xs.reduce(0, +) / n
        let yBar = ys.reduce(0, +) / n
        let sxy = zip(xs, ys).reduce(0) { $0 + ($1.0 - xBar) * ($1.1 - yBar) }
        let sxx = xs.reduce(0) { $0 + ($1 - xBar) * ($1 - xBar) }
        let slope = sxx == 0 ? 0 : sxy / sxx   // kg/day
        return slope * 7
    }

    var projectedGoalDate: Date? {
        let profile = UserProfile.load()
        let remaining = profile.weightKg - profile.goalWeightKg
        guard remaining > 0, weightTrendKgPerWeek < 0 else { return nil }
        let weeksNeeded = remaining / abs(weightTrendKgPerWeek)
        return Calendar.current.date(byAdding: .day, value: Int(weeksNeeded * 7), to: .now)
    }

    var bestDayThisWeek: DayData? {
        weeklyData.min { $0.macros.netCarbs < $1.macros.netCarbs }
    }

    // Macro consistency score (0–100): average adherence across all targets
    var macroConsistencyScore: Int {
        guard !weeklyData.isEmpty else { return 0 }
        let profile = UserProfile.load()
        let scores = weeklyData.map { day -> Double in
            let carbAdh = day.macros.netCarbs <= profile.carbTarget ? 1.0 : profile.carbTarget / day.macros.netCarbs
            let protAdh = min(1.0, day.macros.protein / profile.proteinTarget)
            let calAdh  = min(1.0, day.macros.calories / profile.calorieTarget)
            return (carbAdh + protAdh + calAdh) / 3
        }
        return Int((scores.reduce(0, +) / Double(scores.count)) * 100)
    }

    // Adherence streak — consecutive green-zone days ending today
    var currentStreak: Int { store.computeStreak(carbTarget: UserProfile.load().carbTarget) }
}
