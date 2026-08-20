import type { LoginChallengeRenderers } from "../login/props";

import { SsoLogin } from ".";
import { renderInRouter, screen, waitFor } from "../../../test-utils";
import { useAppStore } from "../../stores";

const handoff = "/?app_id=zlhis&code=one-time-code";
const DEPARTMENT_SELECTION = "department_selection";

const challengeRenderers = {
  [DEPARTMENT_SELECTION]: () => <p>请选择登录部门</p>
} as unknown as LoginChallengeRenderers;

beforeEach(() => {
  useAppStore.setState({ isAuthenticated: false, authTokens: undefined });
});

describe("SsoLogin", () => {
  it("shows progress while the handoff is being exchanged", async () => {
    // Never resolves: the exchange stays in flight for the whole assertion.
    const exchange = Promise.withResolvers<never>();
    const onLogin = vi.fn().mockReturnValue(exchange.promise);

    await renderInRouter(<SsoLogin onLogin={onLogin} />, { initialEntry: handoff });

    // The loader animates its description one character per element, so the
    // message is only whole once the text is concatenated.
    await waitFor(() => expect(document.body).toHaveTextContent("正在登录, 请稍后..."));
  });

  it("presents the challenge the exchange raises", async () => {
    const onLogin = vi.fn().mockResolvedValue({
      challengeToken: "challenge-token",
      challenge: {
        type: DEPARTMENT_SELECTION,
        data: {},
        required: true
      }
    });

    await renderInRouter(
      <SsoLogin challengeRenderers={challengeRenderers} onLogin={onLogin} onResolveChallenge={vi.fn()} />,
      { initialEntry: handoff }
    );

    expect(await screen.findByText("请选择登录部门")).toBeInTheDocument();
  });

  it("reports a refused handoff with a way back to the login page", async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error("expired"));
    await renderInRouter(<SsoLogin onLogin={onLogin} />, { initialEntry: handoff });

    expect(await screen.findByText("单点登录失败")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "返回登录" })).toBeInTheDocument();
  });

  it("reports a link carrying no handoff without calling the backend", async () => {
    const onLogin = vi.fn();
    await renderInRouter(<SsoLogin onLogin={onLogin} />, { initialEntry: "/" });

    expect(await screen.findByText("单点登录链接无效或已失效, 请返回原系统重新进入")).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });
});
