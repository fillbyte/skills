# Submission release notes

iOS Capability Architect is a new skills-only public submission from Fillbyte.

It helps users translate Apple-platform product requirements into evidence-backed capability selection, SwiftUI-first architecture, configuration and entitlement inventories, privacy and App Review analysis, implementation sequencing, and test plans. In Codex environments with a local workspace, its packaged dependency-free CLI can perform a bounded, read-only audit of supported Xcode and XcodeGen configuration surfaces without returning source contents or following symbolic links.

The submission contains no hosted service, authentication, telemetry, or external data storage. It includes 79 reviewed capability profiles mapping 83 catalog identities, a 203-entry discovery catalog with explicit coverage status, an iOS 27 refresh reviewed against the iOS & iPadOS 27 and Xcode 27 release notes on 2026-09-30 (iOS 27.2 beta additions are isolated in a beta-labelled record), official-source metadata, conservative unknown handling, and positive and negative reviewer fixtures.

Known limitation: source detection does not prove generated target settings, signing, provisioning, Apple approval, runtime availability, real-device behavior, or App Review outcome. These remain explicit manual verification steps.
