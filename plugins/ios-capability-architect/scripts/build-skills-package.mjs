import { execFileSync } from "node:child_process";
import { cp, chmod, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

const pluginRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const outputRoot = join(workspaceRoot, "dist", "skills-only");
const skillRoot = join(outputRoot, "ios-capability-architect");
const packageMetadata = JSON.parse(await readFile(join(pluginRoot, "package.json"), "utf8"));
const archiveName = `ios-capability-architect-skill-${packageMetadata.version}.zip`;
const archivePath = join(outputRoot, archiveName);

await rm(skillRoot, { recursive: true, force: true });
await rm(archivePath, { force: true });
await mkdir(join(skillRoot, "scripts"), { recursive: true });
await mkdir(join(skillRoot, "data"), { recursive: true });

await cp(join(pluginRoot, "skills", "ios-capability-architect", "SKILL.md"), join(skillRoot, "SKILL.md"));
await cp(join(pluginRoot, "skills", "ios-capability-architect", "references"), join(skillRoot, "references"), {
  recursive: true
});
await cp(join(pluginRoot, "skills", "ios-capability-architect", "agents"), join(skillRoot, "agents"), {
  recursive: true
});
await cp(join(pluginRoot, "skills", "ios-capability-architect", "assets"), join(skillRoot, "assets"), {
  recursive: true
});
await cp(join(pluginRoot, "bundle", "cli.mjs"), join(skillRoot, "scripts", "ios-capability-architect.mjs"));
await cp(join(pluginRoot, "data", "capabilities.json"), join(skillRoot, "data", "capabilities.json"));
await cp(join(pluginRoot, "data", "taxonomy.json"), join(skillRoot, "data", "taxonomy.json"));
await cp(join(pluginRoot, "LICENSE"), join(skillRoot, "LICENSE"));

await writeFile(
  join(skillRoot, "manifest.json"),
  `${JSON.stringify(
    {
      name: "ios-capability-architect",
      version: packageMetadata.version,
      distribution: "skills-only",
      entrypoint: "SKILL.md",
      cli: "scripts/ios-capability-architect.mjs",
      data: ["data/capabilities.json", "data/taxonomy.json"],
      network_required: false,
      authentication_required: false,
      telemetry: false,
      license: "MIT"
    },
    null,
    2
  )}\n`,
  "utf8"
);

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Skills package cannot contain a symbolic link: ${path}`);
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    if (entry.isFile()) files.push(relative(root, path));
  }
  return files;
}

const files = await listFiles(skillRoot);
const normalizedTimestamp = new Date("2000-01-01T00:00:00.000Z");
for (const file of files) {
  const path = join(skillRoot, file);
  await chmod(path, file === "scripts/ios-capability-architect.mjs" ? 0o755 : 0o644);
  await utimes(path, normalizedTimestamp, normalizedTimestamp);
}

execFileSync("zip", ["-X", "-q", archivePath, "-@"], {
  cwd: skillRoot,
  env: { ...process.env, TZ: "UTC" },
  input: `${files.join("\n")}\n`
});

// Portal-format plugin package: `.codex-plugin/plugin.json` plus the skills-only tree under `skills/`.
// The local MCP server is deliberately absent; an MCP server cannot be added to a skills-only plugin later.
const pluginPackageRoot = join(outputRoot, "plugin", "ios-capability-architect");
const pluginArchiveName = `ios-capability-architect-plugin-${packageMetadata.version}.zip`;
const pluginArchivePath = join(outputRoot, pluginArchiveName);
await rm(join(outputRoot, "plugin"), { recursive: true, force: true });
await rm(pluginArchivePath, { force: true });
await mkdir(join(pluginPackageRoot, ".codex-plugin"), { recursive: true });
await cp(skillRoot, join(pluginPackageRoot, "skills", "ios-capability-architect"), { recursive: true });
await cp(join(pluginRoot, "LICENSE"), join(pluginPackageRoot, "LICENSE"));
const submissionManifest = JSON.parse(await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
delete submissionManifest.mcpServers;
await writeFile(
  join(pluginPackageRoot, ".codex-plugin", "plugin.json"),
  `${JSON.stringify(submissionManifest, null, 2)}\n`,
  "utf8"
);
const pluginFiles = await listFiles(pluginPackageRoot);
for (const file of pluginFiles) {
  const path = join(pluginPackageRoot, file);
  await chmod(path, file.endsWith("scripts/ios-capability-architect.mjs") ? 0o755 : 0o644);
  await utimes(path, normalizedTimestamp, normalizedTimestamp);
}
execFileSync("zip", ["-X", "-q", pluginArchivePath, "-@"], {
  cwd: pluginPackageRoot,
  env: { ...process.env, TZ: "UTC" },
  input: `${pluginFiles.join("\n")}\n`
});

const archiveStats = await stat(archivePath);
process.stdout.write(
  `${JSON.stringify(
    {
      built: true,
      version: packageMetadata.version,
      skill_root: skillRoot,
      archive: archivePath,
      files: files.length,
      archive_bytes: archiveStats.size,
      plugin_archive: pluginArchivePath,
      plugin_files: pluginFiles.length,
      plugin_archive_bytes: (await stat(pluginArchivePath)).size
    },
    null,
    2
  )}\n`
);
