import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var showLogging = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $appState.selectedTab) {
                HomeView()
                    .tag(AppState.Tab.home)

                Color.clear                           // log tab is a sheet, not a full tab
                    .tag(AppState.Tab.log)

                AnalyticsContainerView()
                    .tag(AppState.Tab.analytics)

                ProfileView()
                    .tag(AppState.Tab.profile)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            // Override tab tap for .log to present sheet instead of navigating
            .onChange(of: appState.selectedTab) { _, tab in
                if tab == .log {
                    showLogging = true
                    appState.selectedTab = .home
                }
            }

            KCTabBar(selectedTab: $appState.selectedTab, onLogTap: { showLogging = true })
        }
        .background(KC.Color.background)
        .sheet(isPresented: $showLogging) {
            LoggingSheetView()
        }
    }
}

struct KCTabBar: View {
    @Binding var selectedTab: AppState.Tab
    var onLogTap: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            tabButton(.home)
            tabButton(.log)
            tabButton(.analytics)
            tabButton(.profile)
        }
        .padding(.horizontal, KC.Spacing.md)
        .padding(.top, KC.Spacing.xs)
        .padding(.bottom, KC.Spacing.sm)
        .background(KC.Color.surface.opacity(0.95))
        .overlay(Divider().frame(maxHeight: 0.5).background(KC.Color.border), alignment: .top)
    }

    @ViewBuilder
    private func tabButton(_ tab: AppState.Tab) -> some View {
        Button {
            if tab == .log { onLogTap(); KC.impact(.medium) }
            else { selectedTab = tab; KC.impact(.light) }
        } label: {
            VStack(spacing: 4) {
                if tab == .log {
                    ZStack {
                        Circle()
                            .fill(KC.Color.accentGreen)
                            .frame(width: 52, height: 52)
                            .shadow(color: KC.Color.accentGreen.opacity(0.4), radius: 12)
                        Image(systemName: tab.icon)
                            .font(.title2.bold())
                            .foregroundColor(.black)
                    }
                    .offset(y: -12)
                } else {
                    Image(systemName: tab.icon)
                        .font(.system(size: 22))
                        .foregroundColor(selectedTab == tab ? KC.Color.accentGreen : KC.Color.textSecond)
                    Text(tab.label)
                        .font(KC.Font.caption)
                        .foregroundColor(selectedTab == tab ? KC.Color.accentGreen : KC.Color.textSecond)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}
