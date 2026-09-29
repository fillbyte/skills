import { describe, expect, it } from "vitest";
import { getRegistryCoverage, loadTechnologyCatalog, searchTechnologyCatalog } from "@/registry.js";

describe("Apple technology catalog coverage", () => {
  it("deduplicates the official-index catalog and distinguishes profiles", async () => {
    const catalog = await loadTechnologyCatalog();
    const coverage = await getRegistryCoverage();

    expect(catalog.length).toBeGreaterThanOrEqual(170);
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
    expect(coverage.catalogued_technology_count).toBe(catalog.length);
    expect(coverage.profiled_technology_count).toBe(83);
    expect(coverage.catalog_only_technology_count).toBe(120);
    expect(coverage.profile_coverage_percent).toBe(40.9);
    expect(coverage.verified_profile_count).toBe(79);
    expect(coverage.complete_profile_count + coverage.partial_profile_count).toBe(coverage.verified_profile_count);
    expect(coverage.partial_profile_count).toBeGreaterThan(0);
    expect(coverage.official_index_sources).toHaveLength(4);
  });

  it("finds catalog-only technologies without promoting them to profiles", async () => {
    const [alarmKit] = await searchTechnologyCatalog("AlarmKit");
    expect(alarmKit?.name).toBe("AlarmKit");
    expect(alarmKit?.coverage_status).toBe("catalogued");
    expect(alarmKit?.profile_ids).toEqual([]);
  });
});
