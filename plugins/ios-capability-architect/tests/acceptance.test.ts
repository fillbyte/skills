import { describe, expect, it } from "vitest";
import {
  analyzeAppIdea,
  auditPermissionsAndEntitlements,
  checkAvailability,
  compareImplementationOptions,
  getCapabilityProfile,
  resolveCapabilities
} from "@/engine.js";

describe("acceptance scenarios", () => {
  it("maps a health app to permissions, sensitive-data rules, and bounded background delivery", async () => {
    const analysis = analyzeAppIdea({
      idea: "Uyku düzenini analiz eden, verileri cihazda işleyen ve gerektiğinde bildirim gönderen bir iOS uygulaması.",
      target_platform: "iOS",
      preferred_ui_framework: "SwiftUI",
      on_device_priority: "required",
      privacy_level: "regulated"
    });
    const resolved = await resolveCapabilities({
      requirements: analysis.data.requirements,
      include_beta: false,
      maximum_results_per_requirement: 5
    });
    expect(resolved.data.matches.some((match) => match.capability_id === "healthkit")).toBe(true);
    const audit = await auditPermissionsAndEntitlements(["healthkit", "healthkit-background-delivery"]);
    expect(audit.data.user_permissions?.join(" ")).toContain("HealthKit");
    expect(audit.data.info_plist_keys).toContain("NSHealthShareUsageDescription");
    expect(audit.data.entitlements).toContain("com.apple.developer.healthkit.background-delivery");
    expect((await getCapabilityProfile("healthkit-background-delivery")).data.limitations.join(" ")).toContain(
      "system controls"
    );
  });

  it("compares offline AI and rejects unqualified Foundation Models availability", async () => {
    const comparison = await compareImplementationOptions(
      ["core-ml", "foundation-models"],
      ["on_device", "hardware", "minimum_os"]
    );
    expect(comparison.data.options).toHaveLength(2);
    expect(comparison.data.options.every((option) => option.on_device === "fully_on_device")).toBe(true);
    const availability = await checkAvailability({
      capability_ids: ["foundation-models"],
      platform: "iOS",
      os_version: "26.0",
      allow_beta: false
    });
    expect(availability.data.results[0]?.status).toBe("conditional_or_incompatible");
    expect((availability.data.results[0]?.reasons as string[]).join(" ")).toContain("hardware");
  });

  it("reports background location permissions, energy and review risk", async () => {
    const profile = (await getCapabilityProfile("core-location")).data;
    expect(profile.background_modes).toContain("UIBackgroundModes: location");
    expect(profile.info_plist_keys).toContain("NSLocationAlwaysAndWhenInUseUsageDescription");
    expect(profile.limitations.join(" ")).toMatch(/Energy|suspend|terminate/i);
    expect(profile.app_review_considerations.join(" ")).toContain("Always");
  });

  it("keeps WidgetKit, ActivityKit, App Intents, extension, and App Groups distinct", async () => {
    const widget = (await getCapabilityProfile("widgetkit")).data;
    const activity = (await getCapabilityProfile("activitykit")).data;
    const intents = (await getCapabilityProfile("app-intents")).data;
    const groups = (await getCapabilityProfile("app-groups")).data;
    expect(widget.related_extensions).toContain("Widget Extension");
    expect(activity.info_plist_keys).toContain("NSSupportsLiveActivities");
    expect(intents.entity_type).toBe("framework");
    expect(groups.entitlements).toContain("com.apple.security.application-groups");
  });

  it("labels Family Controls as a managed distribution entitlement", async () => {
    const profile = (await getCapabilityProfile("family-controls-managed-entitlement")).data;
    expect(profile.entity_type).toBe("managed_entitlement");
    expect(profile.managed_entitlements.join(" ")).toContain("approval");
    expect(profile.recommended_alternatives.length).toBeGreaterThan(0);
  });

  it("marks UIWebView deprecated and provides modern migration options", async () => {
    const profile = (await getCapabilityProfile("UIWebView")).data;
    expect(profile.stable_or_beta).toBe("deprecated");
    expect(profile.recommended_alternatives).toContain("WKWebView for configurable embedded web content");
  });

  it("uses assumptions and no more than three questions for an ambiguous idea", () => {
    const analysis = analyzeAppIdea({
      idea: "İnsanların günlük rutinlerini daha iyi yönetmesine yardımcı olan bir iOS uygulaması yapmak istiyorum.",
      target_platform: "iOS",
      preferred_ui_framework: "unspecified",
      on_device_priority: "preferred",
      privacy_level: "standard"
    });
    expect(analysis.data.assumptions.length).toBeGreaterThan(0);
    expect(analysis.data.open_questions.length).toBeLessThanOrEqual(3);
    expect(analysis.data.requirements[0]?.kind).toBe("product_goal");
  });

  it("excludes iOS 27.2 beta records by default", async () => {
    const requirement = [
      {
        id: "req-beta",
        kind: "privacy" as const,
        description: "iOS 27.2 beta expanded tracking prompt",
        keywords: ["expanded prompt", "ios 27.2"],
        confidence: "explicit" as const
      }
    ];
    const stable = await resolveCapabilities({
      requirements: requirement,
      include_beta: false,
      maximum_results_per_requirement: 10
    });
    const beta = await resolveCapabilities({
      requirements: requirement,
      include_beta: true,
      maximum_results_per_requirement: 10
    });
    expect(stable.data.matches.some((match) => match.capability_id === "ios-27-2-beta-additions")).toBe(false);
    expect(beta.data.matches.some((match) => match.capability_id === "ios-27-2-beta-additions")).toBe(true);
  });
});
