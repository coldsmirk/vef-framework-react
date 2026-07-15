import type { UploadFile } from "antd";

import type { GetProp } from "../_base";
import type { UploadProps } from "./props";

import { Upload as UploadInternal } from "antd";
import ImageCropper from "antd-img-crop";
import { PlusIcon, UploadIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { mergeProps, showWarningMessage } from "../_base";
import { Button } from "../button";
import { useFilePreview } from "../file-preview";
import { Icon } from "../icon";
import { Image } from "../image";
import {
  getUploadSourceUrl,
  isImageFile,
  isolateUploadRequestFileUrl,
  toAntdUploadFile,
  toFilePreviewTarget,
  toPublicUploadFile
} from "./helpers";

type UploadFileType = Parameters<GetProp<UploadProps, "beforeUpload">>[0];

type CustomRequestFn = NonNullable<GetProp<UploadProps, "customRequest">>;

type OnChangeFn = NonNullable<GetProp<UploadProps, "onChange">>;

type OnDownloadFn = NonNullable<GetProp<UploadProps, "onDownload">>;

type OnPreviewFn = NonNullable<GetProp<UploadProps, "onPreview">>;

type OnRemoveFn = NonNullable<GetProp<UploadProps, "onRemove">>;

type UploadFileOption<T> = T | ((file: UploadFile) => T);

function restoreUploadFileOption<T>(option: UploadFileOption<T> | undefined): UploadFileOption<T> | undefined {
  if (typeof option !== "function") {
    return option;
  }

  const getOption = option as (file: UploadFile) => T;

  return file => getOption(toPublicUploadFile(file));
}

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
  isImageUrl,
  listType,
  fileList,
  iconRender,
  itemRender,
  defaultFileList,
  maxCount,
  pastable = true,
  customRequest,
  onChange,
  onDownload,
  onPreview,
  onRemove,
  showUploadList,
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

  const filePreview = useFilePreview();
  const antdFileList = useMemo(() => fileList?.map(file => toAntdUploadFile(file)), [fileList]);
  const antdDefaultFileList = useMemo(
    () => defaultFileList?.map(file => toAntdUploadFile(file)),
    [defaultFileList]
  );

  const antdCustomRequest = useMemo<CustomRequestFn | undefined>(() => {
    if (!customRequest) {
      return;
    }

    return (options, info) => customRequest({
      ...options,
      onSuccess: (body, fileOrXhr) => {
        isolateUploadRequestFileUrl(options.file);
        options.onSuccess?.(body, fileOrXhr);
      }
    }, info);
  }, [customRequest]);

  // Default preview chain (an explicit `onPreview` prop bypasses it):
  // images use the built-in <Image> modal; everything else goes to the
  // nearest FilePreviewProvider, then to a warning. The framework never opens
  // a URL directly because it cannot prove that the URL is anonymously readable.
  const handlePreview = useCallback(async (file: UploadFile) => {
    if (isImageFile(file)) {
      let preview = getUploadSourceUrl(file);

      if (!preview && file.originFileObj) {
        preview = await getFileBase64(file.originFileObj as UploadFileType);
      }

      setPreviewImage(preview as string);
      setIsPreviewOpen(true);
      return;
    }

    const target = toFilePreviewTarget(file);

    if (filePreview && (filePreview.canPreview?.(target) ?? true)) {
      filePreview.openPreview(target);
      return;
    }

    showWarningMessage("该文件暂不支持预览");
  }, [filePreview]);

  const handleChange = useCallback<OnChangeFn>(info => {
    const publicFileList = info.fileList.map(file => toPublicUploadFile(file));
    const publicFile = publicFileList.find(file => file.uid === info.file.uid) ?? toPublicUploadFile(info.file);

    onChange?.({
      ...info,
      file: publicFile,
      fileList: publicFileList
    });
  }, [onChange]);

  const handleDownload = useCallback<OnDownloadFn>(file => {
    if (onDownload) {
      onDownload(toPublicUploadFile(file));
      return;
    }

    showWarningMessage("该文件暂不支持下载");
  }, [onDownload]);

  const handlePreviewDispatch = useCallback<OnPreviewFn>(file => {
    if (onPreview) {
      onPreview(toPublicUploadFile(file));
      return;
    }

    void handlePreview(file);
  }, [handlePreview, onPreview]);

  const handleRemove = useCallback<OnRemoveFn>(file => onRemove?.(toPublicUploadFile(file)), [onRemove]);

  const handleIsImageUrl = useMemo(
    () => isImageUrl ? (file: UploadFile): boolean => isImageUrl(toPublicUploadFile(file)) : undefined,
    [isImageUrl]
  );

  const handleIconRender = useMemo<UploadProps["iconRender"]>(() => {
    if (!iconRender) {
      return;
    }

    return (file, currentListType) => iconRender(toPublicUploadFile(file), currentListType);
  }, [iconRender]);

  const handleItemRender = useMemo<UploadProps["itemRender"]>(() => {
    if (!itemRender) {
      return;
    }

    return (originNode, file, currentFileList, actions) => itemRender(
      originNode,
      toPublicUploadFile(file),
      currentFileList.map(currentFile => toPublicUploadFile(currentFile)),
      actions
    );
  }, [itemRender]);

  const antdShowUploadList = useMemo(() => {
    if (!showUploadList || typeof showUploadList === "boolean") {
      return showUploadList;
    }

    return {
      ...showUploadList,
      downloadIcon: restoreUploadFileOption(showUploadList.downloadIcon),
      extra: restoreUploadFileOption(showUploadList.extra),
      previewIcon: restoreUploadFileOption(showUploadList.previewIcon),
      removeIcon: restoreUploadFileOption(showUploadList.removeIcon),
      showDownloadIcon: restoreUploadFileOption(showUploadList.showDownloadIcon),
      showPreviewIcon: restoreUploadFileOption(showUploadList.showPreviewIcon),
      showRemoveIcon: restoreUploadFileOption(showUploadList.showRemoveIcon)
    };
  }, [showUploadList]);

  const shouldShowUploadButton = !isPictureCardOrCircle || !hasReachedMaxCount;

  const uploadElement = (
    <UploadInternal
      {...props}
      customRequest={antdCustomRequest}
      defaultFileList={antdDefaultFileList}
      fileList={antdFileList}
      iconRender={handleIconRender}
      isImageUrl={handleIsImageUrl}
      itemRender={handleItemRender}
      listType={listType}
      maxCount={maxCount}
      pastable={pastable}
      showUploadList={antdShowUploadList}
      onChange={handleChange}
      onDownload={handleDownload}
      onPreview={handlePreviewDispatch}
      onRemove={handleRemove}
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

export { toFilePreviewTarget } from "./helpers";
export { type UploadedFileMeta, type UploadProps } from "./props";
export { type UploadFile } from "antd";
