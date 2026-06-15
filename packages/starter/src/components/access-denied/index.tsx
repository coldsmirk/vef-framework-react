import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button, Center, Icon, Result } from "@vef-framework-react/components";
import { motion } from "@vef-framework-react/core";
import { ArrowLeftIcon } from "lucide-react";
import { useCallback } from "react";

import { INDEX_ROUTE_PATH } from "../../constants";
import { AccessDeniedIcon } from "./access-denied-icon";

const ACCESS_DENIED_TITLE = "抱歉, 您没有权限访问该页面!";

export function AccessDenied(): React.ReactNode {
  const { redirect } = useRouterState();
  const navigate = useNavigate();

  const handleNavigateHome = useCallback(() => {
    navigate({ replace: true, to: INDEX_ROUTE_PATH });
  }, [navigate]);

  const deniedPath = redirect?.options._fromLocation?.pathname ?? null;

  return (
    <Center css={{ height: "100%" }}>
      <Result
        extra={<HomeButton onClick={handleNavigateHome} />}
        icon={<AnimatedIcon><AccessDeniedIcon height="40vh" width="40vh" /></AnimatedIcon>}
        subTitle={deniedPath}
        title={ACCESS_DENIED_TITLE}
      />
    </Center>
  );
}

interface HomeButtonProps {
  onClick: () => void;
}

function HomeButton({ onClick }: HomeButtonProps): React.ReactNode {
  return (
    <Button
      icon={<Icon component={ArrowLeftIcon} />}
      size="large"
      type="primary"
      onClick={onClick}
    >
      回到首页
    </Button>
  );
}

interface AnimatedIconProps {
  children: React.ReactNode;
}

function AnimatedIcon({ children }: AnimatedIconProps): React.ReactNode {
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
