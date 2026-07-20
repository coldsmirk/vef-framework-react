import type { RunSearch } from "../../types";

import { useForm } from "@vef-framework-react/components";
import { describe, expect, it } from "vitest";

import { render, screen } from "../../../../components/test-utils";
import { RunAdvancedSearchFields, RunSearchFields } from "./search";

function SearchHarness({ advanced = false }: { advanced?: boolean }) {
  const form = useForm({ defaultValues: {} as RunSearch });

  return (
    <form.AppForm>
      <form.Form>
        {advanced ? <RunAdvancedSearchFields /> : <RunSearchFields />}
      </form.Form>
    </form.AppForm>
  );
}

describe("run-page search", () => {
  it("keeps only the schedule name in the inline search", () => {
    render(<SearchHarness />);

    expect(screen.getByPlaceholderText("调度名称")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("任务处理器")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("计划时间起", { selector: "label" })).not.toBeInTheDocument();
  });

  it("renders the detailed filters in the advanced search", () => {
    render(<SearchHarness advanced />);

    expect(screen.getByText("任务处理器", { selector: "label" })).toBeInTheDocument();
    expect(screen.getByText("状态", { selector: "label" })).toBeInTheDocument();
    expect(screen.getByText("节点", { selector: "label" })).toBeInTheDocument();
    expect(screen.getByText("计划时间起", { selector: "label" })).toBeInTheDocument();
    expect(screen.getByText("计划时间止", { selector: "label" })).toBeInTheDocument();
  });
});
