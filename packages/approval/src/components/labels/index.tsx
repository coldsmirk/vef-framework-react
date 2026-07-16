import type { CSSProperties } from "react";

import { Button, Compact, Icon, Input, Select, Space, Stack, Tag, Text } from "@vef-framework-react/components";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The key charset the backend accepts for flow labels
 * (`validateFlowLabels`): a dotted or otherwise out-of-charset key would be
 * stored but silently never match the equality filter, so the editor
 * validates it client-side too.
 */
export const FLOW_LABEL_KEY_PATTERN = /^[A-Z0-9](?:[\w-]*[A-Z0-9])?$/i;

const MAX_LABEL_KEY_LENGTH = 63;
const MAX_LABEL_VALUE_LENGTH = 256;

/**
 * Client-side mirror of the backend flow-label validation: key charset and
 * length, value length (in characters, matching the backend's rune count).
 */
export function isValidFlowLabel(key: string, value: string): boolean {
  return key.length <= MAX_LABEL_KEY_LENGTH
    && FLOW_LABEL_KEY_PATTERN.test(key)
    && [...value].length <= MAX_LABEL_VALUE_LENGTH;
}

/**
 * One label row under edit. Rows are local state so an in-progress row (empty
 * or invalid key) survives re-renders even though it is excluded from the
 * emitted map.
 */
interface LabelRow {
  key: string;
  value: string;
}

function toRows(labels: Record<string, string> | undefined): LabelRow[] {
  return Object.entries(labels ?? {}).map(([key, value]) => {
    return { key, value };
  });
}

function toLabels(rows: LabelRow[]): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const row of rows) {
    if (row.key !== "") {
      labels[row.key] = row.value;
    }
  }

  return labels;
}

export interface LabelsEditorProps {
  value?: Record<string, string>;
  onChange?: (labels: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * A key-value editor for flow labels. Emits a plain `Record<string, string>`;
 * rows with an empty key are kept locally but excluded from the emitted map,
 * and out-of-charset keys are flagged inline (the backend rejects them at
 * save with the same rule).
 */
export function LabelsEditor({
  value,
  onChange,
  disabled
}: LabelsEditorProps) {
  const [rows, setRows] = useState<LabelRow[]>(() => toRows(value));
  // The exact object last handed to onChange: when the form echoes it back as
  // `value`, local rows are already ahead of it (they may hold an in-progress
  // empty-key row), so the sync below must not clobber them.
  const lastEmitted = useRef<Record<string, string> | undefined>(value);

  useEffect(() => {
    if (value === lastEmitted.current) {
      return;
    }

    lastEmitted.current = value;
    setRows(toRows(value));
  }, [value]);

  function apply(next: LabelRow[]): void {
    setRows(next);

    const labels = toLabels(next);
    lastEmitted.current = labels;
    onChange?.(labels);
  }

  function updateRow(index: number, patch: Partial<LabelRow>): void {
    apply(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  return (
    <Stack gap={8} style={{ width: "100%" }}>
      {rows.map((row, index) => {
        const invalid = row.key !== "" && !isValidFlowLabel(row.key, row.value);

        return (
          // Index keys keep focus stable while the key text is being edited.
          <Compact key={index} style={{ width: "100%" }}>
            <Input
              disabled={disabled}
              maxLength={MAX_LABEL_KEY_LENGTH}
              placeholder="键，如 app"
              status={invalid ? "error" : undefined}
              style={{ width: "40%" }}
              value={row.key}
              onChange={event => updateRow(index, { key: event.target.value })}
            />

            <Input
              disabled={disabled}
              maxLength={MAX_LABEL_VALUE_LENGTH}
              placeholder="值，如 crm"
              style={{ width: "60%" }}
              value={row.value}
              onChange={event => updateRow(index, { value: event.target.value })}
            />

            <Button
              disabled={disabled}
              icon={<Icon component={Trash2Icon} />}
              onClick={() => apply(rows.filter((_, i) => i !== index))}
            />
          </Compact>
        );
      })}

      {rows.some(row => row.key !== "" && !isValidFlowLabel(row.key, row.value))
        && <Text type="danger">标签键只能包含字母、数字、中划线和下划线，且必须以字母或数字开头和结尾。</Text>}

      <Button
        block
        disabled={disabled}
        icon={<Icon component={PlusIcon} />}
        type="dashed"
        onClick={() => apply([...rows, { key: "", value: "" }])}
      >
        添加标签
      </Button>
    </Stack>
  );
}

/**
 * Parse `key=value` tag entries into a label-filter map (`key` alone means an
 * empty-value presence match). Entries without a key are dropped.
 */
export function parseLabelFilters(entries: string[]): Record<string, string> | undefined {
  const labels: Record<string, string> = {};

  for (const entry of entries) {
    const separator = entry.indexOf("=");
    const key = (separator === -1 ? entry : entry.slice(0, separator)).trim();
    const value = separator === -1 ? "" : entry.slice(separator + 1).trim();

    if (key !== "") {
      labels[key] = value;
    }
  }

  return Object.keys(labels).length > 0 ? labels : undefined;
}

/**
 * Serialize a label-filter map back into `key=value` tag entries.
 */
export function formatLabelFilters(labels: Record<string, string> | undefined): string[] {
  return Object.entries(labels ?? {}).map(([key, value]) => value === "" ? key : `${key}=${value}`);
}

export interface LabelFilterSelectProps {
  value: Record<string, string> | undefined;
  onChange: (labels: Record<string, string> | undefined) => void;
  placeholder?: string;
  style?: CSSProperties;
}

/**
 * A compact label-filter input: pairs typed as `key=value` tags, emitted as
 * the equality-filter map the flow list queries accept (AND-combined).
 */
export function LabelFilterSelect({
  value,
  onChange,
  placeholder = "标签过滤，如 app=crm",
  style
}: LabelFilterSelectProps) {
  const entries = useMemo(() => formatLabelFilters(value), [value]);

  return (
    <Select<string[]>
      allowClear
      mode="tags"
      open={false}
      placeholder={placeholder}
      style={{ minWidth: 200, ...style }}
      value={entries}
      onChange={next => onChange(parseLabelFilters(next))}
    />
  );
}

export interface LabelsDisplayProps {
  labels?: Record<string, string>;
}

/**
 * Flow labels as compact `key: value` tags (`key` alone when the value is an
 * empty presence flag).
 */
export function LabelsDisplay({ labels }: LabelsDisplayProps) {
  const entries = Object.entries(labels ?? {});

  if (entries.length === 0) {
    return <Text type="secondary">-</Text>;
  }

  return (
    <Space wrap size={4}>
      {entries.map(([key, value]) => (
        <Tag key={key} style={{ marginInlineEnd: 0 }}>
          {value === "" ? key : `${key}: ${value}`}
        </Tag>
      ))}
    </Space>
  );
}
