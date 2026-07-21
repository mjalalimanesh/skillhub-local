# SkillHub Local — Full Redesign Plan

**Design Read:** Bolder overhaul of a local dev-tool SPA (SkillHub Local) for power users, dual-theme, in the Raycast/Linear family but with its own accent identity. Dials: `VARIANCE 7 / MOTION 4 / DENSITY 6`.

**Accent decision (veto-able):** Replace the generic indigo `#6366f1` with an **ember orange** (`oklch` orange, ~`#f97316` dark / `#ea580c` light) — a "workshop of tools" metaphor that escapes the AI-purple cliché. Warning shifts from amber to yellow (`#eab308`) to stay distinct from the accent. One accent, locked across all pages.

---

## Phase 1 — Foundation: tokens, fonts, theming

1. **Rewrite `src/styles/index.css`:**
   - Import `@fontsource/geist-sans` + `@fontsource/geist-mono` (new deps; self-hosted, no Google Fonts link)
   - Replace `@theme` with `@theme inline` referencing CSS vars, so themes flip by swapping var values. Rename awkward tokens:
     - `bg`→`base`, `surface` stays, `surface-alt`→`raised`, `border`→`line`, `border-hover`→`line-strong`
     - `text`→`ink`, `text-muted`→`ink-muted`, `text-dim`→`ink-dim` (kills the `text-text` / `bg-bg` ugliness)
     - `primary`→`accent` / `accent-hover`; keep `success` / `warning` / `danger`
   - `:root` = dark values (default), `.light` class on `<html>` = light values. Both themes fully specified, off-black/off-white (no pure `#000`/`#fff`), AA contrast in both
   - Radius scale lock: inputs/buttons `8px`, cards/dialogs `12px` — documented in a comment, enforced everywhere
   - Import `tw-animate-css` (new dep) so the dialog's existing `animate-in`/`zoom-in-95` classes actually work
   - Keep thin scrollbars, theme them via vars
2. **New `src/lib/theme.ts`:** reads `preferences.theme` from `api.getConfig()`, applies/removes the `light` class on `<html>`, subscribes to `prefers-color-scheme` when theme is `system`. Called once from `App.tsx`; re-applied when Settings saves. Default (pre-load) is dark, matching `:root`.

## Phase 2 — Shared primitives (`src/components/ui/`)

Build once, use everywhere (uses already-installed Radix + CVA, no new deps):
- `button.tsx` — CVA variants: `primary` (accent), `secondary`, `ghost`, `danger`; sizes `sm/md/icon`; `active:scale-[0.98]` tactile push
- `input.tsx`, `select.tsx` (Radix Select wrapper — replaces all native `<select>`s), `badge.tsx`, `card.tsx`, `skeleton.tsx`, `tooltip.tsx`
- Restyle `dialog.tsx` onto the new tokens
- `toaster.tsx` — small Zustand-backed toast stack (top-right, ~60 lines): renders WS install/remove/update progress events as they stream in, auto-dismisses on `done`, error toasts persist until dismissed. This finally surfaces the progress data already in the store
- `confirm-dialog.tsx` — reusable confirm built on the existing dialog (used for row-level removes)

## Phase 3 — Layout overhaul

- **`Sidebar.tsx`:** grouped nav sections (`Overview`: Dashboard, Matrix · `Manage`: Skills, Agents · `System`: Store, Plugins, Settings), active item gets a 2px accent leading bar + `bg-raised` instead of the purple-tint wash, WS status pill + version move to a proper sidebar footer
- **`Layout.tsx`:** content column gets `max-w-6xl mx-auto px-8 py-8` (pages currently sprawl edge-to-edge on wide monitors), subtle CSS fade on route change
- **New `PageHeader.tsx`:** consistent page header — title, one-line muted description, right-aligned action slot; breadcrumb variant (`Skills / <name>`) for the detail page. No eyebrow labels

## Phase 4 — Page-by-page restyle + UX fixes

- **Dashboard:** stat cards on new primitives; add an **Activity panel** fed by the store's `progress` log (recent installs/removals with status icons) — uses data that's currently collected and thrown away
- **Skills:** native selects → Radix `Select`; **wire the dead Update button** to `api.updateSkill` (endpoint already exists) with pending state; **Remove gets a confirm dialog**; rows denser, consistent chips
- **Skill Detail:** breadcrumb header, restyled action bar, `SKILL.md` `<pre>` in Geist Mono with proper surface/border
- **Matrix:** sticky header row in addition to sticky first column, refined ✓/— cells
- **Store / Plugins / Agents / Settings:** port to primitives; Settings' Theme dropdown becomes live (wired to Phase 1's `theme.ts`)

## Phase 5 — Fixes, audit, verify

- Complete the empty reconnect `setTimeout` in `useWebSocket.ts` (currently a no-op bug)
- Cap the `progress` array in the store (it's append-only forever)
- **Pre-flight audit per skill rules:** every button passes AA contrast in both themes, accent-color consistency lock, radius lock, no mixed icon families (lucide stays — project already depends on it), reduced-motion respected, copy self-audit on all visible strings
- **Verify:** `npm run typecheck` and `npm run build` in `packages/frontend`; quick `npm run dev` smoke run to confirm backend+frontend boot

**New dependencies (3, all frontend):** `@fontsource/geist-sans`, `@fontsource/geist-mono`, `tw-animate-css`. No `motion` — MOTION 4 is achievable with CSS transitions + tw-animate-css, keeping the bundle lean.

**Not changing:** backend, API client signatures, routing structure, store data flow. `AGENTS.md` gets a conventions note about the new `ui/` primitives.
