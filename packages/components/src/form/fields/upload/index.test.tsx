import userEvent from "@testing-library/user-event";

import { render, screen } from "../../../../test-utils";
import { FilePreviewProvider } from "../../../file-preview";
import { FormModal } from "../../../form-modal";

interface AttachmentValues {
  attachment: string;
}

const STORAGE_KEY = "priv/2026/07/report.docx";
const FILE_BASE_URL = "https://files.test";

function renderUploadField(openPreview: (target: unknown) => void) {
  return render(
    <FilePreviewProvider handler={{ openPreview }}>
      <FormModal<AttachmentValues>
        open
        defaultValues={{ attachment: STORAGE_KEY }}
        title="编辑附件"
      >
        {({ AppField }) => (
          <AppField name="attachment">
            {field => <field.Upload label="附件" />}
          </AppField>
        )}
      </FormModal>
    </FilePreviewProvider>,
    { appContext: { fileBaseUrl: FILE_BASE_URL } }
  );
}

describe("form/fields/UploadField", () => {
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
});
