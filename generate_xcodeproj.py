#!/usr/bin/env python3
"""
Generates KetoCast.xcodeproj/project.pbxproj for Xcode 15+
Targets iOS 17.0, Swift 5.9, iPhone + iPad
"""

import os
import hashlib

PROJECT_DIR = "/home/user/claudecode/KetoCast"

def make_id(seed):
    """Generate a deterministic 24-char hex ID from a seed string."""
    h = hashlib.sha256(seed.encode()).hexdigest()[:24].upper()
    return h

# File tree to include in the project
SOURCE_FILES = [
    "KetoCast/App/KetoCastApp.swift",
    "KetoCast/App/AppState.swift",
    "KetoCast/Models/FoodItem.swift",
    "KetoCast/Models/FoodLog.swift",
    "KetoCast/Models/UserProfile.swift",
    "KetoCast/Models/WeightEntry.swift",
    "KetoCast/ViewModels/DashboardViewModel.swift",
    "KetoCast/ViewModels/LoggingViewModel.swift",
    "KetoCast/ViewModels/AnalyticsViewModel.swift",
    "KetoCast/ViewModels/ProfileViewModel.swift",
    "KetoCast/Views/MainTabView.swift",
    "KetoCast/Views/Home/HomeView.swift",
    "KetoCast/Views/Logging/LoggingSheetView.swift",
    "KetoCast/Views/Analytics/AnalyticsContainerView.swift",
    "KetoCast/Views/Onboarding/OnboardingContainerView.swift",
    "KetoCast/Views/Profile/ProfileView.swift",
    "KetoCast/Services/FoodDatabaseService.swift",
    "KetoCast/Services/AIVisionService.swift",
    "KetoCast/Services/VoiceLoggingService.swift",
    "KetoCast/Services/HealthKitService.swift",
    "KetoCast/Services/ClaudeCoachingService.swift",
    "KetoCast/Services/NotificationService.swift",
    "KetoCast/Persistence/CoreDataStack.swift",
    "KetoCast/Persistence/LogStore.swift",
    "KetoCast/Utilities/SecretsManager.swift",
    "KetoCast/Utilities/DesignSystem.swift",
]

RESOURCE_FILES = [
    "KetoCast/Resources/Assets.xcassets",
    "KetoCast/KetoCast.xcdatamodeld",
]

INFOPLIST = "KetoCast/Info.plist"

# IDs
PROJECT_ID      = make_id("PROJECT_ROOT")
TARGET_ID       = make_id("APP_TARGET")
PRODUCTS_GROUP  = make_id("PRODUCTS_GROUP")
FRAMEWORKS_PH   = make_id("FRAMEWORKS_PHASE")
SOURCES_PH      = make_id("SOURCES_PHASE")
RESOURCES_PH    = make_id("RESOURCES_PHASE")
DEBUG_CONFIG_ID = make_id("DEBUG_CONFIG")
RELEASE_CONFIG_ID = make_id("RELEASE_CONFIG")
TARGET_DEBUG    = make_id("TARGET_DEBUG")
TARGET_RELEASE  = make_id("TARGET_RELEASE")
CONFIG_LIST_PROJECT = make_id("CONFIG_LIST_PROJECT")
CONFIG_LIST_TARGET  = make_id("CONFIG_LIST_TARGET")
PRODUCT_REF_ID  = make_id("PRODUCT_REF")
MAIN_GROUP_ID   = make_id("MAIN_GROUP")
KETOCAST_GROUP  = make_id("KETOCAST_GROUP")
APP_GROUP       = make_id("APP_GROUP")
MODELS_GROUP    = make_id("MODELS_GROUP")
VM_GROUP        = make_id("VM_GROUP")
VIEWS_GROUP     = make_id("VIEWS_GROUP")
SERVICES_GROUP  = make_id("SERVICES_GROUP")
PERSIST_GROUP   = make_id("PERSIST_GROUP")
UTILS_GROUP     = make_id("UTILS_GROUP")
VIEWS_HOME      = make_id("VIEWS_HOME")
VIEWS_LOG       = make_id("VIEWS_LOG")
VIEWS_ANAL      = make_id("VIEWS_ANAL")
VIEWS_PROF      = make_id("VIEWS_PROF")
VIEWS_ONBOARD   = make_id("VIEWS_ONBOARD")
RESOURCES_GROUP = make_id("RESOURCES_GROUP")

# Frameworks needed
FRAMEWORKS = [
    ("SwiftUI",             make_id("FW_SWIFTUI"),        make_id("FWB_SWIFTUI")),
    ("Foundation",          make_id("FW_FOUNDATION"),     make_id("FWB_FOUNDATION")),
    ("CoreData",            make_id("FW_COREDATA"),       make_id("FWB_COREDATA")),
    ("HealthKit",           make_id("FW_HEALTHKIT"),      make_id("FWB_HEALTHKIT")),
    ("AVFoundation",        make_id("FW_AVFOUNDATION"),   make_id("FWB_AVFOUNDATION")),
    ("UserNotifications",   make_id("FW_USERNOTIF"),      make_id("FWB_USERNOTIF")),
    ("Charts",              make_id("FW_CHARTS"),         make_id("FWB_CHARTS")),
]

def file_ref_id(path): return make_id(f"FR_{path}")
def build_file_id(path): return make_id(f"BF_{path}")

def gen_pbxproject():
    lines = []
    lines.append("// !$*UTF8*$!")
    lines.append("{")
    lines.append("\tarchiveVersion = 1;")
    lines.append("\tclasses = {")
    lines.append("\t};")
    lines.append("\tobjectVersion = 77;")
    lines.append("\tobjects = {")
    lines.append("")

    # PBXBuildFile section
    lines.append("/* Begin PBXBuildFile section */")
    for path in SOURCE_FILES:
        fid = file_ref_id(path)
        bid = build_file_id(path)
        name = os.path.basename(path)
        lines.append(f"\t\t{bid} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {fid} /* {name} */; }};")
    for path in RESOURCE_FILES:
        fid = file_ref_id(path)
        bid = build_file_id(path)
        name = os.path.basename(path)
        lines.append(f"\t\t{bid} /* {name} in Resources */ = {{isa = PBXBuildFile; fileRef = {fid} /* {name} */; }};")
    # Frameworks build files
    for fw_name, fw_ref, fw_build in FRAMEWORKS:
        lines.append(f"\t\t{fw_build} /* {fw_name}.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {fw_ref} /* {fw_name}.framework */; }};")
    lines.append("/* End PBXBuildFile section */")
    lines.append("")

    # PBXFileReference section
    lines.append("/* Begin PBXFileReference section */")
    for path in SOURCE_FILES:
        fid = file_ref_id(path)
        name = os.path.basename(path)
        lines.append(f"\t\t{fid} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {name}; sourceTree = \"<group>\"; }};")
    # Assets
    fid = file_ref_id("KetoCast/Resources/Assets.xcassets")
    lines.append(f"\t\t{fid} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = \"<group>\"; }};")
    # Core Data model
    fid = file_ref_id("KetoCast/KetoCast.xcdatamodeld")
    lines.append(f"\t\t{fid} /* KetoCast.xcdatamodeld */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.xcdatamodel; path = KetoCast.xcdatamodeld; sourceTree = \"<group>\"; }};")
    # Info.plist
    fid = file_ref_id(INFOPLIST)
    lines.append(f"\t\t{fid} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = \"<group>\"; }};")
    # Product
    lines.append(f"\t\t{PRODUCT_REF_ID} /* KetoCast.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = KetoCast.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
    # Frameworks
    for fw_name, fw_ref, fw_build in FRAMEWORKS:
        lines.append(f"\t\t{fw_ref} /* {fw_name}.framework */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = {fw_name}.framework; path = System/Library/Frameworks/{fw_name}.framework; sourceTree = SDKROOT; }};")
    lines.append("/* End PBXFileReference section */")
    lines.append("")

    # PBXFrameworksBuildPhase
    lines.append("/* Begin PBXFrameworksBuildPhase section */")
    lines.append(f"\t\t{FRAMEWORKS_PH} /* Frameworks */ = {{")
    lines.append("\t\t\tisa = PBXFrameworksBuildPhase;")
    lines.append("\t\t\tbuildActionMask = 2147483647;")
    lines.append("\t\t\tfiles = (")
    for fw_name, fw_ref, fw_build in FRAMEWORKS:
        lines.append(f"\t\t\t\t{fw_build} /* {fw_name}.framework in Frameworks */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    lines.append("\t\t};")
    lines.append("/* End PBXFrameworksBuildPhase section */")
    lines.append("")

    # PBXGroup section — nested groups
    lines.append("/* Begin PBXGroup section */")

    # Main group
    lines.append(f"\t\t{MAIN_GROUP_ID} /* KetoCast */ = {{")
    lines.append("\t\t\tisa = PBXGroup;")
    lines.append("\t\t\tchildren = (")
    lines.append(f"\t\t\t\t{KETOCAST_GROUP} /* KetoCast */,")
    lines.append(f"\t\t\t\t{PRODUCTS_GROUP} /* Products */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tsourceTree = \"<group>\";")
    lines.append("\t\t};")

    # Products
    lines.append(f"\t\t{PRODUCTS_GROUP} /* Products */ = {{")
    lines.append("\t\t\tisa = PBXGroup;")
    lines.append("\t\t\tchildren = (")
    lines.append(f"\t\t\t\t{PRODUCT_REF_ID} /* KetoCast.app */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tname = Products;")
    lines.append("\t\t\tsourceTree = \"<group>\";")
    lines.append("\t\t};")

    # KetoCast root group
    lines.append(f"\t\t{KETOCAST_GROUP} /* KetoCast */ = {{")
    lines.append("\t\t\tisa = PBXGroup;")
    lines.append("\t\t\tchildren = (")
    lines.append(f"\t\t\t\t{APP_GROUP} /* App */,")
    lines.append(f"\t\t\t\t{MODELS_GROUP} /* Models */,")
    lines.append(f"\t\t\t\t{VM_GROUP} /* ViewModels */,")
    lines.append(f"\t\t\t\t{VIEWS_GROUP} /* Views */,")
    lines.append(f"\t\t\t\t{SERVICES_GROUP} /* Services */,")
    lines.append(f"\t\t\t\t{PERSIST_GROUP} /* Persistence */,")
    lines.append(f"\t\t\t\t{UTILS_GROUP} /* Utilities */,")
    lines.append(f"\t\t\t\t{RESOURCES_GROUP} /* Resources */,")
    lines.append(f"\t\t\t\t{file_ref_id(INFOPLIST)} /* Info.plist */,")
    lines.append(f"\t\t\t\t{file_ref_id('KetoCast/KetoCast.xcdatamodeld')} /* KetoCast.xcdatamodeld */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tpath = KetoCast;")
    lines.append("\t\t\tsourceTree = \"<group>\";")
    lines.append("\t\t};")

    def simple_group(gid, name, files):
        lines.append(f"\t\t{gid} /* {name} */ = {{")
        lines.append("\t\t\tisa = PBXGroup;")
        lines.append("\t\t\tchildren = (")
        for f in files:
            fid = file_ref_id(f)
            fname = os.path.basename(f)
            lines.append(f"\t\t\t\t{fid} /* {fname} */,")
        lines.append("\t\t\t);")
        lines.append(f"\t\t\tname = {name};")
        lines.append("\t\t\tsourceTree = \"<group>\";")
        lines.append("\t\t};")

    simple_group(APP_GROUP, "App", [f for f in SOURCE_FILES if "/App/" in f])
    simple_group(MODELS_GROUP, "Models", [f for f in SOURCE_FILES if "/Models/" in f])
    simple_group(VM_GROUP, "ViewModels", [f for f in SOURCE_FILES if "/ViewModels/" in f])
    simple_group(SERVICES_GROUP, "Services", [f for f in SOURCE_FILES if "/Services/" in f])
    simple_group(PERSIST_GROUP, "Persistence", [f for f in SOURCE_FILES if "/Persistence/" in f])
    simple_group(UTILS_GROUP, "Utilities", [f for f in SOURCE_FILES if "/Utilities/" in f])

    # Views group with subgroups
    lines.append(f"\t\t{VIEWS_GROUP} /* Views */ = {{")
    lines.append("\t\t\tisa = PBXGroup;")
    lines.append("\t\t\tchildren = (")
    lines.append(f"\t\t\t\t{file_ref_id('KetoCast/Views/MainTabView.swift')} /* MainTabView.swift */,")
    lines.append(f"\t\t\t\t{VIEWS_HOME} /* Home */,")
    lines.append(f"\t\t\t\t{VIEWS_LOG} /* Logging */,")
    lines.append(f"\t\t\t\t{VIEWS_ANAL} /* Analytics */,")
    lines.append(f"\t\t\t\t{VIEWS_PROF} /* Profile */,")
    lines.append(f"\t\t\t\t{VIEWS_ONBOARD} /* Onboarding */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tname = Views;")
    lines.append("\t\t\tsourceTree = \"<group>\";")
    lines.append("\t\t};")
    simple_group(VIEWS_HOME,   "Home",       [f for f in SOURCE_FILES if "/Views/Home/" in f])
    simple_group(VIEWS_LOG,    "Logging",    [f for f in SOURCE_FILES if "/Views/Logging/" in f])
    simple_group(VIEWS_ANAL,   "Analytics",  [f for f in SOURCE_FILES if "/Views/Analytics/" in f])
    simple_group(VIEWS_PROF,   "Profile",    [f for f in SOURCE_FILES if "/Views/Profile/" in f])
    simple_group(VIEWS_ONBOARD,"Onboarding", [f for f in SOURCE_FILES if "/Views/Onboarding/" in f])

    # Resources group
    lines.append(f"\t\t{RESOURCES_GROUP} /* Resources */ = {{")
    lines.append("\t\t\tisa = PBXGroup;")
    lines.append("\t\t\tchildren = (")
    lines.append(f"\t\t\t\t{file_ref_id('KetoCast/Resources/Assets.xcassets')} /* Assets.xcassets */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tname = Resources;")
    lines.append("\t\t\tsourceTree = \"<group>\";")
    lines.append("\t\t};")

    lines.append("/* End PBXGroup section */")
    lines.append("")

    # PBXNativeTarget
    lines.append("/* Begin PBXNativeTarget section */")
    lines.append(f"\t\t{TARGET_ID} /* KetoCast */ = {{")
    lines.append("\t\t\tisa = PBXNativeTarget;")
    lines.append("\t\t\tbuildConfigurationList = " + CONFIG_LIST_TARGET + ";")
    lines.append("\t\t\tbuildPhases = (")
    lines.append(f"\t\t\t\t{SOURCES_PH} /* Sources */,")
    lines.append(f"\t\t\t\t{FRAMEWORKS_PH} /* Frameworks */,")
    lines.append(f"\t\t\t\t{RESOURCES_PH} /* Resources */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tbuildRules = (")
    lines.append("\t\t\t);")
    lines.append("\t\t\tdependencies = (")
    lines.append("\t\t\t);")
    lines.append("\t\t\tname = KetoCast;")
    lines.append(f"\t\t\tproductName = KetoCast;")
    lines.append(f"\t\t\tproductReference = {PRODUCT_REF_ID} /* KetoCast.app */;")
    lines.append("\t\t\tproductType = \"com.apple.product-type.application\";")
    lines.append("\t\t};")
    lines.append("/* End PBXNativeTarget section */")
    lines.append("")

    # PBXProject
    lines.append("/* Begin PBXProject section */")
    lines.append(f"\t\t{PROJECT_ID} /* Project object */ = {{")
    lines.append("\t\t\tisa = PBXProject;")
    lines.append("\t\t\tattributes = {")
    lines.append("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
    lines.append("\t\t\t\tLastSwiftUpdateCheck = 1500;")
    lines.append("\t\t\t\tLastUpgradeCheck = 1500;")
    lines.append("\t\t\t\tTargetAttributes = {")
    lines.append(f"\t\t\t\t\t{TARGET_ID} = {{")
    lines.append("\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;")
    lines.append("\t\t\t\t\t};")
    lines.append("\t\t\t\t};")
    lines.append("\t\t\t};")
    lines.append(f"\t\t\tbuildConfigurationList = {CONFIG_LIST_PROJECT};")
    lines.append("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
    lines.append("\t\t\tdevelopmentRegion = en;")
    lines.append("\t\t\thasScannedForEncodings = 0;")
    lines.append("\t\t\tknownRegions = (")
    lines.append("\t\t\t\ten,")
    lines.append("\t\t\t\tBase,")
    lines.append("\t\t\t);")
    lines.append(f"\t\t\tmainGroup = {MAIN_GROUP_ID};")
    lines.append(f"\t\t\tproductRefGroup = {PRODUCTS_GROUP} /* Products */;")
    lines.append("\t\t\tprojectDirPath = \"\";")
    lines.append("\t\t\tprojectRoot = \"\";")
    lines.append("\t\t\ttargets = (")
    lines.append(f"\t\t\t\t{TARGET_ID} /* KetoCast */,")
    lines.append("\t\t\t);")
    lines.append("\t\t};")
    lines.append("/* End PBXProject section */")
    lines.append("")

    # PBXResourcesBuildPhase
    lines.append("/* Begin PBXResourcesBuildPhase section */")
    lines.append(f"\t\t{RESOURCES_PH} /* Resources */ = {{")
    lines.append("\t\t\tisa = PBXResourcesBuildPhase;")
    lines.append("\t\t\tbuildActionMask = 2147483647;")
    lines.append("\t\t\tfiles = (")
    for path in RESOURCE_FILES:
        bid = build_file_id(path)
        name = os.path.basename(path)
        lines.append(f"\t\t\t\t{bid} /* {name} in Resources */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    lines.append("\t\t};")
    lines.append("/* End PBXResourcesBuildPhase section */")
    lines.append("")

    # PBXSourcesBuildPhase
    lines.append("/* Begin PBXSourcesBuildPhase section */")
    lines.append(f"\t\t{SOURCES_PH} /* Sources */ = {{")
    lines.append("\t\t\tisa = PBXSourcesBuildPhase;")
    lines.append("\t\t\tbuildActionMask = 2147483647;")
    lines.append("\t\t\tfiles = (")
    for path in SOURCE_FILES:
        bid = build_file_id(path)
        name = os.path.basename(path)
        lines.append(f"\t\t\t\t{bid} /* {name} in Sources */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    lines.append("\t\t};")
    lines.append("/* End PBXSourcesBuildPhase section */")
    lines.append("")

    # XCBuildConfiguration section
    lines.append("/* Begin XCBuildConfiguration section */")

    # Project-level Debug
    lines.append(f"\t\t{DEBUG_CONFIG_ID} /* Debug */ = {{")
    lines.append("\t\t\tisa = XCBuildConfiguration;")
    lines.append("\t\t\tbuildSettings = {")
    lines.append("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
    lines.append("\t\t\t\tBUILD_LIBRARY_FOR_DISTRIBUTION = NO;")
    lines.append("\t\t\t\tCLANG_ANALYZER_NONNULL = YES;")
    lines.append("\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;")
    lines.append("\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = \"gnu++20\";")
    lines.append("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
    lines.append("\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;")
    lines.append("\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;")
    lines.append("\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;")
    lines.append("\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;")
    lines.append("\t\t\t\tCLANG_WARN_COMMA = YES;")
    lines.append("\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;")
    lines.append("\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;")
    lines.append("\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;")
    lines.append("\t\t\t\tCLANG_WARN_DOCUMENTATION_COMMENTS = YES;")
    lines.append("\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;")
    lines.append("\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;")
    lines.append("\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;")
    lines.append("\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;")
    lines.append("\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;")
    lines.append("\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_CYCLE = YES;")
    lines.append("\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;")
    lines.append("\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;")
    lines.append("\t\t\t\tCLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;")
    lines.append("\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;")
    lines.append("\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;")
    lines.append("\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;")
    lines.append("\t\t\t\tCLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;")
    lines.append("\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;")
    lines.append("\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;")
    lines.append("\t\t\t\tCOPY_PHASE_STRIP = NO;")
    lines.append("\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;")
    lines.append("\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;")
    lines.append("\t\t\t\tENABLE_TESTABILITY = YES;")
    lines.append("\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu17;")
    lines.append("\t\t\t\tGCC_DYNAMIC_NO_PIC = NO;")
    lines.append("\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;")
    lines.append("\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;")
    lines.append("\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (\"DEBUG=1\", \"$(inherited)\",);")
    lines.append("\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;")
    lines.append("\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;")
    lines.append("\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;")
    lines.append("\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;")
    lines.append("\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;")
    lines.append("\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;")
    lines.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;")
    lines.append("\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;")
    lines.append("\t\t\t\tMTL_FAST_MATH = YES;")
    lines.append("\t\t\t\tONLY_ACTIVE_ARCH = YES;")
    lines.append("\t\t\t\tSDKROOT = iphoneos;")
    lines.append("\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;")
    lines.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-Onone\";")
    lines.append("\t\t\t};")
    lines.append("\t\t\tname = Debug;")
    lines.append("\t\t};")

    # Project-level Release
    lines.append(f"\t\t{RELEASE_CONFIG_ID} /* Release */ = {{")
    lines.append("\t\t\tisa = XCBuildConfiguration;")
    lines.append("\t\t\tbuildSettings = {")
    lines.append("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
    lines.append("\t\t\t\tCLANG_ANALYZER_NONNULL = YES;")
    lines.append("\t\t\t\tDEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\";")
    lines.append("\t\t\t\tENABLE_NS_ASSERTIONS = NO;")
    lines.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;")
    lines.append("\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;")
    lines.append("\t\t\t\tSDKROOT = iphoneos;")
    lines.append("\t\t\t\tSWIFT_COMPILATION_MODE = wholemodule;")
    lines.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-O\";")
    lines.append("\t\t\t\tVALIDATE_PRODUCT = YES;")
    lines.append("\t\t\t};")
    lines.append("\t\t\tname = Release;")
    lines.append("\t\t};")

    # Target Debug
    lines.append(f"\t\t{TARGET_DEBUG} /* Debug */ = {{")
    lines.append("\t\t\tisa = XCBuildConfiguration;")
    lines.append("\t\t\tbuildSettings = {")
    lines.append("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    lines.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    lines.append("\t\t\t\tCURRENT_PROJECT_VERSION = 1;")
    lines.append("\t\t\t\tGENERATE_INFOPLIST_FILE = NO;")
    lines.append("\t\t\t\tINFOPLIST_FILE = KetoCast/Info.plist;")
    lines.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;")
    lines.append("\t\t\t\tMARKETING_VERSION = 1.0;")
    lines.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = \"com.ketocast.app\";")
    lines.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    lines.append("\t\t\t\tSUPPORTED_PLATFORMS = iphoneos;")
    lines.append("\t\t\t\tSUPPORTS_MACCATALYST = NO;")
    lines.append("\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;")
    lines.append("\t\t\t\tSWIFT_VERSION = 5.0;")
    lines.append("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
    lines.append("\t\t\t};")
    lines.append("\t\t\tname = Debug;")
    lines.append("\t\t};")

    # Target Release
    lines.append(f"\t\t{TARGET_RELEASE} /* Release */ = {{")
    lines.append("\t\t\tisa = XCBuildConfiguration;")
    lines.append("\t\t\tbuildSettings = {")
    lines.append("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    lines.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    lines.append("\t\t\t\tCURRENT_PROJECT_VERSION = 1;")
    lines.append("\t\t\t\tGENERATE_INFOPLIST_FILE = NO;")
    lines.append("\t\t\t\tINFOPLIST_FILE = KetoCast/Info.plist;")
    lines.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;")
    lines.append("\t\t\t\tMARKETING_VERSION = 1.0;")
    lines.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = \"com.ketocast.app\";")
    lines.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    lines.append("\t\t\t\tSUPPORTED_PLATFORMS = iphoneos;")
    lines.append("\t\t\t\tSUPPORTS_MACCATALYST = NO;")
    lines.append("\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;")
    lines.append("\t\t\t\tSWIFT_VERSION = 5.0;")
    lines.append("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
    lines.append("\t\t\t};")
    lines.append("\t\t\tname = Release;")
    lines.append("\t\t};")
    lines.append("/* End XCBuildConfiguration section */")
    lines.append("")

    # XCConfigurationList
    lines.append("/* Begin XCConfigurationList section */")
    lines.append(f"\t\t{CONFIG_LIST_PROJECT} /* Build configuration list for PBXProject KetoCast */ = {{")
    lines.append("\t\t\tisa = XCConfigurationList;")
    lines.append("\t\t\tbuildConfigurations = (")
    lines.append(f"\t\t\t\t{DEBUG_CONFIG_ID} /* Debug */,")
    lines.append(f"\t\t\t\t{RELEASE_CONFIG_ID} /* Release */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    lines.append("\t\t\tdefaultConfigurationName = Release;")
    lines.append("\t\t};")
    lines.append(f"\t\t{CONFIG_LIST_TARGET} /* Build configuration list for PBXNativeTarget KetoCast */ = {{")
    lines.append("\t\t\tisa = XCConfigurationList;")
    lines.append("\t\t\tbuildConfigurations = (")
    lines.append(f"\t\t\t\t{TARGET_DEBUG} /* Debug */,")
    lines.append(f"\t\t\t\t{TARGET_RELEASE} /* Release */,")
    lines.append("\t\t\t);")
    lines.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    lines.append("\t\t\tdefaultConfigurationName = Release;")
    lines.append("\t\t};")
    lines.append("/* End XCConfigurationList section */")
    lines.append("")

    lines.append("\t};")
    lines.append(f"\trootObject = {PROJECT_ID} /* Project object */;")
    lines.append("}")

    return "\n".join(lines)


if __name__ == "__main__":
    os.makedirs(f"{PROJECT_DIR}/KetoCast.xcodeproj", exist_ok=True)
    pbxproj = gen_pbxproject()
    out = f"{PROJECT_DIR}/KetoCast.xcodeproj/project.pbxproj"
    with open(out, "w") as f:
        f.write(pbxproj)
    print(f"Generated {out}")
    print(f"Lines: {len(pbxproj.splitlines())}")
