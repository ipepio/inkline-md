/**
 * Frontera de error del shell (ODD QA · S2).
 *
 * React desmonta TODO el árbol cuando un hijo lanza durante el render o en un
 * efecto. Sin frontera, un fallo del editor (CodeMirror/Mermaid/Shiki) dejaría
 * la ventana en blanco y se llevaría por delante el rail y el explorador: eso
 * es justo lo que se percibe como «desaparece la parte de settings».
 *
 * Con esta frontera, el fallo queda contenido en el área que lo provoca y el
 * resto de la interfaz sigue viva, con un mensaje honesto y una salida
 * («Reintentar») que remonta el subárbol.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Zona afectada, para nombrarla en el mensaje: «el editor», «el explorador»… */
  area: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-3 bg-ink-preview px-6 py-10 text-center"
      >
        <p className="text-sm font-bold text-foreground">
          Algo falló al mostrar {this.props.area}.
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          El resto de Inkline sigue funcionando. Puedes reintentar o cerrar el
          documento y volver a abrirlo.
        </p>
        <pre className="max-w-md overflow-auto rounded-md border border-border bg-ink-code p-3 text-left font-mono text-[10px] text-muted-foreground">
          {error.message}
        </pre>
        <Button type="button" variant="outline" size="sm" onClick={this.retry}>
          Reintentar
        </Button>
      </div>
    );
  }
}
