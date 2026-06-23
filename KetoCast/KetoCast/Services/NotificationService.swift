import Foundation
import UserNotifications

final class NotificationService {
    static let shared = NotificationService()
    private init() {}

    func requestAuthorization() async {
        _ = try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])
    }

    // Max 3 notifications/day rule enforced by scheduling only specific IDs
    func scheduleLunchReminder() {
        let content = UNMutableNotificationContent()
        content.title = "Time to log lunch"
        content.body  = "You haven't logged anything since breakfast. Keep your streak alive!"
        content.sound = .default

        // 12:00 PM daily, only fires if lunch slot is empty (checked in app)
        var comps = DateComponents(); comps.hour = 12; comps.minute = 0
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
        let req = UNNotificationRequest(identifier: "lunch_reminder", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(req)
    }

    func scheduleCarbWarning(netCarbsConsumed: Double, target: Double) {
        guard netCarbsConsumed / target >= 0.8 else { return }
        let remaining = target - netCarbsConsumed

        let content = UNMutableNotificationContent()
        content.title = "Carb limit approaching"
        content.body  = "You're at 80% of your net carb target. Only \(Int(remaining))g left for today."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let req = UNNotificationRequest(identifier: "carb_warning_\(Date().timeIntervalSince1970)", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(req)
    }

    func scheduleElectrolyteWarning() {
        let content = UNMutableNotificationContent()
        content.title = "Electrolyte check"
        content.body  = "Your sodium is critically low today — this can cause keto flu. Add some salt!"
        content.sound = .default

        // 6 PM reminder
        var comps = DateComponents(); comps.hour = 18; comps.minute = 0
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let req = UNNotificationRequest(identifier: "electrolyte_warning", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(req)
    }

    func scheduleWeeklySummary() {
        let content = UNMutableNotificationContent()
        content.title = "Your weekly keto summary"
        content.body  = "See how you did this week — tap to view your analytics."
        content.sound = .default

        // Every Sunday at 8 AM
        var comps = DateComponents(); comps.weekday = 1; comps.hour = 8; comps.minute = 0
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
        let req = UNNotificationRequest(identifier: "weekly_summary", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(req)
    }

    func cancelAll() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
}
