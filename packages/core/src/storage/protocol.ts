import type { AxiosProgressEvent, GenericAbortSignal } from "axios";

import type { HttpClient } from "../http";

import { createApiRequest } from "../api/helpers";
import { UploadProtocolError } from "./errors";

/**
 * Default RPC entrypoint, resource, and version. Match the conventions used
 * by `vef-framework-go`'s storage resource.
 */
export const DEFAULT_API_PATH = "/api";
export const DEFAULT_RESOURCE = "sys/storage";
export const DEFAULT_VERSION = "v1";

/**
 * Read side of the backend's durable upload registry. Separate from
 * `DEFAULT_RESOURCE` because it is a query surface over recorded state,
 * not a step in the chunked-upload state machine.
 */
export const DEFAULT_FILE_RESOURCE = "sys/storage/file";

const ACTION_INIT = "init_upload";
const ACTION_PART = "upload_part";
const ACTION_LIST_PARTS = "list_parts";
const ACTION_COMPLETE = "complete_upload";
const ACTION_ABORT = "abort_upload";
const ACTION_RESOLVE = "resolve";

/**
 * Shared identifying fields for every storage RPC call. The protocol allows
 * overriding `resource` / `version` per call site so callers running against
 * a customized backend resource name stay supported without re-wiring the
 * Uploader.
 */
export interface ProtocolContext {
  http: Readonly<HttpClient>;
  apiPath: string;
  resource: string;
  version: string;
}

export interface InitUploadParams {
  filename: string;
  size: number;
  contentType?: string;
  public?: boolean;
}

export interface InitUploadResponse {
  key: string;
  claimId: string;
  originalFilename: string;
  partSize: number;
  partCount: number;
  expiresAt: string;
}

export interface UploadPartResponse {
  partNumber: number;
  size: number;
}

export interface ObjectInfo {
  bucket: string;
  key: string;
  eTag: string;
  size: number;
  contentType: string;
  lastModified: string;
  metadata?: Record<string, string>;
}

export interface CompleteUploadResponse extends ObjectInfo {
  originalFilename: string;
}

/**
 * Open a multipart upload session on the backend. The returned `partSize`
 * and `partCount` are authoritative — callers must slice the file using
 * exactly these values.
 */
export async function initUpload(
  ctx: ProtocolContext,
  params: InitUploadParams,
  signal?: GenericAbortSignal
): Promise<InitUploadResponse> {
  try {
    const result = await ctx.http.post<InitUploadResponse>(ctx.apiPath, {
      data: createApiRequest(ctx.resource, ACTION_INIT, ctx.version, params),
      signal
    });

    return result.data;
  } catch (error) {
    throw new UploadProtocolError(ACTION_INIT, "failed to initialize upload", { cause: error });
  }
}

/**
 * Upload a single part. Streams the blob through `HttpClient.upload` so
 * axios surfaces progress events for the in-flight transfer.
 */
export async function uploadPart(
  ctx: ProtocolContext,
  args: {
    claimId: string;
    partNumber: number;
    blob: Blob;
    onProgress?: (event: AxiosProgressEvent) => void;
    signal?: GenericAbortSignal;
  }
): Promise<UploadPartResponse> {
  const form = new FormData();
  form.append("resource", ctx.resource);
  form.append("action", ACTION_PART);
  form.append("version", ctx.version);
  form.append("params", JSON.stringify({ claimId: args.claimId, partNumber: args.partNumber }));
  form.append("file", args.blob);

  const result = await ctx.http.upload<UploadPartResponse>(ctx.apiPath, {
    data: form,
    onProgress: args.onProgress,
    signal: args.signal
  });

  return result.data;
}

/**
 * One row of `list_parts`. Mirrors the backend's `ListedPart` struct —
 * ETag is intentionally omitted server-side and therefore never appears
 * here either: complete_upload assembles the parts list from the
 * database, not from client-supplied state.
 */
export interface ListedPart {
  partNumber: number;
  size: number;
}

export interface ListPartsResponse {
  parts: ListedPart[];
}

/**
 * Enumerate parts the backend has already accepted for an active claim.
 * Drives the resume path: callers feed the result into a `ResumePlan`
 * so the Uploader knows which slots to skip. Errors map to
 * `UploadProtocolError("list_parts", ...)` so callers can fold the
 * "cannot resume" case into the storage error hierarchy and fall back
 * to a fresh init.
 */
export async function listParts(
  ctx: ProtocolContext,
  claimId: string,
  signal?: GenericAbortSignal
): Promise<ListPartsResponse> {
  try {
    const result = await ctx.http.post<ListPartsResponse>(ctx.apiPath, {
      data: createApiRequest(ctx.resource, ACTION_LIST_PARTS, ctx.version, { claimId }),
      signal
    });

    return result.data;
  } catch (error) {
    throw new UploadProtocolError(ACTION_LIST_PARTS, "failed to list parts", { cause: error });
  }
}

/**
 * Finalize a multipart session. The backend reconstructs the part list from
 * its `upload_part` table — the client never replays ETags.
 */
export async function completeUpload(
  ctx: ProtocolContext,
  claimId: string,
  signal?: GenericAbortSignal
): Promise<CompleteUploadResponse> {
  try {
    const result = await ctx.http.post<CompleteUploadResponse>(ctx.apiPath, {
      data: createApiRequest(ctx.resource, ACTION_COMPLETE, ctx.version, { claimId }),
      signal
    });

    return result.data;
  } catch (error) {
    throw new UploadProtocolError(ACTION_COMPLETE, "failed to complete upload", { cause: error });
  }
}

/**
 * One row of `resolve`. Mirrors the backend's `ResolvedFile` struct.
 *
 * `status` follows the backend's file lifecycle: `"uploaded"` (recorded,
 * not yet referenced by business data), `"claimed"` (adopted by a
 * business transaction), `"deleted"` (the object is gone but the record
 * of it remains).
 */
export interface ResolvedFile {
  key: string;
  originalFilename: string;
  contentType: string;
  size: number;
  status: "uploaded" | "claimed" | "deleted";
  uploadedAt: string;
  uploadedBy: string;
}

export interface ResolveFilesResponse {
  files: ResolvedFile[];
}

/**
 * Resolve stored object keys into the metadata needed to render them —
 * original filename above all. A business model stores only the key, so
 * without this a re-opened form can only show the generated object name.
 *
 * Keys the caller may not read, and keys the backend has no record of,
 * are omitted from the response rather than reported as errors: the
 * caller is rendering a list and must degrade to the bare key.
 */
export async function resolveFiles(
  ctx: ProtocolContext,
  keys: string[],
  signal?: GenericAbortSignal
): Promise<ResolveFilesResponse> {
  try {
    const result = await ctx.http.post<ResolveFilesResponse>(ctx.apiPath, {
      data: createApiRequest(ctx.resource, ACTION_RESOLVE, ctx.version, { keys }),
      signal
    });

    return result.data;
  } catch (error) {
    throw new UploadProtocolError(ACTION_RESOLVE, "failed to resolve files", { cause: error });
  }
}

/**
 * Best-effort cancellation of an in-flight session. Errors are swallowed —
 * `abort_upload` is idempotent on the server, and a failure here must not
 * mask the original cause that triggered the abort. Caller code can log via
 * the optional `onError` hook.
 */
export async function abortUpload(
  ctx: ProtocolContext,
  claimId: string,
  onError?: (error: unknown) => void
): Promise<void> {
  try {
    await ctx.http.post(ctx.apiPath, {
      data: createApiRequest(ctx.resource, ACTION_ABORT, ctx.version, { claimId })
    });
  } catch (error) {
    onError?.(error);
  }
}
