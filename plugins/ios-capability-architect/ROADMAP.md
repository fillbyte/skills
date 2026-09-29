# iOS Capability Architect Roadmap

This component roadmap communicates direction, not delivery guarantees. Accepted issues and milestones are the source of truth for scheduled work.

## Project-audit depth

- Inspect generated Xcode build settings in addition to source configuration while preserving the source-of-truth/generated-output distinction.
- Model targets and build configurations so findings identify the exact app or extension target.
- Parse `PrivacyInfo.xcprivacy` declarations semantically and compare required-reason categories with linked dependencies.
- Produce a machine-readable remediation plan with reviewable patch suggestions while keeping mutation opt-in and outside the read-only MCP tool.
- Add real-project fixtures for XcodeGen, native `.xcodeproj`, Swift Package dependencies, widgets, Live Activities, HealthKit, and managed entitlements.
- Establish a 100-scenario evaluation set and publish false-positive, false-negative, unsupported, and evidence-gap rates.

Completion signal: every committed fixture identifies the correct target-level configuration without an unsupported certainty claim.

## Registry depth and maintainability

- Continue expanding beyond the 79 reviewed profiles (grown from 46 with the iOS 27 refresh) into the remaining high-usage catalog-only families, selected by public Apple-platform workflows rather than arbitrary catalog order.
- Prioritize APNs, CloudKit, Keychain, AuthenticationServices, App Attest, camera and media, maps and weather, Bluetooth and NFC, Wallet and Apple Pay, testing, accessibility, and extension families.
- Add machine-readable provenance and change-review metadata without implying automatic factual verification.
- Improve availability modeling for devices, hardware, regions, languages, accounts, managed entitlements, and beta SDKs.
- Add safe tooling that identifies stale sources and produces a review queue without rewriting claims automatically.

Completion signal: the public evaluation set passes without promoting catalog-only entries into recommendations.

## Distribution and adoption

- Submit the reviewed skills-only package before introducing a hosted service.
- Exercise install, upgrade, rollback, and uninstall procedures across consecutive tagged releases.
- Keep unauthenticated GitHub release artifacts available even when a package registry requires authentication.
- Publish an end-to-end example that starts with an app idea, audits a real project, and produces a verified remediation plan.
- Publish benchmark results comparing generic planning with registry-backed, project-aware auditing.

Completion signal: a new user can install a reviewed package, complete the example without repository knowledge, and reproduce the documented output.

## Non-goals

- Private API recommendations, review bypasses, or hidden entitlement acquisition.
- Claims of guaranteed App Review approval, background execution, or entitlement access.
- Automatic promotion of unreviewed web content into verified records.
- Collection of application ideas, telemetry, credentials, or personal data by default.
- Replacing Apple documentation, legal counsel, privacy review, or testing on real target devices.
