import type { ReactNode } from "react";

import type { ResolvedChallenges } from "../../types/common";
import type { LoginChallenge, LoginParams, LoginResult, ResolveChallengeParams } from "./payload";

/**
 * Arguments passed to a challenge renderer. Renderers are stateless from the
 * Login component's perspective — they consume `challenge` for prompt data
 * and call `resolve` / `cancel` to drive the flow forward or backward.
 *
 * Parameterised by `K`, the specific challenge type the renderer is bound to.
 * When projects augment `Register['challenges']`, `challenge.data` and the
 * `resolve` argument are both narrowed to the corresponding spec entry.
 */
export interface LoginChallengeRendererProps<
  K extends keyof ResolvedChallenges = keyof ResolvedChallenges
> {
  /**
   * The pending challenge to present (type identifier and challenge-specific data).
   */
  challenge: Extract<LoginChallenge, { type: K }>;
  /**
   * Submit the user's answer to the current challenge. The concrete shape of
   * `response` is dictated by the augmented `ResolvedChallenges[K]['response']`;
   * without augmentation, it falls back to `unknown`.
   * Returns once the resulting `LoginResult` has been applied — either the
   * next challenge is shown or authentication completes and navigation runs.
   */
  resolve: (response: ResolvedChallenges[K]["response"]) => Promise<void>;
  /**
   * Abandon the challenge and return to the initial credentials form.
   * The held challenge token is discarded; the user must log in again.
   */
  cancel: () => void;
  /**
   * Whether a resolve call is currently in flight. Useful for disabling
   * submit buttons inside the renderer.
   */
  pending: boolean;
  /**
   * The error message from the most recent failed `resolve` attempt, or
   * `null` when there is none. Set by the Login component when
   * `onResolveChallenge` rejects (e.g. a wrong verification code); renderers
   * should surface it inline so the user gets feedback. Cleared automatically
   * on the next `resolve` call and when the challenge is cancelled.
   */
  error?: string | null;
  /**
   * Encrypts a sensitive plaintext using the same scheme the initial login
   * uses for credentials. Present only when the Login component received a
   * `publicKey`; renderers handling sensitive responses (e.g. a new password
   * for `password_change`) should call this before invoking `resolve`.
   * Absent when no `publicKey` was configured.
   *
   * May throw if the underlying RSA encryption fails (invalid key, empty
   * plaintext, etc.). Renderers should catch in their submit handler and
   * surface a user-visible error rather than letting the rejection escape.
   */
  encrypt?: (plaintext: string) => string;
}

/**
 * A renderer responsible for displaying and resolving a single challenge type.
 * Business apps register one per challenge type they support; the Login
 * component looks up the renderer by `challenge.type` at runtime.
 */
export type LoginChallengeRenderer<
  K extends keyof ResolvedChallenges = keyof ResolvedChallenges
> = (props: LoginChallengeRendererProps<K>) => ReactNode;

/**
 * The full renderer registry — one renderer per known challenge type. When
 * `Register['challenges']` is augmented, TypeScript enforces exhaustiveness
 * (every declared challenge must have a renderer) and per-key typing of the
 * `challenge.data` / `resolve` payloads.
 */
export type LoginChallengeRenderers = {
  [K in keyof ResolvedChallenges]: LoginChallengeRenderer<K>;
};

/**
 * Answers a single challenge type from data the page already holds, without
 * showing it. Return `undefined` to decline and let the renderer present the
 * challenge normally.
 *
 * Validate the answer against the challenge's own payload before returning it —
 * `challenge.data` carries the options the server is willing to accept, and a
 * pre-check keeps a stale value from spending an attempt against the backend's
 * brute-force guard.
 */
export type LoginChallengeAutoResolver<
  K extends keyof ResolvedChallenges = keyof ResolvedChallenges
> = (challenge: Extract<LoginChallenge, { type: K }>) => ResolvedChallenges[K]["response"] | undefined;

/**
 * Auto-resolvers keyed by challenge type.
 *
 * Deliberately partial where `LoginChallengeRenderers` is exhaustive:
 * presenting a challenge is mandatory, answering one on the user's behalf is
 * opt-in per type. A challenge type absent here can never be resolved from
 * ambient data — which is the point, since silently answering a second factor
 * from a URL parameter would be a hole rather than a convenience.
 */
export type LoginChallengeAutoResolvers = {
  [K in keyof ResolvedChallenges]?: LoginChallengeAutoResolver<K>;
};

/**
 * The shared subset of LoginProps, independent of whether the flow may
 * surface challenges.
 */
interface BaseLoginProps {
  /**
   * The logo of the login page.
   */
  logo?: ReactNode;
  /**
   * The title of the login page.
   */
  title?: string;
  /**
   * The description of the login page.
   */
  description?: string;
  /**
   * The public key for encrypting credentials (and sensitive challenge
   * responses via `LoginChallengeRendererProps.encrypt`).
   */
  publicKey?: string;
  /**
   * The callback function for the login.
   */
  onLogin: (params: LoginParams) => Promise<LoginResult>;
}

/**
 * Challenge-aware Login wiring. `onResolveChallenge` and `challengeRenderers`
 * are required together: a server that can return challenges needs both a
 * transport (`onResolveChallenge`) and a presenter (`challengeRenderers`).
 */
interface LoginPropsWithChallenge {
  onResolveChallenge: (params: ResolveChallengeParams) => Promise<LoginResult>;
  challengeRenderers: LoginChallengeRenderers;
}

/**
 * Login wiring for backends that never issue challenges.
 */
interface LoginPropsWithoutChallenge {
  onResolveChallenge?: never;
  challengeRenderers?: never;
}

/**
 * The props of the Login component. Either both challenge hooks are wired
 * up, or neither is — partial wiring would leave the UI stranded on a
 * challenge it cannot dispatch.
 */
export type LoginProps = BaseLoginProps & (LoginPropsWithChallenge | LoginPropsWithoutChallenge);
