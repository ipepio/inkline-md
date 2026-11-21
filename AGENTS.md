# Inkline — Markdown Studio

Desktop Markdown editor/viewer built with Tauri 2. Stack: Rust (`src-tauri`) + React 18 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui.

## Commands

- `pnpm dev` — Vite dev server (port 1420)
- `pnpm tauri dev` — desktop app in dev mode
- `pnpm build` — typecheck (`tsc -b`) + Vite build (gate)
- `pnpm test` — vitest run
- `cd src-tauri && cargo check` / `cargo test`

## Conventions

- Product name: **Inkline**. UI copy in Spanish.
- Brand and layout reference: `design/inkline/inkline-markdown-studio.html` (do NOT edit it; it is the frozen design source).
- Design tokens live in `src/index.css` (Inkline palette; dark is default with accent `#d1ff65`, light accent `#769f21`). Inter via `@fontsource-variable/inter`.
- Feature source of truth: `odd/tasks/md-editor-viewer.md` — its `## Specs` are authoritative; read the document until `## Log`.
- Before UI/CSS/JS work, follow `.agents/skills/modern-web-guidance/SKILL.md` (search → retrieve; disclose applied guides).
- Rust commands live in `src-tauri/src/commands.rs`; TS wrappers live in `src/lib/*.ts` (invoke wrappers — components never call `invoke` directly).
- Writes to user files must be atomic (temp + rename in the same directory).
- Runtime: Tauri WKWebView on macOS, not a generic browser. No polyfills for Baseline features.
- Never commit scratch, temp files, or `src-tauri/target`.
