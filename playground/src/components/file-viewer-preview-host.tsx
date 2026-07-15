import type { FilePreviewHandler, FilePreviewTarget } from "@vef-framework-react/components";
import type { CSSProperties, PropsWithChildren, ReactElement } from "react";

import spreadsheetWorkerUrl from "@file-viewer/renderer-spreadsheet/worker/sheetjs/sheet.worker?worker&url";
import {
  ActionButton,
  Button,
  Center,
  FilePreviewProvider,
  globalCssVars,
  Icon,
  Modal,
  Result,
  showErrorMessage,
  Spin,
  useIsDarkMode
} from "@vef-framework-react/components";
import { HTTP_CLIENT, useApiClient } from "@vef-framework-react/core";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

// The viewer follows the app's light/dark mode rather than the OS preference, so a
// preview never renders light inside a dark shell (or vice versa). `system` is
// intentionally omitted — the host always resolves a concrete theme.
type PreviewViewerTheme = "dark" | "light";

interface OfficeFileViewerProps {
  file: Blob;
  filename: string;
  theme: PreviewViewerTheme;
}

interface FileViewerPreviewHostProps {
  onReload?: () => void;
}

const deploymentBaseUrl = `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/`;
const assetUrl = (path: string): string => `${deploymentBaseUrl}${path}`;
const viewerAssetOptions = {
  pdf: {
    workerUrl: assetUrl("vendor/pdf/pdf.worker.mjs"),
    cMapUrl: assetUrl("vendor/pdf/cmaps/"),
    wasmUrl: assetUrl("vendor/pdf/wasm/"),
    standardFontDataUrl: assetUrl("vendor/pdf/standard_fonts/"),
    cjkFontFallbackPath: assetUrl("vendor/pdf/fonts/")
  },
  docx: {
    workerUrl: assetUrl("vendor/docx/docx.worker.js"),
    workerJsZipUrl: assetUrl("vendor/docx/jszip.min.js")
  },
  presentation: {
    workerUrl: assetUrl("vendor/pptx/pptx.worker.js")
  },
  spreadsheet: {
    worker: true,
    workerUrl: spreadsheetWorkerUrl
  }
};

let fileViewerModulePromise: ReturnType<typeof loadFileViewerModule> | undefined;

// Lazy-load so the viewer bundle stays out of the first paint. `openPreview`
// starts this module request alongside the file request to avoid a waterfall.
function loadFileViewerModule() {
  return Promise.all([
    import("@file-viewer/react"),
    import("@file-viewer/preset-office")
  ]).then(([{ FileViewer: FileViewerInternal }, { default: officePreset }]) => {
    const baseOptions = {
      ...viewerAssetOptions,
      preset: officePreset
    };
    // One frozen options object per resolved theme. The viewer keeps a stable
    // reference across unrelated re-renders (so it never re-initializes its workers),
    // yet swaps cleanly when the app toggles light/dark.
    const optionsByTheme = new Map<PreviewViewerTheme, typeof baseOptions & { theme: PreviewViewerTheme }>();

    function getViewerOptions(theme: PreviewViewerTheme) {
      let options = optionsByTheme.get(theme);

      if (!options) {
        options = { ...baseOptions, theme };
        optionsByTheme.set(theme, options);
      }

      return options;
    }

    function OfficeFileViewer({
      file,
      filename,
      theme
    }: OfficeFileViewerProps): ReactElement {
      return <FileViewerInternal file={file} filename={filename} options={getViewerOptions(theme)} />;
    }

    return { default: OfficeFileViewer };
  });
}

function getFileViewerModule() {
  fileViewerModulePromise ??= loadFileViewerModule();
  return fileViewerModulePromise;
}

const FileViewer = lazy(getFileViewerModule);
const PREVIEWABLE_EXTENSIONS = new Set(FILE_VIEWER_OFFICE_EXTENSIONS);

/**
 * The viewer reads the whole file into memory — cap what we hand it.
 */
export const MAX_PREVIEW_BYTES = 100 * 1024 * 1024;
const PREVIEW_TOO_LARGE_MESSAGE = "文件超过 100 MB 在线预览上限，请下载后查看。";

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex === -1 ? "" : filename.slice(dotIndex + 1).toLowerCase();
}

type HostState
  = | { status: "closed" }
    | { status: "loading"; target: FilePreviewTarget }
    | { status: "ready"; target: FilePreviewTarget; file: Blob }
    | {
      status: "error";
      target: FilePreviewTarget;
      message: string;
      recovery: "none" | "reload" | "retry";
    };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class FileViewerModuleLoadError extends Error {
  constructor(cause: unknown) {
    super(getErrorMessage(cause), { cause });
    this.name = "FileViewerModuleLoadError";
  }
}

function reloadPage(): void {
  location.reload();
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

// The preview modal is sized to read a document comfortably: ~80vw wide (capped
// so it never sprawls on ultra-wide displays) over a fixed-height viewport, so the
// frame holds still across the loading, error, and ready states. Content and body
// padding are stripped so the viewer sits flush; content clips to the modal radius
// so the viewer's canvas keeps its rounded corners instead of poking square edges
// past the shell. The header keeps a hairline divider so it reads as one piece with
// the viewer's own toolbar below it.
const PREVIEW_MODAL_WIDTH = "min(80vw, 1680px)";
const PREVIEW_VIEWPORT_HEIGHT = "min(78vh, 880px)";

const previewModalStyles = {
  body: { padding: 0 },
  content: { overflow: "hidden", padding: 0 },
  header: {
    borderBottom: `1px solid ${globalCssVars.colorSplit}`,
    margin: 0,
    padding: "14px 20px"
  }
} satisfies Record<"body" | "content" | "header", CSSProperties>;

const previewViewportStyle: CSSProperties = { height: PREVIEW_VIEWPORT_HEIGHT };
const previewFillStyle: CSSProperties = { height: "100%" };

/**
 * Application-side file-preview host backed by `@file-viewer/react`.
 * Mounted once around the authenticated layout; every `<Upload>` /
 * `<FileUpload>` / `UploadField` in the app dispatches non-image files
 * here as normalized `FilePreviewTarget`s.
 *
 * Bytes are always handed to the viewer as a Blob: local files directly,
 * stored objects through `HttpClient.requestFile()` so the request carries
 * the Bearer token and survives a 401 refresh. Never pass `url` to
 * `<FileViewer>` — its URL mode fetches without auth headers.
 */
export function FileViewerPreviewHost({
  children,
  onReload = reloadPage
}: PropsWithChildren<FileViewerPreviewHostProps>): ReactElement {
  const apiClient = useApiClient();
  const http = apiClient[HTTP_CLIENT];
  const viewerTheme: PreviewViewerTheme = useIsDarkMode() ? "dark" : "light";
  const [state, setState] = useState<HostState>({ status: "closed" });
  // Aborting the in-flight fetch doubles as the stale-response guard.
  const abortRef = useRef<AbortController>(null);

  const openPreview = useCallback((target: FilePreviewTarget) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (target.size !== undefined && target.size > MAX_PREVIEW_BYTES) {
      controller.abort();
      setState({
        status: "error",
        target,
        message: PREVIEW_TOO_LARGE_MESSAGE,
        recovery: "none"
      });
      return;
    }

    setState({ status: "loading", target });

    void (async () => {
      const fileSource = (async () => {
        // Local bytes first (pending / failed / just-uploaded files); stored
        // objects go through the authenticated client.
        let blob: Blob | undefined = target.file;

        if (!blob) {
          if (!target.url) {
            throw new Error("文件地址不可用，无法加载预览。");
          }

          const fileResponse = await http.requestFile(target.url, {
            signal: controller.signal,
            onProgress: ({ loaded, total }) => {
              if (loaded <= MAX_PREVIEW_BYTES && (total === undefined || total <= MAX_PREVIEW_BYTES)) {
                return;
              }

              if (abortRef.current !== controller) {
                return;
              }

              controller.abort();
              setState({
                status: "error",
                target,
                message: PREVIEW_TOO_LARGE_MESSAGE,
                recovery: "none"
              });
            }
          });
          blob = fileResponse.blob;
        }

        if (blob.size > MAX_PREVIEW_BYTES) {
          controller.abort();

          if (abortRef.current === controller) {
            setState({
              status: "error",
              target,
              message: PREVIEW_TOO_LARGE_MESSAGE,
              recovery: "none"
            });
          }

          return;
        }

        return blob;
      })();

      const viewerModule = getFileViewerModule().catch((error: unknown) => {
        throw new FileViewerModuleLoadError(error);
      });
      const [, blob] = await Promise.all([viewerModule, fileSource]);

      if (!blob || controller.signal.aborted || abortRef.current !== controller) {
        return;
      }

      setState({
        status: "ready",
        target,
        file: blob
      });
    })().catch((error: unknown) => {
      if (controller.signal.aborted || abortRef.current !== controller) {
        return;
      }

      controller.abort();
      setState({
        status: "error",
        target,
        message: getErrorMessage(error),
        recovery: error instanceof FileViewerModuleLoadError ? "reload" : "retry"
      });
    });
  }, [http]);

  const handler = useMemo<FilePreviewHandler>(() => {
    return {
      canPreview: target => PREVIEWABLE_EXTENSIONS.has(getExtension(target.filename)),
      openPreview
    };
  }, [openPreview]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: "closed" });
  }, []);

  const download = useCallback(async (target: FilePreviewTarget) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (target.file) {
        triggerBlobDownload(target.file, target.filename);
        return;
      }

      if (target.url) {
        await http.download(target.url, {
          filename: target.filename,
          signal: controller.signal
        });
      }
    } catch (error: unknown) {
      if (controller.signal.aborted || abortRef.current !== controller) {
        return;
      }

      showErrorMessage(`下载失败：${getErrorMessage(error)}`);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [http]);

  useEffect(() => () => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return (
    <FilePreviewProvider handler={handler}>
      {children}

      <Modal
        centered
        destroyOnHidden
        footer={null}
        open={state.status !== "closed"}
        styles={previewModalStyles}
        title={state.status === "closed" ? "" : state.target.filename}
        width={PREVIEW_MODAL_WIDTH}
        onCancel={close}
      >
        <div style={previewViewportStyle}>
          {state.status === "loading" && (
            <Center style={previewFillStyle}>
              <Spin />
            </Center>
          )}

          {state.status === "error" && (
            <Center style={previewFillStyle}>
              <Result
                status="error"
                subTitle={state.message}
                title="预览失败"
                extra={[
                  state.recovery === "retry"
                    ? (
                        <Button
                          key="retry"
                          icon={<Icon component={RefreshCwIcon} />}
                          onClick={() => openPreview(state.target)}
                        >
                          重新预览
                        </Button>
                      )
                    : null,
                  state.recovery === "reload"
                    ? (
                        <Button
                          key="reload"
                          icon={<Icon component={RefreshCwIcon} />}
                          onClick={onReload}
                        >
                          刷新页面
                        </Button>
                      )
                    : null,
                  state.target.file || state.target.url
                    ? (
                        <ActionButton
                          key="download"
                          icon={<Icon component={DownloadIcon} />}
                          type="primary"
                          onClick={() => download(state.target)}
                        >
                          下载文件
                        </ActionButton>
                      )
                    : null
                ]}
              />
            </Center>
          )}

          {state.status === "ready" && (
            <Suspense
              fallback={(
                <Center style={previewFillStyle}>
                  <Spin />
                </Center>
              )}
            >
              {/* FileViewer fills its container — give it an explicit height. */}
              <div style={previewFillStyle}>
                <FileViewer file={state.file} filename={state.target.filename} theme={viewerTheme} />
              </div>
            </Suspense>
          )}
        </div>
      </Modal>
    </FilePreviewProvider>
  );
}
