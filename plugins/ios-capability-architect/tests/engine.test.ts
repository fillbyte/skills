import { describe, expect, it } from "vitest";
import {
  analyzeAppIdea,
  auditPermissionsAndEntitlements,
  auditPrivacyAndReview,
  checkAvailability,
  compareImplementationOptions,
  generateArchitecture,
  generateImplementationPlan,
  getAppleTechnology,
  getCapabilityProfile,
  refreshCapabilityRegistry,
  reportRegistryCoverage,
  resolveCapabilities,
  searchAppleTechnologyCatalog,
  searchOfficialAppleDocs
} from "@/engine.js";
import { loadTechnologyCatalog } from "@/registry.js";

describe("read-only architecture tools", () => {
  it("returns profiles, comparisons, configuration audits, and privacy audits", async () => {
    const profile = await getCapabilityProfile("HealthKit");
    const comparison = await compareImplementationOptions(["healthkit", "core-location"], ["privacy"]);
    const configuration = await auditPermissionsAndEntitlements(["healthkit", "core-location"]);
    const privacy = await auditPrivacyAndReview(["healthkit", "core-location"]);

    expect(profile.data.id).toBe("healthkit");
    expect(comparison.data.options).toHaveLength(2);
    expect(configuration.data.entitlements).toContain("com.apple.developer.healthkit");
    expect(privacy.data.security_considerations ?? []).not.toHaveLength(0);
  });

  it("treats missing availability evidence as conditional", async () => {
    const withoutTarget = await checkAvailability({
      capability_ids: ["healthkit"],
      platform: "iOS",
      allow_beta: false
    });
    const incompatible = await checkAvailability({
      capability_ids: ["foundation-models"],
      platform: "iOS",
      os_version: "18.0",
      allow_beta: false
    });

    expect(withoutTarget.data.results[0]?.status).toBe("conditional_or_incompatible");
    expect(withoutTarget.data.results[0]?.determination).toBe("conditional");
    expect(incompatible.data.results[0]?.status).toBe("conditional_or_incompatible");
    expect(incompatible.data.results[0]?.determination).toBe("incompatible");
  });

  it("covers every declared availability state without converting uncertainty into success", async () => {
    const unsupported = await checkAvailability({
      capability_ids: ["core-motion"],
      platform: "tvOS",
      os_version: "26.0",
      allow_beta: false
    });
    const unknownMinimum = await checkAvailability({
      capability_ids: ["privacy-manifest"],
      platform: "iOS",
      os_version: "18.0",
      allow_beta: false
    });
    const betaRejected = await checkAvailability({
      capability_ids: ["ios-27-2-beta-additions"],
      platform: "iOS",
      os_version: "27.2",
      allow_beta: false
    });
    const betaAllowed = await checkAvailability({
      capability_ids: ["ios-27-2-beta-additions"],
      platform: "iOS",
      os_version: "27.2",
      allow_beta: true
    });
    const deprecated = await checkAvailability({
      capability_ids: ["uiwebview"],
      platform: "iOS",
      os_version: "18.0",
      allow_beta: false
    });

    expect(unsupported.data.results[0]?.reasons).toContain("tvOS is not listed as supported.");
    expect(unknownMinimum.data.results[0]?.reasons).toContain(
      "The minimum iOS version is not verified in this record."
    );
    expect(betaRejected.data.results[0]?.reasons).toContain("This record is beta and beta use was not allowed.");
    expect(betaAllowed.data.results[0]?.reasons).toContain("This record is beta and requires prerelease validation.");
    expect(deprecated.data.results[0]?.reasons).toContain(
      "This record is deprecated and is excluded from new implementation recommendations."
    );
  });

  it("keeps free-text device, region, and language restrictions conditional", async () => {
    const result = await checkAvailability({
      capability_ids: ["foundation-models"],
      platform: "iOS",
      os_version: "26.0",
      device: "iPhone 8",
      region: "TR",
      language: "Turkish",
      allow_beta: false
    });

    expect(result.data.results[0]).toMatchObject({
      determination: "conditional",
      declared_constraints: {
        platform: "iOS",
        os_version: "26.0",
        device: "iPhone 8",
        region: "TR",
        language: "Turkish",
        allow_beta: false
      }
    });
    expect(result.data.results[0]?.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("declared device"),
        expect.stringContaining("declared region"),
        expect.stringContaining("declared language")
      ])
    );
  });

  it("compares minor and patch OS versions instead of only their major version", async () => {
    const tooOld = await checkAvailability({
      capability_ids: ["activitykit"],
      platform: "iOS",
      os_version: "16.0",
      allow_beta: false
    });
    const minimum = await checkAvailability({
      capability_ids: ["activitykit"],
      platform: "iOS",
      os_version: "16.1.0",
      allow_beta: false
    });

    expect(tooOld.data.results[0]).toMatchObject({ determination: "incompatible" });
    expect(tooOld.data.results[0]?.reasons).toContain("Requires iOS 16.1 or later.");
    expect(minimum.data.results[0]).toMatchObject({ determination: "verified_compatible" });
  });

  it("treats a reviewed null platform minimum as unavailable rather than unknown", async () => {
    for (const capabilityId of ["app-attest", "apptrackingtransparency"]) {
      const result = await checkAvailability({
        capability_ids: [capabilityId],
        platform: "macOS",
        os_version: "26.0",
        allow_beta: false
      });

      expect(result.data.results[0]).toMatchObject({
        capability_id: capabilityId,
        determination: "incompatible",
        minimum_os_version: "unavailable"
      });
      expect(result.data.results[0]?.reasons).toContainEqual(expect.stringContaining("no usable macOS capability"));
    }
  });

  it("keeps deprecated capabilities out of default recommendations", async () => {
    const resolved = await resolveCapabilities({
      requirements: [
        {
          id: "req-web",
          kind: "platform",
          description: "Embed UIWebView web content",
          keywords: ["uiwebview", "web"],
          confidence: "explicit"
        }
      ],
      include_beta: false,
      maximum_results_per_requirement: 10
    });

    expect(resolved.data.matches.some((match) => match.capability_id === "uiwebview")).toBe(false);
  });

  it("promotes reviewed catalog identities while keeping adjacent catalog research leads separate", async () => {
    const resolved = await resolveCapabilities({
      requirements: [
        {
          id: "req-maps",
          kind: "product_goal",
          description: "Render a route with MapKit",
          keywords: ["MapKit"],
          confidence: "explicit"
        }
      ],
      include_beta: false,
      maximum_results_per_requirement: 4
    });

    expect(resolved.data.matches.some((match) => match.capability_id === "mapkit")).toBe(true);
    expect(resolved.data.catalog_research_leads).toEqual([]);

    const adjacent = await resolveCapabilities({
      requirements: [
        {
          id: "req-scanner",
          kind: "product_goal",
          description: "Provide document scanning with VisionKit",
          keywords: ["VisionKit"],
          confidence: "explicit"
        }
      ],
      include_beta: false,
      maximum_results_per_requirement: 4
    });
    expect(adjacent.data.catalog_research_leads).toHaveLength(1);
    expect(adjacent.data.catalog_research_leads[0]?.catalog_entry.id).toBe("technology.visionkit");
    expect(adjacent.data.catalog_research_leads[0]?.recommendation_eligible).toBe(false);
    expect(adjacent.data.matches.some((match) => match.capability_id === "vision")).toBe(false);

    const orderedLeads = await resolveCapabilities({
      requirements: [
        {
          id: "req-discovery",
          kind: "product_goal",
          description: "Compare RoomPlan with AlarmKit",
          keywords: ["RoomPlan", "AlarmKit"],
          confidence: "explicit"
        }
      ],
      include_beta: false,
      maximum_results_per_requirement: 4
    });
    expect(orderedLeads.data.catalog_research_leads.map(({ catalog_entry }) => catalog_entry.name)).toEqual([
      "AlarmKit",
      "RoomPlan"
    ]);
  });

  it("does not create matches or research leads from stopwords and substrings", async () => {
    const resolved = await resolveCapabilities({
      requirements: [
        {
          id: "req-garden",
          kind: "product_goal",
          description: "An app that should remain practical where the user prefers system support",
          keywords: ["app", "that", "should", "remain", "practical", "where", "user", "prefers", "system", "support"],
          confidence: "explicit"
        }
      ],
      include_beta: false,
      maximum_results_per_requirement: 4
    });

    expect(resolved.data.matches).toEqual([]);
    expect(resolved.data.catalog_research_leads).toEqual([]);
  });

  it("discriminates reviewed profiles from catalog-only technologies", async () => {
    const reviewed = await getAppleTechnology("HealthKit");

    expect(reviewed.data).toMatchObject({
      kind: "reviewed_profile",
      catalog_entry: { coverage_status: "profiled" },
      profile: { id: "healthkit" }
    });
    for (const [technology, profileId] of [
      ["URLSession", "urlsession"],
      ["Core Data", "core-data"],
      ["CloudKit", "cloudkit"],
      ["Keychain Services", "keychain-services"],
      ["AuthenticationServices", "authenticationservices"],
      ["CryptoKit", "cryptokit"],
      ["APNs", "apns"],
      ["AVFoundation", "avfoundation"],
      ["PhotoKit", "photokit"],
      ["Vision", "vision"],
      ["MapKit", "mapkit"],
      ["Core Bluetooth", "core-bluetooth"],
      ["Accessibility", "accessibility"],
      ["AppTrackingTransparency", "apptrackingtransparency"],
      ["App Attest", "app-attest"],
      ["Core Motion", "core-motion"],
      ["WeatherKit", "weatherkit"],
      ["LocalAuthentication", "local-authentication"],
      ["Core Spotlight", "core-spotlight"],
      ["Network", "network"],
      ["WebKit", "webkit"],
      ["EventKit", "eventkit"],
      ["Contacts", "contacts"]
    ] as const) {
      expect((await getAppleTechnology(technology)).data).toMatchObject({
        kind: "reviewed_profile",
        catalog_entry: { coverage_status: "profiled" },
        profile: { id: profileId }
      });
    }

    const catalogOnlyTechnologies = (await loadTechnologyCatalog())
      .filter((entry) => entry.coverage_status === "catalogued")
      .slice(0, 3)
      .map((entry) => entry.name);
    expect(catalogOnlyTechnologies).toHaveLength(3);

    for (const technology of catalogOnlyTechnologies) {
      const catalogOnly = await getAppleTechnology(technology);
      expect(catalogOnly.data).toMatchObject({
        kind: "catalog_only",
        recommendation_eligible: false
      });
      expect(catalogOnly.data).not.toHaveProperty("profile");
      expect(catalogOnly.data).not.toHaveProperty("minimum_os_version");
      expect(catalogOnly.data).not.toHaveProperty("sdk_availability");
      expect(catalogOnly.data).not.toHaveProperty("entitlements");
      if (catalogOnly.data.kind === "catalog_only") {
        expect(catalogOnly.data.unverified_profile_fields).toContain("minimum_os_version");
      }
    }
  });

  it("reports unknown configuration fields instead of treating empty arrays as verified absence", async () => {
    const audit = await auditPermissionsAndEntitlements(["core-ml"]);

    expect(audit.data.user_permissions).toEqual([]);
    expect(audit.data.knowledge_gaps).toContain("core-ml.user_permissions");
    expect(audit.warnings.join(" ")).toContain("not proof of no requirement");
  });

  it("builds proportional architecture and implementation phases", async () => {
    const architecture = await generateArchitecture("A private offline model app", ["core-ml"], "prototype");
    const plan = await generateImplementationPlan(["core-ml"], true);

    expect(architecture.data.pattern).toContain("Feature-local");
    expect(architecture.data.components).toEqual(expect.arrayContaining([expect.objectContaining({ layer: "AI/ML" })]));
    expect(plan.data.phases).toHaveLength(7);
  });

  it("covers positive and fallback architecture branches", async () => {
    const integrated = await generateArchitecture(
      "A shared on-device model with background delivery",
      ["swiftdata", "app-groups", "foundation-models", "background-tasks", "apns"],
      "large"
    );
    const minimal = await generateArchitecture("A simple local app", ["swift"], "small");
    const integratedText = JSON.stringify(integrated.data.components);
    const minimalText = JSON.stringify(minimal.data.components);

    expect(integrated.data.pattern).toContain("Feature modules");
    expect(integratedText).toContain("SwiftData");
    expect(integratedText).toContain("App Group container");
    expect(integratedText).toContain("URLSession");
    expect(integratedText).toContain("Runtime availability gate");
    expect(integratedText).toContain("Event-driven");
    expect(minimalText).toContain("smallest persistence mechanism");
    expect(minimalText).toContain("app container");
    expect(minimalText).toContain("No server by default");
    expect(minimalText).toContain("Not required");
    expect(minimalText).toContain("Foreground-only");
  });

  it("extracts all architecture-changing questions and explicit assumptions", () => {
    const analysis = analyzeAppIdea({
      idea: "A machine learning health background assistant",
      target_platform: "iOS",
      minimum_os_version: "18.0",
      preferred_ui_framework: "UIKit",
      on_device_priority: "required",
      privacy_level: "sensitive"
    });

    expect(analysis.data.open_questions).toEqual([
      "Which exact data types must the app read, write, or derive?",
      "Is background work event-driven, periodic, or expected to be continuous?",
      "What input and output modality must the AI feature support?"
    ]);
    expect(analysis.data.requirements).toContainEqual(
      expect.objectContaining({ id: "req-on_device", description: "Processing must remain on device" })
    );
    expect(analysis.data.assumptions).toContain("The deployment target is 18.0.");
  });

  it("searches verified sources and the broader discovery catalog separately", async () => {
    const docs = await searchOfficialAppleDocs("HealthKit", ["healthkit"], 5);
    const discoveredDocs = await searchOfficialAppleDocs("HealthKit", [], 5);
    const unrelatedDocs = await searchOfficialAppleDocs("definitely-unrelated-query", ["healthkit"], 5);
    const catalog = await searchAppleTechnologyCatalog("AlarmKit", "catalogued", 5);
    const coverage = await reportRegistryCoverage();

    expect(docs.data.results[0]?.url).toMatch(/^https:\/\/developer\.apple\.com\//);
    expect(discoveredDocs.data.results[0]?.url).toMatch(/^https:\/\/developer\.apple\.com\//);
    expect(unrelatedDocs.data.results).toEqual([]);
    expect(catalog.data.results[0]?.coverage_status).toBe("catalogued");
    expect(coverage.data.catalog_only_technology_count).toBeGreaterThan(100);
  });

  it("omits knowledge-gap warnings when every audited field is reviewed", async () => {
    const configuration = await auditPermissionsAndEntitlements(["core-spotlight"]);
    const privacy = await auditPrivacyAndReview(["core-spotlight"]);

    expect(configuration.data.knowledge_gaps).toEqual([]);
    expect(configuration.warnings).toEqual([]);
    expect(privacy.data.knowledge_gaps).toEqual([]);
    expect(privacy.warnings).toEqual([]);
  });

  it("keeps registry refreshes read-only", async () => {
    const dryRun = await refreshCapabilityRegistry(true, []);
    const refusedMutation = await refreshCapabilityRegistry(false, [
      "https://developer.apple.com/documentation/healthkit"
    ]);

    expect(dryRun.data.updated).toBe(false);
    expect(dryRun.data.dry_run).toBe(true);
    expect(refusedMutation.data.updated).toBe(false);
    expect(refusedMutation.warnings[0]).toContain("mutation is intentionally disabled");
  });

  it("rejects unknown profiles", async () => {
    await expect(getCapabilityProfile("not-a-real-capability")).rejects.toThrow("Unknown capability");
    await expect(getAppleTechnology("not-a-real-technology")).rejects.toThrow("Unknown Apple technology");
    await expect(compareImplementationOptions(["not-a-real-capability"], [])).rejects.toThrow(
      "Unknown capabilities: not-a-real-capability"
    );
  });
});
