import type { FieldOption } from "../types";

import { describe, expect, it } from "vitest";

import {
  collectOptionAncestorValues,
  collectOptionValues,
  countOptionNodes,
  filterOptionTree,
  findDuplicateOptionValues,
  flattenSelectableOptions,
  hasOptionChildren,
  indexOptionsByValue,
  isTreeSelectFieldType,
  matchesOptionQuery,
  toTopLevelOptions
} from "./options";

const REGION_TREE: FieldOption[] = [
  {
    label: "华东大区",
    value: "east",
    description: "华东片区",
    children: [
      {
        label: "浙江省",
        value: "zj",
        children: [
          {
            label: "杭州市",
            value: "hz",
            description: "省会城市"
          },
          {
            label: "宁波市",
            value: "nb",
            disabled: true
          }
        ]
      },
      {
        label: "上海市",
        value: "sh",
        description: "直辖市"
      }
    ]
  },
  {
    label: "华北大区",
    value: "north",
    children: []
  }
];

describe("option tree utilities", () => {
  it("identifies tree select field types", () => {
    expect(isTreeSelectFieldType("tree-select")).toBe(true);
    expect(isTreeSelectFieldType("tree-multi-select")).toBe(true);
    expect(isTreeSelectFieldType("select")).toBe(false);
    expect(isTreeSelectFieldType("multi-select")).toBe(false);
  });

  it("checks whether a node has non-empty children", () => {
    expect(hasOptionChildren(REGION_TREE[0]!)).toBe(true);
    expect(hasOptionChildren(REGION_TREE[1]!)).toBe(false);
    const leaf: FieldOption = { label: "Leaf", value: "leaf" };
    expect(hasOptionChildren(leaf)).toBe(false);
  });

  it("detects duplicate option values anywhere across the full tree", () => {
    expect(findDuplicateOptionValues(REGION_TREE)).toEqual([]);

    const duplicated: FieldOption[] = [
      {
        label: "Root",
        value: "dup",
        children: [
          {
            label: "Nested",
            value: "x",
            children: [
              { label: "Deep Dup", value: "dup" },
              { label: "Num 1", value: 1 }
            ]
          }
        ]
      },
      { label: "Str 1", value: "1" }
    ];

    expect(findDuplicateOptionValues(duplicated)).toEqual(["dup", "1"]);
  });

  it("collects option values and counts every node recursively", () => {
    expect(countOptionNodes(REGION_TREE)).toBe(6);
    expect(countOptionNodes([])).toBe(0);
    expect([...collectOptionValues(REGION_TREE)]).toEqual(["east", "zj", "hz", "nb", "sh", "north"]);
  });

  it("strips children for flat controls while preserving disabled and description", () => {
    expect(toTopLevelOptions([
      {
        label: "华东大区",
        value: "east",
        description: "华东片区",
        disabled: true,
        children: [{ label: "上海市", value: "sh" }]
      },
      { label: "华北大区", value: "north" }
    ])).toEqual([
      {
        label: "华东大区",
        value: "east",
        description: "华东片区",
        disabled: true
      },
      { label: "华北大区", value: "north" }
    ]);
  });

  it("flattens selectable options in pre-order with optional leafOnly filtering", () => {
    expect(flattenSelectableOptions(REGION_TREE).map(o => o.value)).toEqual([
      "east",
      "zj",
      "hz",
      "nb",
      "sh",
      "north"
    ]);

    expect(flattenSelectableOptions(REGION_TREE, { leafOnly: true }).map(o => o.value)).toEqual([
      "hz",
      "nb",
      "sh",
      "north"
    ]);
  });

  it("indexes options by value across all depths", () => {
    const index = indexOptionsByValue(REGION_TREE);

    expect(index.get("east")?.label).toBe("华东大区");
    expect(index.get("hz")?.description).toBe("省会城市");
    expect(index.get("nb")?.disabled).toBe(true);
    expect(index.size).toBe(6);
  });

  it("collects ancestor values leading to selected values", () => {
    expect(collectOptionAncestorValues(REGION_TREE, new Set(["hz"]))).toEqual(["east", "zj"]);
    expect(collectOptionAncestorValues(REGION_TREE, new Set(["sh", "north"]))).toEqual(["east"]);
    expect(collectOptionAncestorValues(REGION_TREE, new Set(["missing"]))).toEqual([]);
  });

  it("matches option query case-insensitively on label and description", () => {
    const option: FieldOption = {
      label: "Hangzhou",
      value: "hz",
      description: "Zhejiang Capital"
    };

    expect(matchesOptionQuery("", option)).toBe(true);
    expect(matchesOptionQuery("hang", option)).toBe(true);
    expect(matchesOptionQuery("capital", option)).toBe(true);
    // Stored value is not searched.
    expect(matchesOptionQuery("hz", option)).toBe(false);
  });

  it("filters option tree keeping ancestors of matching descendants and children of matching branches", () => {
    const byChildDesc = filterOptionTree(REGION_TREE, "省会");

    expect(byChildDesc).toEqual({
      options: [
        {
          label: "华东大区",
          value: "east",
          description: "华东片区",
          children: [
            {
              label: "浙江省",
              value: "zj",
              children: [
                {
                  label: "杭州市",
                  value: "hz",
                  description: "省会城市"
                }
              ]
            }
          ]
        }
      ],
      expandedKeys: ["zj", "east"]
    });

    const byBranch = filterOptionTree(REGION_TREE, "浙江省");

    expect(byBranch.options).toHaveLength(1);
    expect(byBranch.options[0]?.children?.[0]?.children).toHaveLength(2);
    expect(byBranch.expandedKeys).toEqual(["east"]);
  });
});
