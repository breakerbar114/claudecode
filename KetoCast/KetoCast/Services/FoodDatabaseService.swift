import Foundation

// Priority: UserCache → OpenFoodFacts (barcode) → USDA → AI fallback
actor FoodDatabaseService {
    static let shared = FoodDatabaseService()

    private let session: URLSession
    private let usdaBaseURL = "https://api.nal.usda.gov/fdc/v1"
    private let offBaseURL  = "https://world.openfoodfacts.org/api/v2"
    private var cache: [String: FoodItem] = [:]  // barcode → item

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.requestCachePolicy = .returnCacheDataElseLoad
        session = URLSession(configuration: config)
    }

    // MARK: - Barcode lookup
    func lookupBarcode(_ barcode: String) async throws -> FoodItem {
        if let cached = cache[barcode] { return cached }

        // 1. Try Open Food Facts first (better barcode coverage)
        if let item = try? await fetchFromOpenFoodFacts(barcode: barcode) {
            cache[barcode] = item
            return item
        }

        // 2. Fallback to USDA (has GTINs for many products)
        if let item = try? await fetchFromUSDA(barcode: barcode) {
            cache[barcode] = item
            return item
        }

        throw FoodDBError.notFound
    }

    // MARK: - Text search
    func search(_ query: String, limit: Int = 20) async throws -> [FoodItem] {
        let items = try await fetchFromUSDA(query: query, limit: limit)
        return items
    }

    // MARK: - Open Food Facts
    private func fetchFromOpenFoodFacts(barcode: String) async throws -> FoodItem {
        let url = URL(string: "\(offBaseURL)/product/\(barcode).json?fields=product_name,brands,nutriments,serving_size,serving_quantity,code")!
        let (data, response) = try await session.data(from: url)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw FoodDBError.networkError }

        let decoded = try JSONDecoder().decode(OFFProductResponse.self, from: data)
        guard let product = decoded.product, decoded.status == 1 else { throw FoodDBError.notFound }

        return product.toFoodItem(barcode: barcode)
    }

    // MARK: - USDA FoodData Central
    private func fetchFromUSDA(barcode: String) async throws -> FoodItem {
        let apiKey = SecretsManager.shared.usdaAPIKey
        let url = URL(string: "\(usdaBaseURL)/foods/search?query=\(barcode)&dataType=Branded&pageSize=1&api_key=\(apiKey)")!
        let (data, _) = try await session.data(from: url)
        let decoded = try JSONDecoder().decode(USDASearchResponse.self, from: data)
        guard let food = decoded.foods.first else { throw FoodDBError.notFound }
        return food.toFoodItem()
    }

    private func fetchFromUSDA(query: String, limit: Int) async throws -> [FoodItem] {
        let apiKey = SecretsManager.shared.usdaAPIKey
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let url = URL(string: "\(usdaBaseURL)/foods/search?query=\(encoded)&dataType=Foundation,SR%20Legacy,Branded&pageSize=\(limit)&api_key=\(apiKey)")!
        let (data, _) = try await session.data(from: url)
        let decoded = try JSONDecoder().decode(USDASearchResponse.self, from: data)
        return decoded.foods.map { $0.toFoodItem() }
    }

    enum FoodDBError: Error, LocalizedError {
        case notFound, networkError, parseError
        var errorDescription: String? {
            switch self {
            case .notFound:     return "Food not found in database"
            case .networkError: return "Network error — check your connection"
            case .parseError:   return "Could not parse food data"
            }
        }
    }
}

// MARK: - Open Food Facts Decodable models
private struct OFFProductResponse: Decodable {
    let status: Int
    let product: OFFProduct?
}

private struct OFFProduct: Decodable {
    let product_name: String?
    let brands: String?
    let nutriments: OFFNutriments
    let serving_size: String?

    func toFoodItem(barcode: String) -> FoodItem {
        FoodItem(
            name: product_name ?? "Unknown",
            brand: brands,
            servingSize: 100,
            servingUnit: "g",
            calories: nutriments.energyKcal100g ?? 0,
            fat: nutriments.fat100g ?? 0,
            saturatedFat: nutriments.saturatedFat100g ?? 0,
            protein: nutriments.proteins100g ?? 0,
            totalCarbs: nutriments.carbohydrates100g ?? 0,
            fiber: nutriments.fiber100g ?? 0,
            sugar: nutriments.sugars100g ?? 0,
            sodium: (nutriments.sodium100g ?? 0) * 1000,
            potassium: nutriments.potassium100g ?? 0,
            magnesium: nutriments.magnesium100g ?? 0,
            dataSource: .openFoodFacts,
            isVerified: false,
            barcode: barcode
        )
    }
}

private struct OFFNutriments: Decodable {
    let energyKcal100g: Double?
    let fat100g: Double?
    let saturatedFat100g: Double?
    let proteins100g: Double?
    let carbohydrates100g: Double?
    let fiber100g: Double?
    let sugars100g: Double?
    let sodium100g: Double?
    let potassium100g: Double?
    let magnesium100g: Double?

    enum CodingKeys: String, CodingKey {
        case energyKcal100g     = "energy-kcal_100g"
        case fat100g            = "fat_100g"
        case saturatedFat100g   = "saturated-fat_100g"
        case proteins100g       = "proteins_100g"
        case carbohydrates100g  = "carbohydrates_100g"
        case fiber100g          = "fiber_100g"
        case sugars100g         = "sugars_100g"
        case sodium100g         = "sodium_100g"
        case potassium100g      = "potassium_100g"
        case magnesium100g      = "magnesium_100g"
    }
}

// MARK: - USDA Decodable models
private struct USDASearchResponse: Decodable {
    let foods: [USDAFood]
}

private struct USDAFood: Decodable {
    let fdcId: Int
    let description: String
    let brandOwner: String?
    let brandName: String?
    let foodNutrients: [USDANutrient]

    func nutrientValue(_ id: Int) -> Double {
        foodNutrients.first { $0.nutrientId == id }?.value ?? 0
    }

    func toFoodItem() -> FoodItem {
        FoodItem(
            name: description,
            brand: brandOwner ?? brandName,
            servingSize: 100,
            servingUnit: "g",
            calories: nutrientValue(1008),       // Energy (kcal)
            fat: nutrientValue(1004),             // Total lipid
            saturatedFat: nutrientValue(1258),    // Fatty acids, saturated
            protein: nutrientValue(1003),         // Protein
            totalCarbs: nutrientValue(1005),      // Carbohydrate
            fiber: nutrientValue(1079),           // Fiber
            sugar: nutrientValue(2000),           // Sugars
            sodium: nutrientValue(1093),          // Sodium (mg)
            potassium: nutrientValue(1092),       // Potassium (mg)
            magnesium: nutrientValue(1090),       // Magnesium (mg)
            dataSource: .usda,
            isVerified: true
        )
    }
}

private struct USDANutrient: Decodable {
    let nutrientId: Int
    let value: Double

    enum CodingKeys: String, CodingKey {
        case nutrientId = "nutrientId"
        case value
    }
}
