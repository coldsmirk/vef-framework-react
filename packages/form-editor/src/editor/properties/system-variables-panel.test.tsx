import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema, LinkageContextSource } from "../../types";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { useFormEditorStoreApi } from "../../store/form-store";
import { FormEditor } from "../form-editor";

const SOURCES: LinkageContextSource[] = [
  { key: "$applicant.departmentId", label: "发起人部门 ID" },
  { key: "$applicant.name", label: "发起人姓名" }
];

/**
 * A finance-only field: hidden unless the applicant belongs to dept-finance.
 */
function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "budget",
            label: "预算",
            linkage: {
              defaults: { hidden: true },
              rules: [
                {
                  id: "Rule_1",
                  trigger: {
                    kind: "condition",
                    condition: {
                      kind: "leaf",
                      sourceKey: "$applicant.departmentId",
                      operator: "eq",
                      value: "dept-finance"
                    }
                  },
                  actions: [{ type: "show" }]
                }
              ]
            }
          }
        ]
      }
    }
  };
}

function setupEditor(contextSources?: LinkageContextSource[]): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  function Harness(): ReactElement {
    const api = useFormEditorStoreApi();

    useEffect(() => {
      api.getState().setFormConfigTab("variables");
      storeApi = api;
    }, [api]);

    return (
      <FormEditor.Shell>
        <FormEditor.Workspace>
          <FormEditor.Stage />
        </FormEditor.Workspace>
      </FormEditor.Shell>
    );
  }

  render(
    <FormEditor.Provider contextSources={contextSources} initialSchema={makeSchema()}>
      <Harness />
    </FormEditor.Provider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

describe("SystemVariablesPanel", () => {
  it("lists every declared system variable with its path", async () => {
    setupEditor(SOURCES);

    expect(await screen.findByText("系统变量")).toBeInTheDocument();
    expect(screen.getByText("发起人部门 ID")).toBeInTheDocument();
    expect(screen.getAllByText("$applicant.name").length).toBeGreaterThan(0);
  });

  it("lists the form's own variables before the system variables", async () => {
    setupEditor(SOURCES);

    const formVariables = await screen.findByText("表单变量");
    const systemVariables = screen.getByText("系统变量");

    expect(formVariables.compareDocumentPosition(systemVariables) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the variables tab a plain form-variable list without declared sources", async () => {
    setupEditor();

    expect(await screen.findByText(/暂无变量/)).toBeInTheDocument();
    expect(screen.queryByText("系统变量")).not.toBeInTheDocument();
  });

  describe("when a preview sample is entered", () => {
    it("evaluates the preview against the sample", async () => {
      const user = userEvent.setup();
      const storeApi = setupEditor(SOURCES);

      await user.type(await screen.findByRole("textbox", { name: "发起人部门 ID的预览值" }), "dept-finance{Enter}");

      act(() => {
        storeApi.getState().setViewMode("preview");
      });

      expect(screen.getByRole("textbox", { name: "预算" })).toBeInTheDocument();
    });

    it("stops applying a cleared sample", async () => {
      const user = userEvent.setup();
      const storeApi = setupEditor(SOURCES);
      const input = await screen.findByRole("textbox", { name: "发起人部门 ID的预览值" });

      await user.type(input, "dept-finance{Enter}");
      await user.clear(input);
      await user.keyboard("{Enter}");

      act(() => {
        storeApi.getState().setViewMode("preview");
      });

      expect(screen.queryByRole("textbox", { name: "预算" })).not.toBeInTheDocument();
    });
  });

  it("leaves the preview without the field when no sample matches", async () => {
    const storeApi = setupEditor(SOURCES);

    await screen.findByText("系统变量");

    act(() => {
      storeApi.getState().setViewMode("preview");
    });

    expect(screen.queryByRole("textbox", { name: "预算" })).not.toBeInTheDocument();
  });
});
