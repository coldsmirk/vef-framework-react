import type { ApiCompletion } from "./completions";

import { CompletionContext } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";

import { apiCompletionSource, resolveApiPath } from "./completions";

const CATALOG: ApiCompletion[] = [
  {
    label: "http",
    type: "namespace",
    children: [
      {
        label: "fetch",
        type: "function",
        detail: "(url, options?)"
      },
      {
        label: "get",
        type: "function"
      }
    ]
  },
  {
    label: "system",
    children: [
      {
        label: "params",
        type: "property",
        children: []
      }
    ]
  },
  {
    label: "input",
    info: "已校验的入参"
  }
];

function completionContext(doc: string, explicit = false): CompletionContext {
  const state = EditorState.create({
    doc,
    extensions: [javascript()]
  });

  return new CompletionContext(state, doc.length, explicit);
}

describe("resolveApiPath", () => {
  it("returns the root level for an empty path", () => {
    expect(resolveApiPath(CATALOG, [])?.map(entry => entry.label), "empty path should yield the root entries").toEqual(["http", "system", "input"]);
  });

  it("walks nested members", () => {
    expect(resolveApiPath(CATALOG, ["http"])?.map(entry => entry.label), "http members should resolve").toEqual(["fetch", "get"]);
  });

  it("returns null outside the catalog", () => {
    expect(resolveApiPath(CATALOG, ["unknown"]), "an unknown segment should leave the catalog").toBeNull();
    expect(resolveApiPath(CATALOG, ["input"]), "an entry without children offers no members").toBeNull();
  });
});

describe("apiCompletionSource", () => {
  const source = apiCompletionSource(CATALOG);

  it("offers members right after a dot", async () => {
    const result = await source(completionContext("http."));

    expect(result, "typing `http.` should produce a completion result").not.toBeNull();
    expect(result?.options.map(option => option.label), "the http members should be offered").toEqual(["fetch", "get"]);
  });

  it("anchors the replacement range to the typed member prefix", async () => {
    const doc = "http.ge";
    const result = await source(completionContext(doc));

    expect(result?.from, "completion should replace the `ge` prefix").toBe(doc.length - 2);
  });

  it("offers root bindings while typing an identifier", async () => {
    const result = await source(completionContext("sys"));

    expect(result?.options.map(option => option.label), "root entries should be offered for a bare identifier").toEqual(["http", "system", "input"]);
  });

  it("stays silent at the top level until asked", async () => {
    expect(await source(completionContext("")), "no popup with nothing typed and no explicit request").toBeNull();
    expect(await source(completionContext("", true)), "an explicit request at the top level should offer the catalog").not.toBeNull();
  });

  it("stays silent outside the catalog", async () => {
    expect(await source(completionContext("window.")), "unknown objects belong to other sources").toBeNull();
  });

  it("carries entry metadata onto the options", async () => {
    const result = await source(completionContext("inp"));
    const input = result?.options.find(option => option.label === "input");

    expect(input?.info, "the info doc should be carried over").toBe("已校验的入参");
    expect(input?.type, "a leaf without an explicit type defaults to variable").toBe("variable");

    const http = result?.options.find(option => option.label === "http");
    expect(http?.type, "an explicit type wins").toBe("namespace");
  });
});
