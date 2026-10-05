import Foundation

/// A daily goal the user wants to turn into a habit.
struct Goal: Codable, Identifiable, Hashable {
    var id = UUID()
    var title: String
    var emoji: String
    var color: GoalColor
    /// How many times per day the goal should be done (e.g. 8 glasses of water).
    var target: Int = 1
    /// Optional label for the target, e.g. "glasses" or "pages".
    var unit: String = ""
    /// Calendar weekdays the goal is scheduled on (1 = Sunday … 7 = Saturday).
    var weekdays: Set<Int> = Set(1...7)
    var createdAt = Date()

    var isEveryDay: Bool { weekdays.count == 7 }

    func isScheduled(on date: Date, calendar: Calendar = .current) -> Bool {
        weekdays.contains(calendar.component(.weekday, from: date))
            && calendar.startOfDay(for: createdAt) <= calendar.startOfDay(for: date)
    }
}

/// Everything Bloom stores: the goals plus per-day check-in counts.
struct BloomData: Codable {
    var goals: [Goal] = []
    /// Day key ("yyyy-MM-dd") → goal id → count done that day.
    var progress: [String: [String: Int]] = [:]

    static let sample: BloomData = {
        let goals = [
            Goal(title: "Drink water", emoji: "💧", color: .sky, target: 8, unit: "glasses"),
            Goal(title: "Move my body", emoji: "🌿", color: .sage),
            Goal(title: "Read 10 pages", emoji: "📖", color: .sand),
            Goal(title: "Journal", emoji: "✍️", color: .lavender),
            Goal(title: "Lights out by 11", emoji: "🌙", color: .rose),
        ]
        return BloomData(goals: goals)
    }()

    // MARK: Reading

    func goals(on date: Date) -> [Goal] {
        goals.filter { $0.isScheduled(on: date) }
    }

    func count(for goal: Goal, on date: Date) -> Int {
        progress[DayKey.string(for: date)]?[goal.id.uuidString] ?? 0
    }

    func isComplete(_ goal: Goal, on date: Date) -> Bool {
        count(for: goal, on: date) >= goal.target
    }

    func completedCount(on date: Date) -> Int {
        goals(on: date).filter { isComplete($0, on: date) }.count
    }

    /// Fraction of the day's goals done, giving partial credit for multi-step goals.
    func progress(on date: Date) -> Double {
        let scheduled = goals(on: date)
        guard !scheduled.isEmpty else { return 0 }
        let total = scheduled.reduce(0.0) { sum, goal in
            sum + min(Double(count(for: goal, on: date)) / Double(goal.target), 1)
        }
        return total / Double(scheduled.count)
    }

    // MARK: Writing

    /// Records one more check-in. Tapping a goal that is already complete resets it.
    mutating func tap(_ goalID: UUID, on date: Date) {
        guard let goal = goals.first(where: { $0.id == goalID }) else { return }
        let current = count(for: goal, on: date)
        setCount(current >= goal.target ? 0 : current + 1, for: goalID, on: date)
    }

    mutating func undo(_ goalID: UUID, on date: Date) {
        guard let goal = goals.first(where: { $0.id == goalID }) else { return }
        setCount(max(count(for: goal, on: date) - 1, 0), for: goalID, on: date)
    }

    mutating func setCount(_ count: Int, for goalID: UUID, on date: Date) {
        let key = DayKey.string(for: date)
        var day = progress[key] ?? [:]
        day[goalID.uuidString] = count == 0 ? nil : count
        progress[key] = day.isEmpty ? nil : day
    }

    mutating func upsert(_ goal: Goal) {
        if let index = goals.firstIndex(where: { $0.id == goal.id }) {
            goals[index] = goal
        } else {
            goals.append(goal)
        }
    }

    mutating func delete(_ goalID: UUID) {
        goals.removeAll { $0.id == goalID }
        for key in progress.keys {
            progress[key]?[goalID.uuidString] = nil
        }
    }

    // MARK: Streaks & stats

    /// Consecutive scheduled days the goal was completed. An unfinished today doesn't break the streak.
    func streak(for goal: Goal, asOf today: Date = Date()) -> Int {
        streak(asOf: today) { day in
            goal.isScheduled(on: day) ? isComplete(goal, on: day) : nil
        }
    }

    /// Consecutive days on which every scheduled goal was completed.
    func perfectDayStreak(asOf today: Date = Date()) -> Int {
        streak(asOf: today) { day in isPerfect(day) }
    }

    func bestPerfectDayStreak(asOf today: Date = Date()) -> Int {
        let calendar = Calendar.current
        guard let first = goals.map(\.createdAt).min() else { return 0 }
        var day = calendar.startOfDay(for: first)
        let end = calendar.startOfDay(for: today)
        var best = 0, run = 0
        while day <= end {
            if let perfect = isPerfect(day) {
                run = perfect ? run + 1 : 0
                best = max(best, run)
            }
            day = calendar.date(byAdding: .day, value: 1, to: day)!
        }
        return best
    }

    /// Share of scheduled check-ins completed over the last `days` days.
    func completionRate(days: Int, goal: Goal? = nil, asOf today: Date = Date()) -> Double {
        let calendar = Calendar.current
        var done = 0, scheduled = 0
        for offset in 0..<days {
            let day = calendar.date(byAdding: .day, value: -offset, to: today)!
            for g in goals(on: day) where goal == nil || g.id == goal?.id {
                scheduled += 1
                if isComplete(g, on: day) { done += 1 }
            }
        }
        return scheduled == 0 ? 0 : Double(done) / Double(scheduled)
    }

    var totalCheckIns: Int {
        progress.values.reduce(0) { $0 + $1.values.reduce(0, +) }
    }

    /// nil when nothing was scheduled that day.
    private func isPerfect(_ day: Date) -> Bool? {
        let scheduled = goals(on: day)
        guard !scheduled.isEmpty else { return nil }
        return scheduled.allSatisfy { isComplete($0, on: day) }
    }

    /// Walks back from today counting days where `check` is true, skipping days where it is nil.
    private func streak(asOf today: Date, check: (Date) -> Bool?) -> Int {
        let calendar = Calendar.current
        var day = calendar.startOfDay(for: today)
        var count = 0
        if check(day) != true {
            day = calendar.date(byAdding: .day, value: -1, to: day)!
        }
        for _ in 0..<3650 {
            switch check(day) {
            case true?: count += 1
            case false?: return count
            case nil:
                if !goals.contains(where: { $0.createdAt <= day.addingTimeInterval(86_400) }) {
                    return count
                }
            }
            day = calendar.date(byAdding: .day, value: -1, to: day)!
        }
        return count
    }
}

enum DayKey {
    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func string(for date: Date) -> String {
        formatter.string(from: date)
    }
}
