import type { DayKind } from "../types";

import { Alert, Button, Flex, Input, Page, PermissionGate, Select, showSuccessMessage, Stack, Text, Title } from "@vef-framework-react/components";
import { useMutation, useQueryClient } from "@vef-framework-react/core";
import { useState } from "react";

import { useCalendarApi } from "../api";
import { DAY_KINDS } from "../components/format-window-rule";
import { CalendarView, WorkCalendar } from "../components/work-calendar";
import { CALENDAR_PERMISSIONS } from "../permissions";

function CalendarMaintenance() {
  const api = useCalendarApi();
  const client = useQueryClient();
  const [dates, setDates] = useState(() => new Set<string>());
  const [kind, setKind] = useState<DayKind | "baseline">("holiday");
  const [name, setName] = useState("");

  async function saved() {
    setDates(new Set());
    showSuccessMessage("日历已保存");
    await Promise.all([api.findCalendarDays.key, api.previewWindows.key].map(key => client.invalidateQueries({ queryKey: [key] })));
  }

  const save = useMutation({ mutationFn: api.saveCalendarOverrides, onSuccess: saved });
  const restore = useMutation({ mutationFn: api.deleteCalendarOverrides, onSuccess: saved });
  const mutation = kind === "baseline" ? restore : save;
  const pending = save.isPending || restore.isPending;

  function submit() {
    if (kind === "baseline") {
      restore.mutate({ dates: [...dates] });
    } else {
      save.mutate({
        overrides: [...dates].map(date => {
          return {
            date,
            kind,
            name: name.trim()
          };
        })
      });
    }
  }

  return (
    <Stack gap={16}>
      <Text type="secondary">点选日期可加入或移出选择，拖动可连续选择多天。</Text>

      <fieldset
        disabled={pending}
        style={{
          border: 0,
          margin: 0,
          padding: 0,
          minWidth: 0
        }}
      >
        <Stack gap={16}>
          <Flex align="center" gap="small" wrap="wrap">
            <Text>{`已选 ${dates.size} 天`}</Text>
            <Button disabled={dates.size === 0} type="link" onClick={() => setDates(new Set())}>清除选择</Button>

            <Select<DayKind | "baseline">
              aria-label="设置日期类型"
              options={[...Object.entries(DAY_KINDS).map(([value, label]) => { return { value, label }; }), { label: "恢复基线", value: "baseline" }]}
              value={kind}
              onChange={setKind}
            />

            {kind !== "baseline" && (
              <Input
                aria-label="例外名称"
                maxLength={64}
                placeholder="例外名称（可选）"
                style={{ width: 200 }}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            )}

            <Button disabled={dates.size === 0 || dates.size > 400} loading={pending} type="primary" onClick={submit}>保存</Button>
          </Flex>

          {dates.size > 400 && <Text type="warning">每次最多保存 400 天，请减少所选日期。</Text>}
          {mutation.error && <Alert showIcon title={mutation.error.message} type="error" />}
          <CalendarView selection={{ dates, onChange: setDates }} />
        </Stack>
      </fieldset>
    </Stack>
  );
}

export function WorkCalendarPage() {
  return (
    <Page margin scrollable>
      <Stack gap={16}>
        <Title level={4} style={{ margin: 0 }}>工作日历</Title>

        <PermissionGate requiredPermissions={CALENDAR_PERMISSIONS.manage}>
          {allowed => allowed ? <CalendarMaintenance /> : <WorkCalendar />}
        </PermissionGate>
      </Stack>
    </Page>
  );
}
