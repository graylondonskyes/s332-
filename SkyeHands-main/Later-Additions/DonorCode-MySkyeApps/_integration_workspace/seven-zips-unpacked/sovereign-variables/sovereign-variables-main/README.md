# Sovereign Variables • Skyes Over London LC

**Sovereign Variables** is a premium offline-first environment command vessel built and operated by **Skyes Over London LC**. It gives founders, operators, builders, and deployment-focused teams a branded surface for organizing environment variables, writing deployment notes, packaging encrypted exports, and keeping sensitive configuration work under local control.

This is not throwaway extension filler. It is productized operator infrastructure with a visual identity, a modular architecture, and a workflow that respects the fact that many configuration surfaces should remain local first.

## Why this exists

Most variable handling is still ugly. Teams scatter secrets and deployment notes across scratchpads, chats, shell history, and random text files. That is sloppy, fragile, and expensive.

Sovereign Variables fixes that with a controlled vessel that keeps the core workflow on-device first:

- create and organize project-specific variable sets
- maintain environment notes beside the values that actually matter
- export encrypted `.skye` packages for controlled handoff
- import existing `.env`, `.txt`, `.json`, or `.skye` packages
- keep the spectacle layer modular instead of tangling the UI and background together

## Why people need it

Because founders and operators do not need more generic software. They need control.

Sovereign Variables is for people who want:

- **offline-first authority** over sensitive config work
- **clean deployment handoff** instead of fragmented text scraps
- **branded infrastructure** that actually feels like a serious product
- **local-first continuity** without being forced into a backend before they are ready
- **encrypted export lanes** for safer movement of sensitive bundles

## What makes this premium

Created by **Skyes Over London LC**, this extension carries the same branded design language and command-surface thinking used across the wider Skyes Over London ecosystem.

Key product traits:

- **Skyes Over London branding throughout**
- **s0l26-0s style intro and spectacle lane**
- **separate `background.html` lane**
- **separate UI partial lane**
- **offline-first local storage workflow**
- **encrypted `.skye` export/import support**
- **optional routing lanes without forcing backend complexity into the core app**

## Built for real operators

This release is suited for:

- founders managing multiple deploy surfaces
- developers packaging handoff bundles for clients
- operators who want a cleaner `.env` workflow
- teams who need a polished variable vessel without immediately wiring Postgres or cloud storage into the core product

## Install locally from VSIX

Open the Command Palette and run:

`Extensions: Install from VSIX...`

Then choose the packaged `.vsix` file.

After install, run:

`Skyes Over London: Open the Sovereign Variables Command Vessel`

## Package the extension

From this folder:

```bash
npm run package
```

## Publish directly to Open VSX

Create your namespace once:

```bash
npx ovsx create-namespace skyesoverlondon -p YOUR_OPENVSX_TOKEN
```

Publish the packaged extension:

```bash
npx ovsx publish sovereign-variables-0.1.2.vsix -p YOUR_OPENVSX_TOKEN
```

## Push the source to GitHub from your computer

```bash
git init
git add .
git commit -m "Initial Sovereign Variables release"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## Ownership

Created and operated by **Skyes Over London LC**.
