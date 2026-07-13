import type { LiteralUnion } from "@vef-framework-react/shared";

import { Alert, Button, Group, Icon, Stack, useForm } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";

import * as styles from "./styles";

/**
 * The challenge type identifier for forced password change, aligned with the
 * backend `security.ChallengeTypePasswordChange`.
 */
export const PASSWORD_CHANGE_CHALLENGE_TYPE = "password_change";

/**
 * Why the server forces a password change. `first_login` and `expired` are the
 * backend's predefined reasons; hosts may define additional ones.
 */
export type PasswordChangeReason = LiteralUnion<"first_login" | "expired", string>;

/**
 * The challenge `data` payload for a forced password change, aligned with the
 * backend `security.PasswordChangeChallengeData`.
 */
export interface PasswordChangeChallengeData {
  reason: PasswordChangeReason;
  meta?: Record<string, unknown>;
}

/**
 * The `Register['challenges']` entry for the built-in password-change
 * renderer. Hosts wire it up via module augmentation:
 *
 * @example
 * declare module "@vef-framework-react/starter" {
 *   interface Register {
 *     challenges: {
 *       [PASSWORD_CHANGE_CHALLENGE_TYPE]: PasswordChangeChallengeSpec;
 *     };
 *   }
 * }
 */
export interface PasswordChangeChallengeSpec {
  data: PasswordChangeChallengeData;
  /**
   * The new password — encrypted with the login `publicKey` when one is
   * configured, plaintext otherwise.
   */
  response: string;
}

/**
 * Props shaped to stay assignable to `LoginChallengeRenderers` entries both
 * with and without a `Register['challenges']` augmentation: `challenge.data`
 * stays wide (`unknown`, narrowed internally) while `resolve` stays narrow
 * (the renderer only ever submits a string).
 */
export interface PasswordChangeChallengeProps {
  challenge: {
    /**
     * The server-provided {@link PasswordChangeChallengeData}; treated as
     * untrusted wire data and read defensively.
     */
    data?: unknown;
  };
  resolve: (response: string) => Promise<void>;
  cancel: () => void;
  pending: boolean;
  error?: string | null;
  /**
   * Provided by the Login component when a `publicKey` is configured; the new
   * password is encrypted before it is submitted.
   */
  encrypt?: (plaintext: string) => string;
}

const REASON_SUBTITLES: Record<string, string> = {
  first_login: "首次登录需要设置新密码, 设置后将直接完成登录",
  expired: "您的密码已过期, 请设置新密码后继续登录"
};

const DEFAULT_SUBTITLE = "请设置新密码后继续登录";

function readReason(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const { reason } = data as Partial<PasswordChangeChallengeData>;
  return typeof reason === "string" ? reason : undefined;
}

const passwordChangeFormSchema = z.object({
  password: z.string().nonempty("请输入新密码"),
  confirmPassword: z.string().nonempty("请再次输入新密码")
});

/**
 * Built-in renderer for the backend's forced password-change login challenge
 * (`security.PasswordChangeChallengeProvider`). Collects and confirms the new
 * password, encrypts it when the Login component provides `encrypt`, and
 * surfaces both resolve failures (e.g. a password-policy violation) and local
 * validation errors inline.
 */
export function PasswordChangeChallenge({
  challenge,
  pending,
  error,
  encrypt,
  resolve,
  cancel
}: PasswordChangeChallengeProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const reason = readReason(challenge.data);
  const subtitle = (reason && REASON_SUBTITLES[reason]) || DEFAULT_SUBTITLE;
  const displayError = localError ?? error;

  const {
    AppForm,
    Form,
    SubmitButton,
    AppField
  } = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    validators: {
      onSubmit: passwordChangeFormSchema
    },
    async onSubmit({ value }) {
      setLocalError(null);

      if (value.password !== value.confirmPassword) {
        setLocalError("两次输入的密码不一致");
        return;
      }

      let response = value.password;

      if (encrypt) {
        try {
          response = encrypt(value.password);
        } catch {
          setLocalError("密码加密失败, 请稍后重试");
          return;
        }
      }

      await resolve(response);
    }
  });

  return (
    <Stack gap="medium">
      <div css={styles.formHeader}>
        <h2>
          <Group align="center" gap="small">
            <Icon component={KeyRoundIcon} css={styles.formIcon} />
            设置新密码
          </Group>
        </h2>

        <p css={styles.formSubtitle}>{subtitle}</p>
      </div>

      {displayError && <Alert showIcon title={displayError} type="error" />}

      <AppForm>
        <Form>
          <Stack gap="medium">
            <AppField name="password">
              {field => (
                <field.Password
                  css={styles.formControl}
                  placeholder="请输入新密码"
                  size="large"
                />
              )}
            </AppField>

            <AppField name="confirmPassword">
              {field => (
                <field.Password
                  css={styles.formControl}
                  placeholder="请再次输入新密码"
                  size="large"
                />
              )}
            </AppField>

            <SubmitButton
              block
              css={styles.submitButton}
              size="large"
            >
              确认修改并登录
            </SubmitButton>

            <Button block disabled={pending} size="large" onClick={cancel}>
              返回登录
            </Button>
          </Stack>
        </Form>
      </AppForm>
    </Stack>
  );
}
