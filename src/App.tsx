/**
 * Shell de Inkline — Markdown Studio (ODD integración T2 + T4).
 *
 * Composición del mockup: rail de iconos (56px) + sidebar del espacio de
 * trabajo (256px) + área principal (topbar con breadcrumbs y estado de guardado,
 * pestañas de documentos y el área de lectura). El modo edición y su vista
 * dividida llegan en T3; aquí la lectura ya es real.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderIcon,
  FolderOpenIcon,
  MoonIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { cn } from "cn";
import brandMarkLight from "@/assets/brand/inkline-white.png";
import brandMarkDark from "@/assets/brand/inkline-black.png";
import brandWordmark from "@/assets/brand/inklineMD-text-logo.png";
import brandWordmarkLight from "@/assets/brand/inklineMD-text-logo-white.png";
import { CommandPalette } from "@/components/files/CommandPalette";
import { FileTree } from "@/components/files/FileTree";
import { RecentsList } from "@/components/files/RecentsList";
import { TabsBar } from "@/components/files/TabsBar";
import { MarkdownView } from "@/components/viewer/MarkdownView";
import { EditorWorkspace, type EditorWorkspaceHandle } from "@/components/editor/EditorWorkspace";
import { ExportMenu, type ExportMenuHandle } from "@/components/export/ExportMenu";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { StatusBar } from "@/components/shell/StatusBar";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { ConfirmCloseDialog } from "@/components/shell/ConfirmCloseDialog";
import { isWorkspaceMode, type WorkspaceMode } from "@/lib/editor/mode";
import { useTheme } from "@/hooks/useTheme";
import {
  closeDoc,
  markSaved,
  openDoc,
  selectDoc,
  setContents,
  setViewState,
  useDocuments,
} from "@/lib/documents";
import {
  openTextFile,
  readTextFile,
  saveTextFile,
  saveTextFileAs,
} from "@/lib/files";
import { useSettings, updateSettings } from "@/lib/settings";
import { documentStats } from "@/lib/text";
import { exportStandaloneHtml } from "@/lib/export/html";
import { htmlExportFileName } from "@/lib/export/names";
import { openInBrowser, writeTemporaryExport } from "@/lib/export/operations";
import {
  fileNameOf,
  flattenFiles,
  listTree,
  loadWorkspaceConfig,
  pushRecent,
  setWorkspace,
  workspaceName,
  type RecentFile,
  type TreeNode,
} from "@/lib/workspace";

/** Prefijo interno de los documentos aún sin archivo en disco. */
const UNTITLED_PREFIX = "untitled://";
const UNTITLED_LABEL = "Sin título.md";

function isUntitled(path: string): boolean {
  return path.startsWith(UNTITLED_PREFIX);
}

function displayName(name: string): string {
  return isUntitled(name) ? UNTITLED_LABEL : fileNameOf(name);
}

let untitledCounter = 0;

/** Reparto recordado del divisor; se descarta cualquier valor no numérico. */
function readSplitLayout(
  viewState: Record<string, unknown> | undefined,
): { editor: number; preview: number } | undefined {
  const raw = viewState?.splitLayout as { editor?: unknown; preview?: unknown } | undefined;
  if (!raw || typeof raw.editor !== "number" || typeof raw.preview !== "number") {
    return undefined;
  }
  if (!Number.isFinite(raw.editor) || !Number.isFinite(raw.preview)) return undefined;
  return { editor: raw.editor, preview: raw.preview };
}

const RAIL_BUTTON =
  "grid size-[39px] place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const settings = useSettings();
  const { docs, activeId } = useDocuments();
  const active = useMemo(
    () => docs.find((doc) => doc.id === activeId) ?? null,
    [docs, activeId],
  );
  const editorRef = useRef<EditorWorkspaceHandle>(null);
  const exportRef = useRef<ExportMenuHandle>(null);

  const [root, setRoot] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState("Listo");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState<{ id: string; name: string } | null>(null);

  // Carga inicial: raíz recordada + recientes persistidos.
  useEffect(() => {
    void (async () => {
      try {
        const config = await loadWorkspaceConfig();
        setRecents(config.recents);
        if (config.root) {
          setRoot(config.root);
          setTree(await listTree(config.root));
        }
      } catch (err) {
        setStatus(`No se pudo cargar el espacio de trabajo: ${String(err)}`);
      }
    })();
  }, []);

  const registerOpen = useCallback(
    async (path: string, contents: string): Promise<void> => {
      openDoc(path, contents);
      try {
        setRecents(await pushRecent(path));
      } catch {
        // Los recientes son un extra: no interrumpen la apertura.
      }
    },
    [],
  );

  const handleOpenFile = useCallback(
    async (path: string): Promise<void> => {
      if (isUntitled(path)) return;
      try {
        const doc = await readTextFile(path);
        await registerOpen(doc.path, doc.contents);
        setStatus(`Abierto: ${doc.path}`);
      } catch (err) {
        setStatus(`Error al abrir: ${String(err)}`);
      }
    },
    [registerOpen],
  );

  const handleOpenDialog = useCallback(async (): Promise<void> => {
    const doc = await openTextFile();
    if (!doc) return;
    await registerOpen(doc.path, doc.contents);
    setStatus(`Abierto: ${doc.path}`);
  }, [registerOpen]);

  const handleNewDoc = useCallback((): void => {
    untitledCounter += 1;
    const id = openDoc(`${UNTITLED_PREFIX}${Date.now()}-${untitledCounter}`, "");
    setViewState(id, { mode: settings.defaultView });
  }, [settings.defaultView]);

  const handleChooseRoot = useCallback(async (): Promise<void> => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked !== "string") return;
    setRoot(picked);
    try {
      await setWorkspace(picked);
      setTree(await listTree(picked));
    } catch {
      setTree([]);
    }
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!active) return;
    try {
      if (isUntitled(active.path)) {
        const savedPath = await saveTextFileAs(active.contents);
        if (!savedPath) return;
        closeDoc(active.id);
        await registerOpen(savedPath, active.contents);
        setStatus(`Guardado: ${savedPath}`);
      } else {
        await saveTextFile(active.path, active.contents);
        markSaved(active.id);
        setStatus(`Guardado: ${active.path}`);
      }
    } catch (err) {
      setStatus(`Error al guardar: ${String(err)}`);
    }
  }, [active, registerOpen]);

  const handleCloseDoc = useCallback(
    (id: string): void => {
      const doc = docs.find((candidate) => candidate.id === id);
      if (!doc) return;
      if (doc.dirty && settings.confirmClose) {
        setConfirmClose({ id, name: displayName(doc.path) });
        return;
      }
      closeDoc(id);
    },
    [docs, settings.confirmClose],
  );

  const handlePrintFromSettings = useCallback(async (): Promise<void> => {
    if (!active) {
      setStatus("No hay ningún documento que exportar");
      return;
    }
    try {
      const title = displayName(active.path);
      const html = await exportStandaloneHtml(active.contents, {
        theme,
        title,
        pageSize: settings.pageSize,
      });
      const target = await writeTemporaryExport(html, htmlExportFileName(title));
      const opened = await openInBrowser(target);
      setStatus(
        opened === "opened"
          ? `Impresión: el documento se abrió en tu navegador (${target}).`
          : `Documento listo para imprimir: ${target}.`,
      );
    } catch (err) {
      setStatus(`Error al exportar: ${String(err)}`);
    }
  }, [active, theme, settings.pageSize]);

  // Atajos del shell; ⌘K lo registra la propia paleta.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void handleSave();
      } else if (key === "o") {
        event.preventDefault();
        void handleOpenDialog();
      } else if (key === "n") {
        event.preventDefault();
        handleNewDoc();
      } else if (key === "b") {
        event.preventDefault();
        editorRef.current?.applyFormat("bold");
      } else if (key === "i") {
        event.preventDefault();
        editorRef.current?.applyFormat("italic");
      } else if (key === "e") {
        event.preventDefault();
        void exportRef.current?.exportHtml();
      } else if (key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      } else if (key === "\\") {
        event.preventDefault();
        setSidebarOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, handleOpenDialog, handleNewDoc]);

  const crumbs = useMemo(() => {
    if (!active) return null;
    const fileName = displayName(active.path);
    if (!root || !active.path.startsWith(`${root}/`)) {
      return { rootName: null, folders: [] as string[], fileName };
    }
    const relative = active.path.slice(root.length + 1);
    const segments = relative.split("/").filter(Boolean);
    return {
      rootName: workspaceName(root),
      folders: segments.slice(0, -1),
      fileName,
    };
  }, [active, root]);

  const paletteFiles = useMemo(() => flattenFiles(tree).map((node) => node.path), [tree]);
  const paletteDocs = useMemo(
    () =>
      docs.map((doc) => ({
        id: doc.id,
        name: displayName(doc.path),
        path: isUntitled(doc.path) ? "" : doc.path,
      })),
    [docs],
  );

  // Vista por documento (persistida en viewState); la nueva vista llega en T3.
  const activeMode = active?.viewState.mode;
  const mode: WorkspaceMode = isWorkspaceMode(activeMode) ? activeMode : settings.defaultView;

  const handleModeChange = useCallback(
    (next: WorkspaceMode) => {
      if (!active) return;
      setViewState(active.id, { ...active.viewState, mode: next });
    },
    [active],
  );

  const stats = useMemo(() => documentStats(active?.contents ?? ""), [active?.contents]);
  const cursorState = active?.viewState as { line?: number; column?: number } | undefined;

  return (
    <div
      className={cn(
        // `overflow-hidden` evita que un hijo con ancho 0 pinte fuera de su celda.
        // La altura viene de html/body/#root al 100% (ver index.css): no se
        // depende de `dvh`, que un WKWebView antiguo ignora.
        "grid h-full min-h-0 overflow-hidden",
        sidebarOpen
          ? "grid-cols-[56px_256px_minmax(0,1fr)]"
          : "grid-cols-[56px_0_minmax(0,1fr)]",
      )}
    >
      <aside
        aria-label="Barra de Inkline"
        className="flex min-h-0 flex-col items-center gap-2 overflow-hidden border-r border-border bg-ink-rail px-2 py-4"
      >
        {/* Marca del rail: logo transparente, blanco en oscuro y negro en claro. */}
        <img
          src={brandMarkLight}
          alt="Inkline"
          width={34}
          height={34}
          className="mb-5 hidden size-[34px] object-contain dark:block"
        />
        <img
          src={brandMarkDark}
          alt="Inkline"
          width={34}
          height={34}
          className="mb-5 block size-[34px] object-contain dark:hidden"
        />
        <button
          type="button"
          className={cn(RAIL_BUTTON, sidebarOpen && "bg-muted text-foreground")}
          onClick={() => setSidebarOpen((open) => !open)}
          title="Mostrar / ocultar el explorador (⌘\)"
        >
          <PanelLeftIcon aria-hidden className="size-[17px]" />
        </button>
        <button
          type="button"
          className={RAIL_BUTTON}
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { metaKey: true, key: "k" }),
            );
          }}
          title="Buscar archivos y comandos (⌘K)"
        >
          <SearchIcon aria-hidden className="size-[17px]" />
        </button>
        <button
          type="button"
          className={RAIL_BUTTON}
          onClick={handleNewDoc}
          title="Nuevo documento (⌘N)"
        >
          <PlusIcon aria-hidden className="size-[18px]" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className={RAIL_BUTTON}
          onClick={toggleTheme}
          title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
        >
          {theme === "dark" ? (
            <SunIcon aria-hidden className="size-[17px]" />
          ) : (
            <MoonIcon aria-hidden className="size-[17px]" />
          )}
        </button>
        <button
          type="button"
          className={RAIL_BUTTON}
          onClick={() => setSettingsOpen(true)}
          title="Preferencias (⌘,)"
        >
          <SettingsIcon aria-hidden className="size-[17px]" />
        </button>
      </aside>

      {sidebarOpen ? (
        <aside
          aria-label="Explorador de archivos"
          className="flex min-h-0 min-w-0 flex-col border-r border-border bg-ink-side"
        >
          <div className="px-5 pt-6 pb-3">
            <img
              src={brandWordmarkLight}
              alt="inkline MD"
              className="hidden h-[26px] w-auto dark:block"
            />
            <img
              src={brandWordmark}
              alt="inkline MD"
              className="block h-[26px] w-auto dark:hidden"
            />
            <small className="mt-2 block text-[9px] font-bold tracking-[2.1px] text-ink-faint">
              MARKDOWN STUDIO
            </small>
          </div>
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-[10px] font-bold tracking-[1.4px] text-muted-foreground">
              EXPLORADOR
            </span>
            <button
              type="button"
              className="grid size-[29px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={handleNewDoc}
              title="Nuevo documento (⌘N)"
            >
              <PlusIcon aria-hidden className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleChooseRoot}
            title="Elegir carpeta raíz"
            className="mx-3 mb-3 flex items-center gap-2.5 rounded-[9px] border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <FolderIcon aria-hidden className="size-[17px] shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">
                {workspaceName(root)}
              </span>
              <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                {root ?? "Pulsa para elegir tu carpeta de trabajo"}
              </span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              ⌄
            </span>
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
            {root ? (
              <FileTree
                tree={tree}
                activePath={active && !isUntitled(active.path) ? active.path : undefined}
                onOpenFile={(path) => void handleOpenFile(path)}
              />
            ) : (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">
                Elige una carpeta raíz para explorar tus Markdown.
              </p>
            )}
            <RecentsList
              recents={recents}
              onOpenFile={(path) => void handleOpenFile(path)}
            />
          </div>
        </aside>
      ) : null}

      {/* `col-start-3` mantiene el panel principal en su columna aunque el
          explorador esté plegado (antes caía en la columna de 0px). */}
      {/* `min-h-0` es obligatorio: como grid item, `<main>` tiene altura mínima
          automática y crecía más que la ventana; con el recorte del grid eso
          dejaba el área de trabajo fuera de vista y sin scroll. */}
      <main className="col-start-3 flex min-h-0 min-w-0 flex-col overflow-hidden">
        <header className="flex h-[57px] min-h-[57px] shrink-0 items-center gap-3 border-b border-border bg-ink-side px-5">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-muted-foreground">
            {crumbs ? (
              <>
                {crumbs.rootName ? <span className="truncate">{crumbs.rootName}</span> : null}
                {crumbs.folders.map((folder) => (
                  <span key={folder} className="flex items-center gap-2">
                    <span aria-hidden className="opacity-40">
                      ›
                    </span>
                    <span className="truncate">{folder}</span>
                  </span>
                ))}
                <span aria-hidden className="opacity-40">
                  ›
                </span>
                <strong className="truncate text-foreground">{crumbs.fileName}</strong>
              </>
            ) : (
              <span className="truncate">Ningún documento</span>
            )}
          </p>
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-[7px] border border-border px-2.5 py-2 text-[10px] text-muted-foreground",
                active?.dirty && "text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block size-[6px] rounded-full",
                  active?.dirty ? "bg-[#e4b15d]" : "bg-[#94cd75]",
                )}
              />
              {active?.dirty ? "Sin guardar" : "Guardado"}
            </span>
            <button
              type="button"
              onClick={() => void handleOpenDialog()}
              className="flex h-[33px] items-center gap-2 rounded-[8px] border border-border bg-card px-3 text-[11px] font-bold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <FolderOpenIcon aria-hidden className="size-3.5" />
              Abrir
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!active}
              className="flex h-[33px] items-center gap-2 rounded-[8px] bg-primary px-3 text-[11px] font-bold text-primary-foreground transition-[filter] hover:brightness-110 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Guardar
              <span className="font-mono text-[10px] font-normal opacity-70">⌘S</span>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 items-stretch bg-ink-side">
          <div className="min-w-0 flex-1">
            <TabsBar
              docs={docs.map((doc) => ({
                id: doc.id,
                name: displayName(doc.path),
                dirty: doc.dirty,
              }))}
              activeId={activeId}
              onSelect={selectDoc}
              onClose={handleCloseDoc}
            />
          </div>
          <button
            type="button"
            onClick={handleNewDoc}
            title="Nuevo documento (⌘N)"
            className="grid size-10 place-items-center border-r border-b border-border/60 text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            +
          </button>
          <div className="flex items-center border-b border-border px-3">
            <ExportMenu
              ref={exportRef}
              markdown={active ? active.contents : null}
              docTitle={active ? displayName(active.path) : ""}
              theme={theme}
              pageSize={settings.pageSize}
              onStatus={setStatus}
            />
          </div>
        </div>

        {/* Frontera por documento: un fallo del editor no tumba el shell y se
            reinicia al cambiar de pestaña (key por documento). */}
        <ErrorBoundary area="el documento" key={active?.id ?? "sin-documento"}>
          {active ? (
          <EditorWorkspace
            ref={editorRef}
            doc={{ id: active.id, contents: active.contents, viewState: active.viewState }}
            theme={theme}
            mode={mode}
            onModeChange={handleModeChange}
            onContents={setContents}
            onViewState={setViewState}
            preview={
              <MarkdownView
                markdown={active.contents}
                theme={theme}
                className={settings.previewFont === "serif" ? "inkline-serif" : undefined}
              />
            }
            editorConfig={{
              fontSize: settings.editorFontSize,
              tabWidth: settings.tabWidth,
              lineNumbers: settings.lineNumbers,
              wordWrap: settings.wordWrap,
              spellcheck: settings.spellcheck,
            }}
            splitLayout={readSplitLayout(active.viewState)}
            onSplitLayoutChange={(layout) =>
              setViewState(active.id, { ...active.viewState, splitLayout: layout })
            }
          />
        ) : (
          <section className="flex min-h-0 flex-1 flex-col bg-ink-preview">
            <div className="grid h-full place-items-center text-center">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Ningún documento abierto
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Abre un archivo con ⌘O o crea uno nuevo con ⌘N.
                </p>
              </div>
            </div>
          </section>
          )}
        </ErrorBoundary>

        <StatusBar
          fileName={active ? displayName(active.path) : null}
          line={cursorState?.line}
          column={cursorState?.column}
          words={stats.words}
          lines={stats.lines}
          status={status}
        />
      </main>

      <CommandPalette
        docs={paletteDocs}
        files={paletteFiles}
        onSelectDoc={selectDoc}
        onOpenFile={(path) => void handleOpenFile(path)}
        onOpenDialog={() => void handleOpenDialog()}
        onNewDoc={handleNewDoc}
        onToggleTheme={toggleTheme}
      />

      <ConfirmCloseDialog
        open={confirmClose !== null}
        docName={confirmClose?.name ?? ""}
        onConfirm={() => {
          if (confirmClose) closeDoc(confirmClose.id);
          setConfirmClose(null);
        }}
        onCancel={() => setConfirmClose(null)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={updateSettings}
        currentRoot={root}
        onChooseRoot={() => void handleChooseRoot()}
        onExportHtml={() => void exportRef.current?.exportHtml()}
        onOpenPrint={() => void handlePrintFromSettings()}
      />
    </div>
  );
}
