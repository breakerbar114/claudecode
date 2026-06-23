import SwiftUI
import Charts

struct ProfileView: View {
    @StateObject private var vm = ProfileViewModel()
    @EnvironmentObject var appState: AppState
    @State private var showWeightLog = false
    @State private var showMeasurements = false
    @State private var newWeight: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: KC.Spacing.md) {
                // Header
                profileHeader
                    .padding(.horizontal, KC.Spacing.md)
                    .padding(.top, KC.Spacing.md)

                // Macro targets
                MacroTargetsCard(profile: vm.profile)
                    .padding(.horizontal, KC.Spacing.md)

                // Body stats
                BodyStatsCard(vm: vm, showWeightLog: $showWeightLog)
                    .padding(.horizontal, KC.Spacing.md)

                // Body measurements
                MeasurementsCard(showMeasurements: $showMeasurements)
                    .padding(.horizontal, KC.Spacing.md)

                // Settings
                SettingsSection(appState: appState)
                    .padding(.horizontal, KC.Spacing.md)

                Spacer(minLength: 100)
            }
        }
        .background(KC.Color.background)
        .sheet(isPresented: $showWeightLog) {
            WeightLogSheet(vm: vm)
        }
        .sheet(isPresented: $showMeasurements) {
            MeasurementsSheet()
        }
    }

    private var profileHeader: some View {
        HStack(spacing: KC.Spacing.md) {
            Circle()
                .fill(KC.Color.accentGreen.opacity(0.2))
                .frame(width: 60, height: 60)
                .overlay(Image(systemName: "person.fill").font(.title2).foregroundColor(KC.Color.accentGreen))

            VStack(alignment: .leading, spacing: 4) {
                Text(vm.profile.name.isEmpty ? "KetoCast User" : vm.profile.name)
                    .font(KC.Font.displaySmall)
                    .foregroundColor(KC.Color.textPrimary)
                Text("\(vm.profile.ketoMode.rawValue) · \(vm.profile.activityLevel.rawValue.components(separatedBy: "(").first ?? "")")
                    .font(KC.Font.caption)
                    .foregroundColor(KC.Color.textSecond)
            }
            Spacer()
        }
    }
}

struct MacroTargetsCard: View {
    let profile: UserProfile

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Text("Daily Targets").font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)
            HStack(spacing: 0) {
                targetCell(label: "Calories", value: "\(Int(profile.calorieTarget))", unit: "kcal", color: KC.Color.textPrimary)
                Divider().frame(height: 40).background(KC.Color.border)
                targetCell(label: "Net Carbs", value: "\(Int(profile.carbTarget))", unit: "g", color: KC.Color.accentAmber)
                Divider().frame(height: 40).background(KC.Color.border)
                targetCell(label: "Protein", value: "\(Int(profile.proteinTarget))", unit: "g", color: KC.Color.accentBlue)
                Divider().frame(height: 40).background(KC.Color.border)
                targetCell(label: "Fat", value: "\(Int(profile.fatTarget))", unit: "g", color: KC.Color.accentGreen)
            }
        }
        .kcCard()
    }

    private func targetCell(label: String, value: String, unit: String, color: Color) -> some View {
        VStack(spacing: 4) {
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text(value).font(KC.Font.dataNumber).foregroundColor(color)
                Text(unit).font(.system(size: 10)).foregroundColor(KC.Color.textSecond)
            }
            Text(label).font(.system(size: 10)).foregroundColor(KC.Color.textSecond)
        }
        .frame(maxWidth: .infinity)
    }
}

struct BodyStatsCard: View {
    @ObservedObject var vm: ProfileViewModel
    @Binding var showWeightLog: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            HStack {
                Text("Body Stats").font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)
                Spacer()
                Button("Log Weight") { showWeightLog = true }
                    .font(KC.Font.caption.bold())
                    .foregroundColor(KC.Color.accentGreen)
            }

            HStack(spacing: KC.Spacing.lg) {
                statPair(label: "Current", value: String(format: "%.1f", vm.profile.weightKg), unit: "kg")
                statPair(label: "Goal", value: String(format: "%.1f", vm.profile.goalWeightKg), unit: "kg")
                statPair(label: "To Go", value: String(format: "%.1f", max(0, vm.weightToGoalKg)), unit: "kg")
                statPair(label: "BMI", value: String(format: "%.1f", vm.bmi), unit: vm.bmiCategory)
            }
        }
        .kcCard()
    }

    private func statPair(label: String, value: String, unit: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(KC.Font.dataNumber).foregroundColor(KC.Color.textPrimary)
            Text(unit).font(.system(size: 9)).foregroundColor(KC.Color.textSecond)
            Text(label).font(.system(size: 9)).foregroundColor(KC.Color.textSecond)
        }
        .frame(maxWidth: .infinity)
    }
}

struct MeasurementsCard: View {
    @Binding var showMeasurements: Bool
    private let store = MeasurementStore.shared

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            HStack {
                Text("Body Measurements").font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)
                Spacer()
                Button("Add") { showMeasurements = true }
                    .font(KC.Font.caption.bold())
                    .foregroundColor(KC.Color.accentGreen)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: KC.Spacing.xs) {
                ForEach(BodyMeasurement.MeasurementType.allCases, id: \.self) { type in
                    HStack {
                        Text(type.rawValue)
                            .font(KC.Font.caption)
                            .foregroundColor(KC.Color.textSecond)
                        Spacer()
                        if let m = store.latest(for: type) {
                            Text(String(format: "%.1f cm", m.valueCm))
                                .font(KC.Font.dataLabel)
                                .foregroundColor(KC.Color.textPrimary)
                        } else {
                            Text("—").font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                        }
                    }
                    .padding(KC.Spacing.xs)
                    .background(KC.Color.surface)
                    .clipShape(RoundedRectangle(cornerRadius: KC.Radius.tag))
                }
            }
        }
        .kcCard()
    }
}

struct SettingsSection: View {
    let appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Text("Settings").font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)

            settingsRow(icon: "heart.fill", label: "Apple Health") {
                Task { try? await HealthKitService.shared.requestAuthorization() }
            }
            settingsRow(icon: "bell.fill", label: "Notifications") {
                Task { await NotificationService.shared.requestAuthorization() }
            }
            settingsRow(icon: "arrow.counterclockwise", label: "Reset Onboarding") {
                appState.resetOnboarding()
            }
        }
        .kcCard()
    }

    private func settingsRow(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: { action(); KC.impact(.light) }) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(KC.Color.accentGreen)
                    .frame(width: 28)
                Text(label)
                    .font(KC.Font.bodySmall)
                    .foregroundColor(KC.Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(KC.Color.textSecond)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Weight Log Sheet
struct WeightLogSheet: View {
    @ObservedObject var vm: ProfileViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var weightInput: String = ""
    @State private var useKg = true

    private let weightStore = WeightStore.shared

    var body: some View {
        NavigationStack {
            VStack(spacing: KC.Spacing.lg) {
                HStack {
                    TextField(useKg ? "e.g. 72.5" : "e.g. 160", text: $weightInput)
                        .keyboardType(.decimalPad)
                        .font(KC.Font.displayLarge)
                        .foregroundColor(KC.Color.textPrimary)
                    Text(useKg ? "kg" : "lbs")
                        .font(KC.Font.displayMedium)
                        .foregroundColor(KC.Color.textSecond)
                }
                .padding(KC.Spacing.lg)
                .background(KC.Color.card)
                .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
                .padding(.horizontal)

                Toggle("Use kilograms", isOn: $useKg)
                    .foregroundColor(KC.Color.textPrimary)
                    .padding(.horizontal)

                Button("Log Weight") {
                    guard let val = Double(weightInput) else { return }
                    let kg = useKg ? val : val / 2.20462
                    vm.updateWeight(kg)
                    KC.success()
                    dismiss()
                }
                .font(KC.Font.bodySmall.bold())
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(KC.Spacing.md)
                .background(KC.Color.accentGreen)
                .clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
                .padding(.horizontal)
                .disabled(weightInput.isEmpty)

                // Recent entries
                let recent = weightStore.entries(days: 30).suffix(5).reversed()
                if !recent.isEmpty {
                    VStack(alignment: .leading) {
                        Text("Recent")
                            .font(KC.Font.bodySmall.bold())
                            .foregroundColor(KC.Color.textSecond)
                            .padding(.horizontal)
                        ForEach(Array(recent)) { entry in
                            HStack {
                                Text(entry.loggedAt.formatted(date: .abbreviated, time: .omitted))
                                    .font(KC.Font.bodySmall)
                                    .foregroundColor(KC.Color.textSecond)
                                Spacer()
                                Text(String(format: "%.1f kg", entry.weightKg))
                                    .font(KC.Font.dataLabel)
                                    .foregroundColor(KC.Color.textPrimary)
                            }
                            .padding(.horizontal)
                            Divider().background(KC.Color.border).padding(.horizontal)
                        }
                    }
                }

                Spacer()
            }
            .padding(.top)
            .background(KC.Color.background)
            .navigationTitle("Log Weight")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundColor(KC.Color.accentGreen)
                }
            }
        }
    }
}

// MARK: - Measurements Sheet
struct MeasurementsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedType: BodyMeasurement.MeasurementType = .waist
    @State private var valueInput = ""
    private let store = MeasurementStore.shared

    var body: some View {
        NavigationStack {
            VStack(spacing: KC.Spacing.lg) {
                Picker("Measurement", selection: $selectedType) {
                    ForEach(BodyMeasurement.MeasurementType.allCases, id: \.self) {
                        Text($0.rawValue).tag($0)
                    }
                }
                .pickerStyle(.wheel)
                .frame(height: 120)

                HStack {
                    TextField("Value in cm", text: $valueInput)
                        .keyboardType(.decimalPad)
                        .font(KC.Font.displayMedium)
                        .foregroundColor(KC.Color.textPrimary)
                    Text("cm").font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
                }
                .padding(KC.Spacing.md)
                .background(KC.Color.card)
                .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
                .padding(.horizontal)

                Button("Save Measurement") {
                    guard let val = Double(valueInput) else { return }
                    store.add(BodyMeasurement(type: selectedType, valueCm: val))
                    KC.success()
                    dismiss()
                }
                .font(KC.Font.bodySmall.bold())
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(KC.Spacing.md)
                .background(KC.Color.accentGreen)
                .clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
                .padding(.horizontal)
                .disabled(valueInput.isEmpty)

                Spacer()
            }
            .background(KC.Color.background)
            .navigationTitle("Body Measurements")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundColor(KC.Color.accentGreen)
                }
            }
        }
    }
}
