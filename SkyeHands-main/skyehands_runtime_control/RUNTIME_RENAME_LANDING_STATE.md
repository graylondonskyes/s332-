# SkyeHands Runtime Rename Landing State

## Current state
- canonical runtime path in the filesystem: `skyehands_runtime_control/`
- compatibility alias: `stage_44rebuild -> skyehands_runtime_control`

## Why this file exists
The runtime rename is operationally real in the filesystem, but it is not yet a clean landed git rename. This file makes that explicit so nobody mistakes a working local alias for a completed source-control migration.

## What is already true
- runtime shell docs now describe the role-specific runtime identity
- `SKYGATEFS13_*` runtime wiring is patched into the shell launch path
- the old `stage_44rebuild` name no longer represents the real intended role

## What is still required
- clean git-aware landing of the rename
- explicit decision on whether `stage_44rebuild` remains as a compatibility shim
- verification that historical path assumptions are either updated or intentionally preserved
