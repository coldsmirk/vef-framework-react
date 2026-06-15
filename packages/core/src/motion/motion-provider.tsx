import type { Transition } from "motion/react";
import type { ReactNode } from "react";

import { generateId } from "@vef-framework-react/shared";
import { LazyMotion, MotionConfig } from "motion/react";
import { useState } from "react";

interface MotionProviderProps {
  children: ReactNode;
}

const loadFeatures = () => import("./features").then(result => result.default);

const defaultTransition: Transition = {
  duration: 0.2,
  ease: "easeInOut"
};

/**
 * Motion provider component that wraps the application with LazyMotion and MotionConfig.
 * Uses lazy loading for motion features to optimize bundle size.
 */
export default function MotionProvider({ children }: MotionProviderProps): ReactNode {
  const [nonce] = useState(generateId);

  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig
        nonce={nonce}
        reducedMotion="user"
        transition={defaultTransition}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
