# Bloom 🌸

A calm, minimal iPhone app for tracking daily goals and building habits, with a home-screen and lock-screen widget that shows today's progress and lets you check goals off without opening the app.

## Features

- **Today view.** A progress ring for the day, a 7-day strip, and soft goal cards. Tap a card to check in. Press and hold a card to edit it, undo a check-in, or delete it.
- **Flexible goals.** Pick an emoji and a color for each goal, set a daily target (for example "8 glasses"), and choose which days of the week it repeats.
- **Streaks.** Each goal has its own streak, plus a streak for "perfect days" when you finish everything. A day you haven't finished yet doesn't break a streak.
- **Insights.** Current and best streaks, your 30-day completion rate, a 12-week heatmap, and a breakdown for each goal.
- **Widgets.**
  - Home screen: small (progress ring), medium, and large (ring plus a goal list with check buttons you can tap).
  - Lock screen: circular gauge, rectangular, and inline.
  - The widget resets at midnight and updates as soon as you check something off.
- **Light and dark mode.** The interface uses a warm, muted palette with serif headings.

Your data stays on your phone. It is stored in a shared App Group so the app and the widget see the same goals.

## Run it on your iPhone

You need a Mac with **Xcode 16 or newer** and an iPhone on **iOS 17 or newer**. A free Apple ID is enough.

1. Open `Bloom/Bloom.xcodeproj` in Xcode.
2. Click the blue **Bloom** project at the top of the file list, select the **Bloom** project (not a target), and open **Build Settings**. Search for `BUNDLE_ID_PREFIX` and change `com.example` to something unique, such as `com.yourname`.
3. Go to **Signing & Capabilities** for both the **Bloom** target and the **BloomWidgetExtension** target, and choose your **Team**. Sign in under Xcode → Settings → Accounts if needed. Xcode registers the App Group (`group.<prefix>.bloom`) automatically.
4. Plug in your iPhone, select it as the run destination, and press **⌘R**.
   - The first time, turn on **Settings → Privacy & Security → Developer Mode** on the iPhone.
   - Then trust your developer certificate under **Settings → General → VPN & Device Management**.
5. To add the widget, long-press your home screen, tap **Edit → Add Widget**, search for **Bloom**, and pick a size. For the lock screen, long-press the lock screen and choose **Customize**.

> If you use a free Apple ID, apps you install yourself expire after 7 days. Press ⌘R again to reinstall; your data is kept. A paid Apple Developer account removes this limit.

## Project layout

```
Bloom/
├── Bloom/            App target: SwiftUI screens, GoalStore, asset catalog
├── BloomWidget/      Widget extension: timeline provider and widget views
├── Shared/           Compiled into both targets: data model, storage, theme, the intent behind the check buttons
└── Config/           Info.plists and entitlements (App Group)
```

The project uses Xcode's folder-synced groups, so any new `.swift` file you put in one of these folders is added to the build automatically.
