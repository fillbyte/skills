import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const submissionRoot = join(root, "docs", "openai-submission");

async function json(name) {
  return JSON.parse(await readFile(join(submissionRoot, name), "utf8"));
}

const listing = await json("listing.json");
const prompts = await json("starter-prompts.json");
const tests = await json("test-cases.json");
const availability = await json("availability.json");
const pluginManifest = JSON.parse(
  await readFile(join(root, "plugins", "ios-capability-architect", ".codex-plugin", "plugin.json"), "utf8")
);

const requiredListingFields = [
  "name",
  "publisher",
  "category",
  "short_description",
  "long_description",
  "website_url",
  "support_url",
  "privacy_policy_url",
  "terms_url",
  "source_url",
  "icon_source",
  "icon_upload"
];
for (const field of requiredListingFields) {
  if (typeof listing[field] !== "string" || !listing[field].trim()) {
    throw new Error(`Submission listing is missing ${field}`);
  }
}
if (listing.publisher !== "Fillbyte") throw new Error("Submission publisher must remain Fillbyte");
if (listing.name !== pluginManifest.interface?.displayName) {
  throw new Error("Submission and plugin display names must match");
}
if (listing.short_description !== pluginManifest.interface?.shortDescription) {
  throw new Error("Submission and plugin short descriptions must match");
}
if (listing.privacy_policy_url !== pluginManifest.interface?.privacyPolicyURL) {
  throw new Error("Submission and plugin privacy policy URLs must match");
}
if (listing.terms_url !== pluginManifest.interface?.termsOfServiceURL) {
  throw new Error("Submission and plugin terms URLs must match");
}
if (listing.short_description.length > 30)
  throw new Error("Submission short description exceeds the portal's 30 characters");
if (listing.name.length > 30) throw new Error("Submission display name exceeds the portal's 30 characters");
if (listing.publisher.length > 80) throw new Error("Submission publisher exceeds the portal's 80 characters");
if (listing.support_url !== pluginManifest.interface?.supportURL) {
  throw new Error("Submission and plugin support URLs must match");
}
const manifestPrompts = pluginManifest.interface?.defaultPrompt;
if (!Array.isArray(manifestPrompts) || manifestPrompts.length > 3 || manifestPrompts.some((p) => p.length > 128)) {
  throw new Error("Plugin default prompts must be at most three entries of 128 characters");
}
if (!/^\d+\.\d+\.\d+$/.test(pluginManifest.version)) throw new Error("Plugin manifest needs a semantic version");
if (!/^[a-z0-9-]{1,64}$/.test(pluginManifest.name)) throw new Error("Plugin manifest name violates the portal pattern");
if (listing.long_description.length < 200 || listing.long_description.length > 1200) {
  throw new Error("Submission long description must contain 200 through 1200 characters");
}
for (const field of ["website_url", "support_url", "privacy_policy_url", "terms_url", "source_url"]) {
  const url = new URL(listing[field]);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || !url.pathname.startsWith("/fillbyte/")) {
    throw new Error(`Submission ${field} must be a public Fillbyte HTTPS URL`);
  }
}

if (
  !Array.isArray(prompts) ||
  prompts.length < 4 ||
  prompts.some((prompt) => typeof prompt !== "string" || !prompt.trim())
) {
  throw new Error("Submission must contain at least four non-empty starter prompts");
}
if (!Array.isArray(tests.positive) || tests.positive.length < 5) {
  throw new Error("Submission must contain at least five positive tests");
}
if (!Array.isArray(tests.negative) || tests.negative.length < 3) {
  throw new Error("Submission must contain at least three negative tests");
}
const testIds = [...tests.positive, ...tests.negative].map((test) => test.id);
if (new Set(testIds).size !== testIds.length) throw new Error("Submission test IDs must be unique");
for (const test of tests.positive) {
  if (!test.prompt || !Array.isArray(test.expected_behavior) || test.expected_behavior.length < 3) {
    throw new Error(`Positive submission test ${test.id ?? "unknown"} is incomplete`);
  }
}
for (const test of tests.negative) {
  if (!test.prompt || !test.expected_behavior || !test.why) {
    throw new Error(`Negative submission test ${test.id ?? "unknown"} is incomplete`);
  }
}
if (availability.confirmation_required_at_submission !== true) {
  throw new Error("Availability must require submission-day confirmation");
}

for (const name of ["README.md", "policy-attestations.md", "release-notes.md", "reviewer-guide.md"]) {
  const content = await readFile(join(submissionRoot, name), "utf8");
  if (content.includes("[TODO") || content.includes("/Users/")) {
    throw new Error(`${name} contains a placeholder or local absolute path`);
  }
}

await stat(join(submissionRoot, listing.icon_source));
const png = await readFile(join(submissionRoot, listing.icon_upload));
const signature = png.subarray(0, 8).toString("hex");
if (signature !== "89504e470d0a1a0a") throw new Error("Submission icon upload is not a PNG");
if (png.readUInt32BE(16) !== 512 || png.readUInt32BE(20) !== 512) {
  throw new Error("Submission PNG icon must be 512 by 512 pixels");
}

process.stdout.write(
  `${JSON.stringify(
    {
      valid: true,
      publisher: listing.publisher,
      starter_prompts: prompts.length,
      positive_tests: tests.positive.length,
      negative_tests: tests.negative.length,
      icon: "512x512",
      availability_confirmation_required: true
    },
    null,
    2
  )}\n`
);
