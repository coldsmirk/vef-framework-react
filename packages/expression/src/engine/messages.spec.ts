import { getExpressionLocale, localizeCompletionInfo, localizeSourceLabel, setExpressionLocale } from "./messages";

afterEach(() => {
  setExpressionLocale("en-US");
});

describe("getExpressionLocale", () => {
  it("defaults to en-US", () => {
    expect(getExpressionLocale()).toBe("en-US");
  });

  it("reflects the configured locale", () => {
    setExpressionLocale("zh-CN");

    expect(getExpressionLocale()).toBe("zh-CN");
  });
});

describe("localizeCompletionInfo", () => {
  it("returns the English description unchanged under en-US", () => {
    expect(localizeCompletionInfo("Rounds a number down to the nearest integer.")).toBe("Rounds a number down to the nearest integer.");
  });

  it("translates a known description under zh-CN", () => {
    setExpressionLocale("zh-CN");

    expect(localizeCompletionInfo("Rounds a number down to the nearest integer.")).toBe("向下取整到最接近的整数。");
  });

  it("falls back to English for an unknown description under zh-CN", () => {
    setExpressionLocale("zh-CN");

    expect(localizeCompletionInfo("A brand-new builtin not in the table")).toBe("A brand-new builtin not in the table");
  });

  it("returns an empty description unchanged", () => {
    setExpressionLocale("zh-CN");

    expect(localizeCompletionInfo("")).toBe("");
  });
});

describe("localizeSourceLabel", () => {
  it("returns the English label under en-US", () => {
    expect(localizeSourceLabel("parserError")).toBe("Parser error");
  });

  it("translates a known error type under zh-CN", () => {
    setExpressionLocale("zh-CN");

    expect(localizeSourceLabel("parserError")).toBe("语法错误");
  });

  it("falls back to the locale's generic label for an unknown type", () => {
    setExpressionLocale("zh-CN");

    expect(localizeSourceLabel("mysteryError")).toBe("错误");
  });

  it("falls back to the generic label for an undefined type", () => {
    expect(localizeSourceLabel()).toBe("Error");
  });
});
