import type { Except } from "@vef-framework-react/shared";

import type { FileUploadProps } from "../../../file-upload";

/**
 * Form-field flavor of `<FileUpload>`. `fileList` / `defaultFileList` /
 * `onChange` are owned by the field so the surrounding form drives the
 * file list shape; everything else (drag-drop, picture-card, paste,
 * `public`, `partConcurrency`, image crop, etc.) is forwarded through to
 * `<FileUpload>` unchanged.
 */
export interface UploadFieldProps
  extends Except<FileUploadProps, "fileList" | "defaultFileList" | "onChange"> {}
