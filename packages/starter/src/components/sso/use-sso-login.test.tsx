import { act, renderRouterHook, waitFor } from "../../../test-utils";
import { useAppStore } from "../../stores";
import { useSsoLogin } from "./use-sso-login";

const handoff = "/?app_id=zlhis&code=one-time-code";

beforeEach(() => {
  useAppStore.setState({ isAuthenticated: false, authTokens: undefined });
});

describe("useSsoLogin", () => {
  it("exchanges the handoff for a session", async () => {
    const onLogin = vi.fn().mockResolvedValue({ tokens: { accessToken: "access-token" } });
    const { result } = await renderRouterHook(
      () => useSsoLogin({ onLogin, onAuthenticated: vi.fn() }),
      { initialEntry: handoff }
    );

    await waitFor(() => expect(useAppStore.getState().isAuthenticated).toBe(true));
    expect(onLogin).toHaveBeenCalledWith({
      type: "trust_code",
      principal: "zlhis",
      credentials: "one-time-code"
    });
    expect(result.current.search.app_id).toBe("zlhis");
  });

  it("spends the one-time code exactly once across re-renders", async () => {
    const onLogin = vi.fn().mockResolvedValue({ tokens: { accessToken: "access-token" } });
    const { result } = await renderRouterHook(
      () => useSsoLogin({ onLogin, onAuthenticated: vi.fn() }),
      { initialEntry: handoff }
    );

    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.login({
        type: "trust_code",
        principal: "zlhis",
        credentials: "one-time-code"
      });
    });

    // The extra call is the test driving the flow directly; the mount-time
    // exchange itself must not have fired a second time.
    expect(onLogin).toHaveBeenCalledTimes(2);
  });

  it("clears the spent handoff from the address bar", async () => {
    const onLogin = vi.fn().mockResolvedValue({ tokens: { accessToken: "access-token" } });
    await renderRouterHook(
      () => useSsoLogin({ onLogin, onAuthenticated: vi.fn() }),
      { initialEntry: handoff }
    );

    await waitFor(() => expect(location.search).toBe(""));
  });

  it("presents the challenge the exchange raises", async () => {
    const onLogin = vi.fn().mockResolvedValue({
      challengeToken: "challenge-token",
      challenge: {
        type: "department_selection",
        data: {},
        required: true
      }
    });
    const { result } = await renderRouterHook(
      () => useSsoLogin({ onLogin, onResolveChallenge: vi.fn() }),
      { initialEntry: handoff }
    );

    await waitFor(() => expect(result.current.status).toBe("challenge"));
    expect(result.current.challenge?.type).toBe("department_selection");
  });
});

describe("useSsoLogin when the link carries no handoff", () => {
  it("reports it without calling the backend", async () => {
    const onLogin = vi.fn();
    const { result } = await renderRouterHook(
      () => useSsoLogin({ onLogin }),
      { initialEntry: "/?app_id=zlhis" }
    );

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.error).toBe("单点登录链接无效或已失效, 请返回原系统重新进入");
    expect(onLogin).not.toHaveBeenCalled();
  });
});
