import type { HttpClient } from "@vef-framework-react/core";

import type { DateRange, Day, PreviewWindowsParams, PreviewWindowsResult } from "../types";

import { createApiRequest, useApiClient } from "@vef-framework-react/core";
import { useMemo } from "react";

const RESOURCE = "sys/calendar";

export async function findCalendarDays(http: Readonly<HttpClient>, params: DateRange): Promise<Day[]> {
  const result = await http.post<Day[]>("/api", { data: createApiRequest(RESOURCE, "find_days", params), skipErrorMessage: true });

  return result.data;
}

export async function previewWindows(http: Readonly<HttpClient>, params: PreviewWindowsParams): Promise<PreviewWindowsResult> {
  const result = await http.post<PreviewWindowsResult>("/api", { data: createApiRequest(RESOURCE, "preview_windows", params), skipErrorMessage: true });

  return result.data;
}

export async function saveCalendarOverrides(http: Readonly<HttpClient>, params: { overrides: Day[] }): Promise<void> {
  await http.post("/api", { data: createApiRequest(RESOURCE, "save_overrides", params) });
}

export async function deleteCalendarOverrides(http: Readonly<HttpClient>, params: { dates: string[] }): Promise<void> {
  await http.post("/api", { data: createApiRequest(RESOURCE, "delete_overrides", params) });
}

export function useCalendarApi() {
  const client = useApiClient();

  return useMemo(() => {
    return {
      findCalendarDays: client.createQueryFn<Day[], DateRange>("calendar_find_days", http => params => findCalendarDays(http, params)),
      previewWindows: client.createQueryFn<PreviewWindowsResult, PreviewWindowsParams>("calendar_preview_windows", http => params => previewWindows(http, params)),
      saveCalendarOverrides: client.createMutationFn<void, { overrides: Day[] }>("calendar_save_overrides", http => params => saveCalendarOverrides(http, params)),
      deleteCalendarOverrides: client.createMutationFn<void, { dates: string[] }>("calendar_delete_overrides", http => params => deleteCalendarOverrides(http, params))
    };
  }, [client]);
}
