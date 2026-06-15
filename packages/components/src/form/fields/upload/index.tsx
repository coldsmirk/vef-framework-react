import type { MaybeArray, MaybeNullish } from "@vef-framework-react/shared";

import type { UploadFile } from "../../../upload";
import type { UploadFieldProps } from "./props";

import { useAppContext, useDisabled } from "@vef-framework-react/core";
import { getBaseName, isArray } from "@vef-framework-react/shared";
import { useEffect, useMemo, useState } from "react";

import { FileUpload } from "../../../file-upload";
import { useFieldContext } from "../../contexts";
import { withFormItem } from "../../helpers";

const DOUBLE_SLASH_REGEX = /(?<!https?:)\/\//g;

/**
 * Compose the fetch URL for a stored object key against the app's
 * `fileBaseUrl`. Collapses accidental `//` so trailing slashes on either
 * side stay safe.
 */
function composeFileUrl(fileBaseUrl: string | undefined, key: string): string {
  if (!fileBaseUrl) {
    return key;
  }

  return `${fileBaseUrl}/${key}`.replaceAll(DOUBLE_SLASH_REGEX, "/");
}

function UploadComponent({
  disabled,
  maxCount,
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
  // value changes.
  const normalizedFileList = useMemo(() => {
    const filePaths = isArray(value) ? value : value ? [value] : [];

    return filePaths.map(filePath => {
      const file: UploadFile = {
        uid: filePath,
        url: composeFileUrl(fileBaseUrl, filePath),
        name: getBaseName(filePath),
        status: "done"
      };

      return file;
    });
  }, [value, fileBaseUrl]);

  const [fileList, setFileList] = useState(normalizedFileList);
  useEffect(() => {
    setFileList(current => [
      ...normalizedFileList,
      ...current.filter(file => file.status !== "done")
    ]);
  }, [normalizedFileList]);

  return (
    <FileUpload
      {...props}
      disabled={isDisabled}
      fileList={fileList}
      maxCount={maxCount}
      onChange={({ fileList: nextFileList }) => {
        setFileList(nextFileList);

        // <FileUpload> patches `.key` onto the underlying File once the
        // chunked upload finalizes; fall back to `uid` for files that
        // were pre-populated from the field value.
        const uploadedKeys = nextFileList
          .filter(file => file.status === "done")
          .map(file => {
            const candidate = file as UploadFile & { key?: string };
            return candidate.key ?? candidate.uid;
          });

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
