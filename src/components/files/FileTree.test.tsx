import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FileTree } from "./FileTree";
import type { TreeNode } from "@/lib/workspace";

afterEach(cleanup);

const tree: TreeNode[] = [
  {
    name: "docs",
    path: "/ws/docs",
    isDir: true,
    children: [
      { name: "guia.md", path: "/ws/docs/guia.md", isDir: false, children: [] },
      { name: "notas.txt", path: "/ws/docs/notas.txt", isDir: false, children: [] },
    ],
  },
  { name: "README.md", path: "/ws/README.md", isDir: false, children: [] },
];

describe("FileTree", () => {
  it("muestra carpetas expandidas y abre el archivo pulsado", () => {
    const onOpenFile = vi.fn();
    render(<FileTree tree={tree} onOpenFile={onOpenFile} />);

    expect(screen.getByRole("button", { name: /docs/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /guia\.md/i }));
    expect(onOpenFile).toHaveBeenCalledWith("/ws/docs/guia.md");

    fireEvent.click(screen.getByRole("button", { name: /README\.md/i }));
    expect(onOpenFile).toHaveBeenLastCalledWith("/ws/README.md");
    expect(onOpenFile).toHaveBeenCalledTimes(2);
  });

  it("pliega una carpeta al pulsarla y despliega de nuevo", () => {
    render(<FileTree tree={tree} onOpenFile={vi.fn()} />);

    const folder = screen.getByRole("button", { name: /docs/i });
    fireEvent.click(folder);
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /guia\.md/i })).toBeNull();

    fireEvent.click(folder);
    expect(folder).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /guia\.md/i })).toBeInTheDocument();
  });

  it("marca con aria-current el archivo activo y respeta carpetas vacías", () => {
    const withEmptyFolder: TreeNode[] = [
      { name: "vacia", path: "/ws/vacia", isDir: true, children: [] },
      ...tree,
    ];
    render(
      <FileTree
        tree={withEmptyFolder}
        activePath="/ws/docs/guia.md"
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /guia\.md/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /README\.md/i })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("button", { name: /vacia/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("muestra un aviso en español cuando el árbol está vacío", () => {
    render(<FileTree tree={[]} onOpenFile={vi.fn()} />);
    expect(screen.getByText(/no hay archivos markdown/i)).toBeInTheDocument();
  });
});
