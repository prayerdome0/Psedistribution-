# Pilot Sales Public Runtime Hardening Implementation Plan

> **For Codex:** Execute this plan with the `superpowers:executing-plans` workflow. Keep production deployment, DNS, and external publication behind the owner gate.

**Goal:** Produce a locally verified release candidate in which the intended Pilot Sales public site is the only deployable output and its critical browser flows work across desktop, mobile, and resize transitions.

**Architecture:** Keep the existing source tree intact, but introduce a manifest-driven build that copies only approved public files into a clean Vercel output directory. Verify the built artifact, not the repository root. Repair the cinematic hero as a responsive state machine, add a dependency-free Chrome/CDP browser verifier, and align public metadata/tests with the actual seven-page public contract.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js built-ins, Chrome DevTools Protocol, Python/pytest, Vercel static output configuration.

---

## Task 1: Enforce a clean public deployment boundary

**Files:**
- Create: `public-release.json`
- Create: `scripts/build-public-site.mjs`
- Modify: `.gitignore`
- Modify: `vercel.json`
- Modify: `tests/test_static_site.py`

1. Add failing tests that require an exact public-release manifest, a clean build output, and exclusion of legacy HTML, source archives, infrastructure configuration, test files, and internal reports.
2. Run `uv run --with pytest python -m pytest tests/test_static_site.py -q` and retain the expected failures.
3. Implement the manifest and deterministic build script. The script must reject missing or non-file inputs, clean only its resolved output directory, and prove the emitted file set equals the manifest.
4. Configure Vercel to run the build and serve only `.vercel-public`; add `X-Frame-Options: DENY` while retaining the existing CSP and other headers.
5. Re-run the focused pytest suite and confirm the deployment-boundary tests pass.

## Task 2: Repair responsive hero state and visual regressions

**Files:**
- Create: `scripts/verify-public-browser.mjs`
- Modify: `site.js`
- Modify: `site.css`

1. Build a dependency-free local preview plus Chrome/CDP verifier for 1280x720 desktop, 390x844 mobile, desktop-to-mobile resize, RFQ validation/local draft behavior, network silence, overflow, and definite Axe accessibility violations.
2. Run the verifier against the current source and retain failures for the 1280x720 overlap, stale resize class, and contrast violation.
3. Refactor the hero setup into a mode synchronizer that listens to viewport, pointer, and reduced-motion changes. Compact or non-interactive modes must cancel animation, pause the video, set `preload=none`, and use the poster layout; eligible desktop mode may load and enable inspection.
4. Add narrow-height desktop spacing and high-specificity mobile fallbacks so transient class state cannot force desktop absolute positioning below 901px.
5. Darken the affected display-system eyebrow with the existing accessible teal-dark token.
6. Rebuild and rerun the browser verifier until all browser checks pass.

## Task 3: Align the public document and discovery contract

**Files:**
- Modify: `index.html`
- Modify: `products.html`
- Modify: `rfq.html`
- Modify: `about.html`
- Modify: `contact.html`
- Modify: `privacy.html`
- Modify: `terms.html`
- Modify: `robots.txt`
- Modify: `sitemap.xml`
- Modify: `tests/test_static_site.py`

1. Replace legacy-page expectations with the exact seven-page public contract and fail-closed assertions for protected placeholders that remain source-only.
2. Require valid descriptions, canonical URLs, Open Graph/Twitter metadata, homepage Organization/WebSite JSON-LD, breadcrumb JSON-LD on non-home pages, coherent sitemap entries, and RFQ noindex behavior.
3. Add the missing metadata without changing product or commercial claims. Include RFQ in the sitemap for discovery while preserving its `noindex` directive only if tests establish that contract is intentional; otherwise omit it from sitemap to keep directives coherent.
4. Add `/api/` to `robots.txt` as defense in depth; do not treat robots rules as access control.
5. Run the complete static test file and confirm every current public-contract check passes.

## Task 4: Verify wiring and package the owner-gated handoff

**Files:**
- Modify if needed: `docs/superpowers/plans/2026-08-14-pilot-runtime-hardening.md`

1. Run the public build into a fresh temporary directory and compare the output exactly with `public-release.json`.
2. Run the full static pytest suite and the browser verifier against the built `.vercel-public` artifact.
3. Perform three wiring passes: source/control (manifest, Vercel config, headers), runtime/data flow (built routes, assets, responsive state, RFQ network silence), and usefulness (desktop/mobile browser checks, accessibility, discoverability).
4. Inspect `git diff --check`, `git status`, and the final diff. Preserve unrelated files and do not push, deploy, change DNS, or mutate Vercel project state.
5. Record exact PASS/PARTIAL/BLOCKED results and identify the smallest production gate: owner approval for the exact Vercel deployment followed by independent live route, exposure, header, visual, and release-parity checks.
