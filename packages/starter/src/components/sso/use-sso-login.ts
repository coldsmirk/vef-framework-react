import type { LoginParams, LoginResult, ResolveChallengeParams } from "../login/payload";
import type { LoginChallengeAutoResolvers } from "../login/props";
import type { LoginFlow } from "../login/use-login-flow";

import { useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAppStore } from "../../stores";
import { useLoginFlow } from "../login/use-login-flow";

/**
 * Query parameters of the framework's own trust-login handoff, as the gateway
 * appends them to the redirect it sends the browser to.
 */
export const SSO_APP_ID_PARAM = "app_id";
export const SSO_CODE_PARAM = "code";

const INVALID_HANDOFF_ERROR = "单点登录链接无效或已失效, 请返回原系统重新进入";
const ABANDONED_HANDOFF_ERROR = "单点登录未完成, 请返回原系统重新进入或改用账号登录";

/**
 * The handoff's query parameters, exactly as the gateway left them. Values are
 * whatever the URL carried, so a reader narrows before using one.
 */
export type SsoHandoffSearch = Record<string, unknown>;

/**
 * Reads the framework's trust-login handoff. Returns `undefined` when the link
 * carries no usable one, which is reported as an invalid link rather than sent
 * to the server.
 */
export function readTrustCodeHandoff(search: SsoHandoffSearch): LoginParams | undefined {
  const appId = search[SSO_APP_ID_PARAM];
  const code = search[SSO_CODE_PARAM];

  if (typeof appId !== "string" || !appId || typeof code !== "string" || !code) {
    return undefined;
  }

  return {
    type: "trust_code",
    principal: appId,
    credentials: code
  };
}

/**
 * Drops the handoff from the address bar.
 *
 * Called as soon as the parameters have been read, not once the exchange
 * settles: the code is about to be spent either way, and by the time the
 * exchange resolves the browser may already be on the destination page — where
 * rewriting the URL to its bare pathname would throw away that page's own query
 * string and hash.
 *
 * Nothing in the flow reads the URL afterwards, because `useSsoLogin` hands out
 * a snapshot of the search taken at mount instead. That matters: `replaceState`
 * is monkey-patched by `@tanstack/history`, so this notifies the router and
 * empties its in-memory search as well.
 */
function clearHandoffFromUrl(): void {
  history.replaceState(null, "", location.pathname);
}

export interface UseSsoLoginOptions {
  /**
   * Exchanges the handoff for a session. The same backend call an ordinary
   * login uses — single sign-on is a credential type, not a separate endpoint.
   */
  onLogin: (params: LoginParams) => Promise<LoginResult>;
  /**
   * Submits a challenge answer. A handoff runs the full challenge chain, so
   * wire it unless the backend cannot issue challenges.
   */
  onResolveChallenge?: (params: ResolveChallengeParams) => Promise<LoginResult>;
  /**
   * RSA public key for encrypting secrets a challenge collects, matching the
   * `<Login>` prop. A handoff runs the same challenge chain as a password
   * login, so a user whose password expired meets `password_change` here too —
   * and without the key its renderer would submit the new password in clear
   * text to a backend configured to expect it encrypted.
   */
  publicKey?: string;
  /**
   * Builds the exchange request from the handoff's query parameters. Returning
   * `undefined` marks the link as invalid without calling the server.
   * Defaults to the framework's trust-login convention.
   */
  readHandoff?: (search: SsoHandoffSearch) => LoginParams | undefined;
  /**
   * Where to navigate once the session is established. Defaults to the
   * `redirect` search parameter, then to the index route.
   */
  redirectTo?: string;
  /**
   * Replaces the built-in post-authentication effect.
   */
  onAuthenticated?: (result: LoginResult) => void | Promise<void>;
  /**
   * Answers selected challenges from the handoff's own parameters. The usual
   * case is a department the originating system already picked.
   */
  autoResolve?: LoginChallengeAutoResolvers;
  /**
   * Receives the original rejection behind `error`.
   */
  onError?: (error: unknown) => void;
}

export interface SsoLoginFlow extends LoginFlow {
  /**
   * What the page should be showing. `exchanging` also covers the frame before
   * the exchange starts, so a landing page never renders an empty state.
   */
  status: "exchanging" | "challenge" | "failed";
  /**
   * The handoff's query parameters, snapshotted at mount. A custom landing page
   * reads its own extra parameters from here, and a challenge auto-resolver
   * reads the answers the link carried — both keep working after the address
   * bar is cleaned, which the live router search does not: clearing the URL
   * goes through `replaceState`, which `@tanstack/history` patches to notify
   * the router, so its own search empties at that moment.
   */
  search: SsoHandoffSearch;
}

/**
 * Exchanges a single sign-on handoff for a session, once per mount.
 *
 * The exchange is an ordinary login carrying a one-time code instead of a
 * password, so everything after it — the challenge chain, token issuance, the
 * store write, navigation — is the shared login flow. What is specific to a
 * handoff is only what happens around it: reading the code out of the URL,
 * spending it exactly once, and clearing it afterwards.
 *
 * Note what this deliberately does not do: it never short-circuits when a
 * session already exists. A handoff may well arrive at an app the user is
 * already signed into as somebody else, and bouncing them to the target page
 * would silently keep the wrong identity.
 */
export function useSsoLogin({
  onLogin,
  onResolveChallenge,
  readHandoff = readTrustCodeHandoff,
  redirectTo,
  onAuthenticated,
  autoResolve,
  onError,
  publicKey
}: UseSsoLoginOptions): SsoLoginFlow {
  const liveSearch = useSearch({ strict: false }) as SsoHandoffSearch;
  // Snapshot at mount. Clearing the handoff out of the address bar notifies the
  // router, so the live search empties the moment the exchange starts — while
  // the parameters the link carried stay relevant for as long as the page
  // lives: a custom landing page renders from them, and an auto-resolver
  // answers a challenge raised later with them.
  const handoffSearch = useRef(liveSearch);
  const isAuthenticated = useAppStore(state => state.isAuthenticated);

  const flow = useLoginFlow({
    onLogin,
    onResolveChallenge,
    redirectTo,
    onAuthenticated,
    autoResolve,
    onError,
    publicKey
  });

  const [linkError, setLinkError] = useState<string | null>(null);
  const [spent, setSpent] = useState(false);
  // The handoff is spent once per mount. This is not the flow's in-flight
  // mutex under another name: that one only refuses calls that overlap, and it
  // happens to cover StrictMode's double invocation because both land in the
  // same tick. It would not cover an effect re-run after the exchange settled,
  // which is one added dependency away.
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) {
      return;
    }

    exchanged.current = true;

    const params = readHandoff(handoffSearch.current);

    // Cleared before the exchange rather than after it: the credential leaves
    // the address bar at the first moment it can, and the exchange is free to
    // navigate away without this racing the destination's own URL.
    clearHandoffFromUrl();

    if (!params) {
      setLinkError(INVALID_HANDOFF_ERROR);

      return;
    }

    void flow.login(params).then(() => setSpent(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps -- the handoff is spent exactly once per mount; re-running on any changed identity would replay a one-time code the server has already consumed.
  }, []);

  // A spent handoff that produced neither a session nor a pending challenge is
  // over, not still in flight — the user cancelled the challenge, or the result
  // carried nothing to act on. Without this the page would sit on its spinner
  // forever, and the one-time code is gone, so nothing can restart it.
  const abandoned = spent && !flow.challenge && !isAuthenticated;
  const error = flow.error ?? linkError ?? (abandoned ? ABANDONED_HANDOFF_ERROR : null);

  return {
    ...flow,
    error,
    search: handoffSearch.current,
    status: flow.challenge ? "challenge" : error ? "failed" : "exchanging"
  };
}
