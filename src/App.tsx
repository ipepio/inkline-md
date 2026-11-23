/**
 * Shell de Inkline — Markdown Studio (ODD editor groups · T1 · T3).
 *
 * Punto de composición: el rail de iconos (56px) + la sidebar del espacio de
 * trabajo (256px) + el área principal (topbar con breadcrumbs y estado de
 * guardado, pestañas de documentos y los grupos de edición). Toda la
 * orquestación vive en hooks de `src/hooks/`; aquí sólo se unen estados y
 * manejadores.
 *
 * Desde T3 el área de trabajo son uno o dos grupos (`EditorGroups`): cada uno
 * con su documento activo y su propia vista. Lo que lee el chrome (crumbs,
 * indicador de guardado, barra de estado, exportación y ⌘S) es el documento del
 * grupo con foco. Desde T4 la barra de pestañas es UNA y está dividida en una
 * sección por grupo (`TabsBar`).
 *
 * Las pestañas no pasan por el almacén: el clic entrega el grupo de la pestaña
 * al modelo (`ACTIVATE_DOC` + `FOCUS_GROUP`) porque el puente de
 * `useEditorGroups` abre en el grupo ENFOCADO, y eso es lo correcto sólo para
 * ⌘O/⌘N/explorador/recientes/paleta. El cierre, en cambio, sí es del almacén
 * (un documento es uno solo, S7) y el modelo se poda con los ids vivos.
 *
 * Enrutado al grupo con foco (T5 · S2 · S5): ⌘W cierra su documento, ⌘S lo
 * guarda, ⌘E lo exporta, ⌘B/⌘I escriben en su editor (mapa de handles de
 * `EditorGroups`) y explorador/recientes/paleta lo abren. Zoom y tema siguen
 * siendo globales: no cuelgan de ningún grupo.
 *
 * Las costuras del arranque (`useWorkspaceBootstrap`), `handleOpenDialog`,
 * `handleSave` y `handlePrintFromSettings` son estables: la rama hermana
 * `feat/web-demo-mode` engancha ahí sus guardas de modo demo.
 *
 * Barra de menú nativa (T7): Rust construye Archivo/Editar/Ver (más la app y
 * Ventana en macOS) y emite `inkline://menu` con el id del ítem;
 * `useNativeMenu` lo despacha con los MISMOS manejadores que
 * `useShellShortcuts`, así que menú y atajos no pueden divergir.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import {
  Columns2Icon,
  CopyIcon,
  FilePlus2Icon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  MoonIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import brandMarkLight from "@/assets/brand/inkline-white.png";
import brandMarkDark from "@/assets/brand/inkline-black.png";
import brandWordmark from "@/assets/brand/inklineMD-text-logo.png";
import brandWordmarkLight from "@/assets/brand/inklineMD-text-logo-white.png";
import { CommandPalette } from "@/components/files/CommandPalette";
import {
  FileContextMenu,
  type ContextMenuItem,
  type FileContextMenuState,
} from "@/components/files/FileContextMenu";
import { FileTree, type FileTreeContextTarget } from "@/components/files/FileTree";
import { RecentsList } from "@/components/files/RecentsList";
import { TabsBar } from "@/components/files/TabsBar";
import { MarkdownView } from "@/components/viewer/MarkdownView";
import type { EditorWorkspaceHandle } from "@/components/editor/EditorWorkspace";
import { EditorGroups, type EditorGroupRefs } from "@/components/editor/EditorGroups";
import { ExportMenu } from "@/components/export/ExportMenu";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { StatusBar } from "@/components/shell/StatusBar";
import { ConfirmCloseDialog } from "@/components/shell/ConfirmCloseDialog";
import { useAppHardening } from "@/hooks/useAppHardening";
import { useTheme } from "@/hooks/useTheme";
import { useWorkspaceBootstrap } from "@/hooks/useWorkspaceBootstrap";
import { useFileActions } from "@/hooks/useFileActions";
import { useExportActions } from "@/hooks/useExportActions";
import { useCloseConfirm } from "@/hooks/useCloseConfirm";
import { useZoomControls } from "@/hooks/useZoomControls";
import { useShellShortcuts, type ShellShortcutsOptions } from "@/hooks/useShellShortcuts";
import { useNativeMenu } from "@/hooks/useNativeMenu";
import { useExternalFileOpen } from "@/hooks/useExternalFileOpen";
import { useDocumentView } from "@/hooks/useDocumentView";
import { useEditorGroups } from "@/hooks/useEditorGroups";
import { usePaletteItems } from "@/hooks/usePaletteItems";
import { displayName, isUntitled } from "@/hooks/untitled";
import { DEMO_NOTICE, isDemoMode } from "@/lib/demo/mode";
import {
  getDocumentsSnapshot,
  useDocuments,
  selectDoc,
  setContents,
  setViewState,
} from "@/lib/documents";
import { revealInFileManager } from "@/lib/files";
import { useSettings, updateSettings, zoomedEditorFontSize } from "@/lib/settings";
import { comboLabel, fileManagerLabel } from "@/lib/platform";
import { workspaceName } from "@/lib/workspace";

const RAIL_BUTTON =
  "grid size-[39px] place-items-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export default function App() {
  useAppHardening();

  const { theme, toggleTheme } = useTheme();
  const settings = useSettings();
  const { docs, activeId } = useDocuments();

  // Grupos de edición (T3): un grupo como hoy, dos tras ⌘D. `focusedDoc` es el
  // documento del grupo con foco y lo único que leen topbar, guardado y estado.
  const groups = useEditorGroups({ defaultView: settings.defaultView, docs, activeId });
  const focusedDoc = groups.focusedDoc;

  // Poda de los grupos al almacén (S6): un documento cerrado desde cualquier
  // pestaña (⌘W, la cruz, el explorador) desaparece de TODAS las secciones. El
  // modelo de grupos sólo guarda ids, así que se reconcilia con los ids vivos;
  // si no hay nada que podar la acción devuelve el mismo estado y no re-renderiza.
  const dispatchGroups = groups.dispatch;
  useEffect(() => {
    dispatchGroups({ type: "PRUNE_DOCS", docIds: docs.map((doc) => doc.id) });
  }, [docs, dispatchGroups]);

  // Secciones de la barra de pestañas (T4): las pestañas de cada grupo, ya
  // resueltas contra el almacén único (el mismo documento puede estar en ambas).
  const tabSections = useMemo(
    () =>
      groups.groups.map((group) => ({
        groupId: group.id,
        activeDocId: group.activeDocId,
        docs: group.docIds.flatMap((docId) => {
          const doc = docs.find((candidate) => candidate.id === docId);
          return doc
            ? [{ id: doc.id, name: displayName(doc.path), dirty: doc.dirty }]
            : [];
        }),
      })),
    [groups.groups, docs],
  );

  // Handles de los editores por grupo: los atajos de formato apuntan al editor
  // del grupo con foco (T5 usará el mismo mapa para el resto del enrutado).
  const editorRefs = useRef<EditorGroupRefs>({ "1": null, "2": null });
  const focusedEditorRef = useMemo<RefObject<EditorWorkspaceHandle>>(
    () => ({
      get current() {
        return editorRefs.current[groups.focusedGroupId] ?? null;
      },
    }),
    [groups.focusedGroupId],
  );

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<FileContextMenuState | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Arranque: raíz recordada + recientes persistidos (costura del modo demo).
  const { root, tree, recents, status, setStatus, setRecents, handleChooseRoot } =
    useWorkspaceBootstrap();

  const { handleOpenFile, handleOpenDialog, handleNewDoc, handleSave } = useFileActions({
    active: focusedDoc,
    defaultView: settings.defaultView,
    setRecents,
    setStatus,
  });

  // Abrir en el grupo con foco (S2). El puente de `useEditorGroups` abre lo que
  // el almacén selecciona, pero sólo reacciona a un documento NUEVO: si la
  // persona elige justo el que ya estaba activo (el mismo `.md` en los dos
  // grupos, S7) el almacén no cambia y el grupo enfocado no recibía nada. Aquí
  // se selecciona y se despacha el `OPEN_DOC` explícito —idempotente— del grupo
  // con foco, así que los dos caminos coinciden en vez de depender del orden.
  const openDocInFocusedGroup = useCallback(
    (docId: string): void => {
      selectDoc(docId);
      dispatchGroups({ type: "OPEN_DOC", docId });
    },
    [dispatchGroups],
  );

  // Explorador, recientes, paleta y apertura desde el SO trabajan con rutas:
  // si el documento ya está abierto se activa el del almacén (sin releerlo del
  // disco, que descartaría lo que no se ha guardado); si no, se lee y el
  // almacén lo deja en el grupo con foco por la vía de siempre.
  const openFileInFocusedGroup = useCallback(
    async (path: string): Promise<void> => {
      const open = getDocumentsSnapshot().docs.find((doc) => doc.path === path);
      if (open) {
        openDocInFocusedGroup(open.id);
        return;
      }
      await handleOpenFile(path);
    },
    [handleOpenFile, openDocInFocusedGroup],
  );

  useExternalFileOpen(openFileInFocusedGroup);

  const { exportRef, handlePrintFromSettings } = useExportActions({
    active: focusedDoc,
    theme,
    pageSize: settings.pageSize,
    setStatus,
  });

  const { confirmClose, handleCloseDoc, handleConfirmClose, handleCancelClose } = useCloseConfirm({
    docs,
    confirmEnabled: settings.confirmClose,
  });

  // ⌘W (S5): cierra el documento del grupo con foco por el flujo de siempre
  // (`useCloseConfirm`: pregunta si está sucio y `closeDoc` del almacén); la poda
  // de arriba lo retira de todas las secciones. Sin documento es un no-op: no se
  // cae al documento del otro grupo ni se abre ninguna confirmación.
  const closeFocusedDoc = useCallback((): void => {
    if (focusedDoc) handleCloseDoc(focusedDoc.id);
  }, [focusedDoc, handleCloseDoc]);

  const { zoomIn, zoomOut, resetZoom } = useZoomControls();

  // Atajos de teclado y menú nativo comparten manejadores (T7): la misma tabla
  // (`shellShortcut` → `applyShellAction`) sirve a los dos caminos.
  const shellActions: ShellShortcutsOptions = {
    editorRef: focusedEditorRef,
    exportRef,
    handleSave,
    handleOpenDialog,
    handleNewDoc,
    handleSplit: groups.split,
    handleClose: closeFocusedDoc,
    zoomIn,
    zoomOut,
    resetZoom,
    setSettingsOpen,
    setSidebarOpen,
  };

  useShellShortcuts(shellActions);
  useNativeMenu(shellActions);

  const { crumbs, stats, cursor } = useDocumentView({ active: focusedDoc, root });

  const { paletteFiles, paletteDocs } = usePaletteItems(tree, docs);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

  const handleRevealPath = useCallback(
    async (path: string) => {
      if (isDemoMode()) {
        setStatus(DEMO_NOTICE);
        return;
      }
      try {
        await revealInFileManager(path);
      } catch (err) {
        setStatus(`No se pudo mostrar en ${fileManagerLabel()}: ${String(err)}`);
      }
    },
    [setStatus],
  );

  const handleCopyPath = useCallback(
    async (path: string) => {
      try {
        await navigator.clipboard.writeText(path);
        setStatus(`Ruta copiada: ${path}`);
      } catch {
        setStatus("No se pudo copiar la ruta al portapapeles.");
      }
    },
    [setStatus],
  );

  const openFileInSplit = useCallback(
    (path: string) => {
      const otherGroup = groups.groups.find((group) => group.id !== groups.focusedGroupId);
      if (otherGroup) {
        groups.focusGroup(otherGroup.id);
      } else {
        groups.split();
      }
      const open = docs.find((doc) => doc.path === path);
      if (open) {
        selectDoc(open.id);
        dispatchGroups({ type: "OPEN_DOC", docId: open.id, groupId: otherGroup?.id });
        return;
      }
      void handleOpenFile(path);
    },
    [docs, groups, dispatchGroups, handleOpenFile],
  );

  const openFileContextMenu = useCallback(
    (target: FileTreeContextTarget, event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const revealLabel = `Mostrar en ${fileManagerLabel()}`;
      const items: ContextMenuItem[] = [];

      if (!target.isDir) {
        items.push(
          {
            id: "open",
            label: "Abrir",
            icon: <FileTextIcon className="size-3.5" />,
            onSelect: () => openFileInFocusedGroup(target.path),
          },
          {
            id: "open-split",
            label: "Abrir en vista dividida",
            icon: <Columns2Icon className="size-3.5" />,
            onSelect: () => openFileInSplit(target.path),
          },
        );
      }

      items.push(
        {
          id: "reveal",
          label: revealLabel,
          icon: <FolderOpenIcon className="size-3.5" />,
          separatorBefore: !target.isDir,
          onSelect: () => void handleRevealPath(target.path),
        },
        {
          id: "copy-path",
          label: "Copiar ruta",
          icon: <CopyIcon className="size-3.5" />,
          onSelect: () => void handleCopyPath(target.path),
        },
      );

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        label: `Acciones para ${target.name}`,
        items,
        returnFocusTo: event.currentTarget,
      });
    },
    [handleCopyPath, handleRevealPath, openFileInFocusedGroup, openFileInSplit],
  );

  const openTabContextMenu = useCallback(
    (_groupId: string, docId: string, event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const doc = docs.find((candidate) => candidate.id === docId);
      if (!doc) return;
      const items: ContextMenuItem[] = [];
      const hasDiskPath = !isUntitled(doc.path);

      if (hasDiskPath) {
        items.push(
          {
            id: "reveal",
            label: `Mostrar en ${fileManagerLabel()}`,
            icon: <FolderOpenIcon className="size-3.5" />,
            onSelect: () => void handleRevealPath(doc.path),
          },
          {
            id: "copy-path",
            label: "Copiar ruta",
            icon: <CopyIcon className="size-3.5" />,
            onSelect: () => void handleCopyPath(doc.path),
          },
        );
      }

      items.push({
        id: "close",
        label: "Cerrar",
        icon: <XIcon className="size-3.5" />,
        separatorBefore: hasDiskPath,
        onSelect: () => handleCloseDoc(doc.id),
      });

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        label: `Acciones para ${displayName(doc.path)}`,
        items,
        returnFocusTo: event.currentTarget.querySelector("button"),
      });
    },
    [docs, handleCloseDoc, handleCopyPath, handleRevealPath],
  );

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
                activePath={focusedDoc && !isUntitled(focusedDoc.path) ? focusedDoc.path : undefined}
                onOpenFile={openFileInFocusedGroup}
                onContextMenuItem={openFileContextMenu}
              />
            ) : (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">
                Elige una carpeta raíz para explorar tus Markdown.
              </p>
            )}
            <RecentsList
              recents={recents}
              onOpenFile={openFileInFocusedGroup}
              onContextMenuFile={(file, event) =>
                openFileContextMenu({ ...file, isDir: false }, event)
              }
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
                focusedDoc?.dirty && "text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block size-[6px] rounded-full",
                  focusedDoc?.dirty ? "bg-[#e4b15d]" : "bg-[#94cd75]",
                )}
              />
              {focusedDoc?.dirty ? "Sin guardar" : "Guardado"}
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
              disabled={!focusedDoc}
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
              sections={tabSections}
              focusedGroupId={groups.focusedGroupId}
              onSelectTab={(groupId, docId) => {
                groups.dispatch({ type: "ACTIVATE_DOC", docId, groupId });
                groups.focusGroup(groupId);
              }}
              onFocusGroup={groups.focusGroup}
              onClose={handleCloseDoc}
              onContextMenuTab={openTabContextMenu}
            />
          </div>
          <div className="relative flex shrink-0 items-center gap-2 border-b border-border px-3">
            {groups.groups[groups.groups.length - 1]?.id === groups.focusedGroupId ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary"
              />
            ) : null}
            <button
              type="button"
              onClick={handleNewDoc}
              title={`Nuevo documento (${comboLabel("N")})`}
              className="flex h-[29px] shrink-0 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2.5 text-[11px] font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <FilePlus2Icon aria-hidden className="size-3.5 shrink-0 text-primary" />
              <span>Nuevo</span>
            </button>
            <ExportMenu
              ref={exportRef}
              markdown={focusedDoc ? focusedDoc.contents : null}
              docTitle={focusedDoc ? displayName(focusedDoc.path) : ""}
              theme={theme}
              pageSize={settings.pageSize}
              onStatus={setStatus}
            />
          </div>
        </div>

        {/* Grupos de edición: uno como hoy o dos tras ⌘D, cada uno con su
            documento activo y su propia vista. La frontera de error vive dentro
            de cada grupo, keyed por documento. */}
        <EditorGroups
          groups={groups.groups}
          focusedGroupId={groups.focusedGroupId}
          docs={docs}
          theme={theme}
          editorConfig={{
            fontSize: zoomedEditorFontSize(settings.editorFontSize, settings.zoom),
            tabWidth: settings.tabWidth,
            lineNumbers: settings.lineNumbers,
            wordWrap: settings.wordWrap,
            spellcheck: settings.spellcheck,
          }}
          zoom={settings.zoom}
          previewFor={(doc) => (
            <MarkdownView
              markdown={doc.contents}
              theme={theme}
              fontSize={settings.previewFontSize}
              className={settings.previewFont === "serif" ? "inkline-serif" : undefined}
            />
          )}
          onModeChange={groups.setMode}
          onFocus={groups.focusGroup}
          onCloseGroup={groups.closeGroup}
          onContents={setContents}
          onViewState={setViewState}
          editorRefs={editorRefs}
        />

        <StatusBar
          fileName={focusedDoc ? displayName(focusedDoc.path) : null}
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
        onSelectDoc={openDocInFocusedGroup}
        onOpenFile={openFileInFocusedGroup}
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

      <FileContextMenu menu={contextMenu} onClose={closeContextMenu} />

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
