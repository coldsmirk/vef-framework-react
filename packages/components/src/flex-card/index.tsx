import type { ReactElement } from "react";

import type { FlexCardProps } from "./props";

import { Card } from "../card";
import * as styles from "./styles";

export function FlexCard({
  variant = "outlined",
  ...props
}: FlexCardProps): ReactElement {
  return (
    <Card
      css={styles.container}
      variant={variant}
      {...props}
    />
  );
}

export type { FlexCardProps } from "./props";
