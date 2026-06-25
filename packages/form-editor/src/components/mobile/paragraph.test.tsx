import type { ParagraphField } from "../../types";

import { render, screen } from "@testing-library/react";

import { MobileParagraph } from "./paragraph";

function paragraphField(overrides: Partial<ParagraphField> = {}): ParagraphField {
  return {
    id: "P",
    type: "paragraph",
    text: "说明文字",
    ...overrides
  };
}

describe("MobileParagraph", () => {
  it("renders the paragraph text", () => {
    render(<MobileParagraph domId="field-p" field={paragraphField()} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("说明文字")).toBeInTheDocument();
  });

  it("renders empty without throwing when no text is set", () => {
    expect(() => render(
      <MobileParagraph
        domId="field-p"
        field={paragraphField({ text: undefined })}
        value={undefined}
        onChange={vi.fn()}
      />
    )).not.toThrow();
  });

  it("renders without throwing when value is undefined and disabled in edit mode", () => {
    expect(() => render(
      <MobileParagraph
        disabled
        domId="field-p"
        field={paragraphField()}
        value={undefined}
        onChange={vi.fn()}
      />
    )).not.toThrow();
  });
});
