import type { MaybeArray, MaybeNullish } from "@vef-framework-react/shared";
import type { ReactElement } from "react";

import type { UploadedFileMeta, UploadFile } from "../upload";
import type { FileUploadProps } from "./props";

import { useAppContext, useDisabled } from "@vef-framework-react/core";
import { useStoredFileNames } from "@vef-framework-react/hooks";
import { getBaseName, isArray } from "@vef-framework-react/shared";
import { useEffect, useMemo, useState } from "react";

import { resolveStoredFileUrl } from "./helpers";
import { FileUpload } from "./index";

/**
 * The value a storage-backed upload holds: object keys, one for a single-file
 * field and a list for a multi-file one. It is deliberately the shape the
 * backend validates (`approval.FieldUpload` accepts a string or a string
 * array), so a form value round-trips without a translation layer.
 */
export type StoredFileValue = MaybeNullish<MaybeArray<string>>;

export interface StoredFileUploadProps
  extends Omit<FileUploadProps, "fileList" | "defaultFileList" | "onChange"> {
  value: StoredFileValue;
  onChange: (value: StoredFileValue) => void;
}

function getStoredFileKey(file: UploadFile): string {
  const candidate = file as UploadFile & Partial<UploadedFileMeta>;

  return candidate.key ?? candidate.uid;
}

function reconcileDoneFile(
  normalized: UploadFile,
  current: UploadFile | undefined,
  resolvedName: string | undefined
): UploadFile {
  if (!current) {
    return normalized;
  }

  const normalizedMeta = normalized as UploadFile & Partial<UploadedFileMeta>;
  const reconciled: UploadFile & Partial<UploadedFileMeta> = {
    ...current,
    key: normalizedMeta.key,
    sourceUrl: normalizedMeta.sourceUrl
  };

  // Only once the registry has answered: its name is what the file will
  // still be called after a reload. Until then keep the entry's own name —
  // for a file uploaded in this session that is the real local filename,
  // and replacing it with the key's base name would be a visible
  // regression rather than a fallback.
  if (resolvedName) {
    reconciled.name = resolvedName;
    reconciled.fileName = resolvedName;
  }

  return reconciled;
}

function reconcileFileList(
  current: UploadFile[],
  normalized: UploadFile[],
  resolvedNames: Record<string, string>
): UploadFile[] {
  const currentDoneFiles = new Map(
    current
      .filter(file => file.status === "done")
      .map(file => [getStoredFileKey(file), file])
  );

  return [
    ...normalized.map(file => {
      const key = getStoredFileKey(file);

      return reconcileDoneFile(file, currentDoneFiles.get(key), resolvedNames[key]);
    }),
    ...current.filter(file => file.status !== "done")
  ];
}

/**
 * `<FileUpload>` driven by a value of storage keys instead of AntD's file
 * list — the controlled core shared by every form flavor of the upload
 * control: the TanStack-bound `<UploadField>` and the form designer's upload
 * field both render this, so the key hydration, the registry name lookup, and
 * the single-vs-multi value shape have exactly one implementation.
 */
export function StoredFileUpload({
  disabled,
  maxCount,
  resolveFileUrl,
  value,
  onChange,
  ...props
}: StoredFileUploadProps): ReactElement {
  const { fileBaseUrl } = useAppContext();
  const contextDisabled = useDisabled();
  const isDisabled = contextDisabled || disabled;

  const storedKeys = useMemo(
    () => isArray(value) ? value : value ? [value] : [],
    [value]
  );

  // The value holds storage keys only, so a re-opened form would otherwise
  // display the generated object name. The registry knows what each key was
  // uploaded as; until it answers (or when it cannot), fall back to the key's
  // base name.
  const resolvedFiles = useStoredFileNames(storedKeys);
  const resolvedNames = useMemo(
    () => Object.fromEntries(
      Object.entries(resolvedFiles).map(([key, file]) => [key, file.originalFilename])
    ),
    [resolvedFiles]
  );

  // Hydrate the current keys into AntD's UploadFile shape so the list renders
  // previously-uploaded objects on mount and after external value changes.
  // Stamp UploadedFileMeta so hydrated files carry their storage key exactly
  // like freshly uploaded ones (preview targeting and key extraction read it
  // back).
  const normalizedFileList = useMemo<UploadFile[]>(
    () => storedKeys.map(filePath => {
      const name = resolvedNames[filePath] || getBaseName(filePath);
      const file: UploadFile & UploadedFileMeta = {
        uid: filePath,
        key: filePath,
        sourceUrl: resolveStoredFileUrl(filePath, fileBaseUrl, resolveFileUrl),
        name,
        fileName: name,
        status: "done"
      };

      return file;
    }),
    [storedKeys, resolvedNames, fileBaseUrl, resolveFileUrl]
  );

  const [fileList, setFileList] = useState(normalizedFileList);
  useEffect(() => {
    setFileList(current => reconcileFileList(current, normalizedFileList, resolvedNames));
  }, [normalizedFileList, resolvedNames]);

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

        onChange(
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
