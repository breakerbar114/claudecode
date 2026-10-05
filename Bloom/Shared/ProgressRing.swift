import SwiftUI

struct ProgressRing: View {
    var progress: Double
    var lineWidth: CGFloat
    var color: Color = Theme.accent
    var track: Color = Theme.track

    var body: some View {
        ZStack {
            Circle()
                .stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(max(progress, 0), 1))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .padding(lineWidth / 2)
    }
}

/// A goal's check button: a progress ring that fills into a solid check when done.
struct CheckRing: View {
    let progress: Double
    let isComplete: Bool
    let tint: Color

    var body: some View {
        ZStack {
            if isComplete {
                Circle().fill(tint)
                Image(systemName: "checkmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .transition(.scale.combined(with: .opacity))
            } else {
                ProgressRing(progress: progress, lineWidth: 3.5, color: tint)
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.6), value: isComplete)
    }
}

extension BloomData {
    /// A short, encouraging line for the day's progress.
    func mood(on date: Date) -> String {
        let total = goals(on: date).count
        let done = completedCount(on: date)
        switch total == 0 ? -1.0 : progress(on: date) {
        case -1: return "A restful day."
        case 0: return "A fresh start awaits."
        case ..<0.5: return "Small steps count."
        case ..<1 where done == total - 1: return "Just one more to go."
        case ..<1: return "You're on your way."
        default: return "You bloomed today. 🌸"
        }
    }
}
