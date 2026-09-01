import { describe, expect, it } from "vitest";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../../engine/registry/defaults-mobile";
import { uploadFieldDefinition } from "./index";

describe("uploadFieldDefinition", () => {
  it("落在「日期 & 文件」分组且是有值字段", () => {
    expect(uploadFieldDefinition.config.type).toBe("upload");
    expect(uploadFieldDefinition.config.group).toBe("date-file");
    expect(uploadFieldDefinition.config.keyed).toBe(true);
  });

  it("新建时默认单文件 —— 决定了值是单个存储键而不是数组", () => {
    expect(uploadFieldDefinition.config.create()).toMatchObject({ type: "upload", maxCount: 1 });
  });

  it("PC 与移动端注册表都能取到，否则移动端会渲染成未知字段类型", () => {
    expect(createDefaultRegistry().get("upload")?.Component).toBeDefined();
    expect(createDefaultMobileRegistry().get("upload")?.Component).toBeDefined();
  });
});
