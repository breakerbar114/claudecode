import SwiftUI

struct GoalRow: View {
    let goal: Goal
    let count: Int
    let streak: Int

    private var isComplete: Bool { count >= goal.target }
    private var tint: Color { goal.color.color }

    var body: some View {
        HStack(spacing: 14) {
            Text(goal.emoji)
                .font(.system(size: 24))
                .frame(width: 48, height: 48)
                .background(goal.color.wash, in: RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(goal.title)
                    .font(Theme.body(17, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .strikethrough(isComplete, color: Theme.mutedInk)
                    .opacity(isComplete ? 0.6 : 1)
                HStack(spacing: 8) {
                    Text(detail)
                    if streak > 1 {
                        Text("🔥 \(streak)")
                    }
                }
                .font(Theme.body(13))
                .foregroundStyle(Theme.mutedInk)
            }

            Spacer()

            CheckRing(progress: Double(count) / Double(goal.target), isComplete: isComplete, tint: tint)
                .frame(width: 34, height: 34)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(isComplete ? AnyShapeStyle(goal.color.wash) : AnyShapeStyle(Theme.card))
        )
        .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .sensoryFeedback(isComplete ? .success : .increase, trigger: count)
    }

    private var detail: String {
        if goal.target > 1 {
            let unit = goal.unit.isEmpty ? "" : " \(goal.unit)"
            return "\(min(count, goal.target)) of \(goal.target)\(unit)"
        }
        return isComplete ? "Done" : scheduleLabel
    }

    private var scheduleLabel: String {
        if goal.isEveryDay { return "Every day" }
        if goal.weekdays == Set(2...6) { return "Weekdays" }
        if goal.weekdays == [1, 7] { return "Weekends" }
        let symbols = Calendar.current.shortWeekdaySymbols
        return goal.weekdays.sorted().map { symbols[$0 - 1] }.joined(separator: ", ")
    }
}
