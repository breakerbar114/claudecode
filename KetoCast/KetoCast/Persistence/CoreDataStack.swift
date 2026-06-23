import CoreData
import Foundation

final class PersistenceController {
    static let shared = PersistenceController()

    let container: NSPersistentContainer

    private init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "KetoCast")
        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }
        container.loadPersistentStores { _, error in
            if let error {
                // Production apps should handle this gracefully instead of crashing,
                // but this is a fatal configuration error that prevents any data persistence.
                fatalError("Core Data load failed: \(error)")
            }
        }
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    static let preview: PersistenceController = {
        let result = PersistenceController(inMemory: true)
        return result
    }()

    func save() {
        let context = container.viewContext
        guard context.hasChanges else { return }
        do {
            try context.save()
        } catch {
            // Log but don't crash — unsaved changes are recoverable in most cases
            print("Core Data save error: \(error)")
        }
    }
}

// MARK: - CDFoodLog (Core Data entity for persisted food logs)
// The Core Data model is defined in KetoCast.xcdatamodeld
// These extensions map between value types and managed objects

extension NSManagedObjectContext {
    func saveIfNeeded() {
        guard hasChanges else { return }
        try? save()
    }
}
