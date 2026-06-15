import type { EditorPlugins } from "@vef-framework-react/approval-flow-editor";
import type { FC } from "react";

import type { FlowInitiator, InitiatorKind } from "../types";

import { Button, Empty, Select } from "@vef-framework-react/components";

const KIND_OPTIONS: Array<{ label: string; value: InitiatorKind }> = [
  { label: "用户", value: "user" },
  { label: "角色", value: "role" },
  { label: "部门", value: "department" }
];

function isInitiatorKind(value: unknown): value is InitiatorKind {
  return value === "user" || value === "role" || value === "department";
}

interface InitiatorsEditorProps {
  value: FlowInitiator[];
  pickers?: EditorPlugins["pickers"];
  onChange: (value: FlowInitiator[]) => void;
}

/**
 * Editor for the flow-scoped initiator list (who may launch the flow). Each row
 * picks a kind and resolves concrete ids through the host-provided picker for
 * that kind.
 */
export const InitiatorsEditor: FC<InitiatorsEditorProps> = ({
  value,
  pickers,
  onChange
}) => {
  const update = (index: number, next: Partial<FlowInitiator>) => {
    onChange(value.map((item, i) => i === index ? { ...item, ...next } : item));
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 8
    }}
    >
      {value.length === 0 && <Empty description="尚未配置发起人" />}

      {value.map((item, index) => {
        const Picker = pickers?.[item.kind];

        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8
            }}
          >
            <Select
              options={KIND_OPTIONS}
              style={{ width: 120, flexShrink: 0 }}
              value={item.kind}
              onChange={next => {
                if (isInitiatorKind(next)) {
                  update(index, { kind: next, ids: [] });
                }
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              {Picker
                ? <Picker value={item.ids} onChange={ids => update(index, { ids })} />
                : (
                    <span style={{ color: "var(--vef-color-text-tertiary)" }}>
                      未提供
                      {" "}
                      {item.kind}
                      {" "}
                      选择器
                    </span>
                  )}
            </div>

            <Button
              danger
              type="text"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              移除
            </Button>
          </div>
        );
      })}

      <div>
        <Button type="dashed" onClick={() => onChange([...value, { kind: "user", ids: [] }])}>
          + 添加发起人
        </Button>
      </div>
    </div>
  );
};
