import Foundation

// Thread-safe, UserDefaults-backed log store.
// Core Data is the right long-term choice; this gets Sprint 1–3 shipping fast
// while the schema stabilises, then we migrate without UI changes.
final class LogStore {
    static let shared = LogStore()
    private let key  = "food_logs_v1"
    private let waterKey = "water_oz_v1"
    private let recentKey = "recent_items_v1"
    private var _logs: [FoodLog] = []
    private var _waterByDay: [String: Double] = [:]
    private var _recentItems: [FoodItem] = []
    private let lock = NSLock()

    private init() {
        loadFromDisk()
    }

    private func loadFromDisk() {
        if let data = UserDefaults.standard.data(forKey: key),
           let logs = try? JSONDecoder().decode([FoodLog].self, from: data) {
            _logs = logs
        }
        if let data = UserDefaults.standard.data(forKey: waterKey),
           let map = try? JSONDecoder().decode([String: Double].self, from: data) {
            _waterByDay = map
        }
        if let data = UserDefaults.standard.data(forKey: recentKey),
           let items = try? JSONDecoder().decode([FoodItem].self, from: data) {
            _recentItems = items
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(_logs) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    private func persistWater() {
        if let data = try? JSONEncoder().encode(_waterByDay) {
            UserDefaults.standard.set(data, forKey: waterKey)
        }
    }

    func add(_ log: FoodLog) {
        lock.withLock { _logs.append(log) }
        persist()
    }

    func remove(_ log: FoodLog) {
        lock.withLock { _logs.removeAll { $0.id == log.id } }
        persist()
    }

    func logsForDate(_ date: Date) -> [FoodLog] {
        let cal = Calendar.current
        return _logs.filter { cal.isDate($0.loggedAt, inSameDayAs: date) }
    }

    func logsForToday() -> [FoodLog] { logsForDate(.now) }

    func logsForYesterdaySlot(_ slot: FoodLog.MealSlot) -> [FoodLog] {
        guard let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: .now) else { return [] }
        return logsForDate(yesterday).filter { $0.mealSlot == slot }
    }

    func logsForLastDays(_ days: Int) -> [FoodLog] {
        guard let start = Calendar.current.date(byAdding: .day, value: -days, to: .now) else { return [] }
        return _logs.filter { $0.loggedAt >= start }
    }

    // Consecutive days at or under carb target ending today
    func computeStreak(carbTarget: Double) -> Int {
        var streak = 0
        let cal = Calendar.current
        var checkDate = Date.now
        while true {
            let logs = logsForDate(checkDate)
            guard !logs.isEmpty else { break }
            let macros = DailyMacros(from: logs)
            if macros.netCarbs > carbTarget { break }
            streak += 1
            guard let prev = cal.date(byAdding: .day, value: -1, to: checkDate) else { break }
            checkDate = prev
        }
        return streak
    }

    // Water tracking
    func addWater(oz: Double) {
        let key = dayKey(.now)
        _waterByDay[key, default: 0] += oz
        persistWater()
    }

    func todayWaterOz() -> Double { _waterByDay[dayKey(.now)] ?? 0 }

    private func dayKey(_ date: Date) -> String {
        DateFormatter().apply { $0.dateFormat = "yyyy-MM-dd" }.string(from: date)
    }

    // Recent items
    func recentItems(limit: Int) -> [FoodItem] { Array(_recentItems.prefix(limit)) }

    func recordRecentItem(_ item: FoodItem) {
        var updated = [item] + _recentItems.filter { $0.id != item.id }
        if updated.count > 50 { updated = Array(updated.prefix(50)) }
        _recentItems = updated
        if let data = try? JSONEncoder().encode(_recentItems) {
            UserDefaults.standard.set(data, forKey: recentKey)
        }
    }
}

// MARK: - WeightStore
final class WeightStore {
    static let shared = WeightStore()
    private let key = "weight_entries_v1"
    private var _entries: [WeightEntry] = []

    private init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let entries = try? JSONDecoder().decode([WeightEntry].self, from: data) {
            _entries = entries
        }
    }

    func add(_ entry: WeightEntry) {
        _entries.append(entry)
        _entries.sort { $0.loggedAt < $1.loggedAt }
        persist()
    }

    func entries(days: Int) -> [WeightEntry] {
        guard let start = Calendar.current.date(byAdding: .day, value: -days, to: .now) else { return _entries }
        return _entries.filter { $0.loggedAt >= start }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(_entries) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

// MARK: - MeasurementStore
final class MeasurementStore {
    static let shared = MeasurementStore()
    private let key = "measurements_v1"
    private var _entries: [BodyMeasurement] = []

    private init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let entries = try? JSONDecoder().decode([BodyMeasurement].self, from: data) {
            _entries = entries
        }
    }

    func add(_ m: BodyMeasurement) {
        _entries.append(m)
        persist()
    }

    func all() -> [BodyMeasurement] { _entries }

    func latest(for type: BodyMeasurement.MeasurementType) -> BodyMeasurement? {
        _entries.filter { $0.type == type }.max { $0.loggedAt < $1.loggedAt }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(_entries) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

// MARK: - Formatter helper
extension DateFormatter {
    func apply(_ configure: (DateFormatter) -> Void) -> DateFormatter {
        configure(self); return self
    }
}
