import type {
  UploaderOptions,
  UploadError,
  UploadProgress,
  UploadResult
} from "@vef-framework-react/core";

import type { UploadProps } from "../upload";

/**
 * `<FileUpload>` props. Inherits the AntD `<Upload>` shell's props (drag-drop,
 * picture-card, paste, image crop, etc.) and overrides `customRequest` so the
 * upload runs through the framework's chunked storage protocol.
 *
 * Use `fileList` / `onChange` for controlled AntD-style use. Form values made
 * of storage keys are owned by `UploadField`, not this component.
 */
export interface FileUploadProps
  extends Omit<UploadProps, "customRequest" | "action" | "method" | "data" | "headers"> {
  /**
   * Land the object under `pub/` (`true`) or `priv/` (default). Requires the
   * backend's `vef.storage.allow_public_uploads` to be enabled when `true`.
   */
  public?: boolean;
  /**
   * Override RPC entrypoint URL. Defaults to `/api`.
   */
  apiPath?: string;
  /**
   * Override RPC resource name. Defaults to `sys/storage`.
   */
  resource?: string;
  /**
   * Override RPC version. Defaults to `v1`.
   */
  version?: string;
  /**
   * Per-file part concurrency. Defaults to 3.
   */
  partConcurrency?: UploaderOptions["partConcurrency"];
  /**
   * Per-part retry budget. Defaults to 3.
   */
  maxPartRetries?: UploaderOptions["maxPartRetries"];
  /**
   * Resolve an object key into a source URL. Defaults to
   * `${fileBaseUrl}/${key}` from `useAppContext` with double-slash collapsing.
   */
  resolveFileUrl?: (key: string) => string;
  /**
   * Fires on each aggregated progress tick of a specific file.
   */
  onUploadProgress?: (file: File, progress: UploadProgress) => void;
  /**
   * Fires when a file completes successfully.
   */
  onUploadSuccess?: (file: File, result: UploadResult) => void;
  /**
   * Fires when a file fails terminally (including aborts).
   */
  onUploadError?: (file: File, error: UploadError) => void;
}
