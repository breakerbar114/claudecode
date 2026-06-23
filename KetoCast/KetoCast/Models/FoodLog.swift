import Foundation

struct FoodLog: Identifiable, Codable {
    let id: UUID
    var foodItem: FoodItem
    var quantity: Double         // multiplier on top of servingSize
    var mealSlot: MealSlot
    var loggedAt: Date
    var notes: String?
    var logMethod: LogMethod

    // Computed macros scaled to actual quantity consumed
    var scaledCalories: Double  { foodItem.calories  * quantity }
    var scaledFat: Double       { foodItem.fat       * quantity }
    var scaledProtein: Double   { foodItem.protein   * quantity }
    var scaledTotalCarbs: Double{ foodItem.totalCarbs * quantity }
    var scaledFiber: Double     { foodItem.fiber     * quantity }
    var scaledNetCarbs: Double  { foodItem.netCarbs  * quantity }
    var scaledSodium: Double    { foodItem.sodium    * quantity }
    var scaledPotassium: Double { foodItem.potassium * quantity }
    var scaledMagnesium: Double { foodItem.magnesium * quantity }

    enum MealSlot: String, Codable, CaseIterable {
        case breakfast = "Breakfast"
        case lunch     = "Lunch"
        case dinner    = "Dinner"
        case snack     = "Snack"

        var icon: String {
            switch self {
            case .breakfast: return "sunrise.fill"
            case .lunch:     return "sun.max.fill"
            case .dinner:    return "moon.fill"
            case .snack:     return "leaf.fill"
            }
        }
    }

    enum LogMethod: String, Codable {
        case photo, barcode, voice, search, manual, quickRepeat
    }

    init(
        id: UUID = UUID(),
        foodItem: FoodItem,
        quantity: Double = 1.0,
        mealSlot: MealSlot,
        loggedAt: Date = .now,
        notes: String? = nil,
        logMethod: LogMethod = .search
    ) {
        self.id = id; self.foodItem = foodItem; self.quantity = quantity
        self.mealSlot = mealSlot; self.loggedAt = loggedAt
        self.notes = notes; self.logMethod = logMethod
    }
}

// MARK: - Daily totals helper
struct DailyMacros {
    var calories: Double = 0
    var fat: Double = 0
    var protein: Double = 0
    var totalCarbs: Double = 0
    var fiber: Double = 0
    var netCarbs: Double = 0
    var sodium: Double = 0
    var potassium: Double = 0
    var magnesium: Double = 0

    init(from logs: [FoodLog]) {
        for log in logs {
            calories   += log.scaledCalories
            fat        += log.scaledFat
            protein    += log.scaledProtein
            totalCarbs += log.scaledTotalCarbs
            fiber      += log.scaledFiber
            netCarbs   += log.scaledNetCarbs
            sodium     += log.scaledSodium
            potassium  += log.scaledPotassium
            magnesium  += log.scaledMagnesium
        }
    }

    // KetoCast zone: green < 20g, yellow 20-35g, red > 35g net carbs
    var ketosisZone: KetosisZone {
        if netCarbs < 20 { return .green }
        if netCarbs < 35 { return .yellow }
        return .red
    }

    enum KetosisZone {
        case green, yellow, red
        var color: String {
            switch self { case .green: return "accentGreen"; case .yellow: return "accentAmber"; case .red: return "accentRed" }
        }
        var label: String {
            switch self { case .green: return "In Ketosis Zone"; case .yellow: return "Borderline"; case .red: return "Over Carb Limit" }
        }
    }
}
