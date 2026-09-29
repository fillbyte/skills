import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const pluginRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const packageMetadata = JSON.parse(await readFile(join(pluginRoot, "package.json"), "utf8"));
const archivePath = join(
  workspaceRoot,
  "dist",
  "skills-only",
  `ios-capability-architect-skill-${packageMetadata.version}.zip`
);
const pluginArchivePath = join(
  workspaceRoot,
  "dist",
  "skills-only",
  `ios-capability-architect-plugin-${packageMetadata.version}.zip`
);
const buildScript = join(pluginRoot, "scripts", "build-skills-package.mjs");

async function buildInTimezone(timezone) {
  execFileSync(process.execPath, [buildScript], {
    cwd: workspaceRoot,
    env: { ...process.env, TZ: timezone },
    stdio: "pipe"
  });
  const archive = await readFile(archivePath);
  const pluginArchive = await readFile(pluginArchivePath);
  return {
    bytes: archive.length,
    sha256: createHash("sha256").update(archive).digest("hex"),
    pluginBytes: pluginArchive.length,
    pluginSha256: createHash("sha256").update(pluginArchive).digest("hex")
  };
}

const west = await buildInTimezone("Pacific/Honolulu");
const east = await buildInTimezone("Asia/Tokyo");

if (west.pluginBytes !== east.pluginBytes || west.pluginSha256 !== east.pluginSha256) {
  throw new Error(`Plugin archive is timezone-dependent: ${west.pluginSha256} vs ${east.pluginSha256}`);
}
if (west.bytes !== east.bytes || west.sha256 !== east.sha256) {
  throw new Error(`Skills archive is timezone-dependent: Pacific/Honolulu ${west.sha256}, Asia/Tokyo ${east.sha256}`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      reproducible: true,
      timezones: ["Pacific/Honolulu", "Asia/Tokyo"],
      archive_bytes: east.bytes,
      sha256: east.sha256,
      plugin_archive_bytes: east.pluginBytes,
      plugin_sha256: east.pluginSha256
    },
    null,
    2
  )}\n`
);
