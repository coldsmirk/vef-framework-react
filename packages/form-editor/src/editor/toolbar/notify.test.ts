import { confirmDialog, notify } from "./notify";

const silence = Function.prototype as () => void;

interface VefMock {
  message: {
    success: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  modal: {
    confirm: ReturnType<typeof vi.fn>;
  };
}

/**
 * Install a `$vef` global mock (the per-app antd context holders normally set
 * by `<ConfigProvider>`), mirroring `preview-effects.spec.ts`.
 */
function installVefGlobal(): VefMock {
  const vef: VefMock = {
    message: {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn()
    },
    modal: {
      confirm: vi.fn()
    }
  };

  vi.stubGlobal("$vef", vef);

  return vef;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("notify", () => {
  describe("when $vef is present", () => {
    it("routes success to $vef.message.success", () => {
      const vef = installVefGlobal();

      notify("success", "已保存");

      expect(vef.message.success).toHaveBeenCalledWith("已保存");
      expect(vef.message.error).not.toHaveBeenCalled();
    });

    it("routes warning to $vef.message.warning", () => {
      const vef = installVefGlobal();

      notify("warning", "存在警告");

      expect(vef.message.warning).toHaveBeenCalledWith("存在警告");
    });

    it("routes error to $vef.message.error", () => {
      const vef = installVefGlobal();

      notify("error", "失败了");

      expect(vef.message.error).toHaveBeenCalledWith("失败了");
    });
  });

  describe("when $vef is absent", () => {
    it("does not throw for a success notification and logs it", () => {
      const info = vi.spyOn(console, "info").mockImplementation(silence);

      expect(() => notify("success", "已保存")).not.toThrow();
      expect(info).toHaveBeenCalledWith("[form-editor]", "已保存");
    });

    it("does not throw for a warning notification and logs it", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(silence);

      expect(() => notify("warning", "存在警告")).not.toThrow();
      expect(warn).toHaveBeenCalledWith("[form-editor]", "存在警告");
    });

    it("falls back to console.error and alert for an error notification", () => {
      const error = vi.spyOn(console, "error").mockImplementation(silence);
      const alert = vi.spyOn(globalThis, "alert").mockImplementation(silence);

      expect(() => notify("error", "失败了")).not.toThrow();
      expect(error).toHaveBeenCalledWith("[form-editor]", "失败了");
      expect(alert).toHaveBeenCalledWith("失败了");
    });
  });
});

describe("confirmDialog", () => {
  describe("when $vef is present", () => {
    it("opens a danger confirm carrying the title and content", () => {
      const vef = installVefGlobal();
      const onOk = vi.fn();

      confirmDialog("确认清空？", "该操作可撤销。", { onOk });

      expect(vef.modal.confirm).toHaveBeenCalledWith(expect.objectContaining({
        title: "确认清空？",
        content: "该操作可撤销。",
        okType: "danger",
        onOk
      }));
      expect(onOk).not.toHaveBeenCalled();
    });
  });

  describe("when $vef is absent", () => {
    it("runs the callback when the native confirm is accepted", () => {
      vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      const onOk = vi.fn();

      confirmDialog("确认清空？", "该操作可撤销。", { onOk });

      expect(onOk).toHaveBeenCalledTimes(1);
    });

    it("skips the callback when the native confirm is rejected", () => {
      vi.spyOn(globalThis, "confirm").mockReturnValue(false);
      const onOk = vi.fn();

      confirmDialog("确认清空？", "该操作可撤销。", { onOk });

      expect(onOk).not.toHaveBeenCalled();
    });

    it("falls back to the plain-text detail for a rich content body", () => {
      const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      const onOk = vi.fn();

      // A ReactNode content cannot be shown natively; `detail` carries its
      // substance so the question is never reduced to the bare title.
      confirmDialog("删除该控件将影响联动规则", { rich: true } as never, {
        onOk,
        detail: "将同时移除 2 条引用它的联动规则"
      });

      expect(confirm).toHaveBeenCalledWith("删除该控件将影响联动规则\n\n将同时移除 2 条引用它的联动规则");
      expect(onOk).toHaveBeenCalledTimes(1);
    });
  });
});
