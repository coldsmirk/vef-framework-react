import type { CSSProperties } from "react";

import type { LoginChallenge, LoginParams, LoginResult } from "./payload";
import type { LoginChallengeRenderer, LoginChallengeRenderers, LoginProps } from "./props";

import { useRouter, useSearch } from "@tanstack/react-router";
import { Alert, Button, Center, Group, Icon, LogoIcon, showSuccessNotification, SplitText, Stack, TypingAnimation, useForm, useThemeTokens } from "@vef-framework-react/components";
import { useInterval } from "@vef-framework-react/hooks";
import { encryptUsingRSA, getLocalizedDateTime, noop, z } from "@vef-framework-react/shared";
import {
  LockKeyholeIcon,
  SparklesIcon,
  UserRoundIcon
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useAppStore } from "../../stores";
import { IconLogin } from "./icon-login";
import * as styles from "./styles";
import { getRandomWelcomeMessage } from "./welcome-messages";

const DEFAULT_TITLE = "VEF 中后台管理系统";
const DEFAULT_DESCRIPTION = "一款极度快速的开发框架, 用于构建中后台管理系统";

const leftContentStyle: CSSProperties = {
  position: "relative",
  zIndex: 1
};

const userIcon = <Icon component={UserRoundIcon} />;
const lockIcon = <Icon component={LockKeyholeIcon} />;

const loginFormSchema = z.object({
  type: z.literal("password"),
  principal: z.string().nonempty("请输入账号"),
  credentials: z.string().nonempty("请输入密码")
});

const defaultLoginValues: LoginParams = {
  type: "password",
  principal: "",
  credentials: ""
};

interface PendingChallenge {
  token: string;
  challenge: LoginChallenge;
}

export function Login({
  logo,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  publicKey,
  onLogin,
  onResolveChallenge,
  challengeRenderers
}: LoginProps) {
  const { colorPrimary } = useThemeTokens();

  const router = useRouter();
  const { redirect } = useSearch({ strict: false });

  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);
  const [challengePending, setChallengePending] = useState(false);

  const encrypt = useMemo(() => {
    if (!publicKey) {
      return;
    }

    return (plaintext: string) => encryptUsingRSA(plaintext, publicKey);
  }, [publicKey]);

  async function applyLoginResult(result: LoginResult) {
    if (result.challenge && result.challengeToken) {
      setPendingChallenge({
        token: result.challengeToken,
        challenge: result.challenge
      });
      return;
    }

    if (!result.tokens) {
      return;
    }

    useAppStore.setState(state => {
      state.isAuthenticated = true;
      state.authTokens = result.tokens;
    });
    setPendingChallenge(null);

    await router.invalidate();
    await router.navigate({
      to: redirect,
      replace: true
    });

    showSuccessNotification(getRandomWelcomeMessage(), {
      title: result.message || "登录成功"
    });
  }

  const {
    AppForm,
    Form,
    SubmitButton,
    AppField
  } = useForm({
    defaultValues: defaultLoginValues,
    validators: {
      onSubmit: loginFormSchema
    },
    async onSubmit({ value }) {
      const credentials = publicKey
        ? encryptUsingRSA(value.credentials, publicKey)
        : value.credentials;

      const result = await onLogin({ ...value, credentials }).catch(noop);

      if (!result) {
        return;
      }

      await applyLoginResult(result);
    }
  });

  async function resolveChallenge(response: unknown) {
    if (!pendingChallenge || !onResolveChallenge) {
      return;
    }

    setChallengePending(true);

    try {
      const result = await onResolveChallenge({
        challengeToken: pendingChallenge.token,
        type: pendingChallenge.challenge.type,
        response
      }).catch(noop);

      if (result) {
        await applyLoginResult(result);
      }
    } finally {
      setChallengePending(false);
    }
  }

  function cancelChallenge() {
    setPendingChallenge(null);
    setChallengePending(false);
  }

  return (
    <Group css={styles.login} gap={0} justify="center">
      {/* Background orb decorations */}
      <div css={styles.backgroundOrbs}>
        <div css={[styles.orb, styles.orbPrimary]} />
        <div css={[styles.orb, styles.orbSecondary]} />
        <div css={[styles.orb, styles.orbAccent]} />
      </div>

      <div css={styles.logo}>
        {logo || <LogoIcon primaryColor={colorPrimary} />}
      </div>

      <Stack align="center" css={styles.leftContent}>
        <Stack css={styles.title} style={leftContentStyle}>
          <SplitText
            delay={80}
            duration={3}
            ease="elastic.out(1, 0.3)"
            from={{ opacity: 0, y: 18 }}
            rootMargin="0"
            splitType="chars"
            tag="h1"
            text={title}
            textAlign="center"
            threshold={0.1}
            to={{ opacity: 1, y: 0 }}
          />

          <div css={styles.description}>
            <TypingAnimation>{description}</TypingAnimation>
          </div>
        </Stack>

        <Center css={styles.icon} style={leftContentStyle}>
          <IconLogin />
        </Center>
      </Stack>

      <div css={styles.rightContent}>
        <Today />

        {pendingChallenge
          ? (
              <ChallengeView
                challenge={pendingChallenge.challenge}
                encrypt={encrypt}
                pending={challengePending}
                renderers={challengeRenderers}
                onCancel={cancelChallenge}
                onResolve={resolveChallenge}
              />
            )
          : (
              <>
                <div css={styles.formHeader}>
                  <h2>
                    <Group align="center" gap="small">
                      <Icon component={SparklesIcon} css={styles.formIcon} />
                      欢迎回来
                    </Group>
                  </h2>

                  <p css={styles.formSubtitle}>请输入您的账号和密码进行登录</p>
                </div>

                <AppForm>
                  <Form>
                    <Stack gap="medium">
                      <AppField name="principal">
                        {field => (
                          <field.Input
                            css={styles.formControl}
                            placeholder="请输入账号"
                            prefix={userIcon}
                            size="large"
                          />
                        )}
                      </AppField>

                      <AppField name="credentials">
                        {field => (
                          <field.Password
                            css={styles.formControl}
                            placeholder="请输入密码"
                            prefix={lockIcon}
                            size="large"
                          />
                        )}
                      </AppField>

                      <SubmitButton
                        block
                        css={styles.submitButton}
                        size="large"
                      >
                        登录
                      </SubmitButton>
                    </Stack>
                  </Form>
                </AppForm>
              </>
            )}

        <Copyright />
      </div>
    </Group>
  );
}

interface ChallengeViewProps {
  challenge: LoginChallenge;
  pending: boolean;
  renderers?: LoginChallengeRenderers;
  encrypt?: (plaintext: string) => string;
  onResolve: (response: unknown) => Promise<void>;
  onCancel: () => void;
}

function ChallengeView({
  challenge,
  pending,
  renderers,
  encrypt,
  onResolve,
  onCancel
}: ChallengeViewProps) {
  // Indexing into the per-key renderer map at runtime yields a union of
  // function types; widen to the default-generic form so the call site
  // accepts `LoginChallenge` (the full discriminated union) directly.
  const renderer = renderers?.[challenge.type] as LoginChallengeRenderer | undefined;

  if (!renderer) {
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
          message="不支持的登录挑战"
          type="warning"
        />

        <Button block size="large" onClick={onCancel}>
          返回登录
        </Button>
      </Stack>
    );
  }

  return (
    <>
      {renderer({
        challenge,
        pending,
        encrypt,
        resolve: onResolve,
        cancel: onCancel
      })}
    </>
  );
}

const Today = memo(() => {
  const [today, setToday] = useState(getLocalizedDateTime);

  useInterval(
    () => setToday(getLocalizedDateTime()),
    1000,
    { autoInvoke: true }
  );

  return (
    <div css={styles.date}>
      <span>今天是 </span>
      <span css={styles.dateHighlight}>{today}</span>
    </div>
  );
});
Today.displayName = "Today";

const currentYear = new Date().getFullYear();

function Copyright() {
  return (
    <div css={styles.copyright}>
      Copyright &copy;
      {" "}
      {currentYear}
      {" "}
      VEF. All rights reserved.
    </div>
  );
}

export { type LoginChallenge, type LoginParams, type LoginResult, type PasswordLoginParams, type ResolveChallengeParams } from "./payload";
export { type LoginChallengeRenderer, type LoginChallengeRendererProps, type LoginChallengeRenderers, type LoginProps } from "./props";
