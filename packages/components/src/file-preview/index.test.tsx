import type { PropsWithChildren, ReactElement } from "react";

import type { FilePreviewHandler } from "./types";

import { renderHook } from "../../test-utils";
import { FilePreviewProvider, useFilePreview } from "./index";

describe("file-preview/useFilePreview", () => {
  it("returns null when no provider is installed", () => {
    const { result } = renderHook(() => useFilePreview());

    expect(result.current).toBeNull();
  });

  it("returns the handler from the nearest provider", () => {
    const handler: FilePreviewHandler = { openPreview: vi.fn() };

    function Wrapper({ children }: PropsWithChildren): ReactElement {
      return <FilePreviewProvider handler={handler}>{children}</FilePreviewProvider>;
    }

    const { result } = renderHook(() => useFilePreview(), { wrapper: Wrapper });

    expect(result.current).toBe(handler);
  });
});
