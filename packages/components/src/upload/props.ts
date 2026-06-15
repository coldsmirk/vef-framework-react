import type { Except } from "@vef-framework-react/shared";
import type { UploadProps as UploadPropsInternal } from "antd";
import type { ImgCropProps } from "antd-img-crop";

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
