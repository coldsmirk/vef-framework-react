import type { UploadFile } from "antd";

import type { UploadedFileMeta } from "./props";

import userEvent from "@testing-library/user-event";

import { render, screen } from "../../test-utils";
import { FilePreviewProvider } from "../file-preview";
import { Upload } from "./index";

function makeDoneFile(overrides: Partial<UploadFile> = {}): UploadFile {
  return {
    uid: "1",
    name: "report.docx",
    status: "done",
    ...overrides
  };
}

describe("upload/Upload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("preview dispatch", () => {
    it("dispatches a non-image file to the preview provider as a normalized target", async () => {
      const openPreview = vi.fn();
      const user = userEvent.setup();
      const file = makeDoneFile({ url: "https://files.test/priv/report.docx" }) as UploadFile & Partial<UploadedFileMeta>;
      file.key = "priv/2026/07/report.docx";
      file.fileName = "original-report.docx";

      render(
        <FilePreviewProvider handler={{ openPreview }}>
          <Upload fileList={[file]} />
        </FilePreviewProvider>
      );

      await user.click(screen.getByText("report.docx"));

      expect(openPreview).toHaveBeenCalledTimes(1);
      expect(openPreview).toHaveBeenCalledWith({
        filename: "original-report.docx",
        contentType: undefined,
        size: undefined,
        file: undefined,
        key: "priv/2026/07/report.docx",
        url: "https://files.test/priv/report.docx"
      });
    });

    it("falls back to opening the URL when the provider declines the target", async () => {
      const openSpy = vi.spyOn(globalThis, "open").mockImplementation(() => null);
      const openPreview = vi.fn();
      const canPreview = vi.fn(() => false);
      const user = userEvent.setup();

      render(
        <FilePreviewProvider handler={{ canPreview, openPreview }}>
          <Upload fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]} />
        </FilePreviewProvider>
      );

      await user.click(screen.getByText("report.docx"));

      expect(canPreview).toHaveBeenCalledTimes(1);
      expect(openPreview).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith("https://files.test/priv/report.docx", "_blank", "noopener");
    });

    it("opens the file URL in a new tab when no provider is installed", async () => {
      const openSpy = vi.spyOn(globalThis, "open").mockImplementation(() => null);
      const user = userEvent.setup();

      render(<Upload fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]} />);

      await user.click(screen.getByText("report.docx"));

      expect(openSpy).toHaveBeenCalledWith("https://files.test/priv/report.docx", "_blank", "noopener");
    });

    it("warns when the file cannot be previewed anywhere", async () => {
      const openSpy = vi.spyOn(globalThis, "open").mockImplementation(() => null);
      const user = userEvent.setup();

      render(<Upload fileList={[makeDoneFile()]} />);

      await user.click(screen.getByText("report.docx"));

      expect(await screen.findByText("该文件暂不支持预览")).toBeInTheDocument();
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("keeps image files in the built-in image preview", async () => {
      const openPreview = vi.fn();
      const user = userEvent.setup();

      render(
        <FilePreviewProvider handler={{ openPreview }}>
          <Upload fileList={[makeDoneFile({ name: "photo.png", url: "https://files.test/pub/photo.png" })]} />
        </FilePreviewProvider>
      );

      await user.click(screen.getByText("photo.png"));

      expect(openPreview).not.toHaveBeenCalled();
    });

    it("lets an explicit onPreview override the whole chain", async () => {
      const onPreview = vi.fn();
      const openPreview = vi.fn();
      const user = userEvent.setup();
      const file = makeDoneFile({ url: "https://files.test/priv/report.docx" });

      render(
        <FilePreviewProvider handler={{ openPreview }}>
          <Upload fileList={[file]} onPreview={onPreview} />
        </FilePreviewProvider>
      );

      await user.click(screen.getByText("report.docx"));

      expect(onPreview).toHaveBeenCalledTimes(1);
      expect(openPreview).not.toHaveBeenCalled();
    });
  });
});
