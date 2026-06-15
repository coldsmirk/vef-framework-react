import type { UploadFile } from "antd";

import type { GetProp } from "../_base";
import type { UploadProps } from "./props";

import { Upload as UploadInternal } from "antd";
import ImageCropper from "antd-img-crop";
import { PlusIcon, UploadIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { mergeProps } from "../_base";
import { Button } from "../button";
import { Icon } from "../icon";
import { Image } from "../image";

type UploadFileType = Parameters<GetProp<UploadProps, "beforeUpload">>[0];

const DEFAULT_CROPPER_CONFIG = {
  showReset: true,
  rotationSlider: true,
  zoomSlider: true
} as const;

async function getFileBase64(file: UploadFileType) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.addEventListener("load", () => resolve(reader.result as string));
    reader.addEventListener("error", error => reject(error));
  });
}

export function Upload({
  enableCrop = false,
  cropperProps,
  listType,
  fileList,
  defaultFileList,
  maxCount,
  pastable = true,
  onPreview,
  children,
  ...props
}: UploadProps) {
  const isPictureCardOrCircle = listType === "picture-card" || listType === "picture-circle";
  const hasReachedMaxCount = (fileList || defaultFileList || []).length >= (maxCount || Infinity);

  const uploadButton = useMemo(() => {
    if (children) {
      return children;
    }

    if (isPictureCardOrCircle) {
      return <Icon component={PlusIcon} />;
    }

    return (
      <Button
        disabled={hasReachedMaxCount}
        icon={<Icon component={UploadIcon} />}
        type="primary"
      >
        上传
      </Button>
    );
  }, [children, isPictureCardOrCircle, hasReachedMaxCount]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");

  const handlePreview = useCallback(async (file: UploadFile) => {
    let preview = file.url;

    if (!preview && file.originFileObj) {
      preview = await getFileBase64(file.originFileObj as UploadFileType);
    }

    setPreviewImage(preview as string);
    setIsPreviewOpen(true);
  }, []);

  const shouldShowUploadButton = !isPictureCardOrCircle || !hasReachedMaxCount;

  const uploadElement = (
    <UploadInternal
      {...props}
      defaultFileList={defaultFileList}
      fileList={fileList}
      listType={listType}
      maxCount={maxCount}
      pastable={pastable}
      onPreview={onPreview || handlePreview}
    >
      {shouldShowUploadButton && uploadButton}
    </UploadInternal>
  );

  const mergedCropperProps = useMemo(
    () => mergeProps(cropperProps ?? {}, DEFAULT_CROPPER_CONFIG),
    [cropperProps]
  );

  return (
    <>
      {
        enableCrop
          ? (
              <ImageCropper {...mergedCropperProps}>
                {uploadElement}
              </ImageCropper>
            )
          : uploadElement
      }

      {previewImage && (
        <Image
          src={previewImage}
          styles={{ root: { display: "none" } }}
          preview={{
            open: isPreviewOpen,
            onOpenChange: open => setIsPreviewOpen(open),
            afterOpenChange: open => {
              if (!open) {
                setPreviewImage("");
              }
            }
          }}
        />
      )}
    </>
  );
}

export { type UploadProps } from "./props";
export { type UploadFile } from "antd";
