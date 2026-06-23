import Foundation
import HealthKit

@MainActor
final class HealthKitService: ObservableObject {
    static let shared = HealthKitService()

    private let store = HKHealthStore()
    @Published var isAuthorized = false

    private let readTypes: Set<HKSampleType> = [
        HKQuantityType(.bodyMass),
        HKQuantityType(.activeEnergyBurned),
        HKQuantityType(.basalEnergyBurned),
        HKQuantityType(.stepCount),
        HKCategoryType(.sleepAnalysis),
        HKWorkoutType.workoutType()
    ]

    private let writeTypes: Set<HKSampleType> = [
        HKQuantityType(.dietaryEnergyConsumed),
        HKQuantityType(.dietaryFatTotal),
        HKQuantityType(.dietaryProtein),
        HKQuantityType(.dietaryCarbohydrates),
        HKQuantityType(.dietaryFiber),
        HKQuantityType(.dietarySodium),
        HKQuantityType(.dietaryPotassium),
        HKQuantityType(.dietaryMagnesium)
    ]

    private init() {}

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAuthorization() async throws {
        guard isAvailable else { return }
        try await store.requestAuthorization(toShare: writeTypes, read: readTypes)
        isAuthorized = true
    }

    // MARK: - Read weight from HealthKit
    func fetchLatestWeight() async -> WeightEntry? {
        let query = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: HKQuantityType(.bodyMass))],
            sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)],
            limit: 1
        )
        guard let sample = try? await query.result(for: store).first as? HKQuantitySample else {
            return nil
        }
        let kg = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
        return WeightEntry(weightKg: kg, loggedAt: sample.endDate, source: .healthKit)
    }

    func fetchWeightHistory(days: Int = 90) async -> [WeightEntry] {
        let start = Calendar.current.date(byAdding: .day, value: -days, to: .now) ?? .now
        let query = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: HKQuantityType(.bodyMass),
                                         predicate: HKQuery.predicateForSamples(withStart: start, end: .now))],
            sortDescriptors: [SortDescriptor(\.endDate, order: .forward)]
        )
        guard let samples = try? await query.result(for: store) else { return [] }
        return samples.compactMap { sample -> WeightEntry? in
            guard let qs = sample as? HKQuantitySample else { return nil }
            let kg = qs.quantity.doubleValue(for: .gramUnit(with: .kilo))
            return WeightEntry(weightKg: kg, loggedAt: qs.endDate, source: .healthKit)
        }
    }

    // MARK: - Write nutrition to HealthKit
    func logDailyNutrition(_ macros: DailyMacros, date: Date = .now) async throws {
        var samples: [HKQuantitySample] = []

        func sample(_ type: HKQuantityTypeIdentifier, _ value: Double, _ unit: HKUnit) -> HKQuantitySample {
            HKQuantitySample(type: HKQuantityType(type), quantity: HKQuantity(unit: unit, doubleValue: value),
                             start: date, end: date)
        }

        samples = [
            sample(.dietaryEnergyConsumed, macros.calories, .kilocalorie()),
            sample(.dietaryFatTotal, macros.fat, .gram()),
            sample(.dietaryProtein, macros.protein, .gram()),
            sample(.dietaryCarbohydrates, macros.totalCarbs, .gram()),
            sample(.dietaryFiber, macros.fiber, .gram()),
            sample(.dietarySodium, macros.sodium, .gramUnit(with: .milli)),
            sample(.dietaryPotassium, macros.potassium, .gramUnit(with: .milli)),
            sample(.dietaryMagnesium, macros.magnesium, .gramUnit(with: .milli))
        ]

        try await store.save(samples)
    }

    // MARK: - Read active calories
    func fetchActiveCalories(for date: Date = .now) async -> Double {
        let cal = Calendar.current
        let start = cal.startOfDay(for: date)
        let end = cal.date(byAdding: .day, value: 1, to: start) ?? date
        let pred = HKQuery.predicateForSamples(withStart: start, end: end)

        let query = HKStatisticsQueryDescriptor(
            quantitySamplePredicate: .quantitySample(type: HKQuantityType(.activeEnergyBurned), predicate: pred),
            options: .cumulativeSum
        )
        let result = try? await query.result(for: store)
        return result?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
    }

    // MARK: - Read workouts
    func fetchWorkouts(days: Int = 7) async -> [HKWorkout] {
        let start = Calendar.current.date(byAdding: .day, value: -days, to: .now) ?? .now
        let query = HKSampleQueryDescriptor(
            predicates: [.workout(predicate: HKQuery.predicateForSamples(withStart: start, end: .now))],
            sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)]
        )
        return (try? await query.result(for: store) as? [HKWorkout]) ?? []
    }
}
