# iOS Capability Architect

An Apple-platform agent skill, Codex plugin, local MCP server, and standalone CLI for evidence-backed capability architecture and Xcode configuration audits.

## What it does

- Turns app ideas into explicit requirements, assumptions, capability maps, architecture, implementation steps, and tests.
- Maps requirements to reviewed public Apple frameworks, APIs, permissions, Info.plist keys, Xcode capabilities, entitlements, background modes, and extensions.
- Audits supported Xcode and XcodeGen source configuration through a bounded, read-only scan.
- Preserves beta, deprecation, managed-entitlement, hardware, region, language, privacy, and App Store constraints.
- Keeps catalog-only Apple technologies as research leads until technology-specific official evidence is reviewed.

The bundled MCP server exposes fifteen read-only tools. The skills-only distribution packages the same deterministic engine as a dependency-free Node.js 24 CLI. Neither runtime mutates the registry, sends telemetry, requires authentication, or stores project data remotely.

## Install

As an individual agent skill:

```bash
npx skills add https://github.com/fillbyte/skills --skill ios-capability-architect
```

As a Codex plugin from the Fillbyte Skills marketplace:

```bash
codex plugin marketplace add fillbyte/skills
codex plugin add ios-capability-architect@fillbyte-skills
```

The canonical directory page is [skills.sh/fillbyte/skills/ios-capability-architect](https://skills.sh/fillbyte/skills/ios-capability-architect).

Releases through `v0.9.0` used `ios-capability-architect` as both the plugin and marketplace name. Remove that legacy installation before adding the `fillbyte-skills` marketplace.

## Trust boundary

The 203-entry discovery catalog and 79 reviewed capability profiles are intentionally separate. Catalog presence proves identity and taxonomy only. Architecture, configuration, or availability recommendations require a reviewed profile backed by dated official Apple sources.

Project-audit output contains relative paths and structured findings, not file contents. It does not prove generated build settings, signing, provisioning, managed-entitlement approval, runtime availability, real-device behavior, or App Review outcome.

## Development

From the repository root:

```bash
npm ci
npm run verify
npm run verify:docs
```

See the collection [README](../../README.md), [architecture](docs/architecture.md), [tool contracts](docs/tool-contracts.md), [security model](docs/security.md), and [contribution guide](../../CONTRIBUTING.md).

GitHub releases include a skills-only ZIP, npm package tarball, checksums, CycloneDX SBOM, and build-provenance attestations.

## License

MIT. See [LICENSE](LICENSE).
