# SkAIxu Valuation Standard
**Author:** Skyes Over London  
**Directive Type:** Mandatory — Apply to every valuation document produced for any SkAIxu asset  
**Last Updated:** February 2026

---

## What Every Valuation Must Contain

No valuation page, section, or document is complete unless ALL of the following are present, explicitly numbered, and expressed in hard figures (£ amounts + hours where applicable). Do not produce a valuation without every one of these components.

---

### 1. Engineering Reproduction Cost

This is the cost to rebuild the asset from scratch, line by line, with a senior engineering team that has never seen the codebase before.

**Must include:**
- A blended hourly rate (default: **£120/hour** senior blended rate)
- **Per-workstream hour ranges** — every major area of the codebase broken out individually (e.g., architecture, visual system, auth, onboarding, backend, tooling, docs)
- **Low-end total hours** and resulting **£ total**
- **High-end total hours** and resulting **£ total**
- A one-sentence description of what each workstream covers so a non-technical reader understands what they are paying for

This is **not** asset value. This is the floor. It is what it costs to reproduce the thing.

---

### 2. Overall Infrastructure & Code Work

This covers everything beyond pure feature engineering — the decisions, the architecture patterns, and the operational scaffolding that make the codebase production-ready rather than demo-ready.

**Must include:**
- Gateway discipline (routing, auth, key management, error handling)
- Deployment infrastructure (Netlify config, functions, routing rules, environment setup)
- PWA / service worker implementation if present
- Diagnostic and observability layer (event logging, error surfaces, health indicators)
- Multi-tool integration patterns (shared localStorage contracts, shared key surfaces, cross-app navigation)
- Theme/brand system (CSS variables, font stack, design tokens, animation system) — because reproducing this consistently across a suite costs real engineering time
- Any CI/CD, branching, or version control discipline implemented
- Documentation layer — analysis files, directives, integration plans, written governance

Each of these must have an associated **hour estimate** and **£ range**, even if grouped. They cannot be hand-waved as "overhead."

---

### 3. Asset Valuation (Acquisition Value)

This is different from reproduction cost. Asset value is what a buyer would rationally pay to acquire the working, tested, demo-ready system — avoiding rebuild risk, time-to-market delay, and design iteration cost.

**Must include:**
- The **asset multiplier** applied: standard range is **1.4×–1.8×** on reproduction cost for a working, demo-ready codebase
- The resulting **low asset value** (reproduction low × 1.4)
- The resulting **high asset value** (reproduction high × 1.8)
- A **center-of-mass** figure — the single number you would put in a room or on a term sheet
- A clear explanation of why the multiplier is justified for this specific asset (e.g., governance-first architecture, onboarding baked in, multi-tool ecosystem, brand-quality visuals)

---

### 4. Licensing / Access Tiers (if applicable)

Where the asset has a commercially licensable component, include:

- An **ACCESS** tier — limited use, annual or per-seat pricing
- A **COMMAND** tier — full operational use, higher annual price
- A **SOVEREIGN** tier — full acquisition / buyout, one-off figure

Each tier must have a concrete **£ number**, not a range. Ranges belong in the reproduction cost section. Tier prices are a positioning decision; they should be defensible but decisive.

---

### 5. Deal Separation Statement

Every valuation must explicitly state:

- Which asset this valuation covers (name it exactly)
- Which assets are **excluded** from this valuation and documented elsewhere
- Whether any numbers on this page are combined with other assets, and if so, which ones and why
- A confirmation line that reproduction cost and asset value are calculated independently and not conflated

This prevents confusion in client/investor meetings when multiple assets are being valued simultaneously.

---

### 6. What a Valuation Must NOT Do

- **Never produce a valuation without explicit £ figures.** Qualitative bands ("high value," "significant") are not valuations.
- **Never combine asset valuations for different tools without explicit instruction.** GodKode, SkAIxu IDE, Neural-Space-Pro, and all other tools each have their own valuation sheet. Do not stack them unless the user explicitly asks.
- **Never omit infrastructure or code work from the reproduction cost.** A gateway config, a Netlify function, a service worker, and a localStorage contract are all engineering hours. Count them.
- **Never use only one number.** Every valuation must show the range (low/high) AND the center-of-mass anchor so the reader understands both the floor and the point to negotiate from.
- **Never drop content from a valuation document when updating it.** If existing analysis content existed, it is preserved. Adding a new section does not delete prior sections.

---

## Quick Reference — Minimum Valuation Checklist

| Component | Required | Must Include £ Figures |
|---|---|---|
| Engineering reproduction cost (per workstream) | ✅ | ✅ |
| Total hours low/high + £ totals | ✅ | ✅ |
| Infrastructure & code work breakdown | ✅ | ✅ |
| Asset multiplier (1.4×–1.8×) | ✅ | ✅ |
| Asset value low, high, center-of-mass | ✅ | ✅ |
| Licensing tiers (ACCESS / COMMAND / SOVEREIGN) | ✅ where applicable | ✅ |
| Deal separation statement | ✅ | — |
| Excluded assets named explicitly | ✅ | — |

---

## Default Rate Card

| Role | Rate |
|---|---|
| Senior Full-Stack Engineer | £130/hour |
| Senior UI/UX Engineer | £110/hour |
| Blended Senior Rate (default) | **£120/hour** |
| Infrastructure / DevOps Specialist | £125/hour |
| Technical Writer / Architect | £100/hour |

The blended rate of **£120/hour** is the default unless the user specifies otherwise.

---

*This directive applies to all files in the SkAIxu asset suite. Any valuation that does not meet this standard must be redone.*
