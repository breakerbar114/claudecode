import SwiftUI
import Charts

struct AnalyticsContainerView: View {
    @StateObject private var vm = AnalyticsViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: KC.Spacing.md) {
                // Time range selector
                Picker("Range", selection: $vm.selectedTimeRange) {
                    ForEach(AnalyticsViewModel.TimeRange.allCases, id: \.self) {
                        Text($0.rawValue).tag($0)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, KC.Spacing.md)
                .padding(.top, KC.Spacing.md)

                // Ketosis score hero card
                KetosisScoreCard(score: vm.ketosisScore, streak: vm.currentStreak)

                switch vm.selectedTimeRange {
                case .day:   DailyAnalyticsView(vm: vm)
                case .week:  WeeklyAnalyticsView(vm: vm)
                case .month: MonthlyAnalyticsView(vm: vm)
                }

                Spacer(minLength: 100)
            }
        }
        .background(KC.Color.background)
        .onAppear { vm.refresh() }
        .navigationTitle("Analytics")
    }
}

// MARK: - Ketosis Score Card
struct KetosisScoreCard: View {
    let score: Int
    let streak: Int
    @State private var animatedScore = 0

    var scoreColor: Color {
        if score >= 75 { return KC.Color.accentGreen }
        if score >= 50 { return KC.Color.accentAmber }
        return KC.Color.accentRed
    }

    var body: some View {
        HStack(spacing: KC.Spacing.lg) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Ketosis Score").font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                Text("\(animatedScore)")
                    .font(.system(size: 52, weight: .bold, design: .monospaced))
                    .foregroundColor(scoreColor)
                    .contentTransition(.numericText())
                Text("/ 100").font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
            }

            Divider().frame(height: 60).background(KC.Color.border)

            VStack(alignment: .leading, spacing: 4) {
                Text("Streak").font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                HStack(alignment: .lastTextBaseline, spacing: 4) {
                    Text("\(streak)")
                        .font(.system(size: 36, weight: .bold, design: .monospaced))
                        .foregroundColor(KC.Color.accentAmber)
                    Text("days").font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
                }
                Text("in ketosis zone").font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
            }
        }
        .kcCard()
        .padding(.horizontal, KC.Spacing.md)
        .onAppear {
            withAnimation(.spring(duration: 1.5)) { animatedScore = score }
        }
    }
}

// MARK: - Daily View
struct DailyAnalyticsView: View {
    @ObservedObject var vm: AnalyticsViewModel

    var today: AnalyticsViewModel.DayData? { vm.weeklyData.last }

    var body: some View {
        VStack(spacing: KC.Spacing.md) {
            if let day = today {
                // Hourly carb pacing card
                VStack(alignment: .leading, spacing: KC.Spacing.sm) {
                    Text("Today's Macros")
                        .font(KC.Font.bodySmall.bold())
                        .foregroundColor(KC.Color.textPrimary)

                    HStack(spacing: 0) {
                        macroBar(label: "Fat", value: day.macros.fat,
                                 color: KC.Color.accentGreen, icon: "drop.fill")
                        macroBar(label: "Protein", value: day.macros.protein,
                                 color: KC.Color.accentBlue, icon: "bolt.fill")
                        macroBar(label: "Net Carbs", value: day.macros.netCarbs,
                                 color: KC.Color.zoneColor(for: day.netCarbZone), icon: "leaf.fill")
                    }
                }
                .kcCard()
                .padding(.horizontal, KC.Spacing.md)

                // Electrolyte status
                DailyElectrolyteView(macros: day.macros)
                    .padding(.horizontal, KC.Spacing.md)
            }
        }
    }

    private func macroBar(label: String, value: Double, color: Color, icon: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.caption).foregroundColor(color)
            Text("\(Int(value))g").font(KC.Font.dataNumber).foregroundColor(KC.Color.textPrimary)
            Text(label).font(.system(size: 10)).foregroundColor(KC.Color.textSecond)
        }
        .frame(maxWidth: .infinity)
    }
}

struct DailyElectrolyteView: View {
    let macros: DailyMacros

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Text("Electrolytes")
                .font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)

            Chart {
                ForEach([
                    (name: "Sodium", val: macros.sodium, target: 4000.0),
                    (name: "Potassium", val: macros.potassium, target: 3500.0),
                    (name: "Magnesium", val: macros.magnesium, target: 400.0)
                ], id: \.name) { item in
                    BarMark(x: .value("Electrolyte", item.name),
                            y: .value("mg", min(item.val, item.target)))
                    .foregroundStyle(item.val >= item.target * 0.8 ? KC.Color.accentGreen : KC.Color.accentRed)
                    .cornerRadius(4)
                }
            }
            .chartYAxis(.hidden)
            .frame(height: 120)
        }
        .kcCard()
    }
}

// MARK: - Weekly View
struct WeeklyAnalyticsView: View {
    @ObservedObject var vm: AnalyticsViewModel

    var body: some View {
        VStack(spacing: KC.Spacing.md) {
            // Net carb bar chart
            NetCarbBarChart(data: vm.weeklyData)
                .padding(.horizontal, KC.Spacing.md)

            // Weight trend
            if vm.weightEntries.count >= 2 {
                WeightTrendChart(entries: vm.weightEntries, trendPerWeek: vm.weightTrendKgPerWeek,
                                 projectedDate: vm.projectedGoalDate)
                .padding(.horizontal, KC.Spacing.md)
            }

            // Stats summary row
            WeeklyStatsRow(vm: vm)
                .padding(.horizontal, KC.Spacing.md)

            // Streak grid (GitHub style)
            StreakGridView(data: vm.weeklyData)
                .padding(.horizontal, KC.Spacing.md)
        }
    }
}

struct NetCarbBarChart: View {
    let data: [AnalyticsViewModel.DayData]

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Text("Net Carbs — 7 Day")
                .font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)

            Chart(data) { day in
                BarMark(
                    x: .value("Day", day.date, unit: .day),
                    y: .value("Net Carbs", day.macros.netCarbs)
                )
                .foregroundStyle(KC.Color.zoneColor(for: day.netCarbZone))
                .cornerRadius(6)
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day)) { _ in
                    AxisValueLabel(format: .dateTime.weekday(.narrow))
                        .foregroundStyle(KC.Color.textSecond)
                }
            }
            .chartYAxis {
                AxisMarks { value in
                    AxisGridLine().foregroundStyle(KC.Color.border)
                    AxisValueLabel().foregroundStyle(KC.Color.textSecond)
                }
            }
            .frame(height: 180)

            // Zone legend
            HStack(spacing: KC.Spacing.md) {
                zoneLegend(color: KC.Color.accentGreen, label: "Ketosis (<20g)")
                zoneLegend(color: KC.Color.accentAmber, label: "Borderline")
                zoneLegend(color: KC.Color.accentRed, label: "Over limit")
            }
        }
        .kcCard()
    }

    private func zoneLegend(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 12, height: 12)
            Text(label).font(.system(size: 10)).foregroundColor(KC.Color.textSecond)
        }
    }
}

struct WeightTrendChart: View {
    let entries: [WeightEntry]
    let trendPerWeek: Double
    let projectedDate: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            HStack {
                Text("Weight Trend")
                    .font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)
                Spacer()
                if let date = projectedDate {
                    Text("Goal by \(date.formatted(date: .abbreviated, time: .omitted))")
                        .font(KC.Font.caption).foregroundColor(KC.Color.accentGreen)
                }
            }

            Chart(entries.suffix(30)) { entry in
                LineMark(
                    x: .value("Date", entry.loggedAt),
                    y: .value("Weight", entry.weightKg)
                )
                .foregroundStyle(KC.Color.accentBlue)
                .lineStyle(StrokeStyle(lineWidth: 2))

                AreaMark(
                    x: .value("Date", entry.loggedAt),
                    y: .value("Weight", entry.weightKg)
                )
                .foregroundStyle(KC.Color.accentBlue.opacity(0.15))
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 7)) { _ in
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        .foregroundStyle(KC.Color.textSecond)
                }
            }
            .chartYAxis {
                AxisMarks { value in
                    AxisGridLine().foregroundStyle(KC.Color.border)
                    AxisValueLabel().foregroundStyle(KC.Color.textSecond)
                }
            }
            .frame(height: 160)

            HStack {
                Image(systemName: trendPerWeek < 0 ? "arrow.down.right" : "arrow.up.right")
                    .foregroundColor(trendPerWeek < 0 ? KC.Color.accentGreen : KC.Color.accentRed)
                Text(String(format: "%.1f kg/week", abs(trendPerWeek)))
                    .font(KC.Font.bodySmall).foregroundColor(KC.Color.textPrimary)
                Text(trendPerWeek < 0 ? "on track" : "gaining")
                    .font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
            }
        }
        .kcCard()
    }
}

struct WeeklyStatsRow: View {
    @ObservedObject var vm: AnalyticsViewModel

    var body: some View {
        HStack(spacing: KC.Spacing.xs) {
            statCell(value: "\(vm.macroConsistencyScore)%", label: "Consistency", color: KC.Color.accentGreen)
            statCell(value: "\(vm.weeklyData.filter { $0.netCarbZone == .green }.count)/7", label: "Keto Days", color: KC.Color.accentAmber)
            if let best = vm.bestDayThisWeek {
                statCell(value: "\(Int(best.macros.netCarbs))g", label: "Best Day", color: KC.Color.accentBlue)
            }
        }
    }

    private func statCell(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(KC.Font.dataNumber).foregroundColor(color)
            Text(label).font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
        }
        .frame(maxWidth: .infinity)
        .padding(KC.Spacing.sm)
        .background(KC.Color.card)
        .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
    }
}

struct StreakGridView: View {
    let data: [AnalyticsViewModel.DayData]

    let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Text("7-Day Keto Grid").font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(data) { day in
                    RoundedRectangle(cornerRadius: 4)
                        .fill(KC.Color.zoneColor(for: day.netCarbZone))
                        .frame(height: 32)
                        .overlay(
                            Text(day.date.formatted(.dateTime.weekday(.narrow)))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.black.opacity(0.7))
                        )
                }
            }
        }
        .kcCard()
    }
}

// MARK: - Monthly View
struct MonthlyAnalyticsView: View {
    @ObservedObject var vm: AnalyticsViewModel

    var body: some View {
        VStack(spacing: KC.Spacing.md) {
            // 30-day net carb heatmap
            MonthlyHeatmapView(data: vm.monthlyData)
                .padding(.horizontal, KC.Spacing.md)

            // Average macros card
            MonthlyAverageMacros(data: vm.monthlyData, profile: UserProfile.load())
                .padding(.horizontal, KC.Spacing.md)

            // Weight trend (30 days)
            if vm.weightEntries.count >= 2 {
                WeightTrendChart(entries: vm.weightEntries, trendPerWeek: vm.weightTrendKgPerWeek,
                                 projectedDate: vm.projectedGoalDate)
                .padding(.horizontal, KC.Spacing.md)
            }
        }
    }
}

struct MonthlyHeatmapView: View {
    let data: [AnalyticsViewModel.DayData]
    let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 7)

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Text("30-Day Keto Heatmap").font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)
            LazyVGrid(columns: columns, spacing: 3) {
                ForEach(data) { day in
                    RoundedRectangle(cornerRadius: 3)
                        .fill(day.macros.calories < 10 ? KC.Color.surface : KC.Color.zoneColor(for: day.netCarbZone).opacity(0.7))
                        .frame(height: 24)
                        .overlay(
                            Text("\(Calendar.current.component(.day, from: day.date))")
                                .font(.system(size: 8))
                                .foregroundColor(KC.Color.textSecond)
                        )
                }
            }
            HStack(spacing: KC.Spacing.md) {
                legendItem(color: KC.Color.accentGreen, label: "Keto zone")
                legendItem(color: KC.Color.accentAmber, label: "Borderline")
                legendItem(color: KC.Color.accentRed,   label: "Over limit")
                legendItem(color: KC.Color.surface,     label: "No data")
            }
        }
        .kcCard()
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 10, height: 10)
            Text(label).font(.system(size: 9)).foregroundColor(KC.Color.textSecond)
        }
    }
}

struct MonthlyAverageMacros: View {
    let data: [AnalyticsViewModel.DayData]
    let profile: UserProfile

    var avgCalories: Double  { data.isEmpty ? 0 : data.map { $0.macros.calories }.reduce(0, +) / Double(data.count) }
    var avgNetCarbs: Double  { data.isEmpty ? 0 : data.map { $0.macros.netCarbs }.reduce(0, +) / Double(data.count) }
    var avgProtein:  Double  { data.isEmpty ? 0 : data.map { $0.macros.protein }.reduce(0, +) / Double(data.count) }
    var avgFat:      Double  { data.isEmpty ? 0 : data.map { $0.macros.fat }.reduce(0, +) / Double(data.count) }

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Text("30-Day Averages vs Targets")
                .font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)

            macroCompareRow(label: "Net Carbs", avg: avgNetCarbs, target: profile.carbTarget, unit: "g", color: KC.Color.accentAmber)
            macroCompareRow(label: "Protein",   avg: avgProtein,  target: profile.proteinTarget, unit: "g", color: KC.Color.accentBlue)
            macroCompareRow(label: "Calories",  avg: avgCalories, target: profile.calorieTarget, unit: "kcal", color: KC.Color.textPrimary)
        }
        .kcCard()
    }

    private func macroCompareRow(label: String, avg: Double, target: Double, unit: String, color: Color) -> some View {
        HStack {
            Text(label).font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond).frame(width: 80, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4).fill(KC.Color.surface).frame(height: 8)
                    RoundedRectangle(cornerRadius: 4).fill(color)
                        .frame(width: geo.size.width * min(1, CGFloat(avg / target)), height: 8)
                }
            }
            .frame(height: 8)
            Text("\(Int(avg))/\(Int(target))\(unit)")
                .font(KC.Font.dataLabel).foregroundColor(KC.Color.textSecond).frame(width: 90, alignment: .trailing)
        }
    }
}
