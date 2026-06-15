import type { UploadResult } from "@vef-framework-react/core";

import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "../../test-utils";
import { FileUpload } from "./index";

// ──────────────────────────────────────────────────────────────────────────
// Mock the `Uploader` class at the package boundary. file-upload owns ~14
// lines of glue (construct uploader, await start, patch metadata, forward
// callbacks); the upload state machine itself is exhaustively covered by
// `core/storage/uploader.spec.ts`, so this spec stops at the boundary.
// ──────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  return {
    UploaderMock: vi.fn(),
    instance: {
      start: vi.fn(),
      abort: vi.fn()
    }
  };
});

vi.mock("@vef-framework-react/core", async importActual => {
  const actual = await importActual<typeof import("@vef-framework-react/core")>();
  return {
    ...actual,
    Uploader: mocks.UploaderMock
  };
});

function getFileInput(): HTMLInputElement {
  // antd's Upload renders an unlabeled, visually hidden file input. There is
  // no public selector for it, so reach for it via document.querySelector.
  // eslint-disable-next-line testing-library/no-node-access
  const input = document.querySelector<HTMLInputElement>("input[type='file']");

  if (!input) {
    throw new Error("file input not rendered");
  }

  return input;
}

// Function.prototype is a no-op callable — lets us produce a never-settling
// promise without tripping the empty-arrow-function lint rule.
const neverSettle = Function.prototype as () => void;

function cdnResolveFileUrl(key: string): string {
  return `https://cdn.example.com/${key}`;
}

// Vitest mocks invoked with `new` require an implementation that has
// `[[Construct]]`. Arrow functions don't (and lint auto-fixes `function ()` to
// arrow in inline positions), so we hand it a named function declaration.
function buildUploader(): typeof mocks.instance {
  return mocks.instance;
}

const SAMPLE_RESULT: UploadResult = {
  bucket: "uploads",
  key: "priv/2026/05/12/abc.png",
  eTag: "etag",
  size: 1,
  contentType: "image/png",
  lastModified: "2026-05-12T00:00:00Z",
  originalFilename: "selfie.png"
};

describe("file-upload/FileUpload", () => {
  beforeEach(() => {
    mocks.UploaderMock.mockReset();
    mocks.instance.start.mockReset();
    mocks.instance.abort.mockReset();
    mocks.UploaderMock.mockImplementation(buildUploader);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("default rendering", () => {
    it("renders the default upload button with the '上传' label", () => {
      render(<FileUpload />);

      expect(screen.getByRole("button", { name: /上\s*传/ })).toBeInTheDocument();
    });

    it("renders custom children in place of the default button", () => {
      render(
        <FileUpload>
          <button data-testid="custom-upload-trigger" type="button">点我上传</button>
        </FileUpload>
      );

      expect(screen.getByTestId("custom-upload-trigger")).toBeInTheDocument();
      // Default "上传" button should no longer appear once children override the trigger.
      expect(screen.queryByRole("button", { name: /^上传$/ })).not.toBeInTheDocument();
    });
  });

  describe("max-count gating", () => {
    it("disables the default upload button when fileList already meets maxCount", () => {
      const existingFile = {
        uid: "1",
        name: "existing.png",
        status: "done" as const
      };

      render(<FileUpload fileList={[existingFile]} maxCount={1} />);

      expect(screen.getByRole("button", { name: /上\s*传/ })).toBeDisabled();
    });

    it("keeps the upload button enabled while fileList is below maxCount", () => {
      render(<FileUpload maxCount={3} />);

      expect(screen.getByRole("button", { name: /上\s*传/ })).toBeEnabled();
    });
  });

  describe("picture-card listType", () => {
    it("hides the trigger entirely once maxCount is reached in picture-card mode", () => {
      const existingFile = {
        uid: "1",
        name: "existing.png",
        status: "done" as const
      };

      render(
        <FileUpload fileList={[existingFile]} listType="picture-card" maxCount={1} />
      );

      expect(screen.queryByRole("button", { name: /上\s*传/ })).not.toBeInTheDocument();
    });
  });

  describe("uploader integration", () => {
    it("instantiates an Uploader with the configured apiPath/resource/version and file metadata", async () => {
      // Never settle — we only inspect the constructor call here.
      mocks.instance.start.mockReturnValue(new Promise<UploadResult>(neverSettle));
      const user = userEvent.setup();

      render(<FileUpload apiPath="storage/upload" resource="avatar" version="v2" />);

      const file = new File(["x"], "selfie.png", { type: "image/png" });
      await user.upload(getFileInput(), file);

      expect(mocks.UploaderMock).toHaveBeenCalledTimes(1);
      const [, fileArg, options] = mocks.UploaderMock.mock.calls[0] as unknown as [
        unknown,
        File,
        {
          apiPath?: string;
          resource?: string;
          version?: string;
          init?: { filename?: string; contentType?: string };
        }
      ];
      expect(fileArg).toBe(file);
      expect(options).toMatchObject({
        apiPath: "storage/upload",
        resource: "avatar",
        version: "v2",
        init: {
          filename: "selfie.png",
          contentType: "image/png"
        }
      });
    });

    it("forwards onUploadSuccess and patches the file with storage metadata after start resolves", async () => {
      mocks.instance.start.mockResolvedValue(SAMPLE_RESULT);
      const onUploadSuccess = vi.fn();
      const user = userEvent.setup();

      render(<FileUpload onUploadSuccess={onUploadSuccess} />);

      const file = new File(["x"], "selfie.png", { type: "image/png" });
      await user.upload(getFileInput(), file);

      await waitFor(() => {
        expect(onUploadSuccess).toHaveBeenCalledTimes(1);
      });

      const [patchedFile, returnedResult] = onUploadSuccess.mock.calls[0] as unknown as [
        File & { key: string; url: string; fileName: string },
        UploadResult
      ];
      expect(returnedResult).toBe(SAMPLE_RESULT);
      expect(patchedFile.key).toBe("priv/2026/05/12/abc.png");
      expect(patchedFile.fileName).toBe("selfie.png");
    });

    it("invokes onUploadError when start rejects", async () => {
      const failure = {
        code: "boom",
        message: "upload failed",
        originalError: new Error("boom")
      };
      mocks.instance.start.mockRejectedValue(failure);
      const onUploadError = vi.fn();
      const user = userEvent.setup();

      render(<FileUpload onUploadError={onUploadError} />);

      const file = new File(["x"], "selfie.png", { type: "image/png" });
      await user.upload(getFileInput(), file);

      await waitFor(() => {
        expect(onUploadError).toHaveBeenCalledTimes(1);
      });
      const [erroredFile, errorArg] = onUploadError.mock.calls[0] as unknown as [File, typeof failure];
      expect(erroredFile.name).toBe("selfie.png");
      expect(errorArg).toBe(failure);
    });

    it("applies a custom resolveFileUrl when computing the patched url", async () => {
      mocks.instance.start.mockResolvedValue(SAMPLE_RESULT);
      const onUploadSuccess = vi.fn();
      const user = userEvent.setup();

      render(<FileUpload resolveFileUrl={cdnResolveFileUrl} onUploadSuccess={onUploadSuccess} />);

      const file = new File(["x"], "selfie.png", { type: "image/png" });
      await user.upload(getFileInput(), file);

      await waitFor(() => {
        expect(onUploadSuccess).toHaveBeenCalledTimes(1);
      });
      const [patchedFile] = onUploadSuccess.mock.calls[0] as unknown as [File & { url: string }];
      expect(patchedFile.url).toBe("https://cdn.example.com/priv/2026/05/12/abc.png");
    });
  });
});
