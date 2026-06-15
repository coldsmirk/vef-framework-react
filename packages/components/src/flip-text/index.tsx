import type { Variants } from "@vef-framework-react/core";

import type { FlipTextProps } from "./props";

import { css } from "@emotion/react";
import { AnimatePresence, motion } from "@vef-framework-react/core";
import { Children } from "react";

import { Center } from "../center";

const defaultVariants: Variants = {
  hidden: { rotateX: -90, opacity: 0 },
  visible: { rotateX: 0, opacity: 1 }
};

const charStyle = css({
  filter: "drop-shadow(0 1px 2px #00000026)",
  transformOrigin: "50%"
});

export function FlipText({
  className,
  style,
  duration = 0.5,
  delayMultiple = 0.08,
  repeat = 0,
  children
}: FlipTextProps) {
  const characters = [...Children.toArray(children).join("")];

  return (
    <AnimatePresence mode="wait">
      <Center className={className} gap={4} style={style}>
        {
          characters.map((char, index) => (
            <motion.span

              key={index}
              animate="visible"
              css={charStyle}
              exit="hidden"
              initial="hidden"
              variants={defaultVariants}
              transition={{
                delay: index * delayMultiple,
                duration,
                repeat,
                repeatType: "reverse"
              }}
            >
              {char}
            </motion.span>
          ))
        }
      </Center>
    </AnimatePresence>
  );
}

export { type FlipTextProps } from "./props";
