import type { MaybeArray, MaybeNullish } from "@vef-framework-react/shared";

import type { UploadedFileMeta, UploadFile } from "../../../upload";
import type { UploadFieldProps } from "./props";

import { useAppContext, useDisabled } from "@vef-framework-react/core";
import { getBaseName, isArray } from "@vef-framework-react/shared";
import { useEffect, useMemo, useState } from "react";

import { FileUpload } from "../../../file-upload";
import { resolveStoredFileUrl } from "../../../file-upload/helpers";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

function getStoredFileKey(file: UploadFile): string {
  const candidate = file as UploadFile & Partial<UploadedFileMeta>;

  return candidate.key ?? candidate.uid;
}

function reconcileDoneFile(normalized: UploadFile, current: UploadFile | undefined): UploadFile {
  if (!current) {
    return normalized;
  }

  const normalizedMeta = normalized as UploadFile & Partial<UploadedFileMeta>;
  const reconciled: UploadFile & Partial<UploadedFileMeta> = {
    ...current,
    key: normalizedMeta.key,
    sourceUrl: normalizedMeta.sourceUrl
  };

  return reconciled;
}

function reconcileFileList(current: UploadFile[], normalized: UploadFile[]): UploadFile[] {
  const currentDoneFiles = new Map(
    current
      .filter(file => file.status === "done")
      .map(file => [getStoredFileKey(file), file])
  );

  return [
    ...normalized.map(file => reconcileDoneFile(file, currentDoneFiles.get(getStoredFileKey(file)))),
    ...current.filter(file => file.status !== "done")
  ];
}

function UploadComponent({
  disabled,
  maxCount,
  resolveFileUrl,
  ...props
}: UploadFieldProps) {
  const {
    state: { value },
    handleChange
  } = useFieldContext<MaybeNullish<MaybeArray<string>>>();
  const { fileBaseUrl } = useAppContext();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  // Hydrate the field's current keys into AntD's UploadFile shape so the
  // list renders previously-uploaded objects on mount and after external
  // value changes. Stamp UploadedFileMeta so hydrated files carry their
  // storage key exactly like freshly uploaded ones (preview targeting and
  // key extraction read it back).
  const normalizedFileList = useMemo<UploadFile[]>(() => {
    const filePaths = isArray(value) ? value : value ? [value] : [];

    return filePaths.map(filePath => {
      const name = getBaseName(filePath);
      const file: UploadFile & UploadedFileMeta = {
        uid: filePath,
        key: filePath,
        sourceUrl: resolveStoredFileUrl(filePath, fileBaseUrl, resolveFileUrl),
        name,
        fileName: name,
        status: "done"
      };

      return file;
    });
  }, [value, fileBaseUrl, resolveFileUrl]);

  const [fileList, setFileList] = useState(normalizedFileList);
  useEffect(() => {
    setFileList(current => reconcileFileList(current, normalizedFileList));
  }, [normalizedFileList]);

  return (
    <FileUpload
      {...props}
      disabled={isDisabled}
      fileList={fileList}
      maxCount={maxCount}
      resolveFileUrl={resolveFileUrl}
      onChange={({ fileList: nextFileList }) => {
        setFileList(nextFileList);

        // Both hydrated and freshly uploaded files carry UploadedFileMeta;
        // fall back to `uid` for done entries injected by external code.
        const uploadedKeys = nextFileList
          .filter(file => file.status === "done")
          .map(file => getStoredFileKey(file));

        handleChange(
          (maxCount ?? Infinity) > 1
            ? uploadedKeys
            : uploadedKeys.length > 0
              ? uploadedKeys[0]
              : null
        );
      }}
    />
  );
}

export const UploadField = withFormItem("UploadField", UploadComponent);

export { type UploadFieldProps } from "./props";
