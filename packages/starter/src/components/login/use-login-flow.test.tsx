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

  it("does not report a post-authentication failure as a login failure", async () => {
    const onLogin = vi.fn().mockResolvedValue({ tokens });
    const onAuthenticated = vi.fn().mockRejectedValue(new Error("prefetch failed"));
    const onError = vi.fn();
    const { result } = await renderRouterHook(() => useLoginFlow({
      onAuthenticated,
      onError,
      onLogin
    }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    // The session is stored, so the attempt succeeded. Surfacing what came
    // afterwards through `error` would render "登录失败" over an authenticated
    // session, on a form that can no longer accomplish anything.
    expect(useAppStore.getState().isAuthenticated).toBe(true);
    expect(result.current.error).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("ignores cancel while a challenge answer is in flight", async () => {
    const onLogin = vi.fn().mockResolvedValue(challengeResult("department_selection"));
    // Never settles: the answer stays with the server for the whole test.
    const onResolveChallenge = vi.fn().mockReturnValue(new Promise<never>(() => {
      // Intentionally never resolved.
    }));
    const { result } = await renderRouterHook(() => useLoginFlow({ onLogin, onResolveChallenge }));

    await act(async () => {
      await result.current.login({
        type: "password",
        principal: "u",
        credentials: "p"
      });
    });

    act(() => {
      void result.current.resolve("d1");
    });
    await waitFor(() => expect(result.current.pending).toBe(true));

    act(() => result.current.cancel());

    // The answer is already with the server and its result will still be
    // applied, so clearing the challenge here would show the credentials form
    // for as long as the request takes and then replace it again.
    expect(result.current.challenge?.type).toBe("department_selection");
  });
});
