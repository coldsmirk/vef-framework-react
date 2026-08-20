import type { LoginResult } from "./payload";

import { act, renderRouterHook, waitFor } from "../../../test-utils";
import { useAppStore } from "../../stores";
import { useLoginFlow } from "./use-login-flow";

const tokens = { accessToken: "access-token" };
const DEPARTMENT_SELECTION = "department_selection";

function challengeResult(type: string, token = "challenge-token"): LoginResult {
  return {
    challengeToken: token,
    challenge: {
      type,
      data: { departments: [{ id: "d1" }] },
      required: true
    } as LoginResult["challenge"]
  };
}

beforeEach(() => {
  useAppStore.setState({ isAuthenticated: false, authTokens: undefined });
});

describe("useLoginFlow", () => {
  it("holds the challenge the backend answers a login with", async () => {
    const onLogin = vi.fn().mockResolvedValue(challengeResult("department_selection"));
    const { result } = await renderRouterHook(() => useLoginFlow({ onLogin, onResolveChallenge: vi.fn() }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    expect(result.current.challenge?.type).toBe("department_selection");
    expect(useAppStore.getState().isAuthenticated).toBe(false);
  });

  it("carries on to the next challenge the answer raises", async () => {
    const onLogin = vi.fn().mockResolvedValue(challengeResult("password_change"));
    const onResolveChallenge = vi.fn().mockResolvedValue(challengeResult("department_selection", "second-token"));
    const { result } = await renderRouterHook(() => useLoginFlow({ onLogin, onResolveChallenge }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });
    await act(async () => {
      await result.current.resolve("new-password");
    });

    expect(result.current.challenge?.type).toBe("department_selection");
  });

  it("establishes the session once the backend returns tokens", async () => {
    const onLogin = vi.fn().mockResolvedValue({ tokens });
    const onAuthenticated = vi.fn();
    const { result } = await renderRouterHook(() => useLoginFlow({ onLogin, onAuthenticated }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    expect(useAppStore.getState().isAuthenticated).toBe(true);
    expect(useAppStore.getState().authTokens).toEqual(tokens);
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("navigates to the redirect the login page was reached with", async () => {
    const onLogin = vi.fn().mockResolvedValue({ tokens });
    const { result, router } = await renderRouterHook(
      () => useLoginFlow({ onLogin }),
      { initialEntry: "/?redirect=/reports" }
    );

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    await waitFor(() => expect(router.state.location.pathname).toBe("/reports"));
  });

  it("drops the previous session's identity when a new session replaces it", async () => {
    useAppStore.setState({ menuPathSet: Object.freeze(new Set(["/only-the-previous-user-had-this"])) });

    const onLogin = vi.fn().mockResolvedValue({ tokens });
    const { result } = await renderRouterHook(() => useLoginFlow({ onLogin, onAuthenticated: vi.fn() }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    expect(useAppStore.getState().menuPathSet).toBeUndefined();
  });
});

describe("useLoginFlow when the request fails", () => {
  it("reports the failure without rejecting", async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error("boom"));
    const onError = vi.fn();
    const { result } = await renderRouterHook(() => useLoginFlow({ onLogin, onError }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    expect(result.current.error).toBe("登录失败, 请稍后重试");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().isAuthenticated).toBe(false);
  });

  it("ignores a second submit while the first is in flight", async () => {
    const pending = Promise.withResolvers<LoginResult>();
    const onLogin = vi.fn().mockReturnValue(pending.promise);
    const { result } = await renderRouterHook(() => useLoginFlow({ onLogin, onAuthenticated: vi.fn() }));

    act(() => {
      void result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
      void result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    await act(async () => {
      pending.resolve({ tokens });
      await pending.promise;
    });

    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});

describe("useLoginFlow with an auto-resolver", () => {
  it("answers a declared challenge without presenting it", async () => {
    const onLogin = vi.fn().mockResolvedValue(challengeResult("department_selection"));
    const onResolveChallenge = vi.fn().mockResolvedValue({ tokens });
    const { result } = await renderRouterHook(() => useLoginFlow({
      onLogin,
      onResolveChallenge,
      onAuthenticated: vi.fn(),
      autoResolve: { [DEPARTMENT_SELECTION]: () => "d1" }
    }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    expect(onResolveChallenge).toHaveBeenCalledWith({
      challengeToken: "challenge-token",
      type: "department_selection",
      response: "d1"
    });
    expect(result.current.challenge).toBeNull();
    expect(useAppStore.getState().isAuthenticated).toBe(true);
  });

  it("presents the challenge when its resolver declines", async () => {
    const onLogin = vi.fn().mockResolvedValue(challengeResult("department_selection"));
    const { result } = await renderRouterHook(() => useLoginFlow({
      onLogin,
      onResolveChallenge: vi.fn(),
      autoResolve: { [DEPARTMENT_SELECTION]: () => undefined }
    }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    expect(result.current.challenge?.type).toBe("department_selection");
  });

  it("falls back to presenting the challenge when the silent answer is rejected, without retrying", async () => {
    const onLogin = vi.fn().mockResolvedValue(challengeResult("department_selection"));
    const onResolveChallenge = vi.fn().mockRejectedValue(new Error("stale department"));
    const { result } = await renderRouterHook(() => useLoginFlow({
      onLogin,
      onResolveChallenge,
      autoResolve: { [DEPARTMENT_SELECTION]: () => "d1" }
    }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    await waitFor(() => expect(result.current.challenge?.type).toBe("department_selection"));
    expect(onResolveChallenge).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe("登录失败, 请稍后重试");
  });
});
