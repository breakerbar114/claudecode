import SwiftUI

struct OnboardingContainerView: View {
    @EnvironmentObject var appState: AppState
    @State private var currentPage = 0
    @State private var profile = UserProfile()

    var body: some View {
        ZStack {
            KC.Color.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress dots
                HStack(spacing: 8) {
                    ForEach(0..<5) { i in
                        Capsule()
                            .fill(i <= currentPage ? KC.Color.accentGreen : KC.Color.surface)
                            .frame(width: i == currentPage ? 24 : 8, height: 8)
                            .animation(.spring(), value: currentPage)
                    }
                }
                .padding(.top, KC.Spacing.xl)

                TabView(selection: $currentPage) {
                    GoalSelectionPage(profile: $profile, onNext: { advance() })
                        .tag(0)
                    ActivityPage(profile: $profile, onNext: { advance() })
                        .tag(1)
                    BodyStatsPage(profile: $profile, onNext: { advance() })
                        .tag(2)
                    CarbTargetPage(profile: $profile, onNext: { advance() })
                        .tag(3)
                    MetricPickerPage(profile: $profile, onFinish: { finish() })
                        .tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: currentPage)
            }
        }
    }

    private func advance() {
        withAnimation { currentPage = min(currentPage + 1, 4) }
    }

    private func finish() {
        profile.onboardingComplete = true
        profile.save()
        KC.success()
        appState.completeOnboarding()
    }
}

// MARK: - Page 1: Goal
struct GoalSelectionPage: View {
    @Binding var profile: UserProfile
    var onNext: () -> Void

    let goals: [(String, String, String)] = [
        ("Lose Weight", "Caloric deficit + keto for fat loss", "arrow.down.circle.fill"),
        ("Body Recomp",  "Lose fat, gain muscle simultaneously", "figure.strengthtraining.traditional"),
        ("Maintain",    "Maintain current weight on keto", "checkmark.circle.fill")
    ]

    var body: some View {
        OnboardingPage(
            title: "What's your goal?",
            subtitle: "KetoCast will personalize your targets around this."
        ) {
            VStack(spacing: KC.Spacing.sm) {
                ForEach(goals, id: \.0) { goal in
                    GoalCard(
                        title: goal.0, desc: goal.1, icon: goal.2,
                        isSelected: isSelected(goal.0)
                    ) {
                        setGoal(goal.0)
                        KC.impact(.light)
                    }
                }
            }
            .padding(.horizontal, KC.Spacing.md)

            nextButton(action: onNext)
        }
    }

    private func isSelected(_ g: String) -> Bool {
        switch g {
        case "Lose Weight": return profile.goalWeightKg < profile.weightKg
        case "Maintain":    return profile.goalWeightKg == profile.weightKg
        default:            return false
        }
    }

    private func setGoal(_ g: String) {
        switch g {
        case "Lose Weight": profile.goalWeightKg = max(profile.weightKg - 10, 50)
        case "Maintain":    profile.goalWeightKg = profile.weightKg
        case "Body Recomp": profile.goalWeightKg = profile.weightKg
        default: break
        }
    }
}

struct GoalCard: View {
    let title: String; let desc: String; let icon: String
    let isSelected: Bool; let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: KC.Spacing.md) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(isSelected ? .black : KC.Color.accentGreen)
                    .frame(width: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(KC.Font.bodySmall.bold())
                        .foregroundColor(isSelected ? .black : KC.Color.textPrimary)
                    Text(desc).font(KC.Font.caption)
                        .foregroundColor(isSelected ? .black.opacity(0.7) : KC.Color.textSecond)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark").foregroundColor(.black)
                }
            }
            .padding(KC.Spacing.md)
            .background(isSelected ? KC.Color.accentGreen : KC.Color.card)
            .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Page 2: Activity
struct ActivityPage: View {
    @Binding var profile: UserProfile
    var onNext: () -> Void

    var body: some View {
        OnboardingPage(title: "How active are you?",
                       subtitle: "Used to calculate your daily calorie needs.") {
            VStack(spacing: KC.Spacing.sm) {
                ForEach(UserProfile.ActivityLevel.allCases, id: \.self) { level in
                    GoalCard(
                        title: level.rawValue, desc: "TDEE multiplier: ×\(level.multiplier)",
                        icon: "figure.walk", isSelected: profile.activityLevel == level
                    ) {
                        profile.activityLevel = level
                        KC.impact(.light)
                    }
                }
            }
            .padding(.horizontal, KC.Spacing.md)
            nextButton(action: onNext)
        }
    }
}

// MARK: - Page 3: Body Stats
struct BodyStatsPage: View {
    @Binding var profile: UserProfile
    var onNext: () -> Void

    var body: some View {
        OnboardingPage(title: "Tell us about you",
                       subtitle: "Stays private. Used only for macro calculations.") {
            VStack(spacing: KC.Spacing.md) {
                // Sex
                Picker("Sex", selection: $profile.sex) {
                    ForEach(UserProfile.BiologicalSex.allCases, id: \.self) { s in
                        Text(s.rawValue).tag(s)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, KC.Spacing.md)

                // Age
                LabeledSlider(label: "Age", value: $profile.age.toDouble(), range: 16...80, step: 1,
                               format: { "\(Int($0)) yrs" })

                // Height
                LabeledSlider(label: "Height", value: $profile.heightCm, range: 140...220, step: 1,
                               format: { "\(Int($0)) cm" })

                // Weight
                LabeledSlider(label: "Current Weight", value: $profile.weightKg, range: 40...200, step: 0.5,
                               format: { String(format: "%.1f kg", $0) })

                // Goal Weight
                LabeledSlider(label: "Goal Weight", value: $profile.goalWeightKg, range: 40...200, step: 0.5,
                               format: { String(format: "%.1f kg", $0) })
            }
            .padding(.horizontal, KC.Spacing.md)

            // TDEE preview
            VStack(spacing: 4) {
                Text("Estimated Daily Calories")
                    .font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                Text("\(Int(profile.tdee)) kcal/day")
                    .font(KC.Font.dataNumber).foregroundColor(KC.Color.accentGreen)
            }
            .padding(KC.Spacing.md)

            nextButton(action: onNext)
        }
    }
}

struct LabeledSlider: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let format: (Double) -> String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label).font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
                Spacer()
                Text(format(value)).font(KC.Font.dataNumber).foregroundColor(KC.Color.textPrimary)
            }
            Slider(value: $value, in: range, step: step)
                .tint(KC.Color.accentGreen)
        }
        .padding(KC.Spacing.md)
        .background(KC.Color.card)
        .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
    }
}

// MARK: - Page 4: Carb Target
struct CarbTargetPage: View {
    @Binding var profile: UserProfile
    var onNext: () -> Void

    var body: some View {
        OnboardingPage(title: "Choose your carb limit",
                       subtitle: "You can change this anytime in settings.") {
            VStack(spacing: KC.Spacing.sm) {
                ForEach(UserProfile.KetoMode.allCases, id: \.self) { mode in
                    GoalCard(
                        title: mode.rawValue,
                        desc: modeDesc(mode),
                        icon: modeIcon(mode),
                        isSelected: profile.ketoMode == mode
                    ) {
                        profile.ketoMode = mode
                        KC.impact(.light)
                    }
                }

                if profile.ketoMode == .custom {
                    LabeledSlider(label: "Custom carb target", value: $profile.customCarbTarget,
                                  range: 10...100, step: 5, format: { "\(Int($0))g net carbs" })
                        .padding(.horizontal, KC.Spacing.md)
                }
            }
            .padding(.horizontal, KC.Spacing.md)
            nextButton(action: onNext)
        }
    }

    private func modeDesc(_ mode: UserProfile.KetoMode) -> String {
        switch mode {
        case .strict:   return "Best for entering & maintaining ketosis. For most people."
        case .moderate: return "Flexible keto. Good for athletes or those close to goal weight."
        case .custom:   return "Set your own target. Advanced users."
        }
    }

    private func modeIcon(_ mode: UserProfile.KetoMode) -> String {
        switch mode {
        case .strict: return "lock.fill"; case .moderate: return "gauge.medium"; case .custom: return "slider.horizontal.3"
        }
    }
}

// MARK: - Page 5: Metric Picker
struct MetricPickerPage: View {
    @Binding var profile: UserProfile
    var onFinish: () -> Void

    var body: some View {
        OnboardingPage(title: "What matters most to you?",
                       subtitle: "Pick 3 metrics. We'll highlight these on your dashboard.") {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: KC.Spacing.sm) {
                ForEach(UserProfile.PriorityMetric.allCases, id: \.self) { metric in
                    let isSelected = profile.priorityMetrics.contains(metric)
                    Button {
                        if isSelected {
                            profile.priorityMetrics.removeAll { $0 == metric }
                        } else if profile.priorityMetrics.count < 3 {
                            profile.priorityMetrics.append(metric)
                        }
                        KC.impact(.light)
                    } label: {
                        Text(metric.rawValue)
                            .font(KC.Font.bodySmall.bold())
                            .foregroundColor(isSelected ? .black : KC.Color.textSecond)
                            .frame(maxWidth: .infinity)
                            .padding(KC.Spacing.sm)
                            .background(isSelected ? KC.Color.accentGreen : KC.Color.card)
                            .clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
                    }
                    .buttonStyle(.plain)
                    .disabled(!isSelected && profile.priorityMetrics.count >= 3)
                }
            }
            .padding(.horizontal, KC.Spacing.md)

            nextButton(label: "Start KetoCast", action: onFinish)
        }
    }
}

// MARK: - Reusable onboarding shell
struct OnboardingPage<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KC.Spacing.lg) {
                VStack(alignment: .leading, spacing: KC.Spacing.xs) {
                    Text(title)
                        .font(KC.Font.displayMedium)
                        .foregroundColor(KC.Color.textPrimary)
                    Text(subtitle)
                        .font(KC.Font.bodySmall)
                        .foregroundColor(KC.Color.textSecond)
                }
                .padding(.horizontal, KC.Spacing.md)

                content
                    .padding(.bottom, KC.Spacing.xl)
            }
            .padding(.top, KC.Spacing.lg)
        }
    }
}

private func nextButton(label: String = "Continue", action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Text(label)
            .font(KC.Font.bodySmall.bold())
            .foregroundColor(.black)
            .frame(maxWidth: .infinity)
            .padding(KC.Spacing.md)
            .background(KC.Color.accentGreen)
            .clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
    }
    .buttonStyle(.plain)
    .padding(.horizontal, KC.Spacing.md)
}

// MARK: - Binding<Int>.toDouble()
extension Binding where Value == Int {
    func toDouble() -> Binding<Double> {
        Binding<Double>(get: { Double(wrappedValue) }, set: { wrappedValue = Int($0) })
    }
}
