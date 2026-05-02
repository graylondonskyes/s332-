# SkyeHands Runtime Control Shell

This directory is now the product-owned control plane for the autonomous workspace.

## Current Responsibilities

- load product identity from the root branding contract
- own shell-level runtime env and generated local state
- sync canonical product config into the imported agent core
- define the canonical runtime ports for the new platform root
- bootstrap imported dependencies from this workspace
- run doctor checks before startup
- launch the IDE layer and V1 agent backend from one root-owned entry point
- provide a shell-owned stack bridge for shared status, gate proxying, and agent HTTP proxying

## Current Entry Points

- `node bin/bootstrap.mjs`
- `node bin/doctor.mjs`
- `node bin/launch.mjs`

## Next Responsibilities

1. expand the bridge into a fuller IDE-to-agent runtime contract
2. add workspace-level proxying so the shell becomes the single browser entry point
3. absorb more environment policy that currently lives inside imported cores
4. keep deprecated V0 agent surfaces out of the root product contract

## SkyeGateFS13 Runtime Contract

- preferred gate origin vars: `SKYGATEFS13_ORIGIN`, `SKYGATE_AUTH_ORIGIN`, or `SKYGATE_ORIGIN`
- preferred gate token vars: `SKYGATEFS13_GATE_TOKEN` or `SKYGATE_GATE_TOKEN`
- preferred gate model vars: `SKYGATEFS13_GATE_MODEL` or `SKYGATE_GATE_MODEL`
- legacy compatibility vars remain supported: `SKYEQUANTA_GATE_URL`, `OMEGA_GATE_URL`, `SKYEQUANTA_GATE_TOKEN`, `SKYEQUANTA_OSKEY`, `SKYEQUANTA_GATE_MODEL`
- set `SKYGATE_EVENT_MIRROR_SECRET` or `SKYGATEFS13_EVENT_MIRROR_SECRET` if you want the shell-owned audit trail mirrored into the parent gate at `/platform/events`
- `node bin/doctor.mjs` now fails if the gate URL or gate token are missing
- the browser/runtime contract exposes the gate surface through the bridge instead of exposing upstream vendors directly
