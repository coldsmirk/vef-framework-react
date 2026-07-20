import type { ScheduleSearch } from "../../types";

import { useForm } from "@vef-framework-react/components";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, render, screen } from "../../../../components/test-utils";
import { ScheduleAdvancedSearchFields, ScheduleSearchFields } from "./search";

function listJobs(): string[] {
  return ["hr.org.department_snapshot.backup_all"];
}

function createListJobsQuery(): typeof listJobs {
  return listJobs;
}

function createJobApiClient() {
  const apiClient = createTestApiClient();
  const listJobsQuery = apiClient.createQueryFn<string[]>(
    "cron_schedule_list_jobs",
    createListJobsQuery
  );

  vi.spyOn(apiClient, "createQueryFn").mockReturnValue(listJobsQuery as never);

  return apiClient;
}

function SearchHarness({ advanced = false }: { advanced?: boolean }) {
  const form = useForm({ defaultValues: {} as ScheduleSearch });

  return (
    <form.AppForm>
      <form.Form>
        {advanced ? <ScheduleAdvancedSearchFields /> : <ScheduleSearchFields />}
      </form.Form>
    </form.AppForm>
  );
}

describe("schedule-page search", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps only the schedule name in the inline search", () => {
    render(<SearchHarness />);

    expect(screen.getByPlaceholderText("名称")).toBeInTheDocument();
    expect(screen.queryByText("任务处理器", { selector: "label" })).not.toBeInTheDocument();
    expect(screen.queryByText("触发方式", { selector: "label" })).not.toBeInTheDocument();
    expect(screen.queryByText("状态", { selector: "label" })).not.toBeInTheDocument();
  });

  it("renders the detailed filters in the advanced search", () => {
    render(<SearchHarness advanced />, { apiClient: createJobApiClient() });

    expect(screen.getByText("任务处理器", { selector: "label" })).toBeInTheDocument();
    expect(screen.getByText("触发方式", { selector: "label" })).toBeInTheDocument();
    expect(screen.getByText("状态", { selector: "label" })).toBeInTheDocument();
  });
});
