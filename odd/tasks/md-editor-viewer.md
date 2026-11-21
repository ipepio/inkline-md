# md-editor-viewer — Inkline: Tauri 2 markdown studio (React + Tailwind + shadcn)

Desktop Markdown editor/viewer on Tauri 2: dual mode (view / edit with live preview), file drawer, multi-document tabs. Brand: **Inkline — Markdown Studio** (reference mockup: `design/inkline/inkline-markdown-studio.html`). Status: implementation authorized («Adelante hasta terminar»); T1 done (c5a0315), T2 ∥ T4 delegated to DeepSeek workers.

## Specs

- **S1 Product**: «quiero hacer con tauri un editor/visualizador de .md lanza el odd para definir el producto» — desktop Markdown editor/viewer built with Tauri 2.
- **S2 Experience**: «hibrido, pero que permita visualizar. me explico. modo visualización y edición con vista prévia. Con drawer para ver files y poder abrir varios» — two modes: **view** (rendered reading) and **edit** (markdown source + live preview). File drawer with folder tree; multiple documents open as tabs. The mockup refines the mode switch into three layouts: Editor / Split / Preview.
- **S3 Audience**: «Personal, preparado para crecer» — v1 is personal use (macOS first); architecture must not block future distribution.
- **S4 v1 scope**: all four selected — «Núcleo de lectura/edición» (GFM render, code highlighting, shortcuts, open/save with atomic write + dirty indicator), «Gestor de archivos» (folder tree with choosable root, tabs preserving per-document state, persistent recents), «Exportación» (standalone HTML; print/save PDF), «Extras visuales» (light/dark theme following the system with manual override, Mermaid, careful typography).
- **S5 Stack**: «te diría que antes que vue, react y shadcn con tailwind, casi que lo prefiero» — React + TypeScript + Vite + Tailwind CSS + shadcn/ui on Tauri 2; framework-agnostic libs: CodeMirror 6 (editor), markdown-it (GFM), Shiki (code highlight), Mermaid (diagrams).
- **S6 Brand/mockups**: «puedes tomar ese html como mockups y brand» (source: `/Users/ipepio/Desktop/inkline-markdown-studio.html`; repo copy: `design/inkline/inkline-markdown-studio.html`) — Inkline brand: dark default (bg `#0c0f10`, accent `#d1ff65`) and light theme (accent `#769f21`); Inter + system mono; layout: icon rail (56px) + sidebar (256px: explorer, recents, local-first footer) + main (topbar with breadcrumbs and save-state, tab bar with export menu, format toolbar, panes with 700px readable column, status bar); command palette ⌘K; settings window; UI copy in Spanish, as in the mockup.
- **S7 Guidance skill**: «instalate esta skill para este repo https://github.com/GoogleChrome/modern-web-guidance» — installed at `.agents/skills/modern-web-guidance/` (Apache-2.0). Before UI/CSS/JS work, load the skill and follow its search→retrieve flow.
- **S8 Execution**: «con esto puedes orquestar agentes de deepseek para hacerlo?» — implementation units are delegated to the `gentle-ai-worker` role (`.pi/agents/gentle-ai-worker.md`, model `nan/deepseek-v4-flash`) via Herdr; the parent orchestrates, verifies against specs, and commits work units. Start pending the user's explicit go.

## Tasks

- T1 — S1,S3,S5 — route: parent inline — Skeleton: own git repo, Tauri 2 + Vite + React + TS + Tailwind + shadcn/ui, Rust file commands (read, atomic write), open/save one .md — commit: c5a0315 (main).
- T2 — S2,S4,S6 — route: worker — View mode: markdown-it GFM + Shiki + Mermaid + Inkline readable styles + light/dark theme — commit: pend.
- T3 — S2,S4,S6 — route: worker — Edit mode: CodeMirror 6, live preview (split), Editor/Split/Preview switch, format toolbar — commit: pend.
- T4 — S2,S4 — route: worker — File drawer: folder tree (choosable root), multi-doc tabs with per-tab state, persistent recents, ⌘K palette — commit: pend.
- T5 — S4 — route: worker — Export: standalone HTML (embedded styles) + print/PDF via system dialog — commit: pend.
- T6 — S4,S6 — route: parent/worker — Polish: settings window, status bar, shortcut map, brand fine-tuning — commit: pend.

## Log

- **L1**: «quiero hacer con tauri un editor/visualizador de .md lanza el odd para definir el producto»
- **L2**: «te diría que antes que vue, react y shadcn con tailwind, casi que lo prefiero»
- **L3**: «/Users/ipepio/Desktop/inkline-markdown-studio.html puedes tomar ese html como mockups y brand. con esto puedes orquestar agentes de deepseek para hacerlo? por cierto antes de eso, instalate esta skill para este repo https://github.com/GoogleChrome/modern-web-guidance» — dispositions: Inkline brand adopted (S6); skill installed (211 files, Apache-2.0); mockup copied to `design/inkline/`; worker definition created at `.pi/agents/gentle-ai-worker.md` (nan/deepseek-v4-flash); orchestration confirmed feasible (S8).
- **L4** (2026-11-21): ODD artifacts created — this document, visible todo (T1–T6), Engram mirrors. No source writes yet; T1 awaits the user's explicit go.
- **L5**: «Adelante hasta terminar. paraleliza lo que necesites/creas» — explicit go; parallelization left to the parent's judgment.
- **L6** (2026-11-21): T1 DONE inline — commits 34b73aa (setup: ODD doc, brand reference, guidance skill, worker role) and c5a0315 (skeleton) on main; branch feat/inkline-v1 opened. Gates observed: pnpm build ✓ (tsc -b + vite build), pnpm test ✓ 1/1, cargo test --lib ✓ 3/3 (atomic write leaves no temporaries, rejects parentless paths; read_file errors on missing). Setup notes: shadcn CLI 4.23.0 broken in this env → components generated with shadcn@4.22.0 (base-nova style over @base-ui/react); vitest 2.1 caused a dual-vite type clash → upgraded to vitest 3.2 (one orphaned vite@5 remains in the pnpm store, cosmetic).
