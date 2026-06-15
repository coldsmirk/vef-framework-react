import { CompletionContext } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { buildCompletionSource, lintUnknownFieldMembers } from "./expression-assist";

const FIELDS = [
  { value: "age", label: "年龄 · age" },
  { value: "name", label: "姓名 · name" }
];

function complete(doc: string, source = buildCompletionSource({ fields: FIELDS, variables: ["flag"] })) {
  const state = EditorState.create({ doc });

  return source(new CompletionContext(state, doc.length, false));
}

describe("buildCompletionSource", () => {
  it("offers the scope's field keys after field.", () => {
    const result = complete("field.a");

    expect(result?.options.map(option => option.label)).toEqual(["age", "name"]);
  });

  it("offers declared variables after $vars.", () => {
    const result = complete("$vars.f");

    expect(result?.options.map(option => option.label)).toEqual(["flag"]);
  });

  it("offers the scope roots at a bare word", () => {
    const result = complete("fie");

    expect(result?.options.map(option => option.label)).toContain("field");
    expect(result?.options.map(option => option.label)).toContain("$vars");
  });

  it("stays quiet after a member root with no candidates", () => {
    const source = buildCompletionSource({ fields: [], variables: [] });

    expect(complete("field.a", source)).toBeNull();
  });
});

function lint(doc: string, keys: string[] = ["age", "name"]) {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [javascript()] })
  });

  try {
    return lintUnknownFieldMembers(view, new Set(keys));
  } finally {
    view.destroy();
  }
}

describe("lintUnknownFieldMembers", () => {
  it("flags a member key the scope does not provide", () => {
    const diagnostics = lint("field.ghost > 1");

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain("ghost");
    expect(diagnostics[0]?.severity).toBe("warning");
  });

  it("accepts known keys on field and $form", () => {
    expect(lint("field.age > 1 && $form.name === 'x'")).toHaveLength(0);
  });

  it("leaves host-injected roots alone", () => {
    // `$vars` / `$user` / `$node` members come from the host at runtime — the
    // schema cannot enumerate them, so they are not linted.
    expect(lint("$vars.anything && $user.id")).toHaveLength(0);
  });

  it("stays quiet when the scope has no keyed fields at all", () => {
    expect(lint("field.ghost", [])).toHaveLength(0);
  });
});
