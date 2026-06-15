import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { PalettePanel } from "./palette-panel";

interface PalettePanelHarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

function PalettePanelHarness({ onReady }: PalettePanelHarnessProps): ReactElement {
  const api = useFormEditorStoreApi();

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return <PalettePanel />;
}

function getStoreApi(storeApi: FormEditorStoreApi | null): FormEditorStoreApi {
  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

function setupPalettePanel(): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{}}>
      <RegistryProvider registries={{ pc: createDefaultRegistry(), mobile: createDefaultRegistry() }}>
        <PalettePanelHarness onReady={nextApi => {
          storeApi = nextApi;
        }}
        />
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  return getStoreApi(storeApi);
}

describe("PalettePanel", () => {
  it("hides in preview mode without resetting local search state", async () => {
    const user = userEvent.setup();
    const storeApi = setupPalettePanel();

    expect(screen.getByRole("complementary", { name: "组件库" })).not.toBeNull();

    const searchInput = screen.getByPlaceholderText("搜索组件…");

    await user.type(searchInput, "文本");

    expect(searchInput).toHaveValue("文本");

    act(() => {
      storeApi.getState().setViewMode("preview");
    });

    expect(screen.queryByRole("complementary", { name: "组件库" })).toBeNull();

    act(() => {
      storeApi.getState().setViewMode("edit");
    });

    expect(screen.getByRole("complementary", { name: "组件库" })).not.toBeNull();
    expect(screen.getByPlaceholderText("搜索组件…")).toHaveValue("文本");
  });

  describe("search", () => {
    it("filters items to the keyword and forces matching groups open", async () => {
      const user = userEvent.setup();
      setupPalettePanel();

      await user.type(screen.getByPlaceholderText("搜索组件…"), "文本框");

      expect(screen.getByRole("button", { name: "文本框" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "数字" })).not.toBeInTheDocument();
    });

    it("matches by type id as well as display name", async () => {
      const user = userEvent.setup();
      setupPalettePanel();

      await user.type(screen.getByPlaceholderText("搜索组件…"), "textarea");

      expect(screen.getByRole("button", { name: "多行文本" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "文本框" })).not.toBeInTheDocument();
    });

    it("shows the empty state when nothing matches", async () => {
      const user = userEvent.setup();
      setupPalettePanel();

      await user.type(screen.getByPlaceholderText("搜索组件…"), "zzzz");

      expect(screen.getByText("没有匹配的组件")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "文本框" })).not.toBeInTheDocument();
    });
  });
});
