import Foundation

// Reads API keys from Secrets.plist (not committed to version control)
final class SecretsManager {
    static let shared = SecretsManager()

    private var secrets: [String: String] = [:]

    private init() {
        guard let url = Bundle.main.url(forResource: "Secrets", withExtension: "plist"),
              let dict = NSDictionary(contentsOf: url) as? [String: String]
        else {
            print("⚠️  Secrets.plist not found — API features will not work. See README.")
            return
        }
        secrets = dict
    }

    var openAIAPIKey: String    { secrets["OPENAI_API_KEY"]    ?? "" }
    var anthropicAPIKey: String { secrets["ANTHROPIC_API_KEY"] ?? "" }
    var usdaAPIKey: String      { secrets["USDA_API_KEY"]      ?? "DEMO_KEY" }
}
