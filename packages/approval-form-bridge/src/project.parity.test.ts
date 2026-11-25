import type {
  CcFieldPermission,
  FieldKind as FlowFieldKind,
  FieldPermission as FlowFieldPermission
} from "@vef-framework-react/approval-flow-editor";
import type {
  FieldKind as FormEditorFieldKind,
  FieldPermission as FormFieldPermission,
  FormSchema
} from "@vef-framework-react/form-editor";

import type { ApprovalFieldKind, ApprovalFormField } from "./contract";
import type { ProjectionIssueCode } from "./issues";

import { expectTypeOf } from "vitest";

import { projectFormSchema } from "./project";

/**
 * Expected error code and path for every parseable error fixture, mirroring
 * Go `internal/approval/formeditor/parser_test.go`'s `errorTokens`. A new error
 * fixture absent from this table fails the suite loudly so parity stays
 * intentional.
 */
const EXPECTED_ERROR_ISSUES: Record<string, { code: ProjectionIssueCode; path: string }> = {
  cross_device_date_granularity: { code: "cross_device_kind_mismatch", path: "period" },
  cross_device_fixed_rows_item_key_conflict: { code: "cross_device_table_rows_mismatch", path: "checks" },
  cross_device_fixed_rows_source_conflict: { code: "cross_device_table_rows_mismatch", path: "checks" },
  cross_device_kind_conflict: { code: "cross_device_kind_mismatch", path: "amount" },
  cross_device_options_conflict: { code: "cross_device_options_mismatch", path: "city" },
  cross_device_options_label_conflict: { code: "cross_device_options_mismatch", path: "level" },
  cross_device_options_source_conflict: { code: "cross_device_options_mismatch", path: "gender" },
  cross_device_select_multiplicity: { code: "cross_device_kind_mismatch", path: "tags" },
  cross_device_storage_conflict: { code: "cross_device_storage_mismatch", path: "amount" },
  cross_device_table_column_options_conflict: { code: "cross_device_options_mismatch", path: "checks.result" },
  cross_device_table_conflict: { code: "cross_device_table_mismatch", path: "items" },
  cross_device_table_row_mode_conflict: { code: "cross_device_table_rows_mismatch", path: "checks" },
  cross_device_table_validation_conflict: { code: "cross_device_validation_mismatch", path: "items" },
  cross_device_tree_leaf_only_conflict: { code: "cross_device_options_mismatch", path: "region" },
  cross_device_tree_mapping_conflict: { code: "cross_device_options_mismatch", path: "dept" },
  cross_device_unmappable: { code: "unmappable_field_type", path: "a" },
  cross_device_validation_conflict: { code: "cross_device_validation_mismatch", path: "phone" },
  nested_subform: { code: "nested_subform_unsupported", path: "items.parts" },
  subform_fixed_item_key_conflict: { code: "table_fixed_rows_item_key_conflict", path: "checks" },
  subform_fixed_item_key_empty: { code: "table_fixed_rows_item_key_empty", path: "checks" },
  subform_fixed_source_duplicate: { code: "table_fixed_rows_source_invalid", path: "checks" },
  subform_fixed_source_empty: { code: "table_fixed_rows_source_invalid", path: "checks" },
  table_columns_empty: { code: "table_columns_empty", path: "items" },
  unknown_type: { code: "unknown_field_type_unprojectable", path: "score" },
  unmappable_column: { code: "unmappable_field_type", path: "items.flag" },
  unmappable_switch: { code: "unmappable_field_type", path: "flag" }
};

/**
 * Byte-verbatim copies of the Go parser's golden fixtures — the source of
 * truth is `internal/approval/formeditor/testdata/` in the vef-framework-go
 * repository (see the fixture directory's README). `<name>.schema.json`
 * without an `<name>.expected.json` sibling is an error fixture. Raw imports:
 * one fixture is deliberately malformed JSON, so parsing stays in the tests.
 */
const rawFixtures = import.meta.glob<string>("./__fixtures__/formeditor-parity/*.json", {
  query: "?raw",
  import: "default",
  eager: true
});

const MALFORMED_FIXTURE = "malformed_json";

const fixtureFiles = new Map(Object.entries(rawFixtures).map(([path, content]) => [path.split("/").at(-1) ?? path, content]));
const fixtureNames = fixtureFiles.keys()
  .filter(file => file.endsWith(".schema.json"))
  .map(file => file.slice(0, -".schema.json".length))
  .toArray()
  .toSorted();
const goldenNames = fixtureNames.filter(name => fixtureFiles.has(`${name}.expected.json`));
const errorNames = fixtureNames.filter(name => !fixtureFiles.has(`${name}.expected.json`));
const parseableErrorNames = errorNames.filter(name => name !== MALFORMED_FIXTURE);

function readFixture(file: string): string {
  const content = fixtureFiles.get(file);

  if (content === undefined) {
    throw new Error(`missing fixture file: ${file}`);
  }

  return content;
}

describe("projectFormSchema Go parser parity", () => {
  it("discovers both golden pairs and error fixtures", () => {
    expect(goldenNames.length).toBeGreaterThan(0);
    expect(errorNames.length).toBeGreaterThan(0);
    expect(errorNames).toContain(MALFORMED_FIXTURE);
  });

  describe("golden fixtures", () => {
    for (const name of goldenNames) {
      it(`projects ${name} identically to the Go parser`, () => {
        const schema = JSON.parse(readFixture(`${name}.schema.json`)) as FormSchema;
        const expected = JSON.parse(readFixture(`${name}.expected.json`)) as ApprovalFormField[];

        const result = projectFormSchema(schema);

        expect(result.valid).toBe(true);
        // toEqual ignores undefined-valued members, normalizing exactly one
        // serialization artifact: an optional member the projector left
        // absent vs one the JSON fixture omits. No other normalization.
        expect(result.fields).toEqual(expected);
      });
    }
  });

  describe("error fixtures", () => {
    for (const name of parseableErrorNames) {
      it(`rejects ${name} with the expected error-severity issue`, () => {
        const expected = EXPECTED_ERROR_ISSUES[name];
        expect(expected, `register expected code/path for error fixture "${name}" in EXPECTED_ERROR_ISSUES`).toBeDefined();

        const schema = JSON.parse(readFixture(`${name}.schema.json`)) as FormSchema;

        const result = projectFormSchema(schema);

        expect(result.valid).toBe(false);
        expect(result.issues).toContainEqual(expect.objectContaining({
          code: expected!.code,
          path: expected!.path,
          severity: "error"
        }));
      });
    }

    it(`rejects ${MALFORMED_FIXTURE} before projection, at the JSON layer`, () => {
      // The Go parser fails this fixture inside json.Unmarshal; the TS twin
      // of that failure is JSON.parse throwing — no FormSchema value ever
      // exists, so the projection is unreachable by construction.
      expect(() => JSON.parse(readFixture(`${MALFORMED_FIXTURE}.schema.json`))).toThrow(SyntaxError);
    });
  });
});

describe("FieldPermission lockstep", () => {
  // eslint-disable-next-line vitest/expect-expect -- expectTypeOf is a compile-time assertion; a union drift fails `tsc --noEmit`
  it("keeps form-editor's FieldPermission identical to approval-flow-editor's", () => {
    expectTypeOf<FormFieldPermission>().toEqualTypeOf<FlowFieldPermission>();
  });

  // eslint-disable-next-line vitest/expect-expect -- expectTypeOf is a compile-time assertion; a union drift fails `tsc --noEmit`
  it("keeps CcFieldPermission a subset of form-editor's FieldPermission", () => {
    expectTypeOf<CcFieldPermission>().toExtend<FormFieldPermission>();
  });

  // eslint-disable-next-line vitest/expect-expect -- expectTypeOf is a compile-time assertion; a union drift fails `tsc --noEmit`
  it("keeps ApprovalFieldKind identical to approval-flow-editor's FieldKind", () => {
    expectTypeOf<ApprovalFieldKind>().toEqualTypeOf<FlowFieldKind>();
  });

  // eslint-disable-next-line vitest/expect-expect -- expectTypeOf is a compile-time assertion; a union drift fails `tsc --noEmit`
  it("keeps form-editor's FieldKind a subset of ApprovalFieldKind", () => {
    expectTypeOf<FormEditorFieldKind>().toExtend<ApprovalFieldKind>();
  });
});
