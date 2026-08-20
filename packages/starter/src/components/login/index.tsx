import type { CSSProperties } from "react";

import type { LoginParams } from "./payload";
import type { LoginProps } from "./props";

import { Alert, Center, Group, Icon, LogoIcon, SplitText, Stack, TypingAnimation, useForm, useThemeTokens } from "@vef-framework-react/components";
import { useInterval } from "@vef-framework-react/hooks";
import { getLocalizedDateTime, z } from "@vef-framework-react/shared";
import {
  LockKeyholeIcon,
  SparklesIcon,
  UserRoundIcon
} from "lucide-react";
import { memo, useState } from "react";

import { LoginChallengeOutlet } from "./challenge-outlet";
import { IconLogin } from "./icon-login";
import * as styles from "./styles";
import { useLoginFlow } from "./use-login-flow";

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

  const flow = useLoginFlow({
    onLogin,
    onResolveChallenge,
    publicKey
  });

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
      await flow.login({
        ...value,
        credentials: flow.encrypt ? flow.encrypt(value.credentials) : value.credentials
      });
    }
  });

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

        {flow.challenge
          ? (
              <LoginChallengeOutlet
                flow={flow}
                renderers={challengeRenderers}
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
                      {flow.error && (
                        <Alert
                          showIcon
                          closable={{ onClose: flow.clearError }}
                          title={flow.error}
                          type="error"
                        />
                      )}

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

export { LoginChallengeOutlet, type LoginChallengeOutletProps } from "./challenge-outlet";
export { PASSWORD_CHANGE_CHALLENGE_TYPE, PasswordChangeChallenge, type PasswordChangeChallengeData, type PasswordChangeChallengeProps, type PasswordChangeChallengeSpec, type PasswordChangeReason } from "./password-change-challenge";
export { type LoginChallenge, type LoginParams, type LoginResult, type PasswordLoginParams, type ResolveChallengeParams } from "./payload";
export { type LoginChallengeRenderer, type LoginChallengeRendererProps, type LoginChallengeRenderers, type LoginProps } from "./props";
export { useLoginFlow, type LoginFlow, type UseLoginFlowOptions } from "./use-login-flow";
