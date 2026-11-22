/**
 * Cierre de pestañas con confirmación (ODD editor groups · T1).
 *
 * Cerrar un documento sucio pregunta antes de perder cambios (preferencia
 * `confirmClose`). El diálogo es una petición en memoria: la confirmación
 * cierra el documento pendiente y la cancelación la descarta.
 */

import { useCallback, useState } from "react";
import { closeDoc, type OpenDocument } from "@/lib/documents";
import { displayName } from "./untitled";

/** Documento pendiente de confirmación para cerrarse. */
export interface CloseConfirmRequest {
  id: string;
  name: string;
}

export interface CloseConfirmOptions {
  docs: OpenDocument[];
  /** Preferencia «advertir al cerrar un documento con cambios». */
  confirmEnabled: boolean;
}

export interface CloseConfirmResult {
  confirmClose: CloseConfirmRequest | null;
  handleCloseDoc: (id: string) => void;
  handleConfirmClose: () => void;
  handleCancelClose: () => void;
}

export function useCloseConfirm({
  docs,
  confirmEnabled,
}: CloseConfirmOptions): CloseConfirmResult {
  const [confirmClose, setConfirmClose] = useState<CloseConfirmRequest | null>(null);

  const handleCloseDoc = useCallback(
    (id: string): void => {
      const doc = docs.find((candidate) => candidate.id === id);
      if (!doc) return;
      if (doc.dirty && confirmEnabled) {
        setConfirmClose({ id, name: displayName(doc.path) });
        return;
      }
      closeDoc(id);
    },
    [docs, confirmEnabled],
  );

  const handleConfirmClose = useCallback((): void => {
    if (confirmClose) closeDoc(confirmClose.id);
    setConfirmClose(null);
  }, [confirmClose]);

  const handleCancelClose = useCallback((): void => {
    setConfirmClose(null);
  }, []);

  return { confirmClose, handleCloseDoc, handleConfirmClose, handleCancelClose };
}
