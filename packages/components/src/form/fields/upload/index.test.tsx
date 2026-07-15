import type { UploadResult } from "@vef-framework-react/core";

import type { UploadFieldProps } from "./props";

import userEvent from "@testing-library/user-event";

import { render, screen, waitFor } from "../../../../test-utils";
import { FilePreviewProvider } from "../../../file-preview";
import { FormModal } from "../../../form-modal";

interface AttachmentValues {
  attachment: string | null;
}

interface MultipleAttachmentValues {
  attachments: string[];
}

interface RenderUploadFieldOptions {
  defaultValue?: string | null;
  fieldProps?: UploadFieldProps;
  onSubmit?: (values: AttachmentValues) => void;
}

const STORAGE_KEY = "priv/2026/07/report.docx";
const OTHER_STORAGE_KEY = "priv/2026/07/budget.xlsx";
const FILE_BASE_URL = "https://files.test";
const neverSettle = Function.prototype as () => void;

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
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest's importActual type parameter requires an inline `typeof import(...)` to type the real module.
  const actual = await importActual<typeof import("@vef-framework-react/core")>();
  return {
    ...actual,
    Uploader: mocks.UploaderMock
  };
});

function buildUploader(): typeof mocks.instance {
  return mocks.instance;
}

function getFileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[type='file']");

  if (!input) {
    throw new Error("file input not rendered");
  }

  return input;
}

function resolveFileUrl(key: string): string {
  return `https://cdn.example.com/files/${key}`;
}

function resolveAlternateFileUrl(key: string): string {
  return `https://cdn-next.example.com/files/${key}`;
}

function createUploadField(
  openPreview: (target: unknown) => void,
  {
    defaultValue = STORAGE_KEY,
    fieldProps = {},
    onSubmit
  }: RenderUploadFieldOptions = {}
) {
  return (
    <FilePreviewProvider handler={{ openPreview }}>
      <FormModal<AttachmentValues>
        open
        defaultValues={{ attachment: defaultValue }}
        title="编辑附件"
        onSubmit={onSubmit}
      >
        {({ AppField }) => (
          <AppField name="attachment">
            {field => <field.Upload {...fieldProps} label="附件" />}
          </AppField>
        )}
      </FormModal>
    </FilePreviewProvider>
  );
}

function renderUploadField(
  openPreview: (target: unknown) => void,
  options: RenderUploadFieldOptions = {}
) {
  return render(
    createUploadField(openPreview, options),
    { appContext: { fileBaseUrl: FILE_BASE_URL } }
  );
}

describe("form/fields/UploadField", () => {
  beforeEach(() => {
    mocks.UploaderMock.mockReset();
    mocks.instance.start.mockReset();
    mocks.instance.abort.mockReset();
    mocks.UploaderMock.mockImplementation(buildUploader);
  });

  it("hydrates a stored key into the rendered file list", async () => {
    renderUploadField(vi.fn());

    expect(await screen.findByText("report.docx")).toBeInTheDocument();
  });

  it("dispatches a hydrated file to the preview provider with its storage key", async () => {
    const openPreview = vi.fn();
    const user = userEvent.setup();

    renderUploadField(openPreview);

    await user.click(await screen.findByText("report.docx"));

    expect(openPreview).toHaveBeenCalledTimes(1);
    expect(openPreview).toHaveBeenCalledWith(expect.objectContaining({
      filename: "report.docx",
      key: STORAGE_KEY,
      url: `${FILE_BASE_URL}/${STORAGE_KEY}`
    }));
  });

  it("uses resolveFileUrl when hydrating a stored key", async () => {
    const openPreview = vi.fn();
    const user = userEvent.setup();

    renderUploadField(openPreview, { fieldProps: { resolveFileUrl } });

    await user.click(await screen.findByText("report.docx"));

    expect(openPreview).toHaveBeenCalledWith(expect.objectContaining({
      key: STORAGE_KEY,
      url: resolveFileUrl(STORAGE_KEY)
    }));
  });

  it("updates a hydrated URL when resolveFileUrl changes for the same key", async () => {
    const openPreview = vi.fn();
    const user = userEvent.setup();
    const view = renderUploadField(openPreview, { fieldProps: { resolveFileUrl } });

    expect(await screen.findByRole("button", { name: "report.docx" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "report.docx" })).not.toBeInTheDocument();

    view.rerender(createUploadField(openPreview, {
      fieldProps: { resolveFileUrl: resolveAlternateFileUrl }
    }));

    await user.click(screen.getByRole("button", { name: "report.docx" }));
    expect(openPreview).toHaveBeenCalledWith(expect.objectContaining({
      key: STORAGE_KEY,
      url: resolveAlternateFileUrl(STORAGE_KEY)
    }));
  });

  it("preserves completed upload metadata when the field value synchronizes", async () => {
    const result: UploadResult = {
      bucket: "uploads",
      key: STORAGE_KEY,
      eTag: "etag",
      size: 7,
      contentType: "application/pdf",
      lastModified: "2026-07-15T00:00:00Z",
      originalFilename: "original-report.pdf"
    };
    mocks.instance.start.mockResolvedValue(result);
    const onUploadSuccess = vi.fn();
    const onSubmit = vi.fn();
    const openPreview = vi.fn();
    const user = userEvent.setup();
    const file = new File(["content"], "report.pdf", { type: "application/pdf" });

    renderUploadField(openPreview, {
      defaultValue: null,
      fieldProps: {
        maxCount: 1,
        resolveFileUrl,
        onUploadSuccess
      },
      onSubmit
    });

    await user.upload(getFileInput(), file);
    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /提\s*交/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ attachment: STORAGE_KEY }));
    expect(screen.queryByRole("link", { name: "report.pdf" })).not.toBeInTheDocument();
    await user.click(await screen.findByText("report.pdf"));

    expect(openPreview).toHaveBeenCalledWith({
      filename: "original-report.pdf",
      contentType: "application/pdf",
      size: file.size,
      file,
      key: STORAGE_KEY,
      url: resolveFileUrl(STORAGE_KEY)
    });
  });

  it("replaces completed entries when the external field value changes", async () => {
    const openPreview = vi.fn();
    const user = userEvent.setup();

    render(
      <FilePreviewProvider handler={{ openPreview }}>
        <FormModal<AttachmentValues>
          open
          defaultValues={{ attachment: STORAGE_KEY }}
          title="编辑附件"
        >
          {({ AppField, setFieldValue }) => (
            <>
              <AppField name="attachment">
                {field => <field.Upload label="附件" resolveFileUrl={resolveFileUrl} />}
              </AppField>

              <button type="button" onClick={() => setFieldValue("attachment", OTHER_STORAGE_KEY)}>替换附件</button>
            </>
          )}
        </FormModal>
      </FilePreviewProvider>
    );

    await user.click(screen.getByRole("button", { name: "替换附件" }));

    expect(await screen.findByText("budget.xlsx")).toBeInTheDocument();

    await user.click(screen.getByText("budget.xlsx"));
    expect(openPreview).toHaveBeenCalledWith(expect.objectContaining({
      key: OTHER_STORAGE_KEY,
      url: resolveFileUrl(OTHER_STORAGE_KEY)
    }));
  });

  it("preserves an uploading entry when the external field value changes", async () => {
    mocks.instance.start.mockReturnValue(new Promise<UploadResult>(neverSettle));
    const user = userEvent.setup();

    render(
      <FormModal<MultipleAttachmentValues>
        open
        defaultValues={{ attachments: [STORAGE_KEY] }}
        title="编辑附件"
      >
        {({ AppField, setFieldValue }) => (
          <>
            <AppField name="attachments">
              {field => <field.Upload label="附件" maxCount={3} />}
            </AppField>

            <button
              type="button"
              onClick={() => setFieldValue("attachments", [OTHER_STORAGE_KEY])}
            >
              替换附件
            </button>
          </>
        )}
      </FormModal>
    );

    await user.upload(getFileInput(), new File(["draft"], "draft.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("draft.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "替换附件" }));

    expect(await screen.findByText("budget.xlsx")).toBeInTheDocument();
    expect(screen.getByText("draft.pdf")).toBeInTheDocument();
  });
});
