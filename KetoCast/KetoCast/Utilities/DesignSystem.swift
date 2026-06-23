import SwiftUI

// KetoCast design system — single source of truth for colors, typography, spacing
enum KC {
    // MARK: - Colors
    enum Color {
        static let background  = SwiftUI.Color(hex: "#0A0A0F")
        static let surface     = SwiftUI.Color(hex: "#141419")
        static let card        = SwiftUI.Color(hex: "#1C1C24")
        static let accentGreen = SwiftUI.Color(hex: "#00D9A3")
        static let accentAmber = SwiftUI.Color(hex: "#F5A623")
        static let accentRed   = SwiftUI.Color(hex: "#FF4757")
        static let accentBlue  = SwiftUI.Color(hex: "#4A9EFF")
        static let textPrimary = SwiftUI.Color(hex: "#F0F0F5")
        static let textSecond  = SwiftUI.Color(hex: "#8888A0")
        static let border      = SwiftUI.Color.white.opacity(0.08)

        static func zoneColor(for zone: DailyMacros.KetosisZone) -> SwiftUI.Color {
            switch zone { case .green: return accentGreen; case .yellow: return accentAmber; case .red: return accentRed }
        }
    }

    // MARK: - Typography scale
    enum Font {
        static let displayLarge  = SwiftUI.Font.system(.largeTitle,  design: .default, weight: .bold)
        static let displayMedium = SwiftUI.Font.system(.title,       design: .default, weight: .bold)
        static let displaySmall  = SwiftUI.Font.system(.title2,      design: .default, weight: .semibold)
        static let bodyLarge     = SwiftUI.Font.system(.body,        design: .default, weight: .regular)
        static let bodySmall     = SwiftUI.Font.system(.subheadline, design: .default, weight: .regular)
        static let caption       = SwiftUI.Font.system(.caption,     design: .default, weight: .medium)
        static let dataNumber    = SwiftUI.Font.system(.title2,      design: .monospaced, weight: .semibold)
        static let dataLabel     = SwiftUI.Font.system(.caption,     design: .monospaced, weight: .regular)
    }

    // MARK: - Spacing (16pt base grid)
    enum Spacing {
        static let xxs:  CGFloat = 4
        static let xs:   CGFloat = 8
        static let sm:   CGFloat = 12
        static let md:   CGFloat = 16
        static let lg:   CGFloat = 24
        static let xl:   CGFloat = 32
        static let xxl:  CGFloat = 48
    }

    // MARK: - Corner radii
    enum Radius {
        static let card:   CGFloat = 16
        static let button: CGFloat = 12
        static let tag:    CGFloat = 8
        static let full:   CGFloat = 999
    }

    // MARK: - Haptics
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
    static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }
}

// MARK: - SwiftUI Color from hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 08) & 0xFF) / 255
        let b = Double((int >> 00) & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Card modifier
struct KCCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(KC.Spacing.md)
            .background(KC.Color.card)
            .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
            .overlay(RoundedRectangle(cornerRadius: KC.Radius.card).stroke(KC.Color.border, lineWidth: 1))
    }
}

extension View {
    func kcCard() -> some View { modifier(KCCard()) }
}
