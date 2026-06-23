import SwiftUI
import AVFoundation

struct LoggingSheetView: View {
    @StateObject private var vm = LoggingViewModel()
    @StateObject private var voiceVM = VoiceLoggingService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var activeMethod: LogMethod = .search
    @State private var showCamera = false
    @State private var showBarcode = false
    @State private var capturedImage: UIImage?

    enum LogMethod: CaseIterable {
        case search, photo, barcode, voice
        var label: String {
            switch self { case .search: return "Search"; case .photo: return "Photo"; case .barcode: return "Scan"; case .voice: return "Voice" }
        }
        var icon: String {
            switch self { case .search: return "magnifyingglass"; case .photo: return "camera.fill"; case .barcode: return "barcode.viewfinder"; case .voice: return "mic.fill" }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                KC.Color.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    // Method picker
                    methodPicker
                        .padding(.top, KC.Spacing.sm)

                    // Meal slot
                    mealSlotPicker
                        .padding(.horizontal, KC.Spacing.md)
                        .padding(.vertical, KC.Spacing.sm)

                    Divider().background(KC.Color.border)

                    // Content area
                    Group {
                        switch activeMethod {
                        case .search:  SearchLogView(vm: vm)
                        case .photo:   PhotoLogView(vm: vm)
                        case .barcode: BarcodeLogView(vm: vm)
                        case .voice:   VoiceLogView(vm: vm)
                        }
                    }
                }
            }
            .navigationTitle("Log Food")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundColor(KC.Color.accentGreen)
                }
            }
        }
    }

    private var methodPicker: some View {
        HStack(spacing: 0) {
            ForEach(LogMethod.allCases, id: \.self) { method in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { activeMethod = method }
                    KC.impact(.light)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: method.icon)
                            .font(.system(size: 18))
                        Text(method.label)
                            .font(KC.Font.caption)
                    }
                    .foregroundColor(activeMethod == method ? KC.Color.accentGreen : KC.Color.textSecond)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, KC.Spacing.sm)
                    .background(
                        activeMethod == method ?
                        KC.Color.accentGreen.opacity(0.12) : Color.clear
                    )
                    .clipShape(RoundedRectangle(cornerRadius: KC.Radius.tag))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, KC.Spacing.md)
    }

    private var mealSlotPicker: some View {
        HStack(spacing: KC.Spacing.xs) {
            Text("Meal:")
                .font(KC.Font.caption)
                .foregroundColor(KC.Color.textSecond)
            ForEach(FoodLog.MealSlot.allCases, id: \.self) { slot in
                Button {
                    vm.selectedMealSlot = slot
                    KC.impact(.light)
                } label: {
                    Text(slot.rawValue)
                        .font(KC.Font.caption.bold())
                        .foregroundColor(vm.selectedMealSlot == slot ? .black : KC.Color.textSecond)
                        .padding(.horizontal, KC.Spacing.sm)
                        .padding(.vertical, KC.Spacing.xxs)
                        .background(vm.selectedMealSlot == slot ? KC.Color.accentGreen : KC.Color.card)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Search Log View
struct SearchLogView: View {
    @ObservedObject var vm: LoggingViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(KC.Color.textSecond)
                TextField("Search foods...", text: $vm.searchQuery)
                    .foregroundColor(KC.Color.textPrimary)
                    .autocorrectionDisabled()
                    .onChange(of: vm.searchQuery) { _, _ in vm.search() }
                if vm.isSearching {
                    ProgressView().tint(KC.Color.accentGreen)
                }
            }
            .padding(KC.Spacing.sm)
            .background(KC.Color.card)
            .clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
            .padding(KC.Spacing.md)

            // Results
            if let item = vm.pendingItem {
                FoodConfirmView(item: item, quantity: $vm.quantity, onConfirm: {
                    vm.confirmLog()
                }, onCancel: { vm.pendingItem = nil })
                .padding(.horizontal, KC.Spacing.md)
            } else {
                List {
                    if !vm.searchQuery.isEmpty {
                        ForEach(vm.searchResults) { item in
                            FoodResultRow(item: item)
                                .listRowBackground(KC.Color.surface)
                                .onTapGesture { vm.pendingItem = item; KC.impact(.light) }
                        }
                    } else {
                        Section("Recent") {
                            ForEach(vm.recentItems) { item in
                                FoodResultRow(item: item)
                                    .listRowBackground(KC.Color.surface)
                                    .onTapGesture { vm.pendingItem = item; KC.impact(.light) }
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
    }
}

struct FoodResultRow: View {
    let item: FoodItem

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(item.name)
                        .font(KC.Font.bodySmall.bold())
                        .foregroundColor(KC.Color.textPrimary)
                    if item.isVerified {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.caption2)
                            .foregroundColor(KC.Color.accentGreen)
                    }
                }
                if let brand = item.brand {
                    Text(brand)
                        .font(KC.Font.caption)
                        .foregroundColor(KC.Color.textSecond)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(Int(item.netCarbs))g net")
                    .font(KC.Font.dataLabel)
                    .foregroundColor(KC.Color.accentAmber)
                Text("\(Int(item.calories)) kcal")
                    .font(KC.Font.caption)
                    .foregroundColor(KC.Color.textSecond)
            }
        }
        .padding(.vertical, KC.Spacing.xs)
    }
}

struct FoodConfirmView: View {
    let item: FoodItem
    @Binding var quantity: Double
    var onConfirm: () -> Void
    var onCancel: () -> Void

    var scaledCalories: Double { item.calories * quantity }
    var scaledNetCarbs: Double { item.netCarbs * quantity }
    var scaledProtein: Double  { item.protein  * quantity }
    var scaledFat: Double      { item.fat      * quantity }

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            HStack {
                VStack(alignment: .leading) {
                    Text(item.name)
                        .font(KC.Font.displaySmall)
                        .foregroundColor(KC.Color.textPrimary)
                    if let brand = item.brand {
                        Text(brand).font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                    }
                    Text("per \(String(format:"%.0f",item.servingSize))\(item.servingUnit)")
                        .font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                }
                Spacer()
                Button(action: onCancel) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(KC.Color.textSecond)
                }
            }

            // Macro preview
            HStack(spacing: KC.Spacing.md) {
                macroChip(label: "Net Carbs", value: "\(String(format:"%.1f",scaledNetCarbs))g", color: KC.Color.accentAmber)
                macroChip(label: "Protein",   value: "\(String(format:"%.1f",scaledProtein))g",  color: KC.Color.accentBlue)
                macroChip(label: "Fat",       value: "\(String(format:"%.1f",scaledFat))g",       color: KC.Color.accentGreen)
                macroChip(label: "Calories",  value: "\(Int(scaledCalories))", color: KC.Color.textPrimary)
            }

            // Quantity stepper
            HStack {
                Text("Servings")
                    .font(KC.Font.bodySmall)
                    .foregroundColor(KC.Color.textSecond)
                Spacer()
                HStack(spacing: KC.Spacing.sm) {
                    Button { if quantity > 0.25 { quantity = round((quantity - 0.25) * 4) / 4 }; KC.impact(.light) } label: {
                        Image(systemName: "minus.circle.fill").font(.title2).foregroundColor(KC.Color.textSecond)
                    }
                    Text(String(format: "%.2g", quantity))
                        .font(KC.Font.dataNumber)
                        .foregroundColor(KC.Color.textPrimary)
                        .frame(minWidth: 40)
                    Button { quantity = round((quantity + 0.25) * 4) / 4; KC.impact(.light) } label: {
                        Image(systemName: "plus.circle.fill").font(.title2).foregroundColor(KC.Color.accentGreen)
                    }
                }
            }

            Button(action: { onConfirm(); KC.success() }) {
                Text("Log Food")
                    .font(KC.Font.bodySmall.bold())
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(KC.Spacing.sm)
                    .background(KC.Color.accentGreen)
                    .clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
            }
            .buttonStyle(.plain)
        }
        .kcCard()
    }

    private func macroChip(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(KC.Font.dataLabel).foregroundColor(color)
            Text(label).font(.system(size: 9)).foregroundColor(KC.Color.textSecond)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, KC.Spacing.xs)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: KC.Radius.tag))
    }
}

// MARK: - Photo Log View
struct PhotoLogView: View {
    @ObservedObject var vm: LoggingViewModel
    @State private var showPicker = false
    @State private var capturedImage: UIImage?

    var body: some View {
        VStack(spacing: KC.Spacing.lg) {
            if vm.isPhotoAnalyzing {
                VStack(spacing: KC.Spacing.md) {
                    ProgressView().tint(KC.Color.accentGreen).scaleEffect(1.5)
                    Text("Analyzing your food...").font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if vm.showPhotoConfirm {
                PhotoConfirmView(estimates: vm.photoEstimates, onConfirm: { vm.confirmPhotoEstimates($0) },
                                 onRetake: { vm.showPhotoConfirm = false; vm.photoEstimates = [] })
            } else {
                VStack(spacing: KC.Spacing.lg) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 60))
                        .foregroundColor(KC.Color.textSecond)

                    Text("Point your camera at your food")
                        .font(KC.Font.bodySmall)
                        .foregroundColor(KC.Color.textSecond)

                    Button {
                        showPicker = true
                        KC.impact(.medium)
                    } label: {
                        Label("Take Photo", systemImage: "camera.fill")
                            .font(KC.Font.bodySmall.bold())
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(KC.Spacing.sm)
                            .background(KC.Color.accentGreen)
                            .clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, KC.Spacing.lg)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .sheet(isPresented: $showPicker) {
            ImagePicker(image: $capturedImage)
                .onDisappear {
                    if let img = capturedImage {
                        Task { await vm.analyzePhoto(img) }
                    }
                }
        }
    }
}

struct PhotoConfirmView: View {
    let estimates: [AIVisionService.FoodEstimate]
    @State private var selected: Set<UUID>
    var onConfirm: ([AIVisionService.FoodEstimate]) -> Void
    var onRetake: () -> Void

    init(estimates: [AIVisionService.FoodEstimate], onConfirm: @escaping ([AIVisionService.FoodEstimate]) -> Void, onRetake: @escaping () -> Void) {
        self.estimates = estimates
        self.onConfirm = onConfirm
        self.onRetake  = onRetake
        _selected = State(initialValue: Set(estimates.map { $0.id }))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: KC.Spacing.sm) {
            Text("Found \(estimates.count) item(s)")
                .font(KC.Font.bodySmall.bold())
                .foregroundColor(KC.Color.textPrimary)
                .padding(.horizontal, KC.Spacing.md)

            ForEach(estimates) { est in
                HStack {
                    Button { selected.formSymmetricDifference([est.id]); KC.impact(.light) } label: {
                        Image(systemName: selected.contains(est.id) ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(selected.contains(est.id) ? KC.Color.accentGreen : KC.Color.textSecond)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(est.name).font(KC.Font.bodySmall.bold()).foregroundColor(KC.Color.textPrimary)
                        Text(est.portionDescription).font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(Int(est.foodItem.netCarbs))g net").font(KC.Font.dataLabel).foregroundColor(KC.Color.accentAmber)
                        Text("\(Int(est.foodItem.calories)) kcal").font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                    }
                    Text("\(Int(est.confidence * 100))%")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(KC.Color.textSecond.opacity(0.6))
                }
                .padding(.horizontal, KC.Spacing.md)
            }

            HStack(spacing: KC.Spacing.sm) {
                Button(action: onRetake) {
                    Text("Retake").font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
                        .frame(maxWidth: .infinity).padding(KC.Spacing.sm)
                        .background(KC.Color.card).clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
                }
                Button {
                    let confirmed = estimates.filter { selected.contains($0.id) }
                    onConfirm(confirmed)
                } label: {
                    Text("Log Selected").font(KC.Font.bodySmall.bold()).foregroundColor(.black)
                        .frame(maxWidth: .infinity).padding(KC.Spacing.sm)
                        .background(KC.Color.accentGreen).clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, KC.Spacing.md)
        }
        .padding(.vertical, KC.Spacing.md)
    }
}

// MARK: - Barcode Log View
struct BarcodeLogView: View {
    @ObservedObject var vm: LoggingViewModel

    var body: some View {
        VStack(spacing: KC.Spacing.lg) {
            if vm.isSearching {
                ProgressView("Looking up barcode...")
                    .tint(KC.Color.accentGreen)
                    .foregroundColor(KC.Color.textSecond)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let item = vm.pendingItem {
                FoodConfirmView(item: item, quantity: $vm.quantity,
                                onConfirm: { vm.confirmLog() },
                                onCancel: { vm.pendingItem = nil })
                .padding(.horizontal, KC.Spacing.md)
            } else {
                // Wrap native AVFoundation barcode scanner in UIViewRepresentable
                BarcodeScannerView { barcode in
                    Task { await vm.handleBarcode(barcode) }
                }
                .clipShape(RoundedRectangle(cornerRadius: KC.Radius.card))
                .padding(KC.Spacing.md)
                .overlay(
                    RoundedRectangle(cornerRadius: KC.Radius.card)
                        .stroke(KC.Color.accentGreen, lineWidth: 2)
                        .padding(KC.Spacing.md)
                )
            }

            if let error = vm.error {
                Text(error)
                    .font(KC.Font.caption)
                    .foregroundColor(KC.Color.accentRed)
                    .padding()
            }
        }
    }
}

// MARK: - Voice Log View
struct VoiceLogView: View {
    @ObservedObject var vm: LoggingViewModel
    @ObservedObject private var voiceVM = VoiceLoggingService.shared

    var body: some View {
        VStack(spacing: KC.Spacing.lg) {
            Spacer()

            switch voiceVM.state {
            case .idle, .error:
                VStack(spacing: KC.Spacing.md) {
                    Image(systemName: "mic.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(KC.Color.accentGreen)
                    Text("Tap and speak your meal")
                        .font(KC.Font.bodySmall)
                        .foregroundColor(KC.Color.textSecond)
                    Text("\"Two eggs, half avocado, three strips of bacon\"")
                        .font(KC.Font.caption)
                        .foregroundColor(KC.Color.textSecond)
                        .multilineTextAlignment(.center)
                    if case .error(let msg) = voiceVM.state {
                        Text(msg).font(KC.Font.caption).foregroundColor(KC.Color.accentRed)
                    }
                    Button {
                        Task { try? await voiceVM.startRecording() }
                        KC.impact(.heavy)
                    } label: {
                        Text("Start Recording")
                            .font(KC.Font.bodySmall.bold())
                            .foregroundColor(.black)
                            .padding(.horizontal, KC.Spacing.xl)
                            .padding(.vertical, KC.Spacing.sm)
                            .background(KC.Color.accentGreen)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }

            case .recording:
                VStack(spacing: KC.Spacing.md) {
                    Image(systemName: "waveform")
                        .font(.system(size: 60))
                        .foregroundColor(KC.Color.accentRed)
                        .symbolEffect(.variableColor.cumulative)
                    Text("Listening...").font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
                    Button {
                        Task { await voiceVM.stopAndProcess() }
                    } label: {
                        Text("Done")
                            .font(KC.Font.bodySmall.bold())
                            .foregroundColor(.white)
                            .padding(.horizontal, KC.Spacing.xl)
                            .padding(.vertical, KC.Spacing.sm)
                            .background(KC.Color.accentRed)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }

            case .transcribing, .parsing:
                VStack(spacing: KC.Spacing.sm) {
                    ProgressView().tint(KC.Color.accentGreen).scaleEffect(1.5)
                    Text(voiceVM.state == .transcribing ? "Transcribing..." : "Identifying foods...")
                        .font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
                    if !voiceVM.transcription.isEmpty {
                        Text("\"\(voiceVM.transcription)\"")
                            .font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                            .italic().multilineTextAlignment(.center).padding(.horizontal)
                    }
                }

            case .done:
                VStack(alignment: .leading, spacing: KC.Spacing.sm) {
                    Text("I heard: \"\(voiceVM.transcription)\"")
                        .font(KC.Font.caption).foregroundColor(KC.Color.textSecond)
                        .padding(.horizontal, KC.Spacing.md)
                    ForEach(voiceVM.parsedItems) { item in
                        FoodResultRow(item: item)
                            .padding(.horizontal, KC.Spacing.md)
                            .onTapGesture { vm.pendingItem = item }
                    }
                    HStack(spacing: KC.Spacing.sm) {
                        Button("Log All") {
                            for item in voiceVM.parsedItems {
                                let log = FoodLog(foodItem: item, quantity: 1, mealSlot: vm.selectedMealSlot, logMethod: .voice)
                                LogStore.shared.add(log)
                            }
                            voiceVM.reset()
                            KC.success()
                        }
                        .font(KC.Font.bodySmall.bold()).foregroundColor(.black)
                        .frame(maxWidth: .infinity).padding(KC.Spacing.sm)
                        .background(KC.Color.accentGreen).clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
                        .buttonStyle(.plain)

                        Button("Redo") { voiceVM.reset() }
                            .font(KC.Font.bodySmall).foregroundColor(KC.Color.textSecond)
                            .frame(maxWidth: .infinity).padding(KC.Spacing.sm)
                            .background(KC.Color.card).clipShape(RoundedRectangle(cornerRadius: KC.Radius.button))
                    }
                    .padding(.horizontal, KC.Spacing.md)
                }
            }

            Spacer()
        }
    }
}

// MARK: - ImagePicker (UIImagePickerController wrapper)
struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker
        init(_ p: ImagePicker) { parent = p }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            parent.image = info[.originalImage] as? UIImage
            picker.dismiss(animated: true)
        }
    }
}

// MARK: - BarcodeScannerView (AVFoundation)
struct BarcodeScannerView: UIViewControllerRepresentable {
    var onScan: (String) -> Void

    func makeUIViewController(context: Context) -> BarcodeScannerVC {
        BarcodeScannerVC(onScan: onScan)
    }

    func updateUIViewController(_ vc: BarcodeScannerVC, context: Context) {}
}

final class BarcodeScannerVC: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    let onScan: (String) -> Void
    private var didScan = false

    init(onScan: @escaping (String) -> Void) { self.onScan = onScan; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCamera()
    }

    private func setupCamera() {
        let session = AVCaptureSession()
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.ean13, .ean8, .upce, .code128, .qr]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = view.bounds
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)
        previewLayer = preview

        DispatchQueue.global(qos: .userInitiated).async { session.startRunning() }
        captureSession = session
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !didScan,
              let obj = objects.first as? AVMetadataMachineReadableCodeObject,
              let str = obj.stringValue
        else { return }
        didScan = true
        captureSession?.stopRunning()
        onScan(str)
    }
}
