import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  checkAvailability as CheckAvailabilityFunction,
  resolveCapabilities as ResolveCapabilitiesFunction
} from "@/engine.js";
import type * as RegistryModule from "@/registry.js";
import type { CapabilityRecord } from "@/types.js";

vi.mock("@/registry.js", async (importOriginal) => {
  const actual = await importOriginal<typeof RegistryModule>();
  const records = (await actual.loadRegistry()).map((record): CapabilityRecord => ({
    ...record,
    stable_or_beta: "unknown"
  }));
  return {
    ...actual,
    loadRegistry: async () => records,
    findRecord: async (idOrName: string) =>
      records.find(
        (record) =>
          record.id === idOrName.toLocaleLowerCase("en-US") ||
          record.name.toLocaleLowerCase("en-US") === idOrName.toLocaleLowerCase("en-US")
      )
  };
});

let checkAvailability: typeof CheckAvailabilityFunction;
let resolveCapabilities: typeof ResolveCapabilitiesFunction;

beforeAll(async () => {
  ({ checkAvailability, resolveCapabilities } = await import("@/engine.js"));
});

describe("unknown lifecycle safeguards", () => {
  it("keeps unknown lifecycle records conditional and warns on matched recommendations", async () => {
    const resolved = await resolveCapabilities({
      requirements: [
        {
          id: "req-health",
          kind: "data",
          description: "Read HealthKit health data",
          keywords: ["HealthKit"],
          confidence: "explicit"
        }
      ],
      include_beta: false,
      maximum_results_per_requirement: 3
    });
    const availability = await checkAvailability({
      capability_ids: ["healthkit"],
      platform: "iOS",
      os_version: "18.0",
      allow_beta: false
    });

    expect(resolved.data.matches.length).toBeGreaterThan(0);
    expect(resolved.warnings).toContain(
      "Some matches have an unknown lifecycle. Verify their current SDK status before implementation."
    );
    expect(availability.data.results[0]).toMatchObject({ determination: "conditional", stable_or_beta: "unknown" });
    expect(availability.data.results[0]?.reasons).toContain(
      "The current lifecycle status is not verified in this record."
    );
  });
});
