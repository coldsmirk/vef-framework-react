import { DICTIONARY_AUGMENT_TARGET, renderDictionaryKeysFile } from "./render";

const OPTIONS = { configFile: "dictionary-keys.config.ts" };

describe("code-generation/dictionary/renderDictionaryKeysFile", () => {
  it("renders a never union when no entries are provided", () => {
    expect(renderDictionaryKeysFile([], OPTIONS)).toMatchSnapshot();
  });

  it("renders a single key without a comment", () => {
    expect(renderDictionaryKeysFile([{ key: "sys.menu.type" }], OPTIONS)).toMatchSnapshot();
  });

  it("renders multiple keys in the order provided", () => {
    expect(
      renderDictionaryKeysFile(
        [
          { key: "sys.menu.type" },
          { key: "sys.user.gender" },
          { key: "pmrm.project.stage" }
        ],
        OPTIONS
      )
    ).toMatchSnapshot();
  });

  it("renders JSDoc comments before union members", () => {
    expect(
      renderDictionaryKeysFile(
        [
          { key: "sys.menu.type", comment: "Menu type classification" },
          { key: "sys.user.gender", comment: "Gender of the user" }
        ],
        OPTIONS
      )
    ).toMatchSnapshot();
  });

  it("escapes special characters in keys via JSON.stringify", () => {
    expect(
      renderDictionaryKeysFile([{ key: "weird.\"quoted\".key" }], OPTIONS)
    ).toContain(String.raw`"weird.\"quoted\".key"`);
  });

  it("collapses whitespace and escapes nested comment terminators", () => {
    expect(
      renderDictionaryKeysFile([{ key: "k", comment: "  multi\n  line  with */ inside  " }], OPTIONS)
    ).toContain(String.raw`multi line with *\/ inside`);
  });

  it("collapses U+2028 / U+2029 line and paragraph separators in comments", () => {
    expect(
      renderDictionaryKeysFile([
        {
          key: "k",
          comment: "first\u{2028}second\u{2029}third"
        }
      ], OPTIONS)
    ).toContain("first second third");
  });

  it("defaults the augment target to @vef-framework-react/hooks", () => {
    expect(renderDictionaryKeysFile([{ key: "k" }], OPTIONS)).toContain(
      `declare module "${DICTIONARY_AUGMENT_TARGET}"`
    );
  });

  it("honors a custom augment target", () => {
    const generated = renderDictionaryKeysFile(
      [{ key: "k" }],
      { ...OPTIONS, augmentTarget: "@my-fork/dict" }
    );

    expect(generated).toContain("declare module \"@my-fork/dict\"");
    expect(generated).not.toContain("@vef-framework-react/hooks");
  });

  it("always emits the framework module augmentation block", () => {
    const generated = renderDictionaryKeysFile([{ key: "k" }], OPTIONS);

    expect(generated).toContain("interface Register");
    expect(generated).toContain("dictionaryKeys: DictionaryKey;");
  });
});
