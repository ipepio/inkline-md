# Inkline delivery: main, docs, CI/CD y release v0.1.0

Entrega de v0.1.0 al repositorio GitHub `ipepio/inkline-md`: fusión, documentación,
CI en runners de GitHub y artefactos de escritorio en los 3 sistemas.

## Specs

- S1: "mergea todo a main"
- S2: "documenta todo el proyecto subelo git@github.com:ipepio/inkline-md.git"
- S3: "monta ci/cd para sacar app-image en linux y app en windows"
- S4: "buildea en mac en local, linux y windows que los runners sean los de github"
- S5: "y cuando esté todo, deja los 3 archivos en este pc"
- S6: "dudas?" → respuestas del humano: Windows = instalador **NSIS (.exe)**;
  publicar **Release v0.1.0** con los 3 archivos; **LICENSE MIT**; destino de los
  3 archivos = `~/Desktop/Inkline-v0.1.0/`.

## Tasks

| ID | Specs | Ruta | Commit |
|----|-------|------|--------|
| D1 | (previo) | inline: commitear fix pendiente (paneles h-full + scrollbars 6px) | fd466e5 |
| D2 | S1 | inline: merge ff `feat/inkline-v1` → `main` | fd466e5 |
| D3 | S2, S6 | inline: `README.md` (inglés) + `LICENSE` (MIT) | b133656 |
| D4 | S3, S4 | inline: `.github/workflows/build.yml` (ubuntu-latest AppImage, windows-latest NSIS, checks) | e6e6b46 |
| D5 | S2 | inline: remote + push de `main` | — |
| D6 | S3, S5 | inline: esperar runners y descargar artefactos con `gh` | run 44948681439 |
| D7 | S4, S5 | inline: `pnpm tauri build --bundles dmg` en local (arm64) | Inkline_0.1.0_aarch64.dmg |
| D8 | S6 | inline: `gh release create v0.1.0` con los 3 archivos | releases/tag/v0.1.0 |
| D9 | S5 | inline: copiar los 3 archivos a `~/Desktop/Inkline-v0.1.0/` + reporte | 3 archivos en Desktop |

## Log

- **L1**: "mergea todo a main, documenta todo el proyecto subelo git@github.com:ipepio/inkline-md.git monta ci/cd para sacar app-image en linux y app en windows, buildea en mac en local, linux y windows que los runners sean los de github, y cuando esté todo, deja los 3 archivos en este pc, dudas?"
- **L2**: Respuestas a las dudas: Windows NSIS `.exe` · Release v0.1.0 publicada · MIT · `~/Desktop/Inkline-v0.1.0/`. Verificado: repo existe y está vacío; SSH y `gh` autenticados; `main` local en `c5a0315`; 4 archivos del fix de scroll sin commitear; bundle `Inkline 0.1.0`, targets `all`.
- **L3**: Entrega completa. Commits: fix pendiente `fd466e5`, merge ff a `main`, docs `b133656`, ci `e6e6b46`; push a `origin/main` (repo **PRIVATE**, default main). Run **44948681439** success en los 3 jobs (checks, Linux AppImage, Windows NSIS). macOS `.dmg` construido en local. **Release v0.1.0** publicada con los 3 assets: https://github.com/ipepio/inkline-md/releases/tag/v0.1.0. Los 3 archivos quedaron en `~/Desktop/Inkline-v0.1.0/` (`Inkline_0.1.0_aarch64.dmg` 8.3M, `Inkline_0.1.0_amd64.AppImage` 87M, `Inkline_0.1.0_x64-setup.exe` 5.6M). Nota: binarios sin firmar; runners emiten avisos de deprecación de Node 20 (informativos, sin fallo).
- **L4** (2026-11-21): «saca tag, release y descarga los builds de linux y windows, genera el de mac y dejalos aquí /Users/ipepio/Workspace/ipepio/inlink-md-web/». Merge de `feat/zoom` (zoom global ⌘/Ctrl +/−/0, tamaño de lectura 12–16px, atajos conscientes de plataforma) a `main`, bump 0.1.0 → 0.1.1, tag y **Release v0.1.1** con los 3 bundles; los 3 archivos se dejan en `/Users/ipepio/Workspace/ipepio/inlink-md-web/` (Linux y Windows descargados de los runners de GitHub, macOS construido en local).
- **L5** (2026-11-22): «actualiza doc, mete en main, commit push tag release». Bump `0.1.1` → `0.2.0` (editor groups ⌘D + barra de pestañas dividida + sincronización mismo-doc + fix cierre en split, barra de menú nativa Rust, modo demo web `VITE_DEMO=1`, mejoras `modern-web-guidance`), docs actualizadas (`README.md`, `odd/tasks/`), push a `origin/main`, tag `v0.2.0` y GitHub Release `v0.2.0`.

