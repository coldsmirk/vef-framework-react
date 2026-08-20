import type { ReactNode } from "react";

import type { LoginChallenge } from "./payload";
import type { LoginChallengeRenderer, LoginChallengeRenderers } from "./props";
import type { LoginFlow } from "./use-login-flow";

import { Alert, Button, Group, Icon, Stack } from "@vef-framework-react/components";
import { SparklesIcon } from "lucide-react";

import * as styles from "./styles";

export interface LoginChallengeOutletProps {
  /**
   * The flow whose pending challenge is presented. Nothing renders while the
   * flow holds no challenge, so the outlet can sit unconditionally in a tree.
   */
  flow: LoginFlow;
  /**
   * One renderer per challenge type the backend may issue.
   */
  renderers?: LoginChallengeRenderers;
  /**
   * Presents a challenge no renderer is registered for. Defaults to an alert
   * naming the type, which is what turns "the backend added a challenge the
   * frontend has not caught up with" into a readable message instead of a
   * blank screen.
   */
  fallback?: (challenge: LoginChallenge) => ReactNode;
}

/**
 * Renders the challenge a login flow is waiting on, by looking up the renderer
 * registered for its type.
 *
 * Every entry point that can meet a challenge needs this same lookup and the
 * same answer for a type it does not know, so it lives here rather than inside
 * any one login screen.
 */
export function LoginChallengeOutlet({
  flow,
  renderers,
  fallback
}: LoginChallengeOutletProps) {
  const { challenge } = flow;

  if (!challenge) {
    return null;
  }

  // Indexing the per-key renderer map at runtime yields a union of function
  // types; widen to the default-generic form so the call site accepts
  // `LoginChallenge` (the full discriminated union) directly.
  const renderer = renderers?.[challenge.type] as LoginChallengeRenderer | undefined;

  if (!renderer) {
    return fallback
      ? fallback(challenge)
      : <UnsupportedChallenge challenge={challenge} onCancel={flow.cancel} />;
  }

  // Rendered as an element rather than called as a function. A plain call would
  // run the renderer's hooks inside this component's own hook list, so moving
  // from one challenge type to the next — which a chain such as department
  // selection followed by a forced password change does routinely — reuses the
  // previous renderer's hook slots and crashes. The key makes each challenge a
  // fresh instance, so state cannot carry over between two challenges of the
  // same type either.
  const Renderer = renderer;

  return (
    <Renderer
      key={challenge.type}
      cancel={flow.cancel}
      challenge={challenge}
      encrypt={flow.encrypt}
      error={flow.error}
      pending={flow.pending}
      resolve={flow.resolve}
    />
  );
}

interface UnsupportedChallengeProps {
  challenge: LoginChallenge;
  onCancel: () => void;
}

function UnsupportedChallenge({ challenge, onCancel }: UnsupportedChallengeProps) {
  return (
    <Stack gap="medium">
      <div css={styles.formHeader}>
        <h2>
          <Group align="center" gap="small">
            <Icon component={SparklesIcon} css={styles.formIcon} />
            继续登录
          </Group>
        </h2>

        <p css={styles.formSubtitle}>
          服务器要求完成额外验证步骤
        </p>
      </div>

      <Alert
        showIcon
        description={`未注册类型为「${challenge.type}」的挑战处理器，请联系系统管理员。`}
        title="不支持的登录挑战"
        type="warning"
      />

      <Button block size="large" onClick={onCancel}>
        返回登录
      </Button>
    </Stack>
  );
}
