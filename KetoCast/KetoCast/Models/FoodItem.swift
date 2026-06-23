import Foundation
import CoreData

// Lightweight value type used throughout the app; backed by CDFoodItem in Core Data
struct FoodItem: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var brand: String?
    var servingSize: Double        // grams by default
    var servingUnit: String        // "g", "oz", "cup", etc.
    var calories: Double
    var fat: Double
    var saturatedFat: Double
    var protein: Double
    var totalCarbs: Double
    var fiber: Double
    var sugar: Double
    var sodium: Double             // mg
    var potassium: Double          // mg
    var magnesium: Double          // mg
    var dataSource: DataSource
    var isVerified: Bool
    var createdAt: Date
    var barcode: String?

    var netCarbs: Double { max(0, totalCarbs - fiber) }

    // Validation: calories should roughly equal fat*9 + protein*4 + carbs*4 ±10%
    var hasCalorieMismatch: Bool {
        let computed = fat * 9 + protein * 4 + totalCarbs * 4
        guard computed > 0 else { return false }
        return abs(calories - computed) / computed > 0.10
    }

    enum DataSource: String, Codable, CaseIterable {
        case usda = "USDA"
        case openFoodFacts = "OpenFoodFacts"
        case userCreated = "User"
        case aiPhoto = "AI Photo"
        case aiVoice = "AI Voice"
        case manual = "Manual"
    }

    init(
        id: UUID = UUID(),
        name: String,
        brand: String? = nil,
        servingSize: Double = 100,
        servingUnit: String = "g",
        calories: Double,
        fat: Double,
        saturatedFat: Double = 0,
        protein: Double,
        totalCarbs: Double,
        fiber: Double = 0,
        sugar: Double = 0,
        sodium: Double = 0,
        potassium: Double = 0,
        magnesium: Double = 0,
        dataSource: DataSource = .manual,
        isVerified: Bool = false,
        createdAt: Date = .now,
        barcode: String? = nil
    ) {
        self.id = id; self.name = name; self.brand = brand
        self.servingSize = servingSize; self.servingUnit = servingUnit
        self.calories = calories; self.fat = fat; self.saturatedFat = saturatedFat
        self.protein = protein; self.totalCarbs = totalCarbs; self.fiber = fiber
        self.sugar = sugar; self.sodium = sodium; self.potassium = potassium
        self.magnesium = magnesium; self.dataSource = dataSource
        self.isVerified = isVerified; self.createdAt = createdAt; self.barcode = barcode
    }
}

// MARK: - Sample data for previews/testing
extension FoodItem {
    static let sampleEggs = FoodItem(
        name: "Eggs, large", brand: "Generic",
        servingSize: 50, servingUnit: "g",
        calories: 72, fat: 4.8, saturatedFat: 1.6, protein: 6.3,
        totalCarbs: 0.4, fiber: 0, sugar: 0.4,
        sodium: 71, potassium: 69, magnesium: 6,
        dataSource: .usda, isVerified: true
    )
    static let sampleAvocado = FoodItem(
        name: "Avocado, raw", brand: nil,
        servingSize: 150, servingUnit: "g",
        calories: 240, fat: 22, saturatedFat: 3.2, protein: 3,
        totalCarbs: 12.8, fiber: 10, sugar: 0.7,
        sodium: 11, potassium: 727, magnesium: 43,
        dataSource: .usda, isVerified: true
    )
    static let sampleBacon = FoodItem(
        name: "Bacon, pork", brand: nil,
        servingSize: 28, servingUnit: "g",
        calories: 130, fat: 10, saturatedFat: 3.3, protein: 9,
        totalCarbs: 0.4, fiber: 0, sugar: 0,
        sodium: 400, potassium: 139, magnesium: 7,
        dataSource: .usda, isVerified: true
    )
}
