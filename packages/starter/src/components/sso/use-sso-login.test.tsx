import { act, renderRouterHook, waitFor } from "../../../test-utils";
import { useAppStore } from "../../stores";
import { useSsoLogin } from "./use-sso-login";

const handoff = "/?app_id=zlhis&code=one-time-code";
const tokens = { accessToken: "access-token" };

beforeEach(() => {
  useAppStore.setState({ isAuthenticated: false, authTokens: undefined });
});

afterEach(() => {
  // The browser-history cases write to the address bar; put it back so a later
  // test starts from a known location.
  history.replaceState(null, "", "/");
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

  // Browser history, not the default memory one: memory history never touches
  // window.location, so asserting on the address bar under it holds whether or
  // not the code ever cleans anything.
  it("clears the handoff from the address bar before spending it", async () => {
    let searchWhenExchanged: string | undefined;
    const onLogin = vi.fn().mockImplementation(() => {
      searchWhenExchanged = location.search;

      return Promise.resolve({ tokens });
    });

    await renderRouterHook(
      () => useSsoLogin({ onLogin, onAuthenticated: vi.fn() }),
      { history: "browser", initialEntry: handoff }
    );

    await waitFor(() => expect(onLogin).toHaveBeenCalled());

    // Cleaning up afterwards instead would run once the exchange had already
    // navigated, and rewrite the destination's URL rather than this one.
    expect(searchWhenExchanged).toBe("");
    expect(location.search).toBe("");
  });

  it("keeps the handoff parameters readable after the address bar is cleaned", async () => {
    const onLogin = vi.fn().mockResolvedValue({ tokens });
    const { result, router } = await renderRouterHook(
      () => useSsoLogin({ onLogin, onAuthenticated: vi.fn() }),
      { history: "browser", initialEntry: `${handoff}&deptId=d1` }
    );

    await waitFor(() => expect(onLogin).toHaveBeenCalled());

    expect(result.current.search).toMatchObject({
      app_id: "zlhis",
      code: "one-time-code",
      deptId: "d1"
    });

    // Why the snapshot is load-bearing: @tanstack/history patches
    // history.replaceState, so cleaning the URL notifies the router and empties
    // its own search. A landing page or auto-resolver reading the live search
    // would find nothing.
    expect(router.state.location.search).toEqual({});
  });

  it("encrypts with the public key a challenge renderer is given", async () => {
    const onLogin = vi.fn().mockResolvedValue({ tokens });
    const { result } = await renderRouterHook(
      () => useSsoLogin({
        onLogin,
        onAuthenticated: vi.fn(),
        publicKey: "a-public-key"
      }),
      { initialEntry: handoff }
    );

    await waitFor(() => expect(onLogin).toHaveBeenCalled());

    // A handoff meets the same challenge chain a password login does, so a
    // forced password change must be able to encrypt what it collects.
    expect(result.current.encrypt).toBeTypeOf("function");
  });

  it("ends in a terminal failure when the challenge is abandoned", async () => {
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

    act(() => result.current.cancel());

    // The one-time code is spent, so there is nothing left to retry: reverting
    // to "exchanging" would leave the page on its spinner for good.
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.error).toBeTruthy();
  });

  it("ends in a terminal failure when the exchange yields neither session nor challenge", async () => {
    const onLogin = vi.fn().mockResolvedValue({});
    const { result } = await renderRouterHook(
      () => useSsoLogin({ onLogin }),
      { initialEntry: handoff }
    );

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.error).toBeTruthy();
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
