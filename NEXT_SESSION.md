# NEXT SESSION — Start Here

## Read First
Read `PROGRESS.md` and `BUILD_STATUS.md` for full context.

## Where We Are
Sprint 1-3 foundation is complete and committed. The app has all major screens and all 4 logging methods. Open `KetoCast/KetoCast.xcodeproj` in Xcode to verify it builds.

## Exact Next Task

### Task A — Fix Build Errors (Do this first, 15 min)
Open the project in Xcode. There will likely be a few compilation errors around:
1. `AVAudioApplication.shared.recordPermission` — if targeting older SDK, replace with `AVAudioSession.sharedInstance().recordPermission`
2. `HKSampleQueryDescriptor` with `.workout(predicate:)` — if this errors, use classic `HKSampleQuery`
3. Any missing imports

Fix errors until `xcodebuild -scheme KetoCast -destination 'platform=iOS Simulator,name=iPhone 16'` succeeds.

### Task B — Quick Repeat / Copy Yesterday (30 min)
In `LoggingSheetView.swift`, in the `SearchLogView`, add a "Copy from Yesterday" section above the search results (when query is empty) showing yesterday's meals by slot. Wire up `vm.copyYesterdayMeal(slot)`.

### Task C — Water Tracking UI (20 min)
In `HomeView.swift`, add a water tracker card below StreakCard:
- Show current oz with a + button (add 8oz at a time)  
- Visual: horizontal fill bar
- Wire to `vm.addWater(oz: 8)`

### Task D — StoreKit 2 Infrastructure (1 hour)
Create `KetoCast/Services/StoreKitService.swift`:
- Define 2 products: `com.ketocast.pro.monthly` ($4.99) and `com.ketocast.pro.yearly` ($39.99)
- Use StoreKit 2 `Product.products(for:)` and `product.purchase()`
- Create `ProGate.swift` — a simple ViewModifier that shows a "Upgrade to Pro" overlay when feature is locked
- Apply ProGate to: MonthlyAnalyticsView, MeasurementsCard (body tracking), CoachingNudgesCard

### Task E — Settings Screen Expansion (30 min)
In `ProfileView.swift`, expand SettingsSection with:
- Profile name editing (TextField inline)
- Units toggle (kg/lbs, cm/inches)
- Keto mode selector
- Notification toggles per type
- Data export button (CSV export of logs)

### Task F — Edge Cases & Empty States (30 min)
Add empty state views:
- Home screen when no food logged yet: "Tap + to log your first meal"
- Analytics when no data: placeholder chart with "Log 3+ days to see trends"
- Weight chart when no entries: "Log your weight to track your trend"

### Task G — Polish & Animations (ongoing)
- Ensure macro ring animation triggers on every `onAppear`, not just first
- Add `.sensoryFeedback` where haptics are called
- Ensure all charts respect `.animation()` on data changes

## After Session
Run `xcodebuild` to confirm build passes, then update PROGRESS.md, NEXT_SESSION.md, and BUILD_STATUS.md before committing.
