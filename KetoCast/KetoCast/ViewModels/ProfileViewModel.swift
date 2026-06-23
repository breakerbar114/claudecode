import Foundation
import Combine

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var profile: UserProfile

    init() {
        profile = UserProfile.load()
    }

    func save() {
        profile.save()
    }

    func updateWeight(_ kg: Double) {
        profile.weightKg = kg
        save()
        WeightStore.shared.add(WeightEntry(weightKg: kg))
    }

    var bmi: Double {
        let hm = profile.heightCm / 100
        return profile.weightKg / (hm * hm)
    }

    var bmiCategory: String {
        switch bmi {
        case ..<18.5: return "Underweight"
        case 18.5..<25: return "Normal"
        case 25..<30: return "Overweight"
        default: return "Obese"
        }
    }

    var weightToGoalKg: Double { profile.weightKg - profile.goalWeightKg }
    var weightToGoalLbs: Double { weightToGoalKg * 2.20462 }
}
