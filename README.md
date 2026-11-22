# Inkline

![Inkline](src/assets/brand/inkline.png)

Inkline is a local-first Markdown studio for the desktop: a distraction-free
viewer, a full editor with live preview, and an exporter — in one native
window built with Tauri 2.

## Features

- **Two working modes** — rendered *viewer*, raw *editor*, and a resizable
  *split* with live preview (drag the divider; the layout is remembered per
  document).
- **Editor groups** — `⌘D` splits the workspace into at most two groups, each
  with its own document and its own editor/preview/split mode; the tab bar
  stays one and is divided per group, and every shell action (open, save,
  close, format) follows the focused group. The same file can live in both
  groups, with edits appearing live in the other. The split is session-only:
  nothing is persisted.
- **File workspace** — side drawer with folder tree, recents and open-document
  tabs; fuzzy command palette (`⌘K`).
- **Editor** — CodeMirror 6 with line numbers, Markdown highlighting,
  formatting toolbar, per-document cursor/scroll restoration, optional word
  wrap, adjustable font size and tab width.
- **Viewer** — GitHub-flavored Markdown with syntax highlighting (Shiki),
  diagrams (Mermaid) and task lists.
- **Export** — standalone HTML, Markdown copy, and Office formats
  (`.docx`, `.odt` via macOS `textutil`); printing goes through the system
  browser.
- **Native menu bar & shortcuts** — native File/Edit/View menus routed to the
  same shell actions as keyboard shortcuts (`⌘D`, `⌘W`, `⌘O`, `⌘S`, `⌘K`,
  `⌘+/-`/`⌘0`), with platform-aware shortcut labels.
- **Settings** — theme (system/dark/light), editor options, export page size;
  preferences and per-document state persist locally.
- **Local-first** — files are written atomically (write-then-rename) and
  nothing leaves your machine.

## Stack

| Layer | Choice |
| --- | --- |
| Shell | Tauri 2 (Rust) |
| UI | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Editor | CodeMirror 6 |
| Markdown | markdown-it (GFM) + Shiki + Mermaid |

## Getting started

Requirements: Node 22+, pnpm (via Corepack), Rust stable, and the
[Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
pnpm install
pnpm tauri dev
```

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server (frontend only) |
| `pnpm tauri dev` | Desktop app in dev mode |
| `pnpm test` | Vitest suite (jsdom) |
| `pnpm build` | Type-check + Vite production build |
| `pnpm build:demo` | Static web demo build (`VITE_DEMO=1`) with bundled sample doc |
| `pnpm tauri build` | Bundled desktop app for your OS |

## Desktop bundles

CI runs the test suite and builds the Linux and Windows bundles on GitHub-hosted
runners on every push to `main` (also manually via *workflow dispatch*). The
macOS bundle is built locally on an arm64 machine. Grab everything from
[Releases](https://github.com/ipepio/inkline-md/releases).

| OS | Artifact | Where |
| --- | --- | --- |
| Linux | `.AppImage` | `ubuntu-latest` runner |
| Windows | NSIS `-setup.exe` | `windows-latest` runner |
| macOS | `.dmg` (Apple silicon) | local build |

> The binaries are **unsigned**. macOS Gatekeeper and Windows SmartScreen will
> show a first-run warning; use your OS "open anyway" flow. Office export
> (`.docx` / `.odt`) uses macOS `textutil` and is unavailable on other systems.

## Project structure

```
src/        React UI (components, hooks, lib)
src-tauri/  Rust shell: atomic file IO, workspace, export commands
design/     Original HTML mockup (frozen brand reference)
odd/tasks/  Feature specs and task logs (ODD workflow)
.github/    CI workflows
```

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

You may use, modify and redistribute this code, including commercially, as long
as you keep the copyright and NOTICE files, state significant changes, and respect
the patent grant (and its retaliation clause). The Inkline name and logo are not
licensed: a fork that changes the branding is welcome, one that ships the same
name is not.
