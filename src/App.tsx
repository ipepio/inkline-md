/**
 * Shell de Inkline — Markdown Studio (ODD editor groups · T1).
 *
 * Punto de composición: el rail de iconos (56px) + la sidebar del espacio de
 * trabajo (256px) + el área principal (topbar con breadcrumbs y estado de
 * guardado, pestañas de documentos y el área de trabajo). Toda la orquestación
 * vive en hooks de `src/hooks/`; aquí sólo se unen estados y manejadores.
 *
 * Las costuras del arranque (`useWorkspaceBootstrap`), `handleOpenDialog`,
 * `handleSave` y `handlePrintFromSettings` son estables: la rama hermana
 * `feat/web-demo-mode` engancha ahí sus guardas de modo demo.
 */

import { useCallback, useMemo, useRef, useState } from "react";
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
import { ExportMenu } from "@/components/export/ExportMenu";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { StatusBar } from "@/components/shell/StatusBar";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { ConfirmCloseDialog } from "@/components/shell/ConfirmCloseDialog";
import { useTheme } from "@/hooks/useTheme";
import { useWorkspaceBootstrap } from "@/hooks/useWorkspaceBootstrap";
import { useFileActions } from "@/hooks/useFileActions";
import { useExportActions } from "@/hooks/useExportActions";
import { useCloseConfirm } from "@/hooks/useCloseConfirm";
import { useZoomControls } from "@/hooks/useZoomControls";
import { useShellShortcuts } from "@/hooks/useShellShortcuts";
import { useDocumentView } from "@/hooks/useDocumentView";
import { usePaletteItems } from "@/hooks/usePaletteItems";
import { displayName, isUntitled } from "@/hooks/untitled";
import { useDocuments, selectDoc, setContents, setViewState } from "@/lib/documents";
import { useSettings, updateSettings, zoomedEditorFontSize } from "@/lib/settings";
import { comboLabel } from "@/lib/platform";
import { workspaceName } from "@/lib/workspace";

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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Arranque: raíz recordada + recientes persistidos (costura del modo demo).
  const { root, tree, recents, status, setStatus, setRecents, handleChooseRoot } =
    useWorkspaceBootstrap();

  const { handleOpenFile, handleOpenDialog, handleNewDoc, handleSave } = useFileActions({
    active,
    defaultView: settings.defaultView,
    setRecents,
    setStatus,
  });

  const { exportRef, handlePrintFromSettings } = useExportActions({
    active,
    theme,
    pageSize: settings.pageSize,
    setStatus,
  });

  const { confirmClose, handleCloseDoc, handleConfirmClose, handleCancelClose } = useCloseConfirm({
    docs,
    confirmEnabled: settings.confirmClose,
  });

  const { zoomIn, zoomOut, resetZoom } = useZoomControls();

  useShellShortcuts({
    editorRef,
    exportRef,
    handleSave,
    handleOpenDialog,
    handleNewDoc,
    zoomIn,
    zoomOut,
    resetZoom,
    setSettingsOpen,
    setSidebarOpen,
  });

  const { crumbs, mode, handleModeChange, stats, cursor, splitLayout, handleSplitLayoutChange } =
    useDocumentView({ active, root, defaultView: settings.defaultView });

  const { paletteFiles, paletteDocs } = usePaletteItems(tree, docs);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

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
          onClick={toggleSidebar}
          title={`Mostrar / ocultar el explorador (${comboLabel("\\")})`}
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
          title={`Buscar archivos y comandos (${comboLabel("K")})`}
        >
          <SearchIcon aria-hidden className="size-[17px]" />
        </button>
        <button
          type="button"
          className={RAIL_BUTTON}
          onClick={handleNewDoc}
          title={`Nuevo documento (${comboLabel("N")})`}
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
          title={`Preferencias (${comboLabel(",")})`}
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
              title={`Nuevo documento (${comboLabel("N")})`}
            >
              <PlusIcon aria-hidden className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleChooseRoot()}
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
              <span className="font-mono text-[10px] font-normal opacity-70">{comboLabel("S")}</span>
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
            title={`Nuevo documento (${comboLabel("N")})`}
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
                fontSize={settings.previewFontSize}
                className={settings.previewFont === "serif" ? "inkline-serif" : undefined}
              />
            }
            editorConfig={{
              fontSize: zoomedEditorFontSize(settings.editorFontSize, settings.zoom),
              tabWidth: settings.tabWidth,
              lineNumbers: settings.lineNumbers,
              wordWrap: settings.wordWrap,
              spellcheck: settings.spellcheck,
            }}
            zoom={settings.zoom}
            splitLayout={splitLayout}
            onSplitLayoutChange={handleSplitLayoutChange}
          />
        ) : (
          <section className="flex min-h-0 flex-1 flex-col bg-ink-preview">
            <div className="grid h-full place-items-center text-center">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Ningún documento abierto
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Abre un archivo con {comboLabel("O")} o crea uno nuevo con {comboLabel("N")}.
                </p>
              </div>
            </div>
          </section>
          )}
        </ErrorBoundary>

        <StatusBar
          fileName={active ? displayName(active.path) : null}
          line={cursor?.line}
          column={cursor?.column}
          words={stats.words}
          lines={stats.lines}
          zoom={settings.zoom}
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
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={resetZoom}
      />

      <ConfirmCloseDialog
        open={confirmClose !== null}
        docName={confirmClose?.name ?? ""}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
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
