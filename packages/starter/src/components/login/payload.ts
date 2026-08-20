import type { AuthTokens } from "../../models";
import type { Register, ResolvedChallenges } from "../../types/common";

/**
 * Login mechanisms the project adds beyond the framework's own. Augment
 * `Register['loginParams']` with a union of payload shapes — an SMS code, a
 * scanned QR ticket, a corporate directory handoff — and every login entry
 * point accepts them without a cast.
 *
 * @example
 * declare module "@vef-framework-react/starter" {
 *   interface Register {
 *     loginParams: { type: "sms"; principal: string; credentials: string };
 *   }
 * }
 */
type RegisteredLoginParams = Register extends {
  loginParams: infer T extends BaseLoginParams;
} ? T : never;

/**
 * The payload for login.
 *
 * Covers the two mechanisms the framework's backend ships with, plus whatever
 * the project declared through `Register['loginParams']`.
 *
 * This is a union, where it once was the password shape alone. An `onLogin`
 * annotated with `PasswordLoginParams` therefore no longer satisfies it — a
 * parameter has to accept every mechanism the flow can send. Handlers that stay
 * contextually typed by the prop are unaffected; one typed explicitly against
 * the old meaning has to widen to `LoginParams` and narrow on `type`.
 */
export type LoginParams = PasswordLoginParams | TrustCodeLoginParams | RegisteredLoginParams;

/**
 * The base payload for authentication
 */
interface BaseLoginParams<T = unknown> {
  /**
   * The authentication type
   */
  type: string;
  /**
   * The user identifier (username, email, phone, etc.)
   */
  principal: string;
  /**
   * The authentication credentials
   */
  credentials: T;
}

/**
 * The payload for password-based login
 */
export interface PasswordLoginParams extends BaseLoginParams<string> {
  /**
   * The authentication type
   */
  type: "password";
}

/**
 * The payload for single sign-on, exchanging the one-time code a trust-login
 * gateway handed to the browser. `principal` is the app id that initiated the
 * handoff; the gateway echoes it on the redirect so the exchange names the same
 * application the code was issued for.
 */
export interface TrustCodeLoginParams extends BaseLoginParams<string> {
  /**
   * The authentication type
   */
  type: "trust_code";
}

/**
 * A challenge the user must complete during login (e.g., 2FA, department selection).
 *
 * When `Register['challenges']` is augmented by the consuming project, this becomes
 * a discriminated union narrowed per `type`, with `data` typed to the augmented
 * spec. Without augmentation, it degrades to `{ type: string; data: unknown }` —
 * exactly today's wire shape.
 */
export type LoginChallenge = {
  [K in keyof ResolvedChallenges]: {
    type: K;
    data: ResolvedChallenges[K]["data"];
    required: boolean;
  };
}[keyof ResolvedChallenges];

/**
 * The result of a login attempt.
 * When a challenge is pending, tokens is undefined and challengeToken + challenge are set.
 * When all challenges are resolved (or none were needed), tokens is set.
 */
export interface LoginResult {
  /**
   * Optional message to display to the user
   */
  message?: string;
  /**
   * Authentication tokens returned on successful login
   */
  tokens?: AuthTokens;
  /**
   * Token carrying intermediate challenge state
   */
  challengeToken?: string;
  /**
   * The pending challenge the user must complete
   */
  challenge?: LoginChallenge;
}

/**
 * The payload for submitting a challenge response back to the server.
 * Shape mirrors the backend security/auth.resolve_challenge action.
 */
export interface ResolveChallengeParams {
  /**
   * The token returned with the pending challenge that carries intermediate state.
   */
  challengeToken: string;
  /**
   * The challenge type identifier being resolved (must match the pending challenge).
   */
  type: string;
  /**
   * The user's answer to the challenge. The concrete shape is decided by each
   * challenge type — e.g. a department id string for "department_selection",
   * a TOTP code string for "totp", etc.
   */
  response: unknown;
}
