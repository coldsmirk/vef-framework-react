import { toFormContextSources, toFormEvaluationContext } from "./form-context";

describe("toFormContextSources", () => {
  it("offers the applicant attributes first", () => {
    expect(toFormContextSources(undefined).map(source => source.key)).toEqual([
      "$applicant.id",
      "$applicant.name",
      "$applicant.departmentId",
      "$applicant.departmentName"
    ]);
  });

  it("offers each declared form global under $globals", () => {
    expect(toFormContextSources([{ key: "staffTitle", label: "发起人职称" }]).at(-1))
      .toEqual({ key: "$globals.staffTitle", label: "发起人职称" });
  });
});

describe("toFormEvaluationContext", () => {
  it("scopes the applicant and the globals", () => {
    expect(toFormEvaluationContext({ id: "u-1", name: "张三" }, { region: "north" })).toEqual({
      applicant: { id: "u-1", name: "张三" },
      globals: { region: "north" }
    });
  });

  it("leaves out what is absent", () => {
    expect(toFormEvaluationContext(undefined, undefined)).toEqual({});
  });
});
