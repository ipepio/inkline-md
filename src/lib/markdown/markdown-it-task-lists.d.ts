/**
 * Declaración local de `markdown-it-task-lists` (el paquete no publica tipos).
 * Se declara sólo la superficie que usa Inkline.
 */
declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";

  export interface TaskListOptions {
    /** Activa el plugin (por defecto true). */
    enabled?: boolean;
    /** Envuelve el checkbox en un `<label>`; Inkline usa sólo el checkbox. */
    label?: boolean;
    /** Coloca la etiqueta después del texto. */
    labelAfter?: boolean;
  }

  export default function taskLists(md: MarkdownIt, options?: TaskListOptions): void;
}
