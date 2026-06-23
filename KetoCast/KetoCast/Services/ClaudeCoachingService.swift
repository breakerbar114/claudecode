import Foundation

// AI coaching nudges powered by Claude (claude-sonnet-4-6)
actor ClaudeCoachingService {
    static let shared = ClaudeCoachingService()

    private let baseURL = "https://api.anthropic.com/v1/messages"
    private let session = URLSession.shared

    private init() {}

    struct CoachingNudge: Identifiable {
        let id = UUID()
        let message: String
        let actionLabel: String?
        let category: NudgeCategory
    }

    enum NudgeCategory {
        case protein, carbs, electrolytes, weightTrend, recovery, ketosis
        var icon: String {
            switch self {
            case .protein:      return "dumbbell.fill"
            case .carbs:        return "chart.bar.fill"
            case .electrolytes: return "bolt.fill"
            case .weightTrend:  return "arrow.down.right"
            case .recovery:     return "moon.zzz.fill"
            case .ketosis:      return "flame.fill"
            }
        }
    }

    func generateNudges(
        profile: UserProfile,
        recentLogs: [FoodLog],   // last 7 days
        recentWeight: [WeightEntry]
    ) async throws -> [CoachingNudge] {
        let context = buildContext(profile: profile, logs: recentLogs, weight: recentWeight)

        let payload: [String: Any] = [
            "model": "claude-sonnet-4-6",
            "max_tokens": 800,
            "system": """
            You are KetoCast's nutrition coach. Analyze the user's last 7 days of keto diet data \
            and generate 1-3 short, specific, actionable coaching insights.

            Rules:
            - Be specific with numbers ("you averaged 18g net carbs" not "you've been great")
            - Reference their actual goal (weight loss/maintain/recomp)
            - For weight trend: compare to their goal pace, project a date
            - Keep each insight under 2 sentences
            - Tone: supportive, data-driven, not preachy
            - No medical claims

            Return JSON array: [{"message": str, "action_label": str|null, "category": "protein"|"carbs"|"electrolytes"|"weightTrend"|"recovery"|"ketosis"}]
            """,
            "messages": [["role": "user", "content": context]]
        ]

        var request = URLRequest(url: URL(string: baseURL)!)
        request.httpMethod = "POST"
        request.setValue(SecretsManager.shared.anthropicAPIKey, forHTTPHeaderField: "x-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        request.timeoutInterval = 20

        let (data, _) = try await session.data(for: request)
        return try parseNudges(from: data)
    }

    private func buildContext(profile: UserProfile, logs: [FoodLog], weight: [WeightEntry]) -> String {
        // Aggregate last 7 days by date
        let cal = Calendar.current
        var dailyMap: [Date: [FoodLog]] = [:]
        for log in logs {
            let day = cal.startOfDay(for: log.loggedAt)
            dailyMap[day, default: []].append(log)
        }

        let dailySummaries = dailyMap.sorted { $0.key < $1.key }.map { date, dayLogs -> String in
            let macros = DailyMacros(from: dayLogs)
            let df = DateFormatter(); df.dateFormat = "EEE"
            return "\(df.string(from: date)): \(Int(macros.netCarbs))g net carbs, \(Int(macros.protein))g protein, \(Int(macros.calories)) kcal, Na:\(Int(macros.sodium))mg K:\(Int(macros.potassium))mg Mg:\(Int(macros.magnesium))mg"
        }.joined(separator: "\n")

        let weightStr = weight.suffix(7).map { "  \($0.loggedAt.formatted(date: .abbreviated, time: .omitted)): \(String(format:"%.1f", $0.weightKg))kg" }.joined(separator: "\n")

        return """
        User: \(profile.name.isEmpty ? "User" : profile.name), \(profile.age)yo \(profile.sex.rawValue)
        Goal: \(profile.goalWeightKg < profile.weightKg ? "Lose weight" : "Maintain") (current \(String(format:"%.1f",profile.weightKg))kg → goal \(String(format:"%.1f",profile.goalWeightKg))kg)
        Targets: \(Int(profile.carbTarget))g net carbs, \(Int(profile.proteinTarget))g protein, \(Int(profile.calorieTarget)) kcal/day
        Keto mode: \(profile.ketoMode.rawValue)

        Last 7 days food logs:
        \(dailySummaries.isEmpty ? "No data" : dailySummaries)

        Weight log:
        \(weightStr.isEmpty ? "No data" : weightStr)
        """
    }

    private func parseNudges(from data: Data) throws -> [CoachingNudge] {
        struct ClaudeResponse: Decodable {
            struct Content: Decodable { let type: String; let text: String }
            let content: [Content]
        }
        let resp = try JSONDecoder().decode(ClaudeResponse.self, from: data)
        guard let text = resp.content.first(where: { $0.type == "text" })?.text,
              let jsonData = text.data(using: .utf8),
              let items = try? JSONSerialization.jsonObject(with: jsonData) as? [[String: Any]]
        else { return [] }

        return items.compactMap { dict -> CoachingNudge? in
            guard let message = dict["message"] as? String,
                  let catStr = dict["category"] as? String
            else { return nil }
            let category: NudgeCategory
            switch catStr {
            case "protein":      category = .protein
            case "carbs":        category = .carbs
            case "electrolytes": category = .electrolytes
            case "weightTrend":  category = .weightTrend
            case "recovery":     category = .recovery
            default:             category = .ketosis
            }
            return CoachingNudge(message: message, actionLabel: dict["action_label"] as? String, category: category)
        }
    }
}
