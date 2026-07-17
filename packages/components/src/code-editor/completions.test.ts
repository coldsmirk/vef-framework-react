import type { CompletionEntry } from "./completions";

import { CompletionContext } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";

import { completeFromEntries, completeJsonKeysFromEntries, resolveEntryPath } from "./completions";

const CATALOG: CompletionEntry[] = [
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

describe("resolveEntryPath", () => {
  it("returns the root level for an empty path", () => {
    expect(resolveEntryPath(CATALOG, [])?.map(entry => entry.label), "empty path should yield the root entries").toEqual(["http", "system", "input"]);
  });

  it("walks nested members", () => {
    expect(resolveEntryPath(CATALOG, ["http"])?.map(entry => entry.label), "http members should resolve").toEqual(["fetch", "get"]);
  });

  it("returns null outside the catalog", () => {
    expect(resolveEntryPath(CATALOG, ["unknown"]), "an unknown segment should leave the catalog").toBeNull();
    expect(resolveEntryPath(CATALOG, ["input"]), "an entry without children offers no members").toBeNull();
  });
});

describe("completeFromEntries", () => {
  const source = completeFromEntries(CATALOG);

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

function jsonContext(doc: string, pos = doc.length, explicit = false): CompletionContext {
  const state = EditorState.create({
    doc,
    extensions: [json()]
  });

  return new CompletionContext(state, pos, explicit);
}

describe("completeJsonKeysFromEntries", () => {
  const KEYS: CompletionEntry[] = [
    {
      label: "type",
      type: "property",
      info: "实例类型"
    },
    {
      label: "properties",
      type: "property"
    }
  ];
  const source = completeJsonKeysFromEntries(KEYS);

  it("completes while a key string is still being typed", async () => {
    const result = await source(jsonContext("{\"ty"));

    expect(result, "an open key string should produce a completion result").not.toBeNull();
    expect(result?.from, "completion should replace the text after the opening quote").toBe(2);
    expect(result?.options.map(option => option.label), "the catalog keys should be offered").toEqual(["type", "properties"]);
  });

  it("completes inside a closed property name", async () => {
    const result = await source(jsonContext("{\"ty\": 1}", 4));

    expect(result?.from, "completion should anchor after the opening quote").toBe(2);
  });

  it("completes a later key in a populated object", async () => {
    const result = await source(jsonContext("{\"a\": 1, \"pr"));

    expect(result?.from, "completion should anchor inside the second key").toBe(10);
  });

  it("stays silent inside a value string", async () => {
    expect(await source(jsonContext("{\"type\": \"str")), "value strings must not get keyword noise").toBeNull();
  });

  it("offers quoted keys only on an explicit request at a bare position", async () => {
    expect(await source(jsonContext("{", 1)), "plain typing at a bare position stays quiet").toBeNull();

    const result = await source(jsonContext("{", 1, true));
    expect(result, "an explicit request should offer the catalog").not.toBeNull();
    expect(result?.options[0]?.apply, "bare-position insertions should be fully quoted").toBe("\"type\"");
  });

  it("carries entry metadata onto the options", async () => {
    const result = await source(jsonContext("{\"ty"));
    const type = result?.options.find(option => option.label === "type");

    expect(type?.info, "the info doc should be carried over").toBe("实例类型");
    expect(type?.type, "the icon kind should be carried over").toBe("property");
  });
});
