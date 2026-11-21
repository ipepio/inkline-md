/**
 * Confirmación al cerrar un documento con cambios (ODD T6 · S4).
 *
 * El diálogo sólo pregunta y devuelve la decisión: quien lo monta decide si
 * cierra la pestaña (`onConfirm`) o la deja abierta (`onCancel`). El foco
 * inicial queda en la acción segura —cancelar— para que una pulsación
 * accidental no descarte cambios.
 *
 * El primitivo de diálogo del proyecto (`components/ui/dialog`, Base UI) ya
 * aporta el rol de diálogo, el foco atrapado, la capa superior y el cierre con
 * Esc: aquí sólo se nombra el diálogo y se escriben las dos salidas.
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmCloseDialogProps {
  open: boolean;
  /** Nombre del documento que se quiere cerrar. */
  docName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmCloseDialog({ open, docName, onConfirm, onCancel }: ConfirmCloseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{`¿Cerrar «${docName}» sin guardar?`}</DialogTitle>
          <DialogDescription>
            El documento tiene cambios sin guardar. Si lo cierras ahora, esos cambios se pierden.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton={false}>
          <Button variant="outline" autoFocus onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Cerrar sin guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
