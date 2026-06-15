import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { codeEditorDefinition } from "../../components/code-editor";
import { textfieldDefinition } from "../../components/textfield";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { PaletteGroup } from "./palette-group";

interface RenderPaletteGroupResult {
  storeApi: ReturnType<typeof useFormEditorStoreApi>;
}

function StoreCapture({ onReady }: { onReady: (storeApi: ReturnType<typeof useFormEditorStoreApi>) => void }) {
  const storeApi = useFormEditorStoreApi();

  // Calling the callback during render would be a render side effect (and
  // double-fires under StrictMode); commit-time is the contract.
  useEffect(() => {
    onReady(storeApi);
  }, [onReady, storeApi]);

  return null;
}

function renderPaletteGroup(forceOpen?: boolean): RenderPaletteGroupResult {
  let storeApi: ReturnType<typeof useFormEditorStoreApi> | null = null;

  render(
    <FormEditorStoreProvider initialState={{}}>
      <StoreCapture onReady={api => {
        storeApi = api;
      }}
      />

      <PaletteGroup
        definitions={[textfieldDefinition, codeEditorDefinition]}
        forceOpen={forceOpen}
        group="basic-input"
      />
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return { storeApi };
}

describe("PaletteGroup", () => {
  it("uses local open state when forceOpen is false", async () => {
    const user = userEvent.setup();

    renderPaletteGroup(false);

    const header = screen.getByRole("button", { name: /基础输入/ });

    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "文本框" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "代码编辑器" })).not.toBeNull();

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryByRole("button", { name: "文本框" })).toBeNull());

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "文本框" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "代码编辑器" })).not.toBeNull();
  });

  it("stays open while forceOpen is true", async () => {
    const user = userEvent.setup();

    renderPaletteGroup(true);

    const header = screen.getByRole("button", { name: /基础输入/ });

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "文本框" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "代码编辑器" })).not.toBeNull();
  });

  it("exposes each tile as a non-native button so the whole card stays draggable", () => {
    renderPaletteGroup(true);

    const tile = screen.getByRole("button", { name: "文本框" });

    // A native <button> root makes dnd-kit's pointer sensor suppress drag
    // activation on the card's children — it runs target.closest("button"), so
    // only the bare padding stayed draggable. The card must carry button
    // semantics via role without being a real <button>.
    expect(tile.tagName).not.toBe("BUTTON");
    expect(tile).toHaveAttribute("role", "button");
  });

  it("appends a code editor as a new block at the end", async () => {
    const user = userEvent.setup();
    const { storeApi } = renderPaletteGroup(false);

    await user.dblClick(screen.getByRole("button", { name: "代码编辑器" }));

    const { children } = storeApi.getState().schema.presentations.pc;
    expect(children).toHaveLength(1);
    // The minted key is the sanitized type discriminator — the raw
    // "code-editor" would fail the validator's key charset.
    expect(children[0]).toMatchObject({ type: "code-editor", key: "codeeditor" });
  });

  it("appends a field with the Enter key", async () => {
    const user = userEvent.setup();
    const { storeApi } = renderPaletteGroup(false);

    screen.getByRole("button", { name: "文本框" }).focus();
    await user.keyboard("{Enter}");

    const { children } = storeApi.getState().schema.presentations.pc;
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: "textfield", key: "textfield" });
  });

  it("appends a field with the Space key", async () => {
    const user = userEvent.setup();
    const { storeApi } = renderPaletteGroup(false);

    screen.getByRole("button", { name: "文本框" }).focus();
    await user.keyboard(" ");

    const { children } = storeApi.getState().schema.presentations.pc;
    expect(children).toHaveLength(1);
  });
});
