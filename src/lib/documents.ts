/**
 * Documentos abiertos de Inkline (ODD T4 · S2).
 *
 * Almacén observable diminuto sobre `useSyncExternalStore`: sin dependencias
 * nuevas y sin editor de por medio. Cada documento guarda su `viewState`, un
 * objeto plano donde el editor futuro persistirá cursor y scroll.
 */

import { useSyncExternalStore } from "react";

/** Objeto plano reservado para el estado de vista (cursor, scroll…). */
export type ViewState = Record<string, unknown>;

export interface OpenDocument {
  id: string;
  path: string;
  name: string;
  contents: string;
  dirty: boolean;
  viewState: ViewState;
}

export interface DocumentsState {
  docs: OpenDocument[];
  activeId: string | null;
}

const EMPTY_STATE: DocumentsState = { docs: [], activeId: null };

let state: DocumentsState = EMPTY_STATE;
let nextId = 1;
const listeners = new Set<() => void>();

function setName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

function publish(next: DocumentsState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Devuelve la instantánea actual; identidad estable mientras no cambie. */
export function getDocumentsSnapshot(): DocumentsState {
  return state;
}

export function subscribeDocuments(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Estado de documentos para componentes React. */
export function useDocuments(): DocumentsState {
  return useSyncExternalStore(
    subscribeDocuments,
    getDocumentsSnapshot,
    getDocumentsSnapshot,
  );
}

/** Aplica `change` al documento indicado; publica sólo si existe y cambia. */
function updateDoc(
  id: string,
  change: (doc: OpenDocument) => OpenDocument,
): OpenDocument | null {
  const index = state.docs.findIndex((doc) => doc.id === id);
  if (index < 0) return null;
  const current = state.docs[index];
  const next = change(current);
  if (next === current) return current;
  const docs = state.docs.slice();
  docs[index] = next;
  publish({ ...state, docs });
  return next;
}

/**
 * Abre (o reactiva) un documento y devuelve su id.
 *
 * Si la ruta ya está abierta sólo se selecciona: los cambios sin guardar de la
 * pestaña existente nunca se pisan con el contenido recién leído del disco.
 */
export function openDoc(path: string, contents: string): string {
  const existing = state.docs.find((doc) => doc.path === path);
  if (existing) {
    if (state.activeId !== existing.id) {
      publish({ ...state, activeId: existing.id });
    }
    return existing.id;
  }
  const doc: OpenDocument = {
    id: `doc-${nextId}`,
    path,
    name: setName(path),
    contents,
    dirty: false,
    viewState: {},
  };
  nextId += 1;
  publish({ docs: [...state.docs, doc], activeId: doc.id });
  return doc.id;
}

/** Cierra una pestaña; si era la activa se activa una vecina. */
export function closeDoc(id: string): void {
  const index = state.docs.findIndex((doc) => doc.id === id);
  if (index < 0) return;
  const docs = state.docs.filter((doc) => doc.id !== id);
  if (state.activeId !== id) {
    publish({ ...state, docs });
    return;
  }
  const neighbour = docs[index] ?? docs[index - 1] ?? null;
  publish({ docs, activeId: neighbour ? neighbour.id : null });
}

/** Activa un documento abierto; ignora ids desconocidos. */
export function selectDoc(id: string): void {
  if (state.activeId === id) return;
  if (!state.docs.some((doc) => doc.id === id)) return;
  publish({ ...state, activeId: id });
}

/** Cambia el contenido y marca el documento como modificado. */
export function setContents(id: string, contents: string): void {
  updateDoc(id, (doc) =>
    doc.contents === contents && doc.dirty ? doc : { ...doc, contents, dirty: true },
  );
}

/** El documento se guardó: deja de estar sucio. */
export function markSaved(id: string): void {
  updateDoc(id, (doc) => (doc.dirty ? { ...doc, dirty: false } : doc));
}

/** Guarda estado de vista (cursor, scroll…) sin tocar el contenido. */
export function setViewState(id: string, viewState: ViewState): void {
  updateDoc(id, (doc) => ({ ...doc, viewState }));
}

/** Vacía el almacén; pensado para tests y para cerrar el espacio de trabajo. */
export function resetDocuments(): void {
  nextId = 1;
  publish(EMPTY_STATE);
}
