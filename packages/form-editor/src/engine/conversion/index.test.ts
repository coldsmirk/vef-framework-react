import type { BlockConversion, ConversionContext } from ".";
import type {
  Block,
  CodeEditorField,
  FlexNode,
  GridNode,
  NumberField,
  PresentationLayer,
  SectionNode,
  SelectField,
  StaticOptionSource,
  SubformNode,
  TabsNode,
  TextfieldField
} from "../../types";

import { ConversionRegistry, convertPresentation, createDefaultConversionRules } from ".";
import { sectionDefinition } from "../../components/containers";
import { textareaFieldDefinition } from "../../components/textarea-field";
import { textfieldDefinition } from "../../components/textfield";
import { createDefaultRegistry } from "../registry/defaults";
import { FormFieldRegistry } from "../registry/form-field-registry";
import { collectNodeIds } from "../schema/walk";

function textfield(id: string, key: string, span?: number): TextfieldField {
  return {
    id,
    type: "textfield",
    key,
    label: key,
    span
  };
}

function number(id: string, key: string, label: string): NumberField {
  return {
    id,
    type: "number",
    key,
    label
  };
}

function codeEditor(id: string, key: string): CodeEditorField {
  return {
    id,
    type: "code-editor",
    key,
    label: key
  };
}

function grid(id: string, cells: Block[]): GridNode {
  return {
    id,
    type: "grid",
    children: cells
  };
}

function section(id: string, children: Block[]): SectionNode {
  return {
    id,
    type: "section",
    variant: "card",
    title: "Card",
    children
  };
}

function layerOf(blocks: Block[]): PresentationLayer {
  return { children: blocks };
}

/**
 * A mobile target missing most field types: only textfield / textarea are
 * registered, so everything else has "no mobile equivalent".
 */
function partialTarget(): FormFieldRegistry {
  const registry = new FormFieldRegistry();
  registry.register(textfieldDefinition);
  registry.register(textareaFieldDefinition);
  return registry;
}

const rules = createDefaultConversionRules();

describe("convertPresentation", () => {
  describe("leaf fields", () => {
    it("keeps a field the mobile registry has, preserving its key", () => {
      const { layer } = convertPresentation(layerOf([textfield("f1", "name", 12)]), rules, createDefaultRegistry());

      expect(layer.children[0]).toMatchObject({ type: "textfield", key: "name" });
    });

    it("strips the column span so the block fills its mobile slot", () => {
      const { layer } = convertPresentation(layerOf([textfield("f1", "name", 12)]), rules, createDefaultRegistry());

      expect(layer.children[0]?.span).toBeUndefined();
    });

    it("regenerates node ids so the mobile tree owns an independent id space", () => {
      const { layer } = convertPresentation(layerOf([textfield("f1", "name")]), rules, createDefaultRegistry());

      expect(layer.children[0]?.id).not.toBe("f1");
    });

    it("drops a field type the mobile registry lacks", () => {
      const { layer, report } = convertPresentation(layerOf([number("n1", "age", "Age")]), rules, partialTarget());

      expect(layer.children).toHaveLength(0);
      expect(report.dropped).toEqual([
        {
          sourceType: "number",
          reason: "移动端无对应组件",
          label: "Age"
        }
      ]);
    });
  });

  describe("code editor", () => {
    it("degrades to a textarea, preserving the keyed binding", () => {
      const { layer } = convertPresentation(layerOf([codeEditor("c1", "notes")]), rules, createDefaultRegistry());

      expect(layer.children[0]).toMatchObject({ type: "textarea", key: "notes" });
    });

    it("drops the code editor when the mobile registry has no textarea", () => {
      const target = new FormFieldRegistry();
      target.register(textfieldDefinition);

      const { layer, report } = convertPresentation(layerOf([codeEditor("c1", "notes")]), rules, target);

      expect(layer.children).toHaveLength(0);
      expect(report.dropped[0]?.sourceType).toBe("code-editor");
    });
  });

  describe("layout containers", () => {
    it("unwraps a grid into a single-column stack of blocks", () => {
      const pc = layerOf([grid("g1", [textfield("a", "a"), textfield("b", "b")])]);

      const { layer } = convertPresentation(pc, rules, createDefaultRegistry());

      expect(layer.children).toHaveLength(2);
      expect(layer.children.map(block => block.type)).toEqual(["textfield", "textfield"]);
    });

    it("keeps a section shell and converts its body", () => {
      const pc = layerOf([section("s1", [textfield("a", "a")])]);

      const { layer } = convertPresentation(pc, rules, createDefaultRegistry());

      expect(layer.children[0]).toMatchObject({
        type: "section",
        children: [{ type: "textfield", key: "a" }]
      });
    });

    it("unwraps a flex container into inline blocks", () => {
      const flex: FlexNode = {
        id: "x1",
        type: "flex",
        children: [textfield("a", "a"), textfield("b", "b")]
      };

      const { layer } = convertPresentation(layerOf([flex]), rules, createDefaultRegistry());

      expect(layer.children.map(block => block.type)).toEqual(["textfield", "textfield"]);
    });
  });

  describe("structural containers", () => {
    it("converts each tab body and keeps the tabs shell", () => {
      const tabs: TabsNode = {
        id: "t1",
        type: "tabs",
        tabs: [
          {
            id: "tab1",
            label: "One",
            children: [textfield("a", "a", 12)]
          },
          {
            id: "tab2",
            label: "Two",
            children: [textfield("b", "b", 6)]
          }
        ]
      };

      const { layer } = convertPresentation(layerOf([tabs]), rules, createDefaultRegistry());
      const converted = layer.children[0] as TabsNode;

      expect(converted.type).toBe("tabs");
      expect(converted.tabs.map(tab => tab.label)).toEqual(["One", "Two"]);
      expect(converted.tabs[0]?.children[0]).toMatchObject({ type: "textfield", key: "a" });
      expect(converted.tabs[1]?.children[0]).toMatchObject({ type: "textfield", key: "b" });
      expect(converted.tabs[1]?.children[0]?.span).toBeUndefined();
    });

    it("converts a subform template and preserves its key", () => {
      const subform: SubformNode = {
        id: "sf",
        type: "subform",
        variant: "stack",
        key: "lines",
        template: [textfield("a", "amount", 12)]
      };

      const { layer } = convertPresentation(layerOf([subform]), rules, createDefaultRegistry());
      const converted = layer.children[0] as SubformNode;

      expect(converted).toMatchObject({ type: "subform", key: "lines" });
      expect(converted.template[0]).toMatchObject({ type: "textfield", key: "amount" });
      expect(converted.template[0]?.span).toBeUndefined();
    });
  });

  describe("id and rule identity", () => {
    it("regenerates every nested node id while preserving keys", () => {
      const pcSection = section("s1", [textfield("a", "name")]);
      const { layer } = convertPresentation(layerOf([pcSection]), rules, createDefaultRegistry());
      const mobileSection = layer.children[0] as SectionNode;
      const pcIds = collectNodeIds(pcSection);

      for (const id of collectNodeIds(mobileSection)) {
        expect(pcIds.has(id)).toBe(false);
      }

      expect(mobileSection.children[0]).toMatchObject({ type: "textfield", key: "name" });
    });

    it("mints fresh linkage rule ids for the mobile tree", () => {
      const field = textfield("a", "name");

      field.linkage = {
        rules: [
          {
            id: "Rule_1",
            trigger: { kind: "change" },
            actions: [{ type: "hide" }]
          }
        ]
      };

      const { layer } = convertPresentation(layerOf([field]), rules, createDefaultRegistry());

      expect(layer.children[0]?.linkage?.rules?.[0]?.id).not.toBe("Rule_1");
    });
  });

  describe("layer carry-over", () => {
    it("preserves the form-level gap preset", () => {
      const pc: PresentationLayer = { gap: "large", children: [textfield("a", "name")] };

      const { layer } = convertPresentation(pc, rules, createDefaultRegistry());

      expect(layer.gap).toBe("large");
    });

    it("writes no gap key when the source layer has none", () => {
      const { layer } = convertPresentation(layerOf([textfield("a", "name")]), rules, createDefaultRegistry());

      expect(layer).not.toHaveProperty("gap");
    });
  });

  describe("report", () => {
    it("counts every kept block in convertedCount, including nested ones", () => {
      const pc = layerOf([section("s1", [textfield("a", "a"), textfield("b", "b")])]);

      const { report } = convertPresentation(pc, rules, createDefaultRegistry());

      expect(report.convertedCount).toBe(3);
    });

    it("does not count an unwrapped layout container, only its cells", () => {
      const pc = layerOf([grid("g1", [textfield("a", "a"), textfield("b", "b")])]);

      const { report } = convertPresentation(pc, rules, createDefaultRegistry());

      expect(report.convertedCount).toBe(2);
    });

    it("reports the linkage an unwrapped layout container loses", () => {
      const gridWithRule: GridNode = {
        ...grid("g1", [textfield("a", "a")]),
        linkage: {
          rules: [
            {
              id: "r1",
              trigger: {
                kind: "condition",
                condition: {
                  kind: "leaf",
                  sourceKey: "a",
                  operator: "empty"
                }
              },
              actions: [{ type: "hide" }]
            }
          ]
        }
      };

      const { layer, report } = convertPresentation(layerOf([gridWithRule]), rules, createDefaultRegistry());

      // The body still converts…
      expect(layer.children.map(block => block.type)).toEqual(["textfield"]);
      // …but the container's own rules had no surviving node — the report
      // must say so instead of presenting a clean conversion.
      expect(report.dropped).toContainEqual(expect.objectContaining({ sourceType: "grid" }));
    });

    it("stays silent for an unwrapped container without linkage", () => {
      const pc = layerOf([grid("g1", [textfield("a", "a")])]);

      const { report } = convertPresentation(pc, rules, createDefaultRegistry());

      expect(report.dropped).toEqual([]);
    });
  });

  describe("identity fallback for containers", () => {
    it("recurses a kept container's body when no container rule is registered", () => {
      const emptyRules = new ConversionRegistry();
      const pc = layerOf([section("s1", [textfield("a", "a", 12)])]);

      const { layer } = convertPresentation(pc, emptyRules, createDefaultRegistry());
      const converted = layer.children[0] as SectionNode;

      expect(converted.type).toBe("section");
      expect(converted.children[0]).toMatchObject({ type: "textfield", key: "a" });
      expect(converted.children[0]?.span).toBeUndefined();
    });

    it("drops a body block the target registry lacks even under the identity fallback", () => {
      const target = new FormFieldRegistry();
      target.register(sectionDefinition);
      target.register(textfieldDefinition);

      const emptyRules = new ConversionRegistry();
      const pc = layerOf([section("s1", [number("n1", "age", "Age")])]);

      const { layer, report } = convertPresentation(pc, emptyRules, target);
      const converted = layer.children[0] as SectionNode;

      expect(converted.children).toHaveLength(0);
      expect(report.dropped[0]).toMatchObject({ sourceType: "number", label: "Age" });
    });
  });

  describe("pc / mobile isolation", () => {
    it("shares no options array between the pc tree and the converted mobile tree", () => {
      const select: SelectField = {
        id: "sel1",
        type: "select",
        key: "city",
        label: "City",
        dataSource: { kind: "static", options: [{ label: "A", value: "a" }] }
      };

      const { layer } = convertPresentation(layerOf([select]), rules, createDefaultRegistry());
      const mobileSelect = layer.children[0] as SelectField;
      const pcOptions = (select.dataSource as StaticOptionSource).options;
      const mobileOptions = (mobileSelect.dataSource as StaticOptionSource).options;

      pcOptions.push({ label: "B", value: "b" });

      expect(mobileOptions).not.toBe(pcOptions);
      expect(mobileOptions).toHaveLength(1);
    });
  });

  // Proves the public extension seam (ConversionRegistry + BlockConversionRule +
  // BlockConversion + ConversionContext) a custom-field author uses to teach the
  // converter about their own types — the same model as FormFieldRegistry.
  describe("custom rules (extension seam)", () => {
    it("uses a registered custom rule instead of the default identity fallback", () => {
      // A custom-field author registers a conversion alongside their field; here
      // `number` degrades to a textfield rather than being dropped.
      const customRules = new ConversionRegistry().register({
        type: "number",
        convert: (source): BlockConversion => {
          if (source.type !== "number") {
            return {
              status: "dropped",
              sourceType: source.type,
              reason: "unexpected"
            };
          }

          return {
            status: "converted",
            block: {
              id: source.id,
              type: "textfield",
              key: source.key,
              label: source.label
            }
          };
        }
      });

      const { layer, report } = convertPresentation(layerOf([number("n1", "age", "Age")]), customRules, partialTarget());

      expect(layer.children[0]).toMatchObject({ type: "textfield", key: "age" });
      expect(report.dropped).toHaveLength(0);
    });

    it("hands the rule a ConversionContext whose convertBlocks recurses the body", () => {
      const customRules = new ConversionRegistry().register({
        type: "section",
        convert: (source, ctx: ConversionContext): BlockConversion => { return { status: "unwrapped", blocks: ctx.convertBlocks(source.type === "section" ? source.children : []) }; }
      });

      const pc = layerOf([section("s1", [textfield("a", "a")])]);
      const { layer } = convertPresentation(pc, customRules, createDefaultRegistry());

      // The section unwrapped through ctx.convertBlocks; its inner field surfaced inline.
      expect(layer.children[0]).toMatchObject({ type: "textfield", key: "a" });
    });
  });
});
