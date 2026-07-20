import { describe, expect, it } from "vitest";

import { ScheduleActionButtonGroup, ScheduleOperationButtonGroup } from "./helpers";

describe("schedule-page helpers", () => {
  it("exports the schedule Crud button groups", () => {
    expect(ScheduleActionButtonGroup).toBeDefined();
    expect(ScheduleOperationButtonGroup).toBeDefined();
  });
});
