/**
 * Framework-normalized description of a file the user asked to preview.
 *
 * Exactly how the bytes are obtained is up to the preview host; the sources
 * are listed in priority order — `file` (already local, no request needed),
 * then `key` (fetch through an authenticated channel), then `url` (plain
 * fetch; may require auth the browser cannot attach).
 */
export interface FilePreviewTarget {
  /**
   * Display name including the extension. Most viewers derive the file
   * format from it.
   */
  filename: string;
  /**
   * MIME type when known. Local files expose it; files hydrated from a
   * storage key usually do not.
   */
  contentType?: string;
  /**
   * File size in bytes when known.
   */
  size?: number;
  /**
   * Local file content when available — pending, uploading, and failed
   * files, plus files uploaded in the current session.
   */
  file?: File;
  /**
   * Storage object key for files uploaded through the framework's chunked
   * storage protocol (e.g. `priv/2026/05/12/abc.docx`).
   */
  key?: string;
  /**
   * Resolved fetch URL when known — composed from `fileBaseUrl` for stored
   * objects, or taken from the AntD `UploadFile` as-is.
   */
  url?: string;
}

/**
 * Contract a file-preview host implements. The framework never renders a
 * viewer itself — the application provides one (a dialog around a viewer
 * library, a new tab, etc.) via `FilePreviewProvider`.
 */
export interface FilePreviewHandler {
  /**
   * Whether the host can preview the target. Must be cheap and synchronous
   * (no network). Treated as `true` when omitted.
   */
  canPreview?: (target: FilePreviewTarget) => boolean;
  /**
   * Open the preview for the target. Synchronous dispatch only — fetching
   * and rendering happen inside the host.
   */
  openPreview: (target: FilePreviewTarget) => void;
}
