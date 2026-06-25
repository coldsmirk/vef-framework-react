import type { ReactNode } from "react";

import type { ErrorProps } from "./props";

import { Button, Center, Icon, Result, Spin, Text } from "@vef-framework-react/components";
import { motion, useQueryErrorResetBoundary } from "@vef-framework-react/core";
import { getSanitizedErrorStack } from "@vef-framework-react/shared";
import { RefreshCwIcon } from "lucide-react";
import { Suspense, use, useEffect, useMemo } from "react";

import { ErrorIcon } from "./error-icon";

const ERROR_TITLE = "啊哦，出错了～";

export function Error({
  error,
  info,
  reset
}: ErrorProps): ReactNode {
  const { reset: resetQueryError } = useQueryErrorResetBoundary();

  useEffect(resetQueryError);

  return (
    <Center css={{ height: "100%" }}>
      <Result
        extra={<RetryButton onRetry={reset} />}
        icon={<AnimatedIcon><ErrorIcon height="40vh" width="40vh" /></AnimatedIcon>}
        subTitle={<Text type="danger">{error.message}</Text>}
        title={ERROR_TITLE}
      >
        <Suspense fallback={<Center><Spin /></Center>}>
          <ErrorStack componentStack={info?.componentStack} error={error} />
        </Suspense>
      </Result>
    </Center>
  );
}

interface RetryButtonProps {
  onRetry: () => void;
}

function RetryButton({ onRetry }: RetryButtonProps): ReactNode {
  return (
    <Button
      icon={<Icon component={RefreshCwIcon} />}
      size="large"
      type="primary"
      onClick={onRetry}
    >
      重试一下
    </Button>
  );
}

interface AnimatedIconProps {
  children: ReactNode;
}

function AnimatedIcon({ children }: AnimatedIconProps): ReactNode {
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      initial={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

interface ErrorStackProps {
  componentStack?: string;
  error: Error;
}

function getErrorStack(error: Error, componentStack?: string): Promise<string | undefined> {
  if (componentStack) {
    return Promise.resolve(componentStack);
  }

  return getSanitizedErrorStack(error);
}

function ErrorStack({ componentStack, error }: ErrorStackProps): ReactNode {
  const stackPromise = useMemo(
    () => getErrorStack(error, componentStack),
    [error, componentStack]
  );
  const stack = use(stackPromise);

  return <pre css={{ whiteSpace: "pre-wrap" }}>{stack}</pre>;
}
