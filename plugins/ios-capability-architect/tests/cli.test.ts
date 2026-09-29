import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "@/cli.js";

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    streams: {
      stdout: (value: string) => {
        stdout += value;
      },
      stderr: (value: string) => {
        stderr += value;
      }
    },
    stdout: () => stdout,
    stderr: () => stderr
  };
}

describe("skills-only CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses process streams when no custom streams are supplied", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(runCli(["--help"])).resolves.toBe(0);
    await expect(runCli(["unknown-command"])).resolves.toBe(1);

    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("iOS Capability Architect CLI"));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
  });

  it("prints help without invoking a command", async () => {
    const output = capture();
    await expect(runCli(["--help"], output.streams)).resolves.toBe(0);
    expect(output.stdout()).toContain("audit-project");
    expect(output.stderr()).toBe("");
  });

  it("analyzes an idea as structured JSON", async () => {
    const output = capture();
    await expect(runCli(["analyze", "--idea", "An offline health app with reminders"], output.streams)).resolves.toBe(
      0
    );
    const result = JSON.parse(output.stdout()) as { schema_version: string; data: { requirements: unknown[] } };
    expect(result.schema_version).toBe("1.0");
    expect(result.data.requirements.length).toBeGreaterThan(1);
  });

  it("returns a verified capability profile", async () => {
    const output = capture();
    await expect(runCli(["profile", "healthkit"], output.streams)).resolves.toBe(0);
    const result = JSON.parse(output.stdout()) as { data: { id: string } };
    expect(result.data.id).toBe("healthkit");

    const optionFallback = capture();
    await expect(runCli(["profile", "--capability", "healthkit"], optionFallback.streams)).resolves.toBe(0);
    expect(JSON.parse(optionFallback.stdout())).toMatchObject({ data: { id: "healthkit" } });
  });

  it("returns an exact catalog-only technology without promoting it to a profile", async () => {
    const output = capture();
    await expect(runCli(["technology", "RoomPlan"], output.streams)).resolves.toBe(0);
    const result = JSON.parse(output.stdout()) as {
      data: { kind: string; recommendation_eligible: boolean; catalog_entry: { id: string } };
    };
    expect(result.data).toMatchObject({
      kind: "catalog_only",
      recommendation_eligible: false,
      catalog_entry: { id: "technology.roomplan" }
    });

    const queryFallback = capture();
    await expect(runCli(["technology", "--query", "RoomPlan"], queryFallback.streams)).resolves.toBe(0);
    expect(JSON.parse(queryFallback.stdout())).toMatchObject({
      data: { catalog_entry: { id: "technology.roomplan" } }
    });

    const positionalCatalog = capture();
    await expect(runCli(["catalog", "HealthKit"], positionalCatalog.streams)).resolves.toBe(0);
    const positionalResults = JSON.parse(positionalCatalog.stdout()) as { data: { results: Array<{ id: string }> } };
    expect(positionalResults.data.results.some(({ id }) => id === "technology.healthkit")).toBe(true);
  });

  it("runs the bounded project audit", async () => {
    const output = capture();
    await expect(
      runCli(["audit-project", "--root", process.cwd(), "--capability", "privacy-manifest"], output.streams)
    ).resolves.toBe(0);
    const result = JSON.parse(output.stdout()) as { data: { scanned_files: string[]; findings: unknown[] } };
    expect(result.data.scanned_files).toEqual(expect.any(Array));
    expect(result.data.findings.length).toBeGreaterThan(0);
  });

  it("keeps recoverable input errors on stderr", async () => {
    const output = capture();
    await expect(runCli(["audit-project", "--root", process.cwd()], output.streams)).resolves.toBe(1);
    expect(output.stdout()).toBe("");
    expect(output.stderr()).toContain("Provide at least one --capability");
  });

  it("resolves an idea with beta excluded by default", async () => {
    const output = capture();
    await expect(
      runCli(["resolve", "--idea", "A health app with background reminders", "--limit", "3"], output.streams)
    ).resolves.toBe(0);
    const result = JSON.parse(output.stdout()) as {
      analysis: { data: { requirements: unknown[] } };
      resolution: { data: { matches: Array<{ record: { stable_or_beta: string } }> } };
    };
    expect(result.analysis.data.requirements.length).toBeGreaterThan(1);
    expect(result.resolution.data.matches.every((match) => match.record.stable_or_beta !== "beta")).toBe(true);
  });

  it("keeps an exact catalog-only technology out of reviewed recommendations", async () => {
    const output = capture();
    await expect(runCli(["resolve", "--idea", "An app using RoomPlan", "--limit", "5"], output.streams)).resolves.toBe(
      0
    );
    const result = JSON.parse(output.stdout()) as {
      resolution: {
        data: {
          matches: unknown[];
          catalog_research_leads: Array<{ catalog_entry: { id: string }; recommendation_eligible: boolean }>;
        };
      };
    };
    expect(result.resolution.data.matches).toEqual([]);
    expect(result.resolution.data.catalog_research_leads).toHaveLength(1);
    expect(result.resolution.data.catalog_research_leads[0]?.recommendation_eligible).toBe(false);
    expect(result.resolution.data.catalog_research_leads[0]?.catalog_entry.id).toBe("technology.roomplan");
  });

  it("exposes availability, configuration, and privacy audits", async () => {
    for (const args of [
      ["availability", "--capability", "healthkit", "--minimum-os", "18"],
      ["audit-requirements", "--capability", "healthkit,user-notifications"],
      ["audit-privacy", "--capability", "healthkit"]
    ]) {
      const output = capture();
      await expect(runCli(args, output.streams)).resolves.toBe(0);
      expect(JSON.parse(output.stdout())).toMatchObject({ schema_version: "1.0" });
    }
  });

  it("generates architecture and implementation planning output", async () => {
    const architecture = capture();
    await expect(
      runCli(
        ["architecture", "--idea", "A health journal", "--capability", "healthkit", "--scale", "prototype"],
        architecture.streams
      )
    ).resolves.toBe(0);
    const architectureResult = JSON.parse(architecture.stdout()) as { data: { pattern: string } };
    expect(architectureResult.data.pattern).toContain("Feature-local");

    const plan = capture();
    await expect(runCli(["plan", "--capability", "healthkit", "--code-spike"], plan.streams)).resolves.toBe(0);
    const planResult = JSON.parse(plan.stdout()) as { data: { phases: unknown[] } };
    expect(planResult.data.phases).toHaveLength(7);
  });

  it("uses schema defaults and rejects unsupported constrained values", async () => {
    const architecture = capture();
    await expect(
      runCli(["architecture", "--idea", "A health journal", "--capability", "healthkit"], architecture.streams)
    ).resolves.toBe(0);
    expect(JSON.parse(architecture.stdout())).toMatchObject({ data: { project_scale: "small" } });

    const plan = capture();
    await expect(runCli(["plan", "--capability", "healthkit", "--no-code-spike"], plan.streams)).resolves.toBe(0);
    const planResult = JSON.parse(plan.stdout()) as { data: { phases: Array<{ deliverables: string[] }> } };
    expect(planResult.data.phases[0]?.deliverables).toEqual(["Documented feasibility result"]);

    const macApp = capture();
    await expect(
      runCli(
        ["analyze", "--idea", "A native macOS document organizer", "--platform", "macOS", "--ui", "AppKit"],
        macApp.streams
      )
    ).resolves.toBe(0);
    const macAppResult = JSON.parse(macApp.stdout()) as { data: { assumptions: string[] } };
    expect(macAppResult.data.assumptions).toContain("macOS is the primary target.");
    expect(macAppResult.data.assumptions).toContain("AppKit is the default UI approach.");

    for (const args of [
      ["analyze", "--idea", "A health journal", "--platform", "android"],
      ["architecture", "--idea", "A health journal", "--capability", "healthkit", "--scale", "production"],
      ["availability", "--capability", "healthkit", "--minimum-os", "latest"]
    ]) {
      const output = capture();
      await expect(runCli(args, output.streams)).resolves.toBe(1);
      expect(output.stdout()).toBe("");
      expect(output.stderr()).toContain("ios-capability-architect:");
    }
  });

  it("searches verified sources and the discovery catalog", async () => {
    const sources = capture();
    await expect(
      runCli(["search", "HealthKit", "authorization", "--capability", "healthkit"], sources.streams)
    ).resolves.toBe(0);
    const sourceResult = JSON.parse(sources.stdout()) as { data: { results: unknown[] } };
    expect(sourceResult.data.results.length).toBeGreaterThan(0);

    const catalog = capture();
    await expect(
      runCli(["catalog", "--query", "HealthKit", "--coverage", "profiled", "--limit", "5"], catalog.streams)
    ).resolves.toBe(0);
    const catalogResult = JSON.parse(catalog.stdout()) as {
      data: { results: Array<{ coverage_status: string }> };
    };
    expect(catalogResult.data.results[0]?.coverage_status).toBe("profiled");

    const coverage = capture();
    await expect(runCli(["coverage"], coverage.streams)).resolves.toBe(0);
    const coverageResult = JSON.parse(coverage.stdout()) as { data: { profiled_technology_count: number } };
    expect(coverageResult.data.profiled_technology_count).toBeGreaterThan(0);
  });

  it("rejects invalid commands and bounded numeric options", async () => {
    const invalidCommand = capture();
    await expect(runCli(["erase-project"], invalidCommand.streams)).resolves.toBe(1);
    expect(invalidCommand.stderr()).toContain("Unknown command");

    const invalidLimit = capture();
    await expect(runCli(["coverage", "--limit", "0"], invalidLimit.streams)).resolves.toBe(1);
    expect(invalidLimit.stderr()).toContain("--limit must be an integer");

    for (const limit of ["1.5", "101"]) {
      const invalidBound = capture();
      await expect(runCli(["coverage", "--limit", limit], invalidBound.streams)).resolves.toBe(1);
      expect(invalidBound.stderr()).toContain("--limit must be an integer");
    }

    const invalidCoverage = capture();
    await expect(
      runCli(["catalog", "--query", "HealthKit", "--coverage", "verified"], invalidCoverage.streams)
    ).resolves.toBe(1);
    expect(invalidCoverage.stderr()).toContain("Invalid option");

    const conflictingFlags = capture();
    await expect(
      runCli(["plan", "--capability", "healthkit", "--code-spike", "--no-code-spike"], conflictingFlags.streams)
    ).resolves.toBe(1);
    expect(conflictingFlags.stderr()).toContain("Use either --code-spike or --no-code-spike");

    const missingIdea = capture();
    await expect(runCli(["analyze"], missingIdea.streams)).resolves.toBe(1);
    expect(missingIdea.stderr()).toContain("Missing required option: --idea");

    const nonError = capture();
    await expect(
      runCli(["coverage"], {
        stdout: () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- Exercises defensive normalization of host callbacks that violate the Error convention.
          throw "non-error failure";
        },
        stderr: nonError.streams.stderr
      })
    ).resolves.toBe(1);
    expect(nonError.stderr()).toContain("non-error failure");
  });
});
