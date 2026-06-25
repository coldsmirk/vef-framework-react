import type { ReactNode } from "react";

import { useNProgress } from "@tanem/react-nprogress";
import { useEmitterEvent } from "@vef-framework-react/hooks";
import { useState } from "react";

import { Bar, Container } from "./components";
import { nProgressEventEmitter } from "./event";

export function NProgress(): ReactNode {
  const [isAnimating, setIsAnimating] = useState(false);
  const {
    animationDuration,
    isFinished,
    progress
  } = useNProgress({ isAnimating });

  useEmitterEvent(nProgressEventEmitter, "start", () => setIsAnimating(true));
  useEmitterEvent(nProgressEventEmitter, "complete", () => setIsAnimating(false));

  return (
    <Container animationDuration={animationDuration} isFinished={isFinished}>
      <Bar progress={progress} />
    </Container>
  );
}

export { nProgressEventEmitter } from "./event";
