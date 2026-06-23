# KetoCast — Build Progress

## Session 1 — Foundation Complete
**Date:** 2026-06-23

---

## What Was Built

### Research Phase ✅
- Completed full competitive analysis (see `RESEARCH.md`)
- Top pain points: paywalling, food DB inaccuracy, logging friction, no electrolyte tracking, no adaptive targets
- Feature gaps identified: Ketosis Confidence Score, Electrolyte-First Dashboard, Adaptive Keto Targets
- Research output: `KetoCast/RESEARCH.md`

### Sprint 1 — Foundation ✅
All Sprint 1 tasks complete:

**Core Architecture:**
- `KetoCast.xcodeproj/project.pbxproj` — full Xcode project file (generated via Python script)
- MVVM architecture with clear separation
- UserDefaults-backed stores (LogStore, WeightStore, MeasurementStore) — offline-first, CoreData ready for migration

**Models:**
- `FoodItem.swift` — full nutrition model with netCarbs computation, calorie validation, DataSource enum
- `FoodLog.swift` — logging model with scaled macros, DailyMacros aggregate, KetosisZone
- `UserProfile.swift` — Mifflin-St Jeor TDEE, macro target calculation, UserDefaults persistence
- `WeightEntry.swift` + `BodyMeasurement.swift`

**Onboarding (5 screens):**
- Screen 1: Goal selection (Lose Weight / Body Recomp / Maintain)
- Screen 2: Activity level (5 options with TDEE multipliers)
- Screen 3: Body stats (sex, age, height, weight, goal weight) with live TDEE preview
- Screen 4: Keto mode (strict/moderate/custom with custom slider)
- Screen 5: Priority metric picker (choose 3 from 8)
- Progress indicator dots with animation

**Home Screen:**
- Animated triple macro ring (Fat/Protein/Net Carbs)
- Stats row (calories, protein, fat)
- Electrolyte card with progress bars (Na/K/Mg with keto-specific targets)
- Expandable meal slots (Breakfast/Lunch/Dinner/Snack)
- Claude-powered coaching nudges card
- Streak card with flame

**Food Logging Sheet (all 4 methods):**
- Search: text search → USDA API → confirm with serving stepper
- Photo: camera capture → GPT-4o vision → multi-item confirm with checkboxes
- Barcode: AVFoundation scanner → OpenFoodFacts → USDA fallback
- Voice: Whisper transcription → GPT-4o food parsing → batch log

**Services:**
- `FoodDatabaseService` — USDA + OpenFoodFacts + actor-based, retry-ready
- `AIVisionService` — GPT-4o photo analysis, structured JSON output
- `VoiceLoggingService` — Whisper + GPT-4o NLP, full recording lifecycle
- `HealthKitService` — read weight/workouts, write nutrition
- `ClaudeCoachingService` — 7-day context, Claude sonnet-4-6, 3 nudge categories
- `NotificationService` — max 3/day rule, smart scheduling

**Analytics Dashboard:**
- Daily: macro bar chart, electrolyte bar chart
- Weekly: net carb bar chart (color-coded zones), weight trend with regression, consistency score, streak grid
- Monthly: 30-day heatmap, average macros vs targets, weight trend
- Ketosis Score hero card (0-100, animated)

**Profile:**
- Macro targets display (computed from Mifflin-St Jeor)
- Body stats card with BMI
- Body measurements grid (6 measurement types)
- Weight log sheet with recent history
- Settings (Apple Health, notifications, reset onboarding)

**Design System:**
- `DesignSystem.swift` — complete KC namespace: colors, fonts, spacing, radii, haptics
- `.kcCard()` ViewModifier
- Full dark theme (`#0A0A0F` background, `#00D9A3` accent green)

**Supporting Files:**
- `Info.plist` — camera, mic, HealthKit, photo library permissions
- `Assets.xcassets` — AppIcon, AccentColor
- `KetoCast.xcdatamodeld` — 3 Core Data entities (CDFoodLog, CDWeightEntry, CDBodyMeasurement)
- `Secrets.plist.template` — API key setup instructions
- `.gitignore` — secrets excluded

---

## Sprint Status
- ✅ Sprint 1 — Foundation
- ✅ Sprint 2 (partial) — Barcode scanner, Core Data schema, macro calculations, weight logging
- ✅ Sprint 3 (partial) — AI photo logging, voice logging, Apple Health integration
- 🔲 Sprint 3 (remaining) — Quick repeat / copy yesterday, smart notifications wiring
- 🔲 Sprint 4 — Analytics polish, animations, AI nudge cards
- 🔲 Sprint 5 — StoreKit 2, settings screen, edge cases, TestFlight

---

## Files Created
```
KetoCast/
├── KetoCast.xcodeproj/project.pbxproj
├── .gitignore
├── KetoCast/
│   ├── App/
│   │   ├── KetoCastApp.swift
│   │   └── AppState.swift
│   ├── Models/
│   │   ├── FoodItem.swift
│   │   ├── FoodLog.swift
│   │   ├── UserProfile.swift
│   │   └── WeightEntry.swift
│   ├── ViewModels/
│   │   ├── DashboardViewModel.swift
│   │   ├── LoggingViewModel.swift
│   │   ├── AnalyticsViewModel.swift
│   │   └── ProfileViewModel.swift
│   ├── Views/
│   │   ├── MainTabView.swift
│   │   ├── Home/HomeView.swift
│   │   ├── Logging/LoggingSheetView.swift
│   │   ├── Analytics/AnalyticsContainerView.swift
│   │   ├── Onboarding/OnboardingContainerView.swift
│   │   └── Profile/ProfileView.swift
│   ├── Services/
│   │   ├── FoodDatabaseService.swift
│   │   ├── AIVisionService.swift
│   │   ├── VoiceLoggingService.swift
│   │   ├── HealthKitService.swift
│   │   ├── ClaudeCoachingService.swift
│   │   └── NotificationService.swift
│   ├── Persistence/
│   │   ├── CoreDataStack.swift
│   │   └── LogStore.swift
│   ├── Utilities/
│   │   ├── SecretsManager.swift
│   │   └── DesignSystem.swift
│   ├── Resources/
│   │   ├── Assets.xcassets/
│   │   └── Secrets.plist.template
│   ├── KetoCast.xcdatamodeld/
│   └── Info.plist
```

---

## Known Issues / Notes
- App is for Mac compilation only — built on Linux (no Xcode compiler available in this env)
- Core Data stack is wired but data stores use UserDefaults for Sprint 1 simplicity; migration path is clean
- HealthKit queries use iOS 17 `HKSampleQueryDescriptor` API — correct for target iOS 17+
- Voice logging VoiceLoggingService uses `AVAudioApplication.shared.recordPermission` (iOS 17 API)
- StoreKit 2 / RevenueCat not yet implemented (Sprint 5)
