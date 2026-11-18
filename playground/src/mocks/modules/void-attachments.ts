import { defineMock, MockBusinessError } from "../define-mock";

interface Attachment {
  key: string;
  originalFilename: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  blob?: Blob;
}

// Demo files stay in this browser tab. One multipart part is sufficient for the local transport.
const claims = new Map<string, Attachment>();
const stored = new Map<string, Attachment>();
defineMock<{ filename: string; size: number; contentType?: string }>("sys/storage", "init_upload", ({ params }) => {
  const claimId = crypto.randomUUID();
  const key = `priv/meeting-demo/${claimId}/${encodeURIComponent(params.filename)}`;
  const file = {
    key,
    originalFilename: params.filename,
    size: params.size,
    contentType: params.contentType ?? "application/octet-stream",
    uploadedAt: new Date().toISOString()
  };
  claims.set(claimId, file);
  return {
    key,
    claimId,
    originalFilename: params.filename,
    partSize: Math.max(params.size, 1),
    partCount: 1,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString()
  };
});

export function storeAttachmentPart(form: FormData) {
  const params = JSON.parse(String(form.get("params"))) as { claimId: string; partNumber: number };
  const file = claims.get(params.claimId);
  const blob = form.get("file");

  if (!file || !(blob instanceof Blob) || params.partNumber !== 1 || blob.size !== file.size) {
    throw new MockBusinessError(400, "附件分片无效");
  }

  file.blob = blob;
  return { partNumber: 1, size: blob.size };
}

defineMock<{ claimId: string }>("sys/storage", "complete_upload", ({ params }) => {
  const file = claims.get(params.claimId);

  if (!file?.blob) {
    throw new MockBusinessError(400, "附件尚未上传");
  }

  stored.set(file.key, file);
  claims.delete(params.claimId);
  return {
    key: file.key,
    originalFilename: file.originalFilename,
    size: file.size,
    contentType: file.contentType,
    lastModified: file.uploadedAt
  };
});
defineMock<{ claimId: string }>("sys/storage", "abort_upload", ({ params }) => {
  claims.delete(params.claimId);
  return null;
});
defineMock<{ keys: string[] }>("sys/storage/file", "resolve", ({ params }) => {
  const files = params.keys.flatMap(key => {
    const file = stored.get(key);
    return file
      ? [
          {
            key,
            originalFilename: file.originalFilename,
            contentType: file.contentType,
            size: file.size,
            status: "uploaded",
            uploadedAt: file.uploadedAt,
            uploadedBy: "u_1"
          }
        ]
      : [];
  });
  return { files };
});

export function getDemoAttachment(url: string) {
  const marker = "/storage/files/";
  const path = new URL(url).pathname;
  return stored.get(path.slice(path.indexOf(marker) + marker.length))?.blob;
}
