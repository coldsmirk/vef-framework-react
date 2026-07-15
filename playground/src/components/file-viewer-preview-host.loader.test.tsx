import type { FilePreviewHandler, FilePreviewTarget } from "@vef-framework-react/components";
import type { MouseEventHandler, ReactNode } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FileViewerPreviewHost } from "./file-viewer-preview-host";

const runtime = vi.hoisted(() => {
  return {
    handler: null as FilePreviewHandler | null,
    http: {
      download: vi.fn(),
      requestFile: vi.fn()
    },
    httpClientKey: Symbol("HTTP_CLIENT"),
    reloadPage: vi.fn(),
    showErrorMessage: vi.fn(),
    viewerImportGate: Promise.withResolvers<void>(),
    viewerImportStarted: vi.fn()
  };
});

vi.mock("@vef-framework-react/core", () => Object.fromEntries([
  ["HTTP_CLIENT", runtime.httpClientKey],
  [
    "useApiClient",
    () => {
      return {
        [runtime.httpClientKey]: runtime.http
      };
    }
  ]
]));

vi.mock("@vef-framework-react/components", async () => {
  const {
    createElement,
    Fragment,
    useEffect
  } = await import("react");

  function MockButton({
    children,
    onClick
  }: {
    children?: ReactNode;
    onClick?: MouseEventHandler<HTMLButtonElement>;
  }) {
    return createElement("button", { onClick }, children);
  }

  function MockFilePreviewProvider({
    children,
    handler
  }: {
    children?: ReactNode;
    handler: FilePreviewHandler;
  }) {
    useEffect(() => {
      runtime.handler = handler;

      return () => {
        runtime.handler = null;
      };
    }, [handler]);

    return createElement(Fragment, null, children);
  }

  return {
    ActionButton: MockButton,
    Button: MockButton,
    Center: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
    FilePreviewProvider: MockFilePreviewProvider,
    globalCssVars: new Proxy({}, { get: (_target, key) => `var(--vef-${String(key)})` }),
    Icon: () => null,
    Modal: ({
      children,
      open
    }: {
      children?: ReactNode;
      open?: boolean;
    }) => open ? createElement("section", null, children) : null,
    Result: ({
      extra,
      subTitle,
      title
    }: {
      extra?: ReactNode;
      subTitle?: ReactNode;
      title?: ReactNode;
    }) => createElement("div", null, title, subTitle, extra),
    showErrorMessage: runtime.showErrorMessage,
    Spin: () => createElement("span", null, "加载中"),
    useIsDarkMode: () => false
  };
});

vi.mock("@file-viewer/preset-office", () => {
  return {
    default: { renderers: [] }
  };
});

vi.mock("@file-viewer/react", async () => {
  runtime.viewerImportStarted();
  await runtime.viewerImportGate.promise;
  throw new Error("viewer module failed");
});

function target(): FilePreviewTarget {
  return {
    filename: "report.pdf",
    url: "/api/files/report.pdf"
  };
}

describe("FileViewerPreviewHost viewer loader", () => {
  it("loads in parallel and offers a page reload after the module import fails", async () => {
    runtime.http.requestFile.mockResolvedValue({ blob: new Blob(["pdf"]) });
    const user = userEvent.setup();
    render(
      <FileViewerPreviewHost onReload={runtime.reloadPage}>
        <button type="button" onClick={() => runtime.handler?.openPreview(target())}>
          打开预览
        </button>
      </FileViewerPreviewHost>
    );

    await user.click(screen.getByRole("button", { name: "打开预览" }));

    await waitFor(() => {
      expect(runtime.viewerImportStarted).toHaveBeenCalledOnce();
      expect(runtime.http.requestFile).toHaveBeenCalledOnce();
    });
    expect(screen.getByText("加载中")).toBeInTheDocument();
    runtime.viewerImportGate.resolve();

    const reload = await screen.findByRole("button", { name: "刷新页面" });
    expect(screen.queryByRole("button", { name: "重新预览" })).not.toBeInTheDocument();

    await user.click(reload);

    expect(runtime.reloadPage).toHaveBeenCalledOnce();
    expect(runtime.http.requestFile).toHaveBeenCalledOnce();
    expect(runtime.viewerImportStarted).toHaveBeenCalledOnce();
  });
});
