# KetoCast: User Pain Points & Competitive Gap Research

*Research compiled: June 2026 | Sources: App store reviews, Trustpilot, BBB, PissedConsumer, review aggregators, and product analysis blogs*

---

## Executive Summary

The keto nutrition tracking market is dominated by MyFitnessPal (general), Carb Manager (keto-specific), Cronometer (micronutrient depth), and Lose It! (general weight loss). All four share a common set of structural weaknesses: aggressive paywalling of core features, database accuracy problems, logging friction, and lack of meaningful keto-specific metabolic insight. The user exodus is real — MyFitnessPal's free-tier user retention dropped an estimated 34% YoY after locking basic features behind premium, and alternatives searches for every major app are at all-time highs in 2025-2026.

KetoCast has a clear opportunity to enter as the app that does fewer things but does them exceptionally — built keto-first, not keto-bolted-on.

---

## Part 1: Top 10 User Pain Points (Ranked by Frequency)

### #1 — Aggressive Paywalling of Core Features
**Frequency: Extremely High | Apps: MyFitnessPal, Lose It!, Cronometer**

This is the single most cited reason users abandon or rage-quit nutrition apps. MyFitnessPal moved the barcode scanner — its single most-used feature — behind a $79.99/year paywall. Macro tracking, once free, is now locked in Lose It! Cronometer's free tier is disrupted by full-screen video ads that "hijack the app for up to half a minute," appearing mid-logging-session.

**Pricing context (2026):**
- MyFitnessPal Premium: $79.99/year or $19.99/month (more expensive than Netflix Basic)
- MyFitnessPal Premium+: $99.99/year or $24.99/month
- Carb Manager Premium: $59.99/year
- Lose It! Premium: ~$39.99/year

*User sentiment pattern:* "I paid for an annual membership and couldn't access the app when they released a new version incompatible with my phone." (BBB complaint) / "They've removed the cancellation option from the website." (PissedConsumer)

**KetoCast implication:** A generous free tier — specifically free barcode scanning and free net carb tracking — is a direct competitive wedge. Users are primed to switch.

---

### #2 — Food Database Inaccuracy & Duplicate Entries
**Frequency: Very High | Apps: MyFitnessPal (worst), Carb Manager, Lose It!**

The core problem is structural: MyFitnessPal's database was built from user submissions, not curated nutrition data. This creates:
- **Human entry errors**: A protein bar scanning as 180 cal / 10g protein when the label shows 230 cal / 20g protein — a 27% calorie gap from a single scan
- **Outdated product data**: Manufacturers reformulate products; barcodes stay the same; database entries never update
- **Duplicate entries**: 5-20 entries for the same item, with calorie counts varying 20-40% across duplicates — the app defaults to "most popular," not most accurate
- **Regional mismatches**: A UK product barcode returning US nutrition facts with different macro profiles

Carb Manager users specifically report "insanely inaccurate carb totals" with keto-friendly items showing very high values, undermining the core function of a keto tracker.

**KetoCast implication:** A nutritionist-verified database (even if smaller to start) beats a massive inaccurate one. Cronometer's use of USDA/government data is the gold standard. For keto, accurate net carb calculation is non-negotiable.

---

### #3 — Logging Friction (Too Many Taps, Too Much Time)
**Frequency: Very High | Apps: All**

Industry data point: If logging a meal takes more than 30 seconds, most users abandon the app within two weeks. This is the primary churn driver across all nutrition apps.

Specific UX failures cited:
- MyFitnessPal's April 2026 redesign buried the food diary behind additional button taps and made the macro breakdown harder to find
- Lose It! moved calendar navigation from a one-tap action at the top of the screen to a three-step dropdown at the bottom
- Recipe logging in Cronometer is widely described as "clunky"
- Carb Manager removed the back button and hid the scan button in a menu

**KetoCast implication:** The logging flow is the product. Every screen between "I just ate something" and "logged" is a retention risk. Target sub-20-second logging for common meals via quick-add, barcode, recent meals, and AI photo recognition.

---

### #4 — No Meaningful Electrolyte Tracking
**Frequency: High | Apps: All except Carb Manager (partial) and SaltStack (standalone)**

Electrolyte management is non-negotiable on keto — when you restrict carbs, you excrete more sodium and potassium through urine. The standard keto recommendations are:
- Sodium: 3,000–5,000 mg/day
- Potassium: 1,000 mg/day
- Magnesium: 300–400 mg/day

Most general nutrition apps track sodium (because it's on every nutrition label) but ignore potassium and magnesium as first-class keto metrics. SaltStack exists as a standalone electrolyte app precisely because no major tracker handles this well. Users are running two apps — a tracker and SaltStack — when they should need one.

**KetoCast implication:** A dedicated electrolyte dashboard with keto-specific targets (not generic RDA values) is a feature gap no major app has closed. This should be surfaced on the daily dashboard, not buried in settings.

---

### #5 — No Adaptive Calorie/Macro Targeting
**Frequency: High | Apps: All except MacroFactor (non-keto-specific) and MyNetDiary (partial)**

Every major app sets static calorie targets based on a TDEE formula (age, weight, height, activity level) and never adjusts them. The reality: actual metabolic rate varies from the estimate by 10-20% across individuals, and keto dieters frequently hit weight loss plateaus because their targets were never recalibrated.

MacroFactor (a general fitness app, not keto-specific) stands out by using an adaptive TDEE algorithm that:
1. Starts with a population-based estimate
2. Recalculates weekly based on logged calories AND actual weight trend
3. Produces refined targets that reflect real metabolic response

MacroFactor's algorithm typically needs 2-3 weeks of consistent data to become reliable. MyNetDiary has an "Autopilot" feature that attempts something similar for plateau-breaking.

**KetoCast implication:** Keto users disproportionately care about plateaus because the diet is strict — they're sacrificing carbs and want results. An adaptive system that adjusts net carb, protein, and fat targets based on real weight trend data (not just a formula) would be a first for a dedicated keto app.

---

### #6 — Poor (or Zero) Ketosis-State Visibility
**Frequency: High | Apps: All**

No major app proactively tells a user whether they are likely in ketosis based on their logged data. Users have to infer it from net carb totals, and even then they get no guidance on whether their specific food choices (type of fat, protein level, hidden carbs) are affecting ketosis.

Advanced tracking via the Glucose Ketone Index (GKI) — a ratio of blood glucose to blood ketones — is the clinical gold standard for measuring ketosis depth, but:
- Keto-Mojo's app only works with their proprietary hardware meter
- Carb Manager tracks GKI but only if you manually input glucose and ketone readings
- No app integrates GKI education, targets, and tracking natively without hardware dependency

**KetoCast implication:** A "Ketosis Confidence Score" (derived from logged net carbs, protein ratio, and user history) that doesn't require blood testing would serve the majority of users who aren't using a Keto-Mojo. For power users, Apple Health integration to pull CGM data (Dexcom, Libre) closes the loop.

---

### #7 — Subscription Customer Service Black Holes
**Frequency: High | Apps: MyFitnessPal, Lose It!, Carb Manager**

A recurring theme across BBB and Trustpilot complaints: users cannot cancel, cannot reach anyone, and get charged after believing they cancelled.

- MyFitnessPal has no customer service phone number; one BBB complaint describes a "fake number that has been disconnected"
- Lose It!'s support "runs users in loops" with no live chat or phone
- Users report being charged renewal fees they believed were cancelled — including cases of children being charged for accidental premium purchases with refund requests denied

**KetoCast implication:** Transparent subscription management (in-app cancellation, clear renewal reminders, instant email confirmation) is a trust signal. Apple's native in-app purchase system handles most of this; the design decision is to lean into App Store subscription management rather than building a bespoke billing system.

---

### #8 — No Net Carbs vs. Total Carbs Clarity by Default
**Frequency: Moderate-High | Apps: MyFitnessPal, general trackers**

For keto, the distinction between net carbs (total carbs minus fiber and sugar alcohols) and total carbs is the difference between being in ketosis and not. MyFitnessPal and general trackers default to total carbs, forcing keto users to do manual math or configure workarounds.

Keto-specific apps (Carb Manager, Keto.app) get this right — net carbs front and center. But the problem recurs when users log restaurant meals or generic items where fiber data is missing, defaulting to a worst-case total carb figure that discourages compliant food choices.

**KetoCast implication:** Net carbs must be the primary macro displayed everywhere in the app — logging screen, dashboard, search results, meal detail. Total carbs should be accessible but secondary. When fiber data is missing, the app should flag this explicitly rather than silently inflating the net carb count.

---

### #9 — Useless or Absent Progress Visualization
**Frequency: Moderate | Apps: MyFitnessPal (post-redesign), general trackers**

Users report that progress charts are either buried, require premium, or show raw numbers without context. The April 2026 MyFitnessPal redesign made macro breakdowns harder to find. Cronometer's depth is praised but the UI complexity overwhelms casual users.

Research finding: "Raw numbers are exhausting; apps in 2026 focus on clarity, progress bars, visual summaries, and intuitive dashboards — good visualization helps users decide faster." Apps that integrate wearables and show biometric data alongside food data achieve 25% better subscription conversion rates.

**KetoCast implication:** A daily "keto status at a glance" view — net carbs used vs. budget, electrolyte fill rates, fat/protein balance, and a rolling weight trend — should be the home screen. Numbers should be contextualized ("You're 12g under your net carb target — strong keto day") not just displayed raw.

---

### #10 — No Meaningful Keto-Specific Education or Guidance In-App
**Frequency: Moderate | Apps: All**

Keto is a metabolic diet with specific nuances (the importance of fat quality, protein's gluconeogenic threshold, electrolyte timing, the "keto flu" transition). No major app contextualizes the user's data within this framework. Users logging 50g of net carbs are not told "you're above the 20-50g ketosis threshold." Users hitting the keto flu symptoms have no in-app resource connecting their electrolyte deficit to their symptoms.

**KetoCast implication:** Smart, contextual nudges tied to actual logged data ("Your sodium is 1,400mg today — keto targets are 3,000-5,000mg. Low sodium on keto can cause headaches and fatigue.") create value that no general tracker can replicate.

---

## Part 2: Three Feature Gaps KetoCast Can Own

### Gap 1: The Keto Metabolic Intelligence Layer

**What exists:** Apps track macros and show totals. No app interprets the data through a keto lens and communicates what it means for ketosis state.

**What KetoCast can build:**
- A **Ketosis Confidence Indicator** (daily score 1-10) calculated from: net carbs logged, protein-to-fat ratio, electrolyte levels, consistency streak, and weight trend direction. No blood testing required for a baseline score.
- **Apple Health / CGM integration** (Dexcom, Libre via HealthKit) to pull glucose data for users who test — automatically calculating GKI when both glucose and ketone data exist
- **Weekly metabolic report**: "Your average net carbs were 18g this week. Based on your weight trend (-0.8 lbs), your estimated TDEE is 2,050 cal — adjusting your targets by -75 cal."

**Why competitors can't quickly copy it:** Carb Manager's metabolic features (GKI, glucose tracking) exist but are buried in premium and require manual data entry. Building a native iOS app with HealthKit integration from day one, designed around this feature, creates a structural advantage.

**Differentiating claim:** "KetoCast is the first keto app that tells you if your diet is actually working — not just what you ate."

---

### Gap 2: Electrolyte-First Dashboard

**What exists:** SaltStack exists as a standalone app (meaning users run two apps). Carb Manager tracks electrolytes as a buried micronutrient, not a first-class keto feature.

**What KetoCast can build:**
- **Electrolyte Dashboard** as a primary tab (not a settings page), showing: sodium, potassium, magnesium, and calcium fill rates against keto-specific targets (not generic RDA values)
- **Food-to-electrolyte mapping**: When a user logs avocado, the app highlights its potassium contribution proactively ("Added 485mg potassium — 49% of your keto daily target")
- **Electrolyte supplement logging**: Dedicated quick-log entries for common supplements (LMNT, Liquid IV, salt in water) with pre-populated electrolyte values
- **Contextual warnings**: "You're at 800mg sodium at 6pm. On keto, low sodium causes muscle cramps and fatigue. Consider adding a pinch of salt to water."

**Why this gap is real:** SaltStack has a rating but minimal user base. The users running SaltStack alongside Carb Manager or MyFitnessPal represent the addressable market. Eliminating that second app is a concrete value proposition.

**Differentiating claim:** "The only keto tracker built around the electrolytes your body actually needs."

---

### Gap 3: Adaptive Keto Targets (No More Static Formulas)

**What exists:** MacroFactor uses adaptive TDEE for general fitness users. No keto-specific app has implemented this. MyNetDiary's "Autopilot" is rudimentary.

**What KetoCast can build:**
- **Weekly target recalibration**: After 2 weeks of logging, use actual weight trend + logged calorie data to recalculate real TDEE (MacroFactor's approach, applied to keto macro ratios)
- **Plateau detection and response**: If weight has been flat for 10+ days while in compliance, suggest specific adjustments — not generic ("eat less") but keto-specific: increase fat, reduce protein to prevent gluconeogenesis, try a targeted carb refeed window, or add intermittent fasting
- **Macro ratio adjustment**: As users hit maintenance or shift goals (fat loss → body recomposition), the app adjusts the fat/protein/net carb split automatically with an explanation

**Implementation note:** This requires consistent weighing (daily or near-daily). The app should make weigh-in as frictionless as possible — ideally reading from Apple Health (body mass from a Bluetooth scale) without any manual entry.

**Differentiating claim:** "KetoCast adapts to your body — your targets change as your metabolism does."

---

## Part 3: Personalization Approach Recommendation

### Philosophy: Progressive Disclosure of Complexity

Keto users span a wide range — from someone who just watched a documentary and wants to try 30 days of low-carb, to a biohacker tracking GKI daily with a CGM. A single onboarding flow cannot serve both. The recommended approach:

**Tier 1 — Simple Mode (default)**
- Daily net carb budget (default: 20g for ketosis induction)
- Barcode scanner + AI photo logging
- Electrolyte fill meter (sodium, potassium, magnesium)
- Weight trend graph

*Who it serves:* Keto beginners, users migrating from MyFitnessPal who want simplicity without losing macros

**Tier 2 — Adaptive Mode (unlocked after 2 weeks)**
- TDEE calibration using logged data
- Macro ratio recommendations (protein upper bound to prevent gluconeogenesis)
- Plateau detection with specific intervention suggestions
- Intermittent fasting window integration

*Who it serves:* Users 2-4 weeks in who have established a baseline and want the app to start working harder for them

**Tier 3 — Metabolic Mode (optional toggle)**
- GKI tracking (manual entry or Apple Health pull)
- CGM integration (Dexcom, Libre via HealthKit)
- Glucose response logging correlated with meals
- Full micronutrient panel (Cronometer-style depth)

*Who it serves:* Power users, therapeutic keto (epilepsy, metabolic disease), Type 2 diabetics using keto for glucose control

### Onboarding Flow Recommendation

1. **Goal selection** (weight loss / maintenance / therapeutic / athletic performance) — determines default macro split
2. **Experience level** (new to keto / returning / experienced) — sets initial net carb target (20g for new, configurable for experienced)
3. **One metric commitment** ("What will you track consistently?" — weight only / food only / both) — sets app expectations
4. **Apple Health permission** — pull existing body weight data to skip manual historical entry
5. **Electrolyte supplement check** ("Do you take any electrolyte supplements?") — pre-populates common supplement entries

**Avoid:** Long questionnaires about specific foods to avoid (allergy/preference filtering) at onboarding. This is a common friction point. Let the food database handle this through filtering options discovered naturally.

---

## Part 4: Key Metrics to Track for Keto Success

### In-App Metrics (User-Facing)

| Metric | Target/Threshold | Display Priority |
|--------|-----------------|-----------------|
| Daily Net Carbs | <20g (induction) / <50g (maintenance) | Primary — home screen, always visible |
| Net Carb Budget Remaining | Dynamic | Primary — persistent display |
| Protein Intake | 0.7–1.0g per lb lean body mass | Secondary — daily summary |
| Fat Intake | Remaining calories from fat | Secondary — daily summary |
| Sodium | 3,000–5,000 mg/day | Primary — electrolyte dashboard |
| Potassium | 1,000 mg/day | Primary — electrolyte dashboard |
| Magnesium | 300–400 mg/day | Primary — electrolyte dashboard |
| Body Weight Trend | 7-day rolling average | Primary — progress screen |
| Logging Streak | Days consecutive | Engagement — home screen badge |
| Ketosis Confidence Score | 1-10 based on compliance | Secondary — daily summary |

### Metabolic Metrics (Power Users)

| Metric | Notes |
|--------|-------|
| TDEE (Adaptive) | Calculated from weight trend + logged calories, not formula |
| Estimated Total Carbs vs. Net Carbs | For users eating high-fiber foods where the gap matters |
| Glucose Ketone Index (GKI) | Requires manual entry or CGM integration |
| Blood Ketone Level | Manual entry, mmol/L |
| Blood Glucose Level | Manual entry or CGM pull |
| Glycemic Load | For users managing blood sugar |

### App Performance / Product Metrics (Internal, for KetoCast team)

| Metric | Why It Matters |
|--------|---------------|
| Day 7 retention | Leading indicator of habit formation |
| Day 30 retention | Inflection point: habitual users vs. trial users |
| Logging sessions per day | Tracks friction — target 2-3 sessions (breakfast, lunch, dinner) |
| Time-to-log per meal | Target: <30 seconds; above 60 seconds is a churn signal |
| Barcode scan success rate | Indicates database coverage quality |
| Weigh-in frequency | Predictor of adaptive algorithm engagement |
| Electrolyte dashboard open rate | Validates Gap #2 as a valued feature |
| Trial-to-paid conversion | Key monetization health metric |
| Week-2 retention after plateau-detection trigger | Validates Gap #3 feature value |

---

## Part 5: Visual Design Direction Notes

### Overall Aesthetic Direction: "Clinical Clarity with Warmth"

**The problem to solve:** Keto apps either look like generic fitness apps (lots of green, generic iconography) or they feel sterile and medical. Neither creates the emotional connection that drives daily habit use. The design should feel like a tool built by someone who actually does keto — warm, purposeful, not gym-bro.

### Color System

- **Primary palette:** Deep slate (#1C2130) with warm amber/gold accents (#F5A623) — amber references ketone bodies and fat-burning, avoids the saturated "diet app green" cliche
- **Accent colors for macro rings:** Fat (gold), Protein (coral/terracotta), Net Carbs (blue/teal) — carbs in blue creates a subconscious "cool, limited" association vs. the danger-red many apps use
- **Electrolyte indicators:** Use distinct subtle colors (sodium = blue, potassium = purple, magnesium = green) — consistent color coding makes the dashboard scannable at a glance
- **Dark mode first:** Design dark mode as the primary experience, light mode as the adaptation. iPhone OLED screens benefit from true-black backgrounds; keto users often log at night. iOS's Liquid Glass design language (introduced 2025) supports translucent, depth-layered dark interfaces.

### Typography and Hierarchy

- Large, bold net carb number on the home screen (this is the number users care most about) — should be readable at a glance, not buried in a grid
- Secondary metrics in smaller weight, creating clear visual hierarchy
- Avoid walls of numbers — use fill rings, progress arcs, and bar charts to communicate status without number-reading

### Key Screen Design Principles

**Home Screen / Dashboard**
- The "one number" rule: net carbs remaining must be immediately parseable without any reading or interpretation
- Electrolyte fill bars below the macro ring — not a separate tab, but visible on scroll without a tap
- Weight trend as a sparkline (7-day rolling), not a full chart requiring a tap

**Logging Screen**
- Barcode scan should be the first action (largest tap target) — not buried in a menu
- Recent meals and frequent foods above search — most meals are repeats
- AI photo button equally prominent — two primary input modes, not one primary and one buried

**Progress Screen**
- Weight trend as a smooth rolling average line (7-day), not daily raw weigh-ins (too noisy, psychologically damaging for normal fluctuations)
- Net carb compliance rate (percentage of days under target, rolling 30-day) — more motivating than a single weigh-in
- Streak visualization as the primary gamification element

### Interaction Design Notes

- Haptic feedback on milestone completions (hitting net carb goal for the day, logging streak achievements)
- No mandatory onboarding walkthrough beyond the 5-question flow — let users explore
- Empty states should be instructive: an empty food log should show a prominent scan button and "What did you eat?" — not a blank screen
- Apple Watch complication: net carbs remaining + electrolyte warning if sodium is critically low — a daily passive touchpoint that reinforces the habit loop

---

## Sources Consulted

- [MyFitnessPal BBB Complaints](https://www.bbb.org/us/ca/san-francisco/profile/online-shopping/myfitnesspal-1116-539525/complaints)
- [MyFitnessPal PissedConsumer Reviews (129 reviews, 1.5 stars)](https://myfitnesspal.pissedconsumer.com/review.html)
- [MyFitnessPal Trustpilot Reviews](https://www.trustpilot.com/review/www.myfitnesspal.com)
- [Why Did MyFitnessPal Increase Their Price? — Nutrola](https://nutrola.app/en/blog/why-did-myfitnesspal-increase-their-price)
- [MyFitnessPal New Update Complaints — PiunikaWeb (April 2026)](https://piunikaweb.com/2026/04/24/myfitnesspal-new-update-complaints/)
- [MyFitnessPal Barcode Scanner Accuracy — Nutrola](https://nutrola.app/en/blog/myfitnesspal-barcode-scanner-not-accurate-better-options-2026)
- [Carb Manager Review 2026 — CalorieScan AI](https://www.caloriescanai.com/blog/carb-manager-keto-app-review)
- [Carb Manager Reviews — JustUseApp](https://justuseapp.com/en/app/410089731/carb-manager-keto-diet-app/reviews)
- [Carb Manager — Garage Gym Reviews](https://www.garagegymreviews.com/equipment/carb-manager)
- [Cronometer Review 2026 — Marlvel AI Sentiment Analysis](https://marlvel.ai/intel-report/health-fitness/cronometer-calorie-counter)
- [Cronometer Alternatives — Hoot Fitness](https://www.hootfitness.com/blog/cronometer-alternatives-find-the-best-fit-for-your-tracking-style)
- [Lose It! Trustpilot Reviews](https://www.trustpilot.com/review/loseit.com)
- [Lose It! BBB Complaints](https://www.bbb.org/us/ma/boston/profile/mobile-apps/lose-it-0021-188207/complaints)
- [MacroFactor Algorithms and Core Philosophy — Stronger by Science](https://www.strongerbyscience.com/macrofactor-algorithms-philosophy/)
- [MacroFactor Algorithm Accuracy](https://macrofactorapp.com/algorithm-accuracy/)
- [MacroFactor Review 2026 — TryGaya](https://www.trygaya.com/review/macrofactor-review)
- [SaltStack — Electrolyte Tracking App](https://saltstackapp.com/)
- [Electrolytes on Keto — Perfect Keto](https://perfectketo.com/electrolytes-on-keto/)
- [GKI / Glucose Ketone Index — Keto-Mojo](https://keto-mojo.com/glucose-ketone-index-gki/)
- [Best Keto Diet Apps 2026 — Eat This Much Blog](https://blog.eatthismuch.com/best-keto-diet-apps/)
- [Net Carbs vs Total Carbs — Carb Manager](https://help.carbmanager.com/docs/track-total-carbs-net-carbs-or-diabetes-carbs)
- [Health & Fitness App Benchmarks 2026 — Business of Apps](https://www.businessofapps.com/data/health-fitness-app-benchmarks/)
- [Diet and Nutrition Apps Statistics — Market.us](https://media.market.us/diet-and-nutrition-apps-statistics/)
- [Free Calorie Tracking Apps (No Subscription) 2026](https://www.amyfoodjournal.com/blog/free-calorie-tracking-apps-no-subscription)
- [Best MyFitnessPal Alternatives 2026 — Vora Blog](https://askvora.com/blog/best-myfitnesspal-alternatives-2026)
- [iOS App Design Trends 2025 — Tapptitude](https://tapptitude.com/blog/i-os-app-design-guidelines-for-2025)
- [Mobile App Design Trends 2026 — QicApp / Medium](https://medium.com/@qicapp/10-latest-mobile-app-design-trends-to-follow-in-2026-48ab43e1433a)
