import Foundation
import SwiftUI
import AVFoundation

@MainActor
final class LoggingViewModel: ObservableObject {
    @Published var searchQuery = ""
    @Published var searchResults: [FoodItem] = []
    @Published var recentItems: [FoodItem] = []
    @Published var isSearching = false
    @Published var selectedMealSlot: FoodLog.MealSlot = .breakfast
    @Published var quantity: Double = 1.0
    @Published var pendingItem: FoodItem?
    @Published var error: String?
    @Published var photoEstimates: [AIVisionService.FoodEstimate] = []
    @Published var isPhotoAnalyzing = false
    @Published var showPhotoConfirm = false

    private let db = FoodDatabaseService.shared
    private let store = LogStore.shared
    private var searchTask: Task<Void, Never>?

    init() {
        recentItems = store.recentItems(limit: 10)
        selectedMealSlot = currentMealSlot()
    }

    // MARK: - Search
    func search() {
        searchTask?.cancel()
        guard !searchQuery.isEmpty else {
            searchResults = []; isSearching = false; return
        }
        searchTask = Task {
            isSearching = true
            do {
                let results = try await db.search(searchQuery)
                guard !Task.isCancelled else { return }
                searchResults = results
            } catch {
                self.error = error.localizedDescription
            }
            isSearching = false
        }
    }

    // MARK: - Barcode
    func handleBarcode(_ barcode: String) async {
        isSearching = true
        do {
            let item = try await db.lookupBarcode(barcode)
            pendingItem = item
            KC.impact(.medium)
        } catch {
            self.error = error.localizedDescription
            KC.warning()
        }
        isSearching = false
    }

    // MARK: - Photo logging
    func analyzePhoto(_ image: UIImage) async {
        isPhotoAnalyzing = true
        do {
            let estimates = try await AIVisionService.shared.identifyFood(in: image)
            photoEstimates = estimates
            showPhotoConfirm = !estimates.isEmpty
            KC.impact(.medium)
        } catch {
            self.error = error.localizedDescription
        }
        isPhotoAnalyzing = false
    }

    func confirmPhotoEstimates(_ selected: [AIVisionService.FoodEstimate]) {
        for estimate in selected {
            let log = FoodLog(foodItem: estimate.foodItem, quantity: 1.0,
                              mealSlot: selectedMealSlot, logMethod: .photo)
            store.add(log)
        }
        showPhotoConfirm = false
        photoEstimates = []
        KC.success()
    }

    // MARK: - Log confirmation
    func confirmLog() {
        guard let item = pendingItem else { return }
        let log = FoodLog(foodItem: item, quantity: quantity, mealSlot: selectedMealSlot)
        store.add(log)
        store.recordRecentItem(item)
        pendingItem = nil; quantity = 1.0
        KC.success()
    }

    // MARK: - Quick repeat (copy from yesterday)
    func yesterdayLogs(for slot: FoodLog.MealSlot) -> [FoodLog] {
        store.logsForYesterdaySlot(slot)
    }

    func copyYesterdayMeal(_ slot: FoodLog.MealSlot) {
        let yesterday = store.logsForYesterdaySlot(slot)
        yesterday.forEach {
            let copy = FoodLog(foodItem: $0.foodItem, quantity: $0.quantity,
                               mealSlot: slot, logMethod: .quickRepeat)
            store.add(copy)
        }
        KC.success()
    }

    // MARK: - Smart meal slot detection
    private func currentMealSlot() -> FoodLog.MealSlot {
        let hour = Calendar.current.component(.hour, from: .now)
        switch hour {
        case 5..<11:  return .breakfast
        case 11..<15: return .lunch
        case 15..<20: return .dinner
        default:      return .snack
        }
    }
}
