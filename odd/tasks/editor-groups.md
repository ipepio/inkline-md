# Inkline editor groups: dos grupos de edición por atajo (⌘D)

División del área de trabajo en 2 grupos de edición (máximo), cada uno con su
documento activo y su propio modo editor/preview/split. Solo por atajo, sesión
efímera, pestañas divididas tipo Chrome y el mismo `.md` puede vivir en ambos
grupos con edición sincronizada.

## Specs

- S1: "Y si en una pestaña (que ahora mismo tenemos editor y preview) damos la opción de dividirla y poder trabajar con un máximo 2 documentos diferentes? de forma que puedas tener 2 editores y 2 previews? me explico?"
- S2: "es decir, tu seleccionas un editor, y puedes seleccionar otro archivo md y se te abre en ese editor."
- S3: "OJO! esto solo sería mediante atajo (cmd d por ejemplo) y por defecto tienes 2 editores sin preview, pero que puedas sacar el preview de cada editor. me explico?"
- S4: Al dividir, el segundo grupo nace VACÍO, con una llamada a la acción («⌘O o elige del explorador y se abre aquí»). [respuesta del humano]
- S5: "cmd W por ejemplo cierra el del foco, y mientras hayan 2, sale la cruz para cerrar uno" — ⌘W cierra el documento del grupo enfocado (con confirmación si está sucio); con 2 grupos cada grupo muestra una cruz que lo cierra y sus pestañas pasan al grupo superviviente (sin perder documentos). [respuesta del humano]
- S6: "una pestaña, pero dividida, tipo chrome" — UNA barra de pestañas dividida en secciones (una por grupo, con divisor); clic en una pestaña activa ese documento en su grupo y enfoca ese grupo. [respuesta del humano]
- S7: "No, sesión efímera, y ojo! pueden estar los dos editores con el mismo md, entonces se modifica en ambos lo que se escribe eh" — la división NO se persiste; el MISMO documento puede estar en los dos grupos y lo escrito en uno se refleja en el otro (estado compartido). [respuesta del humano]

## Decisión de diseño (integrador)

- Los grupos son estado en memoria del shell (ni Rust ni localStorage).
- Grupo: `{ id, docIds (ordenados), activeDocId, mode }`. El array `docs`
  (`lib/documents`) sigue siendo único y compartido; los grupos referencian
  ids y un mismo id puede estar en ambos (contenido sincronizado gratis).
- El grupo con foco (último clic) recibe ⌘O/⌘N, explorador, recientes, paleta,
  ⌘S, ⌘E, la barra de formato y la barra de estado. Zoom y tema siguen
  siendo globales. `viewState` por doc queda compartido entre sus vistas.
- ⌘D divide (máx 2; con 2 es no-op). El grupo nuevo nace vacío en modo editor.
- Restricción de merge (rama hermana `feat/web-demo-mode`): su `isDemoMode()`
  vive en el efecto de montaje, `handleOpenDialog`, guardar y export/print.
  El refactor debe dejar costuras estables y nombradas en esos puntos — no
  renombrar esos handlers ni reordenar sus guardas.

## Tasks

| ID | Specs | Ruta | Commit |
|----|-------|------|--------|
| T1 | (habilita S1–S7) | worker: extraer orquestación de `App.tsx` a hooks (`src/hooks/`) sin cambio de comportamiento; costuras estables para el merge del demo | 6b3737c |
| T2 | S1–S4, S7 | worker: modelo de grupos (reducer puro: split/closeGroup/open/closeDoc/activate/focus/setMode) + tests exhaustivos | a9ce9bb |
| T3 | S1, S3–S5 | worker: shell de grupos (render máx 2, divisor redimensionable entre grupos, × visible sólo con 2, CTA vacía, marca de foco) | 17cb3ed |
| T4 | S6 | worker: `TabsBar` dividida en secciones por grupo con divisor | b89bf65 |
| T5 | S2–S5, S7 | worker: enrutado de acciones al grupo enfocado (⌘D, ⌘O/⌘N, ⌘W, ⌘S, ⌘E, explorador/recientes/paleta, formato, barra de estado) | 5d4c3c3 |
| T6 | S1–S7 | worker: pruebas de sincronización mismo-doc + suite completa + README | 5134a03 |
| T7 | S3–S5 | worker: barra de menú nativa (Archivo/Editar/Ver) con aceleradores enrutados a las mismas acciones + documentación de atajos veraz | — |

## Log

- **L1**: "se me ha ocurrido otra nueva feature. Y si en una pestaña (que ahora mismo tenemos editor y preview) damos la opción de dividirla y poder trabajar con un máximo 2 documentos diferentes? de forma que puedas tener 2 editores y 2 previews? me explico? es decir, tu seleccionas un editor, y puedes seleccionar otro archivo md y se te abre en ese editor. OJO! esto solo sería mediante atajo (cmd d por ejemplo) y por defecto tienes 2 editores sin preview, pero que puedas sacar el preview de cada editor. me explico?"
- **L2**: Respuestas de diseño: al dividir → grupo vacío con CTA · cierre → ⌘W cierra el doc del grupo enfocado y con 2 grupos aparece una cruz por grupo (sus pestañas pasan al superviviente) · pestañas → una barra dividida en secciones por grupo «tipo chrome» · persistencia → NO (sesión efímera) y el mismo md puede estar en ambos grupos, con edición sincronizada.
- **L3**: Coordinación inter-sesiones: la rama hermana `feat/web-demo-mode` (landing, `5abcb92`) añade guardas `isDemoMode()` en App.tsx; mi rama nace de `main` (`8af6088`) en un worktree aparte (`/Users/ipepio/Workspace/ipepio/md_viewer-groups`) y preserva costuras estables para su merge.
- **L4**: T1 completado (6b3737c): App.tsx 694→460 líneas, 11 módulos bajo `src/hooks/` (7 hooks de orquestación + 3 piezas puras + `useTheme` intacto), 59 tests nuevos. Costuras para `feat/web-demo-mode` preservadas y nombradas (bootstrap con orden interno idéntico, `handleOpenDialog`, `handleSave`, export/print). Gates del juez: **297/297 + build ✓**; sin cambio observable de comportamiento.
- **L5**: T2 completado (a9ce9bb): `src/hooks/editorGroups.ts` (reducer puro de 7 acciones + selectores, sin React) y 49 tests que verifican invariantes e inmutabilidad tras cada paso. El mismo doc puede vivir en ambos grupos (S7); `CLOSE_GROUP` fusiona sus pestañas al superviviente en orden y deduplicadas (S5); `SPLIT` nace vacío en modo editor (S3–S4). Gates del juez: **346/346 + build ✓**.
- **L6**: T3 completado (17cb3ed): `EditorGroups.tsx` (shell: 1 grupo = hoy; 2 = ResizablePanelGroup 50/50 sin persistir; × «Cerrar grupo» sólo con 2 en barra propia que no tapa el ModeSwitch; CTA vacía con copia ⌘O/explorador; foco por pointer-down con acento superior), `useEditorGroups.ts` (puente mínimo: OPEN_DOC del grupo enfocado sólo cuando cambia `activeId`, foco vía ref ⇒ el grupo vacío de ⌘D no se autorrellena) + 22 tests. Cambio de comportamiento decidido por el integrador: el modo es por GRUPO (group 1 nace en `settings.defaultView`); el `viewState.mode` por doc ya no gobierna la vista; tests adaptados. Gates del juez: **368/368 + build ✓**.
- **L7**: T4 completado (b89bf65): `TabsBar` por secciones (una por grupo, divisor `tabs-divider`, acento del grupo enfocado, chip «Vacío · ⌘O abre aquí», cierre con etiqueta «…en el grupo N» cuando el mismo doc vive en ambos). Flujo de clic crítico: `ACTIVATE_DOC` con el grupo de la PESTAÑA + `FOCUS_GROUP`, sin tocar el almacén (el puente queda como única vía de ⌘O/explorador/recientes/paleta). Nueva acción pura `PRUNE_DOCS` poda los ids cerrados en el almacén. +15 tests. Gates del juez: **383/383 + build ✓**.
- **L8**: T5 completado (5d4c3c3): ⌘W NUEVO (no existía manejador; cierra el doc del grupo enfocado con confirmación y la poda de T4 lo retira de todas las secciones; grupo vacío ⇒ no-op). Fallo real encontrado y corregido en el puente: abrir el .md YA activo (S7, mismo doc en los dos grupos) no disparaba nada porque el puente sólo reacciona a cambios de `activeId`; ahora `openDocInFocusedGroup` (select + `OPEN_DOC` idempotente) y `openFileInFocusedGroup` (ruta abierta ⇒ copia del almacén, sin releer disco) cubren explorador/recientes/paleta. ⌘B/⌘I por el mapa de handles del grupo enfocado; zoom y tema verificados globales. Fila «Dividir editor» en Atajos. +8 tests. Gates del juez: **391/391 + build ✓**.
- **L9**: T6 completado (5134a03) y con ello la feature ENTERA (T1–T6). Sincronización mismo-doc (S7) probada de dos formas: test App de extremo a extremo (paleta abre el MISMO .md en el grupo 2 vía `openDocInFocusedGroup`, se escribe en el grupo 1 y convergen almacén único + ambas vistas previas + el editor del grupo 2 vía `applyValue` del doble) y test de componente en `EditorGroups.test`. El doble de CodeMirror gana el contrato de `value` del envoltorio real (sin eco de `onChange`, selección acotada) y `viewFor` para direccionar el editor de cada grupo por nodo. README: bullet «Editor groups». Incidente de orquestación resuelto: el hijo de T6 reportó «sin resultado» pero terminó en su terminal; su versión del fixture (superior) pisó la del padre y ambas se conciliaron — el propio hijo detectó y fusionó la escritura concurrente (bullet duplicado de README) preservando el test del padre. Gates del juez: **393/393 (44 archivos) + build ✓**.
- **L10** (2026-11-22): «no veo que se divida. También hay que actualizar la documentación de los atajos y los menús de la barra de Archivo, Edit etc.. lo que sea necesario». (1) **Split no visible**: el handler ⌘D está verificado (mapa `d`→`split`, sin guardas, y el test App lo dispara end-to-end) — hipótesis principal: instancia/rama equivocada (worktree principal en `feat/web-demo-mode`, sin grupos, o ventana antigua); pendiente de confirmar con el humano. (2) **Docs de atajos**: la tabla mentía — «Buscar en documento ⌘F» no existe en el handler; se sustituye por la fila que faltaba, «Cerrar documento ⌘W» (el atajo que T5 añadió al handler pero no a la tabla). (3) **T7 menú nativo**: barra de menús real (Archivo/Editar/Ver) con aceleradores que enrutan a las mismas acciones — los menús por defecto de macOS muestran ítems ingleses muertos.
