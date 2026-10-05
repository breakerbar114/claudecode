import AppIntents
import Foundation

/// Lets the widget check off a goal without opening the app.
struct ToggleGoalIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Off Goal"
    static var description = IntentDescription("Records progress on one of today's goals.")

    @Parameter(title: "Goal ID")
    var goalID: String

    init() {}

    init(goalID: UUID) {
        self.goalID = goalID.uuidString
    }

    func perform() async throws -> some IntentResult {
        guard let id = UUID(uuidString: goalID) else { return .result() }
        BloomStorage.update { $0.tap(id, on: Date()) }
        return .result()
    }
}
