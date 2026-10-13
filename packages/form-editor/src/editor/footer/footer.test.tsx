import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";
import type { SchemaValidator } from "../host-validation";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { HostValidationProvider } from "../host-validation";
import { EditorFooter } from "./footer";

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    variables: [
      {
        id: "Var_1",
        name: "flag",
        type: "boolean"
      }
    ],
    presentations: {
      pc: {
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "name",
            label: "姓名"
          }
        ]
      }
    }
  };
}

function setupFooter(schema: FormSchema = makeSchema(), validate?: SchemaValidator): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  function Harness(): ReactElement {
    const api = useFormEditorStoreApi();

    useEffect(() => {
      storeApi = api;
    }, [api]);

    return <EditorFooter />;
  }

  render(
    <FormEditorStoreProvider initialState={{ schema }}>
      <RegistryProvider registries={{ pc: createDefaultRegistry(), mobile: createDefaultRegistry() }}>
        <HostValidationProvider validate={validate}>
          <Harness />
        </HostValidationProvider>
      </RegistryProvider>
    </FormEditorStoreProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
}

/**
 * One field-level rule (on 姓名, watching a key that exists) plus one
 * form-level event rule — the 联动 pill must aggregate both.
 */
function linkageSchema(): FormSchema {
  const schema = makeSchema();

  schema.presentations.pc.children.push({
    id: "Field_2",
    type: "textfield",
    key: "age",
    label: "年龄",
    linkage: {
      rules: [
        {
          id: "Rule_field",
          trigger: {
            kind: "condition",
            condition: {
              kind: "group",
              id: "Cond_g",
              logic: "all",
              children: [
                {
                  kind: "leaf",
                  id: "Cond_l",
                  sourceKey: "name",
                  operator: "eq",
                  value: "1"
                }
              ]
            }
          },
          actions: [{ id: "Action_show", type: "show" }]
        }
      ]
    }
  });
  schema.linkage = {
    rules: [
      {
        id: "Rule_form",
        trigger: { kind: "load" },
        actions: [
          {
            id: "Action_alert",
            type: "alert",
            level: "info",
            message: { kind: "literal", value: "hi" }
          }
        ]
      }
    ]
  };

  return schema;
}

/**
 * The base schema plus a default-hidden field with no show rule — the
 * canonical warning, located on that field's node.
 */
function ghostSchema(): FormSchema {
  const schema = makeSchema();

  schema.presentations.pc.children.push({
    id: "Field_hidden",
    type: "textfield",
    key: "ghost",
    label: "幽灵",
    linkage: { defaults: { hidden: true }, rules: [] }
  });

  return schema;
}

/**
 * A host check rejecting the field keyed `name`, addressed by field key.
 */
const rejectName: SchemaValidator = () => [
  {
    path: "name",
    code: "host_rejected",
    severity: "error",
    message: "审批表单不支持该字段"
  }
];

describe("EditorFooter", () => {
  it("shows the field and variable counts", () => {
    setupFooter();

    expect(within(screen.getByRole("button", { name: /字段/ })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /变量/ })).getByText("1")).toBeInTheDocument();
  });

  it("aggregates field-level and form-level rules into the 联动 count", () => {
    setupFooter(linkageSchema());

    expect(within(screen.getByRole("button", { name: /联动/ })).getByText("2")).toBeInTheDocument();
  });

  it("renders no issues chip for a clean schema", () => {
    setupFooter();

    expect(screen.queryByTestId("footer-issues")).not.toBeInTheDocument();
  });

  it("surfaces schema warnings as an issues chip", () => {
    const schema = makeSchema();

    // A default-hidden field with no show rule is the canonical warning.
    schema.presentations.pc.children.push({
      id: "Field_hidden",
      type: "textfield",
      key: "ghost",
      label: "幽灵",
      linkage: { defaults: { hidden: true }, rules: [] }
    });

    setupFooter(schema);

    expect(screen.getByTestId("footer-issues")).toHaveTextContent("1 项提示");
  });

  describe("when the issues chip is opened", () => {
    it("lists every issue", async () => {
      const user = userEvent.setup();
      setupFooter(ghostSchema());

      await user.click(screen.getByTestId("footer-issues"));

      expect(await screen.findByText(/默认隐藏但没有任何「显示」动作的规则/)).toBeInTheDocument();
    });

    it("says where an issue is by the name the designer gave it", async () => {
      const user = userEvent.setup();
      setupFooter(ghostSchema());

      await user.click(screen.getByTestId("footer-issues"));

      expect(await screen.findByText("幽灵")).toHaveAttribute("title", "node[Field_hidden].linkage.defaults.hidden");
    });

    it("names a data-source issue by the source's name", async () => {
      const user = userEvent.setup();
      setupFooter({
        ...makeSchema(),
        dataSources: [
          {
            id: "DataSource_1",
            name: "部门",
            kind: "remote",
            request: { resource: "", action: "" }
          }
        ]
      });

      await user.click(screen.getByTestId("footer-issues"));

      expect(await screen.findByText("数据源「部门」")).toBeInTheDocument();
    });

    it("selects the node an issue is about when the issue is clicked", async () => {
      const user = userEvent.setup();
      const storeApi = setupFooter(ghostSchema());

      await user.click(screen.getByTestId("footer-issues"));
      await user.click(await screen.findByRole("button", { name: /默认隐藏/ }));

      expect(storeApi.getState().selectedId).toBe("Field_hidden");
    });

    it("opens the data-source tab for a data-source issue", async () => {
      const user = userEvent.setup();
      const storeApi = setupFooter({
        ...makeSchema(),
        dataSources: [
          {
            id: "DataSource_1",
            name: "部门",
            kind: "remote",
            request: { resource: "", action: "" }
          }
        ]
      });

      await user.click(screen.getByTestId("footer-issues"));
      await user.click(await screen.findByRole("button", { name: /请求尚未配置完整/ }));

      expect(storeApi.getState().formConfigOpen).toBe(true);
      expect(storeApi.getState().formConfigTab).toBe("dataSources");
    });
  });

  describe("when the host validates the schema", () => {
    it("counts the host's issues as the schema's own", () => {
      setupFooter(makeSchema(), rejectName);

      expect(screen.getByTestId("footer-issues")).toHaveTextContent("1 项问题");
    });

    it("locates a host issue addressed by field key", async () => {
      const user = userEvent.setup();
      const storeApi = setupFooter(makeSchema(), rejectName);

      await user.click(screen.getByTestId("footer-issues"));
      await user.click(await screen.findByRole("button", { name: /审批表单不支持该字段/ }));

      expect(storeApi.getState().selectedId).toBe("Field_1");
    });

    it("never hands the host a schema with structural errors", () => {
      const validate = vi.fn<SchemaValidator>(() => []);
      const schema = makeSchema();

      // A second field reusing the key "name" is a duplicate-key error.
      schema.presentations.pc.children.push({ ...schema.presentations.pc.children[0]!, id: "Field_dup" });
      setupFooter(schema, validate);

      expect(validate).not.toHaveBeenCalledWith(schema);
    });
  });

  it("opens the drawer to a tab when a count pill is clicked", async () => {
    const user = userEvent.setup();
    const storeApi = setupFooter();

    await user.click(screen.getByRole("button", { name: /变量/ }));

    expect(storeApi.getState().formConfigOpen).toBe(true);
    expect(storeApi.getState().formConfigTab).toBe("variables");
  });

  it("toggles the drawer with the form-config switch", async () => {
    const user = userEvent.setup();
    const storeApi = setupFooter();

    await user.click(screen.getByRole("button", { name: /表单配置/ }));
    expect(storeApi.getState().formConfigOpen).toBe(true);

    await user.click(screen.getByRole("button", { name: /表单配置/ }));
    expect(storeApi.getState().formConfigOpen).toBe(false);
  });
});
