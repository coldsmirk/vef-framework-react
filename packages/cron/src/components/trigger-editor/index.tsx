import type { PreviewFiresParams, TriggerKind } from "../../types";
import type { TriggerFormValues } from "./helpers";

import { css } from "@emotion/react";
import {
  Alert,
  DatePicker,
  Empty,
  Flex,
  globalCssVars,
  Input,
  InputNumber,
  Labeled,
  Segmented,
  Select,
  Spin,
  Stack,
  Tag,
  Text
} from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";

import { useScheduleApi } from "../../api";
import { INTERVAL_UNITS } from "../duration";
import { TRIGGER_KIND_OPTIONS } from "../status/labels";
import { isTriggerComplete, triggerFormToParams } from "./helpers";

const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const PREVIEW_DEBOUNCE_MS = 400;

const INTERVAL_UNIT_OPTIONS = INTERVAL_UNITS.map(unit => {
  return { label: unit.label, value: unit.value };
});

const previewBoxCss = css({
  minHeight: 96,
  padding: globalCssVars.spacingSm,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary
});

// Debounce a serialized preview key so we probe the backend only after the
// user pauses typing, not on every keystroke.
function useDebouncedString(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function FiresPreview({
  startsAt,
  endsAt,
  trigger
}: { startsAt?: string; endsAt?: string; trigger: TriggerFormValues }) {
  const api = useScheduleApi();
  const complete = isTriggerComplete(trigger);

  const previewParams = useMemo<PreviewFiresParams>(
    () => {
      return {
        trigger: triggerFormToParams(trigger),
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined
      };
    },
    [trigger, startsAt, endsAt]
  );

  const paramsKey = JSON.stringify(previewParams);
  const debouncedKey = useDebouncedString(paramsKey, PREVIEW_DEBOUNCE_MS);
  const debouncedParams = useMemo(() => JSON.parse(debouncedKey) as PreviewFiresParams, [debouncedKey]);

  const {
    data,
    error,
    isFetching
  } = useQuery({
    enabled: complete,
    queryFn: api.previewFires,
    queryKey: [api.previewFires.key, debouncedParams],
    retry: false
  });

  const renderBody = () => {
    if (!complete) {
      return <Text type="secondary">完善触发配置后显示下次触发时间</Text>;
    }

    if (isFetching) {
      return <Spin size="small" />;
    }

    if (error) {
      return <Alert showIcon title={error.message} type="error" />;
    }

    const fires = data?.nextFires ?? [];

    if (fires.length === 0) {
      return <Empty description="在生效窗口内没有触发时间" />;
    }

    return (
      <Flex gap="small" wrap="wrap">
        {fires.map(fire => <Tag key={fire}>{fire}</Tag>)}
      </Flex>
    );
  };

  return (
    <Labeled label="下次触发时间">
      <div css={previewBoxCss}>{renderBody()}</div>
    </Labeled>
  );
}

export interface TriggerEditorProps {
  value: TriggerFormValues;
  onChange: (value: TriggerFormValues) => void;
  /**
   * The schedule's effective-window start, echoed into the fire preview.
   */
  startsAt?: string;
  /**
   * The schedule's effective-window end, echoed into the fire preview.
   */
  endsAt?: string;
}

/**
 * A trigger editor: a kind switch (cron / interval / once) revealing the
 * kind-specific fields, plus a debounced live preview of the next fire times.
 */
export function TriggerEditor({
  value,
  onChange,
  startsAt,
  endsAt
}: TriggerEditorProps) {
  const patch = (partial: Partial<TriggerFormValues>) => onChange({ ...value, ...partial });

  return (
    <Stack gap="middle">
      <Segmented<TriggerKind>
        options={TRIGGER_KIND_OPTIONS}
        value={value.kind}
        onChange={kind => patch({ kind })}
      />

      {value.kind === "cron" && (
        <Flex gap="small" wrap="wrap">
          <div style={{ flex: 1, minWidth: 220 }}>
            <Labeled label="Cron 表达式">
              <Input
                placeholder="如 0 9 * * * 或 @daily"
                value={value.expr}
                onChange={event => patch({ expr: event.target.value })}
              />
            </Labeled>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <Labeled label="时区">
              <Input
                placeholder="如 Asia/Shanghai，留空为服务器时区"
                value={value.timezone}
                onChange={event => patch({ timezone: event.target.value })}
              />
            </Labeled>
          </div>
        </Flex>
      )}

      {value.kind === "interval" && (
        <Labeled label="间隔">
          <Flex gap="small">
            <InputNumber
              min={1}
              style={{ flex: 1 }}
              value={value.intervalValue}
              onChange={next => patch({ intervalValue: typeof next === "number" ? next : 0 })}
            />

            <Select
              options={INTERVAL_UNIT_OPTIONS}
              style={{ width: 120 }}
              value={value.intervalUnit}
              onChange={intervalUnit => patch({ intervalUnit })}
            />
          </Flex>
        </Labeled>
      )}

      {value.kind === "once" && (
        <Labeled label="触发时间">
          <DatePicker
            showTime
            format={DATE_TIME_FORMAT}
            style={{ width: "100%" }}
            value={value.at ? dayjs(value.at) : undefined}
            onChange={(_, dateString) => patch({ at: typeof dateString === "string" ? dateString : "" })}
          />
        </Labeled>
      )}

      <FiresPreview endsAt={endsAt} startsAt={startsAt} trigger={value} />
    </Stack>
  );
}
