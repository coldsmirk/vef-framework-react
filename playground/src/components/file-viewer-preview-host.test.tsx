import type { FilePreviewHandler, FilePreviewTarget } from "@vef-framework-react/components";
import type { MouseEventHandler, ReactNode } from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FILE_VIEWER_OFFICE_EXTENSIONS } from "../../file-viewer-config";
import { FileViewerPreviewHost, MAX_PREVIEW_BYTES } from "./file-viewer-preview-host";

interface RequestFileOptions {
  signal: AbortSignal;
  onProgress: (event: { loaded: number; total?: number }) => void;
}

interface DownloadOptions {
  filename: string;
  signal: AbortSignal;
}

interface ViewerOptions {
  docx: {
    workerJsZipUrl: string;
    workerUrl: string;
  };
  pdf: {
    cjkFontFallbackPath: string;
    cMapUrl: string;
    standardFontDataUrl: string;
    wasmUrl: string;
    workerUrl: string;
  };
  presentation: {
    workerUrl: string;
  };
  spreadsheet: {
    worker: boolean | "auto";
    workerUrl: string;
  };
}

interface ViewerProps {
  options: ViewerOptions;
}

const runtime = vi.hoisted(() => {
  return {
    handler: null as FilePreviewHandler | null,
    http: {
      download: vi.fn(),
      requestFile: vi.fn()
    },
    httpClientKey: Symbol("HTTP_CLIENT"),
    showErrorMessage: vi.fn(),
    viewerProps: [] as ViewerProps[]
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
        if (runtime.handler === handler) {
          runtime.handler = null;
        }
      };
    }, [handler]);

    return createElement(Fragment, null, children);
  }

  return {
    ActionButton: MockButton,
    Button: MockButton,
    Center: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
    FilePreviewProvider: MockFilePreviewProvider,
    Icon: () => null,
    Modal: ({
      children,
      open,
      onCancel,
      title
    }: {
      children?: ReactNode;
      open?: boolean;
      onCancel?: () => void;
      title?: ReactNode;
    }) => open
      ? createElement(
          "section",
          { "aria-label": String(title) },
          children,
          createElement("button", { onClick: onCancel }, "关闭")
        )
      : null,
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
    Spin: () => createElement("span", null, "加载中")
  };
});

vi.mock("@file-viewer/react", () => {
  return {
    FileViewer: (props: ViewerProps) => {
      runtime.viewerProps.push(props);
      return "viewer-ready";
    }
  };
});

function target(overrides: Partial<FilePreviewTarget> = {}): FilePreviewTarget {
  return {
    filename: "report.pdf",
    url: "/api/files/report.pdf",
    ...overrides
  };
}

function renderHost(previewTarget: FilePreviewTarget) {
  const result = render(
    <FileViewerPreviewHost>
      <button type="button" onClick={() => runtime.handler?.openPreview(previewTarget)}>
        打开预览
      </button>
    </FileViewerPreviewHost>
  );

  return {
    ...result,
    user: userEvent.setup()
  };
}

function getRequestOptions(index = 0): RequestFileOptions {
  return runtime.http.requestFile.mock.calls[index]?.[1] as RequestFileOptions;
}

function getDownloadOptions(): DownloadOptions {
  return runtime.http.download.mock.calls[0]?.[1] as DownloadOptions;
}

function pendingFileResponse(): Promise<{ blob: Blob }> {
  return Promise.withResolvers<{ blob: Blob }>().promise;
}

describe("FileViewerPreviewHost", () => {
  beforeEach(() => {
    runtime.handler = null;
    runtime.http.download.mockReset();
    runtime.http.requestFile.mockReset();
    runtime.showErrorMessage.mockReset();
    runtime.viewerProps.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the viewer after the authenticated file request resolves", async () => {
    const response = Promise.withResolvers<{ blob: Blob }>();
    runtime.http.requestFile.mockReturnValue(response.promise);
    const { user } = renderHost(target());

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    expect(await screen.findByText("加载中")).toBeInTheDocument();
    expect(runtime.http.requestFile).toHaveBeenCalledOnce();

    response.resolve({ blob: new Blob(["pdf"]) });

    expect(await screen.findByText("viewer-ready")).toBeInTheDocument();
  });

  it("derives every previewable extension from the configured office preset", () => {
    renderHost(target());

    for (const extension of FILE_VIEWER_OFFICE_EXTENSIONS) {
      expect(runtime.handler?.canPreview?.(target({ filename: `report.${extension}` }))).toBe(true);
    }

    expect(runtime.handler?.canPreview?.(target({ filename: "report.zip" }))).toBe(false);
  });

  it("rejects a declared oversized file before requesting its bytes", async () => {
    runtime.http.download.mockResolvedValue(undefined);
    const abort = vi.spyOn(AbortController.prototype, "abort");
    const { user } = renderHost(target({ size: MAX_PREVIEW_BYTES + 1 }));

    await user.click(screen.getByRole("button", { name: "打开预览" }));

    expect(await screen.findByText(/超过 100 MB/)).toBeInTheDocument();
    expect(runtime.http.requestFile).not.toHaveBeenCalled();
    expect(abort).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "下载文件" }));
    await waitFor(() => {
      expect(runtime.http.download).toHaveBeenCalledWith("/api/files/report.pdf", expect.objectContaining({
        filename: "report.pdf"
      }));
    });
    expect(getDownloadOptions().signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts a pending remote download when the modal closes", async () => {
    const pendingDownload = Promise.withResolvers<void>();
    runtime.http.download.mockReturnValue(pendingDownload.promise);
    const { user } = renderHost(target({ size: MAX_PREVIEW_BYTES + 1 }));

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    await user.click(await screen.findByRole("button", { name: "下载文件" }));
    await waitFor(() => expect(runtime.http.download).toHaveBeenCalledOnce());
    const { signal } = getDownloadOptions();

    await user.click(screen.getByRole("button", { name: "关闭" }));
    await act(async () => {
      pendingDownload.reject(new Error("late download failure"));
      await pendingDownload.promise.catch(() => undefined);
    });

    expect(screen.queryByText("预览失败")).not.toBeInTheDocument();
    expect(signal.aborted).toBe(true);
    expect(runtime.showErrorMessage).not.toHaveBeenCalled();
  });

  it("aborts a pending remote download when the host unmounts", async () => {
    const pendingDownload = Promise.withResolvers<void>();
    runtime.http.download.mockReturnValue(pendingDownload.promise);
    const { unmount, user } = renderHost(target({ size: MAX_PREVIEW_BYTES + 1 }));

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    await user.click(await screen.findByRole("button", { name: "下载文件" }));
    await waitFor(() => expect(runtime.http.download).toHaveBeenCalledOnce());
    const { signal } = getDownloadOptions();

    unmount();
    await act(async () => {
      pendingDownload.reject(new Error("late download failure"));
      await pendingDownload.promise.catch(() => undefined);
    });

    expect(signal.aborted).toBe(true);
    expect(runtime.showErrorMessage).not.toHaveBeenCalled();
  });

  it("reports a download failure without replacing the preview error", async () => {
    runtime.http.requestFile.mockRejectedValue(new Error("preview failed"));
    runtime.http.download.mockRejectedValue(new Error("download failed"));
    const { user } = renderHost(target());

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    expect(await screen.findByRole("button", { name: "重新预览" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "report.pdf" })).toHaveTextContent("preview failed");

    await user.click(screen.getByRole("button", { name: "下载文件" }));

    await waitFor(() => {
      expect(runtime.showErrorMessage).toHaveBeenCalledExactlyOnceWith("下载失败：download failed");
    });
    expect(screen.getByRole("region", { name: "report.pdf" })).toHaveTextContent("preview failed");
    expect(screen.getByRole("button", { name: "重新预览" })).toBeInTheDocument();
    expect(screen.queryByText("下载失败：download failed")).not.toBeInTheDocument();
  });

  it("retries an ordinary file request failure", async () => {
    runtime.http.requestFile
      .mockRejectedValueOnce(new Error("preview failed"))
      .mockResolvedValueOnce({ blob: new Blob(["pdf"]) });
    const { user } = renderHost(target());

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    const retry = await screen.findByRole("button", { name: "重新预览" });

    await user.click(retry);

    expect(await screen.findByText("viewer-ready")).toBeInTheDocument();
    expect(runtime.http.requestFile).toHaveBeenCalledTimes(2);
  });

  it("aborts when downloaded bytes cross the preview limit", async () => {
    runtime.http.requestFile.mockReturnValue(pendingFileResponse());
    const { user } = renderHost(target());

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    await waitFor(() => expect(runtime.http.requestFile).toHaveBeenCalledOnce());

    const options = getRequestOptions();
    act(() => options.onProgress({ loaded: MAX_PREVIEW_BYTES + 1 }));

    expect(await screen.findByText(/超过 100 MB/)).toBeInTheDocument();
    expect(options.signal.aborted).toBe(true);
  });

  it("aborts when the response total exceeds the preview limit", async () => {
    runtime.http.requestFile.mockReturnValue(pendingFileResponse());
    const { user } = renderHost(target());

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    await waitFor(() => expect(runtime.http.requestFile).toHaveBeenCalledOnce());

    const options = getRequestOptions();
    act(() => options.onProgress({ loaded: 1, total: MAX_PREVIEW_BYTES + 1 }));

    expect(await screen.findByText(/超过 100 MB/)).toBeInTheDocument();
    expect(options.signal.aborted).toBe(true);
  });

  it("rejects an oversized response when progress metadata is unavailable", async () => {
    const blob = new Blob(["file"]);
    Object.defineProperty(blob, "size", { value: MAX_PREVIEW_BYTES + 1 });
    runtime.http.requestFile.mockResolvedValue({ blob });
    const { user } = renderHost(target());

    await user.click(screen.getByRole("button", { name: "打开预览" }));

    expect(await screen.findByText(/超过 100 MB/)).toBeInTheDocument();
    expect(getRequestOptions().signal.aborted).toBe(true);
    expect(runtime.viewerProps).toHaveLength(0);
  });

  it("aborts the active request when the host unmounts", async () => {
    runtime.http.requestFile.mockReturnValue(pendingFileResponse());
    const { unmount, user } = renderHost(target());

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    await waitFor(() => expect(runtime.http.requestFile).toHaveBeenCalledOnce());
    const { signal } = getRequestOptions();

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("aborts the active request when another target opens", async () => {
    runtime.http.requestFile.mockReturnValue(pendingFileResponse());
    const { user } = renderHost(target());

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    await waitFor(() => expect(runtime.http.requestFile).toHaveBeenCalledOnce());
    const firstSignal = getRequestOptions().signal;

    act(() => runtime.handler?.openPreview(target({
      filename: "second.docx",
      url: "/api/files/second.docx"
    })));
    await waitFor(() => expect(runtime.http.requestFile).toHaveBeenCalledTimes(2));

    expect(firstSignal.aborted).toBe(true);
    expect(getRequestOptions(1).signal.aborted).toBe(false);
  });

  it("keeps viewer asset options stable and anchored to the deployment base", async () => {
    const { user } = renderHost(target({ file: new File(["one"], "one.pdf") }));

    await user.click(screen.getByRole("button", { name: "打开预览" }));
    await screen.findByText("viewer-ready");
    const firstOptions = runtime.viewerProps.at(-1)?.options;

    act(() => runtime.handler?.openPreview(target({
      file: new File(["two"], "two.pdf"),
      filename: "two.pdf"
    })));
    await waitFor(() => expect(runtime.viewerProps.length).toBeGreaterThan(1));
    const secondOptions = runtime.viewerProps.at(-1)?.options;

    expect(secondOptions).toBe(firstOptions);
    expect(firstOptions?.pdf).toEqual({
      workerUrl: "/static/vendor/pdf/pdf.worker.mjs",
      cMapUrl: "/static/vendor/pdf/cmaps/",
      wasmUrl: "/static/vendor/pdf/wasm/",
      standardFontDataUrl: "/static/vendor/pdf/standard_fonts/",
      cjkFontFallbackPath: "/static/vendor/pdf/fonts/"
    });
    expect(firstOptions?.docx).toEqual({
      workerUrl: "/static/vendor/docx/docx.worker.js",
      workerJsZipUrl: "/static/vendor/docx/jszip.min.js"
    });
    expect(firstOptions?.presentation.workerUrl).toBe("/static/vendor/pptx/pptx.worker.js");
    expect(firstOptions?.spreadsheet.worker).toBe(true);
    expect(firstOptions?.spreadsheet.workerUrl).toContain("sheet.worker");
  });
});
