import type { UploadError, UploadResult } from "@vef-framework-react/core";
import type { ReactElement } from "react";

import type { GetProp } from "../_base";
import type { UploadedFileMeta, UploadProps } from "../upload";
import type { FileUploadProps } from "./props";

import { HTTP_CLIENT, Uploader, useApiClient, useAppContext } from "@vef-framework-react/core";
import { useCallback, useMemo } from "react";

import { Upload } from "../upload";
import { resolveStoredFileUrl } from "./helpers";

type CustomRequestFn = NonNullable<GetProp<UploadProps, "customRequest">>;

type CustomRequestOptions = Parameters<CustomRequestFn>[0];

/**
 * Chunked-upload variant of `<Upload>` wired to `sys/storage`. Each file is
 * handed to its own `Uploader` instance, so AntD's concurrent file dispatch
 * works out of the box. Successfully uploaded files have `key`, `sourceUrl`,
 * and `fileName` patched onto the AntD `UploadFile` so downstream form fields
 * can read them without a separate state channel.
 */
export function FileUpload({
  public: isPublic,
  apiPath,
  resource,
  version,
  partConcurrency,
  maxPartRetries,
  resolveFileUrl,
  onUploadProgress,
  onUploadSuccess,
  onUploadError,
  ...uploadProps
}: FileUploadProps): ReactElement {
  const apiClient = useApiClient();
  const { fileBaseUrl } = useAppContext();
  const http = apiClient[HTTP_CLIENT];

  const resolveUrl = useCallback(
    (key: string): string => resolveStoredFileUrl(key, fileBaseUrl, resolveFileUrl),
    [resolveFileUrl, fileBaseUrl]
  );

  const customRequest = useMemo<CustomRequestFn>(() => (options: CustomRequestOptions): { abort: () => void } => {
    const file = options.file as File;
    const uploader = new Uploader(http, file, {
      apiPath,
      resource,
      version,
      init: {
        filename: file.name,
        contentType: file.type || undefined,
        public: isPublic
      },
      partConcurrency,
      maxPartRetries,
      onProgress: progress => {
        options.onProgress?.({ percent: progress.percent });
        onUploadProgress?.(file, progress);
      }
    });

    uploader
      .start()
      .then((result: UploadResult) => {
        // Patch AntD's UploadFile with storage metadata so form fields and
        // previews can read it without a parallel state channel. `sourceUrl`
        // deliberately stays separate from AntD's navigable `.url` field.
        const meta: UploadedFileMeta = {
          key: result.key,
          sourceUrl: resolveUrl(result.key),
          fileName: result.originalFilename
        };
        Object.assign(file, meta);

        options.onSuccess?.(result, file);
        onUploadSuccess?.(file, result);
      })
      .catch((error: UploadError) => {
        options.onError?.(error);
        onUploadError?.(file, error);
      });

    return {
      abort() {
        void uploader.abort();
      }
    };
  }, [
    http,
    apiPath,
    resource,
    version,
    isPublic,
    partConcurrency,
    maxPartRetries,
    resolveUrl,
    onUploadProgress,
    onUploadSuccess,
    onUploadError
  ]);

  return <Upload {...uploadProps} customRequest={customRequest} />;
}

export type { FileUploadProps } from "./props";
