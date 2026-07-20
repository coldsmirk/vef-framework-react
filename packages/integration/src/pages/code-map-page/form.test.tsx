import type { ApiClient } from "@vef-framework-react/core";

import type { CodeCatalog, CodeSetCatalog, System } from "../../types";
import type { CodeMapFormValues } from "./model";

import userEvent from "@testing-library/user-event";
import { useForm } from "@vef-framework-react/components";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, render, screen, waitFor, within } from "../../../../components/test-utils";
import { CodeMapForm } from "./form";

const DEFAULT_VALUES: CodeMapFormValues = {
  codeSet: "",
  entries: [],
  fallbackCanonical: "",
  fallbackExternal: "",
  isEnabled: true,
  name: "",
  onUnmapped: "reject",
  systemId: ""
};

function listSystems(): System[] {
  return [];
}

function createSystemQuery(): typeof listSystems {
  return listSystems;
}

function listUnsupportedCodes(): CodeCatalog {
  return { supported: false };
}

function createUnsupportedCodesQuery(): typeof listUnsupportedCodes {
  return listUnsupportedCodes;
}

function createCatalogApiClient(loadCatalog: () => CodeSetCatalog | Promise<CodeSetCatalog>): ApiClient {
  const apiClient = createTestApiClient();
  const systemQuery = apiClient.createQueryFn<System[], object>("integration_system_find_all", createSystemQuery);
  const codeSetsQuery = apiClient.createQueryFn<CodeSetCatalog, object>(
    "integration_code_set_list_code_sets",
    () => loadCatalog
  );
  const codesQuery = apiClient.createQueryFn<CodeCatalog, { codeSet: string }>(
    "integration_code_set_list_codes",
    createUnsupportedCodesQuery
  );

  vi.spyOn(apiClient, "createQueryFn").mockImplementation(key => {
    switch (key) {
      case "integration_system_find_all": {
        return systemQuery as never;
      }

      case "integration_code_set_list_code_sets": {
        return codeSetsQuery as never;
      }

      case "integration_code_set_list_codes": {
        return codesQuery as never;
      }

      default: {
        throw new Error(`Unexpected query function: ${key}`);
      }
    }
  });

  return apiClient;
}

function FormHarness({ scene, values }: { scene: "create" | "update"; values?: Partial<CodeMapFormValues> }) {
  const form = useForm({ defaultValues: { ...DEFAULT_VALUES, ...values } });

  return (
    <form.AppForm>
      <form.Form layout="vertical">
        <CodeMapForm scene={scene} />
      </form.Form>
    </form.AppForm>
  );
}

function renderForm(
  scene: "create" | "update",
  loadCatalog: () => CodeSetCatalog | Promise<CodeSetCatalog>,
  values?: Partial<CodeMapFormValues>
): void {
  render(<FormHarness scene={scene} values={values} />, { apiClient: createCatalogApiClient(loadCatalog) });
}

interface FormFieldElements {
  item: HTMLElement;
  label: HTMLElement;
}

async function findFormField(labelText: string): Promise<FormFieldElements> {
  const label = await screen.findByText(labelText, { selector: "label" });
  const item = label.closest<HTMLElement>(".vef-form-item");

  if (!item) {
    throw new Error(`Form item not found for label: ${labelText}`);
  }

  return { item, label };
}

describe("CodeMapForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when creating", () => {
    it("selects a required standard code set and fills its name", async () => {
      renderForm("create", () => {
        return {
          codeSets: [{ codeSet: "gender", name: "性别" }],
          supported: true
        };
      });
      const user = userEvent.setup();

      const codeSetField = await findFormField("标准码集");
      const codeSetSelect = within(codeSetField.item).getByRole("combobox");
      expect(codeSetField.label).toHaveClass("vef-form-item-required");
      expect(screen.queryByText("码集标识", { selector: "label" })).not.toBeInTheDocument();

      await user.click(codeSetSelect);
      await user.click(await screen.findByText("性别（gender）"));
      expect(codeSetSelect).toHaveAttribute("aria-expanded", "false");
      expect(within(codeSetField.item).getByTitle("性别（gender）")).toBeInTheDocument();

      const nameField = await findFormField("码表名称");
      await waitFor(() => expect(within(nameField.item).getByRole("textbox")).toHaveValue("性别"));
    });

    it("keeps the required standard code set select when the supported catalog is empty", async () => {
      const catalog: CodeSetCatalog = { codeSets: [], supported: true };
      renderForm("create", () => catalog);

      const codeSetField = await findFormField("标准码集");
      expect(within(codeSetField.item).getByRole("combobox")).toBeInTheDocument();
      expect(codeSetField.label).toHaveClass("vef-form-item-required");
      expect(screen.queryByText("码集标识", { selector: "label" })).not.toBeInTheDocument();
    });

    it("falls back to a required code set input only when the catalog is unsupported", async () => {
      const catalog: CodeSetCatalog = { supported: false };
      renderForm("create", () => catalog);

      const codeSetField = await findFormField("码集标识");
      expect(within(codeSetField.item).getByRole("textbox")).toBeInTheDocument();
      expect(codeSetField.label).toHaveClass("vef-form-item-required");
      expect(screen.queryByText("标准码集", { selector: "label" })).not.toBeInTheDocument();
    });

    it("does not expose free text while the catalog is loading", async () => {
      const catalog = Promise.withResolvers<CodeSetCatalog>();
      renderForm("create", () => catalog.promise);

      const codeSetField = await findFormField("标准码集");
      const codeSetSelect = within(codeSetField.item).getByRole("combobox");
      expect(codeSetSelect).toBeDisabled();
      expect(screen.queryByText("码集标识", { selector: "label" })).not.toBeInTheDocument();

      catalog.resolve({ codeSets: [], supported: true });
      await waitFor(() => expect(codeSetSelect).toBeEnabled());
    });

    it("shows a disabled error select instead of free text when the catalog load fails", async () => {
      renderForm("create", () => {
        throw new Error("catalog unavailable");
      });

      const codeSetField = await findFormField("标准码集");
      const codeSetSelect = within(codeSetField.item).getByRole("combobox");
      await screen.findByText("标准码集加载失败，请稍后重试");
      expect(codeSetSelect).toBeDisabled();
      expect(screen.queryByText("码集标识", { selector: "label" })).not.toBeInTheDocument();
    });
  });

  describe("when updating", () => {
    it("keeps the code set as a disabled input", async () => {
      const catalog: CodeSetCatalog = {
        codeSets: [{ codeSet: "gender", name: "性别" }],
        supported: true
      };
      renderForm("update", () => catalog, { codeSet: "gender", name: "性别" });

      const codeSetField = await findFormField("码集标识");
      const codeSetInput = within(codeSetField.item).getByRole("textbox");
      expect(codeSetInput).toBeDisabled();
      expect(codeSetInput).toHaveValue("gender");
      expect(screen.queryByText("标准码集", { selector: "label" })).not.toBeInTheDocument();
    });
  });
});
