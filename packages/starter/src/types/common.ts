import type { AnyObject, LiteralUnion } from "@vef-framework-react/shared";

export type Gender = "male" | "female" | "unknown";

export type UserMenuType = LiteralUnion<"directory" | "menu" | "view" | "report", string>;

/**
 * App-specific extra metadata a menu may carry beyond `params` / `search`.
 * Defaults to an open record; augment `Register['menuMeta']` to type the extra
 * keys exactly (which also closes `meta` to them).
 */
type MenuMetaExtra = Register extends {
  menuMeta: infer T extends AnyObject;
} ? T : Record<string, unknown>;

/**
 * Metadata a menu binds for navigation and active-menu resolution. `params` and
 * `search` are flat string maps — both serialize into the URL, where non-string
 * values carry no meaning, and each menu binds its own keys, so they are fixed
 * rather than globally typed. Host apps type any extra `meta` keys via
 * `Register['menuMeta']`.
 */
export type UserMenuMeta = {
  params?: Record<string, string>;
  search?: Record<string, string>;
} & MenuMetaExtra;

export interface UserMenu {
  type: UserMenuType;
  path: string;
  name: string;
  icon?: string;
  meta?: UserMenuMeta;
  children?: UserMenu[];
}

/**
 * Extension registry for framework types.
 *
 * Projects augment this interface via `declare module` to refine
 * extensible fields such as `UserInfo['details']` or the set of
 * login challenge types the backend may issue.
 *
 * @example
 * declare module "@vef-framework-react/starter" {
 *   interface Register {
 *     appCustomState: {
 *       appId?: string;
 *     };
 *     menuMeta: { badge?: number };
 *     userDetails: {
 *       department: string;
 *       organization: string;
 *     };
 *     challenges: {
 *       department_selection: {
 *         data: { departments: Array<{ id: string; name: string }> };
 *         response: string;
 *       };
 *       totp: { response: string };
 *     };
 *   }
 * }
 */
export interface Register {
  // empty by default; project augments via declare module
}

export type AppCustomState = Register extends {
  appCustomState: infer T extends AnyObject;
} ? T : AnyObject;

/**
 * Default shape of `UserInfo['details']` before projects augment `Register`.
 */
export type UserDetails = Record<string, unknown>;

type ResolvedUserDetails = Register extends {
  userDetails: infer T extends UserDetails;
} ? T : UserDetails;

/**
 * Contract for a single login challenge type. `data` is the payload the
 * server attaches to the challenge for the renderer to display; `response`
 * is the value the renderer feeds back to `resolve`.
 */
export interface ChallengeSpec {
  data?: unknown;
  response: unknown;
}

/**
 * Resolved challenge registry. Falls back to an open `Record` so codebases
 * that never augment `Register['challenges']` retain today's loose typing.
 */
export type ResolvedChallenges = Register extends {
  challenges: infer T extends Record<string, ChallengeSpec>;
} ? T : Record<string, ChallengeSpec>;

export interface UserInfo {
  id: string;
  name: string;
  gender: Gender;
  avatar?: string;
  permissionTokens: string[];
  menus: UserMenu[];
  details: ResolvedUserDetails;
}

export interface OrderSpec {
  column: string;
  direction: "asc" | "desc";
}
