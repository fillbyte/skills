import { z } from "zod";
import {
  entityTypes,
  knowledgeStates,
  knowledgeTrackedFields,
  onDeviceLevels,
  relationshipTypes,
  stabilityLevels
} from "@/types.js";

const documentationReferenceSchema = z.object({
  title: z.string().min(1),
  url: z.url().refine(
    (url) => {
      const parsed = new URL(url);
      return (
        parsed.protocol === "https:" &&
        (parsed.hostname === "developer.apple.com" || parsed.hostname === "developers.openai.com")
      );
    },
    {
      message: "Only official Apple Developer or OpenAI Developer documentation URLs are allowed"
    }
  ),
  source_type: z.enum([
    "apple_developer_documentation",
    "release_notes",
    "wwdc",
    "hig",
    "app_store_review_guidelines",
    "apple_support",
    "openai_plugin_documentation"
  ]),
  verified_at: z.iso.date()
});

const capabilityRelationshipSchema = z.object({
  type: z.enum(relationshipTypes),
  target: z.string().min(1)
});

const knowledgeStateSchema = z.object({
  completeness: z.enum(["complete", "partial"]),
  fields: z.record(z.enum(knowledgeTrackedFields), z.enum(knowledgeStates))
});

const osVersionSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d+){0,2}(?:\s+(?:beta|rc)(?:\s+\d+)?)?$/i, "Use a numeric OS version such as 18 or 18.1");

const capabilityIdentifierSchema = z.string().trim().min(1).max(200);
const availabilityContextSchema = z.string().trim().min(1).max(200);
const officialAppleDeveloperUrlSchema = z.url().refine(
  (url) => {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "developer.apple.com";
  },
  { message: "Use an official https://developer.apple.com URL" }
);

export const capabilityRecordSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    name: z.string().min(1),
    aliases: z.array(z.string()),
    category: z.string().min(1),
    entity_type: z.enum(entityTypes),
    summary: z.string().min(1),
    supported_use_cases: z.array(z.string()),
    unsupported_use_cases: z.array(z.string()),
    related_frameworks: z.array(z.string()),
    related_capabilities: z.array(z.string()),
    related_entitlements: z.array(z.string()),
    related_extensions: z.array(z.string()),
    relationships: z.array(capabilityRelationshipSchema),
    platforms: z.array(z.string()).min(1),
    minimum_os_version: z.record(z.string(), z.string().nullable()),
    sdk_availability: z.string().min(1),
    stable_or_beta: z.enum(stabilityLevels),
    deprecated_status: z.string().nullable(),
    supported_devices: z.array(z.string()),
    hardware_requirements: z.array(z.string()),
    region_restrictions: z.array(z.string()),
    language_restrictions: z.array(z.string()),
    on_device_level: z.enum(onDeviceLevels),
    network_requirement: z.string(),
    cloud_dependency: z.string().nullable(),
    user_permissions: z.array(z.string()),
    info_plist_keys: z.array(z.string()),
    xcode_capabilities: z.array(z.string()),
    entitlements: z.array(z.string()),
    managed_entitlements: z.array(z.string()),
    background_modes: z.array(z.string()),
    privacy_manifest_requirements: z.array(z.string()),
    required_reason_apis: z.array(z.string()),
    app_review_considerations: z.array(z.string()),
    security_considerations: z.array(z.string()),
    implementation_notes: z.array(z.string()),
    limitations: z.array(z.string()),
    recommended_alternatives: z.array(z.string()),
    official_documentation: z.array(documentationReferenceSchema).min(1),
    release_notes: z.array(documentationReferenceSchema),
    last_verified_at: z.iso.date(),
    keywords: z.array(z.string()).min(1),
    knowledge_state: knowledgeStateSchema
  })
  .superRefine((record, context) => {
    const dates = [...record.official_documentation, ...record.release_notes].map((reference) => reference.verified_at);
    if (!dates.includes(record.last_verified_at)) {
      context.addIssue({
        code: "custom",
        path: ["last_verified_at"],
        message: "last_verified_at must match at least one source verification date"
      });
    }
    if (record.stable_or_beta === "deprecated" && !record.deprecated_status) {
      context.addIssue({
        code: "custom",
        path: ["deprecated_status"],
        message: "Deprecated records must explain their status"
      });
    }
    if (
      record.knowledge_state.completeness === "complete" &&
      Object.values(record.knowledge_state.fields).some((state) => state === "unknown")
    ) {
      context.addIssue({
        code: "custom",
        path: ["knowledge_state", "completeness"],
        message: "Complete records cannot contain unknown tracked fields"
      });
    }
  });

export const capabilityRegistrySchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: z.iso.datetime({ offset: true }),
    records: z.array(capabilityRecordSchema).min(1)
  })
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    registry.records.forEach((record, index) => {
      if (ids.has(record.id)) {
        context.addIssue({ code: "custom", path: ["records", index, "id"], message: `Duplicate id: ${record.id}` });
      }
      ids.add(record.id);
    });
  });

export const analyzeIdeaInputSchema = z.object({
  idea: z
    .string()
    .trim()
    .min(10)
    .max(10_000)
    .describe("Natural-language Apple-platform product idea or feature request."),
  target_platform: z
    .enum(["iOS", "iPadOS", "macOS", "watchOS", "tvOS", "visionOS", "Mac Catalyst", "multi-platform"])
    .default("iOS")
    .describe("Primary Apple platform or multi-platform scope."),
  minimum_os_version: osVersionSchema.optional().describe("Deployment target such as 18 or 18.1."),
  preferred_ui_framework: z
    .enum(["SwiftUI", "UIKit", "AppKit", "unspecified"])
    .default("SwiftUI")
    .describe("Preferred presentation framework; choose unspecified when no preference exists."),
  on_device_priority: z
    .enum(["required", "preferred", "neutral"])
    .default("preferred")
    .describe("Whether local and offline processing is mandatory, preferred, or neutral."),
  privacy_level: z
    .enum(["standard", "sensitive", "regulated"])
    .default("standard")
    .describe("Highest expected data-sensitivity and compliance level.")
});

export const resolveCapabilitiesInputSchema = z.object({
  requirements: z
    .array(
      z.object({
        id: capabilityIdentifierSchema.describe("Stable requirement identifier unique within this request."),
        kind: z
          .enum([
            "product_goal",
            "data",
            "hardware",
            "background",
            "notification",
            "on_device",
            "networking",
            "ai_ml",
            "privacy",
            "monetization",
            "platform"
          ])
          .describe("Requirement category used for deterministic capability matching."),
        description: z
          .string()
          .trim()
          .min(1)
          .max(2_000)
          .describe("Concrete product or technical requirement without implementation guesses."),
        keywords: z
          .array(z.string().trim().min(1).max(100))
          .max(50)
          .default([])
          .describe("Relevant framework, feature, domain, or constraint terms; omit generic filler words."),
        confidence: z
          .enum(["explicit", "inferred"])
          .default("explicit")
          .describe("Whether the user stated the requirement or the analysis inferred it.")
      })
    )
    .min(1)
    .max(100)
    .describe("Structured requirements returned by analyze_app_idea or prepared with the same fields."),
  include_beta: z.boolean().default(false).describe("Allow prerelease capability profiles in matches."),
  maximum_results_per_requirement: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(4)
    .describe("Maximum reviewed matches returned for each requirement.")
});

export const getProfileInputSchema = z.object({
  capability_id_or_name: capabilityIdentifierSchema.describe("Exact or recognizable reviewed capability ID or name.")
});

export const getAppleTechnologyInputSchema = z.object({
  technology_id_or_name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("Exact Apple technology catalog ID or name, such as RoomPlan or technology.roomplan.")
});

export const technologyCatalogEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category_ids: z.array(z.string().min(1)).min(1),
  category_names: z.array(z.string().min(1)).min(1),
  coverage_status: z.enum(["catalogued", "profiled"]),
  profile_ids: z.array(z.string().min(1)),
  source_urls: z.array(z.url()).min(1)
});

export const getAppleTechnologyResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("reviewed_profile"),
    catalog_entry: technologyCatalogEntrySchema,
    profile: capabilityRecordSchema
  }),
  z.object({
    kind: z.literal("catalog_only"),
    catalog_entry: technologyCatalogEntrySchema,
    recommendation_eligible: z.literal(false),
    verified_scope: z.tuple([
      z.literal("catalog identity"),
      z.literal("taxonomy categories"),
      z.literal("catalog provenance URLs")
    ]),
    unverified_profile_fields: z.array(z.string()).min(1),
    next_step: z.literal("Review current official Apple documentation before making an architecture recommendation.")
  })
]);

export const compareOptionsInputSchema = z.object({
  capability_ids: z
    .array(capabilityIdentifierSchema)
    .min(2)
    .max(6)
    .describe("Two through six reviewed capability IDs to compare."),
  criteria: z
    .array(
      z.enum([
        "complexity",
        "minimum_os",
        "on_device",
        "privacy",
        "performance",
        "energy",
        "hardware",
        "entitlement",
        "app_review",
        "maintenance",
        "testability"
      ])
    )
    .default(["complexity", "minimum_os", "on_device", "privacy", "app_review", "testability"])
    .describe("Decision criteria to emphasize in the comparison.")
});

export const checkAvailabilityInputSchema = z.object({
  capability_ids: z.array(capabilityIdentifierSchema).min(1).max(30).describe("Reviewed capability IDs to check."),
  platform: z
    .enum(["iOS", "iPadOS", "macOS", "watchOS", "tvOS", "visionOS", "Mac Catalyst"])
    .default("iOS")
    .describe("Apple platform whose compatibility should be evaluated."),
  os_version: osVersionSchema.optional().describe("Target OS version such as 18 or 18.1."),
  device: availabilityContextSchema
    .optional()
    .describe("Declared device family or model; free-text registry constraints still require a runtime check."),
  region: availabilityContextSchema
    .optional()
    .describe("Declared deployment region; free-text regional constraints still require current verification."),
  language: availabilityContextSchema
    .optional()
    .describe("Declared user or feature language; free-text language constraints still require current verification."),
  allow_beta: z.boolean().default(false).describe("Treat prerelease profiles as conditional candidates.")
});

export const auditInputSchema = z.object({
  capability_ids: z
    .array(capabilityIdentifierSchema)
    .min(1)
    .max(30)
    .describe("Reviewed capability IDs included in the audit.")
});

export const projectConfigurationAuditInputSchema = z.object({
  project_root: z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .describe("Local project directory explicitly placed in scope for a bounded read-only scan."),
  capability_ids: z
    .array(capabilityIdentifierSchema)
    .min(1)
    .max(30)
    .describe("Reviewed capability IDs whose configuration requirements should be checked."),
  platform: z
    .enum(["iOS", "iPadOS", "watchOS", "tvOS", "visionOS", "macOS", "Mac Catalyst"])
    .default("iOS")
    .describe("Target platform used to evaluate the reviewed availability requirements.")
});

export const architectureInputSchema = z.object({
  idea: z.string().trim().min(10).max(10_000).describe("Apple-platform app or feature being architected."),
  capability_ids: z.array(capabilityIdentifierSchema).min(1).max(30).describe("Selected reviewed capability IDs."),
  project_scale: z
    .enum(["prototype", "small", "medium", "large"])
    .default("small")
    .describe("Expected product scale used to keep the architecture proportionate.")
});

export const implementationPlanInputSchema = z.object({
  capability_ids: z.array(capabilityIdentifierSchema).min(1).max(30).describe("Selected reviewed capability IDs."),
  include_code_spike: z
    .boolean()
    .default(true)
    .describe("Include a small feasibility implementation before the MVP phases.")
});

export const officialDocsSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(200).describe("Terms to match against the verified local Apple source index."),
  capability_ids: z
    .array(capabilityIdentifierSchema)
    .max(20)
    .default([])
    .describe("Optional reviewed capability IDs that bound the source search."),
  maximum_results: z.number().int().min(1).max(20).default(10).describe("Maximum source references to return.")
});

export const technologyCatalogSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(200).describe("Apple technology name or discovery terms."),
  coverage_status: z
    .enum(["all", "catalogued", "profiled"])
    .default("all")
    .describe("Return every catalog entry, catalog-only entries, or reviewed-profile entries."),
  maximum_results: z.number().int().min(1).max(50).default(20).describe("Maximum catalog entries to return.")
});

export const registryCoverageInputSchema = z.object({});

export const refreshRegistryInputSchema = z.object({
  dry_run: z
    .boolean()
    .default(true)
    .describe("Keep true for a refresh plan; false only confirms that runtime mutation is refused."),
  source_urls: z
    .array(officialAppleDeveloperUrlSchema)
    .max(50)
    .default([])
    .describe("Optional developer.apple.com source URLs to include in the non-mutating refresh plan.")
});
