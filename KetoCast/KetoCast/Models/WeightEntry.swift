import Foundation

struct WeightEntry: Identifiable, Codable {
    let id: UUID
    var weightKg: Double
    var loggedAt: Date
    var source: Source
    var notes: String?

    var weightLbs: Double { weightKg * 2.20462 }

    enum Source: String, Codable {
        case manual, healthKit
    }

    init(id: UUID = UUID(), weightKg: Double, loggedAt: Date = .now,
         source: Source = .manual, notes: String? = nil) {
        self.id = id; self.weightKg = weightKg
        self.loggedAt = loggedAt; self.source = source; self.notes = notes
    }
}

struct BodyMeasurement: Identifiable, Codable {
    let id: UUID
    var type: MeasurementType
    var valueCm: Double
    var loggedAt: Date

    var valueInches: Double { valueCm / 2.54 }

    enum MeasurementType: String, Codable, CaseIterable {
        case waist  = "Waist"
        case thighs = "Thighs"
        case hips   = "Hips"
        case chest  = "Chest"
        case arms   = "Arms"
        case neck   = "Neck"

        var icon: String {
            switch self {
            case .waist:  return "figure.stand"
            case .thighs: return "figure.walk"
            case .hips:   return "figure.stand"
            case .chest:  return "heart.fill"
            case .arms:   return "figure.strengthtraining.traditional"
            case .neck:   return "figure.stand"
            }
        }
    }

    init(id: UUID = UUID(), type: MeasurementType, valueCm: Double, loggedAt: Date = .now) {
        self.id = id; self.type = type; self.valueCm = valueCm; self.loggedAt = loggedAt
    }
}
