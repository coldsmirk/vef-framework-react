import type { CcFieldPermission, FieldPermission as FlowFieldPermission } from "@vef-framework-react/approval-flow-editor";
import type { FieldPermission as FormFieldPermission, FormSchema } from "@vef-framework-react/form-editor";

import type { ApprovalFormField } from "./contract";

import { expectTypeOf } from "vitest";

import { projectFormSchema } from "./project";

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
      it(`rejects ${name} with an error-severity issue`, () => {
        const schema = JSON.parse(readFixture(`${name}.schema.json`)) as FormSchema;

        const result = projectFormSchema(schema);

        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => issue.severity === "error")).toBe(true);
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
});
