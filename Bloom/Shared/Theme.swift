import SwiftUI
import UIKit

/// Soft, muted palette used across the app and widget.
enum Theme {
    static let background = Color(light: 0xF7F3EC, dark: 0x15140F)
    static let card = Color(light: 0xFFFDF8, dark: 0x22201A)
    static let ink = Color(light: 0x2E2A24, dark: 0xF2EDE3)
    static let mutedInk = Color(light: 0x8A8276, dark: 0x9C9486)
    static let track = Color(light: 0xE9E3D7, dark: 0x343129)
    static let accent = Color(light: 0x7C9A82, dark: 0x9DBBA3)

    static func title(_ size: CGFloat) -> Font {
        .system(size: size, weight: .semibold, design: .serif)
    }

    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

/// The colour a user picks for each goal.
enum GoalColor: String, Codable, CaseIterable, Identifiable {
    case sage, rose, sky, sand, lavender, peach, clay, mint

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .sage: Color(light: 0x7C9A82, dark: 0x9DBBA3)
        case .rose: Color(light: 0xD48A8A, dark: 0xE5A3A3)
        case .sky: Color(light: 0x7FA3C4, dark: 0x9DBEDB)
        case .sand: Color(light: 0xC9A66B, dark: 0xDDBF8A)
        case .lavender: Color(light: 0x9D8EC4, dark: 0xB7AADB)
        case .peach: Color(light: 0xE0A27E, dark: 0xEDB898)
        case .clay: Color(light: 0xB07D62, dark: 0xC9977D)
        case .mint: Color(light: 0x6FB3A6, dark: 0x8CCABE)
        }
    }

    /// A pale wash of the colour, used behind emoji and on completed cards.
    var wash: Color { color.opacity(0.16) }
}

extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
