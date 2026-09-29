import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const pluginRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const packageMetadata = JSON.parse(await readFile(join(pluginRoot, "package.json"), "utf8"));
const outputRoot = join(workspaceRoot, "dist", "skills-only");
const skillRoot = join(outputRoot, "ios-capability-architect");
const archivePath = join(outputRoot, `ios-capability-architect-skill-${packageMetadata.version}.zip`);

const requiredPaths = [
  "SKILL.md",
  "LICENSE",
  "manifest.json",
  "agents/openai.yaml",
  "assets/icon.svg",
  "scripts/ios-capability-architect.mjs",
  "data/capabilities.json",
  "data/taxonomy.json",
  "references/capability-registry.md",
  "references/response-quality.md",
  "references/cli.md",
  "references/data-handling.md"
];

for (const path of requiredPaths) await stat(join(skillRoot, path));

const skill = await readFile(join(skillRoot, "SKILL.md"), "utf8");
if (!skill.startsWith("---\n")) throw new Error("Packaged SKILL.md has no YAML frontmatter");
if (!skill.includes("scripts/ios-capability-architect.mjs")) {
  throw new Error("Packaged SKILL.md does not route skills-only execution through the local CLI");
}

const manifest = JSON.parse(await readFile(join(skillRoot, "manifest.json"), "utf8"));
if (manifest.version !== packageMetadata.version)
  throw new Error("Skills package version does not match package metadata");
if (manifest.distribution !== "skills-only") throw new Error("Skills package distribution is not skills-only");

async function inspect(root, current = root) {
  let count = 0;
  let bytes = 0;
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    const details = await lstat(path);
    if (details.isSymbolicLink()) throw new Error(`Skills package contains a symbolic link: ${path}`);
    if (entry.isDirectory()) {
      const nested = await inspect(root, path);
      count += nested.count;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      count += 1;
      bytes += details.size;
      if (details.size > 6 * 1024 * 1024) throw new Error(`Skills package file exceeds 6 MiB: ${path}`);
    }
  }
  return { count, bytes };
}

const inventory = await inspect(skillRoot);
if (inventory.bytes > 15 * 1024 * 1024) throw new Error("Expanded skills package exceeds 15 MiB");

const zipEntries = execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
if (zipEntries.some((entry) => entry.startsWith("/") || entry.split("/").includes(".."))) {
  throw new Error("Skills archive contains an unsafe path");
}
if (zipEntries.includes(".mcp.json") || zipEntries.some((entry) => entry.endsWith("server.mjs"))) {
  throw new Error("Skills-only archive unexpectedly contains an MCP server configuration or runtime");
}
for (const requiredPath of requiredPaths) {
  if (!zipEntries.includes(requiredPath)) throw new Error(`Skills archive is missing ${requiredPath}`);
}

const coverage = JSON.parse(
  execFileSync("node", [join(skillRoot, "scripts", "ios-capability-architect.mjs"), "coverage"], {
    encoding: "utf8"
  })
);
if (coverage.schema_version !== "1.0" || coverage.data.profiled_technology_count < 1) {
  throw new Error("Packaged CLI coverage smoke test failed");
}

const profile = JSON.parse(
  execFileSync("node", [join(skillRoot, "scripts", "ios-capability-architect.mjs"), "profile", "healthkit"], {
    encoding: "utf8"
  })
);
if (profile.data.id !== "healthkit") throw new Error("Packaged CLI profile smoke test failed");

const availability = JSON.parse(
  execFileSync(
    "node",
    [
      join(skillRoot, "scripts", "ios-capability-architect.mjs"),
      "availability",
      "--capability",
      "foundation-models",
      "--minimum-os",
      "26.0",
      "--device",
      "iPhone 8",
      "--region",
      "TR",
      "--language",
      "Turkish"
    ],
    { encoding: "utf8" }
  )
);
if (availability.data.results[0]?.determination !== "conditional") {
  throw new Error("Packaged CLI treated free-text availability constraints as verified");
}

const auditRoot = await mkdtemp(join(tmpdir(), "ios-capability-architect-audit-"));
try {
  await writeFile(join(auditRoot, "project.yml"), "options:\n  deploymentTarget:\n    iOS: '18.0'\n", "utf8");
  const audit = JSON.parse(
    execFileSync(
      "node",
      [
        join(skillRoot, "scripts", "ios-capability-architect.mjs"),
        "audit-project",
        "--root",
        auditRoot,
        "--capability",
        "privacy-manifest",
        "--platform",
        "iOS"
      ],
      { encoding: "utf8" }
    )
  );
  if (audit.data.project_root !== "." || JSON.stringify(audit).includes(auditRoot)) {
    throw new Error("Packaged CLI project audit exposed its absolute project root");
  }
} finally {
  await rm(auditRoot, { recursive: true, force: true });
}

const symlinkRoot = await mkdtemp(join(tmpdir(), "ios-capability-architect-cli-"));
try {
  const symlinkPath = join(symlinkRoot, "ios-capability-architect");
  await symlink(join(skillRoot, "scripts", "ios-capability-architect.mjs"), symlinkPath);
  const symlinkCoverage = JSON.parse(execFileSync("node", [symlinkPath, "coverage"], { encoding: "utf8" }));
  if (symlinkCoverage.schema_version !== "1.0" || symlinkCoverage.data.profiled_technology_count < 1) {
    throw new Error("Packaged CLI symlink smoke test failed");
  }
} finally {
  await rm(symlinkRoot, { recursive: true, force: true });
}

const pluginArchivePath = join(outputRoot, `ios-capability-architect-plugin-${packageMetadata.version}.zip`);
const pluginEntries = execFileSync("unzip", ["-Z1", pluginArchivePath], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
if (pluginEntries.some((entry) => entry.startsWith("/") || entry.split("/").includes(".."))) {
  throw new Error("Plugin archive contains an unsafe path");
}
if (
  pluginEntries.some((entry) => entry === ".mcp.json" || entry.endsWith("server.mjs") || entry.endsWith(".app.json"))
) {
  throw new Error("Skills-only plugin archive contains an MCP server, MCP configuration, or app reference");
}
for (const requiredPath of [
  ".codex-plugin/plugin.json",
  "LICENSE",
  ...requiredPaths.map((p) => `skills/ios-capability-architect/${p}`)
]) {
  if (!pluginEntries.includes(requiredPath)) throw new Error(`Plugin archive is missing ${requiredPath}`);
}
const pluginManifest = JSON.parse(
  execFileSync("unzip", ["-p", pluginArchivePath, ".codex-plugin/plugin.json"], { encoding: "utf8" })
);
if (pluginManifest.version !== packageMetadata.version) throw new Error("Plugin manifest version mismatch");
if (pluginManifest.mcpServers !== undefined) throw new Error("Skills-only plugin manifest must not declare mcpServers");
if (pluginManifest.skills !== "./skills/") throw new Error("Plugin manifest must declare ./skills/");
if (!/^[a-z0-9-]{1,64}$/.test(pluginManifest.name)) throw new Error("Plugin manifest name is invalid");
const pluginInterface = pluginManifest.interface ?? {};
for (const [field, limit] of [
  ["displayName", 30],
  ["shortDescription", 30],
  ["longDescription", 4000],
  ["developerName", 80]
]) {
  const value = pluginInterface[field];
  if (typeof value !== "string" || !value.trim() || value.length > limit) {
    throw new Error(`Plugin interface.${field} must be 1-${limit} characters`);
  }
}
for (const field of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
  if (!String(pluginInterface[field] ?? "").startsWith("https://"))
    throw new Error(`Plugin interface.${field} must be HTTPS`);
}
for (const field of ["composerIcon", "logo"]) {
  const target = String(pluginInterface[field] ?? "").replace(/^\.\//, "");
  if (!pluginEntries.includes(target))
    throw new Error(`Plugin interface.${field} points outside the archive: ${target}`);
}
const pluginArchive = await readFile(pluginArchivePath);

const archive = await readFile(archivePath);
process.stdout.write(
  `${JSON.stringify(
    {
      valid: true,
      version: packageMetadata.version,
      files: inventory.count,
      expanded_bytes: inventory.bytes,
      archive_bytes: archive.length,
      sha256: createHash("sha256").update(archive).digest("hex"),
      plugin_archive_bytes: pluginArchive.length,
      plugin_sha256: createHash("sha256").update(pluginArchive).digest("hex"),
      cli_smoke: [
        "coverage",
        "profile:healthkit",
        "availability:conditional-constraints",
        "audit-project:redacted-root",
        "symlink:coverage"
      ]
    },
    null,
    2
  )}\n`
);
