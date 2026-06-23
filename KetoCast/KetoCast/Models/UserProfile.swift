import Foundation

struct UserProfile: Codable {
    var name: String = ""
    var age: Int = 30
    var sex: BiologicalSex = .female
    var heightCm: Double = 165
    var weightKg: Double = 72.5
    var goalWeightKg: Double = 65.0
    var activityLevel: ActivityLevel = .moderate
    var weeklyWorkouts: Int = 3
    var ketoMode: KetoMode = .strict
    var customCarbTarget: Double = 20
    var priorityMetrics: [PriorityMetric] = [.netCarbs, .protein, .electrolytes]
    var onboardingComplete: Bool = false
    var createdAt: Date = .now

    // Computed macro targets (Mifflin-St Jeor TDEE + keto macro split)
    var tdee: Double {
        let bmr: Double
        switch sex {
        case .female:
            bmr = 10 * weightKg + 6.25 * heightCm - 5 * Double(age) - 161
        case .male:
            bmr = 10 * weightKg + 6.25 * heightCm - 5 * Double(age) + 5
        case .other:
            bmr = 10 * weightKg + 6.25 * heightCm - 5 * Double(age) - 78
        }
        return bmr * activityLevel.multiplier
    }

    var calorieTarget: Double {
        // Slight deficit for weight loss (500 cal), maintenance otherwise
        let deficit = goalWeightKg < weightKg ? 500.0 : 0.0
        return max(1200, tdee - deficit)
    }

    var carbTarget: Double {
        switch ketoMode {
        case .strict:   return 20
        case .moderate: return 35
        case .custom:   return customCarbTarget
        }
    }

    var proteinTarget: Double {
        // 0.8g per lb of bodyweight (lean mass preservation on keto)
        return weightKg * 2.205 * 0.8
    }

    var fatTarget: Double {
        // Fill remaining calories after protein and carb allocation
        let proteinCals = proteinTarget * 4
        let carbCals = carbTarget * 4
        return max(0, (calorieTarget - proteinCals - carbCals) / 9)
    }

    enum BiologicalSex: String, Codable, CaseIterable {
        case female = "Female"
        case male   = "Male"
        case other  = "Prefer not to say"
    }

    enum ActivityLevel: String, Codable, CaseIterable {
        case sedentary    = "Sedentary (desk job)"
        case light        = "Light (1-2 workouts/week)"
        case moderate     = "Moderate (3-4 workouts/week)"
        case active       = "Active (5-6 workouts/week)"
        case veryActive   = "Very Active (daily intense)"

        var multiplier: Double {
            switch self {
            case .sedentary:  return 1.2
            case .light:      return 1.375
            case .moderate:   return 1.55
            case .active:     return 1.725
            case .veryActive: return 1.9
            }
        }
    }

    enum KetoMode: String, Codable, CaseIterable {
        case strict   = "Strict Keto (<20g)"
        case moderate = "Moderate Keto (<35g)"
        case custom   = "Custom"
    }

    enum PriorityMetric: String, Codable, CaseIterable {
        case netCarbs     = "Net Carbs"
        case protein      = "Protein"
        case electrolytes = "Electrolytes"
        case calories     = "Calories"
        case fat          = "Fat"
        case water        = "Water"
        case weight       = "Weight"
        case ketosisScore = "Ketosis Score"
    }

    // Persistence via UserDefaults (UserProfile is lightweight)
    private static let key = "userProfile"

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.key)
        }
    }

    static func load() -> UserProfile {
        guard let data = UserDefaults.standard.data(forKey: key),
              let profile = try? JSONDecoder().decode(UserProfile.self, from: data)
        else { return UserProfile() }
        return profile
    }

    static let sample = UserProfile()
}
