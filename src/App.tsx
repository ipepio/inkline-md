import { useState } from "react";
import { openTextFile, saveTextFile, saveTextFileAs } from "@/lib/files";

export default function App() {
  const [path, setPath] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Ningún documento abierto");

  async function handleOpen() {
    try {
      const doc = await openTextFile();
      if (!doc) return;
      setPath(doc.path);
      setText(doc.contents);
      setStatus(`Abierto: ${doc.path}`);
    } catch (err) {
      setStatus(`Error al abrir: ${String(err)}`);
    }
  }

  async function handleSave() {
    try {
      if (path) {
        await saveTextFile(path, text);
        setStatus(`Guardado: ${path}`);
      } else {
        const saved = await saveTextFileAs(text);
        if (saved) {
          setPath(saved);
          setStatus(`Guardado: ${saved}`);
        }
      }
    } catch (err) {
      setStatus(`Error al guardar: ${String(err)}`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8 font-sans">
      <h1 className="text-2xl font-bold tracking-tight">Inkline — Markdown Studio</h1>
      <p className="text-sm text-muted-foreground" role="status">
        {status}
      </p>
      <textarea
        className="h-96 w-full resize-none rounded-md border border-border bg-card p-4 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label="Editor de Markdown"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-accent"
        >
          Abrir
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          Guardar
        </button>
      </div>
    </main>
  );
}
