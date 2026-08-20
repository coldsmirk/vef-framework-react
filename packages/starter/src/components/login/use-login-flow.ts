import type { LoginChallenge, LoginParams, LoginResult, ResolveChallengeParams } from "./payload";

import { useRouter, useSearch } from "@tanstack/react-router";
import { showSuccessNotification } from "@vef-framework-react/components";
import { isBusinessError } from "@vef-framework-react/core";
import { encryptUsingRSA } from "@vef-framework-react/shared";
import { useMemo, useRef, useState } from "react";

import { INDEX_ROUTE_PATH } from "../../constants";
import { clearIdentityState } from "../../helpers/auth";
import { useAppStore } from "../../stores";
import { getRandomWelcomeMessage } from "./welcome-messages";

const DEFAULT_LOGIN_ERROR = "登录失败, 请稍后重试";

/**
 * Resolve a user-facing message from an unknown rejection. Business errors
 * carry the server-provided message verbatim; everything else (network
 * failures, unexpected runtime errors) falls back to a generic prompt so a raw
 * technical message is never surfaced to the user.
 */
function resolveErrorMessage(error: unknown): string {
  if (isBusinessError(error)) {
    return error.message;
  }

  return DEFAULT_LOGIN_ERROR;
}

interface PendingChallenge {
  token: string;
  challenge: LoginChallenge;
}

export interface UseLoginFlowOptions {
  /**
   * Submits credentials to the backend. Whatever it resolves with is fed
   * straight into the flow, so a challenge and a completed authentication are
   * handled by the same call site.
   */
  onLogin: (params: LoginParams) => Promise<LoginResult>;
  /**
   * Submits a challenge answer. Without it a challenge can be presented but
   * never answered, so wire it whenever the backend may issue one.
   */
  onResolveChallenge?: (params: ResolveChallengeParams) => Promise<LoginResult>;
  /**
   * The public key for encrypting credentials. When present, the returned
   * `encrypt` is available to the caller and to challenge renderers.
   */
  publicKey?: string;
  /**
   * Where to navigate once authentication completes. Defaults to the
   * `redirect` search parameter, then to the index route.
   */
  redirectTo?: string;
  /**
   * Replaces the built-in post-authentication effect (navigation and the
   * welcome notification). The session is written to the store before this
   * runs — that part is the framework's own state contract and is never
   * skipped, because the route guards read it.
   */
  onAuthenticated?: (result: LoginResult) => void | Promise<void>;
  /**
   * Receives the original rejection behind `error`. Useful for reporting;
   * `error` remains the message to render.
   */
  onError?: (error: unknown) => void;
}

export interface LoginFlow {
  /**
   * Submits credentials. Resolves once the result has been applied — a
   * challenge is now pending, or authentication completed and navigation ran.
   * Never rejects: failures surface through `error`.
   */
  login: (params: LoginParams) => Promise<void>;
  /**
   * The challenge awaiting an answer, or `null` when credentials are being
   * collected.
   */
  challenge: LoginChallenge | null;
  /**
   * Answers the pending challenge. Never rejects; failures surface through
   * `error`. A no-op when no challenge is pending.
   */
  resolve: (response: unknown) => Promise<void>;
  /**
   * Abandons the pending challenge and returns to credential entry. The held
   * challenge token is discarded, so the user must authenticate again.
   */
  cancel: () => void;
  /**
   * Whether a login or challenge call is in flight. Calls made while it is
   * true are ignored, so a double submit cannot start two attempts.
   */
  pending: boolean;
  /**
   * The message from the most recent failure, or `null`. Already localized and
   * safe to render.
   */
  error: string | null;
  /**
   * Clears `error`.
   */
  clearError: () => void;
  /**
   * Encrypts a plaintext with the configured public key. Absent when no
   * `publicKey` was given. May throw on an invalid key or empty input.
   */
  encrypt?: (plaintext: string) => string;
}

/**
 * The login state machine, without any presentation.
 *
 * Authentication is a loop rather than a single request: the backend answers a
 * login with either a session or a challenge, answering a challenge yields the
 * same two outcomes again, and only the caller's UI differs between a password
 * form, a single sign-on landing page, or any other entry point. This hook owns
 * that loop — the challenge cycle, error normalization, credential encryption,
 * and the store write plus navigation that complete a session — so an
 * application building its own login screen composes it instead of
 * reimplementing it.
 */
export function useLoginFlow({
  onLogin,
  onResolveChallenge,
  publicKey,
  redirectTo,
  onAuthenticated,
  onError
}: UseLoginFlowOptions): LoginFlow {
  const router = useRouter();
  const { redirect } = useSearch({ strict: false });

  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards re-entrancy inside a single tick, which `pending` cannot: it is
  // state, so a second call in the same turn would still read the stale false.
  const inFlight = useRef(false);
  const encrypt = useMemo(() => {
    if (!publicKey) {
      return;
    }

    return (plaintext: string) => encryptUsingRSA(plaintext, publicKey);
  }, [publicKey]);

  async function applyResult(result: LoginResult): Promise<void> {
    if (result.challenge && result.challengeToken) {
      const { challenge, challengeToken } = result;

      setPendingChallenge({ token: challengeToken, challenge });

      return;
    }

    if (!result.tokens) {
      return;
    }

    // The previous session's identity has to go before the new one is
    // announced: the layout guard reads `menuPathSet` in beforeLoad, ahead of
    // the loader that would refresh it.
    clearIdentityState();

    useAppStore.setState(state => {
      state.isAuthenticated = true;
      state.authTokens = result.tokens;
    });
    setPendingChallenge(null);

    if (onAuthenticated) {
      await onAuthenticated(result);

      return;
    }

    await router.invalidate();
    await router.navigate({
      to: redirectTo ?? redirect ?? INDEX_ROUTE_PATH,
      replace: true
    });

    showSuccessNotification(getRandomWelcomeMessage(), {
      title: result.message || "登录成功"
    });
  }

  async function run(request: () => Promise<LoginResult>): Promise<void> {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setPending(true);
    setError(null);

    try {
      await applyResult(await request());
    } catch (error_) {
      onError?.(error_);
      setError(resolveErrorMessage(error_));
    } finally {
      // eslint-disable-next-line require-atomic-updates -- the ref is a mutex, not derived state: this release is unconditional and does not depend on any value read before the await.
      inFlight.current = false;
      setPending(false);
    }
  }

  return {
    challenge: pendingChallenge?.challenge ?? null,
    pending,
    error,
    encrypt,
    login(params) {
      return run(() => onLogin(params));
    },
    resolve(response) {
      if (!pendingChallenge || !onResolveChallenge) {
        return Promise.resolve();
      }

      return run(() => onResolveChallenge({
        challengeToken: pendingChallenge.token,
        type: pendingChallenge.challenge.type,
        response
      }));
    },
    cancel() {
      setPendingChallenge(null);
      setError(null);
    },
    clearError() {
      setError(null);
    }
  };
}
