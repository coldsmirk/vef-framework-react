import { createPreviewServices } from "./preview-effects";

interface MessageMock {
  info: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

function installVefMessage(): MessageMock {
  const message: MessageMock = {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  };

  vi.stubGlobal("$vef", { message });

  return message;
}

describe("createPreviewServices", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces navigate with an informational preview toast", () => {
    const message = installVefMessage();
    const hostNavigate = vi.fn();
    const preview = createPreviewServices({ navigate: hostNavigate });

    preview.navigate?.("/orders/42");

    expect(hostNavigate).not.toHaveBeenCalled();
    expect(message.info).toHaveBeenCalledWith(expect.stringContaining("/orders/42"), expect.anything());
  });

  it("routes the preview navigate toast through a custom notify service when provided", () => {
    const notify = vi.fn();
    const preview = createPreviewServices({ notify });

    preview.navigate?.("/orders/42");

    expect(notify).toHaveBeenCalledWith("info", expect.stringContaining("/orders/42"));
  });

  it("preserves the host request service for live execution in preview", () => {
    const request = vi.fn().mockResolvedValue([]);
    const preview = createPreviewServices({ request });

    expect(preview.request).toBe(request);
  });

  it("leaves request undefined when the host did not wire one", () => {
    const preview = createPreviewServices();

    expect(preview.request).toBeUndefined();
  });
});
