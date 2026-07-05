import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../../../store/form-store";
import type { Block, ContainerNode, FieldLinkage, FormSchema, SectionNode } from "../../../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../../../store/form-store";
import { ContainerLinkageSection } from "./container-linkage-section";

const SECTION_ID = "Sec_1";

function sectionNode(linkage?: FieldLinkage): SectionNode {
  return {
    id: SECTION_ID,
    type: "section",
    variant: "card",
    title: "联系方式",
    children: [],
    ...linkage && { linkage }
  };
}

function makeSchema(section: SectionNode, withSiblings = true): FormSchema {
  const siblings: Block[] = withSiblings
    ? [
        {
          id: "Field_amount",
          type: "number",
          key: "amount",
          label: "金额"
        }
      ]
    : [];

  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: [...siblings, section] } }
  };
}

interface HarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

/**
 * Renders the section node read live from the store, so updateBlock commits
 * round-trip into the UI like in the real properties panel.
 */
function Harness({ onReady }: HarnessProps): ReactElement | null {
  const api = useFormEditorStoreApi();
  const node = useFormEditorStore(state => state.schema.presentations.pc.children.find(block => block.id === SECTION_ID));

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  if (!node || node.type !== "section") {
    return null;
  }

  return <ContainerLinkageSection node={node} />;
}

function setup(schema: FormSchema): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <FormEditorStoreProvider initialState={{ schema }}>
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

function storeSection(api: FormEditorStoreApi): ContainerNode {
  const node = api.getState().schema.presentations.pc.children.find(block => block.id === SECTION_ID);

  if (!node || node.type !== "section") {
    throw new Error("section node missing from the store schema");
  }

  return node;
}

function conditionShowLinkage(): FieldLinkage {
  return {
    rules: [
      {
        id: "R1",
        trigger: {
          kind: "condition",
          condition: {
            kind: "group",
            id: "G1",
            logic: "all",
            children: [
              {
                kind: "leaf",
                id: "C1",
                sourceKey: "amount",
                operator: "notEmpty"
              }
            ]
          }
        },
        actions: [{ id: "A1", type: "show" }]
      }
    ]
  };
}

describe("ContainerLinkageSection", () => {
  it("adds a condition rule seeded off a same-scope keyed field", async () => {
    const user = userEvent.setup();
    const api = setup(makeSchema(sectionNode()));

    await user.click(screen.getByRole("button", { name: /新建联动规则/ }));

    const rules = storeSection(api).linkage?.rules;
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.trigger).toMatchObject({
      kind: "condition",
      condition: { kind: "group", children: [{ kind: "leaf", sourceKey: "amount" }] }
    });
    expect(rules?.[0]?.actions?.[0]).toMatchObject({ type: "show" });
  });

  it("authors a hide-section rule by switching the action type", async () => {
    const user = userEvent.setup();
    const schema = makeSchema(sectionNode(conditionShowLinkage()));
    const api = setup(schema);

    // Combobox order on the card: trigger kind, leaf source, leaf operator,
    // then the action's type select.
    const selects = screen.getAllByRole("combobox");
    await user.click(selects[3] as HTMLElement);
    await user.click(await screen.findByText("隐藏"));

    // The action keeps its client-stable id across the type switch.
    const action = storeSection(api).linkage?.rules?.[0]?.actions?.[0];
    expect(action).toEqual({ id: "A1", type: "hide" });
  });

  it("limits container state actions to show/hide/enable/disable", async () => {
    const user = userEvent.setup();
    const schema = makeSchema(sectionNode(conditionShowLinkage()));
    setup(schema);

    const selects = screen.getAllByRole("combobox");
    await user.click(selects[3] as HTMLElement);
    await screen.findByText("隐藏");

    expect(screen.getByText("启用")).toBeInTheDocument();
    expect(screen.getByText("提示消息")).toBeInTheDocument();
    // Keyed-leaf-only state actions never appear for a container target.
    expect(screen.queryByText("设为必填")).not.toBeInTheDocument();
    expect(screen.queryByText("赋值")).not.toBeInTheDocument();
    expect(screen.queryByText("脚本")).not.toBeInTheDocument();
  });

  it("toggles the default-hidden state through updateBlock", async () => {
    const user = userEvent.setup();
    const api = setup(makeSchema(sectionNode()));

    // DefaultsPanel order: 默认隐藏 first, 默认禁用 second (必填 is omitted
    // for non-keyed targets).
    expect(screen.getByText("默认隐藏")).toBeInTheDocument();
    expect(screen.getByText("默认禁用")).toBeInTheDocument();
    expect(screen.queryByText("默认必填")).not.toBeInTheDocument();

    const [hiddenToggle] = screen.getAllByRole("switch");
    await user.click(hiddenToggle as HTMLElement);

    expect(storeSection(api).linkage).toEqual({ defaults: { hidden: true } });
  });

  it("disables rule creation when no keyed field is in scope", () => {
    setup(makeSchema(sectionNode(), false));

    expect(screen.getByRole("button", { name: /新建联动规则/ })).toBeDisabled();
    expect(screen.getByText(/当前作用域内没有可引用的字段/)).toBeInTheDocument();
  });
});
