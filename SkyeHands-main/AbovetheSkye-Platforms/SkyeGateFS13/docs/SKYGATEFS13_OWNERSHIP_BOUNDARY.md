# SkyeGateFS13 Ownership Boundary

This document defines what `SkyeGateFS13` owns centrally and what downstream platforms may still own locally.

## Gate-Owned Centrally

`SkyeGateFS13` is the parent authority for:
- user identity and primary auth
- sessions and token issuance
- OAuth/OIDC, JWKS, and discovery metadata
- customer API keys and app-login clearance
- central usage metering
- central billing, caps, and invoice snapshots
- shared vendor ledger and sovereign-variable posture
- parent audit/event ingestion
- push/deploy charging and gate-level provider policy

## Allowed App-Local Ownership

Platforms may still own:
- app-specific business objects
- workspace state
- documents, mailboxes, content, and presentation-layer records
- app-local org/workspace provisioning
- app-specific feature state that does not replace the gate’s auth or billing authority

## Bridge-Only Compatibility Lanes

These may exist temporarily, but should not act as independent sovereign authorities:
- local auth wrappers that call into gate auth
- local workspace provisioning after gate signup/login succeeds
- local audit writes that are mirrored upward into the gate
- app-local session compatibility only where explicitly allowed

## Explicit Non-Goal

The gate does not need to erase all local tables.

The real goal is:
- privileged access routes through the gate
- metered or chargeable actions are visible to the gate
- customer/vendor/policy posture is governed by the gate
- local app state remains local only where it should

## Operational Rule

If a platform feature answers any of these questions, it should usually pass through `SkyeGateFS13`:
- Who is this user?
- Is this action allowed?
- Which credential should be used?
- Should this action be billed?
- Should this action be audited centrally?
