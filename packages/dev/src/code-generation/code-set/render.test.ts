import { CODE_SET_AUGMENT_TARGET, renderCodeSetKeysFile } from "./render";

const OPTIONS = { configFile: "code-set-keys.config.ts" };

describe("code-generation/code-set/renderCodeSetKeysFile", () => {
  it("renders a never union when no entries are provided", () => {
    expect(renderCodeSetKeysFile([], OPTIONS)).toMatchSnapshot();
  });

  it("renders a single key without a comment", () => {
    expect(renderCodeSetKeysFile([{ key: "sys.menu.type" }], OPTIONS)).toMatchSnapshot();
  });

  it("renders multiple keys in the order provided", () => {
    expect(
      renderCodeSetKeysFile(
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
      renderCodeSetKeysFile(
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
      renderCodeSetKeysFile([{ key: "weird.\"quoted\".key" }], OPTIONS)
    ).toContain(String.raw`"weird.\"quoted\".key"`);
  });

  it("collapses whitespace and escapes nested comment terminators", () => {
    expect(
      renderCodeSetKeysFile([{ key: "k", comment: "  multi\n  line  with */ inside  " }], OPTIONS)
    ).toContain(String.raw`multi line with *\/ inside`);
  });

  it("collapses U+2028 / U+2029 line and paragraph separators in comments", () => {
    expect(
      renderCodeSetKeysFile([
        {
          key: "k",
          comment: "first\u{2028}second\u{2029}third"
        }
      ], OPTIONS)
    ).toContain("first second third");
  });

  it("defaults the augment target to @vef-framework-react/hooks", () => {
    expect(renderCodeSetKeysFile([{ key: "k" }], OPTIONS)).toContain(
      `declare module "${CODE_SET_AUGMENT_TARGET}"`
    );
  });

  it("honors a custom augment target", () => {
    const generated = renderCodeSetKeysFile(
      [{ key: "k" }],
      { ...OPTIONS, augmentTarget: "@my-fork/code-sets" }
    );

    expect(generated).toContain("declare module \"@my-fork/code-sets\"");
    expect(generated).not.toContain("@vef-framework-react/hooks");
  });

  it("always emits the framework module augmentation block", () => {
    const generated = renderCodeSetKeysFile([{ key: "k" }], OPTIONS);

    expect(generated).toContain("interface Register");
    expect(generated).toContain("codeSetKeys: CodeSetKey;");
  });
});
