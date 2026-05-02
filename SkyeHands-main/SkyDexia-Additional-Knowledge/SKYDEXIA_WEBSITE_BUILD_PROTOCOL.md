# SkyeDexia Website Build Protocol

This is the mandatory playbook SkyeDexia runs through every time a user requests a website, landing page, SaaS UI, dashboard, or client delivery package.

Read this file before generating any website. Every step is required.

---

## Provider Routing

SkyeDexia orchestrates multiple AI providers. Each task type has a designated provider:

| Task | Primary Provider | Fallback |
|---|---|---|
| Design planning / UX reasoning | Claude (Anthropic) | OpenRouter |
| HTML / CSS / JS code generation | OpenAI GPT-4o | DeepSeek |
| Fast iteration / quick fixes | Groq (Llama 3.3 70B) | OpenAI |
| Research / current best practices | Perplexity | Claude |
| Cost-efficient bulk code | DeepSeek | Groq |
| Any provider fallback | OpenRouter | — |

Never use one provider for everything. Route by task type.

---

## Step 1 — Design Planning (Claude)

Before writing a single line of code, Claude receives the user brief plus the following context injected as system prompt:
- This file (website build protocol)
- `design-vault/library/house-style/sole-skye-visual-standard.md`
- `design-vault/library/templates/template-catalog.json` (relevant sections)
- `design-vault/library/use-case-matrix.json` (matching product lane)
- `AbovetheSkye-Platforms/SkyeWebCreatorMax/SkyeWebCreatorMax_DIRECTIVE.md`

Claude returns a **structured design brief** as JSON with these fields:
```json
{
  "siteName": "string",
  "palette": { "bg": "#hex", "ink": "#hex", "accent1": "#hex", "accent2": "#hex", "muted": "#hex" },
  "typography": { "headingScale": "string", "bodySize": "string", "fontStack": "string" },
  "has3D": true,
  "heroType": "split | centered | fullscreen | product-right",
  "sections": ["hero", "proof", "features", "pricing", "testimonials", "cta", "footer"],
  "tone": "enterprise | startup | studio | minimal | luxury",
  "keyMessages": ["string"],
  "ctaPrimary": "string",
  "ctaSecondary": "string",
  "targetAudience": "string"
}
```

Claude must check the house-style standard before producing this brief. No generic neon SaaS styling. No one-screen toy pages. The SOLE/SkyeSol visual standard is the quality floor.

---

## Step 2 — Code Generation (OpenAI or DeepSeek)

The code generation model receives:
- The design brief from Step 1
- The house-style standard as system context
- The SkyeWebCreatorMax starter template as a quality reference
- The following hard rules (always injected, never optional):

### Hard Code Rules

**Structure — every generated website must include:**
- `index.html` — semantic HTML5, accessible, all sections wired
- `styles.css` — custom properties driving the full palette, no inline styles
- `app.js` — canvas/Three.js layer if `has3D` is true, otherwise animation/interactivity
- `README.md` — provenance note + stack explanation

**HTML rules:**
- Every `<a>` must have a real `href` (hash targets a real `id` or external URL)
- Every `<button>` must have an `onclick` or `type="submit"` inside a form
- No `disabled` on primary CTAs without a functional reason
- Use semantic tags: `<nav>`, `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`
- Every section must have an `id` that matches nav anchor links

**CSS rules:**
- Use `:root` CSS custom properties for every color, spacing token, and font
- Dark base minimum: `background: #06060f` or darker
- Cinematic background: layered `radial-gradient` or `conic-gradient` overlays on `body` or `#bg` canvas
- Typography: `clamp()` for fluid heading sizes, minimum `font-size: clamp(42px, 7vw, 96px)` for H1
- Glass cards: `background: rgba(255,255,255,0.05)`, `border: 1px solid rgba(255,255,255,0.09)`, `backdrop-filter: blur(16px)`
- CTAs: gradient background, strong contrast, minimum 44px touch target
- Sticky nav: `position: sticky; top: 0; backdrop-filter: blur(20px); z-index: 100`

**Canvas / Three.js rules (when `has3D` is true):**
- Always use `position: fixed; inset: 0; z-index: 0; pointer-events: none` for the canvas
- All content sits on `z-index: 1` or higher
- Must have a 2D canvas fallback path that still looks cinematic (animated radial gradient dots)
- If using Three.js: particles + connection lines (neural network) or floating orbs are the house default
- Mouse parallax on camera is strongly preferred
- Canvas must remain performant: max 300 particles, connection distance limit, `requestAnimationFrame` loop
- Load Three.js from CDN: `<script src="https://cdn.jsdelivr.net/npm/three@0.169/build/three.min.js"></script>`
- Always wrap scene init in `try/catch` — guard against THREE undefined
- Use `WebGLRenderer` with `{ alpha: true, antialias: true }`
- Set `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- Add a resize listener: `renderer.setSize(window.innerWidth, window.innerHeight)`
- Animate slowly — multiply elapsed time by `0.0003` or less
- Keep draw calls under 3 meshes for performance
- Ambient light intensity `0.4` + one directional light for depth

**Section architecture (required sections):**
1. **Hero** — eyebrow label + giant H1 + subhead + 2 CTAs + product visual or 3D scene
2. **Proof / Social** — 3 stat blocks or 3 client logos or 3 key facts
3. **Features / How it works** — 3-column grid, icon + title + description
4. **Pricing or Offer** — at least 2 tiers with a highlighted recommended option
5. **CTA / Intake** — final conversion block with primary action
6. **Footer** — nav links, copyright, built-by note

If the user brief does not mention a section explicitly, include it anyway at a sensible level. One-screen pages are not allowed.

---

## Step 3 — Quality Review (Claude)

Claude receives the generated code and checks against this list. If any item fails, it returns a fix list.

**Quality checklist:**
- [ ] First screen makes the real product/service immediately obvious
- [ ] H1 is substantive (describes what the thing does, not a generic tagline)
- [ ] All nav links work (anchor targets exist in the HTML)
- [ ] All CTA buttons have a real action (href or onclick)
- [ ] Color contrast is sufficient (dark bg, light text, accent for interactive elements)
- [ ] Canvas/3D runs without JS errors (check for `THREE` undefined guard)
- [ ] Mobile layout does not break (check `@media` queries exist for <768px)
- [ ] No placeholder text left in (Lorem ipsum, "Your headline here", etc.)
- [ ] Footer exists and has at least copyright + 2 nav links
- [ ] README.md present with provenance

If 3+ items fail, return to Step 2 with the fix list. If <3 items fail, patch inline.

---

## Step 4 — Polish Pass (Groq — fast)

Groq runs a fast pass on any identified fixes from Step 3. Only apply targeted changes, do not regenerate from scratch.

---

## Step 5 — Persist and Deliver

Save artifacts to:
- `.skyequanta/webcreator/projects/<projectId>/project.json` (project manifest)
- `.skyequanta/webcreator/projects/<projectId>/artifacts/index.html`
- `.skyequanta/webcreator/projects/<projectId>/artifacts/styles.css`
- `.skyequanta/webcreator/projects/<projectId>/artifacts/app.js`
- `.skyequanta/webcreator/projects/<projectId>/artifacts/README.md`

Update `.skyequanta/webcreator/projects-index.json`.

Emit events on the platform bus:
- `webcreator.project.generated`
- `app.generated`

---

## Step 6 — Browser Preview (Puppeteer)

After artifacts are on disk, spin up a local HTTP server and take a screenshot with headless Chrome.

**Rules:**
- Serve the artifacts directory on a random port (40000–60000) via Node's `http` module
- Launch Puppeteer at 1440×900, `--no-sandbox` for Linux compatibility
- Navigate to `/` with `waitUntil: networkidle0` (15s timeout), fall back to `domcontentloaded`
- Wait 1200ms after navigation to allow Three.js canvas and CSS animations to render
- Screenshot to `artifacts/preview.png` (viewport only, not full-page)
- Store the relative path in `projectManifest.previewScreenshot`
- Close browser and static server before returning
- If Puppeteer is not installed, log the skip reason and continue without blocking the build

**Smoke command:** `node scripts/ae-skydexia-preview.mjs <projectId>`

---

## Quality Reference — The EnVar Tutorial Standard

`SkyeHands-main/Later-Additions/SkyeDexiasEnVarTutorial/index.html` is a proof-of-quality reference.

That page demonstrates:
- Three.js neural network background (240 particles, connection lines, glowing orbs, mouse parallax)
- Animated gradient headline with CSS `background-size: 300%` + keyframe
- Glassmorphism cards with `backdrop-filter: blur`
- Sticky filter bar with frosted glass
- Expandable sections with CSS `max-height` transition
- `crypto.getRandomValues` for local secret generation
- `localStorage` persistence with save/restore
- Download generation (Blob → anchor click)
- Toast notifications

Any website SkyeDexia generates must match or exceed this quality level.

---

## Palette Templates

Use one of these unless the user's brief specifies otherwise.

**Obsidian / SOLE (default for enterprise/luxury):**
```css
--bg: #060610;
--ink: #e8e8f0;
--accent1: #7c3aed;   /* purple */
--accent2: #06b6d4;   /* cyan */
--muted: #64748b;
--gold: #f59e0b;
```

**Magma / Founder (for high-energy startup/product):**
```css
--bg: #030805;
--ink: #f4fff7;
--accent1: #39ff88;   /* green */
--accent2: #5df1ff;   /* cyan */
--plasma: #ff4fd8;    /* pink accent */
--muted: #adc7b9;
```

**Noir / Studio (for creative/agency):**
```css
--bg: #0c0c0c;
--ink: #f5f5f5;
--accent1: #ff6b35;   /* orange */
--accent2: #ffd700;   /* gold */
--muted: #888;
```

---

## AE Agent Entry Points

AE agents call SkyeDexia through these registered scripts and HTTP routes:

| Script | Purpose | HTTP equivalent |
|---|---|---|
| `scripts/ae-skydexia-build.mjs "<brief>"` | Full 6-step build | `POST /build-website` |
| `scripts/ae-skydexia-threejs.mjs "<brief>"` | Force `has3D:true` build | `POST /build-threejs` |
| `scripts/ae-skydexia-status.mjs` | Worker + provider health | `GET /status` |
| `scripts/ae-skydexia-preview.mjs <projectId>` | Screenshot existing project | `POST /preview` |

All scripts exit `0` on success, `1` on error, and print JSON to stdout.

---

## What SkyeDexia Must Never Do

- Generate a website without running through Steps 1–6
- Skip the design brief step and go straight to code
- Skip the browser preview step without logging the reason
- Use only one AI provider for everything
- Produce a one-section/one-screen page
- Leave placeholder text in the output
- Leave any `href="#"` without a real target
- Use generic neon SaaS color schemes that don't match a named palette
- Claim completion without persisting artifacts
- Skip the quality review step
