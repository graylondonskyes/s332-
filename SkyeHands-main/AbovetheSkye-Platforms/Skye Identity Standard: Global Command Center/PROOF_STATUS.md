# Proof Status

- Status: `partial`
- Surface type: `static command-center pages`
- Proof command: `node smoke/smoke-proof.mjs`

## What this folder proves

- The folder contains two runnable local HTML surfaces:
  - `index.html`
  - `SOC2CompanionPack.html`
- The pages present the SIS command-center narrative and companion-pack narrative as static browser pages.
- The local surfaces now call out their runtime boundaries more explicitly and distinguish local proof from hosted workflows.
- The local copy points users at hosted external sections for the fuller command-center experience.
- `SOC2CompanionPack.html` now includes a real browser-local control packet lane with control rows, evidence rows, packet export, and summary CSV export.
- `SOC2CompanionPack.html` can now probe a same-folder runtime lane and save local proof packets into same-folder JSON artifacts when the local runtime is running.

## What this folder does not prove yet

- This folder does not include the hosted `/sis`, `/ae-checklist`, `/engineer-preflight`, or `/downloads` implementations it links to.
- The local SOC2 lane is still a browser-local evidence packet plus same-folder packet archive, not the hosted approval workflow, PDF generation path, or cross-team routing system.
- The full hosted four-document pack still lives outside this folder.

## Current certification call

This folder now includes a modest but real local evidence-packet implementation inside the companion page plus a same-folder runtime packet archive lane. It remains `partial` because the hosted command-center implementations and cross-team automation it references are still outside this folder.
