import SwiftUI

struct GoalEditorView: View {
    @EnvironmentObject private var store: GoalStore
    @Environment(\.dismiss) private var dismiss

    private let isNew: Bool
    @State private var goal: Goal
    @State private var confirmingDelete = false

    private static let emojiChoices = [
        "💧", "🌿", "📖", "✍️", "🌙", "🧘", "🏃", "🍎",
        "💪", "🥗", "☀️", "🎧", "🪴", "🧠", "💤", "🚶",
        "🎨", "🎹", "📵", "🙏", "🦷", "💊", "🧹", "💌",
    ]

    init(goal: Goal?) {
        isNew = goal == nil
        _goal = State(initialValue: goal ?? Goal(
            title: "",
            emoji: Self.emojiChoices.randomElement()!,
            color: GoalColor.allCases.randomElement()!
        ))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        Text(goal.emoji)
                            .font(.system(size: 30))
                            .frame(width: 56, height: 56)
                            .background(goal.color.wash, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        TextField("e.g. Stretch for 5 minutes", text: $goal.title)
                            .font(Theme.body(18, weight: .medium))
                    }
                    .padding(.vertical, 4)
                }

                Section("Icon") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 8), spacing: 10) {
                        ForEach(Self.emojiChoices, id: \.self) { emoji in
                            Text(emoji)
                                .font(.system(size: 22))
                                .frame(width: 36, height: 36)
                                .background(
                                    Circle().fill(goal.emoji == emoji ? goal.color.wash : .clear)
                                )
                                .onTapGesture { goal.emoji = emoji }
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Color") {
                    HStack {
                        ForEach(GoalColor.allCases) { color in
                            Circle()
                                .fill(color.color)
                                .frame(width: 30, height: 30)
                                .overlay {
                                    if goal.color == color {
                                        Circle().stroke(Theme.ink.opacity(0.7), lineWidth: 2).padding(-4)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .onTapGesture { goal.color = color }
                        }
                    }
                    .padding(.vertical, 6)
                }

                Section {
                    Stepper(value: $goal.target, in: 1...50) {
                        HStack {
                            Text("Times per day")
                            Spacer()
                            Text("\(goal.target)")
                                .foregroundStyle(Theme.mutedInk)
                        }
                    }
                    if goal.target > 1 {
                        TextField("Unit (e.g. glasses, pages)", text: $goal.unit)
                    }
                } header: {
                    Text("Daily target")
                } footer: {
                    Text("Tap a goal once for each time you do it.")
                }

                Section("Repeat on") {
                    WeekdayPicker(selection: $goal.weekdays)
                        .padding(.vertical, 4)
                }

                if !isNew {
                    Section {
                        Button("Delete goal", role: .destructive) { confirmingDelete = true }
                    }
                }
            }
            .font(Theme.body(16))
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle(isNew ? "New goal" : "Edit goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        goal.title = goal.title.trimmingCharacters(in: .whitespacesAndNewlines)
                        goal.unit = goal.target > 1 ? goal.unit.trimmingCharacters(in: .whitespaces) : ""
                        store.save(goal)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(goal.title.trimmingCharacters(in: .whitespaces).isEmpty || goal.weekdays.isEmpty)
                }
            }
            .confirmationDialog("Delete \(goal.title)?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("Delete goal and its history", role: .destructive) {
                    store.delete(goal)
                    dismiss()
                }
            }
        }
        .presentationDragIndicator(.visible)
    }
}

private struct WeekdayPicker: View {
    @Binding var selection: Set<Int>

    var body: some View {
        let symbols = Calendar.current.veryShortWeekdaySymbols
        let first = Calendar.current.firstWeekday
        let ordered = (0..<7).map { (first - 1 + $0) % 7 + 1 }

        HStack(spacing: 6) {
            ForEach(ordered, id: \.self) { day in
                let isOn = selection.contains(day)
                Text(symbols[day - 1])
                    .font(Theme.body(14, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 36)
                    .foregroundStyle(isOn ? Color.white : Theme.mutedInk)
                    .background(Circle().fill(isOn ? Theme.accent : Theme.track))
                    .onTapGesture {
                        if isOn { selection.remove(day) } else { selection.insert(day) }
                    }
            }
        }
    }
}
