import type { ApiClient, AppContext, DataOption } from "@vef-framework-react/core";
import type { ReactNode } from "react";

import type { Block, CodeSetQueryFn, FormSchema, RadioField, SubformNode } from "../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiClientProvider, AppContextProvider, createApiClient } from "@vef-framework-react/core";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

const DICTIONARIES: Record<string, DataOption[]> = {
  "sys.gender": [
    { label: "男", value: "M" },
    { label: "女", value: "F" }
  ],
  "sys.level": [{ label: "高级", value: "senior" }],
  "sys.region": [
    {
      label: "华东",
      value: "east",
      children: [{ label: "上海", value: "sh" }]
    }
  ]
};

function createTestApiClient(): ApiClient {
  return createApiClient({
    // eslint-disable-next-line unicorn/prefer-https -- non-routable test host; plain HTTP avoids needless TLS setup in tests
    http: { baseUrl: "http://vef-test.invalid" }
  });
}

/**
 * A code-set query function over {@link DICTIONARIES}, with the batches it was
 * asked for recorded in `load`.
 */
function createCodeSetQueryFn(apiClient: ApiClient, key = "test/code-set"): { queryFn: CodeSetQueryFn; load: ReturnType<typeof vi.fn> } {
  const load = vi.fn((codeSets: string[]) => Object.fromEntries(codeSets.map(codeSet => [codeSet, DICTIONARIES[codeSet] ?? []])));
  const queryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(key, () => load);

  return { queryFn, load };
}

function radio(key: string, codeSet: string): RadioField {
  return {
    id: `Field_${key}`,
    type: "radio",
    key,
    label: key,
    dataSource: { kind: "codeSet", codeSet }
  };
}

function stack(...children: Block[]): FormSchema {
  return {
    id: "Form_code_sets",
    version: 2,
    presentations: { pc: { children } }
  };
}

function renderForm(form: ReactNode, { apiClient, appContext = {} }: { apiClient?: ApiClient; appContext?: AppContext } = {}): void {
  const registry = createDefaultRegistry();
  const content = <RegistryProvider registries={{ pc: registry, mobile: registry }}>{form}</RegistryProvider>;

  render(
    <AppContextProvider value={appContext}>
      {apiClient === undefined ? content : <ApiClientProvider value={apiClient}>{content}</ApiClientProvider>}
    </AppContextProvider>
  );
}

describe("FormRenderer code sets", () => {
  it("offers a dictionary's entries as a field's options", async () => {
    const apiClient = createTestApiClient();
    const { queryFn } = createCodeSetQueryFn(apiClient);

    renderForm(<FormRenderer schema={stack(radio("gender", "sys.gender"))} />, { apiClient, appContext: { codeSetQueryFn: queryFn } });

    expect(await screen.findByRole("radio", { name: "男" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "女" })).toBeInTheDocument();
  });

  it("loads every dictionary the form reads in one call", async () => {
    const apiClient = createTestApiClient();
    const { queryFn, load } = createCodeSetQueryFn(apiClient);
    const lines: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      template: [radio("lineRegion", "sys.region")]
    };

    renderForm(
      <FormRenderer schema={stack(radio("level", "sys.level"), radio("gender", "sys.gender"), lines)} />,
      { apiClient, appContext: { codeSetQueryFn: queryFn } }
    );

    expect(await screen.findByRole("radio", { name: "高级" })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0]).toEqual(["sys.gender", "sys.level", "sys.region"]);
  });

  it("offers only a tree dictionary's top-level entries", async () => {
    const apiClient = createTestApiClient();
    const { queryFn } = createCodeSetQueryFn(apiClient);

    renderForm(<FormRenderer schema={stack(radio("region", "sys.region"))} />, { apiClient, appContext: { codeSetQueryFn: queryFn } });

    expect(await screen.findByRole("radio", { name: "华东" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "上海" })).not.toBeInTheDocument();
  });

  it("prefers its own codeSetQueryFn over the application's", async () => {
    const apiClient = createTestApiClient();
    const application = createCodeSetQueryFn(apiClient, "test/app-code-set");
    const own = createCodeSetQueryFn(apiClient, "test/own-code-set");

    renderForm(
      <FormRenderer codeSetQueryFn={own.queryFn} schema={stack(radio("gender", "sys.gender"))} />,
      { apiClient, appContext: { codeSetQueryFn: application.queryFn } }
    );

    expect(await screen.findByRole("radio", { name: "男" })).toBeInTheDocument();
    expect(own.load).toHaveBeenCalledTimes(1);
    expect(application.load).not.toHaveBeenCalled();
  });

  it("serves a dictionary the application already loaded from the cache", async () => {
    const apiClient = createTestApiClient();
    const { queryFn, load } = createCodeSetQueryFn(apiClient);

    await apiClient.fetchQuery({ queryKey: [queryFn.key, ["sys.gender"]], queryFn });
    load.mockClear();

    renderForm(<FormRenderer schema={stack(radio("gender", "sys.gender"))} />, { apiClient, appContext: { codeSetQueryFn: queryFn } });

    expect(await screen.findByRole("radio", { name: "男" })).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it("offers a dictionary's entries in a table subform column", async () => {
    const user = userEvent.setup();
    const apiClient = createTestApiClient();
    const { queryFn } = createCodeSetQueryFn(apiClient);
    const lines: SubformNode = {
      id: "Subform_lines",
      type: "subform",
      variant: "table",
      key: "lines",
      label: "明细",
      template: [radio("gender", "sys.gender")]
    };

    renderForm(<FormRenderer schema={stack(lines)} />, { apiClient, appContext: { codeSetQueryFn: queryFn } });

    await user.click(screen.getByRole("button", { name: /新增记录/ }));

    expect(await screen.findByRole("radio", { name: "男" })).toBeInTheDocument();
  });

  describe("when no code-set query function is available", () => {
    it("renders the field without options", async () => {
      renderForm(<FormRenderer schema={stack(radio("gender", "sys.gender"))} />);

      expect(await screen.findByText("gender")).toBeInTheDocument();
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    });
  });
});
