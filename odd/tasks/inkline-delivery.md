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
| D1 | (previo) | inline: commitear fix pendiente (paneles h-full + scrollbars 6px) | — |
| D2 | S1 | inline: merge ff `feat/inkline-v1` → `main` | — |
| D3 | S2, S6 | inline: `README.md` (inglés) + `LICENSE` (MIT) | — |
| D4 | S3, S4 | inline: `.github/workflows/build.yml` (ubuntu-latest AppImage, windows-latest NSIS, checks) | — |
| D5 | S2 | inline: remote + push de `main` | — |
| D6 | S3, S5 | inline: esperar runners y descargar artefactos con `gh` | — |
| D7 | S4, S5 | inline: `pnpm tauri build --bundles dmg` en local (arm64) | — |
| D8 | S6 | inline: `gh release create v0.1.0` con los 3 archivos | — |
| D9 | S5 | inline: copiar los 3 archivos a `~/Desktop/Inkline-v0.1.0/` + reporte | — |

## Log

- **L1**: "mergea todo a main, documenta todo el proyecto subelo git@github.com:ipepio/inkline-md.git monta ci/cd para sacar app-image en linux y app en windows, buildea en mac en local, linux y windows que los runners sean los de github, y cuando esté todo, deja los 3 archivos en este pc, dudas?"
- **L2**: Respuestas a las dudas: Windows NSIS `.exe` · Release v0.1.0 publicada · MIT · `~/Desktop/Inkline-v0.1.0/`. Verificado: repo existe y está vacío; SSH y `gh` autenticados; `main` local en `c5a0315`; 4 archivos del fix de scroll sin commitear; bundle `Inkline 0.1.0`, targets `all`.
