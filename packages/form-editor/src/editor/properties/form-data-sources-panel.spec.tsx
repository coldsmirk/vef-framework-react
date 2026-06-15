import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormDataSource, FormSchema } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { FormDataSourcesPanel } from "./form-data-sources-panel";

function makeSchema(dataSources: FormDataSource[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    ...dataSources.length > 0 ? { dataSources } : {},
    presentations: { pc: { children: [] } }
  };
}

interface HarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

/**
 * Mirrors the form-config drawer wiring: data sources come from the store
 * schema and updates patch them back, so the store-backed delete and the
 * onChange path stay in sync.
 */
function Harness({ onReady }: HarnessProps): ReactElement {
  const api = useFormEditorStoreApi();
  const dataSources = useFormEditorStore(state => state.schema.dataSources);

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return (
    <FormDataSourcesPanel
      dataSources={dataSources ?? []}
      onChange={next => api.getState().patchSchema({ dataSources: next.length > 0 ? next : undefined })}
    />
  );
}

function setup(dataSources: FormDataSource[] = []): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema: makeSchema(dataSources) }}>
      <Harness
        onReady={api => {
          captured = api;
        }}
      />
    </FormEditorStoreProvider>
  );

  if (!captured) {
    throw new Error("Form store API was not captured");
  }

  return captured;
}

function storeSources(api: FormEditorStoreApi): FormDataSource[] {
  return api.getState().schema.dataSources ?? [];
}

function staticSource(): FormDataSource {
  return {
    id: "ds1",
    name: "城市",
    kind: "static",
    options: [{ label: "北京", value: "bj" }]
  };
}

describe("form data sources panel", () => {
  it("adds a static data source", async () => {
    const user = userEvent.setup();
    const api = setup();

    await user.click(screen.getByRole("button", { name: /新增数据源/ }));

    const sources = storeSources(api);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      name: "",
      kind: "static",
      options: []
    });
  });

  it("appends an option to a static source", async () => {
    const user = userEvent.setup();
    const api = setup([staticSource()]);

    await user.click(screen.getByRole("button", { name: /添加选项/ }));

    expect(storeSources(api)[0]).toMatchObject({
      kind: "static",
      options: [{ label: "北京", value: "bj" }, { label: "", value: "" }]
    });
  });

  it("edits a remote request action", async () => {
    const user = userEvent.setup();
    const api = setup([
      {
        id: "ds2",
        name: "部门",
        kind: "remote",
        request: { resource: "org", action: "" }
      }
    ]);

    await user.type(screen.getByPlaceholderText("action"), "x");

    expect(storeSources(api)[0]).toMatchObject({ kind: "remote", request: { resource: "org", action: "x" } });
  });

  describe("kind switching", () => {
    it("switches an unconfigured source instantly, preserving its name", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "ds1",
          name: "城市",
          kind: "static",
          options: []
        }
      ]);

      await user.click(screen.getByText("远程请求"));

      expect(storeSources(api)[0]).toEqual({
        id: "ds1",
        name: "城市",
        kind: "remote",
        request: { resource: "", action: "" }
      });
    });

    it("asks for confirmation before discarding a configured source's payload", async () => {
      const user = userEvent.setup();
      const api = setup([staticSource()]);

      await user.click(screen.getByText("远程请求"));

      // Nothing changed yet — the switch waits behind the confirmation.
      expect(storeSources(api)[0]).toMatchObject({ kind: "static" });

      await user.click(await screen.findByRole("button", { name: "切 换" }));

      expect(storeSources(api)[0]).toEqual({
        id: "ds1",
        name: "城市",
        kind: "remote",
        request: { resource: "", action: "" }
      });
    });

    it("keeps the source untouched when the confirmation is cancelled", async () => {
      const user = userEvent.setup();
      const api = setup([staticSource()]);

      await user.click(screen.getByText("远程请求"));
      await user.click(await screen.findByRole("button", { name: "取 消" }));

      expect(storeSources(api)[0]).toEqual(staticSource());
    });
  });

  it("removes a data source through the store's removeDataSource", async () => {
    const user = userEvent.setup();
    const api = setup([staticSource()]);
    const removeSpy = vi.spyOn(api.getState(), "removeDataSource");

    await user.click(screen.getByRole("button", { name: "删除数据源" }));

    expect(removeSpy).toHaveBeenCalledWith("ds1");
    expect(storeSources(api)).toEqual([]);
  });
});
