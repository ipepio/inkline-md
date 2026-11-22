import { invoke } from "@tauri-apps/api/core";

export interface TextDoc {
  path: string;
  contents: string;
}

const MARKDOWN_FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown", "txt"] },
];

export async function readTextFile(path: string): Promise<TextDoc> {
  return invoke<TextDoc>("read_file", { path });
}

export async function saveTextFile(path: string, contents: string): Promise<void> {
  return invoke("write_file", { path, contents });
}

export async function openTextFile(): Promise<TextDoc | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: false, filters: MARKDOWN_FILTERS });
  if (typeof picked !== "string") return null;
  return readTextFile(picked);
}

export async function saveTextFileAs(contents: string): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const target = await save({ filters: MARKDOWN_FILTERS });
  if (typeof target !== "string") return null;
  await saveTextFile(target, contents);
  return target;
}

/** Muestra un archivo o carpeta en Finder (macOS) o en el explorador del sistema. */
export async function revealInFileManager(path: string): Promise<void> {
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}
