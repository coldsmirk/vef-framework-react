import type { CSSProperties } from "react";

import type { LoaderProps } from "./props";

import { isNumber } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { styles } from "../_base";
import { Center } from "../center";
import { FlipText } from "../flip-text";
import { Spin } from "../spin";

export function Loader({
  size = "default",
  description,
  descriptionSize
}: LoaderProps) {
  const spinProps = useMemo(() => {
    if (isNumber(size)) {
      return {
        style: {
          "--vef-spin-dot-size": `${size}px`
        } as CSSProperties,
        size: "default" as const
      };
    }

    return {
      size
    };
  }, [size]);

  const descriptionStyle = useMemo(() => {
    if (isNumber(descriptionSize)) {
      return {
        fontSize: descriptionSize
      };
    }
  }, [descriptionSize]);

  return (
    <Center
      css={styles.fullHeight}
      gap="large"
      orientation="vertical"
    >
      <Spin {...spinProps} />

      {
        description && (
          <FlipText
            duration={1}
            repeat={Infinity}
            style={descriptionStyle}
          >
            {description}
          </FlipText>
        )
      }
    </Center>
  );
}

export { type LoaderProps } from "./props";
