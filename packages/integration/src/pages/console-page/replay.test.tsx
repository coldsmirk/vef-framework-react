import type { InvocationLog, ReplayParams, ReplayResult } from "../../types";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createTestApiClient, render, screen } from "../../../../components/test-utils";
import { ReplayPanel } from "./replay";

const REPLAY_PERMISSION = "integration.log.replay";

function logOf(overrides: Partial<InvocationLog>): InvocationLog {
  return {
    id: "log-1",
    createdAt: "2026-09-28 10:00:00",
    createdBy: "system",
    systemCode: "his",
    contractCode: "patient.query",
    direction: "outbound",
    failureKind: "upstream",
    durationMs: 120,
    input: { idCardNo: "110" },
    output: null,
    error: "HIS returned 500",
    requestId: "req-1",
    replayable: true,
    ...overrides
  };
}

const REPLAY_RESULT: ReplayResult = {
  durationMs: 80,
  input: { idCardNo: "110" },
  output: { name: "张三" },
  httpTrace: [],
  definitionChanged: true
};

function createReplay(result: ReplayResult = REPLAY_RESULT) {
  const handler = vi.fn<(params: ReplayParams) => Promise<ReplayResult>>(() => Promise.resolve(result));
  const replay = createTestApiClient().createMutationFn<ReplayResult, ReplayParams>("integration_log_replay", () => handler);

  return { handler, replay };
}

describe("ReplayPanel", () => {
  describe("when the entry kept no replay payload", () => {
    it("explains why it cannot be replayed", () => {
      const { replay } = createReplay();

      render(<ReplayPanel log={logOf({ replayable: false })} permission={REPLAY_PERMISSION} replay={replay} />);

      expect(screen.getByText("该调用未保留重放数据（需开启 vef.integration.log.replay）")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /重\s*放/ })).not.toBeInTheDocument();
    });
  });

  describe("when the entry is an outbound call", () => {
    it("asks for confirmation before calling the external system", async () => {
      const user = userEvent.setup();
      const { handler, replay } = createReplay();

      render(<ReplayPanel log={logOf({})} permission={REPLAY_PERMISSION} replay={replay} />);
      await user.click(screen.getByRole("button", { name: /重\s*放/ }));

      expect(screen.getByText("出站重放会真实调用外部系统，确认继续？")).toBeInTheDocument();
      expect(handler).not.toHaveBeenCalled();
    });

    it("replays the entry and compares the outcome with the original", async () => {
      const user = userEvent.setup();
      const { handler, replay } = createReplay();

      render(<ReplayPanel log={logOf({})} permission={REPLAY_PERMISSION} replay={replay} />);
      await user.click(screen.getByRole("button", { name: /重\s*放/ }));
      await user.click(screen.getByRole("button", { name: /确\s*定/ }));

      expect(await screen.findByText("重放结果")).toBeInTheDocument();
      expect(screen.getByText("原始调用")).toBeInTheDocument();
      expect(screen.getByText("契约、系统或适配器在这次调用之后修改过，结果差异可能来自这些修改")).toBeInTheDocument();
      expect(handler).toHaveBeenCalledWith({ id: "log-1", script: undefined });
    });
  });

  describe("when the entry is an inbound delivery", () => {
    it("replays without confirmation, since no business code runs again", async () => {
      const user = userEvent.setup();
      const { handler, replay } = createReplay({ ...REPLAY_RESULT, definitionChanged: false });

      render(<ReplayPanel log={logOf({ direction: "inbound" })} permission={REPLAY_PERMISSION} replay={replay} />);
      await user.click(screen.getByRole("button", { name: /重\s*放/ }));

      expect(await screen.findByText("重放结果")).toBeInTheDocument();
      expect(handler).toHaveBeenCalledWith({ id: "log-1", script: undefined });
      expect(screen.queryByText("契约、系统或适配器在这次调用之后修改过，结果差异可能来自这些修改")).not.toBeInTheDocument();
    });
  });

  describe("when the operator lacks the replay permission", () => {
    it("hides the replay action", () => {
      const { replay } = createReplay();

      render(
        <ReplayPanel log={logOf({})} permission={REPLAY_PERMISSION} replay={replay} />,
        { appContext: { hasPermission: () => false } }
      );

      expect(screen.queryByRole("button", { name: /重\s*放/ })).not.toBeInTheDocument();
    });
  });
});
