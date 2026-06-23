import Foundation
import UIKit

// Sends food photos to OpenAI gpt-4o vision API; returns structured food estimates
actor AIVisionService {
    static let shared = AIVisionService()

    private let baseURL = "https://api.openai.com/v1/chat/completions"
    private let session = URLSession.shared

    private init() {}

    struct FoodEstimate: Identifiable {
        let id = UUID()
        var name: String
        var portionDescription: String   // "~2 large eggs", "1 cup"
        var estimatedGrams: Double
        var foodItem: FoodItem
        var confidence: Double           // 0.0–1.0
    }

    func identifyFood(in image: UIImage) async throws -> [FoodEstimate] {
        guard let jpeg = image.jpegData(compressionQuality: 0.7) else {
            throw VisionError.imageEncodingFailed
        }
        let base64 = jpeg.base64EncodedString()

        let payload = buildPayload(imageBase64: base64)
        var request = URLRequest(url: URL(string: baseURL)!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(SecretsManager.shared.openAIAPIKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        request.timeoutInterval = 30

        let (data, response) = try await session.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw VisionError.apiError((response as? HTTPURLResponse)?.statusCode ?? 0)
        }

        return try parseResponse(data)
    }

    private func buildPayload(imageBase64: String) -> [String: Any] {
        let systemPrompt = """
        You are a precision nutrition analyst. Analyze the food image and return a JSON array of food items detected.
        For each item return:
        - name: specific food name (e.g. "scrambled eggs" not just "eggs")
        - portion: human-readable portion estimate (e.g. "2 large eggs", "1/2 avocado")
        - grams: estimated weight in grams
        - calories: estimated kcal per the portion given
        - fat_g: total fat grams
        - protein_g: protein grams
        - total_carbs_g: total carbohydrate grams
        - fiber_g: dietary fiber grams
        - sodium_mg: sodium milligrams
        - confidence: 0.0-1.0 how confident you are

        Return ONLY valid JSON array. No markdown. No explanation.
        Example: [{"name":"scrambled eggs","portion":"2 large eggs","grams":100,"calories":148,"fat_g":10,"protein_g":12,"total_carbs_g":2,"fiber_g":0,"sodium_mg":170,"confidence":0.9}]
        """

        return [
            "model": "gpt-4o",
            "max_tokens": 1000,
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": [
                    ["type": "text", "text": "Identify all foods in this image and estimate their nutritional content for the visible portions."],
                    ["type": "image_url", "image_url": ["url": "data:image/jpeg;base64,\(imageBase64)", "detail": "high"]]
                ]]
            ]
        ]
    }

    private func parseResponse(_ data: Data) throws -> [FoodEstimate] {
        struct ChatResponse: Decodable {
            struct Choice: Decodable {
                struct Message: Decodable { let content: String }
                let message: Message
            }
            let choices: [Choice]
        }

        let chat = try JSONDecoder().decode(ChatResponse.self, from: data)
        guard let content = chat.choices.first?.message.content,
              let jsonData = content.data(using: .utf8),
              let items = try? JSONSerialization.jsonObject(with: jsonData) as? [[String: Any]]
        else { throw VisionError.parseError }

        return items.compactMap { dict -> FoodEstimate? in
            guard let name = dict["name"] as? String,
                  let portion = dict["portion"] as? String,
                  let grams = dict["grams"] as? Double else { return nil }

            let item = FoodItem(
                name: name,
                servingSize: grams,
                servingUnit: "g",
                calories: dict["calories"] as? Double ?? 0,
                fat: dict["fat_g"] as? Double ?? 0,
                protein: dict["protein_g"] as? Double ?? 0,
                totalCarbs: dict["total_carbs_g"] as? Double ?? 0,
                fiber: dict["fiber_g"] as? Double ?? 0,
                sodium: dict["sodium_mg"] as? Double ?? 0,
                dataSource: .aiPhoto,
                isVerified: false
            )
            return FoodEstimate(
                name: name,
                portionDescription: portion,
                estimatedGrams: grams,
                foodItem: item,
                confidence: dict["confidence"] as? Double ?? 0.7
            )
        }
    }

    enum VisionError: Error, LocalizedError {
        case imageEncodingFailed, apiError(Int), parseError
        var errorDescription: String? {
            switch self {
            case .imageEncodingFailed: return "Could not process image"
            case .apiError(let code): return "Vision API error (\(code))"
            case .parseError:          return "Could not parse food identification"
            }
        }
    }
}
