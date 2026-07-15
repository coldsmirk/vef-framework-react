import type { FilePreviewHandler, FilePreviewTarget } from "@vef-framework-react/components";
import type { PropsWithChildren, ReactElement } from "react";

import { Center, FilePreviewProvider, Modal, Result, Spin } from "@vef-framework-react/components";
import { HTTP_CLIENT, useApiClient } from "@vef-framework-react/core";
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";

interface OfficeFileViewerProps {
  file: Blob;
  filename: string;
}

// Lazy-load so the viewer bundle stays out of the first paint. The office
// preset is passed through `options.preset` — the documented bundler-agnostic
// path for assembling renderers (the Vite plugin's HTML auto-injection does
// not survive this app's custom HTML pipeline; the plugin is still used for
// copying worker/WASM assets into the build).
const FileViewer = lazy(async () => {
  const [{ FileViewer: FileViewerInternal }, { default: officePreset }] = await Promise.all([
    import("@file-viewer/react"),
    import("@file-viewer/preset-office")
  ]);
  // Created once per lazy resolution — a stable reference, so the viewer is
  // not re-created on every host render.
  const viewerOptions = { preset: officePreset };

  function OfficeFileViewer({ file, filename }: OfficeFileViewerProps): ReactElement {
    return <FileViewerInternal file={file} filename={filename} options={viewerOptions} />;
  }

  return { default: OfficeFileViewer };
});

/**
 * Formats covered by the office preset configured in `vite.config.ts`
 * (`fileViewerRenderers({ preset: "office" })`): PDF / OFD / Word /
 * Excel / PowerPoint renderer lines.
 */
const PREVIEWABLE_EXTENSIONS = new Set([
  "pdf",
  "ofd",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "pptx",
  "rtf"
]);

/**
 * The viewer reads the whole file into memory — cap what we hand it.
 */
const MAX_PREVIEW_BYTES = 100 * 1024 * 1024;

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex === -1 ? "" : filename.slice(dotIndex + 1).toLowerCase();
}

type HostState
  = | { status: "closed" }
    | { status: "loading"; target: FilePreviewTarget }
    | { status: "ready"; target: FilePreviewTarget; file: Blob }
    | { status: "error"; target: FilePreviewTarget; message: string };

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
export function FileViewerPreviewHost({ children }: PropsWithChildren): ReactElement {
  const apiClient = useApiClient();
  const http = apiClient[HTTP_CLIENT];
  const [state, setState] = useState<HostState>({ status: "closed" });
  // Aborting the in-flight fetch doubles as the stale-response guard.
  const abortRef = useRef<AbortController>(null);

  const openPreview = useCallback((target: FilePreviewTarget) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (target.size !== undefined && target.size > MAX_PREVIEW_BYTES) {
      setState({
        status: "error",
        target,
        message: "文件过大, 请下载后查看"
      });
      return;
    }

    setState({ status: "loading", target });

    void (async () => {
      // Local bytes first (pending / failed / just-uploaded files); stored
      // objects go through the authenticated client.
      let blob: Blob | undefined = target.file;

      if (!blob) {
        const fileResponse = await http.requestFile(target.url ?? "", { signal: controller.signal });
        blob = fileResponse.blob;
      }

      if (!controller.signal.aborted) {
        setState({
          status: "ready",
          target,
          file: blob
        });
      }
    })().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setState({
          status: "error",
          target,
          message: error instanceof Error ? error.message : String(error)
        });
      }
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
    setState({ status: "closed" });
  }, []);

  return (
    <FilePreviewProvider handler={handler}>
      {children}

      <Modal
        destroyOnHidden
        footer={null}
        open={state.status !== "closed"}
        title={state.status === "closed" ? "" : state.target.filename}
        width={960}
        onCancel={close}
      >
        {state.status === "loading" && (
          <Center style={{ minHeight: 480 }}>
            <Spin />
          </Center>
        )}

        {state.status === "error"
          && <Result status="error" subTitle={state.message} title="预览失败" />}

        {state.status === "ready" && (
          <Suspense
            fallback={(
              <Center style={{ minHeight: 480 }}>
                <Spin />
              </Center>
            )}
          >
            {/* FileViewer fills its container — give it an explicit height. */}
            <div style={{ height: "70vh" }}>
              <FileViewer file={state.file} filename={state.target.filename} />
            </div>
          </Suspense>
        )}
      </Modal>
    </FilePreviewProvider>
  );
}
