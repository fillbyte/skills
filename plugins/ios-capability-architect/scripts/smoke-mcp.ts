import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const pluginRoot = process.env.PLUGIN_SMOKE_ROOT ?? fileURLToPath(new URL("..", import.meta.url));
const packageMetadata: unknown = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
if (
  typeof packageMetadata !== "object" ||
  packageMetadata === null ||
  !("version" in packageMetadata) ||
  typeof packageMetadata.version !== "string"
) {
  throw new Error("Package metadata has no string version");
}
const expectedVersion = packageMetadata.version;
const client = new Client({ name: "ios-capability-architect-smoke", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: "node",
  args: ["./bundle/server.mjs"],
  cwd: pluginRoot,
  stderr: "pipe"
});

try {
  await client.connect(transport);
  if (client.getServerVersion()?.version !== expectedVersion) {
    throw new Error(`Expected MCP server version ${expectedVersion}, received ${client.getServerVersion()?.version}`);
  }
  const tools = await client.listTools();
  if (tools.tools.length !== 15) throw new Error(`Expected 15 tools, received ${tools.tools.length}`);
  const expected = [
    "analyze_app_idea",
    "resolve_ios_capabilities",
    "get_capability_profile",
    "get_apple_technology",
    "compare_implementation_options",
    "check_availability",
    "audit_permissions_and_entitlements",
    "audit_ios_project_configuration",
    "audit_privacy_and_app_review",
    "generate_ios_architecture",
    "generate_implementation_plan",
    "search_official_apple_docs",
    "search_apple_technology_catalog",
    "get_registry_coverage",
    "refresh_capability_registry"
  ];
  for (const name of expected) {
    if (!tools.tools.some((tool) => tool.name === name)) throw new Error(`Missing tool: ${name}`);
  }

  const response = await client.callTool({
    name: "get_capability_profile",
    arguments: { capability_id_or_name: "healthkit" }
  });
  if (response.isError) throw new Error("get_capability_profile returned an MCP error");
  const structuredContent = response.structuredContent as Record<string, unknown> | undefined;
  if (structuredContent?.schema_version !== "1.0") throw new Error("Missing structured output envelope");

  const technologyResponse = await client.callTool({
    name: "get_apple_technology",
    arguments: { technology_id_or_name: "RoomPlan" }
  });
  if (technologyResponse.isError) throw new Error("get_apple_technology returned an MCP error");
  const technologyEnvelope = technologyResponse.structuredContent as { data?: { kind?: string } } | undefined;
  if (technologyEnvelope?.data?.kind !== "catalog_only") {
    throw new Error("RoomPlan did not return the expected catalog-only result");
  }

  const auditResponse = await client.callTool({
    name: "audit_ios_project_configuration",
    arguments: { project_root: pluginRoot, capability_ids: ["swiftdata"], platform: "iOS" }
  });
  if (auditResponse.isError) throw new Error("audit_ios_project_configuration returned an MCP error");
  const auditEnvelope = auditResponse.structuredContent as
    { data?: { project_root?: string; findings?: unknown[] } } | undefined;
  if (!auditEnvelope?.data?.findings?.length) throw new Error("Project audit returned no structured findings");
  if (auditEnvelope.data.project_root !== "." || JSON.stringify(auditEnvelope).includes(pluginRoot)) {
    throw new Error("Project audit exposed its absolute project root");
  }

  const availabilityResponse = await client.callTool({
    name: "check_availability",
    arguments: {
      capability_ids: ["foundation-models"],
      platform: "iOS",
      os_version: "26.0",
      device: "iPhone 8",
      region: "TR",
      language: "Turkish",
      allow_beta: false
    }
  });
  if (availabilityResponse.isError) throw new Error("check_availability returned an MCP error");
  const availabilityEnvelope = availabilityResponse.structuredContent as
    { data?: { results?: Array<{ determination?: string }> } } | undefined;
  if (availabilityEnvelope?.data?.results?.[0]?.determination !== "conditional") {
    throw new Error("Human-readable availability constraints were not kept conditional");
  }

  console.log(
    JSON.stringify(
      {
        connected: true,
        server_version: expectedVersion,
        tool_count: tools.tools.length,
        profile_smoke: "healthkit",
        technology_smoke: "RoomPlan",
        project_audit_smoke: "swiftdata",
        availability_smoke: "foundation-models",
        structured_output: true
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
