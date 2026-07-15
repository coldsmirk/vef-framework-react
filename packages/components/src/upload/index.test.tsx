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

    it("dispatches a typed PDF even when AntD generated an image thumbnail", async () => {
      const openPreview = vi.fn();
      const user = userEvent.setup();
      const file = makeDoneFile({
        type: "application/pdf",
        url: "https://files.test/object/42",
        thumbUrl: "data:image/png;base64,AAAA"
      });

      render(
        <FilePreviewProvider handler={{ openPreview }}>
          <Upload fileList={[file]} />
        </FilePreviewProvider>
      );

      await user.click(screen.getByText("report.docx"));

      expect(openPreview).toHaveBeenCalledTimes(1);
    });

    it("keeps custom isImageUrl limited to AntD thumbnail rendering", async () => {
      const openPreview = vi.fn();
      const user = userEvent.setup();
      const file = makeDoneFile({
        type: "application/pdf",
        name: "report.pdf",
        url: "https://files.test/object/42"
      });

      render(
        <FilePreviewProvider handler={{ openPreview }}>
          <Upload fileList={[file]} isImageUrl={() => true} />
        </FilePreviewProvider>
      );

      await user.click(screen.getByText("report.pdf"));

      expect(openPreview).toHaveBeenCalledTimes(1);
    });

    it("does not open a private storage URL when the provider declines the target", async () => {
      const openSpy = vi.spyOn(globalThis, "open").mockImplementation(() => null);
      const openPreview = vi.fn();
      const canPreview = vi.fn(() => false);
      const user = userEvent.setup();
      const file = makeDoneFile({ url: "https://files.test/priv/report.docx" }) as UploadFile & Partial<UploadedFileMeta>;
      file.key = "priv/2026/07/report.docx";

      render(
        <FilePreviewProvider handler={{ canPreview, openPreview }}>
          <Upload fileList={[file]} />
        </FilePreviewProvider>
      );

      await user.click(screen.getByText("report.docx"));

      expect(canPreview).toHaveBeenCalledTimes(1);
      expect(openPreview).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
      expect(await screen.findByText("该文件暂不支持预览")).toBeInTheDocument();
    });

    it("warns instead of opening a URL when no provider is installed", async () => {
      const openSpy = vi.spyOn(globalThis, "open").mockImplementation(() => null);
      const user = userEvent.setup();

      render(<Upload fileList={[makeDoneFile({ url: "https://files.test/public/report.docx" })]} />);

      await user.click(screen.getByText("report.docx"));

      expect(openSpy).not.toHaveBeenCalled();
      expect(await screen.findByText("该文件暂不支持预览")).toBeInTheDocument();
    });

    it("does not expose the source URL as a native middle-click target", async () => {
      const openSpy = vi.spyOn(globalThis, "open").mockImplementation(() => null);
      const user = userEvent.setup();

      render(<Upload fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]} />);

      const filename = screen.getByText("report.docx");
      expect(filename.closest("a")).toBeNull();

      await user.pointer([{ keys: "[MouseMiddle]", target: filename }]);

      expect(openSpy).not.toHaveBeenCalled();
    });

    it("does not expose the source URL in picture-card links", () => {
      const sourceUrl = "https://files.test/priv/report.docx";

      render(<Upload fileList={[makeDoneFile({ url: sourceUrl })]} listType="picture-card" />);

      const sourceLinks = screen.queryAllByRole("link").filter(link => link.getAttribute("href") === sourceUrl);
      expect(sourceLinks).toHaveLength(0);
      expect(screen.getByRole("button", { name: "report.docx" })).toBeInTheDocument();
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
      expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({
        url: "https://files.test/priv/report.docx"
      }));
      expect(openPreview).not.toHaveBeenCalled();
    });

    it("warns instead of using AntD's URL download fallback", async () => {
      const openSpy = vi.spyOn(globalThis, "open").mockImplementation(() => null);
      const user = userEvent.setup();

      render(
        <Upload
          fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]}
          showUploadList={{ showDownloadIcon: true }}
        />
      );

      await user.click(screen.getByTitle("下载文件"));

      expect(openSpy).not.toHaveBeenCalled();
      expect(await screen.findByText("该文件暂不支持下载")).toBeInTheDocument();
    });

    it("restores the original URL for an explicit onDownload", async () => {
      const onDownload = vi.fn();
      const user = userEvent.setup();

      render(
        <Upload
          fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]}
          showUploadList={{ showDownloadIcon: true }}
          onDownload={onDownload}
        />
      );

      await user.click(screen.getByTitle("下载文件"));

      expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({
        url: "https://files.test/priv/report.docx"
      }));
    });

    it("restores the original URL for an explicit onChange", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Upload
          fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]}
          onChange={onChange}
        />
      );

      await user.click(screen.getByTitle("删除文件"));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        file: expect.objectContaining({
          url: "https://files.test/priv/report.docx"
        })
      }));
    });

    it("restores the original URL for iconRender", () => {
      const iconRender = vi.fn(() => null);

      render(
        <Upload
          fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]}
          iconRender={iconRender}
        />
      );

      expect(iconRender).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://files.test/priv/report.docx" }),
        "text"
      );
    });

    it("restores the original URL for itemRender", () => {
      const itemRender = vi.fn(originNode => originNode);

      render(
        <Upload
          fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]}
          itemRender={itemRender}
        />
      );

      expect(itemRender).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ url: "https://files.test/priv/report.docx" }),
        [expect.objectContaining({ url: "https://files.test/priv/report.docx" })],
        expect.anything()
      );
    });

    it("restores the original URL for showUploadList callbacks", () => {
      const showRemoveIcon = vi.fn(() => true);

      render(
        <Upload
          fileList={[makeDoneFile({ url: "https://files.test/priv/report.docx" })]}
          showUploadList={{ showRemoveIcon }}
        />
      );

      expect(showRemoveIcon).toHaveBeenCalledWith(expect.objectContaining({
        url: "https://files.test/priv/report.docx"
      }));
    });
  });
});
