import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var store: GoalStore
    @State private var editing: Goal?
    @State private var isAdding = false
    @State private var showingInsights = false

    private var today: Date { store.today }
    private var data: BloomData { store.data }
    private var todaysGoals: [Goal] { data.goals(on: today) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                SummaryCard(data: data, date: today)
                WeekStrip(data: data, today: today)
                goalsSection
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
        }
        .background(Theme.background.ignoresSafeArea())
        .sheet(isPresented: $isAdding) {
            GoalEditorView(goal: nil)
        }
        .sheet(item: $editing) { goal in
            GoalEditorView(goal: goal)
        }
        .sheet(isPresented: $showingInsights) {
            InsightsView()
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(today.formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased())
                    .font(Theme.body(12, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(Theme.mutedInk)
                Text(greeting)
                    .font(Theme.title(32))
                    .foregroundStyle(Theme.ink)
            }
            Spacer()
            HStack(spacing: 10) {
                CircleButton(systemImage: "chart.bar.xaxis") { showingInsights = true }
                CircleButton(systemImage: "plus") { isAdding = true }
            }
        }
        .padding(.top, 12)
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 5..<12: "Good morning"
        case 12..<17: "Good afternoon"
        default: "Good evening"
        }
    }

    @ViewBuilder
    private var goalsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today's goals")
                .font(Theme.title(20))
                .foregroundStyle(Theme.ink)

            if todaysGoals.isEmpty {
                EmptyState(hasAnyGoals: !data.goals.isEmpty) { isAdding = true }
            } else {
                ForEach(todaysGoals) { goal in
                    GoalRow(
                        goal: goal,
                        count: data.count(for: goal, on: today),
                        streak: data.streak(for: goal, asOf: today)
                    )
                    .onTapGesture { store.tap(goal) }
                    .contextMenu {
                        Button { editing = goal } label: { Label("Edit", systemImage: "pencil") }
                        Button { store.undo(goal) } label: { Label("Undo one", systemImage: "arrow.uturn.backward") }
                        Button(role: .destructive) { store.delete(goal) } label: { Label("Delete", systemImage: "trash") }
                    }
                }
                Text("Tap to check in · press and hold to edit")
                    .font(Theme.body(12))
                    .foregroundStyle(Theme.mutedInk)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
            }
        }
    }
}

// MARK: - Summary

private struct SummaryCard: View {
    let data: BloomData
    let date: Date

    var body: some View {
        let progress = data.progress(on: date)
        let total = data.goals(on: date).count
        let done = data.completedCount(on: date)
        let streak = data.perfectDayStreak(asOf: date)

        HStack(spacing: 22) {
            ZStack {
                ProgressRing(progress: progress, lineWidth: 14)
                VStack(spacing: 0) {
                    Text("\(Int((progress * 100).rounded()))%")
                        .font(Theme.title(28))
                        .foregroundStyle(Theme.ink)
                        .contentTransition(.numericText())
                    Text("today")
                        .font(Theme.body(12))
                        .foregroundStyle(Theme.mutedInk)
                }
            }
            .frame(width: 128, height: 128)

            VStack(alignment: .leading, spacing: 8) {
                Text("\(done) of \(total) done")
                    .font(Theme.title(22))
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.numericText())
                Text(data.mood(on: date))
                    .font(Theme.body(15))
                    .foregroundStyle(Theme.mutedInk)
                    .fixedSize(horizontal: false, vertical: true)
                if streak > 0 {
                    Label("\(streak)-day streak", systemImage: "flame.fill")
                        .font(Theme.body(13, weight: .semibold))
                        .foregroundStyle(GoalColor.peach.color)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(GoalColor.peach.wash, in: Capsule())
                }
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 12, y: 4)
        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: progress)
    }
}

// MARK: - Week

private struct WeekStrip: View {
    let data: BloomData
    let today: Date

    private var days: [Date] {
        (0..<7).reversed().compactMap { Calendar.current.date(byAdding: .day, value: -$0, to: today) }
    }

    var body: some View {
        HStack {
            ForEach(days, id: \.self) { day in
                let isToday = Calendar.current.isDate(day, inSameDayAs: today)
                VStack(spacing: 6) {
                    Text(day.formatted(.dateTime.weekday(.narrow)))
                        .font(Theme.body(12, weight: isToday ? .bold : .medium))
                        .foregroundStyle(isToday ? Theme.ink : Theme.mutedInk)
                    ZStack {
                        ProgressRing(progress: data.progress(on: day), lineWidth: 4)
                        if !data.goals(on: day).isEmpty && data.progress(on: day) >= 1 {
                            Image(systemName: "checkmark")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.accent)
                        } else {
                            Text(day.formatted(.dateTime.day()))
                                .font(Theme.body(11, weight: .medium))
                                .foregroundStyle(Theme.mutedInk)
                        }
                    }
                    .frame(width: 34, height: 34)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 8)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

// MARK: - Pieces

private struct EmptyState: View {
    let hasAnyGoals: Bool
    let add: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text("🌱").font(.system(size: 44))
            Text(hasAnyGoals ? "Nothing scheduled today." : "Plant your first goal.")
                .font(Theme.title(18))
                .foregroundStyle(Theme.ink)
            Text(hasAnyGoals ? "Enjoy the rest — or add something new." : "Small daily actions grow into lasting habits.")
                .font(Theme.body(14))
                .foregroundStyle(Theme.mutedInk)
                .multilineTextAlignment(.center)
            Button("Add a goal", action: add)
                .font(Theme.body(15, weight: .semibold))
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(28)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

struct CircleButton: View {
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .frame(width: 42, height: 42)
                .background(Theme.card, in: Circle())
                .shadow(color: .black.opacity(0.05), radius: 6, y: 2)
        }
    }
}
