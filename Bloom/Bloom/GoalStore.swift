import SwiftUI

/// Observable wrapper around `BloomData` for the app's views.
@MainActor
final class GoalStore: ObservableObject {
    @Published private(set) var data: BloomData
    /// The day the UI is showing; refreshed when the app becomes active or the date rolls over.
    @Published private(set) var today = Date()

    init() {
        data = BloomStorage.load()
        NotificationCenter.default.addObserver(
            forName: .NSCalendarDayChanged, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.reload() }
        }
    }

    func reload() {
        data = BloomStorage.load()
        today = Date()
    }

    func tap(_ goal: Goal) { commit { $0.tap(goal.id, on: today) } }
    func undo(_ goal: Goal) { commit { $0.undo(goal.id, on: today) } }
    func save(_ goal: Goal) { commit { $0.upsert(goal) } }
    func delete(_ goal: Goal) { commit { $0.delete(goal.id) } }

    private func commit(_ change: (inout BloomData) -> Void) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            change(&data)
        }
        BloomStorage.save(data)
    }
}
