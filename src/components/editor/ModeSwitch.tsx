/**
 * Control segmentado de vistas de Inkline (ODD T3 / S2 · S6).
 *
 * Reproduce el `.switch` del mockup: tres botones dentro de un grupo con borde
 * —Editor / Split / Preview— y exactamente uno marcado con `aria-pressed`.
 * El estado visual se deriva del atributo ARIA, no de una clase paralela.
 */

import { Columns2Icon, EyeIcon, PencilIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import type { WorkspaceMode } from "@/lib/editor/mode";

export interface ModeSwitchProps {
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
}

interface ModeOption {
  mode: WorkspaceMode;
  label: string;
  title: string;
  Icon: LucideIcon;
}

const OPTIONS: readonly ModeOption[] = [
  { mode: "editor", label: "Editor", title: "Solo editor", Icon: PencilIcon },
  { mode: "split", label: "Split", title: "Vista dividida", Icon: Columns2Icon },
  { mode: "preview", label: "Preview", title: "Solo vista previa", Icon: EyeIcon },
];

export function ModeSwitch({ mode, onModeChange }: ModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Vista del editor"
      className="flex gap-0.5 rounded-[9px] border border-border bg-card p-[3px]"
    >
      {OPTIONS.map(({ mode: value, label, title, Icon }) => (
        <button
          key={value}
          type="button"
          title={title}
          aria-pressed={mode === value}
          onClick={() => onModeChange(value)}
          className={cn(
            "flex items-center gap-[7px] rounded-[5px] px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            "aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:[&_svg]:text-primary",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
