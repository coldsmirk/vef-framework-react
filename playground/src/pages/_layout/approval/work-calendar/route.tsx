import { createFileRoute } from "@tanstack/react-router";
import { CALENDAR_PERMISSIONS, WorkCalendarPage } from "@vef-framework-react/calendar";
import { Flex, Segmented } from "@vef-framework-react/components";
import { AppContextProvider, useAppContext } from "@vef-framework-react/core";
import { useMemo, useState } from "react";

function CalendarScenario() {
  const app = useAppContext();
  const [mode, setMode] = useState<"manage" | "view">("manage");
  const viewer = useMemo(() => {
    return { ...app, hasPermission: (token: string) => token !== CALENDAR_PERMISSIONS.manage && (app.hasPermission?.(token) ?? true) };
  }, [app]);
  return (
    <Flex vertical style={{ height: "100%" }}>
      <Segmented<"manage" | "view">
        aria-label="日历演示身份"
        options={[{ label: "维护人员", value: "manage" }, { label: "只读人员", value: "view" }]}
        style={{ alignSelf: "flex-start", margin: "8px 12px 0" }}
        value={mode}
        onChange={setMode}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <AppContextProvider value={mode === "view" ? viewer : app}><WorkCalendarPage /></AppContextProvider>
      </div>
    </Flex>
  );
}

export const Route = createFileRoute("/_layout/approval/work-calendar")({ component: CalendarScenario });
