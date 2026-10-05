import SwiftUI

struct InsightsView: View {
    @EnvironmentObject private var store: GoalStore
    @Environment(\.dismiss) private var dismiss

    private var data: BloomData { store.data }
    private var today: Date { store.today }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())], spacing: 12) {
                        StatTile(value: "\(data.perfectDayStreak(asOf: today))", label: "Current streak", symbol: "flame.fill", tint: .peach)
                        StatTile(value: "\(data.bestPerfectDayStreak(asOf: today))", label: "Best streak", symbol: "trophy.fill", tint: .sand)
                        StatTile(value: percent(data.completionRate(days: 30, asOf: today)), label: "Last 30 days", symbol: "leaf.fill", tint: .sage)
                        StatTile(value: "\(data.totalCheckIns)", label: "Check-ins", symbol: "checkmark.circle.fill", tint: .sky)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Last 12 weeks")
                            .font(Theme.title(20))
                            .foregroundStyle(Theme.ink)
                        Heatmap(data: data, today: today)
                            .padding(16)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    }

                    if !data.goals.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("By goal · 30 days")
                                .font(Theme.title(20))
                                .foregroundStyle(Theme.ink)
                            VStack(spacing: 16) {
                                ForEach(data.goals) { goal in
                                    GoalStatRow(
                                        goal: goal,
                                        rate: data.completionRate(days: 30, goal: goal, asOf: today),
                                        streak: data.streak(for: goal, asOf: today)
                                    )
                                }
                            }
                            .padding(16)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                        }
                    }
                }
                .padding(20)
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("Insights")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }

    private func percent(_ value: Double) -> String {
        "\(Int((value * 100).rounded()))%"
    }
}

private struct StatTile: View {
    let value: String
    let label: String
    let symbol: String
    let tint: GoalColor

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(tint.color)
                .frame(width: 32, height: 32)
                .background(tint.wash, in: Circle())
            Text(value)
                .font(Theme.title(28))
                .foregroundStyle(Theme.ink)
            Text(label)
                .font(Theme.body(13))
                .foregroundStyle(Theme.mutedInk)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

/// GitHub-style grid: one column per week, one row per weekday.
private struct Heatmap: View {
    let data: BloomData
    let today: Date
    private let weeks = 12

    var body: some View {
        let calendar = Calendar.current
        let thisWeek = calendar.dateInterval(of: .weekOfYear, for: today)!.start
        let firstWeek = calendar.date(byAdding: .weekOfYear, value: -(weeks - 1), to: thisWeek)!

        HStack(spacing: 4) {
            ForEach(0..<weeks, id: \.self) { week in
                VStack(spacing: 4) {
                    ForEach(0..<7, id: \.self) { weekday in
                        let offset = week * 7 + weekday
                        let day = calendar.date(byAdding: .day, value: offset, to: firstWeek)!
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(fill(for: day))
                            .aspectRatio(1, contentMode: .fit)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func fill(for day: Date) -> Color {
        guard day <= today, !data.goals(on: day).isEmpty else { return Theme.track.opacity(0.6) }
        let progress = data.progress(on: day)
        return progress == 0 ? Theme.track : Theme.accent.opacity(0.25 + 0.75 * progress)
    }
}

private struct GoalStatRow: View {
    let goal: Goal
    let rate: Double
    let streak: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(goal.emoji)  \(goal.title)")
                    .font(Theme.body(15, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Spacer()
                if streak > 0 {
                    Text("🔥 \(streak)")
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.mutedInk)
                }
                Text("\(Int((rate * 100).rounded()))%")
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(goal.color.color)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.track)
                    Capsule().fill(goal.color.color)
                        .frame(width: max(proxy.size.width * rate, rate > 0 ? 8 : 0))
                }
            }
            .frame(height: 8)
        }
    }
}
