import SwiftUI

struct HomeView: View {
    @StateObject private var vm = DashboardViewModel()
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            VStack(spacing: KC.Spacing.md) {
                headerRow
                MacroRingCard(vm: vm)
                StatsRow(macros: vm.todayMacros, profile: vm.profile)
                ElectrolyteCard(vm: vm)
                MealSlotsCard(vm: vm)
                if !vm.nudges.isEmpty {
                    CoachingNudgesCard(nudges: vm.nudges)
                }
                StreakCard(streak: vm.streak)
                Spacer(minLength: 100)   // room for tab bar
            }
            .padding(.horizontal, KC.Spacing.md)
            .padding(.top, KC.Spacing.md)
        }
        .background(KC.Color.background)
        .onAppear {
            vm.refresh()
            Task { await vm.fetchNudges() }
        }
    }

    private var headerRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(greeting)
                    .font(KC.Font.bodySmall)
                    .foregroundColor(KC.Color.textSecond)
                Text(vm.profile.name.isEmpty ? "KetoCast" : vm.profile.name)
                    .font(KC.Font.displaySmall)
                    .foregroundColor(KC.Color.textPrimary)
            }
            Spacer()
            Text(Date.now, format: .dateTime.month(.abbreviated).day())
                .font(KC.Font.bodySmall)
                .foregroundColor(KC.Color.textSecond)
        }
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: .now)
        switch h {
        case 5..<12:  return "Good morning"
        case 12..<17: return "Good afternoon"
        default:      return "Good evening"
        }
    }
}

// MARK: - Macro Ring Card
struct MacroRingCard: View {
    @ObservedObject var vm: DashboardViewModel
    @State private var animationProgress: Double = 0

    var body: some View {
        VStack(spacing: KC.Spacing.md) {
            ZStack {
                // Background ring
                Circle()
                    .stroke(KC.Color.card, lineWidth: 20)
                    .frame(width: 200, height: 200)

                // Fat ring (outermost segment, green)
                Circle()
                    .trim(from: 0, to: vm.fatProgress * animationProgress)
                    .stroke(KC.Color.accentGreen, style: StrokeStyle(lineWidth: 20, lineCap: .round))
                    .frame(width: 200, height: 200)
                    .rotationEffect(.degrees(-90))

                // Protein ring (middle, blue)
                Circle()
                    .trim(from: 0, to: vm.proteinProgress * animationProgress)
                    .stroke(KC.Color.accentBlue, style: StrokeStyle(lineWidth: 20, lineCap: .round))
                    .frame(width: 160, height: 160)
                    .rotationEffect(.degrees(-90))

                // Net carbs ring (inner, amber/red)
                Circle()
                    .trim(from: 0, to: vm.netCarbProgress * animationProgress)
                    .stroke(KC.Color.zoneColor(for: vm.todayMacros.ketosisZone),
                            style: StrokeStyle(lineWidth: 20, lineCap: .round))
                    .frame(width: 120, height: 120)
                    .rotationEffect(.degrees(-90))

                // Center text
                VStack(spacing: 2) {
                    Text("\(Int(vm.todayMacros.netCarbs))g")
                        .font(KC.Font.dataNumber)
                        .foregroundColor(KC.Color.zoneColor(for: vm.todayMacros.ketosisZone))
                    Text("net carbs")
                        .font(KC.Font.caption)
                        .foregroundColor(KC.Color.textSecond)

                    Text(vm.todayMacros.ketosisZone.label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(KC.Color.zoneColor(for: vm.todayMacros.ketosisZone))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(KC.Color.zoneColor(for: vm.todayMacros.ketosisZone).opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            .animation(.spring(duration: 1.2), value: animationProgress)
            .onAppear { animationProgress = 1.0 }

            // Legend
            HStack(spacing: KC.Spacing.lg) {
                legendItem(color: KC.Color.accentGreen, label: "Fat", value: "\(Int(vm.todayMacros.fat))g")
                legendItem(color: KC.Color.accentBlue,  label: "Protein", value: "\(Int(vm.todayMacros.protein))g")
                legendItem(color: KC.Color.accentAmber, label: "Net Carbs", value: "\(Int(vm.todayMacros.netCarbs))g")
            }
        }
        .kcCard()
    }

    private func legendItem(color: Color, label: String, value: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 0) {
                Text(value).font(KC.Font.dataNumber).foregroundColor(KC.Color.textPrimary)
                Text(label).font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
            }
        }
    }
}

// MARK: - Stats Row
struct StatsRow: View {
    let macros: DailyMacros
    let profile: UserProfile

    var body: some View {
        HStack(spacing: KC.Spacing.xs) {
            statTile(value: "\(Int(macros.calories))", label: "Calories",
                     sub: "/ \(Int(profile.calorieTarget))", color: KC.Color.textPrimary)
            statTile(value: "\(Int(macros.protein))g", label: "Protein",
                     sub: "/ \(Int(profile.proteinTarget))g", color: KC.Color.accentBlue)
            statTile(value: "\(Int(macros.fat))g", label: "Fat",
                     sub: "/ \(Int(profile.fatTarget))g", color: KC.Color.accentGreen)
        }
    }

    private func statTile(value: String, label: String, sub: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(KC.Font.dataNumber).foregroundColor(color)
            Text(label).font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
            Text(sub).font(.system(size: 10, design: .monospaced)).foregroundColor(KC.Color.textSecond)
        }
        .frame(maxWidth: .infinity)
        .padding(KC.Spacing.sm)
        .background(KC.Color.card)
        .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
    }
}

// MARK: - Electrolyte Card
struct ElectrolyteCard: View {
    @ObservedObject var vm: DashboardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            HStack {
                Label("Electrolytes", systemImage: "bolt.fill")
                    .font(KC.Font.bodySmall.bold())
                    .foregroundColor(KC.Color.textPrimary)
                Spacer()
                if vm.sodiumWarning || vm.potassiumWarning || vm.magnesiumWarning {
                    Text("LOW")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(KC.Color.accentRed)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(KC.Color.accentRed.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            electrolytebar(label: "Na", value: Int(vm.todayMacros.sodium),
                           target: 4000, unit: "mg", progress: vm.sodiumProgress,
                           isWarning: vm.sodiumWarning)
            electrolytebar(label: "K+", value: Int(vm.todayMacros.potassium),
                           target: 3500, unit: "mg", progress: vm.potassiumProgress,
                           isWarning: vm.potassiumWarning)
            electrolytebar(label: "Mg", value: Int(vm.todayMacros.magnesium),
                           target: 400, unit: "mg", progress: vm.magnesiumProgress,
                           isWarning: vm.magnesiumWarning)
        }
        .kcCard()
    }

    private func electrolytebar(label: String, value: Int, target: Int, unit: String,
                                 progress: Double, isWarning: Bool) -> some View {
        HStack(spacing: KC.Spacing.sm) {
            Text(label)
                .font(KC.Font.dataLabel)
                .foregroundColor(KC.Color.textSecond)
                .frame(width: 24, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(KC.Color.surface)
                        .frame(height: 8)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(isWarning ? KC.Color.accentRed : KC.Color.accentGreen)
                        .frame(width: geo.size.width * min(1, CGFloat(progress)), height: 8)
                        .animation(.spring(duration: 0.8), value: progress)
                }
            }
            .frame(height: 8)
            Text("\(value)\(unit)")
                .font(KC.Font.dataLabel)
                .foregroundColor(isWarning ? KC.Color.accentRed : KC.Color.textSecond)
                .frame(width: 70, alignment: .trailing)
        }
    }
}

// MARK: - Meal Slots Card
struct MealSlotsCard: View {
    @ObservedObject var vm: DashboardViewModel
    @State private var expandedSlot: FoodLog.MealSlot?
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.xs) {
            Text("Today's Meals")
                .font(KC.Font.bodySmall.bold())
                .foregroundColor(KC.Color.textPrimary)
                .padding(.horizontal, KC.Spacing.md)
                .padding(.top, KC.Spacing.md)

            ForEach(FoodLog.MealSlot.allCases, id: \.self) { slot in
                MealSlotRow(slot: slot,
                            logs: vm.logsForSlot(slot),
                            isExpanded: expandedSlot == slot,
                            onToggle: {
                                withAnimation(.spring()) {
                                    expandedSlot = expandedSlot == slot ? nil : slot
                                }
                            },
                            onAdd: { appState.selectedTab = .log },
                            onDelete: { log in vm.removeLog(log) })
                if slot != .snack {
                    Divider().background(KC.Color.border)
                        .padding(.horizontal, KC.Spacing.md)
                }
            }
        }
        .background(KC.Color.card)
        .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
    }
}

struct MealSlotRow: View {
    let slot: FoodLog.MealSlot
    let logs: [FoodLog]
    let isExpanded: Bool
    var onToggle: () -> Void
    var onAdd: () -> Void
    var onDelete: (FoodLog) -> Void

    private var slotMacros: DailyMacros { DailyMacros(from: logs) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header row
            Button(action: { onToggle(); KC.impact(.light) }) {
                HStack {
                    Label(slot.rawValue, systemImage: slot.icon)
                        .font(KC.Font.bodySmall.bold())
                        .foregroundColor(KC.Color.textPrimary)
                    Spacer()
                    if !logs.isEmpty {
                        Text("\(Int(slotMacros.netCarbs))g net carbs · \(Int(slotMacros.calories)) kcal")
                            .font(KC.Font.caption)
                            .foregroundColor(KC.Color.textSecond)
                    } else {
                        Text("Empty")
                            .font(KC.Font.caption)
                            .foregroundColor(KC.Color.textSecond)
                    }
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(KC.Color.textSecond)
                }
                .padding(.horizontal, KC.Spacing.md)
                .padding(.vertical, KC.Spacing.sm)
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: KC.Spacing.xs) {
                    ForEach(logs) { log in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(log.foodItem.name)
                                    .font(KC.Font.bodySmall)
                                    .foregroundColor(KC.Color.textPrimary)
                                Text("\(String(format: "%.0f", log.scaledCalories)) kcal · \(String(format: "%.1f", log.scaledNetCarbs))g net carbs")
                                    .font(KC.Font.caption)
                                    .foregroundColor(KC.Color.textSecond)
                            }
                            Spacer()
                            Button { onDelete(log) } label: {
                                Image(systemName: "minus.circle.fill")
                                    .foregroundColor(KC.Color.accentRed.opacity(0.8))
                            }
                        }
                        .padding(.horizontal, KC.Spacing.md)
                    }
                    Button(action: { onAdd(); KC.impact(.light) }) {
                        Label("Add to \(slot.rawValue)", systemImage: "plus")
                            .font(KC.Font.caption.bold())
                            .foregroundColor(KC.Color.accentGreen)
                    }
                    .padding(.horizontal, KC.Spacing.md)
                    .padding(.bottom, KC.Spacing.sm)
                }
            }
        }
    }
}

// MARK: - Coaching Nudges
struct CoachingNudgesCard: View {
    let nudges: [ClaudeCoachingService.CoachingNudge]

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Label("Coaching", systemImage: "sparkles")
                .font(KC.Font.bodySmall.bold())
                .foregroundColor(KC.Color.textPrimary)

            ForEach(nudges) { nudge in
                HStack(alignment: .top, spacing: KC.Spacing.sm) {
                    Image(systemName: nudge.category.icon)
                        .foregroundColor(KC.Color.accentGreen)
                        .frame(width: 20)
                    Text(nudge.message)
                        .font(KC.Font.bodySmall)
                        .foregroundColor(KC.Color.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .kcCard()
    }
}

// MARK: - Streak Card
struct StreakCard: View {
    let streak: Int

    var body: some View {
        HStack {
            Image(systemName: "flame.fill")
                .font(.title2)
                .foregroundColor(KC.Color.accentAmber)
            VStack(alignment: .leading, spacing: 2) {
                Text("Day \(streak) in ketosis zone")
                    .font(KC.Font.bodySmall.bold())
                    .foregroundColor(KC.Color.textPrimary)
                Text(streak == 0 ? "Start your streak today!" : "Keep the chain going!")
                    .font(KC.Font.caption)
                    .foregroundColor(KC.Color.textSecond)
            }
            Spacer()
            Text("🔥")
                .font(.largeTitle)
        }
        .kcCard()
    }
}
