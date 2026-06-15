import type { ReactNode } from "react";

import type { TypingAnimationProps } from "./props";

import { motion, useInView } from "@vef-framework-react/core";
import { Children, useEffect, useRef, useState } from "react";

export function TypingAnimation({
  children,
  duration = 100,
  delay = 0,
  startOnView = false,
  ...props
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState<string>("");
  // `started` is a signal between two effects: one decides when to start,
  // the other consumes the signal to run the typing interval. The rule
  // flags it as unused because reads happen only inside an effect.

  const [started, setStarted] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(elementRef, {
    amount: 0.3,
    once: true
  });

  useEffect(() => {
    if (!startOnView) {
      const startTimeout = setTimeout(() => {
        setStarted(true);
      }, delay);
      return () => clearTimeout(startTimeout);
    }

    if (!isInView) {
      return;
    }

    const startTimeout = setTimeout(() => {
      setStarted(true);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [delay, startOnView, isInView]);

  useEffect(() => {
    if (!started) {
      return;
    }

    const graphemes = [...Children.toArray(children as ReactNode).join("")];
    let index = 0;
    const typingEffect = setInterval(() => {
      if (index < graphemes.length) {
        setDisplayedText(graphemes.slice(0, index + 1).join(""));
        index++;
      } else {
        clearInterval(typingEffect);
      }
    }, duration);

    return () => {
      clearInterval(typingEffect);
    };
  }, [children, duration, started]);

  return (
    <motion.div
      ref={elementRef}
      {...props}
    >
      {displayedText}
    </motion.div>
  );
}

export { type TypingAnimationProps } from "./props";
