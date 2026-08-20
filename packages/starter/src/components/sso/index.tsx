import type { LoginChallengeRenderers } from "../login/props";
import type { UseSsoLoginOptions } from "./use-sso-login";

import { Link } from "@tanstack/react-router";
import { Alert, Button, Loader, Stack } from "@vef-framework-react/components";

import { LOGIN_ROUTE_PATH } from "../../constants";
import { LoginChallengeOutlet } from "../login/challenge-outlet";
import * as styles from "./styles";
import { useSsoLogin } from "./use-sso-login";

export interface SsoLoginProps extends UseSsoLoginOptions {
  /**
   * One renderer per challenge type the backend may issue. A handoff runs the
   * same challenge chain a password login does — the originating system
   * authenticated the user, it did not satisfy this application's login policy.
   */
  challengeRenderers?: LoginChallengeRenderers;
}

/**
 * The default single sign-on landing page: it exchanges the handoff in the URL
 * for a session, presents any challenge the exchange raises, and reports a
 * failed handoff with a way back to the ordinary login.
 *
 * It is deliberately plain and takes no slots. An application that wants its
 * own landing screen writes one over `useSsoLogin` and hands it to
 * `createSsoRouteOptions` as `component` — that keeps the exchange, the
 * one-time semantics and the challenge chain shared, while the presentation is
 * entirely the application's.
 */
export function SsoLogin({ challengeRenderers, ...options }: SsoLoginProps) {
  const flow = useSsoLogin(options);

  return (
    <div css={styles.page}>
      <div css={styles.panel}>
        {flow.status === "exchanging"
          && <Loader description="正在登录, 请稍后..." descriptionSize={16} size={40} />}

        {flow.status === "challenge"
          && <LoginChallengeOutlet flow={flow} renderers={challengeRenderers} />}

        {flow.status === "failed" && (
          <Stack gap="medium">
            <Alert
              showIcon
              description={flow.error ?? undefined}
              title="单点登录失败"
              type="error"
            />

            <Link to={LOGIN_ROUTE_PATH}>
              <Button block size="large">
                返回登录
              </Button>
            </Link>
          </Stack>
        )}
      </div>
    </div>
  );
}

export { readTrustCodeHandoff, SSO_APP_ID_PARAM, SSO_CODE_PARAM, useSsoLogin, type SsoHandoffSearch, type SsoLoginFlow, type UseSsoLoginOptions } from "./use-sso-login";
