# OpenAI plugin submission pack

This directory is the review source of truth for the first public, skills-only submission of iOS Capability Architect. It mirrors the fields required by the OpenAI plugin submission portal without pretending that a repository release is an approved directory listing.

## Submission type

Select **Skills only** and upload the plugin package produced by:

```bash
npm run build
npm run smoke:skills
```

The plugin package is written to `dist/skills-only/ios-capability-architect-plugin-<version>.zip`. It contains `.codex-plugin/plugin.json` (the repository manifest without `mcpServers`), the skill under `skills/ios-capability-architect/` with its local CLI and data, and the license. The portal limits are enforced by `npm run validate:submission` and `npm run smoke:skills`: display name and short description at most 30 characters, at most three default prompts of 128 characters, HTTPS listing URLs, and existing icon paths. The GitHub release workflow attaches the same plugin package, the standalone skill archive, the npm package, SBOM, and checksums. Because an MCP server cannot be added to a skills-only plugin later, the local stdio server stays out of this package.

The public submission intentionally excludes the local stdio MCP server. A remote MCP server cannot inspect a user's local Xcode project by accepting a local path, and uploading project contents would materially change the product's privacy boundary. The skills-only archive instead includes a dependency-free local CLI that runs under the host's normal workspace controls.

## Portal fields

- `listing.json`: public name, descriptions, category, publisher, and URLs.
- `starter-prompts.json`: adaptable entry points for the highest-value workflows.
- `test-cases.json`: five positive and three negative reviewer scenarios.
- `availability.json`: launch-region policy and language/support facts.
- `policy-attestations.md`: evidence for the policy answers that require human confirmation in the portal.
- `release-notes.md`: version notes for the portal.
- `reviewer-guide.md`: reproducible local checks and known limitations.
- `assets/icon.svg`: vector source for the listing icon. Use the generated `icon-512.png` upload asset.

## Human-only gates

Before selecting **Submit for Review**, confirm in the OpenAI Platform organization that:

1. the selected publisher is the verified Fillbyte business identity;
2. the submitter is an organization owner or has **Apps Management: Write**;
3. the uploaded archive hash matches the release checksum;
4. every portal field matches this directory and the public repository;
5. country availability is still appropriate on the submission date;
6. policy attestations are accurate for the exact uploaded version.

Do not submit under a different organization or individual identity merely to bypass an incomplete Fillbyte verification.
