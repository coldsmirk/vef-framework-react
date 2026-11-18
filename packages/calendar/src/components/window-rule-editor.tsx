import type { Window, WindowRule } from "../types";

import { Button, Card, Input, Labeled, Stack } from "@vef-framework-react/components";

import { WindowFields } from "./window-fields";

export interface WindowRuleEditorProps {
  value?: WindowRule;
  onChange?: (rule: WindowRule) => void;
}

function WindowList({
  windows,
  label,
  onChange
}: {
  windows: Window[];
  label: string;
  onChange: (windows: Window[]) => void;
}) {
  return (
    <Stack gap={12}>
      {windows.map((window, index) => (
        <Card
          key={index}
          size="small"
          title={`${label} ${index + 1}`}
          extra={(
            <Button
              aria-label={`删除${label} ${index + 1}`}
              size="small"
              type="text"
              onClick={() => onChange(windows.filter((_, i) => i !== index))}
            >
              删除
            </Button>
          )}
        >
          <WindowFields value={window} onChange={next => onChange(windows.map((w, i) => i === index ? next : w))} />
        </Card>
      ))}

      <Button block type="dashed" onClick={() => onChange([...windows, {}])}>{`添加${label}`}</Button>
    </Stack>
  );
}

const EMPTY_RULE: WindowRule = { windows: [] };

export function WindowRuleEditor({ value = EMPTY_RULE, onChange }: WindowRuleEditorProps) {
  return (
    <Stack gap={16}>
      <Labeled label="时区">
        <Input
          aria-label="时区"
          placeholder="使用服务器时区，如需指定可输入 Asia/Shanghai"
          value={value.timezone ?? ""}
          onChange={e => onChange?.({ ...value, timezone: e.target.value || undefined })}
        />
      </Labeled>

      <Labeled hint="同一窗口内所选条件须同时满足。不同窗口中任一开放即可。" label="开放窗口">
        <WindowList label="开放窗口" windows={value.windows} onChange={windows => onChange?.({ ...value, windows })} />
      </Labeled>

      <Labeled label="例外关闭">
        <WindowList
          label="例外关闭窗口"
          windows={value.blackouts ?? []}
          onChange={blackouts => onChange?.({ ...value, blackouts: blackouts.length > 0 ? blackouts : undefined })}
        />
      </Labeled>
    </Stack>
  );
}
