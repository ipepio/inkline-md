import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { OPEN_FILES_EVENT, takePendingOpenFiles } from "@/lib/files";
import { useExternalFileOpen } from "./useExternalFileOpen";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@/lib/files", () => ({
  OPEN_FILES_EVENT: "inkline://open-files",
  takePendingOpenFiles: vi.fn(),
}));

function Harness({ onOpen }: { onOpen: (path: string) => Promise<void> | void }) {
  useExternalFileOpen(onOpen);
  return null;
}

describe("useExternalFileOpen", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registra la escucha antes de drenar las rutas pendientes del arranque", async () => {
    const order: string[] = [];
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation(async (eventName) => {
      order.push(`listen:${eventName}`);
      return unlisten;
    });
    vi.mocked(takePendingOpenFiles).mockImplementation(async () => {
      order.push("takePendingOpenFiles");
      return ["/docs/primero.md", "/docs/segundo.md"];
    });

    const opened: string[] = [];
    const { unmount } = render(
      <Harness
        onOpen={async (path) => {
          opened.push(path);
        }}
      />,
    );

    await waitFor(() => {
      expect(opened).toEqual(["/docs/primero.md", "/docs/segundo.md"]);
    });
    expect(order).toEqual([`listen:${OPEN_FILES_EVENT}`, "takePendingOpenFiles"]);

    unmount();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("abre rutas entregadas en vivo por el evento inkline://open-files", async () => {
    let listener: ((event: { payload: string[] }) => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, cb) => {
      listener = cb as unknown as (event: { payload: string[] }) => void;
      return vi.fn();
    });
    vi.mocked(takePendingOpenFiles).mockResolvedValue([]);

    const opened: string[] = [];
    render(
      <Harness
        onOpen={(path) => {
          opened.push(path);
        }}
      />,
    );

    await waitFor(() => {
      expect(listener).toBeDefined();
    });

    listener?.({ payload: ["/docs/desde-finder.md"] });

    await waitFor(() => {
      expect(opened).toEqual(["/docs/desde-finder.md"]);
    });
  });
});
