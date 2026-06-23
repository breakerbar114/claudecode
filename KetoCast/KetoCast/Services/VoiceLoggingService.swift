import Foundation
import AVFoundation

// Records audio, transcribes via Whisper API, parses food items via GPT-4o
@MainActor
final class VoiceLoggingService: NSObject, ObservableObject {
    static let shared = VoiceLoggingService()

    @Published var isRecording = false
    @Published var transcription: String = ""
    @Published var parsedItems: [FoodItem] = []
    @Published var state: RecordingState = .idle

    enum RecordingState {
        case idle, recording, transcribing, parsing, done, error(String)
    }

    private var audioRecorder: AVAudioRecorder?
    private var recordingURL: URL?
    private let session = URLSession.shared

    private override init() { super.init() }

    func startRecording() async throws {
        let perm = AVAudioApplication.shared.recordPermission
        guard perm == .granted else {
            if perm == .undetermined {
                _ = await AVAudioApplication.requestRecordPermission()
            }
            throw VoiceError.permissionDenied
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("ketocast_voice_\(Date().timeIntervalSince1970).m4a")
        recordingURL = url

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]

        try AVAudioSession.sharedInstance().setCategory(.record, mode: .default)
        try AVAudioSession.sharedInstance().setActive(true)

        audioRecorder = try AVAudioRecorder(url: url, settings: settings)
        audioRecorder?.record()
        isRecording = true
        state = .recording
    }

    func stopAndProcess() async {
        audioRecorder?.stop()
        audioRecorder = nil
        isRecording = false
        state = .transcribing

        guard let url = recordingURL else {
            state = .error("No recording found"); return
        }

        do {
            let text = try await transcribeWithWhisper(audioURL: url)
            transcription = text
            state = .parsing
            parsedItems = try await parseFoodsFromText(text)
            state = .done
        } catch {
            state = .error(error.localizedDescription)
        }

        try? FileManager.default.removeItem(at: url)
    }

    // MARK: - Whisper transcription
    private func transcribeWithWhisper(audioURL: URL) async throws -> String {
        let audioData = try Data(contentsOf: audioURL)
        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/audio/transcriptions")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(SecretsManager.shared.openAIAPIKey)", forHTTPHeaderField: "Authorization")

        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func append(_ str: String) { body.append(str.data(using: .utf8)!) }

        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"model\"\r\n\r\n")
        append("whisper-1\r\n")
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.m4a\"\r\n")
        append("Content-Type: audio/m4a\r\n\r\n")
        body.append(audioData)
        append("\r\n--\(boundary)--\r\n")

        request.httpBody = body
        request.timeoutInterval = 30

        let (data, _) = try await session.data(for: request)
        struct WhisperResponse: Decodable { let text: String }
        return try JSONDecoder().decode(WhisperResponse.self, from: data).text
    }

    // MARK: - NL parsing via GPT-4o
    private func parseFoodsFromText(_ text: String) async throws -> [FoodItem] {
        let payload: [String: Any] = [
            "model": "gpt-4o",
            "max_tokens": 800,
            "messages": [
                ["role": "system", "content": """
                Extract food items from the user's speech and return a JSON array.
                Each item: {"name": str, "quantity_description": str, "estimated_grams": float,
                "calories": float, "fat_g": float, "protein_g": float, "total_carbs_g": float, "fiber_g": float}
                Return ONLY valid JSON. No markdown.
                """],
                ["role": "user", "content": text]
            ]
        ]

        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/chat/completions")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(SecretsManager.shared.openAIAPIKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, _) = try await session.data(for: request)
        struct ChatResponse: Decodable {
            struct Choice: Decodable { struct Msg: Decodable { let content: String }; let message: Msg }
            let choices: [Choice]
        }
        let chat = try JSONDecoder().decode(ChatResponse.self, from: data)
        guard let content = chat.choices.first?.message.content,
              let jsonData = content.data(using: .utf8),
              let items = try? JSONSerialization.jsonObject(with: jsonData) as? [[String: Any]]
        else { return [] }

        return items.compactMap { dict -> FoodItem? in
            guard let name = dict["name"] as? String else { return nil }
            return FoodItem(
                name: name,
                servingSize: dict["estimated_grams"] as? Double ?? 100,
                servingUnit: "g",
                calories: dict["calories"] as? Double ?? 0,
                fat: dict["fat_g"] as? Double ?? 0,
                protein: dict["protein_g"] as? Double ?? 0,
                totalCarbs: dict["total_carbs_g"] as? Double ?? 0,
                fiber: dict["fiber_g"] as? Double ?? 0,
                dataSource: .aiVoice,
                isVerified: false
            )
        }
    }

    func reset() {
        transcription = ""; parsedItems = []; state = .idle
    }

    enum VoiceError: Error, LocalizedError {
        case permissionDenied
        var errorDescription: String? { "Microphone access required. Enable in Settings." }
    }
}
