import { useLocation, useNavigate } from "@tanstack/react-router";
import { Button, Center, Icon, Result } from "@vef-framework-react/components";
import { motion } from "@vef-framework-react/core";
import { ArrowLeftIcon } from "lucide-react";
import { useCallback } from "react";

import { INDEX_ROUTE_PATH } from "../../constants";
import { NotFoundIcon } from "./not-found-icon";

const NOT_FOUND_TITLE = "抱歉, 您访问的页面不存在!";

export function NotFound(): React.ReactNode {
  const navigate = useNavigate();
  const pathname = useLocation({ select: state => state.pathname });

  const handleNavigateHome = useCallback(() => {
    navigate({ replace: true, to: INDEX_ROUTE_PATH });
  }, [navigate]);

  return (
    <Center css={{ height: "100%" }}>
      <Result
        extra={<HomeButton onClick={handleNavigateHome} />}
        icon={<AnimatedIcon><NotFoundIcon height="40vh" width="40vh" /></AnimatedIcon>}
        subTitle={pathname}
        title={NOT_FOUND_TITLE}
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
