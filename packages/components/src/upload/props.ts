import type { Except } from "@vef-framework-react/shared";
import type { UploadProps as UploadPropsInternal } from "antd";
import type { ImgCropProps } from "antd-img-crop";

/**
 * Per-file storage metadata stamped onto AntD `UploadFile`s by the upload
 * family: `<FileUpload>` patches it onto the origin `File` when a chunked
 * upload completes (AntD spreads it into the list entry), and `UploadField`
 * stamps it when hydrating stored keys. Preview targeting and form fields
 * read storage keys back through this shape.
 */
export interface UploadedFileMeta {
  /**
   * Object key (e.g. `priv/2026/05/12/abc.png`).
   */
  key: string;
  /**
   * Resolved source URL for fetching the stored object. Kept separate from
   * AntD's navigable `UploadFile.url` so authenticated files are never exposed
   * as native list links. Use `UploadFile.thumbUrl` only for an application-
   * approved presentation thumbnail.
   */
  sourceUrl: string;
  /**
   * Original client-supplied filename echoed back by the backend.
   */
  fileName: string;
}

export interface UploadProps extends UploadPropsInternal {
  /**
   * Whether to enable image cropping feature
   *
   * @default false
   */
  enableCrop?: boolean;
  /**
   * Additional props for the image cropper component
   */
  cropperProps?: Except<ImgCropProps, "children">;
}
