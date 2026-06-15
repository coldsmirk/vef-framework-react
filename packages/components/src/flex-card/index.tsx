import type { FlexCardProps } from "./props";

import { Card } from "../card";
import * as styles from "./styles";

export function FlexCard({
  variant = "outlined",
  ...props
}: FlexCardProps): React.ReactElement {
  return (
    <Card
      css={styles.container}
      variant={variant}
      {...props}
    />
  );
}

export type { FlexCardProps } from "./props";
