import type { ValidationIssue } from "../validation";

import { createDefaultRegistry } from "../registry/defaults";
import { validateSchema } from "./validate";

const registry = createDefaultRegistry();

function validate(candidate: unknown): ReturnType<typeof validateSchema> {
  return validateSchema(candidate, { pc: registry, mobile: registry });
}

function codesOf(issues: ValidationIssue[]): string[] {
  return issues.map(issue => issue.code);
}

/**
 * Wrap a list of root blocks into a v2 form envelope (pc presentation), merging
 * any extra top-level fields (e.g. a wrong `version`) over the defaults.
 */
function schema(blocks: unknown[], extra: Record<string, unknown> = {}): unknown {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: blocks } },
    ...extra
  };
}

/**
 * A schema with a single root-level flex container, merging the given flex node
 * properties over an empty-body default.
 */
function flexSchema(flex: Record<string, unknown>): unknown {
  return schema([
    {
      id: "Flex_1",
      type: "flex",
      children: [],
      ...flex
    }
  ]);
}

/**
 * A schema with a single root-level grid container, merging the given grid node
 * properties over an empty-body default.
 */
function gridSchema(grid: Record<string, unknown>): unknown {
  return schema([
    {
      id: "Grid_1",
      type: "grid",
      children: [],
      ...grid
    }
  ]);
}

/**
 * A full-width textfield block bound to `key`.
 */
function field(id: string, key: string): unknown {
  return {
    id: `Field_${id}`,
    type: "textfield",
    key
  };
}

/**
 * A schema whose subform `lines` carries a single linkage rule with the given
 * action (the condition references a sibling root field `trigger`).
 */
function subformWithAction(action: unknown): unknown {
  return schema([
    field("t", "trigger"),
    {
      id: "Sub_1",
      type: "subform",
      variant: "stack",
      key: "lines",
      template: [field("a", "amount")],
      linkage: {
        rules: [
          {
            id: "Rule_1",
            trigger: {
              kind: "condition",
              condition: {
                kind: "leaf",
                sourceKey: "trigger",
                operator: "eq",
                value: "x"
              }
            },
            actions: [action]
          }
        ]
      }
    }
  ]);
}

/**
 * A schema whose single select field carries the given inline option source,
 * merging any extra top-level fields (e.g. declared `dataSources`).
 */
function selectWith(dataSource: unknown, extra: Record<string, unknown> = {}): unknown {
  return schema([
    {
      id: "Field_1",
      type: "select",
      key: "level",
      dataSource
    }
  ], extra);
}

/**
 * A schema whose single textfield carries the given `validate` rule object.
 */
function withValidate(validate: unknown): unknown {
  return schema([
    {
      id: "Field_1",
      type: "textfield",
      key: "name",
      validate
    }
  ]);
}

describe("validateSchema", () => {
  describe("when the schema is well-formed", () => {
    it("accepts a flat form and narrows the result", () => {
      const candidate = schema([field("1", "name")]);

      const result = validate(candidate);

      expect(result.valid).toBe(true);
      expect(result.schema).toBe(candidate);
      expect(result.issues).toEqual([]);
    });

    it("accepts an empty form and an empty container (no over-strictness)", () => {
      expect(validate(schema([])).valid).toBe(true);

      const withEmptySection = schema([
        {
          id: "Sec_1",
          type: "section",
          variant: "card",
          children: []
        }
      ]);

      expect(validate(withEmptySection).valid).toBe(true);
    });

    it("lets two subforms reuse the same template key (separate value scopes)", () => {
      const candidate = schema([
        {
          id: "Sub_a",
          type: "subform",
          variant: "stack",
          key: "a",
          template: [field("a1", "amount")]
        },
        {
          id: "Sub_b",
          type: "subform",
          variant: "stack",
          key: "b",
          template: [field("b1", "amount")]
        }
      ]);

      expect(validate(candidate).valid).toBe(true);
    });
  });

  describe("when identity is violated", () => {
    it("rejects a duplicate node id", () => {
      const candidate = schema([
        {
          id: "dup",
          type: "textfield",
          key: "a"
        },
        {
          id: "dup",
          type: "textfield",
          key: "b"
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "duplicate_id",
        path: "presentations.pc.children[1].id",
        severity: "error"
      }));
    });

    it("rejects two sibling fields binding the same key in one scope", () => {
      const candidate = schema([field("1", "name"), field("2", "name")]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "duplicate_key",
        path: "presentations.pc.children[1].key",
        severity: "error"
      }));
    });
  });

  describe("when a key violates the binding grammar", () => {
    it("rejects a dotted key (deep-path binding would silently lose data)", () => {
      const result = validate(schema([field("1", "user.name")]));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "key_invalid_charset",
        path: "presentations.pc.children[0].key",
        severity: "error"
      }));
    });

    it("rejects a key containing the scope separator slash", () => {
      const result = validate(schema([field("1", "a/b")]));

      expect(codesOf(result.issues)).toContain("key_invalid_charset");
    });

    it("rejects an invalid-charset subform key", () => {
      const candidate = schema([
        {
          id: "Sub_1",
          type: "subform",
          variant: "stack",
          key: "li nes",
          template: []
        }
      ]);

      expect(codesOf(validate(candidate).issues)).toContain("key_invalid_charset");
    });

    it("accepts word-character keys including digits and underscores", () => {
      expect(validate(schema([field("1", "total_2")])).valid).toBe(true);
    });
  });

  describe("when a leaf field carries a non-string display text", () => {
    it("rejects an object label (it would crash React as a child)", () => {
      const result = validate(schema([
        {
          id: "Field_1",
          type: "textfield",
          key: "name",
          label: { broken: true }
        }
      ]));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "display_text_invalid",
        path: "presentations.pc.children[0].label",
        severity: "error"
      }));
    });

    it("rejects a numeric placeholder", () => {
      const result = validate(schema([
        {
          id: "Field_1",
          type: "textfield",
          key: "name",
          placeholder: 42
        }
      ]));

      expect(codesOf(result.issues)).toContain("display_text_invalid");
    });

    it("accepts string display texts", () => {
      const candidate = schema([
        {
          id: "Field_1",
          type: "textfield",
          key: "name",
          label: "Name",
          placeholder: "Type here",
          helperText: "Hint"
        }
      ]);

      expect(validate(candidate).valid).toBe(true);
    });
  });

  describe("when a pure-layout container carries a stray key", () => {
    it("rejects a key on a section", () => {
      const candidate = schema([
        {
          id: "Sec_1",
          type: "section",
          variant: "card",
          key: "stray",
          children: []
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "stray_key_on_container",
        path: "presentations.pc.children[0].key",
        severity: "error"
      }));
    });

    it("rejects a key on a tabs container", () => {
      const candidate = schema([
        {
          id: "T_1",
          type: "tabs",
          key: "stray",
          tabs: [
            {
              id: "Tab_1",
              label: "one",
              children: []
            }
          ]
        }
      ]);

      expect(codesOf(validate(candidate).issues)).toContain("stray_key_on_container");
    });

    it("rejects a key on a flex container", () => {
      expect(codesOf(validate(flexSchema({ key: "stray" })).issues)).toContain("stray_key_on_container");
    });

    it("rejects a key on a grid container", () => {
      expect(codesOf(validate(gridSchema({ key: "stray" })).issues)).toContain("stray_key_on_container");
    });
  });

  describe("when layout invariants are violated", () => {
    it("rejects a span outside 1..24", () => {
      const candidate = schema([
        {
          id: "Field_1",
          type: "textfield",
          key: "a",
          span: 25
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "span_invalid",
        path: "presentations.pc.children[0].span"
      }));
    });

    it("rejects a non-positive column width", () => {
      const candidate = schema([
        {
          id: "Field_1",
          type: "textfield",
          key: "a",
          columnWidth: 0
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "column_width_invalid",
        path: "presentations.pc.children[0].columnWidth"
      }));
    });

    it("accepts a positive column width", () => {
      const candidate = schema([
        {
          id: "Field_1",
          type: "textfield",
          key: "a",
          columnWidth: 200
        }
      ]);

      expect(validate(candidate).valid).toBe(true);
    });

    it("rejects a legacy row node (rows are no longer part of the schema)", () => {
      const candidate = schema([
        {
          id: "Row_1",
          type: "row",
          children: []
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(codesOf(result.issues)).toContain("unknown_field_type");
    });

    it("rejects a tabs node with no tabs", () => {
      const candidate = schema([
        {
          id: "T_1",
          type: "tabs",
          tabs: []
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(codesOf(result.issues)).toContain("tabs_empty");
    });
  });

  describe("when the schema uses a flex container", () => {
    it("accepts a flex container with valid axes and a per-slot flex child", () => {
      const candidate = flexSchema({
        direction: "row",
        justify: "between",
        align: "center",
        wrap: true,
        gap: 12,
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "a",
            flex: { grow: 1, basis: "200px" }
          }
        ]
      });

      expect(validate(candidate).valid).toBe(true);
    });

    it("rejects an unknown justify value", () => {
      const result = validate(flexSchema({ justify: "sideways" }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "flex_invalid",
        path: "presentations.pc.children[0].justify"
      }));
    });

    it("rejects a negative flex grow on a child", () => {
      const candidate = flexSchema({
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "a",
            flex: { grow: -1 }
          }
        ]
      });

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "flex_invalid",
        path: "presentations.pc.children[0].children[0].flex.grow"
      }));
    });
  });

  describe("when the schema uses a grid container", () => {
    it("accepts a grid with valid columns, gaps, and cell children", () => {
      const candidate = gridSchema({
        columns: 3,
        gap: 16,
        rowGap: 8,
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "a",
            span: 2
          }
        ]
      });

      expect(validate(candidate).valid).toBe(true);
    });

    it("rejects a non-integer column count", () => {
      expect(codesOf(validate(gridSchema({ columns: 2.5 })).issues)).toContain("columns_invalid");
    });

    it("rejects a column count above the 24-column basis", () => {
      expect(codesOf(validate(gridSchema({ columns: 25 })).issues)).toContain("columns_invalid");
    });

    it("rejects a negative row gap", () => {
      const result = validate(gridSchema({ rowGap: -4 }));

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "gap_invalid",
        path: "presentations.pc.children[0].rowGap"
      }));
    });
  });

  describe("when a stacking container sets a gap", () => {
    it("accepts a section with a valid gap scale", () => {
      const candidate = schema([
        {
          id: "Sec_1",
          type: "section",
          variant: "card",
          gap: "large",
          children: []
        }
      ]);

      expect(validate(candidate).valid).toBe(true);
    });

    it("rejects a gap that is not one of the scale presets", () => {
      const candidate = schema([
        {
          id: "Sec_1",
          type: "section",
          variant: "card",
          gap: "huge",
          children: []
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "gap_invalid",
        path: "presentations.pc.children[0].gap"
      }));
    });
  });

  describe("when the envelope is wrong", () => {
    it("rejects a non-object candidate", () => {
      const result = validate("not a schema");

      expect(result.valid).toBe(false);
      expect(result.schema).toBeUndefined();
      expect(codesOf(result.issues)).toEqual(["schema_not_object"]);
    });

    it("rejects a non-2 version", () => {
      const result = validate(schema([], { version: 1 }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "version_unsupported",
        path: "version"
      }));
    });

    it("rejects a null presentations envelope without crashing", () => {
      const result = validate(schema([], { presentations: null }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "presentation_not_object",
        path: "presentations"
      }));
    });

    it("rejects a null pc layer without crashing", () => {
      const result = validate(schema([], { presentations: { pc: null } }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "presentation_not_object",
        path: "presentations.pc"
      }));
    });

    it("rejects a null block without crashing", () => {
      const result = validate(schema([null]));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "block_not_object",
        path: "presentations.pc.children[0]"
      }));
    });

    it("rejects a keyed field type with no key", () => {
      const result = validate(schema([{ id: "Field_1", type: "textfield" }]));

      expect(result.valid).toBe(false);
      expect(codesOf(result.issues)).toContain("key_required");
    });

    it("rejects a non-keyed field type that carries a key", () => {
      const candidate = schema([
        {
          id: "Field_1",
          type: "button",
          key: "stray"
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "stray_key",
        path: "presentations.pc.children[0].key"
      }));
    });

    it("rejects an unregistered field type", () => {
      const candidate = schema([
        {
          id: "Field_1",
          type: "mystery",
          key: "x"
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "unknown_field_type",
        path: "presentations.pc.children[0].type"
      }));
    });
  });

  describe("when variables are malformed", () => {
    it("rejects a non-array variables envelope (would crash derivation)", () => {
      const result = validate(schema([], { variables: {} }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "variables_invalid",
        path: "variables",
        severity: "error"
      }));
    });

    it("rejects an empty-object variable entry", () => {
      const result = validate(schema([], { variables: [{}] }));

      expect(result.valid).toBe(false);
      expect(codesOf(result.issues)).toContain("variables_invalid");
    });

    it("rejects a variable name that is not an identifier", () => {
      const result = validate(schema([], {
        variables: [
          {
            id: "v1",
            name: "bad name",
            type: "string"
          }
        ]
      }));

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "variables_invalid",
        path: "variables[0].name"
      }));
    });

    it("rejects a digit-leading variable name ($vars.123 is unparseable)", () => {
      const result = validate(schema([], {
        variables: [
          {
            id: "v1",
            name: "123",
            type: "number"
          }
        ]
      }));

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "variables_invalid",
        path: "variables[0].name"
      }));
    });

    it("accepts an underscore-leading variable name", () => {
      const result = validate(schema([], {
        variables: [
          {
            id: "v1",
            name: "_draft2",
            type: "string"
          }
        ]
      }));

      expect(result.valid).toBe(true);
    });

    it("rejects duplicate variable names", () => {
      const result = validate(schema([], {
        variables: [
          {
            id: "v1",
            name: "rate",
            type: "number"
          },
          {
            id: "v2",
            name: "rate",
            type: "string"
          }
        ]
      }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "variables_invalid",
        path: "variables[1].name"
      }));
    });

    it("rejects duplicate variable ids", () => {
      const result = validate(schema([], {
        variables: [
          {
            id: "v1",
            name: "rate",
            type: "number"
          },
          {
            id: "v1",
            name: "factor",
            type: "string"
          }
        ]
      }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "variables_invalid",
        path: "variables[1].id"
      }));
    });

    it("rejects an unknown variable type", () => {
      const result = validate(schema([], {
        variables: [
          {
            id: "v1",
            name: "rate",
            type: "decimal"
          }
        ]
      }));

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "variables_invalid",
        path: "variables[0].type"
      }));
    });

    it("accepts well-formed variables", () => {
      const result = validate(schema([], {
        variables: [
          {
            id: "v1",
            name: "rate",
            type: "number",
            defaultValue: 0.13
          }
        ]
      }));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe("when data sources are malformed", () => {
    it("rejects a non-array dataSources envelope", () => {
      const result = validate(schema([], { dataSources: 42 }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "data_sources_invalid",
        path: "dataSources",
        severity: "error"
      }));
    });

    it("rejects duplicate data source ids", () => {
      const result = validate(schema([], {
        dataSources: [
          {
            id: "ds1",
            name: "one",
            kind: "static",
            options: []
          },
          {
            id: "ds1",
            name: "two",
            kind: "static",
            options: []
          }
        ]
      }));

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "data_sources_invalid",
        path: "dataSources[1].id"
      }));
    });

    it("rejects an unknown data source kind", () => {
      const result = validate(schema([], {
        dataSources: [
          {
            id: "ds1",
            name: "one",
            kind: "graphql"
          }
        ]
      }));

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "data_sources_invalid",
        path: "dataSources[0].kind"
      }));
    });

    it("accepts well-formed static and remote data sources", () => {
      const result = validate(schema([], {
        dataSources: [
          {
            id: "ds1",
            name: "levels",
            kind: "static",
            options: [{ label: "A", value: 1 }]
          },
          {
            id: "ds2",
            name: "users",
            kind: "remote",
            request: { resource: "user", action: "list" },
            mapping: { labelKey: "name", valueKey: "id" }
          }
        ]
      }));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe("when a field carries an inline option source", () => {
    it("rejects a non-object dataSource", () => {
      const result = validate(selectWith("garbage"));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "data_source_invalid",
        path: "presentations.pc.children[0].dataSource"
      }));
    });

    it("rejects a static source whose options is not an array", () => {
      const result = validate(selectWith({ kind: "static", options: {} }));

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "data_source_invalid",
        path: "presentations.pc.children[0].dataSource.options"
      }));
    });

    it("rejects a static option that is not a {label, value} object", () => {
      const result = validate(selectWith({ kind: "static", options: [{ label: 1, value: {} }] }));

      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "data_source_invalid",
        path: "presentations.pc.children[0].dataSource.options[0]"
      }));
    });

    it("warns (not errors) on a ref pointing at an undeclared data source", () => {
      const result = validate(selectWith({ kind: "ref", dataSourceId: "ghost" }));

      expect(result.valid).toBe(true);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "data_source_ref_unknown",
        path: "presentations.pc.children[0].dataSource.dataSourceId",
        severity: "warning"
      }));
    });

    it("accepts a ref resolving to a declared data source", () => {
      const result = validate(selectWith({ kind: "ref", dataSourceId: "ds1" }, {
        dataSources: [
          {
            id: "ds1",
            name: "levels",
            kind: "static",
            options: []
          }
        ]
      }));

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("warns on an inline remote source whose request is not yet filled in", () => {
      const result = validate(selectWith({ kind: "remote", request: { resource: "", action: "" } }));

      expect(result.valid).toBe(true);
      expect(codesOf(result.issues)).toEqual(["request_incomplete", "request_incomplete"]);
    });

    it("rejects an inline remote source with a non-object request", () => {
      const result = validate(selectWith({ kind: "remote", request: null }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "request_malformed",
        path: "presentations.pc.children[0].dataSource.request"
      }));
    });
  });

  describe("when subform bounds are wrong", () => {
    it("rejects minRows greater than maxRows", () => {
      const candidate = schema([
        {
          id: "Sub_1",
          type: "subform",
          variant: "stack",
          key: "lines",
          minRows: 3,
          maxRows: 1,
          template: [field("a", "amount")]
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "rows_bound_invalid",
        path: "presentations.pc.children[0].minRows"
      }));
    });
  });

  describe("when a keyed-only linkage action targets a non-leaf", () => {
    it("rejects a require action on a subform (keyed, but a container)", () => {
      const result = validate(subformWithAction({ type: "require" }));

      expect(result.valid).toBe(false);
      expect(codesOf(result.issues)).toContain("action_requires_keyed_leaf");
    });

    it("rejects an assign action on a subform", () => {
      const result = validate(subformWithAction({
        type: "assign",
        value: { kind: "literal", value: 1 }
      }));

      expect(result.valid).toBe(false);
      expect(codesOf(result.issues)).toContain("action_requires_keyed_leaf");
    });

    it("still accepts a require action on a keyed leaf field", () => {
      const candidate = schema([
        field("t", "trigger"),
        {
          id: "Field_note",
          type: "textfield",
          key: "note",
          linkage: {
            rules: [
              {
                id: "Rule_1",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "trigger",
                    operator: "eq",
                    value: "x"
                  }
                },
                actions: [{ type: "require" }]
              }
            ]
          }
        }
      ]);

      expect(validate(candidate).valid).toBe(true);
    });
  });

  describe("when a half-configured rule round-trips through export → import", () => {
    it("stays valid with warnings only for an empty set_field target", () => {
      // The editor seeds `set_field` with targetKey "" — exporting that state
      // and importing it back must succeed, surfacing the gap as a warning.
      const candidate = schema([
        {
          id: "Field_1",
          type: "textfield",
          key: "name",
          linkage: {
            rules: [
              {
                id: "Rule_1",
                trigger: { kind: "change" },
                actions: [
                  {
                    type: "set_field",
                    targetKey: "",
                    value: { kind: "literal", value: "" }
                  }
                ]
              }
            ]
          }
        }
      ]);

      const result = validate(candidate);

      expect(result.valid).toBe(true);
      expect(result.schema).toBe(candidate);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "target_key_empty",
        ruleId: "Rule_1",
        severity: "warning"
      }));
    });
  });

  describe("when validate rules are inconsistent", () => {
    it("rejects minLength greater than maxLength", () => {
      const result = validate(withValidate({ minLength: 5, maxLength: 3 }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "validate_range_invalid",
        path: "presentations.pc.children[0].validate.minLength"
      }));
    });

    it("rejects min greater than max", () => {
      const result = validate(withValidate({ min: 10, max: 1 }));

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(expect.objectContaining({
        code: "validate_range_invalid",
        path: "presentations.pc.children[0].validate.min"
      }));
    });

    it("rejects an uncompilable regular-expression pattern", () => {
      const result = validate(withValidate({ pattern: "(" }));

      expect(result.valid).toBe(false);
      expect(codesOf(result.issues)).toContain("pattern_invalid");
    });

    it("accepts consistent validate rules", () => {
      expect(validate(withValidate({
        minLength: 1,
        maxLength: 5,
        pattern: String.raw`^\d+$`
      })).valid).toBe(true);
    });
  });

  describe("when a subform uses the table variant", () => {
    it("warns on a non-keyed block in the template", () => {
      const result = validate(schema([
        {
          id: "Sub_1",
          type: "subform",
          variant: "table",
          key: "lines",
          template: [
            {
              id: "Field_name",
              type: "textfield",
              key: "name"
            },
            {
              id: "Btn_1",
              type: "button",
              action: "submit"
            }
          ]
        }
      ]));

      // A warning, not an error — the renderer skips the offending column.
      expect(codesOf(result.issues)).toContain("subform_table_column");
      expect(result.valid).toBe(true);
    });

    it("warns on a nested container in the template", () => {
      const result = validate(schema([
        {
          id: "Sub_1",
          type: "subform",
          variant: "table",
          key: "lines",
          template: [
            {
              id: "Sec_1",
              type: "section",
              variant: "card",
              title: "区块",
              children: []
            }
          ]
        }
      ]));

      expect(codesOf(result.issues)).toContain("subform_table_column");
    });

    it("accepts a template of flat keyed leaf fields", () => {
      const result = validate(schema([
        {
          id: "Sub_1",
          type: "subform",
          variant: "table",
          key: "lines",
          template: [
            field("name", "name"),
            {
              id: "Field_qty",
              type: "number",
              key: "qty"
            }
          ]
        }
      ]));

      expect(codesOf(result.issues)).not.toContain("subform_table_column");
    });
  });

  describe("when a subform omits its variant (a legacy schema)", () => {
    it("normalizes the variant to \"stack\" on ingest", () => {
      const candidate = schema([
        {
          id: "Sub_1",
          type: "subform",
          key: "lines",
          template: [field("name", "name")]
        }
      ]) as { presentations: { pc: { children: Array<{ variant?: unknown }> } } };

      validate(candidate);

      expect(candidate.presentations.pc.children[0]?.variant).toBe("stack");
    });
  });
});
