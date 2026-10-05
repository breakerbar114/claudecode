import SwiftUI
import WidgetKit

@main
struct BloomWidgetBundle: WidgetBundle {
    var body: some Widget {
        BloomWidget()
    }
}

struct BloomWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BloomDailyProgress", provider: Provider()) { entry in
            BloomWidgetView(entry: entry)
                .containerBackground(for: .widget) { Theme.card }
        }
        .configurationDisplayName("Daily Progress")
        .description("See today's goals at a glance and check them off.")
        .supportedFamilies([
            .systemSmall, .systemMedium, .systemLarge,
            .accessoryCircular, .accessoryRectangular, .accessoryInline,
        ])
    }
}

// MARK: - Timeline

struct BloomEntry: TimelineEntry {
    let date: Date
    let data: BloomData
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> BloomEntry {
        BloomEntry(date: Date(), data: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (BloomEntry) -> Void) {
        completion(BloomEntry(date: Date(), data: context.isPreview ? .sample : BloomStorage.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BloomEntry>) -> Void) {
        let data = BloomStorage.load()
        let now = Date()
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400))
        // A second entry at midnight resets the widget for the new day.
        let entries = [BloomEntry(date: now, data: data), BloomEntry(date: midnight, data: data)]
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Views

struct BloomWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BloomEntry

    private var data: BloomData { entry.data }
    private var goals: [Goal] { data.goals(on: entry.date) }
    private var progress: Double { data.progress(on: entry.date) }
    private var done: Int { data.completedCount(on: entry.date) }

    var body: some View {
        switch family {
        case .systemSmall: small
        case .systemMedium: medium
        case .systemLarge: large
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        default: inline
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TODAY")
                .font(Theme.body(11, weight: .bold))
                .tracking(1)
                .foregroundStyle(Theme.mutedInk)
            ZStack {
                ProgressRing(progress: progress, lineWidth: 11)
                    .widgetAccentable()
                Text("\(Int((progress * 100).rounded()))%")
                    .font(Theme.title(22))
                    .foregroundStyle(Theme.ink)
            }
            .frame(maxWidth: .infinity)
            Text("\(done) of \(goals.count) goals")
                .font(Theme.body(13, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity)
        }
    }

    private var medium: some View {
        HStack(spacing: 16) {
            summary(ringSize: 92)
            goalList(limit: 4, rowHeight: 26)
        }
    }

    private var large: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 16) {
                summary(ringSize: 84)
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.date.formatted(.dateTime.weekday(.wide).month().day()))
                        .font(Theme.title(18))
                        .foregroundStyle(Theme.ink)
                    Text(data.mood(on: entry.date))
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.mutedInk)
                    let streak = data.perfectDayStreak(asOf: entry.date)
                    if streak > 0 {
                        Text("🔥 \(streak)-day streak")
                            .font(Theme.body(12, weight: .semibold))
                            .foregroundStyle(GoalColor.peach.color)
                    }
                }
                Spacer(minLength: 0)
            }
            goalList(limit: 7, rowHeight: 32)
        }
    }

    private func summary(ringSize: CGFloat) -> some View {
        ZStack {
            ProgressRing(progress: progress, lineWidth: 10)
                .widgetAccentable()
            VStack(spacing: 0) {
                Text("\(done)/\(goals.count)")
                    .font(Theme.title(20))
                    .foregroundStyle(Theme.ink)
                Text("done")
                    .font(Theme.body(10))
                    .foregroundStyle(Theme.mutedInk)
            }
        }
        .frame(width: ringSize, height: ringSize)
    }

    @ViewBuilder
    private func goalList(limit: Int, rowHeight: CGFloat) -> some View {
        if goals.isEmpty {
            Text(data.goals.isEmpty ? "Add a goal in Bloom 🌱" : "Nothing scheduled today 🌙")
                .font(Theme.body(13))
                .foregroundStyle(Theme.mutedInk)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            // Unfinished goals first so the next thing to do is always visible.
            let ordered = goals.filter { !data.isComplete($0, on: entry.date) }
                + goals.filter { data.isComplete($0, on: entry.date) }
            VStack(alignment: .leading, spacing: 6) {
                ForEach(ordered.prefix(limit)) { goal in
                    WidgetGoalRow(goal: goal, count: data.count(for: goal, on: entry.date), height: rowHeight)
                }
                if ordered.count > limit {
                    Text("+\(ordered.count - limit) more")
                        .font(Theme.body(11))
                        .foregroundStyle(Theme.mutedInk)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    private var circular: some View {
        Gauge(value: progress) {
            Text("Bloom")
        } currentValueLabel: {
            Text("\(done)/\(goals.count)")
        }
        .gaugeStyle(.accessoryCircularCapacity)
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("🌸 Bloom")
                .font(.headline)
                .widgetAccentable()
            Text("\(done) of \(goals.count) goals done")
                .font(.caption)
            ProgressView(value: progress)
                .tint(.primary)
        }
    }

    private var inline: some View {
        Text("🌸 \(done)/\(goals.count) goals done")
    }
}

/// A goal with a tappable check button that records progress without opening the app.
private struct WidgetGoalRow: View {
    let goal: Goal
    let count: Int
    let height: CGFloat

    private var isComplete: Bool { count >= goal.target }

    var body: some View {
        Button(intent: ToggleGoalIntent(goalID: goal.id)) {
            HStack(spacing: 8) {
                Text(goal.emoji)
                    .font(.system(size: height * 0.5))
                Text(goal.title)
                    .font(Theme.body(13, weight: .medium))
                    .foregroundStyle(Theme.ink)
                    .strikethrough(isComplete, color: Theme.mutedInk)
                    .opacity(isComplete ? 0.55 : 1)
                    .lineLimit(1)
                Spacer(minLength: 4)
                if goal.target > 1 && !isComplete {
                    Text("\(count)/\(goal.target)")
                        .font(Theme.body(11, weight: .medium))
                        .foregroundStyle(Theme.mutedInk)
                }
                CheckRing(progress: Double(count) / Double(goal.target), isComplete: isComplete, tint: goal.color.color)
                    .frame(width: height * 0.72, height: height * 0.72)
            }
            .frame(height: height)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
