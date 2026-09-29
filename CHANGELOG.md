# Changelog

All notable changes to this project are documented in this file. The project follows [Semantic Versioning](https://semver.org/) and uses Conventional Commit messages to drive release automation.

## [1.1.0](https://github.com/fillbyte/skills/compare/v1.0.1...v1.1.0) (2026-09-29)


### Features

* **registry:** refresh capability registry for iOS 27 and Xcode 27 ([#60](https://github.com/fillbyte/skills/issues/60)) ([2df2982](https://github.com/fillbyte/skills/commit/2df298280390ba9b31123641ce850eb66387bbdf))


### Bug Fixes

* **submission:** build a portal-format plugin package within listing limits ([#64](https://github.com/fillbyte/skills/issues/64)) ([10b4580](https://github.com/fillbyte/skills/commit/10b458029a909e04d613893e2fe7440b6ccfd3f4))

## [1.0.1](https://github.com/fillbyte/skills/compare/v1.0.0...v1.0.1) (2026-09-04)


### Bug Fixes

* **build:** make skills archive timezone independent ([#44](https://github.com/fillbyte/skills/issues/44)) ([122867c](https://github.com/fillbyte/skills/commit/122867c1c6b9c470143b9e9cb6c895fd3e3894ad))

## [1.0.0](https://github.com/fillbyte/skills/compare/v0.9.0...v1.0.0) (2026-09-04)


### ⚠ BREAKING CHANGES

* the Codex marketplace identity changes from ios-capability-architect to fillbyte-skills; reinstall the marketplace before upgrading.

### Features

* establish Fillbyte Skills collection ([#41](https://github.com/fillbyte/skills/issues/41)) ([8829a1e](https://github.com/fillbyte/skills/commit/8829a1edc8c7621bf22dcca11b915e2f4b1b3af2))


### Bug Fixes

* **test:** make server version assertion release-safe ([#43](https://github.com/fillbyte/skills/issues/43)) ([c5902c2](https://github.com/fillbyte/skills/commit/c5902c2a7f0fe36dea215ccdcd52695a5501e0b4))

## [0.9.0](https://github.com/fillbyte/skills/compare/v0.8.0...v0.9.0) (2026-08-30)


### Features

* **registry:** add core system capability profiles ([#39](https://github.com/fillbyte/skills/issues/39)) ([0eae770](https://github.com/fillbyte/skills/commit/0eae7706ed5b907b81cbed0e4ab9d5e244013d89))

## [0.8.0](https://github.com/fillbyte/skills/compare/v0.7.0...v0.8.0) (2026-08-30)


### Features

* **registry:** add core platform capability profiles ([#37](https://github.com/fillbyte/skills/issues/37)) ([e32dc0b](https://github.com/fillbyte/skills/commit/e32dc0ba79ec59f8c8db2f0afda06934f886b638))

## [0.7.0](https://github.com/fillbyte/skills/compare/v0.6.0...v0.7.0) (2026-08-30)


### Features

* **registry:** add data and security capability profiles ([#35](https://github.com/fillbyte/skills/issues/35)) ([4496612](https://github.com/fillbyte/skills/commit/4496612f6dccd7058ac202f071b9175b935e9218))

## [0.6.0](https://github.com/fillbyte/skills/compare/v0.5.0...v0.6.0) (2026-08-30)


### Features

* **registry:** add foundational Swift and UI profiles ([#33](https://github.com/fillbyte/skills/issues/33)) ([231407f](https://github.com/fillbyte/skills/commit/231407fc3a77bd17531d292bf61e25aa5f5b02b5))

## [0.5.0](https://github.com/fillbyte/skills/compare/v0.4.2...v0.5.0) (2026-08-30)


### Features

* **catalog:** add safe fallback for unprofiled Apple technologies ([#31](https://github.com/fillbyte/skills/issues/31)) ([7dcd128](https://github.com/fillbyte/skills/commit/7dcd128c7ee27bb893c0f7ada1bf4f017a11e53d))

## [0.4.2](https://github.com/fillbyte/skills/compare/v0.4.1...v0.4.2) (2026-08-30)


### Bug Fixes

* **registry:** verify reviewed profile availability ([#29](https://github.com/fillbyte/skills/issues/29)) ([e036825](https://github.com/fillbyte/skills/commit/e03682538d271cd7848d443c7914ac3cc04d539a))

## [0.4.1](https://github.com/fillbyte/skills/compare/v0.4.0...v0.4.1) (2026-08-30)


### Bug Fixes

* **cli:** resolve symlinked executable entrypoints ([#26](https://github.com/fillbyte/skills/issues/26)) ([84865bd](https://github.com/fillbyte/skills/commit/84865bdf95b47369920d31b97bc1dc93fc7623c2))

## [0.4.0](https://github.com/fillbyte/skills/compare/v0.3.0...v0.4.0) (2026-08-30)


### Features

* prepare the public skills-only plugin distribution ([#24](https://github.com/fillbyte/skills/issues/24)) ([7eb184d](https://github.com/fillbyte/skills/commit/7eb184dfcc77ece4a447cc18375e40affcd0b071))

## [0.3.0](https://github.com/fillbyte/skills/compare/v0.2.2...v0.3.0) (2026-08-30)


### Features

* **plugin:** audit existing iOS project configuration ([#20](https://github.com/fillbyte/skills/issues/20)) ([a12e500](https://github.com/fillbyte/skills/commit/a12e50090272ceeb70ddba0d1caf09818c6bfdf5))


### Bug Fixes

* **release:** keep generated bundle stable across version bumps ([#22](https://github.com/fillbyte/skills/issues/22)) ([fab76f5](https://github.com/fillbyte/skills/commit/fab76f5a732d1f7f1a4174d6e326da4ee18226f0))

## [0.2.2](https://github.com/fillbyte/skills/compare/v0.2.1...v0.2.2) (2026-08-30)


### Bug Fixes

* **release:** make package publication idempotent ([#14](https://github.com/fillbyte/skills/issues/14)) ([898f592](https://github.com/fillbyte/skills/commit/898f592ada3a35d023a8094dc876d05b28b786b6))
* **release:** target workflow dispatch repository ([#18](https://github.com/fillbyte/skills/issues/18)) ([056e381](https://github.com/fillbyte/skills/commit/056e381f06ce43b6486642201a3bc906aa9d9146))
* **release:** validate generated metadata deterministically ([#17](https://github.com/fillbyte/skills/issues/17)) ([5ac14dc](https://github.com/fillbyte/skills/commit/5ac14dc7917fa33b4f0269b230d61ddff7b14528))

## [0.2.1](https://github.com/fillbyte/skills/compare/v0.2.0...v0.2.1) (2026-08-30)

### Bug Fixes

- **packaging:** migrate distribution to Fillbyte ([#12](https://github.com/fillbyte/skills/issues/12)) ([c23a72f](https://github.com/fillbyte/skills/commit/c23a72f9d9993bf7527396c5162df15c9c259082))

## [0.2.0](https://github.com/fillbyte/skills/compare/v0.1.0...v0.2.0) (2026-08-30)

### Features

- harden registry integrity and Apple catalog coverage ([#8](https://github.com/fillbyte/skills/issues/8)) ([eb08867](https://github.com/fillbyte/skills/commit/eb0886777fdab5aa5a7ecb5267ab83d1bf530737))
- **plugin:** establish the iOS capability architect foundation ([231cb7d](https://github.com/fillbyte/skills/commit/231cb7d03605f250e2913ebdcd250a78df912e85))
- **registry:** measure Apple technology coverage safely ([d3f83e3](https://github.com/fillbyte/skills/commit/d3f83e305c771ea6652bbe59e16b74c39f4512e4))

### Bug Fixes

- **release:** publish the generated tarball by filesystem path ([bdfbfe0](https://github.com/fillbyte/skills/commit/bdfbfe002c6e08d5037673f0fa3fe3427f58b892))

## 0.1.0 - 2026-08-30

### Added

- Initial iOS Capability Architect skill and read-only MCP server.
- Evidence-backed capability profiles, Apple technology discovery taxonomy, validation scripts, and acceptance tests.
- Local Codex marketplace metadata and a standalone bundled runtime.
