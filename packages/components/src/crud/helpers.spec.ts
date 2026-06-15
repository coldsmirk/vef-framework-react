import { describe, expect, it } from "vitest";

import { createCrudKit } from "./helpers";

interface Row {
  id: string;
}

interface SearchValues {
  keyword: string;
}

interface SceneFormValues {
  create: { title: string };
}

describe("crud/createCrudKit", () => {
  it("returns a kit with the hooks and components Crud consumers depend on", () => {
    const kit = createCrudKit<Row, SearchValues, SceneFormValues>();

    expect(typeof kit.useCrudStore).toBe("function");
    expect(typeof kit.useSearchValues).toBe("function");
    expect(typeof kit.useSelectedRows).toBe("function");
    expect(kit.OperationButtonGroup).toBeDefined();
    expect(kit.ActionButtonGroup).toBeDefined();
  });

  it("returns the same shared underlying hooks across kit instances", () => {
    const first = createCrudKit<Row, SearchValues, SceneFormValues>();
    const second = createCrudKit<Row, SearchValues, SceneFormValues>();

    expect(first.useCrudStore).toBe(second.useCrudStore);
    expect(first.useSearchValues).toBe(second.useSearchValues);
    expect(first.useSelectedRows).toBe(second.useSelectedRows);
  });
});
