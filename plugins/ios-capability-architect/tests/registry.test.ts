import { describe, expect, it } from "vitest";
import {
  deriveKnowledgeState,
  findRecord,
  findTechnologyCatalogEntry,
  loadRegistry,
  loadTechnologyCatalog,
  resetRegistryCache,
  searchRecords,
  searchTechnologyCatalog
} from "@/registry.js";
import { knowledgeTrackedFields, type CapabilityRecord } from "@/types.js";

describe("capability registry", () => {
  it("loads unique fully-normalized records", async () => {
    const records = await loadRegistry();
    expect(records.length).toBeGreaterThanOrEqual(15);
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
    for (const record of records) {
      expect(record.last_verified_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record.official_documentation.length).toBeGreaterThan(0);
      expect(record.on_device_level).toMatch(/^(fully_on_device|primarily_on_device|hybrid|cloud_required|unknown)$/);
      expect(record.knowledge_state.fields.minimum_os_version).not.toBe("unknown");
      expect(record.knowledge_state.fields.sdk_availability).not.toBe("unknown");
      expect(record.knowledge_state.fields.stable_or_beta).toBe("verified_value");
      expect(record.stable_or_beta).not.toBe("unknown");
    }
  });

  it("resolves ids, names, and aliases", async () => {
    expect((await findRecord("healthkit"))?.id).toBe("healthkit");
    expect((await findRecord("Core ML"))?.id).toBe("core-ml");
    expect((await findRecord("Dynamic Island"))?.id).toBe("activitykit");
  });

  it("does not resolve an ambiguous partial phrase to an arbitrary profile", async () => {
    expect(await findRecord("apple")).toBeUndefined();
    expect((await findRecord("healthkit background"))?.id).toBe("healthkit-background-delivery");
  });

  it("loads the reviewed foundational language and UI profiles", async () => {
    const expected = ["swift", "swift-concurrency", "swiftui", "uikit", "foundation"];
    for (const id of expected) {
      const record = await findRecord(id);
      expect(record).toMatchObject({ id, stable_or_beta: "stable", last_verified_at: "2026-09-30" });
      expect(record?.official_documentation.length).toBeGreaterThan(0);
      expect(record?.sdk_availability).toMatch(/Xcode 27|iOS 27 SDK/);
    }

    expect((await findRecord("swift-concurrency"))?.minimum_os_version.iOS).toBe("13.0");
    expect((await findRecord("swiftui"))?.minimum_os_version.watchOS).toBe("6.0");
    expect((await findRecord("uikit"))?.platforms).not.toContain("macOS");
    expect((await findRecord("foundation"))?.on_device_level).toBe("hybrid");
  });

  it("loads reviewed networking, persistence, and security profiles without flattening conditional setup", async () => {
    const expected = [
      "urlsession",
      "core-data",
      "cloudkit",
      "keychain-services",
      "authenticationservices",
      "cryptokit"
    ];
    for (const id of expected) {
      const record = await findRecord(id);
      expect(record).toMatchObject({ id, stable_or_beta: "stable", last_verified_at: "2026-09-30" });
      expect(record?.official_documentation.length).toBeGreaterThan(0);
      expect(record?.sdk_availability).toContain("Xcode 26.6 and SDK 26.5");
      expect(record?.sdk_availability).toMatch(/Xcode 27|iOS 27 SDK/);
      expect(record?.knowledge_state.completeness).toBe("partial");
      expect(record?.knowledge_state.fields.region_restrictions).toBe("unknown");
    }

    const urlSession = await findRecord("urlsession");
    expect(urlSession?.minimum_os_version["Mac Catalyst"]).toBe("13.1");
    expect(urlSession?.background_modes).toEqual([]);
    expect(urlSession?.managed_entitlements).toContainEqual(expect.stringContaining("multicast"));

    const coreData = await findRecord("core-data");
    expect(coreData?.minimum_os_version["Mac Catalyst"]).toBe("13.0");
    expect(coreData?.cloud_dependency).toContain("Optional CloudKit");
    expect(coreData?.xcode_capabilities).toContainEqual(expect.stringContaining("only for CloudKit-backed stores"));
    expect(coreData?.background_modes).toContainEqual(expect.stringContaining("remote-notification only"));

    const cloudKit = await findRecord("cloudkit");
    expect(cloudKit?.on_device_level).toBe("cloud_required");
    expect(cloudKit?.entitlements).toContain("com.apple.developer.icloud-services");
    expect(cloudKit?.entitlements).toContain("com.apple.developer.icloud-container-identifiers");
    expect(cloudKit?.entitlements).toContainEqual(expect.stringContaining("aps-environment"));
    expect(cloudKit?.entitlements.join(" ")).not.toContain("ubiquity-kvstore-identifier");
    expect(cloudKit?.background_modes).toContainEqual(expect.stringContaining("fetch only"));

    const keychain = await findRecord("keychain-services");
    expect(keychain?.minimum_os_version["Mac Catalyst"]).toBe("13.1");
    expect(keychain?.knowledge_state.fields.user_permissions).toBe("verified_none");
    expect(keychain?.xcode_capabilities).toContainEqual(expect.stringContaining("only when items are shared"));
    expect(keychain?.info_plist_keys).toContainEqual(expect.stringContaining("only when Face ID"));

    const authenticationServices = await findRecord("authenticationservices");
    expect(authenticationServices?.minimum_os_version.iOS).toBe("12.0");
    expect(authenticationServices?.entitlements).toContainEqual(expect.stringContaining("only for Sign in with Apple"));
    expect(authenticationServices?.entitlements).toContainEqual(expect.stringContaining("webcredentials"));
    expect(authenticationServices?.entitlements).toContainEqual(
      expect.stringContaining("autofill-credential-provider")
    );

    const cryptoKit = await findRecord("cryptokit");
    expect(cryptoKit?.on_device_level).toBe("fully_on_device");
    expect(cryptoKit?.xcode_capabilities).toEqual([]);
    expect(cryptoKit?.info_plist_keys).toContainEqual(expect.stringContaining("ITSAppUsesNonExemptEncryption"));
    expect(cryptoKit?.limitations).toContainEqual(expect.stringContaining("does not provide durable key storage"));

    expect((await findTechnologyCatalogEntry("Secure Enclave"))?.coverage_status).toBe("catalogued");
    expect((await findTechnologyCatalogEntry("Sign in with Apple"))?.coverage_status).toBe("catalogued");
  });

  it("loads reviewed platform profiles while preserving feature-specific configuration and adjacent identities", async () => {
    const expected = [
      "apns",
      "avfoundation",
      "photokit",
      "vision",
      "mapkit",
      "core-bluetooth",
      "accessibility",
      "apptrackingtransparency",
      "app-attest"
    ];
    for (const id of expected) {
      const record = await findRecord(id);
      expect(record).toMatchObject({ id, stable_or_beta: "stable" });
      expect(record?.last_verified_at).toBe(["avfoundation", "photokit"].includes(id) ? "2026-09-30" : "2026-09-30");
      expect(record?.official_documentation.length).toBeGreaterThan(0);
      expect(record?.sdk_availability).toContain("Xcode 26.6 and SDK 26.5");
      expect(record?.sdk_availability).toMatch(/Xcode 27|iOS 27 SDK/);
      expect(record?.knowledge_state.completeness).toBe("partial");
      if (!["mapkit", "apptrackingtransparency"].includes(id))
        expect(record?.knowledge_state.fields.region_restrictions).toBe("unknown");
    }

    const apns = await findRecord("apns");
    expect(apns?.on_device_level).toBe("hybrid");
    expect(apns?.info_plist_keys).toEqual([]);
    expect(apns?.entitlements).toContainEqual(expect.stringContaining("aps-environment"));
    expect(apns?.background_modes).toContainEqual(expect.stringContaining("only for best-effort silent"));

    const avFoundation = await findRecord("avfoundation");
    expect(avFoundation?.minimum_os_version.iOS).toBe("2.2");
    expect(avFoundation?.info_plist_keys).toContainEqual(expect.stringContaining("NSCameraUsageDescription only"));
    expect(avFoundation?.info_plist_keys).toContainEqual(expect.stringContaining("NSMicrophoneUsageDescription only"));
    expect(avFoundation?.related_capabilities).toContain("Hardened Runtime");
    expect(avFoundation?.entitlements).toContainEqual(
      expect.stringContaining(
        "com.apple.security.device.camera only for camera capture from a macOS app using App Sandbox or Hardened Runtime"
      )
    );
    expect(avFoundation?.entitlements).toContainEqual(
      expect.stringContaining(
        "com.apple.security.device.audio-input only for audio-input capture from a macOS app using App Sandbox or Hardened Runtime"
      )
    );

    const photoKit = await findRecord("photokit");
    expect(photoKit?.minimum_os_version.watchOS).toBe("10.0");
    expect(photoKit?.sdk_availability).toContain("picker subset");
    expect(photoKit?.info_plist_keys).toContainEqual(
      expect.stringContaining("NSPhotoLibraryAddUsageDescription only for")
    );
    expect(photoKit?.recommended_alternatives).toContainEqual(expect.stringContaining("PhotosUI"));
    expect(photoKit?.related_capabilities).toContain("Hardened Runtime");
    expect(photoKit?.entitlements).toContainEqual(
      expect.stringContaining(
        "com.apple.security.personal-information.photos-library only for photo-library access from a macOS app using App Sandbox or Hardened Runtime"
      )
    );
    expect((await findTechnologyCatalogEntry("PhotosUI"))?.coverage_status).toBe("catalogued");

    const vision = await findRecord("vision");
    expect(vision?.platforms).not.toContain("watchOS");
    expect(vision?.on_device_level).toBe("fully_on_device");
    expect(vision?.user_permissions).toEqual([]);

    const mapKit = await findRecord("mapkit");
    expect(mapKit?.minimum_os_version.tvOS).toBe("9.2");
    expect(mapKit?.user_permissions).toContainEqual(expect.stringContaining("only when"));
    expect(mapKit?.limitations).toContainEqual(expect.stringContaining("Ordinary native MapKit"));
    expect(mapKit?.entitlements).not.toContain("com.apple.developer.maps");
    expect(mapKit?.region_restrictions).toHaveLength(2);
    expect(mapKit?.info_plist_keys).toContainEqual(expect.stringContaining("NSLocationUsageDescription"));
    expect(mapKit?.info_plist_keys).toContainEqual(expect.stringMatching(/^CFBundleDocumentTypes only for/));
    expect(mapKit?.info_plist_keys).toContainEqual(expect.stringMatching(/^com\.apple\.maps\.directionsrequest only/));
    expect(mapKit?.info_plist_keys).toContainEqual(expect.stringMatching(/^CFBundleURLTypes only for/));
    expect(mapKit?.info_plist_keys).toContainEqual(expect.stringMatching(/^geo-navigation only/));

    const coreBluetooth = await findRecord("core-bluetooth");
    expect(coreBluetooth?.minimum_os_version.macOS).toBe("10.7");
    expect(coreBluetooth?.minimum_os_version["Mac Catalyst"]).toBe("13.1");
    expect(coreBluetooth?.background_modes).toContainEqual(expect.stringContaining("bluetooth-central only"));
    expect(coreBluetooth?.background_modes).toContainEqual(expect.stringContaining("bluetooth-peripheral only"));
    expect(coreBluetooth?.sdk_availability).toContain("CBPeripheralManager");
    expect(coreBluetooth?.sdk_availability).toContain("unavailable on tvOS, watchOS, and visionOS");

    const accessibility = await findRecord("accessibility");
    expect(accessibility?.minimum_os_version.iOS).toBe("14.0");
    expect(accessibility?.supported_use_cases).toContainEqual(expect.stringContaining("Accessibility framework"));
    expect(accessibility?.supported_use_cases).not.toContainEqual(expect.stringContaining("labels"));
    expect(accessibility?.network_requirement).toContain("requires no network");
    expect(accessibility?.xcode_capabilities).toEqual([]);

    const att = await findRecord("apptrackingtransparency");
    expect(att?.platforms).not.toContain("watchOS");
    expect(att?.minimum_os_version.macOS).toBeNull();
    expect(att?.info_plist_keys).toContainEqual(expect.stringContaining("NSUserTrackingUsageDescription"));
    expect(att?.required_reason_apis).toEqual([]);
    expect(att?.sdk_availability).toContain("14.5");

    const appAttest = await findRecord("app-attest");
    expect(appAttest?.on_device_level).toBe("hybrid");
    expect(appAttest?.minimum_os_version["Mac Catalyst"]).toBeNull();
    expect(appAttest?.minimum_os_version.macOS).toBeNull();
    expect(appAttest?.entitlements).toContainEqual(expect.stringContaining("appattest-environment"));
    expect(appAttest?.sdk_availability).toContain("isSupported returns false on Mac devices");

    for (const adjacent of ["AVFoundation capture", "PhotosUI", "VisionKit", "Maps", "DeviceCheck"]) {
      expect((await findTechnologyCatalogEntry(adjacent))?.coverage_status).toBe("catalogued");
    }
  });

  it("loads reviewed core-system profiles without collapsing member or adjacent-technology boundaries", async () => {
    const expected = [
      "core-motion",
      "weatherkit",
      "local-authentication",
      "core-spotlight",
      "network",
      "webkit",
      "eventkit",
      "contacts"
    ];
    for (const id of expected) {
      const record = await findRecord(id);
      expect(record).toMatchObject({ id, stable_or_beta: "stable", last_verified_at: "2026-09-30" });
      expect(record?.official_documentation.length).toBeGreaterThan(0);
      expect(record?.sdk_availability).toContain("Xcode 26.6 and SDK 26.5");
      expect(record?.sdk_availability).toMatch(/Xcode 27|iOS 27 SDK/);
      expect(record?.knowledge_state.completeness).toBe("partial");
      expect(record?.knowledge_state.fields.privacy_manifest_requirements).toBe("verified_value");
      expect(record?.knowledge_state.fields.required_reason_apis).toBe("verified_none");
    }

    const coreMotion = await findRecord("core-motion");
    expect(coreMotion?.platforms).not.toContain("tvOS");
    expect(coreMotion?.minimum_os_version["Mac Catalyst"]).toBe("13.1");
    expect(coreMotion?.info_plist_keys).toContainEqual(expect.stringContaining("NSMotionUsageDescription only"));
    expect(coreMotion?.info_plist_keys).toContainEqual(expect.stringContaining("NSFallDetectionUsageDescription only"));
    expect(coreMotion?.xcode_capabilities).toContainEqual(expect.stringContaining("Fall Detection Notifications only"));
    expect(coreMotion?.entitlements).toContainEqual(
      expect.stringContaining("com.apple.developer.health.fall-detection only")
    );
    expect(coreMotion?.managed_entitlements).toContainEqual(expect.stringContaining("Apple approval"));
    expect(coreMotion?.background_modes).toEqual([]);

    const weatherKit = await findRecord("weatherkit");
    expect(weatherKit?.on_device_level).toBe("cloud_required");
    expect(weatherKit?.minimum_os_version.watchOS).toBe("9.0");
    expect(weatherKit?.xcode_capabilities).toEqual(["WeatherKit"]);
    expect(weatherKit?.entitlements).toEqual(["com.apple.developer.weatherkit"]);
    expect(weatherKit?.user_permissions).toContainEqual(expect.stringContaining("only when"));

    const localAuthentication = await findRecord("local-authentication");
    expect(localAuthentication?.minimum_os_version.watchOS).toBe("3.0");
    expect(localAuthentication?.platforms).not.toContain("tvOS");
    expect(localAuthentication?.info_plist_keys).toContainEqual(expect.stringContaining("NSFaceIDUsageDescription"));
    expect(localAuthentication?.entitlements).toEqual([]);

    const coreSpotlight = await findRecord("core-spotlight");
    expect(coreSpotlight?.on_device_level).toBe("fully_on_device");
    expect(coreSpotlight?.platforms).not.toContain("tvOS");
    expect(coreSpotlight?.platforms).not.toContain("watchOS");
    expect(coreSpotlight?.minimum_os_version["Mac Catalyst"]).toBe("13.1");
    expect(coreSpotlight?.minimum_os_version.macOS).toBe("10.11");
    expect(coreSpotlight?.related_extensions).toEqual(["Spotlight Index Extension"]);
    expect(coreSpotlight?.user_permissions).toEqual([]);
    expect(coreSpotlight?.entitlements).toEqual([]);

    const network = await findRecord("network");
    expect(network?.minimum_os_version.watchOS).toBe("5.0");
    expect(network?.info_plist_keys).toContainEqual(expect.stringContaining("NSLocalNetworkUsageDescription only"));
    expect(network?.info_plist_keys).toContainEqual(expect.stringContaining("macOS 15 or later"));
    expect(network?.limitations).toContainEqual(expect.stringContaining("doesn't apply to tvOS or watchOS"));
    expect(network?.managed_entitlements).toContainEqual(expect.stringContaining("Multicast Networking"));
    expect(network?.info_plist_keys.join(" ")).not.toContain("NSAppTransportSecurity");
    expect(network?.background_modes).toEqual([]);

    const webKit = await findRecord("webkit");
    expect(webKit?.minimum_os_version.iOS).toBe("8.0");
    expect(webKit?.platforms).not.toContain("tvOS");
    expect(webKit?.platforms).not.toContain("watchOS");
    expect(webKit?.info_plist_keys).toContainEqual(expect.stringContaining("WKAppBoundDomains only"));
    expect(webKit?.background_modes).toEqual([]);
    expect(webKit?.recommended_alternatives).toContainEqual(expect.stringContaining("SFSafariViewController"));

    const eventKit = await findRecord("eventkit");
    expect(eventKit?.info_plist_keys).toContainEqual(
      expect.stringContaining(
        "NSCalendarsWriteOnlyAccessUsageDescription only for write-only event access on iOS or iPadOS 17 or later"
      )
    );
    expect(eventKit?.info_plist_keys).toContainEqual(
      expect.stringContaining("NSCalendarsFullAccessUsageDescription only")
    );
    expect(eventKit?.info_plist_keys).toContainEqual(
      expect.stringContaining(
        "NSRemindersFullAccessUsageDescription only for full reminders access on iOS or iPadOS 17 or later"
      )
    );
    expect(eventKit?.info_plist_keys).toContainEqual(expect.stringContaining("macOS 10.14 through 13"));
    expect(eventKit?.related_capabilities).toContain("Hardened Runtime");
    expect(eventKit?.entitlements).toContainEqual(expect.stringContaining("App Sandbox or Hardened Runtime"));
    expect(eventKit?.unsupported_use_cases).toContain("Read-only calendar or reminders authorization");

    const contacts = await findRecord("contacts");
    expect(contacts?.sdk_availability).toContain("Limited authorization");
    expect(contacts?.info_plist_keys).toContainEqual(expect.stringContaining("NSContactsUsageDescription only"));
    expect(contacts?.entitlements).toContainEqual(expect.stringContaining("com.apple.developer.contacts.notes"));
    expect(contacts?.entitlements).toContainEqual(expect.stringContaining("unavailable on watchOS"));
    expect(contacts?.related_capabilities).toContain("Hardened Runtime");
    expect(contacts?.entitlements).toContainEqual(expect.stringContaining("App Sandbox or Hardened Runtime"));
    expect(contacts?.managed_entitlements).toContainEqual(expect.stringContaining("Apple approval"));

    for (const adjacent of [
      "SensorKit",
      "Secure Enclave",
      "NetworkExtension",
      "Background URLSession",
      "SafariServices",
      "Universal Links"
    ]) {
      expect((await findTechnologyCatalogEntry(adjacent))?.coverage_status, adjacent).toBe("catalogued");
    }
  });

  it("looks up catalog technologies by exact id or normalized name only", async () => {
    expect((await findTechnologyCatalogEntry("MapKit"))?.id).toBe("technology.mapkit");
    expect((await findTechnologyCatalogEntry("technology.mapkit"))?.name).toBe("MapKit");
    expect(await findTechnologyCatalogEntry("Map")).toBeUndefined();
  });

  it("resolves every committed catalog technology by its exact id", async () => {
    const catalog = await loadTechnologyCatalog();
    expect(catalog).toHaveLength(203);
    for (const entry of catalog) {
      expect(await findTechnologyCatalogEntry(entry.id)).toEqual(entry);
    }
  }, 10_000);

  it("returns defensive copies and handles empty searches", async () => {
    const first = await loadRegistry();
    first[0]!.name = "mutated";
    expect((await loadRegistry())[0]?.name).not.toBe("mutated");
    resetRegistryCache();
    expect(await findRecord("   ")).toBeUndefined();
    expect(await searchRecords("zzzxqv-nohit")).toEqual([]);
    const tiedResults = await searchRecords("framework", 100);
    expect(tiedResults.length).toBeGreaterThan(1);
    expect(await searchTechnologyCatalog(" ")).toEqual([]);
    expect(await findTechnologyCatalogEntry(" ")).toBeUndefined();
  });

  it("derives complete and partial knowledge states from field presence", async () => {
    const [record] = await loadRegistry();
    const completeInput = Object.fromEntries(
      knowledgeTrackedFields.map((field) => [field, record![field]])
    ) as Partial<CapabilityRecord>;

    expect(deriveKnowledgeState(completeInput).completeness).toBe("complete");
    expect(deriveKnowledgeState({ id: "partial" }).completeness).toBe("partial");
  });

  it("distinguishes unknown fields, verified values, and verified absence", async () => {
    const healthKit = await findRecord("healthkit");
    const coreML = await findRecord("core-ml");

    expect(healthKit?.knowledge_state.completeness).toBe("partial");
    expect(healthKit?.knowledge_state.fields.minimum_os_version).toBe("verified_value");
    expect(healthKit?.knowledge_state.fields.stable_or_beta).toBe("verified_value");
    expect(healthKit?.knowledge_state.fields.user_permissions).toBe("verified_value");
    expect(healthKit?.knowledge_state.fields.managed_entitlements).toBe("unknown");
    expect(coreML?.knowledge_state.fields.cloud_dependency).toBe("verified_none");
  });

  it("preserves reviewed platform availability instead of inferred defaults", async () => {
    const activityKit = await findRecord("activitykit");
    const healthKit = await findRecord("healthkit");
    const storeKit2 = await findRecord("storekit-2");

    expect(activityKit?.platforms).toEqual(["iOS", "iPadOS"]);
    expect(activityKit?.minimum_os_version).toEqual({ iOS: "16.1", iPadOS: "16.1" });
    expect(healthKit?.minimum_os_version.iPadOS).toBe("17.0");
    expect(healthKit?.minimum_os_version.macOS).toBeNull();
    expect(storeKit2?.minimum_os_version.iOS).toBe("15.0");
  });

  it("derives typed, deduplicated relationships from legacy relationship arrays", async () => {
    const widgetKit = await findRecord("widgetkit");

    expect(widgetKit?.relationships).toContainEqual({ type: "related_framework", target: "SwiftUI" });
    expect(widgetKit?.relationships).toContainEqual({ type: "related_extension", target: "Widget Extension" });
    expect(new Set(widgetKit?.relationships.map(({ type, target }) => `${type}:${target}`)).size).toBe(
      widgetKit?.relationships.length
    );
  });
});
